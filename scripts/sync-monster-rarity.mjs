import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeMonsterRarity } from "../shared/monster-rarity-rules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const db = new DatabaseSync(path.resolve(repoRoot, "prisma", "migration.db"));

const columns = db.prepare('PRAGMA table_info("Monster")').all();
if (!columns.some((column) => column.name === "rarity")) {
  db.exec('ALTER TABLE "Monster" ADD COLUMN "rarity" TEXT;');
}
db.exec('CREATE INDEX IF NOT EXISTS "Monster_rarity_idx" ON "Monster"("rarity")');

const rows = db.prepare(`
  SELECT id, creatureType, challengeRatingDisplay, challengeRatingDecimal, challengeRatingXp
  FROM "Monster"
  ORDER BY name COLLATE NOCASE
`).all();

const updateStmt = db.prepare(`
  UPDATE "Monster"
  SET rarity = ?, updatedAt = ?
  WHERE id = ?
`);

let updated = 0;
const now = new Date().toISOString();

db.exec("BEGIN");
try {
  for (const row of rows) {
    const rarity = computeMonsterRarity({
      creatureType: row.creatureType ?? "",
      challengeRating: {
        display: row.challengeRatingDisplay ?? "",
        decimal: row.challengeRatingDecimal,
        xp: row.challengeRatingXp ?? 0,
      },
    });

    updateStmt.run(rarity || null, now, row.id);
    updated += 1;
  }
  db.exec("COMMIT");
  console.log(`monster-rarity-synced:${updated}`);
} catch (error) {
  try {
    db.exec("ROLLBACK");
  } catch {
    // no-op
  }
  throw error;
}
