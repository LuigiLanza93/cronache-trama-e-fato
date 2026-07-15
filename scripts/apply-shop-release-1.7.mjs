import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const SHOP_TABLES = [
  "Shop", "ShopItem", "ShopItemFeatureState", "ShopCharacterProfile",
  "ShopItemKnowledge", "ShopVisit", "ShopNegotiation", "ShopOffer",
];

const EXPECTED_COLUMNS = {
  Shop: ["id", "externalKey", "name", "description", "ownerName", "ownerDescription", "city", "discountDc", "cp", "sp", "ep", "gp", "archivedAt", "createdAt", "updatedAt", "dmNotes"],
  ShopItem: ["id", "shopId", "itemDefinitionId", "nameOverride", "descriptionOverride", "quantity", "priceCurrency", "priceAmount", "isSecret", "discoveryDc", "sortOrder", "dmNotes", "instanceNotes", "data", "createdAt", "updatedAt"],
  ShopItemFeatureState: ["id", "shopItemId", "itemFeatureId", "usesSpent", "lastResetAt", "updatedAt"],
  ShopCharacterProfile: ["id", "shopId", "characterId", "visitCount", "dmNotes", "usualDiscountPercent", "lastVisitedAt", "createdAt", "updatedAt"],
  ShopItemKnowledge: ["id", "shopId", "shopItemId", "characterId", "revealedByUserId", "revealNote", "revealedAt"],
  ShopVisit: ["id", "shopId", "characterId", "status", "discountPercent", "openedByUserId", "closedByUserId", "closeReason", "dmNotes", "openedAt", "closedAt", "updatedAt"],
  ShopNegotiation: ["id", "visitId", "characterId", "direction", "shopItemId", "characterItemId", "quantity", "status", "itemNameSnapshot", "itemDetailsSnapshot", "createdAt", "resolvedAt", "updatedAt"],
  ShopOffer: ["id", "negotiationId", "sequence", "proposedByUserId", "sellerSide", "currency", "amount", "createdAt", "proposerSide"],
  InventoryTransaction: ["fromShopId", "toShopId", "operationId", "shopNegotiationId", "reversalOfTransactionId", "reversedAt"],
  CurrencyTransaction: ["fromShopId", "toShopId", "shopNegotiationId"],
  ItemDefinition: ["valueCurrency", "valueAmount"],
};

const EXPECTED_INDEXES = {
  Shop: { Shop_externalKey_key: 1, Shop_city_idx: 0, Shop_name_idx: 0, Shop_archivedAt_idx: 0 },
  ShopItem: { ShopItem_shopId_sortOrder_idx: 0, ShopItem_itemDefinitionId_idx: 0, ShopItem_isSecret_idx: 0 },
  ShopItemFeatureState: { ShopItemFeatureState_shopItemId_itemFeatureId_key: 1, ShopItemFeatureState_shopItemId_idx: 0, ShopItemFeatureState_itemFeatureId_idx: 0 },
  ShopCharacterProfile: { ShopCharacterProfile_shopId_characterId_key: 1, ShopCharacterProfile_characterId_idx: 0 },
  ShopItemKnowledge: { ShopItemKnowledge_shopItemId_characterId_key: 1, ShopItemKnowledge_shopId_characterId_idx: 0, ShopItemKnowledge_revealedByUserId_idx: 0 },
  ShopVisit: { ShopVisit_shopId_openedAt_idx: 0, ShopVisit_characterId_openedAt_idx: 0, ShopVisit_status_idx: 0, ShopVisit_openedByUserId_idx: 0, ShopVisit_closedByUserId_idx: 0, ShopVisit_single_active_key: 1 },
  ShopNegotiation: { ShopNegotiation_visitId_status_idx: 0, ShopNegotiation_characterId_idx: 0, ShopNegotiation_shopItemId_idx: 0, ShopNegotiation_characterItemId_idx: 0 },
  ShopOffer: { ShopOffer_negotiationId_sequence_key: 1, ShopOffer_proposedByUserId_idx: 0 },
  InventoryTransaction: { InventoryTransaction_fromShopId_idx: 0, InventoryTransaction_toShopId_idx: 0, InventoryTransaction_operationId_idx: 0, InventoryTransaction_shopNegotiationId_idx: 0, InventoryTransaction_reversalOfTransactionId_key: 1, InventoryTransaction_reversedAt_idx: 0 },
  CurrencyTransaction: { CurrencyTransaction_fromShopId_idx: 0, CurrencyTransaction_toShopId_idx: 0, CurrencyTransaction_shopNegotiationId_idx: 0 },
};

const EXPECTED_UNIQUE_INDEX_COLUMNS = {
  Shop_externalKey_key: ["externalKey"],
  ShopItemFeatureState_shopItemId_itemFeatureId_key: ["shopItemId", "itemFeatureId"],
  ShopCharacterProfile_shopId_characterId_key: ["shopId", "characterId"],
  ShopItemKnowledge_shopItemId_characterId_key: ["shopItemId", "characterId"],
  ShopOffer_negotiationId_sequence_key: ["negotiationId", "sequence"],
  InventoryTransaction_reversalOfTransactionId_key: ["reversalOfTransactionId"],
};

const REQUIRED_LEGACY = {
  User: ["id", "role"], Character: ["id"], CharacterItem: ["id"],
  ItemDefinition: ["id", "valueCp"], ItemFeature: ["id"],
  InventoryTransaction: ["id"], CurrencyTransaction: ["id"],
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const migrationFiles = [
  ["20260708", "20260708_shop_system_phase_1"],
  ["20260710", "20260710_shop_dm_notes"],
  ["20260712", "20260712_shop_offer_proposer_side"],
  ["20260713-item-value", "20260713_item_definition_mono_value"],
  ["20260713-reversal", "20260713_shop_trade_reversal"],
  ["20260715-fix", "20260715_fix_shop_offer_proposer_side"],
];
const migrations = Object.fromEntries(migrationFiles.map(([key, directory]) => [
  key,
  readFileSync(path.join(repoRoot, "prisma", "migrations", directory, "migration.sql"), "utf8"),
]));

function databasePathFromEnvironment() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) throw new Error("DATABASE_URL must target a file SQLite database");
  const withoutQuery = databaseUrl.slice(5).split("?", 1)[0];
  if (!withoutQuery) throw new Error("DATABASE_URL has an empty SQLite path");
  let decoded = decodeURIComponent(withoutQuery);
  if (process.platform === "win32" && /^\/[A-Za-z]:[\\/]/.test(decoded)) decoded = decoded.slice(1);
  const resolved = path.resolve(decoded);
  const production = process.env.NODE_ENV === "production";
  if (production && resolved !== "/data/migration.db") {
    throw new Error(`production migration target refused: ${resolved}`);
  }
  if (!production && !process.argv.includes("--allow-local")) {
    throw new Error("local execution requires the explicit --allow-local flag");
  }
  return resolved;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function tableNames(db) {
  return new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name));
}

function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all().map((row) => row.name));
}

function indexMap(db, table) {
  return new Map(db.prepare(`PRAGMA index_list(${quoteIdentifier(table)})`).all().map((row) => [row.name, Number(row.unique)]));
}

function requireColumns(db, table, expected) {
  const actual = columnNames(db, table);
  const missing = expected.filter((column) => !actual.has(column));
  if (missing.length) throw new Error(`schema precheck failed: ${table} missing columns ${missing.join(",")}`);
}

function requireIndexes(db, table, expected) {
  const actual = indexMap(db, table);
  for (const [name, unique] of Object.entries(expected)) {
    if (!actual.has(name)) throw new Error(`schema precheck failed: ${table} missing index ${name}`);
    if (actual.get(name) !== unique) throw new Error(`schema precheck failed: ${name} uniqueness mismatch`);
  }
}

function requireCriticalIndexDefinitions(db) {
  for (const [name, expectedColumns] of Object.entries(EXPECTED_UNIQUE_INDEX_COLUMNS)) {
    const actualColumns = db.prepare(`PRAGMA index_info(${quoteIdentifier(name)})`).all().map((row) => row.name);
    if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
      throw new Error(`schema precheck failed: ${name} column definition mismatch`);
    }
  }

  const activeVisitIndex = db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'index' AND name = 'ShopVisit_single_active_key'").get();
  const normalizedSql = String(activeVisitIndex?.sql ?? "").replaceAll('"', "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!/^create unique index shopvisit_single_active_key on shopvisit\s*\(\s*\(\s*1\s*\)\s*\)\s*where status\s*=\s*'active'$/.test(normalizedSql)) {
    throw new Error("schema precheck failed: ShopVisit_single_active_key definition or ACTIVE predicate mismatch");
  }
}

function verifyFinalSchema(db) {
  for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) requireColumns(db, table, expected);
  for (const [table, expected] of Object.entries(EXPECTED_INDEXES)) requireIndexes(db, table, expected);
  requireCriticalIndexDefinitions(db);
}

function integrityCheck(db) {
  return db.prepare("PRAGMA integrity_check").all().map((row) => String(Object.values(row)[0]));
}

function foreignKeyRows(db) {
  return db.prepare("PRAGMA foreign_key_check").all()
    .map((row) => [row.table, row.rowid ?? null, row.parent, row.fkid])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function legacyCounts(db) {
  const excluded = new Set([...SHOP_TABLES, "_prisma_migrations"]);
  const result = {};
  for (const table of [...tableNames(db)].sort()) {
    if (table.startsWith("sqlite_") || excluded.has(table)) continue;
    result[table] = Number(db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count);
  }
  return result;
}

function statements(sql) {
  return sql.replace(/^\s*--.*$/gm, "").split(";").map((statement) => statement.trim()).filter(Boolean);
}

function statementStartingWith(sql, prefix) {
  const statement = statements(sql).find((candidate) => candidate.toUpperCase().startsWith(prefix.toUpperCase()));
  if (!statement) throw new Error(`expected SQL statement not found: ${prefix}`);
  return `${statement};`;
}

function itemValueBackfillSql() {
  const original = statementStartingWith(migrations["20260713-item-value"], "UPDATE");
  const guarded = original.replace(
    'WHERE "valueCp" IS NOT NULL;',
    'WHERE "valueCp" IS NOT NULL AND ("valueCurrency" IS NULL OR "valueAmount" IS NULL);',
  );
  if (guarded === original) throw new Error("item-value migration has an unexpected UPDATE shape");
  return guarded;
}

function ensureAllAbsent(db, table, names, label) {
  const actual = columnNames(db, table);
  const present = names.filter((name) => actual.has(name));
  if (present.length) throw new Error(`partial release schema before ${label}: ${table}.${present.join(",")}`);
}

function applyFreshRelease(db) {
  ensureAllAbsent(db, "InventoryTransaction", ["fromShopId", "toShopId", "operationId", "shopNegotiationId"], "20260708");
  ensureAllAbsent(db, "CurrencyTransaction", ["fromShopId", "toShopId", "shopNegotiationId"], "20260708");
  db.exec(migrations["20260708"]);

  if (columnNames(db, "Shop").has("dmNotes")) throw new Error("partial release schema before 20260710");
  db.exec(migrations["20260710"]);

  if (columnNames(db, "ShopOffer").has("proposerSide")) throw new Error("partial release schema before 20260712");
  db.exec(migrations["20260712"]);

  const itemValueColumns = ["valueCurrency", "valueAmount"];
  const itemValuePresent = itemValueColumns.filter((name) => columnNames(db, "ItemDefinition").has(name));
  if (itemValuePresent.length === 0) db.exec(migrations["20260713-item-value"]);
  else if (itemValuePresent.length === itemValueColumns.length) db.exec(itemValueBackfillSql());
  else throw new Error("partial item-value schema before 20260713");

  const reversalColumns = ["reversalOfTransactionId", "reversedAt"];
  const reversalPresent = reversalColumns.filter((name) => columnNames(db, "InventoryTransaction").has(name));
  if (reversalPresent.length === 0) db.exec(migrations["20260713-reversal"]);
  else if (reversalPresent.length === reversalColumns.length) {
    for (const statement of statements(migrations["20260713-reversal"]).filter((sql) => sql.toUpperCase().startsWith("CREATE "))) db.exec(`${statement};`);
  } else throw new Error("partial reversal schema before 20260713");

  db.exec(migrations["20260715-fix"]);
}

const dbPath = databasePathFromEnvironment();
if (!existsSync(dbPath)) throw new Error(`SQLite database does not exist: ${dbPath}`);
const summary = {
  ok: false,
  target: process.env.NODE_ENV === "production" ? "/data/migration.db" : "explicit-local-copy",
  mode: null,
  migrations: migrationFiles.map(([key]) => key),
  integrityBefore: null,
  integrityAfter: null,
  foreignKeysBefore: 0,
  foreignKeysAfter: 0,
  legacyTablesChecked: 0,
  badProposerSide: null,
  badItemValue: null,
  shopCounts: {},
};

let db;
let transactionOpen = false;
try {
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 30000; PRAGMA foreign_keys = ON;");

  summary.integrityBefore = integrityCheck(db);
  if (summary.integrityBefore.length !== 1 || summary.integrityBefore[0] !== "ok") throw new Error("pre-migration integrity_check failed");
  const foreignKeysBefore = foreignKeyRows(db);
  const foreignKeySetBefore = new Set(foreignKeysBefore.map((row) => JSON.stringify(row)));
  summary.foreignKeysBefore = foreignKeysBefore.length;

  const knownTables = tableNames(db);
  for (const [table, columns] of Object.entries(REQUIRED_LEGACY)) {
    if (!knownTables.has(table)) throw new Error(`missing legacy table ${table}`);
    requireColumns(db, table, columns);
  }
  const presentShopTables = SHOP_TABLES.filter((table) => knownTables.has(table));
  if (presentShopTables.length !== 0 && presentShopTables.length !== SHOP_TABLES.length) {
    throw new Error(`partial shop schema refused: ${presentShopTables.length}/${SHOP_TABLES.length} tables`);
  }
  if (presentShopTables.length === SHOP_TABLES.length) {
    verifyFinalSchema(db);
    summary.mode = "already-complete-read-only";
  } else {
    summary.mode = "fresh-shop-schema";
  }

  if (summary.mode === "already-complete-read-only") {
    summary.badProposerSide = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM "ShopOffer"
      WHERE proposerSide IS NULL
         OR proposerSide NOT IN ('SHOP', 'CHARACTER')
    `).get().count);
    summary.badItemValue = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM "ItemDefinition"
      WHERE "valueCp" IS NOT NULL
        AND ("valueCurrency" IS NULL OR "valueAmount" IS NULL OR "valueAmount" <= 0)
    `).get().count);
    if (summary.badProposerSide || summary.badItemValue) {
      throw new Error(`complete-schema invariant failed: proposer=${summary.badProposerSide}, itemValue=${summary.badItemValue}`);
    }
    summary.integrityAfter = summary.integrityBefore;
    summary.foreignKeysAfter = summary.foreignKeysBefore;
    for (const table of SHOP_TABLES) {
      summary.shopCounts[table] = Number(db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count);
    }
    summary.ok = true;
    console.log(JSON.stringify(summary));
  } else {

    const countsBefore = legacyCounts(db);
    summary.legacyTablesChecked = Object.keys(countsBefore).length;

    db.exec("BEGIN IMMEDIATE;");
    transactionOpen = true;
    applyFreshRelease(db);

    verifyFinalSchema(db);
    summary.badProposerSide = Number(db.prepare(`
    SELECT COUNT(*) AS count FROM "ShopOffer" offer
    LEFT JOIN "User" user ON user.id = offer.proposedByUserId
    WHERE offer.proposerSide IS NULL
       OR offer.proposerSide NOT IN ('SHOP', 'CHARACTER')
       OR offer.proposerSide <> CASE WHEN UPPER(COALESCE(user.role, '')) = 'DM' THEN 'SHOP' ELSE 'CHARACTER' END
  `).get().count);
    summary.badItemValue = Number(db.prepare(`
    SELECT COUNT(*) AS count FROM "ItemDefinition"
    WHERE "valueCp" IS NOT NULL
      AND ("valueCurrency" IS NULL OR "valueAmount" IS NULL OR "valueAmount" <= 0)
  `).get().count);
    if (summary.badProposerSide || summary.badItemValue) {
      throw new Error(`backfill verification failed: proposer=${summary.badProposerSide}, itemValue=${summary.badItemValue}`);
    }

    const countsAfter = legacyCounts(db);
    if (JSON.stringify(countsAfter) !== JSON.stringify(countsBefore)) throw new Error("legacy row counts changed");

    summary.integrityAfter = integrityCheck(db);
    if (summary.integrityAfter.length !== 1 || summary.integrityAfter[0] !== "ok") throw new Error("post-migration integrity_check failed");
    const foreignKeysAfter = foreignKeyRows(db);
    summary.foreignKeysAfter = foreignKeysAfter.length;
    const newForeignKeys = foreignKeysAfter.filter((row) => !foreignKeySetBefore.has(JSON.stringify(row)));
    if (newForeignKeys.length) throw new Error(`${newForeignKeys.length} new foreign-key violations detected`);

    for (const table of SHOP_TABLES) {
      summary.shopCounts[table] = Number(db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count);
    }

    db.exec("COMMIT;");
    transactionOpen = false;
    summary.ok = true;
    console.log(JSON.stringify(summary));
  }
} catch (error) {
  if (db && transactionOpen) {
    try { db.exec("ROLLBACK;"); } catch { /* preserve the original failure */ }
  }
  summary.error = String(error?.message ?? error);
  console.error(JSON.stringify(summary));
  process.exitCode = 1;
} finally {
  db?.close();
}
