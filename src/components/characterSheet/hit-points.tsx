import { useEffect, useState } from "react";
import { Heart, ShieldPlus, ShieldX, Sword, Plus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/characterSheet/section-card";
import { updateCharacter } from "@/realtime";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const HIT_DICE_BY_CLASS: Record<string, string> = {
    barbaro: "1d12",
    barbarian: "1d12",
    guerriero: "1d10",
    fighter: "1d10",
    paladino: "1d10",
    paladin: "1d10",
    ranger: "1d10",
    bardo: "1d8",
    bard: "1d8",
    chierico: "1d8",
    cleric: "1d8",
    druido: "1d8",
    druid: "1d8",
    monaco: "1d8",
    monk: "1d8",
    ladro: "1d8",
    rogue: "1d8",
    warlock: "1d8",
    stregone: "1d6",
    sorcerer: "1d6",
    mago: "1d6",
    wizard: "1d6",
};

const HitPoints = ({
    characterData,
    setCharacterData,
    abilityModifier,
}: any) => {
    const [hpChangeAmount, setHpChangeAmount] = useState("");
    const [combatToolsOpen, setCombatToolsOpen] = useState(false);
    const normalizedClass = (characterData.basicInfo.class ?? "").trim().toLowerCase();
    const derivedHitDice = HIT_DICE_BY_CLASS[normalizedClass] ?? characterData.combatStats.hitDice;

    useEffect(() => {
        // Calculate max HP
        const conMod = abilityModifier(characterData.abilityScores["constitution"]);
        const dice = parseInt(derivedHitDice.split("d")[1], 10);
        const maxHP = (conMod + dice) * characterData.basicInfo.level;
        const nextCombatStats = {
            ...characterData.combatStats,
            hitDice: derivedHitDice,
            hitPointMaximum: maxHP,
        };

        if (
            characterData.combatStats.hitPointMaximum !== maxHP ||
            characterData.combatStats.hitDice !== derivedHitDice
        ) {
            setCharacterData((prev: any) => ({
                ...prev,
                combatStats: nextCombatStats,
            }));
            // Update on server (and JSON file)
            if (characterData.slug) {
                setTimeout(() => {
                    updateCharacter(characterData.slug, {
                        combatStats: {
                            hitDice: derivedHitDice,
                            hitPointMaximum: maxHP,
                        },
                    });
                }, 500);
            }
        }
    }, [
        characterData.abilityScores["constitution"],
        derivedHitDice,
        characterData.basicInfo.level,
        characterData.basicInfo.class,
        setCharacterData,
        characterData.combatStats.hitPointMaximum,
        characterData.combatStats.hitDice,
        characterData.slug,
    ]);

    const applyCombatStatsUpdate = (nextCombatStats: any) => {
        setCharacterData((prev: any) => ({
            ...prev,
            combatStats: nextCombatStats,
        }));

        if (characterData.slug) {
            updateCharacter(characterData.slug, { combatStats: nextCombatStats });
        }
    };

    const parsedAmount = parseInt(hpChangeAmount, 10);
    const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

    const applyDamage = () => {
        if (!validAmount) return;

        const current = characterData.combatStats.currentHitPoints ?? 0;
        const temp = characterData.combatStats.temporaryHitPoints ?? 0;
        const damageToTemp = Math.min(temp, validAmount);
        const remainingDamage = validAmount - damageToTemp;

        const nextCombatStats = {
            ...characterData.combatStats,
            temporaryHitPoints: temp - damageToTemp,
            currentHitPoints: Math.max(0, current - remainingDamage),
        };

        applyCombatStatsUpdate(nextCombatStats);
        setHpChangeAmount("");
    };

    const applyHealing = () => {
        if (!validAmount) return;

        const current = characterData.combatStats.currentHitPoints ?? 0;
        const max = characterData.combatStats.hitPointMaximum ?? 0;
        const nextCombatStats = {
            ...characterData.combatStats,
            currentHitPoints: Math.min(max, current + validAmount),
        };

        applyCombatStatsUpdate(nextCombatStats);
        setHpChangeAmount("");
    };

    const setTemporaryHitPoints = () => {
        if (!validAmount) return;

        const nextCombatStats = {
            ...characterData.combatStats,
            temporaryHitPoints: validAmount,
        };

        applyCombatStatsUpdate(nextCombatStats);
        setHpChangeAmount("");
    };

    const clearTemporaryHitPoints = () => {
        const nextCombatStats = {
            ...characterData.combatStats,
            temporaryHitPoints: 0,
        };

        applyCombatStatsUpdate(nextCombatStats);
    };

    return (
        <SectionCard
            cardId="hitPoints"
            title={
                <span className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-primary" />
                    Punti ferita
                </span>
            }
        >
            <div className="space-y-4">
                <Collapsible open={combatToolsOpen} onOpenChange={setCombatToolsOpen}>
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 text-center"
                            aria-expanded={combatToolsOpen}
                        >
                            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
                                <span>{characterData.combatStats.currentHitPoints}</span>
                                <span>/</span>
                                <span>{characterData.combatStats.hitPointMaximum}</span>
                                {(characterData.combatStats.temporaryHitPoints ?? 0) > 0 && (
                                    <span className="text-lg text-sky-600">
                                        (+{characterData.combatStats.temporaryHitPoints})
                                    </span>
                                )}
                            </div>
                            <ChevronDown
                                className={`h-5 w-5 text-muted-foreground transition-transform ${combatToolsOpen ? "rotate-180" : ""}`}
                            />
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                        <div className="space-y-3 pt-1">
                            <div>
                                <Label className="text-xs text-muted-foreground">Valore</Label>
                                <Input
                                    inputMode="numeric"
                                    value={hpChangeAmount}
                                    onChange={(e) => setHpChangeAmount(e.target.value)}
                                    placeholder="Es. 8"
                                    className="mt-1 text-center"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={applyDamage}
                                    disabled={!validAmount}
                                    className="justify-start"
                                >
                                    <Sword className="mr-2 h-4 w-4 text-red-600" />
                                    Danni
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={applyHealing}
                                    disabled={!validAmount}
                                    className="justify-start"
                                >
                                    <Plus className="mr-2 h-4 w-4 text-green-600" />
                                    Cura
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={setTemporaryHitPoints}
                                    disabled={!validAmount}
                                    className="justify-start"
                                >
                                    <ShieldPlus className="mr-2 h-4 w-4 text-sky-600" />
                                    Imposta Temp
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={clearTemporaryHitPoints}
                                    disabled={(characterData.combatStats.temporaryHitPoints ?? 0) <= 0}
                                    className="justify-start"
                                >
                                    <ShieldX className="mr-2 h-4 w-4 text-muted-foreground" />
                                    Azzera Temp
                                </Button>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
                <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="text-muted-foreground">Dado Vita:</span>
                    <span className="font-bold text-primary">{derivedHitDice}</span>
                </div>
            </div>
        </SectionCard>
    )
};

export default HitPoints;
