import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { readCharacterVitalsResourcesFromDatabase } from "../../server.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DATABASE = path.join(ROOT, "prisma", "migration.db");
const MIGRATION_SCRIPT = path.join(ROOT, "scripts", "apply-character-subclass-correction.mjs");
const DRACONIC_MIGRATION_SCRIPT = path.join(ROOT, "scripts", "apply-character-draconic-ancestry.mjs");
const temporaryDirectories = [];
const childProcesses = [];

afterEach(async () => {
  for (const child of childProcesses.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
  }
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, child, logs) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(logs());
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The child can still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server health timeout\n${logs()}`);
}

async function jsonRequest(baseUrl, pathname, { cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function setPassword(database, username, password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  database.prepare(`
    UPDATE "User" SET passwordSalt = ?, passwordHash = ?, mustChangePassword = 0, updatedAt = ?
    WHERE username = ?
  `).run(salt, passwordHash, new Date().toISOString(), username);
}

function protectedState(database, characterId) {
  const read = (sql, ...params) => database.prepare(sql).all(...params).map((row) => ({ ...row }));
  return {
    characterData: JSON.parse(database.prepare('SELECT data FROM "Character" WHERE id = ?').get(characterId).data),
    hitPoints: read('SELECT * FROM "CharacterHitPointState" WHERE characterId = ?', characterId),
    hitDice: read('SELECT * FROM "CharacterHitDiePool" WHERE characterId = ? ORDER BY dieSize, id', characterId),
    resourcePools: read('SELECT * FROM "CharacterResourcePool" WHERE characterId = ? ORDER BY poolKey, id', characterId),
    resourceSources: read(`
      SELECT s.* FROM "CharacterResourcePoolSource" s
      JOIN "CharacterResourcePool" p ON p.id = s.poolId
      WHERE p.characterId = ? ORDER BY s.poolId, s.sourceKey, s.id
    `, characterId),
    resourceTiers: read(`
      SELECT t.* FROM "CharacterResourcePoolTier" t
      JOIN "CharacterResourcePool" p ON p.id = t.poolId
      WHERE p.characterId = ? ORDER BY t.poolId, t.tierKey, t.id
    `, characterId),
  };
}

describe("DM subclass correction HTTP apply", () => {
  it("preserves a historical sheet and manual resources across apply, conflict, replay and correction", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-subclass-http-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "migration.db");
    const appDataPath = path.join(directory, "app-data");
    const notesPath = path.join(directory, "dm-notes");
    copyFileSync(SOURCE_DATABASE, databasePath);
    mkdirSync(appDataPath, { recursive: true });
    mkdirSync(notesPath, { recursive: true });
    const migration = spawnSync(process.execPath, [MIGRATION_SCRIPT, "--apply", "--database", databasePath], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(migration.status, migration.stderr).toBe(0);
    const draconicMigration = spawnSync(process.execPath, [DRACONIC_MIGRATION_SCRIPT, "--apply", "--database", databasePath], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(draconicMigration.status, draconicMigration.stderr).toBe(0);

    const database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON;");
    const character = database.prepare(`
      SELECT c.id, c.slug, cc.level AS classLevel FROM "Character" c
      JOIN "CharacterClass" cc ON cc.characterId = c.id
      WHERE cc.classKey = 'rogue' AND cc.level >= 3
      ORDER BY c.slug LIMIT 1
    `).get();
    expect(character).toBeTruthy();
    const derivedCharacter = database.prepare(`
      SELECT c.id, c.slug, c.data, cc.level AS classLevel FROM "Character" c
      JOIN "CharacterClass" cc ON cc.characterId = c.id
      JOIN "CharacterResourcePool" p ON p.characterId = c.id AND p.kind = 'SPELLCASTING'
      WHERE cc.classKey = 'bard' AND cc.level >= 3
      ORDER BY c.slug LIMIT 1
    `).get();
    expect(derivedCharacter).toBeTruthy();
    const dm = database.prepare("SELECT username FROM \"User\" WHERE role = 'DM' ORDER BY id LIMIT 1").get();
    const player = database.prepare("SELECT username FROM \"User\" WHERE role = 'PLAYER' ORDER BY id LIMIT 1").get();
    expect(dm && player).toBeTruthy();
    setPassword(database, dm.username, "SubclassDmPassword!1");
    setPassword(database, player.username, "SubclassPlayerPassword!1");
    database.prepare(`
      UPDATE "CharacterClass"
      SET subclassRuleId = NULL, subclassStatus = 'INCOMPLETE_LEGACY', source = 'TEST_FIXTURE'
      WHERE characterId = ? AND classKey = 'rogue'
    `).run(character.id);
    database.prepare('DELETE FROM "CharacterSubclassHistory" WHERE characterId = ?').run(character.id);
    database.prepare('DELETE FROM "CharacterResourcePool" WHERE characterId = ?').run(character.id);
    const derivedData = JSON.parse(derivedCharacter.data);
    derivedData.combatStats = {
      ...(derivedData.combatStats ?? {}),
      deathSaves: {
        ...(derivedData.combatStats?.deathSaves ?? {}),
        legacySuccessMarkers: ["first", "second"],
        customNote: "preserve-this-death-save-data",
      },
      historicalRestLedger: {
        short: [{ id: "rest-old", detail: "manual" }],
        customCounter: 9,
      },
    };
    database.prepare('UPDATE "Character" SET data = ?, updatedAt = ? WHERE id = ?')
      .run(JSON.stringify(derivedData), "2026-10-15T13:00:00.001Z", derivedCharacter.id);
    database.prepare(`
      UPDATE "CharacterClass"
      SET subclassRuleId = NULL, subclassStatus = 'INCOMPLETE_LEGACY', source = 'TEST_FIXTURE'
      WHERE characterId = ? AND classKey = 'bard'
    `).run(derivedCharacter.id);
    database.prepare('DELETE FROM "CharacterSubclassHistory" WHERE characterId = ?').run(derivedCharacter.id);
    database.prepare(`
      DELETE FROM "CharacterResourcePoolSource"
      WHERE poolId IN (SELECT id FROM "CharacterResourcePool" WHERE characterId = ? AND kind = 'SPELLCASTING')
    `).run(derivedCharacter.id);
    const now = "2026-10-15T13:00:00.000Z";
    database.prepare(`
      INSERT INTO "CharacterResourcePool" (
        id, characterId, poolKey, kind, label, resetPolicy, revision, backfillStatus,
        backfillIssues, metadata, ruleSnapshot, legacySnapshot, createdAt, updatedAt
      ) VALUES ('test:manual-pool', ?, 'legacy:manual', 'MANUAL', 'Slot storici', 'MANUAL', 7,
        'LEGACY_MANUAL', '[]', '{}', '{}', '{"source":"test"}', ?, ?)
    `).run(character.id, now, now);
    database.prepare(`
      INSERT INTO "CharacterResourcePoolTier" (
        id, poolId, tierKey, sortOrder, derivedMaximum, maximumOverride, used, createdAt, updatedAt
      ) VALUES ('test:manual-tier', 'test:manual-pool', '1', 0, NULL, 2, 1, ?, ?)
    `).run(now, now);
    database.close();

    const port = await reservePort();
    const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(port),
        SQLITE_DB_FILE: databasePath,
        APP_DATA_DIR: appDataPath,
        DM_NOTES_ROOT: notesPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    childProcesses.push(child);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(baseUrl, child, () => `${stdout}\n${stderr}`);

    const dmLogin = await jsonRequest(baseUrl, "/api/auth/login", {
      body: { username: dm.username, password: "SubclassDmPassword!1" },
    });
    expect(dmLogin.response.status).toBe(200);
    const dmCookie = dmLogin.response.headers.get("set-cookie")?.split(";")[0];
    expect(dmCookie).toMatch(/^ctf_session=/);
    const playerLogin = await jsonRequest(baseUrl, "/api/auth/login", {
      body: { username: player.username, password: "SubclassPlayerPassword!1" },
    });
    const playerCookie = playerLogin.response.headers.get("set-cookie")?.split(";")[0];
    const forbidden = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/preview`, {
      cookie: playerCookie,
      body: { targetClassKey: "rogue" },
    });
    expect(forbidden.response.status).toBe(403);

    const initialPreview = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/preview`, {
      cookie: dmCookie,
      body: { targetClassKey: "rogue", targetSubclassKey: "thief" },
    });
    expect(initialPreview.response.status, JSON.stringify(initialPreview.payload)).toBe(200);
    expect(initialPreview.payload.preview).toMatchObject({
      status: "READY",
      canApply: true,
      effects: { spellSlots: { changed: false, strategy: "PRESERVE_MANUAL" } },
    });
    const beforeDatabase = new DatabaseSync(databasePath, { readOnly: true });
    const beforeProtected = protectedState(beforeDatabase, character.id);
    beforeDatabase.close();
    // These legacy fields mirror authoritative resource/wallet data on save.
    const projectedBefore = await jsonRequest(baseUrl, `/api/characters/${character.slug}`, { cookie: dmCookie });
    expect(projectedBefore.response.status).toBe(200);
    beforeProtected.characterData.combatStats.spellSlots = projectedBefore.payload.combatStats.spellSlots;
    beforeProtected.characterData.currencyBalance = projectedBefore.payload.currencyBalance;
    expect(beforeProtected.characterData.combatStats.spellSlots["1"]).toEqual([
      { id: "legacy:manual-1-1", active: true },
      { id: "legacy:manual-1-2", active: false },
    ]);
    const firstRequest = {
      targetClassKey: "rogue",
      targetSubclassKey: "thief",
      requestId: "subclass-http-assign-001",
      expectedRevision: initialPreview.payload.revision,
      expectedProgressionRevision: initialPreview.payload.progressionRevision,
    };
    const applied = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/apply`, {
      cookie: dmCookie,
      body: firstRequest,
    });
    expect(applied.response.status, JSON.stringify(applied.payload)).toBe(200);
    expect(applied.payload).toMatchObject({ ok: true, replayed: false, progressionRevision: initialPreview.payload.progressionRevision + 1 });

    const afterFirstDatabase = new DatabaseSync(databasePath, { readOnly: true });
    expect(protectedState(afterFirstDatabase, character.id)).toEqual(beforeProtected);
    expect(afterFirstDatabase.prepare('SELECT COUNT(*) AS count FROM "CharacterSubclassHistory" WHERE characterId = ?').get(character.id).count).toBe(1);
    afterFirstDatabase.close();

    const replay = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/apply`, {
      cookie: dmCookie,
      body: firstRequest,
    });
    expect(replay.response.status).toBe(200);
    expect(replay.payload).toMatchObject({ replayed: true, requestId: firstRequest.requestId });

    const stale = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/apply`, {
      cookie: dmCookie,
      body: {
        targetClassKey: "rogue",
        targetSubclassKey: "arcane-trickster",
        reason: "Correzione storica",
        requestId: "subclass-http-stale-001",
        expectedRevision: initialPreview.payload.revision,
        expectedProgressionRevision: initialPreview.payload.progressionRevision,
      },
    });
    expect(stale.response.status).toBe(409);
    expect(stale.payload.code).toBe("REVISION_CONFLICT");

    const missingReason = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/preview`, {
      cookie: dmCookie,
      body: { targetClassKey: "rogue", targetSubclassKey: "arcane-trickster" },
    });
    expect(missingReason.payload.preview).toMatchObject({ status: "REASON_REQUIRED", canApply: false });
    const correctionPreview = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/preview`, {
      cookie: dmCookie,
      body: { targetClassKey: "rogue", targetSubclassKey: "arcane-trickster", reason: "Correzione storica" },
    });
    expect(correctionPreview.payload.preview).toMatchObject({ status: "READY", canApply: true, mode: "CHANGE" });
    const corrected = await jsonRequest(baseUrl, `/api/dm/characters/${character.slug}/subclass/apply`, {
      cookie: dmCookie,
      body: {
        targetClassKey: "rogue",
        targetSubclassKey: "arcane-trickster",
        reason: "Correzione storica",
        requestId: "subclass-http-change-001",
        expectedRevision: correctionPreview.payload.revision,
        expectedProgressionRevision: correctionPreview.payload.progressionRevision,
      },
    });
    expect(corrected.response.status, JSON.stringify(corrected.payload)).toBe(200);
    expect(corrected.payload.operation).toMatchObject({ mode: "CHANGE", reason: "Correzione storica" });

    const finalDatabase = new DatabaseSync(databasePath, { readOnly: true });
    expect(protectedState(finalDatabase, character.id)).toEqual(beforeProtected);
    expect(finalDatabase.prepare('SELECT COUNT(*) AS count FROM "CharacterSubclassHistory" WHERE characterId = ?').get(character.id).count).toBe(2);
    expect(finalDatabase.prepare(`
      SELECT sr.subclassKey, cc.level FROM "CharacterClass" cc
      JOIN "SubclassRule" sr ON sr.id = cc.subclassRuleId
      WHERE cc.characterId = ? AND cc.classKey = 'rogue'
    `).get(character.id)).toMatchObject({ subclassKey: "arcane-trickster", level: character.classLevel });
    expect(finalDatabase.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    finalDatabase.close();

    const derivedPreview = await jsonRequest(baseUrl, `/api/dm/characters/${derivedCharacter.slug}/subclass/preview`, {
      cookie: dmCookie,
      body: { targetClassKey: "bard", targetSubclassKey: "college-of-lore" },
    });
    expect(derivedPreview.response.status, JSON.stringify(derivedPreview.payload)).toBe(200);
    expect(derivedPreview.payload.preview.effects.spellSlots.changed).toBe(true);
    const derivedBeforeDatabase = new DatabaseSync(databasePath, { readOnly: true });
    const derivedBefore = protectedState(derivedBeforeDatabase, derivedCharacter.id);
    derivedBeforeDatabase.close();
    const projectedDerivedBefore = await jsonRequest(baseUrl, `/api/characters/${derivedCharacter.slug}`, { cookie: dmCookie });
    expect(projectedDerivedBefore.response.status).toBe(200);
    derivedBefore.characterData.currencyBalance = projectedDerivedBefore.payload.currencyBalance;
    const derivedApplied = await jsonRequest(baseUrl, `/api/dm/characters/${derivedCharacter.slug}/subclass/apply`, {
      cookie: dmCookie,
      body: {
        targetClassKey: "bard",
        targetSubclassKey: "college-of-lore",
        requestId: "subclass-http-derived-001",
        expectedRevision: derivedPreview.payload.revision,
        expectedProgressionRevision: derivedPreview.payload.progressionRevision,
      },
    });
    expect(derivedApplied.response.status, JSON.stringify(derivedApplied.payload)).toBe(200);
    const derivedAfterDatabase = new DatabaseSync(databasePath, { readOnly: true });
    const derivedAfter = protectedState(derivedAfterDatabase, derivedCharacter.id);
    const beforeWithoutSlots = structuredClone(derivedBefore.characterData);
    const afterWithoutSlots = structuredClone(derivedAfter.characterData);
    delete beforeWithoutSlots.combatStats.spellSlots;
    delete afterWithoutSlots.combatStats.spellSlots;
    expect(afterWithoutSlots).toEqual(beforeWithoutSlots);
    expect(derivedAfter.characterData.combatStats.deathSaves).toEqual(derivedBefore.characterData.combatStats.deathSaves);
    expect(derivedAfter.characterData.combatStats.historicalRestLedger).toEqual(
      derivedBefore.characterData.combatStats.historicalRestLedger,
    );
    expect(derivedAfter.hitPoints).toEqual(derivedBefore.hitPoints);
    expect(derivedAfter.hitDice).toEqual(derivedBefore.hitDice);
    const persistedResources = JSON.parse(JSON.stringify(
      readCharacterVitalsResourcesFromDatabase(derivedAfterDatabase, derivedCharacter.id).resourcePools,
    ));
    expect(derivedApplied.payload.character.resourcePools).toEqual(persistedResources);
    const derivedHistory = derivedAfterDatabase.prepare(`
      SELECT requestSnapshot, afterSnapshot, resultSnapshot FROM "CharacterSubclassHistory"
      WHERE characterId = ? AND requestId = ?
    `).get(derivedCharacter.id, "subclass-http-derived-001");
    expect(JSON.parse(derivedHistory.afterSnapshot).resourcePools).toEqual(persistedResources);
    expect(JSON.parse(derivedHistory.resultSnapshot).character.resourcePools).toEqual(persistedResources);
    expect(derivedAfterDatabase.prepare(`
      SELECT cc.level, sr.subclassKey FROM "CharacterClass" cc
      JOIN "SubclassRule" sr ON sr.id = cc.subclassRuleId
      WHERE cc.characterId = ? AND cc.classKey = 'bard'
    `).get(derivedCharacter.id)).toMatchObject({
      level: Number(derivedCharacter.classLevel),
      subclassKey: "college-of-lore",
    });
    derivedAfterDatabase.close();
    const derivedReplay = await jsonRequest(baseUrl, `/api/dm/characters/${derivedCharacter.slug}/subclass/apply`, {
      cookie: dmCookie,
      body: JSON.parse(derivedHistory.requestSnapshot),
    });
    expect(derivedReplay.response.status).toBe(200);
    expect(derivedReplay.payload.replayed).toBe(true);
    expect(derivedReplay.payload.character.resourcePools).toEqual(persistedResources);
  }, 40_000);
});
