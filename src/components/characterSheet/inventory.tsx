import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Plus,
  Shield,
  ShieldOff,
  Trash2,
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
import { fetchItemDefinition, type ItemDefinitionEntry } from "@/lib/auth";

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
          {renderCompactMetaChips([
            summary.category,
            summary.rarity ?? "",
            summary.stackable ? "stack" : "istanza singola",
            summary.equippable ? "equipaggiabile" : "",
            detail?.weaponHandling === "ONE_HANDED" ? "1 mano" : "",
            detail?.weaponHandling === "TWO_HANDED" ? "2 mani" : "",
            detail?.weaponHandling === "VERSATILE" ? "versatile" : "",
            detail?.armorCategory ?? "",
            detail?.gloveWearMode === "SINGLE" ? "guanto singolo" : "",
            detail?.gloveWearMode === "PAIR" ? "paio di guanti" : "",
          ])}
        </div>

        {!!detail?.attacks?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
            {detail.attacks.map((attack) => (
              <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{attack.name}</div>
                <div className="text-muted-foreground">
                  {[
                    attack.kind,
                    attack.handRequirement === "ONE_HANDED" ? "1 mano" : attack.handRequirement === "TWO_HANDED" ? "2 mani" : "",
                    attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                    [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                    attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                  ].filter(Boolean).join(" • ")}
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
                  {[feature.resetOn, feature.maxUses != null ? `${feature.maxUses} usi` : ""].filter(Boolean).join(" • ")}
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
                  effect.effectType,
                  effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : ""),
                  effect.damageType ?? "",
                  effect.savingThrowAbility && effect.savingThrowDc != null ? `TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}` : "",
                  effect.successOutcome ? `succ: ${effect.successOutcome}` : "",
                ].filter(Boolean).join(" • ")}
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
          {renderCompactMetaChips([
            summary.category,
            summary.rarity ?? "",
            summary.stackable ? "stack" : "istanza singola",
            summary.equippable ? "equipaggiabile" : "",
            detail?.weaponHandling === "ONE_HANDED" ? "1 mano" : "",
            detail?.weaponHandling === "TWO_HANDED" ? "2 mani" : "",
            detail?.weaponHandling === "VERSATILE" ? "versatile" : "",
            detail?.armorCategory ?? "",
            detail?.gloveWearMode === "SINGLE" ? "guanto singolo" : "",
            detail?.gloveWearMode === "PAIR" ? "paio di guanti" : "",
          ])}
        </div>

        {!!detail?.attacks?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
            {detail.attacks.map((attack) => (
              <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{attack.name}</div>
                <div className="text-muted-foreground">
                  {[
                    attack.kind,
                    attack.handRequirement === "ONE_HANDED" ? "1 mano" : attack.handRequirement === "TWO_HANDED" ? "2 mani" : "",
                    attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                    [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                    attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                  ].filter(Boolean).join(" • ")}
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
                  {[feature.resetOn, feature.maxUses != null ? `${feature.maxUses} usi` : ""].filter(Boolean).join(" • ")}
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
                  effect.effectType,
                  effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : ""),
                  effect.damageType ?? "",
                  effect.savingThrowAbility && effect.savingThrowDc != null ? `TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}` : "",
                  effect.successOutcome ? `succ: ${effect.successOutcome}` : "",
                ].filter(Boolean).join(" • ")}
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

type InventoryTarget =
  | { kind: "weapon"; index: number }
  | { kind: "object"; index: number }
  | { kind: "consumable"; index: number }
  | { kind: "legacyObject"; index: number };

const Inventory = ({
  coins,
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
  compactCoinsOnAdd,
  setCompactCoinsOnAdd,
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
  removeItem,
  updateLegacyItem,
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
}: any) => {
  const COIN_KEYS = {
    mr: "cp",
    ma: "sp",
    me: "ep",
    mo: "gp",
    mp: "pp",
  } as const;
  type CoinAbbr = keyof typeof COIN_KEYS;
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
    mp: {
      label: "Platino",
      shortLabel: "MP",
      key: "pp",
      swatchClass: "bg-gradient-to-br from-cyan-50 to-cyan-200",
      ringClass: "ring-cyan-400/30",
      textClass: "text-cyan-700",
    },
  };
  const COIN_ORDER: CoinAbbr[] = ["mp", "mo", "me", "ma", "mr"];

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
  const relationalWeapons = relationalItems.filter((item) => item?.itemCategory === "WEAPON");
  const relationalConsumables = relationalItems.filter((item) =>
    item?.itemCategory === "CONSUMABLE" || item?.itemCategory === "AMMUNITION"
  );
  const relationalObjects = relationalItems.filter((item) =>
    !["WEAPON", "CONSUMABLE", "AMMUNITION"].includes(String(item?.itemCategory ?? ""))
  );
  const catalogItems = Array.isArray(itemDefinitions) ? itemDefinitions : [];

  const renderCompactMetaChips = (chips: string[]) => {
    const visible = chips.filter(Boolean);
    if (!visible.length) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {visible.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
    );
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
          {renderCompactMetaChips([
            summary.category,
            summary.rarity ?? "",
            summary.stackable ? "stack" : "istanza singola",
            summary.equippable ? "equipaggiabile" : "",
            detail?.weaponHandling === "ONE_HANDED" ? "1 mano" : "",
            detail?.weaponHandling === "TWO_HANDED" ? "2 mani" : "",
            detail?.weaponHandling === "VERSATILE" ? "versatile" : "",
            detail?.armorCategory ?? "",
            detail?.gloveWearMode === "SINGLE" ? "guanto singolo" : "",
            detail?.gloveWearMode === "PAIR" ? "paio di guanti" : "",
          ])}
        </div>

        {!!detail?.attacks?.length && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
            {detail.attacks.map((attack) => (
              <div key={attack.id} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{attack.name}</div>
                <div className="text-muted-foreground">
                  {[
                    attack.kind,
                    attack.handRequirement === "ONE_HANDED" ? "1 mano" : attack.handRequirement === "TWO_HANDED" ? "2 mani" : "",
                    attack.attackBonus != null ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : "",
                    [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
                    attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : "",
                  ].filter(Boolean).join(" • ")}
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
                  {[feature.resetOn, feature.maxUses != null ? `${feature.maxUses} usi` : ""].filter(Boolean).join(" • ")}
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
                  effect.effectType,
                  effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : ""),
                  effect.damageType ?? "",
                  effect.savingThrowAbility && effect.savingThrowDc != null ? `TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}` : "",
                  effect.successOutcome ? `succ: ${effect.successOutcome}` : "",
                ].filter(Boolean).join(" • ")}
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

  // ==== helper per render armi (retro-compat) ====
  const buildAttackDetail = (atk: any) => {
    const bonus = `+${atk.attackBonus}`;
    const dice = atk.damageDice ?? parseLegacyDamage(atk.damageType).dice ?? "";
    const dtype = (atk.damageType && atk.damageDice) ? atk.damageType : (parseLegacyDamage(atk.damageType).type ?? "");
    const cat = atk.category as "melee" | "ranged" | undefined;
    const hands =
      cat === "melee" && atk.hands
        ? (atk.hands === "1" ? " • 1 mano" : atk.hands === "2" ? " • 2 mani" : " • versatile")
        : "";
    const range = cat === "ranged" && atk.range ? ` • gittata: ${atk.range}` : "";
    const dmg = [dice, dtype].filter(Boolean).join(" ");
    return `${bonus} • ${dmg}${hands}${range}`;
  };

  return (
    <Card className="character-section">
      <div className="character-section-title">Inventario</div>

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
              title="Aggiungi monete"
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
              title="Rimuovi monete"
              onClick={() => {
                lastOpenTriggerRef.current = document.activeElement as HTMLButtonElement | null;
                setMode("coins");
                setCoinFlow("remove");
                setInvOpen(true);
              }}
            >
              <span className="text-base leading-none">-</span>
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
          I cambi tra i vari tagli vengono calcolati automaticamente.
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
            <div key={`db-weapon-${item.id}`} className="flex items-center justify-between gap-3 text-sm dnd-frame p-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {getRelationalItemTitle(item)} {item.isEquipped ? "(equipaggiato)" : ""}
                </div>
                {getRelationalItemDescription(item) ? (
                  <div className="text-muted-foreground">{getRelationalItemDescription(item)}</div>
                ) : null}
                {renderCompactMetaChips([
                  item.itemCategory,
                  item.stackable ? `qty ${item.quantity}` : "",
                  item.isEquipped ? "equip" : "",
                ])}
              </div>
              {item.equippable && !!toggleEquipRelationalItem ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant={item.isEquipped ? "default" : "outline"}
                    className="h-8 w-8"
                    onClick={() => toggleEquipRelationalItem(item.id)}
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
            <div key={`db-cons-${item.id}`} className="text-sm dnd-frame p-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{getRelationalItemTitle(item)}</div>
                  {getRelationalItemDescription(item) ? (
                    <div className="text-muted-foreground">{getRelationalItemDescription(item)}</div>
                  ) : null}
                  {renderCompactMetaChips([
                    item.itemCategory,
                    item.stackable ? `qty ${item.quantity}` : "",
                  ])}
                </div>
                {!!decrementRelationalConsumable && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 px-0 text-sm"
                      onClick={() => incrementRelationalConsumable(item.id)}
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
                      onClick={() => decrementRelationalConsumable(item.id)}
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
              <div key={`db-obj-${item.id}`} className="text-sm dnd-frame p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {getRelationalItemTitle(item)} {item.isEquipped ? "(equipaggiato)" : ""}
                    </div>
                    {getRelationalItemDescription(item) ? (
                      <div className="text-muted-foreground line-clamp-2">{getRelationalItemDescription(item)}</div>
                    ) : null}
                    {renderCompactMetaChips([
                      item.itemCategory ?? "Senza categoria",
                      item.stackable ? `qty ${item.quantity}` : "",
                      item.isEquipped ? "equip" : "",
                    ])}
                  </div>
                  {item.equippable && !!toggleEquipRelationalItem ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant={item.isEquipped ? "default" : "outline"}
                        className="h-8 w-8"
                        onClick={() => toggleEquipRelationalItem(item.id)}
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
          className="sm:max-w-md"
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
                  : "Rimuovi monete"
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
              <Label className="mb-2 block">Tipo</Label>
              {mode === "coins" ? (
                <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  Monete
                </div>
              ) : (
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
              )}
            </div>

            {mode === "coins" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 text-xs text-muted-foreground">
                  Il cambio viene gestito automaticamente secondo la valuta di D&D.
                </div>
                <div className="col-span-3">
                  <Label className="mb-1 block">Taglio</Label>
                  <div className="space-y-1.5">
                    {COIN_ORDER.map((abbr) => (
                      <Button
                        key={abbr}
                        type="button"
                        variant={coinType === abbr ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCoinType(abbr)}
                        className="h-auto w-full justify-between px-2.5 py-1.5"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 ${COIN_META[abbr].ringClass} ${COIN_META[abbr].swatchClass} shadow-inner`}
                            aria-hidden="true"
                          >
                            <span className={`text-[8px] font-bold ${COIN_META[abbr].textClass}`}>
                              {COIN_META[abbr].shortLabel}
                            </span>
                          </span>
                          <span className="text-left">
                            <span className="block text-sm leading-none">{COIN_META[abbr].label}</span>
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="col-span-3">
                  <Label className="mb-1 block">
                    Quantità {coinFlow === "remove" ? "da rimuovere" : "da aggiungere"}
                  </Label>
                  <Input
                    inputMode="numeric"
                    value={coinQty}
                    onChange={(e) => setCoinQty(e.target.value)}
                    placeholder="Es. 10"
                  />
                </div>
                {coinFlow === "add" && (
                  <div className="col-span-3 flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
                    <input
                      id="compact-coins-on-add"
                      type="checkbox"
                      checked={!!compactCoinsOnAdd}
                      onChange={(e) => setCompactCoinsOnAdd(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="compact-coins-on-add" className="mb-0 cursor-pointer text-sm leading-tight">
                      Compatta automaticamente le monete dopo l'aggiunta
                    </Label>
                  </div>
                )}
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
                        {item.rarity ? ` • ${item.rarity}` : ""}
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
            <DialogClose asChild>
              <Button variant="outline">Annulla</Button>
            </DialogClose>
            {mode === "coins" ? (
              <Button
                onClick={() =>
                  handleInventorySubmit({
                    editTarget: editingTarget ?? undefined,
                    kind,
                    weaponCategory,
                    weaponHands: weaponCategory === "melee" ? weaponHands : undefined,
                    weaponRange: weaponCategory === "ranged" ? weaponRange?.trim() || undefined : undefined,
                    damageKind,
                    description: descriptionVal?.trim() || undefined,
                    equippable: kind === "object" ? !!equippableVal : undefined,
                    consumableSubtype,
                    quantity: Number.isNaN(parseInt(quantityVal)) ? 0 : parseInt(quantityVal, 10),
                    potionDice: potionDiceVal?.trim() || undefined,
                  })
                }
              >
                Salva
              </Button>
            ) : (
              <Button
                onClick={() => void (catalogMode === "catalog" ? handleAssignCatalogItem() : handleQuickCreateItem())}
                disabled={assigningItem || (catalogMode === "catalog" ? !selectedCatalogItemId : !customItemName.trim())}
              >
                {assigningItem ? "Aggiungo..." : catalogMode === "catalog" ? "Aggiungi all'inventario" : "Censisci e aggiungi"}
              </Button>
            )}
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
              {detailTarget?.kind === "weapon"
                ? "Dettaglio arma"
                : detailTarget?.kind === "consumable"
                  ? "Dettaglio consumabile"
                  : "Dettaglio oggetto"}
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

          <DialogFooter className="mt-2">
            <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Elimina
            </Button>
            <Button variant="outline" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
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
    </Card>
  )

  function getDetailEntry() {
    if (!detailTarget) return null;
    if (detailTarget.kind === "weapon") return characterData?.equipment?.attacks?.[detailTarget.index] ?? null;
    if (detailTarget.kind === "legacyObject") return characterData?.equipment?.equipment?.[detailTarget.index] ?? null;
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
    } else if (detailTarget.kind === "legacyObject") {
      removeItem(detailTarget.index);
    } else {
      removeStructuredItem?.(detailTarget.index);
    }

    setConfirmDeleteOpen(false);
    setDetailOpen(false);
    setDetailTarget(null);
  }
}

export default Inventory;
