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

function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function parseJsonString(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

function parseLegacyDamage(value) {
  const source = String(value ?? "").trim();
  if (!source) return {};
  const match = source.match(/^\s*([^\s]+)\s+(taglient[ei]|perforante|contundente)\s*$/i);
  if (!match) return { damageDice: source };
  const normalizedType = match[2].toLowerCase().startsWith("taglient") ? "tagliente" : match[2].toLowerCase();
  return { damageDice: match[1], damageType: normalizedType };
}

function normalizeDamageType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("taglient")) return "tagliente";
  if (normalized.startsWith("perfor")) return "perforante";
  if (normalized.startsWith("contund")) return "contundente";
  return normalized;
}

function inferConsumableCategory(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (/(frecce|quadrell|dardi|munizioni|ammunition)/i.test(normalized)) {
    return "AMMUNITION";
  }
  return "CONSUMABLE";
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
      gloveWearMode: isPair ? "PAIR" : "SINGLE",
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
    const bonusMatch = description.match(/CA:\s*\+?(\d+)/i);
    return {
      category: "SHIELD",
      equippable: true,
      armorCategory: "SHIELD",
      armorClassCalculation: "BONUS_ONLY",
      armorClassBonus: bonusMatch ? Number.parseInt(bonusMatch[1], 10) : null,
      slotRules: buildSingleSlotChoice("wear", "ANY_ONE", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]),
    };
  }

  const armorMatch = description.match(/CA:\s*(\d+)/i);
  if (armorMatch) {
    const armorBase = Number.parseInt(armorMatch[1], 10);
    const heavy = /svantaggio|completa|piastre|chain mail|plate/i.test(lower);
    const medium = /mezza|half|petto|scale|scaglie/i.test(lower);
    return {
      category: "ARMOR",
      equippable: true,
      armorCategory: heavy ? "HEAVY" : medium ? "MEDIUM" : "LIGHT",
      armorClassCalculation: heavy ? "BASE_ONLY" : medium ? "BASE_PLUS_DEX_MAX_2" : "BASE_PLUS_DEX",
      armorClassBase: Number.isFinite(armorBase) ? armorBase : null,
      slotRules: buildRequiredSlots("wear", ["ARMOR"]),
    };
  }

  return {
    category: item?.equippable ? "WONDROUS_ITEM" : "GEAR",
    equippable: !!item?.equippable,
    slotRules: [],
  };
}

function buildRequiredSlots(groupKey, slots) {
  return slots.map((slot, index) => ({
    id: crypto.randomUUID(),
    groupKey,
    selectionMode: "ALL_REQUIRED",
    slot,
    required: true,
    sortOrder: index,
  }));
}

function buildSingleSlotChoice(groupKey, selectionMode, slots) {
  return slots.map((slot, index) => ({
    id: crypto.randomUUID(),
    groupKey,
    selectionMode,
    slot,
    required: true,
    sortOrder: index,
  }));
}

function buildWeaponSlotRules(handling) {
  if (handling === "TWO_HANDED") {
    return buildRequiredSlots("two-handed", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]);
  }
  if (handling === "VERSATILE") {
    return [
      ...buildSingleSlotChoice("one-handed", "ANY_ONE", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]),
      ...buildRequiredSlots("two-handed", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]).map((entry, index) => ({
        ...entry,
        sortOrder: index,
      })),
    ];
  }
  return buildSingleSlotChoice("one-handed", "ANY_ONE", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]);
}

function inferWeaponHandling(attack) {
  const hands = String(attack?.hands ?? "").trim().toLowerCase();
  const lowerName = String(attack?.name ?? "").trim().toLowerCase();
  if (hands === "2" || /arco lungo|longbow|heavy crossbow/.test(lowerName)) return "TWO_HANDED";
  if (hands === "versatile") return "VERSATILE";
  return "ONE_HANDED";
}

function makeWeaponDefinition(attack) {
  const legacy = parseLegacyDamage(attack?.damageType);
  const damageDice = String(attack?.damageDice ?? legacy.damageDice ?? "").trim() || null;
  const damageType = normalizeDamageType(attack?.damageDice ? attack?.damageType : legacy.damageType);
  const weaponHandling = inferWeaponHandling(attack);
  const attackKind = String(attack?.category ?? "").trim().toLowerCase() === "ranged" ? "RANGED_WEAPON" : "MELEE_WEAPON";

  return {
    key: `weapon:${sanitizeSlug(attack?.name ?? "weapon")}`,
    name: String(attack?.name ?? "").trim(),
    category: "WEAPON",
    equippable: true,
    stackable: false,
    weaponHandling,
    slotRules: buildWeaponSlotRules(weaponHandling),
    attacks: [
      {
        id: crypto.randomUUID(),
        name: String(attack?.name ?? "").trim() || "Attacco",
        kind: attackKind,
        handRequirement: weaponHandling === "TWO_HANDED" ? "TWO_HANDED" : weaponHandling === "ONE_HANDED" ? "ONE_HANDED" : "ANY",
        ability: null,
        attackBonus: Number.isFinite(Number(attack?.attackBonus)) ? Number(attack.attackBonus) : null,
        damageDice,
        damageType,
        rangeNormal: null,
        rangeLong: extractRangePart(attack?.range, 0),
        twoHandedOnly: weaponHandling === "TWO_HANDED",
        requiresEquipped: true,
        conditionText: null,
        sortOrder: 0,
      },
    ],
  };
}

function extractRangePart(value, partIndex) {
  const source = String(value ?? "").trim();
  if (!source) return null;
  const parts = source.split("/").map((entry) => Number.parseInt(entry.replace(/[^\d-]/g, ""), 10));
  if (!Number.isFinite(parts[partIndex])) return null;
  return parts[partIndex];
}

function dedupePush(map, definition) {
  if (!definition?.name) return;
  const existing = map.get(definition.key);
  if (!existing) {
    map.set(definition.key, definition);
    return;
  }

  if ((!existing.description || existing.description.length < 3) && definition.description) {
    existing.description = definition.description;
  }
  if (!existing.weaponHandling && definition.weaponHandling) existing.weaponHandling = definition.weaponHandling;
  if (!existing.gloveWearMode && definition.gloveWearMode) existing.gloveWearMode = definition.gloveWearMode;
  if (!existing.armorCategory && definition.armorCategory) existing.armorCategory = definition.armorCategory;
  if (!existing.armorClassCalculation && definition.armorClassCalculation) existing.armorClassCalculation = definition.armorClassCalculation;
  if (existing.armorClassBase == null && definition.armorClassBase != null) existing.armorClassBase = definition.armorClassBase;
  if (existing.armorClassBonus == null && definition.armorClassBonus != null) existing.armorClassBonus = definition.armorClassBonus;
  if ((!existing.slotRules || existing.slotRules.length === 0) && definition.slotRules?.length) existing.slotRules = definition.slotRules;

  const existingAttackNames = new Set((existing.attacks ?? []).map((entry) => `${entry.name}|${entry.handRequirement}|${entry.damageDice}`));
  for (const attack of definition.attacks ?? []) {
    const attackKey = `${attack.name}|${attack.handRequirement}|${attack.damageDice}`;
    if (!existingAttackNames.has(attackKey)) {
      existing.attacks.push(attack);
      existingAttackNames.add(attackKey);
    }
  }
}

const characterRows = sqlite
  .prepare('SELECT id, slug, data FROM "Character" WHERE archivedAt IS NULL ORDER BY slug COLLATE NOCASE')
  .all();

const definitions = new Map();

for (const row of characterRows) {
  const data = parseJsonString(row.data, {});
  const equipment = data?.equipment ?? {};

  for (const attack of Array.isArray(equipment.attacks) ? equipment.attacks : []) {
    const normalizedName = String(attack?.name ?? "").trim();
    if (!normalizedName) continue;
    dedupePush(definitions, makeWeaponDefinition(attack));
  }

  for (const item of Array.isArray(equipment.items) ? equipment.items : []) {
    const normalizedName = String(item?.name ?? "").trim();
    if (!normalizedName) continue;

    if (item?.type === "consumable") {
      dedupePush(definitions, {
        key: `${inferConsumableCategory(normalizedName).toLowerCase()}:${sanitizeSlug(normalizedName)}`,
        name: normalizedName,
        category: inferConsumableCategory(normalizedName),
        description: item?.subtype === "potion" && item?.dice ? String(item.dice) : null,
        equippable: false,
        stackable: true,
        slotRules: [],
        attacks: [],
      });
      continue;
    }

    const profile = inferObjectProfile(item);
    dedupePush(definitions, {
      key: `${String(profile.category ?? "other").toLowerCase()}:${sanitizeSlug(normalizedName)}`,
      name: normalizedName,
      category: profile.category ?? "OTHER",
      description: String(item?.description ?? "").trim() || null,
      equippable: !!profile.equippable,
      stackable: false,
      gloveWearMode: profile.gloveWearMode ?? null,
      armorCategory: profile.armorCategory ?? null,
      armorClassCalculation: profile.armorClassCalculation ?? null,
      armorClassBase: profile.armorClassBase ?? null,
      armorClassBonus: profile.armorClassBonus ?? null,
      slotRules: profile.slotRules ?? [],
      attacks: [],
    });
  }

  for (const itemName of Array.isArray(equipment.equipment) ? equipment.equipment : []) {
    const normalizedName = String(itemName ?? "").trim();
    if (!normalizedName) continue;
    dedupePush(definitions, {
      key: `legacy:${sanitizeSlug(normalizedName)}`,
      name: normalizedName,
      category: "GEAR",
      description: null,
      equippable: false,
      stackable: false,
      slotRules: [],
      attacks: [],
    });
  }
}

const definitionRows = Array.from(definitions.values())
  .map((definition) => ({
    id: crypto.randomUUID(),
    slug: sanitizeSlug(definition.name),
    name: definition.name,
    category: definition.category ?? "OTHER",
    subcategory: null,
    weaponHandling: definition.weaponHandling ?? null,
    gloveWearMode: definition.gloveWearMode ?? null,
    armorCategory: definition.armorCategory ?? null,
    armorClassCalculation: definition.armorClassCalculation ?? null,
    armorClassBase: definition.armorClassBase ?? null,
    armorClassBonus: definition.armorClassBonus ?? null,
    rarity: null,
    description: definition.description ?? null,
    stackable: !!definition.stackable,
    equippable: !!definition.equippable,
    attunement: false,
    weight: null,
    valueCp: null,
    data: JSON.stringify({
      importedFromLegacyInventory: true,
    }),
    slotRules: Array.isArray(definition.slotRules) ? definition.slotRules : [],
    attacks: Array.isArray(definition.attacks) ? definition.attacks : [],
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));

const usedSlugs = new Set();
for (const definition of definitionRows) {
  let candidate = definition.slug;
  let counter = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${definition.slug}-${counter}`;
    counter += 1;
  }
  definition.slug = candidate;
  usedSlugs.add(candidate);
}

const deleteTransactionItems = sqlite.prepare('DELETE FROM "InventoryTransactionItem"');
const deleteTransactionCurrency = sqlite.prepare('DELETE FROM "InventoryTransactionCurrency"');
const deleteTransactions = sqlite.prepare('DELETE FROM "InventoryTransaction"');
const deleteCharacterItemEquip = sqlite.prepare('DELETE FROM "CharacterItemEquip"');
const deleteCharacterItems = sqlite.prepare('DELETE FROM "CharacterItem"');
const deleteItemAttack = sqlite.prepare('DELETE FROM "ItemAttack"');
const deleteItemModifier = sqlite.prepare('DELETE FROM "ItemModifier"');
const deleteItemFeature = sqlite.prepare('DELETE FROM "ItemFeature"');
const deleteItemSlotRule = sqlite.prepare('DELETE FROM "ItemSlotRule"');
const deleteItemDefinition = sqlite.prepare('DELETE FROM "ItemDefinition"');

const insertItemDefinition = sqlite.prepare(`
  INSERT INTO "ItemDefinition" (
    id, slug, name, category, subcategory, weaponHandling, gloveWearMode, armorCategory,
    armorClassCalculation, armorClassBase, armorClassBonus, rarity, description, stackable,
    equippable, attunement, weight, valueCp, data, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSlotRule = sqlite.prepare(`
  INSERT INTO "ItemSlotRule" (id, itemDefinitionId, groupKey, selectionMode, slot, required, sortOrder)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAttack = sqlite.prepare(`
  INSERT INTO "ItemAttack" (
    id, itemDefinitionId, name, kind, handRequirement, ability, attackBonus, damageDice,
    damageType, rangeNormal, rangeLong, twoHandedOnly, requiresEquipped, conditionText,
    sortOrder, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

runInTransaction(() => {
  deleteTransactionItems.run();
  deleteTransactionCurrency.run();
  deleteTransactions.run();
  deleteCharacterItemEquip.run();
  deleteCharacterItems.run();
  deleteItemAttack.run();
  deleteItemModifier.run();
  deleteItemFeature.run();
  deleteItemSlotRule.run();
  deleteItemDefinition.run();

  const now = new Date().toISOString();
  for (const definition of definitionRows) {
    insertItemDefinition.run(
      definition.id,
      definition.slug,
      definition.name,
      definition.category,
      definition.subcategory,
      definition.weaponHandling,
      definition.gloveWearMode,
      definition.armorCategory,
      definition.armorClassCalculation,
      definition.armorClassBase,
      definition.armorClassBonus,
      definition.rarity,
      definition.description,
      definition.stackable ? 1 : 0,
      definition.equippable ? 1 : 0,
      definition.attunement ? 1 : 0,
      definition.weight,
      definition.valueCp,
      definition.data,
      now,
      now
    );

    for (const slotRule of definition.slotRules) {
      insertSlotRule.run(
        String(slotRule.id ?? crypto.randomUUID()),
        definition.id,
        String(slotRule.groupKey ?? "default"),
        String(slotRule.selectionMode ?? "ALL_REQUIRED"),
        String(slotRule.slot),
        slotRule.required === false ? 0 : 1,
        Number.isFinite(Number(slotRule.sortOrder)) ? Number(slotRule.sortOrder) : 0
      );
    }

    for (const attack of definition.attacks) {
      insertAttack.run(
        String(attack.id ?? crypto.randomUUID()),
        definition.id,
        attack.name,
        attack.kind ?? "MELEE_WEAPON",
        attack.handRequirement ?? "ANY",
        attack.ability ?? null,
        attack.attackBonus ?? null,
        attack.damageDice ?? null,
        attack.damageType ?? null,
        attack.rangeNormal ?? null,
        attack.rangeLong ?? null,
        attack.twoHandedOnly ? 1 : 0,
        attack.requiresEquipped === false ? 0 : 1,
        attack.conditionText ?? null,
        Number.isFinite(Number(attack.sortOrder)) ? Number(attack.sortOrder) : 0,
        now,
        now
      );
    }
  }
});

console.log(`backfill-item-definitions: created ${definitionRows.length} item definitions in ${DB_PATH}`);
