import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const directories = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cronache-passive-hp-"));
  directories.push(directory);
  const file = path.join(directory, "migration.db");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE CharacterHitPointState (characterId TEXT PRIMARY KEY, maximumHitPoints INTEGER NOT NULL, currentHitPoints INTEGER NOT NULL, legacySnapshot TEXT NOT NULL);
    INSERT INTO CharacterHitPointState VALUES ('hero',52,40,'{"originalMaximum":45}');`);
  db.close();
  return file;
}
const run = (file, mode) => spawnSync(process.execPath, ["scripts/apply-character-passive-hit-points.mjs", mode, "--database", file], { encoding: "utf8" });
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
describe("passive HP contribution migration", () => {
  it("preserves every existing value, does not infer an applied bonus, and reruns safely", () => {
    const file = fixture();
    const before = hash(file);
    expect(run(file, "--dry-run").status).toBe(0);
    expect(hash(file)).toBe(before);
    expect(run(file, "--apply").status).toBe(0);
    const firstApply = hash(file);
    expect(run(file, "--apply").status).toBe(0);
    expect(hash(file)).toBe(firstApply);
    const db = new DatabaseSync(file);
    try {
      expect(db.prepare("SELECT * FROM CharacterHitPointState").get()).toEqual({ characterId: "hero", maximumHitPoints: 52, currentHitPoints: 40, legacySnapshot: '{"originalMaximum":45}', passiveBonusApplied: 0 });
      expect(() => db.prepare("UPDATE CharacterHitPointState SET passiveBonusApplied = 1.5").run()).toThrow();
      expect(db.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    } finally { db.close(); }
  });
  it("rejects incompatible partial schema instead of rewriting it", () => {
    const file = fixture();
    const db = new DatabaseSync(file);
    db.exec("ALTER TABLE CharacterHitPointState ADD COLUMN passiveBonusApplied TEXT");
    db.close();
    const before = hash(file);
    expect(run(file, "--apply").status).toBe(1);
    expect(hash(file)).toBe(before);
  });
});
