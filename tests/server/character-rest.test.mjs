import { describe, expect, it } from "vitest";

import { applyCharacterRest, validateRestClientOptions } from "../../server.js";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function makeCharacter({
  level = 5,
  currentHitPoints = 5,
  hitPointMaximum = 20,
  temporaryHitPoints = 3,
  constitution = 10,
  maxHitDice = level,
  hitDiceRemaining = maxHitDice,
  shortRestsUsedSinceLongRest = 0,
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
        shortRestsUsedSinceLongRest,
        lastLongRestAt,
      },
    },
    capabilities: [
      { name: "Second Wind", usage: { resetOn: "shortRest", used: [true] } },
      { name: "Long Rest Feature", usage: { resetOn: "longRest", used: [true] } },
    ],
  };
}

describe("applyCharacterRest short rest", () => {
  it("automatically spends only the Hit Dice needed for the missing HP", () => {
    const result = applyCharacterRest(
      makeCharacter({ constitution: 14, currentHitPoints: 15, hitDiceRemaining: 5 }),
      "short",
      NOW,
    );

    expect(result.summary).toMatchObject({
      applied: true,
      healingApplied: 5,
      hitDiceSpent: 1,
      hitDiceRemaining: 5,
      hitDiceRemainingAfter: 4,
      shortRestsUsedSinceLongRestAfter: 1,
    });
    expect(result.character.combatStats.currentHitPoints).toBe(20);
    expect(result.character.combatStats.restState.lastShortRestAt).toBe(NOW.toISOString());
  });

  it("spends at most half the maximum Hit Dice, rounded down", () => {
    const result = applyCharacterRest(
      makeCharacter({ currentHitPoints: 0, hitPointMaximum: 40, hitDiceRemaining: 5 }),
      "short",
      NOW,
    );

    expect(result.summary).toMatchObject({ healingApplied: 12, hitDiceSpent: 2, hitDiceRemainingAfter: 3 });
    expect(result.character.combatStats.currentHitPoints).toBe(12);
  });

  it("allows a minimum budget of one Hit Die when the maximum is positive", () => {
    const result = applyCharacterRest(
      makeCharacter({ level: 1, currentHitPoints: 0, hitDiceRemaining: 1 }),
      "short",
      NOW,
    );

    expect(result.summary).toMatchObject({ healingApplied: 6, hitDiceSpent: 1, hitDiceRemainingAfter: 0 });
  });

  it("limits automatic spending to the remaining Hit Dice", () => {
    const result = applyCharacterRest(
      makeCharacter({ level: 8, currentHitPoints: 0, hitPointMaximum: 40, hitDiceRemaining: 1 }),
      "short",
      NOW,
    );

    expect(result.summary).toMatchObject({ healingApplied: 6, hitDiceSpent: 1, hitDiceRemainingAfter: 0 });
  });

  it("uses fixed die average plus Constitution modifier, with at least one HP per die", () => {
    const result = applyCharacterRest(
      makeCharacter({ constitution: 0, currentHitPoints: 1, hitPointMaximum: 20, hitDiceRemaining: 5 }),
      "short",
      NOW,
    );

    expect(result.summary).toMatchObject({ healingApplied: 2, hitDiceSpent: 2, hitDiceRemainingAfter: 3 });
  });

  it("does not spend Hit Dice when no healing is needed", () => {
    const result = applyCharacterRest(
      makeCharacter({ currentHitPoints: 20, hitDiceRemaining: 3, shortRestsUsedSinceLongRest: 1 }),
      "short",
      NOW,
    );

    expect(result.summary).toMatchObject({
      applied: true,
      healingApplied: 0,
      hitDiceSpent: 0,
      hitDiceRemainingAfter: 3,
      shortRestsUsedSinceLongRestAfter: 2,
    });
  });

  it("blocks a third short rest and leaves all character state unchanged", () => {
    const character = makeCharacter({ shortRestsUsedSinceLongRest: 2 });
    const before = structuredClone(character);
    const result = applyCharacterRest(character, "short", NOW);

    expect(result.summary).toMatchObject({
      applied: false,
      hitDiceSpent: 0,
      shortRestsUsedSinceLongRestAfter: 2,
    });
    expect(result.summary.reason).toContain("Limite di 2 riposi brevi");
    expect(result.character).toBe(character);
    expect(character).toEqual(before);
  });

  it("resets short-rest capabilities and the existing Fighter slot pool", () => {
    const result = applyCharacterRest(makeCharacter(), "short", NOW);

    expect(result.character.capabilities[0].usage.used).toEqual([false]);
    expect(result.character.capabilities[1].usage.used).toEqual([true]);
    expect(result.character.combatStats.spellSlots[1][0].active).toBe(false);
  });
});

describe("applyCharacterRest long rest", () => {
  it("fully restores HP and Hit Dice and clears temporary HP, death saves, and short-rest count", () => {
    const result = applyCharacterRest(
      makeCharacter({
        currentHitPoints: 0,
        hitDiceRemaining: 1,
        shortRestsUsedSinceLongRest: 2,
        lastLongRestAt: "2026-08-12T13:00:00.000Z",
        deathSaves: { successes: 2, failures: 2 },
      }),
      "long",
      NOW,
    );

    expect(result.summary).toMatchObject({
      applied: true,
      currentHitPointsAfter: 20,
      temporaryHitPointsAfter: 0,
      hitDiceRecovered: 4,
      hitDiceRemainingAfter: 5,
      shortRestsUsedSinceLongRestAfter: 0,
    });
    expect(result.character.combatStats.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(result.character.combatStats.restState.lastLongRestAt).toBe(NOW.toISOString());
  });

  it("has no 24-hour or positive-starting-HP restriction", () => {
    const result = applyCharacterRest(
      makeCharacter({ currentHitPoints: 0, lastLongRestAt: NOW.toISOString() }),
      "long",
      NOW,
    );

    expect(result.summary.applied).toBe(true);
    expect(result.character.combatStats.currentHitPoints).toBe(20);
  });

  it("resets short- and long-rest capabilities and all existing slots", () => {
    const result = applyCharacterRest(makeCharacter(), "long", NOW);

    expect(result.character.capabilities.map((capability) => capability.usage.used)).toEqual([[false], [false]]);
    expect(result.character.combatStats.spellSlots[1][0].active).toBe(false);
  });
});

describe("rest request validation", () => {
  it("accepts requests without options and ignores the known fields sent by legacy clients", () => {
    expect(() => validateRestClientOptions({}, ["mira"])).not.toThrow();
    expect(() => validateRestClientOptions({ optionsBySlug: { mira: {} } }, ["mira"])).not.toThrow();
    expect(() => validateRestClientOptions({
      optionsBySlug: { mira: { hitDiceSpent: 5, hitDiceRollTotal: 40 } },
    }, ["mira"])).not.toThrow();
  });

  it("still rejects malformed and unselected legacy option maps", () => {
    expect(() => validateRestClientOptions({ optionsBySlug: [] }, ["mira"])).toThrow("deve essere un oggetto");
    expect(() => validateRestClientOptions({ optionsBySlug: { altra: {} } }, ["mira"])).toThrow("non selezionato");
    expect(() => validateRestClientOptions({ optionsBySlug: { mira: { unexpected: true } } }, ["mira"])).toThrow("non supportati");
  });
});

describe("applyCharacterRest state safety", () => {
  it("does not clamp legacy current HP above maximum when a short rest applies no healing", () => {
    const result = applyCharacterRest(
      makeCharacter({ currentHitPoints: 25, hitPointMaximum: 20, hitDiceRemaining: 5 }),
      "short",
      NOW,
    );

    expect(result.summary).toMatchObject({ healingApplied: 0, currentHitPointsBefore: 25, currentHitPointsAfter: 25 });
    expect(result.character.combatStats.currentHitPoints).toBe(25);
  });

  it("resets death saves after automatic healing but preserves them if a short rest cannot heal", () => {
    const wounded = makeCharacter({ currentHitPoints: 0, deathSaves: { successes: 2, failures: 2 } });
    const healed = applyCharacterRest(wounded, "short", NOW);
    expect(healed.character.combatStats.currentHitPoints).toBeGreaterThan(0);
    expect(healed.character.combatStats.deathSaves).toEqual({ successes: 0, failures: 0 });

    const withoutDice = makeCharacter({
      currentHitPoints: 0,
      hitDiceRemaining: 0,
      deathSaves: { successes: 2, failures: 2 },
    });
    const notHealed = applyCharacterRest(withoutDice, "short", NOW);
    expect(notHealed.character.combatStats.currentHitPoints).toBe(0);
    expect(notHealed.character.combatStats.deathSaves).toEqual({ successes: 2, failures: 2 });
  });

  it.each(["short", "long"])("does not mutate its input during a %s rest", (restType) => {
    const character = makeCharacter({ hitDiceRemaining: 2 });
    const before = structuredClone(character);

    const result = applyCharacterRest(character, restType, NOW);

    expect(character).toEqual(before);
    expect(result.character).not.toBe(character);
    expect(result.character.untouched).toEqual(before.untouched);
  });
});
