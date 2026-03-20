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
import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

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
}

/** parser retro-compatibilità: "1d8+3 tagliente" -> { dice, type } */
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

  const hasStructuredObjects = !!structuredItems?.some((it) => it?.type === "object");
  const hasStructuredConsumables = !!structuredItems?.some((it) => it?.type === "consumable");

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
        {characterData.equipment.attacks?.length > 0 ? (
          characterData.equipment.attacks.map((atk: any, i: number) => (
            <div key={`${atk.name}-${i}`} className="flex items-center justify-between gap-3 text-sm dnd-frame p-2">
              <button
                type="button"
                onClick={() => openDetail({ kind: "weapon", index: i })}
                className="min-w-0 flex-1 rounded-sm text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <div className="font-medium">
                  {atk.name} {atk.equipped ? "(equipaggiata)" : ""}
                </div>
                <div className="text-muted-foreground">
                  {buildAttackDetail(atk)}
                </div>
              </button>
              <div className="flex items-center gap-2">
                {atk.name && (atk.damageDice || atk.damageType) && (
                  <Button
                    size="icon"
                    variant={atk.equipped ? "default" : "outline"}
                    className="h-8 w-8"
                    onClick={() => toggleEquipAttack(i)}
                    aria-label={atk.equipped ? "Disequipaggia arma" : "Equipaggia arma"}
                    title={atk.equipped ? "Disequipaggia" : "Equipaggia"}
                  >
                    {atk.equipped ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))
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
        {hasStructuredConsumables ? (
          structuredItems!.map((it, idx) => {
            if (it?.type !== "consumable") return null;
            const qty = typeof it.quantity === "number" ? it.quantity : 0;
            const isPotion = (it.subtype ?? "generic") === "potion";
            const canDec = qty <= 0;
            return (
              <div key={`cons-${idx}`} className="text-sm dnd-frame p-2">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openDetail({ kind: "consumable", index: idx })}
                    className="min-w-0 flex-1 rounded-sm text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="font-medium">{it.name}</div>
                    {isPotion && it.dice && (
                      <div className="text-muted-foreground text-sm mt-1">{it.dice}</div>
                    )}
                    {renderSkillsChips(it.skillsByType as any)}
                  </button>

                  {!!bumpConsumableQuantity && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1" aria-label={`Quantità di ${it.name}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 px-0 text-sm"
                          disabled={canDec}
                          onClick={() => bumpConsumableQuantity(idx, -1)}
                          aria-disabled={canDec}
                          aria-label="Diminuisci"
                        >
                          −
                        </Button>
                        <div className="w-10 text-center text-sm font-semibold select-none tabular-nums">
                          {qty}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 px-0 text-sm"
                          onClick={() => bumpConsumableQuantity(idx, +1)}
                          aria-label="Aumenta"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-muted-foreground">Nessun consumabile in inventario.</div>
        )}
      </div>

      {/* Oggetti (strutturati) */}
      {hasStructuredObjects && (
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
          {structuredItems!.map((it, idx) => {
            if (it?.type !== "object") return null;
            const equippable = !!it.equippable;
            const equipped = !!it.equipped;
            return (
              <div key={`obj-${idx}`} className="text-sm dnd-frame p-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openDetail({ kind: "object", index: idx })}
                    className="min-w-0 flex-1 rounded-sm text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="font-medium">
                      {it.name} {equippable && equipped ? "(equipaggiato)" : ""}
                    </div>
                    {it.description && (
                      <div className="text-muted-foreground whitespace-pre-wrap">{it.description}</div>
                    )}
                    {renderSkillsChips(it.skillsByType as any)}
                  </button>
                  <div className="flex items-center gap-2">
                    {equippable && !!toggleEquipItem && (
                      <Button
                        size="icon"
                        variant={equipped ? "default" : "outline"}
                        className="h-8 w-8"
                        onClick={() => toggleEquipItem(idx)}
                        aria-label={equipped ? "Disequipaggia oggetto" : "Equipaggia oggetto"}
                        title={equipped ? "Disequipaggia" : "Equipaggia"}
                      >
                        {equipped ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Oggetti (legacy) – solo se NON ci sono oggetti strutturati */}
      {!hasStructuredObjects && (
        <div>
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
          {characterData.equipment.equipment.map((item: string, index: number) => (
            <button
              key={index}
              type="button"
              onClick={() => openDetail({ kind: "legacyObject", index })}
              className="flex w-full items-center justify-between rounded-sm py-1 text-left text-sm transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <span>• {item}</span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Modale Aggiungi */}
      <Dialog
        open={invOpen}
        onOpenChange={(v) => {
          setInvOpen(v);
          if (!v) {
            resetInvForm();
            setEditingTarget(null);
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
              {editingTarget ? (
                <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  {kind === "weapon" ? "Arma" : kind === "object" ? "Oggetto" : "Consumabile"}
                </div>
              ) : (
                <RadioGroup
                  value={formType}
                  onValueChange={(v) => {
                    if (v === "coins") {
                      setMode("coins");
                    } else {
                      setMode("item");
                      const k = v.replace("item-", "") as "weapon" | "object" | "consumable";
                      setKind(k);
                    }
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="coins" id="r-coins" />
                    <Label htmlFor="r-coins">Monete</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="item-weapon" id="r-weapon" />
                    <Label htmlFor="r-weapon">Armi</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="item-object" id="r-object" />
                    <Label htmlFor="r-object">Oggetti</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="item-consumable" id="r-consumable" />
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
              <>
                {kind === "weapon" && (
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 block">Nome *</Label>
                      <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Es. Spada lunga" />
                    </div>

                    {/* Categoria arma */}
                    <div>
                      <Label className="mb-1 block">Categoria</Label>
                      <RadioGroup
                        value={weaponCategory}
                        onValueChange={(v) => setWeaponCategory(v as "melee" | "ranged")}
                        className="grid grid-cols-2 gap-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="melee" id="w-melee" />
                          <Label htmlFor="w-melee">Mischia</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ranged" id="w-ranged" />
                          <Label htmlFor="w-ranged">Distanza</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Bonus + Dado + Tipo danno */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="mb-1 block">Bonus attacco</Label>
                        <Input
                          inputMode="numeric"
                          value={itemAtkBonus}
                          onChange={(e) => setItemAtkBonus(e.target.value)}
                          placeholder="Es. 5"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block">Dado del danno</Label>
                        <Input
                          value={itemDmgType}
                          onChange={(e) => setItemDmgType(e.target.value)}
                          placeholder="Es. 1d8+3"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block">Tipo di danno</Label>
                        <Select value={damageKind} onChange={(v) => setDamageKind(v as any)} id="damage-kind">
                          <option value="tagliente">Tagliente</option>
                          <option value="perforante">Perforante</option>
                          <option value="contundente">Contundente</option>
                        </Select>
                      </div>
                    </div>

                    {/* Specifici per categoria */}
                    {weaponCategory === "ranged" ? (
                      <div>
                        <Label className="mb-1 block">Gittata</Label>
                        <Input
                          value={weaponRange}
                          onChange={(e) => setWeaponRange(e.target.value)}
                          placeholder="Es. 80/320"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label className="mb-1 block">Mani</Label>
                        <Select value={weaponHands} onChange={(v) => setWeaponHands(v as any)} id="weapon-hands" className="w-full">
                          <option value="1">Una mano</option>
                          <option value="2">Due mani</option>
                          <option value="versatile">Versatile</option>
                        </Select>
                      </div>
                    )}

                    {/* SKILL CATEGORIZZATE */}
                    <div className="space-y-2">
                      <Label className="block">Skill (per categoria)</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SKILL_TYPES.map((t) => (
                          <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={itemSkillType === t ? "default" : "outline"}
                            onClick={() => setItemSkillType(t)}
                          >
                            {LABELS[t]}
                          </Button>
                        ))}
                      </div>
                      <Input
                        className="mt-2"
                        value={itemSkillInput}
                        onChange={(e) => setItemSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addSkillToCurrentType(itemSkillInput);
                          }
                        }}
                        placeholder="Digita una skill e premi Invio (o ,)"
                      />
                      <div className="space-y-2 mt-2">
                        {SKILL_TYPES.map((t) => {
                          const arr = (itemSkillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;
                          if (!arr.length) return null;
                          return (
                            <div key={t}>
                              <div className="text-xs font-medium text-muted-foreground">{LABELS[t]}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {arr.map((s, idx) => (
                                  <div key={`${t}-${idx}`} className="px-2 py-1 rounded bg-muted text-xs flex items-center gap-1">
                                    <span className="italic">{s.name}</span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 px-1"
                                      onClick={() => removeSkillFromType(t as SkillType, idx)}
                                      aria-label={`Rimuovi ${s.name}`}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {kind === "object" && (
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 block">Nome *</Label>
                      <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Es. Corda di canapa" />
                    </div>
                    <div>
                      <Label className="mb-1 block">Descrizione</Label>
                      <Textarea
                        value={descriptionVal}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Dettagli, effetti narrativi, condizioni d'uso…"
                        rows={4}
                      />
                    </div>

                    {/* NEW: Equipaggiabile */}
                    <div className="flex items-center gap-2">
                      <input
                        id="obj-equippable"
                        type="checkbox"
                        checked={!!equippableVal}
                        onChange={(e) => setEquippable(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="obj-equippable">Equipaggiabile</Label>
                    </div>

                    {/* SKILL come per armi */}
                    <div className="space-y-2">
                      <Label className="block">Skill (per categoria)</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SKILL_TYPES.map((t) => (
                          <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={itemSkillType === t ? "default" : "outline"}
                            onClick={() => setItemSkillType(t)}
                          >
                            {LABELS[t]}
                          </Button>
                        ))}
                      </div>
                      <Input
                        className="mt-2"
                        value={itemSkillInput}
                        onChange={(e) => setItemSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addSkillToCurrentType(itemSkillInput);
                          }
                        }}
                        placeholder="Digita una skill e premi Invio (o ,)"
                      />
                      <div className="space-y-2 mt-2">
                        {SKILL_TYPES.map((t) => {
                          const arr = (itemSkillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;
                          if (!arr.length) return null;
                          return (
                            <div key={t}>
                              <div className="text-xs font-medium text-muted-foreground">{LABELS[t]}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {arr.map((s, idx) => (
                                  <div key={`${t}-${idx}`} className="px-2 py-1 rounded bg-muted text-xs flex items-center gap-1">
                                    <span className="italic">{s.name}</span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 px-1"
                                      onClick={() => removeSkillFromType(t as SkillType, idx)}
                                      aria-label={`Rimuovi ${s.name}`}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {kind === "consumable" && (
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 block">Nome *</Label>
                      <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Es. Razioni" />
                    </div>

                    <div>
                      <Label className="mb-1 block">Sottotipo</Label>
                      <RadioGroup
                        value={consumableSubtype}
                        onValueChange={(v) => setConsumableSubtype(v as "generic" | "potion")}
                        className="grid grid-cols-2 gap-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="generic" id="sub-generic" />
                          <Label htmlFor="sub-generic">Generico</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="potion" id="sub-potion" />
                          <Label htmlFor="sub-potion">Pozione</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="mb-1 block">Quantità</Label>
                        <Input
                          inputMode="numeric"
                          value={quantityVal}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="Es. 3"
                        />
                      </div>

                      {consumableSubtype === "potion" && (
                        <div>
                          <Label className="mb-1 block">Tiro di dado (effetto)</Label>
                          <Input
                            value={potionDiceVal}
                            onChange={(e) => setPotionDiceVal(e.target.value)}
                            placeholder="Es. 2d4+2"
                          />
                        </div>
                      )}
                    </div>

                    {/* SKILL come per armi */}
                    <div className="space-y-2">
                      <Label className="block">Skill (per categoria)</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SKILL_TYPES.map((t) => (
                          <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={itemSkillType === t ? "default" : "outline"}
                            onClick={() => setItemSkillType(t)}
                          >
                            {LABELS[t]}
                          </Button>
                        ))}
                      </div>
                      <Input
                        className="mt-2"
                        value={itemSkillInput}
                        onChange={(e) => setItemSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addSkillToCurrentType(itemSkillInput);
                          }
                        }}
                        placeholder="Digita una skill e premi Invio (o ,)"
                      />
                      <div className="space-y-2 mt-2">
                        {SKILL_TYPES.map((t) => {
                          const arr = (itemSkillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;
                          if (!arr.length) return null;
                          return (
                            <div key={t}>
                              <div className="text-xs font-medium text-muted-foreground">{LABELS[t]}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {arr.map((s, idx) => (
                                  <div key={`${t}-${idx}`} className="px-2 py-1 rounded bg-muted text-xs flex items-center gap-1">
                                    <span className="italic">{s.name}</span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-5 px-1"
                                      onClick={() => removeSkillFromType(t as SkillType, idx)}
                                      aria-label={`Rimuovi ${s.name}`}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {invError && <div className="text-sm text-red-600">{invError}</div>}
          </div>

          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">Annulla</Button>
            </DialogClose>
            <Button
              onClick={() =>
                handleInventorySubmit({
                  editTarget: editingTarget ?? undefined,
                  kind,
                  // nuovi campi arma:
                  weaponCategory,
                  weaponHands: weaponCategory === "melee" ? weaponHands : undefined,
                  weaponRange: weaponCategory === "ranged" ? weaponRange?.trim() || undefined : undefined,
                  damageKind, // "tagliente" | "perforante" | "contundente"
                  // campi oggetti/consumabili:
                  description: (kind === "object" ? (descriptionVal?.trim() || undefined) : (descriptionVal?.trim() || undefined)),
                  equippable: (kind === "object" ? !!equippableVal : undefined), // NEW
                  consumableSubtype,
                  quantity: Number.isNaN(parseInt(quantityVal)) ? 0 : parseInt(quantityVal, 10),
                  potionDice: potionDiceVal?.trim() || undefined,
                })
              }
            >
              {editingTarget ? "Salva modifiche" : "Salva"}
            </Button>
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
    setMode("item");
    setCoinFlow(null);
    if (nextKind) setKind(nextKind);
    setInvOpen(true);
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
