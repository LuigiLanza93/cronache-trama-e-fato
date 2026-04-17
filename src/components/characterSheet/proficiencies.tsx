import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { updateCharacter } from "@/realtime";
import { Check, Eye, Settings2, X } from "lucide-react";
import SectionCard from "@/components/characterSheet/section-card";
import { resolveCharacterAbilityScores } from "@/utils";

const SAVING_THROW_ORDER = [
    { key: "strength", short: "For", matches: ["strength", "forza", "for"] },
    { key: "dexterity", short: "Des", matches: ["dexterity", "destrezza", "des"] },
    { key: "constitution", short: "Cos", matches: ["constitution", "costituzione", "cos"] },
    { key: "intelligence", short: "Int", matches: ["intelligence", "intelligenza", "int"] },
    { key: "wisdom", short: "Sag", matches: ["wisdom", "saggezza", "sag"] },
    { key: "charisma", short: "Car", matches: ["charisma", "carisma", "car"] },
] as const;

const SECTION_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90";

const Proficiencies = ({
    characterData,
    proficiencyBonus,
    abilityModifier,
    deathSaves,
    setDeathSaves,
    calculateSkillValues,
    skillsCatalog,
    passiveCapabilities = [],
    passiveEffectContext = {},
}: any) => {
    // ===== Edit mode per le ABILITÃ€ =====
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
            calculateSkillValues(characterData, skillsCatalog) || [];

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
    const resolvedAbilityData = useMemo(
        () => resolveCharacterAbilityScores(characterData, passiveCapabilities, passiveEffectContext),
        [characterData, passiveCapabilities, passiveEffectContext]
    );
    const resolvedAbilityScores = resolvedAbilityData.scores;
    const skillsCalc =
        calculateSkillValues(characterData, skillsCatalog, {
            passiveCapabilities,
            passiveEffectContext,
            resolvedAbilityScores,
        }) || [];
    const normalizedClass = (characterData?.basicInfo?.class ?? "").trim().toLowerCase();

    const spellcastingAbilityByClass: Record<string, string> = {
        bardo: "charisma",
        bard: "charisma",
        chierico: "wisdom",
        cleric: "wisdom",
        druido: "wisdom",
        druid: "wisdom",
        mago: "intelligence",
        wizard: "intelligence",
        stregone: "charisma",
        sorcerer: "charisma",
        warlock: "charisma",
        paladino: "charisma",
        paladin: "charisma",
        ranger: "wisdom",
    };

    const spellcastingAbility = spellcastingAbilityByClass[normalizedClass];
    const spellSaveDc =
        spellcastingAbility
            ? 8 + profBonus + abilityModifier(resolvedAbilityScores[spellcastingAbility] ?? 10)
            : null;

    // ===== Percezione passiva =====
    // Trova l'oggetto skill "Percezione" (fallback: "Perception")
    const perceptionSkill = skillsCalc.find(
        (s: any) =>
            typeof s?.name === "string" &&
            ["percezione", "perception"].includes(s.name.toLowerCase())
    );
    const wisMod = perceptionSkill?.value ?? 0;
    // Usa la mappa persistita (non il draft) per il calcolo ufficiale
    const isPerceptionProficient = !!persistedProfsMap[perceptionSkill?.name ?? "Percezione"];
    const passivePerception = 10 + wisMod + (isPerceptionProficient ? profBonus : 0);
    const savingThrowProficiencies = (characterData?.proficiencies?.savingThrows ?? []).map((save: string) =>
        typeof save === "string" ? save.trim().toLowerCase() : ""
    );
    const savingThrows = SAVING_THROW_ORDER.map(({ key, short, matches }) => {
        const modifier = abilityModifier(resolvedAbilityScores[key] ?? 10);
        const proficient = matches.some((match) => savingThrowProficiencies.includes(match));
        const total = modifier + (proficient ? profBonus : 0);

        return {
            key,
            short,
            proficient,
            total,
        };
    });

    return (
        <SectionCard cardId="proficiencies" title="Competenze & AbilitÃ ">
            <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex min-h-[3.5rem] flex-col justify-between">
                        <Label className={SECTION_LABEL_CLASS}>Bonus competenze</Label>
                        <div className="text-lg font-bold text-primary">
                            +{profBonus}
                        </div>
                    </div>
                    <div className="flex min-h-[3.5rem] flex-col justify-between">
                        <Label className={SECTION_LABEL_CLASS}>CD Incantesimi</Label>
                        <div className="text-lg font-bold text-primary">
                            {spellSaveDc ?? "-"}
                        </div>
                    </div>
                    <div className="flex min-h-[3.5rem] flex-col justify-between">
                        <Label className={`${SECTION_LABEL_CLASS} flex items-center gap-1`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            Perc. passiva
                        </Label>
                        <div
                            className="text-lg font-bold text-primary"
                            aria-label={`Percezione passiva: ${passivePerception}`}
                        >
                            {passivePerception}
                        </div>
                    </div>
                </div>

                <Separator />

                <div>
                    <Label className={SECTION_LABEL_CLASS}>Tiri salvezza</Label>
                    <div className="mt-2 grid grid-cols-6 gap-2">
                        {savingThrows.map((save) => (
                            <div
                                key={save.key}
                                className={`ability-score flex min-w-0 flex-col items-center px-1 py-2 ${
                                    save.proficient ? "border-primary/40 bg-primary/5" : ""
                                }`}
                            >
                                <div
                                    className={`text-xs text-center font-medium uppercase ${
                                        save.proficient ? "text-primary" : "text-muted-foreground"
                                    }`}
                                >
                                    {save.short}
                                </div>
                                <div
                                    className={`mt-1 text-lg font-bold ${
                                        save.proficient ? "text-primary" : "text-foreground"
                                    }`}
                                >
                                    {save.total >= 0 ? `+${save.total}` : save.total}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="character-section-title flex items-center gap-2 mt-8">
                        Tiri Salvezza Morte
                    </div>
                    <div className="flex flex-col gap-3 mt-2">
                        <div>
                            <Label className={`${SECTION_LABEL_CLASS} mb-1`}>Riuscita</Label>
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
                            <Label className={`${SECTION_LABEL_CLASS} mb-1`}>Fallimento</Label>
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
                        <Label className={SECTION_LABEL_CLASS}>Abilità</Label>
                        {!editingSkills ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent"
                                onClick={() => setEditingSkills(true)}
                                aria-label="Modifica abilitÃ "
                                title="Modifica abilitÃ "
                            >
                                <Settings2 className="h-4 w-4 text-primary" />
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={handleSaveSkills}
                                    aria-label="Salva abilitÃ "
                                    title="Salva abilitÃ "
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={handleCancelSkills}
                                    aria-label="Annulla modifiche abilitÃ "
                                    title="Annulla modifiche abilitÃ "
                                >
                                    <X className="h-4 w-4" />
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
                                        <div className="font-medium text-foreground">
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
        </SectionCard>
    );
};

export default Proficiencies;

