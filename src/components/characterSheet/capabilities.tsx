import { useMemo, useState } from "react";
import { ChevronDown, Plus, Sparkles } from "lucide-react";

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
import SectionCard from "@/components/characterSheet/section-card";
import {
  PASSIVE_EFFECT_SKILL_TARGET_LABELS,
  type PassiveEffectSkillTarget,
} from "@/lib/passive-effect-skills";

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
  | "UNARMED_ATTACK_ROLL"
  | "UNARMED_DAMAGE_ROLL"
  | "OFF_HAND_DAMAGE_ROLL"
  | PassiveEffectSkillTarget
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
type PassiveEffectOperationType = "BONUS" | "SET";
type PassiveEffectSetMode = "ABSOLUTE" | "MINIMUM_FLOOR";
type PassiveEffectSourceAbility =
  | "STRENGTH"
  | "DEXTERITY"
  | "CONSTITUTION"
  | "INTELLIGENCE"
  | "WISDOM"
  | "CHARISMA";

type PassiveEffectEntry = {
  target: PassiveEffectTarget;
  operationType?: PassiveEffectOperationType;
  valueMode?: PassiveEffectValueMode;
  value: number | string;
  setMode?: PassiveEffectSetMode;
  setValue?: number | string;
  capValue?: number | string;
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
  sourceType?: "character" | "item";
  sourceLabel?: string;
  sourceItemId?: string;
  sourceFeatureId?: string;
  readOnly?: boolean;
  usage?: {
    resetOn: CapabilityReset;
    customLabel?: string;
    used: boolean[];
  };
};

type CapabilityListEntry = {
  cap: CapabilityEntry;
  index: number;
  source: "character" | "derived";
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
  UNARMED_ATTACK_ROLL: "Tiri per colpire senz'armi",
  UNARMED_DAMAGE_ROLL: "Danni senz'armi",
  OFF_HAND_DAMAGE_ROLL: "Danni mano secondaria",
  ...PASSIVE_EFFECT_SKILL_TARGET_LABELS,
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
const PASSIVE_OPERATION_LABELS: Record<PassiveEffectOperationType, string> = {
  BONUS: "Bonus",
  SET: "Valore impostato",
};
const PASSIVE_SET_MODE_LABELS: Record<PassiveEffectSetMode, string> = {
  ABSOLUTE: "Assoluto",
  MINIMUM_FLOOR: "Minimo garantito",
};
const ABILITY_SCORE_TARGETS = new Set<PassiveEffectTarget>([
  "STRENGTH_SCORE",
  "DEXTERITY_SCORE",
  "CONSTITUTION_SCORE",
  "INTELLIGENCE_SCORE",
  "WISDOM_SCORE",
  "CHARISMA_SCORE",
]);

function newPassiveEffect(): PassiveEffectEntry {
  return {
    target: "ARMOR_CLASS",
    operationType: "BONUS",
    valueMode: "FLAT",
    value: 1,
    setMode: "MINIMUM_FLOOR",
    setValue: undefined,
    capValue: undefined,
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

function getAllowedValueModesForTarget(target: PassiveEffectTarget) {
  if (ABILITY_SCORE_TARGETS.has(target)) {
    return Object.entries(PASSIVE_VALUE_MODE_LABELS).filter(
      ([value]) => value !== "ABILITY_MODIFIER" && value !== "ABILITY_SCORE"
    );
  }

  return Object.entries(PASSIVE_VALUE_MODE_LABELS);
}

function isEditableSignedInteger(value: string) {
  return /^-?\d*$/.test(value);
}

function normalizeDraftSignedInteger(value: number | string | undefined) {
  if (value === undefined || value === "" || value === "-") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  const operationType = effect.operationType ?? "BONUS";
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
  if (operationType === "SET") {
    valueLabel = `${PASSIVE_OPERATION_LABELS.SET}: ${effect.setValue ?? "?"} (${PASSIVE_SET_MODE_LABELS[effect.setMode ?? "MINIMUM_FLOOR"]})`;
  } else {
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
    if (effect.capValue != null) {
      valueLabel = `${valueLabel} (max ${effect.capValue})`;
    }
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
  toggleDerivedCapabilityUse,
  derivedCapabilities = [],
  canEdit = true,
}: {
  characterData: any;
  addCapability: (entry: CapabilityEntry) => void;
  updateCapability: (capabilityIndex: number, entry: CapabilityEntry) => void;
  removeCapability: (capabilityIndex: number) => void;
  toggleCapabilityUse: (capabilityIndex: number, useIndex: number) => void;
  toggleDerivedCapabilityUse?: (characterItemId: string, itemFeatureId: string, useIndex: number, currentUsed: boolean) => void;
  derivedCapabilities?: CapabilityEntry[];
  canEdit?: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<CapabilityListEntry | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState<CapabilityFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState("");
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [passiveCollapsed, setPassiveCollapsed] = useState(false);

  const characterCapabilities = Array.isArray(characterData?.capabilities) ? characterData.capabilities : [];
  const capabilityEntries = useMemo<CapabilityListEntry[]>(
    () => [
      ...characterCapabilities.map((cap: CapabilityEntry, index: number) => ({
        cap,
        index,
        source: "character" as const,
      })),
      ...derivedCapabilities.map((cap: CapabilityEntry, index: number) => ({
        cap,
        index,
        source: "derived" as const,
      })),
    ],
    [characterCapabilities, derivedCapabilities]
  );
  const activeCapabilities = useMemo(
    () => capabilityEntries.filter(({ cap }) => cap.kind === "active"),
    [capabilityEntries]
  );
  const passiveCapabilities = useMemo(
    () => capabilityEntries.filter(({ cap }) => cap.kind === "passive"),
    [capabilityEntries]
  );
  const activeUsageSummary = useMemo(() => {
    const allUses = activeCapabilities.flatMap((entry) => entry.cap.usage?.used ?? []);
    const total = allUses.length;
    const used = allUses.filter(Boolean).length;
    return { remaining: Math.max(0, total - used), total };
  }, [activeCapabilities]);

  const detailCapability = detailEntry?.cap ?? null;

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setFormError("");
    setEditingIndex(null);
  };

  const openDetail = (entry: CapabilityListEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  };

  const openAddForm = () => {
    if (!canEdit) return;
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = () => {
    if (!canEdit) return;
    if (!detailEntry || detailEntry.source !== "character" || !detailCapability) return;
    setForm(toFormState(detailCapability));
    setFormError("");
    setEditingIndex(detailEntry.index);
    setDetailOpen(false);
    setFormOpen(true);
  };

  const submitCapability = () => {
    if (!canEdit) return;
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
          operationType: effect.operationType ?? "BONUS",
          valueMode: effect.valueMode ?? "FLAT",
          setMode: effect.setMode ?? "MINIMUM_FLOOR",
          setValue: normalizeDraftSignedInteger(effect.setValue),
          capValue: normalizeDraftSignedInteger(effect.capValue),
          sourceAbility: effect.sourceAbility ?? "DEXTERITY",
          multiplierNumerator: Number(effect.multiplierNumerator ?? 1) || 1,
          multiplierDenominator: Math.max(1, Number(effect.multiplierDenominator ?? 1) || 1),
          rounding: effect.rounding ?? "FLOOR",
          value: normalizeDraftSignedInteger(effect.value) ?? 0,
          customTargetLabel: effect.customTargetLabel?.trim() || undefined,
          customTriggerLabel: effect.customTriggerLabel?.trim() || undefined,
          notes: effect.notes?.trim() || undefined,
        }))
        .filter((effect) =>
          effect.operationType === "SET"
            ? Number.isFinite(Number(effect.setValue))
            : effect.valueMode !== "FLAT" || effect.value !== 0 || effect.capValue != null
        );

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
            ABILITY_SCORE_TARGETS.has(effect.target) &&
            (effect.valueMode === "ABILITY_MODIFIER" || effect.valueMode === "ABILITY_SCORE")
        )
      ) {
        setFormError("Le caratteristiche non possono derivare da altre caratteristiche tramite effetti passivi.");
        return;
      }

      if (
        passiveEffects.some(
          (effect) =>
            effect.operationType === "SET" &&
            !Number.isFinite(Number(effect.setValue))
        )
      ) {
        setFormError("Inserisci un valore valido per ogni effetto di tipo set.");
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
          const previous = characterCapabilities[editingIndex]?.usage?.used ?? [];
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
    if (!canEdit) return;
    if (!detailEntry || detailEntry.source !== "character") return;
    removeCapability(detailEntry.index);
    setConfirmDeleteOpen(false);
    setDetailOpen(false);
    setDetailEntry(null);
  };

  const toggleUsageForEntry = (entry: CapabilityListEntry, useIndex: number) => {
    if (!canEdit) return;
    if (entry.source === "character") {
      toggleCapabilityUse(entry.index, useIndex);
      return;
    }

    if (
      entry.cap.sourceItemId &&
      entry.cap.sourceFeatureId &&
      toggleDerivedCapabilityUse &&
      Array.isArray(entry.cap.usage?.used)
    ) {
      toggleDerivedCapabilityUse(
        entry.cap.sourceItemId,
        entry.cap.sourceFeatureId,
        useIndex,
        !!entry.cap.usage?.used?.[useIndex]
      );
    }
  };

  return (
    <SectionCard
      cardId="capabilities"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Skills
        </span>
      }
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={openAddForm}
          disabled={!canEdit}
          className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
          aria-label="Aggiungi skill"
          title="Aggiungi skill"
        >
          <Plus className="h-4 w-4" />
        </Button>
      }
    >

      <div className="space-y-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setActiveCollapsed((current) => !current)}
            className="flex w-full items-center justify-between rounded-sm text-left font-semibold text-primary transition hover:bg-muted/30"
          >
            <span>
              {activeCollapsed
                ? `Attive (${activeUsageSummary.total > 0 ? `${activeUsageSummary.remaining}/${activeUsageSummary.total}` : activeCapabilities.length})`
                : "Attive"}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${activeCollapsed ? "" : "rotate-180"}`} />
          </button>
          {!activeCollapsed && (activeCapabilities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessuna skill attiva censita.</div>
          ) : (
          activeCapabilities.map((entry) => (
              <div key={`active-${entry.source}-${entry.index}-${entry.cap.name}`} className="dnd-frame rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openDetail(entry)}
                    className="min-w-0 flex-1 rounded-sm text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-primary">{entry.cap.name}</div>
                      {entry.cap.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {entry.cap.category}
                        </Badge>
                      )}
                      {entry.cap.usage && (
                        <Badge variant="secondary" className="text-[10px]">
                          {usageLabel(entry.cap.usage)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{entry.cap.shortDescription}</div>
                  </button>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2 pt-0.5">
                    {(entry.cap.usage?.used ?? []).map((used, useIndex) => (
                      <label
                        key={`cap-${entry.index}-use-${useIndex}`}
                        className="inline-flex cursor-pointer items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={used}
                          disabled={!canEdit}
                          onChange={() => toggleUsageForEntry(entry, useIndex)}
                          className="h-4 w-4"
                          aria-label={`${entry.cap.name} uso ${useIndex + 1}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ))}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPassiveCollapsed((current) => !current)}
            className="flex w-full items-center justify-between rounded-sm text-left font-semibold text-primary transition hover:bg-muted/30"
          >
            <span>{passiveCollapsed ? `Passive (${passiveCapabilities.length})` : "Passive"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${passiveCollapsed ? "" : "rotate-180"}`} />
          </button>
          {!passiveCollapsed && (passiveCapabilities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessuna skill passiva censita.</div>
          ) : (
            passiveCapabilities.map((entry) => (
              <button
                key={`passive-${entry.source}-${entry.index}-${entry.cap.name}`}
                type="button"
                onClick={() => openDetail(entry)}
                className="w-full rounded dnd-frame p-3 text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-primary">{entry.cap.name}</div>
                    </div>
                    <div className="whitespace-pre-line text-xs text-muted-foreground">{entry.cap.shortDescription}</div>
                  </div>
                  {entry.cap.category && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {entry.cap.category}
                    </Badge>
                  )}
                </div>
              </button>
            ))
          ))}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(canEdit ? open : false);
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
                            disabled={(effect.operationType ?? "BONUS") === "SET"}
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
                            {getAllowedValueModesForTarget(effect.target).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label className="mb-1 block">Operazione</Label>
                          <select
                            value={effect.operationType ?? "BONUS"}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, operationType: e.target.value as PassiveEffectOperationType }
                                    : row
                                ),
                              }))
                            }
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            {Object.entries(PASSIVE_OPERATION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
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

                      {(effect.operationType ?? "BONUS") !== "SET" && (effect.valueMode === "ABILITY_MODIFIER" || effect.valueMode === "ABILITY_SCORE") && (
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

                      {(effect.operationType ?? "BONUS") !== "SET" && (effect.valueMode ?? "FLAT") !== "FLAT" && (
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

                      {(effect.operationType ?? "BONUS") === "SET" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="mb-1 block">Modalita set</Label>
                            <select
                              value={effect.setMode ?? "MINIMUM_FLOOR"}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? { ...row, setMode: e.target.value as PassiveEffectSetMode }
                                      : row
                                  ),
                                }))
                              }
                              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                            >
                              {Object.entries(PASSIVE_SET_MODE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="mb-1 block">Valore impostato</Label>
                            <Input
                              inputMode="numeric"
                              value={effect.setValue == null ? "" : String(effect.setValue)}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? isEditableSignedInteger(e.target.value)
                                        ? { ...row, setValue: e.target.value }
                                        : row
                                      : row
                                  ),
                                }))
                              }
                              placeholder="Es. 19"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
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
                                      ? isEditableSignedInteger(e.target.value)
                                        ? { ...row, value: e.target.value }
                                        : row
                                      : row
                                  ),
                                }))
                              }
                              placeholder={effect.valueMode === "FLAT" ? "Es. 1" : "Es. 0"}
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block">Cap massimo</Label>
                            <Input
                              inputMode="numeric"
                              value={effect.capValue == null ? "" : String(effect.capValue)}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  passiveEffects: prev.passiveEffects.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? isEditableSignedInteger(e.target.value)
                                        ? { ...row, capValue: e.target.value }
                                        : row
                                      : row
                                  ),
                                }))
                              }
                              placeholder="Opzionale"
                            />
                          </div>
                        </div>
                      )}

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
            <Button onClick={submitCapability} disabled={!canEdit}>{editingIndex !== null ? "Salva modifiche" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailEntry(null);
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
                        key={`detail-cap-${detailEntry?.index}-use-${useIndex}`}
                        className="inline-flex items-center rounded border border-border px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={used}
                          disabled={!canEdit}
                          onChange={() => {
                            if (detailEntry) toggleUsageForEntry(detailEntry, useIndex);
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
            {detailEntry?.source === "character" && (
              <>
                <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={!canEdit}>
                  Elimina
                </Button>
                <Button variant="outline" onClick={openEditForm} disabled={!canEdit}>
                  Modifica
                </Button>
              </>
            )}
            <DialogClose asChild>
              <Button variant="outline">Chiudi</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={(open) => setConfirmDeleteOpen(canEdit ? open : false)}>
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
              disabled={!canEdit}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
