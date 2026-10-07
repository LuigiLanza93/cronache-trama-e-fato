import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

describe("guided character creation migrations", () => {
  it("creates a foreign-keyed JSON snapshot and unique durable request IDs", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec('PRAGMA foreign_keys = ON; CREATE TABLE "Character" ("id" TEXT PRIMARY KEY); INSERT INTO "Character" ("id") VALUES (\'hero\')');
      database.exec(readFileSync("prisma/migrations/20260925_character_creation_level_one/migration.sql", "utf8"));
      database.exec(readFileSync("prisma/migrations/20260925_character_creation_request_id/migration.sql", "utf8"));
      const insert = database.prepare(`INSERT INTO "CharacterCreation" (characterId, requestId, requestSignature, rulesetVersion, selections, resolvedSnapshot) VALUES (?, ?, ?, '2014', '{}', '{}')`);
      insert.run("hero", "request-1", "signature-1");
      expect(() => insert.run("missing", "request-2", "signature-2")).toThrow();
      database.exec('INSERT INTO "Character" ("id") VALUES (\'other\')');
      expect(() => insert.run("other", "request-1", "signature-1")).toThrow();
      expect(() => database.prepare('UPDATE "CharacterCreation" SET selections = ? WHERE characterId = ?').run("invalid json", "hero")).toThrow();
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      database.close();
    }
  });
});
