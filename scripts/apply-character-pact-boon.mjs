import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "prisma",
  "migrations",
  "20261015_character_pact_boon",
  "migration.sql",
);

export const PACT_BOON_HISTORY_COLUMNS = Object.freeze([
  "id", "characterId", "requestId", "requestSignature", "operationType", "targetClassKey",
  "previousPactBoonKey", "targetPactBoonKey", "progressionRevisionBefore",
  "progressionRevisionAfter", "characterRevisionBefore", "characterRevisionAfter", "reason",
  "policyVersion", "requestSnapshot", "beforeSnapshot", "afterSnapshot", "resultSnapshot",
  "appliedByUserId", "appliedBySnapshot", "appliedAt",
]);

export const PACT_BOON_SCHEMA_OBJECTS = Object.freeze({
  index: Object.freeze([
    "CharacterPactBoonHistory_characterId_request_key",
    "CharacterPactBoonHistory_characterId_progressionRevisionAfter_key",
    "CharacterPactBoonHistory_characterId_appliedAt_idx",
    "CharacterPactBoonHistory_appliedByUserId_idx",
  ]),
  trigger: Object.freeze([
    "CharacterClass_pact_boon_insert",
    "CharacterClass_pact_boon_update",
  ]),
});

export function inspectPactBoonSchema(database) {
  const tables = new Set(
    database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => String(row.name)),
  );
  const missingDependencies = ["Character", "User", "CharacterClass", "SubclassRule"]
    .filter((name) => !tables.has(name));
  const classColumns = tables.has("CharacterClass")
    ? new Set(database.prepare('PRAGMA table_info("CharacterClass")').all().map((row) => String(row.name)))
    : new Set();
  const classColumnPresent = classColumns.has("pactBoonKey");
  const historyTablePresent = tables.has("CharacterPactBoonHistory");
  const historyColumns = historyTablePresent
    ? new Set(database.prepare('PRAGMA table_info("CharacterPactBoonHistory")').all().map((row) => String(row.name)))
    : new Set();
  const missingColumns = PACT_BOON_HISTORY_COLUMNS.filter((name) => !historyColumns.has(name));
  const missingObjects = {};
  for (const [type, required] of Object.entries(PACT_BOON_SCHEMA_OBJECTS)) {
    const actual = new Set(
      database.prepare("SELECT name FROM sqlite_schema WHERE type = ?").all(type).map((row) => String(row.name)),
    );
    const missing = required.filter((name) => !actual.has(name));
    if (missing.length) missingObjects[type] = missing;
  }
  const anyFeaturePart = classColumnPresent || historyTablePresent;
  const ready = missingDependencies.length === 0 && classColumnPresent && historyTablePresent
    && missingColumns.length === 0 && Object.keys(missingObjects).length === 0;
  return {
    ready,
    partial: anyFeaturePart && !ready,
    classColumnPresent,
    historyTablePresent,
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
    .map((row) => ({ table: String(row.table), rowid: row.rowid == null ? null : Number(row.rowid), parent: String(row.parent), fkid: Number(row.fkid) }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

async function main() {
  const { apply, dryRun, databasePath } = parseArguments(process.argv.slice(2));
  if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
  const database = new DatabaseSync(databasePath, { readOnly: !apply });
  try {
    database.exec("PRAGMA foreign_keys = ON");
    const before = inspectPactBoonSchema(database);
    const beforeIntegrity = integrityResult(database);
    if (beforeIntegrity.length !== 1 || beforeIntegrity[0] !== "ok") {
      throw new Error(`Database integrity check failed: ${beforeIntegrity.join("; ")}`);
    }
    const beforeForeignKeys = foreignKeyViolations(database);
    if (before.missingDependencies.length) {
      throw new Error(`Pact boon requires: ${before.missingDependencies.join(", ")}`);
    }
    if (before.partial) throw new Error("Pact boon schema is partial; refusing an unsafe automatic repair");
    if (apply && !before.ready) {
      database.exec("BEGIN IMMEDIATE");
      try {
        database.exec(readFileSync(migrationPath, "utf8"));
        const transactional = inspectPactBoonSchema(database);
        if (!transactional.ready) throw new Error("Pact boon migration verification failed");
        const afterForeignKeys = foreignKeyViolations(database);
        if (JSON.stringify(afterForeignKeys) !== JSON.stringify(beforeForeignKeys)) {
          throw new Error("Pact boon migration changed the foreign-key violation baseline");
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
    const after = inspectPactBoonSchema(database);
    if (apply && !after.ready) throw new Error("Pact boon migration verification failed");
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
