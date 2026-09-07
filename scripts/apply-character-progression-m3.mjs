import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  CHARACTER_RULESET,
  CLASS_RULES,
  SUBCLASS_RULES,
  normalizeClassKey,
} from "../shared/character-class-rules.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_DB_PATH = path.join(ROOT_DIR, "prisma", "migration.db");
const MIGRATION_PATH = path.join(
  ROOT_DIR,
  "prisma",
  "migrations",
  "20260815_character_progression_m3",
  "migration.sql",
);
const PROGRESSION_TABLES = ["ClassRule", "SubclassRule", "CharacterProgression", "CharacterClass"];

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

function tableNames(db) {
  return new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name));
}

function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((row) => row.name));
}

function requireColumns(db, table, expected) {
  const actual = columnNames(db, table);
  const missing = expected.filter((column) => !actual.has(column));
  if (missing.length) throw new Error(`Schema precheck failed: ${table} missing ${missing.join(", ")}`);
}

function verifyLegacySchema(db) {
  if (!tableNames(db).has("Character")) throw new Error("Schema precheck failed: missing Character table");
  requireColumns(db, "Character", ["id", "slug", "className", "level", "data"]);
}

function verifyProgressionSchema(db, { allowAbsent = false, requireTriggers = true } = {}) {
  const names = tableNames(db);
  const present = PROGRESSION_TABLES.filter((table) => names.has(table));
  if (present.length === 0 && allowAbsent) return false;
  if (present.length !== PROGRESSION_TABLES.length) {
    throw new Error(`Partial M3 schema refused: found ${present.length}/${PROGRESSION_TABLES.length} tables`);
  }
  requireColumns(db, "ClassRule", [
    "id", "classKey", "labelIt", "labelEn", "aliases", "rulesetId", "rulesetVersion",
    "sourceReference", "hitDie", "casterKind", "spellcastingAbility", "spellcastingStartLevel",
    "subclassSelectionLevel", "isCustom", "isManual", "ruleSnapshot", "catalogHash",
    "createdAt", "updatedAt",
  ]);
  requireColumns(db, "SubclassRule", [
    "id", "subclassKey", "classRuleId", "labelIt", "labelEn", "aliases", "rulesetId",
    "rulesetVersion", "sourceReference", "casterKind", "spellcastingAbility",
    "spellcastingStartLevel", "isCustom", "isManual", "archivedAt", "ruleSnapshot",
    "catalogHash", "createdAt", "updatedAt",
  ]);
  requireColumns(db, "CharacterProgression", [
    "characterId", "revision", "backfillStatus", "backfillIssues", "legacySnapshot", "createdAt", "updatedAt",
  ]);
  requireColumns(db, "CharacterClass", [
    "id", "characterId", "classRuleId", "subclassRuleId", "classKey", "level", "sortOrder",
    "isPrimary", "subclassStatus", "source", "ruleSnapshot", "updatedByUserId", "createdAt", "updatedAt",
  ]);

  const requiredIndexes = [
    "ClassRule_rulesetId_rulesetVersion_classKey_key",
    "SubclassRule_rulesetId_rulesetVersion_subclassKey_key",
    "CharacterClass_characterId_classKey_key",
    "CharacterClass_characterId_sortOrder_key",
    "CharacterClass_one_primary_key",
    "CharacterClass_m3_single_class_key",
  ];
  const indexes = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'index'").all().map((row) => row.name));
  const missingIndexes = requiredIndexes.filter((name) => !indexes.has(name));
  if (missingIndexes.length) throw new Error(`Schema precheck failed: missing indexes ${missingIndexes.join(", ")}`);
  if (requireTriggers) {
    const requiredTriggers = [
      "CharacterClass_class_key_matches_rule_insert",
      "CharacterClass_class_key_matches_rule_update",
      "CharacterClass_subclass_matches_class_insert",
      "CharacterClass_subclass_matches_class_update",
    ];
    const triggers = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger'").all().map((row) => row.name));
    const missingTriggers = requiredTriggers.filter((name) => !triggers.has(name));
    if (missingTriggers.length) throw new Error(`Schema precheck failed: missing triggers ${missingTriggers.join(", ")}`);
  }
  return true;
}

function hashSnapshot(snapshot) {
  return createHash("sha256").update(snapshot).digest("hex");
}

function classRuleId(rule) {
  return `${rule.source.rulesetId}@${rule.source.version}:${rule.key}`;
}

function subclassRuleId(rule) {
  return `${rule.source.rulesetId}@${rule.source.version}:${rule.key}`;
}

function sourceReference(source, fallback = null) {
  if (source.rulesetId === CHARACTER_RULESET.id && source.version === CHARACTER_RULESET.version) {
    return CHARACTER_RULESET.source;
  }
  return fallback ?? `${source.rulesetId} ${source.version}`;
}

function catalogRows() {
  const classes = Object.values(CLASS_RULES).map((rule) => {
    const ruleSnapshot = JSON.stringify(rule);
    return {
      id: classRuleId(rule),
      classKey: rule.key,
      labelIt: rule.labels.it,
      labelEn: rule.labels.en,
      aliases: JSON.stringify(rule.aliases),
      rulesetId: rule.source.rulesetId,
      rulesetVersion: rule.source.version,
      sourceReference: sourceReference(rule.source),
      hitDie: rule.hitDie ?? null,
      casterKind: rule.casterKind ?? null,
      spellcastingAbility: rule.spellcastingAbility ?? null,
      spellcastingStartLevel: rule.spellcastingStartLevel ?? null,
      subclassSelectionLevel: rule.subclassLevel ?? null,
      isCustom: 0,
      isManual: 0,
      ruleSnapshot,
      catalogHash: hashSnapshot(ruleSnapshot),
    };
  });
  const classByKey = new Map(classes.map((row) => [row.classKey, row]));
  const subclasses = Object.values(SUBCLASS_RULES).map((rule) => {
    const parent = classByKey.get(rule.classKey);
    if (!parent) throw new Error(`Catalog subclass ${rule.key} references missing class ${rule.classKey}`);
    const ruleSnapshot = JSON.stringify(rule);
    return {
      id: subclassRuleId(rule),
      subclassKey: rule.key,
      classRuleId: parent.id,
      labelIt: rule.labels.it,
      labelEn: rule.labels.en,
      aliases: JSON.stringify(rule.aliases),
      rulesetId: rule.source.rulesetId,
      rulesetVersion: rule.source.version,
      sourceReference: sourceReference(rule.source),
      casterKind: rule.casterKind ?? null,
      spellcastingAbility: rule.spellcastingAbility ?? null,
      spellcastingStartLevel: rule.spellcastingStartLevel ?? null,
      isCustom: 0,
      isManual: 0,
      archivedAt: null,
      ruleSnapshot,
      catalogHash: hashSnapshot(ruleSnapshot),
    };
  });
  return { classes, subclasses, classByKey };
}

function valuesEqual(left, right) {
  return left === right || (left == null && right == null);
}

function catalogMismatches(existing, expected) {
  return Object.keys(expected).filter((key) => !valuesEqual(existing[key], expected[key]));
}

function inspectCatalog(db, catalog) {
  const summary = {
    classRulesInserted: 0,
    classRulesUpdated: 0,
    subclassRulesInserted: 0,
    subclassRulesUpdated: 0,
    unchanged: 0,
  };
  for (const row of catalog.classes) {
    const existing = db.prepare('SELECT * FROM "ClassRule" WHERE id = ?').get(row.id);
    if (!existing) summary.classRulesInserted += 1;
    else if (catalogMismatches(existing, row).length) summary.classRulesUpdated += 1;
    else summary.unchanged += 1;
  }
  for (const row of catalog.subclasses) {
    const existing = db.prepare('SELECT * FROM "SubclassRule" WHERE id = ?').get(row.id);
    if (!existing) summary.subclassRulesInserted += 1;
    else if (catalogMismatches(existing, row).length) summary.subclassRulesUpdated += 1;
    else summary.unchanged += 1;
  }
  return summary;
}

function syncCatalog(db, catalog, now) {
  const summary = {
    classRulesInserted: 0,
    classRulesUpdated: 0,
    subclassRulesInserted: 0,
    subclassRulesUpdated: 0,
    unchanged: 0,
  };
  const insertClass = db.prepare(`
    INSERT INTO "ClassRule" (
      id, classKey, labelIt, labelEn, aliases, rulesetId, rulesetVersion, sourceReference,
      hitDie, casterKind, spellcastingAbility, spellcastingStartLevel, subclassSelectionLevel,
      isCustom, isManual, ruleSnapshot, catalogHash, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSubclass = db.prepare(`
    INSERT INTO "SubclassRule" (
      id, subclassKey, classRuleId, labelIt, labelEn, aliases, rulesetId, rulesetVersion,
      sourceReference, casterKind, spellcastingAbility, spellcastingStartLevel, isCustom,
      isManual, archivedAt, ruleSnapshot, catalogHash, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateClass = db.prepare(`
    UPDATE "ClassRule" SET
      classKey = ?, labelIt = ?, labelEn = ?, aliases = ?, rulesetId = ?, rulesetVersion = ?,
      sourceReference = ?, hitDie = ?, casterKind = ?, spellcastingAbility = ?,
      spellcastingStartLevel = ?, subclassSelectionLevel = ?, isCustom = ?, isManual = ?,
      ruleSnapshot = ?, catalogHash = ?, updatedAt = ?
    WHERE id = ?
  `);
  const updateSubclass = db.prepare(`
    UPDATE "SubclassRule" SET
      subclassKey = ?, classRuleId = ?, labelIt = ?, labelEn = ?, aliases = ?, rulesetId = ?,
      rulesetVersion = ?, sourceReference = ?, casterKind = ?, spellcastingAbility = ?,
      spellcastingStartLevel = ?, isCustom = ?, isManual = ?, archivedAt = ?, ruleSnapshot = ?,
      catalogHash = ?, updatedAt = ?
    WHERE id = ?
  `);

  for (const row of catalog.classes) {
    const existing = db.prepare('SELECT * FROM "ClassRule" WHERE id = ?').get(row.id);
    if (existing) {
      if (catalogMismatches(existing, row).length === 0) {
        summary.unchanged += 1;
      } else {
        const { id, ...values } = row;
        updateClass.run(...Object.values(values), now, id);
        summary.classRulesUpdated += 1;
      }
      continue;
    }
    insertClass.run(...Object.values(row), now, now);
    summary.classRulesInserted += 1;
  }
  for (const row of catalog.subclasses) {
    const existing = db.prepare('SELECT * FROM "SubclassRule" WHERE id = ?').get(row.id);
    if (existing) {
      if (catalogMismatches(existing, row).length === 0) {
        summary.unchanged += 1;
      } else {
        const { id, ...values } = row;
        updateSubclass.run(...Object.values(values), now, id);
        summary.subclassRulesUpdated += 1;
      }
      continue;
    }
    insertSubclass.run(...Object.values(row), now, now);
    summary.subclassRulesInserted += 1;
  }
  return summary;
}

function strictLevel(value) {
  if (typeof value === "string" && !/^\s*\d+\s*$/.test(value)) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 20 ? number : null;
}

function readCharacters(db) {
  return db.prepare(`
    SELECT id, slug, className, level, data
    FROM "Character"
    ORDER BY slug COLLATE NOCASE, id
  `).all();
}

function analyzeLegacyCharacter(row, catalog) {
  const issues = [];
  let data = null;
  try {
    data = JSON.parse(row.data);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("root is not an object");
  } catch (error) {
    issues.push({ code: "DATA_JSON_INVALID", message: String(error.message ?? error) });
  }
  const basicInfo = data?.basicInfo && typeof data.basicInfo === "object" && !Array.isArray(data.basicInfo)
    ? data.basicInfo
    : null;
  const columnClass = typeof row.className === "string" ? row.className.trim() : "";
  const columnClassKey = normalizeClassKey(columnClass);
  const columnLevel = strictLevel(row.level);
  const jsonClass = typeof basicInfo?.class === "string" ? basicInfo.class.trim() : "";
  const jsonClassKey = normalizeClassKey(jsonClass);
  const jsonLevel = strictLevel(basicInfo?.level);

  if (!columnClass) issues.push({ code: "COLUMN_CLASS_MISSING" });
  else if (!columnClassKey) issues.push({ code: "COLUMN_CLASS_UNRESOLVED", value: columnClass });
  if (columnLevel == null) issues.push({ code: "COLUMN_LEVEL_INVALID", value: row.level ?? null });

  if (!basicInfo) {
    issues.push({ code: "BASIC_INFO_MISSING" });
  } else {
    if (!jsonClass) issues.push({ code: "BASIC_INFO_CLASS_MISSING" });
    else if (!jsonClassKey) issues.push({ code: "BASIC_INFO_CLASS_UNRESOLVED", value: jsonClass });
    else if (columnClassKey && jsonClassKey !== columnClassKey) {
      issues.push({ code: "CLASS_DIVERGENCE", column: columnClassKey, basicInfo: jsonClassKey });
    }
    if (jsonLevel == null) issues.push({ code: "BASIC_INFO_LEVEL_INVALID", value: basicInfo.level ?? null });
    else if (columnLevel != null && jsonLevel !== columnLevel) {
      issues.push({ code: "LEVEL_DIVERGENCE", column: columnLevel, basicInfo: jsonLevel });
    }
  }

  const unresolved = issues.length > 0;
  const classRule = columnClassKey ? catalog.classByKey.get(columnClassKey) : null;
  if (columnClassKey && !classRule) issues.push({ code: "CATALOG_RULE_MISSING", classKey: columnClassKey });
  const legacySnapshot = {
    column: { className: row.className ?? null, level: row.level ?? null },
    basicInfo: basicInfo ? { class: basicInfo.class ?? null, level: basicInfo.level ?? null } : null,
  };
  return {
    characterId: row.id,
    slug: row.slug,
    classKey: columnClassKey,
    level: columnLevel,
    classRule,
    issues,
    unresolved: unresolved || !classRule,
    legacySnapshot,
  };
}

function existingClasses(db, characterId, schemaPresent) {
  if (!schemaPresent) return [];
  return db.prepare('SELECT * FROM "CharacterClass" WHERE characterId = ? ORDER BY sortOrder, id').all(characterId);
}

function evaluateExistingClass(analysis, rows) {
  if (rows.length === 0) return;
  if (analysis.unresolved) {
    analysis.issues.push({ code: "EXISTING_CLASS_FOR_UNRESOLVED_LEGACY", count: rows.length });
    return;
  }
  if (rows.length !== 1) {
    analysis.issues.push({ code: "EXISTING_CLASS_COUNT_CONFLICT", count: rows.length });
    analysis.unresolved = true;
    return;
  }
  const existing = rows[0];
  const matches = existing.classRuleId === analysis.classRule.id
    && existing.classKey === analysis.classKey
    && Number(existing.level) === analysis.level
    && Number(existing.sortOrder) === 0
    && Number(existing.isPrimary) === 1;
  if (!matches) {
    analysis.issues.push({
      code: "EXISTING_CLASS_CONFLICT",
      existing: {
        classRuleId: existing.classRuleId,
        classKey: existing.classKey,
        level: Number(existing.level),
        sortOrder: Number(existing.sortOrder),
        isPrimary: Boolean(existing.isPrimary),
      },
    });
    analysis.unresolved = true;
  }
}

function statusFor(analysis) {
  if (analysis.unresolved) return "UNRESOLVED";
  return "BACKFILLED";
}

function upsertProgression(db, analysis, status, now) {
  const issues = JSON.stringify(analysis.issues);
  const snapshot = JSON.stringify(analysis.legacySnapshot);
  const result = db.prepare(`
    INSERT INTO "CharacterProgression" (
      characterId, revision, backfillStatus, backfillIssues, legacySnapshot, createdAt, updatedAt
    ) VALUES (?, 0, ?, ?, ?, ?, ?)
    ON CONFLICT(characterId) DO UPDATE SET
      backfillStatus = excluded.backfillStatus,
      backfillIssues = excluded.backfillIssues,
      legacySnapshot = excluded.legacySnapshot,
      updatedAt = excluded.updatedAt
    WHERE "CharacterProgression".backfillStatus <> excluded.backfillStatus
       OR "CharacterProgression".backfillIssues <> excluded.backfillIssues
       OR "CharacterProgression".legacySnapshot <> excluded.legacySnapshot
  `).run(analysis.characterId, status, issues, snapshot, now, now);
  return Number(result.changes);
}

function insertCharacterClass(db, analysis, now) {
  const subclassStatus = analysis.level >= analysis.classRule.subclassSelectionLevel
    ? "INCOMPLETE_LEGACY"
    : "NOT_YET_ELIGIBLE";
  db.prepare(`
    INSERT INTO "CharacterClass" (
      id, characterId, classRuleId, subclassRuleId, classKey, level, sortOrder, isPrimary,
      subclassStatus, source, ruleSnapshot, updatedByUserId, createdAt, updatedAt
    ) VALUES (?, ?, ?, NULL, ?, ?, 0, true, ?, 'LEGACY_BACKFILL', ?, NULL, ?, ?)
  `).run(
    `character-class:${analysis.characterId}:${analysis.classKey}`,
    analysis.characterId,
    analysis.classRule.id,
    analysis.classKey,
    analysis.level,
    subclassStatus,
    analysis.classRule.ruleSnapshot,
    now,
    now,
  );
}

function integrityRows(db) {
  return db.prepare("PRAGMA integrity_check").all().map((row) => String(Object.values(row)[0]));
}

function foreignKeyRows(db) {
  return db.prepare("PRAGMA foreign_key_check").all()
    .map((row) => JSON.stringify([row.table, row.rowid ?? null, row.parent, row.fkid]));
}

function run() {
  const { apply, databasePath } = parseArguments(process.argv.slice(2));
  if (!existsSync(databasePath)) throw new Error(`SQLite database does not exist: ${databasePath}`);
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  let transactionOpen = false;
  try {
    db.exec("PRAGMA busy_timeout = 30000; PRAGMA foreign_keys = ON;");
    verifyLegacySchema(db);
    const integrityBefore = integrityRows(db);
    if (integrityBefore.length !== 1 || integrityBefore[0] !== "ok") throw new Error("Pre-apply integrity_check failed");
    const foreignKeysBefore = new Set(foreignKeyRows(db));
    const legacyBefore = JSON.stringify(readCharacters(db));
    const catalog = catalogRows();
    let schemaPresent = verifyProgressionSchema(db, { allowAbsent: true, requireTriggers: false });
    const schemaPresentBefore = schemaPresent;
    const catalogPlan = schemaPresent
      ? inspectCatalog(db, catalog)
      : {
          classRulesInserted: catalog.classes.length,
          classRulesUpdated: 0,
          subclassRulesInserted: catalog.subclasses.length,
          subclassRulesUpdated: 0,
          unchanged: 0,
        };
    let catalogApplied = {
      classRulesInserted: 0,
      classRulesUpdated: 0,
      subclassRulesInserted: 0,
      subclassRulesUpdated: 0,
      unchanged: catalogPlan.unchanged,
    };

    if (apply) {
      db.exec("BEGIN IMMEDIATE;");
      transactionOpen = true;
      db.exec(readFileSync(MIGRATION_PATH, "utf8"));
      schemaPresent = verifyProgressionSchema(db);
      catalogApplied = syncCatalog(db, catalog, new Date().toISOString());
    }

    const analyses = readCharacters(db).map((row) => analyzeLegacyCharacter(row, catalog));
    const now = new Date().toISOString();
    let insertedCharacterClasses = 0;
    let changedProgressions = 0;
    for (const analysis of analyses) {
      const existing = existingClasses(db, analysis.characterId, schemaPresent);
      evaluateExistingClass(analysis, existing);
      const status = statusFor(analysis);
      analysis.status = status;
      analysis.existingClassCount = existing.length;
      analysis.wouldInsertCharacterClass = !analysis.unresolved && existing.length === 0;
      if (apply) {
        if (analysis.wouldInsertCharacterClass) {
          insertCharacterClass(db, analysis, now);
          insertedCharacterClasses += 1;
        }
        changedProgressions += upsertProgression(db, analysis, status, now);
      }
    }

    if (apply) {
      verifyProgressionSchema(db);
      if (JSON.stringify(readCharacters(db)) !== legacyBefore) throw new Error("Legacy Character rows changed during M3 apply");
      const integrityAfter = integrityRows(db);
      if (integrityAfter.length !== 1 || integrityAfter[0] !== "ok") throw new Error("Post-apply integrity_check failed");
      const newForeignKeys = foreignKeyRows(db).filter((row) => !foreignKeysBefore.has(row));
      if (newForeignKeys.length) throw new Error(`${newForeignKeys.length} new foreign-key violations detected`);
      db.exec("COMMIT;");
      transactionOpen = false;
    }

    const report = analyses.map((analysis) => ({
      characterId: analysis.characterId,
      slug: analysis.slug,
      status: analysis.status,
      columnClassKey: analysis.classKey,
      columnLevel: analysis.level,
      existingClassCount: analysis.existingClassCount,
      wouldInsertCharacterClass: analysis.wouldInsertCharacterClass,
      issues: analysis.issues,
    }));
    const summary = {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      databasePath,
      schema: {
        presentBefore: schemaPresentBefore,
        presentAfter: apply ? true : schemaPresentBefore,
        migration: path.relative(ROOT_DIR, MIGRATION_PATH).replaceAll("\\", "/"),
      },
      catalog: {
        classRules: catalog.classes.length,
        subclassRules: catalog.subclasses.length,
        wouldInsertClassRules: catalogPlan.classRulesInserted,
        wouldUpdateClassRules: catalogPlan.classRulesUpdated,
        wouldInsertSubclassRules: catalogPlan.subclassRulesInserted,
        wouldUpdateSubclassRules: catalogPlan.subclassRulesUpdated,
        insertedClassRules: catalogApplied.classRulesInserted,
        updatedClassRules: catalogApplied.classRulesUpdated,
        insertedSubclassRules: catalogApplied.subclassRulesInserted,
        updatedSubclassRules: catalogApplied.subclassRulesUpdated,
        unchanged: catalogApplied.unchanged,
      },
      characters: {
        total: analyses.length,
        backfilled: report.filter((row) => row.status === "BACKFILLED").length,
        unresolved: report.filter((row) => row.status === "UNRESOLVED").length,
        unresolvedDivergences: report.filter((row) =>
          row.status === "UNRESOLVED"
          && row.issues.some((issue) => issue.code === "CLASS_DIVERGENCE" || issue.code === "LEVEL_DIVERGENCE")
        ).length,
        wouldInsertCharacterClasses: report.filter((row) => row.wouldInsertCharacterClass).length,
        insertedCharacterClasses,
        changedProgressions,
      },
      report,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (summary.characters.unresolved > 0) process.exitCode = 2;
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
