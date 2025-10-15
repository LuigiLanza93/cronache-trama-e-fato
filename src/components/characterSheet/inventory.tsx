import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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
  handleInventorySubmit,
  resetInvForm,
  itemName,
  setItemName,
  itemAtkBonus,
  setItemAtkBonus,
  itemDmgType,
  setItemDmgType,
  /** legacy singolo campo (resta per compat) */
  itemSkill,
  setItemSkill,
  /** nuove props per skills categorizzate */
  itemSkillType,
  setItemSkillType,
  itemSkillInput,
  setItemSkillInput,
  itemSkillsByType,
  setItemSkillsByType,
  invError,
  removeAttack,
  removeItem,
  toggleEquipAttack,
  /** NEW oggetti/consumabili */
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
  itemEquippable,
  setItemEquippable,
  /** handlers elenco strutturato */
  removeStructuredItem,
  bumpConsumableQuantity,
  toggleEquipItem,
}: any) => {
  const COIN_KEYS = {
    mr: "cp",
    ma: "sp",
    me: "ep",
    mo: "gp",
    mp: "pp",
  } as const;
  type CoinAbbr = keyof typeof COIN_KEYS;

  const SKILL_TYPES = ["volonta", "incontro", "riposoBreve", "riposoLungo"] as const;
  type SkillType = typeof SKILL_TYPES[number];
  const LABELS: Record<SkillType, string> = {
    volonta: "Volontà",
    incontro: "Incontro",
    riposoBreve: "Riposo Breve",
    riposoLungo: "Riposo Lungo",
  };

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

  const attacks = Array.isArray(characterData?.equipment?.attacks)
    ? characterData.equipment.attacks
    : [];

  const structuredItems = Array.isArray(characterData?.equipment?.items)
    ? characterData.equipment.items
    : [];

  return (
    <Card className="character-section">
      <div className="character-section-title">Inventario</div>

      {/* Monete */}
      <div className="mb-4 text-sm">
        <div className="font-semibold text-primary mb-2">Monete</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {([
            ["MR", "cp"],
            ["MA", "sp"],
            ["ME", "ep"],
            ["MO", "gp"],
            ["MP", "pp"],
          ] as const).map(([label, key]) => (
            <div key={key} className="flex items-center justify-between">
              <span>
                {label}: {coins[key]}
              </span>
            </div>
          ))}
        </div>
        <div className="flex mt-3 gap-3">
          <Button
            size="sm"
            onClick={() => {
              setMode("coins");
              setCoinFlow("add");
              setInvOpen(true);
            }}
          >
            Aggiungi
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setMode("coins");
              setCoinFlow("remove");
              setInvOpen(true);
            }}
          >
            Rimuovi
          </Button>
        </div>
      </div>

      <Separator className="my-3" />

      {/* Armi */}
      {attacks?.length > 0 && (
        <div className="space-y-2 mb-4">
          <div className="font-semibold text-primary">Armi</div>
          {attacks.map((atk: any, i: number) => (
            <div key={`${atk.name}-${i}`} className="flex items-center justify-between text-sm dnd-frame p-2">
              <div className="flex-1">
                <div className="font-medium">
                  {atk.name} {atk.equipped ? "(equipaggiata)" : ""}
                </div>
                <div className="text-muted-foreground">
                  {/* nuovo dettaglio */}
                  {(() => {
                    const bonus = typeof atk.attackBonus === "number" ? `+${atk.attackBonus}` : "";
                    const dice = atk.damageDice || "";
                    const type = atk.damageType || "";
                    const cat = atk.category;
                    const hands =
                      cat === "melee" && atk.hands
                        ? atk.hands === "1" ? " • 1 mano" : atk.hands === "2" ? " • 2 mani" : " • versatile"
                        : "";
                    const range = cat === "ranged" && atk.range ? ` • gittata: ${atk.range}` : "";
                    const dmg = [dice, type].filter(Boolean).join(" ");
                    return [bonus, "•", dmg, hands, range].filter(Boolean).join(" ");
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {atk.name && atk.attackBonus !== undefined && (atk.damageDice || atk.damageType) && (
                  <Button
                    size="sm"
                    variant={atk.equipped ? "outline" : "default"}
                    onClick={() => toggleEquipAttack(i)}
                  >
                    {atk.equipped ? "Disequipaggia" : "Equipaggia"}
                  </Button>
                )}
                <Button size="icon" variant="ghost" aria-label="Rimuovi arma" onClick={() => removeAttack(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Oggetti strutturati */}
      <div className="space-y-2">
        <div className="font-semibold text-primary">Oggetti</div>

        {/* Oggetti/consumabili (nuovo schema) */}
        {structuredItems.map((it: any, index: number) => {
          if (!it) return null;
          if (it.type === "object") {
            return (
              <div key={`obj-${index}`} className="flex items-center justify-between text-sm dnd-frame p-2">
                <div className="flex-1">
                  <div className="font-medium">
                    {it.name} {it.equippable ? (it.equipped ? "(equipaggiato)" : "") : ""}
                  </div>
                  {it.description && <div className="text-muted-foreground whitespace-pre-wrap">{it.description}</div>}
                  {/* skillsByType per oggetti: solo chips */}
                  {it.skillsByType && (
                    <div className="mt-2 space-y-1">
                      {(["volonta", "incontro", "riposoBreve", "riposoLungo"] as const).map((t) => {
                        const arr = (it.skillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;
                        if (!arr?.length) return null;
                        return (
                          <div key={`obj-${t}`} className="text-xs">
                            <div className="font-medium text-muted-foreground">
                              {t === "volonta" ? "Volontà" : t === "incontro" ? "Incontro" : t === "riposoBreve" ? "Riposo Breve" : "Riposo Lungo"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {arr.map((s, si) => (
                                <span key={`obj-${t}-${si}`} className="italic">{s.name}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {it.equippable && (
                    <Button size="sm" variant={it.equipped ? "outline" : "default"} onClick={() => toggleEquipItem(index)}>
                      {it.equipped ? "Disequipaggia" : "Equipaggia"}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" aria-label="Rimuovi oggetto" onClick={() => removeStructuredItem(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          }

          // consumable
          return (
            <div key={`cons-${index}`} className="flex items-center justify-between text-sm dnd-frame p-2">
              <div className="flex-1">
                <div className="font-medium">
                  {it.name} 
                </div>
                {it.subtype === "potion" && it.dice && (
                  <div className="text-muted-foreground">{it.dice}</div>
                )}
                {/* NEW: mostra descrizione (danni/effetti) se presente */}
                {it.description && (
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                    {it.description}
                  </div>
                )}
                {/* skillsByType opzionale: chips */}
                {it.skillsByType && (
                  <div className="mt-2 space-y-1">
                    {(["volonta", "incontro", "riposoBreve", "riposoLungo"] as const).map((t) => {
                      const arr = (it.skillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;
                      if (!arr?.length) return null;
                      return (
                        <div key={`cons-${t}`} className="text-xs">
                          <div className="font-medium text-muted-foreground">
                            {t === "volonta" ? "Volontà" : t === "incontro" ? "Incontro" : t === "riposoBreve" ? "Riposo Breve" : "Riposo Lungo"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {arr.map((s, si) => (
                              <span key={`cons-${t}-${si}`} className="italic">{s.name}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded border">
                  <button
                    className="px-2 py-1 text-lg leading-none"
                    aria-label="Decrementa quantità"
                    onClick={() => bumpConsumableQuantity(index, -1)}
                  >
                    –
                  </button>
                  <div className="px-2 py-1 min-w-[2.5rem] text-center font-medium">
                    {it.quantity ?? 0}
                  </div>
                  <button
                    className="px-2 py-1 text-lg leading-none"
                    aria-label="Incrementa quantità"
                    onClick={() => bumpConsumableQuantity(index, +1)}
                  >
                    +
                  </button>
                </div>
                <Button size="icon" variant="ghost" aria-label="Rimuovi consumabile" onClick={() => removeStructuredItem(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modale */}
      <Dialog
        open={invOpen}
        onOpenChange={(v) => {
          setInvOpen(v);
          if (!v) resetInvForm();
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm" onClick={() => { setMode("item"); setCoinFlow(null); }}>
            Aggiungi
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "coins"
                ? coinFlow === "add"
                  ? "Aggiungi monete"
                  : "Rimuovi monete"
                : "Aggiungi elemento"}
          </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Tipo</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-2 gap-2 mb-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="coins" id="r-coins" />
                  <Label htmlFor="r-coins">Monete</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="item" id="r-item" />
                  <Label htmlFor="r-item">Inventario</Label>
                </div>
              </RadioGroup>

              {mode === "item" && (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={itemKind === "weapon" ? "default" : "outline"}
                    onClick={() => setItemKind("weapon")}
                  >
                    Arma
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={itemKind === "object" ? "default" : "outline"}
                    onClick={() => setItemKind("object")}
                  >
                    Oggetto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={itemKind === "consumable" ? "default" : "outline"}
                    onClick={() => setItemKind("consumable")}
                  >
                    Consumabile
                  </Button>
                </div>
              )}
            </div>

            {mode === "coins" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <Label className="mb-1 block">Taglio</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {(["mr", "ma", "me", "mo", "mp"] as CoinAbbr[]).map((abbr) => (
                      <Button
                        key={abbr}
                        type="button"
                        variant={coinType === abbr ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCoinType(abbr)}
                      >
                        {abbr.toUpperCase()}
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
              </div>
            ) : (
              <>
                {/* Campo nome comune */}
                <div>
                  <Label className="mb-1 block">Nome *</Label>
                  <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Es. Spada lunga" />
                </div>

                {/* Sezione specifica per tipo */}
                {itemKind === "weapon" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
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
                    </div>

                    {/* Categoria arma */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={characterData?.__weaponCategory === "melee" ? "default" : "outline"}
                        onClick={() => (characterData.__weaponCategory = "melee")}
                      >
                        Mischia
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={characterData?.__weaponCategory === "ranged" ? "default" : "outline"}
                        onClick={() => (characterData.__weaponCategory = "ranged")}
                      >
                        Distanza
                      </Button>
                    </div>

                    {/* Sotto-opzioni (mani / gittata / tipo danno) */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Mani (solo mischia) */}
                      <div className={cn(characterData?.__weaponCategory === "melee" ? "" : "opacity-50 pointer-events-none")}>
                        <Label className="mb-1 block">Impugnatura</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["1", "2", "versatile"] as const).map((h) => (
                            <Button
                              key={h}
                              type="button"
                              size="sm"
                              variant={characterData?.__weaponHands === h ? "default" : "outline"}
                              onClick={() => (characterData.__weaponHands = h)}
                            >
                              {h === "1" ? "1 mano" : h === "2" ? "2 mani" : "Versatile"}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Gittata (solo distanza) */}
                      <div className={cn(characterData?.__weaponCategory === "ranged" ? "" : "opacity-50 pointer-events-none")}>
                        <Label className="mb-1 block">Gittata</Label>
                        <Input
                          value={characterData?.__weaponRange || ""}
                          onChange={(e) => (characterData.__weaponRange = e.target.value)}
                          placeholder="Es. 24/96 m"
                        />
                      </div>

                      {/* Tipo di danno */}
                      <div>
                        <Label className="mb-1 block">Tipo di danno</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["tagliente", "perforante", "contundente"] as const).map((k) => (
                            <Button
                              key={k}
                              type="button"
                              size="sm"
                              variant={characterData?.__damageKind === k ? "default" : "outline"}
                              onClick={() => (characterData.__damageKind = k)}
                            >
                              {k}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Skills categorizzate */}
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

                {itemKind === "object" && (
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 block">Descrizione</Label>
                      <textarea
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        className="w-full border rounded px-2 py-1 h-24"
                        placeholder='Es. "CA: 11 + DES" oppure testo libero.'
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="equippable" checked={itemEquippable} onCheckedChange={setItemEquippable} />
                      <Label htmlFor="equippable">Equipaggiabile</Label>
                    </div>

                    {/* Skills categorizzate (oggetti) */}
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

                {itemKind === "consumable" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <Label className="mb-1 block">Quantità</Label>
                        <Input
                          inputMode="numeric"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(e.target.value)}
                          placeholder="Es. 5"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="mb-1 block">Sottotipo</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={itemConsumableSubtype === "generic" ? "default" : "outline"}
                            onClick={() => setItemConsumableSubtype("generic")}
                          >
                            Generico
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={itemConsumableSubtype === "potion" ? "default" : "outline"}
                            onClick={() => setItemConsumableSubtype("potion")}
                          >
                            Pozione
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Pozioni: dado cura */}
                    {itemConsumableSubtype === "potion" && (
                      <div>
                        <Label className="mb-1 block">Dado (cura)</Label>
                        <Input
                          value={potionDice}
                          onChange={(e) => setPotionDice(e.target.value)}
                          placeholder="Es. 2d4+2"
                        />
                      </div>
                    )}

                    {/* NEW: descrizione per consumabili */}
                    <div>
                      <Label className="mb-1 block">Descrizione (opzionale)</Label>
                      <textarea
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        placeholder='Es. "Munizioni (dardo). Danno 1d4 perforante; +2d4 veleno, TS COS CD 12: metà."'
                        className="w-full border rounded px-2 py-1 h-24"
                      />
                    </div>

                    {/* Skills categorizzate (se vuoi) */}
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
              onClick={() => {
                if (mode === "coins") {
                  handleInventorySubmit(); // monete: stesso flusso di prima
                  return;
                }
                if (itemKind === "weapon") {
                  handleInventorySubmit({
                    kind: "weapon",
                    weaponCategory: (characterData as any).__weaponCategory,
                    weaponHands: (characterData as any).__weaponHands,
                    weaponRange: (characterData as any).__weaponRange,
                    damageKind: (characterData as any).__damageKind,
                  });
                  return;
                }
                if (itemKind === "object") {
                  handleInventorySubmit({
                    kind: "object",
                    description: itemDescription,
                    equippable: !!itemEquippable,
                  });
                  return;
                }
                if (itemKind === "consumable") {
                  handleInventorySubmit({
                    kind: "consumable",
                    consumableSubtype: (["generic", "potion"] as const).includes(itemConsumableSubtype)
                      ? itemConsumableSubtype
                      : "generic",
                    quantity: Number(itemQuantity) || 0,
                    potionDice,
                    description: itemDescription, // NEW
                  });
                  return;
                }
              }}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default Inventory;
