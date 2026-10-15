import { CLASS_RULES, normalizeClassKey } from "../../shared/character-class-rules.mjs";

type LevelCharacter = {
  totalLevel?: number | null;
  classes?: Array<{ classKey: string; label?: string; level: number; sortOrder?: number }>;
  basicInfo?: { class?: string | null; level?: number | string | null };
};

function validLevel(value: unknown): number | null {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 20 ? level : null;
}

/** Stable class identities are persisted; numbering is only a display detail. */
export function getPassiveEffectClassOptions(character: LevelCharacter | null | undefined) {
  const seen = new Set<string>();
  const classes = (Array.isArray(character?.classes) ? character.classes : [])
    .filter((entry) => {
      if (!entry || typeof entry.classKey !== "string" || !entry.classKey || validLevel(entry.level) === null || seen.has(entry.classKey)) return false;
      seen.add(entry.classKey);
      return true;
    })
    .map((entry, index) => ({ ...entry, order: Number.isFinite(entry.sortOrder) ? entry.sortOrder! : index }))
    .sort((left, right) => left.order - right.order);

  // Legacy monoclasse sheets can still bind to the same canonical class key
  // they will receive during the structured migration.
  if (!classes.length && !character?.classes?.length) {
    const classKey = normalizeClassKey(character?.basicInfo?.class);
    const level = validLevel(character?.basicInfo?.level);
    if (classKey && level !== null) classes.push({ classKey, level, order: 0 });
  }
  return classes.map((entry, index) => ({
    classKey: entry.classKey,
    level: entry.level,
    index: index + 1,
    label: `Livello classe ${index + 1} — ${entry.label || CLASS_RULES[entry.classKey]?.labels.it || entry.classKey}`,
  }));
}

export function getPassiveEffectTotalLevel(character: LevelCharacter | null | undefined) {
  const explicitTotal = validLevel(character?.totalLevel);
  if (explicitTotal !== null) return explicitTotal;
  const classes = getPassiveEffectClassOptions(character);
  const sum = classes.reduce((total, entry) => total + entry.level, 0);
  return validLevel(sum) ?? validLevel(character?.basicInfo?.level) ?? 1;
}

export function resolvePassiveEffectClassLevel(character: LevelCharacter | null | undefined, sourceClassKey: unknown) {
  if (typeof sourceClassKey !== "string") return 0;
  return getPassiveEffectClassOptions(character).find((entry) => entry.classKey === sourceClassKey)?.level ?? 0;
}
