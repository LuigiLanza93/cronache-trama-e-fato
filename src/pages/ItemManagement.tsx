import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Home, Pencil, Plus, Save, Shield, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import {
  createItemDefinitionRequest,
  deleteItemDefinitionRequest,
  fetchItemDefinition,
  fetchItemDefinitions,
  updateItemDefinitionRequest,
  type ItemAttackEntry,
  type ItemAbilityRequirementEntry,
  type ItemDefinitionEntry,
  type ItemDefinitionSummary,
  type ItemFeatureEntry,
  type ItemModifierEntry,
  type ItemSlotRuleEntry,
  type ItemUseEffectEntry,
} from "@/lib/auth";
import {
  PASSIVE_EFFECT_SKILL_TARGET_LABELS,
  PASSIVE_EFFECT_SKILL_TARGETS,
  type PassiveEffectSkillTarget,
} from "@/lib/passive-effect-skills";

const CATEGORY_OPTIONS = ["WEAPON", "ARMOR", "SHIELD", "WONDROUS_ITEM", "RING", "AMULET", "ROD", "STAFF", "WAND", "TOOL", "CONSUMABLE", "AMMUNITION", "GEAR", "QUEST", "OTHER"];
const RARITY_OPTIONS = ["COMMON", "UNCOMMON", "RARE", "VERY_RARE", "LEGENDARY", "ARTIFACT", "UNIQUE"];
const WEAPON_HANDLING_OPTIONS = ["ONE_HANDED", "TWO_HANDED", "VERSATILE"];
const GLOVE_MODE_OPTIONS = ["SINGLE", "PAIR"];
const ARMOR_CATEGORY_OPTIONS = ["LIGHT", "MEDIUM", "HEAVY", "SHIELD"];
const ARMOR_CALC_OPTIONS = ["BASE_PLUS_DEX", "BASE_PLUS_DEX_MAX_2", "BASE_ONLY", "BONUS_ONLY"];
const SLOT_SELECTION_OPTIONS = ["ALL_REQUIRED", "ANY_ONE"];
const SLOT_OPTIONS = ["HEAD", "BACK", "ARMOR", "GLOVE_LEFT", "GLOVE_RIGHT", "RING_1", "RING_2", "RING_3", "RING_4", "RING_5", "RING_6", "RING_7", "RING_8", "RING_9", "RING_10", "NECK", "FEET", "WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"];
const ATTACK_KIND_OPTIONS = ["MELEE_WEAPON", "RANGED_WEAPON", "THROWN", "SPECIAL"];
const ATTACK_HAND_REQUIREMENT_OPTIONS = ["ANY", "ONE_HANDED", "TWO_HANDED"];
const MODIFIER_TARGET_OPTIONS = ["ARMOR_CLASS", "STRENGTH", "DEXTERITY", "CONSTITUTION", "INTELLIGENCE", "WISDOM", "CHARISMA", "SPEED", "INITIATIVE", "HIT_POINT_MAX"];
const MODIFIER_TYPE_OPTIONS = ["FLAT", "FORMULA", "SET_MIN", "OVERRIDE"];
const EFFECT_CONDITION_OPTIONS = ["ALWAYS", "WHILE_EQUIPPED"];
const FEATURE_RESET_OPTIONS = ["AT_WILL", "ENCOUNTER", "SHORT_REST", "LONG_REST", "DAILY", "CUSTOM"];
const FEATURE_KIND_OPTIONS = ["ACTIVE", "PASSIVE"];
const ABILITY_SCORE_OPTIONS = ["STRENGTH", "DEXTERITY", "CONSTITUTION", "INTELLIGENCE", "WISDOM", "CHARISMA"];
const ATTACK_ABILITY_OPTIONS = ["STRENGTH", "DEXTERITY", "FINESSE", "CONSTITUTION", "INTELLIGENCE", "WISDOM", "CHARISMA"];
const USE_EFFECT_TYPE_OPTIONS = ["HEAL", "DAMAGE", "TEMP_HP", "APPLY_CONDITION", "REMOVE_CONDITION", "RESTORE_RESOURCE", "CUSTOM"];
const USE_TARGET_TYPE_OPTIONS = ["SELF", "CREATURE", "OBJECT", "AREA", "CUSTOM"];
const USE_SUCCESS_OUTCOME_OPTIONS = ["NONE", "HALF", "NEGATES", "CUSTOM"];
const PASSIVE_EFFECT_TARGET_OPTIONS = [
  "ARMOR_CLASS",
  "INITIATIVE",
  "SPEED",
  "HIT_POINT_MAX",
  "STRENGTH_SCORE",
  "DEXTERITY_SCORE",
  "CONSTITUTION_SCORE",
  "INTELLIGENCE_SCORE",
  "WISDOM_SCORE",
  "CHARISMA_SCORE",
  "ATTACK_ROLL",
  "DAMAGE_ROLL",
  "MELEE_ATTACK_ROLL",
  "MELEE_DAMAGE_ROLL",
  "RANGED_ATTACK_ROLL",
  "RANGED_DAMAGE_ROLL",
  "UNARMED_ATTACK_ROLL",
  "UNARMED_DAMAGE_ROLL",
  "OFF_HAND_DAMAGE_ROLL",
  ...PASSIVE_EFFECT_SKILL_TARGETS.map((entry) => entry.target),
  "CUSTOM",
] as const;
const PASSIVE_EFFECT_TRIGGER_OPTIONS = ["ALWAYS", "WHILE_ARMORED", "WHILE_SHIELD_EQUIPPED", "WHILE_WIELDING_SINGLE_MELEE_WEAPON", "WHILE_DUAL_WIELDING", "WHILE_WIELDING_TWO_HANDED_WEAPON", "CUSTOM"];
const PASSIVE_EFFECT_VALUE_MODE_OPTIONS = ["FLAT", "ABILITY_MODIFIER", "ABILITY_SCORE", "PROFICIENCY_BONUS", "CHARACTER_LEVEL"];
const PASSIVE_EFFECT_ROUNDING_OPTIONS = ["FLOOR", "CEIL"];
const PASSIVE_EFFECT_OPERATION_OPTIONS = ["BONUS", "SET"];
const PASSIVE_EFFECT_SET_MODE_OPTIONS = ["ABSOLUTE", "MINIMUM_FLOOR"];
const ABILITY_SCORE_TARGET_OPTIONS = ["STRENGTH_SCORE", "DEXTERITY_SCORE", "CONSTITUTION_SCORE", "INTELLIGENCE_SCORE", "WISDOM_SCORE", "CHARISMA_SCORE"];
const PASSIVE_EFFECT_TARGET_LABELS: Record<(typeof PASSIVE_EFFECT_TARGET_OPTIONS)[number], string> = {
  ARMOR_CLASS: "Classe Armatura",
  INITIATIVE: "Iniziativa",
  SPEED: "Velocita",
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

function cloneItem(item: ItemDefinitionEntry) {
  return structuredClone(item);
}

function newSlotRule(): ItemSlotRuleEntry {
  return { id: crypto.randomUUID(), groupKey: "default", selectionMode: "ALL_REQUIRED", slot: "HEAD", required: true, sortOrder: 0 };
}

function newAttack(): ItemAttackEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    kind: "MELEE_WEAPON",
    handRequirement: "ANY",
    ability: null,
    attackBonus: null,
    damageDice: null,
    damageType: null,
    rangeNormal: null,
    rangeLong: null,
    twoHandedOnly: false,
    requiresEquipped: true,
    conditionText: null,
    sortOrder: 0,
  };
}

function newModifier(): ItemModifierEntry {
  return { id: crypto.randomUUID(), target: "ARMOR_CLASS", type: "FLAT", value: null, formula: null, condition: "WHILE_EQUIPPED", stackKey: null, sortOrder: 0 };
}

function newFeature(): ItemFeatureEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    kind: "ACTIVE",
    description: null,
    resetOn: null,
    customResetLabel: null,
    maxUses: null,
    passiveEffects: [],
    condition: "WHILE_EQUIPPED",
    sortOrder: 0,
  };
}

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

function getAllowedValueModeOptions(target: PassiveEffectTarget) {
  if (ABILITY_SCORE_TARGET_OPTIONS.includes(target)) {
    return PASSIVE_EFFECT_VALUE_MODE_OPTIONS.filter((option) => option !== "ABILITY_MODIFIER" && option !== "ABILITY_SCORE");
  }

  return PASSIVE_EFFECT_VALUE_MODE_OPTIONS;
}

function isEditableSignedInteger(value: string) {
  return /^-?\d*$/.test(value);
}

function normalizeDraftSignedInteger(value: number | string | undefined) {
  if (value === undefined || value === "" || value === "-") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePassiveEffectForSave(effect: any) {
  return {
    ...effect,
    operationType: effect.operationType ?? "BONUS",
    valueMode: effect.valueMode ?? "FLAT",
    setMode: effect.setMode ?? "MINIMUM_FLOOR",
    value: normalizeDraftSignedInteger(effect.value) ?? 0,
    setValue: normalizeDraftSignedInteger(effect.setValue),
    capValue: normalizeDraftSignedInteger(effect.capValue),
    multiplierNumerator: Number(effect.multiplierNumerator ?? 1) || 1,
    multiplierDenominator: Math.max(1, Number(effect.multiplierDenominator ?? 1) || 1),
    rounding: effect.rounding ?? "FLOOR",
  };
}

function normalizeDraftItemForSave(item: ItemDefinitionEntry): ItemDefinitionEntry {
  return {
    ...item,
    features: (item.features ?? []).map((feature) => ({
      ...feature,
      passiveEffects: Array.isArray(feature.passiveEffects)
        ? feature.passiveEffects.map((effect) => normalizePassiveEffectForSave(effect))
        : [],
    })),
  };
}

function newAbilityRequirement(): ItemAbilityRequirementEntry {
  return { id: crypto.randomUUID(), ability: "STRENGTH", minScore: 10, sortOrder: 0 };
}

function newUseEffect(): ItemUseEffectEntry {
  return {
    id: crypto.randomUUID(),
    effectType: "HEAL",
    targetType: "CREATURE",
    diceExpression: null,
    flatValue: null,
    damageType: null,
    savingThrowAbility: null,
    savingThrowDc: null,
    successOutcome: null,
    durationText: null,
    notes: null,
    sortOrder: 0,
  };
}

function TextRow({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function ItemManagement() {
  const [items, setItems] = useState<ItemDefinitionSummary[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemDefinitionEntry | null>(null);
  const [draftItem, setDraftItem] = useState<ItemDefinitionEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");

  useEffect(() => {
    document.title = "Gestione Oggetti | D&D Character Manager";
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setItems(await fetchItemDefinitions());
      } catch {
        toast.error("Non sono riuscito a caricare gli oggetti.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "__all__" && item.category !== categoryFilter) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q);
    });
  }, [categoryFilter, items, query]);

  const openItem = async (itemId: string) => {
    setSelectedItemId(itemId);
    setDetailLoading(true);
    try {
      const detail = await fetchItemDefinition(itemId);
      setSelectedItem(detail);
      setDraftItem(cloneItem(detail));
    } catch {
      toast.error("Non sono riuscito a caricare il dettaglio oggetto.");
    } finally {
      setDetailLoading(false);
    }
  };

  const createItem = async () => {
    if (!newItemName.trim()) return;
    setCreating(true);
    try {
      const created = await createItemDefinitionRequest({ name: newItemName.trim() });
      setItems((prev) => [...prev, {
        id: created.id,
        slug: created.slug,
        name: created.name,
        category: created.category,
        rarity: created.rarity,
        description: created.description,
        playerVisible: created.playerVisible,
        stackable: created.stackable,
        equippable: created.equippable,
        attackCount: created.attacks.length,
        slotRuleCount: created.slotRules.length,
        updatedAt: created.updatedAt,
      }].sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" })));
      setCreateOpen(false);
      setNewItemName("");
      await openItem(created.id);
      toast.success("Oggetto creato.");
    } catch {
      toast.error("Non sono riuscito a creare l'oggetto.");
    } finally {
      setCreating(false);
    }
  };

  const saveItem = async () => {
    if (!selectedItemId || !draftItem) return;
    setSaving(true);
    try {
      const saved = await updateItemDefinitionRequest(selectedItemId, normalizeDraftItemForSave(draftItem));
      setSelectedItem(saved);
      setDraftItem(cloneItem(saved));
      setItems((prev) => prev.map((entry) => entry.id === saved.id ? {
        id: saved.id,
        slug: saved.slug,
        name: saved.name,
        category: saved.category,
        rarity: saved.rarity,
        description: saved.description,
        playerVisible: saved.playerVisible,
        stackable: saved.stackable,
        equippable: saved.equippable,
        attackCount: saved.attacks.length,
        slotRuleCount: saved.slotRules.length,
        updatedAt: saved.updatedAt,
      } : entry).sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" })));
      toast.success("Oggetto salvato.");
    } catch (error: any) {
      toast.error(error?.message || "Non sono riuscito a salvare l'oggetto.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!selectedItem || !window.confirm(`Eliminare ${selectedItem.name}?`)) return;
    try {
      await deleteItemDefinitionRequest(selectedItem.id);
      setItems((prev) => prev.filter((entry) => entry.id !== selectedItem.id));
      setSelectedItemId(null);
      setSelectedItem(null);
      setDraftItem(null);
      toast.success("Oggetto eliminato.");
    } catch (error: any) {
      toast.error(error?.status === 409 ? "L'oggetto è già collegato a inventari personaggio." : "Non sono riuscito a eliminare l'oggetto.");
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Gestione Oggetti</h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">Catalogo delle definizioni oggetto. Qui completiamo categoria, slot, attacchi e metadati prima di legarli agli inventari dei personaggi.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to="/" aria-label="Torna alla home DM">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
              <Shield className="h-4 w-4 text-primary" />
              <span>{items.length}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCreateOpen(true)} aria-label="Aggiungi oggetto">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="character-section space-y-4">
            <div className="space-y-3">
              <TextRow label="Cerca" value={query} onChange={setQuery} placeholder="Nome o slug" />
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutte</SelectItem>
                    {CATEGORY_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="h-[65vh] rounded-2xl border border-border/60 bg-background/45">
              <div className="divide-y divide-border/50">
                {loading ? <div className="px-4 py-4 text-sm text-muted-foreground">Carico oggetti...</div> : filteredItems.length === 0 ? <div className="px-4 py-4 text-sm text-muted-foreground">Nessun oggetto trovato.</div> : filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent/20 ${selectedItemId === item.id ? "bg-accent/20" : ""}`}
                    onClick={() => void openItem(item.id)}
                  >
                    <div className="font-medium text-primary">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.category} / {item.slug}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.playerVisible ? "visibile ai player" : "nascosto ai player"}
                      {item.rarity === "UNIQUE" ? " / unico" : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">slot {item.slotRuleCount} / attacchi {item.attackCount}</div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <Card className="character-section">
            {detailLoading ? (
              <div className="text-sm text-muted-foreground">Carico il dettaglio oggetto...</div>
            ) : !draftItem ? (
              <div className="text-sm text-muted-foreground">Seleziona un oggetto dal catalogo per modificarlo.</div>
            ) : (
              <ScrollArea className="h-[72vh] pr-4">
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-3xl text-primary">{draftItem.name}</h2>
                      <p className="text-sm text-muted-foreground">{draftItem.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => selectedItem && setDraftItem(cloneItem(selectedItem))}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-destructive hover:text-destructive" onClick={() => void deleteItem()}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" className="rounded-full" onClick={() => void saveItem()} disabled={saving}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <section className="grid gap-3 md:grid-cols-2">
                    <TextRow label="Nome" value={draftItem.name} onChange={(value) => setDraftItem({ ...draftItem, name: value })} />
                    <TextRow label="Slug" value={draftItem.slug} onChange={(value) => setDraftItem({ ...draftItem, slug: value })} />
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={draftItem.category} onValueChange={(value) => setDraftItem({ ...draftItem, category: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORY_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rarità</Label>
                      <Select
                        value={draftItem.rarity ?? "__none__"}
                        onValueChange={(value) =>
                          setDraftItem({
                            ...draftItem,
                            rarity: value === "__none__" ? null : value,
                            stackable: value === "UNIQUE" ? false : draftItem.stackable,
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuna</SelectItem>
                          {RARITY_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <TextRow label="Sottocategoria" value={draftItem.subcategory} onChange={(value) => setDraftItem({ ...draftItem, subcategory: value || null })} />
                    <TextRow label="Valore (cp)" value={draftItem.valueCp != null ? String(draftItem.valueCp) : ""} onChange={(value) => setDraftItem({ ...draftItem, valueCp: value ? Number(value) : null })} />
                    <TextRow label="Peso" value={draftItem.weight != null ? String(draftItem.weight) : ""} onChange={(value) => setDraftItem({ ...draftItem, weight: value ? Number(value) : null })} />
                    <div className="space-y-2 md:col-span-2">
                      <Label>Descrizione</Label>
                      <Textarea rows={4} value={draftItem.description ?? ""} onChange={(event) => setDraftItem({ ...draftItem, description: event.target.value || null })} />
                    </div>
                    <div className="flex flex-wrap gap-4 md:col-span-2">
                      <ToggleRow label="Equipaggiabile" checked={draftItem.equippable} onChange={(value) => setDraftItem({ ...draftItem, equippable: value })} />
                      <ToggleRow
                        label="Stackabile"
                        checked={draftItem.stackable}
                        onChange={(value) => setDraftItem({ ...draftItem, stackable: draftItem.rarity === "UNIQUE" ? false : value })}
                      />
                      <ToggleRow label="Richiede attunement" checked={draftItem.attunement} onChange={(value) => setDraftItem({ ...draftItem, attunement: value })} />
                      <ToggleRow label="Visibile ai player" checked={draftItem.playerVisible} onChange={(value) => setDraftItem({ ...draftItem, playerVisible: value })} />
                    </div>
                    {draftItem.rarity === "UNIQUE" ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 md:col-span-2">
                        Gli oggetti UNIQUE non possono avere piu istanze e non vengono trattati come stackabili.
                      </div>
                    ) : null}
                  </section>

                  <section className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Weapon handling</Label>
                      <Select value={draftItem.weaponHandling ?? "__none__"} onValueChange={(value) => setDraftItem({ ...draftItem, weaponHandling: value === "__none__" ? null : value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuno</SelectItem>
                          {WEAPON_HANDLING_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Glove wear mode</Label>
                      <Select value={draftItem.gloveWearMode ?? "__none__"} onValueChange={(value) => setDraftItem({ ...draftItem, gloveWearMode: value === "__none__" ? null : value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuno</SelectItem>
                          {GLOVE_MODE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Armor category</Label>
                      <Select value={draftItem.armorCategory ?? "__none__"} onValueChange={(value) => setDraftItem({ ...draftItem, armorCategory: value === "__none__" ? null : value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuna</SelectItem>
                          {ARMOR_CATEGORY_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Armor calc</Label>
                      <Select value={draftItem.armorClassCalculation ?? "__none__"} onValueChange={(value) => setDraftItem({ ...draftItem, armorClassCalculation: value === "__none__" ? null : value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuna</SelectItem>
                          {ARMOR_CALC_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <TextRow label="CA base" value={draftItem.armorClassBase != null ? String(draftItem.armorClassBase) : ""} onChange={(value) => setDraftItem({ ...draftItem, armorClassBase: value ? Number(value) : null })} />
                    <TextRow label="Bonus CA" value={draftItem.armorClassBonus != null ? String(draftItem.armorClassBonus) : ""} onChange={(value) => setDraftItem({ ...draftItem, armorClassBonus: value ? Number(value) : null })} />
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary">Requisiti caratteristiche</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDraftItem({
                            ...draftItem,
                            abilityRequirements: [
                              ...draftItem.abilityRequirements,
                              { ...newAbilityRequirement(), sortOrder: draftItem.abilityRequirements.length },
                            ],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi requisito
                      </Button>
                    </div>
                    {draftItem.abilityRequirements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
                        Nessun requisito configurato.
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      {draftItem.abilityRequirements.map((entry, index) => (
                        <div key={entry.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background/45 p-3 md:grid-cols-[1fr_150px_44px]">
                          <div className="space-y-2">
                            <Label>Caratteristica</Label>
                            <Select
                              value={entry.ability}
                              onValueChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  abilityRequirements: draftItem.abilityRequirements.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, ability: value } : row
                                  ),
                                })
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ABILITY_SCORE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <TextRow
                            label="Punteggio minimo"
                            value={entry.minScore != null ? String(entry.minScore) : ""}
                            onChange={(value) =>
                              setDraftItem({
                                ...draftItem,
                                abilityRequirements: draftItem.abilityRequirements.map((row, rowIndex) =>
                                  rowIndex === index ? { ...row, minScore: value ? Number(value) : 0 } : row
                                ),
                              })
                            }
                          />
                          <div className="flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="rounded-full"
                              onClick={() =>
                                setDraftItem({
                                  ...draftItem,
                                  abilityRequirements: draftItem.abilityRequirements
                                    .filter((_, rowIndex) => rowIndex !== index)
                                    .map((row, rowIndex) => ({ ...row, sortOrder: rowIndex })),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary">Effetti all'uso</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDraftItem({
                            ...draftItem,
                            useEffects: [
                              ...draftItem.useEffects,
                              { ...newUseEffect(), sortOrder: draftItem.useEffects.length },
                            ],
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi effetto
                      </Button>
                    </div>
                    {draftItem.useEffects.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
                        Nessun effetto all'uso configurato.
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      {draftItem.useEffects.map((entry, index) => (
                        <div key={entry.id} className="space-y-3 rounded-2xl border border-border/60 bg-background/45 p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Tipo effetto</Label>
                              <Select
                                value={entry.effectType}
                                onValueChange={(value) =>
                                  setDraftItem({
                                    ...draftItem,
                                    useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                      rowIndex === index ? { ...row, effectType: value } : row
                                    ),
                                  })
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {USE_EFFECT_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Bersaglio</Label>
                              <Select
                                value={entry.targetType}
                                onValueChange={(value) =>
                                  setDraftItem({
                                    ...draftItem,
                                    useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                      rowIndex === index ? { ...row, targetType: value } : row
                                    ),
                                  })
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {USE_TARGET_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <TextRow
                              label="Dice expression"
                              value={entry.diceExpression}
                              onChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, diceExpression: value || null } : row
                                  ),
                                })
                              }
                            />
                            <TextRow
                              label="Flat value"
                              value={entry.flatValue != null ? String(entry.flatValue) : ""}
                              onChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, flatValue: value ? Number(value) : null } : row
                                  ),
                                })
                              }
                            />
                            <TextRow
                              label="Damage type"
                              value={entry.damageType}
                              onChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, damageType: value || null } : row
                                  ),
                                })
                              }
                            />
                            <div className="space-y-2">
                              <Label>TS caratteristica</Label>
                              <Select
                                value={entry.savingThrowAbility ?? "__none__"}
                                onValueChange={(value) =>
                                  setDraftItem({
                                    ...draftItem,
                                    useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, savingThrowAbility: value === "__none__" ? null : value }
                                        : row
                                    ),
                                  })
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuna</SelectItem>
                                  {ABILITY_SCORE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <TextRow
                              label="TS CD"
                              value={entry.savingThrowDc != null ? String(entry.savingThrowDc) : ""}
                              onChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, savingThrowDc: value ? Number(value) : null } : row
                                  ),
                                })
                              }
                            />
                            <div className="space-y-2">
                              <Label>Esito al successo</Label>
                              <Select
                                value={entry.successOutcome ?? "__none__"}
                                onValueChange={(value) =>
                                  setDraftItem({
                                    ...draftItem,
                                    useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, successOutcome: value === "__none__" ? null : value }
                                        : row
                                    ),
                                  })
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuno</SelectItem>
                                  {USE_SUCCESS_OUTCOME_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <TextRow
                              label="Durata"
                              value={entry.durationText}
                              onChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, durationText: value || null } : row
                                  ),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Note</Label>
                            <Textarea
                              rows={3}
                              value={entry.notes ?? ""}
                              onChange={(event) =>
                                setDraftItem({
                                  ...draftItem,
                                  useEffects: draftItem.useEffects.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, notes: event.target.value || null } : row
                                  ),
                                })
                              }
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setDraftItem({
                                  ...draftItem,
                                  useEffects: draftItem.useEffects
                                    .filter((_, rowIndex) => rowIndex !== index)
                                    .map((row, rowIndex) => ({ ...row, sortOrder: rowIndex })),
                                })
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Rimuovi
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary">Slot rules</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDraftItem({ ...draftItem, slotRules: [...draftItem.slotRules, { ...newSlotRule(), sortOrder: draftItem.slotRules.length }] })}>
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi slot
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {draftItem.slotRules.map((entry, index) => (
                        <div key={entry.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background/45 p-3 md:grid-cols-[1fr_180px_180px_90px_44px]">
                          <TextRow label="Group key" value={entry.groupKey} onChange={(value) => setDraftItem({ ...draftItem, slotRules: draftItem.slotRules.map((row, rowIndex) => rowIndex === index ? { ...row, groupKey: value } : row) })} />
                          <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select value={entry.selectionMode} onValueChange={(value) => setDraftItem({ ...draftItem, slotRules: draftItem.slotRules.map((row, rowIndex) => rowIndex === index ? { ...row, selectionMode: value } : row) })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{SLOT_SELECTION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Slot</Label>
                            <Select value={entry.slot} onValueChange={(value) => setDraftItem({ ...draftItem, slotRules: draftItem.slotRules.map((row, rowIndex) => rowIndex === index ? { ...row, slot: value } : row) })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{SLOT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end pb-2">
                            <ToggleRow label="Required" checked={entry.required} onChange={(value) => setDraftItem({ ...draftItem, slotRules: draftItem.slotRules.map((row, rowIndex) => rowIndex === index ? { ...row, required: value } : row) })} />
                          </div>
                          <div className="flex items-end justify-end">
                            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setDraftItem({ ...draftItem, slotRules: draftItem.slotRules.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, sortOrder: rowIndex })) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-primary">Attacchi</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDraftItem({ ...draftItem, attacks: [...draftItem.attacks, { ...newAttack(), sortOrder: draftItem.attacks.length }] })}>
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi attacco
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {draftItem.attacks.map((entry, index) => (
                        <div key={entry.id} className="grid gap-3 rounded-2xl border border-border/60 bg-background/45 p-3 md:grid-cols-2">
                          <TextRow label="Nome" value={entry.name} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, name: value } : row) })} />
                          <div className="space-y-2">
                            <Label>Kind</Label>
                            <Select value={entry.kind} onValueChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, kind: value } : row) })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{ATTACK_KIND_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Hand requirement</Label>
                            <Select value={entry.handRequirement} onValueChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, handRequirement: value } : row) })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{ATTACK_HAND_REQUIREMENT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Ability</Label>
                            <Select
                              value={entry.ability ?? "__none__"}
                              onValueChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  attacks: draftItem.attacks.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, ability: value === "__none__" ? null : value } : row
                                  ),
                                })
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Predefinita dal tipo</SelectItem>
                                {ATTACK_ABILITY_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option === "FINESSE" ? "FINESSE (Accurata)" : option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <TextRow label="Attack bonus" value={entry.attackBonus != null ? String(entry.attackBonus) : ""} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, attackBonus: value ? Number(value) : null } : row) })} />
                          <TextRow label="Damage dice" value={entry.damageDice} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, damageDice: value || null } : row) })} />
                          <TextRow label="Damage type" value={entry.damageType} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, damageType: value || null } : row) })} />
                          <TextRow label="Range normal" value={entry.rangeNormal != null ? String(entry.rangeNormal) : ""} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, rangeNormal: value ? Number(value) : null } : row) })} />
                          <TextRow label="Range long" value={entry.rangeLong != null ? String(entry.rangeLong) : ""} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, rangeLong: value ? Number(value) : null } : row) })} />
                          <div className="space-y-2 md:col-span-2">
                            <Label>Condition text</Label>
                            <Textarea rows={2} value={entry.conditionText ?? ""} onChange={(event) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, conditionText: event.target.value || null } : row) })} />
                          </div>
                          <div className="flex flex-wrap gap-4 md:col-span-2">
                            <ToggleRow label="Two handed only" checked={entry.twoHandedOnly} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, twoHandedOnly: value } : row) })} />
                            <ToggleRow label="Requires equipped" checked={entry.requiresEquipped} onChange={(value) => setDraftItem({ ...draftItem, attacks: draftItem.attacks.map((row, rowIndex) => rowIndex === index ? { ...row, requiresEquipped: value } : row) })} />
                            <Button type="button" variant="ghost" size="sm" className="ml-auto text-destructive hover:text-destructive" onClick={() => setDraftItem({ ...draftItem, attacks: draftItem.attacks.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, sortOrder: rowIndex })) })}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Rimuovi attacco
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-primary">Modifier</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => setDraftItem({ ...draftItem, modifiers: [...draftItem.modifiers, { ...newModifier(), sortOrder: draftItem.modifiers.length }] })}>
                          <Plus className="mr-2 h-4 w-4" />
                          Aggiungi
                        </Button>
                      </div>
                      {draftItem.modifiers.map((entry, index) => (
                        <div key={entry.id} className="space-y-3 rounded-2xl border border-border/60 bg-background/45 p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Target</Label>
                              <Select value={entry.target} onValueChange={(value) => setDraftItem({ ...draftItem, modifiers: draftItem.modifiers.map((row, rowIndex) => rowIndex === index ? { ...row, target: value } : row) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{MODIFIER_TARGET_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select value={entry.type} onValueChange={(value) => setDraftItem({ ...draftItem, modifiers: draftItem.modifiers.map((row, rowIndex) => rowIndex === index ? { ...row, type: value } : row) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{MODIFIER_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <TextRow label="Value" value={entry.value != null ? String(entry.value) : ""} onChange={(value) => setDraftItem({ ...draftItem, modifiers: draftItem.modifiers.map((row, rowIndex) => rowIndex === index ? { ...row, value: value ? Number(value) : null } : row) })} />
                            <TextRow label="Formula" value={entry.formula} onChange={(value) => setDraftItem({ ...draftItem, modifiers: draftItem.modifiers.map((row, rowIndex) => rowIndex === index ? { ...row, formula: value || null } : row) })} />
                            <div className="space-y-2">
                              <Label>Condition</Label>
                              <Select value={entry.condition} onValueChange={(value) => setDraftItem({ ...draftItem, modifiers: draftItem.modifiers.map((row, rowIndex) => rowIndex === index ? { ...row, condition: value } : row) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{EFFECT_CONDITION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <TextRow label="Stack key" value={entry.stackKey} onChange={(value) => setDraftItem({ ...draftItem, modifiers: draftItem.modifiers.map((row, rowIndex) => rowIndex === index ? { ...row, stackKey: value || null } : row) })} />
                          </div>
                          <div className="flex justify-end">
                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDraftItem({ ...draftItem, modifiers: draftItem.modifiers.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, sortOrder: rowIndex })) })}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Rimuovi
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-primary">Feature</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => setDraftItem({ ...draftItem, features: [...draftItem.features, { ...newFeature(), sortOrder: draftItem.features.length }] })}>
                          <Plus className="mr-2 h-4 w-4" />
                          Aggiungi
                        </Button>
                      </div>
                      {draftItem.features.length === 0 ? <div className="rounded-2xl border border-dashed border-border/60 bg-background/30 px-4 py-4 text-sm text-muted-foreground">Nessuna feature configurata.</div> : null}
                      {draftItem.features.map((entry, index) => (
                        <div key={entry.id} className="space-y-3 rounded-2xl border border-border/60 bg-background/45 p-3">
                          <TextRow label="Nome" value={entry.name} onChange={(value) => setDraftItem({ ...draftItem, features: draftItem.features.map((row, rowIndex) => rowIndex === index ? { ...row, name: value } : row) })} />
                          <div className="space-y-2">
                            <Label>Tipo feature</Label>
                            <Select
                              value={entry.kind ?? "ACTIVE"}
                              onValueChange={(value) =>
                                setDraftItem({
                                  ...draftItem,
                                  features: draftItem.features.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          kind: value,
                                          resetOn: value === "ACTIVE" ? row.resetOn : null,
                                          customResetLabel: value === "ACTIVE" ? row.customResetLabel : null,
                                          maxUses: value === "ACTIVE" ? row.maxUses : null,
                                          passiveEffects: value === "PASSIVE" ? (Array.isArray(row.passiveEffects) ? row.passiveEffects : []) : [],
                                        }
                                      : row
                                  ),
                                })
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FEATURE_KIND_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea rows={3} value={entry.description ?? ""} onChange={(event) => setDraftItem({ ...draftItem, features: draftItem.features.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value || null } : row) })} />
                          </div>
                          {entry.kind === "ACTIVE" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Reset on</Label>
                                <Select value={entry.resetOn ?? "__none__"} onValueChange={(value) => setDraftItem({
                                  ...draftItem,
                                  features: draftItem.features.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          resetOn: value === "__none__" ? null : value,
                                          customResetLabel: value === "CUSTOM" ? row.customResetLabel : null,
                                        }
                                      : row
                                  ),
                                })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Nessuno</SelectItem>
                                    {FEATURE_RESET_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <TextRow label="Max uses" value={entry.maxUses != null ? String(entry.maxUses) : ""} onChange={(value) => setDraftItem({ ...draftItem, features: draftItem.features.map((row, rowIndex) => rowIndex === index ? { ...row, maxUses: value ? Number(value) : null } : row) })} />
                              {entry.resetOn === "CUSTOM" ? (
                                <TextRow label="Custom reset label" value={entry.customResetLabel} onChange={(value) => setDraftItem({ ...draftItem, features: draftItem.features.map((row, rowIndex) => rowIndex === index ? { ...row, customResetLabel: value || null } : row) })} />
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/35 p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-primary">Effetti passivi</div>
                                  <div className="text-xs text-muted-foreground">Bonus modulari applicati quando la feature è attiva.</div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setDraftItem({
                                      ...draftItem,
                                      features: draftItem.features.map((row, rowIndex) =>
                                        rowIndex === index
                                          ? {
                                              ...row,
                                              passiveEffects: [...(Array.isArray(row.passiveEffects) ? row.passiveEffects : []), newPassiveEffect()],
                                            }
                                          : row
                                      ),
                                    })
                                  }
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Aggiungi effetto
                                </Button>
                              </div>

                              {(Array.isArray(entry.passiveEffects) ? entry.passiveEffects : []).length === 0 ? (
                                <div className="text-sm text-muted-foreground">Nessun effetto passivo configurato.</div>
                              ) : null}

                              {(Array.isArray(entry.passiveEffects) ? entry.passiveEffects : []).map((effect, effectIndex) => (
                                <div key={`${entry.id}-effect-${effectIndex}`} className="space-y-3 rounded-2xl border border-border/60 bg-background/45 p-3">
                                  <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-2">
                                      <Label>Bersaglio</Label>
                                      <Select
                                        value={effect.target}
                                        onValueChange={(value) =>
                                          setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, target: value } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {PASSIVE_EFFECT_TARGET_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option}>
                                              {PASSIVE_EFFECT_TARGET_LABELS[option]}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Operazione</Label>
                                      <Select
                                        value={effect.operationType ?? "BONUS"}
                                        onValueChange={(value) =>
                                          setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex
                                                        ? { ...currentEffect, operationType: value }
                                                        : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{PASSIVE_EFFECT_OPERATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Valore</Label>
                                      <Select
                                        disabled={(effect.operationType ?? "BONUS") === "SET"}
                                        value={effect.valueMode ?? "FLAT"}
                                        onValueChange={(value) =>
                                          setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, valueMode: value } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{getAllowedValueModeOptions(effect.target).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Trigger</Label>
                                      <Select
                                        value={effect.trigger}
                                        onValueChange={(value) =>
                                          setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, trigger: value } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{PASSIVE_EFFECT_TRIGGER_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {(effect.operationType ?? "BONUS") !== "SET" && (effect.valueMode === "ABILITY_MODIFIER" || effect.valueMode === "ABILITY_SCORE") ? (
                                    <div className="space-y-2">
                                      <Label>Caratteristica sorgente</Label>
                                      <Select
                                        value={effect.sourceAbility ?? "DEXTERITY"}
                                        onValueChange={(value) =>
                                          setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, sourceAbility: value } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{ABILITY_SCORE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                  ) : null}

                                  {(effect.operationType ?? "BONUS") !== "SET" && (effect.valueMode ?? "FLAT") !== "FLAT" ? (
                                    <div className="grid gap-3 md:grid-cols-3">
                                      <TextRow
                                        label="Rapporto num."
                                        value={String(effect.multiplierNumerator ?? 1)}
                                        onChange={(value) =>
                                          setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, multiplierNumerator: Math.max(1, Number(value || 1)) } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      />
                                      <TextRow
                                        label="Rapporto den."
                                        value={String(effect.multiplierDenominator ?? 1)}
                                        onChange={(value) =>
                                          setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, multiplierDenominator: Math.max(1, Number(value || 1)) } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      />
                                      {(effect.multiplierDenominator ?? 1) !== 1 ? (
                                        <div className="space-y-2">
                                          <Label>Arrotondamento</Label>
                                          <Select
                                            value={effect.rounding ?? "FLOOR"}
                                            onValueChange={(value) =>
                                              setDraftItem({
                                                ...draftItem,
                                                features: draftItem.features.map((row, rowIndex) =>
                                                  rowIndex === index
                                                    ? {
                                                        ...row,
                                                        passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                          currentIndex === effectIndex ? { ...currentEffect, rounding: value } : currentEffect
                                                        ),
                                                      }
                                                    : row
                                                ),
                                              })
                                            }
                                          >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{PASSIVE_EFFECT_ROUNDING_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {(effect.operationType ?? "BONUS") === "SET" ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Modalita set</Label>
                                        <Select
                                          value={effect.setMode ?? "MINIMUM_FLOOR"}
                                          onValueChange={(value) =>
                                            setDraftItem({
                                              ...draftItem,
                                              features: draftItem.features.map((row, rowIndex) =>
                                                rowIndex === index
                                                  ? {
                                                      ...row,
                                                      passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                        currentIndex === effectIndex ? { ...currentEffect, setMode: value } : currentEffect
                                                      ),
                                                    }
                                                  : row
                                              ),
                                            })
                                          }
                                        >
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>{PASSIVE_EFFECT_SET_MODE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </div>
                                      <TextRow
                                        label="Valore impostato"
                                        value={String(effect.setValue ?? "")}
                                        onChange={(value) =>
                                          isEditableSignedInteger(value) && setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, setValue: value } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      />
                                    </div>
                                  ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <TextRow
                                        label={(effect.valueMode ?? "FLAT") === "FLAT" ? "Bonus fisso" : "Offset opzionale"}
                                        value={String(effect.value ?? 0)}
                                        onChange={(value) =>
                                          isEditableSignedInteger(value) && setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex ? { ...currentEffect, value } : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                      />
                                      <TextRow
                                        label="Cap massimo"
                                        value={effect.capValue == null ? "" : String(effect.capValue)}
                                        onChange={(value) =>
                                          isEditableSignedInteger(value) && setDraftItem({
                                            ...draftItem,
                                            features: draftItem.features.map((row, rowIndex) =>
                                              rowIndex === index
                                                ? {
                                                    ...row,
                                                    passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                      currentIndex === effectIndex
                                                        ? { ...currentEffect, capValue: value }
                                                        : currentEffect
                                                    ),
                                                  }
                                                : row
                                            ),
                                          })
                                        }
                                        placeholder="Opzionale"
                                      />
                                    </div>
                                  )}

                                  {effect.target === "CUSTOM" ? (
                                    <TextRow
                                      label="Etichetta bersaglio"
                                      value={effect.customTargetLabel ?? ""}
                                      onChange={(value) =>
                                        setDraftItem({
                                          ...draftItem,
                                          features: draftItem.features.map((row, rowIndex) =>
                                            rowIndex === index
                                              ? {
                                                  ...row,
                                                  passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                    currentIndex === effectIndex ? { ...currentEffect, customTargetLabel: value } : currentEffect
                                                  ),
                                                }
                                              : row
                                          ),
                                        })
                                      }
                                    />
                                  ) : null}

                                  {effect.trigger === "CUSTOM" ? (
                                    <TextRow
                                      label="Etichetta trigger"
                                      value={effect.customTriggerLabel ?? ""}
                                      onChange={(value) =>
                                        setDraftItem({
                                          ...draftItem,
                                          features: draftItem.features.map((row, rowIndex) =>
                                            rowIndex === index
                                              ? {
                                                  ...row,
                                                  passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                    currentIndex === effectIndex ? { ...currentEffect, customTriggerLabel: value } : currentEffect
                                                  ),
                                                }
                                              : row
                                          ),
                                        })
                                      }
                                    />
                                  ) : null}

                                  <div className="space-y-2">
                                    <Label>Note</Label>
                                    <Textarea
                                      rows={2}
                                      value={effect.notes ?? ""}
                                      onChange={(event) =>
                                        setDraftItem({
                                          ...draftItem,
                                          features: draftItem.features.map((row, rowIndex) =>
                                            rowIndex === index
                                              ? {
                                                  ...row,
                                                  passiveEffects: (row.passiveEffects ?? []).map((currentEffect: any, currentIndex: number) =>
                                                    currentIndex === effectIndex ? { ...currentEffect, notes: event.target.value } : currentEffect
                                                  ),
                                                }
                                              : row
                                          ),
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() =>
                                        setDraftItem({
                                          ...draftItem,
                                          features: draftItem.features.map((row, rowIndex) =>
                                            rowIndex === index
                                              ? {
                                                  ...row,
                                                  passiveEffects: (row.passiveEffects ?? []).filter((_: unknown, currentIndex: number) => currentIndex !== effectIndex),
                                                }
                                              : row
                                          ),
                                        })
                                      }
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Rimuovi effetto
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Condition</Label>
                            <Select value={entry.condition} onValueChange={(value) => setDraftItem({ ...draftItem, features: draftItem.features.map((row, rowIndex) => rowIndex === index ? { ...row, condition: value } : row) })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{EFFECT_CONDITION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end">
                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDraftItem({ ...draftItem, features: draftItem.features.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, sortOrder: rowIndex })) })}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Rimuovi
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </ScrollArea>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="[&>button]:hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crea oggetto</DialogTitle>
            <DialogDescription>Crea una nuova definizione oggetto vuota da completare nel catalogo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TextRow label="Nome oggetto" value={newItemName} onChange={setNewItemName} placeholder="Es. Spada lunga" />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => setCreateOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="icon" className="rounded-full" onClick={() => void createItem()} disabled={creating || !newItemName.trim()}>
              <Check className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

