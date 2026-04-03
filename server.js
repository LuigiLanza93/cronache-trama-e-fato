// server.js (ESM)
import { createServer } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { Server as SocketIOServer } from "socket.io";
import { normalizeMonsterTypeFields } from "./shared/monster-type-normalization.mjs";
import { computeMonsterRarity } from "./shared/monster-rarity-rules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;

// ---- Disk paths ----
const DATA_DIR = path.resolve(__dirname, "src/data");
const MONSTERS_DIR = path.resolve(DATA_DIR, "monsters");
const PORTRAIT_DIR = path.resolve(__dirname, "public/portraits");
const SESSION_COOKIE = "ctf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SQLITE_DB_FILE = path.resolve(__dirname, "prisma", "migration.db");
const sqlite = new DatabaseSync(SQLITE_DB_FILE);
sqlite.exec("PRAGMA foreign_keys = ON;");

// ---- Utilities ----
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "character";
}

function extensionFromType(contentType = "", fileName = "") {
  const normalizedType = String(contentType).toLowerCase();
  if (normalizedType === "image/png") return "png";
  if (normalizedType === "image/jpeg") return "jpg";
  if (normalizedType === "image/webp") return "webp";

  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return null;
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
    } catch {
      // Surface the original failure even if rollback also fails.
    }
    throw error;
  }
}

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: String(row.role).toLowerCase() === "dm" ? "dm" : "player",
    passwordSalt: row.passwordSalt,
    passwordHash: row.passwordHash,
    mustChangePassword: !!row.mustChangePassword,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeCharacterRow(row) {
  if (!row) return null;
  const data = parseJsonString(row.data, {});
  return {
    ...data,
    slug: row.slug,
    characterType: String(row.characterType).toLowerCase(),
    basicInfo: {
      ...(data.basicInfo ?? {}),
      characterName: row.name,
      class: row.className ?? data?.basicInfo?.class ?? "",
      race: row.race ?? data?.basicInfo?.race ?? "",
      alignment: row.alignment ?? data?.basicInfo?.alignment ?? "",
      background: row.background ?? data?.basicInfo?.background ?? "",
      level: row.level ?? data?.basicInfo?.level ?? 1,
      portraitUrl: row.portraitUrl ?? data?.basicInfo?.portraitUrl ?? "",
    },
  };
}

function normalizeMonsterDbRow(row) {
  if (!row) return null;
  const data = parseJsonString(row.data, {});
  if (!data?.general && data?.name) {
    const legacyCr = String(data.challengeRating ?? "");
    const legacyDecimal =
      legacyCr === "1/8" ? 0.125 :
      legacyCr === "1/4" ? 0.25 :
      legacyCr === "1/2" ? 0.5 :
      Number.isFinite(Number(legacyCr)) ? Number(legacyCr) : null;

    return normalizeMonsterRecord(
      {
        slug: row.slug,
        general: {
          name: String(data.name),
          challengeRating: {
            fraction: legacyCr,
            decimal: legacyDecimal,
            display: legacyCr,
            xp: typeof row.challengeRatingXp === "number" ? row.challengeRatingXp : 0,
          },
          size: String(data.size ?? ""),
          creatureType: String(data.type ?? ""),
          subtype: "",
          typeLabel: String(data.type ?? ""),
          alignment: String(data.alignment ?? ""),
          environments: [],
        },
        combat: {
          armorClass: {
            value: Number.isFinite(Number(data.armorClass)) ? Number(data.armorClass) : 0,
            note: "",
          },
          hitPoints: {
            average: Number.isFinite(Number(data.hitPoints)) ? Number(data.hitPoints) : 0,
            formula: String(data.hitDice ?? ""),
          },
          speed: Object.fromEntries(
            Object.entries(data.speed ?? {}).map(([key, value]) => [key, typeof value === "number" ? `${value}` : String(value)])
          ),
        },
        abilities: {
          strength: Number(data?.abilityScores?.strength ?? 10),
          dexterity: Number(data?.abilityScores?.dexterity ?? 10),
          constitution: Number(data?.abilityScores?.constitution ?? 10),
          intelligence: Number(data?.abilityScores?.intelligence ?? 10),
          wisdom: Number(data?.abilityScores?.wisdom ?? 10),
          charisma: Number(data?.abilityScores?.charisma ?? 10),
        },
        details: {
          savingThrows: [],
          skills: Array.isArray(data.skills)
            ? data.skills.map((skill) => ({ name: String(skill), bonus: 0 }))
            : [],
          damageVulnerabilities: [],
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: [],
          senses: Array.isArray(data.senses)
            ? data.senses.map((sense) => ({ name: String(sense) }))
            : [],
          languages: Array.isArray(data.languages)
            ? data.languages.map((language) => ({ name: String(language) }))
            : [],
          proficiencyBonus: Number.isFinite(Number(data.proficiencyBonus)) ? Number(data.proficiencyBonus) : 2,
        },
        traits: Array.isArray(data.specialAbilities)
          ? data.specialAbilities.map((item) => ({
              name: String(item.name ?? ""),
              usage: null,
              description: String(item.description ?? ""),
            }))
          : [],
        actions: Array.isArray(data.actions)
          ? data.actions.map((item) => ({
              name: String(item.name ?? ""),
              usage: null,
              description: String(item.description ?? ""),
            }))
          : [],
        bonusActions: [],
        reactions: [],
        legendaryActions: {
          description: "",
          actions: [],
        },
        lairActions: [],
        regionalEffects: [],
        notes: [],
        source: {},
      },
      row.id,
      row.sourceFile ?? row.filePath ?? ""
    );
  }
  return normalizeMonsterRecord(
    data,
    row.id,
    row.sourceFile ?? row.filePath ?? ""
  );
}

function normalizeSpellRow(row) {
  if (!row) return null;
  const data = parseJsonString(row.data, {});
  const classes = parseJsonString(row.classes, []);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    level: Number.isFinite(Number(row.level)) ? Number(row.level) : 0,
    school: row.school ?? "",
    casting_time: row.castingTime ?? data?.casting_time ?? "",
    range: row.range ?? data?.range ?? "",
    components: data?.components ?? "",
    duration: row.duration ?? data?.duration ?? "",
    concentration: !!row.concentration,
    saving_throw: data?.saving_throw ?? null,
    attack_roll: !!data?.attack_roll,
    damage: data?.damage ?? null,
    scaling: data?.scaling ?? null,
    ritual: !!row.ritual,
    description: data?.description ?? "",
    usage: data?.usage ?? null,
    rest: data?.rest ?? null,
    _source: row.sourceUrl ?? data?._source ?? null,
    classes: Array.isArray(classes) ? classes : [],
  };
}

function normalizeSkillRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ability: row.ability,
    sourceType: String(row.sourceType).toLowerCase(),
  };
}

const ABILITY_LABELS = {
  strength: "Forza",
  dexterity: "Destrezza",
  constitution: "Costituzione",
  intelligence: "Intelligenza",
  wisdom: "Saggezza",
  charisma: "Carisma",
};

const ITEM_ABILITY_SCORE_VALUES = ["STRENGTH", "DEXTERITY", "CONSTITUTION", "INTELLIGENCE", "WISDOM", "CHARISMA"];
const ITEM_USE_EFFECT_TYPE_VALUES = ["HEAL", "DAMAGE", "TEMP_HP", "APPLY_CONDITION", "REMOVE_CONDITION", "RESTORE_RESOURCE", "CUSTOM"];
const ITEM_USE_TARGET_TYPE_VALUES = ["SELF", "CREATURE", "OBJECT", "AREA", "CUSTOM"];
const ITEM_USE_SUCCESS_OUTCOME_VALUES = ["NONE", "HALF", "NEGATES", "CUSTOM"];

function tableExists(tableName) {
  return !!sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(tableName);
}

function columnExists(tableName, columnName) {
  return sqlite
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .some((column) => String(column.name) === columnName);
}

function formatSkillLabel(skillName, ability) {
  const normalizedSkillName = String(skillName ?? "").trim();
  const normalizedAbility = String(ability ?? "").trim().toLowerCase();
  const abilityLabel = ABILITY_LABELS[normalizedAbility] ?? String(ability ?? "").trim();

  if (!normalizedSkillName) return "";
  return abilityLabel ? `${normalizedSkillName} (${abilityLabel})` : normalizedSkillName;
}

function readMonsterDiscoveryRules() {
  const crRules = tableExists("MonsterDiscoveryDcByCrRule")
    ? sqlite
        .prepare('SELECT minCr, maxCr, dc FROM "MonsterDiscoveryDcByCrRule" ORDER BY minCr ASC')
        .all()
    : [];

  const rarityRules = tableExists("MonsterDiscoveryDcByRarityRule")
    ? sqlite
        .prepare('SELECT rarity, dc FROM "MonsterDiscoveryDcByRarityRule"')
        .all()
    : [];

  const discoverSkillRules = tableExists("MonsterDiscoverSkillRule")
    ? sqlite.prepare(`
        SELECT
          r.creatureType,
          r.subtype,
          s.id AS skillId,
          s.name AS skillName,
          s.ability AS skillAbility
        FROM "MonsterDiscoverSkillRule" r
        JOIN "Skill" s ON s.id = r.skillId
      `).all()
    : [];

  return {
    crRules,
    rarityRuleMap: new Map(
      rarityRules.map((rule) => [String(rule.rarity ?? "").trim(), Number(rule.dc)])
    ),
    discoverSkillRuleMap: new Map(
      discoverSkillRules.map((rule) => [
        `${String(rule.creatureType ?? "").trim()}::${String(rule.subtype ?? "").trim()}`,
        {
          id: String(rule.skillId ?? "").trim(),
          name: String(rule.skillName ?? "").trim(),
          ability: String(rule.skillAbility ?? "").trim(),
        },
      ])
    ),
  };
}

function resolveAnalysisDc(challengeRating, crRules) {
  const decimal = typeof challengeRating?.decimal === "number" && Number.isFinite(challengeRating.decimal)
    ? challengeRating.decimal
    : null;

  if (decimal === null) return null;

  const rule = crRules.find((entry) => (
    decimal >= Number(entry.minCr) &&
    (entry.maxCr === null || decimal <= Number(entry.maxCr))
  ));

  return rule ? Number(rule.dc) : null;
}

function resolveResearchDc(rarity, rarityRuleMap) {
  const normalizedRarity = String(rarity ?? "").trim();
  if (!normalizedRarity) return null;
  const dc = rarityRuleMap.get(normalizedRarity);
  return typeof dc === "number" && Number.isFinite(dc) ? dc : null;
}

function resolveDiscoverSkill(general, discoverSkillRuleMap) {
  const creatureType = String(general?.creatureType ?? "").trim();
  const subtype = String(general?.subtype ?? "").trim();
  if (!creatureType) return null;

  return (
    (subtype ? discoverSkillRuleMap.get(`${creatureType}::${subtype}`) : null) ??
    discoverSkillRuleMap.get(`${creatureType}::`) ??
    null
  );
}

function enrichMonsterWithDiscovery(monster, discoveryRules = readMonsterDiscoveryRules()) {
  if (!monster) return null;

  const discoverSkill = resolveDiscoverSkill(monster.general, discoveryRules.discoverSkillRuleMap);

  return {
    ...monster,
    analysisDc: resolveAnalysisDc(monster.general.challengeRating, discoveryRules.crRules),
    researchDc: resolveResearchDc(monster.rarity, discoveryRules.rarityRuleMap),
    discoverSkill: formatSkillLabel(discoverSkill?.name, discoverSkill?.ability),
  };
}

function readUsers() {
  return sqlite
    .prepare('SELECT * FROM "User" ORDER BY username COLLATE NOCASE')
    .all()
    .map(normalizeUserRow);
}

function readSkills() {
  const skills = sqlite
    .prepare('SELECT * FROM "Skill" ORDER BY name COLLATE NOCASE')
    .all()
    .map(normalizeSkillRow)
    .filter(Boolean);
  return { skills };
}

function normalizeNullableString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function normalizeNullableInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNullableFloat(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasMeaningfulValue(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  return value !== null && value !== undefined;
}

function assertNamedEntries(entries, label, fields = []) {
  const invalidIndex = entries.findIndex((entry) => {
    const name = String(entry?.name ?? "").trim();
    if (name) return false;
    return fields.some((field) => hasMeaningfulValue(entry?.[field]));
  });

  if (invalidIndex >= 0) {
    throw new Error(`${label} #${invalidIndex + 1} richiede un nome.`);
  }
}

function createUniqueItemSlug(baseSlug, excludeId = null) {
  const safeBaseSlug = sanitizeSlug(baseSlug || "item");
  const rows = tableExists("ItemDefinition")
    ? sqlite.prepare('SELECT id, slug FROM "ItemDefinition"').all()
    : [];
  const used = new Set(
    rows
      .filter((row) => !excludeId || row.id !== excludeId)
      .map((row) => String(row.slug ?? "").trim())
      .filter(Boolean)
  );

  if (!used.has(safeBaseSlug)) return safeBaseSlug;

  let counter = 2;
  while (used.has(`${safeBaseSlug}-${counter}`)) {
    counter += 1;
  }
  return `${safeBaseSlug}-${counter}`;
}

function createEmptyItemDefinition(name = "Nuovo oggetto") {
  const safeName = String(name).trim() || "Nuovo oggetto";
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    slug: createUniqueItemSlug(safeName),
    name: safeName,
    category: "OTHER",
    subcategory: null,
    weaponHandling: null,
    gloveWearMode: null,
    armorCategory: null,
    armorClassCalculation: null,
    armorClassBase: null,
    armorClassBonus: null,
    rarity: null,
    description: null,
    playerVisible: true,
    stackable: false,
    equippable: false,
    attunement: false,
    weight: null,
    valueCp: null,
    data: null,
    createdAt: now,
    updatedAt: now,
    slotRules: [],
    attacks: [],
    modifiers: [],
    features: [],
    abilityRequirements: [],
    useEffects: [],
  };
}

function readItemDefinitions() {
  if (!tableExists("ItemDefinition")) return [];
  const hasPlayerVisible = columnExists("ItemDefinition", "playerVisible");

  return sqlite.prepare(`
    SELECT
      d.id,
      d.slug,
      d.name,
      d.category,
      d.rarity,
      d.description,
      ${hasPlayerVisible ? "d.playerVisible" : "1 AS playerVisible"},
      d.stackable,
      d.equippable,
      d.updatedAt,
      (SELECT COUNT(*) FROM "ItemAttack" a WHERE a.itemDefinitionId = d.id) AS attackCount,
      (SELECT COUNT(*) FROM "ItemSlotRule" s WHERE s.itemDefinitionId = d.id) AS slotRuleCount
    FROM "ItemDefinition" d
    ORDER BY d.name COLLATE NOCASE ASC
  `).all().map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    rarity: row.rarity ?? null,
    description: row.description ?? null,
    playerVisible: !!row.playerVisible,
    stackable: !!row.stackable,
    equippable: !!row.equippable,
    attackCount: Number(row.attackCount ?? 0),
    slotRuleCount: Number(row.slotRuleCount ?? 0),
    updatedAt: row.updatedAt,
  }));
}

function readItemDefinition(itemId) {
  if (!tableExists("ItemDefinition")) return null;

  const base = sqlite.prepare('SELECT * FROM "ItemDefinition" WHERE id = ? LIMIT 1').get(itemId);
  if (!base) return null;

  const slotRules = sqlite
    .prepare('SELECT * FROM "ItemSlotRule" WHERE itemDefinitionId = ? ORDER BY groupKey ASC, sortOrder ASC, slot ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      groupKey: row.groupKey,
      selectionMode: row.selectionMode,
      slot: row.slot,
      required: !!row.required,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const attacks = sqlite
    .prepare('SELECT * FROM "ItemAttack" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, name COLLATE NOCASE ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      handRequirement: row.handRequirement,
      ability: row.ability ?? null,
      attackBonus: row.attackBonus ?? null,
      damageDice: row.damageDice ?? null,
      damageType: row.damageType ?? null,
      rangeNormal: row.rangeNormal ?? null,
      rangeLong: row.rangeLong ?? null,
      twoHandedOnly: !!row.twoHandedOnly,
      requiresEquipped: !!row.requiresEquipped,
      conditionText: row.conditionText ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const modifiers = sqlite
    .prepare('SELECT * FROM "ItemModifier" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, target ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      target: row.target,
      type: row.type,
      value: row.value ?? null,
      formula: row.formula ?? null,
      condition: row.condition,
      stackKey: row.stackKey ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const features = sqlite
    .prepare('SELECT * FROM "ItemFeature" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, name COLLATE NOCASE ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      resetOn: row.resetOn ?? null,
      customResetLabel: row.customResetLabel ?? null,
      maxUses: row.maxUses ?? null,
      condition: row.condition,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const abilityRequirements = tableExists("ItemAbilityRequirement")
    ? sqlite
        .prepare('SELECT * FROM "ItemAbilityRequirement" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, ability ASC')
        .all(itemId)
        .map((row) => ({
          id: row.id,
          ability: row.ability,
          minScore: Number(row.minScore ?? 0),
          sortOrder: Number(row.sortOrder ?? 0),
        }))
    : [];

  const useEffects = tableExists("ItemUseEffect")
    ? sqlite
        .prepare('SELECT * FROM "ItemUseEffect" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, effectType ASC')
        .all(itemId)
        .map((row) => ({
          id: row.id,
          effectType: row.effectType,
          targetType: row.targetType,
          diceExpression: row.diceExpression ?? null,
          flatValue: row.flatValue ?? null,
          damageType: row.damageType ?? null,
          savingThrowAbility: row.savingThrowAbility ?? null,
          savingThrowDc: row.savingThrowDc ?? null,
          successOutcome: row.successOutcome ?? null,
          durationText: row.durationText ?? null,
          notes: row.notes ?? null,
          sortOrder: Number(row.sortOrder ?? 0),
        }))
    : [];

  return {
    id: base.id,
    slug: base.slug,
    name: base.name,
    category: base.category,
    subcategory: base.subcategory ?? null,
    weaponHandling: base.weaponHandling ?? null,
    gloveWearMode: base.gloveWearMode ?? null,
    armorCategory: base.armorCategory ?? null,
    armorClassCalculation: base.armorClassCalculation ?? null,
    armorClassBase: base.armorClassBase ?? null,
    armorClassBonus: base.armorClassBonus ?? null,
    rarity: base.rarity ?? null,
    description: base.description ?? null,
    playerVisible: columnExists("ItemDefinition", "playerVisible") ? !!base.playerVisible : true,
    stackable: !!base.stackable,
    equippable: !!base.equippable,
    attunement: !!base.attunement,
    weight: base.weight ?? null,
    valueCp: base.valueCp ?? null,
    data: base.data ?? null,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    slotRules,
    attacks,
    modifiers,
    features,
    abilityRequirements,
    useEffects,
  };
}

function normalizeItemDefinitionPayload(payload, existingId = null) {
  const base = createEmptyItemDefinition(String(payload?.name ?? "Nuovo oggetto"));
  const safeName = String(payload?.name ?? "").trim();
  if (!safeName) {
    throw new Error("Item name required");
  }

  const rawAttacks = Array.isArray(payload?.attacks) ? payload.attacks : [];
  const rawFeatures = Array.isArray(payload?.features) ? payload.features : [];
  const rawAbilityRequirements = Array.isArray(payload?.abilityRequirements) ? payload.abilityRequirements : [];
  const rawUseEffects = Array.isArray(payload?.useEffects) ? payload.useEffects : [];
  const normalizedRarity = normalizeNullableString(payload?.rarity);

  assertNamedEntries(rawAttacks, "Attacco", ["kind", "handRequirement", "ability", "attackBonus", "damageDice", "damageType", "rangeNormal", "rangeLong", "conditionText"]);
  assertNamedEntries(rawFeatures, "Feature", ["description", "resetOn", "customResetLabel", "maxUses", "condition"]);

  return {
    ...base,
    id: existingId ?? String(payload?.id ?? base.id),
    slug: createUniqueItemSlug(String(payload?.slug ?? safeName), existingId),
    name: safeName,
    category: String(payload?.category ?? "OTHER").trim() || "OTHER",
    subcategory: normalizeNullableString(payload?.subcategory),
    weaponHandling: normalizeNullableString(payload?.weaponHandling),
    gloveWearMode: normalizeNullableString(payload?.gloveWearMode),
    armorCategory: normalizeNullableString(payload?.armorCategory),
    armorClassCalculation: normalizeNullableString(payload?.armorClassCalculation),
    armorClassBase: normalizeNullableInt(payload?.armorClassBase),
    armorClassBonus: normalizeNullableInt(payload?.armorClassBonus),
    rarity: normalizedRarity,
    description: normalizeNullableString(payload?.description),
    playerVisible: payload?.playerVisible !== false,
    stackable: normalizedRarity === "UNIQUE" ? false : !!payload?.stackable,
    equippable: !!payload?.equippable,
    attunement: !!payload?.attunement,
    weight: normalizeNullableFloat(payload?.weight),
    valueCp: normalizeNullableInt(payload?.valueCp),
    data: typeof payload?.data === "string" ? payload.data : payload?.data ? JSON.stringify(payload.data) : null,
    slotRules: Array.isArray(payload?.slotRules)
      ? payload.slotRules.map((entry, index) => ({
          id: String(entry?.id ?? crypto.randomUUID()),
          groupKey: String(entry?.groupKey ?? "default").trim() || "default",
          selectionMode: String(entry?.selectionMode ?? "ALL_REQUIRED").trim() || "ALL_REQUIRED",
          slot: String(entry?.slot ?? "").trim(),
          required: entry?.required !== false,
          sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
        })).filter((entry) => entry.slot)
      : [],
    attacks: rawAttacks
      ? rawAttacks.map((entry, index) => ({
          id: String(entry?.id ?? crypto.randomUUID()),
          name: String(entry?.name ?? "").trim(),
          kind: String(entry?.kind ?? "MELEE_WEAPON").trim() || "MELEE_WEAPON",
          handRequirement: String(entry?.handRequirement ?? "ANY").trim() || "ANY",
          ability: normalizeNullableString(entry?.ability),
          attackBonus: normalizeNullableInt(entry?.attackBonus),
          damageDice: normalizeNullableString(entry?.damageDice),
          damageType: normalizeNullableString(entry?.damageType),
          rangeNormal: normalizeNullableInt(entry?.rangeNormal),
          rangeLong: normalizeNullableInt(entry?.rangeLong),
          twoHandedOnly: !!entry?.twoHandedOnly,
          requiresEquipped: entry?.requiresEquipped !== false,
          conditionText: normalizeNullableString(entry?.conditionText),
          sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
        })).filter((entry) => entry.name)
      : [],
    modifiers: Array.isArray(payload?.modifiers)
      ? payload.modifiers.map((entry, index) => ({
          id: String(entry?.id ?? crypto.randomUUID()),
          target: String(entry?.target ?? "").trim(),
          type: String(entry?.type ?? "FLAT").trim() || "FLAT",
          value: normalizeNullableInt(entry?.value),
          formula: normalizeNullableString(entry?.formula),
          condition: String(entry?.condition ?? "WHILE_EQUIPPED").trim() || "WHILE_EQUIPPED",
          stackKey: normalizeNullableString(entry?.stackKey),
          sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
        })).filter((entry) => entry.target)
      : [],
    features: rawFeatures
      ? rawFeatures.map((entry, index) => ({
          id: String(entry?.id ?? crypto.randomUUID()),
          name: String(entry?.name ?? "").trim(),
          description: normalizeNullableString(entry?.description),
          resetOn: normalizeNullableString(entry?.resetOn),
          customResetLabel: normalizeNullableString(entry?.customResetLabel),
          maxUses: normalizeNullableInt(entry?.maxUses),
          condition: String(entry?.condition ?? "WHILE_EQUIPPED").trim() || "WHILE_EQUIPPED",
          sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
        })).filter((entry) => entry.name)
      : [],
    abilityRequirements: rawAbilityRequirements
      ? rawAbilityRequirements.map((entry, index) => {
          const ability = String(entry?.ability ?? "").trim().toUpperCase();
          const minScore = normalizeNullableInt(entry?.minScore);
          return {
            id: String(entry?.id ?? crypto.randomUUID()),
            ability,
            minScore,
            sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
          };
        }).filter((entry) => ITEM_ABILITY_SCORE_VALUES.includes(entry.ability) && entry.minScore != null)
      : [],
    useEffects: rawUseEffects
      ? rawUseEffects.map((entry, index) => {
          const effectType = String(entry?.effectType ?? "").trim().toUpperCase();
          const targetType = String(entry?.targetType ?? "").trim().toUpperCase();
          const savingThrowAbility = normalizeNullableString(entry?.savingThrowAbility)?.toUpperCase() ?? null;
          const successOutcome = normalizeNullableString(entry?.successOutcome)?.toUpperCase() ?? null;
          return {
            id: String(entry?.id ?? crypto.randomUUID()),
            effectType,
            targetType,
            diceExpression: normalizeNullableString(entry?.diceExpression),
            flatValue: normalizeNullableInt(entry?.flatValue),
            damageType: normalizeNullableString(entry?.damageType),
            savingThrowAbility,
            savingThrowDc: normalizeNullableInt(entry?.savingThrowDc),
            successOutcome,
            durationText: normalizeNullableString(entry?.durationText),
            notes: normalizeNullableString(entry?.notes),
            sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
          };
        }).filter((entry) => (
          ITEM_USE_EFFECT_TYPE_VALUES.includes(entry.effectType) &&
          ITEM_USE_TARGET_TYPE_VALUES.includes(entry.targetType) &&
          (!entry.savingThrowAbility || ITEM_ABILITY_SCORE_VALUES.includes(entry.savingThrowAbility)) &&
          (!entry.successOutcome || ITEM_USE_SUCCESS_OUTCOME_VALUES.includes(entry.successOutcome))
        ))
      : [],
  };
}

function saveItemDefinition(payload, existingId = null) {
  const normalized = normalizeItemDefinitionPayload(payload, existingId);
  const now = new Date().toISOString();
  const existing = tableExists("ItemDefinition")
    ? sqlite.prepare('SELECT id, createdAt FROM "ItemDefinition" WHERE id = ? LIMIT 1').get(normalized.id)
    : null;
  const hasPlayerVisible = columnExists("ItemDefinition", "playerVisible");

  runInTransaction(() => {
    if (existing) {
      sqlite.prepare(`
        UPDATE "ItemDefinition"
        SET
          slug = ?,
          name = ?,
          category = ?,
          subcategory = ?,
          weaponHandling = ?,
          gloveWearMode = ?,
          armorCategory = ?,
          armorClassCalculation = ?,
          armorClassBase = ?,
          armorClassBonus = ?,
          rarity = ?,
          description = ?,
          ${hasPlayerVisible ? "playerVisible = ?," : ""}
          stackable = ?,
          equippable = ?,
          attunement = ?,
          weight = ?,
          valueCp = ?,
          data = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(
        normalized.slug,
        normalized.name,
        normalized.category,
        normalized.subcategory,
        normalized.weaponHandling,
        normalized.gloveWearMode,
        normalized.armorCategory,
        normalized.armorClassCalculation,
        normalized.armorClassBase,
        normalized.armorClassBonus,
        normalized.rarity,
        normalized.description,
        ...(hasPlayerVisible ? [normalized.playerVisible ? 1 : 0] : []),
        normalized.stackable ? 1 : 0,
        normalized.equippable ? 1 : 0,
        normalized.attunement ? 1 : 0,
        normalized.weight,
        normalized.valueCp,
        normalized.data,
        now,
        normalized.id
      );
    } else {
      sqlite.prepare(`
        INSERT INTO "ItemDefinition" (
          id, slug, name, category, subcategory, weaponHandling, gloveWearMode, armorCategory,
          armorClassCalculation, armorClassBase, armorClassBonus, rarity, description,
          ${hasPlayerVisible ? "playerVisible," : ""}
          stackable, equippable, attunement, weight, valueCp, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${hasPlayerVisible ? "?, " : ""}?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalized.id,
        normalized.slug,
        normalized.name,
        normalized.category,
        normalized.subcategory,
        normalized.weaponHandling,
        normalized.gloveWearMode,
        normalized.armorCategory,
        normalized.armorClassCalculation,
        normalized.armorClassBase,
        normalized.armorClassBonus,
        normalized.rarity,
        normalized.description,
        ...(hasPlayerVisible ? [normalized.playerVisible ? 1 : 0] : []),
        normalized.stackable ? 1 : 0,
        normalized.equippable ? 1 : 0,
        normalized.attunement ? 1 : 0,
        normalized.weight,
        normalized.valueCp,
        normalized.data,
        now,
        now
      );
    }

    sqlite.prepare('DELETE FROM "ItemSlotRule" WHERE itemDefinitionId = ?').run(normalized.id);
    sqlite.prepare('DELETE FROM "ItemAttack" WHERE itemDefinitionId = ?').run(normalized.id);
    sqlite.prepare('DELETE FROM "ItemModifier" WHERE itemDefinitionId = ?').run(normalized.id);
    sqlite.prepare('DELETE FROM "ItemFeature" WHERE itemDefinitionId = ?').run(normalized.id);
    if (tableExists("ItemAbilityRequirement")) {
      sqlite.prepare('DELETE FROM "ItemAbilityRequirement" WHERE itemDefinitionId = ?').run(normalized.id);
    }
    if (tableExists("ItemUseEffect")) {
      sqlite.prepare('DELETE FROM "ItemUseEffect" WHERE itemDefinitionId = ?').run(normalized.id);
    }

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
    const insertModifier = sqlite.prepare(`
      INSERT INTO "ItemModifier" (
        id, itemDefinitionId, target, type, value, formula, condition, stackKey, sortOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFeature = sqlite.prepare(`
      INSERT INTO "ItemFeature" (
        id, itemDefinitionId, name, description, resetOn, customResetLabel, maxUses, condition, sortOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAbilityRequirement = tableExists("ItemAbilityRequirement")
      ? sqlite.prepare(`
          INSERT INTO "ItemAbilityRequirement" (
            id, itemDefinitionId, ability, minScore, sortOrder, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
      : null;
    const insertUseEffect = tableExists("ItemUseEffect")
      ? sqlite.prepare(`
          INSERT INTO "ItemUseEffect" (
            id, itemDefinitionId, effectType, targetType, diceExpression, flatValue, damageType,
            savingThrowAbility, savingThrowDc, successOutcome, durationText, notes, sortOrder, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
      : null;

    for (const entry of normalized.slotRules) {
      insertSlotRule.run(
        entry.id,
        normalized.id,
        entry.groupKey,
        entry.selectionMode,
        entry.slot,
        entry.required ? 1 : 0,
        entry.sortOrder
      );
    }

    for (const entry of normalized.attacks) {
      insertAttack.run(
        entry.id,
        normalized.id,
        entry.name,
        entry.kind,
        entry.handRequirement,
        entry.ability,
        entry.attackBonus,
        entry.damageDice,
        entry.damageType,
        entry.rangeNormal,
        entry.rangeLong,
        entry.twoHandedOnly ? 1 : 0,
        entry.requiresEquipped ? 1 : 0,
        entry.conditionText,
        entry.sortOrder,
        now,
        now
      );
    }

    for (const entry of normalized.modifiers) {
      insertModifier.run(
        entry.id,
        normalized.id,
        entry.target,
        entry.type,
        entry.value,
        entry.formula,
        entry.condition,
        entry.stackKey,
        entry.sortOrder,
        now,
        now
      );
    }

    for (const entry of normalized.features) {
      insertFeature.run(
        entry.id,
        normalized.id,
        entry.name,
        entry.description,
        entry.resetOn,
        entry.customResetLabel,
        entry.maxUses,
        entry.condition,
        entry.sortOrder,
        now,
        now
      );
    }

    if (insertAbilityRequirement) {
      for (const entry of normalized.abilityRequirements) {
        insertAbilityRequirement.run(
          entry.id,
          normalized.id,
          entry.ability,
          entry.minScore,
          entry.sortOrder,
          now,
          now
        );
      }
    }

    if (insertUseEffect) {
      for (const entry of normalized.useEffects) {
        insertUseEffect.run(
          entry.id,
          normalized.id,
          entry.effectType,
          entry.targetType,
          entry.diceExpression,
          entry.flatValue,
          entry.damageType,
          entry.savingThrowAbility,
          entry.savingThrowDc,
          entry.successOutcome,
          entry.durationText,
          entry.notes,
          entry.sortOrder,
          now,
          now
        );
      }
    }
  });

  return readItemDefinition(normalized.id);
}

function buildCharacterInventoryDetailSummary(itemDefinitionId, itemCategory) {
  if (!itemDefinitionId) return { description: null, detailSummary: null };

  const definition = sqlite
    .prepare('SELECT description FROM "ItemDefinition" WHERE id = ? LIMIT 1')
    .get(itemDefinitionId);

  let detailSummary = null;

  if (itemCategory === "WEAPON" && tableExists("ItemAttack")) {
    const attack = sqlite
      .prepare(`
        SELECT name, attackBonus, damageDice, damageType, rangeNormal, rangeLong
        FROM "ItemAttack"
        WHERE itemDefinitionId = ?
        ORDER BY sortOrder ASC, name COLLATE NOCASE ASC
        LIMIT 1
      `)
      .get(itemDefinitionId);

    if (attack) {
      const parts = [];
      if (attack.attackBonus !== null && attack.attackBonus !== undefined) {
        parts.push(`${Number(attack.attackBonus) >= 0 ? "+" : ""}${attack.attackBonus}`);
      }
      if (attack.damageDice || attack.damageType) {
        parts.push([attack.damageDice, attack.damageType].filter(Boolean).join(" "));
      }
      if (attack.rangeNormal != null || attack.rangeLong != null) {
        parts.push(`gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}`);
      }
      detailSummary = parts.filter(Boolean).join(" · ") || null;
    }
  } else if ((itemCategory === "CONSUMABLE" || itemCategory === "AMMUNITION") && tableExists("ItemUseEffect")) {
    const effect = sqlite
      .prepare(`
        SELECT effectType, diceExpression, flatValue, damageType, savingThrowAbility, savingThrowDc, successOutcome
        FROM "ItemUseEffect"
        WHERE itemDefinitionId = ?
        ORDER BY sortOrder ASC
        LIMIT 1
      `)
      .get(itemDefinitionId);

    if (effect) {
      const parts = [];
      if (effect.effectType === "HEAL") {
        parts.push(`cura ${effect.diceExpression ?? effect.flatValue ?? ""}`.trim());
      } else if (effect.effectType === "DAMAGE") {
        parts.push([effect.diceExpression ?? effect.flatValue, effect.damageType].filter(Boolean).join(" "));
      } else {
        parts.push(String(effect.effectType ?? "").toLowerCase());
      }
      if (effect.savingThrowAbility && effect.savingThrowDc != null) {
        parts.push(`TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}`);
      }
      if (effect.successOutcome) {
        parts.push(`succ: ${String(effect.successOutcome).toLowerCase()}`);
      }
      detailSummary = parts.filter(Boolean).join(" · ") || null;
    }
  }

  return {
    description: definition?.description ?? null,
    detailSummary,
  };
}

function readCharacterInventoryItemsBySlug(slug) {
  if (!tableExists("CharacterItem")) return [];

  const character = sqlite
    .prepare('SELECT id, slug, name FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(slug);
  if (!character) return null;

  return sqlite.prepare(`
    SELECT
      ci.id,
      ci.characterId,
      ci.itemDefinitionId,
      ci.nameOverride,
      ci.descriptionOverride,
      ci.quantity,
      ci.isEquipped,
      ci.sortOrder,
      ci.notes,
      ci.createdAt,
      ci.updatedAt,
      d.name AS itemDefinitionName,
      d.category AS itemDefinitionCategory,
      d.equippable AS itemDefinitionEquippable,
      d.stackable AS itemDefinitionStackable
    FROM "CharacterItem" ci
    LEFT JOIN "ItemDefinition" d ON d.id = ci.itemDefinitionId
    WHERE ci.characterId = ?
    ORDER BY ci.sortOrder ASC, ci.createdAt ASC
  `).all(character.id).map((row) => {
    const category = row.itemDefinitionCategory ?? null;
    const details = buildCharacterInventoryDetailSummary(row.itemDefinitionId ?? null, category);

    return {
      id: row.id,
      characterId: character.id,
      characterSlug: character.slug,
      characterName: character.name,
      itemDefinitionId: row.itemDefinitionId ?? null,
      itemName: row.nameOverride ?? row.itemDefinitionName ?? "Oggetto senza nome",
      itemCategory: category,
      description: row.descriptionOverride ?? details.description ?? null,
      detailSummary: details.detailSummary,
      equippable: !!row.itemDefinitionEquippable,
      stackable: !!row.itemDefinitionStackable,
      quantity: Number(row.quantity ?? 1),
      isEquipped: !!row.isEquipped,
      nameOverride: row.nameOverride ?? null,
      descriptionOverride: row.descriptionOverride ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

function assignItemDefinitionToCharacter(characterSlug, payload, actorUserId = null) {
  if (!tableExists("CharacterItem")) {
    throw new Error("Character inventory not available");
  }

  const character = sqlite
    .prepare('SELECT id, slug, name FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(characterSlug);
  if (!character) {
    throw new Error("Character not found");
  }

  let itemDefinition = null;
  const itemDefinitionId = String(payload?.itemDefinitionId ?? "").trim();
  const quickCreateItem = payload?.quickCreateItem && typeof payload.quickCreateItem === "object"
    ? payload.quickCreateItem
    : null;

  if (itemDefinitionId) {
    itemDefinition = sqlite
      .prepare('SELECT id, name, category, stackable, rarity FROM "ItemDefinition" WHERE id = ? LIMIT 1')
      .get(itemDefinitionId);
    if (!itemDefinition) {
      throw new Error("Item definition not found");
    }
  } else if (quickCreateItem) {
    const created = saveItemDefinition(buildQuickCreateItemDefinitionPayload(quickCreateItem));
    itemDefinition = {
      id: created.id,
      name: created.name,
      category: created.category,
      stackable: created.stackable ? 1 : 0,
      rarity: created.rarity ?? null,
    };
  } else {
    throw new Error("Item definition required");
  }

  if (String(itemDefinition.rarity ?? "").toUpperCase() === "UNIQUE") {
    const existingInstances = Number(
      sqlite
        .prepare('SELECT COUNT(*) AS count FROM "CharacterItem" WHERE itemDefinitionId = ?')
        .get(itemDefinition.id)?.count ?? 0
    );
    if (existingInstances > 0) {
      throw new Error("Questo oggetto unico esiste gia e non puo avere piu istanze.");
    }
  }

  const requestedQuantity = Math.max(1, normalizeNullableInt(payload?.quantity) ?? 1);
  const notes = normalizeNullableString(payload?.notes);
  const currentMaxSortOrder = Number(
    sqlite.prepare('SELECT MAX(sortOrder) AS maxSortOrder FROM "CharacterItem" WHERE characterId = ?').get(character.id)?.maxSortOrder ?? -1
  );
  const entriesToCreate = !!itemDefinition.stackable
    ? [{ quantity: requestedQuantity }]
    : Array.from({ length: requestedQuantity }, () => ({ quantity: 1 }));

  runInTransaction(() => {
    const now = new Date().toISOString();
    const insertCharacterItem = sqlite.prepare(`
      INSERT INTO "CharacterItem" (
        id, characterId, itemDefinitionId, nameOverride, descriptionOverride, quantity, isEquipped,
        sortOrder, notes, data, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTransaction = tableExists("InventoryTransaction")
      ? sqlite.prepare(`
          INSERT INTO "InventoryTransaction" (
            id, type, fromOwnerType, fromCharacterId, fromNpcName, toOwnerType, toCharacterId, toNpcName,
            notes, createdByUserId, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
      : null;

    const insertTransactionItem = tableExists("InventoryTransactionItem")
      ? sqlite.prepare(`
          INSERT INTO "InventoryTransactionItem" (
            id, transactionId, characterItemId, itemDefinitionId, descriptionSnapshot, quantity
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
      : null;

    const transactionId = insertTransaction ? crypto.randomUUID() : null;
    if (insertTransaction && transactionId) {
      insertTransaction.run(
        transactionId,
        "INITIAL_GRANT",
        "SYSTEM",
        null,
        null,
        "CHARACTER",
        character.id,
        null,
        `Assegnazione DM: ${itemDefinition.name}`,
        actorUserId,
        now
      );
    }

    entriesToCreate.forEach((entry, index) => {
      const characterItemId = crypto.randomUUID();
      insertCharacterItem.run(
        characterItemId,
        character.id,
        itemDefinition.id,
        null,
        null,
        entry.quantity,
        0,
        currentMaxSortOrder + index + 1,
        notes,
        JSON.stringify({ assignedFromCatalog: true }),
        now,
        now
      );

      if (insertTransactionItem && transactionId) {
        insertTransactionItem.run(
          crypto.randomUUID(),
          transactionId,
          characterItemId,
          itemDefinition.id,
          itemDefinition.name,
          entry.quantity
        );
      }
    });
  });

  return readCharacterInventoryItemsBySlug(characterSlug);
}

function buildQuickCreateWeaponSlotRules(weaponHandling) {
  if (weaponHandling === "TWO_HANDED") {
    return [
      { groupKey: "hands", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 0 },
      { groupKey: "hands", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 1 },
    ];
  }

  if (weaponHandling === "VERSATILE") {
    return [
      { groupKey: "one-hand", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 0 },
      { groupKey: "one-hand", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 1 },
      { groupKey: "two-hand", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 2 },
      { groupKey: "two-hand", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 3 },
    ];
  }

  return [
    { groupKey: "hands", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 0 },
    { groupKey: "hands", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 1 },
  ];
}

function buildQuickCreateItemDefinitionPayload(raw) {
  const mode = String(raw?.kind ?? "object").trim();
  const name = String(raw?.name ?? "").trim();
  if (!name) {
    throw new Error("Item name required");
  }

  const base = createEmptyItemDefinition(name);
  const description = normalizeNullableString(raw?.description);
  const notes = normalizeNullableString(raw?.notes);
  const mergedDescription = [description, notes].filter(Boolean).join("\n\n") || null;

  if (mode === "weapon") {
    const weaponHandling = String(raw?.weaponHandling ?? "ONE_HANDED").trim() || "ONE_HANDED";
    const attackKind = String(raw?.attackKind ?? "MELEE_WEAPON").trim() || "MELEE_WEAPON";
    const damageDice = normalizeNullableString(raw?.damageDice);
    const damageType = normalizeNullableString(raw?.damageType);
    const attackBonus = normalizeNullableInt(raw?.attackBonus);
    const rangeNormal = normalizeNullableInt(raw?.rangeNormal);
    const rangeLong = normalizeNullableInt(raw?.rangeLong);
    const versatileDamageDice = normalizeNullableString(raw?.versatileDamageDice);

    const attacks = [];
    if (damageDice || damageType || attackBonus != null) {
      attacks.push({
        name,
        kind: attackKind,
        handRequirement: weaponHandling === "TWO_HANDED" ? "TWO_HANDED" : weaponHandling === "VERSATILE" ? "ONE_HANDED" : "ANY",
        attackBonus,
        damageDice,
        damageType,
        rangeNormal,
        rangeLong,
        requiresEquipped: true,
        sortOrder: 0,
      });
    }
    if (weaponHandling === "VERSATILE" && versatileDamageDice) {
      attacks.push({
        name: `${name} (2 mani)`,
        kind: attackKind,
        handRequirement: "TWO_HANDED",
        attackBonus,
        damageDice: versatileDamageDice,
        damageType,
        rangeNormal,
        rangeLong,
        requiresEquipped: true,
        sortOrder: 1,
      });
    }

    return {
      ...base,
      category: "WEAPON",
      description: mergedDescription,
      equippable: true,
      stackable: false,
      weaponHandling,
      slotRules: buildQuickCreateWeaponSlotRules(weaponHandling),
      attacks,
    };
  }

  if (mode === "consumable") {
    const consumableCategory = String(raw?.consumableCategory ?? "CONSUMABLE").trim() || "CONSUMABLE";
    const effectType = normalizeNullableString(raw?.effectType)?.toUpperCase() ?? null;
    const effectDice = normalizeNullableString(raw?.effectDice);
    const effectFlatValue = normalizeNullableInt(raw?.effectFlatValue);
    const useEffects = effectType
      ? [{
          effectType,
          targetType: "CREATURE",
          diceExpression: effectDice,
          flatValue: effectFlatValue,
          damageType: normalizeNullableString(raw?.effectDamageType),
          savingThrowAbility: normalizeNullableString(raw?.savingThrowAbility)?.toUpperCase() ?? null,
          savingThrowDc: normalizeNullableInt(raw?.savingThrowDc),
          successOutcome: normalizeNullableString(raw?.successOutcome)?.toUpperCase() ?? null,
          notes: normalizeNullableString(raw?.effectNotes),
          sortOrder: 0,
        }]
      : [];

    return {
      ...base,
      category: consumableCategory,
      description: mergedDescription,
      equippable: false,
      stackable: true,
      useEffects,
    };
  }

  return {
    ...base,
    category: String(raw?.objectCategory ?? "OTHER").trim() || "OTHER",
    description: mergedDescription,
    equippable: !!raw?.equippable,
    stackable: !!raw?.stackable,
  };
}

function updateCharacterInventoryItem(characterSlug, characterItemId, payload) {
  if (!tableExists("CharacterItem")) {
    throw new Error("Character inventory not available");
  }

  const character = sqlite
    .prepare('SELECT id, slug FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(characterSlug);
  if (!character) {
    throw new Error("Character not found");
  }

  const existing = sqlite.prepare(`
    SELECT
      ci.id,
      ci.characterId,
      ci.quantity,
      ci.isEquipped,
      d.equippable AS itemDefinitionEquippable
    FROM "CharacterItem" ci
    LEFT JOIN "ItemDefinition" d ON d.id = ci.itemDefinitionId
    WHERE ci.id = ? AND ci.characterId = ?
    LIMIT 1
  `).get(characterItemId, character.id);
  if (!existing) {
    throw new Error("Character item not found");
  }

  const quantity = payload?.quantity === undefined ? Number(existing.quantity ?? 1) : Math.max(0, normalizeNullableInt(payload?.quantity) ?? 0);
  const isEquipped = payload?.isEquipped === undefined ? !!existing.isEquipped : !!payload.isEquipped;
  if (isEquipped && !existing.itemDefinitionEquippable) {
    throw new Error("Item is not equippable");
  }

  sqlite.prepare(`
    UPDATE "CharacterItem"
    SET quantity = ?, isEquipped = ?, updatedAt = ?
    WHERE id = ? AND characterId = ?
  `).run(
    quantity,
    isEquipped ? 1 : 0,
    new Date().toISOString(),
    existing.id,
    character.id
  );

  return readCharacterInventoryItemsBySlug(characterSlug)?.find((item) => item.id === existing.id) ?? null;
}

function readOwnership() {
  const rows = sqlite
    .prepare('SELECT slug, ownerUserId FROM "Character" WHERE archivedAt IS NULL AND ownerUserId IS NOT NULL')
    .all();
  return Object.fromEntries(rows.map((row) => [row.slug, row.ownerUserId]));
}

function writeOwnership(ownership) {
  const allCharacters = sqlite.prepare('SELECT id, slug FROM "Character"').all();
  const clear = sqlite.prepare('UPDATE "Character" SET ownerUserId = NULL WHERE id = ?');
  const set = sqlite.prepare('UPDATE "Character" SET ownerUserId = ? WHERE slug = ?');

  runInTransaction(() => {
    for (const character of allCharacters) {
      clear.run(character.id);
    }
    for (const [slug, userId] of Object.entries(ownership)) {
      set.run(userId, slug);
    }
  });
}

function readChats() {
  const rows = sqlite.prepare(`
    SELECT
      m.id,
      c.slug AS slug,
      m.senderUserId,
      m.senderRole,
      COALESCE(u.displayName, u.username, CASE WHEN m.senderRole = 'DM' THEN 'DM' ELSE 'Player' END) AS senderName,
      m.text,
      m.createdAt
    FROM "ChatMessage" m
    JOIN "Character" c ON c.id = m.characterId
    LEFT JOIN "User" u ON u.id = m.senderUserId
    ORDER BY m.createdAt ASC
  `).all();

  return rows.reduce((acc, row) => {
    if (!acc[row.slug]) acc[row.slug] = [];
    acc[row.slug].push({
      id: row.id,
      slug: row.slug,
      senderUserId: row.senderUserId,
      senderRole: String(row.senderRole).toLowerCase(),
      senderName: row.senderName,
      text: row.text,
      createdAt: row.createdAt,
    });
    return acc;
  }, {});
}

function writeChats(chats) {
  const deleteAll = sqlite.prepare('DELETE FROM "ChatMessage"');
  const findCharacterId = sqlite.prepare('SELECT id FROM "Character" WHERE slug = ?');
  const insert = sqlite.prepare(`
    INSERT INTO "ChatMessage" (id, characterId, senderUserId, senderRole, text, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  runInTransaction(() => {
    deleteAll.run();
    for (const [slug, messages] of Object.entries(chats ?? {})) {
      const character = findCharacterId.get(slug);
      if (!character || !Array.isArray(messages)) continue;
      for (const message of messages) {
        insert.run(
          message.id ?? crypto.randomUUID(),
          character.id,
          message.senderUserId ?? null,
          String(message.senderRole).toLowerCase() === "dm" ? "DM" : "PLAYER",
          message.text ?? "",
          message.createdAt ?? new Date().toISOString()
        );
      }
    }
  });
}

function readEncounterScenarios() {
  const scenarios = sqlite.prepare(`
    SELECT id, name, createdByUserId, createdAt, updatedAt
    FROM "EncounterScenario"
    ORDER BY name COLLATE NOCASE
  `).all();
  const entries = sqlite.prepare(`
    SELECT id, scenarioId, entryType, sortOrder, monsterId, name, count, armorClass, hitPoints, powerTag, createdAt, updatedAt
    FROM "EncounterScenarioEntry"
    ORDER BY sortOrder ASC
  `).all();

  return scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    createdByUserId: scenario.createdByUserId ?? null,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
    entries: entries
      .filter((entry) => entry.scenarioId === scenario.id)
      .map((entry) => ({
        type: entry.entryType === "BESTIARY" ? "bestiary" : "manual",
        monsterId: entry.monsterId ?? undefined,
        name: entry.name,
        count: entry.count,
        armorClass: entry.armorClass ?? undefined,
        hitPoints: entry.hitPoints ?? undefined,
        powerTag: entry.powerTag ? String(entry.powerTag).toLowerCase() : null,
      })),
  }));
}

function readSpellsByClass() {
  const rows = sqlite
    .prepare('SELECT * FROM "Spell" ORDER BY level ASC, name COLLATE NOCASE ASC')
    .all();

  const byClass = {};
  for (const row of rows) {
    const spell = normalizeSpellRow(row);
    if (!spell) continue;
    for (const className of spell.classes) {
      if (!byClass[className]) byClass[className] = [];
      byClass[className].push({
        name: spell.name,
        level: spell.level,
        school: spell.school,
        casting_time: spell.casting_time,
        range: spell.range,
        components: spell.components,
        duration: spell.duration,
        concentration: spell.concentration,
        saving_throw: spell.saving_throw,
        attack_roll: spell.attack_roll,
        damage: spell.damage,
        scaling: spell.scaling,
        ritual: spell.ritual,
        description: spell.description,
        usage: spell.usage,
        rest: spell.rest,
        _source: spell._source,
      });
    }
  }

  return Object.fromEntries(
    Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  );
}

function readSpellSlotProgressions() {
  const rows = sqlite
    .prepare('SELECT className, classSlug, characterLevel, slots FROM "SpellSlotProgression" ORDER BY className COLLATE NOCASE, characterLevel ASC')
    .all();

  const table = {};
  for (const row of rows) {
    const className = String(row.className);
    if (!table[className]) table[className] = {};
    table[className][String(row.characterLevel)] = parseJsonString(row.slots, {});
  }
  return table;
}

function writeEncounterScenarios(scenarios) {
  const deleteEntries = sqlite.prepare('DELETE FROM "EncounterScenarioEntry"');
  const deleteScenarios = sqlite.prepare('DELETE FROM "EncounterScenario"');
  const insertScenario = sqlite.prepare(`
    INSERT INTO "EncounterScenario" (id, name, createdByUserId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertEntry = sqlite.prepare(`
    INSERT INTO "EncounterScenarioEntry" (
      id, scenarioId, entryType, sortOrder, monsterId, name, count, armorClass, hitPoints, powerTag, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  runInTransaction(() => {
    deleteEntries.run();
    deleteScenarios.run();

    for (const scenario of scenarios ?? []) {
      insertScenario.run(
        scenario.id,
        scenario.name,
        scenario.createdByUserId ?? null,
        scenario.createdAt ?? new Date().toISOString(),
        scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString()
      );

      (Array.isArray(scenario.entries) ? scenario.entries : []).forEach((entry, index) => {
        insertEntry.run(
          `${scenario.id}:${index + 1}`,
          scenario.id,
          entry.type === "bestiary" ? "BESTIARY" : "MANUAL",
          index + 1,
          entry.monsterId ?? null,
          entry.name ?? "",
          Math.max(1, parseInt(entry.count, 10) || 1),
          entry.armorClass ?? null,
          entry.hitPoints ?? null,
          entry.powerTag ? String(entry.powerTag).toUpperCase() : null,
          scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString(),
          scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString()
        );
      });
    }
  });
}

function createScenarioId(name) {
  return `scenario_${sanitizeSlug(name)}_${crypto.randomBytes(4).toString("hex")}`;
}

function encodeMonsterId(relativePath) {
  return Buffer.from(relativePath, "utf-8").toString("base64url");
}

function decodeMonsterId(monsterId) {
  try {
    const relativePath = Buffer.from(String(monsterId), "base64url").toString("utf-8");
    if (!relativePath || relativePath.includes("..")) return null;
    return relativePath.replace(/\\/g, "/");
  } catch {
    return null;
  }
}

function parseMonsterHitPointRange(formula = "", average = 0) {
  const normalized = String(formula)
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "");

  if (!normalized) return null;

  const terms = normalized.match(/[+-]?\d+d\d+|[+-]?\d+/gi);
  if (!terms || terms.length === 0) return null;

  let min = 0;
  let max = 0;
  let consumed = "";

  for (const rawTerm of terms) {
    const term = rawTerm.replace(/\s+/g, "");
    consumed += term;

    const diceMatch = term.match(/^([+-]?)(\d+)d(\d+)$/i);
    if (diceMatch) {
      const sign = diceMatch[1] === "-" ? -1 : 1;
      const count = parseInt(diceMatch[2], 10);
      const sides = parseInt(diceMatch[3], 10);
      if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return null;

      if (sign >= 0) {
        min += count;
        max += count * sides;
      } else {
        min -= count * sides;
        max -= count;
      }
      continue;
    }

    const flat = parseInt(term, 10);
    if (!Number.isFinite(flat)) return null;
    min += flat;
    max += flat;
  }

  if (consumed !== normalized) return null;

  const safeMin = Math.max(0, min);
  const safeMax = Math.max(safeMin, max);
  const safeAverage = Math.min(safeMax, Math.max(safeMin, Math.round(average)));

  return { min: safeMin, max: safeMax, average: safeAverage };
}

function classifyMonsterPowerTag(hitPoints, range) {
  if (!range || !Number.isFinite(hitPoints)) return null;
  if (hitPoints <= range.min) return "debolissimo";
  if (hitPoints >= range.max) return "fortissimo";

  const span = range.max - range.min;
  if (span <= 0) return null;

  const edgeBand = Math.max(1, Math.floor(span * 0.2));
  if (hitPoints <= range.min + edgeBand) return "debole";
  if (hitPoints >= range.max - edgeBand) return "forte";
  return null;
}

function isBestiaryJsonFile(entryName) {
  if (!entryName.endsWith(".json")) return false;
  if (entryName.startsWith("_")) return false;
  if (entryName.endsWith(".example.json")) return false;
  return true;
}

function listMonsterFiles(dirPath = MONSTERS_DIR, prefix = "") {
  ensureDir(dirPath);

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return listMonsterFiles(fullPath, relativePath);
    }

    return isBestiaryJsonFile(entry.name) ? [relativePath] : [];
  });
}

function normalizeMonsterRecord(data = {}, fileId, relativePath) {
  const general = data?.general ?? {};
  const combat = data?.combat ?? {};
  const details = data?.details ?? {};
  const abilities = data?.abilities ?? {};
  const challengeRating = general?.challengeRating ?? {};
  const normalizedType = normalizeMonsterTypeFields({
    creatureType: general?.creatureType ?? "",
    subtype: general?.subtype ?? "",
    typeLabel: general?.typeLabel ?? "",
  });
  const normalizedChallengeRating = {
    fraction: String(challengeRating?.fraction ?? challengeRating?.display ?? ""),
    decimal: typeof challengeRating?.decimal === "number" ? challengeRating.decimal : null,
    display: String(challengeRating?.display ?? challengeRating?.fraction ?? ""),
    xp: typeof challengeRating?.xp === "number" ? challengeRating.xp : 0,
  };
  const rarity = computeMonsterRarity({
    creatureType: normalizedType.creatureType,
    challengeRating: normalizedChallengeRating,
  });

  return {
    id: fileId,
    filePath: relativePath,
    slug: typeof data?.slug === "string" ? data.slug : sanitizeSlug(general?.name ?? path.basename(relativePath, ".json")),
    rarity,
    general: {
      name: String(general?.name ?? path.basename(relativePath, ".json")),
      challengeRating: normalizedChallengeRating,
      size: String(general?.size ?? ""),
      creatureType: normalizedType.creatureType,
      subtype: normalizedType.subtype,
      typeLabel: normalizedType.typeLabel,
      alignment: String(general?.alignment ?? ""),
      environments: Array.isArray(general?.environments) ? general.environments.filter(Boolean) : [],
    },
    combat: {
      armorClass: {
        value: typeof combat?.armorClass?.value === "number" ? combat.armorClass.value : 0,
        note: String(combat?.armorClass?.note ?? ""),
      },
      hitPoints: {
        average: typeof combat?.hitPoints?.average === "number" ? combat.hitPoints.average : 0,
        formula: String(combat?.hitPoints?.formula ?? ""),
      },
      speed: typeof combat?.speed === "object" && combat?.speed !== null ? combat.speed : {},
    },
    abilities: {
      strength: typeof abilities?.strength === "number" ? abilities.strength : 10,
      dexterity: typeof abilities?.dexterity === "number" ? abilities.dexterity : 10,
      constitution: typeof abilities?.constitution === "number" ? abilities.constitution : 10,
      intelligence: typeof abilities?.intelligence === "number" ? abilities.intelligence : 10,
      wisdom: typeof abilities?.wisdom === "number" ? abilities.wisdom : 10,
      charisma: typeof abilities?.charisma === "number" ? abilities.charisma : 10,
    },
    details: {
      savingThrows: Array.isArray(details?.savingThrows) ? details.savingThrows : [],
      skills: Array.isArray(details?.skills) ? details.skills : [],
      damageVulnerabilities: Array.isArray(details?.damageVulnerabilities) ? details.damageVulnerabilities : [],
      damageResistances: Array.isArray(details?.damageResistances) ? details.damageResistances : [],
      damageImmunities: Array.isArray(details?.damageImmunities) ? details.damageImmunities : [],
      conditionImmunities: Array.isArray(details?.conditionImmunities) ? details.conditionImmunities : [],
      senses: Array.isArray(details?.senses) ? details.senses : [],
      languages: Array.isArray(details?.languages) ? details.languages : [],
      proficiencyBonus: typeof details?.proficiencyBonus === "number" ? details.proficiencyBonus : 2,
    },
    traits: Array.isArray(data?.traits) ? data.traits : [],
    actions: Array.isArray(data?.actions) ? data.actions : [],
    bonusActions: Array.isArray(data?.bonusActions) ? data.bonusActions : [],
    reactions: Array.isArray(data?.reactions) ? data.reactions : [],
    legendaryActions:
      typeof data?.legendaryActions === "object" && data?.legendaryActions !== null
        ? {
            description: String(data.legendaryActions.description ?? ""),
            actions: Array.isArray(data.legendaryActions.actions) ? data.legendaryActions.actions : [],
          }
        : { description: "", actions: [] },
    lairActions: Array.isArray(data?.lairActions) ? data.lairActions : [],
    regionalEffects: Array.isArray(data?.regionalEffects) ? data.regionalEffects : [],
    notes: Array.isArray(data?.notes) ? data.notes : [],
    source:
      typeof data?.source === "object" && data?.source !== null
        ? data.source
        : {
            extractedFrom: "",
            rawText: "",
          },
  };
}

function readMonsterByRelativePath(relativePath) {
  const hasArchivedAt = columnExists("Monster", "archivedAt");
  const row = sqlite
    .prepare(`SELECT * FROM "Monster" WHERE sourceFile = ? ${hasArchivedAt ? 'AND archivedAt IS NULL' : ""} LIMIT 1`)
    .get(relativePath);
  return enrichMonsterWithDiscovery(normalizeMonsterDbRow(row));
}

function listMonsters() {
  const discoveryRules = readMonsterDiscoveryRules();
  const hasArchivedAt = columnExists("Monster", "archivedAt");
  return sqlite
    .prepare(`SELECT * FROM "Monster" ${hasArchivedAt ? 'WHERE archivedAt IS NULL' : ""} ORDER BY name COLLATE NOCASE`)
    .all()
    .map(normalizeMonsterDbRow)
    .filter(Boolean)
    .map((monster) => enrichMonsterWithDiscovery(monster, discoveryRules));
}

function summarizeMonsterSpeed(speed = {}) {
  const speedLabels = {
    walk: "Camminare",
    fly: "Volare",
    swim: "Nuotare",
    climb: "Scalare",
    burrow: "Scavare",
  };

  return ["walk", "fly", "swim", "climb", "burrow"]
    .filter((key) => speed[key])
    .map((key) => `${speedLabels[key]} ${speed[key]}`)
    .join(", ");
}

function qualitativeAbilityLabel(score) {
  if (score <= 5) return "Molto bassa";
  if (score <= 9) return "Bassa";
  if (score <= 11) return "Nella media";
  if (score <= 15) return "Alta";
  if (score <= 19) return "Molto alta";
  return "Eccezionale";
}

function signedAbilityModifier(score) {
  const modifier = Math.floor((Number(score) - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function fullAbilityLabel(score) {
  return `${score} (${signedAbilityModifier(score)})`;
}

function readKnownMonsterCompendiumStateById() {
  if (!tableExists("MonsterCompendiumEntry")) {
    return new Map();
  }

  return new Map(
    sqlite
      .prepare(`
        SELECT monsterId, knowledgeState
        FROM "MonsterCompendiumEntry"
        WHERE knowledgeState IS NOT NULL
          AND knowledgeState <> 'UNKNOWN'
      `)
      .all()
      .map((row) => [row.monsterId, row.knowledgeState])
  );
}

function buildPlayerCompendiumBasicSummary(monster, knowledgeState = "BASIC") {
  const isComplete = knowledgeState === "COMPLETE";

  return {
    id: monster.id,
    knowledgeState,
    name: monster.general.name,
    size: monster.general.size,
    typeLabel: monster.general.typeLabel || monster.general.creatureType,
    armorClass: monster.combat.armorClass.value,
    hitPointsAverage: monster.combat.hitPoints.average,
    speedLabel: summarizeMonsterSpeed(monster.combat.speed),
    strengthScore: monster.abilities.strength,
    dexterityScore: monster.abilities.dexterity,
    constitutionScore: monster.abilities.constitution,
    intelligenceScore: monster.abilities.intelligence,
    wisdomScore: monster.abilities.wisdom,
    charismaScore: monster.abilities.charisma,
    strengthDisplay: isComplete ? fullAbilityLabel(monster.abilities.strength) : qualitativeAbilityLabel(monster.abilities.strength),
    dexterityDisplay: isComplete ? fullAbilityLabel(monster.abilities.dexterity) : qualitativeAbilityLabel(monster.abilities.dexterity),
    constitutionDisplay: isComplete ? fullAbilityLabel(monster.abilities.constitution) : qualitativeAbilityLabel(monster.abilities.constitution),
    intelligenceDisplay: isComplete ? fullAbilityLabel(monster.abilities.intelligence) : null,
    wisdomDisplay: isComplete ? fullAbilityLabel(monster.abilities.wisdom) : null,
    charismaDisplay: isComplete ? fullAbilityLabel(monster.abilities.charisma) : null,
  };
}

function readMonsterCompendiumKnowledgeState(monsterId) {
  if (!tableExists("MonsterCompendiumEntry")) {
    return "UNKNOWN";
  }

  return (
    sqlite
      .prepare(`
        SELECT knowledgeState
        FROM "MonsterCompendiumEntry"
        WHERE monsterId = ?
        LIMIT 1
      `)
      .get(monsterId)?.knowledgeState ?? "UNKNOWN"
  );
}

function createEmptyMonster(name) {
  const safeName = String(name).trim() || "Nuovo Mostro";
  return normalizeMonsterRecord(
    {
      slug: sanitizeSlug(safeName),
      general: {
        name: safeName,
        challengeRating: {
          fraction: "0",
          decimal: 0,
          display: "0",
          xp: 0,
        },
        size: "Media",
        creatureType: "",
        subtype: "",
        typeLabel: "",
        alignment: "",
        environments: [],
      },
      combat: {
        armorClass: {
          value: 10,
          note: "",
        },
        hitPoints: {
          average: 1,
          formula: "1d8",
        },
        speed: {
          walk: "9 m",
        },
      },
      abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      details: {
        savingThrows: [],
        skills: [],
        damageVulnerabilities: [],
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
        senses: [],
        languages: [],
        proficiencyBonus: 2,
      },
      traits: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      legendaryActions: {
        description: "",
        actions: [],
      },
      lairActions: [],
      regionalEffects: [],
      notes: [],
      source: {
        extractedFrom: "",
        rawText: "",
      },
    },
    "",
    ""
  );
}

function createUniqueMonsterFileName(baseName) {
  const baseSlug = sanitizeSlug(baseName || "monster");
  const existing = new Set(
    sqlite
      .prepare(`SELECT sourceFile FROM "Monster" WHERE sourceType = 'CUSTOM' AND sourceFile IS NOT NULL`)
      .all()
      .map((row) => String(row.sourceFile).replace(/^custom\//, "").replace(/\.json$/i, ""))
  );

  if (!existing.has(baseSlug)) return `${baseSlug}.json`;

  let index = 2;
  while (existing.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}.json`;
}

function listCharacterSlugs() {
  return sqlite
    .prepare('SELECT slug FROM "Character" WHERE archivedAt IS NULL ORDER BY slug COLLATE NOCASE')
    .all()
    .map((row) => row.slug);
}

function readCharacter(slug) {
  const row = sqlite
    .prepare('SELECT * FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(slug);
  return normalizeCharacterRow(row);
}

function listCharacters() {
  return sqlite
    .prepare('SELECT * FROM "Character" WHERE archivedAt IS NULL ORDER BY name COLLATE NOCASE')
    .all()
    .map(normalizeCharacterRow)
    .filter(Boolean);
}

function writeCharacter(slug, data) {
  const basicInfo = data?.basicInfo ?? {};
  const createdByUserId = data?.createdBy?.userId ?? null;
  const existing = sqlite
    .prepare('SELECT id, ownerUserId, createdByUserId, createdAt, archivedAt FROM "Character" WHERE slug = ? LIMIT 1')
    .get(slug);

  const payload = {
    id: existing?.id ?? slug,
    slug,
    name: String(basicInfo.characterName ?? slug),
    characterType: String(data?.characterType).toLowerCase() === "png" ? "PNG" : "PG",
    ownerUserId: existing?.ownerUserId ?? null,
    createdByUserId: existing?.createdByUserId ?? createdByUserId,
    className: basicInfo.class ? String(basicInfo.class) : null,
    race: basicInfo.race ? String(basicInfo.race) : null,
    alignment: basicInfo.alignment ? String(basicInfo.alignment) : null,
    background: basicInfo.background ? String(basicInfo.background) : null,
    level: Number.isFinite(Number(basicInfo.level)) ? Number(basicInfo.level) : null,
    portraitUrl: basicInfo.portraitUrl ? String(basicInfo.portraitUrl) : null,
    archivedAt: existing?.archivedAt ?? null,
    data: JSON.stringify(data),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    sqlite.prepare(`
      UPDATE "Character"
      SET
        name = ?,
        characterType = ?,
        ownerUserId = ?,
        createdByUserId = ?,
        className = ?,
        race = ?,
        alignment = ?,
        background = ?,
        level = ?,
        portraitUrl = ?,
        archivedAt = ?,
        data = ?,
        updatedAt = ?
      WHERE slug = ?
    `).run(
      payload.name,
      payload.characterType,
      payload.ownerUserId,
      payload.createdByUserId,
      payload.className,
      payload.race,
      payload.alignment,
      payload.background,
      payload.level,
      payload.portraitUrl,
      payload.archivedAt,
      payload.data,
      payload.updatedAt,
      slug
    );
    return;
  }

  sqlite.prepare(`
    INSERT INTO "Character" (
      id, slug, name, characterType, ownerUserId, createdByUserId, className, race, alignment, background,
      level, portraitUrl, archivedAt, data, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.id,
    payload.slug,
    payload.name,
    payload.characterType,
    payload.ownerUserId,
    payload.createdByUserId,
    payload.className,
    payload.race,
    payload.alignment,
    payload.background,
    payload.level,
    payload.portraitUrl,
    payload.archivedAt,
    payload.data,
    payload.createdAt,
    payload.updatedAt
  );
}

function archiveCharacter(slug) {
  const archivedAt = new Date().toISOString();
  const result = sqlite
    .prepare('UPDATE "Character" SET archivedAt = ?, updatedAt = ? WHERE slug = ? AND archivedAt IS NULL')
    .run(archivedAt, archivedAt, slug);
  if (!result.changes) return null;
  return archivedAt;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  if (!user?.passwordSalt || !user?.passwordHash) return false;

  const computed = hashPassword(password, user.passwordSalt);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(user.passwordHash, "hex"));
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function serializeSessionCookie(value) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

function serializeExpiredSessionCookie() {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

function createSessionId() {
  return crypto.randomBytes(24).toString("hex");
}

function cleanupExpiredSessions() {
  sqlite.prepare('DELETE FROM "Session" WHERE expiresAt <= ?').run(new Date().toISOString());
}

function getSessionById(sessionId) {
  if (!sessionId) return null;
  cleanupExpiredSessions();
  const session = sqlite
    .prepare('SELECT id, userId, createdAt, expiresAt, lastSeenAt FROM "Session" WHERE id = ? LIMIT 1')
    .get(sessionId);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    sqlite.prepare('DELETE FROM "Session" WHERE id = ?').run(sessionId);
    return null;
  }
  return session;
}

function touchSession(sessionId) {
  if (!sessionId) return;
  const nextExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sqlite
    .prepare('UPDATE "Session" SET lastSeenAt = ?, expiresAt = ? WHERE id = ?')
    .run(new Date().toISOString(), nextExpiresAt, sessionId);
}

function createSession(userId) {
  const sessionId = createSessionId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sqlite
    .prepare('INSERT INTO "Session" (id, userId, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, ?, ?)')
    .run(sessionId, userId, now, expiresAt, now);
  return sessionId;
}

function deleteSessionById(sessionId) {
  if (!sessionId) return;
  sqlite.prepare('DELETE FROM "Session" WHERE id = ?').run(sessionId);
}

function deleteSessionsByUserId(userId) {
  if (!userId) return;
  sqlite.prepare('DELETE FROM "Session" WHERE userId = ?').run(userId);
}

function sanitizeUser(user, ownership) {
  if (!user) return null;

  const ownedCharacters = Object.entries(ownership)
    .filter(([, ownerUserId]) => ownerUserId === user.id)
    .map(([slug]) => slug)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? user.username,
    role: user.role,
    mustChangePassword: !!user.mustChangePassword,
    ownedCharacters,
  };
}

function getUserById(userId) {
  const row = sqlite
    .prepare('SELECT * FROM "User" WHERE id = ? LIMIT 1')
    .get(userId);
  return normalizeUserRow(row);
}

function createUserRecord(user) {
  sqlite.prepare(`
    INSERT INTO "User" (
      id, username, displayName, role, passwordSalt, passwordHash, mustChangePassword, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.displayName ?? user.username,
    String(user.role).toLowerCase() === "dm" ? "DM" : "PLAYER",
    user.passwordSalt ?? "",
    user.passwordHash ?? "",
    user.mustChangePassword ? 1 : 0,
    user.createdAt ?? new Date().toISOString(),
    user.updatedAt ?? user.createdAt ?? new Date().toISOString()
  );
}

function updateUserCredentials(userId, { passwordSalt, passwordHash, mustChangePassword }) {
  const updatedAt = new Date().toISOString();
  const result = sqlite.prepare(`
    UPDATE "User"
    SET passwordSalt = ?, passwordHash = ?, mustChangePassword = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    passwordSalt,
    passwordHash,
    mustChangePassword ? 1 : 0,
    updatedAt,
    userId
  );

  if (!result.changes) return null;
  return getUserById(userId);
}

function deleteUserRecord(userId) {
  return sqlite.prepare('DELETE FROM "User" WHERE id = ?').run(userId);
}

function canAccessCharacter(user, slug, ownership) {
  if (!user) return false;
  if (user.role === "dm") return true;
  return ownership[slug] === user.id;
}

function canEditCharacter(user, slug, ownership) {
  return canAccessCharacter(user, slug, ownership);
}

function sanitizeUserForAdmin(user, ownership) {
  const base = sanitizeUser(user, ownership);
  if (!base) return null;

  return {
    ...base,
    createdAt: user.createdAt ?? null,
  };
}

function createUserId(username) {
  return `user_${sanitizeSlug(username)}_${crypto.randomBytes(4).toString("hex")}`;
}

function createUniqueCharacterSlug(baseSlug) {
  const existing = new Set(
    sqlite.prepare('SELECT slug FROM "Character"').all().map((row) => row.slug)
  );
  if (!existing.has(baseSlug)) return baseSlug;

  let index = 2;
  while (existing.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}`;
}

function createEmptyCharacter({
  slug,
  name,
  characterType,
  className,
  race,
  alignment,
  background,
  creator,
  ownerUser,
}) {
  const skills = readSkills().skills ?? [];

  return {
    slug,
    characterType,
    basicInfo: {
      characterName: name,
      class: className,
      level: 1,
      background,
      playerName: creator.displayName ?? creator.username,
      race,
      alignment,
      experiencePoints: 0,
      portraitUrl: "",
    },
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    combatStats: {
      armorClass: 10,
      initiative: 0,
      speed: 9,
      hitPointMaximum: 1,
      currentHitPoints: 1,
      temporaryHitPoints: 0,
      hitDice: "",
      deathSaves: {
        successes: 0,
        failures: 0,
      },
      spellSlots: {
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
        7: [],
        8: [],
        9: [],
        10: [],
        11: [],
        12: [],
      },
    },
    proficiencies: {
      proficiencyBonus: 2,
      savingThrows: [],
      skills: skills.map((skill) => ({
        name: skill.name,
        ability: skill.ability,
        proficient: false,
      })),
      languages: [],
    },
    equipment: {
      attacks: [],
      equipment: [],
      items: [],
      coins: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: 0,
        pp: 0,
      },
    },
    features: [],
    capabilities: [],
    createdBy: {
      userId: creator.id,
      role: creator.role,
      username: creator.username,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Deep merge (objects merged, arrays replaced, scalars overwritten) */
function deepMerge(target, patch) {
  if (Array.isArray(target) && Array.isArray(patch)) {
    return patch.slice();
  }
  if (
    typeof target === "object" && target !== null &&
    typeof patch === "object" && patch !== null
  ) {
    const out = { ...target };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = k in target ? deepMerge(target[k], v) : v;
    }
    return out;
  }
  return patch;
}

// Optional: debounce writes per slug to avoid hammering the disk
const persistTimers = new Map();
function scheduleWrite(slug, state) {
  clearTimeout(persistTimers.get(slug));
  const t = setTimeout(() => {
    try {
      writeCharacter(slug, state);
    } catch (e) {
      console.error(`[server] persist failed for ${slug}:`, e);
    }
  }, 200);
  persistTimers.set(slug, t);
}

// ---- App ----
async function start() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  ensureDir(PORTRAIT_DIR);
  app.use("/portraits", express.static(PORTRAIT_DIR));

  app.use((req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    const session = getSessionById(sessionId);
    const user = session?.userId ? getUserById(session.userId) : null;
    req.sessionId = sessionId ?? null;
    req.user = user ?? null;
    if (sessionId && session) touchSession(sessionId);
    next();
  });

  function requireAuth(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  }

  function requireRole(role) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
      next();
    };
  }

  // ===== Auth =====
  app.get("/api/auth/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    return res.json(sanitizeUser(req.user, readOwnership()));
  });

  app.post("/api/auth/login", (req, res) => {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const users = readUsers();
    const user = users.find((entry) => String(entry.username).toLowerCase() === username);

    if (!user || !verifyPassword(password, user)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionId = createSession(user.id);
    res.setHeader("Set-Cookie", serializeSessionCookie(sessionId));
    return res.json(sanitizeUser(user, readOwnership()));
  });

  app.post("/api/auth/logout", (req, res) => {
    if (req.sessionId) deleteSessionById(req.sessionId);
    res.setHeader("Set-Cookie", serializeExpiredSessionCookie());
    return res.status(204).end();
  });

  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const newPassword = String(req.body?.newPassword ?? "");

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ error: "Password too short" });
    }

    if (!getUserById(req.user.id)) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const updatedUser = updateUserCredentials(req.user.id, {
      passwordSalt,
      passwordHash: hashPassword(newPassword, passwordSalt),
      mustChangePassword: false,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    deleteSessionsByUserId(req.user.id);
    const sessionId = createSession(updatedUser.id);
    res.setHeader("Set-Cookie", serializeSessionCookie(sessionId));
    return res.json(sanitizeUser(updatedUser, readOwnership()));
  });

  // ===== User management =====
  app.get("/api/users", requireRole("dm"), (req, res) => {
    const ownership = readOwnership();
    const users = readUsers()
      .map((user) => sanitizeUserForAdmin(user, ownership))
      .filter(Boolean)
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }));

    return res.json(users);
  });

  app.post("/api/users", requireRole("dm"), (req, res) => {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const role = req.body?.role === "dm" ? "dm" : "player";
    const displayNameRaw = String(req.body?.displayName ?? "").trim();
    const users = readUsers();

    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    if (!/^[a-z0-9_]+$/i.test(username)) {
      return res.status(400).json({ error: "Invalid username" });
    }

    if (users.some((user) => user.username.toLowerCase() === username)) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const newUser = {
      id: createUserId(username),
      username,
      displayName: displayNameRaw || username,
      role,
      passwordSalt,
      passwordHash: hashPassword(username, passwordSalt),
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };

    createUserRecord(newUser);
    return res.status(201).json(sanitizeUserForAdmin(newUser, readOwnership()));
  });

  app.post("/api/users/:userId/reset-password", requireRole("dm"), (req, res) => {
    const userId = req.params.userId;
    const currentUser = getUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextPassword = currentUser.username;
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const updatedUser = updateUserCredentials(userId, {
      passwordSalt,
      passwordHash: hashPassword(nextPassword, passwordSalt),
      mustChangePassword: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    deleteSessionsByUserId(userId);
    return res.json(sanitizeUserForAdmin(updatedUser, readOwnership()));
  });

  app.delete("/api/users/:userId", requireRole("dm"), (req, res) => {
    const userId = req.params.userId;
    if (req.user.id === userId) {
      return res.status(400).json({ error: "Cannot delete current user" });
    }

    const result = deleteUserRecord(userId);
    if (!result.changes) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(204).end();
  });

  app.get("/api/character-ownership", requireRole("dm"), (req, res) => {
    const ownership = readOwnership();
    const users = readUsers();
    const validUserIds = new Set(users.map((user) => user.id));
    const characters = new Set(listCharacterSlugs());

    const sanitizedOwnership = Object.fromEntries(
      Object.entries(ownership).filter(([slug, userId]) => characters.has(slug) && validUserIds.has(userId))
    );

    return res.json(sanitizedOwnership);
  });

  app.put("/api/character-ownership/:slug", requireRole("dm"), (req, res) => {
    const slug = req.params.slug;
    const userId = req.body?.userId ?? null;
    const ownership = readOwnership();

    if (!listCharacterSlugs().includes(slug)) {
      return res.status(404).json({ error: "Character not found" });
    }

    if (userId !== null) {
      const user = getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      ownership[slug] = userId;
    } else {
      delete ownership[slug];
    }

    writeOwnership(ownership);
    return res.json({ slug, userId: ownership[slug] ?? null });
  });

  app.get("/api/chats/:slug", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const chats = readChats();
    return res.json(Array.isArray(chats[slug]) ? chats[slug] : []);
  });

  // ===== Item definitions =====
  app.get("/api/items", requireAuth, (req, res) => {
    const items = readItemDefinitions();
    if (req.user?.role === "dm") {
      return res.json(items);
    }
    return res.json(
      items.filter((item) => item.playerVisible && String(item.rarity ?? "").toUpperCase() !== "UNIQUE")
    );
  });

  app.get("/api/items/:itemId", requireAuth, (req, res) => {
    const item = readItemDefinition(req.params.itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    if (
      req.user?.role !== "dm" &&
      (
        !item.playerVisible ||
        String(item.rarity ?? "").toUpperCase() === "UNIQUE"
      )
    ) {
      return res.status(404).json({ error: "Item not found" });
    }
    return res.json(item);
  });

  app.post("/api/items", requireRole("dm"), (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Item name required" });
    }

    const created = saveItemDefinition(createEmptyItemDefinition(name));
    return res.status(201).json(created);
  });

  app.put("/api/items/:itemId", requireRole("dm"), (req, res) => {
    const current = readItemDefinition(req.params.itemId);
    if (!current) {
      return res.status(404).json({ error: "Item not found" });
    }

    const payload = req.body?.item;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Item payload required" });
    }

    try {
      const saved = saveItemDefinition({ ...payload, id: current.id }, current.id);
      return res.json(saved);
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.delete("/api/items/:itemId", requireRole("dm"), (req, res) => {
    const itemId = req.params.itemId;
    const item = readItemDefinition(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    const linkedCount = tableExists("CharacterItem")
      ? Number(
          sqlite
            .prepare('SELECT COUNT(*) AS count FROM "CharacterItem" WHERE itemDefinitionId = ?')
            .get(itemId)?.count ?? 0
        )
      : 0;
    if (linkedCount > 0) {
      return res.status(409).json({ error: "Cannot delete item definition linked to character inventory" });
    }

    runInTransaction(() => {
      sqlite.prepare('DELETE FROM "ItemSlotRule" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemAttack" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemModifier" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemFeature" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemDefinition" WHERE id = ?').run(itemId);
    });

    return res.status(204).end();
  });

  app.get("/api/characters/:slug/inventory-items", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const items = readCharacterInventoryItemsBySlug(slug);
    if (items === null) {
      return res.status(404).json({ error: "Character not found" });
    }
    return res.json(items);
  });

  app.post("/api/characters/:slug/inventory-items", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canEditCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const items = assignItemDefinitionToCharacter(slug, req.body ?? {}, req.user?.id ?? null);
      return res.status(201).json(items);
    } catch (error) {
      const message = String(error?.message ?? error);
      const status = /not found/i.test(message) ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.delete("/api/characters/:slug/inventory-items/:characterItemId", requireRole("dm"), (req, res) => {
    if (!tableExists("CharacterItem")) {
      return res.status(500).json({ error: "Character inventory not available" });
    }

    const character = sqlite
      .prepare('SELECT id, slug FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
      .get(req.params.slug);
    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }

    const characterItem = sqlite
      .prepare('SELECT id FROM "CharacterItem" WHERE id = ? AND characterId = ? LIMIT 1')
      .get(req.params.characterItemId, character.id);
    if (!characterItem) {
      return res.status(404).json({ error: "Character item not found" });
    }

    sqlite.prepare('DELETE FROM "CharacterItem" WHERE id = ?').run(characterItem.id);
    return res.status(204).end();
  });

  app.patch("/api/characters/:slug/inventory-items/:characterItemId", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canEditCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const item = updateCharacterInventoryItem(slug, req.params.characterItemId, req.body ?? {});
      if (!item) {
        return res.status(404).json({ error: "Character item not found" });
      }
      return res.json(item);
    } catch (error) {
      const message = String(error?.message ?? error);
      const status = /not found/i.test(message) ? 404 : /forbidden/i.test(message) ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  });

  // ===== Bestiary =====
  app.get("/api/monsters", requireRole("dm"), (req, res) => {
    const monsters = listMonsters().map((monster) => ({
      id: monster.id,
      slug: monster.slug,
      name: monster.general.name,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(monster.id),
      challengeRating: monster.general.challengeRating,
      size: monster.general.size,
      creatureType: monster.general.creatureType,
      typeLabel: monster.general.typeLabel || monster.general.creatureType,
      rarity: monster.rarity,
      alignment: monster.general.alignment,
      filePath: monster.filePath,
      armorClass: monster.combat.armorClass.value,
      hitPointsAverage: monster.combat.hitPoints.average,
      analysisDc: monster.analysisDc,
      researchDc: monster.researchDc,
      discoverSkill: monster.discoverSkill,
    }));

    return res.json(monsters);
  });

  app.get("/api/monsters/:monsterId", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const monster = readMonsterByRelativePath(relativePath);
    if (!monster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    return res.json({
      ...monster,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(monster.id),
    });
  });

  app.get("/api/player-compendium/monsters", requireAuth, (req, res) => {
    const knownStates = readKnownMonsterCompendiumStateById();
    const monsters = listMonsters()
      .filter((monster) => knownStates.has(monster.id))
      .map((monster) => buildPlayerCompendiumBasicSummary(monster, knownStates.get(monster.id)));

    return res.json(monsters);
  });

  app.get("/api/player-compendium/monsters/:monsterId", requireAuth, (req, res) => {
    const monsterId = req.params.monsterId;
    const knowledgeStateRow = tableExists("MonsterCompendiumEntry")
      ? sqlite
          .prepare(`
            SELECT knowledgeState
            FROM "MonsterCompendiumEntry"
            WHERE monsterId = ?
            LIMIT 1
          `)
          .get(monsterId)
      : null;

    const knowledgeState = knowledgeStateRow?.knowledgeState ?? "UNKNOWN";
    if (knowledgeState === "UNKNOWN") {
      return res.status(404).json({ error: "Monster not available in compendium" });
    }

    const relativePath = decodeMonsterId(monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const monster = readMonsterByRelativePath(relativePath);
    if (!monster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    if (knowledgeState === "COMPLETE") {
      return res.json({
        id: monster.id,
        knowledgeState,
        monster,
      });
    }

    return res.json({
      id: monster.id,
      knowledgeState: "BASIC",
      monster,
    });
  });

  app.get("/api/spells", requireAuth, (req, res) => {
    return res.json(readSpellsByClass());
  });

  app.get("/api/rules/skills", requireAuth, (req, res) => {
    return res.json(readSkills());
  });

  app.get("/api/rules/spell-slots", requireAuth, (req, res) => {
    return res.json(readSpellSlotProgressions());
  });

  app.put("/api/monsters/:monsterId", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const currentMonster = readMonsterByRelativePath(relativePath);
    if (!currentMonster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    const payload = req.body?.monster;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Monster payload required" });
    }

    const nextMonster = normalizeMonsterRecord(payload, currentMonster.id, relativePath);
    if (!nextMonster.general.name.trim()) {
      return res.status(400).json({ error: "Monster name required" });
    }

    sqlite.prepare(`
      UPDATE "Monster"
      SET
        slug = ?,
        name = ?,
        challengeRatingDisplay = ?,
        challengeRatingDecimal = ?,
        challengeRatingXp = ?,
        size = ?,
        creatureType = ?,
        rarity = ?,
        alignment = ?,
        data = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(
      nextMonster.slug || sanitizeSlug(nextMonster.general.name),
      nextMonster.general.name,
      nextMonster.general.challengeRating.display || null,
      nextMonster.general.challengeRating.decimal,
      nextMonster.general.challengeRating.xp,
      nextMonster.general.size || null,
      nextMonster.general.creatureType || nextMonster.general.typeLabel || null,
      nextMonster.rarity || null,
      nextMonster.general.alignment || null,
      JSON.stringify({
        slug: nextMonster.slug || sanitizeSlug(nextMonster.general.name),
        general: nextMonster.general,
        combat: nextMonster.combat,
        abilities: nextMonster.abilities,
        details: nextMonster.details,
        traits: nextMonster.traits,
        actions: nextMonster.actions,
        bonusActions: nextMonster.bonusActions,
        reactions: nextMonster.reactions,
        legendaryActions: nextMonster.legendaryActions,
        lairActions: nextMonster.lairActions,
        regionalEffects: nextMonster.regionalEffects,
        notes: nextMonster.notes,
        source: nextMonster.source,
      }),
      new Date().toISOString(),
      nextMonster.id
    );

    const savedMonster = readMonsterByRelativePath(relativePath);
    return res.json({
      ...savedMonster,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(savedMonster.id),
    });
  });

  app.post("/api/monsters", requireRole("dm"), (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const duplicateFromId = typeof req.body?.duplicateFromId === "string" ? req.body.duplicateFromId : null;

    if (!name) {
      return res.status(400).json({ error: "Monster name required" });
    }

    let nextMonster = createEmptyMonster(name);
    if (duplicateFromId) {
      const sourceRelativePath = decodeMonsterId(duplicateFromId);
      if (!sourceRelativePath) {
        return res.status(400).json({ error: "Invalid source monster id" });
      }

      const sourceMonster = readMonsterByRelativePath(sourceRelativePath);
      if (!sourceMonster) {
        return res.status(404).json({ error: "Source monster not found" });
      }

      nextMonster = normalizeMonsterRecord(
        {
          ...sourceMonster,
          slug: sanitizeSlug(name),
          general: {
            ...sourceMonster.general,
            name,
          },
        },
        "",
        ""
      );
    } else {
      nextMonster.general.name = name;
      nextMonster.slug = sanitizeSlug(name);
    }

    const fileName = createUniqueMonsterFileName(name);
    const relativePath = `custom/${fileName}`;
    const now = new Date().toISOString();
    const monsterId = encodeMonsterId(relativePath);

    sqlite.prepare(`
      INSERT INTO "Monster" (
        id, slug, name, sourceType, sourceFile, challengeRatingDisplay, challengeRatingDecimal,
        challengeRatingXp, size, creatureType, rarity, alignment, data, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      monsterId,
      nextMonster.slug || sanitizeSlug(name),
      nextMonster.general.name,
      "CUSTOM",
      relativePath,
      nextMonster.general.challengeRating.display || null,
      nextMonster.general.challengeRating.decimal,
      nextMonster.general.challengeRating.xp,
      nextMonster.general.size || null,
      nextMonster.general.creatureType || nextMonster.general.typeLabel || null,
      nextMonster.rarity || null,
      nextMonster.general.alignment || null,
      JSON.stringify({
        slug: nextMonster.slug || sanitizeSlug(name),
        general: nextMonster.general,
        combat: nextMonster.combat,
        abilities: nextMonster.abilities,
        details: nextMonster.details,
        traits: nextMonster.traits,
        actions: nextMonster.actions,
        bonusActions: nextMonster.bonusActions,
        reactions: nextMonster.reactions,
        legendaryActions: nextMonster.legendaryActions,
        lairActions: nextMonster.lairActions,
        regionalEffects: nextMonster.regionalEffects,
        notes: nextMonster.notes,
        source: nextMonster.source,
      }),
      now,
      now
    );

    if (tableExists("MonsterCompendiumEntry")) {
      sqlite.prepare(`
        INSERT OR IGNORE INTO "MonsterCompendiumEntry" (
          monsterId, knowledgeState, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?)
      `).run(
        monsterId,
        "UNKNOWN",
        now,
        now
      );
    }

    const createdMonster = readMonsterByRelativePath(relativePath);
    return res.status(201).json({
      ...createdMonster,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(createdMonster.id),
    });
  });

  app.put("/api/monsters/:monsterId/compendium-knowledge", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const monster = readMonsterByRelativePath(relativePath);
    if (!monster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    if (!tableExists("MonsterCompendiumEntry")) {
      return res.status(500).json({ error: "Monster compendium not available" });
    }

    const knowledgeState = String(req.body?.knowledgeState ?? "UNKNOWN").toUpperCase();
    if (!["UNKNOWN", "BASIC", "COMPLETE"].includes(knowledgeState)) {
      return res.status(400).json({ error: "Invalid knowledge state" });
    }

    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO "MonsterCompendiumEntry" (
        monsterId, knowledgeState, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(monsterId) DO UPDATE SET
        knowledgeState = excluded.knowledgeState,
        updatedAt = excluded.updatedAt
    `).run(monster.id, knowledgeState, now, now);

    return res.json({ monsterId: monster.id, knowledgeState });
  });

  app.delete("/api/monsters/:monsterId", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const currentMonster = readMonsterByRelativePath(relativePath);
    if (!currentMonster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    if (!columnExists("Monster", "archivedAt")) {
      return res.status(500).json({ error: "Monster archive not available" });
    }

    sqlite.prepare(`
      UPDATE "Monster"
      SET archivedAt = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      new Date().toISOString(),
      new Date().toISOString(),
      currentMonster.id
    );

    return res.status(204).end();
  });

  // ===== Encounter scenarios =====
  app.get("/api/encounter-scenarios", requireRole("dm"), (req, res) => {
    const scenarios = readEncounterScenarios()
      .filter((scenario) => scenario && typeof scenario === "object" && typeof scenario.id === "string")
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" }));

    return res.json(scenarios);
  });

  app.post("/api/encounter-scenarios", requireRole("dm"), (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

    if (!name) {
      return res.status(400).json({ error: "Scenario name required" });
    }

    if (entries.length === 0) {
      return res.status(400).json({ error: "Scenario entries required" });
    }

    const normalizedEntries = [];
    for (const entry of entries) {
      const type = entry?.type === "bestiary" ? "bestiary" : "manual";
      const count = Math.max(1, parseInt(entry?.count, 10) || 1);

      if (type === "bestiary") {
        const monsterId = typeof entry?.monsterId === "string" ? entry.monsterId : "";
        const hitPoints = parseInt(entry?.hitPoints, 10);
        const relativePath = decodeMonsterId(monsterId);
        const monster = relativePath ? readMonsterByRelativePath(relativePath) : null;
        if (!monster) {
          return res.status(400).json({ error: "Invalid bestiary monster in scenario" });
        }

        const normalizedHitPoints = Number.isFinite(hitPoints)
          ? Math.max(0, hitPoints)
          : monster.combat.hitPoints.average;
        const powerTag = classifyMonsterPowerTag(
          normalizedHitPoints,
          parseMonsterHitPointRange(monster.combat.hitPoints.formula, monster.combat.hitPoints.average)
        );

        normalizedEntries.push({
          type: "bestiary",
          monsterId: monster.id,
          name: monster.general.name,
          hitPoints: normalizedHitPoints,
          powerTag,
          count,
        });
        continue;
      }

      const manualName = String(entry?.name ?? "").trim();
      const armorClass = parseInt(entry?.armorClass, 10);
      const hitPoints = parseInt(entry?.hitPoints, 10);
      if (!manualName) {
        return res.status(400).json({ error: "Manual scenario entry requires a name" });
      }

      normalizedEntries.push({
        type: "manual",
        name: manualName,
        armorClass: Number.isFinite(armorClass) ? armorClass : 0,
        hitPoints: Number.isFinite(hitPoints) ? Math.max(0, hitPoints) : 0,
        count,
      });
    }

    const scenarios = readEncounterScenarios();
    const scenario = {
      id: createScenarioId(name),
      name,
      entries: normalizedEntries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    scenarios.push(scenario);
    writeEncounterScenarios(scenarios);
    return res.status(201).json(scenario);
  });

  app.delete("/api/encounter-scenarios/:scenarioId", requireRole("dm"), (req, res) => {
    const scenarioId = req.params.scenarioId;
    const scenarios = readEncounterScenarios();
    const nextScenarios = scenarios.filter((scenario) => scenario.id !== scenarioId);
    if (nextScenarios.length === scenarios.length) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    writeEncounterScenarios(nextScenarios);
    return res.status(204).end();
  });

  // ===== Characters =====
  app.get("/api/characters", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const characters = listCharacters().filter((character) =>
      canAccessCharacter(req.user, character.slug, ownership)
    );

    return res.json(characters);
  });

  app.get("/api/characters/:slug", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();

    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const state = readCharacter(slug);
    if (!state) return res.status(404).json({ error: "Character not found" });
    return res.json(state);
  });

  app.post("/api/characters", requireAuth, (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const requestedType = req.body?.characterType === "png" ? "png" : "pg";
    const className = String(req.body?.className ?? "").trim();
    const race = String(req.body?.race ?? "").trim();
    const alignment = String(req.body?.alignment ?? "").trim();
    const background = String(req.body?.background ?? "").trim();

    if (!name) {
      return res.status(400).json({ error: "Name required" });
    }

    if (!className || !race || !alignment || !background) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const characterType = req.user.role === "dm" ? requestedType : "pg";
    const baseSlug = sanitizeSlug(name);
    const slug = createUniqueCharacterSlug(baseSlug);

    let ownerUserId = null;
    if (req.user.role === "dm") {
      if (characterType === "png") ownerUserId = req.user.id;
    } else {
      ownerUserId = req.user.id;
    }

    const ownerUser = ownerUserId ? getUserById(ownerUserId) : null;
    const character = createEmptyCharacter({
      slug,
      name,
      characterType,
      className,
      race,
      alignment,
      background,
      creator: req.user,
      ownerUser,
    });

    writeCharacter(slug, character);

    if (ownerUserId) {
      const ownership = readOwnership();
      ownership[slug] = ownerUserId;
      writeOwnership(ownership);
    }

    return res.status(201).json({
      slug,
      characterType,
      ownerUserId,
      character,
    });
  });

  app.delete("/api/characters/:slug", requireRole("dm"), (req, res) => {
    const slug = req.params.slug;

    if (!listCharacterSlugs().includes(slug)) {
      return res.status(404).json({ error: "Character not found" });
    }

    const archivedPath = archiveCharacter(slug);
    if (!archivedPath) {
      return res.status(500).json({ error: "Archive failed" });
    }

    const ownership = readOwnership();
    if (slug in ownership) {
      delete ownership[slug];
      writeOwnership(ownership);
    }

    const chats = readChats();
    if (slug in chats) {
      delete chats[slug];
      writeChats(chats);
    }

    return res.status(204).end();
  });

  app.post("/api/uploads/avatar", requireAuth, (req, res) => {
    const { slug, fileName, contentType, data } = req.body ?? {};
    const ext = extensionFromType(contentType, fileName);
    const normalizedSlug = sanitizeSlug(slug);
    const ownership = readOwnership();

    if (!normalizedSlug || !data || !ext) {
      return res.status(400).json({ error: "Invalid upload payload" });
    }

    if (!canEditCharacter(req.user, normalizedSlug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    let buffer;
    try {
      buffer = Buffer.from(String(data), "base64");
    } catch {
      return res.status(400).json({ error: "Invalid image encoding" });
    }

    if (!buffer?.length) {
      return res.status(400).json({ error: "Empty image payload" });
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: "Image too large" });
    }

    const fileBase = `${normalizedSlug}-${Date.now()}.${ext}`;
    const filePath = path.join(PORTRAIT_DIR, fileBase);

    try {
      fs.writeFileSync(filePath, buffer);
      return res.json({ url: `/portraits/${fileBase}` });
    } catch (error) {
      console.error("[server] avatar upload failed:", error);
      return res.status(500).json({ error: "Upload failed" });
    }
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // ===== Presence state =====
  const viewersBySlug = new Map();
  const slugBySocket = new Map();

  const broadcastPresence = () => {
    const payload = Array.from(viewersBySlug.entries())
      .map(([slug, set]) => ({ slug, count: set.size }))
      .filter(({ count }) => count > 0);
    io.emit("presence:update", payload);
  };

  function getSocketUser(socket) {
    const cookies = parseCookies(socket.request.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    const session = getSessionById(sessionId);
    if (sessionId && session) touchSession(sessionId);
    return session?.userId ? getUserById(session.userId) : null;
  }

  io.on("connection", (socket) => {
    const user = getSocketUser(socket);
    socket.data.user = user;
    if (user?.id) {
      socket.join(`user:${user.id}`);
    }

    socket.on("character:join", (slug) => {
      const ownership = readOwnership();
      if (!canAccessCharacter(socket.data.user, slug, ownership)) return;

      socket.join(`char:${slug}`);
      const state = readCharacter(slug);
      if (state) socket.emit("character:state", state);
    });

    socket.on("character:update", ({ slug, patch }) => {
      if (!slug || !patch) return;

      const ownership = readOwnership();
      if (!canEditCharacter(socket.data.user, slug, ownership)) return;

      const current = readCharacter(slug) || {};
      const next = deepMerge(current, patch);
      scheduleWrite(slug, next);
      socket.to(`char:${slug}`).emit("character:patch", { slug, patch });
      socket.emit("character:state", next);
    });

    socket.on("dm:private-message", ({ slug, title, message }) => {
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const normalizedMessage = typeof message === "string" ? message.trim() : "";
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      const ownership = readOwnership();

      if (socket.data.user?.role !== "dm" || !normalizedSlug || !normalizedMessage) return;

      const ownerUserId = ownership[normalizedSlug];
      if (!ownerUserId) return;

      io.to(`user:${ownerUserId}`).emit("dm:private-message", {
        slug: normalizedSlug,
        title: normalizedTitle || undefined,
        message: normalizedMessage,
        sentAt: new Date().toISOString(),
      });
    });

    socket.on("chat:join", (slug) => {
      const ownership = readOwnership();
      if (!slug || !canAccessCharacter(socket.data.user, slug, ownership)) return;
      socket.join(`chat:${slug}`);
    });

    socket.on("chat:message", ({ slug, text }) => {
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const normalizedText = typeof text === "string" ? text.trim() : "";
      const ownership = readOwnership();

      if (!normalizedSlug || !normalizedText || !canAccessCharacter(socket.data.user, normalizedSlug, ownership)) {
        return;
      }

      const chats = readChats();
      const nextMessage = {
        id: crypto.randomUUID(),
        slug: normalizedSlug,
        senderUserId: socket.data.user.id,
        senderRole: socket.data.user.role,
        senderName: socket.data.user.displayName ?? socket.data.user.username,
        text: normalizedText,
        createdAt: new Date().toISOString(),
      };

      const thread = Array.isArray(chats[normalizedSlug]) ? chats[normalizedSlug] : [];
      chats[normalizedSlug] = [...thread, nextMessage];
      writeChats(chats);

      io.to(`chat:${normalizedSlug}`).emit("chat:message", nextMessage);
    });

    socket.on("initiative:turn-start", ({ slug }) => {
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const ownership = readOwnership();

      if (socket.data.user?.role !== "dm" || !normalizedSlug) return;

      const ownerUserId = ownership[normalizedSlug];
      if (!ownerUserId) return;

      io.to(`user:${ownerUserId}`).emit("initiative:turn-start", {
        slug: normalizedSlug,
        startedAt: new Date().toISOString(),
      });
    });

    socket.on("presence:snapshot", () => {
      const payload = Array.from(viewersBySlug.entries())
        .map(([slug, set]) => ({ slug, count: set.size }))
        .filter(({ count }) => count > 0);
      socket.emit("presence:update", payload);
    });

    socket.on("presence:enter", ({ slug }) => {
      const ownership = readOwnership();
      if (!slug || !canAccessCharacter(socket.data.user, slug, ownership)) return;
      if (!viewersBySlug.has(slug)) viewersBySlug.set(slug, new Set());
      viewersBySlug.get(slug).add(socket.id);
      slugBySocket.set(socket.id, slug);
      broadcastPresence();
    });

    socket.on("presence:leave", () => {
      const slug = slugBySocket.get(socket.id);
      if (!slug) return;
      const set = viewersBySlug.get(slug);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) viewersBySlug.delete(slug);
      }
      slugBySocket.delete(socket.id);
      broadcastPresence();
    });

    socket.on("disconnect", () => {
      const slug = slugBySocket.get(socket.id);
      if (!slug) return;
      const set = viewersBySlug.get(slug);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) viewersBySlug.delete(slug);
      }
      slugBySocket.delete(socket.id);
      broadcastPresence();
    });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res) => {
      try {
        const url = req.originalUrl;
        const html = await vite.transformIndexHtml(
          url,
          fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8")
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace?.(e);
        console.error(e);
        res.status(500).end(e.message);
      }
    });
  } else {
    app.use(compression());
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist/index.html"));
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);

    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(` -> Network: http://${net.address}:${PORT}`);
        }
      }
    }
  });
}

start();
