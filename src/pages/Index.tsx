import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Dice6,
  Circle,
  KeyRound,
  Link2,
  LogIn,
  LogOut,
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
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppVersionDialog } from "@/components/app-version-dialog";
import { useAuth } from "@/components/auth-provider";
import { ResourceSummaryBadge } from "@/components/resource-summary-badge";
import { fetchCharacters } from "@/realtime";

type CharacterState = Record<string, any>;

type HomeCharacter = {
  slug: string;
  name: string;
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

function toHomeCharacter(state: CharacterState): HomeCharacter | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
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
  const { user, logout, loading } = useAuth();
  const [characters, setCharacters] = useState<HomeCharacter[]>([]);
  const [playerCreateDialogOpen, setPlayerCreateDialogOpen] = useState(false);

  useEffect(() => {
    document.title = "Home | D&D Character Manager";
  }, []);

  useEffect(() => {
    if (!user) {
      setCharacters([]);
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
        icon: Dice6,
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
    ],
    []
  );

  if (!loading && !user) {
    return (
      <div className="min-h-screen parchment">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-crimson/10 to-transparent"></div>
          <div className="relative mx-auto max-w-5xl px-6 py-20">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h1 className="mb-6 text-6xl font-heading font-bold text-primary">
                  D&D Character Manager
                </h1>
                <p className="text-xl text-muted-foreground">
                  Accessi separati per DM e giocatori, schede condivise e strumenti di sessione in un unico posto.
                </p>
              </div>

              <Card className="min-w-[280px] border-primary/15 bg-background/80 p-5">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Accesso</div>
                    <div className="mt-1 text-xl font-semibold text-primary">Entra con la tua utenza</div>
                  </div>
                  <Button asChild className="w-full">
                    <Link to="/login">
                      <LogIn className="mr-2 h-4 w-4" />
                      Vai al login
                    </Link>
                  </Button>
                </div>
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
              <h3 className="character-section-title text-center border-0 pb-0">Utenze Separate</h3>
              <p className="text-muted-foreground">
                Ogni giocatore accede solo ai propri personaggi, mentre il master mantiene il controllo completo.
              </p>
            </Card>

            <Card className="character-section text-center">
              <Shield className="mx-auto mb-4 h-12 w-12 text-primary" />
              <h3 className="character-section-title text-center border-0 pb-0">Home Ruolo</h3>
              <p className="text-muted-foreground">
                Dopo il login, DM e player atterrano su una home pensata per le loro azioni più frequenti.
              </p>
            </Card>

            <Card className="character-section text-center">
              <Dice6 className="mx-auto mb-4 h-12 w-12 text-primary" />
              <h3 className="character-section-title text-center border-0 pb-0">Realtime</h3>
              <p className="text-muted-foreground">
                Presenza online, schede live e messaggi privati continuano a funzionare in modo controllato.
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
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-3">
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
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
            <div className="text-center">
              <h1 className="font-heading text-5xl font-bold text-primary">
                {user.role === "dm" ? "Home del master" : "Home del giocatore"}
              </h1>
              <div className="mt-3">
                <AppVersionDialog notifyOnNewVersion={user.role === "player"} />
              </div>
              <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
                {user.role === "dm"
                  ? "Da qui puoi aprire la gestione sessione, organizzare gli utenti e mantenere allineate le associazioni tra account e personaggi."
                  : "Da qui accedi ai tuoi personaggi associati e, quando sarà pronta, potrai iniziare la creazione di un nuovo personaggio."}
              </p>
            </div>

          </div>
        </section>

        {user.role === "dm" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dmActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} to={action.href} className="block h-full">
                  <Card className="character-section flex h-full flex-col justify-between transition-colors hover:bg-accent/30">
                    <div>
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <div className="font-heading text-xl font-semibold text-primary">{action.title}</div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
            <Card className="character-section flex h-full flex-col justify-between border-dashed border-primary/25 bg-background/40">
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
