import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Vite 5 does not yet recognize node:sqlite as a built-in during transformation.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");
const MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  "prisma",
  "migrations",
  "20260812_item_weapon_classification",
  "migration.sql",
);
const BACKFILL_PATH = path.join(REPOSITORY_ROOT, "scripts", "backfill-srd-weapon-classification.mjs");

const SIMPLE_WEAPONS = [
  ["ascia", "Ascia", true],
  ["bastone-da-combattimento", "Bastone da combattimento", false],
  ["falcetto", "Falcetto", true],
  ["giavellotto", "Giavellotto", false],
  ["lancia", "Lancia", false],
  ["martello-leggero", "Martello leggero", true],
  ["mazza", "Mazza", false],
  ["pugnale", "Pugnale", true],
  ["randello", "Randello", true],
  ["randello-pesante", "Randello pesante", false],
  ["balestra-leggera", "Balestra leggera", false],
  ["dardo", "Dardo", false],
  ["arco-corto", "Arco corto", false],
  ["fionda", "Fionda", false],
];

const MARTIAL_WEAPONS = [
  ["alabarda", "Alabarda", false],
  ["ascia-da-battaglia", "Ascia da battaglia", false],
  ["ascia-bipenne", "Ascia bipenne", false],
  ["falcione", "Falcione", false],
  ["frusta", "Frusta", false],
  ["lancia-da-cavaliere", "Lancia da cavaliere", false],
  ["maglio", "Maglio", false],
  ["martello-da-guerra", "Martello da guerra", false],
  ["mazzafrusto", "Mazzafrusto", false],
  ["morning-star", "Morning star", false],
  ["picca", "Picca", false],
  ["piccone-da-guerra", "Piccone da guerra", false],
  ["scimitarra", "Scimitarra", true],
  ["spada-corta", "Spada corta", true],
  ["spada-lunga", "Spada lunga", false],
  ["spadone", "Spadone", false],
  ["stocco", "Stocco", false],
  ["tridente", "Tridente", false],
  ["balestra-a-mano", "Balestra a mano", true],
  ["balestra-pesante", "Balestra pesante", false],
  ["cerbottana", "Cerbottana", false],
  ["arco-lungo", "Arco lungo", false],
  ["rete", "Rete", false],
];

const CATALOG = [
  ...SIMPLE_WEAPONS.map(([slug, name, isLightWeapon]) => ({ slug, name, group: "SIMPLE", isLightWeapon })),
  ...MARTIAL_WEAPONS.map(([slug, name, isLightWeapon]) => ({ slug, name, group: "MARTIAL", isLightWeapon })),
];

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createTemporaryDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), "cronache-weapon-classification-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "test.db");
}

function createLegacySchema(databasePath) {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE "ItemDefinition" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

function applyMigration(db) {
  db.exec(readFileSync(MIGRATION_PATH, "utf8"));
}

function runBackfill(databasePath, ...arguments_) {
  const result = spawnSync(
    process.execPath,
    [BACKFILL_PATH, ...arguments_, "--database", databasePath],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  const summary = result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
  return { ...result, summary };
}

function seedClassificationFixture(db) {
  const insert = db.prepare(`
    INSERT INTO "ItemDefinition"
      (id, slug, name, category, updatedAt, weaponProficiencyGroup, isLightWeapon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const weapon of CATALOG) {
    const slug = weapon.slug === "scimitarra" ? "lama-curva-srd" : weapon.slug;
    const name = weapon.slug === "scimitarra" ? "  SCÌMITARRA!!!  " : weapon.name;
    const group = ["pugnale", "scimitarra"].includes(weapon.slug) ? null : weapon.group;
    const isLight = ["pugnale", "scimitarra"].includes(weapon.slug) ? 0 : Number(weapon.isLightWeapon);
    insert.run(`item-${weapon.slug}`, slug, name, "WEAPON", "2000-01-01T00:00:00.000Z", group, isLight);
  }

  insert.run(
    "item-homebrew",
    "lama-della-luna",
    "Lama della Luna",
    "WEAPON",
    "2001-01-01T00:00:00.000Z",
    "CUSTOM",
    1,
  );
  insert.run(
    "item-non-weapon",
    "pugnale-cerimoniale",
    "Pugnale",
    "GEAR",
    "2002-01-01T00:00:00.000Z",
    null,
    0,
  );
}

function readRows(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return db.prepare(`
      SELECT id, slug, name, category, updatedAt, weaponProficiencyGroup, isLightWeapon
      FROM "ItemDefinition"
      ORDER BY id
    `).all();
  } finally {
    db.close();
  }
}

describe("20260812 item weapon classification migration", () => {
  it("adds the nullable group and non-null false light flag without changing existing data", () => {
    const databasePath = createTemporaryDatabase();
    const db = createLegacySchema(databasePath);
    db.prepare(`
      INSERT INTO "ItemDefinition" (id, slug, name, category, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run("legacy-item", "legacy-blade", "Legacy Blade", "WEAPON", "1999-12-31T00:00:00.000Z");

    applyMigration(db);

    const columns = db.prepare(`PRAGMA table_info("ItemDefinition")`).all();
    const groupColumn = columns.find((column) => column.name === "weaponProficiencyGroup");
    const lightColumn = columns.find((column) => column.name === "isLightWeapon");
    expect(groupColumn).toMatchObject({ type: "TEXT", notnull: 0, dflt_value: null });
    expect(lightColumn).toMatchObject({ type: "BOOLEAN", notnull: 1, dflt_value: "false" });
    expect(db.prepare(`SELECT * FROM "ItemDefinition" WHERE id = ?`).get("legacy-item")).toMatchObject({
      id: "legacy-item",
      slug: "legacy-blade",
      name: "Legacy Blade",
      category: "WEAPON",
      updatedAt: "1999-12-31T00:00:00.000Z",
      weaponProficiencyGroup: null,
      isLightWeapon: 0,
    });
    db.close();
  });
});

describe("SRD weapon classification backfill", () => {
  it("keeps dry-run read-only, including matching by normalized name", () => {
    const databasePath = createTemporaryDatabase();
    const db = createLegacySchema(databasePath);
    applyMigration(db);
    seedClassificationFixture(db);
    db.close();
    const before = readRows(databasePath);

    const result = runBackfill(databasePath, "--dry-run");

    expect(result.status, result.stderr).toBe(0);
    expect(result.summary).toMatchObject({
      mode: "dry-run",
      weaponRows: CATALOG.length + 1,
      matchedRows: CATALOG.length,
      wouldChangeRows: 2,
      updatedRows: 0,
      unmatchedCatalog: [],
      unclassifiedWeaponRows: [{ slug: "lama-della-luna", name: "Lama della Luna" }],
    });
    expect(result.summary.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: "pugnale", matchedBy: "slug", to: { group: "SIMPLE", isLightWeapon: true } }),
      expect.objectContaining({ slug: "lama-curva-srd", matchedBy: "name", to: { group: "MARTIAL", isLightWeapon: true } }),
    ]));
    expect(readRows(databasePath)).toEqual(before);
  });

  it("classifies known SRD weapons, preserves custom/non-weapon rows, and is idempotent", () => {
    const databasePath = createTemporaryDatabase();
    const db = createLegacySchema(databasePath);
    applyMigration(db);
    seedClassificationFixture(db);
    db.close();

    const firstApply = runBackfill(databasePath, "--apply");
    expect(firstApply.status, firstApply.stderr).toBe(0);
    expect(firstApply.summary).toMatchObject({ mode: "apply", wouldChangeRows: 2, updatedRows: 2 });

    const rowsAfterFirstApply = readRows(databasePath);
    expect(rowsAfterFirstApply.find((row) => row.id === "item-pugnale")).toMatchObject({
      weaponProficiencyGroup: "SIMPLE",
      isLightWeapon: 1,
    });
    expect(rowsAfterFirstApply.find((row) => row.id === "item-scimitarra")).toMatchObject({
      weaponProficiencyGroup: "MARTIAL",
      isLightWeapon: 1,
    });
    expect(rowsAfterFirstApply.find((row) => row.id === "item-homebrew")).toMatchObject({
      updatedAt: "2001-01-01T00:00:00.000Z",
      weaponProficiencyGroup: "CUSTOM",
      isLightWeapon: 1,
    });
    expect(rowsAfterFirstApply.find((row) => row.id === "item-non-weapon")).toMatchObject({
      updatedAt: "2002-01-01T00:00:00.000Z",
      weaponProficiencyGroup: null,
      isLightWeapon: 0,
    });

    const secondApply = runBackfill(databasePath, "--apply");
    expect(secondApply.status, secondApply.stderr).toBe(0);
    expect(secondApply.summary).toMatchObject({ mode: "apply", wouldChangeRows: 0, updatedRows: 0 });
    expect(readRows(databasePath)).toEqual(rowsAfterFirstApply);

    const secondDryRun = runBackfill(databasePath, "--dry-run");
    expect(secondDryRun.status, secondDryRun.stderr).toBe(0);
    expect(secondDryRun.summary).toMatchObject({ mode: "dry-run", wouldChangeRows: 0, updatedRows: 0 });
    expect(readRows(databasePath)).toEqual(rowsAfterFirstApply);
  });

  it("rejects conflicting slug/name matches without writing partial classifications", () => {
    const databasePath = createTemporaryDatabase();
    const db = createLegacySchema(databasePath);
    applyMigration(db);
    db.prepare(`
      INSERT INTO "ItemDefinition"
        (id, slug, name, category, updatedAt, weaponProficiencyGroup, isLightWeapon)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("conflict", "pugnale", "Spada lunga", "WEAPON", "2003-01-01T00:00:00.000Z", "CUSTOM", 0);
    db.close();
    const before = readRows(databasePath);

    const result = runBackfill(databasePath, "--apply");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Conflicting SRD slug/name match");
    expect(readRows(databasePath)).toEqual(before);
  });

  it("requires the explicit production override before opening /data/migration.db", () => {
    const result = spawnSync(
      process.execPath,
      [BACKFILL_PATH, "--apply", "--database", "/data/migration.db"],
      { cwd: REPOSITORY_ROOT, encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Applying to /data/migration.db requires --allow-production");
  });
});
