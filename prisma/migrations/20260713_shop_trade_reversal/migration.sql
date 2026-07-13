-- Add reversal metadata to inventory transactions.
-- SQLite does not support ADD COLUMN IF NOT EXISTS; apply the two ALTER TABLE
-- statements only after checking PRAGMA table_info("InventoryTransaction").
ALTER TABLE "InventoryTransaction" ADD COLUMN "reversalOfTransactionId" TEXT
  REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryTransaction" ADD COLUMN "reversedAt" DATETIME;

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryTransaction_reversalOfTransactionId_key"
  ON "InventoryTransaction"("reversalOfTransactionId");

CREATE INDEX IF NOT EXISTS "InventoryTransaction_reversedAt_idx"
  ON "InventoryTransaction"("reversedAt");
