-- Independent Warlock pact boon, separate from its patron. Historical characters remain
-- NULL until the DM records the choice explicitly; no legacy value is inferred.

ALTER TABLE "CharacterClass" ADD COLUMN "pactBoonKey" TEXT;

CREATE TABLE "CharacterPactBoonHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestSignature" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "targetClassKey" TEXT NOT NULL,
  "previousPactBoonKey" TEXT,
  "targetPactBoonKey" TEXT,
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
  CONSTRAINT "CharacterPactBoonHistory_request_check" CHECK (length(trim("requestId")) > 0),
  CONSTRAINT "CharacterPactBoonHistory_signature_check" CHECK (
    length("requestSignature") = 64 AND "requestSignature" NOT GLOB '*[^0-9a-f]*'
  ),
  CONSTRAINT "CharacterPactBoonHistory_operation_check" CHECK (
    "operationType" IN ('LEVEL_UP', 'SUBCLASS_CORRECTION')
  ),
  CONSTRAINT "CharacterPactBoonHistory_class_check" CHECK ("targetClassKey" = 'warlock'),
  CONSTRAINT "CharacterPactBoonHistory_previous_key_check" CHECK (
    "previousPactBoonKey" IS NULL OR "previousPactBoonKey" IN
      ('chain', 'blade', 'tome')
  ),
  CONSTRAINT "CharacterPactBoonHistory_target_key_check" CHECK (
    "targetPactBoonKey" IS NULL OR "targetPactBoonKey" IN
      ('chain', 'blade', 'tome')
  ),
  CONSTRAINT "CharacterPactBoonHistory_changed_check" CHECK (
    ("previousPactBoonKey" IS NOT NULL OR "targetPactBoonKey" IS NOT NULL)
      AND "previousPactBoonKey" IS NOT "targetPactBoonKey"
  ),
  CONSTRAINT "CharacterPactBoonHistory_reason_check" CHECK (
    ("previousPactBoonKey" IS NULL AND "targetPactBoonKey" IS NOT NULL AND "reason" IS NULL)
    OR
    ("previousPactBoonKey" IS NOT NULL AND "reason" IS NOT NULL
      AND length(trim("reason")) BETWEEN 3 AND 500)
  ),
  CONSTRAINT "CharacterPactBoonHistory_progression_revisions_check" CHECK (
    "progressionRevisionBefore" >= 0
      AND "progressionRevisionAfter" = "progressionRevisionBefore" + 1
  ),
  CONSTRAINT "CharacterPactBoonHistory_character_revisions_check" CHECK (
    length(trim("characterRevisionBefore")) > 0
      AND length(trim("characterRevisionAfter")) > 0
      AND "characterRevisionBefore" <> "characterRevisionAfter"
  ),
  CONSTRAINT "CharacterPactBoonHistory_json_check" CHECK (
    json_valid("requestSnapshot") AND json_valid("beforeSnapshot")
      AND json_valid("afterSnapshot") AND json_valid("resultSnapshot")
      AND json_valid("appliedBySnapshot")
  ),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CharacterPactBoonHistory_characterId_request_key"
  ON "CharacterPactBoonHistory"("characterId", "operationType", "requestId");
CREATE UNIQUE INDEX "CharacterPactBoonHistory_characterId_progressionRevisionAfter_key"
  ON "CharacterPactBoonHistory"("characterId", "progressionRevisionAfter");
CREATE INDEX "CharacterPactBoonHistory_characterId_appliedAt_idx"
  ON "CharacterPactBoonHistory"("characterId", "appliedAt");
CREATE INDEX "CharacterPactBoonHistory_appliedByUserId_idx"
  ON "CharacterPactBoonHistory"("appliedByUserId");

CREATE TRIGGER "CharacterClass_pact_boon_insert"
BEFORE INSERT ON "CharacterClass"
WHEN NEW."pactBoonKey" IS NOT NULL AND (
  NEW."pactBoonKey" NOT IN
    ('chain', 'blade', 'tome')
  OR NEW."classKey" <> 'warlock'
  OR NEW."level" < 3
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass invalid pact boon');
END;

CREATE TRIGGER "CharacterClass_pact_boon_update"
BEFORE UPDATE ON "CharacterClass"
WHEN NEW."pactBoonKey" IS NOT NULL AND (
  NEW."pactBoonKey" NOT IN
    ('chain', 'blade', 'tome')
  OR NEW."classKey" <> 'warlock'
  OR NEW."level" < 3
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterClass invalid pact boon');
END;
