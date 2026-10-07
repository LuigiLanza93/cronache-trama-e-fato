import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
if (apply && args.includes("--dry-run")) throw new Error("Choose --apply or --dry-run");
const databaseIndex = args.indexOf("--database");
const databasePath = path.resolve(databaseIndex < 0
  ? path.join(root, "prisma", "migration.db")
  : args[databaseIndex + 1] ?? "");
if (databaseIndex >= 0 && (!args[databaseIndex + 1] || args[databaseIndex + 1].startsWith("--"))) {
  throw new Error("--database requires a path");
}
if (apply && databasePath === path.resolve("/data/migration.db")
  && (!args.includes("--allow-production") || !args.includes("--backup-verified"))) {
  throw new Error("Production migration requires --allow-production and --backup-verified");
}
if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);

const expectedTables = ["CharacterRuleEvent", "CharacterRuleDecision", "CharacterRuleGrant"];
const expectedColumns = {
  CharacterRuleEvent: [
    "id", "characterId", "sequence", "eventType", "requestId", "requestSignature",
    "previewHash", "previousVersion", "resultVersion", "rulesetId", "rulesetVersion",
    "resolverVersion", "catalogHash", "sourceSnapshot", "resultSnapshot",
    "appliedByUserId", "appliedBySnapshot", "createdAt",
  ],
  CharacterRuleDecision: [
    "id", "eventId", "definitionId", "decisionKind", "operation", "selectedOptions",
    "ruleId", "ruleVersion", "definitionSnapshot", "levelSnapshot", "createdAt",
  ],
  CharacterRuleGrant: [
    "id", "eventId", "decisionId", "grantInstanceKey", "grantKind", "aggregateKey",
    "payload", "ruleId", "ruleVersion", "sourceSnapshot", "createdAt",
  ],
};
const expectedIndexes = [
  "CharacterRuleEvent_characterId_sequence_key",
  "CharacterRuleEvent_requestId_key",
  "CharacterRuleEvent_characterId_createdAt_idx",
  "CharacterRuleEvent_appliedByUserId_idx",
  "CharacterRuleDecision_eventId_definitionId_key",
  "CharacterRuleDecision_definitionId_idx",
  "CharacterRuleGrant_eventId_grantInstanceKey_key",
  "CharacterRuleGrant_decisionId_idx",
  "CharacterRuleGrant_grantKind_aggregateKey_idx",
];
const expectedTriggers = [
  "CharacterRuleGrant_decision_event_match_insert",
  "CharacterRuleGrant_decision_event_match_update",
];

function inspect(database) {
  const objectNames = (type) => new Set(
    database.prepare("SELECT name FROM sqlite_schema WHERE type = ?").all(type).map((row) => row.name),
  );
  const tables = objectNames("table");
  const indexes = objectNames("index");
  const triggers = objectNames("trigger");
  const missingTables = expectedTables.filter((name) => !tables.has(name));
  const missingColumns = Object.fromEntries(expectedTables.flatMap((table) => {
    if (!tables.has(table)) return [];
    const actual = new Set(database.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name));
    const missing = expectedColumns[table].filter((column) => !actual.has(column));
    return missing.length > 0 ? [[table, missing]] : [];
  }));
  const missingIndexes = expectedIndexes.filter((name) => !indexes.has(name));
  const missingTriggers = expectedTriggers.filter((name) => !triggers.has(name));
  const count = (table) => tables.has(table)
    ? Number(database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count)
    : 0;
  const snapshotOnly = !tables.has("CharacterCreation")
    ? 0
    : !tables.has("CharacterRuleEvent")
      ? Number(database.prepare('SELECT COUNT(*) AS count FROM "CharacterCreation"').get().count)
      : Number(database.prepare(`
        SELECT COUNT(*) AS count
        FROM "CharacterCreation" creation
        WHERE NOT EXISTS (
          SELECT 1 FROM "CharacterRuleEvent" event
          WHERE event."characterId" = creation."characterId" AND event."eventType" = 'CREATION'
        )
      `).get().count);
  return {
    ready: missingTables.length === 0 && Object.keys(missingColumns).length === 0
      && missingIndexes.length === 0 && missingTriggers.length === 0,
    missingTables,
    missingColumns,
    missingIndexes,
    missingTriggers,
    rowCounts: Object.fromEntries(expectedTables.map((table) => [table, count(table)])),
    snapshotOnly,
  };
}

const database = new DatabaseSync(databasePath);
try {
  database.exec("PRAGMA foreign_keys = ON");
  if (!database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'Character'").get()) {
    throw new Error("Character table missing");
  }
  const before = inspect(database);
  if (apply && !before.ready) {
    const sql = readFileSync(
      path.join(root, "prisma", "migrations", "20261002_character_rule_events", "migration.sql"),
      "utf8",
    );
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      const pending = inspect(database);
      if (!pending.ready) throw new Error(`Character rule event schema incomplete: ${JSON.stringify(pending)}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
  const after = inspect(database);
  if (apply && !after.ready) throw new Error(`Character rule event schema incomplete: ${JSON.stringify(after)}`);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    databasePath,
    before,
    after,
    backfilledRows: 0,
  }));
} finally {
  database.close();
}
