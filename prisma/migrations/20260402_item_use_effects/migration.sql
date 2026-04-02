CREATE TABLE "ItemUseEffect" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemDefinitionId" TEXT NOT NULL,
  "effectType" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "diceExpression" TEXT,
  "flatValue" INTEGER,
  "damageType" TEXT,
  "savingThrowAbility" TEXT,
  "savingThrowDc" INTEGER,
  "successOutcome" TEXT,
  "durationText" TEXT,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemUseEffect_itemDefinitionId_fkey"
    FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ItemUseEffect_itemDefinitionId_sortOrder_idx"
  ON "ItemUseEffect"("itemDefinitionId", "sortOrder");

CREATE INDEX "ItemUseEffect_effectType_idx"
  ON "ItemUseEffect"("effectType");
