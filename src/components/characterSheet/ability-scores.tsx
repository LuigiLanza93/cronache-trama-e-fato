import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Minus, Plus, Settings2, Sparkles, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/characterSheet/section-card";
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
import { updateCharacter } from "@/realtime";
import { resolveCharacterAbilityScores } from "@/utils";

const ABILITY_LABELS: Record<string, string> = {
  strength: "Forza",
  dexterity: "Destrezza",
  constitution: "Costituzione",
  intelligence: "Intelligenza",
  wisdom: "Saggezza",
  charisma: "Carisma",
};

const AbilityScores = ({
  characterData,
  abilityModifier,
  passiveCapabilities = [],
  passiveEffectContext = {},
  canEdit = true,
}: any) => {
  const persistedScores = useMemo(
    () => ({ ...(characterData?.abilityScores ?? {}) }),
    [characterData?.abilityScores]
  );
  const [editingScores, setEditingScores] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, number | string>>(persistedScores);
  const resolvedAbilityData = useMemo(
    () => resolveCharacterAbilityScores(characterData, passiveCapabilities, passiveEffectContext),
    [characterData, passiveCapabilities, passiveEffectContext]
  );

  useEffect(() => {
    if (!editingScores) {
      setDraftScores(persistedScores);
    }
  }, [persistedScores, editingScores]);

  const handleStep = (ability: string, delta: number) => {
    if (!editingScores) return;
    setDraftScores((prev) => ({
      ...prev,
      [ability]: Math.max(0, (Number(prev[ability]) || 0) + delta),
    }));
  };

  const handleSave = () => {
    if (!canEdit) return;
    if (scoreChanges.length === 0) {
      setEditingScores(false);
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmSave = () => {
    if (!canEdit) return;
    const nextScores = Object.fromEntries(
      Object.entries(draftScores).map(([ability, value]) => [
        ability,
        value === "" ? 0 : parseInt(String(value), 10) || 0,
      ])
    );

    updateCharacter(characterData.slug, {
      abilityScores: nextScores,
    });

    setConfirmOpen(false);
    setEditingScores(false);
  };

  const handleCancel = () => {
    setDraftScores(persistedScores);
    setConfirmOpen(false);
    setEditingScores(false);
  };

  const scoreChanges = Object.entries(draftScores)
    .map(([ability, value]) => {
      const nextValue = value === "" ? 0 : parseInt(String(value), 10) || 0;
      const previousValue = parseInt(String(persistedScores[ability] ?? 0), 10) || 0;
      const delta = nextValue - previousValue;

      if (delta === 0) return null;

      return {
        ability,
        label: ABILITY_LABELS[ability] ?? ability,
        delta,
      };
    })
    .filter(Boolean) as Array<{ ability: string; label: string; delta: number }>;

  return (
    <>
      <SectionCard
        cardId="abilityScores"
        title={<span>Punti abilità</span>}
        actions={
          !editingScores ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent"
              disabled={!canEdit}
              onClick={() => {
                if (!canEdit) return;
                setEditingScores(true);
              }}
              aria-label="Modifica punti abilità"
              title="Modifica punti abilità"
            >
              <Settings2 className="h-4 w-4 text-primary" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSave}
                aria-label="Salva punti abilità"
                title="Salva punti abilità"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleCancel}
                aria-label="Annulla modifiche punti abilità"
                title="Annulla modifiche punti abilità"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(draftScores).map(([ability, data]) => {
            const detail = resolvedAbilityData.details[ability];
            const displayValue =
              editingScores
                ? (data as string | number)
                : (detail?.resolvedScore ?? Number(data)) || 0;
            const isModified = !editingScores && !!detail?.isModified;
            const isDetailOpen = activeDetail === ability && isModified;

            return (
            <div
              key={ability}
              className={`ability-score flex flex-col items-center rounded-xl px-2 py-2 transition ${
                isModified ? "border border-primary/40 bg-primary/5 shadow-sm" : ""
              }`}
            >
              <div className="relative flex w-full items-center justify-center">
                <div className="inline-flex items-center gap-1 text-xs text-center font-medium uppercase text-muted-foreground">
                  <span>{ability.slice(0, 3)}</span>
                  {isModified ? (
                    <Sparkles
                      className="h-3 w-3 text-primary"
                      aria-label={`${ABILITY_LABELS[ability] ?? ability} modificata`}
                      title={`${ABILITY_LABELS[ability] ?? ability} modificata`}
                    />
                  ) : null}
                </div>
                {isModified ? (
                  <button
                    type="button"
                    onClick={() => setActiveDetail((prev) => (prev === ability ? null : ability))}
                    className="absolute right-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-primary/80 transition hover:bg-primary/10 hover:text-primary"
                    aria-expanded={isDetailOpen}
                    aria-label={isDetailOpen ? `Nascondi dettaglio ${ability}` : `Mostra dettaglio ${ability}`}
                  >
                    {isDetailOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <span className="absolute right-0 h-5 w-5" aria-hidden="true" />
                )}
              </div>
              {editingScores ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleStep(ability, -1)}
                    disabled={!canEdit}
                    aria-label={`Riduci ${ability}`}
                    title={`Riduci ${ability}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex h-10 min-w-[70px] items-center justify-center rounded-md border border-input bg-background px-3 text-center text-xl font-bold md:text-xl">
                    {data as string | number}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleStep(ability, 1)}
                    disabled={!canEdit}
                    aria-label={`Aumenta ${ability}`}
                    title={`Aumenta ${ability}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input
                  value={displayValue}
                  className="max-w-[70px] text-center text-xl font-bold md:text-xl"
                  disabled
                  readOnly
                />
              )}
              <div className="ability-score-modifier">
                {abilityModifier(Number(displayValue) || 0)}
              </div>
            </div>
          )})}
        </div>
        {!editingScores && activeDetail && resolvedAbilityData.details[activeDetail]?.isModified && (
          <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 text-sm font-semibold text-primary">
              Dettaglio {ABILITY_LABELS[activeDetail] ?? activeDetail}
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {resolvedAbilityData.details[activeDetail].breakdown.map((entry, index) => (
                <div key={`${activeDetail}-detail-${index}`} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">{entry.label}</span>
                  <span className="shrink-0 text-right font-medium text-foreground/90">
                    {entry.delta !== undefined
                      ? `${entry.before} ${entry.delta >= 0 ? `+${entry.delta}` : entry.delta} -> ${entry.after}`
                      : entry.after}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => setConfirmOpen(canEdit ? open : false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi l&apos;aggiornamento delle caratteristiche?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>Stai facendo le seguenti modifiche:</div>
                <div className="space-y-1">
                  {scoreChanges.map((change) => (
                    <div key={change.ability} className="flex items-center gap-2">
                      <span>{change.label}</span>
                      <span className={change.delta > 0 ? "text-primary" : "text-foreground"}>
                        {change.delta > 0 ? `+${change.delta}` : change.delta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={!canEdit}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AbilityScores;
