import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  prepareCharacterProgressionPreview,
  prepareCharacterSubclassCorrectionPreview,
  progressionRequestSignature,
  subclassCorrectionRequestSignature,
} from "../../server.js";
import {
  DRACONIC_ANCESTRY_OPTIONS,
  draconicAncestrySummary,
} from "../../shared/draconic-ancestry-rules.mjs";

function baseSnapshot() {
  return {
    revision: "revision-1",
    state: {
      slug: "kael",
      characterType: "pg",
      basicInfo: { characterName: "Kael", class: "Warlock", level: 1 },
      abilityScores: {
        strength: 10, dexterity: 12, constitution: 14,
        intelligence: 10, wisdom: 10, charisma: 16,
      },
      combatStats: { spellSlots: {} },
    },
    progression: {
      source: "STRUCTURED",
      classes: [{
        classKey: "warlock",
        classRuleId: "class:warlock",
        level: 1,
        sortOrder: 0,
        isPrimary: true,
        subclassKey: "the-fiend",
        subclassRuleId: "subclass:the-fiend",
        subclassStatus: "SELECTED",
        draconicAncestryKey: null,
      }],
      totalLevel: 1,
      progressionRevision: 2,
      diagnostics: [],
    },
    schema: { m5Ready: true, m6Ready: true },
    hitPointState: {
      maximumHitPoints: 10,
      currentHitPoints: 8,
      temporaryHitPoints: 2,
      revision: 1,
      backfillStatus: "BACKFILLED",
    },
    hitDicePools: [{ dieSize: 8, maximum: 1, remaining: 1, source: "DERIVED" }],
    resourcePools: [],
  };
}

function draconicSorcererSnapshot(draconicAncestryKey = null) {
  const snapshot = baseSnapshot();
  snapshot.state.basicInfo = { characterName: "Kael", class: "Stregone", level: 1 };
  snapshot.progression.classes = [{
    classKey: "sorcerer",
    classRuleId: "class:sorcerer",
    level: 1,
    sortOrder: 0,
    isPrimary: true,
    subclassKey: "draconic-bloodline",
    subclassRuleId: "subclass:draconic-bloodline",
    subclassStatus: "SELECTED",
    draconicAncestryKey,
  }];
  snapshot.progression.totalLevel = 1;
  snapshot.hitDicePools = [{ dieSize: 6, maximum: 1, remaining: 1, source: "DERIVED" }];
  return snapshot;
}

describe("draconic ancestry rules and previews", () => {
  it("exposes all ten PHB dragons with their damage type", () => {
    expect(DRACONIC_ANCESTRY_OPTIONS).toHaveLength(10);
    expect(draconicAncestrySummary("blue")).toEqual({
      key: "blue", label: "Blu", damageType: "lightning", damageLabel: "Fulmine",
    });
    expect(new Set(DRACONIC_ANCESTRY_OPTIONS.map((entry) => entry.key)).size).toBe(10);
  });

  it("requires an ancestor for a new Draconic Sorcerer and preserves every existing subclass", () => {
    const snapshot = baseSnapshot();
    const missing = prepareCharacterProgressionPreview(snapshot, {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
    });
    expect(missing).toMatchObject({
      status: "DRACONIC_ANCESTRY_REQUIRED",
      canApply: false,
      draconicAncestryRequired: true,
      draconicAncestryKey: null,
      draconicAncestryOptions: expect.arrayContaining([
        { key: "blue", label: "Blu", damageType: "lightning", damageLabel: "Fulmine" },
      ]),
    });
    expect(missing.classesAfter[0]).toMatchObject({
      classKey: "warlock", level: 1, subclassKey: "the-fiend",
    });

    const selected = prepareCharacterProgressionPreview(snapshot, {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
      draconicAncestryKey: "blue",
    });
    expect(selected).toMatchObject({ status: "READY", canApply: true, draconicAncestryKey: "blue" });
    expect(selected.classesAfter).toEqual(expect.arrayContaining([
      expect.objectContaining({ classKey: "warlock", subclassKey: "the-fiend", level: 1 }),
      expect.objectContaining({
        classKey: "sorcerer", subclassKey: "draconic-bloodline",
        draconicAncestryKey: "blue", level: 1,
      }),
    ]));
  });

  it("preserves a saved ancestor during level-up and rejects changing it there", () => {
    const snapshot = draconicSorcererSnapshot("blue");
    const preview = prepareCharacterProgressionPreview(snapshot, { targetClassKey: "sorcerer" });
    expect(preview).toMatchObject({
      status: "READY",
      draconicAncestryKey: "blue",
      classesAfter: [expect.objectContaining({ draconicAncestryKey: "blue", level: 2 })],
    });
    expect(() => prepareCharacterProgressionPreview(snapshot, {
      targetClassKey: "sorcerer",
      draconicAncestryKey: "red",
    })).toThrow(expect.objectContaining({ code: "DRACONIC_ANCESTRY_CHANGE_NOT_ALLOWED" }));
  });

  it("adds a missing ancestor without a reason, but requires one to correct it", () => {
    const missingSnapshot = draconicSorcererSnapshot();
    missingSnapshot.resourcePools = [{
      id: "legacy-mismatched",
      poolKey: "legacy:manual",
      kind: "MANUAL",
      label: "Slot gestiti manualmente",
      resetPolicy: "MANUAL",
      revision: 7,
      maximum: { 1: 1, 4: 2 },
      used: { 1: 1, 4: 1 },
      tiers: [
        { tierKey: "1", derivedMaximum: null, maximumOverride: 1, maximum: 1, used: 1 },
        { tierKey: "4", derivedMaximum: null, maximumOverride: 2, maximum: 2, used: 1 },
      ],
      sources: [{ sourceKey: "legacy", sourceKind: "LEGACY" }],
    }];
    const missing = prepareCharacterSubclassCorrectionPreview(missingSnapshot, {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
      draconicAncestryKey: "gold",
    });
    expect(missing).toMatchObject({
      status: "READY", canApply: true, reasonRequired: false,
      subclassChanged: false, ancestryChanged: true,
      before: { subclassKey: "draconic-bloodline", draconicAncestryKey: null },
      after: { subclassKey: "draconic-bloodline", draconicAncestryKey: "gold" },
      effects: { spellSlots: { changed: false, strategy: "NONE" } },
    });
    expect(missing.effects.spellSlots.before).toEqual(missingSnapshot.resourcePools);
    expect(missing.effects.spellSlots.after).toEqual(missingSnapshot.resourcePools);

    const withoutReason = prepareCharacterSubclassCorrectionPreview(draconicSorcererSnapshot("gold"), {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
      draconicAncestryKey: "red",
    });
    expect(withoutReason).toMatchObject({ status: "REASON_REQUIRED", canApply: false, reasonRequired: true });
    const corrected = prepareCharacterSubclassCorrectionPreview(draconicSorcererSnapshot("gold"), {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
      draconicAncestryKey: "red",
      reason: "Correzione della scheda storica",
    });
    expect(corrected).toMatchObject({ status: "READY", canApply: true, draconicAncestryKey: "red" });
  });

  it("keeps old durable hashes unchanged when the new field is absent", () => {
    const progressionRequest = {
      targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline",
      overrideReason: null,
      expectedRevision: "revision-1",
      expectedProgressionRevision: 2,
    };
    const oldProgressionCanonical = JSON.stringify({
      slug: "kael", actorId: "dm", targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline", overrideReason: null,
      expectedRevision: "revision-1", expectedProgressionRevision: 2,
    });
    expect(progressionRequestSignature("kael", progressionRequest, "dm")).toBe(
      crypto.createHash("sha256").update(oldProgressionCanonical).digest("hex"),
    );

    const subclassRequest = {
      targetClassKey: "sorcerer", targetSubclassKey: "draconic-bloodline",
      reason: null, expectedRevision: "revision-1", expectedProgressionRevision: 2,
    };
    const oldSubclassCanonical = JSON.stringify({
      slug: "kael", actorId: "dm", targetClassKey: "sorcerer",
      targetSubclassKey: "draconic-bloodline", reason: null,
      expectedRevision: "revision-1", expectedProgressionRevision: 2,
    });
    expect(subclassCorrectionRequestSignature("kael", subclassRequest, "dm")).toBe(
      crypto.createHash("sha256").update(oldSubclassCanonical).digest("hex"),
    );
  });
});
