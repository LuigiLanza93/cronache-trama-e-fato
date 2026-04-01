CREATE TABLE IF NOT EXISTS "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ability" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Skill_slug_key" ON "Skill"("slug");
CREATE INDEX IF NOT EXISTS "Skill_name_idx" ON "Skill"("name");
CREATE INDEX IF NOT EXISTS "Skill_ability_idx" ON "Skill"("ability");
CREATE INDEX IF NOT EXISTS "Skill_sourceType_idx" ON "Skill"("sourceType");

CREATE TABLE IF NOT EXISTS "SpellSlotProgression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSlug" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "characterLevel" INTEGER NOT NULL,
    "slots" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "SpellSlotProgression_classSlug_characterLevel_key"
ON "SpellSlotProgression"("classSlug", "characterLevel");
CREATE INDEX IF NOT EXISTS "SpellSlotProgression_classSlug_characterLevel_idx"
ON "SpellSlotProgression"("classSlug", "characterLevel");
CREATE INDEX IF NOT EXISTS "SpellSlotProgression_sourceType_idx"
ON "SpellSlotProgression"("sourceType");

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

ALTER TABLE "Monster" ADD COLUMN "rarity" TEXT;
CREATE INDEX IF NOT EXISTS "Monster_rarity_idx" ON "Monster"("rarity");
ALTER TABLE "Monster" ADD COLUMN "archivedAt" DATETIME;
CREATE INDEX IF NOT EXISTS "Monster_archivedAt_idx" ON "Monster"("archivedAt");

CREATE TABLE IF NOT EXISTS "MonsterCompendiumEntry" (
    "monsterId" TEXT NOT NULL PRIMARY KEY,
    "knowledgeState" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonsterCompendiumEntry_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MonsterCompendiumEntry_knowledgeState_idx"
ON "MonsterCompendiumEntry"("knowledgeState");
