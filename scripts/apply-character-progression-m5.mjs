import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB = path.join(ROOT, "prisma", "migration.db");
const MIGRATION = path.join(ROOT, "prisma", "migrations", "20260922_character_progression_m5", "migration.sql");
const TABLES = ["CharacterHitPointState", "CharacterHitDiePool", "CharacterHitPointAdjustment"];
const INDEXES = [
  "CharacterHitPointState_backfillStatus_idx", "CharacterHitDiePool_characterId_dieSize_key",
  "CharacterHitDiePool_characterId_idx", "CharacterHitPointAdjustment_characterId_requestId_key",
  "CharacterHitPointAdjustment_characterId_appliedAt_idx", "CharacterHitPointAdjustment_appliedByUserId_idx",
];
const TRIGGERS = ["CharacterLevelHistory_m5_hit_points_insert", "CharacterLevelHistory_m5_hit_points_update"];

function argumentsFor(argv) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) throw new Error("Use either --apply or --dry-run, not both");
  const index = argv.indexOf("--database");
  const assignment = argv.find((value) => value.startsWith("--database="));
  const databasePath = index >= 0
    ? path.resolve(argv[index + 1] ?? "")
    : assignment ? path.resolve(assignment.slice(11)) : DEFAULT_DB;
  if (!databasePath) throw new Error("--database requires a path");
  if (apply && databasePath === path.resolve("/data/migration.db")
      && (!argv.includes("--allow-production") || !argv.includes("--backup-verified"))) {
    throw new Error("Applying to /data/migration.db requires --allow-production and --backup-verified after explicit release authorization");
  }
  return { apply, databasePath };
}

function names(db, type) {
  return new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = ?").all(type).map((row) => String(row.name)));
}

function verifyPrerequisites(db) {
  const tables = names(db, "table");
  for (const table of ["Character", "User", "ClassRule", "CharacterClass", "CharacterProgression", "CharacterLevelHistory"]) {
    if (!tables.has(table)) throw new Error(`M5 requires complete M4 schema: missing ${table}`);
  }
  const historyColumns = new Set(db.prepare('PRAGMA table_info("CharacterLevelHistory")').all().map((row) => row.name));
  for (const column of ["hitDieSize", "hitPointMethod", "hitPointsGained", "constitutionModifier"]) {
    if (!historyColumns.has(column)) throw new Error(`M5 requires M4 history column ${column}`);
  }
}

function verifySchema(db, { allowAbsent = false } = {}) {
  const tables = names(db, "table");
  const indexes = names(db, "index");
  const triggers = names(db, "trigger");
  const presentTables = TABLES.filter((name) => tables.has(name));
  const presentObjects = [...INDEXES.filter((name) => indexes.has(name)), ...TRIGGERS.filter((name) => triggers.has(name))];
  if (presentTables.length === 0 && presentObjects.length === 0) {
    if (allowAbsent) return false;
    throw new Error("Schema precheck failed: missing M5 schema");
  }
  if (presentTables.length !== TABLES.length) throw new Error("Partial M5 schema refused");
  const missing = [...INDEXES.filter((name) => !indexes.has(name)), ...TRIGGERS.filter((name) => !triggers.has(name))];
  if (missing.length) throw new Error(`Partial M5 schema refused: missing ${missing.join(", ")}`);
  return true;
}

function integer(value, fallback = 0, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function parseData(row, issues) {
  try {
    const parsed = JSON.parse(row.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch { /* reported below */ }
  issues.push({ code: "CHARACTER_DATA_INVALID" });
  return {};
}

function analyze(db) {
  const characters = db.prepare(`
    SELECT c.id, c.slug, c.data,
      COALESCE(SUM(cc.level), 0) AS totalLevel,
      COUNT(cc.id) AS classCount
    FROM "Character" c
    LEFT JOIN "CharacterClass" cc ON cc.characterId = c.id
    GROUP BY c.id, c.slug, c.data
    ORDER BY c.slug, c.id
  `).all();
  const classRows = db.prepare(`
    SELECT cc.characterId, cc.level, cr.hitDie
    FROM "CharacterClass" cc JOIN "ClassRule" cr ON cr.id = cc.classRuleId
    ORDER BY cc.characterId, cc.sortOrder, cc.id
  `).all();
  const histories = db.prepare(`
    SELECT characterId, COUNT(*) AS count,
      SUM(CASE WHEN hitPointMethod IS NULL THEN 1 ELSE 0 END) AS deferred
    FROM "CharacterLevelHistory" GROUP BY characterId
  `).all();
  const classesByCharacter = Map.groupBy(classRows, (row) => row.characterId);
  const historyByCharacter = new Map(histories.map((row) => [row.characterId, row]));

  return characters.map((row) => {
    const issues = [{ code: "LEGACY_HP_HISTORY_UNAVAILABLE" }];
    const data = parseData(row, issues);
    const combat = data.combatStats && typeof data.combatStats === "object" ? data.combatStats : {};
    const rest = combat.restState && typeof combat.restState === "object" ? combat.restState : {};
    const maximum = integer(combat.hitPointMaximum, 0);
    const current = integer(combat.currentHitPoints, 0);
    const temporary = integer(combat.temporaryHitPoints, 0);
    const deathSuccesses = integer(combat.deathSaves?.successes, 0, 0, 3);
    const deathFailures = integer(combat.deathSaves?.failures, 0, 0, 3);
    const shortRests = integer(rest.shortRestsUsedSinceLongRest, 0);
    const rows = classesByCharacter.get(row.id) ?? [];
    const maximumBySize = new Map();
    for (const classRow of rows) {
      const dieSize = Number(classRow.hitDie);
      if (![6, 8, 10, 12].includes(dieSize)) {
        issues.push({ code: "HIT_DIE_UNRESOLVED" });
        continue;
      }
      maximumBySize.set(dieSize, (maximumBySize.get(dieSize) ?? 0) + Number(classRow.level));
    }
    const derivedTotal = [...maximumBySize.values()].reduce((sum, value) => sum + value, 0);
    const legacyMaximum = Number.isInteger(Number(rest.maxHitDice)) ? Number(rest.maxHitDice) : null;
    const legacyRemaining = Number.isInteger(Number(rest.hitDiceRemaining)) ? Number(rest.hitDiceRemaining) : null;
    if (legacyMaximum !== null && legacyMaximum !== derivedTotal) issues.push({ code: "LEGACY_HIT_DICE_MAX_DIVERGENCE", legacyMaximum, derivedTotal });
    if (maximumBySize.size > 1 && legacyRemaining !== null) issues.push({ code: "LEGACY_MIXED_HIT_DICE_ALLOCATION_UNKNOWN" });
    const history = historyByCharacter.get(row.id);
    if (Number(history?.deferred ?? 0) > 0) issues.push({ code: "DEFERRED_M4_LEVEL_EFFECT", count: Number(history.deferred) });

    const pools = [...maximumBySize.entries()].map(([dieSize, poolMaximum]) => {
      let remaining = poolMaximum;
      if (maximumBySize.size === 1 && legacyRemaining !== null) remaining = Math.min(poolMaximum, Math.max(0, legacyRemaining));
      if (legacyRemaining !== null && (legacyRemaining < 0 || (maximumBySize.size === 1 && legacyRemaining > poolMaximum))) {
        issues.push({ code: "LEGACY_HIT_DICE_REMAINING_INVALID", legacyRemaining, poolMaximum });
      }
      return {
        id: `character-hit-die:${row.id}:d${dieSize}`,
        characterId: row.id,
        dieSize,
        maximum: poolMaximum,
        remaining,
        source: legacyMaximum === null || legacyMaximum !== derivedTotal ? "LEGACY_MANUAL" : "DERIVED",
        legacySnapshot: JSON.stringify({ maxHitDice: rest.maxHitDice ?? null, hitDiceRemaining: rest.hitDiceRemaining ?? null }),
      };
    });
    const unresolved = issues.some((issue) => ["CHARACTER_DATA_INVALID", "HIT_DIE_UNRESOLVED", "LEGACY_MIXED_HIT_DICE_ALLOCATION_UNKNOWN"].includes(issue.code));
    const legacySnapshot = JSON.stringify({
      hitPointMaximum: combat.hitPointMaximum ?? null, currentHitPoints: combat.currentHitPoints ?? null,
      temporaryHitPoints: combat.temporaryHitPoints ?? null, deathSaves: combat.deathSaves ?? null,
      hitDice: combat.hitDice ?? null, restState: combat.restState ?? null,
    });
    return {
      characterId: row.id, slug: row.slug, totalLevel: Number(row.totalLevel),
      status: unresolved ? "UNRESOLVED" : "LEGACY_MANUAL", issues, pools,
      state: { maximum, current, temporary, deathSuccesses, deathFailures, shortRests,
        lastShortRestAt: rest.lastShortRestAt ?? null, lastLongRestAt: rest.lastLongRestAt ?? null, legacySnapshot },
    };
  });
}

function insertBackfill(db, analyses, now) {
  let states = 0; let pools = 0; let adjustments = 0;
  const insertState = db.prepare(`INSERT OR IGNORE INTO "CharacterHitPointState"
    (characterId, maximumHitPoints, currentHitPoints, temporaryHitPoints, deathSaveSuccesses, deathSaveFailures,
     shortRestsUsedSinceLongRest, lastShortRestAt, lastLongRestAt, revision, backfillStatus, backfillIssues,
     legacySnapshot, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`);
  const insertPool = db.prepare(`INSERT OR IGNORE INTO "CharacterHitDiePool"
    (id, characterId, dieSize, maximum, remaining, source, legacySnapshot, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertAdjustment = db.prepare(`INSERT OR IGNORE INTO "CharacterHitPointAdjustment"
    (id, characterId, requestId, adjustmentType, maximumBefore, maximumAfter, currentBefore, currentAfter,
     delta, constitutionModifierBefore, constitutionModifierAfter, totalLevel, reason, appliedByUserId,
     appliedBySnapshot, detailsSnapshot, appliedAt)
    VALUES (?, ?, NULL, 'BASELINE', ?, ?, ?, ?, 0, NULL, NULL, ?, ?, NULL, ?, ?, ?)`);
  for (const item of analyses) {
    const state = item.state;
    states += Number(insertState.run(item.characterId, state.maximum, state.current, state.temporary,
      state.deathSuccesses, state.deathFailures, state.shortRests, state.lastShortRestAt, state.lastLongRestAt,
      item.status, JSON.stringify(item.issues), state.legacySnapshot, now, now).changes);
    for (const pool of item.pools) pools += Number(insertPool.run(pool.id, pool.characterId, pool.dieSize,
      pool.maximum, pool.remaining, pool.source, pool.legacySnapshot, now, now).changes);
    adjustments += Number(insertAdjustment.run(`character-hit-points-baseline:${item.characterId}`, item.characterId,
      state.maximum, state.maximum, state.current, state.current, Math.max(1, item.totalLevel),
      "Baseline legacy M5; storico per livello non ricostruibile", '{"kind":"M5_BACKFILL"}',
      state.legacySnapshot, now).changes);
  }
  return { states, pools, adjustments };
}

function integrity(db) { return db.prepare("PRAGMA integrity_check").all().map((row) => String(Object.values(row)[0])); }
function foreignKeys(db) { return db.prepare("PRAGMA foreign_key_check").all().map((row) => JSON.stringify(row)).sort(); }

function run() {
  const { apply, databasePath } = argumentsFor(process.argv.slice(2));
  if (!existsSync(databasePath)) throw new Error(`SQLite database does not exist: ${databasePath}`);
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  let transaction = false;
  try {
    db.exec("PRAGMA busy_timeout = 30000; PRAGMA foreign_keys = ON;");
    verifyPrerequisites(db);
    if (integrity(db).join() !== "ok") throw new Error("Pre-apply integrity_check failed");
    if (apply) {
      db.exec("BEGIN IMMEDIATE;");
      transaction = true;
    }
    const fkBefore = new Set(foreignKeys(db));
    const schemaBefore = verifySchema(db, { allowAbsent: true });
    const analyses = analyze(db);
    let inserted = { states: 0, pools: 0, adjustments: 0 };
    if (apply) {
      db.exec(readFileSync(MIGRATION, "utf8")); verifySchema(db);
      inserted = insertBackfill(db, analyses, new Date().toISOString());
      if (integrity(db).join() !== "ok") throw new Error("Post-apply integrity_check failed");
      const newFk = foreignKeys(db).filter((row) => !fkBefore.has(row));
      if (newFk.length) throw new Error(`${newFk.length} new foreign-key violations detected`);
      db.exec("COMMIT;"); transaction = false;
    }
    const unresolved = analyses.filter((item) => item.status === "UNRESOLVED").length;
    console.log(JSON.stringify({ ok: unresolved === 0, mode: apply ? "apply" : "dry-run", databasePath,
      schema: { presentBefore: schemaBefore, presentAfter: apply || schemaBefore, wouldApply: !schemaBefore },
      characters: { total: analyses.length, legacyManual: analyses.filter((item) => item.status === "LEGACY_MANUAL").length, unresolved },
      inserted, report: analyses.map(({ characterId, slug, status, issues, pools }) => ({ characterId, slug, status, issues, pools })),
      preservedForeignKeyViolations: fkBefore.size }, null, 2));
    if (unresolved) process.exitCode = 2;
  } catch (error) {
    if (transaction) try { db.exec("ROLLBACK;"); } catch {}
    throw error;
  } finally { db.close(); }
}

try { run(); } catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) })); process.exitCode = 1; }
