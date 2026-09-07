-- M3 character progression foundation.
-- The application script wraps these additive statements and the catalog/backfill
-- in one transaction. IF NOT EXISTS keeps restart after an interrupted apply safe.

CREATE TABLE IF NOT EXISTS "ClassRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "classKey" TEXT NOT NULL,
  "labelIt" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "aliases" TEXT NOT NULL,
  "rulesetId" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "hitDie" INTEGER,
  "casterKind" TEXT,
  "spellcastingAbility" TEXT,
  "spellcastingStartLevel" INTEGER,
  "subclassSelectionLevel" INTEGER,
  "isCustom" BOOLEAN NOT NULL DEFAULT false,
  "isManual" BOOLEAN NOT NULL DEFAULT false,
  "ruleSnapshot" TEXT NOT NULL,
  "catalogHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClassRule_hitDie_check" CHECK ("hitDie" IS NULL OR "hitDie" IN (6, 8, 10, 12)),
  CONSTRAINT "ClassRule_casterKind_check" CHECK ("casterKind" IS NULL OR "casterKind" IN ('NONE', 'FULL', 'HALF', 'THIRD', 'PACT')),
  CONSTRAINT "ClassRule_spellcastingStartLevel_check" CHECK ("spellcastingStartLevel" IS NULL OR "spellcastingStartLevel" BETWEEN 1 AND 20),
  CONSTRAINT "ClassRule_subclassSelectionLevel_check" CHECK ("subclassSelectionLevel" IS NULL OR "subclassSelectionLevel" BETWEEN 1 AND 20),
  CONSTRAINT "ClassRule_boolean_check" CHECK ("isCustom" IN (0, 1) AND "isManual" IN (0, 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassRule_rulesetId_rulesetVersion_classKey_key"
  ON "ClassRule"("rulesetId", "rulesetVersion", "classKey");
CREATE INDEX IF NOT EXISTS "ClassRule_classKey_idx" ON "ClassRule"("classKey");

CREATE TABLE IF NOT EXISTS "SubclassRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "subclassKey" TEXT NOT NULL,
  "classRuleId" TEXT NOT NULL,
  "labelIt" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "aliases" TEXT NOT NULL,
  "rulesetId" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "casterKind" TEXT,
  "spellcastingAbility" TEXT,
  "spellcastingStartLevel" INTEGER,
  "isCustom" BOOLEAN NOT NULL DEFAULT false,
  "isManual" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" DATETIME,
  "ruleSnapshot" TEXT NOT NULL,
  "catalogHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SubclassRule_casterKind_check" CHECK ("casterKind" IS NULL OR "casterKind" IN ('NONE', 'FULL', 'HALF', 'THIRD', 'PACT')),
  CONSTRAINT "SubclassRule_spellcastingStartLevel_check" CHECK ("spellcastingStartLevel" IS NULL OR "spellcastingStartLevel" BETWEEN 1 AND 20),
  CONSTRAINT "SubclassRule_boolean_check" CHECK ("isCustom" IN (0, 1) AND "isManual" IN (0, 1)),
  FOREIGN KEY ("classRuleId") REFERENCES "ClassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubclassRule_rulesetId_rulesetVersion_subclassKey_key"
  ON "SubclassRule"("rulesetId", "rulesetVersion", "subclassKey");
CREATE INDEX IF NOT EXISTS "SubclassRule_subclassKey_idx" ON "SubclassRule"("subclassKey");
CREATE INDEX IF NOT EXISTS "SubclassRule_classRuleId_idx" ON "SubclassRule"("classRuleId");

CREATE TABLE IF NOT EXISTS "CharacterProgression" (
  "characterId" TEXT NOT NULL PRIMARY KEY,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "backfillStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "backfillIssues" TEXT NOT NULL DEFAULT '[]',
  "legacySnapshot" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CharacterProgression_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "CharacterProgression_backfillStatus_check" CHECK ("backfillStatus" IN ('PENDING', 'BACKFILLED', 'BACKFILLED_WITH_DIVERGENCE', 'UNRESOLVED')),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CharacterProgression_backfillStatus_idx"
  ON "CharacterProgression"("backfillStatus");

CREATE TABLE IF NOT EXISTS "CharacterClass" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "classRuleId" TEXT NOT NULL,
  "subclassRuleId" TEXT,
  "classKey" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "isPrimary" BOOLEAN NOT NULL,
  "subclassStatus" TEXT NOT NULL DEFAULT 'UNSELECTED',
  "source" TEXT NOT NULL DEFAULT 'LEGACY_BACKFILL',
  "ruleSnapshot" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CharacterClass_level_check" CHECK ("level" BETWEEN 1 AND 20),
  CONSTRAINT "CharacterClass_sortOrder_check" CHECK ("sortOrder" >= 0),
  CONSTRAINT "CharacterClass_isPrimary_check" CHECK ("isPrimary" IN (0, 1)),
  CONSTRAINT "CharacterClass_subclassStatus_check" CHECK ("subclassStatus" IN ('UNSELECTED', 'NOT_YET_ELIGIBLE', 'INCOMPLETE_LEGACY', 'SELECTED', 'MANUAL')),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("classRuleId") REFERENCES "ClassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("subclassRuleId") REFERENCES "SubclassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterClass_characterId_classKey_key"
  ON "CharacterClass"("characterId", "classKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterClass_characterId_sortOrder_key"
  ON "CharacterClass"("characterId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterClass_one_primary_key"
  ON "CharacterClass"("characterId") WHERE "isPrimary" = true;
-- Temporary M3 domain guard. A later multiclass migration can drop this one index
-- without rebuilding the plural CharacterClass table.
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterClass_m3_single_class_key"
  ON "CharacterClass"("characterId");
CREATE INDEX IF NOT EXISTS "CharacterClass_classRuleId_idx" ON "CharacterClass"("classRuleId");
CREATE INDEX IF NOT EXISTS "CharacterClass_subclassRuleId_idx" ON "CharacterClass"("subclassRuleId");
CREATE INDEX IF NOT EXISTS "CharacterClass_updatedByUserId_idx" ON "CharacterClass"("updatedByUserId");

CREATE TRIGGER IF NOT EXISTS "CharacterClass_class_key_matches_rule_insert"
BEFORE INSERT ON "CharacterClass"
WHEN NOT EXISTS (
  SELECT 1 FROM "ClassRule"
  WHERE "id" = NEW."classRuleId" AND "classKey" = NEW."classKey"
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass classKey does not match class rule');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterClass_class_key_matches_rule_update"
BEFORE UPDATE OF "classRuleId", "classKey" ON "CharacterClass"
WHEN NOT EXISTS (
  SELECT 1 FROM "ClassRule"
  WHERE "id" = NEW."classRuleId" AND "classKey" = NEW."classKey"
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass classKey does not match class rule');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterClass_subclass_matches_class_insert"
BEFORE INSERT ON "CharacterClass"
WHEN NEW."subclassRuleId" IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM "SubclassRule"
   WHERE "id" = NEW."subclassRuleId" AND "classRuleId" = NEW."classRuleId"
 )
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass subclass does not belong to class rule');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterClass_subclass_matches_class_update"
BEFORE UPDATE OF "subclassRuleId", "classRuleId" ON "CharacterClass"
WHEN NEW."subclassRuleId" IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM "SubclassRule"
   WHERE "id" = NEW."subclassRuleId" AND "classRuleId" = NEW."classRuleId"
 )
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass subclass does not belong to class rule');
END;
