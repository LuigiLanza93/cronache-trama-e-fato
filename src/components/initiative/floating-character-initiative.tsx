import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Check, Skull, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/auth-provider";
import { fetchPlayerCompendiumMonster, fetchPlayerInitiativeTrackerView, type PlayerCompendiumMonsterDetail, type PlayerInitiativeTrackerView } from "@/lib/auth";
import { joinInitiativeCharacterRoom, onPlayerInitiativeState } from "@/realtime";
import { cn } from "@/lib/utils";
import { MonsterStatBlock, PlayerMonsterPreviewCard } from "@/pages/BestiaryManagement";
import { toast } from "@/components/ui/sonner";

type FloatingCharacterInitiativeProps = {
  slug: string;
};

function toneClassName(tone: PlayerInitiativeTrackerView["entries"][number]["healthTone"]) {
  if (tone === "down") return "text-stone-100 dark:text-stone-100";
  if (tone === "critical") return "text-rose-600 dark:text-rose-400";
  if (tone === "wounded") return "text-amber-600 dark:text-amber-300";
  return "text-emerald-600 dark:text-emerald-400";
}

function rowClassName(entry: PlayerInitiativeTrackerView["entries"][number]) {
  if (entry.isCurrentTurn) return "border-primary/50 bg-primary/10 shadow-sm";
  return "border-border/60 bg-background/70";
}

function DeathSavesRow({
  successes,
  failures,
}: {
  successes: number;
  failures: number;
}) {
  return (
    <div className="mt-3 flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5 text-rose-400">
        {[0, 1, 2].map((index) => {
          const active = failures > index;
          return (
            <span
              key={`death-fail-${index}`}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-sm border",
                active
                  ? "border-rose-400/70 bg-rose-500/15 text-rose-300"
                  : "border-border/70 text-muted-foreground/40"
              )}
            >
              <X className="h-3 w-3" />
            </span>
          );
        })}
      </div>
      <Skull className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1.5 text-emerald-400">
        {[0, 1, 2].map((index) => {
          const active = successes > index;
          return (
            <span
              key={`death-success-${index}`}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-sm border",
                active
                  ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-300"
                  : "border-border/70 text-muted-foreground/40"
              )}
            >
              <Check className="h-3 w-3" />
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function FloatingCharacterInitiative({ slug }: FloatingCharacterInitiativeProps) {
  const { user } = useAuth();
  const [view, setView] = useState<PlayerInitiativeTrackerView | null>(null);
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [monsterDetail, setMonsterDetail] = useState<PlayerCompendiumMonsterDetail | null>(null);
  const [monsterDetailLoading, setMonsterDetailLoading] = useState(false);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const currentEntryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;

    const applyView = (next: PlayerInitiativeTrackerView, options?: { markUnread?: boolean }) => {
      if (!active || next.slug !== slug) return;

      const shouldMarkUnread =
        options?.markUnread &&
        !!lastUpdatedAtRef.current &&
        next.updatedAt !== lastUpdatedAtRef.current &&
        next.visible &&
        !open;

      lastUpdatedAtRef.current = next.updatedAt;
      setView(next);

      if (!next.visible) {
        setOpen(false);
        setHasUnread(false);
        return;
      }

      if (shouldMarkUnread) {
        setHasUnread(true);
      }
    };

    void fetchPlayerInitiativeTrackerView(slug)
      .then((payload) => applyView(payload))
      .catch(() => {
        if (active) {
          setView(null);
          setOpen(false);
          setHasUnread(false);
        }
      });

    joinInitiativeCharacterRoom(slug);
    const offInitiative = onPlayerInitiativeState((payload) => applyView(payload, { markUnread: true }));
    const interval = window.setInterval(() => {
      void fetchPlayerInitiativeTrackerView(slug)
        .then((payload) => applyView(payload, { markUnread: true }))
        .catch(() => {});
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(interval);
      try {
        offInitiative();
      } catch {}
    };
  }, [open, slug, user]);

  useEffect(() => {
    if (open) {
      setHasUnread(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !view?.currentTurnId) return;

    const animationFrame = window.requestAnimationFrame(() => {
      currentEntryRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [open, view?.currentTurnId, view?.entries.length]);

  useEffect(() => {
    if (!selectedMonsterId) {
      setMonsterDetail(null);
      return;
    }

    let active = true;
    setMonsterDetailLoading(true);

    void fetchPlayerCompendiumMonster(selectedMonsterId)
      .then((payload) => {
        if (active) setMonsterDetail(payload);
      })
      .catch(() => {
        if (!active) return;
        setMonsterDetail(null);
        toast.error("Questo mostro non e ancora disponibile nel bestiario giocatori.");
        setSelectedMonsterId(null);
      })
      .finally(() => {
        if (active) setMonsterDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedMonsterId]);

  if (!user) return null;
  if (!view?.visible) return null;
  if (typeof document === "undefined") return null;

  let livingOrder = 0;

  return createPortal(
    <>
      {open ? (
        <div className="fixed bottom-20 right-20 z-[9998]">
          <div className="flex h-[430px] w-[340px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/90">
            <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Iniziativa</div>
                <div className="text-xs text-muted-foreground">Round {view.round}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Chiudi tracker iniziativa"
                title="Chiudi tracker iniziativa"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 bg-background/35">
              <ScrollArea className="h-full">
                <div className="space-y-3 px-3 py-4">
                  {view.entries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
                      Nessun combattente rivelato ancora.
                    </div>
                  ) : (
                    view.entries.map((entry) => {
                      const isDown = entry.healthTone === "down";
                      const displayOrder = isDown ? null : ++livingOrder;
                      const showDeathSaves =
                        entry.type === "player" &&
                        isDown &&
                        !!entry.deathSaves;

                      return (
                        <div
                          key={entry.id}
                          ref={entry.isCurrentTurn ? currentEntryRef : null}
                          className={cn(
                            "rounded-2xl border px-4 py-3 transition-colors",
                            rowClassName(entry),
                            isDown ? "opacity-70" : ""
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={cn(
                                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[11px] font-semibold",
                                  isDown
                                    ? "border-border/70 bg-background/80 text-stone-100"
                                    : "border-border/70 bg-background/80 text-muted-foreground"
                                )}
                              >
                                {isDown ? <Skull className="h-3.5 w-3.5" /> : displayOrder}
                              </span>
                              <span className={cn("truncate text-sm font-semibold", toneClassName(entry.healthTone))}>
                                {entry.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {entry.type === "monster" &&
                              entry.sourceMonsterId &&
                              entry.knowledgeState &&
                              entry.knowledgeState !== "UNKNOWN" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
                                  onClick={() => setSelectedMonsterId(entry.sourceMonsterId ?? null)}
                                  aria-label={`Apri scheda bestiario di ${entry.name}`}
                                  title={`Apri scheda bestiario di ${entry.name}`}
                                >
                                  <BookOpen className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {entry.isCurrentTurn ? (
                                <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  Turno attuale
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {entry.statuses.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {entry.statuses.map((status) => (
                                <span
                                  key={`${entry.id}-${status}`}
                                  className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground"
                                >
                                  {status}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {showDeathSaves ? (
                            <DeathSavesRow
                              successes={entry.deathSaves?.successes ?? 0}
                              failures={entry.deathSaves?.failures ?? 0}
                            />
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-5 right-36 z-[9999]">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "relative h-12 w-12 rounded-full border-2 border-primary/60 bg-card text-primary shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/90",
            !open ? "initiative-live-glow" : ""
          )}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? "Chiudi iniziativa" : "Apri iniziativa"}
          title={open ? "Chiudi iniziativa" : "Apri iniziativa"}
        >
          <Swords className="h-4 w-4 text-primary" />
          {hasUnread ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary" /> : null}
        </Button>
      </div>

      <Dialog open={!!selectedMonsterId} onOpenChange={(nextOpen) => !nextOpen && setSelectedMonsterId(null)}>
        <DialogContent className="max-w-5xl border-border/70 bg-background/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <span>{monsterDetail?.monster.general.name ?? "Scheda mostro"}</span>
            </DialogTitle>
            <DialogDescription>
              {monsterDetail
                ? `Livello di conoscenza: ${monsterDetail.knowledgeState === "COMPLETE" ? "Completa" : "Base"}`
                : "Carico la scheda del mostro..."}
            </DialogDescription>
          </DialogHeader>
          {monsterDetailLoading || !monsterDetail ? (
            <div className="px-2 py-8 text-sm text-muted-foreground">Carico la scheda del mostro...</div>
          ) : (
            <ScrollArea className="max-h-[78vh]">
              <div className="space-y-6 px-1 py-1">
                {monsterDetail.knowledgeState === "COMPLETE" ? (
                  <MonsterStatBlock monster={monsterDetail.monster} />
                ) : (
                  <PlayerMonsterPreviewCard monster={monsterDetail.monster} state="basic" />
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>,
    document.body
  );
}
