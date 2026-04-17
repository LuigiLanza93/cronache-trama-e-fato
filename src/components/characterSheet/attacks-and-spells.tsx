import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  ChevronDown,
  ChevronUp,
  Repeat,
  Hand,
  Shirt,
  ShieldOff,
  Shield,
  Sparkles,
  Sword,
  Footprints,
  Gem,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SectionCard from "@/components/characterSheet/section-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/sonner";
import {
  fetchItemDefinition,
  type CharacterInventoryItemEntry,
  type EquipResolutionDetails,
  type EquipResolutionOption,
  type ItemAttackEntry,
  type ItemDefinitionEntry,
} from "@/lib/auth";
import {
  proficiencyBonus as getProficiencyBonus,
  resolveCharacterAbilityScores,
  isPassiveTriggerActive,
  resolvePassiveEffectScalarValue,
} from "@/utils";

type SkillType = "volonta" | "incontro" | "riposoBreve" | "riposoLungo";

const LABELS: Record<SkillType, string> = {
  volonta: "Volontà",
  incontro: "Incontro",
  riposoBreve: "Riposo Breve",
  riposoLungo: "Riposo Lungo",
};

const ABILITY_LABELS: Record<string, string> = {
  STRENGTH: "Forza",
  DEXTERITY: "Destrezza",
  CONSTITUTION: "Costituzione",
  INTELLIGENCE: "Intelligenza",
  WISDOM: "Saggezza",
  CHARISMA: "Carisma",
};

const SLOT_LABELS: Record<string, string> = {
  HANDS: "Mani",
  HEAD: "Testa",
  BACK: "Schiena",
  ARMOR: "Armatura",
  GLOVE_LEFT: "Guanto sinistro",
  GLOVE_RIGHT: "Guanto destro",
  NECK: "Collana",
  FEET: "Scarpe",
  WEAPON_HAND_RIGHT: "Mano principale",
  WEAPON_HAND_LEFT: "Mano secondaria",
  RINGS: "Anelli",
};

const SLOT_ORDER = [
  "HANDS",
  "HEAD",
  "ARMOR",
  "BACK",
  "NECK",
  "RINGS",
  "GLOVE_LEFT",
  "GLOVE_RIGHT",
  "FEET",
] as const;

function normalizeDisplaySlot(slot: string) {
  if (slot.startsWith("WEAPON_HAND_")) return "HANDS";
  return slot.startsWith("RING_") ? "RINGS" : slot;
}

function getEquipOptionLabel(option: EquipResolutionOption) {
  const slotLabel = option.slots
    .map((slot) => SLOT_LABELS[normalizeDisplaySlot(slot)] ?? slot)
    .join(" + ");
  const conflictLabel =
    option.conflicts.length > 0
      ? ` - sostituisce ${option.conflicts.map((conflict) => conflict.itemName).join(", ")}`
      : "";
  return `${slotLabel}${conflictLabel}`;
}

function getEquippedHandLabel(item: CharacterInventoryItemEntry) {
  const slots = Array.isArray(item.equippedSlots) ? item.equippedSlots : [];
  const inPrimaryHand = slots.includes("WEAPON_HAND_RIGHT");
  const inSecondaryHand = slots.includes("WEAPON_HAND_LEFT");

  if (inPrimaryHand && inSecondaryHand) return "Mano principale e secondaria";
  if (inPrimaryHand) return "Mano principale";
  if (inSecondaryHand) return "Mano secondaria";
  return null;
}

function parseLegacyDamage(s: string | undefined): { dice?: string; type?: string } {
  const src = (s ?? "").trim();
  if (!src) return {};
  const match = src.match(/^\s*([^\s]+)\s+(tagliente|perforante|contundente)\s*$/i);
  if (match) return { dice: match[1], type: match[2].toLowerCase() };
  return { dice: src };
}

function buildLegacyAttackDetail(attack: any): string {
  const bonus = `+${attack.attackBonus}`;
  const diceNew: string | undefined = attack.damageDice;
  const typeNew: string | undefined = attack.damageType;
  const cat: "melee" | "ranged" | undefined = attack.category;
  const hands =
    cat === "melee" && attack.hands
      ? attack.hands === "1"
        ? " - Una mano"
        : attack.hands === "2"
          ? " - Due mani"
          : " - Versatile"
      : "";
  const range = cat === "ranged" && attack.range ? ` - Gittata ${attack.range}` : "";

  const legacy = parseLegacyDamage(attack.damageType);
  const dice = diceNew ?? legacy.dice ?? "";
  const type = typeNew ?? legacy.type ?? "";
  const dmg = [dice, type].filter(Boolean).join(" ");
  return `${bonus} - ${dmg}${hands}${range}`;
}

function getAttackKindLabel(kind: string | null | undefined) {
  switch (kind) {
    case "MELEE_WEAPON":
      return "Mischia";
    case "RANGED_WEAPON":
      return "Distanza";
    case "THROWN":
      return "Lancio";
    case "SPECIAL":
      return "Speciale";
    default:
      return "Attacco";
  }
}

function getHandRequirementLabel(requirement: string | null | undefined) {
  switch (requirement) {
    case "ONE_HANDED":
      return "Una mano";
    case "TWO_HANDED":
      return "Due mani";
    case "ANY":
      return "Qualsiasi impugnatura";
    default:
      return null;
  }
}

function getWeaponHandlingLabel(handling: string | null | undefined) {
  switch (handling) {
    case "ONE_HANDED":
      return "A una mano";
    case "TWO_HANDED":
      return "A due mani";
    case "VERSATILE":
      return "Versatile";
    default:
      return null;
  }
}

function getArmorClassSummary(detail?: ItemDefinitionEntry) {
  if (!detail) return null;

  if (detail.armorCategory === "SHIELD" && detail.armorClassBonus) {
    return `CA +${detail.armorClassBonus}`;
  }

  if (detail.armorClassBase === null || detail.armorClassBase === undefined) {
    return null;
  }

  switch (detail.armorClassCalculation) {
    case "BASE_PLUS_DEX":
      return `CA ${detail.armorClassBase} + DES`;
    case "BASE_PLUS_DEX_MAX_2":
      return `CA ${detail.armorClassBase} + DES (max 2)`;
    case "BASE_ONLY":
      return `CA ${detail.armorClassBase}`;
    case "BONUS_ONLY":
      return detail.armorClassBonus ? `CA +${detail.armorClassBonus}` : null;
    default:
      return `CA ${detail.armorClassBase}`;
  }
}

function normalizeAbilityKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized in ABILITY_LABELS) return normalized;
  switch (normalized) {
    case "STR":
      return "STRENGTH";
    case "DEX":
      return "DEXTERITY";
    case "CON":
      return "CONSTITUTION";
    case "INT":
      return "INTELLIGENCE";
    case "WIS":
      return "WISDOM";
    case "CHA":
      return "CHARISMA";
    default:
      return null;
  }
}

function getAbilityModifier(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function parseDiceExpressionParts(value: string | null | undefined) {
  const source = (value ?? "").trim();
  if (!source) {
    return { dicePart: "?", flatBonus: 0 };
  }

  const match = source.match(/^(.+?)([+-]\d+)$/);
  if (!match) {
    return { dicePart: source, flatBonus: 0 };
  }

  return {
    dicePart: match[1].trim(),
    flatBonus: Number(match[2]),
  };
}

function getDefaultAbilityForAttackKind(kind: string | null | undefined) {
  switch (kind) {
    case "MELEE_WEAPON":
    case "THROWN":
      return "STRENGTH";
    case "RANGED_WEAPON":
      return "DEXTERITY";
    default:
      return null;
  }
}

function getAttackRollPassiveBonus(
  attack: ItemAttackEntry,
  characterData: any,
  resolvedAbilityScores: Record<string, number>,
  passiveCapabilities: any[],
  passiveEffectContext: any,
  options?: {
    isUnarmedAttack?: boolean;
  }
) {
  const kind = String(attack?.kind ?? "").trim().toUpperCase();
  const specificTargets = new Set<string>(["ATTACK_ROLL"]);
  if (options?.isUnarmedAttack) {
    specificTargets.add("UNARMED_ATTACK_ROLL");
  }
  const specificTarget =
    kind === "MELEE_WEAPON"
      ? "MELEE_ATTACK_ROLL"
      : kind === "RANGED_WEAPON" || kind === "THROWN"
        ? "RANGED_ATTACK_ROLL"
        : null;
  if (specificTarget) {
    specificTargets.add(specificTarget);
  }

  return (Array.isArray(passiveCapabilities) ? passiveCapabilities : []).reduce(
    (total: number, capability: any) => {
      if (String(capability?.kind ?? "").toLowerCase() !== "passive") return total;
      if (!Array.isArray(capability?.passiveEffects)) return total;

      return total + capability.passiveEffects.reduce((sum: number, effect: any) => {
        if (!isPassiveTriggerActive(effect?.trigger, passiveEffectContext)) return sum;
        const target = String(effect?.target ?? "").trim().toUpperCase();
        if (!specificTargets.has(target)) return sum;

        const value = resolvePassiveEffectScalarValue(effect, characterData, resolvedAbilityScores);
        if (!Number.isFinite(value) || value === 0) return sum;
        return sum + value;
      }, 0);
    },
    0
  );
}

function getDamageRollPassiveBonus(
  attack: ItemAttackEntry,
  characterData: any,
  resolvedAbilityScores: Record<string, number>,
  passiveCapabilities: any[],
  passiveEffectContext: any,
  options: {
    isOffHandAttack: boolean;
    isUnarmedAttack?: boolean;
  }
) {
  const kind = String(attack?.kind ?? "").trim().toUpperCase();
  const specificTargets = new Set<string>(["DAMAGE_ROLL"]);
  if (kind === "MELEE_WEAPON") specificTargets.add("MELEE_DAMAGE_ROLL");
  if (kind === "RANGED_WEAPON" || kind === "THROWN") specificTargets.add("RANGED_DAMAGE_ROLL");
  if (options.isUnarmedAttack) specificTargets.add("UNARMED_DAMAGE_ROLL");
  if (options.isOffHandAttack) specificTargets.add("OFF_HAND_DAMAGE_ROLL");

  return (Array.isArray(passiveCapabilities) ? passiveCapabilities : []).reduce(
    (total: number, capability: any) => {
      if (String(capability?.kind ?? "").toLowerCase() !== "passive") return total;
      if (!Array.isArray(capability?.passiveEffects)) return total;

      return total + capability.passiveEffects.reduce((sum: number, effect: any) => {
        if (!isPassiveTriggerActive(effect?.trigger, passiveEffectContext)) return sum;
        const target = String(effect?.target ?? "").trim().toUpperCase();
        if (!specificTargets.has(target)) return sum;

        const value = resolvePassiveEffectScalarValue(effect, characterData, resolvedAbilityScores);
        if (!Number.isFinite(value) || value === 0) return sum;
        return sum + value;
      }, 0);
    },
    0
  );
}

function getWeaponHandAssignments(
  equippedRelationalItems: CharacterInventoryItemEntry[],
  itemDetailsById: Record<string, ItemDefinitionEntry>
) {
  const primaryWeaponItem = equippedRelationalItems.find((item) => {
    if (!item?.itemDefinitionId) return false;
    if (!item.equippedSlots?.includes("WEAPON_HAND_RIGHT")) return false;
    return itemDetailsById[item.itemDefinitionId]?.category === "WEAPON";
  });

  const secondaryWeaponItem = equippedRelationalItems.find((item) => {
    if (!item?.itemDefinitionId) return false;
    if (!item.equippedSlots?.includes("WEAPON_HAND_LEFT")) return false;
    return itemDetailsById[item.itemDefinitionId]?.category === "WEAPON";
  });

  return {
    primaryWeaponItemId: primaryWeaponItem?.id ?? null,
    secondaryWeaponItemId: secondaryWeaponItem?.id ?? null,
    hasDualWeapons:
      !!primaryWeaponItem?.id &&
      !!secondaryWeaponItem?.id &&
      primaryWeaponItem.id !== secondaryWeaponItem.id,
  };
}

function buildRelationalAttackMath(
  attack: ItemAttackEntry,
  characterData: any,
  resolvedAbilityScores: Record<string, number>,
  passiveCapabilities: any[],
  passiveEffectContext: any,
  options: {
    isOffHandAttack: boolean;
    isUnarmedAttack?: boolean;
  }
) {
  const abilityKey =
    normalizeAbilityKey(attack.ability) ?? getDefaultAbilityForAttackKind(attack.kind);
  const abilityScore =
    abilityKey
      ? resolvedAbilityScores[abilityKey.toLowerCase()] ??
        resolvedAbilityScores[abilityKey] ??
        null
      : null;
  const abilityModifier = getAbilityModifier(abilityScore);
  const proficiencyBonus =
    typeof characterData?.proficiencies?.proficiencyBonus === "number"
      ? characterData.proficiencies.proficiencyBonus
      : getProficiencyBonus(Number(characterData?.basicInfo?.level ?? 1));
  const weaponAttackBonus =
    attack.attackBonus !== null && attack.attackBonus !== undefined ? attack.attackBonus : 0;
  const passiveAttackBonus = getAttackRollPassiveBonus(
    attack,
    characterData,
    resolvedAbilityScores,
    passiveCapabilities,
    passiveEffectContext,
    options
  );
  const passiveDamageBonus = getDamageRollPassiveBonus(
    attack,
    characterData,
    resolvedAbilityScores,
    passiveCapabilities,
    passiveEffectContext,
    options
  );

  const hitParts = ["1d20"];
  if (weaponAttackBonus !== 0) {
    hitParts.push(`Arma (${formatSigned(weaponAttackBonus)})`);
  }
  if (proficiencyBonus !== 0) {
    hitParts.push(`B. Comp. (${formatSigned(proficiencyBonus)})`);
  }
  if (abilityKey) {
    hitParts.push(`${ABILITY_LABELS[abilityKey]} (${formatSigned(abilityModifier)})`);
  }
  if (passiveAttackBonus !== 0) {
    hitParts.push(`Effetti passivi (${formatSigned(passiveAttackBonus)})`);
  }

  const totalHitBonus =
    weaponAttackBonus + proficiencyBonus + (abilityKey ? abilityModifier : 0) + passiveAttackBonus;
  const totalDamageBonus =
    abilityKey && ["MELEE_WEAPON", "RANGED_WEAPON", "THROWN"].includes(attack.kind)
      ? abilityModifier
      : 0;
  const parsedDamage = parseDiceExpressionParts(attack.damageDice);
  const totalDamageFlatBonus = parsedDamage.flatBonus + totalDamageBonus + passiveDamageBonus;

  const damageParts = [parsedDamage.dicePart];
  if (parsedDamage.flatBonus !== 0) {
    damageParts.push(`Danno arma (${formatSigned(parsedDamage.flatBonus)})`);
  }
  if (abilityKey && ["MELEE_WEAPON", "RANGED_WEAPON", "THROWN"].includes(attack.kind)) {
    damageParts.push(`${ABILITY_LABELS[abilityKey]} (${formatSigned(abilityModifier)})`);
  }
  if (passiveDamageBonus !== 0) {
    damageParts.push(`Effetti passivi (${formatSigned(passiveDamageBonus)})`);
  }
  if (attack.damageType) {
    damageParts.push(attack.damageType);
  }

  return {
    hitSummaryLine: `Tiro per colpire: 1d20 ${formatSigned(totalHitBonus)}`,
    damageSummaryLine: `Danni: ${parsedDamage.dicePart} ${formatSigned(totalDamageFlatBonus)}${attack.damageType ? ` ${attack.damageType}` : ""}`,
    formulaLine: `Tiro per colpire: ${hitParts.join(" + ")}`,
    damageLine: `Danni: ${damageParts.join(" + ")}`,
  };
}

function getDisplaySlots(detail: ItemDefinitionEntry | undefined): string[] {
  if (!detail || !Array.isArray(detail.slotRules) || detail.slotRules.length === 0) return [];

  const grouped = new Map<
    string,
    Array<{ slot: string; selectionMode: string | null; sortOrder: number }>
  >();

  detail.slotRules.forEach((rule, index) => {
    const key = rule.groupKey?.trim() || `__slot_${index}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push({
      slot: rule.slot,
      selectionMode: rule.selectionMode,
      sortOrder: rule.sortOrder ?? index,
    });
    grouped.set(key, bucket);
  });

  const groups = Array.from(grouped.values())
    .map((rules) => rules.sort((a, b) => a.sortOrder - b.sortOrder))
    .sort((a, b) => {
      const aAny = a[0]?.selectionMode === "ANY_ONE";
      const bAny = b[0]?.selectionMode === "ANY_ONE";
      if (aAny !== bAny) return aAny ? 1 : -1;
      return b.length - a.length;
    });

  const selectedGroup = groups[0] ?? [];
  if (selectedGroup.length === 0) return [];

  if (selectedGroup[0]?.selectionMode === "ANY_ONE") {
    const preferred = selectedGroup
      .map((rule) => rule.slot)
      .sort((a, b) => {
        const aIdx = SLOT_ORDER.indexOf(a as (typeof SLOT_ORDER)[number]);
        const bIdx = SLOT_ORDER.indexOf(b as (typeof SLOT_ORDER)[number]);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    return preferred.length > 0 ? [preferred[0]] : [];
  }

  return selectedGroup.map((rule) => rule.slot);
}

function EquipmentSymbols({ detail }: { detail?: ItemDefinitionEntry }) {
  if (!detail) return null;

  const symbols: Array<{ key: string; title: string; icon: JSX.Element }> = [];

  switch (detail.category) {
    case "WEAPON":
      symbols.push({
        key: "category-weapon",
        title: "Arma",
        icon: <Sword className="h-3.5 w-3.5" />,
      });
      break;
    case "ARMOR":
      symbols.push({
        key: "category-armor",
        title: "Armatura",
        icon: <Shirt className="h-3.5 w-3.5" />,
      });
      break;
    case "SHIELD":
      symbols.push({
        key: "category-shield",
        title: "Scudo",
        icon: <Shield className="h-3.5 w-3.5" />,
      });
      break;
    case "RING":
      symbols.push({
        key: "category-ring",
        title: "Anello",
        icon: <Circle className="h-3.5 w-3.5" />,
      });
      break;
    case "AMULET":
      symbols.push({
        key: "category-amulet",
        title: "Amuleto",
        icon: <Gem className="h-3.5 w-3.5" />,
      });
      break;
    default:
      break;
  }

  switch (detail.weaponHandling) {
    case "ONE_HANDED":
      symbols.push({
        key: "one-handed",
        title: "A una mano",
        icon: <Hand className="h-3.5 w-3.5" />,
      });
      break;
    case "TWO_HANDED":
      symbols.push({
        key: "two-handed",
        title: "A due mani",
        icon: (
          <div className="flex -space-x-1">
            <Hand className="h-3.5 w-3.5" />
            <Hand className="h-3.5 w-3.5" />
          </div>
        ),
      });
      break;
    case "VERSATILE":
      symbols.push({
        key: "versatile",
        title: "Versatile",
        icon: (
          <div className="flex items-center gap-0.5">
            <Hand className="h-3.5 w-3.5" />
            <Hand className="h-3.5 w-3.5" />
          </div>
        ),
      });
      break;
    default:
      break;
  }

  if (detail.category === "ARMOR" || detail.category === "SHIELD") {
    symbols.push({
      key: "ac",
      title: getArmorClassSummary(detail) ?? "Classe Armatura",
      icon: <Shield className="h-3.5 w-3.5" />,
    });
  }

  if (detail.category === "FEET") {
    symbols.push({
      key: "feet",
      title: "Calzature",
      icon: <Footprints className="h-3.5 w-3.5" />,
    });
  }

  if (symbols.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
      {symbols.map((symbol) => (
        <span
          key={symbol.key}
          title={symbol.title}
          aria-label={symbol.title}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background/50"
        >
          {symbol.icon}
        </span>
      ))}
    </div>
  );
}

type RelationalAttackRow = {
  rowKey: string;
  sourceName: string;
  attackName: string;
  showSourceName: boolean;
  detailLine: string;
  secondaryLine: string | null;
  hitSummaryLine: string;
  damageSummaryLine: string;
  formulaLine: string | null;
  damageLine: string | null;
};

const UNARMED_ATTACK: ItemAttackEntry = {
  id: "__unarmed_attack__",
  name: "Colpo senz'armi",
  kind: "MELEE_WEAPON",
  handRequirement: "ANY",
  ability: "STRENGTH",
  attackBonus: 0,
  damageDice: "1",
  damageType: "contundente",
  rangeNormal: 1,
  rangeLong: null,
  conditionText: null,
  sortOrder: 0,
};

function canRepositionEquippedItem(detail?: ItemDefinitionEntry) {
  if (!detail?.slotRules?.length) return false;

  const distinctGroups = new Set(detail.slotRules.map((rule) => rule.groupKey));
  if (distinctGroups.size > 1) return true;

  return detail.slotRules.some((rule, _, rules) => {
    if (rule.selectionMode !== "ANY_ONE") return false;
    const sameGroupRules = rules.filter((candidate) => candidate.groupKey === rule.groupKey);
    return new Set(sameGroupRules.map((candidate) => candidate.slot)).size > 1;
  });
}

const AttacksAndSpells = ({
  characterData,
  toggleEquipAttack,
  toggleAttackSkillUsed,
  toggleEquipItem,
  toggleItemSkillUsed,
  relationalInventoryItems = [],
  toggleEquipRelationalItem,
  passiveCapabilities = [],
  passiveEffectContext = {},
}: {
  characterData: any;
  toggleEquipAttack: (i: number) => void;
  toggleAttackSkillUsed: (attackIndex: number, type: SkillType, skillIndex: number) => void;
  toggleEquipItem?: (i: number) => void;
  toggleItemSkillUsed?: (itemIndex: number, type: SkillType, skillIndex: number) => void;
  relationalInventoryItems?: CharacterInventoryItemEntry[];
  toggleEquipRelationalItem?: (
    characterItemId: string,
    payload?: {
      isEquipped?: boolean;
      equipConfig?: {
        optionId?: string;
        slots?: string[];
        swapItemIds?: string[];
      };
    }
  ) => Promise<unknown> | unknown;
  passiveCapabilities?: any[];
  passiveEffectContext?: any;
}) => {
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDefinitionEntry>>({});
  const [expandedAttackKeys, setExpandedAttackKeys] = useState<string[]>([]);
  const [equipResolutionOpen, setEquipResolutionOpen] = useState(false);
  const [equipResolutionItemId, setEquipResolutionItemId] = useState("");
  const [equipResolutionItemName, setEquipResolutionItemName] = useState("");
  const [equipResolutionOptions, setEquipResolutionOptions] = useState<EquipResolutionOption[]>([]);
  const [equipResolutionSelectedOptionId, setEquipResolutionSelectedOptionId] = useState("");
  const [equipResolutionError, setEquipResolutionError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItemId, setDetailItemId] = useState("");
  const resolvedAbilityData = useMemo(
    () => resolveCharacterAbilityScores(characterData, passiveCapabilities, passiveEffectContext),
    [characterData, passiveCapabilities, passiveEffectContext]
  );

  const equippedRelationalItems = useMemo(
    () =>
      (Array.isArray(relationalInventoryItems) ? relationalInventoryItems : []).filter(
        (item) => item?.isEquipped && item?.itemDefinitionId
      ),
    [relationalInventoryItems]
  );

  useEffect(() => {
    const missingIds = Array.from(
      new Set(
        equippedRelationalItems
          .map((item) => item.itemDefinitionId)
          .filter((id): id is string => !!id && !itemDetailsById[id])
      )
    );

    if (missingIds.length === 0) return;

    let active = true;

    void Promise.all(
      missingIds.map(async (id) => {
        try {
          const detail = await fetchItemDefinition(id);
          return [id, detail] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (!active) return;
      const nextEntries = results.filter(
        (entry): entry is readonly [string, ItemDefinitionEntry] => Array.isArray(entry)
      );
      if (nextEntries.length === 0) return;
      setItemDetailsById((prev) => ({
        ...prev,
        ...Object.fromEntries(nextEntries),
      }));
    });

    return () => {
      active = false;
    };
  }, [equippedRelationalItems, itemDetailsById]);

  const relationalAttacks = useMemo<RelationalAttackRow[]>(() => {
    const handAssignments = getWeaponHandAssignments(equippedRelationalItems, itemDetailsById);
    const derivedAttacks = equippedRelationalItems.flatMap((item) => {
      const definitionId = item.itemDefinitionId;
      if (!definitionId) return [];
      const detail = itemDetailsById[definitionId];
      if (!detail?.attacks?.length) return [];

      return detail.attacks
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((attack) => {
          const weaponHandSlots = (item.equippedSlots ?? []).filter((slot) => slot.startsWith("WEAPON_HAND_"));
          const isTwoHanded = weaponHandSlots.length >= 2;
          const isOneHanded = weaponHandSlots.length === 1;
          if (attack.handRequirement === "TWO_HANDED") return isTwoHanded;
          if (attack.handRequirement === "ONE_HANDED") return isOneHanded;
          return true;
        })
        .map((attack) => {
          const detailParts = [getAttackKindLabel(attack.kind)];
          const handLabel = getHandRequirementLabel(attack.handRequirement);
          if (handLabel) detailParts.push(handLabel);

          const secondaryLine =
            attack.rangeNormal !== null && attack.rangeNormal !== undefined
              ? attack.rangeLong !== null && attack.rangeLong !== undefined
                ? `Gittata ${attack.rangeNormal}/${attack.rangeLong}`
                : `Gittata ${attack.rangeNormal}`
              : null;
          const isOffHandAttack =
            handAssignments.hasDualWeapons &&
            handAssignments.secondaryWeaponItemId === item.id;

          const math = buildRelationalAttackMath(
            attack,
            characterData,
            resolvedAbilityData.scores,
            passiveCapabilities,
            passiveEffectContext,
            { isOffHandAttack, isUnarmedAttack: false }
          );
          const attackName = attack.name || item.itemName;

          return {
            rowKey: `${item.id}-${attack.id}`,
            sourceName: item.itemName,
            attackName,
            showSourceName:
              attackName.trim().toLowerCase() !== item.itemName.trim().toLowerCase(),
            detailLine: detailParts.join(" - "),
            secondaryLine,
            hitSummaryLine: math.hitSummaryLine,
            damageSummaryLine: math.damageSummaryLine,
            formulaLine: math.formulaLine,
            damageLine: math.damageLine,
          };
        });
    });

    const hasEquippedWeapon = equippedRelationalItems.some((item) => {
      if (!item?.itemDefinitionId) return false;
      return itemDetailsById[item.itemDefinitionId]?.category === "WEAPON";
    });

    if (!hasEquippedWeapon && derivedAttacks.length === 0) {
      const math = buildRelationalAttackMath(
        UNARMED_ATTACK,
        characterData,
        resolvedAbilityData.scores,
        passiveCapabilities,
        passiveEffectContext,
        { isOffHandAttack: false, isUnarmedAttack: true }
      );

      derivedAttacks.push({
        rowKey: "unarmed-base",
        sourceName: "",
        attackName: UNARMED_ATTACK.name,
        showSourceName: false,
        detailLine: "Mischia",
        secondaryLine: "Portata 1 quadretto",
        hitSummaryLine: math.hitSummaryLine,
        damageSummaryLine: math.damageSummaryLine,
        formulaLine: math.formulaLine,
        damageLine: math.damageLine,
      });
    }

    return derivedAttacks;
  }, [
    characterData,
    equippedRelationalItems,
    itemDetailsById,
    passiveCapabilities,
    passiveEffectContext,
    resolvedAbilityData.scores,
  ]);

  const equipmentBySlot = useMemo(() => {
    const bucket = new Map<string, Array<{ item: CharacterInventoryItemEntry; detail?: ItemDefinitionEntry }>>();

    equippedRelationalItems.forEach((item) => {
      const detail = item.itemDefinitionId ? itemDetailsById[item.itemDefinitionId] : undefined;
      const slots = Array.isArray(item.equippedSlots) && item.equippedSlots.length > 0
        ? item.equippedSlots
        : getDisplaySlots(detail);
      if (slots.length === 0) {
        const fallback = bucket.get("UNASSIGNED") ?? [];
        fallback.push({ item, detail });
        bucket.set("UNASSIGNED", fallback);
        return;
      }

      slots.forEach((slot) => {
        const normalizedSlot = normalizeDisplaySlot(slot);
        const current = bucket.get(normalizedSlot) ?? [];
        if (current.some((entry) => entry.item.id === item.id)) {
          bucket.set(normalizedSlot, current);
          return;
        }
        current.push({ item, detail });
        bucket.set(normalizedSlot, current);
      });
    });

    return Array.from(bucket.entries()).sort((a, b) => {
      const aIdx = SLOT_ORDER.indexOf(a[0] as (typeof SLOT_ORDER)[number]);
      const bIdx = SLOT_ORDER.indexOf(b[0] as (typeof SLOT_ORDER)[number]);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  }, [equippedRelationalItems, itemDetailsById]);

  const toggleAttackFormula = (rowKey: string) => {
    setExpandedAttackKeys((prev) =>
      prev.includes(rowKey) ? prev.filter((key) => key !== rowKey) : [...prev, rowKey]
    );
  };

  const detailItem = useMemo(
    () => equippedRelationalItems.find((item) => item.id === detailItemId) ?? null,
    [detailItemId, equippedRelationalItems]
  );

  const detailDefinition = detailItem?.itemDefinitionId
    ? itemDetailsById[detailItem.itemDefinitionId] ?? null
    : null;

  function openItemDetail(item: CharacterInventoryItemEntry) {
    setDetailItemId(item.id);
    setDetailOpen(true);
  }

  function buildUseEffectSummary(effect: ItemDefinitionEntry["useEffects"][number]) {
    return [
      effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : ""),
      effect.damageType ?? "",
      effect.savingThrowAbility && effect.savingThrowDc != null
        ? `Tiro salvezza su ${ABILITY_LABELS[normalizeAbilityKey(effect.savingThrowAbility) ?? effect.savingThrowAbility] ?? effect.savingThrowAbility} CD ${effect.savingThrowDc}`
        : "",
      effect.successOutcome === "NEGATES"
        ? "Nessun effetto con successo"
        : effect.successOutcome === "HALF"
          ? "Effetto ridotto con successo"
          : effect.successOutcome === "PARTIAL"
            ? "Effetto parziale con successo"
            : "",
      effect.notes ?? "",
    ].filter(Boolean).join(" - ");
  }

  function openEquipResolutionDialog(item: CharacterInventoryItemEntry, details: EquipResolutionDetails) {
    const options = Array.isArray(details?.options) ? details.options : [];
    setEquipResolutionItemId(item.id);
    setEquipResolutionItemName(item.itemName ?? "Oggetto senza nome");
    setEquipResolutionOptions(options);
    setEquipResolutionSelectedOptionId(options[0]?.optionId ?? "");
    setEquipResolutionError("");
    setEquipResolutionOpen(true);
  }

  async function handleRepositionEquippedItem(item: CharacterInventoryItemEntry) {
    if (!toggleEquipRelationalItem) return;

    try {
      await toggleEquipRelationalItem(item.id, { isEquipped: true });
    } catch (error: any) {
      const details = error?.details as EquipResolutionDetails | undefined;
      if (details?.code === "EQUIP_RESOLUTION_REQUIRED") {
        openEquipResolutionDialog(item, details);
        return;
      }

      toast.error(String(error?.message ?? "Non sono riuscito a cambiare impugnatura."));
    }
  }

  async function confirmEquipResolution() {
    if (!toggleEquipRelationalItem || !equipResolutionItemId || !equipResolutionSelectedOptionId) {
      return;
    }

    const selectedOption = equipResolutionOptions.find(
      (option) => option.optionId === equipResolutionSelectedOptionId
    );
    if (!selectedOption) {
      setEquipResolutionError("Seleziona una configurazione valida.");
      return;
    }

    try {
      await toggleEquipRelationalItem(equipResolutionItemId, {
        isEquipped: true,
        equipConfig: {
          optionId: selectedOption.optionId,
          slots: selectedOption.slots,
          swapItemIds: selectedOption.conflicts.map((conflict) => conflict.itemId),
        },
      });
      setEquipResolutionOpen(false);
      setEquipResolutionItemId("");
      setEquipResolutionItemName("");
      setEquipResolutionOptions([]);
      setEquipResolutionSelectedOptionId("");
      setEquipResolutionError("");
    } catch (error: any) {
      setEquipResolutionError(String(error?.message ?? "Non sono riuscito a completare il cambio impugnatura."));
    }
  }

  return (
    <>
      <SectionCard
        cardId="attacksAndEquipment"
        title={
          <span className="flex items-center gap-2">
            <Sword className="w-5 h-5 text-primary" />
            Attack & Equipment
          </span>
        }
      >

        <div className="space-y-5">
          {relationalAttacks.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-primary">Attacchi equipaggiati</div>
              {relationalAttacks.map((attack) => {
                const isExpanded = expandedAttackKeys.includes(attack.rowKey);

                return (
                  <div key={attack.rowKey} className="dnd-frame p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{attack.attackName}</div>
                        {attack.showSourceName && (
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {attack.sourceName}
                          </div>
                        )}
                        <div className="mt-1 text-muted-foreground">{attack.detailLine}</div>
                        {attack.secondaryLine && (
                          <div className="text-muted-foreground">{attack.secondaryLine}</div>
                        )}
                        <div className="mt-2 text-muted-foreground">
                          {attack.hitSummaryLine}
                          {isExpanded && attack.formulaLine ? (
                            <span className="text-xs text-muted-foreground/90">
                              {" "}
                              ({attack.formulaLine.replace(/^Tiro per colpire:\s*/i, "")})
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground">
                          {attack.damageSummaryLine}
                          {isExpanded && attack.damageLine ? (
                            <span className="text-xs text-muted-foreground/90">
                              {" "}
                              ({attack.damageLine.replace(/^Danni:\s*/i, "")})
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => toggleAttackFormula(attack.rowKey)}
                        aria-label={isExpanded ? "Nascondi formula" : "Mostra formula"}
                        title={isExpanded ? "Nascondi formula" : "Mostra formula"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {equipmentBySlot.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-primary">Equipaggiamento</div>
              {equipmentBySlot.map(([slot, entries]) => (
                <div key={slot} className="dnd-frame p-3 text-sm">
                  <div className="font-medium text-primary">
                    {SLOT_LABELS[slot] ?? "Slot non definito"}
                  </div>
                  <div className="mt-2 space-y-2">
                    {entries.map(({ item, detail }) => (
                      <div key={`${slot}-${item.id}`} className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left transition hover:opacity-90"
                          onClick={() => openItemDetail(item)}
                        >
                          <div className="font-medium">{item.itemName}</div>
                          {slot === "HANDS" && getEquippedHandLabel(item) ? (
                            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
                              {getEquippedHandLabel(item)}
                            </div>
                          ) : null}
                          <EquipmentSymbols detail={detail} />
                          {getArmorClassSummary(detail) && (
                            <div className="mt-1 text-muted-foreground">
                              {getArmorClassSummary(detail)}
                            </div>
                          )}
                        </button>
                        {toggleEquipRelationalItem && item.equippable ? (
                          <div className="flex shrink-0 items-center gap-2">
                            {canRepositionEquippedItem(detail) ? (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleRepositionEquippedItem(item);
                                }}
                                aria-label="Cambia impugnatura"
                                title="Cambia impugnatura"
                              >
                                <Repeat className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              size="icon"
                              variant="default"
                              className="h-8 w-8"
                              onClick={(event) => {
                                event.stopPropagation();
                                void toggleEquipRelationalItem(item.id, { isEquipped: false });
                              }}
                              aria-label="Disequipaggia oggetto"
                              title="Disequipaggia"
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {relationalAttacks.length === 0 &&
            equipmentBySlot.length === 0 && (
              <div className="dnd-frame p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Nessun attacco o equipaggiamento attivo.
              </div>
            )}
        </div>
      </SectionCard>

      <Dialog open={equipResolutionOpen} onOpenChange={setEquipResolutionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cambia impugnatura</DialogTitle>
            <DialogDescription>
              Scegli come tenere equipaggiato {equipResolutionItemName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <RadioGroup
              value={equipResolutionSelectedOptionId}
              onValueChange={setEquipResolutionSelectedOptionId}
              className="space-y-2"
            >
              {equipResolutionOptions.map((option) => (
                <label
                  key={option.optionId}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-3 text-sm"
                >
                  <RadioGroupItem value={option.optionId} className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">{getEquipOptionLabel(option)}</div>
                    {option.conflicts.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Libera: {option.conflicts.map((conflict) => conflict.itemName).join(", ")}
                      </div>
                    ) : null}
                  </div>
                </label>
              ))}
            </RadioGroup>
            {equipResolutionError ? (
              <div className="text-sm text-destructive">{equipResolutionError}</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipResolutionOpen(false)}>
              Annulla
            </Button>
            <Button onClick={() => void confirmEquipResolution()} disabled={!equipResolutionSelectedOptionId}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailItem?.itemName ?? "Dettaglio oggetto"}</DialogTitle>
          </DialogHeader>
          {detailItem ? (
            <div className="space-y-4 text-sm">
              <div className="space-y-1 rounded-lg border border-border/60 bg-muted/15 px-3 py-3">
                {detailDefinition?.category ? (
                  <div>
                    <span className="font-medium text-foreground">Categoria:</span>{" "}
                    {detailDefinition.category.replaceAll("_", " ")}
                  </div>
                ) : null}
                {detailDefinition?.rarity ? (
                  <div>
                    <span className="font-medium text-foreground">Rarità:</span>{" "}
                    {detailDefinition.rarity.replaceAll("_", " ")}
                  </div>
                ) : null}
                {detailDefinition?.weaponHandling ? (
                  <div>
                    <span className="font-medium text-foreground">Impugnatura:</span>{" "}
                    {getWeaponHandlingLabel(detailDefinition.weaponHandling)}
                  </div>
                ) : null}
                {detailItem.equippedSlots?.length ? (
                  <div>
                    <span className="font-medium text-foreground">Equipaggiato in:</span>{" "}
                    {Array.from(new Set(detailItem.equippedSlots.map((slot) => SLOT_LABELS[normalizeDisplaySlot(slot)] ?? slot))).join(", ")}
                  </div>
                ) : null}
                {detailDefinition?.description ? (
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {detailDefinition.description}
                  </div>
                ) : null}
              </div>

              {detailDefinition?.attacks?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
                  {detailDefinition.attacks.map((attack) => (
                    <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="font-medium text-foreground">{attack.name}</div>
                      <div className="mt-1 text-muted-foreground">
                        {[getAttackKindLabel(attack.kind), getHandRequirementLabel(attack.handRequirement)].filter(Boolean).join(" - ")}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {[
                          attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                          [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                          attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                        ].filter(Boolean).join(" - ")}
                      </div>
                      {attack.conditionText ? <div className="mt-1 text-muted-foreground">{attack.conditionText}</div> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {detailDefinition?.features?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature</div>
                  {detailDefinition.features.map((feature) => (
                    <div key={feature.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="font-medium text-foreground">{feature.name}</div>
                      {feature.description ? (
                        <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{feature.description}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {detailDefinition?.useEffects?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effetti all'uso</div>
                  {detailDefinition.useEffects.map((effect) => (
                    <div key={effect.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-muted-foreground">
                      {buildUseEffectSummary(effect)}
                    </div>
                  ))}
                </div>
              ) : null}

              {detailDefinition?.abilityRequirements?.length ? (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisiti</div>
                  <div className="text-muted-foreground">
                    {detailDefinition.abilityRequirements.map((req) => `${req.ability} ${req.minScore}+`).join(", ")}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Dettaglio non disponibile.</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AttacksAndSpells;
