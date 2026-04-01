import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeMonsterTypeFields } from "../shared/monster-type-normalization.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const db = new DatabaseSync(path.resolve(repoRoot, "prisma", "migration.db"));

const rows = db.prepare('SELECT id, creatureType, data FROM "Monster" ORDER BY name COLLATE NOCASE').all();
const updateStmt = db.prepare(`
  UPDATE "Monster"
  SET creatureType = ?, data = ?, updatedAt = ?
  WHERE id = ?
`);

let changed = 0;
const now = new Date().toISOString();

db.exec("BEGIN");

try {
  for (const row of rows) {
    const data = typeof row.data === "string" && row.data.trim() ? JSON.parse(row.data) : {};
    const general = typeof data.general === "object" && data.general !== null ? data.general : {};
    const normalized = normalizeMonsterTypeFields({
      creatureType: general.creatureType ?? row.creatureType ?? "",
      subtype: general.subtype ?? "",
      typeLabel: general.typeLabel ?? "",
    });

    const currentBase = String(general.creatureType ?? row.creatureType ?? "").trim();
    const currentSubtype = String(general.subtype ?? "").trim();
    const currentLabel = String(general.typeLabel ?? "").trim();

    if (
      currentBase === normalized.creatureType &&
      currentSubtype === normalized.subtype &&
      currentLabel === normalized.typeLabel
    ) {
      continue;
    }

    data.general = {
      ...general,
      creatureType: normalized.creatureType,
      subtype: normalized.subtype,
      typeLabel: normalized.typeLabel,
    };

    updateStmt.run(
      normalized.creatureType || null,
      JSON.stringify(data),
      now,
      row.id
    );
    changed += 1;
  }

  db.exec("COMMIT");
  console.log(`monster-types-normalized:${changed}`);
} catch (error) {
  try {
    db.exec("ROLLBACK");
  } catch {
    // no-op
  }
  throw error;
}
