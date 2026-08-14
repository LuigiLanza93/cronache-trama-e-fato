/**
 * Pure character progression rules for the 2014/SRD 5.1 ruleset.
 *
 * Stable keys are deliberately separate from translated labels. Unknown or
 * incomplete custom rules remain explicit manual cases: no resolver invents a
 * Hit Die, caster contribution, prerequisite, or subclass threshold.
 */

export const CHARACTER_RULESET = Object.freeze({
  id: "srd-5.1-2014",
  version: "5.1",
  source: "D&D Basic Rules 2014 / SRD 5.1",
});

export const ABILITY_KEYS = Object.freeze([
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
]);

export const HIT_DIE_SIZES = Object.freeze([6, 8, 10, 12]);
export const CASTER_KINDS = Object.freeze(["NONE", "FULL", "HALF", "THIRD", "PACT"]);

const requirement = (ability, minimum = 13) => Object.freeze({ ability, minimum });
const source = Object.freeze({ rulesetId: CHARACTER_RULESET.id, version: CHARACTER_RULESET.version });

function classRule({ key, it, en, aliases = [], hitDie, primaryAbilities, prerequisiteAnyOf, casterKind, subclassLevel }) {
  return Object.freeze({
    key,
    labels: Object.freeze({ it, en }),
    aliases: Object.freeze([...new Set([key, it, en, ...aliases])]),
    hitDie,
    primaryAbilities: Object.freeze(primaryAbilities),
    multiclassPrerequisites: Object.freeze({
      anyOf: Object.freeze(prerequisiteAnyOf.map((group) => Object.freeze(group))),
    }),
    casterKind,
    subclassLevel,
    source,
  });
}

export const CLASS_RULES = Object.freeze({
  barbarian: classRule({ key: "barbarian", it: "Barbaro", en: "Barbarian", hitDie: 12, primaryAbilities: ["strength"], prerequisiteAnyOf: [[requirement("strength")]], casterKind: "NONE", subclassLevel: 3 }),
  bard: classRule({ key: "bard", it: "Bardo", en: "Bard", hitDie: 8, primaryAbilities: ["charisma"], prerequisiteAnyOf: [[requirement("charisma")]], casterKind: "FULL", subclassLevel: 3 }),
  cleric: classRule({ key: "cleric", it: "Chierico", en: "Cleric", hitDie: 8, primaryAbilities: ["wisdom"], prerequisiteAnyOf: [[requirement("wisdom")]], casterKind: "FULL", subclassLevel: 1 }),
  druid: classRule({ key: "druid", it: "Druido", en: "Druid", hitDie: 8, primaryAbilities: ["wisdom"], prerequisiteAnyOf: [[requirement("wisdom")]], casterKind: "FULL", subclassLevel: 2 }),
  fighter: classRule({ key: "fighter", it: "Guerriero", en: "Fighter", hitDie: 10, primaryAbilities: ["strength", "dexterity"], prerequisiteAnyOf: [[requirement("strength")], [requirement("dexterity")]], casterKind: "NONE", subclassLevel: 3 }),
  monk: classRule({ key: "monk", it: "Monaco", en: "Monk", hitDie: 8, primaryAbilities: ["dexterity", "wisdom"], prerequisiteAnyOf: [[requirement("dexterity"), requirement("wisdom")]], casterKind: "NONE", subclassLevel: 3 }),
  paladin: classRule({ key: "paladin", it: "Paladino", en: "Paladin", hitDie: 10, primaryAbilities: ["strength", "charisma"], prerequisiteAnyOf: [[requirement("strength"), requirement("charisma")]], casterKind: "HALF", subclassLevel: 3 }),
  ranger: classRule({ key: "ranger", it: "Ranger", en: "Ranger", hitDie: 10, primaryAbilities: ["dexterity", "wisdom"], prerequisiteAnyOf: [[requirement("dexterity"), requirement("wisdom")]], casterKind: "HALF", subclassLevel: 3 }),
  rogue: classRule({ key: "rogue", it: "Ladro", en: "Rogue", hitDie: 8, primaryAbilities: ["dexterity"], prerequisiteAnyOf: [[requirement("dexterity")]], casterKind: "NONE", subclassLevel: 3 }),
  sorcerer: classRule({ key: "sorcerer", it: "Stregone", en: "Sorcerer", hitDie: 6, primaryAbilities: ["charisma"], prerequisiteAnyOf: [[requirement("charisma")]], casterKind: "FULL", subclassLevel: 1 }),
  warlock: classRule({ key: "warlock", it: "Warlock", en: "Warlock", hitDie: 8, primaryAbilities: ["charisma"], prerequisiteAnyOf: [[requirement("charisma")]], casterKind: "PACT", subclassLevel: 1 }),
  wizard: classRule({ key: "wizard", it: "Mago", en: "Wizard", hitDie: 6, primaryAbilities: ["intelligence"], prerequisiteAnyOf: [[requirement("intelligence")]], casterKind: "FULL", subclassLevel: 2 }),
});

export const SUBCLASS_RULES = Object.freeze({
  "eldritch-knight": Object.freeze({ key: "eldritch-knight", classKey: "fighter", labels: Object.freeze({ it: "Cavaliere Mistico", en: "Eldritch Knight" }), aliases: Object.freeze(["eldritch-knight", "Cavaliere Mistico", "Eldritch Knight"]), casterKind: "THIRD", source }),
  "arcane-trickster": Object.freeze({ key: "arcane-trickster", classKey: "rogue", labels: Object.freeze({ it: "Mistificatore Arcano", en: "Arcane Trickster" }), aliases: Object.freeze(["arcane-trickster", "Mistificatore Arcano", "Arcane Trickster"]), casterKind: "THIRD", source }),
});

function normalized(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-");
}

function rulesArray(rules) {
  return Array.isArray(rules) ? rules : Object.values(rules ?? {});
}

export function normalizeClassKey(value, rules = CLASS_RULES) {
  const candidate = normalized(value);
  if (!candidate) return null;
  const match = rulesArray(rules).find((rule) =>
    rule && [rule.key, ...(Array.isArray(rule.aliases) ? rule.aliases : [])].some((alias) => normalized(alias) === candidate)
  );
  return match?.key ?? null;
}

export function normalizeSubclassKey(value, rules = SUBCLASS_RULES) {
  const candidate = normalized(value);
  if (!candidate) return null;
  const match = rulesArray(rules).find((rule) =>
    rule && [rule.key, ...(Array.isArray(rule.aliases) ? rule.aliases : [])].some((alias) => normalized(alias) === candidate)
  );
  return match?.key ?? null;
}

export function getClassRule(value, rules = CLASS_RULES) {
  const key = normalizeClassKey(value, rules);
  return key ? rulesArray(rules).find((rule) => rule?.key === key) ?? null : null;
}

export function getSubclassRule(value, rules = SUBCLASS_RULES) {
  const key = normalizeSubclassKey(value, rules);
  return key ? rulesArray(rules).find((rule) => rule?.key === key) ?? null : null;
}

function normalizedEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry, index) => {
    const level = Number(entry?.level);
    if (!entry || typeof entry !== "object" || !Number.isInteger(level) || level < 1 || level > 20) {
      const error = new Error(`Livello di classe non valido all'indice ${index}.`);
      error.code = "INVALID_CLASS_LEVEL";
      throw error;
    }
    const classKey = String(entry.classKey ?? "").trim();
    if (!classKey) {
      const error = new Error(`Chiave classe mancante all'indice ${index}.`);
      error.code = "CLASS_KEY_REQUIRED";
      throw error;
    }
    return { ...entry, classKey, level };
  });
}

function assertNoDuplicateClasses(entries, classRules) {
  const seen = new Set();
  for (const entry of entries) {
    const key = normalizeClassKey(entry.classKey, classRules) ?? normalized(entry.classKey);
    if (seen.has(key)) {
      const error = new Error(`Classe duplicata: ${entry.classKey}.`);
      error.code = "DUPLICATE_CLASS";
      throw error;
    }
    seen.add(key);
  }
}

export function resolveCharacterLevel(entries) {
  return normalizedEntries(entries).reduce((total, entry) => total + entry.level, 0);
}

export function resolveClassLevel(entries, classKey, classRules = CLASS_RULES) {
  const normalizedTarget = normalizeClassKey(classKey, classRules) ?? normalized(classKey);
  return normalizedEntries(entries)
    .filter((entry) => (normalizeClassKey(entry.classKey, classRules) ?? normalized(entry.classKey)) === normalizedTarget)
    .reduce((total, entry) => total + entry.level, 0);
}

export function resolveProficiencyBonus(levelOrEntries) {
  const level = Array.isArray(levelOrEntries) ? resolveCharacterLevel(levelOrEntries) : Number(levelOrEntries);
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    const error = new Error("Il livello totale deve essere un intero tra 1 e 20.");
    error.code = "INVALID_CHARACTER_LEVEL";
    throw error;
  }
  return Math.floor((level - 1) / 4) + 2;
}

export function resolveHitDicePools(entries, classRules = CLASS_RULES) {
  const normalized = normalizedEntries(entries);
  assertNoDuplicateClasses(normalized, classRules);
  const pools = { d6: 0, d8: 0, d10: 0, d12: 0 };
  const unresolved = [];
  for (const entry of normalized) {
    const rule = getClassRule(entry.classKey, classRules);
    if (!rule || !HIT_DIE_SIZES.includes(rule.hitDie)) {
      unresolved.push(entry.classKey);
      continue;
    }
    pools[`d${rule.hitDie}`] += entry.level;
  }
  return { pools, unresolvedClassKeys: unresolved };
}

function effectiveCasterKind(entry, classRules, subclassRules) {
  const subclass = entry.subclassKey ? getSubclassRule(entry.subclassKey, subclassRules) : null;
  if (entry.subclassKey) {
    if (!subclass || normalizeClassKey(subclass.classKey, classRules) !== normalizeClassKey(entry.classKey, classRules)) {
      return null;
    }
    return subclass.casterKind ?? getClassRule(entry.classKey, classRules)?.casterKind ?? null;
  }
  return getClassRule(entry.classKey, classRules)?.casterKind ?? null;
}

export function resolveEffectiveCasterLevel(entries, { classRules = CLASS_RULES, subclassRules = SUBCLASS_RULES } = {}) {
  const normalized = normalizedEntries(entries);
  assertNoDuplicateClasses(normalized, classRules);
  let level = 0;
  const unresolved = [];
  for (const entry of normalized) {
    const kind = effectiveCasterKind(entry, classRules, subclassRules);
    if (!kind) {
      unresolved.push(entry.classKey);
      continue;
    }
    if (kind === "FULL") level += entry.level;
    if (kind === "HALF") level += Math.floor(entry.level / 2);
    if (kind === "THIRD") level += Math.floor(entry.level / 3);
  }
  return { level, unresolvedClassKeys: unresolved };
}

export function resolvePactMagicLevel(entries, classRules = CLASS_RULES) {
  const normalized = normalizedEntries(entries);
  assertNoDuplicateClasses(normalized, classRules);
  let level = 0;
  const unresolved = [];
  for (const entry of normalized) {
    const rule = getClassRule(entry.classKey, classRules);
    if (!rule) {
      unresolved.push(entry.classKey);
      continue;
    }
    if (rule.casterKind === "PACT") level += entry.level;
  }
  return { level, unresolvedClassKeys: unresolved };
}

export function resolveSubclassEligibility(entry, { classRules = CLASS_RULES, subclassRules = SUBCLASS_RULES } = {}) {
  const normalizedEntry = normalizedEntries([entry])[0];
  const classRule = getClassRule(normalizedEntry.classKey, classRules);
  if (!classRule || !Number.isInteger(classRule.subclassLevel)) {
    return { status: "MANUAL", eligible: false, requiredLevel: null, reason: "Soglia sottoclasse non censita." };
  }
  const subclassRule = normalizedEntry.subclassKey ? getSubclassRule(normalizedEntry.subclassKey, subclassRules) : null;
  if (normalizedEntry.subclassKey && (!subclassRule || subclassRule.classKey !== classRule.key)) {
    return { status: "INVALID", eligible: false, requiredLevel: classRule.subclassLevel, reason: "Sottoclasse non associata alla classe." };
  }
  const eligible = normalizedEntry.level >= classRule.subclassLevel;
  return {
    status: eligible ? "ELIGIBLE" : "NOT_YET_ELIGIBLE",
    eligible,
    requiredLevel: classRule.subclassLevel,
    reason: eligible ? null : `La sottoclasse richiede il livello ${classRule.subclassLevel} in ${classRule.labels.it}.`,
  };
}

function requirementSatisfied(group, abilityScores) {
  return group.every(({ ability, minimum }) => Number(abilityScores?.[ability]) >= minimum);
}

export function evaluateMulticlassPrerequisites(currentEntries, targetClassKey, abilityScores, classRules = CLASS_RULES) {
  const entries = normalizedEntries(currentEntries);
  const currentRules = entries.map((entry) => getClassRule(entry.classKey, classRules));
  const targetRule = getClassRule(targetClassKey, classRules);
  if (!targetRule || currentRules.some((rule) => !rule)) {
    return { status: "MANUAL", eligible: false, failedClassKeys: [], reason: "Prerequisiti di una o piu classi non censiti." };
  }
  const rulesToCheck = [...new Map([...currentRules, targetRule].map((rule) => [rule.key, rule])).values()];
  const failedClassKeys = rulesToCheck
    .filter((rule) => !rule.multiclassPrerequisites.anyOf.some((group) => requirementSatisfied(group, abilityScores)))
    .map((rule) => rule.key);
  return {
    status: failedClassKeys.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
    eligible: failedClassKeys.length === 0,
    failedClassKeys,
    reason: failedClassKeys.length === 0 ? null : "Prerequisiti multiclass non soddisfatti per tutte le classi coinvolte.",
  };
}

export function resolveProgressionSummary(entries, options = {}) {
  const classRules = options.classRules ?? CLASS_RULES;
  const subclassRules = options.subclassRules ?? SUBCLASS_RULES;
  const normalized = normalizedEntries(entries);
  assertNoDuplicateClasses(normalized, classRules);
  const characterLevel = resolveCharacterLevel(normalized);
  if (characterLevel > 20) {
    const error = new Error("Il livello totale non puo superare 20.");
    error.code = "CHARACTER_LEVEL_LIMIT";
    throw error;
  }
  const hitDice = resolveHitDicePools(normalized, classRules);
  const caster = resolveEffectiveCasterLevel(normalized, { classRules, subclassRules });
  const pact = resolvePactMagicLevel(normalized, classRules);
  return {
    characterLevel,
    proficiencyBonus: resolveProficiencyBonus(characterLevel),
    hitDicePools: hitDice.pools,
    effectiveCasterLevel: caster.level,
    pactMagicLevel: pact.level,
    unresolvedClassKeys: [...new Set([...hitDice.unresolvedClassKeys, ...caster.unresolvedClassKeys, ...pact.unresolvedClassKeys])],
  };
}
