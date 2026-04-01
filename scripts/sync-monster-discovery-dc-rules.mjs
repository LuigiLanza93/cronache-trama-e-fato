import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMonsterDiscoveryDcByCrRuleRows,
  buildMonsterDiscoveryDcByRarityRuleRows,
} from "../shared/monster-discovery-dc-rules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const db = new DatabaseSync(path.resolve(repoRoot, "prisma", "migration.db"));

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS "MonsterDiscoveryDcByCrRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minCr" REAL NOT NULL,
    "maxCr" REAL,
    "dc" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "MonsterDiscoveryDcByCrRule_minCr_maxCr_key"
  ON "MonsterDiscoveryDcByCrRule"("minCr", "maxCr");

  CREATE TABLE IF NOT EXISTS "MonsterDiscoveryDcByRarityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rarity" TEXT NOT NULL,
    "dc" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "MonsterDiscoveryDcByRarityRule_rarity_key"
  ON "MonsterDiscoveryDcByRarityRule"("rarity");
`);

const byCrRows = buildMonsterDiscoveryDcByCrRuleRows();
const byRarityRows = buildMonsterDiscoveryDcByRarityRuleRows();

const upsertByCr = db.prepare(`
  INSERT INTO "MonsterDiscoveryDcByCrRule" ("id", "minCr", "maxCr", "dc", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT("id") DO UPDATE SET
    "minCr" = excluded."minCr",
    "maxCr" = excluded."maxCr",
    "dc" = excluded."dc",
    "updatedAt" = excluded."updatedAt"
`);

const upsertByRarity = db.prepare(`
  INSERT INTO "MonsterDiscoveryDcByRarityRule" ("id", "rarity", "dc", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT("id") DO UPDATE SET
    "rarity" = excluded."rarity",
    "dc" = excluded."dc",
    "updatedAt" = excluded."updatedAt"
`);

db.exec("BEGIN");
try {
  for (const row of byCrRows) {
    upsertByCr.run(row.id, row.minCr, row.maxCr, row.dc, row.createdAt, row.updatedAt);
  }
  for (const row of byRarityRows) {
    upsertByRarity.run(row.id, row.rarity, row.dc, row.createdAt, row.updatedAt);
  }
  db.exec("COMMIT");
  console.log(`monster-discovery-dc-rules-synced:${byCrRows.length + byRarityRows.length}`);
} catch (error) {
  try {
    db.exec("ROLLBACK");
  } catch {
    // no-op
  }
  throw error;
}
