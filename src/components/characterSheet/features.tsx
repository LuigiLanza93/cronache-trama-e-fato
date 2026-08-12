import { useEffect } from "react";
import { ArrowRightLeft, Check, Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import SectionCard from "@/components/characterSheet/section-card";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { convertSpellSlots, updateCharacter, updateCharacterWithAck } from "@/realtime";

const MAX_SPELL_LEVEL = 12;
const SPELL_SLOT_CONVERSION_COSTS: Record<number, number> = {
    2: 3,
    3: 5,
    4: 7,
    5: 9,
    6: 12,
    7: 15,
    8: 18,
    9: 22,
};
const SLOT_CONVERSION_EXCLUDED_CLASSES = new Set(["warlock", "guerriero", "fighter", "ladro", "rogue"]);
const createSlotConversionRequestId = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const canonicalizeSpellSlotState = (spellSlots: Record<number, unknown>) =>
    JSON.stringify(
        Object.fromEntries(
            Array.from({ length: 9 }, (_, index) => {
                const level = index + 1;
                const slots = spellSlots[level];
                const state = Array.isArray(slots)
                    ? slots.map((slot) => (slot && typeof slot === "object" && (slot as { active?: boolean }).active === true ? "1" : "0")).join("")
                    : "";
                return [String(level), state];
            })
        )
    );

const Features = ({
    characterData,
    stripName,
    parseClassFromFeatureTitle,
    parseLevelFromFeatureTitle,
    findSpell,
    openFeatureModal,
    setAddSpellOpen,
    spellSlotTable,
    canEdit = true,
}: any) => {
    const [slotConversionOpen, setSlotConversionOpen] = useState(false);
    const [conversionTargetLevel, setConversionTargetLevel] = useState<number | null>(null);
    const [conversionSelections, setConversionSelections] = useState<Record<number, number>>({});
    const [conversionSubmitting, setConversionSubmitting] = useState(false);
    const conversionRequestIdRef = useRef<string | null>(null);
    const expectedSlotStateRef = useRef<string | null>(null);

    const resetSlotConversionRequest = () => {
        conversionRequestIdRef.current = null;
        expectedSlotStateRef.current = null;
    };

    const toggleSlot = (level: number, index: number) => {
        if (!canEdit) return;
        const slots = characterData.combatStats.spellSlots[level];
        const updated = slots.map((s: any, idx: number) =>
            idx === index ? { ...s, active: !s.active } : s
        );

        updateCharacter(characterData.slug, {
            combatStats: {
                spellSlots: {
                    [level]: updated,
                },
            },
        });
    };

    const resetSlots = () => {
        if (!canEdit) return;
        const patch: Record<string, any> = { combatStats: { spellSlots: {} } };

        for (let lvl = 1; lvl <= MAX_SPELL_LEVEL; lvl++) {
            if (characterData.combatStats.spellSlots?.[lvl]) {
                patch.combatStats.spellSlots[lvl] = characterData.combatStats.spellSlots[lvl].map(
                    (slot: any) => ({ ...slot, active: false })
                );
            }
        }

        updateCharacter(characterData.slug, patch);
    };

    const orderedFeatures = [...characterData.features]
        .map((feature: any, index: number) => {
            const baseName = stripName(feature.name);
            const cls = parseClassFromFeatureTitle(feature.name);
            const lvl = parseLevelFromFeatureTitle(feature.name);
            const match = findSpell(baseName, cls, lvl);
            const spellLevel = match?.level ?? lvl ?? null;
            const isSpellLike = spellLevel !== null;

            return { feature, index, baseName, match, spellLevel, isSpellLike };
        })
        .sort((a, b) => {
            if (a.isSpellLike && b.isSpellLike) {
                if ((a.spellLevel ?? 0) !== (b.spellLevel ?? 0)) return (a.spellLevel ?? 0) - (b.spellLevel ?? 0);
                return a.baseName.localeCompare(b.baseName, "it");
            }
            if (a.isSpellLike && !b.isSpellLike) return -1;
            if (!a.isSpellLike && b.isSpellLike) return 1;
            return a.index - b.index;
        });

    const spellLevelLabel = (level: number) => {
        if (level === 0) {
            return characterData.basicInfo.class === "Guerriero" ? "Manovre" : "Trucchetti";
        }
        return `Livello ${level}`;
    };
    const normalizedClass = (characterData.basicInfo.class ?? "").trim().toLowerCase();
    const compactSlotRow = ["guerriero", "fighter", "warlock"].includes(normalizedClass);
    const canConvertSpellSlots = !SLOT_CONVERSION_EXCLUDED_CLASSES.has(normalizedClass);
    const spellSlots = useMemo(
        () => characterData.combatStats.spellSlots ?? {},
        [characterData.combatStats.spellSlots]
    );
    const slotInitializationPreview = useMemo(() => {
        const charClass = String(characterData?.basicInfo?.class ?? "").trim().toLowerCase();
        const level = characterData?.basicInfo?.level;
        const progression = spellSlotTable?.[charClass];
        const expectedSlots = progression?.[level] ?? progression?.[String(level)] ?? null;
        if (!expectedSlots) return null;

        const changes: Array<{ level: number; current: number; expected: number }> = [];
        for (let spellLevel = 1; spellLevel <= MAX_SPELL_LEVEL; spellLevel++) {
            const current = Array.isArray(spellSlots[spellLevel]) ? spellSlots[spellLevel].length : 0;
            const expected = Number(expectedSlots[spellLevel] ?? 0);
            if (current !== expected) changes.push({ level: spellLevel, current, expected });
        }
        return changes;
    }, [characterData?.basicInfo?.class, characterData?.basicInfo?.level, spellSlotTable, spellSlots]);

    const initializeStandardSpellSlots = async () => {
        if (!canEdit || !slotInitializationPreview?.length) return;
        const nextSlots: Record<number, unknown[]> = {};
        for (const { level, expected } of slotInitializationPreview) {
            const current = Array.isArray(spellSlots[level]) ? spellSlots[level] : [];
            nextSlots[level] = Array.from({ length: expected }, (_, index) => {
                const existing = current[index];
                return existing && typeof existing === "object"
                    ? existing
                    : { id: index + 1, active: false };
            });
        }
        try {
            await updateCharacterWithAck(characterData.slug, { combatStats: { spellSlots: nextSlots } });
            toast.success("Slot standard inizializzati.");
        } catch {
            // The active sheet renders the actionable save/conflict feedback.
        }
    };
    const conversionTargets = useMemo(
        () => Object.keys(SPELL_SLOT_CONVERSION_COSTS)
            .map(Number)
            .filter((level) => {
                const slots = spellSlots[level];
                return Array.isArray(slots) && slots.length > 0 && slots.some((slot: { active?: boolean }) => slot.active === true);
            }),
        [spellSlots]
    );
    const conversionSources = useMemo(() => {
        if (!conversionTargetLevel) return [];

        return Array.from({ length: conversionTargetLevel - 1 }, (_, index) => index + 1)
            .map((level) => ({
                level,
                available: Array.isArray(spellSlots[level])
                    ? spellSlots[level].filter((slot: { active?: boolean }) => slot.active !== true).length
                    : 0,
            }))
            .filter(({ available }) => available > 0);
    }, [conversionTargetLevel, spellSlots]);
    const conversionCost = conversionTargetLevel ? SPELL_SLOT_CONVERSION_COSTS[conversionTargetLevel] ?? 0 : 0;
    const conversionValue = Object.entries(conversionSelections).reduce(
        (total, [level, quantity]) => total + Number(level) * quantity,
        0
    );
    const conversionExcess = Math.max(0, conversionValue - conversionCost);
    const conversionMissing = Math.max(0, conversionCost - conversionValue);
    const conversionProgress = conversionCost > 0
        ? Math.min(100, Math.round((conversionValue / conversionCost) * 100))
        : 0;
    const conversionBreakdown = Object.entries(conversionSelections)
        .filter(([, quantity]) => quantity > 0)
        .sort(([leftLevel], [rightLevel]) => Number(leftLevel) - Number(rightLevel))
        .map(([level, quantity]) => `${quantity}× L${level}`)
        .join(" + ");

    const openSlotConversion = () => {
        if (!canEdit) return;
        resetSlotConversionRequest();
        setConversionTargetLevel(conversionTargets.length === 1 ? conversionTargets[0] : null);
        setConversionSelections({});
        setSlotConversionOpen(true);
    };

    const closeSlotConversion = () => {
        if (conversionSubmitting) return;
        resetSlotConversionRequest();
        setSlotConversionOpen(false);
    };

    const selectConversionTarget = (value: string) => {
        resetSlotConversionRequest();
        setConversionTargetLevel(Number(value));
        setConversionSelections({});
    };

    const updateConversionSelection = (level: number, value: string) => {
        const available = conversionSources.find((source) => source.level === level)?.available ?? 0;
        const quantity = Math.min(available, Math.max(0, Number(value) || 0));
        setConversionSelections((current) => {
            if ((current[level] ?? 0) === quantity) return current;
            resetSlotConversionRequest();
            return { ...current, [level]: quantity };
        });
    };

    useEffect(() => {
        if (conversionTargetLevel && !conversionTargets.includes(conversionTargetLevel)) {
            resetSlotConversionRequest();
            setConversionTargetLevel(null);
            setConversionSelections({});
        }
    }, [conversionTargetLevel, conversionTargets]);

    useEffect(() => {
        const availableByLevel = new Map(conversionSources.map(({ level, available }) => [level, available]));
        setConversionSelections((current) => {
            let changed = false;
            const next: Record<number, number> = {};

            Object.entries(current).forEach(([levelKey, quantity]) => {
                const level = Number(levelKey);
                const available = availableByLevel.get(level) ?? 0;
                const clamped = Math.min(quantity, available);
                if (clamped !== quantity) changed = true;
                if (clamped > 0) next[level] = clamped;
            });

            if (changed || Object.keys(next).length !== Object.keys(current).length) {
                resetSlotConversionRequest();
                return next;
            }

            return current;
        });
    }, [conversionSources]);

    const submitSlotConversion = async () => {
        if (!canEdit || !conversionTargetLevel || conversionValue < conversionCost || conversionSubmitting) return;

        const selections = Object.fromEntries(
            Object.entries(conversionSelections).filter(([, quantity]) => quantity > 0)
        ) as Record<number, number>;
        if (Object.keys(selections).length === 0) return;

        setConversionSubmitting(true);
        try {
            const requestId = conversionRequestIdRef.current ?? createSlotConversionRequestId();
            const expectedSlotState = expectedSlotStateRef.current ?? canonicalizeSpellSlotState(spellSlots);
            conversionRequestIdRef.current = requestId;
            expectedSlotStateRef.current = expectedSlotState;
            await convertSpellSlots(characterData.slug, conversionTargetLevel, selections, requestId, expectedSlotState);
            toast.success("Slot incantesimo convertiti.");
            resetSlotConversionRequest();
            setSlotConversionOpen(false);
            setConversionTargetLevel(null);
            setConversionSelections({});
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Non sono riuscito a convertire gli slot incantesimo.");
            if (typeof error === "object" && error !== null && "code" in error && error.code === "STALE_SLOT_STATE") {
                resetSlotConversionRequest();
                setSlotConversionOpen(false);
                setConversionTargetLevel(null);
                setConversionSelections({});
            }
        } finally {
            setConversionSubmitting(false);
        }
    };

    const nonSpellFeatures = orderedFeatures.filter(({ isSpellLike }) => !isSpellLike);
    const spellFeatures = orderedFeatures.filter(({ isSpellLike }) => isSpellLike);
    const spellGroups = spellFeatures.reduce((acc, entry) => {
        const level = entry.spellLevel ?? 0;
        if (!acc[level]) acc[level] = [];
        acc[level].push(entry);
        return acc;
    }, {} as Record<number, typeof spellFeatures>);
    const spellLevels = Object.keys(spellGroups).map(Number).sort((a, b) => a - b);

    return (
        <>
        <SectionCard
            cardId="features"
            title={<span>Tratti e Abilità</span>}
            actions={
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
                    aria-label="Aggiungi incantesimo"
                    title="Aggiungi incantesimo"
                    onClick={() => {
                        if (!canEdit) return;
                        setAddSpellOpen(true);
                    }}
                    disabled={!canEdit}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            }
        >
            <div className="space-y-3">
                {nonSpellFeatures.map(({ feature, index, baseName }) => (
                    <div key={index} className="dnd-frame rounded p-3">
                        <button
                            type="button"
                            onClick={() => openFeatureModal(feature, index)}
                            className="w-full min-w-0 rounded-sm text-left hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-primary">{baseName}</div>
                                    <div className="line-clamp-1 text-xs text-muted-foreground">
                                        {feature.description}
                                    </div>
                                </div>
                                {feature.uses && (
                                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                                        {feature.uses}
                                    </Badge>
                                )}
                            </div>
                        </button>
                    </div>
                ))}

                {spellLevels.map((level) => (
                    <div key={level} className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
                            {spellLevelLabel(level)}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {spellGroups[level].map(({ feature, index, baseName, match }) => (
                                <div key={index} className="dnd-frame rounded p-3">
                                    <button
                                        type="button"
                                        onClick={() => openFeatureModal(feature, index)}
                                        className="w-full min-w-0 rounded-sm text-left hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <div className="flex items-start justify-between gap-1.5">
                                            <div className="min-w-0">
                                                <div className="line-clamp-2 pr-1 text-sm font-semibold leading-snug text-primary">
                                                    {baseName}
                                                </div>
                                                {match ? (
                                                    <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
                                                        {match.school}
                                                        {match.concentration ? " · Concentrazione" : ""}
                                                        {match.ritual ? " · Rituale" : ""}
                                                    </div>
                                                ) : null}
                                            </div>
                                            {feature.uses && (
                                                <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                                                    {feature.uses}
                                                </Badge>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
                        Slot Incantesimi
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {slotInitializationPreview?.length ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs"
                                onClick={() => void initializeStandardSpellSlots()}
                                disabled={!canEdit}
                            >
                                Inizializza slot
                            </Button>
                        ) : null}
                        {canConvertSpellSlots ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 px-2 text-xs"
                                aria-label="Converti slot incantesimo"
                                title={conversionTargets.length > 0 ? "Converti slot incantesimo" : "Servono slot incantesimo consumati da ripristinare"}
                                onClick={openSlotConversion}
                                disabled={!canEdit || conversionTargets.length === 0}
                            >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                Converti slot
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
                            aria-label="Resetta slot incantesimi"
                            title="Resetta slot incantesimi"
                            onClick={resetSlots}
                            disabled={!canEdit}
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className={cn("gap-3", compactSlotRow ? "flex flex-wrap" : "grid grid-cols-3")}>
                    {Array.from({ length: MAX_SPELL_LEVEL }).map((_, lvlIdx) => {
                        const lvl = lvlIdx + 1;
                        const lvlSlots = characterData.combatStats.spellSlots?.[lvl];
                        if (!lvlSlots || lvlSlots.length === 0) return null;

                        return (
                            <div
                                key={lvl}
                                className={cn(
                                    "rounded-lg border border-border/50 bg-background/25 p-2",
                                    compactSlotRow ? "min-w-fit" : ""
                                )}
                            >
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
                                    {characterData.basicInfo.class === "Guerriero" ? (
                                        <>
                                            Manovre
                                            <br />
                                            1d{lvl}
                                        </>
                                    ) : (
                                        <>Livello {lvl}</>
                                    )}
                                </div>
                                <div className={cn("gap-2", compactSlotRow ? "flex flex-nowrap gap-1.5" : "grid grid-cols-2")}>
                                    {lvlSlots.map((slot: any, i: number) => (
                                        <button
                                            type="button"
                                            key={i}
                                            onClick={() => toggleSlot(lvl, i)}
                                            disabled={!canEdit}
                                            aria-label={`Slot incantesimo di livello ${lvl}, ${slot.active ? "consumato" : "disponibile"}`}
                                            aria-pressed={Boolean(slot.active)}
                                            className={cn(
                                                "flex items-center justify-center rounded border text-[10px] transition focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60",
                                                compactSlotRow ? "h-6 w-6 shrink-0" : "h-7 w-7",
                                                slot.active ? "bg-primary text-primary-foreground" : "bg-background"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {slotInitializationPreview?.length ? (
                    <p className="text-xs text-muted-foreground">
                        La progressione standard propone modifiche a {slotInitializationPreview.map(({ level, current, expected }) => `L${level}: ${current}→${expected}`).join(", ")}. Applica solo con “Inizializza slot”.
                    </p>
                ) : null}
            </div>
        </SectionCard>

        <Dialog
            open={slotConversionOpen}
            onOpenChange={(open) => {
                if (open) {
                    if (!conversionSubmitting && canEdit) setSlotConversionOpen(true);
                    return;
                }
                closeSlotConversion();
            }}
        >
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Converti slot incantesimo</DialogTitle>
                    <DialogDescription>
                        Recupera uno slot consumato usando slot disponibili di livello inferiore.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label id="slot-conversion-target-label">Slot da recuperare</Label>
                        <div
                            className="flex flex-wrap gap-2"
                            role="group"
                            aria-labelledby="slot-conversion-target-label"
                        >
                            {conversionTargets.map((level) => {
                                const selected = conversionTargetLevel === level;
                                return (
                                    <Button
                                        key={level}
                                        type="button"
                                        size="sm"
                                        variant={selected ? "default" : "outline"}
                                        className="h-9 rounded-full px-3 text-xs shadow-none"
                                        aria-pressed={selected}
                                        onClick={() => selectConversionTarget(level.toString())}
                                        disabled={!canEdit || conversionSubmitting}
                                    >
                                        <span>Liv. {level}</span>
                                        <span className={cn("ml-1 opacity-75", selected && "text-primary-foreground")}>· {SPELL_SLOT_CONVERSION_COSTS[level]}</span>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    {conversionTargetLevel ? (
                        <>
                            {conversionSources.length > 0 ? (
                                <div className="space-y-1">
                                    <div className="pb-1 text-sm font-medium text-primary">Slot da spendere</div>
                                    {conversionSources.map(({ level, available }) => (
                                        <div key={level} className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium">Livello {level}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {available} {available === 1 ? "slot disponibile" : "slot disponibili"}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`Slot di livello ${level} da spendere`}>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-9 w-9 rounded-full"
                                                    onClick={() => updateConversionSelection(level, String((conversionSelections[level] ?? 0) - 1))}
                                                    disabled={!canEdit || conversionSubmitting || (conversionSelections[level] ?? 0) === 0}
                                                    aria-label={`Rimuovi uno slot di livello ${level}`}
                                                >
                                                    <Minus className="h-3.5 w-3.5" />
                                                </Button>
                                                <output className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                                                    {conversionSelections[level] ?? 0}
                                                </output>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-9 w-9 rounded-full"
                                                    onClick={() => updateConversionSelection(level, String((conversionSelections[level] ?? 0) + 1))}
                                                    disabled={!canEdit || conversionSubmitting || (conversionSelections[level] ?? 0) >= available}
                                                    aria-label={`Aggiungi uno slot di livello ${level}`}
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm text-muted-foreground">
                                    Non ci sono slot di livello inferiore disponibili da spendere.
                                </p>
                            )}

                            <div className="space-y-2 border-y border-border/60 py-3 text-sm">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-muted-foreground">Sacrificio</span>
                                    <span className="font-medium tabular-nums">{conversionValue} <span className="font-normal text-muted-foreground">/ {conversionCost}</span></span>
                                </div>
                                {conversionValue > 0 ? (
                                    <p className="text-xs text-muted-foreground">{conversionBreakdown}</p>
                                ) : null}
                                <Progress value={conversionProgress} className="h-1.5" aria-label={`Valore selezionato ${conversionValue} su costo ${conversionCost}`} />
                                <p className={cn("flex items-center gap-1.5 text-xs", conversionMissing > 0 ? "text-muted-foreground" : conversionExcess > 0 ? "text-amber-700 dark:text-amber-400" : "text-primary")} aria-live="polite">
                                    {conversionMissing === 0 && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                    {conversionMissing > 0
                                        ? `Mancano ${conversionMissing} punti di valore.`
                                        : conversionExcess > 0
                                            ? `Eccedenza: ${conversionExcess} punti di valore.`
                                            : "Costo coperto esattamente."}
                                </p>
                            </div>
                        </>
                    ) : null}
                </div>

                <DialogFooter className="mt-1 gap-2 sm:gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={closeSlotConversion}
                        disabled={conversionSubmitting}
                    >
                        Annulla
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        onClick={submitSlotConversion}
                        disabled={!canEdit || !conversionTargetLevel || conversionValue < conversionCost || conversionSubmitting}
                    >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        {conversionSubmitting ? "Conversione in corso…" : "Recupera slot"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
};

export default Features;

