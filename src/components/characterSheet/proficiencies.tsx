import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { updateCharacter } from "@/realtime";

const Proficiencies = ({
    characterData,
    proficiencyBonus,
    deathSaves,
    setDeathSaves,
    calculateSkillValues,
}: any) => {
    // ===== Edit mode per le ABILITÀ =====
    const [editingSkills, setEditingSkills] = useState(false);

    // Mappa persistita: { nomeSkill -> proficient:boolean }
    const persistedProfsMap = useMemo(() => {
        const m: Record<string, boolean> = {};
        (characterData?.proficiencies?.skills ?? []).forEach((s: any) => {
            if (s?.name) m[s.name] = !!s.proficient;
        });
        return m;
    }, [characterData?.proficiencies?.skills]);

    // Draft locale durante la modifica
    const [draftProfs, setDraftProfs] = useState<Record<string, boolean>>(persistedProfsMap);

    // Riallinea il draft ai dati persistiti quando esco/entro da editing
    useEffect(() => {
        if (!editingSkills) setDraftProfs(persistedProfsMap);
    }, [persistedProfsMap, editingSkills]);

    const toggleDraft = (name: string) => {
        if (!editingSkills) return; // non editabile fuori da edit mode
        setDraftProfs((prev) => ({ ...prev, [name]: !prev[name] }));
    };

    const handleSaveSkills = () => {
        // Costruisco l'array completo delle skill da salvare
        const calcSkills: Array<{ name: string; ability: string; value: number }> =
            calculateSkillValues(characterData) || [];

        // Persisto solo name, ability, proficient (niente value)
        const nextSkills = calcSkills.map((s) => ({
            name: s.name,
            ability: s.ability,
            proficient: !!draftProfs[s.name],
        }));

        updateCharacter(characterData.slug, {
            proficiencies: {
                ...characterData.proficiencies,
                skills: nextSkills,
            },
        });

        setEditingSkills(false);
    };

    const handleCancelSkills = () => {
        setDraftProfs(persistedProfsMap);
        setEditingSkills(false);
    };

    const profBonus = proficiencyBonus(characterData.basicInfo.level);
    const skillsCalc = calculateSkillValues(characterData) || [];

    return (
        <Card className="character-section">
            <div className="character-section-title">Competenze & Abilità</div>
            <div className="space-y-3">
                <div>
                    <Label className="text-xs text-muted-foreground">Bonus competenze</Label>
                    <div className="text-lg font-bold text-primary">
                        +{profBonus}
                    </div>
                </div>

                <Separator />

                <div>
                    <Label className="text-xs text-muted-foreground">Tiri salvezza</Label>
                    <div className="space-y-1">
                        {characterData.proficiencies.savingThrows.map((save: string) => (
                            <Badge key={save} variant="secondary" className="mr-1">
                                {save}
                            </Badge>
                        ))}
                    </div>

                    <div className="character-section-title flex items-center gap-2 mt-8">
                        Tiri Salvezza Morte
                    </div>
                    <div className="flex flex-col gap-3 mt-2">
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1">Riuscita</Label>
                            <div className="flex gap-3">
                                {deathSaves.success.map((checked: boolean, i: number) => (
                                    <label
                                        key={`success-${i}`}
                                        className={`flex flex-col items-center cursor-pointer ${checked ? "opacity-100" : "opacity-70"}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={i > 0 && !deathSaves.success[i - 1]}
                                            onChange={() => {
                                                const next = [...deathSaves.success];
                                                next[i] = !next[i];
                                                if (!next[i]) {
                                                    for (let j = i + 1; j < next.length; j++) next[j] = false;
                                                }
                                                const successes = next.filter(Boolean).length;
                                                setDeathSaves({ ...deathSaves, success: next });

                                                if (characterData.slug) {
                                                    updateCharacter(characterData.slug, {
                                                        combatStats: {
                                                            ...characterData.combatStats,
                                                            deathSaves: {
                                                                ...characterData.combatStats.deathSaves,
                                                                successes,
                                                            },
                                                        },
                                                    });
                                                }
                                            }}
                                            aria-label={`Riuscita ${i + 1}`}
                                            className="w-5 h-5 accent-green-600 rounded border-2 border-green-400"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1">Fallimento</Label>
                            <div className="flex gap-3">
                                {deathSaves.fail.map((checked: boolean, i: number) => (
                                    <label
                                        key={`fail-${i}`}
                                        className={`flex flex-col items-center cursor-pointer ${checked ? "opacity-100" : "opacity-70"}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={i > 0 && !deathSaves.fail[i - 1]}
                                            onChange={() => {
                                                const next = [...deathSaves.fail];
                                                next[i] = !next[i];
                                                if (!next[i]) {
                                                    for (let j = i + 1; j < next.length; j++) next[j] = false;
                                                }
                                                const failures = next.filter(Boolean).length;
                                                setDeathSaves({ ...deathSaves, fail: next });

                                                if (characterData.slug) {
                                                    updateCharacter(characterData.slug, {
                                                        combatStats: {
                                                            ...characterData.combatStats,
                                                            deathSaves: {
                                                                ...characterData.combatStats.deathSaves,
                                                                failures,
                                                            },
                                                        },
                                                    });
                                                }
                                            }}
                                            aria-label={`Fallimento ${i + 1}`}
                                            className="deathsave-checkbox w-5 h-5 accent-red-600 rounded border-2 border-red-400"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="!mt-6">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Abilità</Label>
                        {!editingSkills ? (
                            <Button size="sm" variant="outline" onClick={() => setEditingSkills(true)}>
                                Modifica
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={handleCancelSkills}>
                                    Annulla
                                </Button>
                                <Button size="sm" onClick={handleSaveSkills}>
                                    Salva
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1 text-sm mt-2">
                        {skillsCalc.map((skill: any) => {
                            const name = skill.name as string;

                            // Stato mostrato: draft se in editing, altrimenti persistito
                            const isProficient = editingSkills
                                ? !!draftProfs[name]
                                : !!persistedProfsMap[name];

                            const total = skill.value + (isProficient ? profBonus : 0);
                            const totalStr = total >= 0 ? `+${total}` : `${total}`;
                            const baseStr = skill.value >= 0 ? `+${skill.value}` : `${skill.value}`;

                            const rowClass = `flex items-start justify-between rounded px-2 py-1 ${
                                isProficient ? "bg-primary/5 border border-primary/30" : ""
                            }`;
                            const nameClass = `text-primary ${isProficient ? "font-bold" : "font-medium"}`;

                            return (
                                <div key={name} className={rowClass}>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={isProficient}
                                            disabled={!editingSkills}
                                            onChange={() => toggleDraft(name)}
                                            className="h-4 w-4"
                                            aria-label={`Proficienza: ${name}`}
                                        />
                                        <span className={nameClass}>
                                            {name} ({(skill.ability || "").slice(0, 3)}):
                                        </span>
                                    </label>

                                    <div className="text-right">
                                        <div className="text-black font-medium">
                                            {totalStr}
                                            {isProficient && (
                                                <span className="ml-1 text-xs text-muted-foreground">
                                                    ({baseStr} + {profBonus})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default Proficiencies;
