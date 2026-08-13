import { describe, expect, it } from "vitest";

import {
  hasTwoWeaponFightingStyle,
  resolveCharacterProficiencySummary,
  resolveArmorProficiency,
  resolveWeaponProficiency,
} from "../../src/lib/character-combat-rules";

describe("resolveWeaponProficiency", () => {
  it("applies the current single-class group proficiency without granting every weapon", () => {
    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: "Guerriero" } },
        { name: "Spada lunga", weaponProficiencyGroup: "MARTIAL" }
      )
    ).toMatchObject({ known: true, proficient: true, group: "MARTIAL" });

    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: "Bardo" } },
        { name: "Ascia da battaglia", weaponProficiencyGroup: "MARTIAL" }
      )
    ).toMatchObject({ known: true, proficient: false, group: "MARTIAL" });
  });

  it("keeps weapons unknown when either their classification or the class profile is unknown", () => {
    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: "Guerriero" } },
        { name: "Reliquia senza dati" }
      )
    ).toEqual({
      known: false,
      proficient: false,
      group: null,
      breakdown: ["Classificazione competenza arma mancante"],
    });

    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: "Classe homebrew non censita" } },
        { name: "Clava", weaponProficiencyGroup: "SIMPLE" }
      )
    ).toEqual({
      known: false,
      proficient: false,
      group: "SIMPLE",
      breakdown: ["Classe senza profilo di competenze arma"],
    });
  });

  it("honours legacy explicit grants before the class profile, including group grants", () => {
    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: "Mago" }, proficiencies: { weapons: ["Spada cerimoniale"] } },
        { name: "Spada cerimoniale" }
      )
    ).toMatchObject({ known: true, proficient: true, group: null });

    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: "Mago" }, proficiencies: { weapons: { martial: true } } },
        { name: "Spada lunga", weaponProficiencyGroup: "MARTIAL" }
      )
    ).toMatchObject({ known: true, proficient: true, group: "MARTIAL" });
  });

  it("does not promote a structured named legacy weapon to its whole metadata group", () => {
    const characterData = {
      basicInfo: { class: "Mago" },
      proficiencies: { weapons: [{ name: "Spada lunga", weaponProficiencyGroup: "MARTIAL" }] },
    };

    expect(resolveWeaponProficiency(characterData, { name: "Spada lunga", weaponProficiencyGroup: "MARTIAL" }))
      .toMatchObject({ known: true, proficient: true });
    expect(resolveWeaponProficiency(characterData, { name: "Alabarda", weaponProficiencyGroup: "MARTIAL" }))
      .toMatchObject({ known: true, proficient: false });

    const singletonGrant = {
      basicInfo: { class: "Mago" },
      proficiencies: { weapons: { name: "Spada lunga", weaponProficiencyGroup: "MARTIAL", proficient: true } },
    };
    expect(resolveWeaponProficiency(singletonGrant, { name: "Spada lunga", weaponProficiencyGroup: "MARTIAL" }))
      .toMatchObject({ known: true, proficient: true });
    expect(resolveWeaponProficiency(singletonGrant, { name: "Alabarda", weaponProficiencyGroup: "MARTIAL" }))
      .toMatchObject({ known: true, proficient: false });
    expect(resolveWeaponProficiency(
      { basicInfo: { class: "Mago" }, proficiencies: { weapons: { group: "MARTIAL" } } },
      { name: "Alabarda", weaponProficiencyGroup: "MARTIAL" }
    )).toMatchObject({ known: true, proficient: true });
  });

  it.each([
    ["druid", "Scimitarra", "MARTIAL"],
    ["Druido", "Bastone da combattimento +1", "SIMPLE"],
  ])("recognises the Druid-specific weapon synonyms for %s", (className, name, weaponProficiencyGroup) => {
    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: className } },
        { name, weaponProficiencyGroup }
      )
    ).toMatchObject({ known: true, proficient: true });
  });

  it("gives both Monk labels proficiency with every simple weapon", () => {
    for (const className of ["monk", "Monaco"]) {
      expect(
        resolveWeaponProficiency(
          { basicInfo: { class: className } },
          { name: "Qualsiasi arma semplice censita", weaponProficiencyGroup: "SIMPLE" }
        )
      ).toMatchObject({ known: true, proficient: true, group: "SIMPLE" });
    }
  });

  it("adds structured PROFICIENCY passive effects without inferring them from a capability name or text", () => {
    const valorBard = {
      basicInfo: { class: "Bardo" },
      capabilities: [
        {
          kind: "passive",
          name: "Collegio Bardico del Valore",
          description: "Competenze nelle armi da guerra, armature medie e scudi.",
          passiveEffects: [
            { category: "PROFICIENCY", target: "WEAPON_MARTIAL" },
            { category: "PROFICIENCY", target: "ARMOR_MEDIUM" },
            { category: "PROFICIENCY", target: "SHIELD" },
          ],
        },
      ],
    };

    expect(
      resolveWeaponProficiency(
        { basicInfo: { class: "Bardo" } },
        { name: "Ascia da battaglia", weaponProficiencyGroup: "MARTIAL" }
      )
    ).toMatchObject({ known: true, proficient: false, group: "MARTIAL" });

    expect(
      resolveWeaponProficiency(valorBard, { name: "Ascia da battaglia", weaponProficiencyGroup: "MARTIAL" })
    ).toEqual({
      known: true,
      proficient: true,
      group: "MARTIAL",
      breakdown: ["Competenza armi da guerra concessa da Collegio Bardico del Valore"],
    });

    expect(resolveArmorProficiency(valorBard, { armorCategory: "MEDIUM" })).toEqual({
      known: true,
      proficient: true,
      category: "MEDIUM",
      breakdown: ["Competenza armature medie concessa da Collegio Bardico del Valore"],
    });
    expect(resolveArmorProficiency(valorBard, { armorCategory: "SHIELD" })).toEqual({
      known: true,
      proficient: true,
      category: "SHIELD",
      breakdown: ["Competenza scudi concessa da Collegio Bardico del Valore"],
    });

    const namedOnlyBard = {
      basicInfo: { class: "Bardo" },
      capabilities: [{ kind: "passive", name: "Collegio Bardico del Valore", description: "Armi da guerra." }],
    };
    expect(
      resolveWeaponProficiency(namedOnlyBard, { name: "Ascia da battaglia", weaponProficiencyGroup: "MARTIAL" })
    ).toMatchObject({ known: true, proficient: false });
  });

  it("ignores modifier effects and malformed PROFICIENCY effects for proficiency", () => {
    const characterData = {
      basicInfo: { class: "Bardo" },
      capabilities: [
        {
          kind: "passive",
          name: "Effetto incompleto",
          passiveEffects: [
            { target: "WEAPON_MARTIAL", value: 1 },
            { category: "MODIFIER", target: "ARMOR_MEDIUM", value: 1 },
            { category: "PROFICIENCY", target: "WEAPON_MARTIAL", trigger: "WHILE_ARMORED", value: 99 },
          ],
        },
      ],
    };

    expect(
      resolveWeaponProficiency(characterData, { name: "Ascia da battaglia", weaponProficiencyGroup: "MARTIAL" })
    ).toMatchObject({ known: true, proficient: false });
    expect(resolveArmorProficiency(characterData, "MEDIUM")).toMatchObject({ known: true, proficient: false });
  });

  it("grants Pact Weapon proficiency only to the bound item instance or explicitly marked virtual weapon", () => {
    const warlockWithPactBlade = {
      basicInfo: { class: "Warlock" },
      pactBlade: { bondedCharacterItemId: "character-item-bound" },
    };
    const battleaxe = { name: "Ascia da battaglia", weaponProficiencyGroup: "MARTIAL" as const };

    expect(resolveWeaponProficiency({ basicInfo: { class: "Warlock" } }, battleaxe)).toMatchObject({
      known: true,
      proficient: false,
    });
    expect(resolveWeaponProficiency(warlockWithPactBlade, { ...battleaxe, characterItemId: "character-item-bound" })).toEqual({
      known: true,
      proficient: true,
      group: "MARTIAL",
      breakdown: ["Competenza concessa da Arma del Patto"],
    });
    expect(resolveWeaponProficiency(warlockWithPactBlade, { ...battleaxe, characterItemId: "other-instance" })).toMatchObject({
      known: true,
      proficient: false,
    });
    expect(resolveWeaponProficiency(warlockWithPactBlade, { ...battleaxe, isPactWeapon: true })).toEqual({
      known: true,
      proficient: true,
      group: "MARTIAL",
      breakdown: ["Competenza concessa da Arma del Patto"],
    });
    expect(resolveWeaponProficiency(
      { ...warlockWithPactBlade, basicInfo: { class: "Bardo" } },
      { ...battleaxe, characterItemId: "character-item-bound" }
    )).toMatchObject({ known: true, proficient: false });
  });
});

describe("resolveArmorProficiency", () => {
  it("keeps base class armor expertise and validates classified armor categories", () => {
    expect(resolveArmorProficiency({ basicInfo: { class: "Guerriero" } }, "HEAVY")).toMatchObject({
      known: true,
      proficient: true,
      category: "HEAVY",
    });
    expect(resolveArmorProficiency({ basicInfo: { class: "Bardo" } }, "HEAVY")).toMatchObject({
      known: true,
      proficient: false,
      category: "HEAVY",
    });
    expect(resolveArmorProficiency({ basicInfo: { class: "Bardo" } }, { armorCategory: "CLOTH" })).toEqual({
      known: false,
      proficient: false,
      category: null,
      breakdown: ["Classificazione competenza armatura mancante"],
    });
  });
});

describe("resolveCharacterProficiencySummary", () => {
  it("returns only the Bard's owned base-class categories and keeps its named weapons separate", () => {
    expect(resolveCharacterProficiencySummary({ basicInfo: { class: "Bardo" } })).toEqual({
      entries: [
        { kind: "WEAPON_GROUP", target: "SIMPLE", label: "armi semplici", proficient: true, sources: ["Classe: Bardo"] },
        { kind: "ARMOR_CATEGORY", target: "LIGHT", label: "armature leggere", proficient: true, sources: ["Classe: Bardo"] },
      ],
      specificWeapons: [
        { label: "Balestra a mano", source: "Classe: Bardo" },
        { label: "Spada lunga", source: "Classe: Bardo" },
        { label: "Stocco", source: "Classe: Bardo" },
        { label: "Spada corta", source: "Classe: Bardo" },
      ],
    });
  });

  it("combines strict passive PROFICIENCY effects with the base class and exposes each provenance", () => {
    const summary = resolveCharacterProficiencySummary({
      basicInfo: { class: "Bardo" },
      capabilities: [
        {
          kind: "passive",
          name: "Collegio Bardico del Valore",
          category: "Sottoclasse",
          passiveEffects: [
            { category: "PROFICIENCY", target: "WEAPON_MARTIAL" },
            { category: "PROFICIENCY", target: "ARMOR_MEDIUM" },
            { category: "PROFICIENCY", target: "SHIELD" },
          ],
        },
      ],
    });

    expect(summary.entries).toEqual([
      { kind: "WEAPON_GROUP", target: "SIMPLE", label: "armi semplici", proficient: true, sources: ["Classe: Bardo"] },
      { kind: "WEAPON_GROUP", target: "MARTIAL", label: "armi da guerra", proficient: true, sources: ["Sottoclasse: Collegio Bardico del Valore"] },
      { kind: "ARMOR_CATEGORY", target: "LIGHT", label: "armature leggere", proficient: true, sources: ["Classe: Bardo"] },
      { kind: "ARMOR_CATEGORY", target: "MEDIUM", label: "armature medie", proficient: true, sources: ["Sottoclasse: Collegio Bardico del Valore"] },
      { kind: "ARMOR_CATEGORY", target: "SHIELD", label: "scudi", proficient: true, sources: ["Sottoclasse: Collegio Bardico del Valore"] },
    ]);
  });

  it("includes all Fighter base-class groups and armor categories", () => {
    expect(resolveCharacterProficiencySummary({ basicInfo: { class: "Guerriero" } }).entries).toEqual([
      { kind: "WEAPON_GROUP", target: "SIMPLE", label: "armi semplici", proficient: true, sources: ["Classe: Guerriero"] },
      { kind: "WEAPON_GROUP", target: "MARTIAL", label: "armi da guerra", proficient: true, sources: ["Classe: Guerriero"] },
      { kind: "ARMOR_CATEGORY", target: "LIGHT", label: "armature leggere", proficient: true, sources: ["Classe: Guerriero"] },
      { kind: "ARMOR_CATEGORY", target: "MEDIUM", label: "armature medie", proficient: true, sources: ["Classe: Guerriero"] },
      { kind: "ARMOR_CATEGORY", target: "HEAVY", label: "armature pesanti", proficient: true, sources: ["Classe: Guerriero"] },
      { kind: "ARMOR_CATEGORY", target: "SHIELD", label: "scudi", proficient: true, sources: ["Classe: Guerriero"] },
    ]);
  });

  it("keeps the Monk summary aligned with its simple-weapon attack proficiency", () => {
    expect(resolveCharacterProficiencySummary({ basicInfo: { class: "Monaco" } })).toEqual({
      entries: [
        { kind: "WEAPON_GROUP", target: "SIMPLE", label: "armi semplici", proficient: true, sources: ["Classe: Monaco"] },
      ],
      specificWeapons: [{ label: "Spada corta", source: "Classe: Monaco" }],
    });
  });

  it("includes explicit legacy groups and named weapons without promoting names to a group", () => {
    expect(
      resolveCharacterProficiencySummary({ basicInfo: { class: "Mago" }, proficiencies: { weapons: { martial: true } } }).entries
    ).toContainEqual({
      kind: "WEAPON_GROUP",
      target: "MARTIAL",
      label: "armi da guerra",
      proficient: true,
      sources: ["Competenza esplicita"],
    });

    const namedGrant = resolveCharacterProficiencySummary({
      basicInfo: { class: "Mago" },
      proficiencies: { weapons: ["Spada lunga", "armi da guerra", "Spada lunga"] },
    });
    expect(namedGrant.entries).not.toContainEqual(expect.objectContaining({ kind: "WEAPON_GROUP", target: "MARTIAL" }));
    expect(namedGrant.specificWeapons).toEqual([
      { label: "Pugnale", source: "Classe: Mago" },
      { label: "Dardo", source: "Classe: Mago" },
      { label: "Fionda", source: "Classe: Mago" },
      { label: "Bastone", source: "Classe: Mago" },
      { label: "Balestra leggera", source: "Classe: Mago" },
      { label: "Spada lunga", source: "Competenza esplicita" },
    ]);

    const structuredGrant = resolveCharacterProficiencySummary({
      basicInfo: { class: "Mago" },
      proficiencies: {
        weapons: [
          { name: "Spada lunga", weaponProficiencyGroup: "MARTIAL" },
          { name: "Falsa competenza", weaponProficiencyGroup: "MARTIAL", proficient: false },
          { name: "Competenza disabilitata", weaponProficiencyGroup: "MARTIAL", enabled: false },
        ],
      },
    });
    expect(structuredGrant.entries).not.toContainEqual(expect.objectContaining({ kind: "WEAPON_GROUP", target: "MARTIAL" }));
    expect(structuredGrant.specificWeapons).toContainEqual({ label: "Spada lunga", source: "Competenza esplicita" });
    expect(structuredGrant.specificWeapons).not.toContainEqual(expect.objectContaining({ label: "Falsa competenza" }));
    expect(structuredGrant.specificWeapons).not.toContainEqual(expect.objectContaining({ label: "Competenza disabilitata" }));
    expect(structuredGrant.specificWeapons).not.toContainEqual(expect.objectContaining({ label: "proficient" }));
  });

  it("never promotes Pact Blade state to a general summary proficiency", () => {
    expect(resolveCharacterProficiencySummary({
      basicInfo: { class: "Warlock" },
      pactBlade: { bondedCharacterItemId: "bound-martial-weapon" },
    })).toEqual({
      entries: [
        { kind: "WEAPON_GROUP", target: "SIMPLE", label: "armi semplici", proficient: true, sources: ["Classe: Warlock"] },
        { kind: "ARMOR_CATEGORY", target: "LIGHT", label: "armature leggere", proficient: true, sources: ["Classe: Warlock"] },
      ],
      specificWeapons: [],
    });
  });

  it("does not infer summary entries from a capability name or malformed effect", () => {
    const summary = resolveCharacterProficiencySummary({
      basicInfo: { class: "Bardo" },
      capabilities: [
        {
          kind: "passive",
          name: "Collegio Bardico del Valore",
          passiveEffects: [
            { target: "WEAPON_MARTIAL", value: 1 },
            { category: "PROFICIENCY", target: "ARMOR_MEDIUM", trigger: "WHILE_ARMORED" },
          ],
        },
      ],
    });

    expect(summary.entries).toEqual([
      { kind: "WEAPON_GROUP", target: "SIMPLE", label: "armi semplici", proficient: true, sources: ["Classe: Bardo"] },
      { kind: "ARMOR_CATEGORY", target: "LIGHT", label: "armature leggere", proficient: true, sources: ["Classe: Bardo"] },
    ]);
  });
});

describe("hasTwoWeaponFightingStyle", () => {
  it.each([
    { features: ["Combattere con Due Armi"] },
    { capabilities: [{ name: "Two-Weapon Fighting" }] },
    { features: [{ title: "two weapon fighting" }] },
  ])("recognises the persisted TWF labels", (characterData) => {
    expect(hasTwoWeaponFightingStyle(characterData)).toBe(true);
  });

  it("does not infer the style from a partial or unrelated feature name", () => {
    expect(hasTwoWeaponFightingStyle({ features: ["Combattere con due armi migliorato"] })).toBe(false);
  });
});
