import { useEffect } from "react";
import { Plus, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SectionCard from "@/components/characterSheet/section-card";
import { cn } from "@/lib/utils";
import { updateCharacter } from "@/realtime";

const MAX_SPELL_LEVEL = 12;

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
    const toggleSlot = (level: number, index: number) => {
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

    useEffect(() => {
        const charClass = (characterData?.basicInfo?.class ?? "").toLowerCase();
        const level = characterData?.basicInfo?.level;

        if (!charClass || !level || !spellSlotTable || Object.keys(spellSlotTable).length === 0) {
            return;
        }

        const classProgression = spellSlotTable[charClass];
        if (!classProgression) {
            return;
        }

        const expectedSlots = classProgression[level] || classProgression[String(level)] || {};
        const currentSlots = characterData.combatStats.spellSlots || {};

        const patch: Record<string, any> = { combatStats: { spellSlots: {} } };
        let needsUpdate = false;

        for (let spellLvl = 1; spellLvl <= MAX_SPELL_LEVEL; spellLvl++) {
            const expectedCount = expectedSlots[spellLvl] || 0;
            const currentArr = currentSlots[spellLvl] || [];
            const updated = [...currentArr];

            while (updated.length < expectedCount) {
                updated.push({ id: updated.length + 1, active: false });
                needsUpdate = true;
            }

            if (updated.length > expectedCount) {
                updated.length = expectedCount;
                needsUpdate = true;
            }

            if (needsUpdate) {
                patch.combatStats.spellSlots[spellLvl] = updated;
            }
        }

        if (needsUpdate) {
            setTimeout(() => {
                updateCharacter(characterData.slug, patch);
            }, 500);
        }
    }, [characterData.slug, characterData.basicInfo.class, characterData.basicInfo.level, spellSlotTable]);

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
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
                        Slot Incantesimi
                    </span>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
                        aria-label="Resetta slot incantesimi"
                        title="Resetta slot incantesimi"
                        onClick={resetSlots}
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
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
                                            key={i}
                                            onClick={() => toggleSlot(lvl, i)}
                                            className={cn(
                                                "flex items-center justify-center rounded border text-[10px]",
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
            </div>
        </SectionCard>
    );
};

export default Features;

