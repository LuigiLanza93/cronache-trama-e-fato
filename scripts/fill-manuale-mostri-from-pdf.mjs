import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const PDF_FILE = path.resolve(repoRoot, "Docs", "Manuale_dei_Mostri_5.0.pdf");
const MONSTER_DIR = path.resolve(repoRoot, "src", "data", "monsters", "custom", "manuale-mostri-5-0");

const CREATURE_TYPE_WORDS = [
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
  "mostruosita",
  "non morto",
  "pianta",
  "umanoide",
  "vegetale",
];

const SIZE_WORDS = ["Minuscola", "Piccola", "Media", "Grande", "Enorme", "Mastodontica"];

const ABILITY_LABELS = [
  ["FOR", "strength"],
  ["DES", "dexterity"],
  ["COS", "constitution"],
  ["INT", "intelligence"],
  ["SAG", "wisdom"],
  ["CAR", "charisma"],
];

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "monster";
}

function toTitleLineName(name = "") {
  return String(name).replace(/\s+/g, " ").trim();
}

function buildSearchTerms(name) {
  const base = toTitleLineName(name);
  const terms = new Set([
    base,
    base.toUpperCase(),
    base.replace(/-/g, " "),
    base.replace(/'/g, "’"),
    base.replace(/’/g, "'"),
  ]);

  if (base === "Thri-kreen") {
    terms.add("Thri kreen");
  }
  if (base === "Artiglio Strisciante") {
    terms.add("ARTIGLIO STRISCIANTE");
  }
  if (base === "Miconide Germoglio") {
    terms.add("MICONIDE GERMOGLIO");
  }
  if (base === "Miconide Adulto") {
    terms.add("MICONIDE ADULTO");
  }
  if (base === "Miconide Sovrano") {
    terms.add("MICONIDE SOVRANO");
  }
  if (base === "Yuan-ti Abominio") {
    terms.add("YUAN-TI ABOMINIO");
    terms.add("YUAN TI ABOMINIO");
  }
  if (base === "Yuan-ti Nefasto") {
    terms.add("YUAN-TI NEFASTO");
    terms.add("YUAN TI NEFASTO");
  }

  return Array.from(terms).map(normalizeText).filter(Boolean);
}

function pageLooksLikeStatLine(line) {
  const normalized = normalizeText(line);
  return (
    SIZE_WORDS.some((size) => normalized.includes(normalizeText(size))) &&
    CREATURE_TYPE_WORDS.some((type) => normalized.includes(normalizeText(type)))
  );
}

function isUpperHeading(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (/^(AZIONI|REAZIONI|AZIONI LEGGENDARIE|AZIONI DI TANA|EFFETTI REGIONALI)$/i.test(trimmed)) return false;
  const letters = (trimmed.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (!letters) return false;
  const uppers = (trimmed.match(/[A-ZÀ-Ý]/g) || []).length;
  return uppers / letters > 0.7;
}

function parseChallenge(challengeLine = "") {
  const match = String(challengeLine).match(/Sfida\s+([0-9/]+)\s+\(([\d\.\,]+)\s*PE\)/i);
  if (!match) {
    return { fraction: "0", decimal: 0, display: "0", xp: 0 };
  }
  const fraction = match[1];
  const xp = Number(match[2].replace(/\./g, "").replace(/,/g, "."));
  let decimal = 0;
  if (fraction === "1/8") decimal = 0.125;
  else if (fraction === "1/4") decimal = 0.25;
  else if (fraction === "1/2") decimal = 0.5;
  else decimal = Number(fraction);
  return { fraction, decimal, display: fraction, xp: Number.isFinite(xp) ? xp : 0 };
}

function parseArmorClass(line = "") {
  const match = String(line).match(/Classe\s+Armatura\s+(\d+)(?:\s*\((.+)\))?/i);
  return {
    value: match ? Number(match[1]) : 10,
    note: match?.[2]?.trim() ?? "",
  };
}

function parseHitPoints(line = "") {
  const match = String(line).match(/Punti\s+Ferita\s+(\d+)\s*\(([^)]+)\)/i);
  return {
    average: match ? Number(match[1]) : 1,
    formula: match?.[2]?.trim() ?? "1d8",
  };
}

function parseSpeed(line = "") {
  const body = String(line).replace(/^Velocit[aà]\s*/i, "").trim();
  const speed = {};
  const parts = body.split(/\s*,\s*/);
  for (const part of parts) {
    const lower = normalizeText(part);
    if (!part) continue;
    if (lower.startsWith("volare") || lower.startsWith("volo")) speed.fly = part.replace(/^(volare|volo)\s*/i, "").trim();
    else if (lower.startsWith("nuotare") || lower.startsWith("nuoto")) speed.swim = part.replace(/^(nuotare|nuoto)\s*/i, "").trim();
    else if (lower.startsWith("scalare") || lower.startsWith("scalata")) speed.climb = part.replace(/^(scalare|scalata)\s*/i, "").trim();
    else if (lower.startsWith("scavare")) speed.burrow = part.replace(/^scavare\s*/i, "").trim();
    else speed.walk = part.trim();
  }
  return Object.keys(speed).length ? speed : { walk: "9 m" };
}

function parseAbilityScores(lines, startIndex) {
  const result = {};
  for (let offset = 0; offset < 20 && startIndex + offset < lines.length; offset += 1) {
    const label = lines[startIndex + offset]?.trim();
    const next = lines[startIndex + offset + 1]?.trim() ?? "";
    const entry = ABILITY_LABELS.find(([key]) => label === key);
    if (!entry) continue;
    const match = next.match(/(\d+)/);
    result[entry[1]] = match ? Number(match[1]) : 10;
  }
  return {
    strength: result.strength ?? 10,
    dexterity: result.dexterity ?? 10,
    constitution: result.constitution ?? 10,
    intelligence: result.intelligence ?? 10,
    wisdom: result.wisdom ?? 10,
    charisma: result.charisma ?? 10,
  };
}

function parseBonusList(line = "") {
  const body = String(line).replace(/^[^ ]+\s+/i, "").trim();
  return body
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.+?)\s*([+-]\d+)$/);
      if (!match) return { name: entry, bonus: 0 };
      return { name: match[1].trim(), bonus: Number(match[2]) };
    });
}

function parseSenses(line = "") {
  const body = String(line).replace(/^Sensi\s+/i, "").trim();
  return body
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.+?)\s+(\d+\s*m(?:\s*\([^)]+\))?)$/i);
      if (match) return { name: match[1].trim(), value: match[2].trim() };
      return { name: entry };
    });
}

function parseLanguages(line = "") {
  const body = String(line).replace(/^(Linguaggi|linguaggi)\s+/i, "").trim();
  if (!body || body === "-") return [];
  return body
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.+?)\s+(\d+\s*m)$/i);
      if (match) return { name: match[1].trim(), value: match[2].trim() };
      return { name: entry };
    });
}

function collectParagraphs(lines) {
  const joined = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return [];
  const chunks = joined
    .split(/(?=(?:[A-ZÀ-Ý][A-Za-zÀ-ÿ'’0-9\/\- ]{1,80}(?:\([^)]+\))?\.\s))/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const firstDot = chunk.indexOf(".");
    if (firstDot === -1) {
      return { name: chunk, usage: null, description: "" };
    }
    const header = chunk.slice(0, firstDot).trim();
    const description = chunk.slice(firstDot + 1).trim();
    let name = header;
    let usage = null;
    const usageMatch = header.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (usageMatch) {
      name = usageMatch[1].trim();
      usage = usageMatch[2].trim();
    }
    return { name, usage, description };
  });
}

function parseMonsterFromPageContent(name, pageNum, pageText) {
  const lines = pageText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const searchTerms = buildSearchTerms(name);
  let titleIndex = lines.findIndex((line, index) => {
    if (index + 1 >= lines.length) return false;
    const normalized = normalizeText(line);
    return searchTerms.includes(normalized) && pageLooksLikeStatLine(lines[index + 1]);
  });

  if (titleIndex === -1) {
    titleIndex = lines.findIndex((line) => searchTerms.includes(normalizeText(line)));
  }
  if (titleIndex === -1 || titleIndex + 1 >= lines.length) return null;

  let statLineIndex = -1;
  for (let i = titleIndex + 1; i < Math.min(titleIndex + 6, lines.length); i += 1) {
    if (pageLooksLikeStatLine(lines[i])) {
      statLineIndex = i;
      break;
    }
  }
  if (statLineIndex === -1) return null;

  let endIndex = lines.length;
  for (let i = statLineIndex + 1; i < lines.length; i += 1) {
    if (isUpperHeading(lines[i]) && normalizeText(lines[i]) !== normalizeText(name)) {
      endIndex = i;
      break;
    }
  }

  const blockLines = lines.slice(titleIndex, endIndex);
  const challengeLine = blockLines.find((line) => /^Sfida\s+/i.test(line)) ?? "Sfida 0 (0 PE)";
  const armorClassLine = blockLines.find((line) => /^Classe\s+Armatura/i.test(line)) ?? "";
  const hitPointsLine = blockLines.find((line) => /^Punti\s+Ferita/i.test(line)) ?? "";
  const speedLine = blockLines.find((line) => /^Velocit/i.test(line)) ?? "";
  const saveLine = blockLines.find((line) => /^Tiri\s+Salvezza/i.test(line)) ?? "";
  const skillLine = blockLines.find((line) => /^Abilit/i.test(line)) ?? "";
  const vulnerabilitiesLine = blockLines.find((line) => /^Vulnerabilit/i.test(line)) ?? "";
  const resistancesLine = blockLines.find((line) => /^Resistenze\s+ai\s+Danni/i.test(line)) ?? "";
  const damageImmunitiesLine = blockLines.find((line) => /^Immunit[aà]\s+ai\s+Danni/i.test(line)) ?? "";
  const conditionImmunitiesLine = blockLines.find((line) => /^Immunit[aà]\s+alle\s+Condizioni/i.test(line)) ?? "";
  const sensesLine = blockLines.find((line) => /^Sensi\s+/i.test(line)) ?? "";
  const languagesLine = blockLines.find((line) => /^Linguaggi\s+/i.test(line)) ?? "";
  const abilityIndex = blockLines.findIndex((line) => line === "FOR");
  const actionsIndex = blockLines.findIndex((line) => /^AZIONI$/i.test(line));
  const reactionsIndex = blockLines.findIndex((line) => /^REAZIONI$/i.test(line));
  const legendaryIndex = blockLines.findIndex((line) => /^AZIONI LEGGENDARIE$/i.test(line));
  const lairIndex = blockLines.findIndex((line) => /^AZIONI DI TANA$/i.test(line));
  const regionalIndex = blockLines.findIndex((line) => /^EFFETTI REGIONALI$/i.test(line));

  const headerLine = blockLines[statLineIndex] ?? "";
  const sizeMatch = headerLine.match(/(Minuscola|Piccola|Media|Grande|Enorme|Mastodontica)/i);
  const size = sizeMatch?.[1] ?? "Media";
  const headerTail = headerLine.replace(sizeMatch?.[0] ?? "", "").trim().replace(/^,?\s*/, "");
  let alignment = "";
  let typeLabel = headerTail;
  const parts = headerTail.split(/\s*,\s*/);
  if (parts.length >= 2) {
    typeLabel = parts[0].trim();
    alignment = parts.slice(1).join(", ").trim();
  }
  const typeNormalized = typeLabel.toLowerCase();
  let creatureType = "";
  let subtype = "";
  const subtypeMatch = typeLabel.match(/^([^(]+)\(([^)]+)\)$/);
  if (subtypeMatch) {
    creatureType = subtypeMatch[1].trim().toLowerCase();
    subtype = subtypeMatch[2].trim().toLowerCase();
  } else {
    creatureType = CREATURE_TYPE_WORDS.find((type) => typeNormalized.includes(type)) ?? typeLabel.toLowerCase();
  }

  const descriptiveStart = blockLines.findIndex((line) => /^[A-ZÀ-Ý].+?\./.test(line));
  const traitsStart = descriptiveStart !== -1 ? descriptiveStart : Math.max((abilityIndex !== -1 ? abilityIndex + 12 : 0), blockLines.findIndex((line) => /^Sfida\s+/i.test(line)) + 1);
  const preActionLines = actionsIndex === -1 ? [] : blockLines.slice(Math.max(0, traitsStart), actionsIndex).filter((line) => !/^(Classe Armatura|Punti Ferita|Velocit|FOR|DES|COS|INT|SAG|CAR|Tiri Salvezza|Abilit|Sensi|Linguaggi|Sfida|Vulnerabilit|Resistenze|Immunit)/i.test(line));
  const actionsLines = actionsIndex === -1 ? [] : blockLines.slice(actionsIndex + 1, reactionsIndex !== -1 ? reactionsIndex : legendaryIndex !== -1 ? legendaryIndex : lairIndex !== -1 ? lairIndex : regionalIndex !== -1 ? regionalIndex : blockLines.length);
  const reactionsLines = reactionsIndex === -1 ? [] : blockLines.slice(reactionsIndex + 1, legendaryIndex !== -1 ? legendaryIndex : lairIndex !== -1 ? lairIndex : regionalIndex !== -1 ? regionalIndex : blockLines.length);
  const legendaryLines = legendaryIndex === -1 ? [] : blockLines.slice(legendaryIndex + 1, lairIndex !== -1 ? lairIndex : regionalIndex !== -1 ? regionalIndex : blockLines.length);
  const lairLines = lairIndex === -1 ? [] : blockLines.slice(lairIndex + 1, regionalIndex !== -1 ? regionalIndex : blockLines.length);
  const regionalLines = regionalIndex === -1 ? [] : blockLines.slice(regionalIndex + 1);

  return {
    page: pageNum,
    rawText: blockLines.join("\n"),
    general: {
      name,
      challengeRating: parseChallenge(challengeLine),
      size,
      creatureType,
      subtype,
      typeLabel,
      alignment,
      environments: [],
    },
    combat: {
      armorClass: parseArmorClass(armorClassLine),
      hitPoints: parseHitPoints(hitPointsLine),
      speed: parseSpeed(speedLine),
    },
    abilities: abilityIndex !== -1 ? parseAbilityScores(blockLines, abilityIndex) : {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    details: {
      savingThrows: saveLine ? parseBonusList(saveLine) : [],
      skills: skillLine ? parseBonusList(skillLine) : [],
      damageVulnerabilities: vulnerabilitiesLine ? vulnerabilitiesLine.replace(/^Vulnerabilit[aà]\s+ai\s+Danni\s+/i, "").split(/\s*,\s*/).filter(Boolean) : [],
      damageResistances: resistancesLine ? resistancesLine.replace(/^Resistenze\s+ai\s+Danni\s+/i, "").split(/\s*;\s*|\s*,\s*/).filter(Boolean) : [],
      damageImmunities: damageImmunitiesLine ? damageImmunitiesLine.replace(/^Immunit[aà]\s+ai\s+Danni\s+/i, "").split(/\s*;\s*|\s*,\s*/).filter(Boolean) : [],
      conditionImmunities: conditionImmunitiesLine ? conditionImmunitiesLine.replace(/^Immunit[aà]\s+alle\s+Condizioni\s+/i, "").split(/\s*,\s*/).filter(Boolean) : [],
      senses: sensesLine ? parseSenses(sensesLine) : [],
      languages: languagesLine ? parseLanguages(languagesLine) : [],
      proficiencyBonus: Math.max(2, Math.ceil(((parseChallenge(challengeLine).decimal || 0) + 7) / 4)),
    },
    traits: collectParagraphs(preActionLines),
    actions: collectParagraphs(actionsLines),
    bonusActions: [],
    reactions: collectParagraphs(reactionsLines),
    legendaryActions: {
      description: legendaryLines.length ? legendaryLines[0] : "",
      actions: legendaryLines.length ? collectParagraphs(legendaryLines.slice(1)) : [],
    },
    lairActions: collectParagraphs(lairLines),
    regionalEffects: regionalLines,
    notes: [],
  };
}

function mergeMonsterData(current, parsed) {
  if (!parsed) return current;
  return {
    ...current,
    general: parsed.general,
    combat: parsed.combat,
    abilities: parsed.abilities,
    details: parsed.details,
    traits: parsed.traits,
    actions: parsed.actions,
    bonusActions: parsed.bonusActions,
    reactions: parsed.reactions,
    legendaryActions: parsed.legendaryActions,
    lairActions: parsed.lairActions,
    regionalEffects: parsed.regionalEffects,
    notes: parsed.notes,
    source: {
      ...(current.source ?? {}),
      extractedFrom: "Manuale_dei_Mostri_5.0.pdf",
      rawText: parsed.rawText,
      page: parsed.page,
      importCategory: current.source?.importCategory ?? "manual-only",
      possibleDuplicateOf: current.source?.possibleDuplicateOf ?? null,
      autoParsedFromPdf: true,
    },
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const parser = new PDFParse({ data: fs.readFileSync(PDF_FILE) });
  const textResult = await parser.getText({});
  await parser.destroy();

  const pages = textResult.pages.map((page) => ({
    num: page.num,
    text: page.text,
    normalizedLines: page.text.split(/\r?\n/).map((line) => normalizeText(line)).filter(Boolean),
  }));

  const files = fs.readdirSync(MONSTER_DIR).filter((file) => file.endsWith(".json")).sort();
  const summary = {
    total: files.length,
    updated: 0,
    skipped: 0,
    notFound: [],
  };

  for (const file of files) {
    const fullPath = path.join(MONSTER_DIR, file);
    const current = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const alreadyParsed = current?.source?.autoParsedFromPdf;
    const alreadyCompletedManually =
      current?.source?.page &&
      typeof current?.source?.rawText === "string" &&
      !current.source.rawText.includes("Scheda placeholder");
    if ((alreadyParsed || alreadyCompletedManually) && !force) {
      summary.skipped += 1;
      continue;
    }

    const name = current?.general?.name ?? path.basename(file, ".json");
    const searchTerms = buildSearchTerms(name);
    const candidatePage = pages.find((page) =>
      page.normalizedLines.some((line) => searchTerms.includes(line))
    );

    if (!candidatePage) {
      summary.notFound.push(name);
      continue;
    }

    const parsed = parseMonsterFromPageContent(name, candidatePage.num, candidatePage.text);
    if (!parsed) {
      summary.notFound.push(name);
      continue;
    }

    const merged = mergeMonsterData(current, parsed);
    fs.writeFileSync(fullPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
    summary.updated += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
