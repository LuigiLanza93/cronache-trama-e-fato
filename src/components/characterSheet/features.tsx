import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateCharacter } from "@/realtime";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import SPELL_SLOT_TABLE from "@/data/spellSlots.json"; // <-- il mega JSON

const MAX_SPELL_LEVEL = 9;

const Features = ({
    characterData,
    stripName,
    parseClassFromFeatureTitle,
    parseLevelFromFeatureTitle,
    findSpell,
    openFeatureModal,
    setAddSpellOpen,
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

    // 🧙‍♂️ Check all'avvio: se gli slot non matchano, aggiorna
    useEffect(() => {
        const charClass = characterData.basicInfo.class.toLowerCase();
        const level = characterData.basicInfo.level;

        const expectedSlots = SPELL_SLOT_TABLE[charClass]?.[level] || {};
        const currentSlots = characterData.combatStats.spellSlots || {};

        const patch: Record<string, any> = { combatStats: { spellSlots: {} } };
        let needsUpdate = false;

        for (let spellLvl = 1; spellLvl <= MAX_SPELL_LEVEL; spellLvl++) {
            const expectedCount = expectedSlots[spellLvl] || 0;
            const currentArr = currentSlots[spellLvl] || [];
            const updated = [...currentArr];

            // Aggiungi slot mancanti
            while (updated.length < expectedCount) {
                updated.push({ id: updated.length + 1, active: false });
                needsUpdate = true;
            }

            // Taglia slot extra
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
    }, [characterData.slug, characterData.basicInfo.class, characterData.basicInfo.level]);

    return (
        <Card className="character-section">
            <div className="character-section-title flex items-center justify-between">
                <span>Tratti e Abilità</span>
            </div>
            <div className="space-y-3">
                {characterData.features.map((feature: any, index: number) => {
                    const baseName = stripName(feature.name);
                    const cls = parseClassFromFeatureTitle(feature.name);
                    const lvl = parseLevelFromFeatureTitle(feature.name);
                    const match = findSpell(baseName, cls, lvl);

                    return (
                        <button
                            key={index}
                            onClick={() => openFeatureModal(feature)}
                            className="w-full text-left dnd-frame p-3 rounded hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                    <div className="font-semibold text-primary truncate">{baseName}</div>
                                    {match ? (
                                        <div className="text-xs text-muted-foreground">
                                            Lv {match.level} · {match.school}
                                            {match.concentration ? " · Concentrazione" : ""}
                                            {match.ritual ? " · Rituale" : ""}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground line-clamp-1">{feature.description}</div>
                                    )}
                                </div>
                                {feature.uses && (
                                    <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                                        {feature.uses}
                                    </Badge>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            <Button size="sm" className="mt-4" onClick={() => setAddSpellOpen(true)}>
                Aggiungi incantesimo
            </Button>

            {/* Sezione Slot Incantesimi */}
            <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="font-semibold">Slot Incantesimi</span>
                    <Button size="sm" variant="outline" onClick={resetSlots}>
                        Reset
                    </Button>
                </div>
                <div className="space-y-1">
                    {Array.from({ length: MAX_SPELL_LEVEL }).map((_, lvlIdx) => {
                        const lvl = lvlIdx + 1;
                        const lvlSlots = characterData.combatStats.spellSlots?.[lvl];
                        if (!lvlSlots || lvlSlots.length === 0) return null;
                        return (
                            <div key={lvl}>
                                <div className="text-xs text-muted-foreground mb-1">
                                    Livello {lvl}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {lvlSlots.map((slot: any, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => toggleSlot(lvl, i)}
                                            className={cn(
                                                "w-5 h-5 rounded border flex items-center justify-center text-[10px]",
                                                slot.active
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-background"
                                            )}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};

export default Features;
