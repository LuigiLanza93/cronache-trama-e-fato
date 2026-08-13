import { describe, expect, it } from "vitest";

import { applyCharacterRest } from "../../server.js";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function makeCharacter({
  level = 5,
  currentHitPoints = 5,
  hitPointMaximum = 20,
  temporaryHitPoints = 3,
  constitution = 10,
  maxHitDice = level,
  hitDiceRemaining = maxHitDice,
  lastLongRestAt = null,
  deathSaves = { successes: 2, failures: 1 },
} = {}) {
  return {
    slug: "mira",
    untouched: { nested: ["value"] },
    basicInfo: { characterName: "Mira", class: "Guerriero", level },
    abilityScores: { constitution },
    combatStats: {
      hitPointMaximum,
      currentHitPoints,
      temporaryHitPoints,
      hitDice: `${level}d10`,
      deathSaves,
      spellSlots: { 1: [{ id: "slot-1", active: true }] },
      restState: {
        maxHitDice,
        hitDiceRemaining,
        shortRestsUsedSinceLongRest: 2,
        lastLongRestAt,
      },
    },
    capabilities: [{
      name: "Second Wind",
      usage: { resetOn: "shortRest", used: [true] },
    }],
  };
}

describe("applyCharacterRest short rest", () => {
  it("allows spending zero Hit Dice without healing", () => {
    const result = applyCharacterRest(makeCharacter(), "short", { hitDiceSpent: 0, hitDiceRollTotal: 0 }, NOW);

    expect(result.summary).toMatchObject({
      applied: true,
      healingApplied: 0,
      hitDiceSpent: 0,
      hitDiceRemaining: 5,
      hitDiceRemainingAfter: 5,
      shortRestsUsedSinceLongRestAfter: 3,
    });
    expect(result.character.combatStats.currentHitPoints).toBe(5);
  });

  it("applies a negative Constitution modifier to one spent Hit Die", () => {
    const result = applyCharacterRest(
      makeCharacter({ constitution: 6, hitDiceRemaining: 4 }),
      "short",
      { hitDiceSpent: 1, hitDiceRollTotal: 4 },
      NOW,
    );

    expect(result.summary).toMatchObject({ healingApplied: 2, hitDiceSpent: 1, hitDiceRemainingAfter: 3 });
    expect(result.character.combatStats.currentHitPoints).toBe(7);
  });

  it("spends multiple Hit Dice and caps healing at maximum HP", () => {
    const result = applyCharacterRest(
      makeCharacter({ constitution: 14, currentHitPoints: 10, hitDiceRemaining: 4 }),
      "short",
      { hitDiceSpent: 3, hitDiceRollTotal: 15 },
      NOW,
    );

    expect(result.summary).toMatchObject({ healingApplied: 10, hitDiceSpent: 3, hitDiceRemainingAfter: 1 });
    expect(result.character.combatStats.currentHitPoints).toBe(20);
  });

  it.each([
    [{ hitDiceSpent: -1, hitDiceRollTotal: 0 }],
    [{ hitDiceSpent: 6, hitDiceRollTotal: 6 }],
    [{ hitDiceSpent: 1.5, hitDiceRollTotal: 2 }],
    [{ hitDiceSpent: "1", hitDiceRollTotal: 2 }],
    [{ hitDiceSpent: 0, hitDiceRollTotal: 1 }],
    [{ hitDiceSpent: 2, hitDiceRollTotal: 1 }],
    [{ hitDiceSpent: 2, hitDiceRollTotal: 21 }],
    [{ hitDiceSpent: 2, hitDiceRollTotal: 2.5 }],
  ])("rejects invalid spent/roll combinations", (options) => {
    expect(() => applyCharacterRest(makeCharacter(), "short", options, NOW)).toThrow();
  });
});

describe("applyCharacterRest long rest", () => {
  it("recovers half the maximum Hit Dice rounded down at odd levels", () => {
    const result = applyCharacterRest(
      makeCharacter({ level: 5, maxHitDice: 5, hitDiceRemaining: 1 }),
      "long",
      {},
      NOW,
    );

    expect(result.summary).toMatchObject({ applied: true, hitDiceRecovered: 2, hitDiceRemainingAfter: 3 });
  });

  it("recovers at least one Hit Die", () => {
    const result = applyCharacterRest(
      makeCharacter({ level: 1, maxHitDice: 1, hitDiceRemaining: 0 }),
      "long",
      {},
      NOW,
    );

    expect(result.summary).toMatchObject({ hitDiceRecovered: 1, hitDiceRemainingAfter: 1 });
  });

  it("is blocked when the character starts at 0 HP", () => {
    const character = makeCharacter({ currentHitPoints: 0, hitDiceRemaining: 1 });
    const before = structuredClone(character);
    const result = applyCharacterRest(character, "long", {}, NOW);

    expect(result.summary).toMatchObject({ applied: false, currentHitPointsAfter: 0, hitDiceRemainingAfter: 1 });
    expect(result.summary.reason).toContain("almeno 1 PF");
    expect(character).toEqual(before);
  });

  it("is blocked within 24 hours of the previous long rest", () => {
    const character = makeCharacter({ lastLongRestAt: "2026-08-12T13:00:00.000Z", hitDiceRemaining: 1 });
    const before = structuredClone(character);
    const result = applyCharacterRest(character, "long", {}, NOW);

    expect(result.summary.applied).toBe(false);
    expect(result.summary.reason).toContain("ultime 24 ore");
    expect(character).toEqual(before);
  });

  it("rejects Hit Dice options on a long rest", () => {
    expect(() => applyCharacterRest(
      makeCharacter(),
      "long",
      { hitDiceSpent: 1, hitDiceRollTotal: 5 },
      NOW,
    )).toThrow("non accetta Dadi Vita");
  });
});

describe("applyCharacterRest state safety", () => {
  it("resets death saves only when the final HP total is positive", () => {
    const unconscious = makeCharacter({ currentHitPoints: 0, constitution: 10, deathSaves: { successes: 2, failures: 2 } });

    const noHealing = applyCharacterRest(unconscious, "short", { hitDiceSpent: 0, hitDiceRollTotal: 0 }, NOW);
    expect(noHealing.character.combatStats.deathSaves).toEqual({ successes: 2, failures: 2 });

    const healed = applyCharacterRest(unconscious, "short", { hitDiceSpent: 1, hitDiceRollTotal: 4 }, NOW);
    expect(healed.character.combatStats.currentHitPoints).toBe(4);
    expect(healed.character.combatStats.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it.each(["short", "long"])("does not mutate its input during a %s rest", (restType) => {
    const character = makeCharacter({ hitDiceRemaining: 2 });
    const before = structuredClone(character);
    const options = restType === "short" ? { hitDiceSpent: 1, hitDiceRollTotal: 5 } : {};

    const result = applyCharacterRest(character, restType, options, NOW);

    expect(character).toEqual(before);
    expect(result.character).not.toBe(character);
    expect(result.character.untouched).toEqual(before.untouched);
  });
});
