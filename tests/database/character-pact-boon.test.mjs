import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "apply-character-pact-boon.mjs");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function createDatabase() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-pact-boon-"));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, "migration.db");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "Character" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "SubclassRule" (
      "id" TEXT PRIMARY KEY, "subclassKey" TEXT NOT NULL, "classRuleId" TEXT NOT NULL
    );
    CREATE TABLE "CharacterClass" (
      "id" TEXT PRIMARY KEY, "characterId" TEXT NOT NULL, "classRuleId" TEXT NOT NULL,
      "subclassRuleId" TEXT, "classKey" TEXT NOT NULL, "level" INTEGER NOT NULL
    );
    INSERT INTO "User" VALUES ('dm');
    INSERT INTO "Character" VALUES ('hero');
    INSERT INTO "SubclassRule" VALUES
      ('subclass:draconic', 'pact-boon-bloodline', 'class:warlock'),
      ('subclass:wild', 'wild-magic', 'class:warlock');
    INSERT INTO "CharacterClass" VALUES
      ('cc:warlock', 'hero', 'class:warlock', 'subclass:draconic', 'warlock', 3);
  `);
  database.close();
  return databasePath;
}

function run(databasePath, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args, "--database", databasePath], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

describe("pact boon migration", () => {
  it("is read-only in dry-run, applies atomically and enforces structured ancestry", () => {
    const databasePath = createDatabase();
    expect(run(databasePath, "--dry-run").status).toBe(0);
    const before = new DatabaseSync(databasePath, { readOnly: true });
    expect(before.prepare('PRAGMA table_info("CharacterClass")').all().some((column) => column.name === "pactBoonKey")).toBe(false);
    before.close();

    expect(run(databasePath, "--apply").status).toBe(0);
    expect(run(databasePath, "--apply").status).toBe(0);
    const database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON;");
    database.prepare('UPDATE "CharacterClass" SET "pactBoonKey" = ? WHERE id = ?')
      .run("blade", "cc:warlock");
    expect(() => database.prepare('UPDATE "CharacterClass" SET "pactBoonKey" = ? WHERE id = ?')
      .run("invalid", "cc:warlock")).toThrow(/invalid pact boon/i);
    database.prepare(`
      INSERT INTO "CharacterPactBoonHistory" (
        id, characterId, requestId, requestSignature, operationType, targetClassKey,
        previousPactBoonKey, targetPactBoonKey,
        progressionRevisionBefore, progressionRevisionAfter,
        characterRevisionBefore, characterRevisionAfter, reason, policyVersion,
        requestSnapshot, beforeSnapshot, afterSnapshot, resultSnapshot,
        appliedByUserId, appliedBySnapshot, appliedAt
      ) VALUES ('history:1', 'hero', 'request:1', ?, 'SUBCLASS_CORRECTION', 'warlock',
        NULL, 'blade', 0, 1, 'before', 'after', NULL, 'pact-boon-v1',
        '{}', '{}', '{}', '{}', 'dm', '{}', '2026-10-15T12:00:00.000Z')
    `).run("a".repeat(64));
    expect(database.prepare('SELECT targetPactBoonKey FROM "CharacterPactBoonHistory"').get())
      .toEqual({ targetPactBoonKey: "blade" });
    expect(() => database.prepare('UPDATE CharacterClass SET level = 2').run()).toThrow(/invalid pact boon/i);
    expect(() => database.prepare("UPDATE CharacterClass SET classKey = 'fighter'").run()).toThrow(/invalid pact boon/i);
    expect(database.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    database.close();
  });

  it("refuses a partial schema", () => {
    const databasePath = createDatabase();
    const database = new DatabaseSync(databasePath);
    database.exec('ALTER TABLE "CharacterClass" ADD COLUMN "pactBoonKey" TEXT;');
    database.close();
    const result = run(databasePath, "--apply");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/partial/i);
  });
});
