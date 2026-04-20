import type { CharacterInventoryItemEntry, ItemDefinitionEntry } from "@/lib/auth";
import {
  calculateSkillValues,
  isPassiveTriggerActive,
  resolveCharacterAbilityScores,
  resolvePassiveEffectScalarValue,
} from "@/utils";

type CharacterState = Record<string, any>;

const SPELLCASTING_ABILITY_BY_CLASS: Record<string, string> = {
  bardo: "charisma",
  bard: "charisma",
  chierico: "wisdom",
  cleric: "wisdom",
  druido: "wisdom",
  druid: "wisdom",
  mago: "intelligence",
  wizard: "intelligence",
  stregone: "charisma",
  sorcerer: "charisma",
  warlock: "charisma",
  paladino: "charisma",
  paladin: "charisma",
  ranger: "wisdom",
};

const ABILITY_ORDER = [
  { key: "strength", label: "For" },
  { key: "dexterity", label: "Des" },
  { key: "constitution", label: "Cos" },
  { key: "intelligence", label: "Int" },
  { key: "wisdom", label: "Sag" },
  { key: "charisma", label: "Car" },
] as const;

function abilityModifier(score: number | undefined) {
  const safeScore = typeof score === "number" ? score : 10;
  return Math.floor((safeScore - 10) / 2);
}

function proficiencyBonus(level: number | undefined) {
  const safeLevel = Math.max(1, typeof level === "number" ? level : 1);
  return Math.ceil(safeLevel / 4) + 1;
}

function buildDerivedItemPassiveCapabilities(
  relationalInventoryItems: CharacterInventoryItemEntry[],
  itemDefinitionsById: Record<string, ItemDefinitionEntry>
) {
  return relationalInventoryItems.flatMap((item) => {
    if (!item?.isEquipped || !item?.itemDefinitionId) return [];
    const detail = itemDefinitionsById[item.itemDefinitionId];
    if (!detail || !Array.isArray(detail.features)) return [];

    return detail.features
      .filter((feature) => String(feature?.kind ?? "").toUpperCase() === "PASSIVE")
      .map((feature) => ({
        kind: "passive",
        passiveEffects: Array.isArray(feature.passiveEffects) ? feature.passiveEffects : [],
        sourceLabel: item.itemName,
      }));
  });
}

function buildPassiveEffectContext(
  relationalInventoryItems: CharacterInventoryItemEntry[],
  itemDefinitionsById: Record<string, ItemDefinitionEntry>
) {
  const equippedItems = relationalInventoryItems.filter((item) => item?.isEquipped && item?.itemDefinitionId);
  const hasArmorEquipped = equippedItems.some((item) => {
    if (!item?.itemDefinitionId) return false;
    return itemDefinitionsById[item.itemDefinitionId]?.category === "ARMOR";
  });
  const hasShieldEquipped = equippedItems.some((item) => {
    if (!item?.itemDefinitionId) return false;
    return itemDefinitionsById[item.itemDefinitionId]?.category === "SHIELD";
  });
  const equippedWeapons = equippedItems.filter((item) => {
    if (!item?.itemDefinitionId) return false;
    return itemDefinitionsById[item.itemDefinitionId]?.category === "WEAPON";
  });
  const primaryHandWeapon = equippedWeapons.find((item) => item.equippedSlots?.includes("WEAPON_HAND_RIGHT"));
  const secondaryHandWeapon = equippedWeapons.find((item) => item.equippedSlots?.includes("WEAPON_HAND_LEFT"));
  const hasDualWielding =
    !!primaryHandWeapon?.id &&
    !!secondaryHandWeapon?.id &&
    primaryHandWeapon.id !== secondaryHandWeapon.id;
  const twoHandedWeapon = equippedWeapons.find((item) => {
    const slots = Array.isArray(item.equippedSlots) ? item.equippedSlots : [];
    if (!slots.includes("WEAPON_HAND_RIGHT") || !slots.includes("WEAPON_HAND_LEFT")) return false;
    const detail = item.itemDefinitionId ? itemDefinitionsById[item.itemDefinitionId] : undefined;
    return detail?.weaponHandling === "TWO_HANDED" || detail?.weaponHandling === "VERSATILE";
  });
  const singleHandWeapon =
    primaryHandWeapon && primaryHandWeapon.id === secondaryHandWeapon?.id
      ? null
      : primaryHandWeapon ?? secondaryHandWeapon ?? null;
  const hasExactlyOneWeaponEquipped = equippedWeapons.length === 1 && !!singleHandWeapon;
  const hasSingleMeleeWeaponEquipped = Boolean(
    hasExactlyOneWeaponEquipped &&
    !hasShieldEquipped &&
    singleHandWeapon?.itemDefinitionId &&
    itemDefinitionsById[singleHandWeapon.itemDefinitionId]?.attacks?.some((attack) => attack.kind === "MELEE_WEAPON")
  );

  return {
    hasArmorEquipped,
    hasShieldEquipped,
    hasSingleMeleeWeaponEquipped,
    hasDualWielding,
    hasTwoHandedWeaponEquipped: !!twoHandedWeapon,
  };
}

function getFlatEquippedModifiers(
  relationalInventoryItems: CharacterInventoryItemEntry[],
  itemDefinitionsById: Record<string, ItemDefinitionEntry>,
  target: string
) {
  return relationalInventoryItems.reduce((total, item) => {
    if (!item?.isEquipped || !item?.itemDefinitionId) return total;
    const detail = itemDefinitionsById[item.itemDefinitionId];
    if (!detail) return total;

    const itemBonus = (detail.modifiers ?? []).reduce((sum, modifier) => {
      if (modifier.target !== target) return sum;
      if (modifier.type !== "FLAT") return sum;
      if (modifier.condition !== "WHILE_EQUIPPED" && modifier.condition !== "ALWAYS") return sum;
      return sum + (modifier.value ?? 0);
    }, 0);

    return total + itemBonus;
  }, 0);
}

function getArmorClassBaseFromArmor(
  detail: ItemDefinitionEntry | undefined,
  dexModifier: number
) {
  if (!detail || detail.category !== "ARMOR") {
    return 10 + dexModifier;
  }

  const base = detail.armorClassBase ?? 10;

  switch (detail.armorClassCalculation) {
    case "BASE_PLUS_DEX":
      return base + dexModifier;
    case "BASE_PLUS_DEX_MAX_2":
      return base + Math.min(dexModifier, 2);
    case "BASE_ONLY":
      return base;
    case "BONUS_ONLY":
      return base + (detail.armorClassBonus ?? 0);
    default:
      return base + dexModifier;
  }
}

function getShieldBonus(detail: ItemDefinitionEntry | undefined) {
  if (!detail || detail.category !== "SHIELD") return 0;
  return detail.armorClassBonus ?? 0;
}

function getCapabilityBonus(
  state: CharacterState,
  passiveCapabilities: any[],
  passiveEffectContext: Record<string, boolean>,
  resolvedAbilityScores: Record<string, number>,
  target: string
) {
  return passiveCapabilities.reduce((total, capability) => {
    if (String(capability?.kind ?? "").toLowerCase() !== "passive") return total;
    if (!Array.isArray(capability?.passiveEffects)) return total;

    return total + capability.passiveEffects.reduce((sum: number, effect: any) => {
      if (String(effect?.target ?? "").trim().toUpperCase() !== target) return sum;
      if (!isPassiveTriggerActive(effect?.trigger, passiveEffectContext)) return sum;
      const value = resolvePassiveEffectScalarValue(effect, state, resolvedAbilityScores);
      if (!Number.isFinite(value) || value === 0) return sum;
      return sum + value;
    }, 0);
  }, 0);
}

export function getResolvedCharacterRuntime(
  state: CharacterState,
  relationalInventoryItems: CharacterInventoryItemEntry[] = [],
  itemDefinitionsById: Record<string, ItemDefinitionEntry> = {}
) {
  const passiveCapabilities = [
    ...((Array.isArray(state?.capabilities) ? state.capabilities : []) as any[]),
    ...buildDerivedItemPassiveCapabilities(relationalInventoryItems, itemDefinitionsById),
  ];
  const passiveEffectContext = buildPassiveEffectContext(relationalInventoryItems, itemDefinitionsById);
  const resolvedAbilityData = resolveCharacterAbilityScores(state, passiveCapabilities, passiveEffectContext);

  return {
    passiveCapabilities,
    passiveEffectContext,
    resolvedAbilityScores: resolvedAbilityData.scores,
  };
}

export function getDerivedArmorClass(
  state: CharacterState,
  relationalInventoryItems: CharacterInventoryItemEntry[] = [],
  itemDefinitionsById: Record<string, ItemDefinitionEntry> = {}
) {
  const { passiveCapabilities, passiveEffectContext, resolvedAbilityScores } = getResolvedCharacterRuntime(
    state,
    relationalInventoryItems,
    itemDefinitionsById
  );
  const dexModifier = abilityModifier(resolvedAbilityScores.dexterity);
  const equippedDetails = relationalInventoryItems
    .filter((item) => item?.isEquipped && item?.itemDefinitionId)
    .map((item) => (item.itemDefinitionId ? itemDefinitionsById[item.itemDefinitionId] : undefined))
    .filter((detail): detail is ItemDefinitionEntry => !!detail);
  const equippedArmor = equippedDetails.find((detail) => detail.category === "ARMOR") ?? undefined;
  const equippedShields = equippedDetails.filter((detail) => detail.category === "SHIELD");
  const baseArmorClass = getArmorClassBaseFromArmor(equippedArmor, dexModifier);
  const shieldBonus = equippedShields.reduce((total, detail) => total + getShieldBonus(detail), 0);
  const itemBonus = getFlatEquippedModifiers(relationalInventoryItems, itemDefinitionsById, "ARMOR_CLASS");
  const capabilityBonus = getCapabilityBonus(
    state,
    passiveCapabilities,
    passiveEffectContext,
    resolvedAbilityScores,
    "ARMOR_CLASS"
  );

  return baseArmorClass + shieldBonus + itemBonus + capabilityBonus;
}

export function getDerivedInitiativeBonus(
  state: CharacterState,
  relationalInventoryItems: CharacterInventoryItemEntry[] = [],
  itemDefinitionsById: Record<string, ItemDefinitionEntry> = {}
) {
  const { passiveCapabilities, passiveEffectContext, resolvedAbilityScores } = getResolvedCharacterRuntime(
    state,
    relationalInventoryItems,
    itemDefinitionsById
  );
  const dexModifier = abilityModifier(resolvedAbilityScores.dexterity);
  const itemBonus = getFlatEquippedModifiers(relationalInventoryItems, itemDefinitionsById, "INITIATIVE");
  const capabilityBonus = getCapabilityBonus(
    state,
    passiveCapabilities,
    passiveEffectContext,
    resolvedAbilityScores,
    "INITIATIVE"
  );

  return dexModifier + itemBonus + capabilityBonus;
}

export function getDerivedAbilityBonuses(
  state: CharacterState,
  relationalInventoryItems: CharacterInventoryItemEntry[] = [],
  itemDefinitionsById: Record<string, ItemDefinitionEntry> = {}
) {
  const { resolvedAbilityScores } = getResolvedCharacterRuntime(state, relationalInventoryItems, itemDefinitionsById);

  return ABILITY_ORDER.map(({ key, label }) => ({
    label,
    value: abilityModifier(resolvedAbilityScores?.[key]),
  }));
}

export function getDerivedSpellSaveDc(
  state: CharacterState,
  relationalInventoryItems: CharacterInventoryItemEntry[] = [],
  itemDefinitionsById: Record<string, ItemDefinitionEntry> = {}
) {
  const normalizedClass = (state?.basicInfo?.class ?? "").trim().toLowerCase();
  const spellcastingAbility = SPELLCASTING_ABILITY_BY_CLASS[normalizedClass];
  if (!spellcastingAbility) return null;

  const { resolvedAbilityScores } = getResolvedCharacterRuntime(state, relationalInventoryItems, itemDefinitionsById);
  return 8 + proficiencyBonus(state?.basicInfo?.level) + abilityModifier(resolvedAbilityScores?.[spellcastingAbility]);
}

export function getDerivedPassivePerception(
  state: CharacterState,
  relationalInventoryItems: CharacterInventoryItemEntry[] = [],
  itemDefinitionsById: Record<string, ItemDefinitionEntry> = {}
) {
  const { passiveCapabilities, passiveEffectContext, resolvedAbilityScores } = getResolvedCharacterRuntime(
    state,
    relationalInventoryItems,
    itemDefinitionsById
  );
  const perceptionSkill = calculateSkillValues(state, state?.proficiencies?.skills ?? [], {
    passiveCapabilities,
    passiveEffectContext,
    resolvedAbilityScores,
  }).find(
    (skill: any) =>
      typeof skill?.name === "string" &&
      ["percezione", "perception"].includes(skill.name.toLowerCase())
  );

  return 10 + Number(perceptionSkill?.value ?? abilityModifier(resolvedAbilityScores?.wisdom));
}
