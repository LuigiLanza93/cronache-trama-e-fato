import { describe, expect, it } from "vitest";

import { getDerivedAbilityBonuses, getDerivedArmorClass, getDerivedPassivePerception, getResolvedCharacterRuntime } from "../../src/lib/character-derived-stats";
import { calculateSkillValues, getBaseAbilityScores } from "../../src/utils";

describe("resolved ability scores", () => {
  it("preserves a finite score of zero and defaults only missing or non-finite scores", () => {
    expect(
      getBaseAbilityScores({
        abilityScores: {
          STRENGTH: 0,
          DEXTERITY: Number.NaN,
          CONSTITUTION: Number.POSITIVE_INFINITY,
          INTELLIGENCE: "15",
        },
      })
    ).toEqual({
      strength: 0,
      dexterity: 10,
      constitution: 10,
      intelligence: 15,
      wisdom: 10,
      charisma: 10,
    });
  });

  it("derives the -5 modifier from a score of zero", () => {
    expect(getDerivedAbilityBonuses({ abilityScores: { STRENGTH: 0 } })[0]).toEqual({
      label: "For",
      value: -5,
    });
  });
});

describe("skill ranks and passive perception", () => {
  const perceptionCatalog = [{ name: "Percezione", ability: "SAG" }];

  it.each([
    ["none", 2, 0, 2],
    ["half", 2, 1, 3],
    ["proficient", 2, 3, 5],
    ["expertise", 2, 6, 8],
  ] as const)("calculates the %s rank with the expected proficiency contribution", (rank, abilityModifier, proficiencyContribution, value) => {
    const [perception] = calculateSkillValues(
      {
        basicInfo: { level: 5 },
        abilityScores: { WISDOM: 14 },
        proficiencies: { skills: [{ name: "Percezione", rank }] },
      },
      perceptionCatalog
    );

    expect(perception).toMatchObject({ rank, abilityModifier, proficiencyContribution, value });
  });

  it("uses the legacy proficient boolean when a rank has not yet been persisted", () => {
    const [perception] = calculateSkillValues(
      {
        basicInfo: { level: 5 },
        abilityScores: { WISDOM: 14 },
        proficiencies: { skills: [{ name: "Percezione", proficient: true }] },
      },
      perceptionCatalog
    );

    expect(perception).toMatchObject({ rank: "proficient", proficiencyContribution: 3, value: 5 });
  });

  it("includes the same rank and active passive skill bonus in passive perception", () => {
    const state = {
      basicInfo: { level: 5 },
      abilityScores: { WISDOM: 14 },
      proficiencies: {
        skills: [{ name: "Percezione", ability: "SAG", rank: "proficient" }],
      },
      capabilities: [
        {
          kind: "passive",
          name: "Occhio vigile",
          passiveEffects: [{ target: "SKILL_PERCEZIONE", valueMode: "FLAT", value: 2 }],
        },
      ],
    };

    expect(getDerivedPassivePerception(state)).toBe(17);
  });
});

describe("guided creation derived defenses", () => {
  it("uses a monk's unarmored defense in the shared runtime", () => {
    const state = {
      abilityScores: { dexterity: 16, wisdom: 16 },
      creation: { resolved: { identity: { classKey: "monk" } } },
    };
    expect(getDerivedArmorClass(state)).toBe(16);
  });

  it("uses draconic resilience while unarmored", () => {
    const state = {
      abilityScores: { dexterity: 16 },
      creation: { resolved: { identity: { classKey: "sorcerer" }, choices: { "class:sorcerer:origin": ["draconic-bloodline"] } } },
    };
    expect(getDerivedArmorClass(state)).toBe(16);
  });

  it("includes creation passive effects in shared armor calculations", () => {
    const state = {
      abilityScores: { dexterity: 16 },
      creationCapabilities: [{ kind: "passive", passiveEffects: [{ target: "ARMOR_CLASS", valueMode: "FLAT", value: 1, trigger: "WHILE_ARMORED" }] }],
    };
    const items = [{ id: "item", isEquipped: true, itemDefinitionId: "armor" }] as any;
    const definitions = { armor: { id: "armor", category: "ARMOR", armorClassBase: 11, armorClassCalculation: "BASE_PLUS_DEX" } } as any;
    expect(getResolvedCharacterRuntime(state, items, definitions).passiveCapabilities).toHaveLength(1);
    expect(getDerivedArmorClass(state, items, definitions)).toBe(15);
  });
});
