import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Home, Link2, PlusCircle, Shield, Trash2, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCharacters } from "@/realtime";
import {
  archiveCharacterRequest,
  fetchCharacterOwnership,
  fetchUsers,
  updateCharacterOwnership,
  type ManagedUser,
} from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

type CharacterState = Record<string, any>;

type CharacterRow = {
  slug: string;
  name: string;
  className: string;
  level: number | null;
  characterType: "pg" | "png";
};

function toCharacterRow(state: CharacterState): CharacterRow | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
    characterType: state?.characterType === "png" ? "png" : "pg",
  };
}

const NONE_VALUE = "__none__";

export default function CharacterAssignments() {
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [ownership, setOwnership] = useState<Record<string, string>>({});
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [archivingSlug, setArchivingSlug] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<CharacterRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Gestione Schede | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.all([fetchCharacters(), fetchUsers(), fetchCharacterOwnership()])
      .then(([characterItems, userItems, ownershipMap]) => {
        if (!active) return;

        const nextCharacters = Array.isArray(characterItems)
          ? characterItems
              .map((item) => toCharacterRow(item))
              .filter((item): item is CharacterRow => !!item)
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
          : [];

        const nextUsers = Array.isArray(userItems)
          ? [...userItems].sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }))
          : [];

        setCharacters(nextCharacters);
        setUsers(nextUsers);
        setOwnership(ownershipMap ?? {});
      })
      .catch(() => {
        if (active) toast.error("Non sono riuscito a caricare utenti e personaggi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.id,
        label: `${user.username}${user.role === "dm" ? " (master)" : ""}`,
      })),
    [users]
  );

  const playableCharacters = useMemo(
    () => characters.filter((character) => character.characterType === "pg"),
    [characters]
  );

  const nonPlayableCharacters = useMemo(
    () => characters.filter((character) => character.characterType === "png"),
    [characters]
  );

  const handleAssignmentChange = async (slug: string, nextValue: string) => {
    const nextUserId = nextValue === NONE_VALUE ? null : nextValue;
    setSavingSlug(slug);

    try {
      const result = await updateCharacterOwnership(slug, nextUserId);
      setOwnership((prev) => {
        const next = { ...prev };
        if (result.userId) next[slug] = result.userId;
        else delete next[slug];
        return next;
      });
      toast.success(`Associazione aggiornata per ${slug}.`);
    } catch {
      toast.error("Non sono riuscito ad aggiornare l'associazione.");
    } finally {
      setSavingSlug(null);
    }
  };

  const handleArchiveCharacter = async () => {
    if (!pendingArchive) return;

    const slug = pendingArchive.slug;
    setArchivingSlug(slug);

    try {
      await archiveCharacterRequest(slug);
      setCharacters((prev) => prev.filter((character) => character.slug !== slug));
      setOwnership((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      toast.success(`${pendingArchive.name} archiviato.`);
      setPendingArchive(null);
    } catch {
      toast.error("Non sono riuscito ad archiviare il personaggio.");
    } finally {
      setArchivingSlug(null);
    }
  };

  const renderCharacterCard = (character: CharacterRow) => {
    const assignedUserId = ownership[character.slug] ?? NONE_VALUE;
    const selectedUser = users.find((user) => user.id === ownership[character.slug]) ?? null;

    return (
      <Card key={character.slug} className="character-section">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.2fr)_280px_120px] lg:items-center">
          <div>
            <div className="font-heading text-2xl font-semibold text-primary">{character.name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {character.className || "Classe?"}
                {character.level !== null ? ` Lv ${character.level}` : ""}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{character.slug}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {selectedUser ? (
              <>
                <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                  <span className="text-muted-foreground">Associato a</span>{" "}
                  <span>{selectedUser.username}</span>
                </div>
                <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                  {selectedUser.role === "dm" ? (
                    <span className="inline-flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      master
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5 text-primary" />
                      giocatore
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-muted-foreground">
                Nessuna associazione
              </div>
            )}
          </div>

          <div className="lg:justify-self-end">
            <Select
              value={assignedUserId}
              onValueChange={(value) => void handleAssignmentChange(character.slug, value)}
              disabled={savingSlug === character.slug || archivingSlug === character.slug}
            >
              <SelectTrigger className="bg-background/80">
                <SelectValue placeholder="Seleziona utente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Nessun utente</SelectItem>
                {userOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end lg:justify-self-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive"
              title="Archivia scheda"
              aria-label="Archivia scheda"
              disabled={archivingSlug === character.slug}
              onClick={() => setPendingArchive(character)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Gestione Schede</h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
              Qui puoi associare le schede agli utenti, distinguere tra PG e PNG e togliere dal roster quelle che vuoi archiviare senza cancellarne il file in modo definitivo.
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
                  <Link2 className="h-4 w-4 text-primary" />
                  <span>{characters.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Schede totali</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{users.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Utenti disponibili</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                  <Link to="/characters/new" aria-label="Crea scheda">
                    <PlusCircle className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Crea scheda</TooltipContent>
            </Tooltip>
          </div>
        </section>

        {loading ? (
          <Card className="character-section">
            <div className="text-sm text-muted-foreground">Carico gestione schede...</div>
          </Card>
        ) : (
          <div className="space-y-8">
            <section className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-primary">Personaggi Giocanti</h2>
              </div>
              {playableCharacters.length > 0 ? (
                <div className="grid gap-4">{playableCharacters.map(renderCharacterCard)}</div>
              ) : (
                <Card className="character-section">
                  <div className="text-sm text-muted-foreground">Nessun PG presente.</div>
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-primary">Personaggi Non Giocanti</h2>
              </div>
              {nonPlayableCharacters.length > 0 ? (
                <div className="grid gap-4">{nonPlayableCharacters.map(renderCharacterCard)}</div>
              ) : (
                <Card className="character-section">
                  <div className="text-sm text-muted-foreground">Nessun PNG presente.</div>
                </Card>
              )}
            </section>
          </div>
        )}

        <AlertDialog open={!!pendingArchive} onOpenChange={(open) => (!open ? setPendingArchive(null) : null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archiviare questa scheda?</AlertDialogTitle>
              <AlertDialogDescription>
                La scheda verrà marcata come archiviata nel database e non comparirà più tra quelle
                attive o nelle associazioni. I dati resteranno comunque conservati per un eventuale
                recupero successivo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleArchiveCharacter()}
              >
                Archivia
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
