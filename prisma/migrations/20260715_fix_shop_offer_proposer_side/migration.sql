-- Correct the historical proposer-side backfill using the uppercase UserRole values.
-- This UPDATE is intentionally idempotent and safe to re-run during the controlled
-- production migration procedure.
UPDATE "ShopOffer"
SET "proposerSide" = CASE
  WHEN UPPER(COALESCE((
    SELECT "role"
    FROM "User"
    WHERE "User"."id" = "ShopOffer"."proposedByUserId"
  ), '')) = 'DM' THEN 'SHOP'
  ELSE 'CHARACTER'
END;
