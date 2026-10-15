import { describe, expect, it } from "vitest";
import { getPassiveEffectClassOptions, getPassiveEffectTotalLevel, resolvePassiveEffectClassLevel } from "../../src/lib/passive-effect-levels";
import { calculateSkillValues, isPassiveTriggerActive, resolveCharacterAbilityScores, resolvePassiveEffectScalarValue } from "../../src/utils";
import { getDerivedArmorClass, getDerivedInitiativeBonus } from "../../src/lib/character-derived-stats";

function character() {
  return {
    basicInfo: { class: "Warlock", level: 7 }, totalLevel: 7,
    classes: [
      { classKey: "warlock", label: "Warlock", level: 5, sortOrder: 0 },
      { classKey: "sorcerer", label: "Stregone", level: 2, sortOrder: 1 },
    ],
    abilityScores: { DEXTERITY: 10, WISDOM: 10, CHARISMA: 10 },
  };
}
const effect = { valueMode: "CLASS_LEVEL", sourceClassKey: "sorcerer", value: 0, trigger: "ALWAYS" };

describe("passive effect level sources", () => {
  it("numbers owned classes in sheet order and keeps stable keys", () => {
    const state = character();
    state.classes.reverse();
    expect(getPassiveEffectClassOptions(state)).toEqual([
      { classKey: "warlock", label: "Livello classe 1 — Warlock", level: 5, index: 1 },
      { classKey: "sorcerer", label: "Livello classe 2 — Stregone", level: 2, index: 2 },
    ]);
    expect(resolvePassiveEffectClassLevel(state, "sorcerer")).toBe(2);
    state.classes[0].sortOrder = 0;
    state.classes[1].sortOrder = 1;
    expect(resolvePassiveEffectClassLevel(state, "sorcerer")).toBe(2);
  });

  it("keeps old CHARACTER_LEVEL effects on total level and class effects on their selected class", () => {
    const state = character();
    expect(resolvePassiveEffectScalarValue({ ...effect, valueMode: "CHARACTER_LEVEL" }, state, {})).toBe(7);
    expect(resolvePassiveEffectScalarValue(effect, state, {})).toBe(2);
    expect(resolvePassiveEffectScalarValue({ ...effect, sourceClassKey: "warlock" }, state, {})).toBe(5);
    state.classes[0].level = 6; state.totalLevel = 8;
    expect(resolvePassiveEffectScalarValue(effect, state, {})).toBe(2);
    state.classes[1].level = 3; state.totalLevel = 9;
    expect(resolvePassiveEffectScalarValue(effect, state, {})).toBe(3);
  });

  it("preserves scaling, rounding and offsets for the selected class", () => {
    const state = character();
    const half = { ...effect, sourceClassKey: "warlock", multiplierNumerator: 1, multiplierDenominator: 2, value: 1 };
    expect(resolvePassiveEffectScalarValue({ ...half, rounding: "FLOOR" }, state, {})).toBe(3);
    expect(resolvePassiveEffectScalarValue({ ...half, rounding: "CEIL" }, state, {})).toBe(4);
  });

  it("does not substitute total or the first class for a missing class", () => {
    const state = character();
    expect(resolvePassiveEffectClassLevel(state, "fighter")).toBe(0);
    expect(resolvePassiveEffectScalarValue({ ...effect, sourceClassKey: "fighter" }, state, {})).toBe(0);
    expect(resolvePassiveEffectScalarValue({ ...effect, sourceClassKey: undefined }, state, {})).toBe(0);
  });

  it("supports legacy monoclasse and derives totals when the explicit total is absent", () => {
    expect(getPassiveEffectClassOptions({ basicInfo: { class: "Ladro", level: 4 } })).toEqual([
      { classKey: "rogue", label: "Livello classe 1 — Ladro", level: 4, index: 1 },
    ]);
    expect(resolvePassiveEffectClassLevel({ basicInfo: { class: "Ladro", level: 4 } }, "rogue")).toBe(4);
    expect(getPassiveEffectTotalLevel({ ...character(), totalLevel: undefined })).toBe(7);
    expect(getPassiveEffectTotalLevel({ basicInfo: { level: "4" } })).toBe(4);
    expect(getPassiveEffectClassOptions({ classes: [{ classKey: "rogue", level: -1 }], basicInfo: { class: "Ladro", level: 7 } })).toEqual([]);
  });

  it("applies the selected class consistently to skills, ability scores and derived combat stats", () => {
    const state = { ...character(), capabilities: [{ kind: "passive", name: "Bonus di classe", passiveEffects: [
      { ...effect, target: "SKILL_PERCEZIONE" }, { ...effect, target: "ARMOR_CLASS" }, { ...effect, target: "INITIATIVE" },
      { ...effect, target: "CHARISMA_SCORE" },
    ] }] };
    expect(calculateSkillValues(state, [{ name: "Percezione", ability: "SAG" }], { passiveCapabilities: state.capabilities })[0].value).toBe(2);
    expect(resolveCharacterAbilityScores(state, state.capabilities).scores.charisma).toBe(12);
    expect(getDerivedArmorClass(state)).toBe(12);
    expect(getDerivedInitiativeBonus(state)).toBe(2);
  });
});

describe("unarmored passive trigger", () => {
  it("is the inverse of wearing armor, including when only a shield is equipped", () => {
    for (const context of [{ hasArmorEquipped: false }, { hasArmorEquipped: true }, { hasArmorEquipped: false, hasShieldEquipped: true }]) {
      expect(isPassiveTriggerActive("WHILE_UNARMORED", context)).toBe(!isPassiveTriggerActive("WHILE_ARMORED", context));
    }
  });

  it("updates derived combat and skill bonuses when armor is equipped or removed", () => {
    const capabilities = [{ name: "Bonus senza armatura", kind: "passive", passiveEffects: [
      { ...effect, target: "ARMOR_CLASS", trigger: "WHILE_UNARMORED" },
      { ...effect, target: "SKILL_PERCEZIONE", trigger: "WHILE_UNARMORED" },
    ] }];
    const state = { ...character(), capabilities };
    const armor = { id: "armor", itemDefinitionId: "armor-def", isEquipped: false } as any;
    const shield = { id: "shield", itemDefinitionId: "shield-def", isEquipped: true } as any;
    const definitions = {
      "armor-def": { category: "ARMOR", armorClassBase: 13, armorClassCalculation: "BASE_ONLY" },
      "shield-def": { category: "SHIELD", armorClassBonus: 2 },
    } as any;
    expect(getDerivedArmorClass(state, [armor], definitions)).toBe(12);
    expect(getDerivedArmorClass(state, [armor, shield], definitions)).toBe(14);
    expect(getDerivedArmorClass(state, [{ ...armor, isEquipped: true }, shield], definitions)).toBe(15);
    expect(calculateSkillValues(state, [{ name: "Percezione", ability: "SAG" }], { passiveCapabilities: capabilities, passiveEffectContext: { hasArmorEquipped: false } })[0].value).toBe(2);
    expect(calculateSkillValues(state, [{ name: "Percezione", ability: "SAG" }], { passiveCapabilities: capabilities, passiveEffectContext: { hasArmorEquipped: true } })[0].value).toBe(0);
  });
});
