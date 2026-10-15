-- M6 resource pools. Maximum capacity and consumed state are distinct, and
-- pool reset behaviour is data-driven instead of inferred from class labels.

CREATE TABLE IF NOT EXISTS "CharacterResourcePool" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "poolKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "resetPolicy" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "backfillStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "backfillIssues" TEXT NOT NULL DEFAULT '[]',
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "ruleSnapshot" TEXT NOT NULL DEFAULT '{}',
  "legacySnapshot" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CharacterResourcePool_key_check" CHECK (length(trim("poolKey")) > 0),
  CONSTRAINT "CharacterResourcePool_kind_check" CHECK (
    "kind" IN ('SPELLCASTING', 'PACT_MAGIC', 'CLASS_RESOURCE', 'MANUAL')
  ),
  CONSTRAINT "CharacterResourcePool_reset_check" CHECK (
    "resetPolicy" IN ('SHORT_REST', 'LONG_REST', 'MANUAL', 'NONE')
  ),
  CONSTRAINT "CharacterResourcePool_status_check" CHECK (
    "backfillStatus" IN ('PENDING', 'BACKFILLED', 'LEGACY_MANUAL', 'UNRESOLVED')
  ),
  CONSTRAINT "CharacterResourcePool_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "CharacterResourcePool_json_check" CHECK (
    json_valid("backfillIssues") AND json_type("backfillIssues") = 'array'
    AND json_valid("metadata") AND json_valid("ruleSnapshot") AND json_valid("legacySnapshot")
  ),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterResourcePool_characterId_poolKey_key"
  ON "CharacterResourcePool"("characterId", "poolKey");
CREATE INDEX IF NOT EXISTS "CharacterResourcePool_characterId_idx"
  ON "CharacterResourcePool"("characterId");
CREATE INDEX IF NOT EXISTS "CharacterResourcePool_kind_idx"
  ON "CharacterResourcePool"("kind");
CREATE INDEX IF NOT EXISTS "CharacterResourcePool_backfillStatus_idx"
  ON "CharacterResourcePool"("backfillStatus");

CREATE TABLE IF NOT EXISTS "CharacterResourcePoolSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "poolId" TEXT NOT NULL,
  "characterClassId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "ruleSnapshot" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CharacterResourcePoolSource_key_check" CHECK (length(trim("sourceKey")) > 0),
  CONSTRAINT "CharacterResourcePoolSource_kind_check" CHECK (
    "sourceKind" IN ('CLASS', 'SUBCLASS', 'LEGACY', 'MANUAL')
  ),
  CONSTRAINT "CharacterResourcePoolSource_json_check" CHECK (json_valid("ruleSnapshot")),
  FOREIGN KEY ("poolId") REFERENCES "CharacterResourcePool"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("characterClassId") REFERENCES "CharacterClass"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterResourcePoolSource_poolId_sourceKey_key"
  ON "CharacterResourcePoolSource"("poolId", "sourceKey");
CREATE INDEX IF NOT EXISTS "CharacterResourcePoolSource_characterClassId_idx"
  ON "CharacterResourcePoolSource"("characterClassId");

CREATE TABLE IF NOT EXISTS "CharacterResourcePoolTier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "poolId" TEXT NOT NULL,
  "tierKey" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "derivedMaximum" INTEGER,
  "maximumOverride" INTEGER,
  "used" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CharacterResourcePoolTier_key_check" CHECK (length(trim("tierKey")) > 0),
  CONSTRAINT "CharacterResourcePoolTier_values_check" CHECK (
    "sortOrder" >= 0 AND "used" >= 0
    AND ("derivedMaximum" IS NULL OR "derivedMaximum" >= 0)
    AND ("maximumOverride" IS NULL OR "maximumOverride" >= 0)
    AND ("derivedMaximum" IS NOT NULL OR "maximumOverride" IS NOT NULL)
    AND "used" <= COALESCE("maximumOverride", "derivedMaximum")
  ),
  FOREIGN KEY ("poolId") REFERENCES "CharacterResourcePool"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterResourcePoolTier_poolId_tierKey_key"
  ON "CharacterResourcePoolTier"("poolId", "tierKey");
CREATE INDEX IF NOT EXISTS "CharacterResourcePoolTier_poolId_sortOrder_idx"
  ON "CharacterResourcePoolTier"("poolId", "sortOrder");
