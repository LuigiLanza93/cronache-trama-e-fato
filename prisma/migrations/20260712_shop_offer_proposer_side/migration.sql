ALTER TABLE "ShopOffer" ADD COLUMN "proposerSide" TEXT;

UPDATE "ShopOffer"
SET "proposerSide" = CASE
  WHEN (SELECT "role" FROM "User" WHERE "User"."id" = "ShopOffer"."proposedByUserId") = 'dm' THEN 'SHOP'
  ELSE 'CHARACTER'
END
WHERE "proposerSide" IS NULL;
