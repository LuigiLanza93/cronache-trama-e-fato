-- Additive shop-system foundation. This migration intentionally does not modify existing data.
CREATE TABLE "Shop" (
  "id" TEXT NOT NULL PRIMARY KEY, "externalKey" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "ownerName" TEXT NOT NULL,
  "ownerDescription" TEXT NOT NULL DEFAULT '', "city" TEXT NOT NULL, "discountDc" INTEGER,
  "cp" INTEGER NOT NULL DEFAULT 0, "sp" INTEGER NOT NULL DEFAULT 0,
  "ep" INTEGER NOT NULL DEFAULT 0, "gp" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Shop_externalKey_key" ON "Shop"("externalKey");
CREATE INDEX "Shop_city_idx" ON "Shop"("city");
CREATE INDEX "Shop_name_idx" ON "Shop"("name");
CREATE INDEX "Shop_archivedAt_idx" ON "Shop"("archivedAt");

CREATE TABLE "ShopItem" (
  "id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "itemDefinitionId" TEXT,
  "nameOverride" TEXT, "descriptionOverride" TEXT, "quantity" INTEGER NOT NULL DEFAULT 1,
  "priceCurrency" TEXT NOT NULL, "priceAmount" INTEGER NOT NULL,
  "isSecret" BOOLEAN NOT NULL DEFAULT false, "discoveryDc" INTEGER, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "dmNotes" TEXT, "instanceNotes" TEXT, "data" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ShopItem_shopId_sortOrder_idx" ON "ShopItem"("shopId", "sortOrder");
CREATE INDEX "ShopItem_itemDefinitionId_idx" ON "ShopItem"("itemDefinitionId");
CREATE INDEX "ShopItem_isSecret_idx" ON "ShopItem"("isSecret");

CREATE TABLE "ShopItemFeatureState" (
  "id" TEXT NOT NULL PRIMARY KEY, "shopItemId" TEXT NOT NULL, "itemFeatureId" TEXT NOT NULL,
  "usesSpent" INTEGER NOT NULL DEFAULT 0, "lastResetAt" DATETIME, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("shopItemId") REFERENCES "ShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("itemFeatureId") REFERENCES "ItemFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopItemFeatureState_shopItemId_itemFeatureId_key" ON "ShopItemFeatureState"("shopItemId", "itemFeatureId");
CREATE INDEX "ShopItemFeatureState_shopItemId_idx" ON "ShopItemFeatureState"("shopItemId");
CREATE INDEX "ShopItemFeatureState_itemFeatureId_idx" ON "ShopItemFeatureState"("itemFeatureId");

CREATE TABLE "ShopCharacterProfile" (
  "id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "characterId" TEXT NOT NULL,
  "visitCount" INTEGER NOT NULL DEFAULT 0, "dmNotes" TEXT NOT NULL DEFAULT '',
  "usualDiscountPercent" INTEGER, "lastVisitedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopCharacterProfile_shopId_characterId_key" ON "ShopCharacterProfile"("shopId", "characterId");
CREATE INDEX "ShopCharacterProfile_characterId_idx" ON "ShopCharacterProfile"("characterId");

CREATE TABLE "ShopItemKnowledge" (
  "id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "shopItemId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL, "revealedByUserId" TEXT, "revealNote" TEXT,
  "revealedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("shopItemId") REFERENCES "ShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("revealedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopItemKnowledge_shopItemId_characterId_key" ON "ShopItemKnowledge"("shopItemId", "characterId");
CREATE INDEX "ShopItemKnowledge_shopId_characterId_idx" ON "ShopItemKnowledge"("shopId", "characterId");
CREATE INDEX "ShopItemKnowledge_revealedByUserId_idx" ON "ShopItemKnowledge"("revealedByUserId");

CREATE TABLE "ShopVisit" (
  "id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "characterId" TEXT NOT NULL,
  "status" TEXT NOT NULL, "discountPercent" INTEGER NOT NULL DEFAULT 0,
  "openedByUserId" TEXT, "closedByUserId" TEXT, "closeReason" TEXT, "dmNotes" TEXT NOT NULL DEFAULT '',
  "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" DATETIME, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ShopVisit_shopId_openedAt_idx" ON "ShopVisit"("shopId", "openedAt");
CREATE INDEX "ShopVisit_characterId_openedAt_idx" ON "ShopVisit"("characterId", "openedAt");
CREATE INDEX "ShopVisit_status_idx" ON "ShopVisit"("status");
CREATE INDEX "ShopVisit_openedByUserId_idx" ON "ShopVisit"("openedByUserId");
CREATE INDEX "ShopVisit_closedByUserId_idx" ON "ShopVisit"("closedByUserId");
CREATE UNIQUE INDEX "ShopVisit_single_active_key" ON "ShopVisit"((1)) WHERE "status" = 'ACTIVE';

CREATE TABLE "ShopNegotiation" (
  "id" TEXT NOT NULL PRIMARY KEY, "visitId" TEXT NOT NULL, "characterId" TEXT NOT NULL,
  "direction" TEXT NOT NULL, "shopItemId" TEXT, "characterItemId" TEXT, "quantity" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "itemNameSnapshot" TEXT NOT NULL, "itemDetailsSnapshot" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" DATETIME, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("visitId") REFERENCES "ShopVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("shopItemId") REFERENCES "ShopItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("characterItemId") REFERENCES "CharacterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ShopNegotiation_visitId_status_idx" ON "ShopNegotiation"("visitId", "status");
CREATE INDEX "ShopNegotiation_characterId_idx" ON "ShopNegotiation"("characterId");
CREATE INDEX "ShopNegotiation_shopItemId_idx" ON "ShopNegotiation"("shopItemId");
CREATE INDEX "ShopNegotiation_characterItemId_idx" ON "ShopNegotiation"("characterItemId");

CREATE TABLE "ShopOffer" (
  "id" TEXT NOT NULL PRIMARY KEY, "negotiationId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
  "proposedByUserId" TEXT NOT NULL, "sellerSide" TEXT NOT NULL, "currency" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("negotiationId") REFERENCES "ShopNegotiation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopOffer_negotiationId_sequence_key" ON "ShopOffer"("negotiationId", "sequence");
CREATE INDEX "ShopOffer_proposedByUserId_idx" ON "ShopOffer"("proposedByUserId");

ALTER TABLE "InventoryTransaction" ADD COLUMN "fromShopId" TEXT REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD COLUMN "toShopId" TEXT REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD COLUMN "operationId" TEXT;
ALTER TABLE "InventoryTransaction" ADD COLUMN "shopNegotiationId" TEXT REFERENCES "ShopNegotiation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "InventoryTransaction_fromShopId_idx" ON "InventoryTransaction"("fromShopId");
CREATE INDEX "InventoryTransaction_toShopId_idx" ON "InventoryTransaction"("toShopId");
CREATE INDEX "InventoryTransaction_operationId_idx" ON "InventoryTransaction"("operationId");
CREATE INDEX "InventoryTransaction_shopNegotiationId_idx" ON "InventoryTransaction"("shopNegotiationId");

ALTER TABLE "CurrencyTransaction" ADD COLUMN "fromShopId" TEXT REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurrencyTransaction" ADD COLUMN "toShopId" TEXT REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurrencyTransaction" ADD COLUMN "shopNegotiationId" TEXT REFERENCES "ShopNegotiation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CurrencyTransaction_fromShopId_idx" ON "CurrencyTransaction"("fromShopId");
CREATE INDEX "CurrencyTransaction_toShopId_idx" ON "CurrencyTransaction"("toShopId");
CREATE INDEX "CurrencyTransaction_shopNegotiationId_idx" ON "CurrencyTransaction"("shopNegotiationId");
