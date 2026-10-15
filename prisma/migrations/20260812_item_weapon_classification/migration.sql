BEGIN IMMEDIATE;

ALTER TABLE "ItemDefinition" ADD COLUMN "weaponProficiencyGroup" TEXT;
ALTER TABLE "ItemDefinition" ADD COLUMN "isLightWeapon" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
