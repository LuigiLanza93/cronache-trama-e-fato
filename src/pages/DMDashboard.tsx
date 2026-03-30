import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Circle,
  ExternalLink,
  MessageSquareMore,
  Shield,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyPatch,
  fetchCharacter,
  fetchCharacters,
  joinCharacterRoom,
  onCharacterPatch,
  onCharacterState,
  requestPresenceSnapshot,
  sendPrivateMessage,
  subscribePresence,
} from "@/realtime";
import { toast } from "@/components/ui/sonner";

type CharacterState = Record<string, any>;

type PlayerCardData = {
  slug: string;
  name: string;
  playerName: string;
  className: string;
  level: number | null;
  initiativeBonus: number;
  armorClass: number | null;
  passivePerception: number | null;
  spellSaveDc: number | null;
  abilityBonuses: Array<{ label: string; value: number }>;
  resourceSummary: { label: string; entries: Array<{ label: string; remaining: number }> };
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
      label: `${level}`,
      remaining,
    })),
  };
}

function toPlayerCardData(state: CharacterState): PlayerCardData | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    playerName: state?.basicInfo?.playerName ?? "",
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
    initiativeBonus: state?.combatStats?.initiative ?? 0,
    armorClass: typeof state?.combatStats?.armorClass === "number" ? state.combatStats.armorClass : null,
    passivePerception: getPassivePerception(state),
    spellSaveDc: getSpellSaveDc(state),
    abilityBonuses: getAbilityBonuses(state),
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
  const [onlineSlugs, setOnlineSlugs] = useState<string[]>([]);
  const [baseCharacterStates, setBaseCharacterStates] = useState<CharacterState[]>([]);
  const [liveStates, setLiveStates] = useState<Record<string, CharacterState>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [expandedAbilityBonuses, setExpandedAbilityBonuses] = useState<Record<string, boolean>>({});
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageTargetSlug, setMessageTargetSlug] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.title = "DM Dashboard | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;

    void fetchCharacters()
      .then((characters) => {
        if (active) setBaseCharacterStates(Array.isArray(characters) ? characters : []);
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

    void Promise.all(
      onlineSlugs.map(async (slug) => {
        try {
          const state = await fetchCharacter(slug);
          return [slug, state] as const;
        } catch (error: any) {
          setErrors((prev) => [...prev, `[fetch ${slug}] ${String(error?.message ?? error)}`]);
          return null;
        }
      })
    ).then((results) => {
      const nextEntries = results.filter(Boolean) as Array<readonly [string, CharacterState]>;
      if (nextEntries.length === 0) return;

      setLiveStates((prev) => ({
        ...prev,
        ...Object.fromEntries(nextEntries),
      }));
    });
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
        .map((state) => toPlayerCardData(state))
        .filter((player): player is PlayerCardData => !!player)
        .map((basePlayer) => {
          const livePlayer = toPlayerCardData(liveStates[basePlayer.slug]);
          return livePlayer ?? basePlayer;
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [baseCharacterStates, liveStates]
  );

  const selectedPlayer = useMemo(
    () => roster.find((player) => player.slug === messageTargetSlug) ?? null,
    [messageTargetSlug, roster]
  );

  const onlineCount = onlineSlugs.length;
  const onlineSet = useMemo(() => new Set(onlineSlugs), [onlineSlugs]);

  const openMessageModal = (slug: string) => {
    setMessageTargetSlug(slug);
    setMessageBody("");
    setMessageModalOpen(true);
  };

  const toggleAbilityBonuses = (slug: string) => {
    setExpandedAbilityBonuses((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const handleSendMessage = () => {
    if (!selectedPlayer) return;

    const trimmedMessage = messageBody.trim();
    if (!trimmedMessage) return;

    sendPrivateMessage({
      slug: selectedPlayer.slug,
      title: "Messaggio privato del DM",
      message: trimmedMessage,
    });

    toast.success(`Messaggio inviato a ${selectedPlayer.name}`);
    setMessageBody("");
    setMessageModalOpen(false);
  };

  return (
    <div className="min-h-screen parchment p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="dnd-frame p-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="w-fit border-primary/30 bg-background/70">
                Pagina DM
              </Badge>
              <div>
                <h1 className="font-heading text-4xl font-bold text-primary">Roster giocatori</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Vista rapida del party sempre disponibile, con stato live e gli stessi riferimenti tattici del tracker.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Card className="min-w-36 border-primary/15 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Giocatori</div>
                    <div className="text-lg font-semibold text-foreground">{roster.length}</div>
                  </div>
                </div>
              </Card>
              <Card className="min-w-36 border-emerald-500/20 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Online</div>
                    <div className="text-lg font-semibold text-foreground">{onlineCount}</div>
                  </div>
                </div>
              </Card>
              <Button variant="outline" className="bg-background/80" asChild>
                <a href="/dm/initiative">Apri tracker iniziativa</a>
              </Button>
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
                        <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                          <span className="text-muted-foreground">{player.resourceSummary.label}</span>{" "}
                          <span>
                            {player.resourceSummary.entries.map((entry) => `${entry.label}:${entry.remaining}`).join(" · ")}
                          </span>
                        </div>
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
                      onClick={() => openMessageModal(player.slug)}
                      disabled={!isOnline}
                      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                      title="Messaggio privato"
                      aria-label="Messaggio privato"
                    >
                      <MessageSquareMore className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedPlayer ? `Messaggio a ${selectedPlayer.name}` : "Messaggio privato"}
              </DialogTitle>
              <DialogDescription>
                Il messaggio compare come popup sulla scheda del giocatore se il personaggio e' online.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {selectedPlayer?.playerName
                  ? `Giocatore: ${selectedPlayer.playerName}`
                  : "Giocatore non indicato"}
              </div>
              <Textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Scrivi qui il messaggio del DM..."
                className="min-h-36"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMessageModalOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSendMessage} disabled={!messageBody.trim()}>
                Invia popup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
