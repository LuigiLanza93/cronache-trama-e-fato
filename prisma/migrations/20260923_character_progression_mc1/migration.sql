-- MC1 enables the plural CharacterClass model prepared by M3.
-- All remaining unique indexes and total-level triggers stay in force.
DROP INDEX IF EXISTS "CharacterClass_m3_single_class_key";
