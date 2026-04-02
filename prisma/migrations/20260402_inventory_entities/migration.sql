-- CreateTable
CREATE TABLE "ItemDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "weaponHandling" TEXT,
    "gloveWearMode" TEXT,
    "armorCategory" TEXT,
    "armorClassCalculation" TEXT,
    "armorClassBase" INTEGER,
    "armorClassBonus" INTEGER,
    "rarity" TEXT,
    "description" TEXT,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "equippable" BOOLEAN NOT NULL DEFAULT false,
    "attunement" BOOLEAN NOT NULL DEFAULT false,
    "weight" REAL,
    "valueCp" INTEGER,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CharacterItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "itemDefinitionId" TEXT,
    "nameOverride" TEXT,
    "descriptionOverride" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterItem_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemSlotRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemDefinitionId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL DEFAULT 'default',
    "selectionMode" TEXT NOT NULL DEFAULT 'ALL_REQUIRED',
    "slot" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ItemSlotRule_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterItemEquip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterItemId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    CONSTRAINT "CharacterItemEquip_characterItemId_fkey" FOREIGN KEY ("characterItemId") REFERENCES "CharacterItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemAttack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "handRequirement" TEXT NOT NULL DEFAULT 'ANY',
    "ability" TEXT,
    "attackBonus" INTEGER,
    "damageDice" TEXT,
    "damageType" TEXT,
    "rangeNormal" INTEGER,
    "rangeLong" INTEGER,
    "twoHandedOnly" BOOLEAN NOT NULL DEFAULT false,
    "requiresEquipped" BOOLEAN NOT NULL DEFAULT true,
    "conditionText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItemAttack_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemModifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemDefinitionId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER,
    "formula" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'WHILE_EQUIPPED',
    "stackKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItemModifier_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resetOn" TEXT,
    "maxUses" INTEGER,
    "condition" TEXT NOT NULL DEFAULT 'WHILE_EQUIPPED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItemFeature_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "fromOwnerType" TEXT,
    "fromCharacterId" TEXT,
    "fromNpcName" TEXT,
    "toOwnerType" TEXT,
    "toCharacterId" TEXT,
    "toNpcName" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryTransaction_fromCharacterId_fkey" FOREIGN KEY ("fromCharacterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_toCharacterId_fkey" FOREIGN KEY ("toCharacterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTransactionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "characterItemId" TEXT,
    "itemDefinitionId" TEXT,
    "descriptionSnapshot" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "InventoryTransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InventoryTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransactionItem_characterItemId_fkey" FOREIGN KEY ("characterItemId") REFERENCES "CharacterItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransactionItem_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTransactionCurrency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "currencyType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "InventoryTransactionCurrency_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InventoryTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemDefinition_slug_key" ON "ItemDefinition"("slug");

-- CreateIndex
CREATE INDEX "ItemDefinition_category_idx" ON "ItemDefinition"("category");

-- CreateIndex
CREATE INDEX "ItemDefinition_name_idx" ON "ItemDefinition"("name");

-- CreateIndex
CREATE INDEX "ItemDefinition_rarity_idx" ON "ItemDefinition"("rarity");

-- CreateIndex
CREATE INDEX "CharacterItem_characterId_sortOrder_idx" ON "CharacterItem"("characterId", "sortOrder");

-- CreateIndex
CREATE INDEX "CharacterItem_itemDefinitionId_idx" ON "CharacterItem"("itemDefinitionId");

-- CreateIndex
CREATE INDEX "CharacterItem_isEquipped_idx" ON "CharacterItem"("isEquipped");

-- CreateIndex
CREATE INDEX "ItemSlotRule_itemDefinitionId_idx" ON "ItemSlotRule"("itemDefinitionId");

-- CreateIndex
CREATE INDEX "ItemSlotRule_itemDefinitionId_groupKey_sortOrder_idx" ON "ItemSlotRule"("itemDefinitionId", "groupKey", "sortOrder");

-- CreateIndex
CREATE INDEX "ItemSlotRule_slot_idx" ON "ItemSlotRule"("slot");

-- CreateIndex
CREATE INDEX "CharacterItemEquip_slot_idx" ON "CharacterItemEquip"("slot");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterItemEquip_characterItemId_slot_key" ON "CharacterItemEquip"("characterItemId", "slot");

-- CreateIndex
CREATE INDEX "ItemAttack_itemDefinitionId_sortOrder_idx" ON "ItemAttack"("itemDefinitionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ItemAttack_kind_idx" ON "ItemAttack"("kind");

-- CreateIndex
CREATE INDEX "ItemModifier_itemDefinitionId_sortOrder_idx" ON "ItemModifier"("itemDefinitionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ItemModifier_target_condition_idx" ON "ItemModifier"("target", "condition");

-- CreateIndex
CREATE INDEX "ItemFeature_itemDefinitionId_sortOrder_idx" ON "ItemFeature"("itemDefinitionId", "sortOrder");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_createdAt_idx" ON "InventoryTransaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_fromCharacterId_idx" ON "InventoryTransaction"("fromCharacterId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_toCharacterId_idx" ON "InventoryTransaction"("toCharacterId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_createdByUserId_idx" ON "InventoryTransaction"("createdByUserId");

-- CreateIndex
CREATE INDEX "InventoryTransactionItem_transactionId_idx" ON "InventoryTransactionItem"("transactionId");

-- CreateIndex
CREATE INDEX "InventoryTransactionItem_characterItemId_idx" ON "InventoryTransactionItem"("characterItemId");

-- CreateIndex
CREATE INDEX "InventoryTransactionItem_itemDefinitionId_idx" ON "InventoryTransactionItem"("itemDefinitionId");

-- CreateIndex
CREATE INDEX "InventoryTransactionCurrency_transactionId_idx" ON "InventoryTransactionCurrency"("transactionId");

-- CreateIndex
CREATE INDEX "InventoryTransactionCurrency_currencyType_idx" ON "InventoryTransactionCurrency"("currencyType");
