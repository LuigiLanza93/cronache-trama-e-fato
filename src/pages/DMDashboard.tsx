import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Circle,
  Home,
  ExternalLink,
  MessageSquareMore,
  Package,
  Shield,
  Swords,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/auth-provider";
import { useGameSession } from "@/components/game-session-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { ResourceSummaryBadge } from "@/components/resource-summary-badge";
import {
  applyPatch,
  ChatMessage,
  fetchCharacter,
  fetchCharacters,
  joinChatRoom,
  joinCharacterRoom,
  onChatMessage,
  onCharacterPatch,
  onCharacterState,
  requestPresenceSnapshot,
  subscribePresence,
} from "@/realtime";
import CharacterChatWindow from "@/components/chat/character-chat-window";
import { getInitials, normalizePortraitUrl } from "@/lib/character-ui";
import {
  fetchCharacterInventoryItems,
  fetchItemDefinition,
  updateGameSessionStateRequest,
  type CharacterInventoryItemEntry,
  type ItemDefinitionEntry,
} from "@/lib/auth";
import {
  getDerivedAbilityBonuses,
  getDerivedArmorClass,
  getDerivedInitiativeBonus,
  getDerivedPassivePerception,
  getDerivedSpellSaveDc,
} from "@/lib/character-derived-stats";
import { toast } from "@/components/ui/sonner";

type CharacterState = Record<string, any>;

type PlayerCardData = {
  slug: string;
  name: string;
  characterType: "pg" | "png";
  playerName: string;
  portraitUrl?: string;
  className: string;
  level: number | null;
  initiativeBonus: number;
  armorClass: number | null;
  passivePerception: number | null;
  spellSaveDc: number | null;
  abilityBonuses: Array<{ label: string; value: number }>;
  resourceSummary: { label: string; entries: Array<{ label: string; remaining: number; total: number }> };
  hp: {
    current: number;
    max: number;
    temp: number;
  };
  deathSaves: {
    successes: number;
    failures: number;
  };
};

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

function toPlayerCardData(
  state: CharacterState,
  relationalInventoryItems: CharacterInventoryItemEntry[] = [],
  itemDefinitionsById: Record<string, ItemDefinitionEntry> = {}
): PlayerCardData | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    characterType: state?.characterType === "png" ? "png" : "pg",
    playerName: state?.basicInfo?.playerName ?? "",
    portraitUrl: state?.basicInfo?.portraitUrl ?? "",
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
    initiativeBonus: getDerivedInitiativeBonus(state, relationalInventoryItems, itemDefinitionsById),
    armorClass: getDerivedArmorClass(state, relationalInventoryItems, itemDefinitionsById),
    passivePerception: getDerivedPassivePerception(state, relationalInventoryItems, itemDefinitionsById),
    spellSaveDc: getDerivedSpellSaveDc(state, relationalInventoryItems, itemDefinitionsById),
    abilityBonuses: getDerivedAbilityBonuses(state, relationalInventoryItems, itemDefinitionsById),
    resourceSummary: summarizeResourceSlots(state?.basicInfo?.class, state?.combatStats?.spellSlots),
    hp: {
      current: Math.max(0, state?.combatStats?.currentHitPoints ?? 0),
      max: Math.max(0, state?.combatStats?.hitPointMaximum ?? 0),
      temp: Math.max(0, state?.combatStats?.temporaryHitPoints ?? 0),
    },
    deathSaves: {
      successes: Math.max(0, Math.min(3, state?.combatStats?.deathSaves?.successes ?? 0)),
      failures: Math.max(0, Math.min(3, state?.combatStats?.deathSaves?.failures ?? 0)),
    },
  };
}

function hpPercent(hp: PlayerCardData["hp"]) {
  const max = Math.max(1, hp.max);
  return Math.min(100, Math.round((Math.max(0, hp.current) / max) * 100));
}

function hpSegments(hp: PlayerCardData["hp"]) {
  const current = Math.max(0, hp.current);
  const max = Math.max(1, hp.max);
  const temp = Math.max(0, hp.temp);
  const total = max + temp;

  return {
    currentPct: Math.min(100, (current / total) * 100),
    tempPct: Math.min(100, (temp / total) * 100),
  };
}

function hpBarColor(hp: PlayerCardData["hp"]) {
  const percent = hpPercent(hp);
  if (percent >= 66) return "bg-emerald-500";
  if (percent >= 33) return "bg-amber-500";
  return "bg-rose-500";
}

export default function DMDashboard() {
  const { user } = useAuth();
  const { sessionState, refresh: refreshGameSession } = useGameSession();
  const [onlineSlugs, setOnlineSlugs] = useState<string[]>([]);
  const [baseCharacterStates, setBaseCharacterStates] = useState<CharacterState[]>([]);
  const [liveStates, setLiveStates] = useState<Record<string, CharacterState>>({});
  const [baseInventoryBySlug, setBaseInventoryBySlug] = useState<Record<string, CharacterInventoryItemEntry[]>>({});
  const [liveInventoryBySlug, setLiveInventoryBySlug] = useState<Record<string, CharacterInventoryItemEntry[]>>({});
  const [itemDefinitionsById, setItemDefinitionsById] = useState<Record<string, ItemDefinitionEntry>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [expandedAbilityBonuses, setExpandedAbilityBonuses] = useState<Record<string, boolean>>({});
  const [openChatSlugs, setOpenChatSlugs] = useState<string[]>([]);
  const [minimizedChatSlugs, setMinimizedChatSlugs] = useState<string[]>([]);
  const [unreadChatCounts, setUnreadChatCounts] = useState<Record<string, number>>({});
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const joinedChatRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.title = "DM Dashboard | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;

    void fetchCharacters()
      .then(async (characters) => {
        if (!active) return;
        const nextCharacters = Array.isArray(characters) ? characters : [];
        setBaseCharacterStates(nextCharacters);

        const inventoryResults = await Promise.all(
          nextCharacters.map(async (character) => {
            const slug = String(character?.slug ?? "").trim();
            if (!slug) return null;
            try {
              const items = await fetchCharacterInventoryItems(slug);
              return [slug, Array.isArray(items) ? items : []] as const;
            } catch {
              return [slug, []] as const;
            }
          })
        );
        if (!active) return;

        const nextInventoryBySlug = Object.fromEntries(
          inventoryResults.filter((entry): entry is readonly [string, CharacterInventoryItemEntry[]] => Array.isArray(entry))
        );
        setBaseInventoryBySlug(nextInventoryBySlug);

        const definitionIds = Array.from(
          new Set(
            Object.values(nextInventoryBySlug)
              .flatMap((items) => items)
              .filter((item) => item?.isEquipped && item?.itemDefinitionId)
              .map((item) => item.itemDefinitionId)
              .filter((itemDefinitionId): itemDefinitionId is string => !!itemDefinitionId)
          )
        );
        const definitions = await Promise.all(
          definitionIds.map(async (itemDefinitionId) => {
            try {
              const detail = await fetchItemDefinition(itemDefinitionId);
              return [itemDefinitionId, detail] as const;
            } catch {
              return null;
            }
          })
        );
        if (!active) return;

        const validDefinitions = definitions.filter(
          (entry): entry is readonly [string, ItemDefinitionEntry] => Array.isArray(entry)
        );
        if (validDefinitions.length > 0) {
          setItemDefinitionsById((prev) => ({
            ...prev,
            ...Object.fromEntries(validDefinitions),
          }));
        }
      })
      .catch(() => {
        if (active) setErrors((prev) => [...prev, "Impossibile caricare il roster iniziale."]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePresence((list) => {
      setOnlineSlugs(list.filter((entry) => entry.count > 0).map((entry) => entry.slug));
    });
    requestPresenceSnapshot();

    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, []);

  useEffect(() => {
    onlineSlugs.forEach((slug) => {
      if (joinedRoomsRef.current.has(slug)) return;
      joinedRoomsRef.current.add(slug);

      try {
        joinCharacterRoom(slug);
      } catch (error: any) {
        setErrors((prev) => [...prev, `[join ${slug}] ${String(error?.message ?? error)}`]);
      }
    });

    let cancelled = false;

    const loadOnlineCharacters = async () => {
      const results = await Promise.all(
        onlineSlugs.map(async (slug) => {
          try {
            const [state, inventoryItems] = await Promise.all([
              fetchCharacter(slug),
              fetchCharacterInventoryItems(slug).catch(() => []),
            ]);
            return [slug, state, Array.isArray(inventoryItems) ? inventoryItems : []] as const;
          } catch (error: any) {
            setErrors((prev) => [...prev, `[fetch ${slug}] ${String(error?.message ?? error)}`]);
            return null;
          }
        })
      );
      if (cancelled) return;

      const nextEntries = results.filter(
        (entry): entry is readonly [string, CharacterState, CharacterInventoryItemEntry[]] => Array.isArray(entry)
      );
      if (nextEntries.length === 0) return;

      setLiveStates((prev) => ({
        ...prev,
        ...Object.fromEntries(nextEntries.map(([slug, state]) => [slug, state])),
      }));
      setLiveInventoryBySlug((prev) => ({
        ...prev,
        ...Object.fromEntries(nextEntries.map(([slug, _state, inventoryItems]) => [slug, inventoryItems])),
      }));

      const definitionIds = Array.from(
        new Set(
          nextEntries
            .flatMap(([, , inventoryItems]) => inventoryItems)
            .filter((item) => item?.isEquipped && item?.itemDefinitionId)
            .map((item) => item.itemDefinitionId)
            .filter((itemDefinitionId): itemDefinitionId is string => !!itemDefinitionId)
        )
      );
      const definitions = await Promise.all(
        definitionIds.map(async (itemDefinitionId) => {
          try {
            const detail = await fetchItemDefinition(itemDefinitionId);
            return [itemDefinitionId, detail] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;

      const validDefinitions = definitions.filter(
        (entry): entry is readonly [string, ItemDefinitionEntry] => Array.isArray(entry)
      );
      if (validDefinitions.length > 0) {
        setItemDefinitionsById((prev) => ({
          ...prev,
          ...Object.fromEntries(validDefinitions),
        }));
      }
    };

    void loadOnlineCharacters();
    const interval = window.setInterval(loadOnlineCharacters, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [onlineSlugs]);

  useEffect(() => {
    const offState = onCharacterState((state: CharacterState) => {
      const slug = state?.slug;
      if (!slug) return;
      setLiveStates((prev) => ({ ...prev, [slug]: state }));
    });

    const offPatch = onCharacterPatch(({ slug, patch }: { slug: string; patch: any }) => {
      setLiveStates((prev) => {
        const current = prev[slug];
        if (!current) return prev;
        return { ...prev, [slug]: applyPatch(current, patch) };
      });
    });

    return () => {
      try {
        offState();
      } catch {}
      try {
        offPatch();
      } catch {}
    };
  }, []);

  const roster = useMemo(
    () =>
      baseCharacterStates
        .map((state) =>
          toPlayerCardData(state, baseInventoryBySlug[state?.slug] ?? [], itemDefinitionsById)
        )
        .filter((player): player is PlayerCardData => !!player)
        .filter((player) => player.characterType === "pg")
        .map((basePlayer) => {
          const livePlayer = toPlayerCardData(
            liveStates[basePlayer.slug],
            liveInventoryBySlug[basePlayer.slug] ?? [],
            itemDefinitionsById
          );
          return (livePlayer?.characterType === "pg" ? livePlayer : null) ?? basePlayer;
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [baseCharacterStates, baseInventoryBySlug, itemDefinitionsById, liveInventoryBySlug, liveStates]
  );

  const onlineCount = onlineSlugs.length;
  const onlineSet = useMemo(() => new Set(onlineSlugs), [onlineSlugs]);

  useEffect(() => {
    roster.forEach((player) => {
      if (joinedChatRoomsRef.current.has(player.slug)) return;
      joinedChatRoomsRef.current.add(player.slug);
      joinChatRoom(player.slug);
    });
  }, [roster]);

  useEffect(() => {
    const offChat = onChatMessage((message: ChatMessage) => {
      if (message.senderUserId === user?.id) return;

      const player = roster.find((entry) => entry.slug === message.slug);
      if (!player) return;

      const isVisible = openChatSlugs.includes(message.slug) && !minimizedChatSlugs.includes(message.slug);
      if (!isVisible) {
        setUnreadChatCounts((prev) => ({
          ...prev,
          [message.slug]: (prev[message.slug] ?? 0) + 1,
        }));
      }
    });

    return () => {
      try {
        offChat();
      } catch {}
    };
  }, [minimizedChatSlugs, openChatSlugs, roster, user?.id]);

  const openChatWindow = (slug: string) => {
    setOpenChatSlugs((prev) => {
      const next = prev.filter((entry) => entry !== slug);
      return [...next, slug];
    });
    setMinimizedChatSlugs((prev) => prev.filter((entry) => entry !== slug));
    setUnreadChatCounts((prev) => {
      if (!prev[slug]) return prev;
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  };

  const minimizeChatWindow = (slug: string) => {
    setMinimizedChatSlugs((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  };

  const toggleAbilityBonuses = (slug: string) => {
    setExpandedAbilityBonuses((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const closeChatWindow = (slug: string) => {
    setOpenChatSlugs((prev) => prev.filter((entry) => entry !== slug));
    setMinimizedChatSlugs((prev) => prev.filter((entry) => entry !== slug));
  };

  const handleSessionToggle = async (nextOpen: boolean) => {
    setSessionSubmitting(true);
    try {
      await updateGameSessionStateRequest(nextOpen);
      await refreshGameSession();
      toast.success(nextOpen ? "Sessione aperta." : "Sessione chiusa: i player sono ora in sola lettura.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aggiornamento sessione non riuscito.");
    } finally {
      setSessionSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen parchment p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Roster giocatori</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Vista rapida del party sempre disponibile, con stato live e gli stessi riferimenti tattici del tracker.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
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
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{roster.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Giocatori nel roster</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <Circle className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                  <span>{onlineCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Giocatori online</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                  <a href="/dm/initiative" aria-label="Apri tracker iniziativa">
                    <Swords className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Apri tracker iniziativa</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                  <a href="/dm/inventory" aria-label="Apri assegnazione oggetti">
                    <Package className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Assegna oggetti ai personaggi</TooltipContent>
            </Tooltip>
            <div className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-2 shadow-sm">
              <Switch
                checked={sessionState?.isOpen !== false}
                disabled={sessionSubmitting}
                onCheckedChange={(checked) => void handleSessionToggle(checked)}
                aria-label="Apri o chiudi la sessione dei player"
              />
            </div>
          </div>
        </section>

        {errors.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-50/70 p-4 text-sm text-amber-950">
            Alcuni aggiornamenti live non sono andati a buon fine. Il roster resta comunque disponibile.
          </Card>
        )}

        <section className="grid gap-4">
          {roster.map((player) => {
            const isOnline = onlineSet.has(player.slug);
            const abilitiesExpanded = !!expandedAbilityBonuses[player.slug];
            const hpColor = hpBarColor(player.hp);
            const { currentPct, tempPct } = hpSegments(player.hp);
            const showDeathSaves = player.hp.current === 0;

            return (
              <Card key={player.slug} className="character-section">
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)_110px] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Circle
                        className={`h-3 w-3 ${isOnline ? "fill-emerald-500 text-emerald-500" : "fill-muted text-muted"}`}
                      />
                      <div className="font-heading text-2xl font-semibold text-primary">{player.name}</div>
                      <Badge variant="outline">
                        {player.className || "Classe?"} {player.level ? `Lv ${player.level}` : ""}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{player.playerName || "Giocatore non indicato"}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                        <span className="text-muted-foreground">Init</span>{" "}
                        <span>{player.initiativeBonus >= 0 ? `+${player.initiativeBonus}` : player.initiativeBonus}</span>
                      </div>
                      <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                        <span className="text-muted-foreground">CA</span>{" "}
                        <span>{player.armorClass ?? "-"}</span>
                      </div>
                      {player.resourceSummary.entries.length > 0 && (
                        <ResourceSummaryBadge
                          label={player.resourceSummary.label}
                          entries={player.resourceSummary.entries}
                        />
                      )}
                      <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                        <span className="text-muted-foreground">Perc</span>{" "}
                        <span>{player.passivePerception ?? "-"}</span>
                      </div>
                      {player.spellSaveDc !== null && (
                        <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                          <span className="text-muted-foreground">CD</span>{" "}
                          <span>{player.spellSaveDc}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleAbilityBonuses(player.slug)}
                        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90 transition-colors hover:bg-accent"
                        aria-expanded={abilitiesExpanded}
                        aria-label="Mostra bonus caratteristiche"
                        title="Mostra bonus caratteristiche"
                      >
                        <span className="text-muted-foreground">Caratt.</span>
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${abilitiesExpanded ? "rotate-90" : ""}`} />
                      </button>
                    </div>

                    <div
                      className={`grid transition-all ${abilitiesExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden">
                        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/50 bg-background/30 px-2 py-2">
                          {player.abilityBonuses.map((ability) => (
                            <div
                              key={`${player.slug}-${ability.label}`}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/90"
                            >
                              {ability.label} {ability.value >= 0 ? `+${ability.value}` : ability.value}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/60 bg-background/35 p-3">
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                        <span>Punti ferita</span>
                        <span className="tabular-nums">
                          {player.hp.current}/{player.hp.max}
                          {player.hp.temp ? ` (+${player.hp.temp})` : ""}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-border">
                        <div className="flex h-full w-full">
                          <div className={`${hpColor} h-full`} style={{ width: `${currentPct}%` }} />
                          {tempPct > 0 && <div className="h-full bg-sky-400" style={{ width: `${tempPct}%` }} />}
                        </div>
                      </div>
                      {showDeathSaves && (
                        <div className="text-xs text-muted-foreground">
                          TS morte: {player.deathSaves.successes}/3 successi, {player.deathSaves.failures}/3 fallimenti
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 lg:pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                      title="Apri scheda"
                      aria-label="Apri scheda"
                    >
                      <a href={`/${player.slug}`}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openChatWindow(player.slug)}
                      className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                      title="Apri chat"
                      aria-label="Apri chat"
                    >
                      <MessageSquareMore className="h-4 w-4" />
                      {(unreadChatCounts[player.slug] ?? 0) > 0 ? (
                        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                          {(unreadChatCounts[player.slug] ?? 0) > 9 ? "9+" : unreadChatCounts[player.slug]}
                        </span>
                      ) : null}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      </div>

      {openChatSlugs.length > 0 ? (
        <div className="fixed bottom-5 right-20 z-40 flex max-w-[calc(100vw-7rem)] items-end gap-3 overflow-x-auto pb-2 pr-2">
          {openChatSlugs.map((slug) => {
            const player = roster.find((entry) => entry.slug === slug);
            if (!player) return null;
            const isMinimized = minimizedChatSlugs.includes(slug);
            const unreadCount = unreadChatCounts[slug] ?? 0;
            const normalizedAvatar = normalizePortraitUrl(player.portraitUrl);

            if (isMinimized) {
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => openChatWindow(slug)}
                  className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-card/95 shadow-xl transition-transform hover:-translate-y-0.5"
                  title={`Apri chat con ${player.name}`}
                  aria-label={`Apri chat con ${player.name}`}
                >
                  <Avatar className="h-12 w-12 border border-border/60">
                    {normalizedAvatar ? <AvatarImage src={normalizedAvatar} alt={player.name} className="object-cover" /> : null}
                    <AvatarFallback className="bg-primary/10 font-heading text-sm font-bold text-primary">
                      {getInitials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            }

            return (
              <CharacterChatWindow
                key={slug}
                slug={slug}
                title={player.name}
                subtitle={player.playerName || player.slug}
                avatarUrl={player.portraitUrl}
                onMinimize={() => minimizeChatWindow(slug)}
                onClose={() => closeChatWindow(slug)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
