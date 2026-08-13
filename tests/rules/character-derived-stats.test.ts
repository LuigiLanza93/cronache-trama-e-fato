import { describe, expect, it } from "vitest";

import { getDerivedAbilityBonuses, getDerivedPassivePerception } from "../../src/lib/character-derived-stats";
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
