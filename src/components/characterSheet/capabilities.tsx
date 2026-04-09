import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CapabilityKind = "passive" | "active";
type CapabilityReset = "atWill" | "encounter" | "shortRest" | "longRest" | "custom";
type PassiveEffectTarget =
  | "ARMOR_CLASS"
  | "INITIATIVE"
  | "SPEED"
  | "HIT_POINT_MAX"
  | "STRENGTH_SCORE"
  | "DEXTERITY_SCORE"
  | "CONSTITUTION_SCORE"
  | "INTELLIGENCE_SCORE"
  | "WISDOM_SCORE"
  | "CHARISMA_SCORE"
  | "ATTACK_ROLL"
  | "DAMAGE_ROLL"
  | "MELEE_ATTACK_ROLL"
  | "MELEE_DAMAGE_ROLL"
  | "RANGED_ATTACK_ROLL"
  | "RANGED_DAMAGE_ROLL"
  | "OFF_HAND_DAMAGE_ROLL"
  | "CUSTOM";
type PassiveEffectTrigger =
  | "ALWAYS"
  | "WHILE_ARMORED"
  | "WHILE_SHIELD_EQUIPPED"
  | "WHILE_WIELDING_SINGLE_MELEE_WEAPON"
  | "WHILE_DUAL_WIELDING"
  | "WHILE_WIELDING_TWO_HANDED_WEAPON"
  | "CUSTOM";
type PassiveEffectValueMode =
  | "FLAT"
  | "ABILITY_MODIFIER"
  | "ABILITY_SCORE"
  | "PROFICIENCY_BONUS"
  | "CHARACTER_LEVEL";
type PassiveEffectRounding = "FLOOR" | "CEIL";
type PassiveEffectSourceAbility =
  | "STRENGTH"
  | "DEXTERITY"
  | "CONSTITUTION"
  | "INTELLIGENCE"
  | "WISDOM"
  | "CHARISMA";

type PassiveEffectEntry = {
  target: PassiveEffectTarget;
  valueMode?: PassiveEffectValueMode;
  value: number;
  sourceAbility?: PassiveEffectSourceAbility;
  multiplierNumerator?: number;
  multiplierDenominator?: number;
  rounding?: PassiveEffectRounding;
  trigger: PassiveEffectTrigger;
  customTargetLabel?: string;
  customTriggerLabel?: string;
  notes?: string;
};

type CapabilityEntry = {
  name: string;
  category?: string;
  kind: CapabilityKind;
  shortDescription: string;
  description?: string;
  passiveEffects?: PassiveEffectEntry[];
  usage?: {
    resetOn: CapabilityReset;
    customLabel?: string;
    used: boolean[];
  };
};

type CapabilityFormState = {
  name: string;
  category: string;
  kind: CapabilityKind;
  shortDescription: string;
  description: string;
  resetOn: CapabilityReset;
  customLabel: string;
  maxUses: string;
  passiveEffects: PassiveEffectEntry[];
};

const RESET_LABELS: Record<CapabilityReset, string> = {
  atWill: "A volontà",
  encounter: "Incontro",
  shortRest: "Riposo breve",
  longRest: "Riposo lungo",
  custom: "Personalizzato",
};

const DEFAULT_FORM: CapabilityFormState = {
  name: "",
  category: "",
  kind: "passive",
  shortDescription: "",
  description: "",
  resetOn: "atWill",
  customLabel: "",
  maxUses: "1",
  passiveEffects: [],
};

const PASSIVE_TARGET_LABELS: Record<PassiveEffectTarget, string> = {
  ARMOR_CLASS: "Classe Armatura",
  INITIATIVE: "Iniziativa",
  SPEED: "Velocità",
  HIT_POINT_MAX: "Punti ferita massimi",
  STRENGTH_SCORE: "Forza",
  DEXTERITY_SCORE: "Destrezza",
  CONSTITUTION_SCORE: "Costituzione",
  INTELLIGENCE_SCORE: "Intelligenza",
  WISDOM_SCORE: "Saggezza",
  CHARISMA_SCORE: "Carisma",
  ATTACK_ROLL: "Tiri per colpire",
  DAMAGE_ROLL: "Tiri danno",
  MELEE_ATTACK_ROLL: "Tiri per colpire in mischia",
  MELEE_DAMAGE_ROLL: "Danni in mischia",
  RANGED_ATTACK_ROLL: "Tiri per colpire a distanza",
  RANGED_DAMAGE_ROLL: "Danni a distanza",
  OFF_HAND_DAMAGE_ROLL: "Danni mano secondaria",
  CUSTOM: "Altro",
};

const PASSIVE_TRIGGER_LABELS: Record<PassiveEffectTrigger, string> = {
  ALWAYS: "Sempre attivo",
  WHILE_ARMORED: "Finché indossa un'armatura",
  WHILE_SHIELD_EQUIPPED: "Finché usa uno scudo",
  WHILE_WIELDING_SINGLE_MELEE_WEAPON: "Finché impugna una sola arma da mischia",
  WHILE_DUAL_WIELDING: "Finché combatte con due armi",
  WHILE_WIELDING_TWO_HANDED_WEAPON: "Finché usa un'arma a due mani",
  CUSTOM: "Trigger personalizzato",
};

const PASSIVE_VALUE_MODE_LABELS: Record<PassiveEffectValueMode, string> = {
  FLAT: "Bonus fisso",
  ABILITY_MODIFIER: "Mod. caratteristica",
  ABILITY_SCORE: "Punteggio caratteristica",
  PROFICIENCY_BONUS: "Bonus competenza",
  CHARACTER_LEVEL: "Livello personaggio",
};

const PASSIVE_SOURCE_ABILITY_LABELS: Record<PassiveEffectSourceAbility, string> = {
  STRENGTH: "Forza",
  DEXTERITY: "Destrezza",
  CONSTITUTION: "Costituzione",
  INTELLIGENCE: "Intelligenza",
  WISDOM: "Saggezza",
  CHARISMA: "Carisma",
};

const PASSIVE_ROUNDING_LABELS: Record<PassiveEffectRounding, string> = {
  FLOOR: "Per difetto",
  CEIL: "Per eccesso",
};

function newPassiveEffect(): PassiveEffectEntry {
  return {
    target: "ARMOR_CLASS",
    valueMode: "FLAT",
    value: 1,
    sourceAbility: "DEXTERITY",
    multiplierNumerator: 1,
    multiplierDenominator: 1,
    rounding: "FLOOR",
    trigger: "ALWAYS",
    customTargetLabel: "",
    customTriggerLabel: "",
    notes: "",
  };
}

function passiveEffectSummary(effect: PassiveEffectEntry) {
  const targetLabel =
    effect.target === "CUSTOM"
      ? effect.customTargetLabel?.trim() || "Altro"
      : PASSIVE_TARGET_LABELS[effect.target];
  const triggerLabel =
    effect.trigger === "CUSTOM"
      ? effect.customTriggerLabel?.trim() || "Trigger personalizzato"
      : PASSIVE_TRIGGER_LABELS[effect.trigger];
  const mode = effect.valueMode ?? "FLAT";
  const offset = Number(effect.value ?? 0);
  const signedOffset = offset >= 0 ? `+${offset}` : `${offset}`;
  const numerator = Number(effect.multiplierNumerator ?? 1);
  const denominator = Number(effect.multiplierDenominator ?? 1);
  const ratioLabel =
    numerator === 1 && denominator === 1
      ? ""
      : ` × ${numerator}/${denominator}${
          denominator !== 1 ? ` (${PASSIVE_ROUNDING_LABELS[effect.rounding ?? "FLOOR"]})` : ""
        }`;

  let valueLabel = signedOffset;
  switch (mode) {
    case "ABILITY_MODIFIER":
      valueLabel = `${PASSIVE_SOURCE_ABILITY_LABELS[effect.sourceAbility ?? "DEXTERITY"]} mod${ratioLabel}${offset !== 0 ? ` ${signedOffset}` : ""}`;
      break;
    case "ABILITY_SCORE":
      valueLabel = `${PASSIVE_SOURCE_ABILITY_LABELS[effect.sourceAbility ?? "DEXTERITY"]}${ratioLabel}${offset !== 0 ? ` ${signedOffset}` : ""}`;
      break;
    case "PROFICIENCY_BONUS":
      valueLabel = `B. Comp.${ratioLabel}${offset !== 0 ? ` ${signedOffset}` : ""}`;
      break;
    case "CHARACTER_LEVEL":
      valueLabel = `Livello${ratioLabel}${offset !== 0 ? ` ${signedOffset}` : ""}`;
      break;
    default:
      break;
  }

  return `${targetLabel} ${valueLabel} - ${triggerLabel}`;
}

function usageLabel(usage?: CapabilityEntry["usage"]) {
  if (!usage) return "";
  if (usage.resetOn === "custom") return usage.customLabel?.trim() || "Personalizzato";
  return RESET_LABELS[usage.resetOn];
}

function toFormState(entry: CapabilityEntry): CapabilityFormState {
  return {
    name: entry.name ?? "",
    category: entry.category ?? "",
    kind: entry.kind,
    shortDescription: entry.shortDescription ?? "",
    description: entry.description ?? "",
    resetOn: entry.usage?.resetOn ?? "atWill",
    customLabel: entry.usage?.customLabel ?? "",
    maxUses: String(entry.usage?.used?.length ?? 1),
    passiveEffects: Array.isArray(entry.passiveEffects)
      ? entry.passiveEffects.map((effect) => ({ ...effect }))
      : [],
  };
}

export default function Capabilities({
  characterData,
  addCapability,
  updateCapability,
  removeCapability,
  toggleCapabilityUse,
}: {
  characterData: any;
  addCapability: (entry: CapabilityEntry) => void;
  updateCapability: (capabilityIndex: number, entry: CapabilityEntry) => void;
  removeCapability: (capabilityIndex: number) => void;
  toggleCapabilityUse: (capabilityIndex: number, useIndex: number) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState<CapabilityFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState("");

  const capabilities = Array.isArray(characterData?.capabilities) ? characterData.capabilities : [];
  const activeCapabilities = useMemo(
    () => capabilities.map((cap: CapabilityEntry, index: number) => ({ cap, index })).filter(({ cap }) => cap.kind === "active"),
    [capabilities]
  );
  const passiveCapabilities = useMemo(
    () => capabilities.map((cap: CapabilityEntry, index: number) => ({ cap, index })).filter(({ cap }) => cap.kind === "passive"),
    [capabilities]
  );

  const detailCapability =
    detailIndex !== null && capabilities[detailIndex] ? (capabilities[detailIndex] as CapabilityEntry) : null;

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setFormError("");
    setEditingIndex(null);
  };

  const openDetail = (index: number) => {
    setDetailIndex(index);
    setDetailOpen(true);
  };

  const openAddForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = () => {
    if (detailIndex === null || !detailCapability) return;
    setForm(toFormState(detailCapability));
    setFormError("");
    setEditingIndex(detailIndex);
    setDetailOpen(false);
    setFormOpen(true);
  };

  const submitCapability = () => {
    const name = form.name.trim();
    const shortDescription = form.shortDescription.trim();
    const category = form.category.trim();
    const description = form.description.trim();

    if (!name) {
      setFormError("Il nome è obbligatorio.");
      return;
    }

    if (!shortDescription) {
      setFormError("La descrizione breve è obbligatoria.");
      return;
    }

    const entry: CapabilityEntry = {
      name,
      kind: form.kind,
      shortDescription,
      ...(category ? { category } : {}),
      ...(description ? { description } : {}),
    };

    if (form.kind === "passive") {
      const passiveEffects = form.passiveEffects
        .map((effect) => ({
          ...effect,
          valueMode: effect.valueMode ?? "FLAT",
          sourceAbility: effect.sourceAbility ?? "DEXTERITY",
          multiplierNumerator: Number(effect.multiplierNumerator ?? 1) || 1,
          multiplierDenominator: Math.max(1, Number(effect.multiplierDenominator ?? 1) || 1),
          rounding: effect.rounding ?? "FLOOR",
          customTargetLabel: effect.customTargetLabel?.trim() || undefined,
          customTriggerLabel: effect.customTriggerLabel?.trim() || undefined,
          notes: effect.notes?.trim() || undefined,
        }))
        .filter((effect) => effect.valueMode !== "FLAT" || effect.value !== 0);

      if (passiveEffects.some((effect) => effect.target === "CUSTOM" && !effect.customTargetLabel)) {
        setFormError("Inserisci un'etichetta per ogni bersaglio personalizzato.");
        return;
      }

      if (passiveEffects.some((effect) => effect.trigger === "CUSTOM" && !effect.customTriggerLabel)) {
        setFormError("Inserisci un'etichetta per ogni trigger personalizzato.");
        return;
      }

      if (
        passiveEffects.some(
          (effect) =>
            (effect.valueMode === "ABILITY_MODIFIER" || effect.valueMode === "ABILITY_SCORE") &&
            !effect.sourceAbility
        )
      ) {
        setFormError("Se usi una caratteristica come sorgente, seleziona quale.");
        return;
      }

      if (
        passiveEffects.some(
          (effect) =>
            (effect.multiplierDenominator ?? 1) <= 0 || (effect.multiplierNumerator ?? 1) <= 0
        )
      ) {
        setFormError("Rapporto non valido: numeratore e denominatore devono essere maggiori di zero.");
        return;
      }

      if (passiveEffects.length > 0) {
        entry.passiveEffects = passiveEffects;
      }
    }

    if (form.kind === "active") {
      const customLabel = form.customLabel.trim();
      if (form.resetOn === "custom" && !customLabel) {
        setFormError("Inserisci un'etichetta personalizzata per il tipo di utilizzo.");
        return;
      }

      let used: boolean[] = [];
      if (form.resetOn !== "atWill") {
        const maxUses = parseInt(form.maxUses, 10);
        if (!Number.isFinite(maxUses) || maxUses <= 0) {
          setFormError("Inserisci un numero di utilizzi valido.");
          return;
        }

        used = Array.from({ length: maxUses }, () => false);
        if (editingIndex !== null) {
          const previous = capabilities[editingIndex]?.usage?.used ?? [];
          used = Array.from({ length: maxUses }, (_, index) => previous[index] ?? false);
        }
      }

      entry.usage = {
        resetOn: form.resetOn,
        used,
        ...(form.resetOn === "custom" && customLabel ? { customLabel } : {}),
      };
    }

    if (editingIndex !== null) {
      updateCapability(editingIndex, entry);
    } else {
      addCapability(entry);
    }

    setFormOpen(false);
    resetForm();
  };

  const confirmDelete = () => {
    if (detailIndex === null) return;
    removeCapability(detailIndex);
    setConfirmDeleteOpen(false);
    setDetailOpen(false);
    setDetailIndex(null);
  };

  return (
    <Card className="character-section">
      <div className="character-section-title flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Skills
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={openAddForm}
          className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
          aria-label="Aggiungi skill"
          title="Aggiungi skill"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="font-semibold text-primary">Attive</div>
          {activeCapabilities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessuna skill attiva censita.</div>
          ) : (
            activeCapabilities.map(({ cap, index }) => (
              <div key={`active-${index}`} className="dnd-frame rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openDetail(index)}
                    className="min-w-0 flex-1 rounded-sm text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-primary">{cap.name}</div>
                      {cap.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {cap.category}
                        </Badge>
                      )}
                      {cap.usage && (
                        <Badge variant="secondary" className="text-[10px]">
                          {usageLabel(cap.usage)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{cap.shortDescription}</div>
                  </button>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2 pt-0.5">
                    {(cap.usage?.used ?? []).map((used, useIndex) => (
                      <label
                        key={`cap-${index}-use-${useIndex}`}
                        className="inline-flex cursor-pointer items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={used}
                          onChange={() => toggleCapabilityUse(index, useIndex)}
                          className="h-4 w-4"
                          aria-label={`${cap.name} uso ${useIndex + 1}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-primary">Passive</div>
          {passiveCapabilities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessuna skill passiva censita.</div>
          ) : (
            passiveCapabilities.map(({ cap, index }) => (
              <button
                key={`passive-${index}`}
                type="button"
                onClick={() => openDetail(index)}
                className="w-full rounded dnd-frame p-3 text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-primary">{cap.name}</div>
                    <div className="whitespace-pre-line text-xs text-muted-foreground">{cap.shortDescription}</div>
                  </div>
                  {cap.category && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {cap.category}
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Modifica skill" : "Aggiungi skill"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block">Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Es. Ispirazione bardica"
                />
              </div>
              <div>
                <Label className="mb-1 block">Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Es. Suppliche"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Tipologia</Label>
              <select
                value={form.kind}
                onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as CapabilityKind }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="passive">Passiva</option>
                <option value="active">Attiva</option>
              </select>
            </div>

            <div>
              <Label className="mb-1 block">Descrizione breve *</Label>
              <Textarea
                value={form.shortDescription}
                onChange={(e) => setForm((prev) => ({ ...prev, shortDescription: e.target.value }))}
                rows={2}
                placeholder="Testo breve mostrato direttamente nel componente"
              />
            </div>

            <div>
              <Label className="mb-1 block">Descrizione completa</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={5}
                placeholder="Dettagli aggiuntivi visibili nel pannello di dettaglio"
              />
            </div>

            {form.kind === "passive" && (
              <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-primary">Effetti passivi</div>
                    <div className="text-xs text-muted-foreground">
                      Bonus modulari con bersaglio e trigger.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        passiveEffects: [...prev.passiveEffects, newPassiveEffect()],
                      }))
                    }
                  >
                    Aggiungi effetto
                  </Button>
                </div>

                {form.passiveEffects.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nessun effetto configurato.
                  </div>
                ) : (
                  form.passiveEffects.map((effect, index) => (
                    <div key={`passive-effect-${index}`} className="space-y-3 rounded-md border border-border/60 bg-background/60 p-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="mb-1 block">Bersaglio</Label>
                          <select
                            value={effect.target}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, target: e.target.value as PassiveEffectTarget }
                                    : row
                                ),
                              }))
                            }
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            {Object.entries(PASSIVE_TARGET_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label className="mb-1 block">Valore</Label>
                          <select
                            value={effect.valueMode ?? "FLAT"}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, valueMode: e.target.value as PassiveEffectValueMode }
                                    : row
                                ),
                              }))
                            }
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            {Object.entries(PASSIVE_VALUE_MODE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label className="mb-1 block">Trigger</Label>
                          <select
                            value={effect.trigger}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, trigger: e.target.value as PassiveEffectTrigger }
                                    : row
                                ),
                              }))
                            }
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            {Object.entries(PASSIVE_TRIGGER_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {(effect.valueMode === "ABILITY_MODIFIER" || effect.valueMode === "ABILITY_SCORE") && (
                        <div>
                          <Label className="mb-1 block">Caratteristica sorgente</Label>
                          <select
                            value={effect.sourceAbility ?? "DEXTERITY"}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, sourceAbility: e.target.value as PassiveEffectSourceAbility }
                                    : row
                                ),
                              }))
                            }
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            {Object.entries(PASSIVE_SOURCE_ABILITY_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(effect.valueMode ?? "FLAT") !== "FLAT" && (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <Label className="mb-1 block">Rapporto</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                inputMode="numeric"
                                value={String(effect.multiplierNumerator ?? 1)}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, multiplierNumerator: Math.max(1, Number(e.target.value || 1)) }
                                        : row
                                    ),
                                  }))
                                }
                                placeholder="1"
                              />
                              <span className="text-sm text-muted-foreground">/</span>
                              <Input
                                inputMode="numeric"
                                value={String(effect.multiplierDenominator ?? 1)}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, multiplierDenominator: Math.max(1, Number(e.target.value || 1)) }
                                        : row
                                    ),
                                  }))
                                }
                                placeholder="1"
                              />
                            </div>
                          </div>

                          {(effect.multiplierDenominator ?? 1) !== 1 && (
                            <div>
                              <Label className="mb-1 block">Arrotondamento</Label>
                              <select
                                value={effect.rounding ?? "FLOOR"}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, rounding: e.target.value as PassiveEffectRounding }
                                        : row
                                    ),
                                  }))
                                }
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                              >
                                {Object.entries(PASSIVE_ROUNDING_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <Label className="mb-1 block">
                          {effect.valueMode === "FLAT" ? "Bonus fisso" : "Offset opzionale"}
                        </Label>
                        <Input
                          inputMode="numeric"
                          value={String(effect.value)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, value: Number(e.target.value || 0) }
                                  : row
                              ),
                            }))
                          }
                          placeholder={effect.valueMode === "FLAT" ? "Es. 1" : "Es. 0"}
                        />
                      </div>

                      {effect.target === "CUSTOM" && (
                        <div>
                          <Label className="mb-1 block">Etichetta bersaglio</Label>
                          <Input
                            value={effect.customTargetLabel ?? ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, customTargetLabel: e.target.value }
                                    : row
                                ),
                              }))
                            }
                            placeholder="Es. CA contro opportunità"
                          />
                        </div>
                      )}

                      {effect.trigger === "CUSTOM" && (
                        <div>
                          <Label className="mb-1 block">Etichetta trigger</Label>
                          <Input
                            value={effect.customTriggerLabel ?? ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, customTriggerLabel: e.target.value }
                                    : row
                                ),
                              }))
                            }
                            placeholder="Es. Finché è sotto metà punti ferita"
                          />
                        </div>
                      )}

                      <div>
                        <Label className="mb-1 block">Note</Label>
                        <Input
                          value={effect.notes ?? ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, notes: e.target.value }
                                  : row
                              ),
                            }))
                          }
                          placeholder="Opzionale"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              passiveEffects: prev.passiveEffects.filter((_, rowIndex) => rowIndex !== index),
                            }))
                          }
                        >
                          Rimuovi effetto
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {form.kind === "active" && (
              <div className="space-y-4 rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1 block">Tipo di utilizzo</Label>
                    <select
                      value={form.resetOn}
                      onChange={(e) => setForm((prev) => ({ ...prev, resetOn: e.target.value as CapabilityReset }))}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="atWill">A volontà</option>
                      <option value="encounter">Incontro</option>
                      <option value="shortRest">Riposo breve</option>
                      <option value="longRest">Riposo lungo</option>
                      <option value="custom">Personalizzato</option>
                    </select>
                  </div>
                  {form.resetOn !== "atWill" && (
                    <div>
                      <Label className="mb-1 block">Numero utilizzi</Label>
                      <Input
                        inputMode="numeric"
                        value={form.maxUses}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxUses: e.target.value }))}
                        placeholder="Es. 3"
                      />
                    </div>
                  )}
                </div>

                {form.resetOn === "custom" && (
                  <div>
                    <Label className="mb-1 block">Etichetta personalizzata</Label>
                    <Input
                      value={form.customLabel}
                      onChange={(e) => setForm((prev) => ({ ...prev, customLabel: e.target.value }))}
                      placeholder="Es. 1 volta al giorno"
                    />
                  </div>
                )}
              </div>
            )}

            {formError && <div className="text-sm text-destructive">{formError}</div>}
          </div>

          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">Annulla</Button>
            </DialogClose>
            <Button onClick={submitCapability}>{editingIndex !== null ? "Salva modifiche" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailIndex(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailCapability?.name || "Dettaglio skill"}</DialogTitle>
          </DialogHeader>

          {detailCapability && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {detailCapability.kind === "passive" ? "Passiva" : "Attiva"}
                </Badge>
                {detailCapability.category && <Badge variant="outline">{detailCapability.category}</Badge>}
                {detailCapability.usage && <Badge variant="outline">{usageLabel(detailCapability.usage)}</Badge>}
              </div>

              <div className="whitespace-pre-line text-muted-foreground">{detailCapability.shortDescription}</div>

              {detailCapability.description && <div className="whitespace-pre-line">{detailCapability.description}</div>}

              {detailCapability.kind === "passive" && Array.isArray(detailCapability.passiveEffects) && detailCapability.passiveEffects.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-primary">Effetti passivi</div>
                  <div className="space-y-2">
                    {detailCapability.passiveEffects.map((effect, index) => (
                      <div key={`detail-passive-effect-${index}`} className="rounded border border-border/70 px-3 py-2 text-muted-foreground">
                        <div>{passiveEffectSummary(effect)}</div>
                        {effect.notes && <div className="mt-1 text-xs">{effect.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailCapability.usage && detailCapability.usage.used.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-primary">Utilizzi</div>
                  <div className="flex flex-wrap gap-2">
                    {detailCapability.usage.used.map((used, useIndex) => (
                      <label
                        key={`detail-cap-${detailIndex}-use-${useIndex}`}
                        className="inline-flex items-center rounded border border-border px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={used}
                          onChange={() => {
                            if (detailIndex !== null) toggleCapabilityUse(detailIndex, useIndex);
                          }}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              Elimina
            </Button>
            <Button variant="outline" onClick={openEditForm}>
              Modifica
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Chiudi</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa skill?</AlertDialogTitle>
            <AlertDialogDescription>
              La skill verrà rimossa definitivamente dalla scheda del personaggio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
