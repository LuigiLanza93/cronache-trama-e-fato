import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "apply-character-progression-m4.mjs");
const M3_MIGRATION = readFileSync(
  path.join(ROOT, "prisma", "migrations", "20260815_character_progression_m3", "migration.sql"),
  "utf8",
);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDatabase() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-m4-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "migration.db");
}

function run(databasePath, ...arguments_) {
  return spawnSync(
    process.execPath,
    [SCRIPT, ...arguments_, "--database", databasePath],
    { cwd: ROOT, encoding: "utf8" },
  );
}

function insertClassRule(db, {
  id,
  classKey,
  labelIt,
  subclassSelectionLevel = 3,
} = {}) {
  db.prepare(`
    INSERT INTO "ClassRule" (
      id, classKey, labelIt, labelEn, aliases, rulesetId, rulesetVersion, sourceReference,
      hitDie, casterKind, spellcastingAbility, spellcastingStartLevel, subclassSelectionLevel,
      isCustom, isManual, ruleSnapshot, catalogHash, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, 'srd-5.1', '2014', 'TEST', 10, 'NONE', NULL, NULL, ?, 0, 0, '{}', 'hash', ?, ?)
  `).run(
    id,
    classKey,
    labelIt,
    labelIt,
    JSON.stringify([classKey, labelIt.toLowerCase()]),
    subclassSelectionLevel,
    "2026-09-21T00:00:00.000Z",
    "2026-09-21T00:00:00.000Z",
  );
}

function createM3Database(databasePath) {
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "displayName" TEXT NOT NULL
    );
    CREATE TABLE "Character" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "className" TEXT,
      "level" INTEGER,
      "data" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL
    );
  `);
  db.exec(M3_MIGRATION);
  db.prepare('INSERT INTO "User" (id, displayName) VALUES (?, ?)').run("dm", "Dungeon Master");
  db.prepare(`
    INSERT INTO "Character" (id, slug, className, level, data, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    "hero",
    "hero",
    "Guerriero",
    5,
    JSON.stringify({ basicInfo: { class: "Guerriero", level: 5 } }),
    "2026-09-21T00:00:00.000Z",
  );
  insertClassRule(db, { id: "srd-5.1@2014:fighter", classKey: "fighter", labelIt: "Guerriero" });
  insertClassRule(db, { id: "srd-5.1@2014:wizard", classKey: "wizard", labelIt: "Mago", subclassSelectionLevel: 2 });
  db.prepare(`
    INSERT INTO "SubclassRule" (
      id, subclassKey, classRuleId, labelIt, labelEn, aliases, rulesetId, rulesetVersion,
      sourceReference, casterKind, spellcastingAbility, spellcastingStartLevel, isCustom,
      isManual, archivedAt, ruleSnapshot, catalogHash, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'srd-5.1', '2014', 'TEST', 'NONE', NULL, NULL, 0, 0, NULL, '{}', 'hash', ?, ?)
  `).run(
    "srd-5.1@2014:champion",
    "champion",
    "srd-5.1@2014:fighter",
    "Campione",
    "Champion",
    '["champion","campione"]',
    "2026-09-21T00:00:00.000Z",
    "2026-09-21T00:00:00.000Z",
  );
  db.prepare(`
    INSERT INTO "SubclassRule" (
      id, subclassKey, classRuleId, labelIt, labelEn, aliases, rulesetId, rulesetVersion,
      sourceReference, casterKind, spellcastingAbility, spellcastingStartLevel, isCustom,
      isManual, archivedAt, ruleSnapshot, catalogHash, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'srd-5.1', '2014', 'TEST', 'FULL', 'intelligence', 1, 0, 0, NULL, '{}', 'hash', ?, ?)
  `).run(
    "srd-5.1@2014:school-of-evocation",
    "school-of-evocation",
    "srd-5.1@2014:wizard",
    "Scuola di Invocazione",
    "School of Evocation",
    '["school-of-evocation"]',
    "2026-09-21T00:00:00.000Z",
    "2026-09-21T00:00:00.000Z",
  );
  db.prepare(`
    INSERT INTO "CharacterProgression" (
      characterId, revision, backfillStatus, backfillIssues, legacySnapshot, createdAt, updatedAt
    ) VALUES (?, 0, 'BACKFILLED', '[]', ?, ?, ?)
  `).run(
    "hero",
    JSON.stringify({
      column: { className: "Guerriero", level: 5 },
      basicInfo: { class: "Guerriero", level: 5 },
    }),
    "2026-09-21T00:00:00.000Z",
    "2026-09-21T00:00:00.000Z",
  );
  db.prepare(`
    INSERT INTO "CharacterClass" (
      id, characterId, classRuleId, subclassRuleId, classKey, level, sortOrder, isPrimary,
      subclassStatus, source, ruleSnapshot, updatedByUserId, createdAt, updatedAt
    ) VALUES (?, ?, ?, NULL, ?, 5, 0, 1, 'INCOMPLETE_LEGACY', 'LEGACY_BACKFILL', '{}', NULL, ?, ?)
  `).run(
    "character-class:hero:fighter",
    "hero",
    "srd-5.1@2014:fighter",
    "fighter",
    "2026-09-21T00:00:00.000Z",
    "2026-09-21T00:00:00.000Z",
  );
  return db;
}

function historyRecord(overrides = {}) {
  return {
    id: "history-1",
    characterId: "hero",
    requestId: "request-1",
    requestSignature: "a".repeat(64),
    operationType: "LEVEL_UP",
    mode: "INCREMENT_EXISTING",
    targetClassKey: "fighter",
    targetClassRuleId: "srd-5.1@2014:fighter",
    targetSubclassKey: null,
    targetSubclassRuleId: null,
    classLevelBefore: 5,
    classLevelAfter: 6,
    totalLevelBefore: 5,
    totalLevelAfter: 6,
    progressionRevisionBefore: 0,
    progressionRevisionAfter: 1,
    characterRevisionBefore: "2026-09-21T00:00:00.000Z",
    characterRevisionAfter: "2026-09-21T00:01:00.000Z",
    rulesetId: "srd-5.1",
    rulesetVersion: "2014",
    policyVersion: "m4-v1",
    requestSnapshot: "{}",
    beforeSnapshot: "{}",
    afterSnapshot: "{}",
    ruleSnapshot: "{}",
    resultSnapshot: "{}",
    overrideReason: null,
    appliedByUserId: "dm",
    appliedBySnapshot: '{"id":"dm","displayName":"Dungeon Master","role":"dm"}',
    hitDieSize: null,
    hitPointMethod: null,
    hitPointsGained: null,
    constitutionModifier: null,
    ...overrides,
  };
}

function insertHistory(db, overrides = {}) {
  const record = historyRecord(overrides);
  const columns = Object.keys(record);
  const placeholders = columns.map(() => "?").join(", ");
  return db.prepare(`
    INSERT INTO "CharacterLevelHistory" (${columns.map((column) => `"${column}"`).join(", ")})
    VALUES (${placeholders})
  `).run(...columns.map((column) => record[column]));
}

describe("M4 character progression persistence", () => {
  it("applies the additive schema without data writes and reruns idempotently", () => {
    const databasePath = temporaryDatabase();
    const db = createM3Database(databasePath);
    const before = JSON.stringify({
      character: db.prepare('SELECT * FROM "Character"').all(),
      progression: db.prepare('SELECT * FROM "CharacterProgression"').all(),
      classes: db.prepare('SELECT * FROM "CharacterClass"').all(),
    });
    db.close();

    const dryRun = run(databasePath, "--dry-run");
    expect(dryRun.status).toBe(0);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({
      ok: true,
      mode: "dry-run",
      schema: { presentBefore: false, presentAfter: false, wouldApply: true },
      readiness: { characters: 1, ready: 1, unresolved: 0 },
    });

    const afterDryRun = new DatabaseSync(databasePath, { readOnly: true });
    expect(afterDryRun.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'CharacterLevelHistory'").get()).toBeUndefined();
    afterDryRun.close();

    const firstApply = run(databasePath, "--apply");
    expect(firstApply.status).toBe(0);
    expect(JSON.parse(firstApply.stdout)).toMatchObject({
      ok: true,
      mode: "apply",
      schema: { presentBefore: false, presentAfter: true, wouldApply: true },
      historyRows: 0,
    });
    const secondApply = run(databasePath, "--apply");
    expect(secondApply.status).toBe(0);
    expect(JSON.parse(secondApply.stdout)).toMatchObject({
      schema: { presentBefore: true, presentAfter: true, wouldApply: false },
      historyRows: 0,
    });

    const check = new DatabaseSync(databasePath, { readOnly: true });
    const columns = new Set(check.prepare('PRAGMA table_info("CharacterLevelHistory")').all().map((row) => row.name));
    expect(columns.has("requestSignature")).toBe(true);
    expect(columns.has("constitutionModifier")).toBe(true);
    const triggers = new Set(check.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger'").all().map((row) => row.name));
    expect(triggers.has("CharacterClass_total_level_limit_insert")).toBe(true);
    expect(triggers.has("CharacterClass_total_level_limit_update")).toBe(true);
    expect(JSON.stringify({
      character: check.prepare('SELECT * FROM "Character"').all(),
      progression: check.prepare('SELECT * FROM "CharacterProgression"').all(),
      classes: check.prepare('SELECT * FROM "CharacterClass"').all(),
    })).toBe(before);
    check.close();
  });

  it("enforces durable receipt uniqueness, revision sequences, snapshots, and rule ownership", () => {
    const databasePath = temporaryDatabase();
    const db = createM3Database(databasePath);
    db.close();
    expect(run(databasePath, "--apply").status).toBe(0);

    const check = new DatabaseSync(databasePath);
    check.exec("PRAGMA foreign_keys = ON;");
    insertHistory(check);
    expect(() => insertHistory(check, { id: "history-2" })).toThrow(/UNIQUE constraint failed/i);
    expect(() => insertHistory(check, {
      id: "history-3",
      requestId: "request-3",
    })).toThrow(/UNIQUE constraint failed/i);
    expect(() => insertHistory(check, {
      id: "history-4",
      requestId: "request-4",
      progressionRevisionBefore: 1,
      progressionRevisionAfter: 2,
      requestSignature: "not-a-sha256",
    })).toThrow(/CHECK constraint failed/i);
    expect(() => insertHistory(check, {
      id: "history-5",
      requestId: "request-5",
      progressionRevisionBefore: 1,
      progressionRevisionAfter: 2,
      requestSnapshot: "not-json",
    })).toThrow(/CHECK constraint failed/i);
    expect(() => insertHistory(check, {
      id: "history-6",
      requestId: "request-6",
      progressionRevisionBefore: 1,
      progressionRevisionAfter: 2,
      targetClassKey: "wizard",
    })).toThrow(/targetClassKey does not match/i);
    expect(() => insertHistory(check, {
      id: "history-7",
      requestId: "request-7",
      progressionRevisionBefore: 1,
      progressionRevisionAfter: 2,
      targetSubclassKey: "school-of-evocation",
      targetSubclassRuleId: "srd-5.1@2014:school-of-evocation",
    })).toThrow(/target subclass does not belong/i);
    expect(() => insertHistory(check, {
      id: "history-8",
      requestId: "request-8",
      progressionRevisionBefore: 1,
      progressionRevisionAfter: 2,
      classLevelBefore: 6,
      classLevelAfter: 8,
    })).toThrow(/CHECK constraint failed/i);
    insertHistory(check, {
      id: "history-9",
      requestId: "request-9",
      requestSignature: "b".repeat(64),
      mode: "ADD_NEW_CLASS",
      targetClassKey: "wizard",
      targetClassRuleId: "srd-5.1@2014:wizard",
      classLevelBefore: null,
      classLevelAfter: 1,
      totalLevelBefore: 6,
      totalLevelAfter: 7,
      progressionRevisionBefore: 1,
      progressionRevisionAfter: 2,
      characterRevisionBefore: "2026-09-21T00:01:00.000Z",
      characterRevisionAfter: "2026-09-21T00:02:00.000Z",
    });
    expect(check.prepare('SELECT COUNT(*) AS count FROM "CharacterLevelHistory"').get().count).toBe(2);
    check.close();
  });

  it("keeps the total-level cap ready for MC1 while retaining the M3 single-class index", () => {
    const databasePath = temporaryDatabase();
    const db = createM3Database(databasePath);
    db.close();
    expect(run(databasePath, "--apply").status).toBe(0);

    const check = new DatabaseSync(databasePath);
    check.exec("PRAGMA foreign_keys = ON;");
    expect(check.prepare("SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'CharacterClass_m3_single_class_key'").get()).toBeTruthy();
    check.prepare('UPDATE "CharacterClass" SET level = 19 WHERE id = ?').run("character-class:hero:fighter");
    check.exec('DROP INDEX "CharacterClass_m3_single_class_key";');
    check.prepare(`
      INSERT INTO "CharacterClass" (
        id, characterId, classRuleId, subclassRuleId, classKey, level, sortOrder, isPrimary,
        subclassStatus, source, ruleSnapshot, updatedByUserId, createdAt, updatedAt
      ) VALUES (?, ?, ?, NULL, ?, 1, 1, 0, 'NOT_YET_ELIGIBLE', 'TEST', '{}', NULL, ?, ?)
    `).run(
      "character-class:hero:wizard",
      "hero",
      "srd-5.1@2014:wizard",
      "wizard",
      "2026-09-21T00:00:00.000Z",
      "2026-09-21T00:00:00.000Z",
    );
    expect(() => check.prepare('UPDATE "CharacterClass" SET level = 2 WHERE id = ?').run("character-class:hero:wizard"))
      .toThrow(/total level cannot exceed 20/i);
    check.close();
  });

  it("refuses partial schemas and unresolved M3 rows", () => {
    const partialPath = temporaryDatabase();
    const partial = createM3Database(partialPath);
    partial.exec('CREATE TABLE "CharacterLevelHistory" ("id" TEXT NOT NULL PRIMARY KEY);');
    partial.close();
    const partialApply = run(partialPath, "--apply");
    expect(partialApply.status).toBe(1);
    expect(partialApply.stderr).toContain("CharacterLevelHistory missing");
    const partialCheck = new DatabaseSync(partialPath, { readOnly: true });
    expect(partialCheck.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger' AND name = 'CharacterClass_total_level_limit_insert'").get()).toBeUndefined();
    partialCheck.close();

    const unresolvedPath = temporaryDatabase();
    const unresolved = createM3Database(unresolvedPath);
    unresolved.prepare(`
      UPDATE "CharacterProgression"
      SET backfillStatus = 'UNRESOLVED', backfillIssues = '[{"code":"TEST"}]'
      WHERE characterId = 'hero'
    `).run();
    unresolved.close();
    const dryRun = run(unresolvedPath, "--dry-run");
    expect(dryRun.status).toBe(2);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({ ok: false, readiness: { unresolved: 1 } });
    const unresolvedApply = run(unresolvedPath, "--apply");
    expect(unresolvedApply.status).toBe(1);
    expect(unresolvedApply.stderr).toContain("M4 apply refused");
  });

  it("preserves pre-existing foreign-key violations and requires production safety flags", () => {
    const databasePath = temporaryDatabase();
    const db = createM3Database(databasePath);
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec(`
      CREATE TABLE "ExistingParent" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "ExistingChild" (
        "id" TEXT PRIMARY KEY,
        "parentId" TEXT NOT NULL,
        FOREIGN KEY ("parentId") REFERENCES "ExistingParent"("id")
      );
      INSERT INTO "ExistingChild" (id, parentId) VALUES ('orphan', 'missing');
    `);
    db.close();

    const applied = run(databasePath, "--apply");
    expect(applied.status).toBe(0);
    expect(JSON.parse(applied.stdout)).toMatchObject({ preservedForeignKeyViolations: 1 });

    const production = spawnSync(
      process.execPath,
      [SCRIPT, "--apply", "--database", "/data/migration.db"],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(production.status).toBe(1);
    expect(production.stderr).toContain("requires --allow-production and --backup-verified");
  });
});
