import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = path.join(root, "scripts", "apply-character-progression-mc1.mjs");
const m3 = readFileSync(path.join(root, "prisma", "migrations", "20260815_character_progression_m3", "migration.sql"), "utf8");
const m4 = readFileSync(path.join(root, "prisma", "migrations", "20260921_character_progression_m4", "migration.sql"), "utf8");
const directories = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-mc1-"));
  directories.push(directory);
  const databasePath = path.join(directory, "migration.db");
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);
    CREATE TABLE "Character" ("id" TEXT NOT NULL PRIMARY KEY);
  `);
  db.exec(m3);
  db.exec(m4);
  db.close();
  return databasePath;
}

function run(databasePath, mode) {
  return spawnSync(process.execPath, [script, mode, `--database=${databasePath}`], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("MC1 multiclass schema gate", () => {
  it("keeps dry-run read-only, removes only the M3 single-class guard, and reruns safely", () => {
    const databasePath = fixture();
    const dryRun = run(databasePath, "--dry-run");
    expect(dryRun.status).toBe(0);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({
      mode: "dry-run",
      before: { singleClassIndex: true },
      after: { singleClassIndex: true },
    });

    const first = run(databasePath, "--apply");
    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({
      before: { singleClassIndex: true },
      after: { singleClassIndex: false },
    });
    const second = run(databasePath, "--apply");
    expect(second.status).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({
      before: { singleClassIndex: false },
      after: { singleClassIndex: false },
    });

    const check = new DatabaseSync(databasePath, { readOnly: true });
    expect(check.prepare("SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'CharacterClass_m3_single_class_key'").get()).toBeUndefined();
    expect(check.prepare("SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'CharacterClass_one_primary_key'").get()).toBeTruthy();
    expect(check.prepare("SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'CharacterClass_characterId_classKey_key'").get()).toBeTruthy();
    check.close();
  });
});
