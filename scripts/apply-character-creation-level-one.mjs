import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
if (apply && args.includes("--dry-run")) throw new Error("Choose --apply or --dry-run");
const databaseIndex = args.indexOf("--database");
const databasePath = path.resolve(databaseIndex < 0 ? path.join(root, "prisma", "migration.db") : args[databaseIndex + 1] ?? "");
if (databaseIndex >= 0 && (!args[databaseIndex + 1] || args[databaseIndex + 1].startsWith("--"))) {
  throw new Error("--database requires a path");
}
if (apply && databasePath === path.resolve("/data/migration.db")
  && (!args.includes("--allow-production") || !args.includes("--backup-verified"))) {
  throw new Error("Production migration requires --allow-production and --backup-verified");
}
if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);

const db = new DatabaseSync(databasePath);
try {
  db.exec("PRAGMA foreign_keys = ON");
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'Character'").get()) {
    throw new Error("Character table missing");
  }
  const hasTable = () => Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'CharacterCreation'").get());
  const before = hasTable();
  if (apply && !before) {
    const sql = readFileSync(path.join(root, "prisma", "migrations", "20260925_character_creation_level_one", "migration.sql"), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  const after = hasTable();
  if (apply && !after) throw new Error("CharacterCreation table missing after migration");
  const columns = () => new Set(after ? db.prepare('PRAGMA table_info("CharacterCreation")').all().map((column) => column.name) : []);
  if (apply && after && (!columns().has("requestId") || !columns().has("requestSignature"))) {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (!columns().has("requestId")) db.exec('ALTER TABLE "CharacterCreation" ADD COLUMN "requestId" TEXT');
      if (!columns().has("requestSignature")) db.exec('ALTER TABLE "CharacterCreation" ADD COLUMN "requestSignature" TEXT');
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS "CharacterCreation_requestId_key" ON "CharacterCreation"("requestId")');
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", databasePath, before, after, requestIdReady: columns().has("requestId") && columns().has("requestSignature") }));
} finally {
  db.close();
}
