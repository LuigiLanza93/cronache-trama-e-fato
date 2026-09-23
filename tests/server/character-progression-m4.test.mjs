import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertProgressionEffectsReady,
  inspectCharacterProgressionM4Database,
  prepareCharacterProgressionPreview,
  progressionRequestSignature,
  readActiveCharacterClassRule,
} from "../../server.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const databases = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function snapshot({
  characterType = "pg",
  classKey = "fighter",
  level = 1,
  subclassKey = null,
  subclassStatus = "NOT_YET_ELIGIBLE",
  revision = "revision-1",
  progressionRevision = 0,
} = {}) {
  return {
    revision,
    state: {
      slug: "mira",
      characterType,
      basicInfo: { characterName: "Mira", class: "Guerriero", level },
      abilityScores: { strength: 14, dexterity: 12, constitution: 14, intelligence: 14, wisdom: 12, charisma: 10 },
    },
    progression: {
      source: "STRUCTURED",
      classes: [{
        classKey,
        classRuleId: `rule:${classKey}`,
        level,
        sortOrder: 0,
        isPrimary: true,
        subclassKey,
        subclassRuleId: subclassKey ? `rule:${subclassKey}` : null,
        subclassStatus,
      }],
      totalLevel: level,
      progressionRevision,
      diagnostics: [],
    },
  };
}

describe("M4 progression preview contract", () => {
  it("blocks apply when any M5/M6 derived effect is deferred", () => {
    expect(() => assertProgressionEffectsReady({ effects: null })).toThrowError(
      expect.objectContaining({
        code: "PROGRESSION_EFFECTS_NOT_READY",
        statusCode: 503,
      }),
    );
    expect(() => assertProgressionEffectsReady({
      effects: { hitPoints: {}, hitDicePools: {}, resourcePools: {} },
    })).not.toThrow();
  });

  it("uses the lowercase SHA-256 signature required by the durable history schema", () => {
    const signature = progressionRequestSignature("mira", {
      targetClassKey: "fighter",
      targetSubclassKey: undefined,
      expectedRevision: "revision-1",
      expectedProgressionRevision: 0,
    });
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(signature).toBe(progressionRequestSignature("mira", {
      targetClassKey: "fighter",
      targetSubclassKey: undefined,
      expectedRevision: "revision-1",
      expectedProgressionRevision: 0,
    }));
    expect(signature).not.toBe(progressionRequestSignature("mira", {
      targetClassKey: "fighter",
      targetSubclassKey: undefined,
      expectedRevision: "revision-1",
      expectedProgressionRevision: 0,
    }, "another-dm"));
  });

  it("increments the only owned class and exposes the shared resolver result", () => {
    const result = prepareCharacterProgressionPreview(snapshot(), {
      targetClassKey: "fighter",
      expectedRevision: "revision-1",
      expectedProgressionRevision: 0,
    });

    expect(result).toMatchObject({
      status: "READY",
      canApply: true,
      mode: "INCREMENT_EXISTING",
      targetClassKey: "fighter",
      subclassOptions: [],
      before: { characterLevel: 1 },
      after: { characterLevel: 2 },
      prerequisites: { status: "NOT_APPLICABLE", eligible: true },
    });
  });

  it("requires a valid subclass at the class threshold", () => {
    const wizard = snapshot({ classKey: "wizard", level: 1 });
    expect(prepareCharacterProgressionPreview(wizard, { targetClassKey: "wizard" }))
      .toMatchObject({
        status: "SUBCLASS_REQUIRED",
        canApply: false,
        subclassOptions: [{
          key: "school-of-evocation",
          label: "Scuola di Invocazione",
          classKey: "wizard",
        }],
      });
    expect(prepareCharacterProgressionPreview(wizard, {
      targetClassKey: "wizard",
      targetSubclassKey: "school-of-evocation",
    })).toMatchObject({
      status: "READY",
      canApply: true,
      classesAfter: [{ classKey: "wizard", level: 2, subclassKey: "school-of-evocation" }],
      subclassOptions: [{
        key: "school-of-evocation",
        label: "Scuola di Invocazione",
        classKey: "wizard",
      }],
    });
  });

  it("offers only authoritative subclasses belonging to the target class", () => {
    const result = prepareCharacterProgressionPreview(snapshot({ classKey: "fighter", level: 2 }), {
      targetClassKey: "fighter",
    });

    expect(result).toMatchObject({ status: "SUBCLASS_REQUIRED", canApply: false });
    expect(result.subclassOptions).toEqual([
      { key: "champion", label: "Campione", classKey: "fighter" },
      { key: "eldritch-knight", label: "Cavaliere Mistico", classKey: "fighter" },
    ]);
    expect(result.subclassOptions).not.toContainEqual(expect.objectContaining({ classKey: "wizard" }));
    expect(result.subclassOptions).not.toContainEqual(expect.objectContaining({ key: "school-of-evocation" }));
  });

  it("enables multiclass while still blocking PNG, stale revisions, and subclass replacement", () => {
    expect(prepareCharacterProgressionPreview(snapshot(), { targetClassKey: "wizard" })).toMatchObject({
      mode: "ADD_NEW_CLASS",
      status: "READY",
      canApply: true,
      prerequisites: { status: "ELIGIBLE", eligible: true },
      classesAfter: [{ classKey: "fighter", level: 1 }, { classKey: "wizard", level: 1 }],
    });
    const ineligible = snapshot();
    ineligible.state.abilityScores.intelligence = 8;
    expect(prepareCharacterProgressionPreview(ineligible, { targetClassKey: "wizard" })).toMatchObject({
      status: "MULTICLASS_PREREQUISITES_FAILED",
      canApply: false,
      prerequisites: { status: "INELIGIBLE", failedClassKeys: ["wizard"] },
    });
    expect(prepareCharacterProgressionPreview(ineligible, {
      targetClassKey: "wizard",
      overrideReason: "Eccezione narrativa concordata con il tavolo",
    })).toMatchObject({
      status: "READY",
      canApply: true,
      prerequisites: { status: "INELIGIBLE", overridden: true },
    });
    expect(() => prepareCharacterProgressionPreview(snapshot({ characterType: "png" }), { targetClassKey: "fighter" }))
      .toThrow(expect.objectContaining({ code: "CHARACTER_TYPE_UNSUPPORTED", statusCode: 422 }));
    expect(() => prepareCharacterProgressionPreview(snapshot(), {
      targetClassKey: "fighter",
      expectedRevision: "stale",
    })).toThrow(expect.objectContaining({ code: "REVISION_CONFLICT", statusCode: 409 }));
    expect(() => prepareCharacterProgressionPreview(snapshot(), {
      targetClassKey: "fighter",
      expectedProgressionRevision: 5,
    })).toThrow(expect.objectContaining({ code: "PROGRESSION_REVISION_CONFLICT", statusCode: 409 }));
    expect(() => prepareCharacterProgressionPreview(snapshot({
      classKey: "wizard",
      level: 4,
      subclassKey: "school-of-evocation",
      subclassStatus: "SELECTED",
    }), {
      targetClassKey: "wizard",
      targetSubclassKey: "tradizione-custom",
    })).toThrow(expect.objectContaining({ code: "SUBCLASS_CHANGE_NOT_ALLOWED", statusCode: 422 }));
  });

  it("binds the motivated override to the durable idempotency signature", () => {
    const request = {
      targetClassKey: "wizard",
      expectedRevision: "revision-1",
      expectedProgressionRevision: 0,
    };
    expect(progressionRequestSignature("mira", request, "dm")).not.toBe(
      progressionRequestSignature("mira", { ...request, overrideReason: "Eccezione" }, "dm"),
    );
  });

  it("rejects legacy or unresolved progression state", () => {
    const legacy = snapshot();
    legacy.progression = {
      source: "LEGACY",
      classes: [],
      totalLevel: 1,
      progressionRevision: 0,
      diagnostics: [{ code: "CHARACTER_PROGRESSION_NOT_BACKFILLED" }],
    };
    expect(() => prepareCharacterProgressionPreview(legacy, { targetClassKey: "fighter" }))
      .toThrow(expect.objectContaining({ code: "PROGRESSION_UNAVAILABLE", statusCode: 409 }));
  });
});

describe("M4 progression schema capability", () => {
  it("selects a new class only from the active ruleset version", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    database.exec(`
      CREATE TABLE "ClassRule" (
        id TEXT PRIMARY KEY, classKey TEXT, rulesetId TEXT, rulesetVersion TEXT,
        isManual INTEGER, updatedAt TEXT
      );
      INSERT INTO "ClassRule" VALUES
        ('active', 'wizard', 'srd-5.1-2014', '5.1', 0, '2026-01-01'),
        ('other-version', 'wizard', 'srd-5.1-2014', '2024', 0, '2027-01-01'),
        ('manual', 'wizard', 'srd-5.1-2014', '5.1', 1, '2028-01-01');
    `);
    expect(readActiveCharacterClassRule(database, "wizard")?.id).toBe("active");
    expect(readActiveCharacterClassRule(database, "custom")).toBeNull();
  });

  it("keeps the M4 writer disabled until the complete history table is present", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    expect(inspectCharacterProgressionM4Database(database)).toMatchObject({
      ready: false,
      missingTable: true,
    });

    database.exec(`
      CREATE TABLE "CharacterLevelHistory" (
        "id" TEXT, "characterId" TEXT, "requestId" TEXT, "requestSignature" TEXT,
        "operationType" TEXT, "mode" TEXT, "targetClassKey" TEXT, "targetClassRuleId" TEXT,
        "targetSubclassKey" TEXT, "targetSubclassRuleId" TEXT, "classLevelBefore" INTEGER,
        "classLevelAfter" INTEGER, "totalLevelBefore" INTEGER, "totalLevelAfter" INTEGER,
        "progressionRevisionBefore" INTEGER, "progressionRevisionAfter" INTEGER,
        "characterRevisionBefore" TEXT, "characterRevisionAfter" TEXT, "rulesetId" TEXT,
        "rulesetVersion" TEXT, "policyVersion" TEXT, "requestSnapshot" TEXT,
        "beforeSnapshot" TEXT, "afterSnapshot" TEXT, "ruleSnapshot" TEXT,
        "resultSnapshot" TEXT, "overrideReason" TEXT, "appliedByUserId" TEXT,
        "appliedBySnapshot" TEXT, "hitDieSize" INTEGER, "hitPointMethod" TEXT,
        "hitPointsGained" INTEGER, "constitutionModifier" INTEGER, "appliedAt" TEXT
      );
    `);
    expect(inspectCharacterProgressionM4Database(database)).toMatchObject({
      ready: false,
      missingTable: false,
      missingColumns: [],
      missingObjects: {
        index: expect.any(Array),
        trigger: expect.any(Array),
      },
    });
    for (const name of [
      "CharacterLevelHistory_characterId_requestId_key",
      "CharacterLevelHistory_characterId_progressionRevisionAfter_key",
      "CharacterLevelHistory_characterId_appliedAt_idx",
      "CharacterLevelHistory_targetClassRuleId_idx",
      "CharacterLevelHistory_targetSubclassRuleId_idx",
      "CharacterLevelHistory_appliedByUserId_idx",
    ]) {
      database.exec(`CREATE INDEX "${name}" ON "CharacterLevelHistory"("id")`);
    }
    for (const name of [
      "CharacterLevelHistory_class_key_matches_rule_insert",
      "CharacterLevelHistory_class_key_matches_rule_update",
      "CharacterLevelHistory_subclass_matches_class_insert",
      "CharacterLevelHistory_subclass_matches_class_update",
      "CharacterClass_total_level_limit_insert",
      "CharacterClass_total_level_limit_update",
    ]) {
      database.exec(`
        CREATE TRIGGER "${name}" AFTER INSERT ON "CharacterLevelHistory"
        BEGIN SELECT 1; END
      `);
    }
    expect(inspectCharacterProgressionM4Database(database)).toEqual({
      ready: true,
      missingTable: false,
      missingColumns: [],
      missingObjects: {},
    });
  });
});
