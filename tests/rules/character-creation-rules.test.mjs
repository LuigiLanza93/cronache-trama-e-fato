import { expect, test } from "vitest";
import { getLevelOneCreationOptions, materializeLevelOneCharacter, resolveLevelOneCreationPreview, validateLevelOneCreation } from "../../shared/character-creation-rules.mjs";
import spellChoiceCatalog from "../../shared/character-creation-spell-options.json" with { type: "json" };
import { projectGuidedCreationSpells } from "../../shared/character-creation-spells.mjs";

test("client spell-choice catalog contains only level-zero and level-one choice metadata", () => {
  const entries = Object.values(spellChoiceCatalog).flat();
  expect(entries.length).toBeGreaterThan(0);
  expect(entries.every((entry) => (entry.level === 0 || entry.level === 1) && Object.keys(entry).every((key) => ["id", "name", "label", "level", "school", "ritual", "attack_roll"].includes(key)))).toBe(true);
});

const wizard = {
  raceKey: "elf", subraceKey: "high", classKey: "wizard", backgroundKey: "sage",
  narrative: { personalityTraits: ["Curioso", "Metodico"], ideal: "Conoscenza", bond: "La mia accademia", flaw: "Testardo" },
  abilityScores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 },
  selections: {
    "race:elf:high:language": ["dwarvish"], "race:elf:high:cantrip": ["Luce"],
    "class:wizard:skills": ["insight", "investigation"], "class:wizard:weapon": ["class:wizard:weapon:1"],
    "class:wizard:focus": ["class:wizard:focus:1"], "class:wizard:pack": ["class:wizard:pack:1"],
    "class:wizard:cantrips": ["Dardo di Fuoco", "Mano Magica", "Prestidigitazione"],
    "class:wizard:spellbook": ["Allarme", "Armatura Magica", "Caduta Morbida", "Camuffare Sé Stesso", "Charme su Persone", "Comprensione dei Linguaggi"],
    "class:wizard:prepared-spells": ["Allarme", "Armatura Magica", "Caduta Morbida", "Camuffare Sé Stesso"],
    "background:sage:languages": ["giant", "gnomish"],
  },
};

test("exposes concrete spell options and dynamic wizard preparation choices", () => {
  const options = getLevelOneCreationOptions(wizard);
  const prepared = options.resolved.choiceSlots.find((slot) => slot.id === "class:wizard:prepared-spells");
  expect(prepared.count).toBe(4);
  expect(prepared.options.map((option) => option.key)).toEqual(wizard.selections["class:wizard:spellbook"]);
  expect(prepared.options.find((option) => option.key === "Allarme")?.spellDetails).toBeUndefined();
});

test("Warlock patrons have Italian labels and expand only their own level-one spell list", () => {
  const patrons = [
    ["the-archfey", "Il Signore Fatato", ["Luminescenza", "Sonno"]],
    ["the-fiend", "L'Immondo", ["Comando", "Mani Brucianti"]],
    ["the-great-old-one", "Il Grande Antico", ["Risata Incontenibile", "Sussurri Dissonanti"]],
  ];
  const base = getLevelOneCreationOptions({ raceKey: "human", classKey: "warlock", backgroundKey: "urchin" });
  const baseSpells = base.resolved.choiceSlots.find((slot) => slot.id === "class:warlock:spells");
  const baseNames = new Set(baseSpells.options.map((option) => option.key));
  const patronSlot = base.resolved.choiceSlots.find((slot) => slot.id === "class:warlock:patron");
  expect(patronSlot.options.map((option) => [option.key, option.label.it])).toEqual(patrons.map(([key, name]) => [key, name]));

  for (const [key, , addedNames] of patrons) {
    const options = getLevelOneCreationOptions({
      raceKey: "human", classKey: "warlock", backgroundKey: "urchin",
      selections: { "class:warlock:patron": [key] },
    });
    const spellSlot = options.resolved.choiceSlots.find((slot) => slot.id === "class:warlock:spells");
    expect(spellSlot.count).toBe(2);
    const spellNames = new Set(spellSlot.options.map((option) => option.key));
    expect([...spellNames].filter((name) => !baseNames.has(name)).sort()).toEqual([...addedNames].sort());
    for (const name of addedNames) expect(spellSlot.options.find((option) => option.key === name)?.label.it).toContain("Patrono");
  }
});

test("validates and materializes a fully selected level-one wizard", () => {
  const result = validateLevelOneCreation(wizard);
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  const materialized = materializeLevelOneCharacter(wizard);
  expect(materialized.ok).toBe(true);
  expect(materialized.choiceSlots.find((slot) => slot.id === "class:wizard:cantrips").options[0].spellDetails).toBeUndefined();
  const spellGrants = projectGuidedCreationSpells(materialized);
  expect(spellGrants.filter((spell) => spell.role === "cantrip")).toHaveLength(4);
  expect(spellGrants.filter((spell) => spell.role === "spellbook")).toHaveLength(6);
  expect(spellGrants.filter((spell) => spell.role === "prepared")).toHaveLength(4);
  expect(spellGrants).toContainEqual(expect.objectContaining({ name: "Allarme", level: 1, role: "prepared", source: "Classe" }));
  expect(materialized.abilities.final.intelligence).toBe(16);
  expect(materialized.proficiencies.languages).toEqual(["common", "elvish", "dwarvish", "giant", "gnomish"]);
});

test("spell validation preserves historical aliases while preventing duplicate canonical identities", () => {
  const aliased = structuredClone(wizard);
  aliased.selections["class:wizard:prepared-spells"] = ["Camuffare Se Stesso", "Allarme", "Armatura Magica", "Caduta Morbida"];
  expect(validateLevelOneCreation(aliased).ok).toBe(true);
  expect(materializeLevelOneCharacter(aliased).choices["class:wizard:spellbook"]).toContain("Camuffare Sé Stesso");
  aliased.selections["class:wizard:spellbook"][0] = "Camuffare Se Stesso";
  expect(validateLevelOneCreation(aliased).issues.some((issue) => issue.code === "duplicate_choice")).toBe(true);
  aliased.selections["class:wizard:spellbook"] = ["Allarme", "Allarme", "Armatura Magica", "Caduta Morbida", "Camuffare Sé Stesso", "Comprensione dei Linguaggi"];
  expect(() => validateLevelOneCreation(aliased)).not.toThrow();
  expect(validateLevelOneCreation(aliased).ok).toBe(false);
});

test("projects ritual books and fixed level-one cantrips into their proper sheet groups", () => {
  const ritual = projectGuidedCreationSpells({
    identity: { raceKey: "variant-human", classKey: "fighter" },
    choiceSlots: [{ id: "feat:ritualCaster:rituals", kind: "spell", owner: "feat" }],
    choices: { "feat:ritualCaster:rituals": ["Allarme", "Comprensione dei Linguaggi"] },
  });
  expect(ritual).toEqual([
    expect.objectContaining({ name: "Allarme", level: 1, role: "ritualbook", source: "Talento" }),
    expect.objectContaining({ name: "Comprensione dei Linguaggi", level: 1, role: "ritualbook", source: "Talento" }),
  ]);

  for (const [raceKey, subraceKey, expected] of [
    ["elf", "drow", "Luci Danzanti"],
    ["gnome", "forest", "Illusione Minore"],
    ["tiefling", null, "Taumaturgia"],
  ]) {
    expect(projectGuidedCreationSpells({ identity: { raceKey, subraceKey }, choiceSlots: [], choices: {} }))
      .toContainEqual(expect.objectContaining({ name: expected, level: 0, role: "cantrip", source: "Razza" }));
  }

  const lightCleric = projectGuidedCreationSpells({
    identity: { classKey: "cleric" },
    choiceSlots: [],
    choices: { "class:cleric:domain": ["light-domain"] },
  });
  expect(lightCleric).toContainEqual(expect.objectContaining({ name: "Luce", level: 0, role: "cantrip", source: "Dominio divino" }));
});

test("rejects point-buy violations, arbitrary spells, duplicate languages and unknown slots", () => {
  const invalid = structuredClone(wizard);
  invalid.abilityScores.intelligence = 16;
  invalid.selections["class:wizard:prepared-spells"] = ["Allarme", "Armatura Magica", "Caduta Morbida", "Forgiato dal nulla"];
  invalid.selections["background:sage:languages"] = ["common", "common"];
  invalid.selections.forged = ["anything"];
  const result = validateLevelOneCreation(invalid);
  expect(result.ok).toBe(false);
  expect(result.issues.some((issue) => issue.code === "point_buy_budget")).toBe(true);
  expect(result.issues.some((issue) => issue.code === "spell_not_in_spellbook")).toBe(true);
  expect(result.issues.some((issue) => issue.code === "duplicate_proficiency")).toBe(true);
  expect(result.issues.some((issue) => issue.code === "unknown_choice_slot")).toBe(true);
});

test("every first-level class exposes a completable set of guided choices", () => {
  const catalog = getLevelOneCreationOptions();
  for (const classKey of Object.keys(catalog.classes)) {
    const input = {
      raceKey: "human", classKey, backgroundKey: "urchin",
      narrative: { personalityTraits: ["Curioso", "Tenace"], ideal: "Libertà", bond: "La famiglia", flaw: "Impulsivo" },
      abilityScores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
      selections: {},
    };
    for (let pass = 0; pass < 5; pass++) {
      const options = getLevelOneCreationOptions(input);
      let changed = false;
      for (const slot of options.resolved.choiceSlots) {
        const count = slot.count ?? 1;
        if ((input.selections[slot.id] ?? []).length === count) continue;
        const taken = new Set([
          "common",
          ...options.backgrounds.urchin.skillProficiencies,
          ...options.backgrounds.urchin.toolProficiencies,
          ...(options.classes[classKey].fixed.tools ?? []),
          ...Object.entries(input.selections).filter(([id]) => id !== slot.id).flatMap(([, values]) => values),
        ]);
        input.selections[slot.id] = slot.options.map((option) => option.key)
          .filter((key) => !slot.excludedOptions?.includes(key))
          .filter((key) => !["skill", "language", "tool"].includes(slot.kind) || !taken.has(key))
          .slice(0, count);
        changed = true;
      }
      if (!changed) break;
    }
    const result = validateLevelOneCreation(input);
    expect(result.ok, `${classKey}: ${JSON.stringify(result.issues)}`).toBe(true);
  }
});

test("racial and background duplicate skills require an explicit replacement", () => {
  const options = getLevelOneCreationOptions({ raceKey: "elf", subraceKey: "wood", classKey: "fighter", backgroundKey: "sailor" });
  const replacement = options.resolved.choiceSlots.find((slot) => slot.id === "replacement:skills");
  expect(replacement?.count).toBe(1);
  expect(replacement.options.some((option) => option.key === "perception")).toBe(true);
  expect(replacement.conflicts).toEqual([{ name: "Percezione", sources: ["Elfo", "Marinaio"] }]);
});

test("rogue and criminal explain the thieves' tools overlap only when it exists", () => {
  const criminal = getLevelOneCreationOptions({ raceKey: "halfling", subraceKey: "lightfoot", classKey: "rogue", backgroundKey: "criminal" });
  const replacement = criminal.resolved.choiceSlots.find((slot) => slot.id === "replacement:tools");
  expect(replacement?.count).toBe(1);
  expect(replacement?.conflicts).toEqual([{ name: "Arnesi da scasso", sources: ["Ladro", "Criminale"] }]);
  const noOverlap = getLevelOneCreationOptions({ raceKey: "halfling", subraceKey: "lightfoot", classKey: "rogue", backgroundKey: "acolyte" });
  expect(noOverlap.resolved.choiceSlots.some((slot) => slot.id.startsWith("replacement:"))).toBe(false);
});

test("variant-human feats enforce armor prerequisites and expose their dependent choices", () => {
  const input = {
    ...wizard,
    raceKey: "variant-human",
    subraceKey: undefined,
    selections: { "race:variant-human:feat": ["heavilyArmored"] },
  };
  const invalid = validateLevelOneCreation(input);
  expect(invalid.issues.some((issue) => issue.code === "feat_prerequisite")).toBe(true);
  input.selections["race:variant-human:feat"] = ["magicInitiate"];
  input.selections["feat:magicInitiate:class"] = ["druid"];
  const options = getLevelOneCreationOptions(input).resolved.choiceSlots;
  expect(options.find((slot) => slot.id === "feat:magicInitiate:cantrips")?.count).toBe(2);
  expect(options.find((slot) => slot.id === "feat:magicInitiate:spell")?.options.length).toBeGreaterThan(0);
});

test("ranger humanoid enemies require both races and beasts do not force a language", () => {
  const base = { raceKey: "human", classKey: "ranger", backgroundKey: "soldier", abilityScores: wizard.abilityScores, narrative: wizard.narrative };
  const humanoids = getLevelOneCreationOptions({ ...base, selections: { "class:ranger:enemy": ["twoHumanoidRaces"] } }).resolved.choiceSlots;
  expect(humanoids.find((slot) => slot.id === "class:ranger:humanoid-races")?.count).toBe(2);
  const beasts = getLevelOneCreationOptions({ ...base, selections: { "class:ranger:enemy": ["beasts"] } }).resolved.choiceSlots;
  expect(beasts.some((slot) => slot.id === "class:ranger:enemy-language")).toBe(false);
});

test("PHB background variants keep owned items separate from proficiencies and optional privileges", () => {
  const options = getLevelOneCreationOptions({ raceKey: "human", classKey: "fighter", backgroundKey: "guildMerchant" });
  const merchant = options.backgrounds.guildMerchant;
  expect(merchant.toolProficiencies).toEqual([]);
  expect(options.resolved.choiceSlots.map((slot) => slot.id)).toEqual(expect.arrayContaining(["background:guildMerchant:proficiency", "background:guildMerchant:equipment"]));
  expect(options.resolved.choiceSlots.find((slot) => slot.id === "background:guildMerchant:proficiency")?.options.map((option) => option.key)).toEqual(expect.arrayContaining(["navigatorsTools", "elvish", "smithsTools"]));
  const gladiator = getLevelOneCreationOptions({ raceKey: "human", classKey: "fighter", backgroundKey: "gladiator" });
  expect(gladiator.resolved.choiceSlots.find((slot) => slot.id === "background:gladiator:performance-item")?.kind).toBe("equipment");
  expect(gladiator.resolved.choiceSlots.find((slot) => slot.id === "background:gladiator:instrument")?.kind).toBe("tool");
  for (const key of ["sailor", "pirate"]) {
    const catalog = getLevelOneCreationOptions({ raceKey: "human", classKey: "fighter", backgroundKey: key });
    expect(catalog.backgrounds[key].privilege?.label.it).toBe("Passaggio in Nave");
    expect(catalog.resolved.choiceSlots.find((slot) => slot.id === `background:${key}:privilege`)?.options.map(o => o.key)).toEqual(["passageOnShip", "badReputation"]);
  }
});

test("custom background has bounded PHB sources and preview never materializes invalid draft grants", () => {
  const input = { raceKey:"human", classKey:"fighter", backgroundKey:"custom", customBackground:{name:"Custode del Porto",featureBackgroundKey:"acolyte",equipmentBackgroundKey:"sailor",backgroundDetails:"Custodisce un piccolo santuario."}, abilityScores:{strength:15,dexterity:14,constitution:13,intelligence:12,wisdom:10,charisma:8} };
  const preview = resolveLevelOneCreationPreview(input);
  expect(preview.ok).toBe(false);
  expect(preview.resolved.background).toMatchObject({key:"custom",featureBackgroundKey:"acolyte",equipmentBackgroundKey:"sailor",backgroundDetails:"Custodisce un piccolo santuario."});
  expect(preview.resolved.choiceSlots.map((slot) => slot.id)).toEqual(expect.arrayContaining(["background:custom:skills", "background:custom:proficiencies", "background:custom:equipment:lucky-charm"]));
  expect(validateLevelOneCreation({...input,customBackground:{...input.customBackground,featureBackgroundKey:"unknown"}}).issues.some((issue) => issue.code === "unknown_background")).toBe(true);
});
