import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "apply-character-progression-m3.mjs");
const MIGRATION = path.join(
  ROOT,
  "prisma",
  "migrations",
  "20260815_character_progression_m3",
  "migration.sql",
);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), "cronache-character-progression-m3-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "fixture.db");
}

function createLegacyDatabase(databasePath) {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY
    );
    CREATE TABLE "Character" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "className" TEXT,
      "level" INTEGER,
      "data" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

function addCharacter(db, { id, className, level, basicClass = className, basicLevel = level, rawData } = {}) {
  const data = rawData ?? JSON.stringify({
    slug: id,
    basicInfo: { characterName: id, class: basicClass, level: basicLevel },
  });
  db.prepare(`
    INSERT INTO "Character" (id, slug, className, level, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, id, className ?? null, level ?? null, data);
}

function run(databasePath, ...arguments_) {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, ...arguments_, "--database", databasePath],
    { cwd: ROOT, encoding: "utf8" },
  );
  let summary;
  try { summary = result.stdout.trim() ? JSON.parse(result.stdout) : undefined; } catch { /* assertion reports stdout */ }
  return { ...result, summary };
}

function readM3State(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return {
      classRules: db.prepare('SELECT * FROM "ClassRule" ORDER BY id').all(),
      subclassRules: db.prepare('SELECT * FROM "SubclassRule" ORDER BY id').all(),
      progressions: db.prepare('SELECT * FROM "CharacterProgression" ORDER BY characterId').all(),
      classes: db.prepare('SELECT * FROM "CharacterClass" ORDER BY characterId, sortOrder').all(),
    };
  } finally {
    db.close();
  }
}

describe("M3 additive character progression schema", () => {
  it("materializes versioned catalog snapshots and backfills one primary class idempotently", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "fighter-alias", className: "Fighter", level: 5, basicClass: "Guerriero" });
    db.close();

    const first = run(databasePath, "--apply");
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    expect(first.summary).toMatchObject({
      ok: true,
      mode: "apply",
      schema: { presentBefore: false, presentAfter: true },
      catalog: {
        classRules: 12,
        subclassRules: 14,
        wouldInsertClassRules: 12,
        wouldInsertSubclassRules: 14,
        insertedClassRules: 12,
        insertedSubclassRules: 14,
      },
      characters: {
        total: 1,
        backfilled: 1,
        unresolved: 0,
        unresolvedDivergences: 0,
        insertedCharacterClasses: 1,
        changedProgressions: 1,
      },
    });

    const stateAfterFirst = readM3State(databasePath);
    expect(stateAfterFirst.classRules).toHaveLength(12);
    expect(stateAfterFirst.subclassRules).toHaveLength(14);
    expect(stateAfterFirst.classes).toEqual([
      expect.objectContaining({
        characterId: "fighter-alias",
        classKey: "fighter",
        level: 5,
        sortOrder: 0,
        isPrimary: 1,
        subclassStatus: "INCOMPLETE_LEGACY",
        source: "LEGACY_BACKFILL",
      }),
    ]);
    expect(JSON.parse(stateAfterFirst.classes[0].ruleSnapshot)).toMatchObject({
      key: "fighter",
      labels: { it: "Guerriero", en: "Fighter" },
      source: { rulesetId: "srd-5.1-2014", version: "5.1" },
    });

    const second = run(databasePath, "--apply");
    expect(second.status, `${second.stdout}\n${second.stderr}`).toBe(0);
    expect(second.summary).toMatchObject({
      catalog: {
        wouldInsertClassRules: 0,
        wouldUpdateClassRules: 0,
        wouldInsertSubclassRules: 0,
        wouldUpdateSubclassRules: 0,
        insertedClassRules: 0,
        updatedClassRules: 0,
        insertedSubclassRules: 0,
        updatedSubclassRules: 0,
        unchanged: 26,
      },
      characters: { insertedCharacterClasses: 0, changedProgressions: 0 },
    });
    expect(readM3State(databasePath)).toEqual(stateAfterFirst);
  });

  it("keeps dry-run byte-for-byte read-only while reporting planned alias backfill", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "alias", className: "Guerriero", level: 3, basicClass: "Fighter" });
    db.close();
    const before = readFileSync(databasePath);

    const result = run(databasePath, "--dry-run");

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.summary).toMatchObject({
      mode: "dry-run",
      schema: { presentBefore: false, presentAfter: false },
      catalog: {
        wouldInsertClassRules: 12,
        wouldInsertSubclassRules: 14,
        insertedClassRules: 0,
        insertedSubclassRules: 0,
      },
      characters: { backfilled: 1, unresolved: 0, wouldInsertCharacterClasses: 1, insertedCharacterClasses: 0 },
      report: [expect.objectContaining({ columnClassKey: "fighter", status: "BACKFILLED", issues: [] })],
    });
    expect(readFileSync(databasePath)).toEqual(before);
  });

  it("resynchronizes catalog drift from code while preserving the character rule snapshot", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "snapshot", className: "Bardo", level: 2 });
    db.close();
    expect(run(databasePath, "--apply").status).toBe(0);

    const tamper = new DatabaseSync(databasePath);
    const characterSnapshot = tamper.prepare('SELECT ruleSnapshot FROM "CharacterClass" WHERE characterId = ?').get("snapshot").ruleSnapshot;
    tamper.prepare('UPDATE "ClassRule" SET labelIt = ?, updatedAt = ? WHERE classKey = ?')
      .run("Alterato fuori codice", "2000-01-01T00:00:00.000Z", "bard");
    tamper.close();

    const repaired = run(databasePath, "--apply");
    expect(repaired.status, `${repaired.stdout}\n${repaired.stderr}`).toBe(0);
    expect(repaired.summary.catalog).toMatchObject({
      wouldInsertClassRules: 0,
      wouldUpdateClassRules: 1,
      wouldInsertSubclassRules: 0,
      wouldUpdateSubclassRules: 0,
      insertedClassRules: 0,
      updatedClassRules: 1,
      insertedSubclassRules: 0,
      updatedSubclassRules: 0,
      unchanged: 25,
    });
    const verify = new DatabaseSync(databasePath, { readOnly: true });
    expect(verify.prepare('SELECT labelIt FROM "ClassRule" WHERE classKey = ?').get("bard").labelIt).toBe("Bardo");
    expect(verify.prepare('SELECT ruleSnapshot FROM "CharacterClass" WHERE characterId = ?').get("snapshot").ruleSnapshot)
      .toBe(characterSnapshot);
    verify.close();
  });

  it("persists column/JSON divergences as unresolved without guessing or correcting legacy data", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "divergent", className: "Bardo", level: 5, basicClass: "Mago", basicLevel: 4 });
    const legacyBefore = db.prepare('SELECT className, level, data FROM "Character" WHERE id = ?').get("divergent");
    db.close();

    const result = run(databasePath, "--apply");

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(2);
    expect(result.summary.characters).toMatchObject({ backfilled: 0, unresolved: 1, unresolvedDivergences: 1 });
    expect(result.summary.report[0]).toMatchObject({
      status: "UNRESOLVED",
      columnClassKey: "bard",
      columnLevel: 5,
      wouldInsertCharacterClass: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "CLASS_DIVERGENCE", column: "bard", basicInfo: "wizard" }),
        expect.objectContaining({ code: "LEVEL_DIVERGENCE", column: 5, basicInfo: 4 }),
      ]),
    });
    const state = readM3State(databasePath);
    expect(state.classes).toEqual([]);
    expect(state.progressions[0].backfillStatus).toBe("UNRESOLVED");
    expect(JSON.parse(state.progressions[0].backfillIssues)).toEqual(result.summary.report[0].issues);
    const verify = new DatabaseSync(databasePath, { readOnly: true });
    expect(verify.prepare('SELECT className, level, data FROM "Character" WHERE id = ?').get("divergent")).toEqual(legacyBefore);
    verify.close();
  });

  it("persists unresolved legacy cases explicitly and never guesses combined or invalid classes", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "combined", className: "Guerriero / Ladro", level: 5, basicClass: "Guerriero" });
    addCharacter(db, { id: "bad-level", className: "Bardo", level: 21, basicLevel: 5 });
    db.close();

    const result = run(databasePath, "--apply");

    expect(result.status).toBe(2);
    expect(result.summary.characters).toMatchObject({ total: 2, unresolved: 2, insertedCharacterClasses: 0 });
    expect(result.summary.report).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slug: "combined",
        status: "UNRESOLVED",
        columnClassKey: null,
        issues: expect.arrayContaining([expect.objectContaining({ code: "COLUMN_CLASS_UNRESOLVED" })]),
      }),
      expect.objectContaining({
        slug: "bad-level",
        status: "UNRESOLVED",
        columnLevel: null,
        issues: expect.arrayContaining([expect.objectContaining({ code: "COLUMN_LEVEL_INVALID" })]),
      }),
    ]));
    const state = readM3State(databasePath);
    expect(state.classes).toEqual([]);
    expect(state.progressions.map((row) => row.backfillStatus)).toEqual(["UNRESOLVED", "UNRESOLVED"]);
  });

  it("marks incomplete or invalid legacy JSON unresolved even when columns are valid", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "invalid-json", className: "Bardo", level: 5, rawData: "{" });
    addCharacter(db, { id: "missing-basic-info", className: "Bardo", level: 5, rawData: "{}" });
    addCharacter(db, {
      id: "missing-json-level",
      className: "Bardo",
      level: 5,
      rawData: JSON.stringify({ basicInfo: { class: "Bardo" } }),
    });
    db.close();

    const result = run(databasePath, "--apply");

    expect(result.status).toBe(2);
    expect(result.summary.characters).toMatchObject({ total: 3, backfilled: 0, unresolved: 3, insertedCharacterClasses: 0 });
    expect(result.summary.report).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slug: "invalid-json",
        issues: expect.arrayContaining([expect.objectContaining({ code: "DATA_JSON_INVALID" })]),
      }),
      expect.objectContaining({
        slug: "missing-basic-info",
        issues: expect.arrayContaining([expect.objectContaining({ code: "BASIC_INFO_MISSING" })]),
      }),
      expect.objectContaining({
        slug: "missing-json-level",
        issues: expect.arrayContaining([expect.objectContaining({ code: "BASIC_INFO_LEVEL_INVALID" })]),
      }),
    ]));
    const state = readM3State(databasePath);
    expect(state.classes).toEqual([]);
    expect(state.progressions.map((row) => row.backfillStatus)).toEqual([
      "UNRESOLVED",
      "UNRESOLVED",
      "UNRESOLVED",
    ]);
  });

  it("enforces class levels, one row per character in M3, primary uniqueness, and subclass ownership", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "one", className: "Bardo", level: 2 });
    addCharacter(db, { id: "two", className: "Guerriero", level: 2 });
    db.close();
    expect(run(databasePath, "--apply").status).toBe(0);

    const check = new DatabaseSync(databasePath);
    check.exec("PRAGMA foreign_keys = ON;");
    const bardRule = check.prepare('SELECT id, ruleSnapshot FROM "ClassRule" WHERE classKey = ?').get("bard");
    const fighterRule = check.prepare('SELECT id, ruleSnapshot FROM "ClassRule" WHERE classKey = ?').get("fighter");
    const thief = check.prepare('SELECT id FROM "SubclassRule" WHERE subclassKey = ?').get("thief");
    check.prepare('INSERT INTO "Character" (id, slug, className, level, data) VALUES (?, ?, ?, ?, ?)')
      .run("three", "three", "Bardo", 1, JSON.stringify({ basicInfo: { class: "Bardo", level: 1 } }));

    const insert = (id, rule, classKey, level, subclassRuleId = null) => check.prepare(`
      INSERT INTO "CharacterClass" (
        id, characterId, classRuleId, subclassRuleId, classKey, level, sortOrder, isPrimary,
        subclassStatus, source, ruleSnapshot, createdAt, updatedAt
      ) VALUES (?, 'three', ?, ?, ?, ?, 0, true, 'INCOMPLETE_LEGACY', 'TEST', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, rule.id, subclassRuleId, classKey, level, rule.ruleSnapshot);

    expect(() => insert("bad-level", bardRule, "bard", 0)).toThrow(/CHECK constraint failed/i);
    expect(() => insert("wrong-class-key", bardRule, "fighter", 1)).toThrow(/classKey does not match class rule/i);
    expect(() => insert("wrong-subclass", fighterRule, "fighter", 1, thief.id)).toThrow(/subclass does not belong/i);
    insert("valid", bardRule, "bard", 1);
    expect(() => insert("duplicate", bardRule, "bard", 1)).toThrow(/UNIQUE constraint failed/i);
    expect(() => insert("second-class", fighterRule, "fighter", 1)).toThrow(/UNIQUE constraint failed/i);

    const indexes = new Set(check.prepare('SELECT name FROM sqlite_schema WHERE type = \'index\'').all().map((row) => row.name));
    expect(indexes.has("CharacterClass_characterId_classKey_key")).toBe(true);
    expect(indexes.has("CharacterClass_one_primary_key")).toBe(true);
    expect(indexes.has("CharacterClass_m3_single_class_key")).toBe(true);
    check.close();
  });

  it("rolls back all catalog and backfill writes when an apply step fails", () => {
    const databasePath = temporaryDatabase();
    const db = createLegacyDatabase(databasePath);
    addCharacter(db, { id: "legacy", className: "Bardo", level: 1 });
    db.exec(readFileSync(MIGRATION, "utf8"));
    db.exec(`
      CREATE TRIGGER "force_m3_test_failure"
      BEFORE INSERT ON "SubclassRule"
      BEGIN
        SELECT RAISE(ABORT, 'forced M3 test failure');
      END;
    `);
    db.close();

    const result = run(databasePath, "--apply");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("forced M3 test failure");
    const verify = new DatabaseSync(databasePath, { readOnly: true });
    expect(verify.prepare('SELECT COUNT(*) AS count FROM "ClassRule"').get().count).toBe(0);
    expect(verify.prepare('SELECT COUNT(*) AS count FROM "SubclassRule"').get().count).toBe(0);
    expect(verify.prepare('SELECT COUNT(*) AS count FROM "CharacterProgression"').get().count).toBe(0);
    expect(verify.prepare('SELECT COUNT(*) AS count FROM "CharacterClass"').get().count).toBe(0);
    verify.close();
  });

  it("requires both explicit production authorization and a verified backup flag", () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT, "--apply", "--database", "/data/migration.db"],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires --allow-production and --backup-verified");
  });
});
