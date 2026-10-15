-- Track only the explicit passive contribution included in the saved total.
-- No historical HP, manual effects or legacy snapshots are recalculated.
ALTER TABLE "CharacterHitPointState" ADD COLUMN "passiveBonusApplied" INTEGER NOT NULL DEFAULT 0
  CHECK (typeof("passiveBonusApplied") = 'integer');
