import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "apply-character-subclass-correction.mjs");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function createDatabase() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-subclass-"));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, "migration.db");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "Character" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "ClassRule" ("id" TEXT PRIMARY KEY, "classKey" TEXT NOT NULL);
    CREATE TABLE "SubclassRule" (
      "id" TEXT PRIMARY KEY, "subclassKey" TEXT NOT NULL, "classRuleId" TEXT NOT NULL,
      FOREIGN KEY ("classRuleId") REFERENCES "ClassRule"("id")
    );
    CREATE TABLE "CharacterProgression" ("characterId" TEXT PRIMARY KEY, "revision" INTEGER NOT NULL);
    CREATE TABLE "CharacterClass" ("id" TEXT PRIMARY KEY, "characterId" TEXT NOT NULL);
    CREATE TABLE "CharacterHitPointState" ("characterId" TEXT PRIMARY KEY);
    CREATE TABLE "CharacterHitDiePool" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "CharacterHitPointAdjustment" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "CharacterResourcePool" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "CharacterResourcePoolSource" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "CharacterResourcePoolTier" ("id" TEXT PRIMARY KEY);
    INSERT INTO "User" (id) VALUES ('dm');
    INSERT INTO "Character" (id) VALUES ('hero');
    INSERT INTO "ClassRule" (id, classKey) VALUES ('rule:rogue', 'rogue');
    INSERT INTO "SubclassRule" (id, subclassKey, classRuleId) VALUES
      ('rule:thief', 'thief', 'rule:rogue'),
      ('rule:arcane-trickster', 'arcane-trickster', 'rule:rogue');
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

describe("subclass correction migration", () => {
  it("keeps dry-run read-only, applies restart-safely and enforces the audit invariants", () => {
    const databasePath = createDatabase();
    const dryRun = run(databasePath, "--dry-run");
    expect(dryRun.status).toBe(0);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({ mode: "dry-run", before: { tablePresent: false } });
    const before = new DatabaseSync(databasePath, { readOnly: true });
    expect(before.prepare("SELECT name FROM sqlite_schema WHERE name = 'CharacterSubclassHistory'").get()).toBeUndefined();
    before.close();

    expect(run(databasePath, "--apply").status).toBe(0);
    expect(run(databasePath, "--apply").status).toBe(0);
    const database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON;");
    const insert = database.prepare(`
      INSERT INTO "CharacterSubclassHistory" (
        id, characterId, requestId, requestSignature, mode, targetClassKey, targetClassRuleId,
        previousSubclassKey, previousSubclassRuleId, targetSubclassKey, targetSubclassRuleId,
        classLevel, totalLevel, progressionRevisionBefore, progressionRevisionAfter,
        characterRevisionBefore, characterRevisionAfter, reason, policyVersion, requestSnapshot,
        beforeSnapshot, afterSnapshot, ruleSnapshot, resultSnapshot, appliedByUserId,
        appliedBySnapshot, appliedAt
      ) VALUES (?, 'hero', ?, ?, ?, 'rogue', 'rule:rogue', ?, ?, ?, ?, 3, 3, 0, 1,
        'revision-before', 'revision-after', ?, 'subclass-correction-v1', '{}', '{}', '{}', '{}', '{}',
        'dm', '{}', '2026-10-15T12:00:00.000Z')
    `);
    insert.run(
      "history:assign",
      "request-assign",
      "a".repeat(64),
      "ASSIGN",
      null,
      null,
      "arcane-trickster",
      "rule:arcane-trickster",
      null,
    );
    expect(() => insert.run(
      "history:bad-change",
      "request-change",
      "b".repeat(64),
      "CHANGE",
      "thief",
      "rule:thief",
      "arcane-trickster",
      "rule:arcane-trickster",
      null,
    )).toThrow(/CHECK constraint failed/i);
    expect(() => insert.run(
      "history:wrong-class",
      "request-wrong",
      "c".repeat(64),
      "ASSIGN",
      null,
      null,
      "arcane-trickster",
      "rule:thief",
      null,
    )).toThrow(/does not belong to class rule/i);
    expect(database.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    database.close();
  });

  it("refuses partial history schemas", () => {
    const databasePath = createDatabase();
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE "CharacterSubclassHistory" ("id" TEXT PRIMARY KEY);');
    database.close();
    const result = run(databasePath, "--apply");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/partial/i);
  });
});
