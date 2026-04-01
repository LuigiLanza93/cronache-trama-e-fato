function normalizeWhitespace(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripPunctuation(value = "") {
  return normalizeWhitespace(value).replace(/^[,;.)\s]+|[,;.(\s]+$/g, "").trim();
}

function stripAccents(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const KNOWN_MONSTER_TYPES = new Set([
  "aberrazione",
  "bestia",
  "celestiale",
  "costrutto",
  "drago",
  "elementale",
  "fatato",
  "gigante",
  "immondo",
  "melma",
  "mostruosità",
  "non morto",
  "pianta",
  "sciame di minuscole bestie",
  "umanoide",
]);

function canonicalizeType(value = "") {
  const cleaned = stripPunctuation(value).toLocaleLowerCase("it-IT");
  if (!cleaned) return "";

  const mostruosita = "mostruosit\u00E0";
  const aliasMap = new Map([
    ["aberrazione", "aberrazione"],
    ["aberration", "aberrazione"],
    ["bestia", "bestia"],
    ["beast", "bestia"],
    ["celestiale", "celestiale"],
    ["celestial", "celestiale"],
    ["costrutto", "costrutto"],
    ["construct", "costrutto"],
    ["drago", "drago"],
    ["dragon", "drago"],
    ["elementale", "elementale"],
    ["elemental", "elementale"],
    ["fatato", "fatato"],
    ["fey", "fatato"],
    ["gigante", "gigante"],
    ["giant", "gigante"],
    ["immondo", "immondo"],
    ["fiend", "immondo"],
    ["melma", "melma"],
    ["ooze", "melma"],
    ["mostruosita", mostruosita],
    ["mostruosit\u00E0", mostruosita],
    ["monstrosity", mostruosita],
    ["monstruosita", mostruosita],
    ["monstruosit\u00E0", mostruosita],
    ["non morto", "non morto"],
    ["undead", "non morto"],
    ["pianta", "pianta"],
    ["plant", "pianta"],
    ["sciame di minuscole bestie", "sciame di minuscole bestie"],
    ["swarm of tiny beasts", "sciame di minuscole bestie"],
    ["umanoide", "umanoide"],
    ["humanoid", "umanoide"],
  ]);

  const accentless = stripAccents(cleaned);
  return aliasMap.get(cleaned) ?? aliasMap.get(accentless) ?? cleaned;
}

function canonicalizeSubtype(value = "") {
  return stripPunctuation(value).toLocaleLowerCase("it-IT");
}

function toDisplayCase(value = "") {
  const lowerWords = new Set(["a", "con", "da", "dei", "degli", "del", "della", "delle", "dello", "di", "e", "fra", "in", "o", "per", "su", "tra"]);
  return normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      const lowerWord = word.toLocaleLowerCase("it-IT");
      if (index > 0 && lowerWords.has(lowerWord)) {
        return lowerWord;
      }
      return lowerWord.charAt(0).toLocaleUpperCase("it-IT") + lowerWord.slice(1);
    })
    .join(" ");
}

function parseTypeWithOptionalSubtype(value = "") {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) return { base: "", subtype: "" };

  const match = cleaned.match(/^(.+?)\s*\(\s*([^)]+?)\s*\)?$/u);
  if (!match) {
    return { base: cleaned, subtype: "" };
  }

  return {
    base: match[1],
    subtype: match[2],
  };
}

export function normalizeMonsterTypeFields({
  creatureType = "",
  subtype = "",
  typeLabel = "",
} = {}) {
  const parsedType = parseTypeWithOptionalSubtype(creatureType);
  const parsedLabel = parseTypeWithOptionalSubtype(typeLabel);

  const nextBase = canonicalizeType(parsedType.base || parsedLabel.base || creatureType || typeLabel);
  const nextSubtype = canonicalizeSubtype(subtype || parsedType.subtype || parsedLabel.subtype);
  const nextTypeLabel = nextBase
    ? `${toDisplayCase(nextBase)}${nextSubtype ? ` (${toDisplayCase(nextSubtype)})` : ""}`
    : "";

  return {
    creatureType: nextBase,
    subtype: nextSubtype,
    typeLabel: nextTypeLabel,
  };
}

export function isKnownMonsterType(value = "") {
  const parsed = parseTypeWithOptionalSubtype(value);
  return KNOWN_MONSTER_TYPES.has(canonicalizeType(parsed.base || value));
}
