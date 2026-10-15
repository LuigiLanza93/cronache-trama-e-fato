/**
 * Pure M5/M6 character vitality and resource rules.
 *
 * These functions deliberately operate on explicit, persisted-shaped state.
 * They never infer a pool from a translated class label or mutate an input.
 */

import { resolveHitDicePools } from "./character-class-rules.mjs";

export const REST_POLICY_V1 = Object.freeze({
  id: "rest-v1",
  maxShortRestsSinceLongRest: 2,
  hitDieSpendOrder: Object.freeze([12, 10, 8, 6]),
});

export const RESOURCE_KINDS = Object.freeze(["SPELLCASTING", "PACT_MAGIC", "CLASS_RESOURCE", "MANUAL"]);
export const RESOURCE_RESET_POLICIES = Object.freeze(["SHORT_REST", "LONG_REST", "MANUAL", "NONE"]);
export const SPELLCASTING_CONVERSION_COSTS = Object.freeze({ 2: 3, 3: 5, 4: 7, 5: 9, 6: 12, 7: 15, 8: 18, 9: 22 });

function ruleError(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function integer(value, label, { min = undefined, max = undefined } = {}) {
  if (!Number.isInteger(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) {
    ruleError("INVALID_VITALS_INPUT", `${label} non è valido.`);
  }
  return value;
}

function cloneNumericRecord(value, label, { minimumKey = 0, maximumKey = 99 } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    ruleError("INVALID_RESOURCE_POOL", `${label} deve essere un oggetto.`);
  }
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (!/^\d+$/.test(rawKey)) ruleError("INVALID_RESOURCE_POOL", `${label} contiene un livello non valido.`);
    const key = Number(rawKey);
    integer(key, `${label} livello`, { min: minimumKey, max: maximumKey });
    integer(rawValue, `${label} valore`, { min: 0 });
    result[key] = rawValue;
  }
  return result;
}

export function resolveConstitutionModifier(score) {
  integer(score, "Il punteggio di Costituzione");
  return Math.floor((score - 10) / 2);
}

/** House rule: every acquired level gains its entire class Hit Die plus CON, minimum 1. */
export function resolveLevelUpHitPoints({ hitDieSize, constitutionModifier }) {
  integer(hitDieSize, "La taglia del Dado Vita", { min: 1 });
  integer(constitutionModifier, "Il modificatore di Costituzione");
  return Object.freeze({
    hitDieSize,
    constitutionModifier,
    gained: Math.max(1, hitDieSize + constitutionModifier),
    method: "HOUSE_RULE_MAX",
    policyVersion: REST_POLICY_V1.id,
  });
}

/** Creates full, explicit pools from M2 class rules. Unknown classes remain unresolved. */
export function deriveHitDiePools(entries, classRules) {
  const result = resolveHitDicePools(entries, classRules);
  return {
    pools: [6, 8, 10, 12].map((dieSize) => ({
      dieSize,
      maximum: result.pools[`d${dieSize}`],
      remaining: result.pools[`d${dieSize}`],
    })),
    unresolvedClassKeys: [...result.unresolvedClassKeys],
  };
}

export function normalizeHitDiePools(value) {
  if (!Array.isArray(value)) ruleError("INVALID_HIT_DIE_POOLS", "I pool Dadi Vita devono essere un array.");
  const seen = new Set();
  const pools = value.map((pool) => {
    if (!pool || typeof pool !== "object" || Array.isArray(pool)) ruleError("INVALID_HIT_DIE_POOLS", "Pool Dado Vita non valido.");
    const dieSize = integer(pool.dieSize, "La taglia del Dado Vita", { min: 6, max: 12 });
    if (![6, 8, 10, 12].includes(dieSize)) ruleError("INVALID_HIT_DIE_POOLS", "La taglia del Dado Vita non è supportata.");
    if (seen.has(dieSize)) ruleError("DUPLICATE_HIT_DIE_POOL", "Ogni taglia Dado Vita può avere un solo pool.");
    seen.add(dieSize);
    const maximum = integer(pool.maximum, "Il massimo dei Dadi Vita", { min: 0 });
    const remaining = integer(pool.remaining, "I Dadi Vita residui", { min: 0, max: maximum });
    return { dieSize, maximum, remaining };
  });
  return pools.sort((left, right) => right.dieSize - left.dieSize);
}

function fixedHealing(dieSize, constitutionModifier) {
  return Math.max(1, Math.floor(dieSize / 2) + 1 + constitutionModifier);
}

/** Applies the established automatic short-rest house rule without mutating its inputs. */
export function applyShortRestToHitDicePools({
  pools,
  currentHitPoints,
  maximumHitPoints,
  constitutionModifier,
  shortRestsUsedSinceLongRest = 0,
  policy = REST_POLICY_V1,
}) {
  const normalizedPools = normalizeHitDiePools(pools);
  integer(currentHitPoints, "I PF correnti", { min: 0 });
  integer(maximumHitPoints, "I PF massimi", { min: 0 });
  integer(constitutionModifier, "Il modificatore di Costituzione");
  integer(shortRestsUsedSinceLongRest, "I riposi brevi usati", { min: 0 });
  if (!policy || !Number.isInteger(policy.maxShortRestsSinceLongRest) || !Array.isArray(policy.hitDieSpendOrder)) {
    ruleError("INVALID_REST_POLICY", "La policy di riposo non è valida.");
  }

  if (shortRestsUsedSinceLongRest >= policy.maxShortRestsSinceLongRest) {
    return {
      applied: false,
      reason: "SHORT_REST_LIMIT_REACHED",
      pools: normalizedPools,
      currentHitPoints,
      healingApplied: 0,
      hitDiceSpent: 0,
      hitDiceSpentBySize: {},
      shortRestsUsedSinceLongRest,
    };
  }

  const maximumDice = normalizedPools.reduce((sum, pool) => sum + pool.maximum, 0);
  let budget = maximumDice > 0 ? Math.max(1, Math.floor(maximumDice / 2)) : 0;
  let missing = Math.max(0, maximumHitPoints - currentHitPoints);
  let healingApplied = 0;
  let hitDiceSpent = 0;
  const spentBySize = {};
  const mutablePools = normalizedPools.map((pool) => ({ ...pool }));
  const bySize = new Map(mutablePools.map((pool) => [pool.dieSize, pool]));

  for (const dieSize of policy.hitDieSpendOrder) {
    const pool = bySize.get(dieSize);
    while (pool && missing > 0 && budget > 0 && pool.remaining > 0) {
      const healed = Math.min(missing, fixedHealing(dieSize, constitutionModifier));
      pool.remaining -= 1;
      budget -= 1;
      missing -= healed;
      healingApplied += healed;
      hitDiceSpent += 1;
      spentBySize[`d${dieSize}`] = (spentBySize[`d${dieSize}`] ?? 0) + 1;
    }
  }

  return {
    applied: true,
    reason: null,
    pools: mutablePools,
    currentHitPoints: currentHitPoints + healingApplied,
    healingApplied,
    hitDiceSpent,
    hitDiceSpentBySize: spentBySize,
    shortRestsUsedSinceLongRest: shortRestsUsedSinceLongRest + 1,
  };
}

export function applyLongRestToHitDicePools({ pools, shortRestsUsedSinceLongRest = 0 }) {
  const normalizedPools = normalizeHitDiePools(pools);
  integer(shortRestsUsedSinceLongRest, "I riposi brevi usati", { min: 0 });
  return {
    pools: normalizedPools.map((pool) => ({ ...pool, remaining: pool.maximum })),
    hitDiceRecovered: normalizedPools.reduce((sum, pool) => sum + pool.maximum - pool.remaining, 0),
    shortRestsUsedSinceLongRest: 0,
  };
}

export function normalizeResourcePool(pool) {
  if (!pool || typeof pool !== "object" || Array.isArray(pool)) ruleError("INVALID_RESOURCE_POOL", "Pool risorsa non valido.");
  const id = String(pool.id ?? "").trim();
  if (!id) ruleError("INVALID_RESOURCE_POOL", "Il pool risorsa richiede un id stabile.");
  const kind = String(pool.kind ?? "").trim();
  const resetPolicy = String(pool.resetPolicy ?? "").trim();
  if (!RESOURCE_KINDS.includes(kind) || !RESOURCE_RESET_POLICIES.includes(resetPolicy)) {
    ruleError("INVALID_RESOURCE_POOL", "Tipo o policy del pool risorsa non validi.");
  }
  const maximum = cloneNumericRecord(pool.maximum, "maximum");
  const used = cloneNumericRecord(pool.used, "used");
  const allLevels = new Set([...Object.keys(maximum), ...Object.keys(used)]);
  for (const level of allLevels) {
    const max = maximum[level] ?? 0;
    const spent = used[level] ?? 0;
    if (spent > max) ruleError("INVALID_RESOURCE_POOL", "Le risorse usate non possono superare il massimo.");
  }
  return { id, kind, resetPolicy, maximum, used, sourceClassKey: pool.sourceClassKey ?? null };
}

/** A long rest also refreshes resources that normally recover on a short rest. */
export function resetResourcePools(pools, restType) {
  if (!Array.isArray(pools)) ruleError("INVALID_RESOURCE_POOL", "I pool risorsa devono essere un array.");
  if (!["SHORT_REST", "LONG_REST"].includes(restType)) ruleError("INVALID_REST_TYPE", "Tipo di riposo non valido.");
  const ids = new Set();
  return pools.map((rawPool) => {
    const pool = normalizeResourcePool(rawPool);
    if (ids.has(pool.id)) ruleError("DUPLICATE_RESOURCE_POOL", "Ogni pool risorsa deve avere un id distinto.");
    ids.add(pool.id);
    const resets = restType === "SHORT_REST"
      ? pool.resetPolicy === "SHORT_REST"
      : pool.resetPolicy === "SHORT_REST" || pool.resetPolicy === "LONG_REST";
    return resets ? { ...pool, used: Object.fromEntries(Object.keys(pool.maximum).map((level) => [level, 0])) } : pool;
  });
}

/** Converts lower-level shared Spellcasting capacity into one expended target slot. */
export function convertSpellcastingPool(pool, { targetLevel, selections, costs = SPELLCASTING_CONVERSION_COSTS }) {
  const normalized = normalizeResourcePool(pool);
  if (normalized.kind !== "SPELLCASTING") ruleError("SPELLCASTING_POOL_REQUIRED", "La conversione è consentita solo al pool Spellcasting.");
  integer(targetLevel, "Il livello bersaglio", { min: 2, max: 9 });
  if (!selections || typeof selections !== "object" || Array.isArray(selections)) ruleError("INVALID_CONVERSION", "Le selezioni non sono valide.");
  const cost = costs[targetLevel];
  if (!Number.isInteger(cost) || cost < 1) ruleError("INVALID_CONVERSION", "Costo di conversione mancante.");
  const targetMaximum = normalized.maximum[targetLevel] ?? 0;
  const targetUsed = normalized.used[targetLevel] ?? 0;
  if (targetMaximum < 1 || targetUsed < 1) ruleError("INVALID_CONVERSION", "Lo slot bersaglio deve esistere ed essere consumato.");

  let pointsSpent = 0;
  const parsedSelections = {};
  for (const [key, value] of Object.entries(selections)) {
    if (!/^\d+$/.test(key)) ruleError("INVALID_CONVERSION", "Livello sorgente non valido.");
    const level = Number(key);
    integer(level, "Il livello sorgente", { min: 1, max: 9 });
    integer(value, "La quantità sorgente", { min: 0 });
    if (value === 0) continue;
    if (level >= targetLevel) ruleError("INVALID_CONVERSION", "Si possono sacrificare soltanto slot inferiori.");
    const available = (normalized.maximum[level] ?? 0) - (normalized.used[level] ?? 0);
    if (value > available) ruleError("INVALID_CONVERSION", "Non ci sono abbastanza slot sorgente disponibili.");
    parsedSelections[level] = value;
    pointsSpent += level * value;
  }
  if (!Object.keys(parsedSelections).length || pointsSpent < cost) ruleError("INVALID_CONVERSION", "Punti slot insufficienti per la conversione.");

  const used = { ...normalized.used, [targetLevel]: targetUsed - 1 };
  for (const [level, amount] of Object.entries(parsedSelections)) used[level] = (used[level] ?? 0) + amount;
  return { pool: { ...normalized, used }, cost, pointsSpent, excess: pointsSpent - cost };
}
