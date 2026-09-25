import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/convert-player-handbook-pdf.mjs <input.pdf> <output.md>");
  process.exit(1);
}

const pageMarker = /^--\s+(\d+)\s+of\s+(\d+)\s+--$/;
const romanOrNumberedHeading = /^(?:\d+\.|[IVXLCDM]+\.)\s+\S/;
const likelyFooter = /^(?:CAPITOLO|PARTE|APPENDICE|INTRODUZIONE|PREFAZIONE)\b.*(?:\d+)?$/i;
const bulletLine = /^[•●▪◦]\s*/;
const replacementCharacter = /�/g;

function normalizeLine(line) {
  return line
    .replace(/\u00ad/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(replacementCharacter, "�");
}

function isAllCapsHeading(line) {
  if (line.length < 3 || line.length > 90) return false;
  if (/^[\d\W_]+$/u.test(line)) return false;
  const letters = line.match(/\p{L}/gu) ?? [];
  if (letters.length < 3) return false;
  const uppercase = letters.filter((letter) => letter === letter.toLocaleUpperCase("it-IT"));
  const words = line.split(/\s+/).filter(Boolean);
  return uppercase.length / letters.length >= 0.92 && words.length <= 7;
}

function headingLevel(line) {
  if (/^(?:PARTE\s+[\dIVXLCDM]+|CAPITOLO\s+[\dIVXLCDM]+|APPENDICE\s+[A-Z])\b/i.test(line)) return 2;
  if (/^(?:PREFAZIONE|INTRODUZIONE|INDICE|SCHEDA DEL PERSONAGGIO)$/i.test(line)) return 2;
  if (romanOrNumberedHeading.test(line)) return 3;
  return 3;
}

function shouldJoin(previous, current) {
  if (!previous || !current) return false;
  if (/^(?:#{1,6}|[-*+] |>|\|)/.test(previous) || /^(?:#{1,6}|[-*+] |>|\|)/.test(current)) return false;
  if (/^[A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙ\d\s'’.,:;()&/-]{2,}$/u.test(current)) return false;
  if (/^[\d]+[.)]\s/.test(current)) return false;
  if (/[:.!?…]$/.test(previous)) return false;
  return true;
}

function formatPage(rawLines, pageNumber) {
  const normalized = rawLines.map(normalizeLine);
  const nonEmpty = normalized.filter(Boolean);

  // Running headers and footers repeat the chapter title close to page edges.
  const body = normalized.filter((line, index) => {
    if (!line) return true;
    const nearBottom = index >= normalized.length - 4;
    if (nearBottom && /^\d{1,3}$/.test(line)) return false;
    if (nearBottom && likelyFooter.test(line) && line.length > 12) return false;
    return true;
  });

  const blocks = [];
  let paragraph = "";
  const flush = () => {
    if (paragraph) blocks.push(paragraph.trim());
    paragraph = "";
  };

  for (let index = 0; index < body.length; index += 1) {
    const line = body[index];
    if (!line) {
      flush();
      continue;
    }

    if (bulletLine.test(line)) {
      flush();
      blocks.push(`- ${line.replace(bulletLine, "")}`);
      continue;
    }

    if (isAllCapsHeading(line)) {
      flush();
      blocks.push(`${"#".repeat(headingLevel(line))} ${line.replace(/[-_\s]+$/g, "")}`);
      continue;
    }

    if (/^\d+[.)]\s+\S/.test(line)) {
      flush();
      blocks.push(line.replace(/^(\d+)[.)]\s+/, "$1. "));
      continue;
    }

    if (paragraph && shouldJoin(paragraph, line)) {
      paragraph = paragraph.endsWith("-")
        ? `${paragraph.slice(0, -1)}${line.charAt(0).toLocaleLowerCase("it-IT")}${line.slice(1)}`
        : `${paragraph} ${line}`;
    } else {
      flush();
      paragraph = line;
    }
  }
  flush();

  while (blocks.length && !blocks[0]) blocks.shift();
  while (blocks.length && !blocks.at(-1)) blocks.pop();

  return [
    `<a id="pagina-${pageNumber}"></a>`,
    `<!-- Pagina PDF ${pageNumber} -->`,
    "",
    ...blocks,
  ].join("\n");
}

const parser = new PDFParse({ url: inputPath });
let result;
try {
  result = await parser.getText();
} finally {
  await parser.destroy();
}

const pages = result.pages.map((page, index) => {
  const rawLines = page.text.split(/\r?\n/);
  return formatPage(rawLines, index + 1);
});

const title = path.basename(inputPath, path.extname(inputPath)).replaceAll("_", " ");
const pageLinks = Array.from({ length: pages.length }, (_, index) => {
  const page = index + 1;
  return `[${page}](#pagina-${page})`;
});
const pageRows = [];
for (let index = 0; index < pageLinks.length; index += 20) {
  pageRows.push(pageLinks.slice(index, index + 20).join(" · "));
}

const header = [
  `# ${title}`,
  "",
  `> Conversione automatica in Markdown da \`${path.basename(inputPath)}\` (${pages.length} pagine).`,
  "> Il PDF sorgente usa OCR: il testo conserva eventuali refusi e caratteri non riconosciuti, indicati con `�`.",
  "> Tabelle, colonne e riquadri complessi possono richiedere revisione rispetto all'impaginato originale.",
  "",
  "## Navigazione per pagina PDF",
  "",
  ...pageRows,
  "",
  "---",
  "",
].join("\n");

fs.writeFileSync(outputPath, `${header}${pages.join("\n\n---\n\n")}\n`, "utf8");
console.log(JSON.stringify({ inputPath, outputPath, pages: pages.length, bytes: fs.statSync(outputPath).size }));
