import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DB_PATH = path.resolve(ROOT_DIR, "prisma", "migration.db");

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA foreign_keys = ON;");

const LEGACY_RESET_MAP = {
  volonta: "AT_WILL",
  incontro: "ENCOUNTER",
  riposoBreve: "SHORT_REST",
  riposoLungo: "LONG_REST",
};

function parseJsonString(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferConsumableCategory(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (/(frecce|quadrell|dardi|munizioni|ammunition)/i.test(normalized)) {
    return "AMMUNITION";
  }
  return "CONSUMABLE";
}

function buildSingleSlotChoice(groupKey, selectionMode, slots) {
  return slots.map((slot, index) => ({
    groupKey,
    selectionMode,
    slot,
    required: true,
    sortOrder: index,
  }));
}

function buildRequiredSlots(groupKey, slots) {
  return slots.map((slot, index) => ({
    groupKey,
    selectionMode: "ALL_REQUIRED",
    slot,
    required: true,
    sortOrder: index,
  }));
}

function inferObjectProfile(item) {
  const name = String(item?.name ?? "").trim();
  const description = String(item?.description ?? "").trim();
  const lower = `${name} ${description}`.toLowerCase();

  if (/anello|ring/.test(lower)) {
    return {
      category: "RING",
      equippable: true,
      slotRules: buildSingleSlotChoice("wear", "ANY_ONE", ["RING_1", "RING_2", "RING_3", "RING_4", "RING_5", "RING_6", "RING_7", "RING_8", "RING_9", "RING_10"]),
    };
  }

  if (/collana|ciondolo|amulet|pendaglio/.test(lower)) {
    return {
      category: "AMULET",
      equippable: true,
      slotRules: buildRequiredSlots("wear", ["NECK"]),
    };
  }

  if (/guanto|glove/.test(lower)) {
    const isPair = /guanti|paio|coppia/.test(lower);
    return {
      category: "WONDROUS_ITEM",
      equippable: true,
      slotRules: isPair
        ? buildRequiredSlots("wear", ["GLOVE_LEFT", "GLOVE_RIGHT"])
        : buildSingleSlotChoice("wear", "ANY_ONE", ["GLOVE_LEFT", "GLOVE_RIGHT"]),
    };
  }

  if (/scarpe|stivali|boots|shoe/.test(lower)) {
    return {
      category: "WONDROUS_ITEM",
      equippable: true,
      slotRules: buildRequiredSlots("wear", ["FEET"]),
    };
  }

  if (/scudo|shield/.test(lower) || /ca:\s*\+\d+/.test(lower)) {
    return {
      category: "SHIELD",
      equippable: true,
      slotRules: buildSingleSlotChoice("wear", "ANY_ONE", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]),
    };
  }

  if (/ca:\s*(\d+)/i.test(description)) {
    return {
      category: "ARMOR",
      equippable: true,
      slotRules: buildRequiredSlots("wear", ["ARMOR"]),
    };
  }

  return {
    category: item?.equippable ? "WONDROUS_ITEM" : "GEAR",
    equippable: !!item?.equippable,
    slotRules: [],
  };
}

function buildFeatureSeed({ name, resetOn, condition }) {
  const normalizedName = String(name ?? "").trim();
  if (!normalizedName) return null;
  return {
    name: normalizedName,
    description: null,
    resetOn,
    customResetLabel: null,
    maxUses: resetOn && resetOn !== "AT_WILL" ? 1 : null,
    condition,
  };
}

function collectLegacyFeatures(entry, defaultCondition) {
  const byType = entry?.skillsByType;
  if (!byType || typeof byType !== "object") return [];

  const features = [];
  for (const [legacyReset, mappedReset] of Object.entries(LEGACY_RESET_MAP)) {
    const rows = Array.isArray(byType?.[legacyReset]) ? byType[legacyReset] : [];
    for (const row of rows) {
      const feature = buildFeatureSeed({
        name: row?.name,
        resetOn: mappedReset,
        condition: defaultCondition,
      });
      if (feature) features.push(feature);
    }
  }

  return features;
}

function runInTransaction(work) {
  sqlite.exec("BEGIN");
  try {
    const result = work();
    sqlite.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {}
    throw error;
  }
}

const itemDefinitions = sqlite
  .prepare('SELECT id, name, category, equippable FROM "ItemDefinition" ORDER BY name COLLATE NOCASE')
  .all();

const definitionsByName = new Map();
const definitionsByCategoryAndName = new Map();
for (const row of itemDefinitions) {
  const normalizedName = normalizeName(row.name);
  const byName = definitionsByName.get(normalizedName) ?? [];
  byName.push(row);
  definitionsByName.set(normalizedName, byName);
  definitionsByCategoryAndName.set(`${row.category}|${normalizedName}`, row);
}

function findDefinitionForAttack(attack) {
  const normalizedName = normalizeName(attack?.name ?? "");
  if (!normalizedName) return null;
  return definitionsByCategoryAndName.get(`WEAPON|${normalizedName}`) ?? null;
}

function findDefinitionForItem(item) {
  const normalizedName = normalizeName(item?.name ?? "");
  if (!normalizedName) return null;

  const inferredCategory =
    item?.type === "consumable" ? inferConsumableCategory(item?.name) : inferObjectProfile(item).category;

  const strictMatch = definitionsByCategoryAndName.get(`${inferredCategory}|${normalizedName}`);
  if (strictMatch) return strictMatch;

  const candidates = definitionsByName.get(normalizedName) ?? [];
  if (candidates.length === 1) return candidates[0];

  const equippableCandidate =
    item?.equippable == null
      ? null
      : candidates.find((candidate) => Boolean(candidate.equippable) === Boolean(item.equippable)) ?? null;

  return equippableCandidate ?? candidates[0] ?? null;
}

const existingFeatures = sqlite
  .prepare('SELECT id, itemDefinitionId, name, resetOn, sortOrder FROM "ItemFeature"')
  .all();

const existingFeatureKeysByDefinitionId = new Map();
const existingMaxSortOrderByDefinitionId = new Map();
for (const feature of existingFeatures) {
  const featureKey = `${normalizeName(feature.name)}|${String(feature.resetOn ?? "")}`;
  const bucket = existingFeatureKeysByDefinitionId.get(feature.itemDefinitionId) ?? new Set();
  bucket.add(featureKey);
  existingFeatureKeysByDefinitionId.set(feature.itemDefinitionId, bucket);
  const currentMax = existingMaxSortOrderByDefinitionId.get(feature.itemDefinitionId) ?? -1;
  existingMaxSortOrderByDefinitionId.set(feature.itemDefinitionId, Math.max(currentMax, Number(feature.sortOrder ?? -1)));
}

const characterRows = sqlite
  .prepare('SELECT id, slug, data FROM "Character" WHERE archivedAt IS NULL ORDER BY slug COLLATE NOCASE')
  .all();

const pendingFeaturesByDefinitionId = new Map();
const unmatchedSources = [];

for (const row of characterRows) {
  const data = parseJsonString(row.data, {});
  const equipment = data?.equipment ?? {};

  for (const attack of Array.isArray(equipment.attacks) ? equipment.attacks : []) {
    const features = collectLegacyFeatures(attack, "WHILE_EQUIPPED");
    if (features.length === 0) continue;

    const definition = findDefinitionForAttack(attack);
    if (!definition) {
      unmatchedSources.push(`attack:${String(attack?.name ?? "").trim()} @ ${row.slug}`);
      continue;
    }

    const bucket = pendingFeaturesByDefinitionId.get(definition.id) ?? [];
    bucket.push(...features);
    pendingFeaturesByDefinitionId.set(definition.id, bucket);
  }

  for (const item of Array.isArray(equipment.items) ? equipment.items : []) {
    const defaultCondition = item?.equippable ? "WHILE_EQUIPPED" : "ALWAYS";
    const features = collectLegacyFeatures(item, defaultCondition);
    if (features.length === 0) continue;

    const definition = findDefinitionForItem(item);
    if (!definition) {
      unmatchedSources.push(`item:${String(item?.name ?? "").trim()} @ ${row.slug}`);
      continue;
    }

    const bucket = pendingFeaturesByDefinitionId.get(definition.id) ?? [];
    bucket.push(...features);
    pendingFeaturesByDefinitionId.set(definition.id, bucket);
  }
}

const insertFeature = sqlite.prepare(`
  INSERT INTO "ItemFeature" (
    id, itemDefinitionId, name, description, resetOn, customResetLabel, maxUses, condition, sortOrder, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRows = [];
for (const [definitionId, rawFeatures] of pendingFeaturesByDefinitionId.entries()) {
  const seenKeys = new Set(existingFeatureKeysByDefinitionId.get(definitionId) ?? []);
  const dedupedFeatures = [];

  for (const feature of rawFeatures) {
    const featureKey = `${normalizeName(feature.name)}|${String(feature.resetOn ?? "")}`;
    if (seenKeys.has(featureKey)) continue;
    seenKeys.add(featureKey);
    dedupedFeatures.push(feature);
  }

  dedupedFeatures.forEach((feature, index) => {
    const baseSortOrder = existingMaxSortOrderByDefinitionId.get(definitionId) ?? -1;
    insertRows.push({
      id: crypto.randomUUID(),
      itemDefinitionId: definitionId,
      ...feature,
      sortOrder: baseSortOrder + index + 1,
    });
  });
}

runInTransaction(() => {
  const now = new Date().toISOString();
  for (const row of insertRows) {
    insertFeature.run(
      row.id,
      row.itemDefinitionId,
      row.name,
      row.description,
      row.resetOn,
      row.customResetLabel,
      row.maxUses,
      row.condition,
      row.sortOrder,
      now,
      now
    );
  }
});

console.log(`backfill-item-features: inserted ${insertRows.length} item features in ${DB_PATH}`);
if (unmatchedSources.length > 0) {
  console.log(`backfill-item-features: unmatched legacy entries (${unmatchedSources.length})`);
  unmatchedSources.slice(0, 20).forEach((entry) => console.log(` - ${entry}`));
}
