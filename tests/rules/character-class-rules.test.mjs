import { describe, expect, it } from "vitest";

import {
  CLASS_RULES,
  evaluateMulticlassPrerequisites,
  normalizeClassKey,
  resolveClassLevel,
  resolveEffectiveCasterLevel,
  resolveHitDicePools,
  resolvePactMagicLevel,
  resolveProgressionSummary,
  resolveProficiencyBonus,
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
