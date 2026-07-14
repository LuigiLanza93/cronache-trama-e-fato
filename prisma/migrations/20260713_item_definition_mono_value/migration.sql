ALTER TABLE "ItemDefinition" ADD COLUMN "valueCurrency" TEXT;
ALTER TABLE "ItemDefinition" ADD COLUMN "valueAmount" INTEGER;

UPDATE "ItemDefinition"
SET
  "valueCurrency" = CASE
    WHEN "valueCp" IS NULL THEN NULL
    WHEN "valueCp" % 100 = 0 THEN 'GP'
    WHEN "valueCp" % 50 = 0 THEN 'EP'
    WHEN "valueCp" % 10 = 0 THEN 'SP'
    ELSE 'CP'
  END,
  "valueAmount" = CASE
    WHEN "valueCp" IS NULL THEN NULL
    WHEN "valueCp" % 100 = 0 THEN "valueCp" / 100
    WHEN "valueCp" % 50 = 0 THEN "valueCp" / 50
    WHEN "valueCp" % 10 = 0 THEN "valueCp" / 10
    ELSE "valueCp"
  END
WHERE "valueCp" IS NOT NULL;
