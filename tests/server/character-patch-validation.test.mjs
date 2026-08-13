import { describe, expect, it } from "vitest";

import { validateCharacterPatch, validatePactBladeState } from "../../server.js";

function expectInvalid(patch, expectedIssue) {
  const issues = validateCharacterPatch(patch);
  expect(issues).not.toEqual([]);
  expect(issues.join("\n")).toContain(expectedIssue);
}

describe("validateCharacterPatch", () => {
  it("accepts a representative persisted character patch, including ability score 0", () => {
    const patch = {
      basicInfo: {
        characterName: "Mira",
        class: "Guerriero",
        level: 5,
        background: "Soldato",
        playerName: "Giocatrice",
        race: "Umana",
        alignment: "Neutrale Buono",
        experiencePoints: 6_500,
        portraitUrl: "/portraits/mira.png",
      },
      abilityScores: {
        strength: 16,
        dexterity: 12,
        constitution: 14,
        intelligence: 0,
        wisdom: 10,
        charisma: 8,
      },
      combatStats: {
        armorClass: 18,
        initiative: 1,
        speed: 9,
        hitPointMaximum: 44,
        currentHitPoints: 31,
        temporaryHitPoints: 4,
        hitDice: "5d10",
        deathSaves: { successes: 2, failures: 1 },
        spellSlots: { 1: [{ id: "slot-1", active: false }] },
        restState: {
          maxHitDice: 5,
          hitDiceRemaining: 3,
          shortRestsUsedSinceLongRest: 1,
          lastShortRestAt: "2026-08-13T08:00:00.000Z",
          lastLongRestAt: null,
        },
      },
      proficiencies: {
        proficiencyBonus: 3,
        savingThrows: ["strength", "constitution"],
        languages: ["Comune"],
        weapons: { simple: true, martial: true },
        skills: [{ name: "Atletica", ability: "strength", value: 6, proficient: true, rank: "expertise" }],
      },
      equipment: {
        coins: { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 },
        equipment: ["Corda"],
        attacks: [{ name: "Spada lunga", attackBonus: 6, damageDice: "1d8", equipped: true }],
        items: [{ type: "gear", name: "Torcia", description: "Una torcia", quantity: 2 }],
      },
      features: [{ name: "Second Wind", description: "Recupera PF", uses: "1/riposo breve" }],
      capabilities: [{
        name: "Second Wind",
        category: "class",
        usage: { resetOn: "shortRest", used: [true] },
        passiveEffects: [{ target: "armorClass", operationType: "add", value: 1 }],
      }],
      pactBlade: { bondedCharacterItemId: null, activeSummon: { mode: null, templateId: null } },
    };

    expect(validateCharacterPatch(patch)).toEqual([]);
  });

  it.each(["slug", "ownerUserId", "characterType"])("rejects server-owned root key %s", (key) => {
    expectInvalid({ [key]: "client-value" }, `patch.${key}: campo sconosciuto`);
  });

  it("rejects unknown nested keys", () => {
    expectInvalid({ combatStats: { currentHitPoints: 10, internalRevision: 7 } }, "patch.combatStats.internalRevision: campo sconosciuto");
  });

  it.each([
    [[], "patch: deve essere un oggetto"],
    [{ abilityScores: [] }, "patch.abilityScores: deve essere un oggetto"],
    [{ combatStats: [] }, "patch.combatStats: deve essere un oggetto"],
    [{ features: {} }, "patch.features: deve essere un array"],
    [{ proficiencies: { skills: {} } }, "patch.proficiencies.skills: deve essere un array"],
    [{ equipment: { attacks: {} } }, "patch.equipment.attacks: deve essere un array"],
  ])("rejects object/array shape mismatches", (patch, issue) => {
    expectInvalid(patch, issue);
  });

  it.each([
    [{ abilityScores: { strength: 31 } }, "patch.abilityScores.strength"],
    [{ abilityScores: { strength: "18" } }, "patch.abilityScores.strength"],
    [{ combatStats: { currentHitPoints: -1 } }, "patch.combatStats.currentHitPoints"],
    [{ combatStats: { deathSaves: { successes: 4 } } }, "patch.combatStats.deathSaves.successes"],
    [{ proficiencies: { skills: [{ rank: "master" }] } }, "patch.proficiencies.skills[0].rank: valore non supportato"],
  ])("rejects out-of-contract values", (patch, issue) => {
    expectInvalid(patch, issue);
  });

  it.each([
    ['{"__proto__":{"polluted":true}}', "patch.__proto__: campo non consentito"],
    ['{"basicInfo":{"constructor":{"prototype":{"polluted":true}}}}', "patch.basicInfo.constructor: campo non consentito"],
    ['{"capabilities":[{"name":"x","prototype":{"polluted":true}}]}', "patch.capabilities[0].prototype: campo non consentito"],
  ])("rejects prototype-related JSON keys", (json, issue) => {
    expectInvalid(JSON.parse(json), issue);
    expect({}.polluted).toBeUndefined();
  });

  it("rejects oversized patches", () => {
    expectInvalid(
      { features: [{ name: "Oversized", description: "x".repeat(513 * 1_024) }] },
      "dimensione massima 524288 byte superata",
    );
  });

  it("rejects structures deeper than the configured limit", () => {
    const characterName = {};
    let cursor = characterName;
    for (let depth = 0; depth < 14; depth += 1) {
      cursor.nested = {};
      cursor = cursor.nested;
    }

    expectInvalid({ basicInfo: { characterName } }, "profondita massima 12 superata");
  });

  it("accepts proficiency passive effects containing only category and target", () => {
    expect(validateCharacterPatch({
      capabilities: [{
        name: "Collegio Bardico del Valore",
        kind: "passive",
        passiveEffects: [
          { category: "PROFICIENCY", target: "WEAPON_MARTIAL" },
          { category: "PROFICIENCY", target: "ARMOR_MEDIUM" },
          { category: "PROFICIENCY", target: "SHIELD" },
        ],
      }],
    })).toEqual([]);
  });

  it.each([
    [
      { category: "PROFICIENCY", target: "WEAPON_MARTIAL", value: 1 },
      "campo non consentito per una competenza",
    ],
    [
      { category: "PROFICIENCY", target: "WEAPON_EXOTIC" },
      "categoria di competenza non supportata",
    ],
    [
      { category: "UNKNOWN", target: "WEAPON_MARTIAL" },
      "deve essere MODIFIER o PROFICIENCY",
    ],
  ])("rejects malformed proficiency passive effects", (effect, issue) => {
    expectInvalid({
      capabilities: [{ name: "Competenza non valida", kind: "passive", passiveEffects: [effect] }],
    }, issue);
  });
});

describe("validatePactBladeState", () => {
  const bondedMeleeWeapon = { id: "weapon-1", itemCategory: "WEAPON", hasMeleeAttack: true };

  it("accepts a Warlock bound melee weapon and whitelisted virtual template", () => {
    expect(validatePactBladeState({
      basicInfo: { class: "Warlock" },
      pactBlade: {
        bondedCharacterItemId: "weapon-1",
        activeSummon: { mode: "template", templateId: "longsword" },
      },
    }, bondedMeleeWeapon)).toEqual([]);
  });

  it("rejects Pact Blade state on a non-Warlock", () => {
    expect(validatePactBladeState({
      basicInfo: { class: "Bardo" },
      pactBlade: { bondedCharacterItemId: "weapon-1", activeSummon: { mode: null, templateId: null } },
    }, bondedMeleeWeapon).join("\n")).toContain("soltanto per un Warlock");
  });

  it.each([
    [null, "arma da mischia posseduta"],
    [{ id: "weapon-1", itemCategory: "ARMOR", hasMeleeAttack: false }, "arma da mischia posseduta"],
    [{ id: "different-instance", itemCategory: "WEAPON", hasMeleeAttack: true }, "arma da mischia posseduta"],
  ])("rejects an invalid or foreign bonded item", (bondedItem, issue) => {
    expect(validatePactBladeState({
      basicInfo: { class: "Warlock" },
      pactBlade: { bondedCharacterItemId: "weapon-1", activeSummon: { mode: "bonded", templateId: null } },
    }, bondedItem).join("\n")).toContain(issue);
  });

  it("rejects unknown templates and inconsistent summon state", () => {
    expect(validatePactBladeState({
      basicInfo: { class: "Warlock" },
      pactBlade: { bondedCharacterItemId: null, activeSummon: { mode: "template", templateId: "forged-template" } },
    }).join("\n")).toContain("modello non supportato");
    expect(validatePactBladeState({
      basicInfo: { class: "Warlock" },
      pactBlade: { bondedCharacterItemId: null, activeSummon: { mode: "bonded", templateId: null } },
    }).join("\n")).toContain("richiede un'arma legata");
  });
});
