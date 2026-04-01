-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "characterType" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "createdByUserId" TEXT,
    "className" TEXT,
    "race" TEXT,
    "alignment" TEXT,
    "background" TEXT,
    "level" INTEGER,
    "portraitUrl" TEXT,
    "archivedAt" DATETIME,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Character_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceFile" TEXT,
    "challengeRatingDisplay" TEXT,
    "challengeRatingDecimal" REAL,
    "challengeRatingXp" INTEGER,
    "size" TEXT,
    "creatureType" TEXT,
    "rarity" TEXT,
    "alignment" TEXT,
    "archivedAt" DATETIME,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Spell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "school" TEXT,
    "castingTime" TEXT,
    "range" TEXT,
    "duration" TEXT,
    "concentration" BOOLEAN NOT NULL DEFAULT false,
    "ritual" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "classes" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ability" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpellSlotProgression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classSlug" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "characterLevel" INTEGER NOT NULL,
    "slots" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonsterDiscoverSkillRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatureType" TEXT NOT NULL,
    "subtype" TEXT NOT NULL DEFAULT '',
    "skillId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonsterDiscoverSkillRule_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonsterDiscoveryDcByCrRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minCr" REAL NOT NULL,
    "maxCr" REAL,
    "dc" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonsterDiscoveryDcByRarityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rarity" TEXT NOT NULL,
    "dc" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterScenario_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterScenarioEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "monsterId" TEXT,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "armorClass" INTEGER,
    "hitPoints" INTEGER,
    "powerTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterScenarioEntry_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "EncounterScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EncounterScenarioEntry_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Character_slug_key" ON "Character"("slug");

-- CreateIndex
CREATE INDEX "Character_characterType_idx" ON "Character"("characterType");

-- CreateIndex
CREATE INDEX "Character_ownerUserId_idx" ON "Character"("ownerUserId");

-- CreateIndex
CREATE INDEX "Character_createdByUserId_idx" ON "Character"("createdByUserId");

-- CreateIndex
CREATE INDEX "Character_archivedAt_idx" ON "Character"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Monster_slug_key" ON "Monster"("slug");

-- CreateIndex
CREATE INDEX "Monster_sourceType_idx" ON "Monster"("sourceType");

-- CreateIndex
CREATE INDEX "Monster_name_idx" ON "Monster"("name");

-- CreateIndex
CREATE INDEX "Monster_challengeRatingDecimal_idx" ON "Monster"("challengeRatingDecimal");

-- CreateIndex
CREATE INDEX "Monster_rarity_idx" ON "Monster"("rarity");

-- CreateIndex
CREATE INDEX "Monster_archivedAt_idx" ON "Monster"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Spell_slug_key" ON "Spell"("slug");

-- CreateIndex
CREATE INDEX "Spell_name_idx" ON "Spell"("name");

-- CreateIndex
CREATE INDEX "Spell_level_idx" ON "Spell"("level");

-- CreateIndex
CREATE INDEX "Spell_school_idx" ON "Spell"("school");

-- CreateIndex
CREATE INDEX "Spell_sourceType_idx" ON "Spell"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE INDEX "Skill_name_idx" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "Skill_ability_idx" ON "Skill"("ability");

-- CreateIndex
CREATE INDEX "Skill_sourceType_idx" ON "Skill"("sourceType");

-- CreateIndex
CREATE INDEX "SpellSlotProgression_classSlug_characterLevel_idx" ON "SpellSlotProgression"("classSlug", "characterLevel");

-- CreateIndex
CREATE INDEX "SpellSlotProgression_sourceType_idx" ON "SpellSlotProgression"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "SpellSlotProgression_classSlug_characterLevel_key" ON "SpellSlotProgression"("classSlug", "characterLevel");

-- CreateIndex
CREATE UNIQUE INDEX "MonsterDiscoverSkillRule_creatureType_subtype_key" ON "MonsterDiscoverSkillRule"("creatureType", "subtype");

-- CreateIndex
CREATE INDEX "MonsterDiscoverSkillRule_skillId_idx" ON "MonsterDiscoverSkillRule"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "MonsterDiscoveryDcByCrRule_minCr_maxCr_key" ON "MonsterDiscoveryDcByCrRule"("minCr", "maxCr");

-- CreateIndex
CREATE UNIQUE INDEX "MonsterDiscoveryDcByRarityRule_rarity_key" ON "MonsterDiscoveryDcByRarityRule"("rarity");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "ChatMessage_characterId_createdAt_idx" ON "ChatMessage"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderUserId_idx" ON "ChatMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "EncounterScenario_name_idx" ON "EncounterScenario"("name");

-- CreateIndex
CREATE INDEX "EncounterScenario_createdByUserId_idx" ON "EncounterScenario"("createdByUserId");

-- CreateIndex
CREATE INDEX "EncounterScenarioEntry_scenarioId_sortOrder_idx" ON "EncounterScenarioEntry"("scenarioId", "sortOrder");

-- CreateIndex
CREATE INDEX "EncounterScenarioEntry_monsterId_idx" ON "EncounterScenarioEntry"("monsterId");

-- CreateIndex
CREATE INDEX "EncounterScenarioEntry_entryType_idx" ON "EncounterScenarioEntry"("entryType");

