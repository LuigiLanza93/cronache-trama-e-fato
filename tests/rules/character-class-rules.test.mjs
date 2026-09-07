import { describe, expect, it } from "vitest";

import {
  CLASS_RULES,
  PACT_MAGIC_SLOT_PROGRESSION,
  SPELLCASTING_SLOT_PROGRESSION,
  SUBCLASS_RULES,
  evaluateMulticlassPrerequisites,
  normalizeClassKey,
  resolveClassAdvancementPreview,
  resolveClassLevel,
  resolveEffectiveCasterLevel,
  resolveHitDicePools,
  resolvePactMagicLevel,
  resolvePactMagicSlots,
  resolveProgressionSummary,
  resolveProficiencyBonus,
  resolveSpellcastingProgression,
  resolveSpellcastingSlots,
  resolveSubclassEligibility,
} from "../../shared/character-class-rules.mjs";

describe("character class catalog", () => {
  it.each([
    ["Guerriero", "fighter"],
    ["fighter", "fighter"],
    ["Ladro", "rogue"],
    ["Bardo", "bard"],
    ["Mago", "wizard"],
  ])("normalizes the stable key for %s", (input, expected) => {
    expect(normalizeClassKey(input)).toBe(expected);
  });

  it("keeps labels separate from stable keys and records ruleset provenance", () => {
    expect(CLASS_RULES.fighter).toMatchObject({
      key: "fighter",
      labels: { it: "Guerriero", en: "Fighter" },
      hitDie: 10,
      source: { rulesetId: "srd-5.1-2014", version: "5.1" },
    });
  });

  it("records each catalogued caster ability and the associated 2014/SRD subclasses", () => {
    expect(CLASS_RULES.wizard.spellcastingAbility).toBe("intelligence");
    expect(CLASS_RULES.warlock.spellcastingAbility).toBe("charisma");
    expect(CLASS_RULES.fighter.spellcastingAbility).toBeNull();
    expect(normalizeClassKey("Ranger")).toBe("ranger");
    expect(Object.values(SUBCLASS_RULES).map((rule) => rule.classKey)).toEqual(expect.arrayContaining([
      "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
    ]));
    expect(SUBCLASS_RULES["eldritch-knight"]).toMatchObject({ casterKind: "THIRD", spellcastingAbility: "intelligence" });
    expect(SUBCLASS_RULES["arcane-trickster"]).toMatchObject({ casterKind: "THIRD", spellcastingAbility: "intelligence" });
    expect(SUBCLASS_RULES["eldritch-knight"].source).toEqual({ rulesetId: "dnd-5e-2014", version: "2014" });
    expect(SUBCLASS_RULES.champion.source).toEqual({ rulesetId: "srd-5.1-2014", version: "5.1" });
  });
});

describe("progression resolvers", () => {
  it("resolves total level, per-class level, proficiency and Hit Dice pools", () => {
    const classes = [{ classKey: "wizard", level: 3 }, { classKey: "fighter", level: 2 }];
    expect(resolveClassLevel(classes, "Mago")).toBe(3);
    expect(resolveProficiencyBonus(classes)).toBe(3);
    expect(resolveHitDicePools(classes)).toEqual({
      pools: { d6: 3, d8: 0, d10: 2, d12: 0 },
      unresolvedClassKeys: [],
    });
  });

  it.each([
    [[{ classKey: "wizard", level: 3 }, { classKey: "cleric", level: 2 }], 5],
    [[{ classKey: "wizard", level: 3 }, { classKey: "paladin", level: 4 }], 5],
    [[{ classKey: "paladin", level: 2 }, { classKey: "ranger", level: 3 }], 2],
    [[{ classKey: "wizard", level: 3 }, { classKey: "fighter", level: 3, subclassKey: "eldritch-knight" }], 4],
  ])("calculates per-class caster contribution for %j", (classes, expected) => {
    expect(resolveEffectiveCasterLevel(classes)).toEqual({ level: expected, unresolvedClassKeys: [] });
  });

  it("keeps Pact Magic separate from shared Spellcasting", () => {
    const classes = [{ classKey: "warlock", level: 5 }, { classKey: "wizard", level: 3 }];
    expect(resolveEffectiveCasterLevel(classes)).toEqual({ level: 3, unresolvedClassKeys: [] });
    expect(resolvePactMagicLevel(classes)).toEqual({ level: 5, unresolvedClassKeys: [] });
    expect(resolveProgressionSummary(classes)).toMatchObject({
      characterLevel: 8,
      proficiencyBonus: 3,
      hitDicePools: { d6: 3, d8: 5, d10: 0, d12: 0 },
      effectiveCasterLevel: 3,
      pactMagicLevel: 5,
    });
  });

  it("resolves maximum Spellcasting slots from effective caster level without consumed state", () => {
    expect(SPELLCASTING_SLOT_PROGRESSION[3]).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(resolveSpellcastingSlots(0)).toEqual({
      progressionLevel: 0,
      slots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    });
    expect(resolveSpellcastingSlots(7)).toEqual({
      progressionLevel: 7,
      slots: { 1: 4, 2: 3, 3: 3, 4: 1, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
    });
    expect(SPELLCASTING_SLOT_PROGRESSION[18]).toEqual([4, 3, 3, 3, 3, 1, 1, 1, 1]);
    expect(SPELLCASTING_SLOT_PROGRESSION[19]).toEqual([4, 3, 3, 3, 3, 2, 1, 1, 1]);
    expect(resolveSpellcastingSlots(20).slots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 });
    expect(() => resolveSpellcastingSlots(21)).toThrow(expect.objectContaining({ code: "INVALID_PROGRESSION_LEVEL" }));
  });

  it("resolves Pact Magic count and level independently at every breakpoint", () => {
    expect(PACT_MAGIC_SLOT_PROGRESSION[11]).toEqual({ slotCount: 3, slotLevel: 5 });
    expect(resolvePactMagicSlots(0)).toEqual({ pactMagicLevel: 0, slotCount: 0, slotLevel: null });
    expect(resolvePactMagicSlots(1)).toEqual({ pactMagicLevel: 1, slotCount: 1, slotLevel: 1 });
    expect(resolvePactMagicSlots(5)).toEqual({ pactMagicLevel: 5, slotCount: 2, slotLevel: 3 });
    expect(resolvePactMagicSlots(11)).toEqual({ pactMagicLevel: 11, slotCount: 3, slotLevel: 5 });
    expect(resolvePactMagicSlots(17)).toEqual({ pactMagicLevel: 17, slotCount: 4, slotLevel: 5 });
  });

  it("keeps one active source on its class progression, then uses floor contributions for multiple sources", () => {
    expect(resolveSpellcastingProgression([{ classKey: "paladin", level: 1 }])).toMatchObject({
      mode: "NONE", progressionLevel: 0, slots: { 1: 0 },
    });
    expect(resolveProgressionSummary([{ classKey: "paladin", level: 2 }])).toMatchObject({
      effectiveCasterLevel: 1,
      spellcastingSlots: { mode: "SINGLE_SOURCE", progressionLevel: 1, slots: { 1: 2 } },
    });
    expect(resolveProgressionSummary([{ classKey: "paladin", level: 3 }])).toMatchObject({
      effectiveCasterLevel: 1,
      spellcastingSlots: { mode: "SINGLE_SOURCE", progressionLevel: 2, slots: { 1: 3 } },
    });
    expect(resolveProgressionSummary([{ classKey: "ranger", level: 3 }]).spellcastingSlots).toMatchObject({
      mode: "SINGLE_SOURCE", progressionLevel: 2, slots: { 1: 3 },
    });
    expect(resolveProgressionSummary([{ classKey: "fighter", level: 3, subclassKey: "eldritch-knight" }]).spellcastingSlots).toMatchObject({
      mode: "SINGLE_SOURCE", progressionLevel: 1, slots: { 1: 2 },
    });
    expect(resolveProgressionSummary([{ classKey: "fighter", level: 4, subclassKey: "eldritch-knight" }]).spellcastingSlots).toMatchObject({
      mode: "SINGLE_SOURCE", progressionLevel: 2, slots: { 1: 3 },
    });
    expect(resolveProgressionSummary([{ classKey: "wizard", level: 3 }, { classKey: "paladin", level: 3 }])).toMatchObject({
      effectiveCasterLevel: 4,
      spellcastingSlots: { mode: "MULTICLASS", progressionLevel: 4, slots: { 1: 4, 2: 3 } },
    });
    expect(resolveProgressionSummary([{ classKey: "warlock", level: 5 }, { classKey: "wizard", level: 3 }])).toMatchObject({
      effectiveCasterLevel: 3,
      spellcastingSlots: { mode: "SINGLE_SOURCE", progressionLevel: 3, slots: { 1: 4, 2: 2 } },
      pactMagicSlots: { pactMagicLevel: 5, slotCount: 2, slotLevel: 3 },
    });
  });

  it("does not invent rules for a custom class", () => {
    const custom = [{ classKey: "runomante", level: 2 }];
    expect(resolveHitDicePools(custom)).toEqual({
      pools: { d6: 0, d8: 0, d10: 0, d12: 0 },
      unresolvedClassKeys: ["runomante"],
    });
    expect(resolveProgressionSummary(custom)).toMatchObject({
      characterLevel: 2,
      unresolvedClassKeys: ["runomante"],
    });
  });

  it("keeps an uncatalogued or mismatched subclass contribution unresolved", () => {
    expect(resolveEffectiveCasterLevel([
      { classKey: "fighter", level: 3, subclassKey: "custom-arcane-warrior" },
    ])).toEqual({ level: 0, unresolvedClassKeys: ["fighter"] });
    expect(resolveEffectiveCasterLevel([
      { classKey: "wizard", level: 3, subclassKey: "eldritch-knight" },
    ])).toEqual({ level: 0, unresolvedClassKeys: ["wizard"] });
  });

  it.each([
    [[{ classKey: "wizard", level: 1 }, { classKey: "wizard", level: 1 }], "DUPLICATE_CLASS"],
    [[{ classKey: "wizard", level: 21 }], "INVALID_CLASS_LEVEL"],
    [[{ classKey: "wizard", level: 20 }, { classKey: "fighter", level: 1 }], "CHARACTER_LEVEL_LIMIT"],
  ])("rejects invalid class collections", (classes, code) => {
    expect(() => resolveProgressionSummary(classes)).toThrow(expect.objectContaining({ code }));
  });
});

describe("class advancement previews", () => {
  it("increments the selected existing class, reports before/after, and requires the subclass at its class threshold", () => {
    const entries = [{ classKey: "wizard", level: 1 }];
    const snapshot = structuredClone(entries);

    expect(resolveClassAdvancementPreview(entries, "Mago")).toMatchObject({
      status: "SUBCLASS_REQUIRED",
      canAdvance: false,
      targetClassKey: "wizard",
      mode: "INCREMENT_EXISTING",
      before: { characterLevel: 1, effectiveCasterLevel: 1 },
      after: { characterLevel: 2, effectiveCasterLevel: 2 },
      classesAfter: [{ classKey: "wizard", level: 2 }],
    });
    expect(entries).toEqual(snapshot);
  });

  it("accepts a valid selected subclass at the threshold without mutating its inputs", () => {
    const entries = [{ classKey: "wizard", level: 1 }];
    const preview = resolveClassAdvancementPreview(entries, "wizard", { targetSubclassKey: "school-of-evocation" });

    expect(preview).toMatchObject({
      status: "READY",
      canAdvance: true,
      after: { characterLevel: 2 },
      classesAfter: [{ classKey: "wizard", level: 2, subclassKey: "school-of-evocation" }],
    });
    expect(entries).toEqual([{ classKey: "wizard", level: 1 }]);
  });

  it("represents a new class without applying multiclass prerequisites", () => {
    const preview = resolveClassAdvancementPreview([{ classKey: "wizard", level: 3 }], "paladin");
    expect(preview).toMatchObject({
      status: "READY",
      canAdvance: true,
      mode: "ADD_NEW_CLASS",
      targetClassKey: "paladin",
      after: { characterLevel: 4 },
      classesAfter: [{ classKey: "wizard", level: 3 }, { classKey: "paladin", level: 1 }],
    });
  });

  it("keeps cap, custom, and invalid subclass cases explicit", () => {
    expect(resolveClassAdvancementPreview([{ classKey: "wizard", level: 20 }], "wizard")).toMatchObject({
      status: "CHARACTER_LEVEL_LIMIT",
      canAdvance: false,
      after: null,
    });
    expect(resolveClassAdvancementPreview([{ classKey: "wizard", level: 3 }], "runomante")).toMatchObject({
      status: "MANUAL",
      canAdvance: false,
      mode: "ADD_NEW_CLASS",
      after: { unresolvedClassKeys: ["runomante"] },
    });
    expect(resolveClassAdvancementPreview([{ classKey: "wizard", level: 1 }], "wizard", { targetSubclassKey: "eldritch-knight" })).toMatchObject({
      status: "INVALID_SUBCLASS",
      canAdvance: false,
    });
    expect(resolveClassAdvancementPreview([{ classKey: "wizard", level: 1 }], "wizard", { targetSubclassKey: "tradizione-custom" })).toMatchObject({
      status: "MANUAL",
      canAdvance: false,
      subclassEligibility: { status: "MANUAL", requiredLevel: 2 },
    });
    expect(() => resolveClassAdvancementPreview([{ classKey: "wizard", level: 1 }], "")).toThrow(expect.objectContaining({ code: "TARGET_CLASS_KEY_REQUIRED" }));
  });

  it("keeps the preview manual when another class has unresolved rules", () => {
    expect(resolveClassAdvancementPreview([
      { classKey: "wizard", level: 5, subclassKey: "tradizione-custom" },
      { classKey: "fighter", level: 3, subclassKey: "champion" },
    ], "fighter")).toMatchObject({
      status: "MANUAL",
      canAdvance: false,
      after: { unresolvedClassKeys: ["wizard"] },
    });
  });
});

describe("subclass and multiclass eligibility", () => {
  it("uses class level, never total level, for subclass thresholds", () => {
    expect(resolveSubclassEligibility({ classKey: "wizard", level: 1 })).toMatchObject({
      status: "NOT_YET_ELIGIBLE",
      eligible: false,
      requiredLevel: 2,
    });
    expect(resolveSubclassEligibility({ classKey: "wizard", level: 2 })).toMatchObject({
      status: "ELIGIBLE",
      eligible: true,
      requiredLevel: 2,
    });
  });

  it("rejects a subclass associated with another class", () => {
    expect(resolveSubclassEligibility({ classKey: "wizard", level: 3, subclassKey: "eldritch-knight" })).toMatchObject({
      status: "INVALID",
      eligible: false,
    });
  });

  it("checks both current and target class prerequisites", () => {
    expect(evaluateMulticlassPrerequisites(
      [{ classKey: "wizard", level: 3 }],
      "paladin",
      { intelligence: 13, strength: 13, charisma: 12 },
    )).toMatchObject({ status: "INELIGIBLE", eligible: false, failedClassKeys: ["paladin"] });

    expect(evaluateMulticlassPrerequisites(
      [{ classKey: "wizard", level: 3 }],
      "paladin",
      { intelligence: 13, strength: 13, charisma: 13 },
    )).toMatchObject({ status: "ELIGIBLE", eligible: true, failedClassKeys: [] });
  });

  it("supports Fighter's Strength-or-Dexterity prerequisite", () => {
    expect(evaluateMulticlassPrerequisites(
      [{ classKey: "rogue", level: 2 }],
      "fighter",
      { dexterity: 13, strength: 8 },
    )).toMatchObject({ status: "ELIGIBLE", eligible: true });
  });

  it("keeps incomplete custom prerequisites manual", () => {
    expect(evaluateMulticlassPrerequisites(
      [{ classKey: "runomante", level: 2 }],
      "wizard",
      { intelligence: 18 },
    )).toMatchObject({ status: "MANUAL", eligible: false });
  });
});
