-- Structured Draconic Bloodline ancestor choice. Historical characters remain
-- NULL until the DM records the choice explicitly; no legacy value is inferred.

ALTER TABLE "CharacterClass" ADD COLUMN "draconicAncestryKey" TEXT;

CREATE TABLE "CharacterDraconicAncestryHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestSignature" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "targetClassKey" TEXT NOT NULL,
  "previousDraconicAncestryKey" TEXT,
  "targetDraconicAncestryKey" TEXT,
  "progressionRevisionBefore" INTEGER NOT NULL,
  "progressionRevisionAfter" INTEGER NOT NULL,
  "characterRevisionBefore" TEXT NOT NULL,
  "characterRevisionAfter" TEXT NOT NULL,
  "reason" TEXT,
  "policyVersion" TEXT NOT NULL,
  "requestSnapshot" TEXT NOT NULL,
  "beforeSnapshot" TEXT NOT NULL,
  "afterSnapshot" TEXT NOT NULL,
  "resultSnapshot" TEXT NOT NULL,
  "appliedByUserId" TEXT,
  "appliedBySnapshot" TEXT NOT NULL,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterDraconicAncestryHistory_request_check" CHECK (length(trim("requestId")) > 0),
  CONSTRAINT "CharacterDraconicAncestryHistory_signature_check" CHECK (
    length("requestSignature") = 64 AND "requestSignature" NOT GLOB '*[^0-9a-f]*'
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_operation_check" CHECK (
    "operationType" IN ('LEVEL_UP', 'SUBCLASS_CORRECTION')
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_class_check" CHECK ("targetClassKey" = 'sorcerer'),
  CONSTRAINT "CharacterDraconicAncestryHistory_previous_key_check" CHECK (
    "previousDraconicAncestryKey" IS NULL OR "previousDraconicAncestryKey" IN
      ('black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white')
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_target_key_check" CHECK (
    "targetDraconicAncestryKey" IS NULL OR "targetDraconicAncestryKey" IN
      ('black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white')
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_changed_check" CHECK (
    ("previousDraconicAncestryKey" IS NOT NULL OR "targetDraconicAncestryKey" IS NOT NULL)
      AND "previousDraconicAncestryKey" IS NOT "targetDraconicAncestryKey"
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_reason_check" CHECK (
    ("previousDraconicAncestryKey" IS NULL AND "targetDraconicAncestryKey" IS NOT NULL AND "reason" IS NULL)
    OR
    ("previousDraconicAncestryKey" IS NOT NULL AND "reason" IS NOT NULL
      AND length(trim("reason")) BETWEEN 3 AND 500)
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_progression_revisions_check" CHECK (
    "progressionRevisionBefore" >= 0
      AND "progressionRevisionAfter" = "progressionRevisionBefore" + 1
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_character_revisions_check" CHECK (
    length(trim("characterRevisionBefore")) > 0
      AND length(trim("characterRevisionAfter")) > 0
      AND "characterRevisionBefore" <> "characterRevisionAfter"
  ),
  CONSTRAINT "CharacterDraconicAncestryHistory_json_check" CHECK (
    json_valid("requestSnapshot") AND json_valid("beforeSnapshot")
      AND json_valid("afterSnapshot") AND json_valid("resultSnapshot")
      AND json_valid("appliedBySnapshot")
  ),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CharacterDraconicAncestryHistory_characterId_request_key"
  ON "CharacterDraconicAncestryHistory"("characterId", "operationType", "requestId");
CREATE UNIQUE INDEX "CharacterDraconicAncestryHistory_characterId_progressionRevisionAfter_key"
  ON "CharacterDraconicAncestryHistory"("characterId", "progressionRevisionAfter");
CREATE INDEX "CharacterDraconicAncestryHistory_characterId_appliedAt_idx"
  ON "CharacterDraconicAncestryHistory"("characterId", "appliedAt");
CREATE INDEX "CharacterDraconicAncestryHistory_appliedByUserId_idx"
  ON "CharacterDraconicAncestryHistory"("appliedByUserId");

CREATE TRIGGER "CharacterClass_draconic_ancestry_insert"
BEFORE INSERT ON "CharacterClass"
WHEN NEW."draconicAncestryKey" IS NOT NULL AND (
  NEW."draconicAncestryKey" NOT IN
    ('black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white')
  OR NEW."classKey" <> 'sorcerer'
  OR NOT EXISTS (
    SELECT 1 FROM "SubclassRule" sr
    WHERE sr."id" = NEW."subclassRuleId"
      AND sr."classRuleId" = NEW."classRuleId"
      AND sr."subclassKey" = 'draconic-bloodline'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass invalid draconic ancestry');
END;

CREATE TRIGGER "CharacterClass_draconic_ancestry_update"
BEFORE UPDATE ON "CharacterClass"
WHEN NEW."draconicAncestryKey" IS NOT NULL AND (
  NEW."draconicAncestryKey" NOT IN
    ('black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white')
  OR NEW."classKey" <> 'sorcerer'
  OR NOT EXISTS (
    SELECT 1 FROM "SubclassRule" sr
    WHERE sr."id" = NEW."subclassRuleId"
      AND sr."classRuleId" = NEW."classRuleId"
      AND sr."subclassKey" = 'draconic-bloodline'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass invalid draconic ancestry');
END;
