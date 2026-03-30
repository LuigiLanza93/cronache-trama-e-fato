import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Link2, Shield, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCharacters } from "@/realtime";
import {
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
};

function toCharacterRow(state: CharacterState): CharacterRow | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
  };
}

const NONE_VALUE = "__none__";

export default function CharacterAssignments() {
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [ownership, setOwnership] = useState<Record<string, string>>({});
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Associazione PG | D&D Character Manager";
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
        if (active) toast.error("Non sono riuscito a caricare associazioni e utenti.");
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
        role: user.role,
      })),
    [users]
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

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <Button variant="ghost" asChild className="w-fit">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna alla home
          </Link>
        </Button>

        <div className="dnd-frame p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-heading text-4xl font-bold text-primary">Associazione personaggi</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Per ogni personaggio puoi scegliere quale utente ne è proprietario. Lasciarlo senza assegnazione è valido; assegnarlo al master sarà utile più avanti per i PNG speciali.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Card className="min-w-36 border-primary/15 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Link2 className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Personaggi</div>
                    <div className="text-lg font-semibold text-foreground">{characters.length}</div>
                  </div>
                </div>
              </Card>
              <Card className="min-w-36 border-primary/15 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Utenti</div>
                    <div className="text-lg font-semibold text-foreground">{users.length}</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {loading ? (
          <Card className="character-section">
            <div className="text-sm text-muted-foreground">Carico associazioni e personaggi...</div>
          </Card>
        ) : (
          <section className="grid gap-4">
            {characters.map((character) => {
              const assignedUserId = ownership[character.slug] ?? NONE_VALUE;
              const selectedUser = users.find((user) => user.id === ownership[character.slug]) ?? null;

              return (
                <Card key={character.slug} className="character-section">
                  <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.2fr)_280px] lg:items-center">
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
                        disabled={savingSlug === character.slug}
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
                  </div>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
