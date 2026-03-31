CREATE TABLE IF NOT EXISTS "Spell" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "Spell_slug_key" ON "Spell"("slug");
CREATE INDEX IF NOT EXISTS "Spell_name_idx" ON "Spell"("name");
CREATE INDEX IF NOT EXISTS "Spell_level_idx" ON "Spell"("level");
CREATE INDEX IF NOT EXISTS "Spell_school_idx" ON "Spell"("school");
CREATE INDEX IF NOT EXISTS "Spell_sourceType_idx" ON "Spell"("sourceType");
