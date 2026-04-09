import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  ChevronDown,
  ChevronUp,
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
import {
  fetchItemDefinition,
  type CharacterInventoryItemEntry,
  type ItemAttackEntry,
  type ItemDefinitionEntry,
} from "@/lib/auth";
import { proficiencyBonus as getProficiencyBonus } from "@/utils";

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
  HEAD: "Testa",
  BACK: "Schiena",
  ARMOR: "Armatura",
  GLOVE_LEFT: "Guanto sinistro",
  GLOVE_RIGHT: "Guanto destro",
  NECK: "Collana",
  FEET: "Scarpe",
  WEAPON_HAND_RIGHT: "Mano destra",
  WEAPON_HAND_LEFT: "Mano sinistra",
  RINGS: "Anelli",
};

const SLOT_ORDER = [
  "WEAPON_HAND_RIGHT",
  "WEAPON_HAND_LEFT",
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
  return slot.startsWith("RING_") ? "RINGS" : slot;
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

function buildRelationalAttackMath(attack: ItemAttackEntry, characterData: any) {
  const abilityKey =
    normalizeAbilityKey(attack.ability) ?? getDefaultAbilityForAttackKind(attack.kind);
  const abilityScore =
    abilityKey && characterData?.abilityScores
      ? characterData.abilityScores[abilityKey] ??
        characterData.abilityScores[abilityKey.toLowerCase()] ??
        null
      : null;
  const abilityModifier = getAbilityModifier(abilityScore);
  const proficiencyBonus =
    typeof characterData?.proficiencies?.proficiencyBonus === "number"
      ? characterData.proficiencies.proficiencyBonus
      : getProficiencyBonus(Number(characterData?.basicInfo?.level ?? 1));
  const weaponAttackBonus =
    attack.attackBonus !== null && attack.attackBonus !== undefined ? attack.attackBonus : 0;

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

  const totalHitBonus = weaponAttackBonus + proficiencyBonus + (abilityKey ? abilityModifier : 0);
  const totalDamageBonus =
    abilityKey && ["MELEE_WEAPON", "RANGED_WEAPON", "THROWN"].includes(attack.kind)
      ? abilityModifier
      : 0;
  const parsedDamage = parseDiceExpressionParts(attack.damageDice);
  const totalDamageFlatBonus = parsedDamage.flatBonus + totalDamageBonus;

  const damageParts = [parsedDamage.dicePart];
  if (parsedDamage.flatBonus !== 0) {
    damageParts.push(`Danno arma (${formatSigned(parsedDamage.flatBonus)})`);
  }
  if (abilityKey && ["MELEE_WEAPON", "RANGED_WEAPON", "THROWN"].includes(attack.kind)) {
    damageParts.push(`${ABILITY_LABELS[abilityKey]} (${formatSigned(abilityModifier)})`);
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

const AttacksAndSpells = ({
  characterData,
  toggleEquipAttack,
  toggleAttackSkillUsed,
  toggleEquipItem,
  toggleItemSkillUsed,
  relationalInventoryItems = [],
  toggleEquipRelationalItem,
}: {
  characterData: any;
  toggleEquipAttack: (i: number) => void;
  toggleAttackSkillUsed: (attackIndex: number, type: SkillType, skillIndex: number) => void;
  toggleEquipItem?: (i: number) => void;
  toggleItemSkillUsed?: (itemIndex: number, type: SkillType, skillIndex: number) => void;
  relationalInventoryItems?: CharacterInventoryItemEntry[];
  toggleEquipRelationalItem?: (characterItemId: string) => void;
}) => {
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDefinitionEntry>>({});
  const [expandedAttackKeys, setExpandedAttackKeys] = useState<string[]>([]);

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
    return equippedRelationalItems.flatMap((item) => {
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

          const math = buildRelationalAttackMath(attack, characterData);
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
  }, [characterData, equippedRelationalItems, itemDetailsById]);

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

  return (
    <Card className="character-section">
      <div className="character-section-title flex items-center gap-2">
        <Sword className="w-5 h-5 text-primary" />
        Attack & Equipment
      </div>

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
                      <div className="min-w-0">
                        <div className="font-medium">{item.itemName}</div>
                        <EquipmentSymbols detail={detail} />
                        {getArmorClassSummary(detail) && (
                          <div className="mt-1 text-muted-foreground">
                            {getArmorClassSummary(detail)}
                          </div>
                        )}
                      </div>
                      {toggleEquipRelationalItem && item.equippable ? (
                        <Button
                          size="icon"
                          variant="default"
                          className="h-8 w-8 shrink-0"
                          onClick={() => toggleEquipRelationalItem(item.id)}
                          aria-label="Disequipaggia oggetto"
                          title="Disequipaggia"
                        >
                          <ShieldOff className="h-4 w-4" />
                        </Button>
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
    </Card>
  );
};

export default AttacksAndSpells;
