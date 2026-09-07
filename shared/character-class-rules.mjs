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

/**
 * Maximum slots granted by the 2014 multiclass Spellcasting table. This is a
 * maximum/potential progression only: spent slots and recovery rules belong to
 * persistent character state, never to this rules module.
 */
export const SPELLCASTING_SLOT_PROGRESSION = Object.freeze({
  1: Object.freeze([2, 0, 0, 0, 0, 0, 0, 0, 0]),
  2: Object.freeze([3, 0, 0, 0, 0, 0, 0, 0, 0]),
  3: Object.freeze([4, 2, 0, 0, 0, 0, 0, 0, 0]),
  4: Object.freeze([4, 3, 0, 0, 0, 0, 0, 0, 0]),
  5: Object.freeze([4, 3, 2, 0, 0, 0, 0, 0, 0]),
  6: Object.freeze([4, 3, 3, 0, 0, 0, 0, 0, 0]),
  7: Object.freeze([4, 3, 3, 1, 0, 0, 0, 0, 0]),
  8: Object.freeze([4, 3, 3, 2, 0, 0, 0, 0, 0]),
  9: Object.freeze([4, 3, 3, 3, 1, 0, 0, 0, 0]),
  10: Object.freeze([4, 3, 3, 3, 2, 0, 0, 0, 0]),
  11: Object.freeze([4, 3, 3, 3, 2, 1, 0, 0, 0]),
  12: Object.freeze([4, 3, 3, 3, 2, 1, 0, 0, 0]),
  13: Object.freeze([4, 3, 3, 3, 2, 1, 1, 0, 0]),
  14: Object.freeze([4, 3, 3, 3, 2, 1, 1, 0, 0]),
  15: Object.freeze([4, 3, 3, 3, 2, 1, 1, 1, 0]),
  16: Object.freeze([4, 3, 3, 3, 2, 1, 1, 1, 0]),
  17: Object.freeze([4, 3, 3, 3, 2, 1, 1, 1, 1]),
  18: Object.freeze([4, 3, 3, 3, 3, 1, 1, 1, 1]),
  19: Object.freeze([4, 3, 3, 3, 3, 2, 1, 1, 1]),
  20: Object.freeze([4, 3, 3, 3, 3, 2, 2, 1, 1]),
});

/** Pact Magic remains a separate, short-rest pool and never uses the table above. */
export const PACT_MAGIC_SLOT_PROGRESSION = Object.freeze({
  1: Object.freeze({ slotCount: 1, slotLevel: 1 }),
  2: Object.freeze({ slotCount: 2, slotLevel: 1 }),
  3: Object.freeze({ slotCount: 2, slotLevel: 2 }),
  4: Object.freeze({ slotCount: 2, slotLevel: 2 }),
  5: Object.freeze({ slotCount: 2, slotLevel: 3 }),
  6: Object.freeze({ slotCount: 2, slotLevel: 3 }),
  7: Object.freeze({ slotCount: 2, slotLevel: 4 }),
  8: Object.freeze({ slotCount: 2, slotLevel: 4 }),
  9: Object.freeze({ slotCount: 2, slotLevel: 5 }),
  10: Object.freeze({ slotCount: 2, slotLevel: 5 }),
  11: Object.freeze({ slotCount: 3, slotLevel: 5 }),
  12: Object.freeze({ slotCount: 3, slotLevel: 5 }),
  13: Object.freeze({ slotCount: 3, slotLevel: 5 }),
  14: Object.freeze({ slotCount: 3, slotLevel: 5 }),
  15: Object.freeze({ slotCount: 3, slotLevel: 5 }),
  16: Object.freeze({ slotCount: 3, slotLevel: 5 }),
  17: Object.freeze({ slotCount: 4, slotLevel: 5 }),
  18: Object.freeze({ slotCount: 4, slotLevel: 5 }),
  19: Object.freeze({ slotCount: 4, slotLevel: 5 }),
  20: Object.freeze({ slotCount: 4, slotLevel: 5 }),
});

const requirement = (ability, minimum = 13) => Object.freeze({ ability, minimum });
const source = Object.freeze({ rulesetId: CHARACTER_RULESET.id, version: CHARACTER_RULESET.version });
const rules2014Source = Object.freeze({ rulesetId: "dnd-5e-2014", version: "2014" });

function classRule({ key, it, en, aliases = [], hitDie, primaryAbilities, prerequisiteAnyOf, casterKind, spellcastingAbility = null, spellcastingStartLevel = null, subclassLevel }) {
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
    spellcastingAbility,
    spellcastingStartLevel,
    subclassLevel,
    source,
  });
}

export const CLASS_RULES = Object.freeze({
  barbarian: classRule({ key: "barbarian", it: "Barbaro", en: "Barbarian", hitDie: 12, primaryAbilities: ["strength"], prerequisiteAnyOf: [[requirement("strength")]], casterKind: "NONE", subclassLevel: 3 }),
  bard: classRule({ key: "bard", it: "Bardo", en: "Bard", hitDie: 8, primaryAbilities: ["charisma"], prerequisiteAnyOf: [[requirement("charisma")]], casterKind: "FULL", spellcastingAbility: "charisma", spellcastingStartLevel: 1, subclassLevel: 3 }),
  cleric: classRule({ key: "cleric", it: "Chierico", en: "Cleric", hitDie: 8, primaryAbilities: ["wisdom"], prerequisiteAnyOf: [[requirement("wisdom")]], casterKind: "FULL", spellcastingAbility: "wisdom", spellcastingStartLevel: 1, subclassLevel: 1 }),
  druid: classRule({ key: "druid", it: "Druido", en: "Druid", hitDie: 8, primaryAbilities: ["wisdom"], prerequisiteAnyOf: [[requirement("wisdom")]], casterKind: "FULL", spellcastingAbility: "wisdom", spellcastingStartLevel: 1, subclassLevel: 2 }),
  fighter: classRule({ key: "fighter", it: "Guerriero", en: "Fighter", hitDie: 10, primaryAbilities: ["strength", "dexterity"], prerequisiteAnyOf: [[requirement("strength")], [requirement("dexterity")]], casterKind: "NONE", subclassLevel: 3 }),
  monk: classRule({ key: "monk", it: "Monaco", en: "Monk", hitDie: 8, primaryAbilities: ["dexterity", "wisdom"], prerequisiteAnyOf: [[requirement("dexterity"), requirement("wisdom")]], casterKind: "NONE", subclassLevel: 3 }),
  paladin: classRule({ key: "paladin", it: "Paladino", en: "Paladin", hitDie: 10, primaryAbilities: ["strength", "charisma"], prerequisiteAnyOf: [[requirement("strength"), requirement("charisma")]], casterKind: "HALF", spellcastingAbility: "charisma", spellcastingStartLevel: 2, subclassLevel: 3 }),
  ranger: classRule({ key: "ranger", it: "Ranger", en: "Ranger", hitDie: 10, primaryAbilities: ["dexterity", "wisdom"], prerequisiteAnyOf: [[requirement("dexterity"), requirement("wisdom")]], casterKind: "HALF", spellcastingAbility: "wisdom", spellcastingStartLevel: 2, subclassLevel: 3 }),
  rogue: classRule({ key: "rogue", it: "Ladro", en: "Rogue", hitDie: 8, primaryAbilities: ["dexterity"], prerequisiteAnyOf: [[requirement("dexterity")]], casterKind: "NONE", subclassLevel: 3 }),
  sorcerer: classRule({ key: "sorcerer", it: "Stregone", en: "Sorcerer", hitDie: 6, primaryAbilities: ["charisma"], prerequisiteAnyOf: [[requirement("charisma")]], casterKind: "FULL", spellcastingAbility: "charisma", spellcastingStartLevel: 1, subclassLevel: 1 }),
  warlock: classRule({ key: "warlock", it: "Warlock", en: "Warlock", hitDie: 8, primaryAbilities: ["charisma"], prerequisiteAnyOf: [[requirement("charisma")]], casterKind: "PACT", spellcastingAbility: "charisma", spellcastingStartLevel: 1, subclassLevel: 1 }),
  wizard: classRule({ key: "wizard", it: "Mago", en: "Wizard", hitDie: 6, primaryAbilities: ["intelligence"], prerequisiteAnyOf: [[requirement("intelligence")]], casterKind: "FULL", spellcastingAbility: "intelligence", spellcastingStartLevel: 1, subclassLevel: 2 }),
});

export const SUBCLASS_RULES = Object.freeze({
  berserker: Object.freeze({ key: "berserker", classKey: "barbarian", labels: Object.freeze({ it: "Berserker", en: "Berserker" }), aliases: Object.freeze(["berserker"]), source }),
  "college-of-lore": Object.freeze({ key: "college-of-lore", classKey: "bard", labels: Object.freeze({ it: "Collegio del Sapere", en: "College of Lore" }), aliases: Object.freeze(["college-of-lore", "Collegio del Sapere", "College of Lore"]), source }),
  "life-domain": Object.freeze({ key: "life-domain", classKey: "cleric", labels: Object.freeze({ it: "Dominio della Vita", en: "Life Domain" }), aliases: Object.freeze(["life-domain", "Dominio della Vita", "Life Domain"]), source }),
  "circle-of-the-land": Object.freeze({ key: "circle-of-the-land", classKey: "druid", labels: Object.freeze({ it: "Circolo della Terra", en: "Circle of the Land" }), aliases: Object.freeze(["circle-of-the-land", "Circolo della Terra", "Circle of the Land"]), source }),
  champion: Object.freeze({ key: "champion", classKey: "fighter", labels: Object.freeze({ it: "Campione", en: "Champion" }), aliases: Object.freeze(["champion", "Campione"]), source }),
  "eldritch-knight": Object.freeze({ key: "eldritch-knight", classKey: "fighter", labels: Object.freeze({ it: "Cavaliere Mistico", en: "Eldritch Knight" }), aliases: Object.freeze(["eldritch-knight", "Cavaliere Mistico", "Eldritch Knight"]), casterKind: "THIRD", spellcastingAbility: "intelligence", spellcastingStartLevel: 3, source: rules2014Source }),
  "way-of-the-open-hand": Object.freeze({ key: "way-of-the-open-hand", classKey: "monk", labels: Object.freeze({ it: "Via della Mano Aperta", en: "Way of the Open Hand" }), aliases: Object.freeze(["way-of-the-open-hand", "Via della Mano Aperta", "Way of the Open Hand"]), source }),
  "oath-of-devotion": Object.freeze({ key: "oath-of-devotion", classKey: "paladin", labels: Object.freeze({ it: "Giuramento di Devozione", en: "Oath of Devotion" }), aliases: Object.freeze(["oath-of-devotion", "Giuramento di Devozione", "Oath of Devotion"]), source }),
  hunter: Object.freeze({ key: "hunter", classKey: "ranger", labels: Object.freeze({ it: "Cacciatore", en: "Hunter" }), aliases: Object.freeze(["hunter", "Cacciatore"]), source }),
  thief: Object.freeze({ key: "thief", classKey: "rogue", labels: Object.freeze({ it: "Ladro", en: "Thief" }), aliases: Object.freeze(["thief", "Ladro"]), source }),
  "arcane-trickster": Object.freeze({ key: "arcane-trickster", classKey: "rogue", labels: Object.freeze({ it: "Mistificatore Arcano", en: "Arcane Trickster" }), aliases: Object.freeze(["arcane-trickster", "Mistificatore Arcano", "Arcane Trickster"]), casterKind: "THIRD", spellcastingAbility: "intelligence", spellcastingStartLevel: 3, source: rules2014Source }),
  "draconic-bloodline": Object.freeze({ key: "draconic-bloodline", classKey: "sorcerer", labels: Object.freeze({ it: "Stirpe Draconica", en: "Draconic Bloodline" }), aliases: Object.freeze(["draconic-bloodline", "Stirpe Draconica", "Draconic Bloodline"]), source }),
  "the-fiend": Object.freeze({ key: "the-fiend", classKey: "warlock", labels: Object.freeze({ it: "L'Immondo", en: "The Fiend" }), aliases: Object.freeze(["the-fiend", "L'Immondo", "The Fiend"]), source }),
  "school-of-evocation": Object.freeze({ key: "school-of-evocation", classKey: "wizard", labels: Object.freeze({ it: "Scuola di Invocazione", en: "School of Evocation" }), aliases: Object.freeze(["school-of-evocation", "Scuola di Invocazione", "School of Evocation"]), source }),
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

function spellcastingProfile(entry, classRules, subclassRules) {
  const classRule = getClassRule(entry.classKey, classRules);
  const subclass = entry.subclassKey ? getSubclassRule(entry.subclassKey, subclassRules) : null;
  if (entry.subclassKey && (!subclass || normalizeClassKey(subclass.classKey, classRules) !== normalizeClassKey(entry.classKey, classRules))) {
    return null;
  }
  if (!classRule) return null;
  return {
    casterKind: subclass?.casterKind ?? classRule.casterKind ?? null,
    spellcastingStartLevel: subclass?.spellcastingStartLevel ?? classRule.spellcastingStartLevel ?? null,
  };
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

function assertProgressionLevel(level, label) {
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    const error = new Error(`${label} deve essere un intero tra 0 e 20.`);
    error.code = "INVALID_PROGRESSION_LEVEL";
    throw error;
  }
}

function slotMaximums(slotCounts = []) {
  return Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, slotCounts[index] ?? 0]));
}

/**
 * Resolves only the maximum shared Spellcasting slots for an effective caster
 * level. It deliberately has no input for expended slots.
 */
export function resolveSpellcastingSlots(effectiveCasterLevel) {
  const level = Number(effectiveCasterLevel);
  assertProgressionLevel(level, "Il livello da incantatore effettivo");
  return {
    progressionLevel: level,
    slots: slotMaximums(SPELLCASTING_SLOT_PROGRESSION[level]),
  };
}

/**
 * Resolves the shared Spellcasting maximums from class entries. A sole active
 * Spellcasting source keeps its own class progression (notably half and third
 * casters); two or more sources use the multiclass effective-caster formula.
 */
export function resolveSpellcastingProgression(entries, { classRules = CLASS_RULES, subclassRules = SUBCLASS_RULES } = {}) {
  const normalized = normalizedEntries(entries);
  assertNoDuplicateClasses(normalized, classRules);
  const activeSources = [];
  const unresolved = [];
  for (const entry of normalized) {
    const profile = spellcastingProfile(entry, classRules, subclassRules);
    if (!profile) {
      unresolved.push(entry.classKey);
      continue;
    }
    if (profile.casterKind === "NONE" || profile.casterKind === "PACT") continue;
    if (!Number.isInteger(profile.spellcastingStartLevel) || profile.spellcastingStartLevel < 1) {
      unresolved.push(entry.classKey);
      continue;
    }
    if (entry.level >= profile.spellcastingStartLevel) {
      activeSources.push({ ...entry, casterKind: profile.casterKind });
    }
  }

  let mode = "NONE";
  let progressionLevel = 0;
  if (activeSources.length === 1) {
    mode = "SINGLE_SOURCE";
    const source = activeSources[0];
    const divisor = source.casterKind === "FULL" ? 1 : source.casterKind === "HALF" ? 2 : 3;
    progressionLevel = Math.ceil(source.level / divisor);
  } else if (activeSources.length > 1) {
    mode = "MULTICLASS";
    progressionLevel = resolveEffectiveCasterLevel(normalized, { classRules, subclassRules }).level;
  }

  return {
    mode,
    progressionLevel,
    slots: resolveSpellcastingSlots(progressionLevel).slots,
    activeSourceClassKeys: activeSources.map((source) => entryClassIdentity(source, classRules)),
    unresolvedClassKeys: [...new Set(unresolved)],
  };
}

/** Resolves only the maximum Pact Magic slots for the Warlock class level. */
export function resolvePactMagicSlots(pactMagicLevel) {
  const level = Number(pactMagicLevel);
  assertProgressionLevel(level, "Il livello di Pact Magic");
  const progression = PACT_MAGIC_SLOT_PROGRESSION[level];
  return {
    pactMagicLevel: level,
    slotCount: progression?.slotCount ?? 0,
    slotLevel: progression?.slotLevel ?? null,
  };
}

export function resolveSubclassEligibility(entry, { classRules = CLASS_RULES, subclassRules = SUBCLASS_RULES } = {}) {
  const normalizedEntry = normalizedEntries([entry])[0];
  const classRule = getClassRule(normalizedEntry.classKey, classRules);
  if (!classRule || !Number.isInteger(classRule.subclassLevel)) {
    return { status: "MANUAL", eligible: false, requiredLevel: null, reason: "Soglia sottoclasse non censita." };
  }
  const subclassRule = normalizedEntry.subclassKey ? getSubclassRule(normalizedEntry.subclassKey, subclassRules) : null;
  if (normalizedEntry.subclassKey && !subclassRule) {
    return { status: "MANUAL", eligible: false, requiredLevel: classRule.subclassLevel, reason: "Sottoclasse custom o non censita." };
  }
  if (subclassRule && subclassRule.classKey !== classRule.key) {
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
  const spellcasting = resolveSpellcastingProgression(normalized, { classRules, subclassRules });
  return {
    characterLevel,
    proficiencyBonus: resolveProficiencyBonus(characterLevel),
    hitDicePools: hitDice.pools,
    effectiveCasterLevel: caster.level,
    pactMagicLevel: pact.level,
    spellcastingSlots: spellcasting,
    pactMagicSlots: resolvePactMagicSlots(pact.level),
    unresolvedClassKeys: [...new Set([...hitDice.unresolvedClassKeys, ...caster.unresolvedClassKeys, ...pact.unresolvedClassKeys, ...spellcasting.unresolvedClassKeys])],
  };
}

function assertTargetClassKey(targetClassKey) {
  if (typeof targetClassKey !== "string" || !targetClassKey.trim()) {
    const error = new Error("targetClassKey e obbligatoria per la preview di avanzamento.");
    error.code = "TARGET_CLASS_KEY_REQUIRED";
    throw error;
  }
  return targetClassKey.trim();
}

function entryClassIdentity(entry, classRules) {
  return normalizeClassKey(entry.classKey, classRules) ?? normalized(entry.classKey);
}

/**
 * Produces a non-persistent level-up preview. It never evaluates multiclass
 * prerequisites: those rules only apply when the application explicitly opts
 * into adding a class, whereas this contract must also represent monoclasse
 * advancement and future custom/manual flows.
 */
export function resolveClassAdvancementPreview(currentEntries, targetClassKey, options = {}) {
  const classRules = options.classRules ?? CLASS_RULES;
  const subclassRules = options.subclassRules ?? SUBCLASS_RULES;
  const requestedClassKey = assertTargetClassKey(targetClassKey);
  const entries = normalizedEntries(currentEntries);
  assertNoDuplicateClasses(entries, classRules);

  const before = resolveProgressionSummary(entries, { classRules, subclassRules });
  const canonicalTargetKey = normalizeClassKey(requestedClassKey, classRules);
  const targetIdentity = canonicalTargetKey ?? normalized(requestedClassKey);
  const targetIndex = entries.findIndex((entry) => entryClassIdentity(entry, classRules) === targetIdentity);
  const existingTarget = targetIndex >= 0;
  const targetEntry = existingTarget
    ? { ...entries[targetIndex], level: entries[targetIndex].level + 1 }
    : { classKey: canonicalTargetKey ?? requestedClassKey, level: 1 };

  if (options.targetSubclassKey !== undefined) {
    targetEntry.subclassKey = options.targetSubclassKey;
  }

  if (before.characterLevel >= 20) {
    return {
      status: "CHARACTER_LEVEL_LIMIT",
      canAdvance: false,
      reason: "Il personaggio e gia al livello totale 20.",
      targetClassKey: canonicalTargetKey ?? requestedClassKey,
      mode: existingTarget ? "INCREMENT_EXISTING" : "ADD_NEW_CLASS",
      before,
      after: null,
      classesAfter: null,
      subclassEligibility: null,
    };
  }

  const classesAfter = existingTarget
    ? entries.map((entry, index) => index === targetIndex ? targetEntry : { ...entry })
    : [...entries.map((entry) => ({ ...entry })), targetEntry];
  const after = resolveProgressionSummary(classesAfter, { classRules, subclassRules });
  const targetRule = getClassRule(targetEntry.classKey, classRules);
  const subclassEligibility = targetRule
    ? resolveSubclassEligibility(targetEntry, { classRules, subclassRules })
    : { status: "MANUAL", eligible: false, requiredLevel: null, reason: "Classe custom o non censita." };
  const base = {
    targetClassKey: canonicalTargetKey ?? requestedClassKey,
    mode: existingTarget ? "INCREMENT_EXISTING" : "ADD_NEW_CLASS",
    before,
    after,
    classesAfter,
    subclassEligibility,
  };

  if (!targetRule || subclassEligibility.status === "MANUAL") {
    return { status: "MANUAL", canAdvance: false, reason: subclassEligibility.reason, ...base };
  }
  if (subclassEligibility.status === "INVALID") {
    return { status: "INVALID_SUBCLASS", canAdvance: false, reason: subclassEligibility.reason, ...base };
  }
  if (targetEntry.subclassKey && subclassEligibility.status === "NOT_YET_ELIGIBLE") {
    return {
      status: "SUBCLASS_NOT_YET_AVAILABLE",
      canAdvance: false,
      reason: subclassEligibility.reason,
      ...base,
    };
  }
  if (targetEntry.level >= targetRule.subclassLevel && !targetEntry.subclassKey) {
    return {
      status: "SUBCLASS_REQUIRED",
      canAdvance: false,
      reason: `L'avanzamento richiede una sottoclasse valida per ${targetRule.labels.it}.`,
      ...base,
    };
  }
  if (after.unresolvedClassKeys.length > 0) {
    return {
      status: "MANUAL",
      canAdvance: false,
      reason: `La progressione contiene regole non censite per: ${after.unresolvedClassKeys.join(", ")}.`,
      ...base,
    };
  }
  return { status: "READY", canAdvance: true, reason: null, ...base };
}
