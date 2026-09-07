import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildCharacterStatePayload,
  inspectCharacterProgressionShadowDatabase,
  readCharacterProgressionShadowFromDatabase,
} from "../../server.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATION_SQL = readFileSync(
  path.join(ROOT, "prisma", "migrations", "20260815_character_progression_m3", "migration.sql"),
  "utf8",
);
const databases = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function openDatabase() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

function createLegacySchema(database) {
  database.exec(`
    CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);
    CREATE TABLE "Character" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "className" TEXT,
      "level" INTEGER,
      "data" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL
    );
  `);
}

function seedCoherentFighter(database) {
  const data = JSON.stringify({
    slug: "aros",
    basicInfo: { characterName: "Aros", class: "Guerriero", level: 5 },
  });
  database.prepare(`
    INSERT INTO "Character" (id, slug, className, level, data, updatedAt)
    VALUES ('aros', 'aros', 'Guerriero', 5, ?, '2026-08-15T00:00:00.000Z')
  `).run(data);
  database.prepare(`
    INSERT INTO "ClassRule" (
      id, classKey, labelIt, labelEn, aliases, rulesetId, rulesetVersion, sourceReference,
      hitDie, casterKind, spellcastingAbility, spellcastingStartLevel, subclassSelectionLevel,
      isCustom, isManual, ruleSnapshot, catalogHash, createdAt, updatedAt
    ) VALUES (
      'srd-5.1@2014:fighter', 'fighter', 'Guerriero', 'Fighter', '["guerriero","fighter"]',
      'srd-5.1', '2014', 'SRD', 10, 'NONE', NULL, NULL, 3, 0, 0, '{}', 'hash',
      '2026-08-15T00:00:00.000Z', '2026-08-15T00:00:00.000Z'
    )
  `).run();
  const legacySnapshot = JSON.stringify({
    column: { className: "Guerriero", level: 5 },
    basicInfo: { class: "Guerriero", level: 5 },
  });
  database.prepare(`
    INSERT INTO "CharacterProgression" (
      characterId, revision, backfillStatus, backfillIssues, legacySnapshot, createdAt, updatedAt
    ) VALUES ('aros', 0, 'BACKFILLED', '[]', ?, '2026-08-15T00:00:00.000Z', '2026-08-15T00:00:00.000Z')
  `).run(legacySnapshot);
  database.prepare(`
    INSERT INTO "CharacterClass" (
      id, characterId, classRuleId, subclassRuleId, classKey, level, sortOrder, isPrimary,
      subclassStatus, source, ruleSnapshot, updatedByUserId, createdAt, updatedAt
    ) VALUES (
      'character-class:aros:fighter', 'aros', 'srd-5.1@2014:fighter', NULL, 'fighter', 5, 0, 1,
      'INCOMPLETE_LEGACY', 'LEGACY_BACKFILL', '{}', NULL,
      '2026-08-15T00:00:00.000Z', '2026-08-15T00:00:00.000Z'
    )
  `).run();
}

function readCharacterRow(database) {
  return database.prepare('SELECT * FROM "Character" WHERE id = ?').get("aros");
}

describe("M3 character progression shadow", () => {
  it("distinguishes absent, partial and complete additive schemas without writing", () => {
    const absent = openDatabase();
    createLegacySchema(absent);
    expect(inspectCharacterProgressionShadowDatabase(absent)).toMatchObject({
      complete: false,
      status: "ABSENT",
    });

    const partial = openDatabase();
    createLegacySchema(partial);
    partial.exec('CREATE TABLE "ClassRule" ("id" TEXT PRIMARY KEY)');
    expect(inspectCharacterProgressionShadowDatabase(partial)).toMatchObject({
      complete: false,
      status: "PARTIAL",
      missingTables: expect.arrayContaining(["CharacterClass", "CharacterProgression"]),
    });

    const complete = openDatabase();
    createLegacySchema(complete);
    complete.exec(MIGRATION_SQL);
    expect(inspectCharacterProgressionShadowDatabase(complete)).toEqual({
      complete: true,
      status: "COMPLETE",
      missingTables: [],
      missingColumns: {},
      missingObjects: {},
    });

    complete.exec('DROP TRIGGER "CharacterClass_class_key_matches_rule_update"');
    expect(inspectCharacterProgressionShadowDatabase(complete)).toMatchObject({
      complete: false,
      status: "PARTIAL",
      missingObjects: {
        trigger: ["CharacterClass_class_key_matches_rule_update"],
      },
    });
  });

  it("uses the structured shadow only for a complete, BACKFILLED and coherent monoclasse", () => {
    const database = openDatabase();
    createLegacySchema(database);
    database.exec(MIGRATION_SQL);
    seedCoherentFighter(database);

    expect(readCharacterProgressionShadowFromDatabase(database, readCharacterRow(database))).toEqual({
      source: "STRUCTURED",
      classes: [{
        classKey: "fighter",
        classRuleId: "srd-5.1@2014:fighter",
        level: 5,
        sortOrder: 0,
        isPrimary: true,
        label: "Guerriero",
        subclassRuleId: null,
        subclassKey: null,
        subclassStatus: "INCOMPLETE_LEGACY",
        source: "LEGACY_BACKFILL",
      }],
      totalLevel: 5,
      progressionRevision: 0,
      diagnostics: [],
    });
  });

  it("accepts a persisted ClassRule alias when the verified legacy snapshot uses that alias", () => {
    const database = openDatabase();
    createLegacySchema(database);
    database.exec(MIGRATION_SQL);
    seedCoherentFighter(database);
    const aliasedData = JSON.stringify({
      slug: "aros",
      basicInfo: { characterName: "Aros", class: "Fighter", level: 5 },
    });
    database.prepare('UPDATE "Character" SET className = ?, data = ? WHERE id = ?')
      .run("Fighter", aliasedData, "aros");
    database.prepare('UPDATE "CharacterProgression" SET legacySnapshot = ? WHERE characterId = ?').run(
      JSON.stringify({
        column: { className: "Fighter", level: 5 },
        basicInfo: { class: "Fighter", level: 5 },
      }),
      "aros",
    );

    expect(readCharacterProgressionShadowFromDatabase(database, readCharacterRow(database))).toMatchObject({
      source: "STRUCTURED",
      classes: [{ classKey: "fighter", level: 5 }],
      totalLevel: 5,
    });
  });

  it("rejects an incoherent subclass status instead of trusting the class row", () => {
    const database = openDatabase();
    createLegacySchema(database);
    database.exec(MIGRATION_SQL);
    seedCoherentFighter(database);
    database.prepare(`
      UPDATE "CharacterClass" SET subclassStatus = 'SELECTED' WHERE characterId = 'aros'
    `).run();

    const shadow = readCharacterProgressionShadowFromDatabase(database, readCharacterRow(database));
    expect(shadow.source).toBe("LEGACY");
    expect(shadow.diagnostics).toContainEqual({ code: "SUBCLASS_SELECTION_MISSING" });
  });

  it("falls back after a legacy class/level patch and never updates CharacterClass", () => {
    const database = openDatabase();
    createLegacySchema(database);
    database.exec(MIGRATION_SQL);
    seedCoherentFighter(database);
    const patchedData = JSON.stringify({
      slug: "aros",
      basicInfo: { characterName: "Aros", class: "Guerriero", level: 6 },
    });
    database.prepare(`
      UPDATE "Character" SET level = 6, data = ?, updatedAt = '2026-08-15T01:00:00.000Z'
      WHERE id = 'aros'
    `).run(patchedData);

    const shadow = readCharacterProgressionShadowFromDatabase(database, readCharacterRow(database));
    expect(shadow).toMatchObject({ source: "LEGACY", classes: [], totalLevel: 6 });
    expect(shadow.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "LEGACY_PROJECTION_CHANGED_AFTER_BACKFILL",
      "LEGACY_COLUMN_LEVEL_MISMATCH",
      "LEGACY_JSON_LEVEL_MISMATCH",
    ]));
    expect(database.prepare('SELECT level FROM "CharacterClass" WHERE characterId = ?').get("aros").level).toBe(5);
  });

  it("keeps the verified shadow coherent after an unrelated legacy data patch", () => {
    const database = openDatabase();
    createLegacySchema(database);
    database.exec(MIGRATION_SQL);
    seedCoherentFighter(database);
    const patchedData = JSON.stringify({
      slug: "aros",
      basicInfo: { characterName: "Aros", class: "Guerriero", level: 5 },
      notes: "Una modifica non legata alla progressione",
    });
    database.prepare(`
      UPDATE "Character" SET data = ?, updatedAt = '2026-08-15T01:00:00.000Z' WHERE id = 'aros'
    `).run(patchedData);

    expect(readCharacterProgressionShadowFromDatabase(database, readCharacterRow(database))).toMatchObject({
      source: "STRUCTURED",
      totalLevel: 5,
      diagnostics: [],
    });
  });

  it("falls back for a recorded divergent backfill even if the class row looks valid", () => {
    const database = openDatabase();
    createLegacySchema(database);
    database.exec(MIGRATION_SQL);
    seedCoherentFighter(database);
    database.prepare(`
      UPDATE "CharacterProgression"
      SET backfillStatus = 'BACKFILLED_WITH_DIVERGENCE', backfillIssues = '[{"code":"CLASS_DIVERGENCE"}]'
      WHERE characterId = 'aros'
    `).run();

    const shadow = readCharacterProgressionShadowFromDatabase(database, readCharacterRow(database));
    expect(shadow.source).toBe("LEGACY");
    expect(shadow.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "CHARACTER_PROGRESSION_NOT_BACKFILLED",
      "CHARACTER_PROGRESSION_HAS_ISSUES",
    ]));
  });

  it("does not expose the internal progression object in realtime state payloads", () => {
    const state = { slug: "aros", basicInfo: { class: "Guerriero", level: 5 } };
    const payload = buildCharacterStatePayload("aros", {
      state,
      revision: "revision-1",
      progression: { source: "STRUCTURED", classes: [{ classKey: "fighter", level: 5 }], totalLevel: 5 },
    });
    expect(payload).toEqual({ slug: "aros", revision: "revision-1", state });
    expect(payload).not.toHaveProperty("progression");
    expect(payload.state).not.toHaveProperty("classes");
    expect(payload.state).not.toHaveProperty("totalLevel");
  });
});
