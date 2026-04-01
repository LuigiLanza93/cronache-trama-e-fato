import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isKnownMonsterType, normalizeMonsterTypeFields } from "../shared/monster-type-normalization.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const db = new DatabaseSync(path.resolve(repoRoot, "prisma", "migration.db"));

const rows = db.prepare('SELECT id, name, creatureType, data FROM "Monster" ORDER BY name COLLATE NOCASE').all();
const updateStmt = db.prepare(`
  UPDATE "Monster"
  SET creatureType = ?, data = ?, updatedAt = ?
  WHERE id = ?
`);

const SIZE_PATTERN = /^(Minuscola|Piccola|Media|Grande|Enorme|Mastodontica)\s+(.+?)(?:,\s*.+)?$/iu;

function extractCandidate(data) {
  const rawText = typeof data?.source?.rawText === "string" ? data.source.rawText : "";
  for (const line of rawText.split(/\r?\n/)) {
    const match = line.trim().match(SIZE_PATTERN);
    if (!match) continue;
    if (!isKnownMonsterType(match[2])) continue;
    return match[2];
  }
  if (typeof data?.type === "string" && data.type.trim() && isKnownMonsterType(data.type)) {
    return data.type;
  }
  return "";
}

let repaired = 0;
const now = new Date().toISOString();

db.exec("BEGIN");

try {
  for (const row of rows) {
    if (isKnownMonsterType(row.creatureType ?? "")) continue;

    const data = typeof row.data === "string" && row.data.trim() ? JSON.parse(row.data) : {};
    const general = typeof data.general === "object" && data.general !== null ? data.general : {};
    const candidate = extractCandidate(data);
    if (!candidate) continue;

    const normalized = normalizeMonsterTypeFields({
      creatureType: candidate,
      subtype: general.subtype ?? "",
      typeLabel: general.typeLabel ?? "",
    });
    if (!normalized.creatureType) continue;

    data.general = {
      ...general,
      creatureType: normalized.creatureType,
      subtype: normalized.subtype,
      typeLabel: normalized.typeLabel,
    };

    updateStmt.run(normalized.creatureType, JSON.stringify(data), now, row.id);
    repaired += 1;
  }

  db.exec("COMMIT");
  console.log(`monster-types-repaired:${repaired}`);
} catch (error) {
  try {
    db.exec("ROLLBACK");
  } catch {
    // no-op
  }
  throw error;
}
