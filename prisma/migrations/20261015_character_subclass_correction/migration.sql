-- Dedicated, immutable audit history for DM subclass identity corrections.
-- This is intentionally separate from CharacterLevelHistory: no level changes
-- are allowed by this operation.

CREATE TABLE IF NOT EXISTS "CharacterSubclassHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestSignature" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "targetClassKey" TEXT NOT NULL,
  "targetClassRuleId" TEXT NOT NULL,
  "previousSubclassKey" TEXT,
  "previousSubclassRuleId" TEXT,
  "targetSubclassKey" TEXT NOT NULL,
  "targetSubclassRuleId" TEXT NOT NULL,
  "classLevel" INTEGER NOT NULL,
  "totalLevel" INTEGER NOT NULL,
  "progressionRevisionBefore" INTEGER NOT NULL,
  "progressionRevisionAfter" INTEGER NOT NULL,
  "characterRevisionBefore" TEXT NOT NULL,
  "characterRevisionAfter" TEXT NOT NULL,
  "reason" TEXT,
  "policyVersion" TEXT NOT NULL,
  "requestSnapshot" TEXT NOT NULL,
  "beforeSnapshot" TEXT NOT NULL,
  "afterSnapshot" TEXT NOT NULL,
  "ruleSnapshot" TEXT NOT NULL,
  "resultSnapshot" TEXT NOT NULL,
  "appliedByUserId" TEXT,
  "appliedBySnapshot" TEXT NOT NULL,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterSubclassHistory_requestId_check" CHECK (length(trim("requestId")) > 0),
  CONSTRAINT "CharacterSubclassHistory_requestSignature_check" CHECK (
    length("requestSignature") = 64 AND "requestSignature" NOT GLOB '*[^0-9a-f]*'
  ),
  CONSTRAINT "CharacterSubclassHistory_mode_check" CHECK ("mode" IN ('ASSIGN', 'CHANGE')),
  CONSTRAINT "CharacterSubclassHistory_previous_check" CHECK (
    ("mode" = 'ASSIGN' AND "previousSubclassKey" IS NULL AND "previousSubclassRuleId" IS NULL AND "reason" IS NULL)
    OR
    ("mode" = 'CHANGE' AND "previousSubclassKey" IS NOT NULL AND "previousSubclassRuleId" IS NOT NULL
      AND "reason" IS NOT NULL
      AND length(trim("reason")) BETWEEN 3 AND 500)
  ),
  CONSTRAINT "CharacterSubclassHistory_changed_check" CHECK (
    "previousSubclassKey" IS NULL OR "previousSubclassKey" <> "targetSubclassKey"
  ),
  CONSTRAINT "CharacterSubclassHistory_levels_check" CHECK (
    "classLevel" BETWEEN 1 AND 20 AND "totalLevel" BETWEEN "classLevel" AND 20
  ),
  CONSTRAINT "CharacterSubclassHistory_progressionRevisions_check" CHECK (
    "progressionRevisionBefore" >= 0 AND "progressionRevisionAfter" = "progressionRevisionBefore" + 1
  ),
  CONSTRAINT "CharacterSubclassHistory_characterRevisions_check" CHECK (
    length(trim("characterRevisionBefore")) > 0 AND length(trim("characterRevisionAfter")) > 0
      AND "characterRevisionBefore" <> "characterRevisionAfter"
  ),
  CONSTRAINT "CharacterSubclassHistory_json_check" CHECK (
    json_valid("requestSnapshot") AND json_valid("beforeSnapshot") AND json_valid("afterSnapshot")
      AND json_valid("ruleSnapshot") AND json_valid("resultSnapshot") AND json_valid("appliedBySnapshot")
  ),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("targetClassRuleId") REFERENCES "ClassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("previousSubclassRuleId") REFERENCES "SubclassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("targetSubclassRuleId") REFERENCES "SubclassRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CharacterSubclassHistory_characterId_requestId_key"
  ON "CharacterSubclassHistory"("characterId", "requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterSubclassHistory_characterId_progressionRevisionAfter_key"
  ON "CharacterSubclassHistory"("characterId", "progressionRevisionAfter");
CREATE INDEX IF NOT EXISTS "CharacterSubclassHistory_characterId_appliedAt_idx"
  ON "CharacterSubclassHistory"("characterId", "appliedAt");
CREATE INDEX IF NOT EXISTS "CharacterSubclassHistory_targetClassRuleId_idx"
  ON "CharacterSubclassHistory"("targetClassRuleId");
CREATE INDEX IF NOT EXISTS "CharacterSubclassHistory_previousSubclassRuleId_idx"
  ON "CharacterSubclassHistory"("previousSubclassRuleId");
CREATE INDEX IF NOT EXISTS "CharacterSubclassHistory_targetSubclassRuleId_idx"
  ON "CharacterSubclassHistory"("targetSubclassRuleId");
CREATE INDEX IF NOT EXISTS "CharacterSubclassHistory_appliedByUserId_idx"
  ON "CharacterSubclassHistory"("appliedByUserId");

CREATE TRIGGER IF NOT EXISTS "CharacterSubclassHistory_class_key_matches_rule_insert"
BEFORE INSERT ON "CharacterSubclassHistory"
WHEN NOT EXISTS (SELECT 1 FROM "ClassRule" WHERE "id" = NEW."targetClassRuleId" AND "classKey" = NEW."targetClassKey")
BEGIN
  SELECT RAISE(ABORT, 'CharacterSubclassHistory targetClassKey does not match class rule');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterSubclassHistory_subclasses_match_class_insert"
BEFORE INSERT ON "CharacterSubclassHistory"
WHEN NOT EXISTS (
  SELECT 1 FROM "SubclassRule" WHERE "id" = NEW."targetSubclassRuleId"
    AND "classRuleId" = NEW."targetClassRuleId" AND "subclassKey" = NEW."targetSubclassKey"
) OR (
  NEW."previousSubclassRuleId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "SubclassRule" WHERE "id" = NEW."previousSubclassRuleId"
      AND "classRuleId" = NEW."targetClassRuleId" AND "subclassKey" = NEW."previousSubclassKey"
  )
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterSubclassHistory subclass does not belong to class rule');
END;
