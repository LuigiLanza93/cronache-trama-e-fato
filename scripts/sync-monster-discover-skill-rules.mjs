import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMonsterDiscoverSkillRuleRows } from "../shared/monster-discover-skill-rules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const db = new DatabaseSync(path.resolve(repoRoot, "prisma", "migration.db"));

db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS "MonsterDiscoverSkillRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatureType" TEXT NOT NULL,
    "subtype" TEXT NOT NULL DEFAULT '',
    "skillId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonsterDiscoverSkillRule_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "MonsterDiscoverSkillRule_creatureType_subtype_key"
  ON "MonsterDiscoverSkillRule"("creatureType", "subtype");
  CREATE INDEX IF NOT EXISTS "MonsterDiscoverSkillRule_skillId_idx"
  ON "MonsterDiscoverSkillRule"("skillId");
`);

const knownSkillIds = new Set(
  db.prepare('SELECT id FROM "Skill"').all().map((row) => row.id)
);

const rows = buildMonsterDiscoverSkillRuleRows();
for (const row of rows) {
  if (!knownSkillIds.has(row.skillId)) {
    throw new Error(`Skill non trovata per rule ${row.id}: ${row.skillId}`);
  }
}

const upsert = db.prepare(`
  INSERT INTO "MonsterDiscoverSkillRule" ("id", "creatureType", "subtype", "skillId", "createdAt", "updatedAt")
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT("id") DO UPDATE SET
    "creatureType" = excluded."creatureType",
    "subtype" = excluded."subtype",
    "skillId" = excluded."skillId",
    "updatedAt" = excluded."updatedAt"
`);

db.exec("BEGIN");
try {
  for (const row of rows) {
    upsert.run(row.id, row.creatureType, row.subtype, row.skillId, row.createdAt, row.updatedAt);
  }
  db.exec("COMMIT");
  console.log(`monster-discover-skill-rules-synced:${rows.length}`);
} catch (error) {
  try {
    db.exec("ROLLBACK");
  } catch {
    // no-op
  }
  throw error;
}
