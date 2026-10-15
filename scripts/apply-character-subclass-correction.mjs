import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "prisma",
  "migrations",
  "20261015_character_subclass_correction",
  "migration.sql",
);

export const SUBCLASS_CORRECTION_COLUMNS = Object.freeze([
  "id", "characterId", "requestId", "requestSignature", "mode", "targetClassKey",
  "targetClassRuleId", "previousSubclassKey", "previousSubclassRuleId", "targetSubclassKey",
  "targetSubclassRuleId", "classLevel", "totalLevel", "progressionRevisionBefore",
  "progressionRevisionAfter", "characterRevisionBefore", "characterRevisionAfter", "reason",
  "policyVersion", "requestSnapshot", "beforeSnapshot", "afterSnapshot", "ruleSnapshot",
  "resultSnapshot", "appliedByUserId", "appliedBySnapshot", "appliedAt",
]);

export const SUBCLASS_CORRECTION_OBJECTS = Object.freeze({
  index: Object.freeze([
    "CharacterSubclassHistory_characterId_requestId_key",
    "CharacterSubclassHistory_characterId_progressionRevisionAfter_key",
    "CharacterSubclassHistory_characterId_appliedAt_idx",
    "CharacterSubclassHistory_targetClassRuleId_idx",
    "CharacterSubclassHistory_previousSubclassRuleId_idx",
    "CharacterSubclassHistory_targetSubclassRuleId_idx",
    "CharacterSubclassHistory_appliedByUserId_idx",
  ]),
  trigger: Object.freeze([
    "CharacterSubclassHistory_class_key_matches_rule_insert",
    "CharacterSubclassHistory_subclasses_match_class_insert",
  ]),
});

export function inspectSubclassCorrectionSchema(database) {
  const dependencies = [
    "Character", "User", "ClassRule", "SubclassRule", "CharacterProgression", "CharacterClass",
    "CharacterHitPointState", "CharacterHitDiePool", "CharacterHitPointAdjustment",
    "CharacterResourcePool", "CharacterResourcePoolSource", "CharacterResourcePoolTier",
  ];
  const presentTables = new Set(
    database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => String(row.name)),
  );
  const missingDependencies = dependencies.filter((name) => !presentTables.has(name));
  const tablePresent = presentTables.has("CharacterSubclassHistory");
  const actualColumns = tablePresent
    ? new Set(database.prepare('PRAGMA table_info("CharacterSubclassHistory")').all().map((row) => String(row.name)))
    : new Set();
  const missingColumns = SUBCLASS_CORRECTION_COLUMNS.filter((name) => !actualColumns.has(name));
  const missingObjects = {};
  for (const [type, required] of Object.entries(SUBCLASS_CORRECTION_OBJECTS)) {
    const actual = new Set(
      database.prepare("SELECT name FROM sqlite_schema WHERE type = ?").all(type).map((row) => String(row.name)),
    );
    const missing = required.filter((name) => !actual.has(name));
    if (missing.length) missingObjects[type] = missing;
  }
  const partial = tablePresent && (missingColumns.length > 0 || Object.keys(missingObjects).length > 0);
  return {
    ready: missingDependencies.length === 0 && tablePresent && !partial,
    tablePresent,
    partial,
    missingDependencies,
    missingColumns,
    missingObjects,
  };
}

function parseArguments(argv) {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run") || !apply;
  if (apply && argv.includes("--dry-run")) throw new Error("Use either --apply or --dry-run, not both");
  const databaseIndex = argv.indexOf("--database");
  const inline = argv.find((value) => value.startsWith("--database="));
  const rawDatabase = databaseIndex >= 0 ? argv[databaseIndex + 1] : inline?.slice("--database=".length);
  if (databaseIndex >= 0 && (!rawDatabase || rawDatabase.startsWith("--"))) {
    throw new Error("--database requires a path");
  }
  const databasePath = path.resolve(rawDatabase || path.join(root, "prisma", "migration.db"));
  const productionPath = path.resolve("/data/migration.db");
  if (apply && databasePath === productionPath
    && (!argv.includes("--allow-production") || !argv.includes("--backup-verified"))) {
    throw new Error("Applying to /data/migration.db requires --allow-production and --backup-verified");
  }
  return { apply, dryRun, databasePath };
}

function integrityResult(database) {
  return database.prepare("PRAGMA integrity_check").all().map((row) => String(Object.values(row)[0]));
}

function foreignKeyViolations(database) {
  return database.prepare("PRAGMA foreign_key_check").all()
    .map((row) => ({
      table: String(row.table),
      rowid: row.rowid == null ? null : Number(row.rowid),
      parent: String(row.parent),
      fkid: Number(row.fkid),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

async function main() {
  const { apply, dryRun, databasePath } = parseArguments(process.argv.slice(2));
  if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
  const database = new DatabaseSync(databasePath, { readOnly: !apply });
  try {
    database.exec("PRAGMA foreign_keys = ON");
    const before = inspectSubclassCorrectionSchema(database);
    const beforeIntegrity = integrityResult(database);
    if (beforeIntegrity.length !== 1 || beforeIntegrity[0] !== "ok") {
      throw new Error(`Database integrity check failed: ${beforeIntegrity.join("; ")}`);
    }
    const beforeForeignKeys = foreignKeyViolations(database);
    if (before.missingDependencies.length) {
      throw new Error(`Subclass correction requires: ${before.missingDependencies.join(", ")}`);
    }
    if (before.partial) {
      throw new Error("CharacterSubclassHistory is partial; refusing an unsafe automatic repair");
    }
    if (apply && !before.ready) {
      database.exec("BEGIN IMMEDIATE");
      try {
        database.exec(readFileSync(migrationPath, "utf8"));
        const transactional = inspectSubclassCorrectionSchema(database);
        if (!transactional.ready) throw new Error("Subclass correction migration verification failed");
        const transactionalIntegrity = integrityResult(database);
        if (transactionalIntegrity.length !== 1 || transactionalIntegrity[0] !== "ok") {
          throw new Error(`Database integrity check failed after migration: ${transactionalIntegrity.join("; ")}`);
        }
        const afterForeignKeys = foreignKeyViolations(database);
        if (JSON.stringify(afterForeignKeys) !== JSON.stringify(beforeForeignKeys)) {
          throw new Error("Subclass correction migration changed the foreign-key violation baseline");
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
    const after = inspectSubclassCorrectionSchema(database);
    if (apply && !after.ready) throw new Error("Subclass correction migration verification failed");
    console.log(JSON.stringify({
      mode: dryRun ? "dry-run" : "apply",
      databasePath,
      before,
      after,
      integrity: beforeIntegrity,
      foreignKeyViolationCount: beforeForeignKeys.length,
    }, null, 2));
  } finally {
    database.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
