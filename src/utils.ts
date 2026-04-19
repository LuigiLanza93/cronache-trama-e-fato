import { matchesSkillPassiveEffectTarget } from "@/lib/passive-effect-skills";

function coerce(value: string, kind: "string" | "int" | "float") {
    if (kind === "int") {
        const n = parseInt(value, 10);
        return Number.isNaN(n) ? 0 : n;
    }
    if (kind === "float") {
        const n = parseFloat(value);
        return Number.isNaN(n) ? 0 : n;
    }
    return value;
}

/** Immutable set: returns a new object with value set at dot-path */
function setAtPathImmutable<T extends Record<string, any>>(
    obj: T,
    path: string,
    value: any
): T {
    const parts = path.split(".");
    const clone = Array.isArray(obj) ? (obj.slice() as any) : { ...obj };
    let cur: any = clone;

    for (let i = 0; i < parts.length; i++) {
        const key = parts[i];
        const isLast = i === parts.length - 1;

        const prevVal = cur[key];

        if (isLast) {
            cur[key] = value;
        } else {
            const nextVal =
                prevVal && typeof prevVal === "object"
                    ? Array.isArray(prevVal)
                        ? prevVal.slice()
                        : { ...prevVal }
                    : {};
            cur[key] = nextVal;
            cur = nextVal;
        }
    }

    return clone;
}

/** Build a minimal nested patch object from a dot-path and value */
function buildPatch(path: string, value: any) {
    const parts = path.split(".");
    const root: any = {};
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
        const k = parts[i];
        if (i === parts.length - 1) cur[k] = value;
        else {
            cur[k] = {};
            cur = cur[k];
        }
    }
    return root;
}

function abilityModifier(score) {
    return Math.floor((score - 10) / 2);
}

type ResolvedAbilityKey =
    | "strength"
    | "dexterity"
    | "constitution"
    | "intelligence"
    | "wisdom"
    | "charisma";

type PassiveEffectContext = {
    hasArmorEquipped?: boolean;
    hasShieldEquipped?: boolean;
    hasSingleMeleeWeaponEquipped?: boolean;
    hasDualWielding?: boolean;
    hasTwoHandedWeaponEquipped?: boolean;
};

type PassiveEffectLike = {
    target?: string;
    trigger?: string;
    valueMode?: string;
    value?: number;
    sourceAbility?: string;
    multiplierNumerator?: number;
    multiplierDenominator?: number;
    rounding?: string;
    operationType?: string;
    setMode?: string;
    setValue?: number;
    capValue?: number;
    notes?: string;
};

type PassiveCapabilityLike = {
    name?: string;
    sourceLabel?: string;
    kind?: string;
    passiveEffects?: PassiveEffectLike[];
};

type ResolvedAbilityBreakdownEntry = {
    kind: "base" | "set" | "bonus" | "cap";
    label: string;
    before?: number;
    delta?: number;
    after: number;
};

type ResolvedAbilityScoreDetail = {
    ability: ResolvedAbilityKey;
    baseScore: number;
    resolvedScore: number;
    isModified: boolean;
    breakdown: ResolvedAbilityBreakdownEntry[];
    appliedEffects: Array<{
        capabilityName?: string;
        sourceLabel?: string;
        effect: PassiveEffectLike;
    }>;
};

type ResolvedAbilityScoresResult = {
    scores: Record<ResolvedAbilityKey, number>;
    details: Record<ResolvedAbilityKey, ResolvedAbilityScoreDetail>;
};

const RESOLVED_ABILITY_KEYS: ResolvedAbilityKey[] = [
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
];

const PASSIVE_TARGET_TO_ABILITY_KEY: Record<string, ResolvedAbilityKey> = {
    STRENGTH_SCORE: "strength",
    DEXTERITY_SCORE: "dexterity",
    CONSTITUTION_SCORE: "constitution",
    INTELLIGENCE_SCORE: "intelligence",
    WISDOM_SCORE: "wisdom",
    CHARISMA_SCORE: "charisma",
};

function normalizeAbilityKey(value: string | undefined | null): ResolvedAbilityKey | null {
    const normalized = String(value ?? "").trim().toUpperCase();
    switch (normalized) {
        case "STRENGTH":
        case "STR":
        case "FORZA":
        case "FOR":
            return "strength";
        case "DEXTERITY":
        case "DEX":
        case "DESTREZZA":
        case "DES":
            return "dexterity";
        case "CONSTITUTION":
        case "CON":
        case "COSTITUZIONE":
        case "COS":
            return "constitution";
        case "INTELLIGENCE":
        case "INT":
        case "INTELLIGENZA":
            return "intelligence";
        case "WISDOM":
        case "WIS":
        case "SAGGEZZA":
        case "SAG":
            return "wisdom";
        case "CHARISMA":
        case "CHA":
        case "CARISMA":
        case "CAR":
            return "charisma";
        default:
            return null;
    }
}

function getBaseAbilityScores(characterData: any): Record<ResolvedAbilityKey, number> {
    const source = characterData?.abilityScores ?? {};
    return {
        strength: Number(source.STRENGTH ?? source.strength ?? source.STR ?? source.str ?? 10) || 10,
        dexterity: Number(source.DEXTERITY ?? source.dexterity ?? source.DEX ?? source.dex ?? 10) || 10,
        constitution: Number(source.CONSTITUTION ?? source.constitution ?? source.CON ?? source.con ?? 10) || 10,
        intelligence: Number(source.INTELLIGENCE ?? source.intelligence ?? source.INT ?? source.int ?? 10) || 10,
        wisdom: Number(source.WISDOM ?? source.wisdom ?? source.WIS ?? source.wis ?? 10) || 10,
        charisma: Number(source.CHARISMA ?? source.charisma ?? source.CHA ?? source.cha ?? 10) || 10,
    };
}

function isPassiveTriggerActive(trigger: string | undefined, context: PassiveEffectContext = {}) {
    switch (String(trigger ?? "ALWAYS").trim().toUpperCase()) {
        case "ALWAYS":
            return true;
        case "WHILE_ARMORED":
            return !!context.hasArmorEquipped;
        case "WHILE_SHIELD_EQUIPPED":
            return !!context.hasShieldEquipped;
        case "WHILE_WIELDING_SINGLE_MELEE_WEAPON":
            return !!context.hasSingleMeleeWeaponEquipped;
        case "WHILE_DUAL_WIELDING":
            return !!context.hasDualWielding;
        case "WHILE_WIELDING_TWO_HANDED_WEAPON":
            return !!context.hasTwoHandedWeaponEquipped;
        default:
            return false;
    }
}

function resolvePassiveEffectScalarValue(
    effect: PassiveEffectLike,
    characterData: any,
    resolvedAbilityScores: Record<string, number>
) {
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

    const sourceAbilityKey = normalizeAbilityKey(effect?.sourceAbility);
    const sourceScore =
        sourceAbilityKey
            ? resolvedAbilityScores[sourceAbilityKey.toLowerCase()] ??
            resolvedAbilityScores[sourceAbilityKey] ??
            10
            : 10;

    switch (mode) {
        case "ABILITY_MODIFIER":
            return applyScale(abilityModifier(sourceScore));
        case "ABILITY_SCORE":
            return applyScale(sourceScore);
        case "PROFICIENCY_BONUS":
            return applyScale(proficiencyBonus(Number(characterData?.basicInfo?.level ?? 1)));
        case "CHARACTER_LEVEL":
            return applyScale(Number(characterData?.basicInfo?.level ?? 1));
        default:
            return offset;
    }
}

function buildPassiveEffectLabel(capability: PassiveCapabilityLike, effect: PassiveEffectLike) {
    const base = String(capability?.name ?? "").trim() || String(effect?.notes ?? "").trim() || "Effetto passivo";
    const source = String(capability?.sourceLabel ?? "").trim();
    return source ? `${base} (${source})` : base;
}

function resolvePassiveEffectScalarForAbilityTarget(
    effect: PassiveEffectLike,
    characterData: any,
    baseAbilityScores: Record<ResolvedAbilityKey, number>,
    targetAbility: ResolvedAbilityKey
) {
    const mode = String(effect?.valueMode ?? "FLAT").trim().toUpperCase();
    if (mode === "ABILITY_MODIFIER" || mode === "ABILITY_SCORE") {
        return null;
    }
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

    switch (mode) {
        case "PROFICIENCY_BONUS":
            return applyScale(proficiencyBonus(Number(characterData?.basicInfo?.level ?? 1)));
        case "CHARACTER_LEVEL":
            return applyScale(Number(characterData?.basicInfo?.level ?? 1));
        default:
            return offset;
    }
}

function resolveCharacterAbilityScores(
    characterData: any,
    passiveCapabilities: PassiveCapabilityLike[] = [],
    context: PassiveEffectContext = {}
): ResolvedAbilityScoresResult {
    const baseAbilityScores = getBaseAbilityScores(characterData);

    const details = RESOLVED_ABILITY_KEYS.reduce((acc, ability) => {
        const target = `${ability.toUpperCase()}_SCORE`;
        const activeEffects = (Array.isArray(passiveCapabilities) ? passiveCapabilities : [])
            .filter((capability) => String(capability?.kind ?? "passive").toLowerCase() === "passive")
            .flatMap((capability) =>
                (Array.isArray(capability?.passiveEffects) ? capability.passiveEffects : [])
                    .filter((effect) => effect?.target === target)
                    .filter((effect) => isPassiveTriggerActive(effect?.trigger, context))
                    .map((effect) => ({
                        capabilityName: capability?.name,
                        sourceLabel: capability?.sourceLabel,
                        label: buildPassiveEffectLabel(capability, effect),
                        effect,
                    }))
            );

        let workingScore = baseAbilityScores[ability];
        const breakdown: ResolvedAbilityBreakdownEntry[] = [
            {
                kind: "base",
                label: "Valore base",
                after: workingScore,
            },
        ];
        const appliedEffects: ResolvedAbilityScoreDetail["appliedEffects"] = [];

        const setEffects = activeEffects
            .filter((entry) => String(entry.effect?.operationType ?? "BONUS").trim().toUpperCase() === "SET")
            .map((entry) => {
                const rawSetValue = Number(entry.effect?.setValue);
                if (!Number.isFinite(rawSetValue)) return null;
                const setMode = String(entry.effect?.setMode ?? "MINIMUM_FLOOR").trim().toUpperCase();
                const candidate =
                    setMode === "ABSOLUTE"
                        ? rawSetValue
                        : Math.max(baseAbilityScores[ability], rawSetValue);
                return {
                    ...entry,
                    candidate,
                };
            })
            .filter(Boolean) as Array<{
            capabilityName?: string;
            sourceLabel?: string;
            label: string;
            effect: PassiveEffectLike;
            candidate: number;
        }>;

        if (setEffects.length > 0) {
            const bestSet = setEffects.reduce((best, current) =>
                current.candidate > best.candidate ? current : best
            );
            if (bestSet.candidate !== workingScore) {
                breakdown.push({
                    kind: "set",
                    label: `${bestSet.label}: valore impostato`,
                    before: workingScore,
                    after: bestSet.candidate,
                });
                workingScore = bestSet.candidate;
                appliedEffects.push({
                    capabilityName: bestSet.capabilityName,
                    sourceLabel: bestSet.sourceLabel,
                    effect: bestSet.effect,
                });
            }
        }

        const bonusEffects = activeEffects
            .filter((entry) => String(entry.effect?.operationType ?? "BONUS").trim().toUpperCase() !== "SET")
            .map((entry) => {
                const resolvedValue = resolvePassiveEffectScalarForAbilityTarget(
                    entry.effect,
                    characterData,
                    baseAbilityScores,
                    ability
                );
                if (!Number.isFinite(resolvedValue) || resolvedValue === 0) return null;
                const capValue = Number(entry.effect?.capValue);
                return {
                    ...entry,
                    resolvedValue,
                    capValue: Number.isFinite(capValue) ? capValue : null,
                };
            })
            .filter(Boolean) as Array<{
            capabilityName?: string;
            sourceLabel?: string;
            label: string;
            effect: PassiveEffectLike;
            resolvedValue: number;
            capValue: number | null;
        }>;

        const uncappedBonuses = bonusEffects.filter((entry) => entry.capValue == null);
        const cappedBonuses = bonusEffects
            .filter((entry) => entry.capValue != null)
            .sort((a, b) => Number(a.capValue) - Number(b.capValue));

        [...uncappedBonuses, ...cappedBonuses].forEach((entry) => {
            const before = workingScore;
            let after = before + entry.resolvedValue;
            let breakdownKind: ResolvedAbilityBreakdownEntry["kind"] = "bonus";
            let label = entry.label;

            if (entry.capValue != null) {
                breakdownKind = "cap";
                label = `${entry.label}: max ${entry.capValue}`;
                if (entry.resolvedValue > 0) {
                    const availableGrowth = Math.max(0, entry.capValue - before);
                    after = before + Math.min(entry.resolvedValue, availableGrowth);
                }
            }

            const delta = after - before;
            if (delta === 0) return;

            breakdown.push({
                kind: breakdownKind,
                label,
                before,
                delta,
                after,
            });
            workingScore = after;
            appliedEffects.push({
                capabilityName: entry.capabilityName,
                sourceLabel: entry.sourceLabel,
                effect: entry.effect,
            });
        });

        acc[ability] = {
            ability,
            baseScore: baseAbilityScores[ability],
            resolvedScore: workingScore,
            isModified: workingScore !== baseAbilityScores[ability],
            breakdown,
            appliedEffects,
        };

        return acc;
    }, {} as Record<ResolvedAbilityKey, ResolvedAbilityScoreDetail>);

    const scores = RESOLVED_ABILITY_KEYS.reduce((acc, ability) => {
        acc[ability] = details[ability].resolvedScore;
        return acc;
    }, {} as Record<ResolvedAbilityKey, number>);

    return { scores, details };
}

function proficiencyBonus(level: number): number {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2; // livello 1-4
}

function calculateSkillValues(
    character,
    skillsCatalog = [],
    options: {
        passiveCapabilities?: PassiveCapabilityLike[];
        passiveEffectContext?: PassiveEffectContext;
        resolvedAbilityScores?: Record<string, number>;
    } = {}
) {
    const abilityScores =
        options.resolvedAbilityScores ??
        resolveCharacterAbilityScores(
            character,
            options.passiveCapabilities ?? [],
            options.passiveEffectContext ?? {}
        ).scores;
    const passiveCapabilities = Array.isArray(options.passiveCapabilities)
        ? options.passiveCapabilities
        : [];
    const passiveEffectContext = options.passiveEffectContext ?? {};

    return skillsCatalog.map((skill) => {
        const abilityKey = normalizeAbilityKey(skill.ability) ?? normalizeAbilityKey(String(skill.ability).toUpperCase());
        const mod = abilityModifier(abilityKey ? abilityScores[abilityKey] : 10);
        const appliedEffects = passiveCapabilities
            .filter((capability) => String(capability?.kind ?? "passive").toLowerCase() === "passive")
            .flatMap((capability) =>
                (Array.isArray(capability?.passiveEffects) ? capability.passiveEffects : [])
                    .filter((effect) => matchesSkillPassiveEffectTarget(effect?.target, skill?.name))
                    .filter((effect) => isPassiveTriggerActive(effect?.trigger, passiveEffectContext))
                    .map((effect) => ({
                        effect,
                        resolvedValue: resolvePassiveEffectScalarValue(effect, character, abilityScores),
                    }))
            );

        let value = mod;

        const setEffects = appliedEffects
            .filter(({ effect }) => String(effect?.operationType ?? "BONUS").trim().toUpperCase() === "SET")
            .map(({ effect }) => {
                const rawSetValue = Number(effect?.setValue);
                if (!Number.isFinite(rawSetValue)) return null;
                const setMode = String(effect?.setMode ?? "MINIMUM_FLOOR").trim().toUpperCase();
                return setMode === "ABSOLUTE" ? rawSetValue : Math.max(mod, rawSetValue);
            })
            .filter((entry): entry is number => Number.isFinite(entry));

        if (setEffects.length > 0) {
            value = Math.max(...setEffects);
        }

        const bonusEffects = appliedEffects
            .filter(({ effect, resolvedValue }) =>
                String(effect?.operationType ?? "BONUS").trim().toUpperCase() !== "SET" &&
                Number.isFinite(resolvedValue) &&
                resolvedValue !== 0
            );
        const uncappedBonusEffects = bonusEffects.filter(({ effect }) => !Number.isFinite(Number(effect?.capValue)));
        const cappedBonusEffects = bonusEffects
            .filter(({ effect }) => Number.isFinite(Number(effect?.capValue)))
            .sort((a, b) => Number(a.effect?.capValue) - Number(b.effect?.capValue));

        [...uncappedBonusEffects, ...cappedBonusEffects].forEach(({ effect, resolvedValue }) => {
                const capValue = Number(effect?.capValue);
                if (Number.isFinite(capValue) && resolvedValue > 0) {
                    const availableGrowth = Math.max(0, capValue - value);
                    value += Math.min(resolvedValue, availableGrowth);
                    return;
                }
                value += resolvedValue;
            });

        return {
            ...skill,
            value,
        };
    });
}

export {
    coerce,
    setAtPathImmutable,
    buildPatch,
    abilityModifier,
    proficiencyBonus,
    calculateSkillValues,
    getBaseAbilityScores,
    normalizeAbilityKey,
    isPassiveTriggerActive,
    resolvePassiveEffectScalarValue,
    resolveCharacterAbilityScores,
};
