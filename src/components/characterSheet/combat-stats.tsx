import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FastForward, Shield, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  fetchItemDefinition,
  fetchRaceSpeeds,
  type CharacterInventoryItemEntry,
  type ItemDefinitionEntry,
  type RaceSpeedEntry,
} from "@/lib/auth";
import { proficiencyBonus as getProficiencyBonus } from "@/utils";

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatMeters(value: number) {
  return `${value % 1 === 0 ? String(value) : String(value).replace(".", ",")} m`;
}

function formatFeet(value: number) {
  const feet = value / 0.3;
  const rounded = Number.isInteger(feet) ? String(feet) : feet.toFixed(1).replace(".", ",");
  return `${rounded} ft`;
}

function formatSquares(value: number) {
  const squares = value / 1.5;
  const rounded = Number.isInteger(squares)
    ? String(squares)
    : squares.toFixed(1).replace(".", ",");
  return `${rounded} quadretti`;
}

function formatSpeedValue(
  value: number,
  unit: "meters" | "feet" | "squares",
  variant: "compact" | "full" = "full"
) {
  switch (unit) {
    case "feet":
      return formatFeet(value);
    case "squares":
      if (variant === "compact") {
        const squares = value / 1.5;
        const rounded = Number.isInteger(squares)
          ? String(squares)
          : squares.toFixed(1).replace(".", ",");
        return `${rounded} Q`;
      }
      return formatSquares(value);
    default:
      return formatMeters(value);
  }
}

function StatDetailPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 w-full rounded-lg border border-border/50 bg-background/25 px-3 py-2 text-left">
      {children}
    </div>
  );
}

function StatDetailRows({
  rows,
}: {
  rows: Array<{ label: string; value?: string }>;
}) {
  return (
    <div className="space-y-1.5 text-[11px] leading-snug text-muted-foreground">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1 font-medium text-foreground/90">{row.label}</span>
          {row.value ? <span className="shrink-0 text-right">{row.value}</span> : null}
        </div>
      ))}
    </div>
  );
}

function StatDetailList({
  rows,
}: {
  rows: Array<{ label: string; value?: string }>;
}) {
  return (
    <div className="space-y-1.5 text-[11px] leading-snug text-muted-foreground">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <span className="font-medium text-foreground/90">{row.label}</span>
          {row.value ? <span>: {row.value}</span> : null}
        </div>
      ))}
    </div>
  );
}

function normalizeRaceLabel(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getBaseSpeedFromRace(
  raceEntries: RaceSpeedEntry[],
  raceLabel: string | undefined,
  fallbackSpeed: number
) {
  const normalizedRace = normalizeRaceLabel(raceLabel);
  const normalizedEntries = raceEntries.map((entry) => ({
    ...entry,
    normalizedLabel: normalizeRaceLabel(
      [entry.raceName, entry.subraceName].filter(Boolean).join(" ")
    ),
    normalizedRaceName: normalizeRaceLabel(entry.raceName),
  }));
  const exactMatch = normalizedEntries.find((entry) => entry.normalizedLabel === normalizedRace);
  if (exactMatch) return exactMatch;

  const partialMatch = normalizedEntries.find(
    (entry) =>
      normalizedRace.includes(entry.normalizedLabel) ||
      normalizedRace.includes(entry.normalizedRaceName)
  );
  if (partialMatch) return partialMatch;

  return {
    id: "race-speed-fallback",
    raceName: raceLabel || "Razza non definita",
    subraceName: null,
    speedMeters: fallbackSpeed,
    notes: null,
  };
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

function getArmorSourceLabel(
  detail: ItemDefinitionEntry | undefined,
  dexModifier: number
) {
  if (!detail || detail.category !== "ARMOR") {
    return `Base 10 + DES mod (${formatSigned(dexModifier)})`;
  }

  const base = detail.armorClassBase ?? 10;

  switch (detail.armorClassCalculation) {
    case "BASE_PLUS_DEX":
      return `${detail.name}: ${base} + DES mod (${formatSigned(dexModifier)})`;
    case "BASE_PLUS_DEX_MAX_2":
      return `${detail.name}: ${base} + DES mod (max +2)`;
    case "BASE_ONLY":
      return `${detail.name}: ${base}`;
    case "BONUS_ONLY":
      return `${detail.name}: +${detail.armorClassBonus ?? 0}`;
    default:
      return `${detail.name}: ${base}`;
  }
}

function getShieldBonus(detail: ItemDefinitionEntry | undefined) {
  if (!detail || detail.category !== "SHIELD") return 0;
  return detail.armorClassBonus ?? 0;
}

function getFlatEquippedModifiers(details: ItemDefinitionEntry[], target: string) {
  return details.reduce((total, detail) => {
    const bonus = (detail.modifiers ?? []).reduce((sum, modifier) => {
      if (modifier.target !== target) return sum;
      if (modifier.type !== "FLAT") return sum;
      if (modifier.condition !== "WHILE_EQUIPPED" && modifier.condition !== "ALWAYS") return sum;
      return sum + (modifier.value ?? 0);
    }, 0);

    return total + bonus;
  }, 0);
}

function resolveAbilityScore(characterData: any, ability: string | undefined) {
  switch (ability) {
    case "STRENGTH":
      return (
        characterData?.abilityScores?.STRENGTH ??
        characterData?.abilityScores?.strength ??
        characterData?.abilityScores?.STR ??
        characterData?.abilityScores?.str ??
        10
      );
    case "DEXTERITY":
      return (
        characterData?.abilityScores?.DEXTERITY ??
        characterData?.abilityScores?.dexterity ??
        characterData?.abilityScores?.DEX ??
        characterData?.abilityScores?.dex ??
        10
      );
    case "CONSTITUTION":
      return (
        characterData?.abilityScores?.CONSTITUTION ??
        characterData?.abilityScores?.constitution ??
        characterData?.abilityScores?.CON ??
        characterData?.abilityScores?.con ??
        10
      );
    case "INTELLIGENCE":
      return (
        characterData?.abilityScores?.INTELLIGENCE ??
        characterData?.abilityScores?.intelligence ??
        characterData?.abilityScores?.INT ??
        characterData?.abilityScores?.int ??
        10
      );
    case "WISDOM":
      return (
        characterData?.abilityScores?.WISDOM ??
        characterData?.abilityScores?.wisdom ??
        characterData?.abilityScores?.WIS ??
        characterData?.abilityScores?.wis ??
        10
      );
    case "CHARISMA":
      return (
        characterData?.abilityScores?.CHARISMA ??
        characterData?.abilityScores?.charisma ??
        characterData?.abilityScores?.CHA ??
        characterData?.abilityScores?.cha ??
        10
      );
    default:
      return 10;
  }
}

function resolvePassiveEffectValue(characterData: any, effect: any, abilityModifier: any) {
  const mode = effect?.valueMode ?? "FLAT";
  const offset = Number(effect?.value ?? 0);
  const numerator = Math.max(1, Number(effect?.multiplierNumerator ?? 1) || 1);
  const denominator = Math.max(1, Number(effect?.multiplierDenominator ?? 1) || 1);
  const rounding = effect?.rounding ?? "FLOOR";

  const applyScale = (baseValue: number) => {
    const scaled = (baseValue * numerator) / denominator;
    const rounded =
      denominator === 1 ? scaled : rounding === "CEIL" ? Math.ceil(scaled) : Math.floor(scaled);
    return rounded + offset;
  };

  switch (mode) {
    case "ABILITY_MODIFIER":
      return applyScale(abilityModifier(resolveAbilityScore(characterData, effect?.sourceAbility)));
    case "ABILITY_SCORE":
      return applyScale(resolveAbilityScore(characterData, effect?.sourceAbility));
    case "PROFICIENCY_BONUS":
      return applyScale(getProficiencyBonus(Number(characterData?.basicInfo?.level ?? 1)));
    case "CHARACTER_LEVEL":
      return applyScale(Number(characterData?.basicInfo?.level ?? 1));
    default:
      return offset;
  }
}

function getCapabilityBonus(
  characterData: any,
  target: string,
  abilityModifier: any,
  conditions: {
    hasArmorEquipped: boolean;
    hasShieldEquipped: boolean;
  }
) {
  const capabilities = Array.isArray(characterData?.capabilities) ? characterData.capabilities : [];

  return capabilities.reduce((total: number, capability: any) => {
    if (capability?.kind !== "passive" || !Array.isArray(capability?.passiveEffects)) {
      return total;
    }

    const nextBonus = capability.passiveEffects.reduce((sum: number, effect: any) => {
      if (effect?.target !== target) return sum;
      const value = resolvePassiveEffectValue(characterData, effect, abilityModifier);
      if (!Number.isFinite(value) || value === 0) return sum;

      switch (effect?.trigger) {
        case "ALWAYS":
          return sum + value;
        case "WHILE_ARMORED":
          return conditions.hasArmorEquipped ? sum + value : sum;
        case "WHILE_SHIELD_EQUIPPED":
          return conditions.hasShieldEquipped ? sum + value : sum;
        default:
          return sum;
      }
    }, 0);

    return total + nextBonus;
  }, 0);
}

const CombatStats = ({
  characterData,
  makeChangeHandler,
  abilityModifier,
  relationalInventoryItems = [],
}: any) => {
  const [itemDetailsById, setItemDetailsById] = useState<Record<string, ItemDefinitionEntry>>({});
  const [raceSpeedEntries, setRaceSpeedEntries] = useState<RaceSpeedEntry[]>([]);
  const [speedUnit, setSpeedUnit] = useState<"meters" | "feet" | "squares">("meters");
  const [activeDetail, setActiveDetail] = useState<"armor" | "initiative" | "speed" | null>(null);
  const armorDetailsOpen = activeDetail === "armor";
  const initiativeDetailsOpen = activeDetail === "initiative";
  const speedDetailsOpen = activeDetail === "speed";

  const equippedRelationalItems = useMemo(
    () =>
      (Array.isArray(relationalInventoryItems) ? relationalInventoryItems : []).filter(
        (item: CharacterInventoryItemEntry) => item?.isEquipped && item?.itemDefinitionId
      ),
    [relationalInventoryItems]
  );

  useEffect(() => {
    const missingIds = Array.from(
      new Set(
        equippedRelationalItems
          .map((item: CharacterInventoryItemEntry) => item.itemDefinitionId)
          .filter((id: string | null): id is string => !!id && !itemDetailsById[id])
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
      const validResults = results.filter(
        (entry): entry is readonly [string, ItemDefinitionEntry] => Array.isArray(entry)
      );
      if (validResults.length === 0) return;
      setItemDetailsById((prev) => ({
        ...prev,
        ...Object.fromEntries(validResults),
      }));
    });

    return () => {
      active = false;
    };
  }, [equippedRelationalItems, itemDetailsById]);

  useEffect(() => {
    let active = true;

    void fetchRaceSpeeds()
      .then((payload) => {
        if (!active) return;
        setRaceSpeedEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      })
      .catch(() => {
        if (!active) return;
        setRaceSpeedEntries([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const equippedDetails = useMemo(
    () =>
      equippedRelationalItems
        .map((item: CharacterInventoryItemEntry) =>
          item.itemDefinitionId ? itemDetailsById[item.itemDefinitionId] : undefined
        )
        .filter((detail): detail is ItemDefinitionEntry => !!detail),
    [equippedRelationalItems, itemDetailsById]
  );

  const armorClassData = useMemo(() => {
    const dexScore =
      characterData?.abilityScores?.DEXTERITY ??
      characterData?.abilityScores?.dexterity ??
      characterData?.abilityScores?.DEX ??
      characterData?.abilityScores?.dex ??
      10;
    const dexModifier = abilityModifier(dexScore);
    const equippedArmor =
      equippedDetails.find((detail) => detail.category === "ARMOR") ?? undefined;
    const equippedShields = equippedDetails.filter((detail) => detail.category === "SHIELD");
    const hasArmorEquipped = !!equippedArmor;
    const hasShieldEquipped = equippedShields.length > 0;

    const baseArmorClass = getArmorClassBaseFromArmor(equippedArmor, dexModifier);
    const shieldBonus = equippedShields.reduce(
      (total, detail) => total + getShieldBonus(detail),
      0
    );
    const modifierBonus = getFlatEquippedModifiers(equippedDetails, "ARMOR_CLASS");
    const capabilityBonus = getCapabilityBonus(
      characterData,
      "ARMOR_CLASS",
      abilityModifier,
      { hasArmorEquipped, hasShieldEquipped }
    );
    const totalArmorClass = baseArmorClass + shieldBonus + modifierBonus + capabilityBonus;

    const breakdown = [
      getArmorSourceLabel(equippedArmor, dexModifier),
      shieldBonus !== 0 ? `Scudo ${formatSigned(shieldBonus)}` : null,
      modifierBonus !== 0 ? `Altri bonus ${formatSigned(modifierBonus)}` : null,
      capabilityBonus !== 0 ? `Skill ${formatSigned(capabilityBonus)}` : null,
    ].filter(Boolean);

    return {
      totalArmorClass,
      breakdown,
    };
  }, [
    abilityModifier,
    characterData?.capabilities,
    characterData?.abilityScores?.DEXTERITY,
    characterData?.abilityScores?.dexterity,
    characterData?.abilityScores?.DEX,
    characterData?.abilityScores?.dex,
    equippedDetails,
  ]);

  const speedData = useMemo(() => {
    const raceEntry = getBaseSpeedFromRace(
      raceSpeedEntries,
      characterData?.basicInfo?.race,
      Number(characterData?.combatStats?.speed ?? 9)
    );
    const hasArmorEquipped = equippedDetails.some((detail) => detail.category === "ARMOR");
    const hasShieldEquipped = equippedDetails.some((detail) => detail.category === "SHIELD");
    const itemBonus = getFlatEquippedModifiers(equippedDetails, "SPEED");
    const capabilityBonus = getCapabilityBonus(
      characterData,
      "SPEED",
      abilityModifier,
      { hasArmorEquipped, hasShieldEquipped }
    );
    const totalSpeed = raceEntry.speedMeters + itemBonus + capabilityBonus;
    const raceLabel = [raceEntry.raceName, raceEntry.subraceName].filter(Boolean).join(" ");

    return {
      totalSpeed,
      breakdown: [
        `Razza (${raceLabel || characterData?.basicInfo?.race || "Non definita"}): ${formatMeters(raceEntry.speedMeters)}`,
        itemBonus !== 0 ? `Oggetti ${formatSigned(itemBonus)} m` : null,
        capabilityBonus !== 0 ? `Skill ${formatSigned(capabilityBonus)} m` : null,
        raceEntry.notes ? `Nota: ${raceEntry.notes}` : null,
      ].filter(Boolean),
      contributions: [
        {
          label: `Razza (${raceLabel || characterData?.basicInfo?.race || "Non definita"})`,
          value: raceEntry.speedMeters,
        },
        ...(itemBonus !== 0 ? [{ label: "Oggetti", value: itemBonus }] : []),
        ...(capabilityBonus !== 0 ? [{ label: "Skill", value: capabilityBonus }] : []),
      ],
      note: raceEntry.notes ?? null,
    };
  }, [
    abilityModifier,
    characterData?.basicInfo?.race,
    characterData?.capabilities,
    equippedDetails,
    raceSpeedEntries,
  ]);

  const initiativeData = useMemo(() => {
    const dexScore =
      characterData?.abilityScores?.DEXTERITY ??
      characterData?.abilityScores?.dexterity ??
      characterData?.abilityScores?.DEX ??
      characterData?.abilityScores?.dex ??
      10;
    const dexModifier = abilityModifier(dexScore);
    const hasArmorEquipped = equippedDetails.some((detail) => detail.category === "ARMOR");
    const hasShieldEquipped = equippedDetails.some((detail) => detail.category === "SHIELD");
    const itemBonus = getFlatEquippedModifiers(equippedDetails, "INITIATIVE");
    const capabilityBonus = getCapabilityBonus(
      characterData,
      "INITIATIVE",
      abilityModifier,
      { hasArmorEquipped, hasShieldEquipped }
    );
    const totalInitiative = dexModifier + itemBonus + capabilityBonus;

    const breakdown = [
      `Destrezza mod ${formatSigned(dexModifier)}`,
      itemBonus !== 0 ? `Oggetti ${formatSigned(itemBonus)}` : null,
      capabilityBonus !== 0 ? `Skill ${formatSigned(capabilityBonus)}` : null,
    ].filter(Boolean);

    return {
      totalInitiative,
      breakdown,
    };
  }, [
    abilityModifier,
    characterData?.capabilities,
    characterData?.abilityScores?.DEXTERITY,
    characterData?.abilityScores?.dexterity,
    characterData?.abilityScores?.DEX,
    characterData?.abilityScores?.dex,
    equippedDetails,
  ]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="flex flex-col dnd-frame p-4 text-center">
        <Shield className="w-6 h-6 mx-auto text-primary mb-2" />
          <div className="text-xs text-muted-foreground">CA</div>
        <div className="mt-3 text-2xl font-bold text-primary">
          {armorClassData.totalArmorClass}
        </div>
        <button
          type="button"
          onClick={() => setActiveDetail((prev) => (prev === "armor" ? null : "armor"))}
          className="mt-2 inline-flex items-center justify-center text-muted-foreground transition hover:text-foreground"
          aria-expanded={armorDetailsOpen}
          aria-label={armorDetailsOpen ? "Nascondi dettaglio CA" : "Mostra dettaglio CA"}
          title={armorDetailsOpen ? "Nascondi dettaglio CA" : "Mostra dettaglio CA"}
        >
          {armorDetailsOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {false && armorDetailsOpen && (
          <StatDetailPanel>
            <StatDetailRows
              rows={armorClassData.breakdown.map((entry: string) => ({ label: entry }))}
            />
          </StatDetailPanel>
        )}
      </Card>
      <Card className="flex flex-col dnd-frame p-4 text-center">
        <Zap className="w-6 h-6 mx-auto text-primary mb-2" />
        <div className="text-xs text-muted-foreground">Iniziativa</div>
        <div className="mt-3 text-2xl font-bold text-primary">
          {initiativeData.totalInitiative >= 0 ? `+${initiativeData.totalInitiative}` : initiativeData.totalInitiative}
        </div>
        <button
          type="button"
          onClick={() => setActiveDetail((prev) => (prev === "initiative" ? null : "initiative"))}
          className="mt-2 inline-flex items-center justify-center text-muted-foreground transition hover:text-foreground"
          aria-expanded={initiativeDetailsOpen}
          aria-label={initiativeDetailsOpen ? "Nascondi dettaglio iniziativa" : "Mostra dettaglio iniziativa"}
          title={initiativeDetailsOpen ? "Nascondi dettaglio iniziativa" : "Mostra dettaglio iniziativa"}
        >
          {initiativeDetailsOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {false && initiativeDetailsOpen && (
          <StatDetailPanel>
            <StatDetailRows
              rows={initiativeData.breakdown.map((entry: string) => ({ label: entry }))}
            />
          </StatDetailPanel>
        )}
      </Card>
      <Card className="flex flex-col dnd-frame p-4 text-center">
        <FastForward className="w-6 h-6 mx-auto text-primary mb-2" />
        <div className="text-xs text-muted-foreground">Velocità</div>
        <div className="mt-3 text-2xl font-bold text-primary">
          {formatSpeedValue(speedData.totalSpeed, speedUnit, "compact")}
        </div>
        <button
          type="button"
          onClick={() => setActiveDetail((prev) => (prev === "speed" ? null : "speed"))}
          className="mt-2 inline-flex items-center justify-center text-muted-foreground transition hover:text-foreground"
          aria-expanded={speedDetailsOpen}
          aria-label={speedDetailsOpen ? "Nascondi dettaglio velocità" : "Mostra dettaglio velocità"}
          title={speedDetailsOpen ? "Nascondi dettaglio velocità" : "Mostra dettaglio velocità"}
        >
          {speedDetailsOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {false && speedDetailsOpen && (
          <div className="mt-1 space-y-1 text-[11px] leading-snug text-muted-foreground">
            {speedData.breakdown.map((entry: string, index: number) => (
              <div key={`speed-breakdown-${index}`} className="flex items-start justify-center gap-1">
                <span className="mt-[2px] text-[9px]">•</span>
                <span>{entry}</span>
              </div>
            ))}
          </div>
        )}
        {false && speedDetailsOpen && (
          <div className="mt-2 w-full rounded-md border border-border/60 bg-background/20 p-2">
            <div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
              <label className="inline-flex items-center justify-center gap-1 rounded border border-border/50 px-1 py-1 cursor-pointer">
                <input
                  type="radio"
                  name="speed-unit"
                  checked={speedUnit === "meters"}
                  onChange={() => setSpeedUnit("meters")}
                />
                <span>m</span>
              </label>
              <label className="inline-flex items-center justify-center gap-1 rounded border border-border/50 px-1 py-1 cursor-pointer">
                <input
                  type="radio"
                  name="speed-unit"
                  checked={speedUnit === "feet"}
                  onChange={() => setSpeedUnit("feet")}
                />
                <span>ft</span>
              </label>
              <label className="inline-flex items-center justify-center gap-1 rounded border border-border/50 px-1 py-1 cursor-pointer">
                <input
                  type="radio"
                  name="speed-unit"
                  checked={speedUnit === "squares"}
                  onChange={() => setSpeedUnit("squares")}
                />
                <span>Q</span>
              </label>
            </div>
            <div className="mt-2 space-y-1.5">
            {speedData.contributions.map((entry: { label: string; value: number }, index: number) => (
              <div key={`speed-breakdown-modern-${index}`} className="text-left text-[11px] leading-snug text-muted-foreground">
                <span className="mt-[2px] text-[9px]">•</span>
                <span className="font-medium text-foreground/90">{entry.label}</span>
                <span>: {formatSpeedValue(entry.value, speedUnit)}</span>
              </div>
            ))}
            {speedData.note && (
              <div className="text-left text-[10px] italic text-muted-foreground/90">
                <span className="mt-[2px] text-[9px]">•</span>
                <span>Nota: {speedData.note}</span>
              </div>
            )}
            </div>
          </div>
        )}
        {false && speedDetailsOpen && (
          <StatDetailPanel>
            <div className="space-y-2">
            <div className="grid w-full grid-cols-3 gap-1 rounded-md border border-border/40 bg-background/30 p-1 text-[10px]">
              <label
                className={`inline-flex w-full items-center justify-center cursor-pointer rounded px-2 py-1 transition ${
                  speedUnit === "meters"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="speed-unit-clean"
                  className="sr-only"
                  checked={speedUnit === "meters"}
                  onChange={() => setSpeedUnit("meters")}
                />
                <span>m</span>
              </label>
              <label
                className={`inline-flex w-full items-center justify-center cursor-pointer rounded px-2 py-1 transition ${
                  speedUnit === "feet"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="speed-unit-clean"
                  className="sr-only"
                  checked={speedUnit === "feet"}
                  onChange={() => setSpeedUnit("feet")}
                />
                <span>ft</span>
              </label>
              <label
                className={`inline-flex w-full items-center justify-center cursor-pointer rounded px-2 py-1 transition ${
                  speedUnit === "squares"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="speed-unit-clean"
                  className="sr-only"
                  checked={speedUnit === "squares"}
                  onChange={() => setSpeedUnit("squares")}
                />
                <span>sq</span>
              </label>
            </div>
            <StatDetailList
              rows={speedData.contributions.map((entry: { label: string; value: number }) => ({
                label: entry.label,
                value: formatSpeedValue(entry.value, speedUnit),
              }))}
            />
            {speedData.note && (
              <div className="border-t border-border/40 pt-2 text-[10px] italic text-muted-foreground/90">
                {speedData.note}
              </div>
            )}
            </div>
          </StatDetailPanel>
        )}
      </Card>

      {armorDetailsOpen && (
        <Card className="col-span-3 dnd-frame p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            Dettaglio Classe armatura
          </div>
          <StatDetailRows
            rows={armorClassData.breakdown.map((entry: string) => ({ label: entry }))}
          />
        </Card>
      )}

      {initiativeDetailsOpen && (
        <Card className="col-span-3 dnd-frame p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Zap className="h-4 w-4" />
            Dettaglio Iniziativa
          </div>
          <StatDetailRows
            rows={initiativeData.breakdown.map((entry: string) => ({ label: entry }))}
          />
        </Card>
      )}

      {speedDetailsOpen && (
        <Card className="col-span-3 dnd-frame p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <FastForward className="h-4 w-4" />
            Dettaglio Velocità
          </div>
          <div className="space-y-3">
            <div className="grid w-full max-w-xs grid-cols-3 gap-1 rounded-md border border-border/40 bg-background/30 p-1 text-[11px]">
              <label
                className={`inline-flex w-full items-center justify-center cursor-pointer rounded px-2 py-1 transition ${
                  speedUnit === "meters"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="speed-unit-panel"
                  className="sr-only"
                  checked={speedUnit === "meters"}
                  onChange={() => setSpeedUnit("meters")}
                />
                <span>m</span>
              </label>
              <label
                className={`inline-flex w-full items-center justify-center cursor-pointer rounded px-2 py-1 transition ${
                  speedUnit === "feet"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="speed-unit-panel"
                  className="sr-only"
                  checked={speedUnit === "feet"}
                  onChange={() => setSpeedUnit("feet")}
                />
                <span>ft</span>
              </label>
              <label
                className={`inline-flex w-full items-center justify-center cursor-pointer rounded px-2 py-1 transition ${
                  speedUnit === "squares"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="speed-unit-panel"
                  className="sr-only"
                  checked={speedUnit === "squares"}
                  onChange={() => setSpeedUnit("squares")}
                />
                <span>sq</span>
              </label>
            </div>
            <StatDetailList
              rows={speedData.contributions.map((entry: { label: string; value: number }) => ({
                label: entry.label,
                value: formatSpeedValue(entry.value, speedUnit),
              }))}
            />
            {speedData.note && (
              <div className="border-t border-border/40 pt-2 text-[10px] italic text-muted-foreground/90">
                {speedData.note}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default CombatStats;
