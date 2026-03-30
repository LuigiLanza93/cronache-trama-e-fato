import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Dice6,
  KeyRound,
  Link2,
  LogIn,
  LogOut,
  PlusCircle,
  Scroll,
  Shield,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/auth-provider";
import { fetchCharacters } from "@/realtime";

type CharacterState = Record<string, any>;

type HomeCharacter = {
  slug: string;
  name: string;
  className: string;
  level: number | null;
};

function toHomeCharacter(state: CharacterState): HomeCharacter | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
  };
}

const Index = () => {
  const { user, logout, loading } = useAuth();
  const [characters, setCharacters] = useState<HomeCharacter[]>([]);

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
        <section className="dnd-frame p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={user.role === "dm" ? "default" : "secondary"}>
                  {user.role === "dm" ? "Master" : "Giocatore"}
                </Badge>
                <span className="text-sm text-muted-foreground">{user.username}</span>
              </div>
              <h1 className="mt-3 font-heading text-5xl font-bold text-primary">
                {user.role === "dm" ? "Home del master" : "Home del giocatore"}
              </h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                {user.role === "dm"
                  ? "Da qui puoi aprire la gestione sessione, organizzare gli utenti e mantenere allineate le associazioni tra account e personaggi."
                  : "Da qui accedi ai tuoi personaggi associati e, quando sarà pronta, potrai iniziare la creazione di un nuovo personaggio."}
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Esci
            </Button>
          </div>
        </section>

        {user.role === "dm" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dmActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.href} className="character-section flex h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <div className="font-heading text-xl font-semibold text-primary">{action.title}</div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <Button asChild className="mt-6 w-fit">
                    <Link to={action.href}>
                      Apri
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </Card>
              );
            })}
          </section>
        ) : (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-heading text-3xl font-bold text-primary">Le tue schede</h2>
                <p className="text-muted-foreground">
                  Elenco delle schede attualmente associate al tuo account.
                </p>
              </div>
              <Button asChild>
                <Link to="/characters/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crea nuova scheda
                </Link>
              </Button>
            </div>

            {characters.length === 0 ? (
              <Card className="character-section">
                <div className="text-sm text-muted-foreground">
                  Non ci sono ancora personaggi associati a questo account.
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {characters.map((character) => (
                  <Card key={character.slug} className="character-section">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-heading text-2xl font-semibold text-primary">
                          {character.name}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {character.className || "Classe?"}
                            {character.level !== null ? ` Lv ${character.level}` : ""}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">{character.slug}</span>
                        </div>
                      </div>
                      <Scroll className="h-5 w-5 text-primary" />
                    </div>

                    <Button asChild className="mt-5 w-fit">
                      <Link to={`/${character.slug}`}>
                        Apri scheda
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default Index;
