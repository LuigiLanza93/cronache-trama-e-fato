import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_DB_PATH = path.resolve(ROOT_DIR, "prisma", "migration.db");

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

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseArguments(argv) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) {
    throw new Error("Use either --apply or --dry-run, not both");
  }

  const databaseIndex = argv.findIndex((argument) => argument === "--database");
  const databaseAssignment = argv.find((argument) => argument.startsWith("--database="));
  let databasePath = DEFAULT_DB_PATH;
  if (databaseIndex >= 0) {
    const value = argv[databaseIndex + 1];
    if (!value || value.startsWith("--")) throw new Error("--database requires a path");
    databasePath = path.resolve(value);
  } else if (databaseAssignment) {
    const value = databaseAssignment.slice("--database=".length);
    if (!value) throw new Error("--database requires a path");
    databasePath = path.resolve(value);
  }

  const productionPath = path.resolve("/data/migration.db");
  if (apply && databasePath === productionPath && !argv.includes("--allow-production")) {
    throw new Error("Applying to /data/migration.db requires --allow-production after the documented backup and authorization flow");
  }

  return { apply, databasePath };
}

const WEAPON_CATALOG = [
  ...SIMPLE_WEAPONS.map(([slug, name, isLightWeapon]) => ({ slug, name, group: "SIMPLE", isLightWeapon })),
  ...MARTIAL_WEAPONS.map(([slug, name, isLightWeapon]) => ({ slug, name, group: "MARTIAL", isLightWeapon })),
];
const CATALOG_BY_SLUG = new Map(WEAPON_CATALOG.map((entry) => [entry.slug, entry]));
const CATALOG_BY_NAME = new Map(WEAPON_CATALOG.map((entry) => [normalizeName(entry.name), entry]));

function assertRequiredColumns(db) {
  const columns = new Set(db.prepare("PRAGMA table_info('ItemDefinition')").all().map((column) => column.name));
  for (const column of ["weaponProficiencyGroup", "isLightWeapon"]) {
    if (!columns.has(column)) throw new Error(`Missing ItemDefinition.${column}; apply the schema migration first`);
  }
}

function main() {
  const { apply, databasePath } = parseArguments(process.argv.slice(2));
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  let transactionOpen = false;

  try {
    db.exec("PRAGMA busy_timeout = 30000; PRAGMA foreign_keys = ON;");
    assertRequiredColumns(db);

    const weaponRows = db.prepare(`
      SELECT id, slug, name, weaponProficiencyGroup, isLightWeapon
      FROM "ItemDefinition"
      WHERE category = 'WEAPON'
      ORDER BY name COLLATE NOCASE, slug
    `).all();

    const matchedCatalogSlugs = new Set();
    const changes = [];
    const unchanged = [];
    const unclassifiedWeaponRows = [];

    for (const row of weaponRows) {
      const slugMatch = CATALOG_BY_SLUG.get(String(row.slug ?? "").trim());
      const nameMatch = CATALOG_BY_NAME.get(normalizeName(row.name));
      if (slugMatch && nameMatch && slugMatch.slug !== nameMatch.slug) {
        throw new Error(`Conflicting SRD slug/name match for ${row.slug} (${row.name})`);
      }

      const classification = slugMatch ?? nameMatch;
      if (!classification) {
        unclassifiedWeaponRows.push({ slug: row.slug, name: row.name });
        continue;
      }

      matchedCatalogSlugs.add(classification.slug);
      const currentLight = !!row.isLightWeapon;
      const differs = row.weaponProficiencyGroup !== classification.group || currentLight !== classification.isLightWeapon;
      const reportRow = {
        slug: row.slug,
        name: row.name,
        matchedBy: slugMatch ? "slug" : "name",
        from: { group: row.weaponProficiencyGroup ?? null, isLightWeapon: currentLight },
        to: { group: classification.group, isLightWeapon: classification.isLightWeapon },
      };
      (differs ? changes : unchanged).push(reportRow);
    }

    if (apply && changes.length > 0) {
      const update = db.prepare(`
        UPDATE "ItemDefinition"
        SET weaponProficiencyGroup = ?, isLightWeapon = ?, updatedAt = ?
        WHERE id = ?
      `);
      const now = new Date().toISOString();
      db.exec("BEGIN IMMEDIATE;");
      transactionOpen = true;
      for (const change of changes) {
        const source = weaponRows.find((row) => row.slug === change.slug && row.name === change.name);
        const result = update.run(change.to.group, change.to.isLightWeapon ? 1 : 0, now, source.id);
        if (Number(result.changes) !== 1) throw new Error(`Expected one updated row for ${change.slug}`);
      }
      db.exec("COMMIT;");
      transactionOpen = false;
    }

    const unmatchedCatalog = WEAPON_CATALOG
      .filter((entry) => !matchedCatalogSlugs.has(entry.slug))
      .map(({ slug, name, group, isLightWeapon }) => ({ slug, name, group, isLightWeapon }));
    const summary = {
      mode: apply ? "apply" : "dry-run",
      databasePath,
      catalog: {
        total: WEAPON_CATALOG.length,
        simple: SIMPLE_WEAPONS.length,
        martial: MARTIAL_WEAPONS.length,
        light: WEAPON_CATALOG.filter((entry) => entry.isLightWeapon).length,
      },
      weaponRows: weaponRows.length,
      matchedRows: changes.length + unchanged.length,
      wouldChangeRows: changes.length,
      updatedRows: apply ? changes.length : 0,
      unchangedRows: unchanged.length,
      unmatchedCatalog,
      unclassifiedWeaponRows,
      changes,
    };
    console.log(JSON.stringify(summary, null, 2));

    if (unmatchedCatalog.length > 0) process.exitCode = 2;
  } catch (error) {
    if (transactionOpen) {
      try { db.exec("ROLLBACK;"); } catch { /* preserve the original failure */ }
    }
    throw error;
  } finally {
    db.close();
  }
}

main();
