import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function inspectPassiveHitPointSchema(database) {
  const columns = database.prepare('PRAGMA table_info("CharacterHitPointState")').all();
  const column = columns.find((entry) => entry.name === "passiveBonusApplied");
  return { ready: Boolean(column && column.type.toUpperCase() === "INTEGER" && column.notnull === 1 && String(column.dflt_value) === "0"),
    dependencyReady: columns.some((entry) => entry.name === "maximumHitPoints"), columnPresent: Boolean(column) };
}

function run(argv) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) throw new Error("Choose --apply or --dry-run");
  const index = argv.indexOf("--database");
  const inline = argv.find((entry) => entry.startsWith("--database="));
  const supplied = index >= 0 ? argv[index + 1] : inline?.slice(11);
  if (index >= 0 && (!supplied || supplied.startsWith("--"))) throw new Error("--database requires a path");
  const databasePath = path.resolve(supplied || path.join(root, "prisma", "migration.db"));
  if (apply && databasePath === path.resolve("/data/migration.db") && (!argv.includes("--allow-production") || !argv.includes("--backup-verified"))) {
    throw new Error("Production requires explicit authorization, --allow-production and --backup-verified");
  }
  if (!fs.existsSync(databasePath)) throw new Error("Database not found");
  const database = new DatabaseSync(databasePath, { readOnly: !apply });
  try {
    database.exec("PRAGMA foreign_keys = ON");
    const before = inspectPassiveHitPointSchema(database);
    if (!before.dependencyReady) throw new Error("M5 hit point state is required first");
    if (before.columnPresent && !before.ready) throw new Error("Partial or incompatible passive HP schema");
    const integrity = database.prepare("PRAGMA integrity_check").all().map((row) => Object.values(row)[0]);
    if (integrity.length !== 1 || integrity[0] !== "ok") throw new Error("Integrity check failed");
    const foreignKeys = () => JSON.stringify(database.prepare("PRAGMA foreign_key_check").all());
    const beforeForeignKeys = foreignKeys();
    if (apply && !before.ready) {
      database.exec("BEGIN IMMEDIATE");
      try {
        database.exec(fs.readFileSync(path.join(root, "prisma", "migrations", "20261015_character_passive_hit_points", "migration.sql"), "utf8"));
        if (!inspectPassiveHitPointSchema(database).ready) throw new Error("Schema verification failed");
        if (foreignKeys() !== beforeForeignKeys) throw new Error("Foreign-key baseline changed");
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    }
    console.log(JSON.stringify({ databasePath, mode: apply ? "apply" : "dry-run", before, after: inspectPassiveHitPointSchema(database), integrity,
      foreignKeyViolationCount: JSON.parse(beforeForeignKeys).length }, null, 2));
  } finally { database.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
