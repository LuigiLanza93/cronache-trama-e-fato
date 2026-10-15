export const DRACONIC_BLOODLINE_SUBCLASS_KEY = "draconic-bloodline";

export const DRACONIC_ANCESTRIES = Object.freeze({
  black: Object.freeze({ key: "black", label: "Nero", damageType: "acid", damageLabel: "Acido" }),
  blue: Object.freeze({ key: "blue", label: "Blu", damageType: "lightning", damageLabel: "Fulmine" }),
  brass: Object.freeze({ key: "brass", label: "Ottone", damageType: "fire", damageLabel: "Fuoco" }),
  bronze: Object.freeze({ key: "bronze", label: "Bronzo", damageType: "lightning", damageLabel: "Fulmine" }),
  copper: Object.freeze({ key: "copper", label: "Rame", damageType: "acid", damageLabel: "Acido" }),
  gold: Object.freeze({ key: "gold", label: "Oro", damageType: "fire", damageLabel: "Fuoco" }),
  green: Object.freeze({ key: "green", label: "Verde", damageType: "poison", damageLabel: "Veleno" }),
  red: Object.freeze({ key: "red", label: "Rosso", damageType: "fire", damageLabel: "Fuoco" }),
  silver: Object.freeze({ key: "silver", label: "Argento", damageType: "cold", damageLabel: "Freddo" }),
  white: Object.freeze({ key: "white", label: "Bianco", damageType: "cold", damageLabel: "Freddo" }),
});

export const DRACONIC_ANCESTRY_OPTIONS = Object.freeze(
  Object.values(DRACONIC_ANCESTRIES).map((entry) => Object.freeze({ ...entry })),
);

export function normalizeDraconicAncestryKey(value) {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return DRACONIC_ANCESTRIES[key]?.key ?? null;
}

export function draconicAncestrySummary(value) {
  const key = normalizeDraconicAncestryKey(value);
  return key ? { ...DRACONIC_ANCESTRIES[key] } : null;
}

export function requiresDraconicAncestry(classKey, subclassKey) {
  return classKey === "sorcerer" && subclassKey === DRACONIC_BLOODLINE_SUBCLASS_KEY;
}
