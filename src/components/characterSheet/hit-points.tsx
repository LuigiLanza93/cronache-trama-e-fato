import { useEffect, useMemo, useState } from "react";
import { Heart, ShieldPlus, ShieldX, Sword, Plus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/characterSheet/section-card";
import { updateCharacter } from "@/realtime";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { resolveCharacterAbilityScores } from "@/utils";

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

function resolvePassiveHitPointEffectValue(effect: any, resolvedAbilityScores: Record<string, number>, level: number, abilityModifier: any) {
    if (String(effect?.operationType ?? "BONUS").trim().toUpperCase() === "SET") {
        return 0;
    }

    const mode = String(effect?.valueMode ?? "FLAT").trim().toUpperCase();
    const offset = Number(effect?.value ?? 0) || 0;
    const numerator = Math.max(1, Number(effect?.multiplierNumerator ?? 1) || 1);
    const denominator = Math.max(1, Number(effect?.multiplierDenominator ?? 1) || 1);
    const rounding = String(effect?.rounding ?? "FLOOR").trim().toUpperCase();

    const applyScale = (baseValue: number) => {
        const scaled = (baseValue * numerator) / denominator;
        const rounded =
            denominator === 1
                ? scaled
                : rounding === "CEIL"
                    ? Math.ceil(scaled)
                    : Math.floor(scaled);
        return rounded + offset;
    };

    const sourceAbility = String(effect?.sourceAbility ?? "").trim().toLowerCase();
    const sourceScore = resolvedAbilityScores[sourceAbility] ?? 10;

    switch (mode) {
        case "ABILITY_MODIFIER":
            return applyScale(abilityModifier(sourceScore));
        case "ABILITY_SCORE":
            return applyScale(sourceScore);
        case "PROFICIENCY_BONUS":
            return applyScale(level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2);
        case "CHARACTER_LEVEL":
            return applyScale(level);
        default:
            return offset;
    }
}

function isTriggerActive(trigger: string | undefined, context: any) {
    switch (String(trigger ?? "ALWAYS").trim().toUpperCase()) {
        case "ALWAYS":
            return true;
        case "WHILE_ARMORED":
            return !!context?.hasArmorEquipped;
        case "WHILE_SHIELD_EQUIPPED":
            return !!context?.hasShieldEquipped;
        default:
            return false;
    }
}

const HitPoints = ({
    characterData,
    setCharacterData,
    abilityModifier,
    passiveCapabilities = [],
    passiveEffectContext = {},
}: any) => {
    const [hpChangeAmount, setHpChangeAmount] = useState("");
    const [combatToolsOpen, setCombatToolsOpen] = useState(false);
    const normalizedClass = (characterData.basicInfo.class ?? "").trim().toLowerCase();
    const derivedHitDice = HIT_DICE_BY_CLASS[normalizedClass] ?? characterData.combatStats.hitDice;
    const resolvedAbilityData = resolveCharacterAbilityScores(
        characterData,
        passiveCapabilities,
        passiveEffectContext
    );
    const resolvedConstitution = resolvedAbilityData.scores.constitution ?? 10;
    const hitPointBonusData = useMemo(() => {
        const level = Number(characterData?.basicInfo?.level ?? 1);
        const capabilities = Array.isArray(passiveCapabilities) ? passiveCapabilities : [];
        const activeEffects = capabilities
            .filter((capability) => String(capability?.kind ?? "passive").toLowerCase() === "passive")
            .flatMap((capability) =>
                (Array.isArray(capability?.passiveEffects) ? capability.passiveEffects : [])
                    .filter((effect) => effect?.target === "HIT_POINT_MAX")
                    .filter((effect) => isTriggerActive(effect?.trigger, passiveEffectContext))
                    .map((effect) => {
                        const value = resolvePassiveHitPointEffectValue(
                            effect,
                            resolvedAbilityData.scores,
                            level,
                            abilityModifier
                        );
                        if (!Number.isFinite(value) || value === 0) return null;

                        const sourceName = String(capability?.name ?? "").trim() || "Effetto passivo";
                        const sourceLabel = String(capability?.sourceLabel ?? "").trim();
                        return {
                            label: sourceLabel ? `${sourceName} (${sourceLabel})` : sourceName,
                            value,
                        };
                    })
                    .filter(Boolean)
            ) as Array<{ label: string; value: number }>;

        return {
            bonusTotal: activeEffects.reduce((sum, effect) => sum + effect.value, 0),
            breakdown: activeEffects,
        };
    }, [
        abilityModifier,
        characterData?.basicInfo?.level,
        passiveCapabilities,
        passiveEffectContext,
        resolvedAbilityData.scores,
    ]);

    useEffect(() => {
        // Calculate max HP
        const conMod = abilityModifier(resolvedConstitution);
        const dice = parseInt(derivedHitDice.split("d")[1], 10);
        const baseMaxHP = (conMod + dice) * characterData.basicInfo.level;
        const maxHP = baseMaxHP + hitPointBonusData.bonusTotal;
        const nextCombatStats = {
            ...characterData.combatStats,
            hitDice: derivedHitDice,
            hitPointMaximum: maxHP,
            currentHitPoints: Math.min(characterData.combatStats.currentHitPoints ?? 0, maxHP),
        };

        if (
            characterData.combatStats.hitPointMaximum !== maxHP ||
            characterData.combatStats.hitDice !== derivedHitDice ||
            (characterData.combatStats.currentHitPoints ?? 0) !== nextCombatStats.currentHitPoints
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
                            currentHitPoints: nextCombatStats.currentHitPoints,
                        },
                    });
                }, 500);
            }
        }
    }, [
        resolvedConstitution,
        derivedHitDice,
        hitPointBonusData.bonusTotal,
        characterData.basicInfo.level,
        characterData.basicInfo.class,
        setCharacterData,
        characterData.combatStats.hitPointMaximum,
        characterData.combatStats.hitDice,
        characterData.combatStats.currentHitPoints,
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
                            <div className="space-y-1 text-center">
                                {hitPointBonusData.bonusTotal !== 0 && (
                                    <div className="text-xs font-medium text-primary">
                                        Bonus PF max {hitPointBonusData.bonusTotal >= 0 ? `+${hitPointBonusData.bonusTotal}` : hitPointBonusData.bonusTotal}
                                    </div>
                                )}
                                {hitPointBonusData.breakdown.length > 0 && (
                                    <div className="space-y-1 text-[11px] text-muted-foreground">
                                        {hitPointBonusData.breakdown.map((entry, index) => (
                                            <div key={`hp-bonus-${index}`}>
                                                {entry.label}: {entry.value >= 0 ? `+${entry.value}` : entry.value}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
