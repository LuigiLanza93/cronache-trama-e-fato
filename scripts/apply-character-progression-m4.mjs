import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_DB_PATH = path.join(ROOT_DIR, "prisma", "migration.db");
const MIGRATION_PATH = path.join(
  ROOT_DIR,
  "prisma",
  "migrations",
  "20260921_character_progression_m4",
  "migration.sql",
);

const M3_TABLE_COLUMNS = Object.freeze({
  ClassRule: [
    "id", "classKey", "labelIt", "labelEn", "aliases", "rulesetId", "rulesetVersion",
    "sourceReference", "hitDie", "casterKind", "spellcastingAbility", "spellcastingStartLevel",
    "subclassSelectionLevel", "isCustom", "isManual", "ruleSnapshot", "catalogHash",
    "createdAt", "updatedAt",
  ],
  SubclassRule: [
    "id", "subclassKey", "classRuleId", "labelIt", "labelEn", "aliases", "rulesetId",
    "rulesetVersion", "sourceReference", "casterKind", "spellcastingAbility",
    "spellcastingStartLevel", "isCustom", "isManual", "archivedAt", "ruleSnapshot",
    "catalogHash", "createdAt", "updatedAt",
  ],
  CharacterProgression: [
    "characterId", "revision", "backfillStatus", "backfillIssues", "legacySnapshot",
    "createdAt", "updatedAt",
  ],
  CharacterClass: [
    "id", "characterId", "classRuleId", "subclassRuleId", "classKey", "level", "sortOrder",
    "isPrimary", "subclassStatus", "source", "ruleSnapshot", "updatedByUserId", "createdAt",
    "updatedAt",
  ],
});

const M3_REQUIRED_INDEXES = Object.freeze([
  "ClassRule_rulesetId_rulesetVersion_classKey_key",
  "SubclassRule_rulesetId_rulesetVersion_subclassKey_key",
  "CharacterClass_characterId_classKey_key",
  "CharacterClass_characterId_sortOrder_key",
  "CharacterClass_one_primary_key",
  "CharacterClass_m3_single_class_key",
]);

const M3_REQUIRED_TRIGGERS = Object.freeze([
  "CharacterClass_class_key_matches_rule_insert",
  "CharacterClass_class_key_matches_rule_update",
  "CharacterClass_subclass_matches_class_insert",
  "CharacterClass_subclass_matches_class_update",
]);

const M4_HISTORY_COLUMNS = Object.freeze([
  "id", "characterId", "requestId", "requestSignature", "operationType", "mode",
  "targetClassKey", "targetClassRuleId", "targetSubclassKey", "targetSubclassRuleId",
  "classLevelBefore", "classLevelAfter", "totalLevelBefore", "totalLevelAfter",
  "progressionRevisionBefore", "progressionRevisionAfter", "characterRevisionBefore",
  "characterRevisionAfter", "rulesetId", "rulesetVersion", "policyVersion", "requestSnapshot",
  "beforeSnapshot", "afterSnapshot", "ruleSnapshot", "resultSnapshot", "overrideReason",
  "appliedByUserId", "appliedBySnapshot", "hitDieSize", "hitPointMethod", "hitPointsGained",
  "constitutionModifier", "appliedAt",
]);

const M4_REQUIRED_INDEXES = Object.freeze([
  "CharacterLevelHistory_characterId_requestId_key",
  "CharacterLevelHistory_characterId_progressionRevisionAfter_key",
  "CharacterLevelHistory_characterId_appliedAt_idx",
  "CharacterLevelHistory_targetClassRuleId_idx",
  "CharacterLevelHistory_targetSubclassRuleId_idx",
  "CharacterLevelHistory_appliedByUserId_idx",
]);

const M4_REQUIRED_TRIGGERS = Object.freeze([
  "CharacterLevelHistory_class_key_matches_rule_insert",
  "CharacterLevelHistory_class_key_matches_rule_update",
  "CharacterLevelHistory_subclass_matches_class_insert",
  "CharacterLevelHistory_subclass_matches_class_update",
  "CharacterClass_total_level_limit_insert",
  "CharacterClass_total_level_limit_update",
]);

function parseArguments(argv) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) throw new Error("Use either --apply or --dry-run, not both");
  const databaseIndex = argv.indexOf("--database");
  const assignment = argv.find((argument) => argument.startsWith("--database="));
  let databasePath = DEFAULT_DB_PATH;
  if (databaseIndex >= 0) {
    const value = argv[databaseIndex + 1];
    if (!value || value.startsWith("--")) throw new Error("--database requires a path");
    databasePath = path.resolve(value);
  } else if (assignment) {
    const value = assignment.slice("--database=".length);
    if (!value) throw new Error("--database requires a path");
    databasePath = path.resolve(value);
  }

  const productionPath = path.resolve("/data/migration.db");
  if (apply && databasePath === productionPath) {
    if (!argv.includes("--allow-production") || !argv.includes("--backup-verified")) {
      throw new Error("Applying to /data/migration.db requires --allow-production and --backup-verified after explicit release authorization");
    }
  }
  return { apply, databasePath };
}

function schemaNames(db, type) {
  return new Set(
    db.prepare("SELECT name FROM sqlite_schema WHERE type = ?").all(type).map((row) => String(row.name)),
  );
}

function columnNames(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info("${tableName}")`).all().map((row) => String(row.name)));
}

function requireColumns(db, tableName, expectedColumns) {
  const actual = columnNames(db, tableName);
  const missing = expectedColumns.filter((column) => !actual.has(column));
  if (missing.length > 0) {
    throw new Error(`Schema precheck failed: ${tableName} missing ${missing.join(", ")}`);
  }
}

function requireObjects(db, type, expectedNames) {
  const actual = schemaNames(db, type);
  const missing = expectedNames.filter((name) => !actual.has(name));
  if (missing.length > 0) {
    throw new Error(`Schema precheck failed: missing ${type} objects ${missing.join(", ")}`);
  }
}

function verifyM3Schema(db) {
  const tables = schemaNames(db, "table");
  for (const [tableName, columns] of Object.entries(M3_TABLE_COLUMNS)) {
    if (!tables.has(tableName)) throw new Error(`M4 requires complete M3 schema: missing ${tableName}`);
    requireColumns(db, tableName, columns);
  }
  requireObjects(db, "index", M3_REQUIRED_INDEXES);
  requireObjects(db, "trigger", M3_REQUIRED_TRIGGERS);
}

function verifyM4Schema(db, { allowAbsent = false } = {}) {
  const tables = schemaNames(db, "table");
  const indexes = schemaNames(db, "index");
  const triggers = schemaNames(db, "trigger");
  const tablePresent = tables.has("CharacterLevelHistory");
  const presentIndexes = M4_REQUIRED_INDEXES.filter((name) => indexes.has(name));
  const presentTriggers = M4_REQUIRED_TRIGGERS.filter((name) => triggers.has(name));

  if (!tablePresent) {
    if (presentIndexes.length > 0 || presentTriggers.length > 0) {
      throw new Error("Partial M4 schema refused: history table is absent but M4 objects are present");
    }
    if (allowAbsent) return false;
    throw new Error("Schema precheck failed: missing CharacterLevelHistory");
  }

  requireColumns(db, "CharacterLevelHistory", M4_HISTORY_COLUMNS);
  requireObjects(db, "index", M4_REQUIRED_INDEXES);
  requireObjects(db, "trigger", M4_REQUIRED_TRIGGERS);
  return true;
}

function parseIssueArray(value) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function progressionReadiness(db) {
  const rows = db.prepare(`
    SELECT
      c.id AS characterId,
      c.slug,
      cp.revision,
      cp.backfillStatus,
      cp.backfillIssues,
      COUNT(cc.id) AS classCount,
      COALESCE(SUM(CASE WHEN cc.isPrimary = 1 THEN 1 ELSE 0 END), 0) AS primaryCount,
      COALESCE(SUM(cc.level), 0) AS totalLevel
    FROM "Character" c
    LEFT JOIN "CharacterProgression" cp ON cp.characterId = c.id
    LEFT JOIN "CharacterClass" cc ON cc.characterId = c.id
    GROUP BY c.id, c.slug, cp.revision, cp.backfillStatus, cp.backfillIssues
    ORDER BY c.slug, c.id
  `).all();

  return rows.map((row) => {
    const issues = [];
    const recordedIssues = parseIssueArray(row.backfillIssues);
    if (row.revision == null || !Number.isInteger(Number(row.revision)) || Number(row.revision) < 0) {
      issues.push("PROGRESSION_REVISION_INVALID");
    }
    if (row.backfillStatus !== "BACKFILLED") issues.push("PROGRESSION_NOT_BACKFILLED");
    if (!recordedIssues) issues.push("BACKFILL_ISSUES_INVALID");
    else if (recordedIssues.length > 0) issues.push("BACKFILL_ISSUES_PRESENT");
    if (Number(row.classCount) !== 1) issues.push("M4_REQUIRES_ONE_CLASS");
    if (Number(row.primaryCount) !== 1) issues.push("PRIMARY_CLASS_COUNT_INVALID");
    if (!Number.isInteger(Number(row.totalLevel)) || Number(row.totalLevel) < 1 || Number(row.totalLevel) > 20) {
      issues.push("TOTAL_LEVEL_INVALID");
    }
    return {
      characterId: row.characterId,
      slug: row.slug,
      revision: row.revision == null ? null : Number(row.revision),
      backfillStatus: row.backfillStatus ?? null,
      classCount: Number(row.classCount),
      primaryCount: Number(row.primaryCount),
      totalLevel: Number(row.totalLevel),
      issues,
    };
  });
}

function integrityRows(db) {
  return db.prepare("PRAGMA integrity_check").all().map((row) => String(Object.values(row)[0]));
}

function foreignKeyRows(db) {
  return db.prepare("PRAGMA foreign_key_check").all().map((row) => JSON.stringify(row)).sort();
}

function progressionStateSnapshot(db, m4Present) {
  return JSON.stringify({
    characters: db.prepare(`
      SELECT id, slug, className, level, data, updatedAt
      FROM "Character"
      ORDER BY id
    `).all(),
    progressions: db.prepare(`
      SELECT characterId, revision, backfillStatus, backfillIssues, legacySnapshot, createdAt, updatedAt
      FROM "CharacterProgression"
      ORDER BY characterId
    `).all(),
    classes: db.prepare(`
      SELECT id, characterId, classRuleId, subclassRuleId, classKey, level, sortOrder, isPrimary,
             subclassStatus, source, ruleSnapshot, updatedByUserId, createdAt, updatedAt
      FROM "CharacterClass"
      ORDER BY characterId, sortOrder, id
    `).all(),
    history: m4Present
      ? db.prepare('SELECT * FROM "CharacterLevelHistory" ORDER BY characterId, progressionRevisionAfter, id').all()
      : [],
  });
}

function run() {
  const { apply, databasePath } = parseArguments(process.argv.slice(2));
  if (!existsSync(databasePath)) throw new Error(`SQLite database does not exist: ${databasePath}`);

  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  let transactionOpen = false;
  try {
    db.exec("PRAGMA busy_timeout = 30000; PRAGMA foreign_keys = ON;");
    verifyM3Schema(db);
    const integrityBefore = integrityRows(db);
    if (integrityBefore.length !== 1 || integrityBefore[0] !== "ok") {
      throw new Error("Pre-apply integrity_check failed");
    }

    const foreignKeysBefore = new Set(foreignKeyRows(db));
    const readiness = progressionReadiness(db);
    const unresolved = readiness.filter((row) => row.issues.length > 0);
    const schemaPresentBefore = verifyM4Schema(db, { allowAbsent: true });
    const stateBefore = progressionStateSnapshot(db, schemaPresentBefore);

    if (apply && unresolved.length > 0) {
      throw new Error(`M4 apply refused: ${unresolved.length} character progression rows are not ready`);
    }

    if (apply) {
      db.exec("BEGIN IMMEDIATE;");
      transactionOpen = true;
      db.exec(readFileSync(MIGRATION_PATH, "utf8"));
      verifyM4Schema(db);

      const stateAfter = progressionStateSnapshot(db, true);
      if (stateAfter !== stateBefore) {
        throw new Error("Progression data changed during M4 schema apply");
      }
      const integrityAfter = integrityRows(db);
      if (integrityAfter.length !== 1 || integrityAfter[0] !== "ok") {
        throw new Error("Post-apply integrity_check failed");
      }
      const newForeignKeys = foreignKeyRows(db).filter((row) => !foreignKeysBefore.has(row));
      if (newForeignKeys.length > 0) {
        throw new Error(`${newForeignKeys.length} new foreign-key violations detected`);
      }
      db.exec("COMMIT;");
      transactionOpen = false;
    }

    const historyRows = apply || schemaPresentBefore
      ? Number(db.prepare('SELECT COUNT(*) AS count FROM "CharacterLevelHistory"').get().count)
      : 0;
    const summary = {
      ok: unresolved.length === 0,
      mode: apply ? "apply" : "dry-run",
      databasePath,
      schema: {
        presentBefore: schemaPresentBefore,
        presentAfter: apply ? true : schemaPresentBefore,
        wouldApply: !schemaPresentBefore,
        migration: path.relative(ROOT_DIR, MIGRATION_PATH).replaceAll("\\", "/"),
      },
      readiness: {
        characters: readiness.length,
        ready: readiness.length - unresolved.length,
        unresolved: unresolved.length,
        report: readiness,
      },
      historyRows,
      preservedForeignKeyViolations: foreignKeysBefore.size,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (unresolved.length > 0) process.exitCode = 2;
  } catch (error) {
    if (transactionOpen) {
      try { db.exec("ROLLBACK;"); } catch { /* preserve original error */ }
    }
    throw error;
  } finally {
    db.close();
  }
}

try {
  run();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
  process.exitCode = 1;
}
