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

describe("Warlock pact boon HTTP persistence", () => {
  it("audits independent corrections, preserves resources and supports replay and level-up", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-pact-http-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "migration.db");
    copyFileSync(SOURCE_DATABASE, databasePath);
    applyMigration(SUBCLASS_SCRIPT, databasePath);
    applyMigration(DRACONIC_SCRIPT, databasePath);
    applyMigration(path.join(ROOT, "scripts", "apply-character-pact-boon.mjs"), databasePath);
    const setup = new DatabaseSync(databasePath);
    const dm = setup.prepare("SELECT username FROM User WHERE role = 'DM' ORDER BY id LIMIT 1").get();
    const player = setup.prepare("SELECT username FROM User WHERE role = 'PLAYER' ORDER BY id LIMIT 1").get();
    setPassword(setup, dm.username, "PactDmPassword!1");
    if (player) setPassword(setup, player.username, "PactPlayerPassword!1");
    const hero = setup.prepare(`SELECT c.id, c.slug, cc.level, sr.subclassKey FROM Character c
      JOIN CharacterClass cc ON cc.characterId = c.id AND cc.classKey = 'warlock' AND cc.level BETWEEN 3 AND 18
      JOIN SubclassRule sr ON sr.id = cc.subclassRuleId WHERE c.archivedAt IS NULL LIMIT 1`).get();
    expect(hero).toBeTruthy();
    setup.prepare("UPDATE CharacterClass SET pactBoonKey = NULL WHERE characterId = ? AND classKey = 'warlock'").run(hero.id);
    setup.prepare("DELETE FROM CharacterPactBoonHistory WHERE characterId = ?").run(hero.id);
    const data = JSON.parse(setup.prepare("SELECT data FROM Character WHERE id = ?").get(hero.id).data);
    data.pactBlade = { bondedCharacterItemId: null, activeSummon: { mode: "template", templateId: "longsword" } };
    setup.prepare("UPDATE Character SET data = ? WHERE id = ?").run(JSON.stringify(data), hero.id);
    setup.close();

    const port = await reservePort();
    const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
      cwd: ROOT, env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port),
        SQLITE_DB_FILE: databasePath, APP_DATA_DIR: path.join(directory, "app-data"), DM_NOTES_ROOT: path.join(directory, "notes") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    childProcesses.push(child);
    let logs = "";
    child.stdout.on("data", (chunk) => { logs += chunk; });
    child.stderr.on("data", (chunk) => { logs += chunk; });
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(baseUrl, child, () => logs);
    const login = await post(baseUrl, "/api/auth/login", null, { username: dm.username, password: "PactDmPassword!1" });
    expect(login.response.status).toBe(200);
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
    const route = `/api/dm/characters/${hero.slug}/subclass`;
    const patron = { targetClassKey: "warlock", targetSubclassKey: hero.subclassKey };
    expect((await post(baseUrl, `${route}/preview`, null, patron)).response.status).toBe(401);
    if (player) {
      const playerLogin = await post(baseUrl, "/api/auth/login", null, { username: player.username, password: "PactPlayerPassword!1" });
      const playerCookie = playerLogin.response.headers.get("set-cookie")?.split(";")[0];
      expect((await post(baseUrl, `${route}/preview`, playerCookie, patron)).response.status).toBe(403);
      expect((await post(baseUrl, `${route}/apply`, playerCookie, patron)).response.status).toBe(403);
    }
    expect((await post(baseUrl, `${route}/preview`, cookie, { ...patron, pactBoonKey: "invalid" })).response.status).toBe(400);
    const missing = await post(baseUrl, `${route}/preview`, cookie, patron);
    expect(missing.payload.preview.status).toBe("PACT_BOON_REQUIRED");
    const ready = await post(baseUrl, `${route}/preview`, cookie, { ...patron, pactBoonKey: "blade" });
    expect(ready.payload.preview).toMatchObject({ canApply: true, subclassChanged: false, reasonRequired: false });
    const request = { ...patron, pactBoonKey: "blade", expectedRevision: ready.payload.revision,
      expectedProgressionRevision: ready.payload.progressionRevision, requestId: crypto.randomUUID() };
    const assigned = await post(baseUrl, `${route}/apply`, cookie, request);
    expect(assigned.response.status, JSON.stringify(assigned.payload)).toBe(200);
    expect(assigned.payload.character.classes.find((entry) => entry.classKey === "warlock")).toMatchObject({ level: hero.level, pactBoonKey: "blade", subclass: { subclassKey: hero.subclassKey } });
    const replay = await post(baseUrl, `${route}/apply`, cookie, request);
    expect(replay.payload).toMatchObject({ replayed: true, revision: assigned.payload.revision });
    expect((await post(baseUrl, `${route}/apply`, cookie, { ...request, pactBoonKey: "chain" })).response.status).toBe(409);
    expect((await post(baseUrl, `${route}/apply`, cookie, { ...request, requestId: crypto.randomUUID(), pactBoonKey: "chain" })).response.status).toBe(409);
    const noReason = await post(baseUrl, `${route}/preview`, cookie, { ...patron, pactBoonKey: "tome" });
    expect(noReason.payload.preview.status).toBe("REASON_REQUIRED");
    const correction = await post(baseUrl, `${route}/apply`, cookie, { ...patron, pactBoonKey: "tome", reason: "Scelta corretta del dono",
      expectedRevision: assigned.payload.revision, expectedProgressionRevision: assigned.payload.progressionRevision, requestId: crypto.randomUUID() });
    expect(correction.response.status, JSON.stringify(correction.payload)).toBe(200);
    const check = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const histories = check.prepare("SELECT * FROM CharacterPactBoonHistory WHERE characterId = ? ORDER BY progressionRevisionAfter").all(hero.id);
      expect(histories).toHaveLength(2);
      expect(histories[0]).toMatchObject({ previousPactBoonKey: null, targetPactBoonKey: "blade", reason: null });
      expect(histories[1]).toMatchObject({ previousPactBoonKey: "blade", targetPactBoonKey: "tome" });
      for (const row of histories) {
        const before = JSON.parse(row.beforeSnapshot), after = JSON.parse(row.afterSnapshot);
        expect(after.characterData).toEqual(before.characterData);
        expect(after.resourcePools).toEqual(before.resourcePools);
        expect(after.hitPointState).toEqual(before.hitPointState);
        expect(after.hitDicePools).toEqual(before.hitDicePools);
        expect(after.class.subclassKey).toBe(before.class.subclassKey);
      }
      expect(check.prepare("SELECT level, pactBoonKey FROM CharacterClass WHERE characterId = ? AND classKey = 'warlock'").get(hero.id)).toEqual({ level: hero.level, pactBoonKey: "tome" });
    } finally { check.close(); }
    const levelRoute = `/api/dm/characters/${hero.slug}/progression`;
    const level = await post(baseUrl, `${levelRoute}/preview`, cookie, { targetClassKey: "warlock" });
    expect(level.response.status, JSON.stringify(level.payload)).toBe(200);
    expect(level.payload.preview.pactBoonKey).toBe("tome");
    const advanced = await post(baseUrl, `${levelRoute}/apply`, cookie, { targetClassKey: "warlock",
      expectedRevision: level.payload.revision, expectedProgressionRevision: level.payload.progressionRevision, requestId: crypto.randomUUID() });
    expect(advanced.response.status, JSON.stringify(advanced.payload)).toBe(200);
    expect(advanced.payload.character.classes.find((entry) => entry.classKey === "warlock")).toMatchObject({ level: hero.level + 1, pactBoonKey: "tome" });
  }, 30_000);
});

function applyMigration(script, databasePath) {
  const result = spawnSync(process.execPath, [script, "--apply", "--database", databasePath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
}
