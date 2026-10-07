import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATION = readFileSync(
  path.join(ROOT, "prisma", "migrations", "20261002_character_rule_events", "migration.sql"),
  "utf8",
);
const databases = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function openDatabase() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "Character" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "CharacterCreation" (
      "characterId" TEXT PRIMARY KEY,
      "rulesetVersion" TEXT NOT NULL,
      "selections" TEXT NOT NULL,
      "resolvedSnapshot" TEXT NOT NULL,
      FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE
    );
    INSERT INTO "User" ("id") VALUES ('user-1');
    INSERT INTO "Character" ("id") VALUES ('legacy-guided'), ('new-character'), ('other-character');
    INSERT INTO "CharacterCreation" (
      "characterId", "rulesetVersion", "selections", "resolvedSnapshot"
    ) VALUES ('legacy-guided', '2014', '{}', '{}');
  `);
  return database;
}

function insertEvent(database, {
  id = "event-1",
  characterId = "new-character",
  requestId = "00000000-0000-4000-8000-000000000001",
} = {}) {
  database.prepare(`
    INSERT INTO "CharacterRuleEvent" (
      "id", "characterId", "sequence", "eventType", "requestId", "requestSignature",
      "previewHash", "previousVersion", "resultVersion", "rulesetId", "rulesetVersion",
      "resolverVersion", "catalogHash", "sourceSnapshot", "resultSnapshot",
      "appliedByUserId", "appliedBySnapshot", "createdAt"
    ) VALUES (?, ?, 1, 'CREATION', ?, ?, ?, 0, 1, 'dnd-5e-2014-phb', '2014',
      'creation-event-v1', ?, '{}', '{}', 'user-1', '{}', '2026-10-02T10:00:00.000Z')
  `).run(id, characterId, requestId, "a".repeat(64), "b".repeat(64), "c".repeat(64));
}

describe("character rule event migration", () => {
  it("is restart safe and never invents journal rows for existing creation snapshots", () => {
    const database = openDatabase();
    database.exec(MIGRATION);
    database.exec(MIGRATION);

    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleEvent"').get().count).toBe(0);
    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleDecision"').get().count).toBe(0);
    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleGrant"').get().count).toBe(0);
    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterCreation"').get().count).toBe(1);
  });

  it("enforces event sequencing, request idempotence, JSON and version hashes", () => {
    const database = openDatabase();
    database.exec(MIGRATION);
    insertEvent(database);

    expect(() => insertEvent(database, {
      id: "event-duplicate-sequence",
      requestId: "00000000-0000-4000-8000-000000000002",
    })).toThrow();
    expect(() => insertEvent(database, {
      id: "event-duplicate-request",
      characterId: "other-character",
    })).toThrow();
    expect(() => database.prepare(`
      UPDATE "CharacterRuleEvent" SET "resultSnapshot" = 'invalid json' WHERE "id" = 'event-1'
    `).run()).toThrow();
    expect(() => database.prepare(`
      UPDATE "CharacterRuleEvent" SET "resultVersion" = 4 WHERE "id" = 'event-1'
    `).run()).toThrow();
  });

  it("keeps decisions and grants in the same event and cascades only with their character", () => {
    const database = openDatabase();
    database.exec(MIGRATION);
    insertEvent(database);
    insertEvent(database, {
      id: "event-2",
      characterId: "other-character",
      requestId: "00000000-0000-4000-8000-000000000002",
    });
    database.prepare(`
      INSERT INTO "CharacterRuleDecision" (
        "id", "eventId", "definitionId", "decisionKind", "operation",
        "selectedOptions", "ruleId", "ruleVersion", "definitionSnapshot", "levelSnapshot"
      ) VALUES ('decision-1', 'event-1', 'creation:class', 'class', 'ACQUIRE',
        '["cleric"]', 'phb2014:class:cleric', '1', '{}', '{"totalLevel":1}')
    `).run();
    database.prepare(`
      INSERT INTO "CharacterRuleDecision" (
        "id", "eventId", "definitionId", "decisionKind", "operation",
        "selectedOptions", "ruleId", "ruleVersion", "definitionSnapshot", "levelSnapshot"
      ) VALUES ('decision-2', 'event-2', 'creation:class', 'class', 'ACQUIRE',
        '["wizard"]', 'phb2014:class:wizard', '1', '{}', '{"totalLevel":1}')
    `).run();
    database.prepare(`
      INSERT INTO "CharacterRuleGrant" (
        "id", "eventId", "decisionId", "grantInstanceKey", "grantKind", "aggregateKey",
        "payload", "ruleId", "ruleVersion", "sourceSnapshot"
      ) VALUES ('grant-1', 'event-1', 'decision-1', 'class:cleric', 'CLASS_MEMBERSHIP',
        'class:cleric', '{"classKey":"cleric","level":1}', 'phb2014:class:cleric', '1', '{}')
    `).run();

    expect(() => database.prepare(`
      INSERT INTO "CharacterRuleGrant" (
        "id", "eventId", "decisionId", "grantInstanceKey", "grantKind", "aggregateKey",
        "payload", "ruleId", "ruleVersion", "sourceSnapshot"
      ) VALUES ('grant-cross-event', 'event-1', 'decision-2', 'bad', 'FEATURE',
        'feature:bad', '{}', 'rule', '1', '{}')
    `).run()).toThrow("CharacterRuleGrant decision belongs to another event");

    database.prepare('DELETE FROM "Character" WHERE "id" = ?').run("new-character");
    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleEvent" WHERE "id" = ?').get("event-1").count).toBe(0);
    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleDecision" WHERE "id" = ?').get("decision-1").count).toBe(0);
    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleGrant" WHERE "id" = ?').get("grant-1").count).toBe(0);
    expect(database.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleEvent" WHERE "id" = ?').get("event-2").count).toBe(1);
  });
});
