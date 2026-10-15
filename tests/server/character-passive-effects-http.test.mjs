import { io } from "socket.io-client";
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

describe("passive class-level effects realtime persistence", () => {
  it("saves stable class references and unarmored triggers, reloads them and rejects malformed references", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-passive-effects-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "migration.db");
    copyFileSync(SOURCE_DATABASE, databasePath);
    const setup = new DatabaseSync(databasePath);
    const dm = setup.prepare("SELECT username FROM User WHERE role = 'DM' ORDER BY id LIMIT 1").get();
    const hero = setup.prepare(`SELECT c.id, c.slug, cc.classKey FROM Character c
      JOIN CharacterClass cc ON cc.characterId = c.id
      WHERE LOWER(c.characterType) = 'pg' AND c.archivedAt IS NULL ORDER BY cc.sortOrder, c.id LIMIT 1`).get();
    if (dm) setPassword(setup, dm.username, "PassiveEffectsDmPassword!1");
    setup.close();
    expect(hero && dm).toBeTruthy();
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
    const login = await post(baseUrl, "/api/auth/login", null, { username: dm.username, password: "PassiveEffectsDmPassword!1" });
    expect(login.response.status).toBe(200);
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
    const before = await (await fetch(`${baseUrl}/api/characters/${hero.slug}`, { headers: { cookie } })).json();
    const capability = { name: "Bonus di classe senza armatura", kind: "passive", shortDescription: "Prova su copia",
      passiveEffects: [{ target: "SKILL_PERCEZIONE", valueMode: "CLASS_LEVEL", sourceClassKey: hero.classKey,
        value: 0, trigger: "WHILE_UNARMORED", multiplierNumerator: 1, multiplierDenominator: 2, rounding: "FLOOR" }] };
    const capabilities = [...(before.capabilities ?? []), capability];
    const socket = io(baseUrl, { transports: ["websocket"], extraHeaders: { Cookie: cookie }, autoConnect: false });
    try {
      await new Promise((resolve, reject) => {
        socket.once("connect", resolve); socket.once("connect_error", reject); socket.connect();
      });
      const joined = await socket.timeout(5_000).emitWithAck("character:join", { slug: hero.slug });
      expect(joined.ok).toBe(true);
      const saved = await socket.timeout(5_000).emitWithAck("character:update", { slug: hero.slug, revision: before.revision, patch: { capabilities } });
      expect(saved.ok, JSON.stringify(saved)).toBe(true);
      const reloaded = await (await fetch(`${baseUrl}/api/characters/${hero.slug}`, { headers: { cookie } })).json();
      expect(reloaded.capabilities.at(-1)).toEqual(capability);
      expect(reloaded.classes).toEqual(before.classes);
      expect(reloaded.basicInfo.level).toBe(before.basicInfo.level);
      const invalid = await socket.timeout(5_000).emitWithAck("character:update", {
        slug: hero.slug, revision: reloaded.revision,
        patch: { capabilities: [{ ...capability, passiveEffects: [{ ...capability.passiveEffects[0], sourceClassKey: "../invalid" }] }] },
      });
      expect(invalid).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
      const finalState = await (await fetch(`${baseUrl}/api/characters/${hero.slug}`, { headers: { cookie } })).json();
      expect(finalState.capabilities).toEqual(capabilities);
      const check = new DatabaseSync(databasePath, { readOnly: true });
      try { expect(JSON.parse(check.prepare("SELECT data FROM Character WHERE id = ?").get(hero.id).data).capabilities).toEqual(capabilities); }
      finally { check.close(); }
    } finally { socket.disconnect(); }
  }, 25_000);
});
