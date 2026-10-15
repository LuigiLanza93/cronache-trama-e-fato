import { normalizeClassKey } from "./character-class-rules.mjs";

const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const key = (value) => String(value ?? "").trim().toUpperCase();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const level = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20 ? Number(value) : 0;

function totalLevel(character) {
  return level(character?.totalLevel) || level((character?.classes ?? []).reduce((sum, entry) => sum + level(entry.level), 0))
    || level(character?.basicInfo?.level) || 1;
}

function classLevel(character, classKey) {
  if (!classKey) return 0;
  if (character?.classes?.length) return level(character.classes.find((entry) => entry.classKey === classKey)?.level);
  return normalizeClassKey(character?.basicInfo?.class) === classKey ? level(character?.basicInfo?.level) : 0;
}

function triggerActive(trigger, context) {
  switch (key(trigger || "ALWAYS")) {
    case "ALWAYS": return true;
    case "WHILE_ARMORED": return Boolean(context.hasArmorEquipped);
    case "WHILE_UNARMORED": return !context.hasArmorEquipped;
    case "WHILE_SHIELD_EQUIPPED": return Boolean(context.hasShieldEquipped);
    case "WHILE_WIELDING_SINGLE_MELEE_WEAPON": return Boolean(context.hasSingleMeleeWeaponEquipped);
    case "WHILE_DUAL_WIELDING": return Boolean(context.hasDualWielding);
    case "WHILE_WIELDING_TWO_HANDED_WEAPON": return Boolean(context.hasTwoHandedWeaponEquipped);
    default: return false;
  }
}

function abilityKey(value) {
  const aliases = {
    STR: "strength", FOR: "strength", FORZA: "strength",
    DEX: "dexterity", DES: "dexterity", DESTREZZA: "dexterity",
    CON: "constitution", COS: "constitution", COSTITUZIONE: "constitution",
    INT: "intelligence", INTELLIGENZA: "intelligence",
    WIS: "wisdom", SAG: "wisdom", SAGGEZZA: "wisdom",
    CHA: "charisma", CAR: "charisma", CARISMA: "charisma",
  };
  return aliases[key(value)] ?? (abilities.includes(String(value).toLowerCase()) ? String(value).toLowerCase() : null);
}

function scalar(effect, character, scores, abilityTarget = false) {
  const mode = key(effect.valueMode || "FLAT");
  if (abilityTarget && ["ABILITY_SCORE", "ABILITY_MODIFIER"].includes(mode)) return null;
  let base;
  switch (mode) {
    case "CHARACTER_LEVEL": base = totalLevel(character); break;
    case "CLASS_LEVEL": base = classLevel(character, effect.sourceClassKey); break;
    case "PROFICIENCY_BONUS": base = Math.ceil(totalLevel(character) / 4) + 1; break;
    case "ABILITY_SCORE": base = scores[abilityKey(effect.sourceAbility)] ?? 10; break;
    case "ABILITY_MODIFIER": base = Math.floor(((scores[abilityKey(effect.sourceAbility)] ?? 10) - 10) / 2); break;
    default: return number(effect.value);
  }
  const numerator = Math.max(1, number(effect.multiplierNumerator, 1) || 1);
  const denominator = Math.max(1, number(effect.multiplierDenominator, 1) || 1);
  const scaled = base * numerator / denominator;
  return (denominator === 1 ? scaled : key(effect.rounding) === "CEIL" ? Math.ceil(scaled) : Math.floor(scaled)) + number(effect.value);
}

function resolvedScores(character, effects) {
  return Object.fromEntries(abilities.map((ability) => {
    const base = number(character?.abilityScores?.[ability.toUpperCase()] ?? character?.abilityScores?.[ability] ?? 10, 10);
    const targeted = effects.filter(({ effect }) => key(effect.target) === `${ability.toUpperCase()}_SCORE`);
    const sets = targeted.filter(({ effect }) => key(effect.operationType) === "SET" && Number.isFinite(Number(effect.setValue)));
    let score = sets.length ? Math.max(...sets.map(({ effect }) => key(effect.setMode) === "ABSOLUTE" ? Number(effect.setValue) : Math.max(base, Number(effect.setValue)))) : base;
    const bonuses = targeted.filter(({ effect }) => key(effect.operationType) !== "SET").map(({ effect }) => ({ effect, value: scalar(effect, character, {}, true) }))
      .filter(({ value }) => value !== null && Number.isFinite(value) && value !== 0);
    const uncapped = bonuses.filter(({ effect }) => !Number.isFinite(Number(effect.capValue)));
    const capped = bonuses.filter(({ effect }) => Number.isFinite(Number(effect.capValue))).sort((a, b) => Number(a.effect.capValue) - Number(b.effect.capValue));
    for (const { effect, value } of [...uncapped, ...capped]) {
      score += value > 0 && Number.isFinite(Number(effect.capValue)) ? Math.min(value, Math.max(0, Number(effect.capValue) - score)) : value;
    }
    return [ability, score];
  }));
}

/** Evaluate explicit declarations only; do not reconstruct historical hit dice/HP. */
export function resolvePassiveHitPointBonus(character, { capabilities = character?.capabilities ?? [], context = {}, resolvedAbilityScores = null } = {}) {
  const effects = (Array.isArray(capabilities) ? capabilities : [])
    .filter((capability) => String(capability?.kind ?? "passive").toLowerCase() === "passive")
    .flatMap((capability) => (Array.isArray(capability.passiveEffects) ? capability.passiveEffects : [])
      .filter((effect) => triggerActive(effect?.trigger, context)).map((effect) => ({ capability, effect })));
  const scores = resolvedAbilityScores ?? resolvedScores(character, effects);
  const breakdown = effects.filter(({ effect }) => key(effect.target) === "HIT_POINT_MAX" && key(effect.operationType) !== "SET")
    .map(({ capability, effect }) => {
      const label = String(capability.name ?? "").trim() || "Effetto passivo";
      const source = String(capability.sourceLabel ?? "").trim();
      return { label: source ? `${label} (${source})` : label, value: scalar(effect, character, scores) };
    }).filter(({ value }) => Number.isSafeInteger(value) && value !== 0);
  return { bonusTotal: breakdown.reduce((sum, entry) => sum + entry.value, 0), breakdown };
}

/** Idempotent projection: persisted max already includes passiveBonusApplied. */
export function reconcilePassiveHitPoints(state, desiredBonus) {
  if (!state) return state;
  if (!Number.isSafeInteger(desiredBonus)) throw new Error("Bonus PF passivo non valido");
  const oldApplied = number(state.passiveBonusApplied);
  const baseMaximum = number(state.maximumHitPoints) - oldApplied;
  const maximumHitPoints = Math.max(0, baseMaximum + desiredBonus);
  const delta = maximumHitPoints - number(state.maximumHitPoints);
  return {
    ...state,
    maximumHitPoints,
    currentHitPoints: number(state.currentHitPoints) === 0 ? 0 : Math.max(0, number(state.currentHitPoints) + delta),
    passiveBonusApplied: maximumHitPoints - baseMaximum,
  };
}
