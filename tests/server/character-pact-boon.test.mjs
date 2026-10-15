import { describe, expect, it } from "vitest";
import {
  prepareCharacterSubclassCorrectionPreview, prepareCharacterProgressionPreview,
  subclassCorrectionRequestSignature, progressionRequestSignature, validatePactBladeState,
} from "../../server.js";
import { PACT_BOON_OPTIONS, canUsePactBlade } from "../../shared/warlock-pact-rules.mjs";

function snapshot(level = 3, pactBoonKey = null) {
  return {
    revision: "rev-1", schema: { m5Ready: true, m6Ready: true },
    state: { characterType: "pg", basicInfo: { class: "Warlock", level },
      abilityScores: { charisma: 16, constitution: 14 }, combatStats: { spellSlots: {} },
      features: [{ name: "Contenuto manuale" }] },
    progression: { source: "STRUCTURED", progressionRevision: 1, totalLevel: level,
      classes: [{ classKey: "warlock", classRuleId: "warlock", level, isPrimary: true,
        sortOrder: 0, subclassKey: "the-fiend", subclassStatus: "SELECTED", pactBoonKey }] },
    hitPointState: { maximumHitPoints: 24, currentHitPoints: 17, temporaryHitPoints: 4, revision: 1, backfillStatus: "BACKFILLED" },
    hitDicePools: [{ dieSize: 8, maximum: level, remaining: 1, source: "DERIVED" }],
    resourcePools: [],
  };
}
const patron = { targetClassKey: "warlock", targetSubclassKey: "the-fiend" };

describe("independent Warlock pact boon", () => {
  it("offers exactly the three supplied boons only from Warlock level 3", () => {
    expect(PACT_BOON_OPTIONS.map((entry) => entry.key)).toEqual(["chain", "blade", "tome"]);
    expect(prepareCharacterSubclassCorrectionPreview(snapshot(2), patron)).toMatchObject({ pactBoonOptions: [], pactBoonRequired: false });
    expect(prepareCharacterSubclassCorrectionPreview(snapshot(3), patron)).toMatchObject({ status: "PACT_BOON_REQUIRED", canApply: false, pactBoonRequired: true });
    expect(() => prepareCharacterSubclassCorrectionPreview(snapshot(2), { ...patron, pactBoonKey: "blade" })).toThrow(/3 livelli/);
  });

  it("fills a missing boon without changing patron or manual resources", () => {
    const before = snapshot();
    const copy = structuredClone(before);
    const preview = prepareCharacterSubclassCorrectionPreview(before, { ...patron, pactBoonKey: "chain" });
    expect(preview).toMatchObject({ status: "READY", canApply: true, reasonRequired: false,
      subclassChanged: false, pactBoonChanged: true, after: { subclassKey: "the-fiend", pactBoonKey: "chain" } });
    expect(preview.effects.spellSlots.changed).toBe(false);
    expect(preview.effects.hitPoints.before).toEqual(preview.effects.hitPoints.after);
    expect(before).toEqual(copy);
  });

  it("requires a reason to change an existing boon and preserves it on patron correction", () => {
    const before = snapshot(5, "blade");
    expect(prepareCharacterSubclassCorrectionPreview(before, { ...patron, pactBoonKey: "tome" })).toMatchObject({ status: "REASON_REQUIRED", canApply: false });
    expect(prepareCharacterSubclassCorrectionPreview(before, { ...patron, pactBoonKey: "tome", reason: "Correzione scelta" })).toMatchObject({ canApply: true, subclassChanged: false });
    expect(prepareCharacterSubclassCorrectionPreview(before, { ...patron, targetSubclassKey: "the-archfey", reason: "Correzione patrono" })).toMatchObject({ canApply: true, pactBoonChanged: false, after: { pactBoonKey: "blade" } });
    expect(prepareCharacterSubclassCorrectionPreview(before, patron)).toMatchObject({ status: "ALREADY_SELECTED" });
  });

  it("checks Warlock class level instead of total level and rejects another class", () => {
    const before = snapshot(2);
    before.progression.classes.push({ classKey: "fighter", level: 5, sortOrder: 1, isPrimary: false, subclassKey: "champion" });
    before.progression.totalLevel = 7;
    expect(prepareCharacterSubclassCorrectionPreview(before, patron).pactBoonOptions).toEqual([]);
    expect(() => prepareCharacterSubclassCorrectionPreview(before, { targetClassKey: "fighter", targetSubclassKey: "champion", pactBoonKey: "chain" })).toThrow(/Warlock/);
  });

  it("requires the boon at level 2 to 3 and preserves it in subsequent level-ups", () => {
    expect(prepareCharacterProgressionPreview(snapshot(2), { targetClassKey: "warlock" })).toMatchObject({ status: "PACT_BOON_REQUIRED", canApply: false });
    const preview = prepareCharacterProgressionPreview(snapshot(2), { targetClassKey: "warlock", pactBoonKey: "tome" });
    expect(preview).toMatchObject({ canApply: true, pactBoonKey: "tome", classesAfter: [{ level: 3, pactBoonKey: "tome", subclassKey: "the-fiend" }] });
    expect(prepareCharacterProgressionPreview(snapshot(3, "blade"), { targetClassKey: "warlock" })).toMatchObject({ pactBoonKey: "blade", pactBoonOptions: [] });
    expect(() => prepareCharacterProgressionPreview(snapshot(3, "blade"), { targetClassKey: "warlock", pactBoonKey: "tome" })).toThrow(/azione sottoclasse/);
  });

  it("validates keys and binds retry signatures to the independent choice", () => {
    expect(() => prepareCharacterSubclassCorrectionPreview(snapshot(), { ...patron, pactBoonKey: "invalid" })).toThrow();
    for (const signature of [subclassCorrectionRequestSignature, progressionRequestSignature]) {
      expect(signature("hero", patron)).not.toBe(signature("hero", { ...patron, pactBoonKey: "tome" }));
    }
  });

  it("enables Blade for multiclass Warlocks with the recorded boon and blocks other boons", () => {
    const hero = { basicInfo: { class: "Guerriero" }, classes: [{ classKey: "warlock", level: 3, pactBoonKey: "blade" }], pactBlade: { activeSummon: { mode: "template", templateId: "longsword" } } };
    expect(canUsePactBlade(hero)).toBe(true);
    expect(validatePactBladeState({ ...hero, classes: [{ classKey: "warlock", level: 3, pactBoonKey: "tome" }] })[0]).toMatch(/Patto della Lama/);
    expect(canUsePactBlade({ classes: [{ classKey: "warlock", level: 2, pactBoonKey: "blade" }] })).toBe(false);
  });
});
