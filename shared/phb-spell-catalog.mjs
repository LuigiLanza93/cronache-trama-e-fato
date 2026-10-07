/** Shared, source-backed PHB definitions. No database access or mutable character state. */
import catalog from "./phb-spell-catalog.json" with { type: "json" };

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it").replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
const classAliases = Object.freeze({ bard: "bardo", cleric: "chierico", druid: "druido", wizard: "mago", paladin: "paladino", ranger: "ranger", sorcerer: "stregone", warlock: "warlock" });

export const PHB_SPELL_CATALOG = freeze(catalog);
export const PHB_SPELL_CATALOG_VERSION = catalog.version;
export const PHB_SPELL_CLASSES = Object.freeze(["bardo", "chierico", "druido", "mago", "paladino", "ranger", "stregone", "warlock"]);

const byName = new Map();
for (const spell of catalog.spells) for (const name of [spell.id, spell.name, ...spell.aliases]) {
  const key = normalize(name);
  const previous = byName.get(key);
  if (previous && previous.id !== spell.id) throw new Error(`Ambiguous PHB spell alias: ${name}`);
  byName.set(key, spell);
}

/** Resolve a stable ID, canonical Italian label, or an explicit historical alias. */
export function resolvePhbSpell(value) {
  return typeof value === "string" ? byName.get(normalize(value)) ?? null : null;
}

/** Base class list only. Subclass expansions and granted spells belong to rule decisions. */
export function listPhbSpells(classKey, filters = {}) {
  if (typeof classKey !== "string") return [];
  const normalized = normalize(classKey);
  const key = classAliases[normalized] ?? normalized;
  return catalog.spells.filter((spell) => spell.classLists.some((entry) => entry.classKey === key)
    && (filters.level === undefined || spell.level === filters.level)
    && (filters.school === undefined || (spell.school !== null && normalize(spell.school) === normalize(filters.school)))
    && (filters.ritual === undefined || spell.ritual === filters.ritual)
    && (filters.attackRoll === undefined || spell.attack_roll === filters.attackRoll))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "it"));
}
