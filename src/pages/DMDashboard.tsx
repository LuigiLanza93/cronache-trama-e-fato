// src/pages/DMDashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Map, Users, Sword, Scroll, Dice6 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import {
  subscribePresence,   // (cb: (list: { slug: string; count: number }[]) => void) => () => void
  joinCharacterRoom,   // (slug: string) => void
  fetchCharacter,      // (slug: string) => Promise<CharacterState>
  onCharacterState,    // (cb: (payload: { slug: string; state: CharacterState }) => void) => () => void
  onCharacterPatch,    // (cb: (payload: { slug: string; patch: any }) => void) => () => void
  applyPatch,          // (prev: CharacterState, patch: any) => CharacterState (nuova reference!)
} from "@/realtime";

// ---------- Tipi di base (adatta ai tuoi modelli) ----------
type CharacterState = Record<string, any>;
type LiveSummary = {
  slug: string;
  name: string;
  class?: string;
  level?: number;
  hp?: { current?: number; max?: number; temp?: number };
  ac?: number;
  status?: string;
  player?: string; 
  deathSavesFailures?: number;
};

type DMDashboardProps = {
  campaign: {
    campaignInfo: {
      name: string;
      session: string | number;
      location: string;
      date: string;
    };
    notes: string[];
  };
  monsters: Array<{
    name: string;
    size: string;
    type: string;
    challengeRating: string | number;
    armorClass: number;
    hitPoints: number;
  }>;
};

// ---------- Helper ----------
function toSummary(slug: string, s: CharacterState): LiveSummary {
  return {
    slug,
    name: s?.basicInfo?.name ?? s?.name ?? slug,
    class: s?.basicInfo?.class ?? s?.class ?? "",
    level: s?.basicInfo?.level ?? s?.level,
    hp: {
      current: s?.combatStats?.currentHitPoints ?? s?.hp?.current,
      max: s?.combatStats?.hitPointMaximum ?? s?.hp?.max,
      temp: s?.combatStats?.temporaryHitPoints ?? s?.hp?.temp,
    },
    ac: s?.combatStats?.armorClass ?? s?.ac,
    status: s?.status ?? s?.conditions?.join?.(", "),
    player: s?.player ?? s?.owner,
    deathSavesFailures: s?.combatStats?.deathSaves?.failures ?? 0,
  };
}

function hpPercent(hp?: { current?: number; max?: number, temp?: number }): number {
  const cur = Math.max(0, hp?.current ?? 0);
  const max = Math.max(1, hp?.max ?? 1);
  const temp = Math.max(0, hp?.temp ?? 0);
  return Math.min(100, Math.round((cur / (max + temp)) * 100));
}

// ---------- Component ----------
export default function DMDashboard({ campaign, monsters }: DMDashboardProps) {
  // --- Realtime: presence + dati giocatori (solo Players tab) ---
  const [online, setOnline] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<Record<string, LiveSummary>>({});
  const fullStatesRef = useRef<Record<string, CharacterState>>({});
  const [errors, setErrors] = useState<string | null>(null);

  // Notes locali (mantengo la tua UI intatta)
  const [sessionNotes, setSessionNotes] = useState("");

  // Presence
  useEffect(() => {
    const unsubscribe = subscribePresence((list) => {
      const next = list.filter((x) => x.count > 0)?.map((x) => x.slug);
      setOnline(next);
    });
    return () => {
      try { unsubscribe?.(); } catch { /* noop */ }
    };
  }, []);

  // Join room + fetch iniziale per i personaggi online
  useEffect(() => {
    online.forEach((slug) => {
      try { joinCharacterRoom(slug); } catch (e: any) {
        setErrors((prev) => `[join ${slug}] ${String(e?.message ?? e)}${prev ? `\n${prev}` : ""}`);
      }

      fetchCharacter(slug)
        .then((state) => {
          fullStatesRef.current[slug] = state;
          setSummaries((prev) => ({ ...prev, [slug]: toSummary(slug, state) }));
        })
        .catch((e) => {
          setErrors((prev) => `[fetch ${slug}] ${String(e?.message ?? e)}${prev ? `\n${prev}` : ""}`);
        });
    });

    // Prune chi è offline
    setSummaries((prev) => {
      const next: typeof prev = {};
      for (const slug of online) if (prev[slug]) next[slug] = prev[slug];
      return next;
    });
    Object.keys(fullStatesRef.current).forEach((slug) => {
      if (!online.includes(slug)) delete fullStatesRef.current[slug];
    });
  }, [online]);

  // Listener GLOBALI: snapshot completi e patch incrementali
  useEffect(() => {
    const offState = onCharacterState(({ slug, state }: { slug: string; state: CharacterState }) => {
      console.log('offState', slug, state);

      fullStatesRef.current[slug] = state;
      setSummaries((prev) => ({ ...prev, [slug]: toSummary(slug, state) }));
    });

    const offPatch = onCharacterPatch(({ slug, patch }: { slug: string; patch: any }) => {
      console.log('offpatch', slug, patch);
      try {
        const prev = fullStatesRef.current[slug] ?? {};
        const next = applyPatch(prev, patch); // deve ritornare NUOVA reference
        fullStatesRef.current[slug] = next;
        setSummaries((prev) => ({ ...prev, [slug]: toSummary(slug, next) }));
      } catch (e: any) {
        setErrors((prev) => `[patch ${slug}] ${String(e?.message ?? e)}${prev ? `\n${prev}` : ""}`);
      }
    });

    return () => {
      try { offState(); } catch { }
      try { offPatch(); } catch { }
    };
  }, []);

  // Per la UI Players
  const playerCards = useMemo(() => {
    const list = Object.values(summaries);
    console.log('list: ', list);

    return list.sort((a, b) =>
      (a.name || a.slug)?.localeCompare(b.name || b.slug, undefined, { sensitivity: "base" })
    );
  }, [summaries]);

  // ----------- UI ORIGINALE + logica Players inserita -----------
  return (
    <div className="min-h-screen parchment p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-heading font-bold text-primary">
            Dungeon Master's Screen
          </h1>
          <div className="dnd-frame p-4">
            <h2 className="text-2xl font-heading text-crimson">{campaign?.campaignInfo?.name}</h2>
            <div className="flex justify-center items-center gap-6 mt-2 text-sm text-muted-foreground">
              <span>Session {campaign?.campaignInfo?.session}</span>
              <span>•</span>
              <span>{campaign?.campaignInfo?.location}</span>
              <span>•</span>
              <span>{campaign?.campaignInfo?.date}</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 dnd-frame">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="bestiary" className="flex items-center gap-2">
              <Sword className="w-4 h-4" />
              Bestiary
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <Scroll className="w-4 h-4" />
              Session Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="character-section">
                <div className="character-section-title">Campaign Status</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Active Players:</span>
                    <Badge variant="secondary">{online.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Location:</span>
                    <span className="text-primary font-semibold">{campaign?.campaignInfo?.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Session:</span>
                    <span className="text-primary font-semibold">#{campaign?.campaignInfo?.session}</span>
                  </div>
                </div>
              </Card>

              <Card className="character-section">
                <div className="character-section-title">Quick Actions</div>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Dice6 className="w-4 h-4 mr-2" />
                    Roll Initiative
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Sword className="w-4 h-4 mr-2" />
                    Start Encounter
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Scroll className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </Card>

              <Card className="character-section">
                <div className="character-section-title">Recent Notes</div>
                <div className="space-y-1 text-sm">
                  {campaign?.notes.slice(-3).map((note, index) => (
                    <div key={index} className="text-muted-foreground">
                      • {note}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-4">
              {playerCards.length === 0 ? (
                <Card className="character-section">
                  <div className="text-sm text-muted-foreground">
                    Nessun giocatore online al momento.
                  </div>
                </Card>
              ) : (
                playerCards?.map((p) => {
                  const pct = hpPercent(p.hp);
                  const barColor =
                    pct >= 66 ? "bg-emerald-500" : pct >= 33 ? "bg-amber-500" : "bg-rose-500";

                  return (
                    <Card key={p.slug} className="character-section">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <h3 className="font-heading text-lg font-semibold text-primary">
                            {p.name} {p.deathSavesFailures > 0 && (
                              <div className="inline-block text-2xl text-red-600 mb-2">
                                {Array.from({ length: p.deathSavesFailures }).map((_, i) => (
                                  <span key={i}>💀</span>
                                ))}
                              </div>
                            )}
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            {p.class ? `${p.class}` : "Adventurer"}
                            {typeof p.level === "number" ? ` • Level ${p.level}` : ""}
                            {p.player ? ` • Played by ${p.player}` : ""}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {p.status ? (
                            <Badge variant="default">{p.status}</Badge>
                          ) : (
                            <Badge variant="secondary">active</Badge>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/${p.slug}`}>View Sheet</a>
                          </Button>
                        </div>
                      </div>

                      {/* HP + AC */}
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>HP</span>
                            <span className="tabular-nums">
                              {(p.hp?.current ?? 0)}/{p.hp?.max ?? 0}
                              {p.hp?.temp ? ` (+${p.hp.temp})` : ""}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded bg-border">
                            <div
                              className={`h-full ${barColor} transition-[width] duration-300`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="text-sm">
                            <span className="text-muted-foreground mr-1">AC</span>
                            <span className="font-semibold">{typeof p.ac === "number" ? p.ac : "-"}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground mr-1">Slug</span>
                            <span className="font-mono text-xs">{p.slug}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="bestiary" className="space-y-4">
            <div className="grid gap-4">
              {monsters?.map((monster, index) => (
                <Card key={index} className="character-section">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-primary">
                        {monster.name}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {monster.size} {monster.type} • CR {monster.challengeRating}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div>AC {monster.armorClass}</div>
                      <div>{monster.hitPoints} HP</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <Card className="character-section">
              <div className="character-section-title">Session Notes</div>
              <Textarea
                placeholder="Record important events, player decisions, and story developments..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="min-h-48"
              />
              <Button className="mt-2">Save Notes</Button>
            </Card>

            <Card className="character-section">
              <div className="character-section-title">Previous Notes</div>
              <div className="space-y-2">
                {campaign?.notes.map((note, index) => (
                  <div key={index} className="text-sm border-l-2 border-primary pl-3 py-1">
                    {note}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
