/** Read-only comparison of the PHB spell lists and the current choice catalog. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manual = readFileSync(resolve(root, "docs/Manuale_del_Giocatore_5.0.md"), "utf8").split(/\r?\n/);
const useLegacyCatalog = process.argv.includes("--legacy");
const allLevels = process.argv.includes("--all-levels");
const classIndex = process.argv.indexOf("--class");
const onlyClass = classIndex >= 0 ? process.argv[classIndex + 1] : null;
const catalogPath = useLegacyCatalog ? "src/data/JSON_LEGACY/spells.json" : "shared/character-creation-spell-options.json";
const catalog = JSON.parse(readFileSync(resolve(root, catalogPath), "utf8"));
const names = {
  BARDO: "bardo", CHIERICO: "chierico", DRUIDO: "druido", MAGO: "mago",
  PALADINO: "paladino", RANGER: "ranger", STREGONE: "stregone", WARLOCK: "warlock",
};
const keyOf = (name) => {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("it").replace(/ di (tasha|tenser)$/i, "")
  .replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  return { linguaggi: "lingue", "tocco del vampiro": "tocco vampirico" }[normalized] ?? normalized;
};
const lists = Object.fromEntries(Object.values(names).map((name) => [name, []]));
let currentClass = null;
let currentLevel = null;
let inLists = false;

for (let index = 0; index < manual.length; index++) {
  const line = manual[index].trim();
  const classMatch = /^### INCANTESIMI DA (BARDO|CHIERICO|DRUIDO|MAGO|PALADINO|RANGER|STREGONE|WARLOCK)(?: \(CONTINUA\))?$/.exec(line);
  if (classMatch) {
    currentClass = names[classMatch[1]];
    currentLevel = null;
    inLists = true;
    continue;
  }
  if (!inLists) continue;
  if (line === "### DESCRIZIONE DEGLI INCANTESIMI") break;
  const levelMatch = /^#### (?:Trucchetti \(livello 0\)|([1-9])° livello)/.exec(line);
  if (levelMatch) {
    currentLevel = levelMatch[1] ? Number(levelMatch[1]) : 0;
    continue;
  }
  const spellMatch = /^- (?!\*\*)(.+)$/.exec(line);
  if (spellMatch && currentClass !== null && currentLevel !== null) {
    lists[currentClass].push({ name: spellMatch[1].trim(), level: currentLevel, line: index + 1 });
  }
}

const report = {};
for (const classKey of Object.values(names).filter((name) => !onlyClass || name === onlyClass)) {
  const manualEntries = lists[classKey].filter((spell) => allLevels || spell.level <= 1);
  const choiceEntries = (catalog[classKey] ?? []).filter((spell) => allLevels || spell.level <= 1);
  const manualKeys = new Set(manualEntries.map((spell) => `${spell.level}:${keyOf(spell.name)}`));
  const choiceKeys = new Set(choiceEntries.map((spell) => `${spell.level}:${keyOf(spell.name)}`));
  report[classKey] = {
    manualCount: manualEntries.length,
    choiceCount: choiceEntries.length,
    missingFromChoices: manualEntries.filter((spell) => !choiceKeys.has(`${spell.level}:${keyOf(spell.name)}`)),
    extraInChoices: choiceEntries.filter((spell) => !manualKeys.has(`${spell.level}:${keyOf(spell.name)}`))
      .map((spell) => ({ name: spell.name, level: spell.level })),
  };
}

const output = process.argv.includes("--summary")
  ? Object.fromEntries(Object.entries(report).map(([classKey, details]) => [classKey, {
      manualCount: details.manualCount,
      catalogCount: details.choiceCount,
      missingCount: details.missingFromChoices.length,
      extraCount: details.extraInChoices.length,
    }]))
  : report;
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
