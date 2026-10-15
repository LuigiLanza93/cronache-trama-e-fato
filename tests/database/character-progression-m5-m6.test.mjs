import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const M5_SCRIPT = path.join(ROOT, "scripts", "apply-character-progression-m5.mjs");
const M6_SCRIPT = path.join(ROOT, "scripts", "apply-character-progression-m6.mjs");
const M3 = readFileSync(path.join(ROOT, "prisma/migrations/20260815_character_progression_m3/migration.sql"), "utf8");
const M4 = readFileSync(path.join(ROOT, "prisma/migrations/20260921_character_progression_m4/migration.sql"), "utf8");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDatabase() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-m5-m6-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "migration.db");
}
function run(script, databasePath, ...arguments_) {
  return spawnSync(process.execPath, [script, ...arguments_, "--database", databasePath], { cwd: ROOT, encoding: "utf8" });
}

function classRule(db, { classKey, hitDie, casterKind, ability = null, start = null }) {
  const id = `srd-5.1-2014@5.1:${classKey}`;
  db.prepare(`INSERT INTO "ClassRule" (
    id, classKey, labelIt, labelEn, aliases, rulesetId, rulesetVersion, sourceReference,
    hitDie, casterKind, spellcastingAbility, spellcastingStartLevel, subclassSelectionLevel,
    isCustom, isManual, ruleSnapshot, catalogHash, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, 'srd-5.1-2014', '5.1', 'TEST', ?, ?, ?, ?, 3, 0, 0, '{}', 'hash', ?, ?)`)
    .run(id, classKey, classKey, classKey, JSON.stringify([classKey]), hitDie, casterKind, ability, start,
      "2026-09-22T00:00:00.000Z", "2026-09-22T00:00:00.000Z");
  return id;
}

function createFixture(databasePath) {
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "displayName" TEXT NOT NULL);
    CREATE TABLE "Character" (
      "id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "className" TEXT, "level" INTEGER,
      "data" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL
    );
  `);
  db.exec(M3);
  db.exec(M4);
  const fighterRule = classRule(db, { classKey: "fighter", hitDie: 10, casterKind: "NONE" });
  const bardRule = classRule(db, { classKey: "bard", hitDie: 8, casterKind: "FULL", ability: "charisma", start: 1 });
  const warlockRule = classRule(db, { classKey: "warlock", hitDie: 8, casterKind: "PACT", ability: "charisma", start: 1 });
  const definitions = [
    {
      id: "fighter", className: "Guerriero", level: 6, classKey: "fighter", ruleId: fighterRule,
      combatStats: { hitPointMaximum: 65, currentHitPoints: 70, temporaryHitPoints: 2, hitDice: "1d10",
        deathSaves: { successes: 1, failures: 2 }, restState: { maxHitDice: 5, hitDiceRemaining: 3, shortRestsUsedSinceLongRest: 1 },
        spellSlots: { 8: [{ id: 1, active: true }, { id: 2, active: false }, { id: 3, active: false }, { id: 4, active: false }] } },
    },
    {
      id: "bard", className: "Bardo", level: 5, classKey: "bard", ruleId: bardRule,
      combatStats: { hitPointMaximum: 40, currentHitPoints: 40, temporaryHitPoints: 0, hitDice: "1d8",
        deathSaves: { successes: 0, failures: 0 }, restState: { maxHitDice: 5, hitDiceRemaining: 5, shortRestsUsedSinceLongRest: 0 },
        spellSlots: { 1: Array.from({ length: 4 }, (_, i) => ({ id: i + 1, active: i === 0 })),
          2: Array.from({ length: 3 }, (_, i) => ({ id: i + 1, active: false })),
          3: Array.from({ length: 2 }, (_, i) => ({ id: i + 1, active: false })) } },
    },
    {
      id: "warlock", className: "Warlock", level: 5, classKey: "warlock", ruleId: warlockRule,
      combatStats: { hitPointMaximum: 35, currentHitPoints: 30, temporaryHitPoints: 0, hitDice: "1d8",
        deathSaves: { successes: 0, failures: 0 }, restState: { maxHitDice: 5, hitDiceRemaining: 4, shortRestsUsedSinceLongRest: 0 },
        spellSlots: { 3: [{ id: 1, active: true }, { id: 2, active: false }] } },
    },
  ];
  for (const item of definitions) {
    const data = { slug: item.id, basicInfo: { characterName: item.id, class: item.className, level: item.level },
      abilityScores: { constitution: 14 }, combatStats: item.combatStats };
    db.prepare('INSERT INTO "Character" (id, slug, className, level, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(item.id, item.id, item.className, item.level, JSON.stringify(data), "2026-09-22T00:00:00.000Z");
    db.prepare(`INSERT INTO "CharacterProgression"
      (characterId, revision, backfillStatus, backfillIssues, legacySnapshot, createdAt, updatedAt)
      VALUES (?, 0, 'BACKFILLED', '[]', '{}', ?, ?)`)
      .run(item.id, "2026-09-22T00:00:00.000Z", "2026-09-22T00:00:00.000Z");
    db.prepare(`INSERT INTO "CharacterClass"
      (id, characterId, classRuleId, subclassRuleId, classKey, level, sortOrder, isPrimary,
       subclassStatus, source, ruleSnapshot, updatedByUserId, createdAt, updatedAt)
      VALUES (?, ?, ?, NULL, ?, ?, 0, 1, 'INCOMPLETE_LEGACY', 'LEGACY_BACKFILL', '{}', NULL, ?, ?)`)
      .run(`class:${item.id}`, item.id, item.ruleId, item.classKey, item.level,
        "2026-09-22T00:00:00.000Z", "2026-09-22T00:00:00.000Z");
  }
  db.prepare(`INSERT INTO "CharacterLevelHistory" (
    id, characterId, requestId, requestSignature, operationType, mode, targetClassKey, targetClassRuleId,
    targetSubclassKey, targetSubclassRuleId, classLevelBefore, classLevelAfter, totalLevelBefore, totalLevelAfter,
    progressionRevisionBefore, progressionRevisionAfter, characterRevisionBefore, characterRevisionAfter,
    rulesetId, rulesetVersion, policyVersion, requestSnapshot, beforeSnapshot, afterSnapshot, ruleSnapshot,
    resultSnapshot, overrideReason, appliedByUserId, appliedBySnapshot, hitDieSize, hitPointMethod,
    hitPointsGained, constitutionModifier, appliedAt
  ) VALUES (?, ?, ?, ?, 'LEVEL_UP', 'INCREMENT_EXISTING', ?, ?, NULL, NULL, 5, 6, 5, 6,
    0, 1, ?, ?, 'srd-5.1-2014', '5.1', 'm4-v1', '{}', '{}', '{}', '{}', '{}', NULL, NULL, '{}', 10, NULL, NULL, NULL, ?)`)
    .run("history:fighter", "fighter", "request-fighter", "a".repeat(64), "fighter", fighterRule,
      "2026-09-22T00:00:00.000Z", "2026-09-22T00:01:00.000Z", "2026-09-22T00:01:00.000Z");
  return db;
}

describe("M5 persistence and conservative backfill", () => {
  it("preserves effective legacy HP, marks deferred history manual, and reruns without duplicates", () => {
    const databasePath = temporaryDatabase(); createFixture(databasePath).close();
    const dryRun = run(M5_SCRIPT, databasePath, "--dry-run");
    expect(dryRun.status).toBe(0);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({ schema: { presentBefore: false, wouldApply: true }, characters: { total: 3, legacyManual: 3 } });
    expect(run(M5_SCRIPT, databasePath, "--apply").status).toBe(0);
    const rerun = run(M5_SCRIPT, databasePath, "--apply");
    expect(rerun.status).toBe(0);
    expect(JSON.parse(rerun.stdout).inserted).toEqual({ states: 0, pools: 0, adjustments: 0 });

    const db = new DatabaseSync(databasePath);
    const state = db.prepare('SELECT * FROM "CharacterHitPointState" WHERE characterId = ?').get("fighter");
    expect(state).toMatchObject({ maximumHitPoints: 65, currentHitPoints: 70, backfillStatus: "LEGACY_MANUAL" });
    expect(db.prepare('SELECT dieSize, maximum, remaining, source FROM "CharacterHitDiePool" WHERE characterId = ?').get("fighter"))
      .toMatchObject({ dieSize: 10, maximum: 6, remaining: 3, source: "LEGACY_MANUAL" });
    expect(db.prepare('SELECT COUNT(*) AS count FROM "CharacterHitPointAdjustment"').get().count).toBe(3);
    expect(() => db.prepare('UPDATE "CharacterLevelHistory" SET hitPointMethod = ? WHERE id = ?').run("HOUSE_RULE_MAX", "history:fighter"))
      .toThrow(/invalid M5 hit point bundle/i);
    db.prepare(`UPDATE "CharacterLevelHistory" SET hitPointMethod = 'HOUSE_RULE_MAX', hitPointsGained = 12,
      constitutionModifier = 2 WHERE id = ?`).run("history:fighter");
    db.close();
  });
});

describe("M6 persistence and resource separation", () => {
  it("separates Spellcasting, Pact Magic, and fighter legacy maneuvers", () => {
    const databasePath = temporaryDatabase(); createFixture(databasePath).close();
    expect(run(M6_SCRIPT, databasePath, "--apply").status).toBe(0);
    const rerun = run(M6_SCRIPT, databasePath, "--apply");
    expect(rerun.status).toBe(0);
    expect(JSON.parse(rerun.stdout).inserted).toEqual({ pools: 0, sources: 0, tiers: 0 });
    const db = new DatabaseSync(databasePath);
    expect(db.prepare('SELECT kind, resetPolicy, backfillStatus FROM "CharacterResourcePool" WHERE characterId = ?').get("bard"))
      .toMatchObject({ kind: "SPELLCASTING", resetPolicy: "LONG_REST", backfillStatus: "BACKFILLED" });
    expect(db.prepare('SELECT kind, resetPolicy, backfillStatus FROM "CharacterResourcePool" WHERE characterId = ?').get("warlock"))
      .toMatchObject({ kind: "PACT_MAGIC", resetPolicy: "SHORT_REST", backfillStatus: "BACKFILLED" });
    expect(db.prepare('SELECT kind, resetPolicy, backfillStatus FROM "CharacterResourcePool" WHERE characterId = ?').get("fighter"))
      .toMatchObject({ kind: "CLASS_RESOURCE", resetPolicy: "SHORT_REST", backfillStatus: "LEGACY_MANUAL" });
    expect(db.prepare(`SELECT derivedMaximum, maximumOverride, used FROM "CharacterResourcePoolTier" t
      JOIN "CharacterResourcePool" p ON p.id = t.poolId WHERE p.characterId = 'warlock'`).get())
      .toMatchObject({ derivedMaximum: 2, maximumOverride: null, used: 1 });
    expect(() => db.prepare(`UPDATE "CharacterResourcePoolTier" SET used = 99 WHERE poolId =
      (SELECT id FROM "CharacterResourcePool" WHERE characterId = 'warlock')`).run()).toThrow(/CHECK constraint failed/i);
    db.close();
  });

  it("refuses partial schema and production apply without both guards", () => {
    const databasePath = temporaryDatabase(); const db = createFixture(databasePath);
    db.exec('CREATE TABLE "CharacterResourcePool" ("id" TEXT PRIMARY KEY);'); db.close();
    expect(run(M6_SCRIPT, databasePath, "--apply").status).toBe(1);
    const production = run(M6_SCRIPT, "/data/migration.db", "--apply");
    expect(production.status).toBe(1);
    expect(production.stderr).toContain("requires --allow-production and --backup-verified");
  });
});
