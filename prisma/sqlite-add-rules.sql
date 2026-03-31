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
