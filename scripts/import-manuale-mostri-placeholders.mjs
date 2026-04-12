import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DB_FILE = path.resolve(repoRoot, "prisma", "migration.db");
const DOC_EXPORT_DIR = path.resolve(repoRoot, "Docs", "manuale-mostri-import");
const DOC_JSON_DIR = path.resolve(DOC_EXPORT_DIR, "json");
const MONSTER_SOURCE_DIR = path.resolve(repoRoot, "src", "data", "monsters", "custom", "manuale-mostri-5-0");
const SQL_OUTPUT_FILE = path.resolve(repoRoot, "prisma", "manuale-mostri-5-0-placeholders.sql");
const MANIFEST_FILE = path.resolve(DOC_EXPORT_DIR, "manifest.json");

const MANUAL_SOURCE = "Manuale_dei_Mostri_5.0.pdf";
const PLACEHOLDER_NOTE =
  "Scheda placeholder generata dal censimento del Manuale dei Mostri. Statistiche e testo descrittivo da completare con trascrizione manuale.";

const importEntries = [
  { name: "Aarakocra", category: "manual-only" },
  { name: "Artiglio Strisciante", category: "manual-only" },
  { name: "Banshee", category: "manual-only" },
  { name: "Beholder", category: "manual-only" },
  { name: "Bestia Distorcente", category: "manual-only" },
  { name: "Boleto Stridente", category: "possible-duplicate", possibleDuplicateOf: "Fungo Stridente" },
  { name: "Bullywug", category: "manual-only" },
  { name: "Cacciatore Invisibile", category: "possible-duplicate", possibleDuplicateOf: "Persecutore Invisibile" },
  { name: "Cambion", category: "manual-only" },
  { name: "Cavaliere della Morte", category: "manual-only" },
  { name: "Cavallo degli Incubi", category: "possible-duplicate", possibleDuplicateOf: "Destriero da Incubo" },
  { name: "Ciclope", category: "manual-only" },
  { name: "Cuspide Letale", category: "manual-only" },
  { name: "Demilich", category: "manual-only" },
  { name: "Deva", category: "possible-duplicate", possibleDuplicateOf: "Angelo Deva" },
  { name: "Diavolo Uncinato", category: "manual-only" },
  { name: "Divoracervelli", category: "manual-only" },
  { name: "Dracolich", category: "manual-only" },
  { name: "Drago d'Ombra", category: "manual-only" },
  { name: "Drago Fatato", category: "manual-only" },
  { name: "Empireo", category: "manual-only" },
  { name: "Fatale dell'Acqua", category: "manual-only" },
  { name: "Fauce Gorgogliante", category: "possible-duplicate", possibleDuplicateOf: "Fauci Gorgoglianti" },
  { name: "Flumph", category: "manual-only" },
  { name: "Fomorian", category: "manual-only" },
  { name: "Galeb Duhr", category: "manual-only" },
  { name: "Githyanki Cavaliere", category: "manual-only" },
  { name: "Githyanki Combattente", category: "manual-only" },
  { name: "Githzerai Monaco", category: "manual-only" },
  { name: "Githzerai Zerth", category: "manual-only" },
  { name: "Goristro", category: "manual-only" },
  { name: "Grell", category: "manual-only" },
  { name: "Kenku", category: "manual-only" },
  { name: "Magmin", category: "possible-duplicate", possibleDuplicateOf: "Uomo Magma (Magmin)" },
  { name: "Marid", category: "manual-only" },
  { name: "Marinide", category: "possible-duplicate", possibleDuplicateOf: "Uomo Acquatico" },
  { name: "Merrow", category: "manual-only" },
  { name: "Miconide Adulto", category: "manual-only" },
  { name: "Miconide Germoglio", category: "manual-only" },
  { name: "Miconide Sovrano", category: "manual-only" },
  { name: "Mind Flayer", category: "manual-only" },
  { name: "Monodrone", category: "manual-only" },
  { name: "Duodrone", category: "manual-only" },
  { name: "Tridrone", category: "manual-only" },
  { name: "Quadrone", category: "manual-only" },
  { name: "Pentadrone", category: "manual-only" },
  { name: "Mefit del Fango", category: "manual-only" },
  { name: "Mefit del Fumo", category: "manual-only" },
  { name: "Naga d'Ossa", category: "manual-only" },
  { name: "Naga Guardiana", category: "possible-duplicate", possibleDuplicateOf: "Naga Guardiano" },
  { name: "Nothic", category: "manual-only" },
  { name: "Orrore Corazzato", category: "manual-only" },
  { name: "Orrore Uncinato", category: "manual-only" },
  { name: "Peryton", category: "manual-only" },
  { name: "Pixie", category: "manual-only" },
  { name: "Planetar", category: "possible-duplicate", possibleDuplicateOf: "Angelo Planetar" },
  { name: "Quaggoth", category: "manual-only" },
  { name: "Revenant", category: "manual-only" },
  { name: "Roc", category: "manual-only" },
  { name: "Sciacallo Mannaro", category: "manual-only" },
  { name: "Slaad Blu", category: "manual-only" },
  { name: "Slaad della Morte", category: "manual-only" },
  { name: "Slaad Girino", category: "manual-only" },
  { name: "Slaad Grigio", category: "manual-only" },
  { name: "Slaad Rosso", category: "manual-only" },
  { name: "Slaad Verde", category: "manual-only" },
  { name: "Solar", category: "possible-duplicate", possibleDuplicateOf: "Angelo Solar" },
  { name: "Spaventapasseri", category: "manual-only" },
  { name: "Spettro", category: "manual-only" },
  { name: "Spora Gassosa", category: "manual-only" },
  { name: "Teschio Infuocato", category: "manual-only" },
  { name: "Thri-kreen", category: "manual-only" },
  { name: "Treant", category: "possible-duplicate", possibleDuplicateOf: "Uomo Albero (Treant)" },
  { name: "Troglodita", category: "manual-only" },
  { name: "Ultroloth", category: "manual-only" },
  { name: "Umber Hulk", category: "manual-only" },
  { name: "Vermeiena", category: "manual-only" },
  { name: "Yeti", category: "manual-only" },
  { name: "Yochlol", category: "manual-only" },
  { name: "Yuan-ti Abominio", category: "manual-only" },
  { name: "Yuan-ti Nefasto", category: "manual-only" },
  { name: "Ago Maligno", category: "manual-only" },
  { name: "Allosauro", category: "manual-only" },
  { name: "Anchilosauro", category: "manual-only" },
  { name: "Arbusto Maligno", category: "manual-only" },
  { name: "Arcanaloth", category: "manual-only" },
  { name: "Barlgura", category: "manual-only" },
  { name: "Chasme", category: "manual-only" },
  { name: "Dao", category: "manual-only" },
  { name: "Demone d'Ombra", category: "manual-only" },
  { name: "Elementale dell'Aria", category: "manual-only" },
  { name: "Elementale dell'Acqua", category: "manual-only" },
  { name: "Mane", category: "manual-only" },
  { name: "Mezzoloth", category: "manual-only" },
  { name: "Nycaloth", category: "manual-only" },
  { name: "Pteranodonte", category: "manual-only" },
  { name: "Rampicante Maligno", category: "manual-only" },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "monster";
}

function encodeMonsterId(relativePath) {
  return Buffer.from(relativePath, "utf-8").toString("base64url");
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildPlaceholderMonster(entry) {
  const slugCore = sanitizeSlug(entry.name);
  const slug = `mm5-${slugCore}`;
  const relativePath = `custom/manuale-mostri-5-0/${slug}.json`;
  const now = new Date().toISOString();

  return {
    record: {
      id: encodeMonsterId(relativePath),
      slug,
      name: entry.name,
      sourceType: "CUSTOM",
      sourceFile: relativePath,
      challengeRatingDisplay: "0",
      challengeRatingDecimal: 0,
      challengeRatingXp: 0,
      size: "Media",
      creatureType: "",
      rarity: null,
      alignment: "",
      data: JSON.stringify({
        slug,
        general: {
          name: entry.name,
          challengeRating: {
            fraction: "0",
            decimal: 0,
            display: "0",
            xp: 0,
          },
          size: "Media",
          creatureType: "",
          subtype: "",
          typeLabel: "",
          alignment: "",
          environments: [],
        },
        combat: {
          armorClass: {
            value: 10,
            note: "placeholder",
          },
          hitPoints: {
            average: 1,
            formula: "1d8",
          },
          speed: {
            walk: "9 m",
          },
        },
        abilities: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        details: {
          savingThrows: [],
          skills: [],
          damageVulnerabilities: [],
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: [],
          senses: [],
          languages: [],
          proficiencyBonus: 2,
        },
        traits: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        legendaryActions: {
          description: "",
          actions: [],
        },
        lairActions: [],
        regionalEffects: [],
        notes: [],
        source: {
          extractedFrom: MANUAL_SOURCE,
          rawText: PLACEHOLDER_NOTE,
          importCategory: entry.category,
          possibleDuplicateOf: entry.possibleDuplicateOf ?? null,
        },
      }, null, 2),
      createdAt: now,
      updatedAt: now,
    },
    filePayload: {
      slug,
      general: {
        name: entry.name,
        challengeRating: {
          fraction: "0",
          decimal: 0,
          display: "0",
          xp: 0,
        },
        size: "Media",
        creatureType: "",
        subtype: "",
        typeLabel: "",
        alignment: "",
        environments: [],
      },
      combat: {
        armorClass: {
          value: 10,
          note: "placeholder",
        },
        hitPoints: {
          average: 1,
          formula: "1d8",
        },
        speed: {
          walk: "9 m",
        },
      },
      abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      details: {
        savingThrows: [],
        skills: [],
        damageVulnerabilities: [],
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
        senses: [],
        languages: [],
        proficiencyBonus: 2,
      },
      traits: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      legendaryActions: {
        description: "",
        actions: [],
      },
      lairActions: [],
      regionalEffects: [],
      notes: [],
      source: {
        extractedFrom: MANUAL_SOURCE,
        rawText: PLACEHOLDER_NOTE,
        importCategory: entry.category,
        possibleDuplicateOf: entry.possibleDuplicateOf ?? null,
      },
    },
  };
}

function buildInsertSql(record) {
  const keys = [
    "id",
    "slug",
    "name",
    "sourceType",
    "sourceFile",
    "challengeRatingDisplay",
    "challengeRatingDecimal",
    "challengeRatingXp",
    "size",
    "creatureType",
    "rarity",
    "alignment",
    "data",
    "createdAt",
    "updatedAt",
  ];
  const columns = keys.map((key) => `"${key}"`).join(", ");
  const values = keys.map((key) => sqlValue(record[key])).join(", ");

  return [
    `INSERT INTO "Monster" (${columns}) VALUES (${values})`,
    `ON CONFLICT("id") DO UPDATE SET`,
    `  "slug" = excluded."slug",`,
    `  "name" = excluded."name",`,
    `  "sourceType" = excluded."sourceType",`,
    `  "sourceFile" = excluded."sourceFile",`,
    `  "challengeRatingDisplay" = excluded."challengeRatingDisplay",`,
    `  "challengeRatingDecimal" = excluded."challengeRatingDecimal",`,
    `  "challengeRatingXp" = excluded."challengeRatingXp",`,
    `  "size" = excluded."size",`,
    `  "creatureType" = excluded."creatureType",`,
    `  "rarity" = excluded."rarity",`,
    `  "alignment" = excluded."alignment",`,
    `  "data" = excluded."data",`,
    `  "updatedAt" = excluded."updatedAt";`,
  ].join("\n");
}

function buildCompendiumSql(monsterId, createdAt, updatedAt) {
  return [
    `INSERT INTO "MonsterCompendiumEntry" ("monsterId", "knowledgeState", "createdAt", "updatedAt")`,
    `VALUES (${sqlValue(monsterId)}, 'UNKNOWN', ${sqlValue(createdAt)}, ${sqlValue(updatedAt)})`,
    `ON CONFLICT("monsterId") DO NOTHING;`,
  ].join("\n");
}

function writeOutputs(monsters) {
  ensureDir(DOC_EXPORT_DIR);
  ensureDir(DOC_JSON_DIR);
  ensureDir(MONSTER_SOURCE_DIR);

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceManual: MANUAL_SOURCE,
    placeholderNote: PLACEHOLDER_NOTE,
    count: monsters.length,
    monsters: monsters.map(({ entry, record }) => ({
      name: entry.name,
      slug: record.slug,
      sourceFile: record.sourceFile,
      category: entry.category,
      possibleDuplicateOf: entry.possibleDuplicateOf ?? null,
    })),
  };

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf-8");

  const sqlLines = ["BEGIN TRANSACTION;"];
  for (const monster of monsters) {
    const fileName = `${monster.record.slug}.json`;
    fs.writeFileSync(path.join(DOC_JSON_DIR, fileName), JSON.stringify(monster.filePayload, null, 2), "utf-8");
    fs.writeFileSync(path.join(MONSTER_SOURCE_DIR, fileName), JSON.stringify(monster.filePayload, null, 2), "utf-8");
    sqlLines.push(buildInsertSql(monster.record));
    sqlLines.push(buildCompendiumSql(monster.record.id, monster.record.createdAt, monster.record.updatedAt));
  }
  sqlLines.push("COMMIT;");
  sqlLines.push("");

  fs.writeFileSync(SQL_OUTPUT_FILE, sqlLines.join("\n"), "utf-8");
}

function applyImport(monsters) {
  const db = new DatabaseSync(DB_FILE);
  const insertMonster = db.prepare(`
    INSERT INTO "Monster" (
      id, slug, name, sourceType, sourceFile, challengeRatingDisplay, challengeRatingDecimal,
      challengeRatingXp, size, creatureType, rarity, alignment, data, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      sourceType = excluded.sourceType,
      sourceFile = excluded.sourceFile,
      challengeRatingDisplay = excluded.challengeRatingDisplay,
      challengeRatingDecimal = excluded.challengeRatingDecimal,
      challengeRatingXp = excluded.challengeRatingXp,
      size = excluded.size,
      creatureType = excluded.creatureType,
      rarity = excluded.rarity,
      alignment = excluded.alignment,
      data = excluded.data,
      updatedAt = excluded.updatedAt
  `);
  const insertCompendium = db.prepare(`
    INSERT INTO "MonsterCompendiumEntry" (
      monsterId, knowledgeState, createdAt, updatedAt
    ) VALUES (?, 'UNKNOWN', ?, ?)
    ON CONFLICT(monsterId) DO NOTHING
  `);

  db.exec("BEGIN");
  try {
    for (const monster of monsters) {
      const row = monster.record;
      insertMonster.run(
        row.id,
        row.slug,
        row.name,
        row.sourceType,
        row.sourceFile,
        row.challengeRatingDisplay,
        row.challengeRatingDecimal,
        row.challengeRatingXp,
        row.size,
        row.creatureType,
        row.rarity,
        row.alignment,
        row.data,
        row.createdAt,
        row.updatedAt
      );
      insertCompendium.run(row.id, row.createdAt, row.updatedAt);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

function main() {
  const shouldApply = process.argv.includes("--apply");

  const seenNames = new Set();
  const monsters = importEntries.map((entry) => {
    if (seenNames.has(entry.name)) {
      throw new Error(`Nome duplicato nella lista import: ${entry.name}`);
    }
    seenNames.add(entry.name);
    const { record, filePayload } = buildPlaceholderMonster(entry);
    return { entry, record, filePayload };
  });

  writeOutputs(monsters);

  if (shouldApply) {
    applyImport(monsters);
  }

  console.log(`[manuale-mostri] Placeholder generati: ${monsters.length}`);
  console.log(`[manuale-mostri] Manifest: ${path.relative(repoRoot, MANIFEST_FILE)}`);
  console.log(`[manuale-mostri] SQL: ${path.relative(repoRoot, SQL_OUTPUT_FILE)}`);
  console.log(`[manuale-mostri] JSON sorgente: ${path.relative(repoRoot, MONSTER_SOURCE_DIR)}`);
  console.log(`[manuale-mostri] Applicato al DB: ${shouldApply ? "si" : "no"}`);
}

main();
