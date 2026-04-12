import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const MONSTER_DIR = path.resolve(repoRoot, "src", "data", "monsters", "custom", "manuale-mostri-5-0");
const DB_FILE = path.resolve(repoRoot, "prisma", "migration.db");

function main() {
  const db = new DatabaseSync(DB_FILE);
  const files = fs.readdirSync(MONSTER_DIR).filter((file) => file.endsWith(".json")).sort();
  const upsert = db.prepare(`
    UPDATE "Monster"
    SET slug = ?, name = ?, challengeRatingDisplay = ?, challengeRatingDecimal = ?, challengeRatingXp = ?,
        size = ?, creatureType = ?, alignment = ?, data = ?, updatedAt = ?
    WHERE sourceFile = ?
  `);

  let synced = 0;
  db.exec("BEGIN");
  try {
    for (const file of files) {
      const fullPath = path.join(MONSTER_DIR, file);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      const relativePath = `custom/manuale-mostri-5-0/${file}`;
      const cr = data.general?.challengeRating ?? {};
      const now = new Date().toISOString();
      const result = upsert.run(
        data.slug,
        data.general?.name ?? path.basename(file, ".json"),
        cr.display ?? null,
        typeof cr.decimal === "number" ? cr.decimal : null,
        typeof cr.xp === "number" ? cr.xp : null,
        data.general?.size ?? null,
        data.general?.creatureType || data.general?.typeLabel || null,
        data.general?.alignment ?? null,
        JSON.stringify(data),
        now,
        relativePath
      );
      synced += Number(result?.changes ?? 0);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  console.log(JSON.stringify({ files: files.length, synced }, null, 2));
}

main();
