-- M4 authoritative character progression history.
-- The application script applies this additive migration in one transaction.
-- IF NOT EXISTS makes a retry safe; the script separately verifies every
-- required column, index, trigger, and pre-existing M3 dependency.

CREATE TABLE IF NOT EXISTS "CharacterLevelHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestSignature" TEXT NOT NULL,
  "operationType" TEXT NOT NULL DEFAULT 'LEVEL_UP',
  "mode" TEXT NOT NULL,
  "targetClassKey" TEXT NOT NULL,
  "targetClassRuleId" TEXT NOT NULL,
  "targetSubclassKey" TEXT,
  "targetSubclassRuleId" TEXT,
  "classLevelBefore" INTEGER,
  "classLevelAfter" INTEGER NOT NULL,
  "totalLevelBefore" INTEGER NOT NULL,
  "totalLevelAfter" INTEGER NOT NULL,
  "progressionRevisionBefore" INTEGER NOT NULL,
  "progressionRevisionAfter" INTEGER NOT NULL,
  "characterRevisionBefore" TEXT NOT NULL,
  "characterRevisionAfter" TEXT NOT NULL,
  "rulesetId" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "requestSnapshot" TEXT NOT NULL,
  "beforeSnapshot" TEXT NOT NULL,
  "afterSnapshot" TEXT NOT NULL,
  "ruleSnapshot" TEXT NOT NULL,
  "resultSnapshot" TEXT NOT NULL,
  "overrideReason" TEXT,
  "appliedByUserId" TEXT,
  "appliedBySnapshot" TEXT NOT NULL,
  "hitDieSize" INTEGER,
  "hitPointMethod" TEXT,
  "hitPointsGained" INTEGER,
  "constitutionModifier" INTEGER,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterLevelHistory_requestId_check" CHECK (length(trim("requestId")) > 0),
  CONSTRAINT "CharacterLevelHistory_requestSignature_check" CHECK (
    length("requestSignature") = 64 AND "requestSignature" NOT GLOB '*[^0-9a-f]*'
  ),
  CONSTRAINT "CharacterLevelHistory_operationType_check" CHECK ("operationType" = 'LEVEL_UP'),
  CONSTRAINT "CharacterLevelHistory_mode_check" CHECK ("mode" IN ('INCREMENT_EXISTING', 'ADD_NEW_CLASS')),
  CONSTRAINT "CharacterLevelHistory_targetSubclass_check" CHECK (
    "targetSubclassRuleId" IS NULL OR "targetSubclassKey" IS NOT NULL
  ),
  CONSTRAINT "CharacterLevelHistory_classLevels_check" CHECK (
    (
      "mode" = 'INCREMENT_EXISTING'
      AND "classLevelBefore" BETWEEN 1 AND 19
      AND "classLevelAfter" = "classLevelBefore" + 1
    )
    OR
    (
      "mode" = 'ADD_NEW_CLASS'
      AND "classLevelBefore" IS NULL
      AND "classLevelAfter" = 1
    )
  ),
  CONSTRAINT "CharacterLevelHistory_totalLevels_check" CHECK (
    "totalLevelBefore" BETWEEN 1 AND 19
    AND "totalLevelAfter" = "totalLevelBefore" + 1
    AND "totalLevelAfter" <= 20
  ),
  CONSTRAINT "CharacterLevelHistory_progressionRevisions_check" CHECK (
    "progressionRevisionBefore" >= 0
    AND "progressionRevisionAfter" = "progressionRevisionBefore" + 1
  ),
  CONSTRAINT "CharacterLevelHistory_characterRevisions_check" CHECK (
    length(trim("characterRevisionBefore")) > 0
    AND length(trim("characterRevisionAfter")) > 0
    AND "characterRevisionBefore" <> "characterRevisionAfter"
  ),
  CONSTRAINT "CharacterLevelHistory_ruleset_check" CHECK (
    length(trim("rulesetId")) > 0
    AND length(trim("rulesetVersion")) > 0
    AND length(trim("policyVersion")) > 0
  ),
  CONSTRAINT "CharacterLevelHistory_snapshots_check" CHECK (
    json_valid("requestSnapshot")
    AND json_valid("beforeSnapshot")
    AND json_valid("afterSnapshot")
    AND json_valid("ruleSnapshot")
    AND json_valid("resultSnapshot")
    AND json_valid("appliedBySnapshot")
  ),
  CONSTRAINT "CharacterLevelHistory_hitDieSize_check" CHECK (
    "hitDieSize" IS NULL OR "hitDieSize" IN (6, 8, 10, 12)
  ),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("targetClassRuleId") REFERENCES "ClassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("targetSubclassRuleId") REFERENCES "SubclassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CharacterLevelHistory_characterId_requestId_key"
  ON "CharacterLevelHistory"("characterId", "requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterLevelHistory_characterId_progressionRevisionAfter_key"
  ON "CharacterLevelHistory"("characterId", "progressionRevisionAfter");
CREATE INDEX IF NOT EXISTS "CharacterLevelHistory_characterId_appliedAt_idx"
  ON "CharacterLevelHistory"("characterId", "appliedAt");
CREATE INDEX IF NOT EXISTS "CharacterLevelHistory_targetClassRuleId_idx"
  ON "CharacterLevelHistory"("targetClassRuleId");
CREATE INDEX IF NOT EXISTS "CharacterLevelHistory_targetSubclassRuleId_idx"
  ON "CharacterLevelHistory"("targetSubclassRuleId");
CREATE INDEX IF NOT EXISTS "CharacterLevelHistory_appliedByUserId_idx"
  ON "CharacterLevelHistory"("appliedByUserId");

CREATE TRIGGER IF NOT EXISTS "CharacterLevelHistory_class_key_matches_rule_insert"
BEFORE INSERT ON "CharacterLevelHistory"
WHEN NOT EXISTS (
  SELECT 1 FROM "ClassRule"
  WHERE "id" = NEW."targetClassRuleId" AND "classKey" = NEW."targetClassKey"
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterLevelHistory targetClassKey does not match class rule');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterLevelHistory_class_key_matches_rule_update"
BEFORE UPDATE OF "targetClassRuleId", "targetClassKey" ON "CharacterLevelHistory"
WHEN NOT EXISTS (
  SELECT 1 FROM "ClassRule"
  WHERE "id" = NEW."targetClassRuleId" AND "classKey" = NEW."targetClassKey"
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterLevelHistory targetClassKey does not match class rule');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterLevelHistory_subclass_matches_class_insert"
BEFORE INSERT ON "CharacterLevelHistory"
WHEN NEW."targetSubclassRuleId" IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM "SubclassRule"
   WHERE "id" = NEW."targetSubclassRuleId"
     AND "classRuleId" = NEW."targetClassRuleId"
     AND "subclassKey" = NEW."targetSubclassKey"
 )
BEGIN
  SELECT RAISE(ABORT, 'CharacterLevelHistory target subclass does not belong to class rule');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterLevelHistory_subclass_matches_class_update"
BEFORE UPDATE OF "targetSubclassRuleId", "targetSubclassKey", "targetClassRuleId" ON "CharacterLevelHistory"
WHEN NEW."targetSubclassRuleId" IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM "SubclassRule"
   WHERE "id" = NEW."targetSubclassRuleId"
     AND "classRuleId" = NEW."targetClassRuleId"
     AND "subclassKey" = NEW."targetSubclassKey"
 )
BEGIN
  SELECT RAISE(ABORT, 'CharacterLevelHistory target subclass does not belong to class rule');
END;

-- This guard is already compatible with MC1. M4 keeps the stricter
-- CharacterClass_m3_single_class_key index; MC1 will drop only that index.
CREATE TRIGGER IF NOT EXISTS "CharacterClass_total_level_limit_insert"
BEFORE INSERT ON "CharacterClass"
WHEN NEW."level" + COALESCE((
  SELECT SUM("level") FROM "CharacterClass" WHERE "characterId" = NEW."characterId"
), 0) > 20
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass total level cannot exceed 20');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterClass_total_level_limit_update"
BEFORE UPDATE OF "characterId", "level" ON "CharacterClass"
WHEN NEW."level" + COALESCE((
  SELECT SUM("level")
  FROM "CharacterClass"
  WHERE "characterId" = NEW."characterId" AND "id" <> OLD."id"
), 0) > 20
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass total level cannot exceed 20');
END;
