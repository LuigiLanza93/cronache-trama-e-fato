ALTER TABLE "CharacterCreation" ADD COLUMN "requestId" TEXT;
ALTER TABLE "CharacterCreation" ADD COLUMN "requestSignature" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterCreation_requestId_key" ON "CharacterCreation"("requestId");
