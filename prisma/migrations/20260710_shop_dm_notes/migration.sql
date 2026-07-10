-- Add private DM notes to the permanent shop record.
ALTER TABLE "Shop" ADD COLUMN "dmNotes" TEXT NOT NULL DEFAULT '';
