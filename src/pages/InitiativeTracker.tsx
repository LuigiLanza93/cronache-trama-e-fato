import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { fetchCharacter } from "@/realtime";
import { Check, ChevronRight, Copy, FlaskConical, Heart, Plus, Skull, Sword, Swords, Trash2, Users, X } from "lucide-react";

type CharacterState = Record<string, any>;

type CharacterCatalogEntry = {
  slug: string;
  name: string;
  className: string;
  level: number;
  initiativeBonus: number;
  armorClass: number;
  hp: { current: number; max: number; temp: number };
  deathSaves: { successes: number; failures: number };
  resourceSummary: { label: string; entries: Array<{ label: string; remaining: number }> };
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
  hp: { current: number; max: number; temp: number };
  deathSaves: { successes: number; failures: number };
  resourceSummary: { label: string; entries: Array<{ label: string; remaining: number }> };
  statuses: string[];
};

type MonsterCombatant = MonsterEncounterEntry & {
  hp: { current: number; max: number; temp: number };
};

type Combatant = PlayerCombatant | MonsterCombatant;

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

const characterModules = import.meta.glob("../data/characters/*.json", { eager: true }) as Record<
  string,
  { default: CharacterState }
>;

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
    return { label: "", entries: [] as Array<{ label: string; remaining: number }> };
  }

  if (normalizedClass === "guerriero" || normalizedClass === "fighter") {
    return {
      label: "Manovre",
      entries: entries.map(({ level, remaining }) => ({
        label: `d${level}`,
        remaining,
      })),
    };
  }

  return {
    label: "Slot",
    entries: entries.map(({ level, remaining }) => ({
      label: `${level}°`,
      remaining,
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

function nextMonsterCopyName(name: string, monsters: MonsterEncounterEntry[]) {
  const normalizedBase = name.replace(/\s+\d+$/, "").trim();
  let highest = 1;

  monsters.forEach((monster) => {
    const match = monster.name.match(/^(.*?)(?:\s+(\d+))?$/);
    if (!match) return;

    const candidateBase = match[1].trim();
    const candidateIndex = match[2] ? parseInt(match[2], 10) : 1;

    if (candidateBase.toLowerCase() === normalizedBase.toLowerCase()) {
      highest = Math.max(highest, candidateIndex);
    }
  });

  return `${normalizedBase} ${highest + 1}`;
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
  const [liveCharacterStates, setLiveCharacterStates] = useState<Record<string, CharacterState>>({});
  const [playerRolls, setPlayerRolls] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [monsterHpAdjustments, setMonsterHpAdjustments] = useState<Record<string, string>>({});
  const [setupSectionsOpen, setSetupSectionsOpen] = useState(true);
  const [monsterForm, setMonsterForm] = useState({
    name: "",
    initiative: "",
    armorClass: "",
    hitPoints: "",
  });

  const catalogList = useMemo(
    () =>
      Object.values(characterModules)
        .map((mod) => toCharacterCatalogEntry(mod.default))
        .filter(Boolean)
        .sort((a, b) => a!.name.localeCompare(b!.name, undefined, { sensitivity: "base" })) as CharacterCatalogEntry[],
    []
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

  useEffect(() => {
    document.title = "Iniziativa | D&D Character Manager";
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

  const addPlayer = (slug: string) => {
    if (encounter.players.some((entry) => entry.slug === slug)) return;

    const source = catalogBySlug[slug];
    const roll = Number.isFinite(parseInt(playerRolls[slug], 10)) ? parseInt(playerRolls[slug], 10) : NaN;
    if (!Number.isFinite(roll)) return;
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
  };

  const removePlayer = (slug: string) => {
    setEncounter((prev) => ({
      ...prev,
      players: prev.players.filter((entry) => entry.slug !== slug),
      currentTurnId: prev.currentTurnId === `player:${slug}` ? null : prev.currentTurnId,
    }));
  };

  const addMonster = () => {
    const name = monsterForm.name.trim();
    if (!name) return;

    const initiative = Number.isFinite(parseInt(monsterForm.initiative, 10))
      ? parseInt(monsterForm.initiative, 10)
      : 0;
    const armorClass = Number.isFinite(parseInt(monsterForm.armorClass, 10))
      ? parseInt(monsterForm.armorClass, 10)
      : 0;
    const hitPoints = Number.isFinite(parseInt(monsterForm.hitPoints, 10))
      ? Math.max(0, parseInt(monsterForm.hitPoints, 10))
      : 0;

    setEncounter((prev) => ({
      ...prev,
      monsters: [
        ...prev.monsters,
        {
          id: `monster:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "monster",
          name,
          initiative,
          armorClass,
          currentHitPoints: hitPoints,
          maxHitPoints: hitPoints,
          statuses: [],
          sortOrder: prev.nextSortOrder,
        },
      ],
      nextSortOrder: prev.nextSortOrder + 1,
    }));

    setMonsterForm({
      name: "",
      initiative: "",
      armorClass: "",
      hitPoints: "",
    });
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

    setSetupSectionsOpen(false);
    setEncounter((prev) => ({
      ...prev,
      started: true,
      round: prev.round > 0 ? prev.round : 1,
      currentTurnId: buildCombatants(prev, catalogBySlug, liveCharacterStates).filter(isEligibleForTurn)[0]?.id ?? null,
    }));
  };

  const nextTurn = () => {
    if (combatants.length === 0 || !encounter.currentTurnId) return;

    const eligibleCombatants = combatants.filter(isEligibleForTurn);
    if (eligibleCombatants.length === 0) return;

    const currentIndex = eligibleCombatants.findIndex((combatant) => combatant.id === encounter.currentTurnId);
    if (currentIndex < 0) {
      setEncounter((prev) => ({
        ...prev,
        currentTurnId: eligibleCombatants[0]?.id ?? null,
      }));
      return;
    }

    const nextIndex = (currentIndex + 1) % eligibleCombatants.length;
    const wrapped = nextIndex === 0;

    setEncounter((prev) => ({
      ...prev,
      currentTurnId: eligibleCombatants[nextIndex].id,
      round: wrapped ? prev.round + 1 : prev.round,
    }));
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

  return (
    <div className="min-h-screen parchment p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-heading font-bold text-primary">Tracker Iniziativa</h1>
          <p className="text-sm text-muted-foreground">
            Prepara il combattimento, ordina i partecipanti e scorri i turni senza perdere di vista PF e CA.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
                <div className="grid grid-cols-[minmax(0,1.8fr)_110px_70px_70px_90px_96px] gap-2 border-b border-border/70 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
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
                      className="grid grid-cols-[minmax(0,1.8fr)_110px_70px_70px_90px_96px] items-center gap-2 border-b border-border/50 px-3 py-1.5 text-sm last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-primary">{source?.name}</div>
                      </div>
                      <div className="truncate text-xs text-foreground">{source?.className || "—"}</div>
                      <div className="text-xs text-foreground">{source?.level || "—"}</div>
                      <div className="text-xs text-foreground">
                        {source?.initiativeBonus !== undefined
                          ? `${source.initiativeBonus >= 0 ? "+" : ""}${source.initiativeBonus}`
                          : "—"}
                      </div>
                      <Input
                        value={initiativeRoll}
                        onChange={(e) =>
                          setPlayerRolls((prev) => ({ ...prev, [entry.slug]: e.target.value }))
                        }
                        inputMode="numeric"
                        placeholder="Tiro init"
                        className="h-7 text-center text-xs"
                        disabled={selected}
                        maxLength={2}
                      />
                      <div className="flex justify-end">
                        {selected ? (
                          <Button size="sm" variant="outline" onClick={() => removePlayer(entry.slug)} className="h-7 px-2.5 text-xs">
                            Rimuovi
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => addPlayer(entry.slug)}
                            disabled={parsedRoll === null}
                            title={totalInitiative !== null ? `Totale iniziativa ${totalInitiative}` : undefined}
                          >
                            Aggiungi
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
                <div className="grid grid-cols-[minmax(0,1.6fr)_90px_80px_90px_110px] gap-2 border-b border-border/70 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>Nome</span>
                  <span>Init</span>
                  <span>CA</span>
                  <span>PF</span>
                  <span className="text-right">Azione</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1.6fr)_90px_80px_90px_110px] items-end gap-2 px-3 py-1.5">
                  <div>
                    <Input
                      value={monsterForm.name}
                      onChange={(e) => setMonsterForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Es. Goblin 1"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      value={monsterForm.initiative}
                      onChange={(e) => setMonsterForm((prev) => ({ ...prev, initiative: e.target.value }))}
                      inputMode="numeric"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      value={monsterForm.armorClass}
                      onChange={(e) => setMonsterForm((prev) => ({ ...prev, armorClass: e.target.value }))}
                      inputMode="numeric"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      value={monsterForm.hitPoints}
                      onChange={(e) => setMonsterForm((prev) => ({ ...prev, hitPoints: e.target.value }))}
                      inputMode="numeric"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={addMonster} className="h-7 px-2.5 text-xs">
                      <Plus className="mr-2 h-4 w-4" />
                      Aggiungi
                    </Button>
                  </div>
                </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        <Card className="character-section">
          <div className="character-section-title flex items-center justify-between gap-4">
            <span>Combattimento</span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Round {encounter.round}</Badge>
              <Button variant="outline" size="sm" onClick={clearEncounter}>
                Svuota incontro
              </Button>
              {encounter.started ? (
                <Button variant="outline" size="sm" onClick={resetEncounter}>
                  Termina
                </Button>
              ) : (
                <Button size="sm" onClick={startEncounter} disabled={combatants.filter(isEligibleForTurn).length === 0}>
                  Avvia
                </Button>
              )}
              <Button size="sm" onClick={nextTurn} disabled={!encounter.started || combatants.length === 0}>
                Prossimo
                <ChevronRight className="ml-1 h-4 w-4" />
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
                            <Badge variant="secondary">{combatant.initiative}</Badge>
                            {combatant.type === "player" ? (
                              <Badge variant="outline">
                                {combatant.className} {combatant.level ? `Lv ${combatant.level}` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Mostro</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span>CA {combatant.armorClass}</span>
                            {combatant.type === "player" && combatant.resourceSummary.entries.length > 0 && (
                              <span className="truncate">
                                {combatant.resourceSummary.label}{" "}
                                {combatant.resourceSummary.entries
                                  .map((entry) => `${entry.label}: ${entry.remaining}`)
                                  .join(" · ")}
                              </span>
                            )}
                          </div>
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
                            <Button variant="outline" size="sm" asChild className="h-8 px-3">
                              <a href={`/${combatant.slug}`}>Apri scheda</a>
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


                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                                <Badge variant="secondary">{status} ×</Badge>
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
    </div>
  );
}
