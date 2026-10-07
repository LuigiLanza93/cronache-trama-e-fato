import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractPhbSpellCatalog, projectCreationSpellOptions } from "../../scripts/build-phb-spell-catalog.mjs";
import creationOptions from "../../shared/character-creation-spell-options.json" with { type: "json" };
import { PHB_SPELL_CATALOG, listPhbSpells, resolvePhbSpell } from "../../shared/phb-spell-catalog.mjs";

const manual = readFileSync(new URL("../../docs/Manuale_del_Giocatore_5.0.md", import.meta.url), "utf8");
const manualLines = manual.split(/\r?\n/);

describe("source-backed PHB spell catalog", () => {
  it("reproduces all checked-in definitions and initial choices from the local manual", () => {
    const extracted = extractPhbSpellCatalog(manual);
    expect(extracted).toEqual(PHB_SPELL_CATALOG);
    expect(projectCreationSpellOptions(extracted)).toEqual(creationOptions);
    expect(extracted.spells).toHaveLength(361);
    expect(extracted.spells.every((spell) => spell.description.length > 100 && spell.source.page >= 211 && spell.source.page <= 289)).toBe(true);
    expect(new Set(extracted.spells.map((spell) => spell.id)).size).toBe(361);
  });

  it("covers every class list at every PHB spell tier without importing legacy flags", () => {
    const expected = { bardo: 120, chierico: 106, druido: 110, mago: 215, paladino: 45, ranger: 46, stregone: 129, warlock: 74 };
    for (const [classKey, count] of Object.entries(expected)) {
      expect(listPhbSpells(classKey)).toHaveLength(count);
      const levels = [...new Set(listPhbSpells(classKey).map((spell) => spell.level))].sort();
      expect(levels).toEqual(["paladino", "ranger"].includes(classKey) ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const spell of listPhbSpells(classKey)) {
        const entry = spell.classLists.find((entry) => entry.classKey === classKey);
        expect(manualLines[entry.line - 1]).toBe(`- ${spell.name}`);
      }
    }
    expect(listPhbSpells("wizard")).toEqual(listPhbSpells("mago"));
    expect(listPhbSpells("invented-class")).toEqual([]);
  });

  it("keeps spell availability separate from subclass grants and at-will casting", () => {
    expect(listPhbSpells("warlock", { level: 1 }).map((spell) => spell.name)).not.toContain("Dardo Incantato");
    expect(listPhbSpells("warlock", { level: 1 }).map((spell) => spell.name)).not.toContain("Vita Falsata");
    expect(resolvePhbSpell("Vita Falsata").level).toBe(1);
    expect(resolvePhbSpell("Sortilegio").ritual).toBe(false);
    expect(resolvePhbSpell("Comprensione dei Linguaggi").ritual).toBe(true);
  });

  it("only marks actual spell attacks, so Spell Sniper cannot pick save-based cantrips", () => {
    for (const name of ["Beffa Crudele", "Fiotto Acido", "Fiamma Sacra", "Colpo Accurato", "Spruzzo Velenoso", "Randello Incantato"]) expect(resolvePhbSpell(name).attack_roll).toBe(false);
    for (const name of ["Dardo di Fuoco", "Deflagrazione Occulta", "Frusta di Spine", "Produrre Fiamma", "Raggio di Gelo", "Stretta Folgorante", "Tocco Gelido"]) expect(resolvePhbSpell(name).attack_roll).toBe(true);
  });

  it("resolves saved labels and explicit legacy aliases to the same immutable definition", () => {
    for (const [oldName, canonical] of [["Disco Fluttuante", "Disco Fluttuante di Tenser"], ["Risata Incontenibile", "Risata Incontenibile di Tasha"], ["Lingue", "Linguaggi"], ["Tocco Vampirico", "Tocco del Vampiro"], ["Mano Arcana", "Mano di Bigby"], ["Aura Magica dell’Arcanista", "Aura Magica di Nystul"]]) {
      expect(resolvePhbSpell(oldName)).toBe(resolvePhbSpell(canonical));
    }
    for (const spell of PHB_SPELL_CATALOG.spells) expect(resolvePhbSpell(spell.id)).toBe(spell);
    expect(resolvePhbSpell("Camuffare Se Stesso")).toBe(resolvePhbSpell("Camuffare Sé Stesso"));
    expect(resolvePhbSpell("Attacco con Finta")).toBeNull();
    expect(resolvePhbSpell(null)).toBeNull();
    expect(Object.isFrozen(resolvePhbSpell("Vita Falsata"))).toBe(true);
  });

  it("fails missing or ambiguous descriptions and exposes unreadable OCR metadata", () => {
    expect(() => extractPhbSpellCatalog(manual.replace("### VITA FALSATA", "### UNKNOWN SPELL"))).toThrow("Expected one description for Vita Falsata");
    expect(() => extractPhbSpellCatalog(manual.replace("### VITA FALSATA", "### VITA FALSATA\n\n### VITA FALSATA"))).toThrow("Expected one description for Vita Falsata");
    expect(resolvePhbSpell("Illusione Minore").school).toBe("Illusione");
    expect(resolvePhbSpell("Resurrezione").level).toBe(7);
    expect(resolvePhbSpell("Resurrezione").school).toBe("Necromanzia");
    expect(resolvePhbSpell("Resurrezione").warnings).toEqual([]);
    expect(resolvePhbSpell("Animare Oggetti").description).toContain("STATISTICHE DEGLI OGGETTI ANIMATI");
  });
});
