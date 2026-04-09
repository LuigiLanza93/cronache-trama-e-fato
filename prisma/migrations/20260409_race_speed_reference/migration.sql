CREATE TABLE IF NOT EXISTS "RaceSpeedReference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raceName" TEXT NOT NULL,
  "subraceName" TEXT,
  "speedMeters" REAL NOT NULL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "RaceSpeedReference_raceName_subraceName_key"
ON "RaceSpeedReference"("raceName", "subraceName");

CREATE INDEX IF NOT EXISTS "RaceSpeedReference_raceName_subraceName_idx"
ON "RaceSpeedReference"("raceName", "subraceName");

INSERT OR IGNORE INTO "RaceSpeedReference" (
  "id", "raceName", "subraceName", "speedMeters", "notes"
) VALUES
  ('race-speed-umano', 'Umano', NULL, 9, NULL),
  ('race-speed-nano-colline', 'Nano', 'delle colline', 7.5, 'Armatura pesante non riduce la velocita'),
  ('race-speed-nano-montagne', 'Nano', 'delle montagne', 7.5, 'Armatura pesante non riduce la velocita'),
  ('race-speed-elfo-alto', 'Elfo', 'alto', 9, NULL),
  ('race-speed-elfo-boschi', 'Elfo', 'dei boschi', 10.5, 'Piu rapido degli altri elfi'),
  ('race-speed-elfo-drow', 'Elfo', 'drow', 9, NULL),
  ('race-speed-halfling-piedelesto', 'Halfling', 'piedelesto', 7.5, NULL),
  ('race-speed-halfling-tozzo', 'Halfling', 'tozzo', 7.5, NULL),
  ('race-speed-dragonide', 'Dragonide', NULL, 9, NULL),
  ('race-speed-gnomo-foreste', 'Gnomo', 'delle foreste', 7.5, NULL),
  ('race-speed-gnomo-rocce', 'Gnomo', 'delle rocce', 7.5, NULL),
  ('race-speed-mezzelfo', 'Mezzelfo', NULL, 9, NULL),
  ('race-speed-mezzorco', 'Mezzorco', NULL, 9, NULL),
  ('race-speed-tiefling', 'Tiefling', NULL, 9, NULL);
