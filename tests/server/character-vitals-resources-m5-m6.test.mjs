import { describe, expect, it } from "vitest";

import {
  applyStructuredCharacterRest,
  legacySpellSlotsFromResourcePools,
  prepareStructuredResourcePoolUsage,
  prepareStructuredLegacyPatchSync,
  prepareCharacterProgressionPreview,
} from "../../server.js";

function progressionSnapshot(overrides = {}) {
  return {
    revision: "revision-1",
    state: {
      slug: "mira",
      characterType: "pg",
      basicInfo: { characterName: "Mira", class: "Guerriero", level: 1 },
      abilityScores: { constitution: 14 },
      combatStats: {
        hitPointMaximum: 12,
        currentHitPoints: 6,
        temporaryHitPoints: 0,
        deathSaves: { successes: 1, failures: 1 },
        spellSlots: {},
      },
      capabilities: [],
    },
    progression: {
      source: "STRUCTURED",
      classes: [{
        classKey: "fighter",
        classRuleId: "rule:fighter",
        level: 1,
        sortOrder: 0,
        isPrimary: true,
        subclassKey: null,
        subclassStatus: "NOT_YET_ELIGIBLE",
      }],
      totalLevel: 1,
      progressionRevision: 0,
      diagnostics: [],
    },
    schema: { m5Ready: true, m6Ready: true },
    hitPointState: {
      maximumHitPoints: 12,
      currentHitPoints: 6,
      temporaryHitPoints: 0,
      deathSaveSuccesses: 1,
      deathSaveFailures: 1,
      shortRestsUsedSinceLongRest: 0,
      lastShortRestAt: null,
      lastLongRestAt: null,
      revision: 0,
      backfillStatus: "BACKFILLED",
      backfillIssues: [],
    },
    hitDicePools: [{ id: "d10", dieSize: 10, maximum: 1, remaining: 1, source: "DERIVED" }],
    resourcePools: [],
    ...overrides,
  };
}

describe("M5 progression effects", () => {
  it("blocks progression when the M5 schema exists but vitality state is missing", () => {
    const snapshot = progressionSnapshot({ hitPointState: null, hitDicePools: [] });
    const preview = prepareCharacterProgressionPreview(snapshot, { targetClassKey: "fighter" });

    expect(preview).toMatchObject({ status: "VITALS_NOT_READY", canApply: false });
  });

  it("adds full class Hit Die plus Constitution and one die to its pool", () => {
    const preview = prepareCharacterProgressionPreview(progressionSnapshot(), { targetClassKey: "fighter" });

    expect(preview.effects).toMatchObject({
      status: "READY",
      hitPoints: {
        hitDieSize: 10,
        constitutionModifier: 2,
        gained: 12,
        method: "HOUSE_RULE_MAX",
        after: { maximumHitPoints: 24, currentHitPoints: 18 },
      },
      hitDicePools: {
        after: [{ dieSize: 10, maximum: 2, remaining: 2 }],
      },
    });
  });

  it("adjusts authoritative maximum and current HP when Constitution changes", () => {
    const snapshot = progressionSnapshot({
      progression: { ...progressionSnapshot().progression, totalLevel: 3 },
      state: {
        ...progressionSnapshot().state,
        abilityScores: { ...progressionSnapshot().state.abilityScores, constitution: 10 },
      },
    });
    const next = {
      ...snapshot.state,
      abilityScores: { ...snapshot.state.abilityScores, constitution: 16 },
    };

    const sync = prepareStructuredLegacyPatchSync(snapshot, next, { abilityScores: { constitution: 16 } });

    expect(sync).toMatchObject({
      hitPointState: { maximumHitPoints: 21, currentHitPoints: 15, revision: 1 },
      hitPointAdjustment: {
        adjustmentType: "CONSTITUTION_CHANGE",
        delta: 9,
        constitutionModifierBefore: 0,
        constitutionModifierAfter: 3,
        totalLevel: 3,
      },
    });
  });

  it("applies deterministic Constitution deltas to legacy-manual vitality states", () => {
    const snapshot = progressionSnapshot({
      progression: { ...progressionSnapshot().progression, totalLevel: 3 },
      hitPointState: { ...progressionSnapshot().hitPointState, backfillStatus: "LEGACY_MANUAL" },
    });
    const next = {
      ...snapshot.state,
      abilityScores: { ...snapshot.state.abilityScores, constitution: 16 },
    };

    expect(prepareStructuredLegacyPatchSync(snapshot, next, { abilityScores: { constitution: 16 } })).toMatchObject({
      hitPointState: { maximumHitPoints: 15, currentHitPoints: 9, backfillStatus: "LEGACY_MANUAL" },
      hitPointAdjustment: { adjustmentType: "CONSTITUTION_CHANGE", delta: 3, totalLevel: 3 },
    });
  });

  it("reduces authoritative HP when the Constitution modifier decreases", () => {
    const base = progressionSnapshot();
    const snapshot = progressionSnapshot({
      progression: { ...base.progression, totalLevel: 5 },
      state: { ...base.state, abilityScores: { ...base.state.abilityScores, constitution: 20 } },
      hitPointState: {
        ...base.hitPointState,
        maximumHitPoints: 65,
        currentHitPoints: 65,
        backfillStatus: "LEGACY_MANUAL",
      },
    });
    const next = {
      ...snapshot.state,
      abilityScores: { ...snapshot.state.abilityScores, constitution: 12 },
    };

    expect(prepareStructuredLegacyPatchSync(snapshot, next, { abilityScores: { constitution: 12 } })).toMatchObject({
      hitPointState: { maximumHitPoints: 45, currentHitPoints: 45, backfillStatus: "LEGACY_MANUAL" },
      hitPointAdjustment: {
        adjustmentType: "CONSTITUTION_CHANGE",
        delta: -20,
        constitutionModifierBefore: 5,
        constitutionModifierAfter: 1,
        totalLevel: 5,
      },
    });
  });
});

describe("M5/M6 structured rests", () => {
  it("spends the largest Hit Die first and resets only short-rest resources", () => {
    const snapshot = progressionSnapshot({
      hitDicePools: [
        { id: "d12", dieSize: 12, maximum: 1, remaining: 1, source: "DERIVED" },
        { id: "d6", dieSize: 6, maximum: 3, remaining: 3, source: "DERIVED" },
      ],
      resourcePools: [
        { id: "pact", poolKey: "pact-magic", kind: "PACT_MAGIC", label: "Patto", resetPolicy: "SHORT_REST", maximum: { 2: 2 }, used: { 2: 2 } },
        { id: "spell", poolKey: "spellcasting", kind: "SPELLCASTING", label: "Slot", resetPolicy: "LONG_REST", maximum: { 1: 4 }, used: { 1: 2 } },
      ],
    });

    const result = applyStructuredCharacterRest(snapshot, "short", new Date("2026-09-22T12:00:00.000Z"));

    expect(result.summary).toMatchObject({ applied: true, hitDiceSpentBySize: { d12: 1 } });
    expect(result.hitDicePools.find((pool) => pool.dieSize === 12)?.remaining).toBe(0);
    expect(result.resourcePools.find((pool) => pool.kind === "PACT_MAGIC")?.used).toEqual({ 2: 0 });
    expect(result.resourcePools.find((pool) => pool.kind === "SPELLCASTING")?.used).toEqual({ 1: 2 });
  });

  it("projects a class resource separately without treating it as Spellcasting", () => {
    const projected = legacySpellSlotsFromResourcePools([{
      id: "maneuvers",
      poolKey: "fighter-maneuvers",
      kind: "CLASS_RESOURCE",
      maximum: { 0: 4 },
      used: { 0: 2 },
    }]);

    expect(projected[0]).toHaveLength(4);
    expect(projected[0].map((slot) => slot.active)).toEqual([true, true, false, false]);
  });

  it("updates only the selected resource pool and enforces its revision", () => {
    const snapshot = progressionSnapshot({
      resourcePools: [
        { id: "spell", poolKey: "spellcasting", kind: "SPELLCASTING", revision: 2, maximum: { 1: 4 }, used: { 1: 1 } },
        { id: "pact", poolKey: "pact-magic", kind: "PACT_MAGIC", revision: 5, maximum: { 2: 2 }, used: { 2: 0 } },
      ],
    });

    const prepared = prepareStructuredResourcePoolUsage(snapshot, snapshot.state, {
      poolKey: "pact-magic",
      tierKey: "2",
      used: 1,
      expectedPoolRevision: 5,
    });

    expect(prepared.updatedPool).toMatchObject({ poolKey: "pact-magic", revision: 6, used: { 2: 1 } });
    expect(prepared.resourcePools.find((pool) => pool.poolKey === "spellcasting")?.used).toEqual({ 1: 1 });
    expect(() => prepareStructuredResourcePoolUsage(snapshot, snapshot.state, {
      poolKey: "pact-magic",
      tierKey: "2",
      used: 1,
      expectedPoolRevision: 4,
    })).toThrow(/modificato/);
  });
});
