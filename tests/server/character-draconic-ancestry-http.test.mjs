import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DATABASE = path.join(ROOT, "prisma", "migration.db");
const SUBCLASS_SCRIPT = path.join(ROOT, "scripts", "apply-character-subclass-correction.mjs");
const DRACONIC_SCRIPT = path.join(ROOT, "scripts", "apply-character-draconic-ancestry.mjs");
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
      server.close((error) => error ? reject(error) : resolve(address.port));
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
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server health timeout\n${logs()}`);
}

async function post(baseUrl, pathname, cookie, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

function setPassword(database, username, password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  database.prepare(`
    UPDATE "User" SET passwordSalt = ?, passwordHash = ?, mustChangePassword = 0, updatedAt = ?
    WHERE username = ?
  `).run(salt, passwordHash, new Date().toISOString(), username);
}

function applyMigration(script, databasePath) {
  const result = spawnSync(process.execPath, [script, "--apply", "--database", databasePath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
}

describe("draconic ancestry HTTP persistence", () => {
  it("persists a PNG multiclass level-up and audits independent ancestor corrections", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-draconic-http-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "migration.db");
    const appDataPath = path.join(directory, "app-data");
    const notesPath = path.join(directory, "dm-notes");
    copyFileSync(SOURCE_DATABASE, databasePath);
    mkdirSync(appDataPath, { recursive: true });
    mkdirSync(notesPath, { recursive: true });
    applyMigration(SUBCLASS_SCRIPT, databasePath);
    applyMigration(DRACONIC_SCRIPT, databasePath);

    const setup = new DatabaseSync(databasePath);
    setup.exec("PRAGMA foreign_keys = ON");
    const dm = setup.prepare("SELECT username FROM \"User\" WHERE role = 'DM' ORDER BY id LIMIT 1").get();
    expect(dm).toBeTruthy();
    setPassword(setup, dm.username, "DraconicDmPassword!1");
    const multiclass = setup.prepare("SELECT id, slug FROM \"Character\" WHERE slug = 'valthor'").get();
    const historical = setup.prepare("SELECT id, slug FROM \"Character\" WHERE slug = 'pippo'").get();
    expect(multiclass && historical).toBeTruthy();
    // The copied development sheet may already have been multiclassed manually.
    // Restore the test's starting condition only in this disposable database.
    setup.prepare('UPDATE "Character" SET archivedAt = NULL WHERE id = ?').run(historical.id);
    setup.prepare("DELETE FROM CharacterClass WHERE characterId = ? AND classKey = 'sorcerer'").run(multiclass.id);
    const remainingLevel = setup.prepare("SELECT SUM(level) AS total FROM CharacterClass WHERE characterId = ?").get(multiclass.id).total;
    const multiclassData = JSON.parse(setup.prepare("SELECT data FROM Character WHERE id = ?").get(multiclass.id).data);
    multiclassData.characterType = "png";
    multiclassData.basicInfo.level = remainingLevel;
    setup.prepare("UPDATE Character SET characterType = 'PNG', level = ?, data = ? WHERE id = ?")
      .run(remainingLevel, JSON.stringify(multiclassData), multiclass.id);
    const legacySnapshot = JSON.parse(setup.prepare("SELECT legacySnapshot FROM CharacterProgression WHERE characterId = ?").get(multiclass.id).legacySnapshot);
    legacySnapshot.column.level = remainingLevel;
    legacySnapshot.basicInfo.level = remainingLevel;
    setup.prepare("UPDATE CharacterProgression SET legacySnapshot = ? WHERE characterId = ?").run(JSON.stringify(legacySnapshot), multiclass.id);
    setup.prepare(`
      UPDATE "CharacterClass" SET "draconicAncestryKey" = NULL
      WHERE characterId = ? AND classKey = 'sorcerer'
    `).run(historical.id);
    setup.prepare('DELETE FROM "CharacterDraconicAncestryHistory" WHERE characterId IN (?, ?)')
      .run(multiclass.id, historical.id);
    setup.close();

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
    const login = await post(baseUrl, "/api/auth/login", null, {
      username: dm.username,
      password: "DraconicDmPassword!1",
    });
    expect(login.response.status).toBe(200);
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];

    const levelPreview = await post(
      baseUrl,
      `/api/dm/characters/${multiclass.slug}/progression/preview`,
      cookie,
      {
        targetClassKey: "sorcerer",
        targetSubclassKey: "draconic-bloodline",
        draconicAncestryKey: "blue",
      },
    );
    expect(levelPreview.response.status, JSON.stringify(levelPreview.payload)).toBe(200);
    expect(levelPreview.payload.preview).toMatchObject({
      status: "READY",
      draconicAncestryKey: "blue",
      classesAfter: expect.arrayContaining([
        expect.objectContaining({ classKey: "warlock", subclassKey: "the-fiend", level: 5 }),
        expect.objectContaining({
          classKey: "sorcerer", subclassKey: "draconic-bloodline",
          draconicAncestryKey: "blue", level: 1,
        }),
      ]),
    });
    const levelRequest = {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
      draconicAncestryKey: "blue",
      requestId: "draconic-levelup-001",
      expectedRevision: levelPreview.payload.revision,
      expectedProgressionRevision: levelPreview.payload.progressionRevision,
    };
    const levelApplied = await post(
      baseUrl,
      `/api/dm/characters/${multiclass.slug}/progression/apply`,
      cookie,
      levelRequest,
    );
    expect(levelApplied.response.status, JSON.stringify(levelApplied.payload)).toBe(200);
    expect(levelApplied.payload.character.characterType).toBe("png");
    expect(levelApplied.payload.character.classes).toEqual(expect.arrayContaining([
      expect.objectContaining({ subclass: expect.objectContaining({ subclassKey: "the-fiend" }) }),
      expect.objectContaining({
        classKey: "sorcerer",
        subclass: expect.objectContaining({ subclassKey: "draconic-bloodline" }),
        draconicAncestry: { key: "blue", label: "Blu", damageType: "lightning", damageLabel: "Fulmine" },
      }),
    ]));
    const levelReplay = await post(
      baseUrl,
      `/api/dm/characters/${multiclass.slug}/progression/apply`,
      cookie,
      levelRequest,
    );
    expect(levelReplay.payload).toMatchObject({ replayed: true, requestId: levelRequest.requestId });

    const missingPreview = await post(
      baseUrl,
      `/api/dm/characters/${historical.slug}/subclass/preview`,
      cookie,
      {
        targetClassKey: "sorcerer",
        targetSubclassKey: "draconic-bloodline",
        draconicAncestryKey: "gold",
      },
    );
    expect(missingPreview.response.status, JSON.stringify(missingPreview.payload)).toBe(200);
    expect(missingPreview.payload.preview).toMatchObject({
      status: "READY", subclassChanged: false, ancestryChanged: true, reasonRequired: false,
    });
    const missingRequest = {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
      draconicAncestryKey: "gold",
      requestId: "draconic-correction-assign-001",
      expectedRevision: missingPreview.payload.revision,
      expectedProgressionRevision: missingPreview.payload.progressionRevision,
    };
    const missingApplied = await post(
      baseUrl,
      `/api/dm/characters/${historical.slug}/subclass/apply`,
      cookie,
      missingRequest,
    );
    expect(missingApplied.response.status, JSON.stringify(missingApplied.payload)).toBe(200);
    expect(missingApplied.payload.character.classes.find((entry) => entry.classKey === "sorcerer").draconicAncestry.key)
      .toBe("gold");
    const missingReplay = await post(
      baseUrl,
      `/api/dm/characters/${historical.slug}/subclass/apply`,
      cookie,
      missingRequest,
    );
    expect(missingReplay.payload.replayed).toBe(true);

    const reasonPreview = await post(
      baseUrl,
      `/api/dm/characters/${historical.slug}/subclass/preview`,
      cookie,
      {
        targetClassKey: "sorcerer",
        targetSubclassKey: "draconic-bloodline",
        draconicAncestryKey: "red",
      },
    );
    expect(reasonPreview.payload.preview).toMatchObject({ status: "REASON_REQUIRED", reasonRequired: true });
    const correctionPreview = await post(
      baseUrl,
      `/api/dm/characters/${historical.slug}/subclass/preview`,
      cookie,
      {
        targetClassKey: "sorcerer",
        targetSubclassKey: "draconic-bloodline",
        draconicAncestryKey: "red",
        reason: "Correzione del colore storico",
      },
    );
    const correctionApplied = await post(
      baseUrl,
      `/api/dm/characters/${historical.slug}/subclass/apply`,
      cookie,
      {
        targetClassKey: "sorcerer",
        targetSubclassKey: "draconic-bloodline",
        draconicAncestryKey: "red",
        reason: "Correzione del colore storico",
        requestId: "draconic-correction-change-001",
        expectedRevision: correctionPreview.payload.revision,
        expectedProgressionRevision: correctionPreview.payload.progressionRevision,
      },
    );
    expect(correctionApplied.response.status, JSON.stringify(correctionApplied.payload)).toBe(200);

    const verify = new DatabaseSync(databasePath, { readOnly: true });
    expect(verify.prepare(`
      SELECT cc.level, cc.draconicAncestryKey, sr.subclassKey
      FROM "CharacterClass" cc JOIN "SubclassRule" sr ON sr.id = cc.subclassRuleId
      WHERE cc.characterId = ? AND cc.classKey = 'sorcerer'
    `).get(multiclass.id)).toMatchObject({ level: 1, subclassKey: "draconic-bloodline", draconicAncestryKey: "blue" });
    expect(verify.prepare("SELECT characterType, level FROM Character WHERE id = ?").get(multiclass.id))
      .toEqual({ characterType: "PNG", level: 6 });
    expect(verify.prepare(`
      SELECT cc.level, cc.draconicAncestryKey, sr.subclassKey
      FROM "CharacterClass" cc JOIN "SubclassRule" sr ON sr.id = cc.subclassRuleId
      WHERE cc.characterId = ? AND cc.classKey = 'sorcerer'
    `).get(historical.id)).toMatchObject({ level: 1, subclassKey: "draconic-bloodline", draconicAncestryKey: "red" });
    expect(verify.prepare(`
      SELECT COUNT(*) AS count FROM "CharacterDraconicAncestryHistory"
      WHERE characterId = ? AND operationType = 'LEVEL_UP'
    `).get(multiclass.id).count).toBe(1);
    expect(verify.prepare(`
      SELECT COUNT(*) AS count FROM "CharacterDraconicAncestryHistory"
      WHERE characterId = ? AND operationType = 'SUBCLASS_CORRECTION'
    `).get(historical.id).count).toBe(2);
    expect(verify.prepare(`
      SELECT COUNT(*) AS count FROM "CharacterSubclassHistory"
      WHERE characterId = ? AND requestId LIKE 'draconic-correction-%'
    `).get(historical.id).count).toBe(0);
    expect(verify.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    verify.close();
  }, 50_000);
});
