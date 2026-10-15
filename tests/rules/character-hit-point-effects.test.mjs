import { describe, expect, it } from "vitest";
import { reconcilePassiveHitPoints, resolvePassiveHitPointBonus } from "../../shared/character-hit-point-effects.mjs";

function state() {
  return { totalLevel: 6, basicInfo: { class: "Warlock", level: 6 }, abilityScores: { constitution: 12 },
    classes: [{ classKey: "warlock", level: 5 }, { classKey: "sorcerer", level: 1 }],
    capabilities: [{ name: "Resilienza Draconica", kind: "passive", passiveEffects: [{
      target: "HIT_POINT_MAX", operationType: "BONUS", valueMode: "CLASS_LEVEL", sourceClassKey: "sorcerer", value: 0,
      multiplierNumerator: 1, multiplierDenominator: 1, trigger: "ALWAYS",
    }] }] };
}

describe("authoritative passive maximum HP contribution", () => {
  it("projects Warlock5/Sorcerer1 from52 to53 and never adds the same bonus twice", () => {
    const bonus = resolvePassiveHitPointBonus(state());
    expect(bonus).toEqual({ bonusTotal: 1, breakdown: [{ label: "Resilienza Draconica", value: 1 }] });
    const raw = { maximumHitPoints: 52, currentHitPoints: 52, temporaryHitPoints: 4, revision: 7, passiveBonusApplied: 0 };
    const projected = reconcilePassiveHitPoints(raw, bonus.bonusTotal);
    expect(projected).toEqual({ ...raw, maximumHitPoints: 53, currentHitPoints: 53, passiveBonusApplied: 1 });
    expect(reconcilePassiveHitPoints(projected, 1)).toEqual(projected);
    expect(raw.maximumHitPoints).toBe(52);
  });

  it("preserves damage, temporary HP and death state on bonus changes", () => {
    const raw = { maximumHitPoints: 52, currentHitPoints: 40, temporaryHitPoints: 5, deathSaveFailures: 1 };
    const projected = reconcilePassiveHitPoints(raw, 1);
    expect(projected).toMatchObject({ maximumHitPoints: 53, currentHitPoints: 41, temporaryHitPoints: 5, deathSaveFailures: 1 });
    expect(reconcilePassiveHitPoints(projected, 0)).toMatchObject(raw);
    expect(reconcilePassiveHitPoints({ ...raw, currentHitPoints: 0 }, 1).currentHitPoints).toBe(0);
  });

  it("tracks the class contribution independently during subsequent level-ups", () => {
    const character = state();
    const old = reconcilePassiveHitPoints({ maximumHitPoints: 52, currentHitPoints: 52 }, 1);
    character.classes[1].level = 2; character.totalLevel = 7;
    const next = reconcilePassiveHitPoints({ ...old, maximumHitPoints: old.maximumHitPoints + 7, currentHitPoints: old.currentHitPoints + 7 }, resolvePassiveHitPointBonus(character).bonusTotal);
    expect(next).toMatchObject({ maximumHitPoints: 61, currentHitPoints: 61, passiveBonusApplied: 2 });
  });

  it("evaluates equipment triggers and resolved source ability consistently", () => {
    const character = state();
    const effect = character.capabilities[0].passiveEffects[0];
    effect.trigger = "WHILE_UNARMORED";
    expect(resolvePassiveHitPointBonus(character, { context: { hasArmorEquipped: true } }).bonusTotal).toBe(0);
    expect(resolvePassiveHitPointBonus(character, { context: { hasArmorEquipped: false, hasShieldEquipped: true } }).bonusTotal).toBe(1);
    effect.valueMode = "ABILITY_MODIFIER"; effect.sourceAbility = "CONSTITUTION";
    expect(resolvePassiveHitPointBonus(character).bonusTotal).toBe(1);
    expect(resolvePassiveHitPointBonus(character, { resolvedAbilityScores: { constitution: 16 } }).bonusTotal).toBe(3);
  });

  it("restores the underlying maximum after a negative bonus clamps max tozero", () => {
    const zero = reconcilePassiveHitPoints({ maximumHitPoints: 52, currentHitPoints: 40 }, -100);
    expect(zero).toMatchObject({ maximumHitPoints: 0, currentHitPoints: 0, passiveBonusApplied: -52 });
    expect(reconcilePassiveHitPoints(zero, 0)).toMatchObject({ maximumHitPoints: 52, currentHitPoints: 0, passiveBonusApplied: 0 });
  });
});
