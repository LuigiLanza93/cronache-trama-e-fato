import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, Settings2, X } from "lucide-react";

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

const ABILITY_LABELS: Record<string, string> = {
  strength: "Forza",
  dexterity: "Destrezza",
  constitution: "Costituzione",
  intelligence: "Intelligenza",
  wisdom: "Saggezza",
  charisma: "Carisma",
};

const AbilityScores = ({ characterData, abilityModifier }: any) => {
  const persistedScores = useMemo(
    () => ({ ...(characterData?.abilityScores ?? {}) }),
    [characterData?.abilityScores]
  );
  const [editingScores, setEditingScores] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftScores, setDraftScores] = useState<Record<string, number | string>>(persistedScores);

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
    if (scoreChanges.length === 0) {
      setEditingScores(false);
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmSave = () => {
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
              onClick={() => setEditingScores(true)}
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
          {Object.entries(draftScores).map(([ability, data]) => (
            <div key={ability} className="ability-score flex flex-col items-center">
              <div className="text-xs text-center font-medium uppercase text-muted-foreground">
                {ability.slice(0, 3)}
              </div>
              {editingScores ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleStep(ability, -1)}
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
                    aria-label={`Aumenta ${ability}`}
                    title={`Aumenta ${ability}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input
                  value={data as string | number}
                  className="max-w-[70px] text-center text-xl font-bold md:text-xl"
                  disabled
                  readOnly
                />
              )}
              <div className="ability-score-modifier">{abilityModifier(Number(data) || 0)}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
            <AlertDialogAction onClick={handleConfirmSave}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AbilityScores;
