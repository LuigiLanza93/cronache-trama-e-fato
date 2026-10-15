import { describe, expect, it } from "vitest";

import {
  prepareCharacterSubclassCorrectionPreview,
  subclassCorrectionRequestSignature,
} from "../../server.js";

function rogueSnapshot({
  level = 3,
  subclassKey = null,
  subclassStatus = "INCOMPLETE_LEGACY",
  resourcePools = [],
} = {}) {
  const state = {
    slug: "ombra",
    characterType: "pg",
    basicInfo: { characterName: "Ombra", class: "Ladro", level },
    combatStats: {
      hitPoints: { max: 24, current: 17, temporary: 4 },
      spellSlots: {
        1: [{ id: "legacy-slot-1", active: true, note: "manuale" }],
      },
    },
    features: [{ id: "legacy-feature", name: "Privilegio manuale" }],
    spells: [{ id: "legacy-spell", name: "Illusione Minore" }],
  };
  return {
    revision: "2026-10-15T10:00:00.000Z",
    state,
    progression: {
      source: "STRUCTURED",
      classes: [{
        classKey: "rogue",
        classRuleId: "rule:rogue",
        label: "Ladro",
        level,
        sortOrder: 0,
        isPrimary: true,
        subclassKey,
        subclassRuleId: subclassKey ? `rule:${subclassKey}` : null,
        subclassStatus,
      }],
      totalLevel: level,
      progressionRevision: 4,
      diagnostics: [],
    },
    schema: { m5Ready: true, m6Ready: true },
    hitPointState: {
      maximumHitPoints: 24,
      currentHitPoints: 17,
      temporaryHitPoints: 4,
      revision: 2,
    },
    hitDicePools: [{ dieSize: 8, maximum: 3, remaining: 1, source: "LEGACY_MANUAL" }],
    resourcePools,
  };
}

describe("independent subclass correction preview", () => {
  it("registers a missing subclass while preserving legacy manual slots and all manual character data", () => {
    const manualPool = {
      id: "pool:manual",
      poolKey: "legacy:manual",
      kind: "MANUAL",
      label: "Slot legacy manuali",
      resetPolicy: "MANUAL",
      revision: 3,
      maximum: { 1: 2 },
      used: { 1: 1 },
      tiers: [{ tierKey: "1", derivedMaximum: null, maximumOverride: 2, maximum: 2, used: 1 }],
      sources: [{ sourceKey: "legacy", sourceKind: "LEGACY" }],
    };
    const original = rogueSnapshot({ resourcePools: [manualPool] });
    const frozenState = JSON.stringify(original.state);
    const preview = prepareCharacterSubclassCorrectionPreview(original, {
      targetClassKey: "rogue",
      targetSubclassKey: "arcane-trickster",
    });

    expect(preview).toMatchObject({
      status: "READY",
      canApply: true,
      mode: "ASSIGN",
      before: { subclassKey: null },
      after: { subclassKey: "arcane-trickster" },
      effects: {
        characterLevel: { before: 3, after: 3 },
        manualContentPreserved: true,
        spellSlots: { changed: false, strategy: "PRESERVE_MANUAL" },
      },
    });
    expect(preview.effects.spellSlots.before).toEqual([manualPool]);
    expect(preview.effects.spellSlots.after).toEqual([manualPool]);
    expect(preview.warnings.join(" ")).toMatch(/gestiti manualmente|gestite manualmente/i);
    expect(JSON.stringify(original.state)).toBe(frozenState);
    expect(preview.effects.hitPoints.before).toEqual(preview.effects.hitPoints.after);
  });

  it("requires a reason only when replacing an existing subclass", () => {
    const snapshot = rogueSnapshot({ subclassKey: "thief", subclassStatus: "SELECTED" });
    const withoutReason = prepareCharacterSubclassCorrectionPreview(snapshot, {
      targetClassKey: "rogue",
      targetSubclassKey: "arcane-trickster",
    });
    expect(withoutReason).toMatchObject({ status: "REASON_REQUIRED", canApply: false, mode: "CHANGE", reasonRequired: true });

    const withReason = prepareCharacterSubclassCorrectionPreview(snapshot, {
      targetClassKey: "rogue",
      targetSubclassKey: "arcane-trickster",
      reason: "Correzione della scheda storica",
    });
    expect(withReason).toMatchObject({ status: "READY", canApply: true, mode: "CHANGE" });
  });

  it("offers authoritative options first and rejects class ownership, threshold and no-op changes", () => {
    const noChoice = prepareCharacterSubclassCorrectionPreview(rogueSnapshot(), { targetClassKey: "rogue" });
    expect(noChoice.status).toBe("SUBCLASS_REQUIRED");
    expect(noChoice.subclassOptions.map((entry) => entry.key)).toEqual(expect.arrayContaining(["thief", "arcane-trickster"]));
    expect(() => prepareCharacterSubclassCorrectionPreview(rogueSnapshot(), { targetClassKey: "wizard" }))
      .toThrowError(expect.objectContaining({ code: "CLASS_NOT_OWNED" }));
    const belowThreshold = prepareCharacterSubclassCorrectionPreview(
      rogueSnapshot({ level: 2 }),
      { targetClassKey: "rogue" },
    );
    expect(belowThreshold).toMatchObject({ status: "LEVEL_REQUIRED", canApply: false, subclassOptions: [] });
    expect(belowThreshold.classOptions).toHaveLength(1);
    const same = prepareCharacterSubclassCorrectionPreview(
      rogueSnapshot({ subclassKey: "thief", subclassStatus: "SELECTED" }),
      { targetClassKey: "rogue", targetSubclassKey: "thief" },
    );
    expect(same).toMatchObject({ status: "ALREADY_SELECTED", canApply: false });
    expect(same.effects.spellSlots.preservedExpended).toEqual(expect.any(Array));
  });

  it("blocks derived reconciliation that would discard consumed tiers", () => {
    const spellcasting = {
      id: "pool:spellcasting",
      poolKey: "spellcasting",
      kind: "SPELLCASTING",
      label: "Slot Incantesimi",
      resetPolicy: "LONG_REST",
      revision: 1,
      maximum: { 1: 2, 3: 1 },
      used: { 1: 1, 3: 1 },
      tiers: [
        { tierKey: "1", derivedMaximum: 2, maximumOverride: null, maximum: 2, used: 1 },
        { tierKey: "3", derivedMaximum: 1, maximumOverride: null, maximum: 1, used: 1 },
      ],
      sources: [],
    };
    const preview = prepareCharacterSubclassCorrectionPreview(
      rogueSnapshot({ resourcePools: [spellcasting] }),
      { targetClassKey: "rogue", targetSubclassKey: "arcane-trickster" },
    );
    expect(preview).toMatchObject({ status: "RESOURCE_CONSUMPTION_CONFLICT", canApply: false });
    expect(preview.reason).toMatch(/slot consumati/i);
  });

  it("does not attribute shared Wizard slots to a Rogue choosing a non-caster subclass", () => {
    const snapshot = rogueSnapshot();
    snapshot.state.basicInfo.level = 8;
    snapshot.progression.totalLevel = 8;
    snapshot.progression.classes.push({
      classKey: "wizard",
      classRuleId: "rule:wizard",
      label: "Mago",
      level: 5,
      sortOrder: 1,
      isPrimary: false,
      subclassKey: "school-of-evocation",
      subclassRuleId: "rule:school-of-evocation",
      subclassStatus: "SELECTED",
    });
    snapshot.resourcePools = [{
      id: "pool:shared",
      poolKey: "spellcasting",
      kind: "SPELLCASTING",
      label: "Slot Incantesimi",
      resetPolicy: "LONG_REST",
      revision: 2,
      maximum: { 1: 4, 2: 3, 3: 2 },
      used: { 1: 1, 2: 0, 3: 0 },
      tiers: [
        { tierKey: "1", derivedMaximum: 4, maximumOverride: null, maximum: 4, used: 1 },
        { tierKey: "2", derivedMaximum: 3, maximumOverride: null, maximum: 3, used: 0 },
        { tierKey: "3", derivedMaximum: 2, maximumOverride: null, maximum: 2, used: 0 },
      ],
      sources: [
        { sourceKey: "wizard", sourceKind: "CLASS" },
        { sourceKey: "rogue", sourceKind: "SUBCLASS" },
      ],
    }];
    const preview = prepareCharacterSubclassCorrectionPreview(snapshot, {
      targetClassKey: "rogue",
      targetSubclassKey: "thief",
    });
    expect(preview.status).toBe("READY");
    expect(preview.effects.spellSlots.removeSourceClassKey).toBe("rogue");
    const pool = preview.effects.spellSlots.after.find((entry) => entry.kind === "SPELLCASTING");
    expect(pool.sourceClassKey).toBeNull();
    expect(pool.sources.map((source) => source.sourceKey)).toEqual(["wizard"]);
  });

  it("removes stale subclass spellcasting provenance without deleting its manually visible pool", () => {
    const snapshot = rogueSnapshot({ subclassKey: "arcane-trickster", subclassStatus: "SELECTED" });
    snapshot.resourcePools = [{
      id: "pool:rogue-spells",
      poolKey: "spellcasting",
      kind: "SPELLCASTING",
      label: "Slot Incantesimi",
      resetPolicy: "LONG_REST",
      revision: 4,
      maximum: { 1: 2 },
      used: { 1: 1 },
      tiers: [{ tierKey: "1", derivedMaximum: 2, maximumOverride: null, maximum: 2, used: 1 }],
      sources: [{ sourceKey: "rogue", sourceKind: "SUBCLASS" }],
    }, {
      id: "pool:maneuvers",
      poolKey: "fighter:maneuvers",
      kind: "CLASS_RESOURCE",
      label: "Dadi superiorita manuali",
      resetPolicy: "SHORT_REST",
      revision: 1,
      maximum: { uses: 4 },
      used: { uses: 2 },
      tiers: [{ tierKey: "uses", derivedMaximum: null, maximumOverride: 4, maximum: 4, used: 2 }],
      sources: [],
    }];
    const preview = prepareCharacterSubclassCorrectionPreview(snapshot, {
      targetClassKey: "rogue",
      targetSubclassKey: "thief",
      reason: "Correzione sottoclasse storica",
    });
    expect(preview).toMatchObject({ status: "READY", canApply: true });
    expect(preview.effects.spellSlots).toMatchObject({
      changed: true,
      strategy: "PRESERVE_MANUAL",
      removeSourceClassKey: "rogue",
    });
    const afterPool = preview.effects.spellSlots.after.find((entry) => entry.kind === "SPELLCASTING");
    expect(afterPool.maximum).toEqual({ 1: 2 });
    expect(afterPool.used).toEqual({ 1: 1 });
    expect(afterPool.sources).toEqual([]);
  });

  it("binds durable retries to the actor and request payload", () => {
    const request = {
      targetClassKey: "rogue",
      targetSubclassKey: "arcane-trickster",
      expectedRevision: "revision-1",
      expectedProgressionRevision: 4,
      reason: "Correzione storica",
    };
    const signature = subclassCorrectionRequestSignature("ombra", request, "dm-1");
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(signature).toBe(subclassCorrectionRequestSignature("ombra", request, "dm-1"));
    expect(signature).not.toBe(subclassCorrectionRequestSignature("ombra", request, "dm-2"));
  });
});
