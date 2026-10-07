/** Deterministic extraction of PHB spell definitions; never imports legacy rules. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const sourcePath = "docs/Manuale_del_Giocatore_5.0.md";
const classes = { BARDO: "bardo", CHIERICO: "chierico", DRUIDO: "druido", MAGO: "mago", PALADINO: "paladino", RANGER: "ranger", STREGONE: "stregone", WARLOCK: "warlock" };
const schools = ["Abiurazione", "Ammaliamento", "Divinazione", "Evocazione", "Illusione", "Invocazione", "Necromanzia", "Trasmutazione"];
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it").replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
// Explicit historical display-name mappings only; no legacy levels or flags are imported.
const nameAliases = {
  "lingue": "linguaggi", "tocco vampirico": "tocco del vampiro",
  "risata incontenibile": "risata incontenibile di tasha", "disco fluttuante": "disco fluttuante di tenser",
  "capanna": "capanna di leomund", "parlare con le piante": "parlare con i vegetali",
  "reggia meravigliosa": "reggia meravigliosa di mordenkainen", "spada arcana": "spada di mordenkainen",
  "danza irresistibile": "danza irresistibile di otto", "pelle di corteccia": "pelle coriacea",
  "aura magica dell'arcanista": "aura magica di nystul", "freccia acida": "freccia acida di melf",
  "santuario privato": "santuario privato di mordenkainen", "scrigno segreto": "scrigno segreto di leomund",
  "segugio fedele": "segugio fedele di mordenkainen", "sfera elastica": "sfera elastica di otiluke",
  "tentacoli neri": "tentacoli neri di evard", "legame telepatico": "legame telepatico di rary",
  "mano arcana": "mano di bigby", "evocazioni istantanee": "evocazioni istantanee di drawmij",
  "sfera congelante": "sfera congelante di otiluke",
};
const creationNameOverrides = { "Risata Incontenibile di Tasha": "Risata Incontenibile", "Disco Fluttuante di Tenser": "Disco Fluttuante" };
const key = (value) => nameAliases[normalize(value)] ?? normalize(value);
const slug = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function extractPhbSpellCatalog(text) {
  const lines = text.split(/\r?\n/);
  const pages = []; let page = null;
  lines.forEach((line, index) => { const match = /^<!-- Pagina PDF (\d+) -->/.exec(line); if (match) page = Number(match[1]); pages[index] = page; });
  const start = lines.indexOf("### DESCRIZIONE DEGLI INCANTESIMI");
  const end = lines.findIndex((line, index) => index > start && /^## APPENDICE A/.test(line));
  if (start < 0 || end < 0) throw new Error("Missing PHB spell chapter boundaries");
  const listEntries = [];
  let classKey = null; let level = null;
  for (let index = 0; index < start; index++) {
    const line = lines[index].trim();
    const classMatch = /^### INCANTESIMI DA (BARDO|CHIERICO|DRUIDO|MAGO|PALADINO|RANGER|STREGONE|WARLOCK)(?: \(CONTINUA\))?$/.exec(line);
    if (classMatch) { classKey = classes[classMatch[1]]; level = null; continue; }
    if (!classKey) continue;
    const levelMatch = /^#### (?:Trucchetti \(livello 0\)|([1-9])° livello)/.exec(line);
    if (levelMatch) { level = Number(levelMatch[1] ?? 0); continue; }
    const spellMatch = /^- (?!\*\*)(.+)$/.exec(line);
    if (spellMatch && level !== null) listEntries.push({ classKey, name: spellMatch[1].trim(), level, line: index + 1, page: pages[index] });
  }
  const wanted = new Map();
  for (const entry of listEntries) { const nameKey = key(entry.name); if (!wanted.has(nameKey)) wanted.set(nameKey, []); wanted.get(nameKey).push(entry); }
  const headings = [];
  for (let index = start + 1; index < end; index++) {
    const match = /^(?:#{2,3}\s+)+(.+)$/.exec(lines[index]);
    if (match && wanted.has(key(match[1]))) headings.push({ index, name: match[1] });
  }
  const sections = headings.map(({ index, name }, position) => ({ name, index, endIndex: headings[position + 1]?.index ?? end, text: lines.slice(index + 1, headings[position + 1]?.index ?? end).join("\n").trim() }));
  const spells = [];
  for (const [nameKey, entries] of wanted) {
    const matches = sections.filter((section) => key(section.name) === nameKey);
    if (matches.length !== 1) throw new Error(`Expected one description for ${entries[0].name}; found ${matches.length}`);
    const section = matches[0];
    const first = section.text.split(/\n/).find((line) => line.trim())?.replace(/\*/g, "") ?? "";
    const school = schools.find((name) => first.toLocaleLowerCase("it").includes(name.toLocaleLowerCase("it")));
    const levels = [...new Set(entries.map((entry) => entry.level))];
    if (levels.length !== 1) throw new Error(`Conflicting class-list levels for ${entries[0].name}: ${levels}`);
    const metadata = first.split(/Tempo\s+(?:di|dl)\s+Lancio/i)[0].trim();
    const metadataLevel = /Trucchetto/i.test(metadata) ? 0 : Number(/di\s+([1-9])[^a-z0-9]*\s+livello/i.exec(metadata)?.[1] ?? NaN);
    const warnings = school ? [] : ["School unreadable in source metadata"];
    if (!Number.isFinite(metadataLevel)) warnings.push("Description level unreadable; level verified from class lists");
    else if (metadataLevel !== levels[0]) warnings.push(`Description level ${metadataLevel} conflicts with class-list level ${levels[0]}`);
    const description = section.text.split(/\n/).filter((line) => !/^---\s*$|^<a id=|^<!-- Pagina PDF/.test(line)).join("\n").trim();
    spells.push({ id: `phb2014:spell:${slug(entries[0].name)}`, name: entries[0].name, label: entries[0].name, aliases: [...new Set([section.name, ...entries.map((entry) => entry.name), ...Object.keys(nameAliases).filter((alias) => nameAliases[alias] === nameKey)])], level: levels[0], school: school ?? null, ritual: /\(rituale\)/i.test(metadata), attack_roll: /attacco (?:in mischia|a distanza) con questo incantesimo/i.test(description), description, metadataText: metadata, source: { path: sourcePath, line: section.index + 1, endLine: section.endIndex, page: pages[section.index] }, classLists: entries.map(({ classKey, line, page }) => ({ classKey, line, page })), warnings });
  }
  spells.sort((a, b) => a.id.localeCompare(b.id, "en"));
  if (Object.values(classes).some((name) => !listEntries.some((entry) => entry.classKey === name))) throw new Error("A PHB class spell list is missing");
  if (new Set(spells.map((spell) => spell.id)).size !== spells.length) throw new Error("Duplicate stable spell ID");
  return { version: "phb2014-it-v1", source: sourcePath, sourceSha256: createHash("sha256").update(text).digest("hex"), spells };
}

export function projectCreationSpellOptions(catalog) {
  return Object.fromEntries(Object.values(classes).map((classKey) => [classKey,
    catalog.spells.filter((spell) => spell.level <= 1 && spell.classLists.some((entry) => entry.classKey === classKey))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "it"))
      .map(({ id, name, label, level, school, ritual, attack_roll }) => ({ id, name: creationNameOverrides[name] ?? name, label, level, school, ritual, attack_roll })),
  ]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = extractPhbSpellCatalog(readFileSync(resolve(root, sourcePath), "utf8"));
  if (process.argv.includes("--inspect")) console.log(JSON.stringify(catalog.spells.map(({ name, level, metadataText, warnings, attack_roll }) => ({ name, level, metadataText, warnings, attack_roll })), null, 2));
  else {
    const artifacts = { "shared/phb-spell-catalog.json": catalog, "shared/character-creation-spell-options.json": projectCreationSpellOptions(catalog) };
    for (const [path, content] of Object.entries(artifacts)) {
      const generated = `${JSON.stringify(content, null, 2)}\n`;
      if (process.argv.includes("--check")) {
        if (readFileSync(resolve(root, path), "utf8") !== generated) throw new Error(`Generated artifact is stale: ${path}`);
      } else writeFileSync(resolve(root, path), generated, "utf8");
    }
    console.log(`Extracted ${catalog.spells.length} spells (${catalog.spells.filter((spell) => spell.warnings.length).length} metadata warnings)`);
  }
}
