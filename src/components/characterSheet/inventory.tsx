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