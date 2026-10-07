/** Read-only index of all twelve class progression tables in the local PHB. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const path = resolve(fileURLToPath(new URL("../docs/Manuale_del_Giocatore_5.0.md", import.meta.url)));
const lines = readFileSync(path, "utf8").split(/\r?\n/);
const names = ["BARBARO", "BARDO", "CHIERICO", "DRUIDO", "GUERRIERO", "LADRO", "MAGO", "MONACO", "PALADINO", "RANGER", "STREGONE", "WARLOCK"];
const result = {};
for (const name of names) {
  const headings = lines.flatMap((line, index) => line.trim() === `### ${name}` ? [index] : []);
  const tableAt = headings.map((index) => lines.findIndex((line, at) => at > index && at < index + 100 && /^\| Livello \| Bonus di Competenza \|/.test(line)))
    .find((index) => index >= 0);
  if (tableAt === undefined) throw new Error(`Tabella ${name} non trovata`);
  const rows = [];
  for (let index = tableAt + 2; index < lines.length; index++) {
    const cells = lines[index].split("|").slice(1, -1).map((cell) => cell.trim());
    if (!/^\d+°$/.test(cells[0] ?? "")) break;
    rows.push({ level: Number(cells[0].slice(0, -1)), featureText: cells[2] ?? "", line: index + 1 });
  }
  const missingLevels = Array.from({ length: 20 }, (_, index) => index + 1).filter((level) => !rows.some((row) => row.level === level));
  result[name.toLowerCase()] = { tableLine: tableAt + 1, rowCount: rows.length, missingLevels, rows };
}
const output = process.argv.includes("--summary")
  ? Object.fromEntries(Object.entries(result).map(([key, value]) => [key, {
      tableLine: value.tableLine, rowCount: value.rowCount, missingLevels: value.missingLevels,
    }]))
  : result;
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
