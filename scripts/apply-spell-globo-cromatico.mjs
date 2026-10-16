import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const GLOBO_CROMATICO = Object.freeze({
  id: "globo-cromatico",
  slug: "globo-cromatico",
  name: "Globo Cromatico",
  level: 1,
  school: "Invocazione",
  castingTime: "1 azione",
  range: "27 metri",
  duration: "Istantanea",
  concentration: 0,
  ritual: 0,
  sourceType: "CUSTOM",
  sourceUrl: null,
  classes: JSON.stringify(["mago", "stregone"]),
  data: JSON.stringify({
    name: "Globo Cromatico",
    level: 1,
    school: "Invocazione",
    casting_time: "1 azione",
    range: "27 metri",
    components: "V, S, M (un diamante del valore di almeno 50 mo)",
    duration: "Istantanea",
    concentration: false,
    saving_throw: null,
    attack_roll: true,
    damage: "3d8",
    scaling: "Quando l'incantatore lancia questo incantesimo usando uno slot incantesimo di 2° livello o superiore, i danni aumentano di 1d8 per ogni livello dello slot sopra il 1°.",
    ritual: false,
    description: "L'incantatore scaglia una sfera del diametro di 10 cm contro una creatura entro gittata e che egli sia in grado di vedere. Può scegliere che tipo di globo creare tra acido, freddo, fulmine, fuoco, tuono o veleno e poi effettuare un attacco a distanza con questo incantesimo contro il bersaglio. Se l'attacco colpisce, la creatura subisce 3d8 danni del tipo scelto dall'incantatore.",
    usage: null,
    rest: null,
    _source: "Manuale 5e",
    classes: ["mago", "stregone"],
  }),
});

function parseArguments(argv) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) {
    throw new Error("Use either --apply or --dry-run, not both");
  }

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

  return { apply, databasePath };
}

function comparable(row) {
  if (!row) return null;
  return Object.fromEntries(Object.keys(GLOBO_CROMATICO).map((key) => [key, row[key]]));
}

export function inspectGloboCromatico(database) {
  const table = database.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'Spell'",
  ).get();
  if (!table) throw new Error('Required table "Spell" is missing');

  const row = database.prepare('SELECT * FROM "Spell" WHERE id = ? OR slug = ?')
    .get(GLOBO_CROMATICO.id, GLOBO_CROMATICO.slug);
  const exact = row != null
    && JSON.stringify(comparable(row)) === JSON.stringify(GLOBO_CROMATICO);
  return { present: row != null, exact, current: comparable(row) };
}

export function applyGloboCromatico(database, now = new Date().toISOString()) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const before = inspectGloboCromatico(database);
    if (before.exact) {
      database.exec("COMMIT");
      return { action: "unchanged", before, after: before };
    }
    if (before.present) {
      throw new Error("Globo Cromatico already exists with different data; refusing to overwrite it");
    }

    database.prepare(`
      INSERT INTO "Spell" (
        id, slug, name, level, school, castingTime, range, duration,
        concentration, ritual, sourceType, sourceUrl, classes, data, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      GLOBO_CROMATICO.id,
      GLOBO_CROMATICO.slug,
      GLOBO_CROMATICO.name,
      GLOBO_CROMATICO.level,
      GLOBO_CROMATICO.school,
      GLOBO_CROMATICO.castingTime,
      GLOBO_CROMATICO.range,
      GLOBO_CROMATICO.duration,
      GLOBO_CROMATICO.concentration,
      GLOBO_CROMATICO.ritual,
      GLOBO_CROMATICO.sourceType,
      GLOBO_CROMATICO.sourceUrl,
      GLOBO_CROMATICO.classes,
      GLOBO_CROMATICO.data,
      now,
      now,
    );
    const after = inspectGloboCromatico(database);
    if (!after.exact) throw new Error("Globo Cromatico verification failed after apply");
    database.exec("COMMIT");
    return { action: "inserted", before, after };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function assertIntegrity(database) {
  const results = database.prepare("PRAGMA integrity_check").all()
    .map((row) => String(Object.values(row)[0]));
  if (results.length !== 1 || results[0].toLowerCase() !== "ok") {
    throw new Error(`SQLite integrity check failed: ${results.join("; ")}`);
  }
  return results;
}

function run() {
  const { apply, databasePath } = parseArguments(process.argv.slice(2));
  const database = new DatabaseSync(databasePath, { readOnly: !apply });
  try {
    assertIntegrity(database);
    const before = inspectGloboCromatico(database);
    if (before.present && !before.exact) {
      throw new Error("Globo Cromatico already exists with different data; refusing to overwrite it");
    }
    const result = apply
      ? applyGloboCromatico(database)
      : { action: before.exact ? "unchanged" : "would-insert", before };
    const integrity = assertIntegrity(database);
    console.log(JSON.stringify({ databasePath, mode: apply ? "apply" : "dry-run", ...result, integrity }, null, 2));
  } finally {
    database.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
