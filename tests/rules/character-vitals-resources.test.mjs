import { describe, expect, it } from "vitest";

import {
  applyLongRestToHitDicePools,
  applyShortRestToHitDicePools,
  convertSpellcastingPool,
  deriveHitDiePools,
  resetResourcePools,
  resolveLevelUpHitPoints,
} from "../../shared/character-vitals-resources.mjs";

describe("M5 vitality rules", () => {
  it("records full class Hit Die plus Constitution, with a minimum of one", () => {
    expect(resolveLevelUpHitPoints({ hitDieSize: 10, constitutionModifier: 2 })).toMatchObject({ gained: 12, method: "HOUSE_RULE_MAX" });
    expect(resolveLevelUpHitPoints({ hitDieSize: 6, constitutionModifier: -8 })).toMatchObject({ gained: 1 });
  });

  it("derives separate full Hit Dice pools with the M2 class resolver", () => {
    expect(deriveHitDiePools([{ classKey: "wizard", level: 3 }, { classKey: "fighter", level: 2 }])).toEqual({
      pools: [{ dieSize: 6, maximum: 3, remaining: 3 }, { dieSize: 8, maximum: 0, remaining: 0 }, { dieSize: 10, maximum: 2, remaining: 2 }, { dieSize: 12, maximum: 0, remaining: 0 }],
      unresolvedClassKeys: [],
    });
  });

  it("uses the versioned d12>d10>d8>d6 ordering and never mutates pools", () => {
    const pools = [{ dieSize: 6, maximum: 2, remaining: 2 }, { dieSize: 10, maximum: 2, remaining: 2 }];
    const before = structuredClone(pools);
    const result = applyShortRestToHitDicePools({ pools, currentHitPoints: 0, maximumHitPoints: 20, constitutionModifier: 0 });
    expect(result).toMatchObject({ healingApplied: 12, hitDiceSpent: 2, hitDiceSpentBySize: { d10: 2 }, currentHitPoints: 12, shortRestsUsedSinceLongRest: 1 });
    expect(result.pools).toEqual([{ dieSize: 10, maximum: 2, remaining: 0 }, { dieSize: 6, maximum: 2, remaining: 2 }]);
    expect(pools).toEqual(before);
  });

  it("uses half the total maximum with minimum one, stops at missing HP, and blocks the third short rest", () => {
    const pools = [{ dieSize: 8, maximum: 1, remaining: 1 }, { dieSize: 6, maximum: 4, remaining: 4 }];
    expect(applyShortRestToHitDicePools({ pools, currentHitPoints: 19, maximumHitPoints: 20, constitutionModifier: -10 })).toMatchObject({ healingApplied: 1, hitDiceSpent: 1, hitDiceSpentBySize: { d8: 1 } });
    expect(applyShortRestToHitDicePools({ pools, currentHitPoints: 0, maximumHitPoints: 30, constitutionModifier: 0, shortRestsUsedSinceLongRest: 2 })).toMatchObject({ applied: false, reason: "SHORT_REST_LIMIT_REACHED", shortRestsUsedSinceLongRest: 2 });
  });

  it("long rest fully recovers every pool and resets the short-rest counter", () => {
    expect(applyLongRestToHitDicePools({ pools: [{ dieSize: 12, maximum: 2, remaining: 0 }, { dieSize: 6, maximum: 3, remaining: 1 }], shortRestsUsedSinceLongRest: 2 })).toEqual({
      pools: [{ dieSize: 12, maximum: 2, remaining: 2 }, { dieSize: 6, maximum: 3, remaining: 3 }], hitDiceRecovered: 4, shortRestsUsedSinceLongRest: 0,
    });
  });
});

describe("M6 resource pools", () => {
  const pools = [
    { id: "spell", kind: "SPELLCASTING", resetPolicy: "LONG_REST", maximum: { 1: 4, 2: 2 }, used: { 1: 1, 2: 1 } },
    { id: "pact", kind: "PACT_MAGIC", resetPolicy: "SHORT_REST", maximum: { 3: 2 }, used: { 3: 2 } },
    { id: "maneuvers", kind: "CLASS_RESOURCE", resetPolicy: "SHORT_REST", maximum: { 0: 4 }, used: { 0: 3 } },
    { id: "manual", kind: "MANUAL", resetPolicy: "MANUAL", maximum: { 0: 1 }, used: { 0: 1 } },
  ];

  it("resets pools by resetPolicy, not by class name", () => {
    expect(resetResourcePools(pools, "SHORT_REST").map((pool) => [pool.id, pool.used])).toEqual([
      ["spell", { 1: 1, 2: 1 }], ["pact", { 3: 0 }], ["maneuvers", { 0: 0 }], ["manual", { 0: 1 }],
    ]);
    expect(resetResourcePools(pools, "LONG_REST").map((pool) => [pool.id, pool.used])).toEqual([
      ["spell", { 1: 0, 2: 0 }], ["pact", { 3: 0 }], ["maneuvers", { 0: 0 }], ["manual", { 0: 1 }],
    ]);
  });

  it("converts only shared Spellcasting capacity and preserves Pact Magic", () => {
    const result = convertSpellcastingPool(pools[0], { targetLevel: 2, selections: { 1: 3 } });
    expect(result).toMatchObject({ cost: 3, pointsSpent: 3, excess: 0, pool: { used: { 1: 4, 2: 0 } } });
    expect(() => convertSpellcastingPool(pools[1], { targetLevel: 3, selections: { 1: 1 } })).toThrow(expect.objectContaining({ code: "SPELLCASTING_POOL_REQUIRED" }));
  });

  it("rejects invalid spent state and unavailable conversion sources", () => {
    expect(() => resetResourcePools([{ ...pools[0], used: { 1: 5 } }], "LONG_REST")).toThrow(expect.objectContaining({ code: "INVALID_RESOURCE_POOL" }));
    expect(() => convertSpellcastingPool(pools[0], { targetLevel: 2, selections: { 1: 4 } })).toThrow(expect.objectContaining({ code: "INVALID_CONVERSION" }));
  });
});
