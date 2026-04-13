import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ResourceSummaryBadge } from "@/components/resource-summary-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createEncounterScenarioRequest,
  deleteEncounterScenarioRequest,
  fetchEncounterScenarios,
  fetchMonster,
  fetchMonsters,
  updateMonsterCompendiumKnowledgeRequest,
  type EncounterScenario,
  type EncounterScenarioEntry,
  type MonsterEntry,
  type MonsterSummary,
} from "@/lib/auth";
import { fetchCharacter, fetchCharacters, notifyInitiativeTurn } from "@/realtime";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  BookOpen,
  FolderOpen,
  Check,
  ChevronRight,
  Copy,
  Dices,
  ExternalLink,
  FlaskConical,
  Heart,
  Home,
  Play,
  Plus,
  Save,
  Skull,
  Sword,
  Swords,
  Trash2,
  Users,
  X,
} from "lucide-react";

type CharacterState = Record<string, any>;

type CharacterCatalogEntry = {
  slug: string;
  name: string;
  className: string;
  level: number;
  initiativeBonus: number;
  armorClass: number;
  passivePerception: number;
  spellSaveDc: number | null;
  abilityBonuses: Array<{ label: string; value: number }>;
  hp: { current: number; max: number; temp: number };
  deathSaves: { successes: number; failures: number };
  resourceSummary: { label: string; entries: Array<{ label: string; remaining: number; total: number }> };
};

type PlayerEncounterEntry = {
  id: string;
  type: "player";
  slug: string;
  initiativeRoll: number;
  initiative: number;
  statuses: string[];
  sortOrder: number;
};

type MonsterEncounterEntry = {
  id: string;
  type: "monster";
  name: string;
  initiative: number;
  armorClass: number;
  currentHitPoints: number;
  maxHitPoints: number;
  statuses: string[];
  sortOrder: number;
  source: "custom" | "bestiary";
  sourceMonsterId: string | null;
  powerTag?: MonsterPowerTag | null;
};

type EncounterState = {
  players: PlayerEncounterEntry[];
  monsters: MonsterEncounterEntry[];
  started: boolean;
  round: number;
  currentTurnId: string | null;
  nextSortOrder: number;
};

type PlayerCombatant = {
  id: string;
  type: "player";
  initiativeRoll: number;
  initiative: number;
  sortOrder: number;
  slug: string;
  name: string;
  className: string;
  level: number;
  initiativeBonus: number;
  armorClass: number;
  passivePerception: number;
  spellSaveDc: number | null;
  abilityBonuses: Array<{ label: string; value: number }>;
  hp: { current: number; max: number; temp: number };
  deathSaves: { successes: number; failures: number };
  resourceSummary: { label: string; entries: Array<{ label: string; remaining: number; total: number }> };
  statuses: string[];
};

type MonsterCombatant = MonsterEncounterEntry & {
  hp: { current: number; max: number; temp: number };
};

type Combatant = PlayerCombatant | MonsterCombatant;

type UnifiedMonsterDraft = {
  name: string;
  selectedMonsterId: string;
  initiative: string;
  armorClass: string;
  hitPoints: string;
  quantity: string;
};

type PendingScenarioCombatant = {
  id: string;
  source: "bestiary" | "manual";
  sourceMonsterId: string | null;
  name: string;
  armorClass: number;
  hitPoints: number;
  initiative: string;
  powerTag?: MonsterPowerTag | null;
};

type PendingMonsterBatch = {
  source: "custom" | "bestiary";
  armorClass: number;
  hitPoints: number;
  sourceMonsterId: string | null;
  powerTag?: MonsterPowerTag | null;
  names: string[];
  initiatives: string[];
};

type MonsterPowerTag = "debolissimo" | "debole" | "forte" | "fortissimo";

const STORAGE_KEY = "dm-initiative-tracker-v1";
const STATUS_OPTIONS = [
  "Accecato",
  "Affascinato",
  "Afferrato",
  "Assordato",
  "Avvelenato",
  "Incapacitato",
  "Invisibile",
  "Paralizzato",
  "Pietrificato",
  "Prono",
  "Spaventato",
  "Stordito",
  "Svenuto",
  "Trattenuto",
] as const;

const emptyEncounterState = (): EncounterState => ({
  players: [],
  monsters: [],
  started: false,
  round: 1,
  currentTurnId: null,
  nextSortOrder: 1,
});

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

function getPassivePerception(state: CharacterState) {
  const wisdomModifier = abilityModifier(state?.abilityScores?.wisdom);
  const perceptionSkill = (state?.proficiencies?.skills ?? []).find(
    (skill: any) =>
      typeof skill?.name === "string" &&
      ["percezione", "perception"].includes(skill.name.toLowerCase())
  );
  const isProficient = !!perceptionSkill?.proficient;
  return 10 + wisdomModifier + (isProficient ? proficiencyBonus(state?.basicInfo?.level) : 0);
}

function getSpellSaveDc(state: CharacterState) {
  const normalizedClass = (state?.basicInfo?.class ?? "").trim().toLowerCase();
  const spellcastingAbility = SPELLCASTING_ABILITY_BY_CLASS[normalizedClass];
  if (!spellcastingAbility) return null;

  return 8 + proficiencyBonus(state?.basicInfo?.level) + abilityModifier(state?.abilityScores?.[spellcastingAbility]);
}

function getAbilityBonuses(state: CharacterState) {
  return ABILITY_ORDER.map(({ key, label }) => ({
    label,
    value: abilityModifier(state?.abilityScores?.[key]),
  }));
}

function summarizeResourceSlots(
  className: string | undefined,
  spellSlots: Record<string, Array<{ active?: boolean }>> | undefined
) {
  const normalizedClass = (className ?? "").trim().toLowerCase();
  const entries = Object.entries(spellSlots ?? {})
    .map(([level, slots]) => ({
      level: parseInt(level, 10),
      remaining: Array.isArray(slots) ? slots.filter((slot) => !slot?.active).length : 0,
      total: Array.isArray(slots) ? slots.length : 0,
    }))
    .filter((entry) => Number.isFinite(entry.level) && entry.level > 0 && entry.total > 0)
    .sort((a, b) => a.level - b.level);

  if (entries.length === 0) {
    return { label: "", entries: [] as Array<{ label: string; remaining: number; total: number }> };
  }

  if (normalizedClass === "guerriero" || normalizedClass === "fighter") {
    return {
      label: "Manovre",
      entries: entries.map(({ level, remaining, total }) => ({
        label: `d${level}`,
        remaining,
        total,
      })),
    };
  }

  return {
    label: "Slot",
    entries: entries.map(({ level, remaining, total }) => ({
      label: `${level}`,
      remaining,
      total,
    })),
  };
}

function toCharacterCatalogEntry(state: CharacterState): CharacterCatalogEntry | null {
  const slug = state?.slug;
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    className: state?.basicInfo?.class ?? "",
    level: state?.basicInfo?.level ?? 0,
    initiativeBonus: state?.combatStats?.initiative ?? 0,
    armorClass: state?.combatStats?.armorClass ?? 0,
    passivePerception: getPassivePerception(state),
    spellSaveDc: getSpellSaveDc(state),
    abilityBonuses: getAbilityBonuses(state),
    hp: {
      current: state?.combatStats?.currentHitPoints ?? 0,
      max: state?.combatStats?.hitPointMaximum ?? 0,
      temp: state?.combatStats?.temporaryHitPoints ?? 0,
    },
    deathSaves: {
      successes: Math.max(0, Math.min(3, state?.combatStats?.deathSaves?.successes ?? 0)),
      failures: Math.max(0, Math.min(3, state?.combatStats?.deathSaves?.failures ?? 0)),
    },
    resourceSummary: summarizeResourceSlots(state?.basicInfo?.class, state?.combatStats?.spellSlots),
  };
}

function parseEncounterState(raw: string | null): EncounterState {
  if (!raw) return emptyEncounterState();

  try {
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed?.players)
        ? parsed.players.map((player: any) => ({
            ...player,
            initiativeRoll:
              typeof player?.initiativeRoll === "number" ? player.initiativeRoll : player?.initiative ?? 0,
            statuses: Array.isArray(player?.statuses) ? player.statuses : [],
          }))
        : [],
      monsters: Array.isArray(parsed?.monsters)
        ? parsed.monsters.map((monster: any) => ({
            ...monster,
            statuses: Array.isArray(monster?.statuses)
              ? monster.statuses
              : monster?.status
              ? [monster.status]
              : [],
            source: monster?.source === "bestiary" ? "bestiary" : "custom",
            sourceMonsterId: typeof monster?.sourceMonsterId === "string" ? monster.sourceMonsterId : null,
            powerTag:
              monster?.powerTag === "debolissimo" ||
              monster?.powerTag === "debole" ||
              monster?.powerTag === "forte" ||
              monster?.powerTag === "fortissimo"
                ? monster.powerTag
                : null,
          }))
        : [],
      started: !!parsed?.started,
      round: typeof parsed?.round === "number" && parsed.round > 0 ? parsed.round : 1,
      currentTurnId: parsed?.currentTurnId ?? null,
      nextSortOrder:
        typeof parsed?.nextSortOrder === "number" && parsed.nextSortOrder > 0
          ? parsed.nextSortOrder
          : 1,
    };
  } catch {
    return emptyEncounterState();
  }
}

function hpSegments(hp: { current?: number; max?: number; temp?: number }) {
  const current = Math.max(0, hp?.current ?? 0);
  const max = Math.max(1, hp?.max ?? 1);
  const temp = Math.max(0, hp?.temp ?? 0);
  const total = max + temp;

  return {
    currentPct: Math.min(100, (current / total) * 100),
    tempPct: Math.min(100, (temp / total) * 100),
  };
}

function hpBarColor(hp: { current?: number; max?: number; temp?: number }) {
  const current = Math.max(0, hp?.current ?? 0);
  const max = Math.max(1, hp?.max ?? 1);
  const pct = Math.min(100, Math.round((current / max) * 100));

  if (pct >= 66) return "bg-emerald-500";
  if (pct >= 33) return "bg-amber-500";
  return "bg-rose-500";
}

function compareCombatants(a: Combatant, b: Combatant) {
  if (b.initiative !== a.initiative) return b.initiative - a.initiative;
  return a.sortOrder - b.sortOrder;
}

function buildCombatants(
  encounter: EncounterState,
  catalog: Record<string, CharacterCatalogEntry>,
  liveStates: Record<string, CharacterState>
): Combatant[] {
  const players: Combatant[] = encounter.players
    .map((entry) => {
      const live = liveStates[entry.slug];
      const source = live ? toCharacterCatalogEntry(live) : catalog[entry.slug];
      if (!source) return null;

      return {
        id: entry.id,
        type: "player" as const,
        initiativeRoll: entry.initiativeRoll,
        initiative: entry.initiative,
        sortOrder: entry.sortOrder,
        slug: entry.slug,
        name: source.name,
        className: source.className,
        level: source.level,
        initiativeBonus: source.initiativeBonus,
        armorClass: source.armorClass,
        passivePerception: source.passivePerception,
        spellSaveDc: source.spellSaveDc,
        abilityBonuses: source.abilityBonuses,
        hp: source.hp,
        deathSaves: source.deathSaves,
        resourceSummary: source.resourceSummary,
        statuses: Array.isArray(entry.statuses) ? entry.statuses : [],
      };
    })
    .filter(Boolean) as Combatant[];

  const monsters: Combatant[] = encounter.monsters.map((entry) => ({
    ...entry,
    hp: {
      current: entry.currentHitPoints,
      max: entry.maxHitPoints,
      temp: 0,
    },
  }));

  return [...players, ...monsters].sort(compareCombatants);
}

function isEligibleForTurn(combatant: Combatant) {
  if (combatant.type === "monster") {
    return (combatant.hp.current ?? 0) > 0;
  }

  return true;
}

function normalizeMonsterCopyBase(name: string) {
  return name.replace(/\s+#\d+$/, "").replace(/\s+\d+$/, "").trim();
}

function nextMonsterCopyName(name: string, monsters: MonsterEncounterEntry[]) {
  const normalizedBase = normalizeMonsterCopyBase(name);
  let highest = 0;

  monsters.forEach((monster) => {
    const match = monster.name.match(/^(.*?)(?:\s+#?(\d+))?$/);
    if (!match) return;

    const candidateBase = match[1].trim();
    const candidateIndex = match[2] ? parseInt(match[2], 10) : 0;

    if (candidateBase.toLowerCase() === normalizedBase.toLowerCase()) {
      highest = Math.max(highest, candidateIndex);
    }
  });

  return `${normalizedBase} #${highest + 1}`;
}

function hasMonsterWithSameBaseName(name: string, monsters: MonsterEncounterEntry[]) {
  const normalizedBase = normalizeMonsterCopyBase(name).toLowerCase();
  return monsters.some((monster) => normalizeMonsterCopyBase(monster.name).toLowerCase() === normalizedBase);
}

function buildSequentialMonsterNames(baseName: string, quantity: number, existingMonsters: MonsterEncounterEntry[]) {
  const names: string[] = [];
  const virtualMonsters = [...existingMonsters];

  for (let index = 0; index < quantity; index += 1) {
    const nextName = nextMonsterCopyName(baseName, virtualMonsters);
    names.push(nextName);
    virtualMonsters.push({
      id: `virtual:${index}`,
      type: "monster",
      name: nextName,
      initiative: 0,
      armorClass: 0,
      currentHitPoints: 0,
      maxHitPoints: 0,
      statuses: [],
      sortOrder: 0,
      source: "custom",
      sourceMonsterId: null,
    });
  }

  return names;
}

function sanitizeNameForId(value: string) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function crLabel(challengeRating?: { display?: string; fraction?: string }) {
  return challengeRating?.display || challengeRating?.fraction || "-";
}

function abilityModifierLabel(score: number) {
  const value = abilityModifier(score);
  return `${score} (${value >= 0 ? `+${value}` : value})`;
}

function parseHitPointFormulaRange(formula: string | undefined, average: number) {
  const normalized = String(formula ?? "")
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

  return {
    min: safeMin,
    max: safeMax,
    average: safeAverage,
  };
}

function classifyMonsterPowerTag(hitPoints: number, range: ReturnType<typeof parseHitPointFormulaRange>) {
  if (!range || !Number.isFinite(hitPoints)) return null;
  if (hitPoints <= range.min) return "debolissimo" as const;
  if (hitPoints >= range.max) return "fortissimo" as const;

  const span = range.max - range.min;
  if (span <= 0) return null;

  const edgeBand = Math.max(1, Math.floor(span * 0.2));
  if (hitPoints <= range.min + edgeBand) return "debole" as const;
  if (hitPoints >= range.max - edgeBand) return "forte" as const;
  return null;
}

function formatMonsterPowerTag(tag: MonsterPowerTag | null | undefined) {
  if (!tag) return null;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function monsterPowerTagClassName(tag: MonsterPowerTag | null | undefined) {
  switch (tag) {
    case "debolissimo":
      return "border-rose-300/60 bg-rose-500/10 text-rose-200 dark:border-rose-300/40 dark:bg-rose-400/10 dark:text-rose-200";
    case "debole":
      return "border-amber-300/60 bg-amber-500/10 text-amber-100 dark:border-amber-300/40 dark:bg-amber-400/10 dark:text-amber-100";
    case "forte":
      return "border-sky-300/60 bg-sky-500/10 text-sky-100 dark:border-sky-300/40 dark:bg-sky-400/10 dark:text-sky-100";
    case "fortissimo":
      return "border-emerald-300/60 bg-emerald-500/10 text-emerald-100 dark:border-emerald-300/40 dark:bg-emerald-400/10 dark:text-emerald-100";
    default:
      return "";
  }
}

function formatMonsterTagged(items: Array<{ name: string; value?: string }>) {
  return items.map((item) => (item.value ? `${item.name} ${item.value}` : item.name)).join(", ");
}

function formatMonsterBonuses(items: Array<{ ability?: string; name?: string; bonus: number }>) {
  return items.map((item) => `${item.ability ?? item.name ?? ""} ${item.bonus >= 0 ? `+${item.bonus}` : item.bonus}`).join(", ");
}

function MonsterDetailLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="text-[15px] leading-relaxed text-foreground">
      <span className="font-semibold text-foreground">{label}</span> {value}
    </div>
  );
}

function MonsterFeatureSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; usage?: string | null; description: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="font-heading text-xl font-semibold uppercase tracking-wide text-[#7d2c17] dark:text-amber-200">{title}</h4>
      <div className="space-y-3">
        {items.map((item, index) => (
          <p key={`${title}-${item.name}-${index}`} className="text-[15px] leading-7 text-foreground dark:text-amber-50/95">
            <span className="font-semibold italic text-foreground dark:text-amber-100">
              {item.name}
              {item.usage ? ` (${item.usage})` : ""}.
            </span>{" "}
            {item.description}
          </p>
        ))}
      </div>
    </div>
  );
}

function TrackerMonsterStatBlock({ monster }: { monster: MonsterEntry }) {
  const typeLine = [monster.general.size, monster.general.typeLabel || monster.general.creatureType, monster.general.alignment]
    .filter(Boolean)
    .join("; ");

  return (
    <div className="rounded-[28px] border border-primary/25 bg-[linear-gradient(180deg,rgba(247,237,214,0.96),rgba(239,225,193,0.92))] p-6 text-stone-900 shadow-[0_18px_40px_rgba(34,25,16,0.18)] dark:border-amber-200/20 dark:bg-[linear-gradient(180deg,rgba(52,35,24,0.96),rgba(32,21,16,0.96))] dark:text-amber-50 dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <div className="space-y-5">
        <div>
          <h2 className="font-heading text-4xl font-bold uppercase tracking-wide text-[#7d2c17] dark:text-amber-200">{monster.general.name}</h2>
          <p className="mt-1 text-lg italic text-stone-700 dark:text-amber-50/75">{typeLine}</p>
        </div>
        <div className="h-[3px] rounded-full bg-[#8d3821]/70 dark:bg-amber-300/45" />
        <div className="space-y-1">
          <MonsterDetailLine label="Classe Armatura" value={[String(monster.combat.armorClass.value || 0), monster.combat.armorClass.note ? `(${monster.combat.armorClass.note})` : ""].filter(Boolean).join(" ")} />
          <MonsterDetailLine label="Punti Ferita" value={[String(monster.combat.hitPoints.average || 0), monster.combat.hitPoints.formula ? `(${monster.combat.hitPoints.formula})` : ""].filter(Boolean).join(" ")} />
          <MonsterDetailLine label="Velocità" value={Object.entries(monster.combat.speed).map(([key, speed]) => `${key} ${speed}`).join(", ")} />
        </div>
        <div className="h-[3px] rounded-full bg-[#8d3821]/70 dark:bg-amber-300/45" />
        <div className="grid grid-cols-3 gap-3 rounded-[24px] border border-[#8d3821]/20 bg-white/45 px-4 py-4 md:grid-cols-6 dark:border-amber-200/15 dark:bg-white/5">
          {([
            ["FOR", monster.abilities.strength],
            ["DES", monster.abilities.dexterity],
            ["COS", monster.abilities.constitution],
            ["INT", monster.abilities.intelligence],
            ["SAG", monster.abilities.wisdom],
            ["CAR", monster.abilities.charisma],
          ] as const).map(([label, score]) => (
            <div key={label} className="text-center">
              <div className="text-sm font-bold uppercase tracking-[0.22em] text-[#7d2c17] dark:text-amber-200">{label}</div>
              <div className="mt-1 text-lg font-semibold text-stone-900 dark:text-amber-50">{abilityModifierLabel(score)}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <MonsterDetailLine label="Tiri Salvezza" value={formatMonsterBonuses(monster.details.savingThrows)} />
          <MonsterDetailLine label="Abilità" value={formatMonsterBonuses(monster.details.skills)} />
          <MonsterDetailLine label="Vulnerabilità ai Danni" value={monster.details.damageVulnerabilities.join(", ")} />
          <MonsterDetailLine label="Resistenze ai Danni" value={monster.details.damageResistances.join(", ")} />
          <MonsterDetailLine label="Immunità ai Danni" value={monster.details.damageImmunities.join(", ")} />
          <MonsterDetailLine label="Immunità alle Condizioni" value={monster.details.conditionImmunities.join(", ")} />
          <MonsterDetailLine label="Sensi" value={formatMonsterTagged(monster.details.senses)} />
          <MonsterDetailLine label="Linguaggi" value={formatMonsterTagged(monster.details.languages)} />
          <MonsterDetailLine label="Sfida" value={`${crLabel(monster.general.challengeRating)} (${monster.general.challengeRating.xp.toLocaleString("it-IT")} PE)`} />
        </div>
        <div className="space-y-8 rounded-[24px] border border-[#8d3821]/20 bg-white/45 px-5 py-5 dark:border-amber-200/15 dark:bg-white/5">
          <MonsterFeatureSection title="Tratti" items={monster.traits} />
          <MonsterFeatureSection title="Azioni" items={monster.actions} />
          <MonsterFeatureSection title="Azioni Bonus" items={monster.bonusActions} />
          <MonsterFeatureSection title="Reazioni" items={monster.reactions} />
          {monster.legendaryActions.description || monster.legendaryActions.actions.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-heading text-xl font-semibold uppercase tracking-wide text-[#7d2c17] dark:text-amber-200">Azioni Leggendarie</h4>
              {monster.legendaryActions.description ? <p className="text-[15px] leading-7 text-foreground dark:text-amber-50/95">{monster.legendaryActions.description}</p> : null}
              <MonsterFeatureSection title="" items={monster.legendaryActions.actions.map((item) => ({ ...item, usage: item.cost > 1 ? `Costa ${item.cost} azioni` : null }))} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeathSaveTrack({
  successes,
  failures,
}: {
  successes: number;
  failures: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-2.5 py-1">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => {
          const active = failures >= 3 - index;
          return (
            <span
              key={`fail-${index}`}
              className={`flex h-5 w-5 items-center justify-center rounded-sm border ${
                active ? "border-red-300 bg-red-50 text-red-600" : "border-border/70 text-muted-foreground/40"
              }`}
            >
              <X className="h-3 w-3" />
            </span>
          );
        })}
      </div>
      <Skull className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => {
          const active = successes > index;
          return (
            <span
              key={`success-${index}`}
              className={`flex h-5 w-5 items-center justify-center rounded-sm border ${
                active ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-border/70 text-muted-foreground/40"
              }`}
            >
              <Check className="h-3 w-3" />
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function InitiativeTracker() {
  const [encounter, setEncounter] = useState<EncounterState>(() =>
    parseEncounterState(localStorage.getItem(STORAGE_KEY))
  );
  const [catalogStates, setCatalogStates] = useState<CharacterState[]>([]);
  const [bestiaryCatalog, setBestiaryCatalog] = useState<MonsterSummary[]>([]);
  const [bestiaryById, setBestiaryById] = useState<Record<string, MonsterEntry>>({});
  const [liveCharacterStates, setLiveCharacterStates] = useState<Record<string, CharacterState>>({});
  const [playerRolls, setPlayerRolls] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [monsterHpAdjustments, setMonsterHpAdjustments] = useState<Record<string, string>>({});
  const [expandedAbilityBonuses, setExpandedAbilityBonuses] = useState<Record<string, boolean>>({});
  const [setupSectionsOpen, setSetupSectionsOpen] = useState(true);
  const playerRollInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const monsterNameInputRef = useRef<HTMLInputElement | null>(null);
  const monsterSearchPopoverRef = useRef<HTMLDivElement | null>(null);
  const [monsterSearchActiveIndex, setMonsterSearchActiveIndex] = useState(-1);
  const [monsterDraft, setMonsterDraft] = useState<UnifiedMonsterDraft>({
    name: "",
    selectedMonsterId: "",
    initiative: "",
    armorClass: "",
    hitPoints: "",
    quantity: "1",
  });
  const [monsterSearchOpen, setMonsterSearchOpen] = useState(false);
  const monsterForm = monsterDraft;
  const setMonsterForm = setMonsterDraft;
  const bestiaryMonsterDraft = {
    monsterId: monsterDraft.selectedMonsterId,
    initiative: monsterDraft.initiative,
    hitPoints: monsterDraft.hitPoints,
    quantity: monsterDraft.quantity,
  };
  const setBestiaryMonsterDraft = (
    value:
      | { monsterId: string; initiative: string; hitPoints: string; quantity: string }
      | ((prev: { monsterId: string; initiative: string; hitPoints: string; quantity: string }) => {
          monsterId: string;
          initiative: string;
          hitPoints: string;
          quantity: string;
        })
  ) => {
    setMonsterDraft((prev) => {
      const current = {
        monsterId: prev.selectedMonsterId,
        initiative: prev.initiative,
        hitPoints: prev.hitPoints,
        quantity: prev.quantity,
      };
      const next = typeof value === "function" ? value(current) : value;
      return {
        ...prev,
        selectedMonsterId: next.monsterId,
        initiative: next.initiative,
        hitPoints: next.hitPoints,
        quantity: next.quantity,
      };
    });
  };
  const [monsterDetailOpen, setMonsterDetailOpen] = useState(false);
  const [monsterDetailLoading, setMonsterDetailLoading] = useState(false);
  const [selectedMonsterDetail, setSelectedMonsterDetail] = useState<MonsterEntry | null>(null);
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [scenarioSaveOpen, setScenarioSaveOpen] = useState(false);
  const [initiativeBatchOpen, setInitiativeBatchOpen] = useState(false);
  const [pendingMonsterBatch, setPendingMonsterBatch] = useState<PendingMonsterBatch | null>(null);
  const [unlockKnowledgeOpen, setUnlockKnowledgeOpen] = useState(false);
  const [unlockingKnowledge, setUnlockingKnowledge] = useState(false);
  const [unlockSelection, setUnlockSelection] = useState<string[]>([]);
  const [scenarioName, setScenarioName] = useState("");
  const [encounterScenarios, setEncounterScenarios] = useState<EncounterScenario[]>([]);
  const [pendingScenarioCombatants, setPendingScenarioCombatants] = useState<PendingScenarioCombatant[]>([]);

  const rollD20 = () => Math.floor(Math.random() * 20) + 1;

  const handlePlayerRollKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    slug: string,
    selected: boolean,
    parsedRoll: number | null
  ) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    if (selected || parsedRoll === null) return;
    const added = addPlayer(slug);
    if (!added) return;

    const nextSlug = catalogList.find(
      (entry) => entry.slug !== slug && !selectedSlugs.includes(entry.slug)
    )?.slug;

    if (!nextSlug) return;

    window.requestAnimationFrame(() => {
      playerRollInputRefs.current[nextSlug]?.focus();
      playerRollInputRefs.current[nextSlug]?.select();
    });
  };

  const handleMonsterFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const added = addMonsterFromDraft();
    if (!added) return;

    window.requestAnimationFrame(() => {
      monsterNameInputRef.current?.focus();
    });
  };
  const handleBestiaryMonsterSubmit = handleMonsterFormSubmit;

  const catalogList = useMemo(
    () =>
      catalogStates
        .map((state) => toCharacterCatalogEntry(state))
        .filter(Boolean)
        .sort((a, b) => a!.name.localeCompare(b!.name, undefined, { sensitivity: "base" })) as CharacterCatalogEntry[],
    [catalogStates]
  );

  const catalogBySlug = useMemo(
    () => Object.fromEntries(catalogList.map((entry) => [entry.slug, entry])),
    [catalogList]
  );

  const selectedSlugs = useMemo(() => encounter.players.map((entry) => entry.slug), [encounter.players]);
  const combatants = useMemo(
    () => buildCombatants(encounter, catalogBySlug, liveCharacterStates),
    [encounter, catalogBySlug, liveCharacterStates]
  );
  const selectedBestiaryMonster = useMemo(
    () => bestiaryCatalog.find((entry) => entry.id === monsterDraft.selectedMonsterId) ?? null,
    [bestiaryCatalog, monsterDraft.selectedMonsterId]
  );
  const encounterUnknownBestiaryMonsters = useMemo(() => {
    const ids = Array.from(
      new Set(
        encounter.monsters
          .filter((monster) => monster.source === "bestiary" && monster.sourceMonsterId)
          .map((monster) => monster.sourceMonsterId)
          .filter((value): value is string => Boolean(value))
      )
    );

    return ids
      .map((id) => bestiaryCatalog.find((entry) => entry.id === id) ?? null)
      .filter((entry): entry is MonsterSummary => Boolean(entry))
      .filter((entry) => (entry.compendiumKnowledgeState ?? "UNKNOWN") === "UNKNOWN")
      .sort((left, right) => left.name.localeCompare(right.name, "it", { sensitivity: "base" }));
  }, [bestiaryCatalog, encounter.monsters]);
  const selectedBestiaryMonsterDetails = useMemo(
    () => (selectedBestiaryMonster ? bestiaryById[selectedBestiaryMonster.id] ?? null : null),
    [bestiaryById, selectedBestiaryMonster]
  );
  const filteredBestiaryOptions = useMemo(() => {
    const needle = monsterDraft.name.trim().toLocaleLowerCase("it");
    if (!needle) return [];
    return bestiaryCatalog
      .filter((entry) => entry.name.toLocaleLowerCase("it").includes(needle))
      .slice(0, 10);
  }, [bestiaryCatalog, monsterDraft.name]);
  const bestiaryHitPointRange = useMemo(
    () =>
      selectedBestiaryMonsterDetails
        ? parseHitPointFormulaRange(
            selectedBestiaryMonsterDetails.combat.hitPoints.formula,
            selectedBestiaryMonsterDetails.combat.hitPoints.average
          )
        : null,
    [selectedBestiaryMonsterDetails]
  );
  const monsterDraftQuantity = Number.isFinite(parseInt(monsterDraft.quantity, 10))
    ? Math.max(1, parseInt(monsterDraft.quantity, 10))
    : 1;
  const isBestiaryDraft = Boolean(monsterDraft.selectedMonsterId);
  const requiresImmediateMonsterInitiative = !isBestiaryDraft || monsterDraftQuantity === 1;

  useEffect(() => {
    document.title = "Iniziativa | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;

    void fetchCharacters()
      .then((characters) => {
        if (active) setCatalogStates(Array.isArray(characters) ? characters : []);
      })
      .catch(() => {
        if (active) setCatalogStates([]);
      });

    void fetchMonsters()
      .then((monsters) => {
        if (active) setBestiaryCatalog(Array.isArray(monsters) ? monsters : []);
      })
      .catch(() => {
        if (active) setBestiaryCatalog([]);
      });

    void fetchEncounterScenarios()
      .then((scenarios) => {
        if (active) setEncounterScenarios(Array.isArray(scenarios) ? scenarios : []);
      })
      .catch(() => {
        if (active) setEncounterScenarios([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encounter));
  }, [encounter]);

  useEffect(() => {
    if (selectedSlugs.length === 0) {
      setLiveCharacterStates({});
      return;
    }

    let cancelled = false;

    const loadCharacters = async () => {
      const results = await Promise.all(
        selectedSlugs.map(async (slug) => {
          try {
            const data = await fetchCharacter(slug);
            return [slug, data] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const nextState = results
        .filter(Boolean)
        .reduce<Record<string, CharacterState>>((acc, entry) => {
          const [slug, data] = entry!;
          acc[slug] = data;
          return acc;
        }, {});

      setLiveCharacterStates(nextState);
    };

    loadCharacters();
    const interval = window.setInterval(loadCharacters, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedSlugs]);

  useEffect(() => {
    if (!monsterDraft.selectedMonsterId) return;
    const cached = bestiaryById[monsterDraft.selectedMonsterId];
    if (cached) {
      setMonsterDraft((prev) => ({
        ...prev,
        armorClass: prev.armorClass || String(cached.combat.armorClass.value),
        hitPoints: prev.hitPoints || String(cached.combat.hitPoints.average),
      }));
      return;
    }

    let active = true;
    void fetchMonster(monsterDraft.selectedMonsterId)
      .then((monster) => {
        if (!active) return;
        setBestiaryById((prev) => ({ ...prev, [monster.id]: monster }));
        setMonsterDraft((prev) => (
          prev.selectedMonsterId === monster.id
            ? {
                ...prev,
                armorClass: prev.armorClass || String(monster.combat.armorClass.value),
                hitPoints: prev.hitPoints || String(monster.combat.hitPoints.average),
              }
            : prev
        ));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [monsterDraft.selectedMonsterId, bestiaryById]);

  useEffect(() => {
    if (!encounter.started || combatants.length === 0) return;

    const eligibleCombatants = combatants.filter(isEligibleForTurn);
    if (eligibleCombatants.length === 0) return;

    const hasCurrent = eligibleCombatants.some((combatant) => combatant.id === encounter.currentTurnId);
    if (hasCurrent) return;

    setEncounter((prev) => ({
      ...prev,
      currentTurnId: eligibleCombatants[0]?.id ?? null,
    }));
  }, [encounter.started, encounter.currentTurnId, combatants]);

  const currentTurn = combatants.find((combatant) => combatant.id === encounter.currentTurnId) ?? null;

  const triggerTurnNotification = (combatant: Combatant | null | undefined) => {
    if (!combatant || combatant.type !== "player") return;
    notifyInitiativeTurn(combatant.slug);
  };

  const addPlayer = (slug: string) => {
    if (encounter.players.some((entry) => entry.slug === slug)) return false;

    const source = catalogBySlug[slug];
    const roll = Number.isFinite(parseInt(playerRolls[slug], 10)) ? parseInt(playerRolls[slug], 10) : NaN;
    if (!Number.isFinite(roll)) return false;
    const totalInitiative = roll + (source?.initiativeBonus ?? 0);

    setEncounter((prev) => ({
      ...prev,
      players: [
        ...prev.players,
        {
          id: `player:${slug}`,
          type: "player",
          slug,
          initiativeRoll: roll,
          initiative: totalInitiative,
          statuses: [],
          sortOrder: prev.nextSortOrder,
        },
      ],
      nextSortOrder: prev.nextSortOrder + 1,
    }));

    setPlayerRolls((prev) => ({ ...prev, [slug]: "" }));
    return true;
  };

  const removePlayer = (slug: string) => {
    setEncounter((prev) => ({
      ...prev,
      players: prev.players.filter((entry) => entry.slug !== slug),
      currentTurnId: prev.currentTurnId === `player:${slug}` ? null : prev.currentTurnId,
    }));
  };

  const selectBestiaryMonster = (entry: MonsterSummary) => {
    const cached = bestiaryById[entry.id];
    setMonsterDraft((prev) => ({
      ...prev,
      name: entry.name,
      selectedMonsterId: entry.id,
      armorClass: cached ? String(cached.combat.armorClass.value) : String(entry.armorClass ?? ""),
      hitPoints: cached ? String(cached.combat.hitPoints.average) : prev.hitPoints,
    }));
    setMonsterSearchOpen(false);
    setMonsterSearchActiveIndex(-1);
  };

  const handleMonsterNameChange = (value: string) => {
    setMonsterDraft((prev) => {
      const keepsSelection =
        prev.selectedMonsterId &&
        selectedBestiaryMonster &&
        value.trim().toLocaleLowerCase("it") === selectedBestiaryMonster.name.trim().toLocaleLowerCase("it");

      return {
        ...prev,
        name: value,
        selectedMonsterId: keepsSelection ? prev.selectedMonsterId : "",
        armorClass: keepsSelection ? prev.armorClass : "",
        hitPoints: keepsSelection ? prev.hitPoints : "",
      };
    });
    setMonsterSearchOpen(Boolean(value.trim()));
    setMonsterSearchActiveIndex(-1);
  };

  const handleMonsterSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredBestiaryOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMonsterSearchOpen(true);
      setMonsterSearchActiveIndex((prev) =>
        prev < 0 ? 0 : Math.min(prev + 1, filteredBestiaryOptions.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMonsterSearchOpen(true);
      setMonsterSearchActiveIndex((prev) =>
        prev <= 0 ? filteredBestiaryOptions.length - 1 : prev - 1
      );
      return;
    }

    if (event.key === "Enter" && monsterSearchOpen && monsterSearchActiveIndex >= 0) {
      event.preventDefault();
      const entry = filteredBestiaryOptions[monsterSearchActiveIndex];
      if (entry) {
        selectBestiaryMonster(entry);
      }
      return;
    }

    if (event.key === "Escape" && monsterSearchOpen) {
      event.preventDefault();
      setMonsterSearchOpen(false);
      setMonsterSearchActiveIndex(-1);
      return;
    }
  };

  const addManualMonster = () => {
    const name = monsterDraft.name.trim();
    if (!name) return false;

    const initiative = Number.isFinite(parseInt(monsterDraft.initiative, 10))
      ? parseInt(monsterDraft.initiative, 10)
      : 0;
    const armorClass = Number.isFinite(parseInt(monsterDraft.armorClass, 10))
      ? parseInt(monsterDraft.armorClass, 10)
      : 0;
    const hitPoints = Number.isFinite(parseInt(monsterDraft.hitPoints, 10))
      ? Math.max(0, parseInt(monsterDraft.hitPoints, 10))
      : 0;
    const quantity = Number.isFinite(parseInt(monsterDraft.quantity, 10))
      ? Math.max(1, parseInt(monsterDraft.quantity, 10))
      : 1;

    if (quantity > 1) {
      setPendingMonsterBatch({
        source: "custom",
        armorClass,
        hitPoints,
        sourceMonsterId: null,
        powerTag: null,
        names: buildSequentialMonsterNames(name, quantity, encounter.monsters),
        initiatives: Array.from({ length: quantity }, () => ""),
      });
      setInitiativeBatchOpen(true);
      setMonsterDraft({
        name: "",
        selectedMonsterId: "",
        initiative: "",
        armorClass: "",
        hitPoints: "",
        quantity: "1",
      });
      return true;
    }

    setEncounter((prev) => {
      const resolvedName = hasMonsterWithSameBaseName(name, prev.monsters)
        ? nextMonsterCopyName(name, prev.monsters)
        : name;

      return {
        ...prev,
        monsters: [
          ...prev.monsters,
          {
            id: `monster:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "monster",
            name: resolvedName,
            initiative,
            armorClass,
            currentHitPoints: hitPoints,
            maxHitPoints: hitPoints,
            statuses: [],
            sortOrder: prev.nextSortOrder,
            source: "custom",
            sourceMonsterId: null,
          },
        ],
        nextSortOrder: prev.nextSortOrder + 1,
      };
    });

    setMonsterDraft({
      name: "",
      selectedMonsterId: "",
      initiative: "",
      armorClass: "",
      hitPoints: "",
      quantity: "1",
    });
    setMonsterSearchOpen(false);

    return true;
  };

  const addBestiaryMonster = () => {
    if (!selectedBestiaryMonster) return false;
    const sourceMonster = selectedBestiaryMonsterDetails;
    if (!sourceMonster) return false;

    const quantity = Number.isFinite(parseInt(monsterDraft.quantity, 10))
      ? Math.max(1, parseInt(monsterDraft.quantity, 10))
      : 1;

    const initiative = Number.isFinite(parseInt(monsterDraft.initiative, 10))
      ? parseInt(monsterDraft.initiative, 10)
      : NaN;
    if (quantity === 1 && !Number.isFinite(initiative)) return false;

    const hitPoints = Number.isFinite(parseInt(monsterDraft.hitPoints, 10))
      ? Math.max(0, parseInt(monsterDraft.hitPoints, 10))
      : sourceMonster.combat.hitPoints.average;
    const powerTag = classifyMonsterPowerTag(hitPoints, bestiaryHitPointRange);

    if (quantity > 1) {
      setPendingMonsterBatch({
        source: "bestiary",
        armorClass: sourceMonster.combat.armorClass.value,
        hitPoints,
        sourceMonsterId: sourceMonster.id,
        powerTag,
        names: buildSequentialMonsterNames(sourceMonster.general.name, quantity, encounter.monsters),
        initiatives: Array.from({ length: quantity }, () => ""),
      });
      setInitiativeBatchOpen(true);
      setMonsterDraft({ name: "", selectedMonsterId: "", initiative: "", armorClass: "", hitPoints: "", quantity: "1" });
      setMonsterSearchOpen(false);
      return true;
    }

    setEncounter((prev) => {
      const resolvedName = hasMonsterWithSameBaseName(sourceMonster.general.name, prev.monsters)
        ? nextMonsterCopyName(sourceMonster.general.name, prev.monsters)
        : sourceMonster.general.name;

      return {
        ...prev,
        monsters: [
          ...prev.monsters,
          {
            id: `monster:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "monster",
            name: resolvedName,
            initiative,
            armorClass: sourceMonster.combat.armorClass.value,
            currentHitPoints: hitPoints,
            maxHitPoints: hitPoints,
            statuses: [],
            sortOrder: prev.nextSortOrder,
            source: "bestiary",
            sourceMonsterId: sourceMonster.id,
            powerTag,
          },
        ],
        nextSortOrder: prev.nextSortOrder + 1,
      };
    });
    setMonsterDraft({ name: "", selectedMonsterId: "", initiative: "", armorClass: "", hitPoints: "", quantity: "1" });
    setMonsterSearchOpen(false);

    return true;
  };

  const addMonsterFromDraft = () => {
    if (monsterDraft.selectedMonsterId) {
      return addBestiaryMonster();
    }
    return addManualMonster();
  };

  const updatePendingMonsterInitiative = (index: number, value: string) => {
    setPendingMonsterBatch((prev) =>
      prev
        ? {
            ...prev,
            initiatives: prev.initiatives.map((entry, entryIndex) => (entryIndex === index ? value : entry)),
          }
        : prev
    );
  };

  const confirmPendingMonsterBatch = () => {
    if (!pendingMonsterBatch) return;

    const parsedInitiatives = pendingMonsterBatch.initiatives.map((value) => parseInt(value, 10));
    if (parsedInitiatives.some((value) => !Number.isFinite(value))) return;

    setEncounter((prev) => ({
      ...prev,
      monsters: [
        ...prev.monsters,
        ...pendingMonsterBatch.names.map((name, index) => ({
          id: `monster:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "monster" as const,
          name,
          initiative: parsedInitiatives[index],
          armorClass: pendingMonsterBatch.armorClass,
          currentHitPoints: pendingMonsterBatch.hitPoints,
          maxHitPoints: pendingMonsterBatch.hitPoints,
          statuses: [],
          sortOrder: prev.nextSortOrder + index,
          source: pendingMonsterBatch.source,
          sourceMonsterId: pendingMonsterBatch.sourceMonsterId,
          powerTag: pendingMonsterBatch.powerTag ?? null,
        })),
      ],
      nextSortOrder: prev.nextSortOrder + pendingMonsterBatch.names.length,
    }));

    setPendingMonsterBatch(null);
    setInitiativeBatchOpen(false);
  };

  const removeMonster = (id: string) => {
    setEncounter((prev) => ({
      ...prev,
      monsters: prev.monsters.filter((monster) => monster.id !== id),
      currentTurnId: prev.currentTurnId === id ? null : prev.currentTurnId,
    }));
  };

  const duplicateMonster = (sourceMonster: MonsterEncounterEntry) => {
    const rawInitiative = window.prompt(`Iniziativa per la copia di ${sourceMonster.name}:`, `${sourceMonster.initiative}`);
    if (rawInitiative === null) return;

    const initiative = Number.isFinite(parseInt(rawInitiative, 10)) ? parseInt(rawInitiative, 10) : NaN;
    if (!Number.isFinite(initiative)) return;

    setEncounter((prev) => ({
      ...prev,
      monsters: [
        ...prev.monsters,
        {
          ...sourceMonster,
          id: `monster:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: nextMonsterCopyName(sourceMonster.name, prev.monsters),
          initiative,
          statuses: [...sourceMonster.statuses],
          sortOrder: prev.nextSortOrder,
        },
      ],
      nextSortOrder: prev.nextSortOrder + 1,
    }));
  };

  const applyMonsterHitPointChange = (id: string, mode: "damage" | "heal") => {
    const rawValue = monsterHpAdjustments[id] ?? "";
    const amount = Number.isFinite(parseInt(rawValue, 10)) ? Math.max(0, parseInt(rawValue, 10)) : 0;
    if (!amount) return;

    setEncounter((prev) => ({
      ...prev,
      monsters: prev.monsters.map((monster) => {
        if (monster.id !== id) return monster;

        return {
          ...monster,
          currentHitPoints:
            mode === "damage"
              ? Math.max(0, monster.currentHitPoints - amount)
              : Math.min(monster.maxHitPoints, monster.currentHitPoints + amount),
        };
      }),
    }));

    setMonsterHpAdjustments((prev) => ({ ...prev, [id]: "" }));
  };

  const startEncounter = () => {
    const eligibleCombatants = combatants.filter(isEligibleForTurn);
    if (eligibleCombatants.length === 0) return;
    const nextCombatant = eligibleCombatants[0] ?? null;

    setSetupSectionsOpen(false);
    setEncounter((prev) => ({
      ...prev,
      started: true,
      round: prev.round > 0 ? prev.round : 1,
      currentTurnId: buildCombatants(prev, catalogBySlug, liveCharacterStates).filter(isEligibleForTurn)[0]?.id ?? null,
    }));
    triggerTurnNotification(nextCombatant);
  };

  const nextTurn = () => {
    if (combatants.length === 0 || !encounter.currentTurnId) return;

    const eligibleCombatants = combatants.filter(isEligibleForTurn);
    if (eligibleCombatants.length === 0) return;

    const currentIndex = eligibleCombatants.findIndex((combatant) => combatant.id === encounter.currentTurnId);
    if (currentIndex < 0) {
      const nextCombatant = eligibleCombatants[0] ?? null;
      setEncounter((prev) => ({
        ...prev,
        currentTurnId: eligibleCombatants[0]?.id ?? null,
      }));
      triggerTurnNotification(nextCombatant);
      return;
    }

    const nextIndex = (currentIndex + 1) % eligibleCombatants.length;
    const wrapped = nextIndex === 0;
    const nextCombatant = eligibleCombatants[nextIndex] ?? null;

    setEncounter((prev) => ({
      ...prev,
      currentTurnId: eligibleCombatants[nextIndex].id,
      round: wrapped ? prev.round + 1 : prev.round,
    }));
    triggerTurnNotification(nextCombatant);
  };

  const resetEncounter = () => {
    setEncounter((prev) => ({
      ...prev,
      started: false,
      round: 1,
      currentTurnId: null,
    }));
  };

  const clearEncounter = () => {
    setEncounter(emptyEncounterState());
    setLiveCharacterStates({});
  };

  const addStatusToCombatant = (combatantId: string, status: string) => {
    if (!status) return;

    setEncounter((prev) => ({
      ...prev,
      players: prev.players.map((entry) =>
        entry.id === combatantId && !entry.statuses.includes(status)
          ? { ...entry, statuses: [...entry.statuses, status] }
          : entry
      ),
      monsters: prev.monsters.map((entry) =>
        entry.id === combatantId && !entry.statuses.includes(status)
          ? { ...entry, statuses: [...entry.statuses, status] }
          : entry
      ),
    }));

    setStatusDrafts((prev) => ({ ...prev, [combatantId]: "" }));
  };

  const removeStatusFromCombatant = (combatantId: string, status: string) => {
    setEncounter((prev) => ({
      ...prev,
      players: prev.players.map((entry) =>
        entry.id === combatantId
          ? { ...entry, statuses: entry.statuses.filter((value) => value !== status) }
          : entry
      ),
      monsters: prev.monsters.map((entry) =>
        entry.id === combatantId
          ? { ...entry, statuses: entry.statuses.filter((value) => value !== status) }
          : entry
      ),
    }));
  };

  const toggleAbilityBonuses = (combatantId: string) => {
    setExpandedAbilityBonuses((prev) => ({
      ...prev,
      [combatantId]: !prev[combatantId],
    }));
  };

  const openMonsterDetail = async (monsterId: string) => {
    setMonsterDetailOpen(true);
    setMonsterDetailLoading(true);
    const cached = bestiaryById[monsterId];
    if (cached) {
      setSelectedMonsterDetail(cached);
      setMonsterDetailLoading(false);
      return;
    }

    try {
      const monster = await fetchMonster(monsterId);
      setBestiaryById((prev) => ({ ...prev, [monster.id]: monster }));
      setSelectedMonsterDetail(monster);
    } catch {
      setMonsterDetailOpen(false);
    } finally {
      setMonsterDetailLoading(false);
    }
  };

  const openUnlockKnowledgeDialog = () => {
    const ids = encounterUnknownBestiaryMonsters.map((monster) => monster.id);
    setUnlockSelection(ids);
    setUnlockKnowledgeOpen(true);
  };

  const toggleUnlockSelection = (monsterId: string, checked: boolean) => {
    setUnlockSelection((prev) =>
      checked ? Array.from(new Set([...prev, monsterId])) : prev.filter((id) => id !== monsterId)
    );
  };

  const unlockSelectedMonsterKnowledge = async () => {
    if (unlockSelection.length === 0) return;

    setUnlockingKnowledge(true);
    try {
      await Promise.all(
        unlockSelection.map((monsterId) =>
          updateMonsterCompendiumKnowledgeRequest(monsterId, "BASIC")
        )
      );

      setBestiaryCatalog((prev) =>
        prev.map((entry) =>
          unlockSelection.includes(entry.id)
            ? { ...entry, compendiumKnowledgeState: "BASIC" }
            : entry
        )
      );
      setUnlockKnowledgeOpen(false);
      setUnlockSelection([]);
    } finally {
      setUnlockingKnowledge(false);
    }
  };

  const saveCurrentMonstersAsScenario = async () => {
    const monstersToSave = encounter.monsters;
    if (monstersToSave.length === 0 || !scenarioName.trim()) return;

    const grouped = new Map<string, EncounterScenarioEntry>();
    monstersToSave.forEach((monster) => {
      const key = monster.source === "bestiary" && monster.sourceMonsterId
        ? `bestiary:${monster.sourceMonsterId}:${monster.maxHitPoints}`
        : `manual:${monster.name}:${monster.armorClass}:${monster.maxHitPoints}`;

      if (grouped.has(key)) {
        const current = grouped.get(key)!;
        current.count += 1;
        return;
      }

      if (monster.source === "bestiary" && monster.sourceMonsterId) {
        grouped.set(key, {
          type: "bestiary",
          monsterId: monster.sourceMonsterId,
          name: monster.name,
          hitPoints: monster.maxHitPoints,
          powerTag: monster.powerTag ?? null,
          count: 1,
        });
      } else {
        grouped.set(key, {
          type: "manual",
          name: monster.name,
          armorClass: monster.armorClass,
          hitPoints: monster.maxHitPoints,
          count: 1,
        });
      }
    });

    try {
      const created = await createEncounterScenarioRequest({
        name: scenarioName.trim(),
        entries: Array.from(grouped.values()),
      });
      setEncounterScenarios((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
      setScenarioName("");
      setScenarioSaveOpen(false);
    } catch {
      // keep silent for now
    }
  };

  const loadScenario = async (scenario: EncounterScenario) => {
    const pending: PendingScenarioCombatant[] = [];

    for (const entry of scenario.entries) {
      if (entry.type === "bestiary") {
        let monster = bestiaryById[entry.monsterId];
        if (!monster) {
          try {
            monster = await fetchMonster(entry.monsterId);
            setBestiaryById((prev) => ({ ...prev, [monster!.id]: monster! }));
          } catch {
            continue;
          }
        }

        for (let index = 0; index < entry.count; index += 1) {
          pending.push({
            id: `${scenario.id}:${entry.monsterId}:${index}`,
            source: "bestiary",
            sourceMonsterId: entry.monsterId,
            name: entry.count > 1 ? `${monster.general.name} ${index + 1}` : monster.general.name,
            armorClass: monster.combat.armorClass.value,
            hitPoints:
              typeof entry.hitPoints === "number" && Number.isFinite(entry.hitPoints)
                ? Math.max(0, entry.hitPoints)
                : monster.combat.hitPoints.average,
            initiative: "",
            powerTag:
              entry.powerTag ??
              classifyMonsterPowerTag(
                typeof entry.hitPoints === "number" && Number.isFinite(entry.hitPoints)
                  ? Math.max(0, entry.hitPoints)
                  : monster.combat.hitPoints.average,
                parseHitPointFormulaRange(monster.combat.hitPoints.formula, monster.combat.hitPoints.average)
              ),
          });
        }
        continue;
      }

      for (let index = 0; index < entry.count; index += 1) {
        pending.push({
          id: `${scenario.id}:${sanitizeNameForId(entry.name)}:${index}`,
          source: "manual",
          sourceMonsterId: null,
          name: entry.count > 1 ? `${entry.name} ${index + 1}` : entry.name,
          armorClass: entry.armorClass,
          hitPoints: entry.hitPoints,
          initiative: "",
        });
      }
    }

    setPendingScenarioCombatants(pending);
    setScenarioDialogOpen(false);
    setSetupSectionsOpen(true);
  };

  const addPendingScenarioCombatants = () => {
    const ready = pendingScenarioCombatants
      .map((entry) => {
        const initiative = Number.isFinite(parseInt(entry.initiative, 10)) ? parseInt(entry.initiative, 10) : NaN;
        if (!Number.isFinite(initiative)) return null;
        return {
          id: `monster:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "monster" as const,
          name: entry.name,
          initiative,
          armorClass: entry.armorClass,
          currentHitPoints: entry.hitPoints,
          maxHitPoints: entry.hitPoints,
          statuses: [],
          source: entry.source,
          sourceMonsterId: entry.sourceMonsterId,
          powerTag: entry.powerTag ?? null,
        };
      })
      .filter(Boolean);

    if (ready.length !== pendingScenarioCombatants.length) return;

    setEncounter((prev) => ({
      ...prev,
      monsters: [
        ...prev.monsters,
        ...ready.map((monster, index) => ({
          ...monster!,
          sortOrder: prev.nextSortOrder + index,
        })),
      ],
      nextSortOrder: prev.nextSortOrder + ready.length,
    }));
    setPendingScenarioCombatants([]);
  };

  const deleteScenario = async (scenarioId: string) => {
    try {
      await deleteEncounterScenarioRequest(scenarioId);
      setEncounterScenarios((prev) => prev.filter((scenario) => scenario.id !== scenarioId));
    } catch {
      // keep silent for now
    }
  };

  return (
    <div className="min-h-screen parchment p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-heading font-bold text-primary">Tracker Iniziativa</h1>
          <p className="text-sm text-muted-foreground">
            Prepara il combattimento, ordina i partecipanti e scorri i turni senza perdere di vista PF e CA.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                  <Link to="/" aria-label="Torna alla home">
                    <Home className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Torna alla home</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setScenarioDialogOpen(true)} aria-label="Carica scenario">
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Carica scenario</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setScenarioSaveOpen(true)} aria-label="Salva scenario">
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Salva scenario</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={openUnlockKnowledgeDialog}
                  aria-label="Sblocca conoscenza base"
                  disabled={encounterUnknownBestiaryMonsters.length === 0}
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sblocca conoscenza base</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
          <Card className="character-section">
            <Collapsible open={setupSectionsOpen} onOpenChange={setSetupSectionsOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="character-section-title flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Personaggi Con Scheda
                  </span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${setupSectionsOpen ? "rotate-90" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3">
                <div className="overflow-hidden rounded-md border border-border/70 bg-background/20">
                <div className="grid grid-cols-[minmax(0,1.65fr)_92px_62px_62px_84px_72px] gap-2 border-b border-border/70 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>Personaggio</span>
                  <span>Classe</span>
                  <span>Livello</span>
                  <span>Bonus</span>
                  <span>Tiro iniziativa</span>
                  <span className="text-right">Azione</span>
                </div>
                <div className="max-h-[340px] overflow-y-auto">
                {catalogList.map((entry) => {
                  const selected = encounter.players.some((player) => player.slug === entry.slug);
                  const currentState = liveCharacterStates[entry.slug];
                  const source = currentState ? toCharacterCatalogEntry(currentState) : entry;
                  const initiativeRoll = playerRolls[entry.slug] ?? "";
                  const parsedRoll = Number.isFinite(parseInt(initiativeRoll, 10))
                    ? parseInt(initiativeRoll, 10)
                    : null;
                  const totalInitiative =
                    parsedRoll !== null ? parsedRoll + (source?.initiativeBonus ?? 0) : null;

                  return (
                    <div
                      key={entry.slug}
                      className="grid grid-cols-[minmax(0,1.65fr)_92px_62px_62px_84px_72px] items-center gap-2 border-b border-border/50 px-3 py-1.5 text-sm last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-primary">{source?.name}</div>
                      </div>
                      <div className="truncate text-xs text-foreground">{source?.className || "â€”"}</div>
                      <div className="text-xs text-foreground">{source?.level || "â€”"}</div>
                      <div className="text-xs text-foreground">
                        {source?.initiativeBonus !== undefined
                          ? `${source.initiativeBonus >= 0 ? "+" : ""}${source.initiativeBonus}`
                          : "â€”"}
                      </div>
                      <Input
                        ref={(element) => {
                          playerRollInputRefs.current[entry.slug] = element;
                        }}
                        value={initiativeRoll}
                        onChange={(e) =>
                          setPlayerRolls((prev) => ({ ...prev, [entry.slug]: e.target.value }))
                        }
                        onKeyDown={(e) => handlePlayerRollKeyDown(e, entry.slug, selected, parsedRoll)}
                        inputMode="numeric"
                        placeholder="Tiro init"
                        className="h-7 text-center text-xs"
                        disabled={selected}
                        maxLength={2}
                      />
                      <div className="flex justify-end">
                        {selected ? (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => removePlayer(entry.slug)}
                            className="h-7 w-7"
                            title="Rimuovi dal tracker"
                            aria-label="Rimuovi dal tracker"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => addPlayer(entry.slug)}
                            disabled={parsedRoll === null}
                            title={totalInitiative !== null ? `Totale iniziativa ${totalInitiative}` : undefined}
                            aria-label="Aggiungi al tracker"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card className="character-section">
            <Collapsible open={setupSectionsOpen} onOpenChange={setSetupSectionsOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="character-section-title flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    Mostri E NPC
                  </span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${setupSectionsOpen ? "rotate-90" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">
                <div className="overflow-hidden rounded-md border border-border/70 bg-background/20">
                                <div className="grid grid-cols-[minmax(0,1.7fr)_72px_82px_64px_82px_110px] gap-2 border-b border-border/70 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>Nome o bestiario</span>
                  <span>CA</span>
                  <span>PF</span>
                  <span>Qt�</span>
                  <span>Init</span>
                  <span className="text-right">Azione</span>
                </div>
                <form
                  onSubmit={handleMonsterFormSubmit}
                  className="grid grid-cols-[minmax(0,1.7fr)_72px_82px_64px_82px_110px] items-start gap-2 px-3 py-1.5"
                >
                  <div className="min-w-0 space-y-1">
                    <Popover open={monsterSearchOpen && filteredBestiaryOptions.length > 0} onOpenChange={setMonsterSearchOpen}>
                      <PopoverTrigger asChild>
                        <div className="min-w-0">
                          <Input
                            ref={monsterNameInputRef}
                            value={monsterDraft.name}
                            onChange={(e) => handleMonsterNameChange(e.target.value)}
                            onKeyDown={handleMonsterSearchKeyDown}
                            onFocus={() => setMonsterSearchOpen(Boolean(monsterDraft.name.trim()))}
                            placeholder="Es. Goblin 1 oppure cerca nel bestiario"
                            className="h-7 text-xs"
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent
                        ref={monsterSearchPopoverRef}
                        align="start"
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                        onCloseAutoFocus={(event) => event.preventDefault()}
                      >
                        <Command shouldFilter={false}>
                          <CommandList>
                            <CommandEmpty>Nessun mostro trovato.</CommandEmpty>
                            <CommandGroup>
                              {filteredBestiaryOptions.map((entry, index) => (
                                <CommandItem
                                  key={entry.id}
                                  value={entry.name}
                                  onSelect={() => selectBestiaryMonster(entry)}
                                  onMouseMove={() => setMonsterSearchActiveIndex(index)}
                                  className={`flex items-center justify-between gap-3 ${
                                    monsterSearchActiveIndex === index ? "bg-accent text-accent-foreground" : ""
                                  }`}
                                >
                                  <span className="truncate">{entry.name}</span>
                                  <span className="shrink-0 text-[11px] text-muted-foreground">
                                    GS {crLabel(entry.challengeRating)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedBestiaryMonster ? (
                      <div className="truncate text-[11px] text-muted-foreground">
                        <span>GS {crLabel(selectedBestiaryMonster.challengeRating)}</span>
                        <span> - </span>
                        <span>{selectedBestiaryMonster.typeLabel || selectedBestiaryMonster.creatureType || "Tipo?"}</span>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <Input
                      value={monsterDraft.armorClass}
                      onChange={(e) => setMonsterDraft((prev) => ({ ...prev, armorClass: e.target.value }))}
                      inputMode="numeric"
                      className="h-7 text-xs"
                      placeholder={selectedBestiaryMonster ? "CA auto" : "CA"}
                      readOnly={isBestiaryDraft}
                      disabled={isBestiaryDraft}
                    />
                  </div>
                  <div>
                    <Input
                      value={monsterDraft.hitPoints}
                      onChange={(e) => setMonsterDraft((prev) => ({ ...prev, hitPoints: e.target.value }))}
                      inputMode="numeric"
                      className="h-7 text-xs"
                      placeholder={selectedBestiaryMonster ? "PF medi" : "PF"}
                      readOnly={isBestiaryDraft}
                      disabled={isBestiaryDraft}
                    />
                  </div>
                  <div>
                    <Input
                      value={monsterDraft.quantity}
                      onChange={(e) =>
                        setMonsterDraft((prev) => {
                          const nextQuantityRaw = e.target.value;
                          const nextQuantity = Number.isFinite(parseInt(nextQuantityRaw, 10))
                            ? Math.max(1, parseInt(nextQuantityRaw, 10))
                            : 1;

                          return {
                            ...prev,
                            quantity: nextQuantityRaw,
                            initiative: prev.selectedMonsterId && nextQuantity > 1 ? "" : prev.initiative,
                          };
                        })
                      }
                      inputMode="numeric"
                      className="h-7 text-center text-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <Input
                        value={monsterDraft.initiative}
                        onChange={(e) => setMonsterDraft((prev) => ({ ...prev, initiative: e.target.value }))}
                        inputMode="numeric"
                        className="h-7 text-xs"
                        disabled={isBestiaryDraft && monsterDraftQuantity > 1}
                        placeholder={isBestiaryDraft && monsterDraftQuantity > 1 ? "Batch" : "Init"}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => setMonsterDraft((prev) => ({ ...prev, initiative: String(rollD20()) }))}
                        title="Tira iniziativa"
                        aria-label="Tira iniziativa"
                        disabled={isBestiaryDraft && monsterDraftQuantity > 1}
                      >
                        <Dices className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {selectedBestiaryMonster && selectedBestiaryMonsterDetails ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => void openMonsterDetail(selectedBestiaryMonster.id)}
                        title="Apri scheda mostro"
                        aria-label="Apri scheda mostro"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="submit"
                      size="icon"
                      className="h-7 w-7"
                      disabled={
                        !monsterDraft.name.trim() ||
                        (requiresImmediateMonsterInitiative && !monsterDraft.initiative.trim()) ||
                        (monsterDraft.selectedMonsterId && !selectedBestiaryMonsterDetails)
                      }
                      title={monsterDraft.selectedMonsterId ? "Aggiungi dal bestiario" : "Aggiungi mostro manuale"}
                      aria-label={monsterDraft.selectedMonsterId ? "Aggiungi dal bestiario" : "Aggiungi mostro manuale"}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </form>
                {selectedBestiaryMonsterDetails && bestiaryHitPointRange ? (
                  <div className="border-t border-border/60 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                      <span>Range Punti Ferita</span>
                      <span>
                        {bestiaryHitPointRange.min} - {bestiaryHitPointRange.max}
                      </span>
                    </div>
                    <Slider
                      value={[
                        Math.min(
                          bestiaryHitPointRange.max,
                          Math.max(
                            bestiaryHitPointRange.min,
                            Number.isFinite(parseInt(monsterDraft.hitPoints, 10))
                              ? parseInt(monsterDraft.hitPoints, 10)
                              : bestiaryHitPointRange.average
                          )
                        ),
                      ]}
                      min={bestiaryHitPointRange.min}
                      max={bestiaryHitPointRange.max}
                      step={1}
                      onValueChange={([value]) =>
                        setMonsterDraft((prev) => ({ ...prev, hitPoints: String(value ?? bestiaryHitPointRange.average) }))
                      }
                      aria-label="Punti ferita del mostro"
                      className="py-1"
                      trackClassName="bg-[linear-gradient(90deg,rgba(244,63,94,0.55)_0%,rgba(244,63,94,0.55)_0.8%,rgba(251,191,36,0.5)_0.8%,rgba(251,191,36,0.5)_20%,rgba(148,163,184,0.35)_20%,rgba(148,163,184,0.35)_80%,rgba(56,189,248,0.45)_80%,rgba(56,189,248,0.45)_99.2%,rgba(16,185,129,0.55)_99.2%,rgba(16,185,129,0.55)_100%)]"
                      rangeClassName="bg-primary/30"
                      thumbClassName="border-primary bg-background shadow-[0_0_0_2px_rgba(0,0,0,0.08)]"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Min {bestiaryHitPointRange.min}</span>
                      <span>Medio {selectedBestiaryMonsterDetails.combat.hitPoints.average}</span>
                      <span>Max {bestiaryHitPointRange.max}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Formula: {selectedBestiaryMonsterDetails.combat.hitPoints.formula}
                    </div>
                  </div>
                ) : null}
                </div>

                <div className="hidden overflow-hidden rounded-md border border-border/70 bg-background/20">
                  <div className="grid grid-cols-[minmax(0,1.45fr)_70px_72px_82px_64px_110px] gap-2 border-b border-border/70 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <span>Bestiario</span>
                    <span>GS</span>
                    <span>CA</span>
                    <span>PF</span>
                    <span>Qtà</span>
                    <span className="text-right">Azione</span>
                  </div>
                  <form onSubmit={handleBestiaryMonsterSubmit} className="grid grid-cols-[minmax(0,1.45fr)_70px_72px_82px_64px_110px] items-end gap-2 px-3 py-1.5">
                    <div>
                      <Select
                        value={bestiaryMonsterDraft.monsterId || undefined}
                        onValueChange={(value) => setBestiaryMonsterDraft({ monsterId: value, initiative: "", hitPoints: "", quantity: "1" })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Scegli dal bestiario" />
                        </SelectTrigger>
                        <SelectContent>
                          {bestiaryCatalog.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex h-7 items-center text-xs text-muted-foreground">
                      {selectedBestiaryMonster ? crLabel(selectedBestiaryMonster.challengeRating) : "-"}
                    </div>
                    <div className="flex h-7 items-center text-xs text-muted-foreground">
                      {selectedBestiaryMonsterDetails
                        ? selectedBestiaryMonsterDetails.combat.armorClass.value
                        : "-"}
                    </div>
                    <div>
                      <Input
                        value={bestiaryMonsterDraft.hitPoints}
                        onChange={(e) => setBestiaryMonsterDraft((prev) => ({ ...prev, hitPoints: e.target.value }))}
                        inputMode="numeric"
                        className="h-7 text-xs"
                        placeholder="PF medi"
                      />
                    </div>
                    <div>
                      <Input
                        value={bestiaryMonsterDraft.quantity}
                        onChange={(e) => setBestiaryMonsterDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                        inputMode="numeric"
                        className="h-7 text-center text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        value={bestiaryMonsterDraft.initiative}
                        onChange={(e) => setBestiaryMonsterDraft((prev) => ({ ...prev, initiative: e.target.value }))}
                        inputMode="numeric"
                        className="h-7 w-12 text-center text-xs"
                        placeholder="Init"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => setBestiaryMonsterDraft((prev) => ({ ...prev, initiative: String(rollD20()) }))}
                        title="Tira iniziativa"
                        aria-label="Tira iniziativa"
                      >
                        <Dices className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="submit"
                        size="icon"
                        className="h-7 w-7"
                        onClick={addBestiaryMonster}
                        disabled={!bestiaryMonsterDraft.monsterId || !bestiaryMonsterDraft.initiative || !bestiaryById[bestiaryMonsterDraft.monsterId]}
                        title="Aggiungi dal bestiario"
                        aria-label="Aggiungi dal bestiario"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </form>
                  {selectedBestiaryMonsterDetails && bestiaryHitPointRange ? (
                    <div className="border-t border-border/60 px-3 py-3">
                      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                        <span>Range Punti Ferita</span>
                        <span>
                          {bestiaryHitPointRange.min} - {bestiaryHitPointRange.max}
                        </span>
                      </div>
                      <Slider
                        value={[
                          Math.min(
                            bestiaryHitPointRange.max,
                            Math.max(
                              bestiaryHitPointRange.min,
                              Number.isFinite(parseInt(bestiaryMonsterDraft.hitPoints, 10))
                                ? parseInt(bestiaryMonsterDraft.hitPoints, 10)
                                : bestiaryHitPointRange.average
                            )
                          ),
                        ]}
                        min={bestiaryHitPointRange.min}
                        max={bestiaryHitPointRange.max}
                        step={1}
                        onValueChange={([value]) =>
                          setBestiaryMonsterDraft((prev) => ({ ...prev, hitPoints: String(value ?? bestiaryHitPointRange.average) }))
                        }
                        aria-label="Punti ferita del mostro"
                        className="py-1"
                        trackClassName="bg-[linear-gradient(90deg,rgba(244,63,94,0.55)_0%,rgba(244,63,94,0.55)_0.8%,rgba(251,191,36,0.5)_0.8%,rgba(251,191,36,0.5)_20%,rgba(148,163,184,0.35)_20%,rgba(148,163,184,0.35)_80%,rgba(56,189,248,0.45)_80%,rgba(56,189,248,0.45)_99.2%,rgba(16,185,129,0.55)_99.2%,rgba(16,185,129,0.55)_100%)]"
                        rangeClassName="bg-primary/30"
                        thumbClassName="border-primary bg-background shadow-[0_0_0_2px_rgba(0,0,0,0.08)]"
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Min {bestiaryHitPointRange.min}</span>
                        <span>Medio {selectedBestiaryMonsterDetails.combat.hitPoints.average}</span>
                        <span>Max {bestiaryHitPointRange.max}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Formula: {selectedBestiaryMonsterDetails.combat.hitPoints.formula}
                      </div>
                    </div>
                  ) : null}
                </div>

                {pendingScenarioCombatants.length > 0 ? (
                  <div className="overflow-hidden rounded-md border border-primary/30 bg-primary/5">
                    <div className="flex items-center justify-between border-b border-primary/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Scenario pronto da caricare</div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" className="h-7 w-7" onClick={addPendingScenarioCombatants} title="Conferma scenario" aria-label="Conferma scenario">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPendingScenarioCombatants([])} title="Annulla scenario" aria-label="Annulla scenario">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1.6fr)_90px_80px_90px_70px] gap-2 border-b border-primary/20 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <span>Nome</span>
                      <span>Init</span>
                      <span>CA</span>
                      <span>PF</span>
                      <span>Fonte</span>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto">
                      {pendingScenarioCombatants.map((entry) => (
                        <div key={entry.id} className="grid grid-cols-[minmax(0,1.6fr)_90px_80px_90px_70px] items-center gap-2 px-3 py-1.5 text-sm border-b border-primary/10 last:border-b-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="truncate font-medium text-primary">{entry.name}</div>
                          {entry.powerTag ? (
                            <Badge variant="outline" className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${monsterPowerTagClassName(entry.powerTag)}`}>
                              {formatMonsterPowerTag(entry.powerTag)}
                            </Badge>
                          ) : null}
                        </div>
                          <Input value={entry.initiative} onChange={(event) => setPendingScenarioCombatants((prev) => prev.map((current) => current.id === entry.id ? { ...current, initiative: event.target.value } : current))} inputMode="numeric" className="h-7 text-xs" />
                          <div className="text-xs text-foreground">{entry.armorClass}</div>
                          <div className="text-xs text-foreground">{entry.hitPoints}</div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{entry.source === "bestiary" ? "Best." : "Manuale"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        <Card className="character-section">
          <div className="character-section-title flex items-center justify-between gap-4">
            <span>Combattimento</span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Round {encounter.round}</Badge>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={clearEncounter}
                title="Svuota incontro"
                aria-label="Svuota incontro"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {encounter.started ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={resetEncounter}
                  title="Termina combattimento"
                  aria-label="Termina combattimento"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={startEncounter}
                  disabled={combatants.filter(isEligibleForTurn).length === 0}
                  title="Avvia combattimento"
                  aria-label="Avvia combattimento"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                className="h-8 w-8"
                onClick={nextTurn}
                disabled={!encounter.started || combatants.length === 0}
                title="Prossimo turno"
                aria-label="Prossimo turno"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {combatants.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aggiungi almeno un personaggio o un mostro per preparare l'ordine di iniziativa.
            </div>
          ) : (
            <div className="space-y-4">
              {currentTurn && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  Turno attuale:
                  <span className="ml-2 font-semibold text-primary">
                    {currentTurn.name}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {combatants.map((combatant, index) => {
                  const active = combatant.id === encounter.currentTurnId;
                  const abilitiesExpanded = !!expandedAbilityBonuses[combatant.id];
                  const { currentPct, tempPct } = hpSegments(combatant.hp);
                  const barColor = hpBarColor(combatant.hp);
                  const monsterAdjustment = monsterHpAdjustments[combatant.id] ?? "";
                  const showDeathSaves =
                    combatant.type === "player" && (combatant.hp.current ?? 0) === 0;

                  return (
                    <div
                      key={combatant.id}
                      className={`rounded-md border p-3 transition-colors ${
                        active ? "border-primary bg-primary/5" : "border-border/60 bg-background/40"
                      }`}
                    >
                      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(220px,0.75fr)_minmax(560px,1.75fr)_280px] lg:items-center lg:gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={active ? "default" : "outline"}>#{index + 1}</Badge>
                            <div className="font-heading text-lg font-semibold text-primary">
                              {combatant.name}
                            </div>
                            {combatant.type === "monster" && combatant.powerTag ? (
                              <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${monsterPowerTagClassName(combatant.powerTag)}`}>
                                {formatMonsterPowerTag(combatant.powerTag)}
                              </Badge>
                            ) : null}
                            <Badge variant="secondary">{combatant.initiative}</Badge>
                            {combatant.type === "player" ? (
                              <Badge variant="outline">
                                {combatant.className} {combatant.level ? `Lv ${combatant.level}` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Mostro</Badge>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                              <span className="text-muted-foreground">CA</span>{" "}
                              <span>{combatant.armorClass}</span>
                            </div>
                            {combatant.type === "player" && combatant.resourceSummary.entries.length > 0 && (
                              <ResourceSummaryBadge
                                label={combatant.resourceSummary.label}
                                entries={combatant.resourceSummary.entries}
                              />
                            )}
                            {combatant.type === "player" && (
                              <>
                                <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                                  <span className="text-muted-foreground">Perc</span>{" "}
                                  <span>{combatant.passivePerception}</span>
                                </div>
                                {combatant.spellSaveDc !== null && (
                                  <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                                    <span className="text-muted-foreground">CD</span>{" "}
                                    <span>{combatant.spellSaveDc}</span>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleAbilityBonuses(combatant.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90 transition-colors hover:bg-accent"
                                  aria-expanded={abilitiesExpanded}
                                  aria-label="Mostra bonus caratteristiche"
                                  title="Mostra bonus caratteristiche"
                                >
                                  <span className="text-muted-foreground">Caratt.</span>
                                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${abilitiesExpanded ? "rotate-90" : ""}`} />
                                </button>
                              </>
                            )}
                          </div>
                          {combatant.type === "player" && (
                            <div
                              className={`grid transition-all ${abilitiesExpanded ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                            >
                              <div className="overflow-hidden">
                                <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/50 bg-background/30 px-2 py-2">
                                  {combatant.abilityBonuses.map((ability) => (
                                    <div
                                      key={`${combatant.id}-${ability.label}`}
                                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/90"
                                    >
                                      {ability.label} {ability.value >= 0 ? `+${ability.value}` : ability.value}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                          <div className="h-2 w-full overflow-hidden rounded bg-border">
                            <div className="flex h-full w-full">
                              <div className={`${barColor} h-full`} style={{ width: `${currentPct}%` }} />
                              {tempPct > 0 && <div className="h-full bg-sky-400" style={{ width: `${tempPct}%` }} />}
                            </div>
                          </div>
                          <span className="min-w-fit text-xs tabular-nums text-muted-foreground">
                            {combatant.hp.current}/{combatant.hp.max}
                            {combatant.hp.temp ? ` (+${combatant.hp.temp})` : ""}
                          </span>
                        </div>

                        {combatant.type === "player" ? (
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="icon"
                              asChild
                              className="h-8 w-8"
                            >
                              <a
                                href={`/${combatant.slug}`}
                                title="Apri scheda"
                                aria-label="Apri scheda"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="default"
                              onClick={() => applyMonsterHitPointChange(combatant.id, "damage")}
                              disabled={!monsterHpAdjustments[combatant.id]}
                              title="Sottrai PF"
                              className="h-8 w-8 bg-red-600 hover:bg-red-700 text-white"
                            >
                              <Sword className="h-4 w-4 text-white" />
                            </Button>
                            <Input
                              value={monsterHpAdjustments[combatant.id] ?? ""}
                              onChange={(e) =>
                                setMonsterHpAdjustments((prev) => ({
                                  ...prev,
                                  [combatant.id]: e.target.value,
                                }))
                              }
                              inputMode="numeric"
                              placeholder="0"
                              className="h-8 w-12 text-center text-xs"
                            />
                            <Button
                              size="icon"
                              variant="default"
                              onClick={() => applyMonsterHitPointChange(combatant.id, "heal")}
                              disabled={!monsterHpAdjustments[combatant.id]}
                              title="Aggiungi PF"
                              className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white"
                            >
                              <FlaskConical className="h-4 w-4 text-white" />
                            </Button>
                            {combatant.source === "bestiary" && combatant.sourceMonsterId ? (
                              <Button size="icon" variant="ghost" onClick={() => void openMonsterDetail(combatant.sourceMonsterId!)} title="Apri stats mostro" className="h-8 w-8">
                                <BookOpen className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button size="icon" variant="ghost" onClick={() => duplicateMonster(combatant)} title="Copia mostro" className="h-8 w-8">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => removeMonster(combatant.id)} title="Rimuovi mostro" className="h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {showDeathSaves && (
                        <div className="mt-2 flex justify-center lg:justify-start">
                          <DeathSaveTrack
                            successes={combatant.deathSaves.successes}
                            failures={combatant.deathSaves.failures}
                          />
                        </div>
                      )}


                      <div className="mt-3 flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-h-7 flex flex-wrap gap-2">
                          {combatant.statuses.length > 0 &&
                            combatant.statuses.map((status) => (
                              <button
                                key={`${combatant.id}-${status}`}
                                type="button"
                                onClick={() => removeStatusFromCombatant(combatant.id, status)}
                                className="inline-flex"
                                title="Rimuovi status"
                              >
                                <Badge variant="secondary" className="rounded-full border border-border/50 bg-muted/80 px-2.5 py-1">
                                  {status} x
                                </Badge>
                              </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={statusDrafts[combatant.id] ?? ""}
                            onChange={(e) => {
                              const nextStatus = e.target.value;
                              setStatusDrafts((prev) => ({ ...prev, [combatant.id]: nextStatus }));
                              if (nextStatus) addStatusToCombatant(combatant.id, nextStatus);
                            }}
                            className="h-8 rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="">Aggiungi status</option>
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog
        open={scenarioSaveOpen}
        onOpenChange={(open) => {
          setScenarioSaveOpen(open);
          if (!open) setScenarioName("");
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Salva scenario</DialogTitle>
            <DialogDescription>
              Salva i mostri attualmente nel tracker come composizione riutilizzabile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-name">Nome scenario</Label>
              <Input id="scenario-name" value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="Es. Scontro nella grotta" />
            </div>
            <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3 text-sm text-muted-foreground">
              {encounter.monsters.length === 0
                ? "Nessun mostro attualmente nel tracker."
                : `${encounter.monsters.length} nemici verranno trasformati in scenario.`}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScenarioSaveOpen(false)}>Annulla</Button>
            <Button onClick={() => void saveCurrentMonstersAsScenario()} disabled={!scenarioName.trim() || encounter.monsters.length === 0}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={initiativeBatchOpen}
        onOpenChange={(open) => {
          setInitiativeBatchOpen(open);
          if (!open) {
            setPendingMonsterBatch(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Iniziative multiple</DialogTitle>
            <DialogDescription>
              Inserisci l'iniziativa di ogni istanza prima di aggiungerla al tracker.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingMonsterBatch?.names.map((name, index) => (
              <div key={`${name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_88px_36px] items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <div className="truncate text-sm font-medium text-primary">{name}</div>
                <Input
                  value={pendingMonsterBatch.initiatives[index] ?? ""}
                  onChange={(event) => updatePendingMonsterInitiative(index, event.target.value)}
                  inputMode="numeric"
                  className="h-8 text-center text-xs"
                  placeholder="Init"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => updatePendingMonsterInitiative(index, String(rollD20()))}
                  title="Tira iniziativa"
                  aria-label={`Tira iniziativa per ${name}`}
                >
                  <Dices className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setInitiativeBatchOpen(false)} aria-label="Annulla">
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={confirmPendingMonsterBatch}
              disabled={!pendingMonsterBatch || pendingMonsterBatch.initiatives.some((value) => !Number.isFinite(parseInt(value, 10)))}
              aria-label="Conferma iniziative"
            >
              <Check className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={scenarioDialogOpen}
        onOpenChange={setScenarioDialogOpen}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carica scenario</DialogTitle>
            <DialogDescription>
              Seleziona uno scenario preparato: poi inserirai solo le iniziative dei nemici generati.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {encounterScenarios.length === 0 ? (
              <div className="rounded-md border border-border/60 bg-background/50 px-3 py-4 text-sm text-muted-foreground">
                Nessuno scenario salvato.
              </div>
            ) : encounterScenarios.map((scenario) => (
              <div key={scenario.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{scenario.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {scenario.entries
                      .map((entry) => `${entry.count} ${entry.name}${entry.type === "bestiary" && entry.powerTag ? ` (${formatMonsterPowerTag(entry.powerTag)})` : ""}`)
                      .join(" + ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" className="h-8 w-8" onClick={() => void loadScenario(scenario)} title="Carica scenario" aria-label="Carica scenario">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void deleteScenario(scenario.id)} title="Elimina scenario" aria-label="Elimina scenario">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={unlockKnowledgeOpen}
        onOpenChange={(open) => {
          setUnlockKnowledgeOpen(open);
          if (!open) {
            setUnlockSelection([]);
            setUnlockingKnowledge(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sblocca conoscenza base</DialogTitle>
            <DialogDescription>
              Seleziona i mostri del bestiario presenti nello scontro che vuoi rendere noti ai player al livello base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {encounterUnknownBestiaryMonsters.length === 0 ? (
              <div className="rounded-md border border-border/60 bg-background/50 px-3 py-4 text-sm text-muted-foreground">
                Tutti i mostri del bestiario presenti in questo combattimento hanno già un livello di conoscenza diverso da sconosciuto.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="text-muted-foreground">{unlockSelection.length} selezionati</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 rounded-full px-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground" onClick={() => setUnlockSelection(encounterUnknownBestiaryMonsters.map((monster) => monster.id))}>
                      Tutti
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 rounded-full px-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground" onClick={() => setUnlockSelection([])}>
                      Nessuno
                    </Button>
                  </div>
                </div>
                <div className="max-h-[340px] overflow-y-auto rounded-md border border-border/60 bg-background/40">
                  {encounterUnknownBestiaryMonsters.map((monster) => {
                    const checked = unlockSelection.includes(monster.id);
                    return (
                      <label
                        key={monster.id}
                        className="flex cursor-pointer items-center justify-between gap-3 border-b border-border/50 px-3 py-3 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-primary">{monster.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            GS {crLabel(monster.challengeRating)} · {monster.size || "-"} · {monster.typeLabel || monster.creatureType || "-"}
                          </div>
                        </div>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleUnlockSelection(monster.id, value === true)}
                          aria-label={`Seleziona ${monster.name}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setUnlockKnowledgeOpen(false)} aria-label="Annulla">
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => void unlockSelectedMonsterKnowledge()}
              disabled={unlockSelection.length === 0 || unlockingKnowledge || encounterUnknownBestiaryMonsters.length === 0}
              aria-label="Sblocca livello base"
            >
              <Check className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={monsterDetailOpen}
        onOpenChange={(open) => {
          setMonsterDetailOpen(open);
          if (!open) {
            setSelectedMonsterDetail(null);
            setMonsterDetailLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl border-primary/20 bg-card/95 p-0 [&>button]:hidden">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle className="font-heading text-3xl text-primary">
              {selectedMonsterDetail?.general.name || "Dettaglio mostro"}
            </DialogTitle>
            <DialogDescription>
              Scheda rapida dal bestiario per consultazione durante il combattimento.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[78vh]">
            <div className="px-6 py-6">
              {monsterDetailLoading || !selectedMonsterDetail ? (
                <div className="text-sm text-muted-foreground">Carico il dettaglio del mostro...</div>
              ) : (
                <TrackerMonsterStatBlock monster={selectedMonsterDetail} />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}





