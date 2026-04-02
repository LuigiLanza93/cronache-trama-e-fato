CREATE TABLE "ItemAbilityRequirement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemDefinitionId" TEXT NOT NULL,
  "ability" TEXT NOT NULL,
  "minScore" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemAbilityRequirement_itemDefinitionId_fkey"
    FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ItemAbilityRequirement_itemDefinitionId_sortOrder_idx"
  ON "ItemAbilityRequirement"("itemDefinitionId", "sortOrder");

CREATE INDEX "ItemAbilityRequirement_ability_idx"
  ON "ItemAbilityRequirement"("ability");
