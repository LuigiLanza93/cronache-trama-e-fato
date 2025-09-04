import Skills from "@/data/skills.json";

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

function proficiencyBonus(level: number): number {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2; // livello 1-4
}

function calculateSkillValues(character) {
    const { abilityScores } = character;

    return Skills.skills.map((skill) => {
        const mod = abilityModifier(abilityScores[skill.ability]);
        let value = mod;

        return {
            ...skill,
            value,
        };
    });
}

export { coerce, setAtPathImmutable, buildPatch, abilityModifier, proficiencyBonus, calculateSkillValues };