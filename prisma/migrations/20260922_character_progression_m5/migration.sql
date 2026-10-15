-- M5 authoritative hit points, Hit Dice pools, and auditable adjustments.
-- Additive/restart-safe: pre-M5 Character JSON remains as a legacy projection.

CREATE TABLE IF NOT EXISTS "CharacterHitPointState" (
  "characterId" TEXT NOT NULL PRIMARY KEY,
  "maximumHitPoints" INTEGER NOT NULL,
  "currentHitPoints" INTEGER NOT NULL,
  "temporaryHitPoints" INTEGER NOT NULL DEFAULT 0,
  "deathSaveSuccesses" INTEGER NOT NULL DEFAULT 0,
  "deathSaveFailures" INTEGER NOT NULL DEFAULT 0,
  "shortRestsUsedSinceLongRest" INTEGER NOT NULL DEFAULT 0,
  "lastShortRestAt" DATETIME,
  "lastLongRestAt" DATETIME,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "backfillStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "backfillIssues" TEXT NOT NULL DEFAULT '[]',
  "legacySnapshot" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CharacterHitPointState_values_check" CHECK (
    "maximumHitPoints" >= 0 AND "currentHitPoints" >= 0 AND "temporaryHitPoints" >= 0
    AND "deathSaveSuccesses" BETWEEN 0 AND 3 AND "deathSaveFailures" BETWEEN 0 AND 3
    AND "shortRestsUsedSinceLongRest" >= 0 AND "revision" >= 0
  ),
  CONSTRAINT "CharacterHitPointState_status_check" CHECK (
    "backfillStatus" IN ('PENDING', 'BACKFILLED', 'LEGACY_MANUAL', 'UNRESOLVED')
  ),
  CONSTRAINT "CharacterHitPointState_json_check" CHECK (
    json_valid("backfillIssues") AND json_type("backfillIssues") = 'array'
    AND json_valid("legacySnapshot")
  ),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CharacterHitPointState_backfillStatus_idx"
  ON "CharacterHitPointState"("backfillStatus");

CREATE TABLE IF NOT EXISTS "CharacterHitDiePool" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "dieSize" INTEGER NOT NULL,
  "maximum" INTEGER NOT NULL,
  "remaining" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "legacySnapshot" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CharacterHitDiePool_dieSize_check" CHECK ("dieSize" IN (6, 8, 10, 12)),
  CONSTRAINT "CharacterHitDiePool_values_check" CHECK (
    "maximum" >= 0 AND "remaining" >= 0 AND "remaining" <= "maximum"
  ),
  CONSTRAINT "CharacterHitDiePool_source_check" CHECK (
    "source" IN ('DERIVED', 'LEGACY_MANUAL', 'MANUAL_OVERRIDE')
  ),
  CONSTRAINT "CharacterHitDiePool_json_check" CHECK (json_valid("legacySnapshot")),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterHitDiePool_characterId_dieSize_key"
  ON "CharacterHitDiePool"("characterId", "dieSize");
CREATE INDEX IF NOT EXISTS "CharacterHitDiePool_characterId_idx"
  ON "CharacterHitDiePool"("characterId");

CREATE TABLE IF NOT EXISTS "CharacterHitPointAdjustment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "requestId" TEXT,
  "adjustmentType" TEXT NOT NULL,
  "maximumBefore" INTEGER NOT NULL,
  "maximumAfter" INTEGER NOT NULL,
  "currentBefore" INTEGER NOT NULL,
  "currentAfter" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "constitutionModifierBefore" INTEGER,
  "constitutionModifierAfter" INTEGER,
  "totalLevel" INTEGER NOT NULL,
  "reason" TEXT,
  "appliedByUserId" TEXT,
  "appliedBySnapshot" TEXT NOT NULL,
  "detailsSnapshot" TEXT NOT NULL DEFAULT '{}',
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterHitPointAdjustment_request_check" CHECK (
    "requestId" IS NULL OR length(trim("requestId")) BETWEEN 8 AND 128
  ),
  CONSTRAINT "CharacterHitPointAdjustment_type_check" CHECK (
    "adjustmentType" IN ('BASELINE', 'CONSTITUTION_CHANGE', 'MANUAL_OVERRIDE')
  ),
  CONSTRAINT "CharacterHitPointAdjustment_values_check" CHECK (
    "maximumBefore" >= 0 AND "maximumAfter" >= 0
    AND "currentBefore" >= 0 AND "currentAfter" >= 0
    AND "maximumAfter" = "maximumBefore" + "delta"
    AND "totalLevel" BETWEEN 1 AND 20
  ),
  CONSTRAINT "CharacterHitPointAdjustment_json_check" CHECK (
    json_valid("appliedBySnapshot") AND json_valid("detailsSnapshot")
  ),
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterHitPointAdjustment_characterId_requestId_key"
  ON "CharacterHitPointAdjustment"("characterId", "requestId") WHERE "requestId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "CharacterHitPointAdjustment_characterId_appliedAt_idx"
  ON "CharacterHitPointAdjustment"("characterId", "appliedAt");
CREATE INDEX IF NOT EXISTS "CharacterHitPointAdjustment_appliedByUserId_idx"
  ON "CharacterHitPointAdjustment"("appliedByUserId");

-- M4 persisted hitDieSize when known while leaving the other M5 fields NULL.
-- Keep that exact m4-v1 receipt shape valid during an expand/deploy transition,
-- while every M5 receipt must carry a complete vitality bundle.
CREATE TRIGGER IF NOT EXISTS "CharacterLevelHistory_m5_hit_points_insert"
BEFORE INSERT ON "CharacterLevelHistory"
WHEN NOT (
  (NEW."policyVersion" = 'm4-v1' AND NEW."hitPointMethod" IS NULL
   AND NEW."hitPointsGained" IS NULL AND NEW."constitutionModifier" IS NULL)
  OR
  (NEW."hitDieSize" IN (6, 8, 10, 12)
   AND NEW."hitPointMethod" IN ('HOUSE_RULE_MAX', 'MANUAL_OVERRIDE')
   AND NEW."hitPointsGained" >= 1
   AND NEW."constitutionModifier" IS NOT NULL
   AND (NEW."hitPointMethod" <> 'HOUSE_RULE_MAX'
        OR NEW."hitPointsGained" = MAX(1, NEW."hitDieSize" + NEW."constitutionModifier")))
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterLevelHistory invalid M5 hit point bundle');
END;

CREATE TRIGGER IF NOT EXISTS "CharacterLevelHistory_m5_hit_points_update"
BEFORE UPDATE OF "hitDieSize", "hitPointMethod", "hitPointsGained", "constitutionModifier"
ON "CharacterLevelHistory"
WHEN NOT (
  (NEW."policyVersion" = 'm4-v1' AND NEW."hitPointMethod" IS NULL
   AND NEW."hitPointsGained" IS NULL AND NEW."constitutionModifier" IS NULL)
  OR
  (NEW."hitDieSize" IN (6, 8, 10, 12)
   AND NEW."hitPointMethod" IN ('HOUSE_RULE_MAX', 'MANUAL_OVERRIDE')
   AND NEW."hitPointsGained" >= 1
   AND NEW."constitutionModifier" IS NOT NULL
   AND (NEW."hitPointMethod" <> 'HOUSE_RULE_MAX'
        OR NEW."hitPointsGained" = MAX(1, NEW."hitDieSize" + NEW."constitutionModifier")))
)
BEGIN
  SELECT RAISE(ABORT, 'CharacterLevelHistory invalid M5 hit point bundle');
END;
