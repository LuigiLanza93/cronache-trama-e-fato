import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DATABASE = path.join(ROOT, "prisma", "migration.db");
const MIGRATION_SCRIPT = path.join(ROOT, "scripts", "apply-character-passive-hit-points.mjs");
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
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server health timeout\n${logs()}`);
}

function setPassword(database, username, password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  database.prepare(`UPDATE "User" SET passwordSalt = ?, passwordHash = ?, mustChangePassword = 0, updatedAt = ? WHERE username = ?`)
    .run(salt, passwordHash, new Date().toISOString(), username);
}

function waitForCharacterState(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("character:state", listener);
      reject(new Error("Timed out waiting for character:state"));
    }, 5_000);
    const listener = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off("character:state", listener);
      resolve(payload);
    };
    socket.on("character:state", listener);
  });
}

describe("passive maximum hit points over HTTP and realtime", () => {
  it("reconciles an equipped item HP bonus through HTTP and realtime without drift or revival", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-passive-hp-http-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "migration.db");
    copyFileSync(SOURCE_DATABASE, databasePath);
    const migration = spawnSync(process.execPath, [MIGRATION_SCRIPT, "--apply", "--database", databasePath], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(migration.status, `${migration.stdout}\n${migration.stderr}`).toBe(0);

    const setup = new DatabaseSync(databasePath);
    const dm = setup.prepare("SELECT username FROM User WHERE role = 'DM' ORDER BY id LIMIT 1").get();
    const hero = setup.prepare(`
      SELECT c.id, c.slug FROM Character c
      JOIN CharacterHitPointState hp ON hp.characterId = c.id
      WHERE LOWER(c.characterType) = 'pg' AND c.archivedAt IS NULL
      ORDER BY c.id LIMIT 1
    `).get();
    const armor = setup.prepare(`
      SELECT d.id FROM ItemDefinition d
      JOIN ItemSlotRule slot ON slot.itemDefinitionId = d.id AND slot.slot = 'ARMOR'
      WHERE d.category = 'ARMOR' AND d.equippable = 1
      ORDER BY d.id LIMIT 1
    `).get();
    expect(hero && dm && armor).toBeTruthy();
    setPassword(setup, dm.username, "PassiveHitPointsDm!1");
    const row = setup.prepare("SELECT data FROM Character WHERE id = ?").get(hero.id);
    const data = JSON.parse(row.data);
    data.combatStats = { ...(data.combatStats ?? {}), hitPointMaximum: 52, currentHitPoints: 52, temporaryHitPoints: 0 };
    data.capabilities = [];
    setup.prepare("UPDATE Character SET data = ?, updatedAt = ? WHERE id = ?")
      .run(JSON.stringify(data), new Date().toISOString(), hero.id);
    setup.prepare(`UPDATE CharacterHitPointState
      SET maximumHitPoints = 52, currentHitPoints = 52, passiveBonusApplied = 0, revision = 0, updatedAt = ?
      WHERE characterId = ?`).run(new Date().toISOString(), hero.id);
    setup.prepare(`DELETE FROM CharacterItemEquip
      WHERE characterItemId IN (SELECT id FROM CharacterItem WHERE characterId = ?)`).run(hero.id);
    setup.prepare("UPDATE CharacterItem SET isEquipped = 0 WHERE characterId = ?").run(hero.id);
    setup.prepare("DELETE FROM ItemFeature WHERE itemDefinitionId = ?").run(armor.id);
    setup.prepare(`INSERT INTO ItemFeature (
      id, itemDefinitionId, name, description, resetOn, maxUses, condition, sortOrder,
      createdAt, updatedAt, customResetLabel, kind, passiveEffects
    ) VALUES (?, ?, ?, ?, NULL, NULL, 'WHILE_EQUIPPED', 0, ?, ?, NULL, 'PASSIVE', ?)`)
      .run(
        "test-passive-hp-armor-feature",
        armor.id,
        "Vigore dell'armatura",
        "Bonus PF di collaudo",
        new Date().toISOString(),
        new Date().toISOString(),
        JSON.stringify([{ target: "HIT_POINT_MAX", operationType: "BONUS", valueMode: "FLAT", value: 2, trigger: "ALWAYS" }]),
      );
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
        APP_DATA_DIR: path.join(directory, "app-data"),
        DM_NOTES_ROOT: path.join(directory, "notes"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    childProcesses.push(child);
    let logs = "";
    child.stdout.on("data", (chunk) => { logs += chunk; });
    child.stderr.on("data", (chunk) => { logs += chunk; });
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(baseUrl, child, () => logs);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: dm.username, password: "PassiveHitPointsDm!1" }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    const projected = await (await fetch(`${baseUrl}/api/characters/${hero.slug}`, { headers: { cookie } })).json();
    expect(projected.hitPointState).toMatchObject({ maximumHitPoints: 52, currentHitPoints: 52, passiveBonusApplied: 0 });

    const assignedResponse = await fetch(`${baseUrl}/api/characters/${hero.slug}/inventory-items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ itemDefinitionId: armor.id, quantity: 1 }),
    });
    expect(assignedResponse.status).toBe(201);
    const assignedItems = await assignedResponse.json();
    const armorItem = assignedItems.filter((item) => item.itemDefinitionId === armor.id).at(-1);
    expect(armorItem?.id).toBeTruthy();

    const socket = io(baseUrl, { transports: ["websocket"], extraHeaders: { Cookie: cookie }, autoConnect: false });
    try {
      await new Promise((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
      });
      expect((await socket.timeout(5_000).emitWithAck("character:join", { slug: hero.slug })).ok).toBe(true);

      const equippedState = waitForCharacterState(socket, (payload) =>
        payload?.slug === hero.slug && payload?.state?.hitPointState?.maximumHitPoints === 54
      );
      const equipped = await fetch(`${baseUrl}/api/characters/${hero.slug}/inventory-items/${armorItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ isEquipped: true }),
      });
      expect(equipped.status).toBe(200);
      expect((await equippedState).state.hitPointState).toMatchObject({
        maximumHitPoints: 54,
        currentHitPoints: 54,
        passiveBonusApplied: 2,
      });

      const equippedCharacter = await (await fetch(`${baseUrl}/api/characters/${hero.slug}`, { headers: { cookie } })).json();
      const damaged = await socket.timeout(5_000).emitWithAck("character:update", {
        slug: hero.slug,
        revision: equippedCharacter.revision,
        patch: { combatStats: { currentHitPoints: 50 } },
      });
      expect(damaged.ok, JSON.stringify(damaged)).toBe(true);

      const unequippedState = waitForCharacterState(socket, (payload) =>
        payload?.slug === hero.slug && payload?.state?.hitPointState?.maximumHitPoints === 52
      );
      const unequipped = await fetch(`${baseUrl}/api/characters/${hero.slug}/inventory-items/${armorItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ isEquipped: false }),
      });
      expect(unequipped.status).toBe(200);
      expect((await unequippedState).state.hitPointState).toMatchObject({
        maximumHitPoints: 52,
        currentHitPoints: 48,
        passiveBonusApplied: 0,
      });

      const afterRemoval = await (await fetch(`${baseUrl}/api/characters/${hero.slug}`, { headers: { cookie } })).json();
      expect(afterRemoval.hitPointState).toMatchObject({ maximumHitPoints: 52, currentHitPoints: 48, passiveBonusApplied: 0 });

      const zeroed = await socket.timeout(5_000).emitWithAck("character:update", {
        slug: hero.slug,
        revision: afterRemoval.revision,
        patch: { combatStats: { currentHitPoints: 0 } },
      });
      expect(zeroed.ok, JSON.stringify(zeroed)).toBe(true);
      const equippedAtZeroState = waitForCharacterState(socket, (payload) =>
        payload?.slug === hero.slug && payload?.state?.hitPointState?.maximumHitPoints === 54
      );
      const equippedAtZero = await fetch(`${baseUrl}/api/characters/${hero.slug}/inventory-items/${armorItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ isEquipped: true }),
      });
      expect(equippedAtZero.status).toBe(200);
      expect((await equippedAtZeroState).state.hitPointState).toMatchObject({
        maximumHitPoints: 54,
        currentHitPoints: 0,
        passiveBonusApplied: 2,
      });
    } finally {
      socket.disconnect();
    }

    const reloaded = await (await fetch(`${baseUrl}/api/characters/${hero.slug}`, { headers: { cookie } })).json();
    expect(reloaded.hitPointState).toMatchObject({ maximumHitPoints: 54, currentHitPoints: 0, passiveBonusApplied: 2 });
    const check = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(check.prepare(`SELECT maximumHitPoints, currentHitPoints, passiveBonusApplied
        FROM CharacterHitPointState WHERE characterId = ?`).get(hero.id)).toEqual({
        maximumHitPoints: 52,
        currentHitPoints: 0,
        passiveBonusApplied: 0,
      });
    } finally {
      check.close();
    }
  }, 30_000);
});
