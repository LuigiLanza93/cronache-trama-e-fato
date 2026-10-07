-- Additive creation journal. Existing characters and CharacterCreation snapshots
-- intentionally receive no inferred event, decision, or grant rows.
CREATE TABLE IF NOT EXISTS "CharacterRuleEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestSignature" TEXT NOT NULL,
  "previewHash" TEXT NOT NULL,
  "previousVersion" INTEGER NOT NULL,
  "resultVersion" INTEGER NOT NULL,
  "rulesetId" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL,
  "resolverVersion" TEXT NOT NULL,
  "catalogHash" TEXT NOT NULL,
  "sourceSnapshot" TEXT NOT NULL,
  "resultSnapshot" TEXT NOT NULL,
  "appliedByUserId" TEXT,
  "appliedBySnapshot" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterRuleEvent_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CharacterRuleEvent_appliedByUserId_fkey"
    FOREIGN KEY ("appliedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CharacterRuleEvent_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "CharacterRuleEvent_type_check" CHECK (
    "eventType" IN ('CREATION', 'CLASS_LEVEL_GAIN', 'TOTAL_LEVEL_GAIN', 'PREPARATION_CHANGE', 'BOOK_COPY', 'REST', 'MANUAL_ADJUSTMENT')
  ),
  CONSTRAINT "CharacterRuleEvent_requestId_check" CHECK (length(trim("requestId")) BETWEEN 8 AND 128),
  CONSTRAINT "CharacterRuleEvent_requestSignature_check" CHECK (
    length("requestSignature") = 64 AND "requestSignature" NOT GLOB '*[^0-9a-f]*'
  ),
  CONSTRAINT "CharacterRuleEvent_previewHash_check" CHECK (
    length("previewHash") = 64 AND "previewHash" NOT GLOB '*[^0-9a-f]*'
  ),
  CONSTRAINT "CharacterRuleEvent_catalogHash_check" CHECK (
    length("catalogHash") = 64 AND "catalogHash" NOT GLOB '*[^0-9a-f]*'
  ),
  CONSTRAINT "CharacterRuleEvent_versions_check" CHECK (
    "previousVersion" >= 0 AND "resultVersion" = "previousVersion" + 1
  ),
  CONSTRAINT "CharacterRuleEvent_ruleset_check" CHECK (
    length(trim("rulesetId")) > 0 AND length(trim("rulesetVersion")) > 0 AND length(trim("resolverVersion")) > 0
  ),
  CONSTRAINT "CharacterRuleEvent_sourceSnapshot_json_check" CHECK (json_valid("sourceSnapshot")),
  CONSTRAINT "CharacterRuleEvent_resultSnapshot_json_check" CHECK (json_valid("resultSnapshot")),
  CONSTRAINT "CharacterRuleEvent_appliedBySnapshot_json_check" CHECK (json_valid("appliedBySnapshot"))
);

CREATE UNIQUE INDEX IF NOT EXISTS "CharacterRuleEvent_characterId_sequence_key"
  ON "CharacterRuleEvent"("characterId", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterRuleEvent_requestId_key"
  ON "CharacterRuleEvent"("requestId");
CREATE INDEX IF NOT EXISTS "CharacterRuleEvent_characterId_createdAt_idx"
  ON "CharacterRuleEvent"("characterId", "createdAt");
CREATE INDEX IF NOT EXISTS "CharacterRuleEvent_appliedByUserId_idx"
  ON "CharacterRuleEvent"("appliedByUserId");

CREATE TABLE IF NOT EXISTS "CharacterRuleDecision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "decisionKind" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "selectedOptions" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "definitionSnapshot" TEXT NOT NULL,
  "levelSnapshot" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterRuleDecision_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "CharacterRuleEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CharacterRuleDecision_identity_check" CHECK (
    length(trim("definitionId")) > 0 AND length(trim("decisionKind")) > 0
    AND length(trim("ruleId")) > 0 AND length(trim("ruleVersion")) > 0
  ),
  CONSTRAINT "CharacterRuleDecision_operation_check" CHECK (
    "operation" IN ('ACQUIRE', 'REPLACE', 'PREPARE')
  ),
  CONSTRAINT "CharacterRuleDecision_selectedOptions_json_check" CHECK (
    json_valid("selectedOptions") AND json_type("selectedOptions") = 'array'
  ),
  CONSTRAINT "CharacterRuleDecision_definitionSnapshot_json_check" CHECK (json_valid("definitionSnapshot")),
  CONSTRAINT "CharacterRuleDecision_levelSnapshot_json_check" CHECK (json_valid("levelSnapshot"))
);

CREATE UNIQUE INDEX IF NOT EXISTS "CharacterRuleDecision_eventId_definitionId_key"
  ON "CharacterRuleDecision"("eventId", "definitionId");
CREATE INDEX IF NOT EXISTS "CharacterRuleDecision_definitionId_idx"
  ON "CharacterRuleDecision"("definitionId");

CREATE TABLE IF NOT EXISTS "CharacterRuleGrant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "decisionId" TEXT,
  "grantInstanceKey" TEXT NOT NULL,
  "grantKind" TEXT NOT NULL,
  "aggregateKey" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "sourceSnapshot" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterRuleGrant_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "CharacterRuleEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CharacterRuleGrant_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "CharacterRuleDecision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CharacterRuleGrant_identity_check" CHECK (
    length(trim("grantInstanceKey")) > 0 AND length(trim("aggregateKey")) > 0
    AND length(trim("ruleId")) > 0 AND length(trim("ruleVersion")) > 0
  ),
  CONSTRAINT "CharacterRuleGrant_kind_check" CHECK (
    "grantKind" IN (
      'PROFICIENCY', 'FEATURE', 'SPELL_GRANT', 'ABILITY_INCREASE',
      'STATISTIC_EFFECT', 'EQUIPMENT', 'CURRENCY', 'CLASS_MEMBERSHIP', 'RESOURCE'
    )
  ),
  CONSTRAINT "CharacterRuleGrant_payload_json_check" CHECK (json_valid("payload")),
  CONSTRAINT "CharacterRuleGrant_sourceSnapshot_json_check" CHECK (json_valid("sourceSnapshot"))
);

CREATE UNIQUE INDEX IF NOT EXISTS "CharacterRuleGrant_eventId_grantInstanceKey_key"
  ON "CharacterRuleGrant"("eventId", "grantInstanceKey");
CREATE INDEX IF NOT EXISTS "CharacterRuleGrant_decisionId_idx"
  ON "CharacterRuleGrant"("decisionId");
CREATE INDEX IF NOT EXISTS "CharacterRuleGrant_grantKind_aggregateKey_idx"
  ON "CharacterRuleGrant"("grantKind", "aggregateKey");

CREATE TRIGGER IF NOT EXISTS "CharacterRuleGrant_decision_event_match_insert"
BEFORE INSERT ON "CharacterRuleGrant"
WHEN NEW."decisionId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CharacterRuleDecision" decision
    WHERE decision."id" = NEW."decisionId" AND decision."eventId" = NEW."eventId"
  )
BEGIN
  SELECT RAISE(ABORT, 'CharacterRuleGrant decision belongs to another event');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterRuleGrant_decision_event_match_update"
BEFORE UPDATE OF "decisionId", "eventId" ON "CharacterRuleGrant"
WHEN NEW."decisionId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "CharacterRuleDecision" decision
    WHERE decision."id" = NEW."decisionId" AND decision."eventId" = NEW."eventId"
  )
BEGIN
  SELECT RAISE(ABORT, 'CharacterRuleGrant decision belongs to another event');
END;
