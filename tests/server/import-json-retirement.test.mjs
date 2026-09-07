import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "import-json-to-sqlite.mjs");
const GENERATED_SQL = path.join(ROOT, "prisma", "import-json.sql");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function createDatabase(sql) {
  const directory = mkdtempSync(path.join(tmpdir(), "cronache-legacy-import-"));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, "migration.db");
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
  return databasePath;
}

function runImporter(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

describe("retired destructive JSON importer", () => {
  it("refuses by default before regenerating prisma/import-json.sql", () => {
    const before = readFileSync(GENERATED_SQL, "utf8");
    const databasePath = createDatabase('CREATE TABLE "Character" ("id" TEXT PRIMARY KEY)');
    const result = runImporter(["--dry-run", "--database", databasePath]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/richiede il flag esplicito/i);
    expect(readFileSync(GENERATED_SQL, "utf8")).toBe(before);
  });

  it("refuses a database containing any M3 table even with the explicit flag", () => {
    const before = readFileSync(GENERATED_SQL, "utf8");
    const databasePath = createDatabase(`
      CREATE TABLE "Character" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "CharacterProgression" ("characterId" TEXT PRIMARY KEY);
    `);
    const result = runImporter([
      "--dry-run",
      "--allow-destructive-legacy-import",
      "--database",
      databasePath,
    ]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/contiene strutture M3.*CharacterProgression/i);
    expect(readFileSync(GENERATED_SQL, "utf8")).toBe(before);
  });

  it("always refuses the canonical production database path", () => {
    const before = readFileSync(GENERATED_SQL, "utf8");
    const result = runImporter([
      "--dry-run",
      "--allow-destructive-legacy-import",
      "--database",
      "/data/migration.db",
    ]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/rifiutato.*database canonico di produzione/i);
    expect(readFileSync(GENERATED_SQL, "utf8")).toBe(before);
  });
});
