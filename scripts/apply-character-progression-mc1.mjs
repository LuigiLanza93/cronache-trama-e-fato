import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "prisma", "migrations", "20260923_character_progression_mc1", "migration.sql");

function argumentsFor(argv) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) throw new Error("Use either --apply or --dry-run, not both");
  const databaseIndex = argv.indexOf("--database");
  const flag = argv.find((value) => value.startsWith("--database="));
  const databaseValue = databaseIndex >= 0 ? argv[databaseIndex + 1] : flag?.slice("--database=".length);
  if (databaseIndex >= 0 && (!databaseValue || databaseValue.startsWith("--"))) {
    throw new Error("--database requires a path");
  }
  const databasePath = path.resolve(databaseValue || path.join(root, "prisma", "migration.db"));
  if (apply && databasePath === path.resolve("/data/migration.db")
    && (!argv.includes("--allow-production") || !argv.includes("--backup-verified"))) {
    throw new Error("Applying to /data/migration.db requires --allow-production and --backup-verified");
  }
  return { apply, databasePath };
}

function inspect(db) {
  const table = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'CharacterClass'").get();
  if (!table) throw new Error("MC1 requires the M3 CharacterClass table");
  const singleClassIndex = Boolean(db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'CharacterClass_m3_single_class_key'",
  ).get());
  const duplicateClasses = db.prepare(`
    SELECT characterId, classKey, COUNT(*) AS count
    FROM "CharacterClass" GROUP BY characterId, classKey HAVING COUNT(*) > 1
  `).all();
  const invalidTotals = db.prepare(`
    SELECT characterId, SUM(level) AS totalLevel
    FROM "CharacterClass" GROUP BY characterId HAVING SUM(level) > 20
  `).all();
  const objectNames = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type IN ('index', 'trigger')").all().map((row) => String(row.name)));
  const requiredObjects = [
    "CharacterClass_characterId_classKey_key",
    "CharacterClass_characterId_sortOrder_key",
    "CharacterClass_one_primary_key",
    "CharacterClass_class_key_matches_rule_insert",
    "CharacterClass_class_key_matches_rule_update",
    "CharacterClass_subclass_matches_class_insert",
    "CharacterClass_subclass_matches_class_update",
    "CharacterClass_total_level_limit_insert",
    "CharacterClass_total_level_limit_update",
  ];
  const missingObjects = requiredObjects.filter((name) => !objectNames.has(name));
  return { singleClassIndex, duplicateClasses, invalidTotals, missingObjects };
}

const { apply, databasePath } = argumentsFor(process.argv.slice(2));
if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
const db = new DatabaseSync(databasePath);
try {
  db.exec("PRAGMA foreign_keys = ON");
  const before = inspect(db);
  if (before.duplicateClasses.length || before.invalidTotals.length || before.missingObjects.length) {
    throw new Error(`MC1 precheck failed: invalid CharacterClass state${before.missingObjects.length ? `; missing ${before.missingObjects.join(", ")}` : ""}`);
  }
  if (apply && before.singleClassIndex) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(readFileSync(migrationPath, "utf8"));
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  const after = inspect(db);
  if (apply && after.singleClassIndex) throw new Error("MC1 verification failed: guard index still present");
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", databasePath, before, after }, null, 2));
} finally {
  db.close();
}
