import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { resolveProgressionSummary } from "../shared/character-class-rules.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB = path.join(ROOT, "prisma", "migration.db");
const MIGRATION = path.join(ROOT, "prisma", "migrations", "20260922_character_progression_m6", "migration.sql");
const TABLES = ["CharacterResourcePool", "CharacterResourcePoolSource", "CharacterResourcePoolTier"];
const INDEXES = [
  "CharacterResourcePool_characterId_poolKey_key", "CharacterResourcePool_characterId_idx",
  "CharacterResourcePool_kind_idx", "CharacterResourcePool_backfillStatus_idx",
  "CharacterResourcePoolSource_poolId_sourceKey_key", "CharacterResourcePoolSource_characterClassId_idx",
  "CharacterResourcePoolTier_poolId_tierKey_key", "CharacterResourcePoolTier_poolId_sortOrder_idx",
];

function argumentsFor(argv) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) throw new Error("Use either --apply or --dry-run, not both");
  const index = argv.indexOf("--database");
  const assignment = argv.find((value) => value.startsWith("--database="));
  const databasePath = index >= 0 ? path.resolve(argv[index + 1] ?? "")
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
  for (const table of ["Character", "ClassRule", "CharacterClass", "CharacterProgression", "CharacterLevelHistory"]) {
    if (!tables.has(table)) throw new Error(`M6 requires complete M4 schema: missing ${table}`);
  }
}
function verifySchema(db, { allowAbsent = false } = {}) {
  const tables = names(db, "table"); const indexes = names(db, "index");
  const presentTables = TABLES.filter((name) => tables.has(name));
  const presentIndexes = INDEXES.filter((name) => indexes.has(name));
  if (!presentTables.length && !presentIndexes.length) {
    if (allowAbsent) return false;
    throw new Error("Schema precheck failed: missing M6 schema");
  }
  if (presentTables.length !== TABLES.length) throw new Error("Partial M6 schema refused");
  const missing = INDEXES.filter((name) => !indexes.has(name));
  if (missing.length) throw new Error(`Partial M6 schema refused: missing ${missing.join(", ")}`);
  return true;
}

function parseData(row, issues) {
  try {
    const parsed = JSON.parse(row.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  issues.push({ code: "CHARACTER_DATA_INVALID" });
  return {};
}
function legacyTiers(spellSlots, issues) {
  if (!spellSlots || typeof spellSlots !== "object" || Array.isArray(spellSlots)) {
    issues.push({ code: "LEGACY_SPELL_SLOTS_INVALID" });
    return new Map();
  }
  const tiers = new Map();
  for (const [key, value] of Object.entries(spellSlots)) {
    if (!/^\d+$/.test(key) || !Array.isArray(value)) {
      issues.push({ code: "LEGACY_RESOURCE_TIER_INVALID", tierKey: key });
      continue;
    }
    tiers.set(Number(key), { maximum: value.length, used: value.filter((slot) => slot?.active === true).length, raw: value });
  }
  return tiers;
}
function poolRecord({ characterId, poolKey, kind, label, resetPolicy, status, issues, metadata, ruleSnapshot, legacySnapshot, tiers, sources }) {
  const id = `character-resource:${characterId}:${poolKey}`;
  return { id, characterId, poolKey, kind, label, resetPolicy, status, issues, metadata, ruleSnapshot, legacySnapshot,
    tiers: tiers.map((tier, index) => ({ id: `${id}:tier:${tier.tierKey}`, poolId: id, sortOrder: index, ...tier })),
    sources: sources.map((source) => ({ id: `${id}:source:${source.sourceKey}`, poolId: id, ...source })) };
}

function analyze(db) {
  const characters = db.prepare('SELECT id, slug, data FROM "Character" ORDER BY slug, id').all();
  const classes = db.prepare(`
    SELECT cc.id, cc.characterId, cc.classKey, cc.level, cc.subclassRuleId,
      sr.subclassKey, cr.casterKind, cr.ruleSnapshot
    FROM "CharacterClass" cc JOIN "ClassRule" cr ON cr.id = cc.classRuleId
    LEFT JOIN "SubclassRule" sr ON sr.id = cc.subclassRuleId
    ORDER BY cc.characterId, cc.sortOrder, cc.id
  `).all();
  const classesByCharacter = Map.groupBy(classes, (row) => row.characterId);
  return characters.map((row) => {
    const issues = [];
    const data = parseData(row, issues);
    const legacy = legacyTiers(data.combatStats?.spellSlots ?? {}, issues);
    const classRows = classesByCharacter.get(row.id) ?? [];
    const entries = classRows.map((entry) => ({ classKey: entry.classKey, level: Number(entry.level), subclassKey: entry.subclassKey ?? undefined }));
    let summary;
    try { summary = resolveProgressionSummary(entries); }
    catch (error) { issues.push({ code: "RESOURCE_RULES_UNRESOLVED", message: String(error?.message ?? error) }); }
    if (summary?.unresolvedClassKeys?.length) issues.push({ code: "RESOURCE_RULES_UNRESOLVED", classKeys: summary.unresolvedClassKeys });
    const pools = [];
    const claimed = new Set();

    const fighter = classRows.find((entry) => entry.classKey === "fighter");
    const fighterLegacy = fighter ? legacy.get(8) : null;
    if (fighterLegacy?.maximum > 0) {
      claimed.add(8);
      pools.push(poolRecord({ characterId: row.id, poolKey: "legacy:fighter:manoeuvres", kind: "CLASS_RESOURCE",
        label: "Manovre", resetPolicy: "SHORT_REST", status: "LEGACY_MANUAL",
        issues: [{ code: "LEGACY_FIGHTER_MANOEUVRES" }], metadata: { dieSize: 8 },
        ruleSnapshot: {}, legacySnapshot: { spellSlotTier: 8, slots: fighterLegacy.raw },
        tiers: [{ tierKey: "0", derivedMaximum: null, maximumOverride: fighterLegacy.maximum, used: fighterLegacy.used }],
        sources: [{ characterClassId: fighter.id, sourceKey: fighter.classKey, sourceKind: "LEGACY", ruleSnapshot: JSON.parse(fighter.ruleSnapshot || "{}") }],
      }));
    }

    const spell = summary?.spellcastingSlots;
    if (spell && spell.progressionLevel > 0) {
      const poolIssues = [];
      const tiers = [];
      for (let level = 1; level <= 9; level += 1) {
        const expected = Number(spell.slots[level] ?? 0);
        const actual = legacy.get(level) ?? { maximum: 0, used: 0, raw: [] };
        if (expected === 0 && actual.maximum === 0) continue;
        claimed.add(level);
        const mismatch = actual.maximum !== expected;
        if (mismatch) poolIssues.push({ code: "LEGACY_RESOURCE_MAX_DIVERGENCE", tierKey: String(level), expected, actual: actual.maximum });
        tiers.push({ tierKey: String(level), derivedMaximum: expected, maximumOverride: mismatch ? actual.maximum : null, used: actual.used });
      }
      pools.push(poolRecord({ characterId: row.id, poolKey: "spellcasting", kind: "SPELLCASTING", label: "Spellcasting",
        resetPolicy: "LONG_REST", status: poolIssues.length ? "LEGACY_MANUAL" : "BACKFILLED", issues: poolIssues,
        metadata: { progressionLevel: spell.progressionLevel, mode: spell.mode }, ruleSnapshot: spell,
        legacySnapshot: Object.fromEntries([...legacy].filter(([level]) => claimed.has(level))), tiers,
        sources: classRows.filter((entry) => spell.activeSourceClassKeys.includes(entry.classKey)).map((entry) => ({
          characterClassId: entry.id, sourceKey: entry.classKey, sourceKind: "CLASS", ruleSnapshot: JSON.parse(entry.ruleSnapshot || "{}"),
        })),
      }));
    }

    const pact = summary?.pactMagicSlots;
    if (pact?.slotCount > 0 && pact.slotLevel) {
      const actual = legacy.get(pact.slotLevel) ?? { maximum: 0, used: 0, raw: [] };
      const collision = claimed.has(pact.slotLevel);
      const poolIssues = [];
      if (collision) poolIssues.push({ code: "LEGACY_SHARED_AND_PACT_STATE_AMBIGUOUS", tierKey: String(pact.slotLevel) });
      else claimed.add(pact.slotLevel);
      if (actual.maximum !== pact.slotCount) poolIssues.push({ code: "LEGACY_RESOURCE_MAX_DIVERGENCE", expected: pact.slotCount, actual: actual.maximum });
      const pactRows = classRows.filter((entry) => entry.casterKind === "PACT");
      pools.push(poolRecord({ characterId: row.id, poolKey: "pact-magic", kind: "PACT_MAGIC", label: "Pact Magic",
        resetPolicy: "SHORT_REST", status: poolIssues.length ? "LEGACY_MANUAL" : "BACKFILLED", issues: poolIssues,
        metadata: { pactMagicLevel: pact.pactMagicLevel, slotLevel: pact.slotLevel }, ruleSnapshot: pact,
        legacySnapshot: { [pact.slotLevel]: actual.raw },
        tiers: [{ tierKey: String(pact.slotLevel), derivedMaximum: pact.slotCount,
          maximumOverride: actual.maximum !== pact.slotCount ? actual.maximum : null, used: collision ? 0 : actual.used }],
        sources: pactRows.map((entry) => ({ characterClassId: entry.id, sourceKey: entry.classKey,
          sourceKind: "CLASS", ruleSnapshot: JSON.parse(entry.ruleSnapshot || "{}") })),
      }));
    }

    const unclaimed = [...legacy.entries()].filter(([level, value]) => value.maximum > 0 && !claimed.has(level));
    if (unclaimed.length) {
      pools.push(poolRecord({ characterId: row.id, poolKey: "legacy:manual", kind: "MANUAL", label: "Risorse legacy",
        resetPolicy: "MANUAL", status: "LEGACY_MANUAL", issues: [{ code: "LEGACY_RESOURCE_UNCLASSIFIED" }], metadata: {}, ruleSnapshot: {},
        legacySnapshot: Object.fromEntries(unclaimed),
        tiers: unclaimed.map(([level, value]) => ({ tierKey: String(level), derivedMaximum: null, maximumOverride: value.maximum, used: value.used })),
        sources: classRows.map((entry) => ({ characterClassId: entry.id, sourceKey: entry.classKey, sourceKind: "LEGACY", ruleSnapshot: JSON.parse(entry.ruleSnapshot || "{}") })),
      }));
    }
    const unresolved = issues.some((issue) => ["CHARACTER_DATA_INVALID", "LEGACY_SPELL_SLOTS_INVALID", "RESOURCE_RULES_UNRESOLVED"].includes(issue.code))
      || pools.some((pool) => pool.issues.some((issue) => issue.code === "LEGACY_SHARED_AND_PACT_STATE_AMBIGUOUS"));
    return { characterId: row.id, slug: row.slug, status: unresolved ? "UNRESOLVED" : pools.some((pool) => pool.status === "LEGACY_MANUAL") ? "LEGACY_MANUAL" : "BACKFILLED", issues, pools };
  });
}

function insertBackfill(db, analyses, now) {
  let pools = 0; let sources = 0; let tiers = 0;
  const insertPool = db.prepare(`INSERT OR IGNORE INTO "CharacterResourcePool"
    (id, characterId, poolKey, kind, label, resetPolicy, revision, backfillStatus, backfillIssues,
     metadata, ruleSnapshot, legacySnapshot, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`);
  const insertSource = db.prepare(`INSERT OR IGNORE INTO "CharacterResourcePoolSource"
    (id, poolId, characterClassId, sourceKey, sourceKind, ruleSnapshot, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertTier = db.prepare(`INSERT OR IGNORE INTO "CharacterResourcePoolTier"
    (id, poolId, tierKey, sortOrder, derivedMaximum, maximumOverride, used, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const analysis of analyses) for (const pool of analysis.pools) {
    pools += Number(insertPool.run(pool.id, pool.characterId, pool.poolKey, pool.kind, pool.label, pool.resetPolicy,
      pool.status, JSON.stringify(pool.issues), JSON.stringify(pool.metadata), JSON.stringify(pool.ruleSnapshot),
      JSON.stringify(pool.legacySnapshot), now, now).changes);
    for (const source of pool.sources) sources += Number(insertSource.run(source.id, source.poolId, source.characterClassId,
      source.sourceKey, source.sourceKind, JSON.stringify(source.ruleSnapshot), now, now).changes);
    for (const tier of pool.tiers) tiers += Number(insertTier.run(tier.id, tier.poolId, tier.tierKey, tier.sortOrder,
      tier.derivedMaximum, tier.maximumOverride, tier.used, now, now).changes);
  }
  return { pools, sources, tiers };
}
function integrity(db) { return db.prepare("PRAGMA integrity_check").all().map((row) => String(Object.values(row)[0])); }
function foreignKeys(db) { return db.prepare("PRAGMA foreign_key_check").all().map((row) => JSON.stringify(row)).sort(); }

function run() {
  const { apply, databasePath } = argumentsFor(process.argv.slice(2));
  if (!existsSync(databasePath)) throw new Error(`SQLite database does not exist: ${databasePath}`);
  const db = new DatabaseSync(databasePath, { readOnly: !apply }); let transaction = false;
  try {
    db.exec("PRAGMA busy_timeout = 30000; PRAGMA foreign_keys = ON;"); verifyPrerequisites(db);
    if (integrity(db).join() !== "ok") throw new Error("Pre-apply integrity_check failed");
    if (apply) { db.exec("BEGIN IMMEDIATE;"); transaction = true; }
    const fkBefore = new Set(foreignKeys(db)); const schemaBefore = verifySchema(db, { allowAbsent: true });
    const analyses = analyze(db); let inserted = { pools: 0, sources: 0, tiers: 0 };
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
      characters: { total: analyses.length, backfilled: analyses.filter((item) => item.status === "BACKFILLED").length,
        legacyManual: analyses.filter((item) => item.status === "LEGACY_MANUAL").length, unresolved }, inserted,
      report: analyses.map(({ characterId, slug, status, issues, pools }) => ({ characterId, slug, status, issues,
        pools: pools.map((pool) => ({ poolKey: pool.poolKey, kind: pool.kind, status: pool.status, issues: pool.issues, tiers: pool.tiers })) })),
      preservedForeignKeyViolations: fkBefore.size }, null, 2));
    if (unresolved) process.exitCode = 2;
  } catch (error) { if (transaction) try { db.exec("ROLLBACK;"); } catch {} throw error; }
  finally { db.close(); }
}
try { run(); } catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) })); process.exitCode = 1; }
