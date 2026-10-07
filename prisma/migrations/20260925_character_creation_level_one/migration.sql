-- Guided level-one creation keeps its validated input and rule resolution separate
-- from the editable legacy character projection.
CREATE TABLE IF NOT EXISTS "CharacterCreation" (
  "characterId" TEXT NOT NULL PRIMARY KEY,
  "rulesetVersion" TEXT NOT NULL,
  "selections" TEXT NOT NULL,
  "resolvedSnapshot" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterCreation_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CharacterCreation_selections_json_check" CHECK (json_valid("selections")),
  CONSTRAINT "CharacterCreation_resolvedSnapshot_json_check" CHECK (json_valid("resolvedSnapshot"))
);
