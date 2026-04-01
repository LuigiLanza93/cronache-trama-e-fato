function makeCrRule(minCr, maxCr, dc) {
  return {
    id: maxCr === null ? `cr:${minCr}+` : `cr:${minCr}-${maxCr}`,
    minCr,
    maxCr,
    dc,
  };
}

function makeRarityRule(rarity, dc) {
  return {
    id: `rarity:${rarity.toLocaleLowerCase("it-IT").replace(/\s+/g, "-")}`,
    rarity,
    dc,
  };
}

export const MONSTER_DISCOVERY_DC_BY_CR_RULES = [
  makeCrRule(0, 4, 10),
  makeCrRule(5, 10, 15),
  makeCrRule(11, 16, 20),
  makeCrRule(17, null, 25),
];

export const MONSTER_DISCOVERY_DC_BY_RARITY_RULES = [
  makeRarityRule("Comune", 10),
  makeRarityRule("Non comune", 15),
  makeRarityRule("Raro", 20),
  makeRarityRule("Molto raro", 25),
  makeRarityRule("Leggendario", 99),
];

export function buildMonsterDiscoveryDcByCrRuleRows(now = new Date().toISOString()) {
  return MONSTER_DISCOVERY_DC_BY_CR_RULES.map((rule) => ({
    ...rule,
    createdAt: now,
    updatedAt: now,
  }));
}

export function buildMonsterDiscoveryDcByRarityRuleRows(now = new Date().toISOString()) {
  return MONSTER_DISCOVERY_DC_BY_RARITY_RULES.map((rule) => ({
    ...rule,
    createdAt: now,
    updatedAt: now,
  }));
}
