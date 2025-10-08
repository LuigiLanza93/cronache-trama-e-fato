import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    /** --- nuove props per skills categorizzate --- */
    itemSkill,                 // legacy (ignorata nella UI nuova, ma lasciata per compatibilità)
    setItemSkill,              // legacy
    itemSkillType,             // "volonta" | "incontro" | "riposoBreve" | "riposoLungo"
    setItemSkillType,
    itemSkillInput,
    setItemSkillInput,
    itemSkillsByType,          // { volonta: SkillEntry[]; incontro: ...; riposoBreve: ...; riposoLungo: ... }
    setItemSkillsByType,
    /** --- fine nuove props --- */
    invError,
    removeAttack,
    removeItem,
    toggleEquipAttack,
}: any) => {
    const COIN_KEYS = {
        mr: "cp",
        ma: "sp",
        me: "ep",
        mo: "gp",
        mp: "pp",
    } as const;
    type CoinAbbr = keyof typeof COIN_KEYS;

    // === mapping categorie ===
    const SKILL_TYPES = ["volonta", "incontro", "riposoBreve", "riposoLungo"] as const;
    type SkillType = typeof SKILL_TYPES[number];
    const LABELS: Record<SkillType, string> = {
        volonta: "Volontà",
        incontro: "Incontro",
        riposoBreve: "Riposo Breve",
        riposoLungo: "Riposo Lungo",
    };

    // === helpers per aggiungere/rimuovere skill per categoria ===
    const addSkillToCurrentType = (raw: string) => {
        const s = (raw ?? "").trim();
        if (!s) return;
        const t = itemSkillType as SkillType;
        const list = (itemSkillsByType?.[t] ?? []) as Array<{ name: string; used: boolean }>;

        // evita duplicati (case-insensitive)
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

    return (
        <Card className="character-section">
            <div className="character-section-title">Inventario</div>
            <div className="mb-4 text-sm">
                <div className="font-semibold text-primary mb-2">Monete</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                        ["MR", "cp"],
                        ["MA", "sp"],
                        ["ME", "ep"],
                        ["MO", "gp"],
                        ["MP", "pp"],
                    ]).map(([label, key]) => (
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
            {characterData.equipment.attacks?.length > 0 && (
                <div className="space-y-2 mb-4">
                    <div className="font-semibold text-primary">Armi</div>
                    {characterData.equipment.attacks.map((atk: any, i: number) => (
                        <div key={`${atk.name}-${i}`} className="flex items-center justify-between text-sm dnd-frame p-2">
                            <div className="flex-1">
                                <div className="font-medium">
                                    {atk.name} {atk.equipped ? "(equipaggiata)" : ""}
                                </div>
                                <div className="text-muted-foreground">
                                    +{atk.attackBonus} • {atk.damageType}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {atk.name && atk.attackBonus !== undefined && atk.damageType && (
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
            <div>
                <div className="font-semibold text-primary">Oggetti</div>
                {characterData.equipment.equipment.map((item: string, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                        <span>• {item}</span>
                        <Button size="icon" variant="ghost" aria-label="Rimuovi oggetto" onClick={() => removeItem(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

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
                                : "Aggiungi oggetto"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2 block">Tipo</Label>
                            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-2 gap-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="coins" id="r-coins" />
                                    <Label htmlFor="r-coins">Monete</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="item" id="r-item" />
                                    <Label htmlFor="r-item">Oggetto</Label>
                                </div>
                            </RadioGroup>
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
                            <div className="space-y-3">
                                <div>
                                    <Label className="mb-1 block">Nome *</Label>
                                    <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Es. Spada lunga" />
                                </div>
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
                                        <Label className="mb-1 block">Tipo di danno</Label>
                                        <Input
                                            value={itemDmgType}
                                            onChange={(e) => setItemDmgType(e.target.value)}
                                            placeholder="Es. 1d8+3 tagliente"
                                        />
                                    </div>
                                </div>

                                {/* ====== SKILL CATEGORIZZATE ====== */}
                                <div className="space-y-2">
                                    <Label className="block">Skill (per categoria)</Label>

                                    {/* Selettore categoria */}
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

                                    {/* Input singolo per aggiungere una skill nella categoria selezionata */}
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

                                    {/* Chip per ciascuna categoria (solo se presenti) */}
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
                                {/* ====== /SKILL CATEGORIZZATE ====== */}
                            </div>
                        )}

                        {invError && <div className="text-sm text-red-600">{invError}</div>}
                    </div>

                    <DialogFooter className="mt-2">
                        <DialogClose asChild>
                            <Button variant="outline">Annulla</Button>
                        </DialogClose>
                        <Button onClick={handleInventorySubmit}>Salva</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

export default Inventory;
