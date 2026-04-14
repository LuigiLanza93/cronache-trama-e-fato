import { type ComponentPropsWithoutRef, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Dice6,
  Circle,
  KeyRound,
  Link2,
  LogIn,
  LogOut,
  Package,
  PlusCircle,
  Scroll,
  ScrollText,
  Shield,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppVersionDialog } from "@/components/app-version-dialog";
import { useAuth } from "@/components/auth-provider";
import { ResourceSummaryBadge } from "@/components/resource-summary-badge";
import {
  fetchCurrencyTransactions,
  fetchInventoryTransfers,
  fetchItemDefinitions,
  fetchMonsters,
  fetchUsers,
  type CurrencyTransactionEntry,
  type InventoryTransferEntry,
  type ItemDefinitionSummary,
  type ManagedUser,
  type MonsterSummary,
} from "@/lib/auth";
import { fetchCharacters, requestPresenceSnapshot, subscribePresence } from "@/realtime";

type CharacterState = Record<string, any>;

type HomeCharacter = {
  slug: string;
  name: string;
  characterType: "pg" | "png";
  className: string;
  level: number | null;
  initiativeBonus: number;
  armorClass: number | null;
  passivePerception: number | null;
  spellSaveDc: number | null;
  resourceSummary: { label: string; entries: Array<{ label: string; remaining: number; total: number }> };
  hp: {
    current: number;
    max: number;
    temp: number;
  };
};

type InitiativePlayerEntry = {
  id: string;
  slug: string;
  initiative: number;
  initiativeRoll: number;
  sortOrder: number;
};

type InitiativeMonsterEntry = {
  id: string;
  name: string;
  initiative: number;
  currentHitPoints: number;
  maxHitPoints: number;
  sortOrder: number;
};

type InitiativeEncounterState = {
  players: InitiativePlayerEntry[];
  monsters: InitiativeMonsterEntry[];
  started: boolean;
  round: number;
  currentTurnId: string | null;
};

type InitiativeCombatantSummary = {
  id: string;
  name: string;
  initiative: number;
  sortOrder: number;
  type: "player" | "monster";
  currentHitPoints?: number;
};

type TransactionCardSummary = {
  title: string;
  detail: string;
  timestamp: string;
} | null;

const INITIATIVE_STORAGE_KEY = "dm-initiative-tracker-v1";
const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "VERY_RARE", "LEGENDARY", "UNIQUE"] as const;
const RARITY_LABELS: Record<string, string> = {
  COMMON: "Comuni",
  UNCOMMON: "Non comuni",
  RARE: "Rari",
  VERY_RARE: "Molto rari",
  LEGENDARY: "Leggendari",
  UNIQUE: "Unici",
};
const RARITY_ALIASES: Record<string, (typeof RARITY_ORDER)[number]> = {
  COMMON: "COMMON",
  COMUNE: "COMMON",
  UNCOMMON: "UNCOMMON",
  "NON COMUNE": "UNCOMMON",
  NON_COMUNE: "UNCOMMON",
  RARE: "RARE",
  RARO: "RARE",
  VERY_RARE: "VERY_RARE",
  "MOLTO RARO": "VERY_RARE",
  MOLTO_RARO: "VERY_RARE",
  LEGENDARY: "LEGENDARY",
  LEGGENDARIO: "LEGENDARY",
  UNIQUE: "UNIQUE",
  UNICO: "UNIQUE",
};

function normalizeRarityKey(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, " ");

  return RARITY_ALIASES[normalized] ?? normalized.replace(/\s+/g, "_");
}

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

function hpPercent(hp: HomeCharacter["hp"]) {
  const max = Math.max(1, hp.max);
  return Math.min(100, Math.round((Math.max(0, hp.current) / max) * 100));
}

function hpSegments(hp: HomeCharacter["hp"]) {
  const current = Math.max(0, hp.current);
  const max = Math.max(1, hp.max);
  const temp = Math.max(0, hp.temp);
  const total = max + temp;

  return {
    currentPct: Math.min(100, (current / total) * 100),
    tempPct: Math.min(100, (temp / total) * 100),
  };
}

function hpBarColor(hp: HomeCharacter["hp"]) {
  const percent = hpPercent(hp);
  if (percent >= 66) return "bg-emerald-500";
  if (percent >= 33) return "bg-amber-500";
  return "bg-rose-500";
}

function parseInitiativeEncounterState(raw: string | null): InitiativeEncounterState {
  if (!raw) {
    return {
      players: [],
      monsters: [],
      started: false,
      round: 1,
      currentTurnId: null,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed?.players)
        ? parsed.players.map((player: any) => ({
            id: typeof player?.id === "string" ? player.id : `player:${String(player?.slug ?? "")}`,
            slug: typeof player?.slug === "string" ? player.slug : "",
            initiative: typeof player?.initiative === "number" ? player.initiative : 0,
            initiativeRoll: typeof player?.initiativeRoll === "number" ? player.initiativeRoll : 0,
            sortOrder: typeof player?.sortOrder === "number" ? player.sortOrder : 0,
          }))
        : [],
      monsters: Array.isArray(parsed?.monsters)
        ? parsed.monsters.map((monster: any) => ({
            id: typeof monster?.id === "string" ? monster.id : `monster:${String(monster?.name ?? "")}`,
            name: typeof monster?.name === "string" ? monster.name : "Mostro",
            initiative: typeof monster?.initiative === "number" ? monster.initiative : 0,
            currentHitPoints: typeof monster?.currentHitPoints === "number" ? monster.currentHitPoints : 0,
            maxHitPoints: typeof monster?.maxHitPoints === "number" ? monster.maxHitPoints : 0,
            sortOrder: typeof monster?.sortOrder === "number" ? monster.sortOrder : 0,
          }))
        : [],
      started: !!parsed?.started,
      round: typeof parsed?.round === "number" && parsed.round > 0 ? parsed.round : 1,
      currentTurnId: typeof parsed?.currentTurnId === "string" ? parsed.currentTurnId : null,
    };
  } catch {
    return {
      players: [],
      monsters: [],
      started: false,
      round: 1,
      currentTurnId: null,
    };
  }
}

function compareInitiativeCombatants(a: InitiativeCombatantSummary, b: InitiativeCombatantSummary) {
  if (b.initiative !== a.initiative) return b.initiative - a.initiative;
  return a.sortOrder - b.sortOrder;
}

function formatCompactTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
  });
}

function directionFromInventoryEntry(entry: InventoryTransferEntry) {
  if (entry.type === "INITIAL_GRANT") {
    return `DM -> ${entry.toCharacterName ?? "-"}`;
  }

  if (entry.type === "REMOVAL") {
    return `${entry.fromCharacterName ?? "-"} -> DM`;
  }

  return `${entry.fromCharacterName ?? "-"} -> ${entry.toCharacterName ?? "-"}`;
}

function currencyFromSummary(entry: CurrencyTransactionEntry) {
  if (entry.operationType === "ADD") return entry.fromExternalName ?? "Origine esterna";
  if (entry.operationType === "REMOVE") return entry.fromCharacterName ?? "-";
  if (entry.operationType === "TRANSFER") return entry.fromCharacterName ?? "-";
  return entry.fromCharacterName ?? entry.toCharacterName ?? "Portafoglio";
}

function currencyToSummary(entry: CurrencyTransactionEntry) {
  if (entry.operationType === "ADD") return entry.toCharacterName ?? "-";
  if (entry.operationType === "REMOVE") return entry.toExternalName ?? "Destinazione esterna";
  if (entry.operationType === "TRANSFER") return entry.toCharacterName ?? "-";
  return entry.toCharacterName ?? entry.fromCharacterName ?? "Portafoglio";
}

function D20Icon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M91.9,61.37l-14-42a2,2,0,0,0-1.33-1.29l-37-11a2,2,0,0,0-2,.51l-31,31a2,2,0,0,0-.48,2.06l15,44A2,2,0,0,0,22.73,86l36,5L59,91a2,2,0,0,0,1.31-.49l31-27A2,2,0,0,0,91.9,61.37ZM24.44,82,31.6,47.05l33.08,34ZM77.26,31.69,32.33,43.61l7.06-31.75Zm-47,12.12L11.16,39.66,36.88,14ZM66.38,79.92,32.91,45.53,78.38,33.46l.12.35-12,46ZM77,29.29l-30.52-16,28,8.31ZM10.66,41.6l19.16,4.17L23.16,78.26ZM58.37,86.89,35.5,83.72l27.23-.62Zm10.85-9.44L79.66,37.29l8,24.08ZM41.64,35.5a7,7,0,0,1,1.85-3.82,16.93,16.93,0,0,0,1.84-2.58A2.44,2.44,0,0,0,45.4,27a2.67,2.67,0,0,0-1.13-1.28,2.34,2.34,0,0,0-1.74-.21c-.9.2-1.38.64-1.46,1.31a4.35,4.35,0,0,0,.36,1.74l-3,.7a6,6,0,0,1-.42-3c.26-1.51,1.4-2.47,3.4-2.91a6.62,6.62,0,0,1,4.21.31,5.27,5.27,0,0,1,2.73,2.71,3.82,3.82,0,0,1,.21,2.86,7.46,7.46,0,0,1-1.35,2.28l-.85,1.08q-.81,1-1.08,1.47A2.81,2.81,0,0,0,45,35l6.62-1.74,1.11,2.45L42.09,38.6A6.75,6.75,0,0,1,41.64,35.5ZM56.57,21.81A13,13,0,0,1,60,26.36a10.48,10.48,0,0,1,1.47,5.28c-.1,1.4-1.06,2.36-2.87,2.85a5.11,5.11,0,0,1-4.76-.82,13,13,0,0,1-3.53-4.93,9.78,9.78,0,0,1-1.2-5.25c.2-1.3,1.19-2.14,3-2.53A5.18,5.18,0,0,1,56.57,21.81Zm-1.26,9.66a2.13,2.13,0,0,0,2.25.81,1.29,1.29,0,0,0,1-1.66,13.72,13.72,0,0,0-1.33-3.57,15,15,0,0,0-2.06-3.34A2.09,2.09,0,0,0,53.07,23,1.24,1.24,0,0,0,52,24.46,12.67,12.67,0,0,0,53.23,28,15.33,15.33,0,0,0,55.31,31.47Z" />
    </svg>
  );
}

function toHomeCharacter(state: CharacterState): HomeCharacter | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    characterType: state?.characterType === "png" ? "png" : "pg",
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
    initiativeBonus: state?.combatStats?.initiative ?? 0,
    armorClass: typeof state?.combatStats?.armorClass === "number" ? state.combatStats.armorClass : null,
    passivePerception: getPassivePerception(state),
    spellSaveDc: getSpellSaveDc(state),
    resourceSummary: summarizeResourceSlots(state?.basicInfo?.class, state?.combatStats?.spellSlots),
    hp: {
      current: Math.max(0, state?.combatStats?.currentHitPoints ?? 0),
      max: Math.max(0, state?.combatStats?.hitPointMaximum ?? 0),
      temp: Math.max(0, state?.combatStats?.temporaryHitPoints ?? 0),
    },
  };
}

const Index = () => {
  const { user, logout, loading, login } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<HomeCharacter[]>([]);
  const [onlineCharacterSlugs, setOnlineCharacterSlugs] = useState<string[]>([]);
  const [monsterSummaries, setMonsterSummaries] = useState<MonsterSummary[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinitionSummary[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [inventoryTransfers, setInventoryTransfers] = useState<InventoryTransferEntry[]>([]);
  const [currencyTransactions, setCurrencyTransactions] = useState<CurrencyTransactionEntry[]>([]);
  const [initiativeEncounter, setInitiativeEncounter] = useState<InitiativeEncounterState>(() =>
    typeof window === "undefined" ? parseInitiativeEncounterState(null) : parseInitiativeEncounterState(window.localStorage.getItem(INITIATIVE_STORAGE_KEY))
  );
  const [playerCreateDialogOpen, setPlayerCreateDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    document.title = "Home | D&D Character Manager";
  }, []);

  useEffect(() => {
    if (!user) {
      setCharacters([]);
      setMonsterSummaries([]);
      setItemDefinitions([]);
      setManagedUsers([]);
      setInventoryTransfers([]);
      setCurrencyTransactions([]);
      return;
    }

    let active = true;

    void fetchCharacters()
      .then((items) => {
        if (!active) return;
        const nextCharacters = Array.isArray(items)
          ? items
              .map((item) => toHomeCharacter(item))
              .filter((item): item is HomeCharacter => !!item)
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
          : [];
        setCharacters(nextCharacters);
      })
      .catch(() => {
        if (active) setCharacters([]);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "dm") {
      setMonsterSummaries([]);
      setItemDefinitions([]);
      setManagedUsers([]);
      setInventoryTransfers([]);
      setCurrencyTransactions([]);
      return;
    }

    let active = true;

    void fetchMonsters()
      .then((items) => {
        if (active) setMonsterSummaries(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setMonsterSummaries([]);
      });

    void fetchItemDefinitions()
      .then((items) => {
        if (active) setItemDefinitions(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setItemDefinitions([]);
      });

    void fetchUsers()
      .then((items) => {
        if (active) setManagedUsers(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setManagedUsers([]);
      });

    void fetchInventoryTransfers()
      .then((items) => {
        if (active) setInventoryTransfers(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setInventoryTransfers([]);
      });

    void fetchCurrencyTransactions()
      .then((items) => {
        if (active) setCurrencyTransactions(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setCurrencyTransactions([]);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOnlineCharacterSlugs([]);
      return;
    }

    const unsubscribe = subscribePresence((list) => {
      setOnlineCharacterSlugs(list.filter((entry) => entry.count > 0).map((entry) => entry.slug));
    });

    requestPresenceSnapshot();

    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, [user]);

  useEffect(() => {
    const readInitiativeEncounter = () => {
      setInitiativeEncounter(parseInitiativeEncounterState(window.localStorage.getItem(INITIATIVE_STORAGE_KEY)));
    };

    readInitiativeEncounter();
    window.addEventListener("storage", readInitiativeEncounter);
    window.addEventListener("focus", readInitiativeEncounter);
    document.addEventListener("visibilitychange", readInitiativeEncounter);

    return () => {
      window.removeEventListener("storage", readInitiativeEncounter);
      window.removeEventListener("focus", readInitiativeEncounter);
      document.removeEventListener("visibilitychange", readInitiativeEncounter);
    };
  }, []);

  const dmActions = useMemo(
    () => [
      {
        title: "Gestione sessione",
        description: "Apri la pagina DM principale su `/dm` per roster, presenza e messaggi privati.",
        href: "/dm",
        icon: Shield,
      },
      {
        title: "Tracker iniziativa",
        description: "Prepara il combattimento, aggiungi mostri e segui round e turni.",
        href: "/dm/initiative",
        icon: D20Icon,
      },
      {
        title: "Gestione utenti",
        description: "Crea, elimina o resetta le password delle utenze.",
        href: "/dm/users",
        icon: KeyRound,
      },
      {
        title: "Gestione Schede",
        description: "Associa le schede agli utenti e separa i personaggi giocanti dai personaggi non giocanti.",
        href: "/dm/assignments",
        icon: Link2,
      },
      {
        title: "Gestione bestiario",
        description: "Filtra i mostri censiti, apri il dettaglio da combattimento e crea nuove varianti.",
        href: "/dm/bestiary",
        icon: ScrollText,
      },
      {
        title: "Gestione oggetti",
        description: "Apri il catalogo oggetti per statistiche, attacchi, effetti, visibilita e metadati.",
        href: "/dm/items",
        icon: Package,
      },
      {
        title: "Assegna oggetti",
        description: "Assegna oggetti ai personaggi e consulta il loro inventario relazionale.",
        href: "/dm/inventory",
        icon: PlusCircle,
      },
      {
        title: "Transazioni oggetti",
        description: "Controlla i trasferimenti tra PG e annulla eventuali errori.",
        href: "/dm/inventory/transactions",
        icon: Link2,
      },
      {
        title: "Transazioni monete",
        description: "Controlla i movimenti monete e annulla eventuali errori.",
        href: "/dm/currency-transactions",
        icon: Link2,
      },
    ],
    []
  );

  const dmActionMap = useMemo(
    () => Object.fromEntries(dmActions.map((action) => [action.href, action])),
    [dmActions]
  );

  const primaryDmActions = ["/dm", "/dm/initiative"]
    .map((href) => dmActionMap[href])
    .filter(Boolean);
  const secondaryDmActions = ["/dm/assignments", "/dm/bestiary", "/dm/items"]
    .map((href) => dmActionMap[href])
    .filter(Boolean);
  const tertiaryDmActions = ["/dm/inventory", "/dm/users"]
    .map((href) => dmActionMap[href])
    .filter(Boolean);
  const utilityDmActions = ["/dm/inventory/transactions", "/dm/currency-transactions"]
    .map((href) => dmActionMap[href])
    .filter(Boolean);

  const playerCharacterSlugs = useMemo(
    () =>
      characters
        .filter((character) => character.characterType !== "png")
        .map((character) => character.slug),
    [characters]
  );

  const onlinePlayerCount = useMemo(() => {
    const onlineSet = new Set(onlineCharacterSlugs);
    return playerCharacterSlugs.filter((slug) => onlineSet.has(slug)).length;
  }, [onlineCharacterSlugs, playerCharacterSlugs]);

  const sessionStatusLabel = useMemo(() => {
    const totalPlayers = playerCharacterSlugs.length;

    if (totalPlayers === 0) {
      return "Nessun PG nel roster";
    }

    if (onlinePlayerCount === 0) {
      return "Nessun giocatore online";
    }

    if (onlinePlayerCount === totalPlayers) {
      return "Tavolo al completo";
    }

    const missingPlayers = totalPlayers - onlinePlayerCount;
    return missingPlayers === 1 ? "Manca 1 giocatore" : `Mancano ${missingPlayers} giocatori`;
  }, [onlinePlayerCount, playerCharacterSlugs.length]);

  const initiativeCombatants = useMemo(() => {
    const characterNameBySlug = Object.fromEntries(characters.map((character) => [character.slug, character.name]));

    const players: InitiativeCombatantSummary[] = initiativeEncounter.players
      .filter((entry) => entry.slug)
      .map((entry) => ({
        id: entry.id,
        name: characterNameBySlug[entry.slug] ?? entry.slug,
        initiative: entry.initiative,
        sortOrder: entry.sortOrder,
        type: "player",
      }));

    const monsters: InitiativeCombatantSummary[] = initiativeEncounter.monsters.map((entry) => ({
      id: entry.id,
      name: entry.name,
      initiative: entry.initiative,
      sortOrder: entry.sortOrder,
      type: "monster",
      currentHitPoints: entry.currentHitPoints,
    }));

    return [...players, ...monsters].sort(compareInitiativeCombatants);
  }, [characters, initiativeEncounter]);

  const initiativeEligibleCombatants = useMemo(
    () =>
      initiativeCombatants.filter((combatant) =>
        combatant.type === "monster" ? (combatant.currentHitPoints ?? 0) > 0 : true
      ),
    [initiativeCombatants]
  );

  const initiativeCurrentTurn = useMemo(() => {
    if (!initiativeEncounter.started || initiativeEligibleCombatants.length === 0) return null;

    return (
      initiativeEligibleCombatants.find((combatant) => combatant.id === initiativeEncounter.currentTurnId) ??
      initiativeEligibleCombatants[0] ??
      null
    );
  }, [initiativeEligibleCombatants, initiativeEncounter.currentTurnId, initiativeEncounter.started]);

  const initiativeNextTurn = useMemo(() => {
    if (!initiativeCurrentTurn || initiativeEligibleCombatants.length === 0) return null;

    const currentIndex = initiativeEligibleCombatants.findIndex((combatant) => combatant.id === initiativeCurrentTurn.id);
    if (currentIndex === -1) return initiativeEligibleCombatants[0] ?? null;
    if (initiativeEligibleCombatants.length === 1) return initiativeCurrentTurn;

    return initiativeEligibleCombatants[(currentIndex + 1) % initiativeEligibleCombatants.length] ?? null;
  }, [initiativeCurrentTurn, initiativeEligibleCombatants]);

  const initiativeStatus = useMemo(() => {
    const combatantCount = initiativeEncounter.players.length + initiativeEncounter.monsters.length;

    if (!initiativeEncounter.started && combatantCount === 0) {
      return { label: "Nessun combattimento in corso", showDetails: false };
    }

    if (!initiativeEncounter.started) {
      return { label: "Combattimento in preparazione", showDetails: false };
    }

    return { label: "Combattimento in corso", showDetails: true };
  }, [initiativeEncounter.monsters.length, initiativeEncounter.players.length, initiativeEncounter.started]);

  const activeCharacterCounts = useMemo(() => {
    const pg = characters.filter((character) => character.characterType === "pg").length;
    const png = characters.filter((character) => character.characterType === "png").length;
    return { pg, png };
  }, [characters]);

  const monsterRarityCounts = useMemo(() => {
    const counts = new Map<string, number>();

    monsterSummaries.forEach((monster) => {
      const key = normalizeRarityKey(monster.rarity) || "UNKNOWN";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const orderedKnown = RARITY_ORDER
      .filter((key) => counts.has(key))
      .map((key) => ({
        key,
        label: RARITY_LABELS[key],
        count: counts.get(key) ?? 0,
      }));

    const orderedUnknown = Array.from(counts.entries())
      .filter(([key]) => !RARITY_ORDER.includes(key as (typeof RARITY_ORDER)[number]))
      .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map(([key, count]) => ({
        key,
        label: key === "UNKNOWN" ? "Senza rarita" : key,
        count,
      }));

    return [...orderedKnown, ...orderedUnknown];
  }, [monsterSummaries]);

  const itemCategoryCounts = useMemo(() => {
    return itemDefinitions.reduce(
      (acc, item) => {
        const category = String(item.category ?? "").trim().toUpperCase();
        if (category === "WEAPON") {
          acc.weapons += 1;
        } else if (category === "ARMOR") {
          acc.armors += 1;
        } else {
          acc.other += 1;
        }
        return acc;
      },
      { weapons: 0, armors: 0, other: 0 }
    );
  }, [itemDefinitions]);

  const managedUserCounts = useMemo(() => {
    return managedUsers.reduce(
      (acc, managedUser) => {
        if (managedUser.role === "dm") {
          acc.dm += 1;
        } else {
          acc.player += 1;
        }
        return acc;
      },
      { dm: 0, player: 0 }
    );
  }, [managedUsers]);

  const latestInventoryTransfer = useMemo<TransactionCardSummary>(() => {
    if (inventoryTransfers.length === 0) return null;

    const latest = [...inventoryTransfers].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0];

    return {
      title: latest.itemName,
      detail: `${latest.quantity}x ${directionFromInventoryEntry(latest)}`,
      timestamp: formatCompactTimestamp(latest.createdAt),
    };
  }, [inventoryTransfers]);

  const latestCurrencyTransaction = useMemo<TransactionCardSummary>(() => {
    if (currencyTransactions.length === 0) return null;

    const latest = [...currencyTransactions].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0];

    return {
      title: latest.summary,
      detail: `${currencyFromSummary(latest)} -> ${currencyToSummary(latest)}`,
      timestamp: formatCompactTimestamp(latest.createdAt),
    };
  }, [currencyTransactions]);

  const handleHomeLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginSubmitting(true);
    setLoginError("");

    try {
      const nextUser = await login(username.trim(), password);
      navigate(nextUser.mustChangePassword ? "/change-password" : "/", { replace: true });
    } catch {
      setLoginError("Credenziali non valide.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="min-h-screen parchment">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-crimson/10 to-transparent"></div>
          <div className="relative mx-auto max-w-5xl px-6 py-20">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between">
              <div className="flex max-w-3xl flex-1 flex-col justify-between">
                <h1 className="mb-6 text-6xl font-heading font-bold text-primary lg:text-[4.25rem]">
                  D&D Character Manager
                </h1>
                <p className="text-xl text-muted-foreground">
                  Gestisci personaggi, campagne e sessioni in un unico spazio condiviso. Meno burocrazia, più gioco di ruolo.
                </p>
              </div>

              <Card className="min-w-[320px] border-primary/15 bg-background/80 p-5 lg:flex lg:min-h-full lg:flex-col lg:justify-center">
                <form className="space-y-4" onSubmit={handleHomeLoginSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="home-username">Username</Label>
                    <Input
                      id="home-username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Es. roberto"
                      autoComplete="username"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="home-password">Password</Label>
                    <Input
                      id="home-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                    />
                  </div>

                  {loginError ? <div className="text-sm text-destructive">{loginError}</div> : null}

                  <Button type="submit" className="w-full" disabled={loginSubmitting || !username.trim() || !password}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {loginSubmitting ? "Accesso..." : "Accedi al tavolo!"}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-heading font-bold text-primary">
              Tutto quello che serve al tavolo
            </h2>
            <Separator className="mx-auto w-24 bg-primary" />
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Card className="character-section text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-primary" />
              <h3 className="character-section-title text-center border-0 pb-0">Il tuo spazio personale</h3>
              <p className="text-muted-foreground">
                Accedi ai tuoi eroi in un istante. Tutto ciò che ti serve è pronto per il prossimo tiro di iniziativa.
              </p>
            </Card>

            <Card className="character-section text-center">
              <Shield className="mx-auto mb-4 h-12 w-12 text-primary" />
              <h3 className="character-section-title text-center border-0 pb-0">Controllo Totale</h3>
              <p className="text-muted-foreground">
                Una dashboard su misura per te. Che tu sia un DM o un giocatore, avrai sott'occhio solo quello che conta davvero.
              </p>
            </Card>

            <Card className="character-section text-center">
              <Dice6 className="mx-auto mb-4 h-12 w-12 text-primary" />
              <h3 className="character-section-title text-center border-0 pb-0">Sincronia Perfetta</h3>
              <p className="text-muted-foreground">
                Schede che si aggiornano dal vivo e strumenti live per non perdere mai il ritmo della narrazione.
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen parchment px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="space-y-3">
          <div className="space-y-3">
            <div className="relative text-center">
              <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 flex-wrap items-center justify-end gap-3 text-sm md:flex">
                <div className="inline-flex items-center">
                  {user.role === "dm" ? (
                    <Shield className="h-4 w-4 text-primary" aria-label="Master" />
                  ) : (
                    <UserRound className="h-4 w-4 text-primary" aria-label="Giocatore" />
                  )}
                </div>
                <span className="text-muted-foreground">{user.username}</span>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => void logout()} aria-label="Esci" title="Esci">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            
              <h1 className="font-heading text-5xl font-bold text-primary">
                {user.role === "dm" ? "Home del master" : "Home del giocatore"}
              </h1>
              <div className="mt-3">
                <AppVersionDialog notifyOnNewVersion={user.role === "player"} />
              </div>
              {user.role !== "dm" && (
                <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
                  Da qui accedi ai tuoi personaggi associati e, quando sarà pronta, potrai iniziare la creazione di un nuovo personaggio.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 text-sm md:hidden">
              <div className="inline-flex items-center">
                {user.role === "dm" ? (
                  <Shield className="h-4 w-4 text-primary" aria-label="Master" />
                ) : (
                  <UserRound className="h-4 w-4 text-primary" aria-label="Giocatore" />
                )}
              </div>
              <span className="text-muted-foreground">{user.username}</span>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => void logout()} aria-label="Esci" title="Esci">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </section>

        {user.role === "dm" ? (
          <section className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
              <div className="grid gap-4">
                {primaryDmActions.map((action) => {
                  const Icon = action.icon;
                  const isSessionAction = action.href === "/dm";
                  const isInitiativeAction = action.href === "/dm/initiative";
                  const isEnhancedPrimaryAction = isSessionAction || isInitiativeAction;
                  return (
                    <Link key={action.href} to={action.href} className="block h-full">
                      <Card className="character-section flex h-full min-h-[220px] flex-col justify-between transition-colors hover:bg-accent/30">
                        <div className="flex h-full flex-col">
                          <div className="flex items-center gap-3">
                            {isEnhancedPrimaryAction ? (
                              <Icon className="h-12 w-12 text-primary" />
                            ) : (
                              <Icon className="h-6 w-6 text-primary" />
                            )}
                            <div className={isEnhancedPrimaryAction ? "font-heading text-3xl font-semibold text-primary" : "font-heading text-2xl font-semibold text-primary"}>
                              {action.title}
                            </div>
                          </div>
                          {isSessionAction ? (
                            <>
                              <p className="mt-3 max-w-xl text-base italic text-muted-foreground">
                                Tieni d'occhio il tavolo in un solo sguardo, tra presenze, personaggi attivi e ritmo della sessione.
                              </p>
                              <div className="mt-auto max-w-xl rounded-xl border border-primary/20 bg-background/65 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-muted-foreground">
                                  <div className="inline-flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                    <span>{onlinePlayerCount} online</span>
                                  </div>
                                  <span className="text-border">-</span>
                                  <div className="inline-flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden="true" />
                                    <span>{playerCharacterSlugs.length - onlinePlayerCount} offline</span>
                                  </div>
                                </div>
                                <div className="mt-1 text-sm text-foreground/85">{sessionStatusLabel}</div>
                              </div>
                            </>
                          ) : isInitiativeAction ? (
                            <>
                              <p className="mt-3 max-w-xl text-base italic text-muted-foreground">{action.description}</p>
                              <div className="mt-auto max-w-xl rounded-xl border border-primary/20 bg-background/65 px-4 py-3">
                                <div className="text-sm font-medium text-foreground/85">{initiativeStatus.label}</div>
                                {initiativeStatus.showDetails ? (
                                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                                    <div>Round: {initiativeEncounter.round}</div>
                                    <div>Di turno: {initiativeCurrentTurn?.name ?? "-"}</div>
                                    <div>Prossimo: {initiativeNextTurn?.name ?? "-"}</div>
                                  </div>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <p className="mt-4 max-w-xl text-base text-muted-foreground">{action.description}</p>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {secondaryDmActions.map((action) => {
                    const Icon = action.icon;
                    const isAssignmentsAction = action.href === "/dm/assignments";
                    const isBestiaryAction = action.href === "/dm/bestiary";
                    const isItemsAction = action.href === "/dm/items";
                    return (
                      <Link key={action.href} to={action.href} className="block h-full">
                        <Card className="character-section flex h-full min-h-[190px] flex-col justify-between transition-colors hover:bg-accent/30">
                          <div className="flex h-full flex-col">
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-primary" />
                              <div className="font-heading text-xl font-semibold text-primary">{action.title}</div>
                            </div>
                            {isAssignmentsAction ? (
                              <div className="mt-auto rounded-xl border border-primary/20 bg-background/65 px-3 py-2.5">
                                <div className="grid gap-0.5 text-xs leading-4 text-muted-foreground">
                                  <div>PG censiti: {activeCharacterCounts.pg}</div>
                                  <div>PNG censiti: {activeCharacterCounts.png}</div>
                                </div>
                              </div>
                            ) : isBestiaryAction ? (
                              <div className="mt-auto rounded-xl border border-primary/20 bg-background/65 px-3 py-2.5">
                                <div className="grid gap-0.5 text-xs leading-4 text-muted-foreground">
                                  {monsterRarityCounts.map((entry) => (
                                    <div key={entry.key}>
                                      {entry.label}: {entry.count}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : isItemsAction ? (
                              <div className="mt-auto rounded-xl border border-primary/20 bg-background/65 px-3 py-2.5">
                                <div className="grid gap-0.5 text-xs leading-4 text-muted-foreground">
                                  <div>Armi: {itemCategoryCounts.weapons}</div>
                                  <div>Armature: {itemCategoryCounts.armors}</div>
                                  <div>Altro: {itemCategoryCounts.other}</div>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-sm italic text-muted-foreground">{action.description}</p>
                            )}
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {tertiaryDmActions.map((action) => {
                    const Icon = action.icon;
                    const isUsersAction = action.href === "/dm/users";
                    return (
                      <Link key={action.href} to={action.href} className="block h-full">
                        <Card className="character-section flex h-full min-h-[170px] flex-col justify-between transition-colors hover:bg-accent/30">
                          <div className="flex h-full flex-col">
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-primary" />
                              <div className="font-heading text-xl font-semibold text-primary">{action.title}</div>
                            </div>
                            {isUsersAction ? (
                              <div className="mt-auto rounded-xl border border-primary/20 bg-background/65 px-3 py-2.5">
                                <div className="grid gap-0.5 text-xs leading-4 text-muted-foreground">
                                  <div>Utenti DM: {managedUserCounts.dm}</div>
                                  <div>Utenti player: {managedUserCounts.player}</div>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-sm italic text-muted-foreground">{action.description}</p>
                            )}
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
                  {utilityDmActions.map((action) => {
                    const Icon = action.icon;
                    const isInventoryTransactionsAction = action.href === "/dm/inventory/transactions";
                    const transactionSummary = isInventoryTransactionsAction
                      ? latestInventoryTransfer
                      : action.href === "/dm/currency-transactions"
                        ? latestCurrencyTransaction
                        : null;
                    return (
                      <Link key={action.href} to={action.href} className="block h-full">
                        <Card className="character-section flex h-full min-h-[140px] flex-col justify-between transition-colors hover:bg-accent/30">
                          <div className="flex h-full flex-col">
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-primary" />
                              <div className="font-heading text-lg font-semibold text-primary">{action.title}</div>
                            </div>
                            <div className="mt-auto rounded-xl border border-primary/20 bg-background/65 px-3 py-2.5">
                              {transactionSummary ? (
                                <div className="space-y-0.5 text-xs leading-4">
                                  <div className="truncate font-medium text-foreground/90">{transactionSummary.title}</div>
                                  <div className="truncate text-muted-foreground">{transactionSummary.detail}</div>
                                  <div className="text-muted-foreground/80">{transactionSummary.timestamp}</div>
                                </div>
                              ) : (
                                <div className="text-xs leading-4 text-muted-foreground">Nessuna transazione registrata</div>
                              )}
                            </div>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}

                  <Card className="character-section flex h-full min-h-[140px] flex-col justify-between border-dashed border-primary/25 bg-background/40">
                    <div>
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <div className="font-heading text-xl font-semibold text-primary">More to come</div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Nuovi strumenti DM arriveranno qui nelle prossime rifiniture.
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <div>
              <h2 className="font-heading text-3xl font-bold text-primary">Le tue schede</h2>
              <p className="text-muted-foreground">
                Elenco delle schede attualmente associate al tuo account.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                    <Scroll className="h-4 w-4 text-primary" />
                    <span>{characters.length}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Schede associate</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  {user.role === "dm" ? (
                    <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                      <Link to="/characters/new" aria-label="Crea nuova scheda">
                        <PlusCircle className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Crea nuova scheda"
                      onClick={() => setPlayerCreateDialogOpen(true)}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent>Crea nuova scheda</TooltipContent>
              </Tooltip>
            </div>

            <div className="grid gap-4">
              {characters.length === 0 ? (
                <Card className="character-section">
                  <div className="text-sm text-muted-foreground">
                    Non ci sono ancora personaggi associati a questo account.
                  </div>
                </Card>
              ) : (
                characters.map((character) => (
                  <Link key={character.slug} to={`/${character.slug}`} className="block h-full">
                    <Card className="character-section transition-colors hover:bg-accent/30">
                      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.5fr)_100px] lg:items-center">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-heading text-2xl font-semibold text-primary">
                              {character.name}
                            </div>
                            <Scroll className="h-5 w-5 text-primary lg:hidden" />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {character.className || "Classe?"}
                              {character.level !== null ? ` Lv ${character.level}` : ""}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">{character.slug}</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                              <span className="text-muted-foreground">Init</span>{" "}
                              <span>{character.initiativeBonus >= 0 ? `+${character.initiativeBonus}` : character.initiativeBonus}</span>
                            </div>
                            <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                              <span className="text-muted-foreground">CA</span>{" "}
                              <span>{character.armorClass ?? "-"}</span>
                            </div>
                            {character.resourceSummary.entries.length > 0 && (
                              <ResourceSummaryBadge
                                label={character.resourceSummary.label}
                                entries={character.resourceSummary.entries}
                              />
                            )}
                            <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                              <span className="text-muted-foreground">Perc</span>{" "}
                              <span>{character.passivePerception ?? "-"}</span>
                            </div>
                            {character.spellSaveDc !== null && (
                              <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                                <span className="text-muted-foreground">CD</span>{" "}
                                <span>{character.spellSaveDc}</span>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                              <span>PF</span>
                              <span>
                                {character.hp.current}/{character.hp.max}
                                {character.hp.temp > 0 ? ` +${character.hp.temp} temp` : ""}
                              </span>
                            </div>
                            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`absolute inset-y-0 left-0 ${hpBarColor(character.hp)}`}
                                style={{ width: `${hpSegments(character.hp).currentPct}%` }}
                              />
                              {character.hp.temp > 0 && (
                                <div
                                  className="absolute inset-y-0 bg-sky-300/80"
                                  style={{
                                    left: `${hpSegments(character.hp).currentPct}%`,
                                    width: `${hpSegments(character.hp).tempPct}%`,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="hidden justify-end lg:flex">
                          <Scroll className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      <Dialog open={playerCreateDialogOpen} onOpenChange={setPlayerCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg border-primary/20 bg-background/95">
          <DialogHeader>
            <DialogTitle className="font-heading text-3xl text-primary">Presto disponibile</DialogTitle>
            <DialogDescription>
              La creazione diretta di una nuova scheda arrivera presto anche qui.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-3xl border border-primary/20 bg-[linear-gradient(135deg,rgba(120,28,28,0.10),rgba(201,116,34,0.08))] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-background/70">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="font-heading text-2xl font-semibold text-primary">Nuova scheda in arrivo</div>
                  <p className="text-sm text-muted-foreground">
                    Qui comparira una modalita dedicata per avviare la creazione del tuo prossimo personaggio.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <PlusCircle className="h-5 w-5 text-primary" />
                <div className="mt-3 text-sm font-medium text-foreground">Creazione dedicata</div>
                <p className="mt-1 text-xs text-muted-foreground">Uno spazio pensato per iniziare una nuova scheda.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <Scroll className="h-5 w-5 text-primary" />
                <div className="mt-3 text-sm font-medium text-foreground">Prime scelte</div>
                <p className="mt-1 text-xs text-muted-foreground">Nome, classe e identita del personaggio fin dal primo passo.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <div className="mt-3 text-sm font-medium text-foreground">Esperienza in arrivo</div>
                <p className="mt-1 text-xs text-muted-foreground">Una nuova funzione pronta ad aprirsi qui nelle prossime iterazioni.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;

