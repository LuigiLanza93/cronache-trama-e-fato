import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const pdfPath = path.resolve(projectRoot, "src/data/monsters/srd05_13_bestiario.pdf");
const outputDir = path.resolve(projectRoot, "src/data/monsters/srd-extracted");
const indexPath = path.resolve(outputDir, "_index.json");

const SIZE_WORDS = [
  "Minuscola",
  "Minuscolo",
  "Piccola",
  "Piccolo",
  "Media",
  "Medio",
  "Grande",
  "Enorme",
  "Mastodontica",
  "Mastodontico",
];
const SIZE_LABEL_PATTERN = `(${SIZE_WORDS.join("|")})`;
const SIZE_PATTERN = new RegExp(`^${SIZE_LABEL_PATTERN}\\s`, "i");
const PAGE_MARKER_PATTERN = /^--\s*\d+\s+of\s+\d+\s*--$/i;
const BOOK_HEADER_PATTERN = /^SRD Italia 5a Edizione - Compendio dei Mostri$/i;
const SECTION_HEADERS = [
  "Azioni",
  "Azioni Bonus",
  "Reazioni",
  "Azioni Leggendarie",
  "Azioni di Tana",
  "Effetti Regionali",
];
const ABILITY_KEYS = [
  ["FORZA", "strength"],
  ["DESTREZZA", "dexterity"],
  ["COSTITUZIONE", "constitution"],
  ["INTELLIGENZA", "intelligence"],
  ["SAGGEZZA", "wisdom"],
  ["CARISMA", "charisma"],
];
const BAD_HEADER_PREFIXES = [
  "Taglia ",
  "Che ",
  "Quando ",
  "Una ",
  "Un ",
  "Se ",
  "Ogni ",
  "Il ",
  "La ",
  "Gli ",
  "Le ",
];
const MOJIBAKE_PATTERN = /(?:Ã.|â.|Â.)/;
const LOWERCASE_NAME_CONNECTORS = new Set([
  "a",
  "al",
  "allo",
  "ai",
  "agli",
  "alla",
  "alle",
  "da",
  "dal",
  "dallo",
  "dai",
  "dagli",
  "dalla",
  "dalle",
  "de",
  "del",
  "dello",
  "dei",
  "degli",
  "della",
  "delle",
  "di",
  "e",
  "ed",
  "il",
  "la",
  "le",
  "lo",
  "o",
  "su",
]);
const MOJIBAKE_REPLACEMENTS = [
  ["Ã€", "À"],
  ["Ãˆ", "È"],
  ["Ã‰", "É"],
  ["ÃŒ", "Ì"],
  ["Ã’", "Ò"],
  ["Ã™", "Ù"],
  ["Ã ", "à"],
  ["Ã¡", "á"],
  ["Ã¨", "è"],
  ["Ã©", "é"],
  ["Ã¬", "ì"],
  ["Ã²", "ò"],
  ["Ã³", "ó"],
  ["Ã¹", "ù"],
  ["Ãº", "ú"],
  ["Ã§", "ç"],
  ["Â°", "°"],
  ["Âº", "º"],
  ["Â", ""],
  ["â€™", "'"],
  ["â€˜", "'"],
  ['â€œ', '"'],
  ['â€\u009d', '"'],
  ["â€“", "-"],
  ["â€”", "-"],
  ["â€¦", "..."],
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  ensureDir(dirPath);
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    fs.unlinkSync(entryPath);
  }
}

function maybeFixMojibake(text) {
  if (!MOJIBAKE_PATTERN.test(text)) return text;
  const repaired = Buffer.from(text, "latin1").toString("utf8");
  return repaired.includes("�") ? text : repaired;
}

function normalizeText(text) {
  let normalized = maybeFixMojibake(String(text))
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\t/g, " ");

  for (const [search, replacement] of MOJIBAKE_REPLACEMENTS) {
    normalized = normalized.replaceAll(search, replacement);
  }

  return normalized.replace(/ +/g, " ");
}

function cleanLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toDecimalChallenge(value) {
  const normalized = String(value).trim();
  if (normalized.includes("/")) {
    const [num, den] = normalized.split("/").map(Number);
    if (num && den) return num / den;
  }

  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseChallengeXp(raw) {
  return Number(String(raw).replace(/\./g, "").replace(/,/g, ""));
}

function splitCommaListPreservingSemicolons(value) {
  return String(value)
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBonusEntries(value, mode) {
  return splitCommaListPreservingSemicolons(value).map((entry) => {
    const match = entry.match(/^(.*?)\s*([+-]\d+)$/);
    if (!match) {
      return mode === "skills"
        ? { name: entry, bonus: 0 }
        : { ability: entry, bonus: 0 };
    }

    return mode === "skills"
      ? { name: match[1].trim(), bonus: Number(match[2]) }
      : { ability: match[1].trim(), bonus: Number(match[2]) };
  });
}

function parseTaggedList(value) {
  return splitCommaListPreservingSemicolons(value).map((entry) => {
    const match = entry.match(/^(.*?)(\d+(?:,\d+)?\s*m)$/i);
    if (!match) return { name: entry };
    return {
      name: match[1].trim().replace(/[,:;]$/, ""),
      value: match[2].trim(),
    };
  });
}

function parseSpeedEntries(value) {
  const entries = {};

  for (const rawEntry of splitCommaListPreservingSemicolons(value)) {
    const entry = rawEntry.trim();
    const lower = entry.toLowerCase();

    if (lower.startsWith("nuoto ")) {
      entries.swim = entry.replace(/^nuoto\s+/i, "");
      continue;
    }
    if (lower.startsWith("volare ") || lower.startsWith("volo ")) {
      entries.fly = entry.replace(/^(volare|volo)\s+/i, "");
      continue;
    }
    if (lower.startsWith("scalata ") || lower.startsWith("arrampicarsi ")) {
      entries.climb = entry.replace(/^(scalata|arrampicarsi)\s+/i, "");
      continue;
    }
    if (lower.startsWith("scavo ")) {
      entries.burrow = entry.replace(/^scavo\s+/i, "");
      continue;
    }

    entries.walk = entry;
  }

  return entries;
}

function extractLineValue(lines, labelPattern) {
  for (const line of lines) {
    const match = line.match(labelPattern);
    if (match) return match[1].trim();
  }
  return "";
}

function isSectionHeader(line) {
  return SECTION_HEADERS.includes(line);
}

function isLikelyEntryStart(line) {
  if (!line) return false;
  if (isSectionHeader(line)) return false;
  if (/^(Colpisce|Fallimento|Successo|A volontà|Al giorno|1\/giorno|2\/giorno|3\/giorno|Bonus|CD)\b/i.test(line)) return false;

  const match = line.match(/^([A-ZÀ-ÖØ-Ý][^.]{1,90}?)(?:\s*\(([^)]+)\))?\.\s*(.*)$/);
  if (!match) return false;

  const title = match[1].trim();
  if (title.length < 2) return false;
  if (/:$/.test(title)) return false;
  return true;
}

function parseEntryLines(lines) {
  const items = [];
  let current = null;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (isSectionHeader(line)) continue;

    const match = line.match(/^([A-ZÀ-ÖØ-Ý][^.]{1,90}?)(?:\s*\(([^)]+)\))?\.\s*(.*)$/);
    if (match && isLikelyEntryStart(line)) {
      if (current) {
        current.description = current.description.trim();
        items.push(current);
      }

      current = {
        name: match[1].trim(),
        usage: match[2]?.trim() ?? null,
        description: match[3]?.trim() ?? "",
      };
      continue;
    }

    if (!current) {
      current = {
        name: "Voce",
        usage: null,
        description: line,
      };
      continue;
    }

    current.description = `${current.description} ${line}`.trim();
  }

  if (current) {
    current.description = current.description.trim();
    items.push(current);
  }

  return items.filter((item) => item.name !== "Voce" || item.description);
}

function parseLegendaryActions(lines) {
  if (lines.length === 0) {
    return {
      description: "",
      actions: [],
    };
  }

  let splitIndex = lines.findIndex((line) => isLikelyEntryStart(cleanLine(line)));
  if (splitIndex < 0) splitIndex = lines.length;

  const description = lines
    .slice(0, splitIndex)
    .map(cleanLine)
    .filter(Boolean)
    .join(" ")
    .trim();

  const actions = parseEntryLines(lines.slice(splitIndex)).map((item) => {
    const costMatch = item.name.match(/^(.*)\(Costa\s+(\d+)\s+Azioni?\)$/i);
    const usageCostMatch = item.usage?.match(/^Costa\s+(\d+)\s+Azioni?$/i);
    return {
      name: costMatch ? costMatch[1].trim() : item.name,
      description: item.description,
      cost: costMatch ? Number(costMatch[2]) : usageCostMatch ? Number(usageCostMatch[1]) : 1,
    };
  });

  return {
    description,
    actions,
  };
}

function getSectionSlices(lines) {
  const sectionIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isSectionHeader(line));

  const sections = {};

  for (let i = 0; i < sectionIndexes.length; i += 1) {
    const current = sectionIndexes[i];
    const next = sectionIndexes[i + 1];
    sections[current.line] = lines
      .slice(current.index + 1, next ? next.index : undefined)
      .map(cleanLine)
      .filter(Boolean);
  }

  return sections;
}

function getTraitLines(lines, firstSectionIndex) {
  const challengeIndex = lines.findIndex((line) => /^Sfida\s+/i.test(line));
  if (challengeIndex < 0) return [];

  const endIndex = firstSectionIndex >= 0 ? firstSectionIndex : lines.length;
  return lines
    .slice(challengeIndex + 1, endIndex)
    .map(cleanLine)
    .filter(Boolean);
}

function parseAbilities(lines) {
  return Object.fromEntries(
    ABILITY_KEYS.map(([label, key]) => {
      const line = lines.find((entry) => new RegExp(`^${label}\\s+`, "i").test(entry));
      const match = line?.match(new RegExp(`^${label}\\s+(\\d+)\\s+\\([^)]+\\)$`, "i"));
      return [key, match ? Number(match[1]) : 10];
    })
  );
}

function parseMonsterBlock(name, block) {
  const lines = block
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !PAGE_MARKER_PATTERN.test(line) && !BOOK_HEADER_PATTERN.test(line));

  const classification = lines[1] ?? "";
  const classMatch = classification.match(
    new RegExp(`^${SIZE_LABEL_PATTERN}\\s+(.*?),\\s*(.*)$`, "i")
  );
  const size = classMatch?.[1] ?? "";
  const typeLabel = classMatch?.[2]?.trim() ?? "";
  const alignment = classMatch?.[3]?.trim() ?? "";
  const subtypeMatch = typeLabel.match(/^(.*?)\s*\((.*?)\)$/);

  const armorClassLine = extractLineValue(lines, /^Classe Armatura\s+(.+)$/i);
  const armorClassMatch = armorClassLine.match(/^(\d+)(?:\s*\(([^)]+)\))?$/i);
  const hitPointsLine = extractLineValue(lines, /^Punti Ferita\s+(.+)$/i);
  const hitPointsMatch = hitPointsLine.match(/^(\d+)\s*\(([^)]+)\)$/i);
  const speedLine = extractLineValue(lines, /^Velocità\s+(.+)$/i);
  const challengeLine = extractLineValue(lines, /^Sfida\s+(.+)$/i);
  const challengeMatch = challengeLine.match(/^([^\s]+)\s+\(([\d.,]+)\s*PE\)$/i);

  const firstSectionIndex = lines.findIndex((line) => isSectionHeader(line));
  const sections = getSectionSlices(lines);

  const traits = parseEntryLines(getTraitLines(lines, firstSectionIndex));
  const actions = parseEntryLines(sections["Azioni"] ?? []);
  const bonusActions = parseEntryLines(sections["Azioni Bonus"] ?? []);
  const reactions = parseEntryLines(sections["Reazioni"] ?? []);
  const legendaryActions = parseLegendaryActions(sections["Azioni Leggendarie"] ?? []);
  const lairActions = parseEntryLines(sections["Azioni di Tana"] ?? []);
  const regionalEffects = parseEntryLines(sections["Effetti Regionali"] ?? []);

  const challengeFraction = challengeMatch?.[1] ?? "";
  const proficiencyBonus = challengeFraction
    ? Math.max(2, Math.ceil((toDecimalChallenge(challengeFraction) ?? 1) / 4) + 1)
    : 2;

  return {
    slug: slugify(name),
    general: {
      name,
      challengeRating: {
        fraction: challengeFraction,
        decimal: toDecimalChallenge(challengeFraction),
        display: challengeFraction,
        xp: challengeMatch ? parseChallengeXp(challengeMatch[2]) : 0,
      },
      size,
      creatureType: subtypeMatch ? subtypeMatch[1].trim() : typeLabel,
      subtype: subtypeMatch ? subtypeMatch[2].trim() : "",
      typeLabel,
      alignment,
      environments: [],
    },
    combat: {
      armorClass: {
        value: armorClassMatch ? Number(armorClassMatch[1]) : 0,
        note: armorClassMatch?.[2]?.trim() ?? "",
      },
      hitPoints: {
        average: hitPointsMatch ? Number(hitPointsMatch[1]) : 0,
        formula: hitPointsMatch?.[2]?.trim() ?? "",
      },
      speed: parseSpeedEntries(speedLine),
    },
    abilities: parseAbilities(lines),
    details: {
      savingThrows: extractLineValue(lines, /^Tiri Salvezza\s+(.+)$/i)
        ? parseBonusEntries(extractLineValue(lines, /^Tiri Salvezza\s+(.+)$/i), "savingThrows")
        : [],
      skills: extractLineValue(lines, /^Abilità\s+(.+)$/i)
        ? parseBonusEntries(extractLineValue(lines, /^Abilità\s+(.+)$/i), "skills")
        : [],
      damageVulnerabilities: extractLineValue(lines, /^Vulnerabilità (?:ai Danni|al Danno)\s+(.+)$/i)
        ? splitCommaListPreservingSemicolons(extractLineValue(lines, /^Vulnerabilità (?:ai Danni|al Danno)\s+(.+)$/i))
        : [],
      damageResistances: extractLineValue(lines, /^Resistenze (?:ai Danni|al Danno)\s+(.+)$/i)
        ? splitCommaListPreservingSemicolons(extractLineValue(lines, /^Resistenze (?:ai Danni|al Danno)\s+(.+)$/i))
        : [],
      damageImmunities: extractLineValue(lines, /^Immunità (?:ai Danni|al Danno)\s+(.+)$/i)
        ? splitCommaListPreservingSemicolons(extractLineValue(lines, /^Immunità (?:ai Danni|al Danno)\s+(.+)$/i))
        : [],
      conditionImmunities: extractLineValue(lines, /^Immunità alle Condizioni\s+(.+)$/i)
        ? splitCommaListPreservingSemicolons(extractLineValue(lines, /^Immunità alle Condizioni\s+(.+)$/i))
        : [],
      senses: extractLineValue(lines, /^Sensi\s+(.+)$/i)
        ? parseTaggedList(extractLineValue(lines, /^Sensi\s+(.+)$/i))
        : [],
      languages: extractLineValue(lines, /^Linguaggi\s+(.+)$/i)
        ? parseTaggedList(extractLineValue(lines, /^Linguaggi\s+(.+)$/i))
        : [],
      proficiencyBonus,
    },
    traits,
    actions,
    bonusActions,
    reactions,
    legendaryActions,
    lairActions,
    regionalEffects,
    notes: [],
    source: {
      extractedFrom: path.basename(pdfPath),
      rawText: block.trim(),
    },
  };
}

function isLikelyMonsterName(name) {
  if (!name) return false;
  if (name.length > 70) return false;
  if (/[.:;]/.test(name)) return false;
  if (/\d/.test(name) && !/^\d+\/giorno$/i.test(name)) return false;
  if (PAGE_MARKER_PATTERN.test(name) || BOOK_HEADER_PATTERN.test(name)) return false;
  if (/^[a-zàèéìòù]/.test(name)) return false;
  if (BAD_HEADER_PREFIXES.some((prefix) => name.startsWith(prefix))) return false;

  const words = name.split(/\s+/);
  if (words.length > 7) return false;

  const cleanedWords = words.map((word) => word.replace(/[(),]/g, ""));
  for (const word of cleanedWords) {
    if (!word) continue;
    if (LOWERCASE_NAME_CONNECTORS.has(word.toLowerCase())) continue;
    if (/^[dl]'[A-ZÀ-ÖØ-Ý]/.test(word)) continue;
    if (/^[A-ZÀ-ÖØ-Ý]/.test(word)) continue;
    if (/^\(.*\)$/.test(word)) continue;
    if (/^[A-ZÀ-ÖØ-Ý]+\/[A-ZÀ-ÖØ-Ý]+$/.test(word)) continue;
    return false;
  }

  return true;
}

function blockLooksLikeMonster(lines, startIndex) {
  const slice = lines.slice(startIndex, startIndex + 24);
  const hasAc = slice.some((line) => /^Classe Armatura\s+/i.test(line));
  const hasHp = slice.some((line) => /^Punti Ferita\s+/i.test(line));
  const hasChallenge = slice.some((line) => /^Sfida\s+/i.test(line));
  return hasAc && hasHp && hasChallenge;
}

function isLikelyNameFragment(line) {
  if (!line) return false;
  if (/[.:;]/.test(line)) return false;
  if (/\d/.test(line)) return false;
  if (PAGE_MARKER_PATTERN.test(line) || BOOK_HEADER_PATTERN.test(line)) return false;
  if (SIZE_PATTERN.test(line)) return false;
  return /^[A-ZÀ-ÖØ-Ý(]/.test(line);
}

function buildMonsterName(lines, sizeIndex) {
  const previous = [
    { index: sizeIndex - 1, text: cleanLine(lines[sizeIndex - 1] ?? "") },
    { index: sizeIndex - 2, text: cleanLine(lines[sizeIndex - 2] ?? "") },
    { index: sizeIndex - 3, text: cleanLine(lines[sizeIndex - 3] ?? "") },
  ];

  const primary = previous[0];
  if (!isLikelyMonsterName(primary.text) && !/^\(.*\)$/.test(primary.text)) {
    const fallback = previous.find((entry) => isLikelyMonsterName(entry.text));
    return fallback ? { name: fallback.text, index: fallback.index } : null;
  }

  if (/^\(.*\)$/.test(primary.text) && isLikelyNameFragment(previous[1]?.text)) {
    return {
      name: `${previous[1].text} ${primary.text}`.trim(),
      index: previous[1].index,
    };
  }

  if (
    isLikelyNameFragment(previous[1]?.text) &&
    (previous[1].text.match(/\b(di|del|della|delle|degli|dei|d')$/i) ||
      (primary.text.split(/\s+/).length === 1 && previous[1].text.split(/\s+/).length >= 2))
  ) {
    return {
      name: `${previous[1].text} ${primary.text}`.trim(),
      index: previous[1].index,
    };
  }

  if (isLikelyMonsterName(primary.text)) {
    return {
      name: primary.text,
      index: primary.index,
    };
  }

  return null;
}

function findMonsterHeaders(lines) {
  const headers = [];

  for (let i = 0; i < lines.length; i += 1) {
    const classification = cleanLine(lines[i]);
    if (!SIZE_PATTERN.test(classification)) continue;

    const candidate = buildMonsterName(lines, i);
    if (!candidate) continue;
    if (!isLikelyMonsterName(candidate.name)) continue;
    if (!blockLooksLikeMonster(lines, candidate.index)) continue;

    headers.push(candidate);
  }

  return headers.filter((header, index, array) => index === 0 || header.index !== array[index - 1].index);
}

async function main() {
  resetDir(outputDir);

  const dataBuffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  await parser.destroy();

  const rawText = normalizeText(result.text);
  const lines = rawText.split("\n").map(cleanLine);
  const headers = findMonsterHeaders(lines);

  const monsters = [];
  const names = [];

  for (let i = 0; i < headers.length; i += 1) {
    const current = headers[i];
    const next = headers[i + 1];
    const blockLines = lines.slice(current.index, next ? next.index : undefined);

    while (blockLines.length > 0) {
      const tail = cleanLine(blockLines[blockLines.length - 1]);
      if (!tail || PAGE_MARKER_PATTERN.test(tail) || BOOK_HEADER_PATTERN.test(tail)) {
        blockLines.pop();
        continue;
      }
      if (/^[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ' ]{1,30}$/.test(tail) && !SIZE_PATTERN.test(tail) && !/^Azioni/i.test(tail)) {
        blockLines.pop();
        continue;
      }
      break;
    }

    const block = blockLines.join("\n").trim();
    if (!block) continue;

    const monster = parseMonsterBlock(current.name, block);
    monsters.push(monster);
    names.push(monster.general.name);

    fs.writeFileSync(path.join(outputDir, `${monster.slug}.json`), JSON.stringify(monster, null, 2) + "\n", "utf-8");
  }

  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        source: path.basename(pdfPath),
        generatedAt: new Date().toISOString(),
        count: monsters.length,
        names,
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  console.log(`Estratti ${monsters.length} mostri in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
