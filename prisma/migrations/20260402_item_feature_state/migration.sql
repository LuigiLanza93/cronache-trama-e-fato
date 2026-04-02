ALTER TABLE "ItemFeature"
ADD COLUMN "customResetLabel" TEXT;

CREATE TABLE "CharacterItemFeatureState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterItemId" TEXT NOT NULL,
    "itemFeatureId" TEXT NOT NULL,
    "usesSpent" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterItemFeatureState_characterItemId_fkey" FOREIGN KEY ("characterItemId") REFERENCES "CharacterItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterItemFeatureState_itemFeatureId_fkey" FOREIGN KEY ("itemFeatureId") REFERENCES "ItemFeature" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CharacterItemFeatureState_characterItemId_itemFeatureId_key"
ON "CharacterItemFeatureState"("characterItemId", "itemFeatureId");

CREATE INDEX "CharacterItemFeatureState_characterItemId_idx"
ON "CharacterItemFeatureState"("characterItemId");

CREATE INDEX "CharacterItemFeatureState_itemFeatureId_idx"
ON "CharacterItemFeatureState"("itemFeatureId");
