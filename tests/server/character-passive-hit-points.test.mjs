import { describe, expect, it } from "vitest";

import {
  applyStructuredCharacterRest,
  buildCharacterProgressionEffects,
  prepareStructuredLegacyPatchSync,
} from "../../server.js";

const draconicResilience = {
  name: "Resilienza Draconica",
  kind: "passive",
  passiveEffects: [{
    target: "HIT_POINT_MAX",
    operationType: "BONUS",
    valueMode: "CLASS_LEVEL",
    sourceClassKey: "sorcerer",
    value: 0,
    multiplierNumerator: 1,
    multiplierDenominator: 1,
    rounding: "FLOOR",
    trigger: "ALWAYS",
  }],
};

function snapshot({ withCapability = true, maximum = 52, current = 52, applied = 0 } = {}) {
  return {
    schema: { m5Ready: true, m6Ready: false, passiveHitPointBonusReady: true },
    state: {
      slug: "valthor",
      basicInfo: { class: "Warlock", level: 6 },
      abilityScores: { constitution: 12 },
      combatStats: { hitPointMaximum: maximum, currentHitPoints: current, temporaryHitPoints: 0 },
      capabilities: withCapability ? [draconicResilience] : [],
    },
    progression: {
      source: "STRUCTURED",
      totalLevel: 6,
      classes: [
        { classKey: "warlock", level: 5, isPrimary: true, sortOrder: 0 },
        { classKey: "sorcerer", level: 1, isPrimary: false, sortOrder: 1 },
      ],
    },
    hitPointState: {
      maximumHitPoints: maximum,
      currentHitPoints: current,
      temporaryHitPoints: 0,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      shortRestsUsedSinceLongRest: 0,
      lastShortRestAt: null,
      lastLongRestAt: null,
      revision: 4,
      passiveBonusApplied: applied,
    },
    hitDicePools: [
      { dieSize: 8, maximum: 5, remaining: 5, source: "DERIVED" },
      { dieSize: 6, maximum: 1, remaining: 1, source: "DERIVED" },
    ],
    resourcePools: [],
  };
}

describe("authoritative passive maximum hit points", () => {
  it("materializes a newly saved class-level capability exactly once", () => {
    const before = snapshot({ withCapability: false });
    const next = {
      ...before.state,
      capabilities: [draconicResilience],
    };

    const first = prepareStructuredLegacyPatchSync(before, next, { capabilities: next.capabilities });
    expect(first.hitPointState).toMatchObject({
      maximumHitPoints: 53,
      currentHitPoints: 53,
      passiveBonusApplied: 1,
      revision: 5,
    });

    const projected = snapshot({ maximum: 53, current: 53, applied: 1 });
    const second = prepareStructuredLegacyPatchSync(projected, projected.state, { capabilities: [draconicResilience] });
    expect(second).toBeNull();
  });

  it("persists damage against the projected maximum without adding the passive bonus again", () => {
    const before = snapshot({ maximum: 53, current: 53, applied: 1 });
    const next = {
      ...before.state,
      combatStats: { ...before.state.combatStats, currentHitPoints: 47 },
    };
    const sync = prepareStructuredLegacyPatchSync(before, next, {
      combatStats: { currentHitPoints: 47 },
    });

    expect(sync.hitPointState).toMatchObject({
      maximumHitPoints: 53,
      currentHitPoints: 47,
      passiveBonusApplied: 1,
      revision: 5,
    });
  });

  it("heals and rests against the effective maximum while retaining the tracking value", () => {
    const damaged = snapshot({ maximum: 53, current: 41, applied: 1 });
    const healedState = {
      ...damaged.state,
      combatStats: { ...damaged.state.combatStats, currentHitPoints: 53 },
    };
    const healed = prepareStructuredLegacyPatchSync(damaged, healedState, {
      combatStats: { currentHitPoints: 53 },
    });
    expect(healed.hitPointState).toMatchObject({
      maximumHitPoints: 53,
      currentHitPoints: 53,
      passiveBonusApplied: 1,
    });

    const rested = applyStructuredCharacterRest(damaged, "long", new Date("2026-10-15T12:00:00.000Z"));
    expect(rested.hitPointState).toMatchObject({
      maximumHitPoints: 53,
      currentHitPoints: 53,
      passiveBonusApplied: 1,
    });
  });

  it("removes the tracked bonus once and does not revive a character at zero PF", () => {
    const before = snapshot({ maximum: 53, current: 0, applied: 1 });
    const next = { ...before.state, capabilities: [] };
    const sync = prepareStructuredLegacyPatchSync(before, next, { capabilities: [] });
    expect(sync.hitPointState).toMatchObject({
      maximumHitPoints: 52,
      currentHitPoints: 0,
      passiveBonusApplied: 0,
      revision: 5,
    });
  });

  it("adds the base level gain and the new Sorcerer class-level bonus delta", () => {
    const before = snapshot({ maximum: 53, current: 53, applied: 1 });
    const effects = buildCharacterProgressionEffects(before, {
      targetClassKey: "sorcerer",
      after: { characterLevel: 7 },
      classesAfter: [
        { classKey: "warlock", level: 5 },
        { classKey: "sorcerer", level: 2 },
      ],
    });

    expect(effects.status).toBe("READY");
    expect(effects.hitPoints).toMatchObject({
      gained: 7,
      after: {
        maximumHitPoints: 61,
        currentHitPoints: 61,
        passiveBonusApplied: 2,
        revision: 5,
      },
    });
  });
});
