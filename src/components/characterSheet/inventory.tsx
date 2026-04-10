import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Backpack,
  Circle,
  Check,
  Crosshair,
  Feather,
  FlaskConical,
  Gem,
  Hammer,
  Hand,
  Pencil,
  Package,
  Plus,
  Repeat,
  ScrollText,
  Shield,
  ShieldOff,
  Sparkles,
  Swords,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SectionCard from "@/components/characterSheet/section-card";
import {
  fetchItemDefinition,
  type EquipResolutionDetails,
  type EquipResolutionOption,
  type ItemDefinitionEntry,
} from "@/lib/auth";

/** Select minimale, senza dipendenze extra */
function Select({
  value,
  onChange,
  children,
  id,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border rounded-md px-3 py-2 text-sm bg-background ${className}`}
    >
      {children}
    </select>
  );
  /*
    const detail = selectedCatalogItemDetail;
    const summary = selectedCatalogItem;
    if (!summary) return null;

    return (
      <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
        <div>
          <div className="font-medium text-primary">{summary.name}</div>
          {summary.description ? (
            <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{summary.description}</div>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {renderRarityBadge(summary.rarity)}
            {renderMetaIcons(buildCatalogMetaIcons(summary, detail))}
          </div>
        </div>

        {!!detail?.attacks?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
            {detail.attacks.map((attack) => (
              <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{attack.name}</div>
                {renderMetaIcons(buildAttackMetaIcons(attack))}
                <div className="text-muted-foreground">
                  {[
                    attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                    [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                    attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                  ].filter(Boolean).join(" - ")}
                </div>
                {attack.conditionText ? <div className="mt-1 text-muted-foreground">{attack.conditionText}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.features?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature</div>
            {detail.features.map((feature) => (
              <div key={feature.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{feature.name}</div>
                <div className="text-muted-foreground">
                  {[getFeatureResetLabel(feature), feature.maxUses != null ? `${feature.maxUses} usi` : ""].filter(Boolean).join(" - ")}
                </div>
                {feature.description ? <div className="mt-1 text-muted-foreground">{feature.description}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.useEffects?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effetti all'uso</div>
            {detail.useEffects.map((effect) => (
              <div key={effect.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
                {[
                  getUseEffectTypeLabel(effect.effectType),
                  effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : ""),
                  effect.damageType ?? "",
                  effect.savingThrowAbility && effect.savingThrowDc != null ? `TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}` : "",
                  effect.successOutcome ? getSuccessOutcomeLabel(effect.successOutcome) : "",
                ].filter(Boolean).join(" - ")}
                {effect.notes ? <div className="mt-1">{effect.notes}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.abilityRequirements?.length && (
          <div className="text-xs text-muted-foreground">
            Requisiti: {detail.abilityRequirements.map((req) => `${req.ability} ${req.minScore}+`).join(", ")}
          </div>
        )}
      </div>
    );
  */
}

/* const unusedTopLevelCatalogPreview = () => {
    const detail = selectedCatalogItemDetail;
    const summary = selectedCatalogItem;
    if (!summary) return null;

    return (
      <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
        <div>
          <div className="font-medium text-primary">{summary.name}</div>
          {summary.description ? (
            <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{summary.description}</div>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {renderRarityBadge(summary.rarity)}
            {renderMetaIcons(buildCatalogMetaIcons(summary, detail))}
          </div>
        </div>

        {!!detail?.attacks?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
            {detail.attacks.map((attack) => (
              <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{attack.name}</div>
                {renderMetaIcons(buildAttackMetaIcons(attack))}
                <div className="text-muted-foreground">
                  {[
                    attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                    [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                    attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                  ].filter(Boolean).join(" - ")}
                </div>
                {attack.conditionText ? <div className="mt-1 text-muted-foreground">{attack.conditionText}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.features?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature</div>
            {detail.features.map((feature) => (
              <div key={feature.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{feature.name}</div>
                <div className="text-muted-foreground">
                  {[getFeatureResetLabel(feature), feature.maxUses != null ? `${feature.maxUses} usi` : ""].filter(Boolean).join(" - ")}
                </div>
                {feature.description ? <div className="mt-1 text-muted-foreground">{feature.description}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.useEffects?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effetti all'uso</div>
            {detail.useEffects.map((effect) => (
              <div key={effect.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
                {[
                  getUseEffectTypeLabel(effect.effectType),
                  effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : ""),
                  effect.damageType ?? "",
                  effect.savingThrowAbility && effect.savingThrowDc != null ? `TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}` : "",
                  effect.successOutcome ? getSuccessOutcomeLabel(effect.successOutcome) : "",
                ].filter(Boolean).join(" - ")}
                {effect.notes ? <div className="mt-1">{effect.notes}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.abilityRequirements?.length && (
          <div className="text-xs text-muted-foreground">
            Requisiti: {detail.abilityRequirements.map((req) => `${req.ability} ${req.minScore}+`).join(", ")}
          </div>
        )}
      </div>
    );
  };

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border rounded-md px-3 py-2 text-sm bg-background ${className}`}
    >
      {children}
    </select>
  );
}

*/
/** parser retro-compatibilita: "1d8+3 tagliente" -> { dice, type } */
function parseLegacyDamage(s: string | undefined): { dice?: string; type?: string } {
  const src = (s ?? "").trim();
  if (!src) return {};
  const m = src.match(/^\s*([^\s]+)\s+(tagliente|perforante|contundente)\s*$/i);
  if (m) return { dice: m[1], type: m[2].toLowerCase() };
  return { dice: src };
}

const EQUIPMENT_SLOT_LABELS: Record<string, string> = {
  HEAD: "Testa",
  BACK: "Schiena",
  ARMOR: "Armatura",
  GLOVE_LEFT: "Guanto sinistro",
  GLOVE_RIGHT: "Guanto destro",
  RING_1: "Anello",
  RING_2: "Anello",
  RING_3: "Anello",
  RING_4: "Anello",
  RING_5: "Anello",
  RING_6: "Anello",
  RING_7: "Anello",
  RING_8: "Anello",
  RING_9: "Anello",
  RING_10: "Anello",
  NECK: "Collana",
  FEET: "Scarpe",
  WEAPON_HAND_LEFT: "Mano sinistra",
  WEAPON_HAND_RIGHT: "Mano destra",
};

function formatEquipOptionLabel(option: EquipResolutionOption) {
  const slots = option.slots.map((slot) => EQUIPMENT_SLOT_LABELS[slot] ?? slot);
  if (option.selectionMode === "ANY_ONE" && slots.length === 1) return slots[0];
  return slots.join(" + ");
}

type InventoryTarget =
  | { kind: "weapon"; index: number }
  | { kind: "object"; index: number }
  | { kind: "consumable"; index: number }
  | { kind: "legacyObject"; index: number }
  | { kind: "relationalWeapon"; id: string }
  | { kind: "relationalObject"; id: string }
  | { kind: "relationalConsumable"; id: string };

const Inventory = ({
  coins,
  coinActionsEnabled = true,
  characterData,
  setMode,
  setCoinFlow,
  setInvOpen,
  invOpen,
  mode,
  coinType,
  setCoinType,
  coinQty,
  setCoinQty,
  coinFlow,
  coinCounterpartyName,
  setCoinCounterpartyName,
  coinReason,
  setCoinReason,
  coinPurchaseDescription,
  setCoinPurchaseDescription,
  coinNote,
  setCoinNote,
  coinTransferTargetSlug,
  setCoinTransferTargetSlug,
  coinSubmitting,
  handleCurrencySubmit,
  handleInventorySubmit,
  resetInvForm,
  itemName,
  setItemName,
  itemAtkBonus,
  setItemAtkBonus,
  itemDmgType,
  setItemDmgType,
  /** --- nuove props per skills categorizzate --- */
  itemSkill,                 // legacy
  setItemSkill,              // legacy
  itemSkillType,             // "volonta" | "incontro" | "riposoBreve" | "riposoLungo"
  setItemSkillType,
  itemSkillInput,
  setItemSkillInput,
  itemSkillsByType,
  setItemSkillsByType,
  /** --- fine nuove props --- */
  invError,
  removeAttack,
  toggleEquipAttack,

  // opzionali per i nuovi tipi (oggetti/consumabili già gestiti)
  itemDescription,
  setItemDescription,
  itemQuantity,
  setItemQuantity,
  itemConsumableSubtype,
  setItemConsumableSubtype,
  itemKind,
  setItemKind,
  potionDice,
  setPotionDice,

  // ===== NEW: per oggetto equipaggiabile =====
  itemEquippable,
  setItemEquippable,

  // handler opzionali per elenco strutturato
  removeStructuredItem,                 // (index: number) => void
  bumpConsumableQuantity,               // (index: number, delta: number) => void
  toggleEquipItem,                      // (index: number) => void   // NEW opzionale
  relationalInventoryItems,
  itemDefinitions,
  assignRelationalInventoryItem,
  toggleEquipRelationalItem,
  decrementRelationalConsumable,
  incrementRelationalConsumable,
  transferTargets,
  transferRelationalInventoryItem,
}: any) => {
  const COIN_KEYS = {
    mr: "cp",
    ma: "sp",
    me: "ep",
    mo: "gp",
  } as const;
  type CoinAbbr = keyof typeof COIN_KEYS;
  const isCoinTransfer = mode === "coins" && coinFlow === "transfer";
  const COIN_META: Record<
    CoinAbbr,
    {
      label: string;
      shortLabel: string;
      key: keyof typeof coins;
      swatchClass: string;
      ringClass: string;
      textClass: string;
    }
  > = {
    mr: {
      label: "Rame",
      shortLabel: "MR",
      key: "cp",
      swatchClass: "bg-gradient-to-br from-amber-500 to-amber-800",
      ringClass: "ring-amber-900/30",
      textClass: "text-amber-900",
    },
    ma: {
      label: "Argento",
      shortLabel: "MA",
      key: "sp",
      swatchClass: "bg-gradient-to-br from-slate-100 to-slate-400",
      ringClass: "ring-slate-500/30",
      textClass: "text-slate-700",
    },
    me: {
      label: "Electrum",
      shortLabel: "ME",
      key: "ep",
      swatchClass: "bg-gradient-to-br from-emerald-200 to-teal-500",
      ringClass: "ring-teal-600/30",
      textClass: "text-teal-700",
    },
    mo: {
      label: "Oro",
      shortLabel: "MO",
      key: "gp",
      swatchClass: "bg-gradient-to-br from-yellow-200 to-yellow-500",
      ringClass: "ring-yellow-600/30",
      textClass: "text-yellow-700",
    },
  };
  const COIN_ORDER: CoinAbbr[] = ["mo", "me", "ma", "mr"];
  const coinPrimaryLabel =
    coinFlow === "add"
      ? "Da chi / da dove"
      : coinFlow === "remove"
        ? "A chi"
        : "Destinatario PG";
  const coinPrimaryPlaceholder =
    coinFlow === "add"
      ? "Es. Ricompensa del duca, bottino goblin, Oste Pinco Pallino"
      : "Es. Oste Pinco Pallino, guardia al ponte";
  const coinReasonPlaceholder =
    coinFlow === "add"
      ? "Es. Ricompensa, bottino, vendita"
      : coinFlow === "remove"
        ? "Es. Pernottamento, pedaggio, acquisto"
        : "Es. Prestito, divisione bottino";
  const coinDetailLabel =
    coinFlow === "remove"
      ? "Cosa sta comprando"
      : coinFlow === "add"
        ? "Origine / dettaglio"
        : "Dettaglio";
  const coinDetailPlaceholder =
    coinFlow === "remove"
      ? "Campo opzionale"
      : coinFlow === "add"
        ? "Es. Taglia sui briganti, borsa trovata nel covo"
        : "Es. Quota per le provviste";

  // === mapping categorie ===
  const SKILL_TYPES = ["volonta", "incontro", "riposoBreve", "riposoLungo"] as const;
  type SkillType = typeof SKILL_TYPES[number];
  const LABELS: Record<SkillType, string> = {
    volonta: "Volontà",
    incontro: "Incontro",
    riposoBreve: "Riposo Breve",
    riposoLungo: "Riposo Lungo",
  };

  // gestione locale del "kind" (weapon|object|consumable)
  const [fallbackKind, setFallbackKind] = useState<"weapon" | "object" | "consumable">("weapon");
  const kind: "weapon" | "object" | "consumable" = itemKind ?? fallbackKind;
  const setKind = setItemKind ?? setFallbackKind;

  // ---- Stati locali aggiuntivi per le ARMI ----
  const [weaponCategory, setWeaponCategory] = useState<"melee" | "ranged">("melee"); // Miscia/Distanza
  const [weaponHands, setWeaponHands] = useState<"1" | "2" | "versatile">("1");       // solo mischia
  const [weaponRange, setWeaponRange] = useState<string>("");                         // solo distanza, es. 80/320
  const [damageKind, setDamageKind] = useState<"tagliente" | "perforante" | "contundente">("tagliente");
  // NB: itemDmgType rimane il "dado" (es. 1d8+3). I nuovi metadati li passiamo nel payload.

  // ---- Stati locali per oggetti/consumabili ----
  const [fallbackSubtype, setFallbackSubtype] = useState<"generic" | "potion">("generic");
  const consumableSubtype: "generic" | "potion" = itemConsumableSubtype ?? fallbackSubtype;
  const setConsumableSubtype = setItemConsumableSubtype ?? setFallbackSubtype;

  const [fallbackDescription, setFallbackDescription] = useState<string>("");
  const descriptionVal: string = (itemDescription ?? fallbackDescription);
  const setDescription = setItemDescription ?? setFallbackDescription;

  const [fallbackQuantity, setFallbackQuantity] = useState<string>("");
  const quantityVal: string = (itemQuantity ?? fallbackQuantity);
  const setQuantity = setItemQuantity ?? setFallbackQuantity;

  const [fallbackPotionDice, setFallbackPotionDice] = useState<string>("");
  const potionDiceVal: string = (potionDice ?? fallbackPotionDice);
  const setPotionDiceVal = setPotionDice ?? setFallbackPotionDice;

  // NEW: stato locale equipaggiabile (se parent non lo gestisce)
  const [fallbackEquippable, setFallbackEquippable] = useState<boolean>(false);
  const equippableVal: boolean = (typeof itemEquippable === "boolean" ? itemEquippable : fallbackEquippable);
  const setEquippable = (setItemEquippable ?? setFallbackEquippable);
  const lastOpenTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogMode, setCatalogMode] = useState<"catalog" | "custom">("catalog");
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState("");
  const [selectedCatalogItemDetail, setSelectedCatalogItemDetail] = useState<ItemDefinitionEntry | null>(null);
  const [assignQuantity, setAssignQuantity] = useState("1");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assigningItem, setAssigningItem] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemDescription, setCustomItemDescription] = useState("");
  const [customObjectCategory, setCustomObjectCategory] = useState("OTHER");
  const [customEquippable, setCustomEquippable] = useState(false);
  const [customStackable, setCustomStackable] = useState(false);
  const [customWeaponHandling, setCustomWeaponHandling] = useState("ONE_HANDED");
  const [customAttackKind, setCustomAttackKind] = useState("MELEE_WEAPON");
  const [customAttackBonus, setCustomAttackBonus] = useState("");
  const [customDamageDice, setCustomDamageDice] = useState("");
  const [customVersatileDamageDice, setCustomVersatileDamageDice] = useState("");
  const [customDamageType, setCustomDamageType] = useState("tagliente");
  const [customRangeNormal, setCustomRangeNormal] = useState("");
  const [customRangeLong, setCustomRangeLong] = useState("");
  const [customConsumableCategory, setCustomConsumableCategory] = useState("CONSUMABLE");
  const [customEffectType, setCustomEffectType] = useState("");
  const [customEffectDice, setCustomEffectDice] = useState("");
  const [customEffectDamageType, setCustomEffectDamageType] = useState("");
  const [customEffectSaveAbility, setCustomEffectSaveAbility] = useState("");
  const [customEffectSaveDc, setCustomEffectSaveDc] = useState("");
  const [customEffectSuccessOutcome, setCustomEffectSuccessOutcome] = useState("");
  const [customEffectNotes, setCustomEffectNotes] = useState("");
  const [detailTarget, setDetailTarget] = useState<InventoryTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDefinition, setDetailDefinition] = useState<ItemDefinitionEntry | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetSlug, setTransferTargetSlug] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [transferError, setTransferError] = useState("");
  const [transferringItem, setTransferringItem] = useState(false);
  const [equipResolutionOpen, setEquipResolutionOpen] = useState(false);
  const [equipResolutionItemId, setEquipResolutionItemId] = useState<string>("");
  const [equipResolutionItemName, setEquipResolutionItemName] = useState("");
  const [equipResolutionMode, setEquipResolutionMode] = useState<"choice" | "swap">("choice");
  const [equipResolutionOptions, setEquipResolutionOptions] = useState<EquipResolutionOption[]>([]);
  const [equipResolutionSelectedOptionId, setEquipResolutionSelectedOptionId] = useState("");
  const [equipResolutionError, setEquipResolutionError] = useState("");
  const [editingTarget, setEditingTarget] = useState<InventoryTarget | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // === helpers per skills ===
  const addSkillToCurrentType = (raw: string) => {
    const s = (raw ?? "").trim();
    if (!s) return;
    const t = itemSkillType as SkillType;
    const list = (itemSkillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;
    const exists = list.some((e) => e.name.toLowerCase() === s.toLowerCase());
    if (exists) {
      setItemSkillInput("");
      return;
    }
    const nextList = [...list, { name: s, used: false }];
    setItemSkillsByType({ ...itemSkillsByType, [t]: nextList });
    setItemSkillInput("");
  };

  const removeSkillFromType = (t: SkillType, idx: number) => {
    const list = (itemSkillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;
    const nextList = list.filter((_, i) => i !== idx);
    setItemSkillsByType({ ...itemSkillsByType, [t]: nextList });
  };

  const renderSkillsChips = (skillsByType?: Record<SkillType, { name: string; used: boolean }[]>) => {
    if (!skillsByType) return null;
    const blocks = SKILL_TYPES.map((t) => {
      const arr = (skillsByType?.[t] ?? []);
      if (!arr.length) return null;
      return (
        <div key={`disp-${t}`} className="mt-1">
          <div className="text-xs font-medium text-muted-foreground">{LABELS[t]}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {arr.map((s, idx) => (
              <div key={`${t}-${idx}`} className="px-2 py-1 rounded bg-muted text-xs">
                <span className="italic">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    });
    return <div className="mt-2 space-y-2">{blocks}</div>;
  };

  const formType = mode === "coins" ? "coins" : `item-${kind}`;
  const emptySkillsByType = {
    volonta: [],
    incontro: [],
    riposoBreve: [],
    riposoLungo: [],
  };

  // items strutturati (se presenti) — per oggetti/consumabili
  const structuredItems = characterData?.equipment?.items as
    | Array<
      | { type: "object"; name: string; description?: string; equippable?: boolean; equipped?: boolean; skillsByType?: Record<SkillType, { name: string; used: boolean }[]>; }
      | { type: "consumable"; name: string; quantity: number; subtype?: "generic" | "potion"; dice?: string; skillsByType?: Record<SkillType, { name: string; used: boolean }[]>; }
    >
    | undefined;
  const relationalItems = Array.isArray(relationalInventoryItems) ? relationalInventoryItems : [];
  const relationalWeapons = relationalItems.filter((item) => item?.itemCategory === "WEAPON" && !item?.isEquipped);
  const relationalConsumables = relationalItems.filter((item) =>
    item?.itemCategory === "CONSUMABLE" || item?.itemCategory === "AMMUNITION"
  );
  const relationalObjects = relationalItems.filter((item) =>
    !item?.isEquipped && !["WEAPON", "CONSUMABLE", "AMMUNITION"].includes(String(item?.itemCategory ?? ""))
  );
  const catalogItems = Array.isArray(itemDefinitions) ? itemDefinitions : [];

  type MetaIconSpec = {
    key: string;
    label: string;
    Icon: any;
    text?: string;
  };

  const renderRarityBadge = (rarity: string | null | undefined) => {
    if (!rarity) return null;
    return (
      <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {rarity.replaceAll("_", " ")}
      </span>
    );
  };

  const renderMetaIcons = (specs: MetaIconSpec[]) => {
    const visible = specs.filter(Boolean);
    if (!visible.length) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {visible.map(({ key, label, Icon, text }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <span className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border border-border/70 bg-background/60 px-2 text-[11px] font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {text ? <span className="leading-none">{text}</span> : null}
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  };

  const renderCompactMetaChips = (chips: string[]) => {
    const visible = chips.filter(Boolean);
    if (!visible.length) return null;

    const iconSpecs: MetaIconSpec[] = [];
    const textBadges: string[] = [];

    visible.forEach((chip) => {
      switch (chip) {
        case "stack":
          iconSpecs.push({
            key: `meta-${chip}`,
            label: "Oggetto accumulabile nello stesso stack",
            Icon: Package,
            text: "+",
          });
          break;
        case "1 mano":
          iconSpecs.push({ key: "meta-one-hand", label: "Uso a una mano", Icon: Hand, text: "1" });
          break;
        case "2 mani":
          iconSpecs.push({ key: "meta-two-hand", label: "Uso a due mani", Icon: Hand, text: "2" });
          break;
        case "versatile":
          iconSpecs.push({ key: "meta-versatile", label: "Uso versatile", Icon: Repeat });
          break;
        case "LIGHT":
        case "MEDIUM":
        case "HEAVY":
        case "SHIELD": {
          const armorSpec = getArmorCategoryMetaIcon(chip);
          if (armorSpec) iconSpecs.push(armorSpec);
          break;
        }
        case "SINGLE":
        case "PAIR": {
          const gloveSpec = getGloveModeMetaIcon(chip);
          if (gloveSpec) iconSpecs.push(gloveSpec);
          break;
        }
        default:
          if (/^qty\s+/i.test(chip)) {
            iconSpecs.push({
              key: `meta-${chip}`,
              label: `Quantita nello stack: ${chip.replace(/^qty\s+/i, "")}`,
              Icon: Package,
              text: chip.replace(/^qty\s+/i, ""),
            });
          } else if (["COMMON", "UNCOMMON", "RARE", "VERY_RARE", "LEGENDARY", "ARTIFACT", "UNIQUE"].includes(chip)) {
            textBadges.push(chip.replaceAll("_", " "));
          } else {
            const categorySpec = getCategoryMetaIcon(chip);
            if (categorySpec && chip === String(chip).toUpperCase()) {
              iconSpecs.push(categorySpec);
            } else {
              textBadges.push(chip);
            }
          }
      }
    });

    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {textBadges.map((badge) => (
          <span key={badge} className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        ))}
        {renderMetaIcons(iconSpecs)}
      </div>
    );
  };

  const getCategoryMetaIcon = (category: string | null | undefined): MetaIconSpec | null => {
    switch (String(category ?? "").toUpperCase()) {
      case "WEAPON":
        return { key: "category-weapon", label: "Arma", Icon: Swords };
      case "ARMOR":
        return { key: "category-armor", label: "Armatura", Icon: Shield };
      case "SHIELD":
        return { key: "category-shield", label: "Scudo", Icon: Shield };
      case "WONDROUS_ITEM":
        return { key: "category-wondrous", label: "Oggetto meraviglioso", Icon: Sparkles };
      case "RING":
        return { key: "category-ring", label: "Anello", Icon: Circle };
      case "AMULET":
        return { key: "category-amulet", label: "Amuleto o collana", Icon: Gem };
      case "ROD":
        return { key: "category-rod", label: "Verga", Icon: WandSparkles };
      case "STAFF":
        return { key: "category-staff", label: "Bastone", Icon: WandSparkles };
      case "WAND":
        return { key: "category-wand", label: "Bacchetta", Icon: WandSparkles };
      case "TOOL":
        return { key: "category-tool", label: "Strumento", Icon: Hammer };
      case "CONSUMABLE":
        return { key: "category-consumable", label: "Consumabile", Icon: FlaskConical };
      case "AMMUNITION":
        return { key: "category-ammunition", label: "Munizione", Icon: Crosshair };
      case "GEAR":
        return { key: "category-gear", label: "Equipaggiamento", Icon: Backpack };
      case "QUEST":
        return { key: "category-quest", label: "Oggetto di trama o missione", Icon: ScrollText };
      default:
        return { key: `category-${String(category ?? "other").toLowerCase()}`, label: "Oggetto generico", Icon: Package };
    }
  };

  const getWeaponHandlingMetaIcon = (weaponHandling: string | null | undefined): MetaIconSpec | null => {
    switch (weaponHandling) {
      case "ONE_HANDED":
        return { key: "handling-one-handed", label: "Impugnatura a una mano", Icon: Hand, text: "1" };
      case "TWO_HANDED":
        return { key: "handling-two-handed", label: "Impugnatura a due mani", Icon: Hand, text: "2" };
      case "VERSATILE":
        return { key: "handling-versatile", label: "Arma versatile: una o due mani", Icon: Repeat };
      default:
        return null;
    }
  };

  const getArmorCategoryMetaIcon = (armorCategory: string | null | undefined): MetaIconSpec | null => {
    switch (armorCategory) {
      case "LIGHT":
        return { key: "armor-light", label: "Armatura leggera", Icon: Feather };
      case "MEDIUM":
        return { key: "armor-medium", label: "Armatura media", Icon: Shield, text: "M" };
      case "HEAVY":
        return { key: "armor-heavy", label: "Armatura pesante", Icon: Shield, text: "H" };
      case "SHIELD":
        return { key: "armor-shield", label: "Scudo", Icon: Shield, text: "+" };
      default:
        return null;
    }
  };

  const getGloveModeMetaIcon = (gloveWearMode: string | null | undefined): MetaIconSpec | null => {
    switch (gloveWearMode) {
      case "SINGLE":
        return { key: "glove-single", label: "Guanto singolo", Icon: Hand, text: "1" };
      case "PAIR":
        return { key: "glove-pair", label: "Paio di guanti", Icon: Hand, text: "2" };
      default:
        return null;
    }
  };

  const getAttackKindMetaIcon = (attackKind: string | null | undefined): MetaIconSpec | null => {
    switch (attackKind) {
      case "MELEE_WEAPON":
        return { key: "attack-melee", label: "Attacco in mischia", Icon: Swords };
      case "RANGED_WEAPON":
        return { key: "attack-ranged", label: "Attacco a distanza", Icon: Crosshair };
      case "THROWN":
        return { key: "attack-thrown", label: "Attacco da lancio", Icon: Repeat };
      case "SPECIAL":
        return { key: "attack-special", label: "Attacco speciale", Icon: Sparkles };
      default:
        return null;
    }
  };

  const getHandRequirementMetaIcon = (handRequirement: string | null | undefined): MetaIconSpec | null => {
    switch (handRequirement) {
      case "ONE_HANDED":
        return { key: "hand-one", label: "Usabile a una mano", Icon: Hand, text: "1" };
      case "TWO_HANDED":
        return { key: "hand-two", label: "Usabile a due mani", Icon: Hand, text: "2" };
      default:
        return null;
    }
  };

  const buildCatalogMetaIcons = (summary: any, detail: ItemDefinitionEntry | null) => {
    return [
      getCategoryMetaIcon(summary?.category),
      summary?.stackable ? { key: "stackable", label: "Oggetto accumulabile nello stesso stack", Icon: Package, text: "+" } : null,
      getWeaponHandlingMetaIcon(detail?.weaponHandling),
      getArmorCategoryMetaIcon(detail?.armorCategory),
      getGloveModeMetaIcon(detail?.gloveWearMode),
    ].filter(Boolean) as MetaIconSpec[];
  };

  const buildAttackMetaIcons = (attack: any) => {
    return [
      getAttackKindMetaIcon(attack?.kind),
      getHandRequirementMetaIcon(attack?.handRequirement),
    ].filter(Boolean) as MetaIconSpec[];
  };

  const buildRelationalItemMetaIcons = (item: any) => {
    return [
      getCategoryMetaIcon(item?.itemCategory),
      item?.stackable ? { key: `qty-${item.id}`, label: `Quantita nello stack: ${item.quantity}`, Icon: Package, text: String(item.quantity) } : null,
    ].filter(Boolean) as MetaIconSpec[];
  };

  const getCategoryLabel = (category: string | null | undefined) => {
    switch (String(category ?? "").toUpperCase()) {
      case "WEAPON":
        return "Arma";
      case "ARMOR":
        return "Armatura";
      case "SHIELD":
        return "Scudo";
      case "WONDROUS_ITEM":
        return "Oggetto meraviglioso";
      case "RING":
        return "Anello";
      case "AMULET":
        return "Amuleto";
      case "ROD":
        return "Verga";
      case "STAFF":
        return "Bastone";
      case "WAND":
        return "Bacchetta";
      case "TOOL":
        return "Strumento";
      case "CONSUMABLE":
        return "Consumabile";
      case "AMMUNITION":
        return "Munizione";
      case "GEAR":
        return "Equipaggiamento";
      case "QUEST":
        return "Oggetto di trama";
      case "OTHER":
        return "Altro";
      default:
        return category ?? "Altro";
    }
  };

  const getWeaponHandlingLabel = (weaponHandling: string | null | undefined) => {
    switch (weaponHandling) {
      case "ONE_HANDED":
        return "A una mano";
      case "TWO_HANDED":
        return "A due mani";
      case "VERSATILE":
        return "Versatile";
      default:
        return null;
    }
  };

  const getArmorCategoryLabel = (armorCategory: string | null | undefined) => {
    switch (armorCategory) {
      case "LIGHT":
        return "Armatura leggera";
      case "MEDIUM":
        return "Armatura media";
      case "HEAVY":
        return "Armatura pesante";
      case "SHIELD":
        return "Scudo";
      default:
        return null;
    }
  };

  const getGloveModeLabel = (gloveWearMode: string | null | undefined) => {
    switch (gloveWearMode) {
      case "SINGLE":
        return "Guanto singolo";
      case "PAIR":
        return "Paio di guanti";
      default:
        return null;
    }
  };

  const getAttackKindLabel = (attackKind: string | null | undefined) => {
    switch (attackKind) {
      case "MELEE_WEAPON":
        return "Mischia";
      case "RANGED_WEAPON":
        return "Distanza";
      case "THROWN":
        return "Lancio";
      case "SPECIAL":
        return "Speciale";
      default:
        return attackKind ?? null;
    }
  };

  const getHandRequirementLabel = (handRequirement: string | null | undefined) => {
    switch (handRequirement) {
      case "ONE_HANDED":
        return "Una mano";
      case "TWO_HANDED":
        return "Due mani";
      case "ANY":
        return "Qualsiasi impugnatura";
      default:
        return null;
    }
  };

  const getAbilityLabel = (ability: string | null | undefined) => {
    switch (ability) {
      case "STRENGTH":
        return "Forza";
      case "DEXTERITY":
        return "Destrezza";
      case "CONSTITUTION":
        return "Costituzione";
      case "INTELLIGENCE":
        return "Intelligenza";
      case "WISDOM":
        return "Saggezza";
      case "CHARISMA":
        return "Carisma";
      default:
        return ability ?? null;
    }
  };

  const getUseEffectTypeLabel = (effectType: string | null | undefined) => {
    switch (effectType) {
      case "HEAL":
        return "Cura";
      case "DAMAGE":
        return "Danno";
      case "TEMP_HP":
        return "Punti ferita temporanei";
      case "APPLY_CONDITION":
        return "Applica condizione";
      case "REMOVE_CONDITION":
        return "Rimuove condizione";
      case "RESTORE_RESOURCE":
        return "Recupero risorsa";
      case "CUSTOM":
        return "Effetto speciale";
      default:
        return effectType ?? null;
    }
  };

  const getSuccessOutcomeLabel = (successOutcome: string | null | undefined) => {
    switch (successOutcome) {
      case "NONE":
        return "Nessun effetto al successo";
      case "HALF":
        return "Effetto dimezzato al successo";
      case "NEGATES":
        return "Nessun effetto con successo";
      case "CUSTOM":
        return "Effetto personalizzato al successo";
      default:
        return successOutcome ?? null;
    }
  };

  const capitalizeLabel = (value: string | null | undefined) => {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const getUseEffectSummaryParts = (effect: any) => {
    const amount = effect?.diceExpression ?? (effect?.flatValue != null ? String(effect.flatValue) : "");
    const damageType = capitalizeLabel(effect?.damageType ?? "");
    let headline = "";

    if (effect?.effectType === "DAMAGE") {
      headline = [amount, damageType].filter(Boolean).join(" ");
    } else if (effect?.effectType === "HEAL") {
      headline = ["Cura", amount].filter(Boolean).join(" ");
    } else if (effect?.effectType === "TEMP_HP") {
      headline = ["Punti ferita temporanei", amount].filter(Boolean).join(": ");
    } else {
      headline = [getUseEffectTypeLabel(effect?.effectType), amount, damageType].filter(Boolean).join(" ");
    }

    return [
      headline,
      effect?.savingThrowAbility && effect?.savingThrowDc != null
        ? `Tiro salvezza su ${getAbilityLabel(effect.savingThrowAbility)} CD ${effect.savingThrowDc}`
        : "",
      effect?.successOutcome ? getSuccessOutcomeLabel(effect.successOutcome) : "",
    ].filter(Boolean);
  };

  const getFeatureResetLabel = (feature: any) => {
    if (!feature?.resetOn) return null;
    if (feature.resetOn === "CUSTOM") return feature.customResetLabel ?? "Reset personalizzato";
    switch (feature.resetOn) {
      case "AT_WILL":
        return "A volontà";
      case "ENCOUNTER":
        return "A incontro";
      case "SHORT_REST":
        return "Riposo breve";
      case "LONG_REST":
        return "Riposo lungo";
      case "DAILY":
        return "Giornaliera";
      default:
        return feature.resetOn;
    }
  };

  const renderCatalogItemPreview = () => {
    const detail = selectedCatalogItemDetail;
    const summary = selectedCatalogItem;
    if (!summary) return null;

    return (
      <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
        <div>
          <div className="font-medium text-primary">{summary.name}</div>
          {summary.description ? (
            <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{summary.description}</div>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {renderRarityBadge(summary.rarity)}
            {renderMetaIcons(buildCatalogMetaIcons(summary, detail))}
          </div>
        </div>

        {!!detail?.attacks?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
            {detail.attacks.map((attack) => (
              <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{attack.name}</div>
                <div className="text-muted-foreground">
                  {[
                    attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                    [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                    attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                  ].filter(Boolean).join(" - ")}
                </div>
                {attack.conditionText ? <div className="mt-1 text-muted-foreground">{attack.conditionText}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.features?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature</div>
            {detail.features.map((feature) => (
              <div key={feature.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{feature.name}</div>
                <div className="text-muted-foreground">
                  {[getFeatureResetLabel(feature), feature.maxUses != null ? `${feature.maxUses} usi` : ""].filter(Boolean).join(" - ")}
                </div>
                {feature.description ? <div className="mt-1 text-muted-foreground">{feature.description}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.useEffects?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effetti all'uso</div>
            {detail.useEffects.map((effect) => (
              <div key={effect.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
                {[
                  getUseEffectTypeLabel(effect.effectType),
                  effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : ""),
                  effect.damageType ?? "",
                  effect.savingThrowAbility && effect.savingThrowDc != null ? `TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}` : "",
                  effect.successOutcome ? getSuccessOutcomeLabel(effect.successOutcome) : "",
                ].filter(Boolean).join(" - ")}
                {effect.notes ? <div className="mt-1">{effect.notes}</div> : null}
              </div>
            ))}
          </div>
        )}

        {!!detail?.abilityRequirements?.length && (
          <div className="text-xs text-muted-foreground">
            Requisiti: {detail.abilityRequirements.map((req) => `${req.ability} ${req.minScore}+`).join(", ")}
          </div>
        )}
      </div>
    );
  };

  const getRelationalItemTitle = (item: any) => item?.nameOverride?.trim?.() || item?.itemName || "Oggetto";
  const getRelationalItemDescription = (item: any) =>
    item?.descriptionOverride?.trim?.() || item?.detailSummary || item?.description || "";
  const matchesCatalogKind = (item: any, currentKind: "weapon" | "object" | "consumable") => {
    const category = String(item?.category ?? "");
    if (currentKind === "weapon") return category === "WEAPON";
    if (currentKind === "consumable") return category === "CONSUMABLE" || category === "AMMUNITION";
    return !["WEAPON", "CONSUMABLE", "AMMUNITION"].includes(category);
  };
  const filteredCatalogItems = catalogItems.filter((item: any) => {
    if (item?.rarity === "UNIQUE" && Number(item?.assignedCharacterItemCount ?? 0) > 0) return false;
    if (!matchesCatalogKind(item, kind)) return false;
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      String(item?.name ?? "").toLowerCase().includes(query) ||
      String(item?.slug ?? "").toLowerCase().includes(query)
    );
  });
  const selectedCatalogItem =
    filteredCatalogItems.find((item: any) => item.id === selectedCatalogItemId) ??
    catalogItems.find((item: any) => item.id === selectedCatalogItemId) ??
    null;
  const isRelationalDetail =
    detailTarget?.kind === "relationalWeapon" ||
    detailTarget?.kind === "relationalObject" ||
    detailTarget?.kind === "relationalConsumable";

  const resetCustomItemForm = () => {
    setCustomItemName("");
    setCustomItemDescription("");
    setCustomObjectCategory("OTHER");
    setCustomEquippable(false);
    setCustomStackable(false);
    setCustomWeaponHandling("ONE_HANDED");
    setCustomAttackKind("MELEE_WEAPON");
    setCustomAttackBonus("");
    setCustomDamageDice("");
    setCustomVersatileDamageDice("");
    setCustomDamageType("tagliente");
    setCustomRangeNormal("");
    setCustomRangeLong("");
    setCustomConsumableCategory("CONSUMABLE");
    setCustomEffectType("");
    setCustomEffectDice("");
    setCustomEffectDamageType("");
    setCustomEffectSaveAbility("");
    setCustomEffectSaveDc("");
    setCustomEffectSuccessOutcome("");
    setCustomEffectNotes("");
  };

  useEffect(() => {
    if (!invOpen || mode !== "item") return;
    if (filteredCatalogItems.some((item: any) => item.id === selectedCatalogItemId)) return;
    setSelectedCatalogItemId(filteredCatalogItems[0]?.id ?? "");
  }, [filteredCatalogItems, invOpen, mode, selectedCatalogItemId]);

  useEffect(() => {
    if (!invOpen || mode !== "item" || catalogMode !== "catalog" || !selectedCatalogItemId) {
      setSelectedCatalogItemDetail(null);
      return;
    }
    let active = true;
    void fetchItemDefinition(selectedCatalogItemId)
      .then((detail) => {
        if (active) setSelectedCatalogItemDetail(detail);
      })
      .catch(() => {
        if (active) setSelectedCatalogItemDetail(null);
      });
    return () => {
      active = false;
    };
  }, [catalogMode, invOpen, mode, selectedCatalogItemId]);

  useEffect(() => {
    const relationalKinds = ["relationalWeapon", "relationalObject", "relationalConsumable"];
    if (!detailTarget || !relationalKinds.includes(detailTarget.kind)) {
      setDetailDefinition(null);
      return;
    }

    const relationalItem = relationalItems.find((item: any) => item?.id === (detailTarget as any).id);
    const itemDefinitionId = relationalItem?.itemDefinitionId;
    if (!itemDefinitionId) {
      setDetailDefinition(null);
      return;
    }

    let active = true;
    void fetchItemDefinition(itemDefinitionId)
      .then((detail) => {
        if (active) setDetailDefinition(detail);
      })
      .catch(() => {
        if (active) setDetailDefinition(null);
      });

    return () => {
      active = false;
    };
  }, [detailTarget, relationalItems]);

  // ==== helper per render armi (retro-compat) ====
  const buildAttackDetail = (atk: any) => {
    const bonus = `+${atk.attackBonus}`;
    const dice = atk.damageDice ?? parseLegacyDamage(atk.damageType).dice ?? "";
    const dtype = (atk.damageType && atk.damageDice) ? atk.damageType : (parseLegacyDamage(atk.damageType).type ?? "");
    const cat = atk.category as "melee" | "ranged" | undefined;
    const hands =
      cat === "melee" && atk.hands
        ? (atk.hands === "1" ? " - 1 mano" : atk.hands === "2" ? " - 2 mani" : " - versatile")
        : "";
    const range = cat === "ranged" && atk.range ? ` - gittata: ${atk.range}` : "";
    const dmg = [dice, dtype].filter(Boolean).join(" ");
    return `${bonus} - ${dmg}${hands}${range}`;
  };

  return (
    <SectionCard cardId="inventory" title="Inventario">

      {/* Monete */}
      <div className="mb-4 text-sm">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="font-semibold text-primary">Monete</div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
              aria-label="Aggiungi monete"
              title={coinActionsEnabled ? "Aggiungi monete" : "Gestione monete in attivazione"}
              disabled={!coinActionsEnabled}
              onClick={() => {
                lastOpenTriggerRef.current = document.activeElement as HTMLButtonElement | null;
                setMode("coins");
                setCoinFlow("add");
                setInvOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
              aria-label="Rimuovi monete"
              title={coinActionsEnabled ? "Rimuovi monete" : "Gestione monete in attivazione"}
              disabled={!coinActionsEnabled}
              onClick={() => {
                lastOpenTriggerRef.current = document.activeElement as HTMLButtonElement | null;
                setMode("coins");
                setCoinFlow("remove");
                setInvOpen(true);
              }}
            >
              <span className="text-base leading-none">-</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
              aria-label="Trasferisci monete"
              title={coinActionsEnabled ? "Trasferisci monete" : "Gestione monete in attivazione"}
              disabled={!coinActionsEnabled || !Array.isArray(transferTargets) || transferTargets.length === 0}
              onClick={() => {
                lastOpenTriggerRef.current = document.activeElement as HTMLButtonElement | null;
                setMode("coins");
                setCoinFlow("transfer");
                if (!coinTransferTargetSlug && Array.isArray(transferTargets) && transferTargets[0]?.slug) {
                  setCoinTransferTargetSlug(String(transferTargets[0].slug));
                }
                setInvOpen(true);
              }}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          {COIN_ORDER.map((abbr) => {
            const meta = COIN_META[abbr];
            return (
              <div
                key={abbr}
                className="flex items-center justify-between rounded-md bg-card/40 px-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 ${meta.ringClass} ${meta.swatchClass} shadow-inner`}
                    aria-hidden="true"
                  >
                    <span className={`text-[8px] font-bold ${meta.textClass}`}>{meta.shortLabel}</span>
                  </span>
                  <div className="font-medium leading-none">{meta.label}</div>
                </div>
                <span className="font-semibold tabular-nums text-sm">{coins[meta.key]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          {coinActionsEnabled
            ? "I cambi tra i vari tagli vengono calcolati automaticamente."
            : "Saldo letto dal DB. Le operazioni monete arrivano nel prossimo step."}
        </div>
      </div>

      <Separator className="my-3" />

      {/* Armi */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-primary">Armi</div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
            aria-label="Aggiungi arma"
            title="Aggiungi arma"
            onClick={() => {
              lastOpenTriggerRef.current = document.activeElement as HTMLButtonElement | null;
              openAddDialog("weapon");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {relationalWeapons.length > 0 ? (
          <>
          {relationalWeapons.map((item: any) => (
            <div
              key={`db-weapon-${item.id}`}
              className="flex cursor-pointer items-center justify-between gap-3 text-sm dnd-frame p-2 transition hover:bg-accent/10"
              onClick={() => openDetail({ kind: "relationalWeapon", id: item.id })}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {getRelationalItemTitle(item)} {item.isEquipped ? "(equipaggiato)" : ""}
                </div>
                {getRelationalItemDescription(item) ? (
                  <div className="text-muted-foreground">{getRelationalItemDescription(item)}</div>
                ) : null}
                {renderMetaIcons(buildRelationalItemMetaIcons(item))}
              </div>
              {item.equippable && !!toggleEquipRelationalItem ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant={item.isEquipped ? "default" : "outline"}
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleRelationalEquip(item);
                    }}
                    aria-label={item.isEquipped ? "Disequipaggia arma" : "Equipaggia arma"}
                    title={item.isEquipped ? "Disequipaggia" : "Equipaggia"}
                  >
                    {item.isEquipped ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Nessuna arma in inventario.</div>
        )}
      </div>

      {/* Consumabili */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-primary">Consumabili</div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
            aria-label="Aggiungi consumabile"
            title="Aggiungi consumabile"
            onClick={() => {
              lastOpenTriggerRef.current = document.activeElement as HTMLButtonElement | null;
              openAddDialog("consumable");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {relationalConsumables.length > 0 ? (
          <>
          {relationalConsumables.map((item: any) => (
            <div
              key={`db-cons-${item.id}`}
              className="cursor-pointer text-sm dnd-frame p-2 transition hover:bg-accent/10"
              onClick={() => openDetail({ kind: "relationalConsumable", id: item.id })}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{getRelationalItemTitle(item)}</div>
                  {getRelationalItemDescription(item) ? (
                    <div className="text-muted-foreground">{getRelationalItemDescription(item)}</div>
                  ) : null}
                  {renderMetaIcons(buildRelationalItemMetaIcons(item))}
                </div>
                {!!decrementRelationalConsumable && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 px-0 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        incrementRelationalConsumable(item.id);
                      }}
                      aria-label="Aumenta quantità"
                      title="Aumenta quantità"
                    >
                      +
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 px-0 text-sm"
                      disabled={item.quantity <= 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        decrementRelationalConsumable(item.id);
                      }}
                      aria-label="Consuma una unità"
                      title="Consuma una unità"
                    >
                      −
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Nessun consumabile in inventario.</div>
        )}
      </div>

      {/* Oggetti (strutturati) */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-primary">Oggetti</div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
            aria-label="Aggiungi oggetto"
            title="Aggiungi oggetto"
            onClick={() => {
              lastOpenTriggerRef.current = document.activeElement as HTMLButtonElement | null;
              openAddDialog("object");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {relationalObjects.length > 0 ? (
          <>
            {relationalObjects.map((item: any) => (
              <div
                key={`db-obj-${item.id}`}
                className="cursor-pointer text-sm dnd-frame p-2 transition hover:bg-accent/10"
                onClick={() => openDetail({ kind: "relationalObject", id: item.id })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {getRelationalItemTitle(item)} {item.isEquipped ? "(equipaggiato)" : ""}
                    </div>
                    {getRelationalItemDescription(item) ? (
                      <div className="text-muted-foreground line-clamp-2">{getRelationalItemDescription(item)}</div>
                    ) : null}
                    {renderMetaIcons(buildRelationalItemMetaIcons(item))}
                  </div>
                  {item.equippable && !!toggleEquipRelationalItem ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant={item.isEquipped ? "default" : "outline"}
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleRelationalEquip(item);
                        }}
                        aria-label={item.isEquipped ? "Disequipaggia oggetto" : "Equipaggia oggetto"}
                        title={item.isEquipped ? "Disequipaggia" : "Equipaggia"}
                      >
                        {item.isEquipped ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Nessun oggetto in inventario.</div>
        )}
      </div>

      {/* Modale Aggiungi */}
      <Dialog
        open={invOpen}
        onOpenChange={(v) => {
          setInvOpen(v);
          if (!v) {
            resetInvForm();
            resetCustomItemForm();
            setEditingTarget(null);
            setCatalogMode("catalog");
            setCatalogQuery("");
            setAssignQuantity("1");
            setAssignNotes("");
            setAssignError("");
            setSelectedCatalogItemId("");
          }
        }}
      >
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            lastOpenTriggerRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "coins"
                ? coinFlow === "add"
                  ? "Aggiungi monete"
                  : coinFlow === "remove"
                    ? "Rimuovi monete"
                    : "Trasferisci monete"
                : editingTarget
                  ? kind === "weapon"
                    ? "Modifica arma"
                    : kind === "object"
                      ? "Modifica oggetto"
                      : "Modifica consumabile"
                  : kind === "weapon"
                    ? "Aggiungi arma"
                    : kind === "object"
                      ? "Aggiungi oggetto"
                      : "Aggiungi consumabile"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              {mode === "coins" ? null : (
                <>
                <Label className="mb-2 block">Tipo</Label>
                <RadioGroup
                  value={kind}
                  onValueChange={(v) => {
                    setKind(v as "weapon" | "object" | "consumable");
                    setSelectedCatalogItemId("");
                    setCatalogQuery("");
                    setAssignError("");
                  }}
                  className="grid grid-cols-3 gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weapon" id="r-weapon" />
                    <Label htmlFor="r-weapon">Armi</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="object" id="r-object" />
                    <Label htmlFor="r-object">Oggetti</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="consumable" id="r-consumable" />
                    <Label htmlFor="r-consumable">Consumabili</Label>
                  </div>
                </RadioGroup>
                </>
              )}
            </div>

            {mode === "coins" ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/85">
                    Operazione
                  </div>
                  <div className="mx-auto flex w-full max-w-xl rounded-full border border-border/70 bg-muted/10 p-1">
                    <Button
                      type="button"
                      variant={coinFlow === "add" ? "default" : "ghost"}
                      className="h-8 flex-1 rounded-full px-3 text-xs font-semibold"
                      onClick={() => setCoinFlow("add")}
                    >
                      Entrata
                    </Button>
                    <Button
                      type="button"
                      variant={coinFlow === "remove" ? "default" : "ghost"}
                      className="h-8 flex-1 rounded-full px-3 text-xs font-semibold"
                      onClick={() => setCoinFlow("remove")}
                    >
                      Spesa
                    </Button>
                    <Button
                      type="button"
                      variant={coinFlow === "transfer" ? "default" : "ghost"}
                      className="h-8 flex-1 rounded-full px-3 text-xs font-semibold"
                      onClick={() => setCoinFlow("transfer")}
                    >
                      Trasferisci
                    </Button>
                  </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
                  <div className="space-y-2">
                    <Label className="mb-0.5 block">
                      {coinFlow === "add"
                        ? "Quantita da aggiungere"
                        : coinFlow === "remove"
                          ? "Quantita da spendere"
                          : "Quantita da trasferire"}
                    </Label>
                    <Input
                      inputMode="numeric"
                      value={coinQty}
                      onChange={(e) => setCoinQty(e.target.value)}
                      placeholder="Es. 10"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="mb-0.5 block">Taglio</Label>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {COIN_ORDER.map((abbr) => {
                        const selected = coinType === abbr;
                        return (
                          <button
                            key={abbr}
                            type="button"
                            onClick={() => setCoinType(abbr)}
                            className="group flex flex-col items-center gap-1 text-center"
                          >
                            <span
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 transition-all ${COIN_META[abbr].ringClass} ${COIN_META[abbr].swatchClass} ${selected ? "scale-105 ring-primary/80 shadow-[0_0_0_2px_rgba(255,255,255,0.08),0_0_0_4px_rgba(255,92,92,0.16)]" : "opacity-70 group-hover:opacity-100"}`}
                              aria-hidden="true"
                            >
                              <span className={`text-xs font-bold ${COIN_META[abbr].textClass}`}>
                                {COIN_META[abbr].shortLabel}
                              </span>
                            </span>
                            <span
                              className={`text-[11px] font-semibold transition-colors ${selected ? "text-primary" : "text-muted-foreground"}`}
                            >
                              {COIN_META[abbr].label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-6 md:items-start">
                  {coinFlow === "transfer" && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="mb-1 block">{coinPrimaryLabel}</Label>
                      <Select value={coinTransferTargetSlug} onChange={setCoinTransferTargetSlug}>
                        <option value="">Seleziona personaggio</option>
                        {(Array.isArray(transferTargets) ? transferTargets : []).map((target: any) => (
                          <option key={target.slug} value={target.slug}>
                            {target.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  {coinFlow !== "transfer" && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="mb-1 block">{coinPrimaryLabel}</Label>
                      <Input
                        value={coinCounterpartyName}
                        onChange={(e) => setCoinCounterpartyName(e.target.value)}
                        placeholder={coinPrimaryPlaceholder}
                      />
                    </div>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="mb-1 block">Motivo</Label>
                    <Input
                      value={coinReason}
                      onChange={(e) => setCoinReason(e.target.value)}
                      placeholder={coinReasonPlaceholder}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="mb-1 block">{coinDetailLabel}</Label>
                    <Input
                      value={coinPurchaseDescription}
                      onChange={(e) => setCoinPurchaseDescription(e.target.value)}
                      placeholder={coinDetailPlaceholder}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-6">
                    <Label className="mb-1 block">Note</Label>
                    <Textarea
                      rows={3}
                      value={coinNote}
                      onChange={(e) => setCoinNote(e.target.value)}
                      placeholder="Annotazioni opzionali"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3 text-xs text-muted-foreground">
                  Seleziona un oggetto censito nel catalogo. L'aggiunta creerà una vera istanza nell'inventario del personaggio.
                </div>

                <RadioGroup
                  value={catalogMode}
                  onValueChange={(v) => {
                    setCatalogMode(v as "catalog" | "custom");
                    setAssignError("");
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="catalog" id="catalog-mode-catalog" />
                    <Label htmlFor="catalog-mode-catalog">Da catalogo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="catalog-mode-custom" />
                    <Label htmlFor="catalog-mode-custom">Nuovo oggetto</Label>
                  </div>
                </RadioGroup>

                {catalogMode === "catalog" && (
                  <>
                <div className="space-y-2">
                  <Label className="mb-1 block">Cerca nel catalogo</Label>
                  <Input
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder={
                      kind === "weapon"
                        ? "Cerca arma"
                        : kind === "consumable"
                          ? "Cerca consumabile"
                          : "Cerca oggetto"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="mb-1 block">
                    {kind === "weapon" ? "Arma" : kind === "consumable" ? "Consumabile" : "Oggetto"}
                  </Label>
                  <Select value={selectedCatalogItemId} onChange={setSelectedCatalogItemId}>
                    <option value="">Seleziona dal catalogo</option>
                    {filteredCatalogItems.map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.rarity ? ` - ${item.rarity}` : ""}
                      </option>
                    ))}
                  </Select>
                  {!filteredCatalogItems.length ? (
                    <div className="text-xs text-muted-foreground">
                      Nessun elemento del catalogo compatibile con questo tipo.
                    </div>
                  ) : null}
                </div>

                {renderCatalogItemPreview()}
                  </>
                )}

                {catalogMode === "custom" && (
                  <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-3">
                    <div className="space-y-2">
                      <Label className="mb-1 block">Nome *</Label>
                      <Input value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} placeholder="Es. Lama ricurva di bronzo" />
                    </div>
                    <div className="space-y-2">
                      <Label className="mb-1 block">Descrizione</Label>
                      <Textarea rows={3} value={customItemDescription} onChange={(e) => setCustomItemDescription(e.target.value)} placeholder="Dettagli rapidi sull'oggetto" />
                    </div>
                    {kind === "weapon" && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="mb-1 block">Impugnatura</Label>
                            <Select value={customWeaponHandling} onChange={setCustomWeaponHandling}>
                              <option value="ONE_HANDED">1 mano</option>
                              <option value="TWO_HANDED">2 mani</option>
                              <option value="VERSATILE">Versatile</option>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="mb-1 block">Tipo attacco</Label>
                            <Select value={customAttackKind} onChange={setCustomAttackKind}>
                              <option value="MELEE_WEAPON">Mischia</option>
                              <option value="RANGED_WEAPON">Distanza</option>
                              <option value="THROWN">Lancio</option>
                              <option value="SPECIAL">Speciale</option>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label className="mb-1 block">Bonus attacco</Label>
                            <Input value={customAttackBonus} onChange={(e) => setCustomAttackBonus(e.target.value)} placeholder="Es. 5" />
                          </div>
                          <div className="space-y-2">
                            <Label className="mb-1 block">Dado danno</Label>
                            <Input value={customDamageDice} onChange={(e) => setCustomDamageDice(e.target.value)} placeholder="Es. 1d8" />
                          </div>
                          <div className="space-y-2">
                            <Label className="mb-1 block">Tipo danno</Label>
                            <Select value={customDamageType} onChange={setCustomDamageType}>
                              <option value="tagliente">Tagliente</option>
                              <option value="perforante">Perforante</option>
                              <option value="contundente">Contundente</option>
                            </Select>
                          </div>
                        </div>
                        {customWeaponHandling === "VERSATILE" && (
                          <div className="space-y-2">
                            <Label className="mb-1 block">Danno a 2 mani</Label>
                            <Input value={customVersatileDamageDice} onChange={(e) => setCustomVersatileDamageDice(e.target.value)} placeholder="Es. 1d10" />
                          </div>
                        )}
                      </>
                    )}
                    {kind === "object" && (
                      <>
                        <div className="space-y-2">
                          <Label className="mb-1 block">Categoria</Label>
                          <Select value={customObjectCategory} onChange={setCustomObjectCategory}>
                            <option value="OTHER">Altro</option>
                            <option value="GEAR">Equipaggiamento</option>
                            <option value="TOOL">Strumento</option>
                            <option value="WONDROUS_ITEM">Oggetto meraviglioso</option>
                            <option value="RING">Anello</option>
                            <option value="AMULET">Amuleto</option>
                          </Select>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={customEquippable} onChange={(e) => setCustomEquippable(e.target.checked)} className="h-4 w-4" />
                            Equipaggiabile
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={customStackable} onChange={(e) => setCustomStackable(e.target.checked)} className="h-4 w-4" />
                            Stackabile
                          </label>
                        </div>
                      </>
                    )}
                    {kind === "consumable" && (
                      <>
                        <div className="space-y-2">
                          <Label className="mb-1 block">Categoria</Label>
                          <Select value={customConsumableCategory} onChange={setCustomConsumableCategory}>
                            <option value="CONSUMABLE">Consumabile</option>
                            <option value="AMMUNITION">Munizione</option>
                          </Select>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="mb-1 block">Effetto principale</Label>
                            <Select value={customEffectType} onChange={setCustomEffectType}>
                              <option value="">Nessun effetto strutturato</option>
                              <option value="HEAL">Cura</option>
                              <option value="DAMAGE">Danno</option>
                              <option value="TEMP_HP">PF temporanei</option>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="mb-1 block">Valore / dadi</Label>
                            <Input value={customEffectDice} onChange={(e) => setCustomEffectDice(e.target.value)} placeholder="Es. 2d4+2" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="mb-1 block">
                      Quantità
                    </Label>
                    <Input
                      inputMode="numeric"
                      value={assignQuantity}
                      onChange={(e) => setAssignQuantity(e.target.value)}
                      placeholder="Es. 1"
                    />
                    <div className="text-xs text-muted-foreground">
                      {selectedCatalogItem?.stackable
                        ? "Per gli oggetti stackabili aggiorna la quantità iniziale dello stack."
                        : "Per gli oggetti non stackabili verranno create istanze separate."}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="mb-1 block">Note</Label>
                    <Textarea
                      rows={3}
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="Annotazioni opzionali sull'istanza"
                    />
                  </div>
                </div>
              </div>
            )}

            {(mode === "coins" ? invError : assignError) && (
              <div className="text-sm text-red-600">{mode === "coins" ? invError : assignError}</div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
                  aria-label="Annulla"
                  title="Annulla"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            {mode === "coins" ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
                onClick={() => void handleCurrencySubmit()}
                disabled={coinSubmitting}
                aria-label={coinSubmitting ? "Salvataggio in corso" : "Conferma"}
                title={coinSubmitting ? "Salvataggio in corso" : "Conferma"}
              >
                <Check className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => void (catalogMode === "catalog" ? handleAssignCatalogItem() : handleQuickCreateItem())}
                disabled={assigningItem || (catalogMode === "catalog" ? !selectedCatalogItemId : !customItemName.trim())}
              >
                {assigningItem ? "Aggiungo..." : catalogMode === "catalog" ? "Aggiungi all'inventario" : "Censisci e aggiungi"}
              </Button>
            )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isRelationalDetail
                ? getRelationalItemTitle(getDetailEntry())
                : detailTarget?.kind === "weapon"
                  ? (getDetailEntry() as any)?.name ?? "Dettaglio oggetto"
                  : detailTarget?.kind === "consumable"
                    ? (getDetailEntry() as any)?.name ?? "Dettaglio oggetto"
                    : typeof getDetailEntry() === "string"
                      ? getDetailEntry()
                      : (getDetailEntry() as any)?.name ?? "Dettaglio oggetto"}
            </DialogTitle>
          </DialogHeader>

          {detailTarget?.kind === "weapon" && getDetailEntry() && (
            <div className="space-y-3 text-sm">
              <div className="font-semibold text-primary">{(getDetailEntry() as any).name}</div>
              <div className="text-muted-foreground">{buildAttackDetail(getDetailEntry() as any)}</div>
              {renderSkillsChips((getDetailEntry() as any).skillsByType)}
            </div>
          )}

          {detailTarget?.kind === "consumable" && getDetailEntry() && (
            <div className="space-y-3 text-sm">
              <div className="font-semibold text-primary">{(getDetailEntry() as any).name}</div>
              <div className="text-muted-foreground">Quantità: {(getDetailEntry() as any).quantity ?? 0}</div>
              {(getDetailEntry() as any).dice && <div className="text-muted-foreground">{(getDetailEntry() as any).dice}</div>}
              {renderSkillsChips((getDetailEntry() as any).skillsByType)}
            </div>
          )}

          {(detailTarget?.kind === "object" || detailTarget?.kind === "legacyObject") && getDetailEntry() && (
            <div className="space-y-3 text-sm">
              <div className="font-semibold text-primary">
                {typeof getDetailEntry() === "string" ? getDetailEntry() : (getDetailEntry() as any).name}
              </div>
              {typeof getDetailEntry() !== "string" && (getDetailEntry() as any).description && (
                <div className="whitespace-pre-wrap text-muted-foreground">{(getDetailEntry() as any).description}</div>
              )}
              {typeof getDetailEntry() !== "string" && renderSkillsChips((getDetailEntry() as any).skillsByType)}
            </div>
          )}

          {isRelationalDetail && getDetailEntry() && (
            <div className="space-y-4 text-sm">
              <div>
                {getRelationalItemDescription(getDetailEntry()) ? (
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{getRelationalItemDescription(getDetailEntry())}</div>
                ) : null}
              </div>

              <div className="grid gap-2 rounded-md border border-border/60 bg-muted/15 px-3 py-3 text-muted-foreground">
                <div><span className="font-medium text-foreground">Categoria:</span> {getCategoryLabel((getDetailEntry() as any)?.itemCategory)}</div>
                {detailDefinition?.rarity ? <div><span className="font-medium text-foreground">Rarità:</span> {detailDefinition.rarity.replaceAll("_", " ")}</div> : null}
                {(getDetailEntry() as any)?.stackable ? <div><span className="font-medium text-foreground">Quantità:</span> {(getDetailEntry() as any)?.quantity ?? 0}</div> : null}
                {(getDetailEntry() as any)?.isEquipped ? <div><span className="font-medium text-foreground">Stato:</span> Equipaggiato</div> : null}
                {detailDefinition?.weaponHandling ? <div><span className="font-medium text-foreground">Impugnatura:</span> {getWeaponHandlingLabel(detailDefinition.weaponHandling)}</div> : null}
                {detailDefinition?.armorCategory ? <div><span className="font-medium text-foreground">Tipo armatura:</span> {getArmorCategoryLabel(detailDefinition.armorCategory)}</div> : null}
                {detailDefinition?.gloveWearMode ? <div><span className="font-medium text-foreground">Modalità guanti:</span> {getGloveModeLabel(detailDefinition.gloveWearMode)}</div> : null}
              </div>

              {!!(getDetailEntry() as any)?.notes && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note istanza</div>
                  <div className="whitespace-pre-wrap text-muted-foreground">{(getDetailEntry() as any).notes}</div>
                </div>
              )}

              {detailDefinition ? (
                <>
                  {!!detailDefinition.attacks?.length && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
                      {detailDefinition.attacks.map((attack) => (
                        <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                          <div className="font-medium text-foreground">{attack.name}</div>
                          <div className="mt-1 text-muted-foreground">
                            {[getAttackKindLabel(attack.kind), getHandRequirementLabel(attack.handRequirement)].filter(Boolean).join(" - ")}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {[
                              attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                              [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                              attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                            ].filter(Boolean).join(" - ")}
                          </div>
                          {attack.conditionText ? <div className="mt-1 text-muted-foreground">{attack.conditionText}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {!!detailDefinition.features?.length && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feature</div>
                      {detailDefinition.features.map((feature) => (
                        <div key={feature.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                          <div className="font-medium text-foreground">{feature.name}</div>
                          <div className="mt-1 text-muted-foreground">
                            {[getFeatureResetLabel(feature), feature.maxUses != null ? `${feature.maxUses} usi` : ""].filter(Boolean).join(" - ")}
                          </div>
                          {feature.description ? <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{feature.description}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {!!detailDefinition.useEffects?.length && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effetti all'uso</div>
                      {detailDefinition.useEffects.map((effect) => (
                        <div key={effect.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-muted-foreground">
                          {getUseEffectSummaryParts(effect).join(" - ")}
                          {effect.durationText ? <div className="mt-1">Durata: {effect.durationText}</div> : null}
                          {effect.notes ? <div className="mt-1 whitespace-pre-wrap">{effect.notes}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {!!detailDefinition.abilityRequirements?.length && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisiti</div>
                      <div className="text-muted-foreground">
                        {detailDefinition.abilityRequirements.map((req) => `${req.ability} ${req.minScore}+`).join(", ")}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Carico i dettagli della definizione oggetto...</div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            {!isRelationalDetail && (
              <>
                <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Elimina
                </Button>
                <Button variant="outline" onClick={startEditing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifica
                </Button>
              </>
            )}
            {isRelationalDetail && Array.isArray(transferTargets) && transferTargets.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setTransferTargetSlug((transferTargets[0]?.slug as string) ?? "");
                  setTransferQuantity("1");
                  setTransferError("");
                  setTransferOpen(true);
                }}
              >
                Trasferisci
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trasferisci oggetto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destinatario</Label>
              <Select value={transferTargetSlug} onChange={setTransferTargetSlug}>
                <option value="">Seleziona un personaggio</option>
                {(Array.isArray(transferTargets) ? transferTargets : []).map((target: any) => (
                  <option key={target.slug} value={target.slug}>
                    {target.name}
                  </option>
                ))}
              </Select>
            </div>
            {(getDetailEntry() as any)?.stackable ? (
              <div className="space-y-2">
                <Label>Quantità</Label>
                <Input
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                  inputMode="numeric"
                />
              </div>
            ) : null}
            {transferError ? <div className="text-sm text-destructive">{transferError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Annulla
            </Button>
            <Button onClick={() => void handleTransferRelationalItem()} disabled={transferringItem || !transferTargetSlug}>
              {transferringItem ? "Trasferisco..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={equipResolutionOpen} onOpenChange={setEquipResolutionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{equipResolutionMode === "swap" ? "Slot occupati" : "Scegli equipaggiamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {equipResolutionMode === "swap"
                ? `Per equipaggiare ${equipResolutionItemName} devi liberare gli slot richiesti.`
                : `Scegli come equipaggiare ${equipResolutionItemName}.`}
            </div>

            <RadioGroup value={equipResolutionSelectedOptionId} onValueChange={setEquipResolutionSelectedOptionId} className="space-y-2">
              {equipResolutionOptions.map((option) => (
                <label
                  key={option.optionId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-3"
                >
                  <RadioGroupItem value={option.optionId} className="mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-foreground">{formatEquipOptionLabel(option)}</div>
                    {option.conflicts.length > 0 ? (
                      <div className="text-muted-foreground">
                        Sostituisce: {option.conflicts.map((conflict) => `${conflict.itemName} (${EQUIPMENT_SLOT_LABELS[conflict.slot] ?? conflict.slot})`).join(", ")}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Nessun conflitto.</div>
                    )}
                  </div>
                </label>
              ))}
            </RadioGroup>

            {equipResolutionError ? <div className="text-sm text-destructive">{equipResolutionError}</div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipResolutionOpen(false)}>
              Annulla
            </Button>
            <Button onClick={() => void confirmEquipResolution()} disabled={!equipResolutionSelectedOptionId}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo elemento?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;elemento verrà rimosso definitivamente dall&apos;inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )

  function getDetailEntry() {
    if (!detailTarget) return null;
    if (detailTarget.kind === "weapon") return characterData?.equipment?.attacks?.[detailTarget.index] ?? null;
    if (detailTarget.kind === "legacyObject") return characterData?.equipment?.equipment?.[detailTarget.index] ?? null;
    if (detailTarget.kind === "relationalWeapon" || detailTarget.kind === "relationalObject" || detailTarget.kind === "relationalConsumable") {
      return relationalItems.find((item: any) => item?.id === detailTarget.id) ?? null;
    }
    return structuredItems?.[detailTarget.index] ?? null;
  }

  function openAddDialog(nextKind?: "weapon" | "object" | "consumable") {
    setEditingTarget(null);
    resetInvForm();
    resetCustomItemForm();
    setCatalogMode("catalog");
    setCatalogQuery("");
    setAssignQuantity("1");
    setAssignNotes("");
    setAssignError("");
    setSelectedCatalogItemId("");
    setMode("item");
    setCoinFlow(null);
    if (nextKind) setKind(nextKind);
    setInvOpen(true);
  }

  async function handleTransferRelationalItem() {
    if (!transferRelationalInventoryItem) return;
    const detailEntry = getDetailEntry() as any;
    if (!isRelationalDetail || !detailEntry?.id) return;
    if (!transferTargetSlug) {
      setTransferError("Seleziona un personaggio destinatario.");
      return;
    }

    const numericQuantity = Math.max(1, parseInt(transferQuantity, 10) || 1);
    setTransferringItem(true);
    setTransferError("");
    try {
      await transferRelationalInventoryItem(detailEntry.id, {
        toCharacterSlug: transferTargetSlug,
        quantity: detailEntry.stackable ? numericQuantity : 1,
      });
      setTransferOpen(false);
      setDetailOpen(false);
      setTransferTargetSlug("");
      setTransferQuantity("1");
      toast.success("Oggetto trasferito.");
    } catch (error: any) {
      setTransferError(String(error?.message ?? "Non sono riuscito a trasferire l'oggetto."));
    } finally {
      setTransferringItem(false);
    }
  }

  function openEquipResolutionDialog(item: any, details: EquipResolutionDetails) {
    const options = Array.isArray(details?.options) ? details.options : [];
    setEquipResolutionItemId(item.id);
    setEquipResolutionItemName(item.itemName ?? "Oggetto senza nome");
    setEquipResolutionMode(details?.mode === "swap" ? "swap" : "choice");
    setEquipResolutionOptions(options);
    setEquipResolutionSelectedOptionId(options[0]?.optionId ?? "");
    setEquipResolutionError("");
    setEquipResolutionOpen(true);
  }

  async function handleToggleRelationalEquip(item: any) {
    if (!toggleEquipRelationalItem) return;

    if (item.isEquipped) {
      try {
        await toggleEquipRelationalItem(item.id, { isEquipped: false });
      } catch (error: any) {
        toast.error(String(error?.message ?? "Non sono riuscito a disequipaggiare l'oggetto."));
      }
      return;
    }

    try {
      await toggleEquipRelationalItem(item.id, { isEquipped: true });
    } catch (error: any) {
      const details = error?.details as EquipResolutionDetails | undefined;
      if (details?.code === "EQUIP_RESOLUTION_REQUIRED") {
        openEquipResolutionDialog(item, details);
        return;
      }
      toast.error(String(error?.message ?? "Non sono riuscito a equipaggiare l'oggetto."));
    }
  }

  async function confirmEquipResolution() {
    if (!toggleEquipRelationalItem || !equipResolutionItemId || !equipResolutionSelectedOptionId) {
      return;
    }

    const selectedOption = equipResolutionOptions.find((option) => option.optionId === equipResolutionSelectedOptionId);
    if (!selectedOption) {
      setEquipResolutionError("Seleziona una configurazione valida.");
      return;
    }

    try {
      await toggleEquipRelationalItem(equipResolutionItemId, {
        isEquipped: true,
        equipConfig: {
          optionId: selectedOption.optionId,
          slots: selectedOption.slots,
          swapItemIds: selectedOption.conflicts.map((conflict) => conflict.itemId),
        },
      });
      setEquipResolutionOpen(false);
      setEquipResolutionItemId("");
      setEquipResolutionItemName("");
      setEquipResolutionOptions([]);
      setEquipResolutionSelectedOptionId("");
      setEquipResolutionError("");
    } catch (error: any) {
      setEquipResolutionError(String(error?.message ?? "Non sono riuscito a completare l'equipaggiamento."));
    }
  }

  async function handleAssignCatalogItem() {
    if (!assignRelationalInventoryItem) return;
    if (!selectedCatalogItemId) {
      setAssignError("Seleziona un oggetto dal catalogo.");
      return;
    }

    const numericQuantity = Math.max(1, parseInt(assignQuantity, 10) || 1);
    setAssigningItem(true);
    setAssignError("");
    try {
      await assignRelationalInventoryItem({
        itemDefinitionId: selectedCatalogItemId,
        quantity: numericQuantity,
        notes: assignNotes.trim() || null,
      });
      setInvOpen(false);
      setCatalogQuery("");
      setAssignQuantity("1");
      setAssignNotes("");
      setSelectedCatalogItemId("");
    } catch (error: any) {
      setAssignError(String(error?.message ?? "Non sono riuscito ad aggiungere l'oggetto all'inventario."));
    } finally {
      setAssigningItem(false);
    }
  }

  async function handleQuickCreateItem() {
    if (!assignRelationalInventoryItem) return;
    if (!customItemName.trim()) {
      setAssignError("Inserisci almeno un nome per il nuovo oggetto.");
      return;
    }

    const numericQuantity = Math.max(1, parseInt(assignQuantity, 10) || 1);
    const quickPayload: Record<string, unknown> = {
      kind,
      name: customItemName.trim(),
      description: customItemDescription.trim() || null,
      notes: assignNotes.trim() || null,
    };

    if (kind === "weapon") {
      quickPayload.weaponHandling = customWeaponHandling;
      quickPayload.attackKind = customAttackKind;
      quickPayload.attackBonus = customAttackBonus.trim() || null;
      quickPayload.damageDice = customDamageDice.trim() || null;
      quickPayload.versatileDamageDice = customVersatileDamageDice.trim() || null;
      quickPayload.damageType = customDamageType;
      quickPayload.rangeNormal = customRangeNormal.trim() || null;
      quickPayload.rangeLong = customRangeLong.trim() || null;
    } else if (kind === "consumable") {
      quickPayload.consumableCategory = customConsumableCategory;
      quickPayload.effectType = customEffectType || null;
      quickPayload.effectDice = customEffectDice.trim() || null;
      quickPayload.effectDamageType = customEffectDamageType.trim() || null;
      quickPayload.savingThrowAbility = customEffectSaveAbility || null;
      quickPayload.savingThrowDc = customEffectSaveDc.trim() || null;
      quickPayload.successOutcome = customEffectSuccessOutcome || null;
      quickPayload.effectNotes = customEffectNotes.trim() || null;
    } else {
      quickPayload.objectCategory = customObjectCategory;
      quickPayload.equippable = customEquippable;
      quickPayload.stackable = customStackable;
    }

    setAssigningItem(true);
    setAssignError("");
    try {
      await assignRelationalInventoryItem({
        quantity: numericQuantity,
        notes: assignNotes.trim() || null,
        quickCreateItem: quickPayload,
      });
      setInvOpen(false);
      setCatalogQuery("");
      setAssignQuantity("1");
      setAssignNotes("");
      setSelectedCatalogItemId("");
      resetCustomItemForm();
    } catch (error: any) {
      setAssignError(String(error?.message ?? "Non sono riuscito a censire e assegnare l'oggetto."));
    } finally {
      setAssigningItem(false);
    }
  }

  function openDetail(target: InventoryTarget) {
    setDetailTarget(target);
    setDetailOpen(true);
  }

  function startEditing() {
    const detailEntry = getDetailEntry();
    if (!detailTarget || !detailEntry) return;

    resetInvForm();
    setEditingTarget(detailTarget);
    setMode("item");

    if (detailTarget.kind === "weapon") {
      const atk = detailEntry as any;
      const legacy = parseLegacyDamage(atk.damageType);
      setKind("weapon");
      setItemName(atk.name ?? "");
      setItemAtkBonus(String(atk.attackBonus ?? ""));
      setItemDmgType(atk.damageDice ?? legacy.dice ?? "");
      setWeaponCategory(atk.category ?? "melee");
      setWeaponHands(atk.hands ?? "1");
      setWeaponRange(atk.range ?? "");
      setDamageKind((atk.damageDice ? atk.damageType : legacy.type ?? "tagliente") as any);
      setItemSkillsByType({ ...emptySkillsByType, ...(atk.skillsByType ?? {}) });
    } else if (detailTarget.kind === "object") {
      const obj = detailEntry as any;
      setKind("object");
      setItemName(obj.name ?? "");
      setDescription(obj.description ?? "");
      setEquippable(!!obj.equippable);
      setItemSkillsByType({ ...emptySkillsByType, ...(obj.skillsByType ?? {}) });
    } else if (detailTarget.kind === "consumable") {
      const cons = detailEntry as any;
      setKind("consumable");
      setItemName(cons.name ?? "");
      setQuantity(String(cons.quantity ?? 0));
      setConsumableSubtype(cons.subtype ?? "generic");
      setPotionDiceVal(cons.dice ?? "");
      setItemSkillsByType({ ...emptySkillsByType, ...(cons.skillsByType ?? {}) });
    } else {
      setKind("object");
      setItemName(String(detailEntry ?? ""));
    }

    setDetailOpen(false);
    setInvOpen(true);
  }

  function handleDelete() {
    if (!detailTarget) return;

    if (detailTarget.kind === "weapon") {
      removeAttack(detailTarget.index);
    } else if (detailTarget.kind !== "legacyObject") {
      removeStructuredItem?.(detailTarget.index);
    }

    setConfirmDeleteOpen(false);
    setDetailOpen(false);
    setDetailTarget(null);
  }
}

export default Inventory;







