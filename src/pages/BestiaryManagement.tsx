import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Check, Eye, Home, Pencil, Plus, Save, ScrollText, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { archiveMonsterRequest, createMonsterRequest, fetchMonster, fetchMonsters, importMonsterJsonRequest, updateMonsterCompendiumKnowledgeRequest, updateMonsterRequest, type MonsterEntry, type MonsterSummary, type PlayerMonsterKnowledgeState } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

const ABILITIES = [
  ["strength", "FOR"],
  ["dexterity", "DES"],
  ["constitution", "COS"],
  ["intelligence", "INT"],
  ["wisdom", "SAG"],
  ["charisma", "CAR"],
] as const;

const SPEED_KEYS = ["walk", "fly", "swim", "climb", "burrow"] as const;
const SPEED_LABELS: Record<string, string> = {
  walk: "Camminare",
  fly: "Volare",
  swim: "Nuotare",
  climb: "Scalare",
  burrow: "Scavare",
};
const MONSTER_RARITY_OPTIONS = ["Comune", "Non comune", "Raro", "Molto raro", "Leggendario"] as const;
const BESTIARY_TABLE_GRID = "minmax(220px, 1.6fr) 64px 84px 84px minmax(128px, 0.95fr) 112px 56px 76px 84px minmax(140px, 1fr)";

type BestiarySortKey =
  | "name"
  | "challengeRating"
  | "analysisDc"
  | "researchDc"
  | "discoverSkill"
  | "rarity"
  | "armorClass"
  | "hitPointsAverage"
  | "size"
  | "typeLabel";

export type PlayerKnowledgePreviewState = "unknown" | "basic" | "complete";

function cloneMonster(monster: MonsterEntry) {
  return structuredClone(monster);
}

function crLabel(challengeRating: { display: string; fraction: string }) {
  return challengeRating.display || challengeRating.fraction || "-";
}

function speedSummary(speed: Record<string, string>) {
  return SPEED_KEYS.filter((key) => speed[key]).map((key) => `${SPEED_LABELS[key]} ${speed[key]}`).join(", ");
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function signedValue(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function abilityBlock(score: number) {
  return `${score} (${signedValue(abilityModifier(score))})`;
}

function parseHitPointRange(formula: string, average: number) {
  const normalized = String(formula)
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "");

  if (!normalized) return null;

  const terms = normalized.match(/[+-]?\d+d\d+|[+-]?\d+/gi);
  if (!terms || terms.length === 0) return null;

  let min = 0;
  let max = 0;
  let consumed = "";

  for (const rawTerm of terms) {
    const term = rawTerm.replace(/\s+/g, "");
    consumed += term;

    const diceMatch = term.match(/^([+-]?)(\d+)d(\d+)$/i);
    if (diceMatch) {
      const sign = diceMatch[1] === "-" ? -1 : 1;
      const count = Number.parseInt(diceMatch[2], 10);
      const sides = Number.parseInt(diceMatch[3], 10);
      if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return null;

      if (sign >= 0) {
        min += count;
        max += count * sides;
      } else {
        min -= count * sides;
        max -= count;
      }
      continue;
    }

    const flat = Number.parseInt(term, 10);
    if (!Number.isFinite(flat)) return null;
    min += flat;
    max += flat;
  }

  if (consumed !== normalized) return null;

  return {
    min: Math.max(0, min),
    max: Math.max(Math.max(0, min), max),
    average: Math.max(0, Math.round(average)),
  };
}

function hitPointsLabel(hitPoints: MonsterEntry["combat"]["hitPoints"]) {
  const average = hitPoints.average ? String(hitPoints.average) : "";
  const formula = hitPoints.formula ? `(${hitPoints.formula})` : "";
  const range = hitPoints.formula ? parseHitPointRange(hitPoints.formula, hitPoints.average) : null;
  const minMax = range ? `[${range.min}-${range.max}]` : "";

  return [average ? `${average} medi` : "", formula, minMax].filter(Boolean).join(" ");
}

function listToText(items: string[]) {
  return items.join("\n");
}

function textToList(value: string) {
  return value.split("\n").map((entry) => entry.trim()).filter(Boolean);
}

function sanitizeImportSlug(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseImportChallengeDecimal(challengeRating: Record<string, unknown> | null | undefined) {
  const decimal = challengeRating?.decimal;
  if (typeof decimal === "number" && Number.isFinite(decimal)) return decimal;

  const display = String(challengeRating?.display ?? challengeRating?.fraction ?? "").trim();
  if (!display) return null;
  if (display === "1/8") return 0.125;
  if (display === "1/4") return 0.25;
  if (display === "1/2") return 0.5;

  const numeric = Number(display);
  return Number.isFinite(numeric) ? numeric : null;
}

function computeImportRarityHint(creatureType: string, challengeRating: Record<string, unknown> | null | undefined) {
  const type = String(creatureType ?? "").trim().toLocaleLowerCase("it-IT");
  const challengeDecimal = parseImportChallengeDecimal(challengeRating);
  const isHighCr = typeof challengeDecimal === "number" && challengeDecimal >= 5;

  if (!type) return "";
  if (["bestia", "umanoide", "pianta", "vegetale", "sciame di minuscole bestie"].includes(type)) {
    return isHighCr ? "Non comune" : "Comune";
  }
  if (["mostruosità", "mostruosita", "gigante", "non morto", "fatato", "folletto"].includes(type)) {
    return isHighCr ? "Raro" : "Non comune";
  }
  if (["aberrazione", "immondo", "celestiale", "elementale", "melma", "costrutto"].includes(type)) {
    return isHighCr ? "Molto raro" : "Raro";
  }
  if (type === "drago") {
    return typeof challengeDecimal === "number" && challengeDecimal > 15 ? "Leggendario" : "Molto raro";
  }
  return "";
}

type MonsterImportPreview =
  | {
      ok: false;
      error: string;
    }
  | {
      ok: true;
      payload: Record<string, unknown>;
      name: string;
      slug: string;
      challengeLabel: string;
      size: string;
      creatureType: string;
      subtype: string;
      typeLabel: string;
      alignment: string;
      rarityHint: string;
      sourceLabel: string;
      traitCount: number;
      actionCount: number;
      matches: MonsterSummary[];
    };

function buildMonsterImportPreview(rawJson: string, monsters: MonsterSummary[]): MonsterImportPreview {
  const text = rawJson.trim();
  if (!text) {
    return { ok: false, error: "Incolla un JSON per vedere l'anteprima." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: "Il contenuto non e un JSON valido." };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Il JSON deve rappresentare un singolo mostro." };
  }

  const monster = payload as Record<string, unknown>;
  const general = typeof monster.general === "object" && monster.general !== null ? monster.general as Record<string, unknown> : {};
  const source = typeof monster.source === "object" && monster.source !== null ? monster.source as Record<string, unknown> : {};
  const challengeRating = typeof general.challengeRating === "object" && general.challengeRating !== null ? general.challengeRating as Record<string, unknown> : {};
  const name = String(general.name ?? "").trim();

  if (!name) {
    return { ok: false, error: "Manca `general.name`." };
  }

  const slug = String(monster.slug ?? "").trim() || sanitizeImportSlug(name);
  const challengeLabel = String(challengeRating.display ?? challengeRating.fraction ?? "").trim();
  const creatureType = String(general.creatureType ?? "").trim();
  const subtype = String(general.subtype ?? "").trim();
  const typeLabel = String(general.typeLabel ?? "").trim();
  const lowerName = name.toLocaleLowerCase("it-IT");
  const matches = monsters.filter((entry) => (
    entry.slug.toLocaleLowerCase("it-IT") === slug.toLocaleLowerCase("it-IT") ||
    entry.name.toLocaleLowerCase("it-IT") === lowerName
  ));

  return {
    ok: true,
    payload: monster,
    name,
    slug,
    challengeLabel,
    size: String(general.size ?? "").trim(),
    creatureType,
    subtype,
    typeLabel,
    alignment: String(general.alignment ?? "").trim(),
    rarityHint: computeImportRarityHint(creatureType, challengeRating),
    sourceLabel: String(source.extractedFrom ?? "").trim() || "Custom / JSON incollato",
    traitCount: Array.isArray(monster.traits) ? monster.traits.length : 0,
    actionCount: Array.isArray(monster.actions) ? monster.actions.length : 0,
    matches,
  };
}

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined) {
  const left = typeof a === "number" ? a : Number.NEGATIVE_INFINITY;
  const right = typeof b === "number" ? b : Number.NEGATIVE_INFINITY;
  return left - right;
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return String(a ?? "").localeCompare(String(b ?? ""), "it", { sensitivity: "base", numeric: true });
}

function qualitativeAbility(score: number) {
  if (score <= 5) return "Molto bassa";
  if (score <= 9) return "Bassa";
  if (score <= 11) return "Nella media";
  if (score <= 15) return "Alta";
  if (score <= 19) return "Molto alta";
  return "Eccezionale";
}

function summaryFromMonster(monster: MonsterEntry): MonsterSummary {
  return {
    id: monster.id,
    slug: monster.slug,
    name: monster.general.name,
    challengeRating: monster.general.challengeRating,
    size: monster.general.size,
    creatureType: monster.general.creatureType,
    typeLabel: monster.general.typeLabel || monster.general.creatureType,
    rarity: monster.rarity,
    alignment: monster.general.alignment,
    filePath: monster.filePath,
    armorClass: monster.combat.armorClass.value,
    hitPointsAverage: monster.combat.hitPoints.average,
    analysisDc: monster.analysisDc,
    researchDc: monster.researchDc,
    discoverSkill: monster.discoverSkill,
  };
}

function formatTagged(items: Array<{ name: string; value?: string }>) {
  return items.map((item) => item.value ? `${item.name} ${item.value}` : item.name).join(", ");
}

function formatBonuses(items: Array<{ ability?: string; name?: string; bonus: number }>) {
  return items.map((item) => `${item.ability ?? item.name ?? ""} ${signedValue(item.bonus)}`).join(", ");
}

function typeLine(monster: MonsterEntry) {
  return [monster.general.size, monster.general.typeLabel || monster.general.creatureType, monster.general.alignment].filter(Boolean).join("; ");
}

function StatLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="text-[15px] leading-relaxed text-foreground">
      <span className="font-medium tracking-[0.08em] uppercase text-stone-700/80 dark:text-amber-100/70">{label}</span>{" "}
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function FeatureList({
  items,
  emptyLabel,
}: {
  items: Array<{ name: string; usage?: string | null; description: string }>;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? "Nessun contenuto."}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, index) => (
          <p key={`${item.name}-${index}`} className="text-[15px] leading-7 text-foreground">
            <span className="font-medium tracking-[0.08em] uppercase text-stone-700/80 dark:text-amber-100/70">
              {item.name}
              {item.usage ? ` (${item.usage})` : ""}.
            </span>{" "}
            <span className="font-semibold text-foreground">{item.description}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeSort,
  direction,
  onToggle,
}: {
  label: string;
  sortKey: BestiarySortKey;
  activeSort: BestiarySortKey;
  direction: "asc" | "desc";
  onToggle: (key: BestiarySortKey) => void;
}) {
  const isActive = activeSort === sortKey;

  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-left transition-colors ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      onClick={() => onToggle(sortKey)}
    >
      <span>{label}</span>
      <ArrowUpDown className={`h-3 w-3 ${isActive ? "opacity-100" : "opacity-45"}`} />
      {isActive ? <span className="text-[9px]">{direction === "asc" ? "A-Z" : "Z-A"}</span> : null}
    </button>
  );
}

function TableShell({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/55">
      <div className="grid gap-3 border-b border-border/60 bg-muted/35 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr)) 44px` }}>
        {headers.map((header) => <div key={header}>{header}</div>)}
        <div className="text-right">Azioni</div>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

function BonusTableEditor({
  label,
  items,
  keyName,
  onChange,
}: {
  label: string;
  items: Array<{ ability?: string; name?: string; bonus: number }>;
  keyName: "ability" | "name";
  onChange: (next: Array<{ ability?: string; name?: string; bonus: number }>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => onChange([...items, { [keyName]: "", bonus: 0 }])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <TableShell headers={[keyName === "ability" ? "Caratteristica" : "Nome", "Bonus"]}>
        {items.length === 0 ? <div className="px-3 py-4 text-sm text-muted-foreground">Nessuna voce.</div> : items.map((item, index) => (
          <div key={`${keyName}-${index}`} className="grid gap-3 px-3 py-3" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 44px" }}>
            <Input value={item[keyName] ?? ""} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, [keyName]: event.target.value } : entry))} />
            <Input type="number" value={item.bonus} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, bonus: Number(event.target.value || 0) } : entry))} />
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </TableShell>
    </div>
  );
}

function TaggedTableEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: Array<{ name: string; value?: string }>;
  onChange: (next: Array<{ name: string; value?: string }>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => onChange([...items, { name: "", value: "" }])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <TableShell headers={["Nome", "Valore"]}>
        {items.length === 0 ? <div className="px-3 py-4 text-sm text-muted-foreground">Nessuna voce.</div> : items.map((item, index) => (
          <div key={`${label}-${index}`} className="grid gap-3 px-3 py-3" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 44px" }}>
            <Input value={item.name} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, name: event.target.value } : entry))} />
            <Input value={item.value ?? ""} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, value: event.target.value } : entry))} />
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </TableShell>
    </div>
  );
}

function FeatureTableEditor({
  label,
  items,
  onChange,
  withCost = false,
}: {
  label: string;
  items: Array<{ name: string; usage?: string | null; description: string; cost?: number }>;
  onChange: (next: Array<{ name: string; usage?: string | null; description: string; cost?: number }>) => void;
  withCost?: boolean;
}) {
  const headers = withCost ? ["Nome", "Costo", "Descrizione"] : ["Nome", "Uso", "Descrizione"];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => onChange([...items, withCost ? { name: "", cost: 1, description: "" } : { name: "", usage: "", description: "" }])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <TableShell headers={headers}>
        {items.length === 0 ? <div className="px-3 py-4 text-sm text-muted-foreground">Nessuna voce.</div> : items.map((item, index) => (
          <div key={`${label}-${index}`} className="grid gap-3 px-3 py-3" style={{ gridTemplateColumns: withCost ? "minmax(180px,0.8fr) 100px minmax(0,1.8fr) 44px" : "minmax(180px,0.8fr) minmax(140px,0.7fr) minmax(0,1.8fr) 44px" }}>
            <Input value={item.name} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, name: event.target.value } : entry))} />
            {withCost ? (
              <Input type="number" value={item.cost ?? 1} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, cost: Number(event.target.value || 1) } : entry))} />
            ) : (
              <Input value={item.usage ?? ""} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, usage: event.target.value } : entry))} />
            )}
            <Textarea rows={2} value={item.description} onChange={(event) => onChange(items.map((entry, rowIndex) => rowIndex === index ? { ...entry, description: event.target.value } : entry))} />
            <Button type="button" variant="ghost" size="icon" className="rounded-full self-start" onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </TableShell>
    </div>
  );
}

export function MonsterStatBlock({ monster }: { monster: MonsterEntry }) {
  const statSections = [
    {
      value: "traits",
      title: "Tratti",
      content: <FeatureList items={monster.traits} emptyLabel="Nessun tratto disponibile." />,
    },
    {
      value: "actions",
      title: "Azioni",
      content: <FeatureList items={monster.actions} emptyLabel="Nessuna azione disponibile." />,
    },
    {
      value: "bonus-reactions",
      title: "Azioni bonus e reazioni",
      content: (
        <div className="space-y-8">
          {monster.bonusActions.length > 0 ? <FeatureList items={monster.bonusActions} /> : null}
          {monster.reactions.length > 0 ? <FeatureList items={monster.reactions} /> : null}
          {monster.bonusActions.length === 0 && monster.reactions.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna azione bonus o reazione disponibile.</p> : null}
        </div>
      ),
    },
    {
      value: "legendary",
      title: "Azioni leggendarie",
      content: (
        <div className="space-y-4">
          {monster.legendaryActions.description ? <p className="text-[15px] leading-7 text-foreground">{monster.legendaryActions.description}</p> : null}
          <FeatureList items={monster.legendaryActions.actions.map((item) => ({ ...item, usage: item.cost > 1 ? `Costa ${item.cost} azioni` : null }))} emptyLabel="Nessuna azione leggendaria disponibile." />
        </div>
      ),
    },
    {
      value: "lair",
      title: "Azioni di tana ed effetti regionali",
      content: (
        <div className="space-y-8">
          {monster.lairActions.length > 0 ? <FeatureList items={monster.lairActions} /> : null}
          {monster.regionalEffects.length > 0 ? <FeatureList items={monster.regionalEffects} /> : null}
          {monster.lairActions.length === 0 && monster.regionalEffects.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna azione di tana o effetto regionale disponibile.</p> : null}
        </div>
      ),
    },
  ].filter((section) => {
    if (section.value === "traits") return monster.traits.length > 0;
    if (section.value === "actions") return monster.actions.length > 0;
    if (section.value === "bonus-reactions") return monster.bonusActions.length > 0 || monster.reactions.length > 0;
    if (section.value === "legendary") return monster.legendaryActions.description || monster.legendaryActions.actions.length > 0;
    if (section.value === "lair") return monster.lairActions.length > 0 || monster.regionalEffects.length > 0;
    return true;
  });

  return (
    <div className="rounded-[28px] border border-primary/25 bg-[linear-gradient(180deg,rgba(247,237,214,0.96),rgba(239,225,193,0.92))] p-6 text-stone-900 shadow-[0_18px_40px_rgba(34,25,16,0.18)] dark:border-amber-200/20 dark:bg-[linear-gradient(180deg,rgba(52,35,24,0.96),rgba(32,21,16,0.96))] dark:text-amber-50 dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <div className="space-y-5">
        <div>
          <h2 className="font-heading text-4xl font-bold uppercase tracking-wide text-[#7d2c17] dark:text-amber-200">{monster.general.name}</h2>
          <p className="mt-1 text-lg italic text-stone-700 dark:text-amber-50/75">{typeLine(monster)}</p>
        </div>

        <div className="h-[3px] rounded-full bg-[#8d3821]/70 dark:bg-amber-300/45" />

        <div className="space-y-1">
          <StatLine label="Classe Armatura" value={[monster.combat.armorClass.value ? String(monster.combat.armorClass.value) : "", monster.combat.armorClass.note ? `(${monster.combat.armorClass.note})` : ""].filter(Boolean).join(" ")} />
          <StatLine label="Punti Ferita" value={hitPointsLabel(monster.combat.hitPoints)} />
          <StatLine label="Velocità" value={speedSummary(monster.combat.speed)} />
        </div>

        <div className="h-[3px] rounded-full bg-[#8d3821]/70 dark:bg-amber-300/45" />

        <div className="grid grid-cols-3 gap-3 rounded-[24px] border border-[#8d3821]/20 bg-white/45 px-4 py-4 md:grid-cols-6 dark:border-amber-200/15 dark:bg-white/5">
          {ABILITIES.map(([key, label]) => (
            <div key={key} className="text-center">
              <div className="text-sm font-bold uppercase tracking-[0.22em] text-[#7d2c17] dark:text-amber-200">{label}</div>
              <div className="mt-1 text-lg font-semibold text-stone-900 dark:text-amber-50">{abilityBlock(monster.abilities[key])}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <StatLine label="Tiri Salvezza" value={formatBonuses(monster.details.savingThrows)} />
          <StatLine label="Abilità" value={formatBonuses(monster.details.skills)} />
          <StatLine label="Vulnerabilità ai Danni" value={monster.details.damageVulnerabilities.join(", ")} />
          <StatLine label="Resistenze ai Danni" value={monster.details.damageResistances.join(", ")} />
          <StatLine label="Immunità ai Danni" value={monster.details.damageImmunities.join(", ")} />
          <StatLine label="Immunità alle Condizioni" value={monster.details.conditionImmunities.join(", ")} />
          <StatLine label="Sensi" value={formatTagged(monster.details.senses)} />
          <StatLine label="Linguaggi" value={formatTagged(monster.details.languages)} />
          <StatLine label="Sfida" value={`${crLabel(monster.general.challengeRating)} (${monster.general.challengeRating.xp.toLocaleString("it-IT")} PE)`} />
          <StatLine label="Ambiente" value={monster.general.environments.join(", ")} />
        </div>

        <Accordion type="multiple" defaultValue={statSections.slice(0, 3).map((section) => section.value)} className="rounded-[24px] border border-[#8d3821]/20 bg-white/45 px-5 dark:border-amber-200/15 dark:bg-white/5">
          {statSections.map((section) => (
            <AccordionItem key={section.value} value={section.value} className="border-[#8d3821]/15 dark:border-amber-200/10">
              <AccordionTrigger className="font-heading text-left text-2xl uppercase tracking-wide text-[#7d2c17] hover:no-underline dark:text-amber-200">{section.title}</AccordionTrigger>
              <AccordionContent className="pb-6">{section.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

function KnowledgeValue({
  visible,
  value,
  widthClass = "w-28",
}: {
  visible: boolean;
  value: string;
  widthClass?: string;
}) {
  if (visible) {
    return <span>{value}</span>;
  }

  return (
    <span
      className={`inline-flex h-5 ${widthClass} rounded-full bg-foreground/15 blur-sm select-none`}
      aria-hidden="true"
    />
  );
}

function PlayerPreviewLine({
  label,
  visible,
  value,
  widthClass = "w-24",
}: {
  label: string;
  visible: boolean;
  value: string;
  widthClass?: string;
}) {
  return (
    <div className="text-[15px] leading-relaxed text-foreground">
      <span className="font-medium tracking-[0.08em] uppercase text-stone-700/80 dark:text-amber-100/70">{label}</span>{" "}
      <KnowledgeValue visible={visible} value={value} widthClass={widthClass} />
    </div>
  );
}

function BlurredSection({
  rows = 3,
}: {
  rows?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`blurred-row-${index}`}
          className={`h-4 rounded-full bg-foreground/15 blur-sm ${index % 3 === 0 ? "w-11/12" : index % 3 === 1 ? "w-10/12" : "w-8/12"}`}
        />
      ))}
    </div>
  );
}

export function PlayerMonsterPreviewCard({
  monster,
  state,
}: {
  monster: MonsterEntry;
  state: PlayerKnowledgePreviewState;
}) {
  if (state === "complete") {
    return <MonsterStatBlock monster={monster} />;
  }

  const knowsBasic = state === "basic";

  return (
    <div className="rounded-[28px] border border-primary/25 bg-[linear-gradient(180deg,rgba(247,237,214,0.96),rgba(239,225,193,0.92))] p-6 text-stone-900 shadow-[0_18px_40px_rgba(34,25,16,0.18)] dark:border-amber-200/20 dark:bg-[linear-gradient(180deg,rgba(52,35,24,0.96),rgba(32,21,16,0.96))] dark:text-amber-50 dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <div className="space-y-5">
        <div>
          <h2 className="font-heading text-4xl font-bold uppercase tracking-wide text-[#7d2c17] dark:text-amber-200">
            <KnowledgeValue visible={knowsBasic} value={monster.general.name} widthClass="w-56" />
          </h2>
          <p className="mt-1 text-lg italic text-stone-700 dark:text-amber-50/75">
            <KnowledgeValue
              visible={knowsBasic}
              value={[monster.general.size, monster.general.typeLabel || monster.general.creatureType].filter(Boolean).join("; ")}
              widthClass="w-72"
            />
          </p>
        </div>

        <div className="h-[3px] rounded-full bg-[#8d3821]/70 dark:bg-amber-300/45" />

        <div className="space-y-1">
          <PlayerPreviewLine label="Classe Armatura" visible={knowsBasic} value={String(monster.combat.armorClass.value || "-")} widthClass="w-12" />
          <PlayerPreviewLine label="Punti Ferita" visible={knowsBasic} value={monster.combat.hitPoints.average ? `${monster.combat.hitPoints.average} medi` : "-"} widthClass="w-24" />
          <PlayerPreviewLine label="Velocita" visible={knowsBasic} value={speedSummary(monster.combat.speed)} widthClass="w-40" />
        </div>

        <div className="h-[3px] rounded-full bg-[#8d3821]/70 dark:bg-amber-300/45" />

        <div className="grid grid-cols-3 gap-3 rounded-[24px] border border-[#8d3821]/20 bg-white/45 px-4 py-4 md:grid-cols-6 dark:border-amber-200/15 dark:bg-white/5">
          {([
            ["strength", "Forza", true],
            ["dexterity", "Destrezza", true],
            ["constitution", "Costituzione", true],
            ["intelligence", "Intelligenza", false],
            ["wisdom", "Saggezza", false],
            ["charisma", "Carisma", false],
          ] as const).map(([key, label, visible]) => (
            <div key={key} className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d2c17] dark:text-amber-200">{label}</div>
              <div className="mt-2 text-base font-semibold text-stone-900 dark:text-amber-50">
                <KnowledgeValue
                  visible={knowsBasic && visible}
                  value={qualitativeAbility(monster.abilities[key])}
                  widthClass="w-24"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <PlayerPreviewLine label="Tiri Salvezza" visible={false} value="-" widthClass="w-40" />
          <PlayerPreviewLine label="Abilita" visible={false} value="-" widthClass="w-44" />
          <PlayerPreviewLine label="Vulnerabilita ai Danni" visible={false} value="-" widthClass="w-44" />
          <PlayerPreviewLine label="Resistenze ai Danni" visible={false} value="-" widthClass="w-44" />
          <PlayerPreviewLine label="Immunita ai Danni" visible={false} value="-" widthClass="w-40" />
          <PlayerPreviewLine label="Immunita alle Condizioni" visible={false} value="-" widthClass="w-48" />
          <PlayerPreviewLine label="Sensi" visible={false} value="-" widthClass="w-32" />
          <PlayerPreviewLine label="Linguaggi" visible={false} value="-" widthClass="w-36" />
          <PlayerPreviewLine label="Sfida" visible={false} value="-" widthClass="w-20" />
          <PlayerPreviewLine label="Ambiente" visible={false} value="-" widthClass="w-32" />
        </div>

        <Accordion type="multiple" defaultValue={["traits", "actions"]} className="rounded-[24px] border border-[#8d3821]/20 bg-white/45 px-5 dark:border-amber-200/15 dark:bg-white/5">
          {[
            ["traits", "Tratti", 3],
            ["actions", "Azioni", 3],
            ["bonus-reactions", "Azioni bonus e reazioni", 2],
            ["legendary", "Azioni leggendarie", 2],
            ["lair", "Azioni di tana ed effetti regionali", 2],
          ].map(([value, title, rows]) => (
            <AccordionItem key={value} value={value} className="border-[#8d3821]/15 dark:border-amber-200/10">
              <AccordionTrigger className="font-heading text-left text-2xl uppercase tracking-wide text-[#7d2c17] hover:no-underline dark:text-amber-200">{title}</AccordionTrigger>
              <AccordionContent className="pb-6">
                <BlurredSection rows={Number(rows)} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="rounded-[24px] border border-[#8d3821]/20 bg-white/45 px-5 py-5 dark:border-amber-200/15 dark:bg-white/5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#7d2c17] dark:text-amber-200">
            Note e informazioni non ancora note
          </div>
          <div className="space-y-3">
            <div className="h-4 w-11/12 rounded-full bg-foreground/15 blur-sm" />
            <div className="h-4 w-10/12 rounded-full bg-foreground/15 blur-sm" />
            <div className="h-4 w-8/12 rounded-full bg-foreground/15 blur-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MonsterEditForm({
  monster,
  draftMonster,
  setDraftMonster,
}: {
  monster: MonsterEntry;
  draftMonster: MonsterEntry | null;
  setDraftMonster: React.Dispatch<React.SetStateAction<MonsterEntry | null>>;
}) {
  return (
    <Accordion type="multiple" defaultValue={["general", "combat", "details", "traits"]} className="space-y-4">
      <AccordionItem value="general" className="rounded-3xl border border-border/60 bg-background/50 px-5">
        <AccordionTrigger className="font-heading text-xl font-semibold text-primary hover:no-underline">Informazioni generali</AccordionTrigger>
        <AccordionContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2"><Label>Nome</Label><Input value={monster.general.name} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, name: event.target.value } })} /></div>
            <div className="space-y-2"><Label>GS</Label><Input value={monster.general.challengeRating.display} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, challengeRating: { ...draftMonster.general.challengeRating, display: event.target.value, fraction: event.target.value } } })} /></div>
            <div className="space-y-2"><Label>PE</Label><Input type="number" value={monster.general.challengeRating.xp} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, challengeRating: { ...draftMonster.general.challengeRating, xp: Number(event.target.value || 0) } } })} /></div>
            <div className="space-y-2"><Label>Taglia</Label><Input value={monster.general.size} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, size: event.target.value } })} /></div>
            <div className="space-y-2"><Label>Tipo</Label><Input value={monster.general.creatureType} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, creatureType: event.target.value } })} /></div>
            <div className="space-y-2"><Label>Sottotipo</Label><Input value={monster.general.subtype} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, subtype: event.target.value } })} /></div>
            <div className="space-y-2"><Label>Etichetta tipo</Label><Input value={monster.general.typeLabel} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, typeLabel: event.target.value } })} /></div>
            <div className="space-y-2">
              <Label>Rarita</Label>
              <Select
                value={monster.rarity?.trim() ? monster.rarity : "__auto__"}
                onValueChange={(value) => draftMonster && setDraftMonster({ ...draftMonster, rarity: value === "__auto__" ? "" : value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Auto</SelectItem>
                  {MONSTER_RARITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>Allineamento</Label><Input value={monster.general.alignment} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, alignment: event.target.value } })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">`Auto` usa le regole di calcolo standard. Seleziona una rarita esplicita per i casi speciali che non devono seguire l'automatismo.</p>
          <div className="space-y-2"><Label>Ambienti</Label><Textarea rows={2} value={listToText(monster.general.environments)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, environments: textToList(event.target.value) } })} /></div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="combat" className="rounded-3xl border border-border/60 bg-background/50 px-5">
        <AccordionTrigger className="font-heading text-xl font-semibold text-primary hover:no-underline">Combattimento e caratteristiche</AccordionTrigger>
        <AccordionContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>CA</Label><Input type="number" value={monster.combat.armorClass.value} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, armorClass: { ...draftMonster.combat.armorClass, value: Number(event.target.value || 0) } } })} /></div>
            <div className="space-y-2"><Label>Nota CA</Label><Input value={monster.combat.armorClass.note} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, armorClass: { ...draftMonster.combat.armorClass, note: event.target.value } } })} /></div>
            <div className="space-y-2"><Label>PF medi</Label><Input type="number" value={monster.combat.hitPoints.average} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, hitPoints: { ...draftMonster.combat.hitPoints, average: Number(event.target.value || 0) } } })} /></div>
            <div className="space-y-2"><Label>Formula PF</Label><Input value={monster.combat.hitPoints.formula} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, hitPoints: { ...draftMonster.combat.hitPoints, formula: event.target.value } } })} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SPEED_KEYS.map((key) => (
              <div key={key} className="space-y-2"><Label>{SPEED_LABELS[key]}</Label><Input value={monster.combat.speed[key] ?? ""} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, speed: { ...draftMonster.combat.speed, [key]: event.target.value } } })} /></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ABILITIES.map(([key, label]) => (
              <div key={key} className="space-y-2 rounded-2xl border border-border/60 bg-background/60 p-3"><Label>{label}</Label><Input type="number" value={monster.abilities[key]} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, abilities: { ...draftMonster.abilities, [key]: Number(event.target.value || 0) } })} /></div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="details" className="rounded-3xl border border-border/60 bg-background/50 px-5">
        <AccordionTrigger className="font-heading text-xl font-semibold text-primary hover:no-underline">Dettagli e difese</AccordionTrigger>
        <AccordionContent className="space-y-4">
          <BonusTableEditor label="Tiri salvezza" items={monster.details.savingThrows} keyName="ability" onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, savingThrows: next as MonsterEntry["details"]["savingThrows"] } })} />
          <BonusTableEditor label="Abilità" items={monster.details.skills} keyName="name" onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, skills: next as MonsterEntry["details"]["skills"] } })} />
          <TaggedTableEditor label="Sensi" items={monster.details.senses} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, senses: next } })} />
          <TaggedTableEditor label="Linguaggi" items={monster.details.languages} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, languages: next } })} />
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2"><Label>Resistenze ai danni</Label><Textarea rows={3} value={listToText(monster.details.damageResistances)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, damageResistances: textToList(event.target.value) } })} /></div>
            <div className="space-y-2"><Label>Immunità ai danni</Label><Textarea rows={3} value={listToText(monster.details.damageImmunities)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, damageImmunities: textToList(event.target.value) } })} /></div>
            <div className="space-y-2"><Label>Vulnerabilità ai danni</Label><Textarea rows={3} value={listToText(monster.details.damageVulnerabilities)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, damageVulnerabilities: textToList(event.target.value) } })} /></div>
            <div className="space-y-2"><Label>Immunità alle condizioni</Label><Textarea rows={3} value={listToText(monster.details.conditionImmunities)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, conditionImmunities: textToList(event.target.value) } })} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="traits" className="rounded-3xl border border-border/60 bg-background/50 px-5">
        <AccordionTrigger className="font-heading text-xl font-semibold text-primary hover:no-underline">Tratti e azioni</AccordionTrigger>
        <AccordionContent className="space-y-4">
          <FeatureTableEditor label="Tratti" items={monster.traits} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, traits: next as MonsterEntry["traits"] })} />
          <FeatureTableEditor label="Azioni" items={monster.actions} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, actions: next as MonsterEntry["actions"] })} />
          <FeatureTableEditor label="Azioni bonus" items={monster.bonusActions} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, bonusActions: next as MonsterEntry["bonusActions"] })} />
          <FeatureTableEditor label="Reazioni" items={monster.reactions} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, reactions: next as MonsterEntry["reactions"] })} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="advanced" className="rounded-3xl border border-border/60 bg-background/50 px-5">
        <AccordionTrigger className="font-heading text-xl font-semibold text-primary hover:no-underline">Sezioni avanzate e sorgente</AccordionTrigger>
        <AccordionContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descrizione azioni leggendarie</Label>
            <Textarea rows={3} value={monster.legendaryActions.description} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, legendaryActions: { ...draftMonster.legendaryActions, description: event.target.value } })} />
          </div>
          <FeatureTableEditor label="Azioni leggendarie" items={monster.legendaryActions.actions} withCost onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, legendaryActions: { ...draftMonster.legendaryActions, actions: next.map((item) => ({ name: item.name, cost: item.cost ?? 1, description: item.description })) } })} />
          <FeatureTableEditor label="Azioni di tana" items={monster.lairActions} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, lairActions: next as MonsterEntry["lairActions"] })} />
          <FeatureTableEditor label="Effetti regionali" items={monster.regionalEffects} onChange={(next) => draftMonster && setDraftMonster({ ...draftMonster, regionalEffects: next as MonsterEntry["regionalEffects"] })} />
          <div className="space-y-2"><Label>Note</Label><Textarea rows={4} value={listToText(monster.notes)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, notes: textToList(event.target.value) })} /></div>
          <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">File</div>
            <div className="mt-1 text-sm text-foreground">{monster.filePath}</div>
            <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Origine</div>
            <div className="mt-1 text-sm text-foreground">{monster.source.extractedFrom || "Custom / manuale"}</div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default function BestiaryManagement() {
  const [monsters, setMonsters] = useState<MonsterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ name: "", challenge: "__all__", size: "__all__", creatureType: "__all__", rarity: "__all__", alignment: "__all__", minArmorClass: "", minHitPoints: "" });
  const [sortBy, setSortBy] = useState<BestiarySortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [selectedMonster, setSelectedMonster] = useState<MonsterEntry | null>(null);
  const [draftMonster, setDraftMonster] = useState<MonsterEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [playerPreviewOpen, setPlayerPreviewOpen] = useState(false);
  const [playerPreviewState, setPlayerPreviewState] = useState<PlayerKnowledgePreviewState>("basic");
  const [updatingKnowledge, setUpdatingKnowledge] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "duplicate">("blank");
  const [newMonsterName, setNewMonsterName] = useState("");
  const [duplicateFromId, setDuplicateFromId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importMode, setImportMode] = useState<"create" | "update">("create");
  const [importTargetId, setImportTargetId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState("");

  useEffect(() => {
    document.title = "Gestione Bestiario | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;
    void fetchMonsters().then((items) => {
      if (active) setMonsters(items);
    }).catch(() => {
      if (active) toast.error("Non sono riuscito a caricare il bestiario.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const filterOptions = useMemo(() => ({
    challenges: Array.from(new Set(monsters.map((monster) => crLabel(monster.challengeRating)).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    sizes: Array.from(new Set(monsters.map((monster) => monster.size).filter(Boolean))).sort(),
    types: Array.from(new Set(monsters.map((monster) => monster.typeLabel || monster.creatureType).filter(Boolean))).sort(),
    rarities: Array.from(new Set(monsters.map((monster) => monster.rarity).filter(Boolean))).sort(),
    alignments: Array.from(new Set(monsters.map((monster) => monster.alignment).filter(Boolean))).sort(),
  }), [monsters]);

  const filteredMonsters = useMemo(() => monsters.filter((monster) => {
    const needle = filters.name.toLowerCase();
    const minArmorClass = Number.parseInt(filters.minArmorClass, 10);
    const minHitPoints = Number.parseInt(filters.minHitPoints, 10);
    const nameMatch = !needle || monster.name.toLowerCase().includes(needle) || monster.slug.toLowerCase().includes(needle);
    const challengeMatch = filters.challenge === "__all__" || crLabel(monster.challengeRating) === filters.challenge;
    const sizeMatch = filters.size === "__all__" || monster.size === filters.size;
    const typeMatch = filters.creatureType === "__all__" || (monster.typeLabel || monster.creatureType) === filters.creatureType;
    const rarityMatch = filters.rarity === "__all__" || monster.rarity === filters.rarity;
    const alignmentMatch = filters.alignment === "__all__" || monster.alignment === filters.alignment;
    const armorClassMatch = !Number.isFinite(minArmorClass) || monster.armorClass >= minArmorClass;
    const hitPointsMatch = !Number.isFinite(minHitPoints) || monster.hitPointsAverage >= minHitPoints;
    return nameMatch && challengeMatch && sizeMatch && typeMatch && rarityMatch && alignmentMatch && armorClassMatch && hitPointsMatch;
  }), [filters, monsters]);
  const sortedMonsters = useMemo(() => {
    const items = [...filteredMonsters];
    items.sort((left, right) => {
      let result = 0;

      switch (sortBy) {
        case "name":
          result = compareText(left.name, right.name);
          break;
        case "challengeRating":
          result = compareNullableNumber(left.challengeRating.decimal, right.challengeRating.decimal);
          break;
        case "analysisDc":
          result = compareNullableNumber(left.analysisDc, right.analysisDc);
          break;
        case "researchDc":
          result = compareNullableNumber(left.researchDc, right.researchDc);
          break;
        case "discoverSkill":
          result = compareText(left.discoverSkill, right.discoverSkill);
          break;
        case "rarity":
          result = compareText(left.rarity, right.rarity);
          break;
        case "armorClass":
          result = compareNullableNumber(left.armorClass, right.armorClass);
          break;
        case "hitPointsAverage":
          result = compareNullableNumber(left.hitPointsAverage, right.hitPointsAverage);
          break;
        case "size":
          result = compareText(left.size, right.size);
          break;
        case "typeLabel":
          result = compareText(left.typeLabel || left.creatureType, right.typeLabel || right.creatureType);
          break;
      }

      if (result === 0) {
        result = compareText(left.name, right.name);
      }

      return sortDirection === "asc" ? result : -result;
    });
    return items;
  }, [filteredMonsters, sortBy, sortDirection]);
  const hasActiveFilters =
    filters.name.trim().length > 0 ||
    filters.challenge !== "__all__" ||
    filters.size !== "__all__" ||
    filters.creatureType !== "__all__" ||
    filters.rarity !== "__all__" ||
    filters.alignment !== "__all__" ||
    filters.minArmorClass.trim().length > 0 ||
    filters.minHitPoints.trim().length > 0;

  const monster = editing ? draftMonster : selectedMonster;
  const importPreview = useMemo(() => buildMonsterImportPreview(importJsonText, monsters), [importJsonText, monsters]);

  useEffect(() => {
    if (!importPreview.ok) return;
    if (!importTargetId && importPreview.matches.length === 1) {
      setImportTargetId(importPreview.matches[0].id);
      setImportMode("update");
    }
  }, [importPreview, importTargetId]);

  const toggleSort = (key: BestiarySortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => prev === "asc" ? "desc" : "asc");
      return;
    }
    setSortBy(key);
    setSortDirection("asc");
  };

  const openMonster = async (monsterId: string) => {
    setSelectedMonsterId(monsterId);
    setDetailOpen(true);
    setDetailLoading(true);
    setEditing(false);
    try {
      const nextMonster = await fetchMonster(monsterId);
      setSelectedMonster(nextMonster);
      setDraftMonster(cloneMonster(nextMonster));
      setPlayerPreviewState(
        nextMonster.compendiumKnowledgeState === "COMPLETE"
          ? "complete"
          : nextMonster.compendiumKnowledgeState === "UNKNOWN"
            ? "unknown"
            : "basic"
      );
    } catch {
      toast.error("Non sono riuscito ad aprire il mostro.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveMonster = async () => {
    if (!selectedMonsterId || !draftMonster) return;
    setSaving(true);
    try {
      const savedMonster = await updateMonsterRequest(selectedMonsterId, draftMonster);
      setSelectedMonster(savedMonster);
      setDraftMonster(cloneMonster(savedMonster));
      setMonsters((prev) => prev.map((entry) => (entry.id === savedMonster.id ? summaryFromMonster(savedMonster) : entry)).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
      setEditing(false);
      toast.success(`${savedMonster.general.name} salvato.`);
    } catch {
      toast.error("Non sono riuscito a salvare il mostro.");
    } finally {
      setSaving(false);
    }
  };

  const archiveMonster = async () => {
    if (!selectedMonsterId || !monster) return;
    const confirmed = window.confirm(`Archiviare ${monster.general.name}? Il mostro verra nascosto dal bestiario ma non eliminato definitivamente.`);
    if (!confirmed) return;

    setArchiving(true);
    try {
      await archiveMonsterRequest(selectedMonsterId);
      setMonsters((prev) => prev.filter((entry) => entry.id !== selectedMonsterId));
      setDetailOpen(false);
      setSelectedMonsterId(null);
      setSelectedMonster(null);
      setDraftMonster(null);
      setEditing(false);
      toast.success(`${monster.general.name} archiviato.`);
    } catch {
      toast.error("Non sono riuscito ad archiviare il mostro.");
    } finally {
      setArchiving(false);
    }
  };

  const updateCompendiumKnowledge = async (knowledgeState: PlayerMonsterKnowledgeState) => {
    if (!selectedMonsterId || !selectedMonster) return;
    setUpdatingKnowledge(true);
    try {
      const result = await updateMonsterCompendiumKnowledgeRequest(selectedMonsterId, knowledgeState);
      setSelectedMonster((prev) => (prev ? { ...prev, compendiumKnowledgeState: result.knowledgeState } : prev));
      setDraftMonster((prev) => (prev ? { ...prev, compendiumKnowledgeState: result.knowledgeState } : prev));
      setPlayerPreviewState(
        result.knowledgeState === "COMPLETE"
          ? "complete"
          : result.knowledgeState === "UNKNOWN"
            ? "unknown"
            : "basic"
      );
      toast.success("Livello di conoscenza aggiornato.");
    } catch {
      toast.error("Non sono riuscito ad aggiornare il livello di conoscenza.");
    } finally {
      setUpdatingKnowledge(false);
    }
  };

  const createMonster = async () => {
    if (!newMonsterName.trim()) return;
    if (createMode === "duplicate" && !duplicateFromId) {
      toast.error("Scegli il mostro da duplicare.");
      return;
    }
    try {
      const createdMonster = await createMonsterRequest({ name: newMonsterName.trim(), duplicateFromId: createMode === "duplicate" ? duplicateFromId : null });
      setMonsters((prev) => [...prev, summaryFromMonster(createdMonster)].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
      setCreateOpen(false);
      setCreateMode("blank");
      setNewMonsterName("");
      setDuplicateFromId("");
      toast.success(`${createdMonster.general.name} creato.`);
      await openMonster(createdMonster.id);
      setEditing(true);
    } catch {
      toast.error("Non sono riuscito a creare il mostro.");
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setImportJsonText(content);
      setImportFileName(file.name);
    } catch {
      toast.error("Non sono riuscito a leggere il file JSON.");
    } finally {
      event.target.value = "";
    }
  };

  const importMonsterFromJson = async () => {
    if (!importPreview.ok) {
      toast.error(importPreview.error);
      return;
    }

    if (importMode === "update" && !importTargetId) {
      toast.error("Scegli il mostro da aggiornare.");
      return;
    }

    setImporting(true);
    try {
      const savedMonster = await importMonsterJsonRequest({
        monster: importPreview.payload,
        targetMonsterId: importMode === "update" ? importTargetId : null,
      });

      setMonsters((prev) => {
        const nextSummary = summaryFromMonster(savedMonster);
        const exists = prev.some((entry) => entry.id === savedMonster.id);
        const next = exists
          ? prev.map((entry) => entry.id === savedMonster.id ? nextSummary : entry)
          : [...prev, nextSummary];
        return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      });

      setImportOpen(false);
      setImportJsonText("");
      setImportMode("create");
      setImportTargetId("");
      setImportFileName("");
      toast.success(importMode === "update" ? `${savedMonster.general.name} aggiornato da JSON.` : `${savedMonster.general.name} importato da JSON.`);
      await openMonster(savedMonster.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Non sono riuscito a importare il mostro.";
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Gestione Bestiario</h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">Filtri rapidi, dettaglio da combattimento in stile scheda mostro e modifica solo quando serve.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                  <Link to="/" aria-label="Torna alla home">
                    <Home className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Torna alla home</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <ScrollText className="h-4 w-4 text-primary" />
                  <span>{monsters.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Mostri totali</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>{filteredMonsters.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Mostri filtrati</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCreateOpen(true)} aria-label="Aggiungi mostro">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aggiungi mostro</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setImportOpen(true)} aria-label="Importa mostro da JSON">
                  <WandSparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Importa mostro da JSON</TooltipContent>
            </Tooltip>
          </div>
        </section>

        <Card className="character-section space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(7,minmax(100px,1fr))]">
              <div className="space-y-2">
                <Label htmlFor="monster-filter-name">Mostro</Label>
                <Input
                  id="monster-filter-name"
                  value={filters.name}
                  onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Cerca per nome o slug"
                />
              </div>
              <div className="space-y-2">
                <Label>GS</Label>
                <Select value={filters.challenge} onValueChange={(value) => setFilters((prev) => ({ ...prev, challenge: value }))}>
                  <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutti</SelectItem>
                    {filterOptions.challenges.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taglia</Label>
                <Select value={filters.size} onValueChange={(value) => setFilters((prev) => ({ ...prev, size: value }))}>
                  <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutte</SelectItem>
                    {filterOptions.sizes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={filters.creatureType} onValueChange={(value) => setFilters((prev) => ({ ...prev, creatureType: value }))}>
                  <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutti</SelectItem>
                    {filterOptions.types.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rarità</Label>
                <Select value={filters.rarity} onValueChange={(value) => setFilters((prev) => ({ ...prev, rarity: value }))}>
                  <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutte</SelectItem>
                    {filterOptions.rarities.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Allineamento</Label>
                <Select value={filters.alignment} onValueChange={(value) => setFilters((prev) => ({ ...prev, alignment: value }))}>
                  <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutti</SelectItem>
                    {filterOptions.alignments.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monster-filter-ac">CA min</Label>
                <Input
                  id="monster-filter-ac"
                  type="number"
                  min="0"
                  value={filters.minArmorClass}
                  onChange={(event) => setFilters((prev) => ({ ...prev, minArmorClass: event.target.value }))}
                  placeholder="Es. 15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monster-filter-hp">PF min</Label>
                <Input
                  id="monster-filter-hp"
                  type="number"
                  min="0"
                  value={filters.minHitPoints}
                  onChange={(event) => setFilters((prev) => ({ ...prev, minHitPoints: event.target.value }))}
                  placeholder="Es. 50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 text-sm">
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{filteredMonsters.length}</span> / {monsters.length} visibili
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFilters({ name: "", challenge: "__all__", size: "__all__", creatureType: "__all__", rarity: "__all__", alignment: "__all__", minArmorClass: "", minHitPoints: "" })}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reset filtri
                </Button>
              ) : null}
            </div>
          </div>

          <div className="h-[calc(100vh-23rem)] min-h-[280px] overflow-auto rounded-2xl border border-border/60 bg-background/45">
            <div className="sticky top-0 z-10 grid min-w-[1040px] gap-3 border-b border-border/60 bg-muted/95 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur [&>*:nth-child(7)]:hidden" style={{ gridTemplateColumns: BESTIARY_TABLE_GRID }}>
              <SortHeader label="Mostro" sortKey="name" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="GS" sortKey="challengeRating" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="DC Analisi" sortKey="analysisDc" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="DC Ricerca" sortKey="researchDc" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="Skill" sortKey="discoverSkill" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="Rarita" sortKey="rarity" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <span>Rarità</span>
              <SortHeader label="CA" sortKey="armorClass" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="PF medi" sortKey="hitPointsAverage" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="Taglia" sortKey="size" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
              <SortHeader label="Tipo" sortKey="typeLabel" activeSort={sortBy} direction={sortDirection} onToggle={toggleSort} />
            </div>

            {loading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Carico il bestiario...</div>
              ) : filteredMonsters.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Nessun mostro corrisponde ai filtri attivi.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {sortedMonsters.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="grid min-w-[1040px] w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/20"
                      style={{ gridTemplateColumns: BESTIARY_TABLE_GRID }}
                      onClick={() => void openMonster(entry.id)}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-heading text-lg font-semibold text-primary">{entry.name}</div>
                      </div>
                      <div className="text-xs text-foreground">GS {crLabel(entry.challengeRating)}</div>
                      <div className="text-xs text-foreground">{entry.analysisDc ?? "-"}</div>
                      <div className="text-xs text-foreground">{entry.researchDc ?? "-"}</div>
                      <div className="truncate text-xs text-foreground">{entry.discoverSkill || "-"}</div>
                      <div className="truncate text-xs text-foreground">{entry.rarity || "-"}</div>
                      <div className="text-xs text-foreground">{entry.armorClass || "-"}</div>
                      <div className="text-xs text-foreground">{entry.hitPointsAverage || "-"}</div>
                      <div className="text-xs text-foreground">{entry.size || "-"}</div>
                      <div className="truncate text-xs text-foreground">{entry.typeLabel || entry.creatureType || "-"}</div>
                    </button>
                  ))}
                </div>
              )}
          </div>
        </Card>
      </div>

      <Dialog open={detailOpen} onOpenChange={(open) => {
        setDetailOpen(open);
        if (!open) {
          setSelectedMonsterId(null);
          setSelectedMonster(null);
          setDraftMonster(null);
          setEditing(false);
          setPlayerPreviewOpen(false);
        }
      }}>
        <DialogContent className="[&>button]:hidden max-w-6xl border-primary/20 bg-card/95 p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <DialogTitle className="font-heading text-3xl text-primary">{monster?.general.name || "Dettaglio mostro"}</DialogTitle>
                <DialogDescription>{editing ? "Modalità modifica attiva." : "Vista da combattimento in stile scheda mostro."}</DialogDescription>
                {monster ? <div className="flex flex-wrap gap-2"><Badge variant="outline">GS {crLabel(monster.general.challengeRating)}</Badge><Badge variant="outline">{monster.general.size || "Taglia?"}</Badge><Badge variant="outline">{monster.general.typeLabel || monster.general.creatureType || "Tipo?"}</Badge><Badge variant="outline">{monster.general.alignment || "Allineamento?"}</Badge></div> : null}
                {monster ? <div className="flex flex-wrap items-center gap-3 pt-1"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conoscenza player</Label><Select value={monster.compendiumKnowledgeState ?? "UNKNOWN"} onValueChange={(value) => void updateCompendiumKnowledge(value as PlayerMonsterKnowledgeState)} disabled={updatingKnowledge}><SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="UNKNOWN">Sconosciuto</SelectItem><SelectItem value="BASIC">Conoscenza base</SelectItem><SelectItem value="COMPLETE">Conoscenza completa</SelectItem></SelectContent></Select></div> : null}
              </div>
              {monster ? <div className="flex flex-wrap gap-2">{editing ? <><Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => { setDraftMonster(selectedMonster ? cloneMonster(selectedMonster) : null); setEditing(false); }}><X className="h-4 w-4" /></Button><Button size="icon" className="rounded-full" onClick={() => void saveMonster()} disabled={saving}><Check className="h-4 w-4" /></Button></> : <><Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => setPlayerPreviewOpen(true)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="rounded-full text-destructive hover:text-destructive" onClick={() => void archiveMonster()} disabled={archiving}><Trash2 className="h-4 w-4" /></Button></>}</div> : null}
            </div>
          </DialogHeader>

          {detailLoading || !monster ? <div className="px-6 py-8 text-sm text-muted-foreground">Carico il dettaglio del mostro...</div> : <ScrollArea className="max-h-[78vh]"><div className="space-y-6 px-6 py-6">{editing ? <MonsterEditForm monster={monster} draftMonster={draftMonster} setDraftMonster={setDraftMonster} /> : <MonsterStatBlock monster={monster} />}</div></ScrollArea>}
        </DialogContent>
      </Dialog>

      <Dialog open={playerPreviewOpen} onOpenChange={setPlayerPreviewOpen}>
        <DialogContent className="[&>button]:hidden max-w-5xl border-primary/20 bg-card/95 p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <div className="space-y-3">
              <div>
                <DialogTitle className="font-heading text-3xl text-primary">Anteprima compendio player</DialogTitle>
                <DialogDescription>Vista di test della scheda mostro lato giocatore, con informazioni nascoste in base al livello di conoscenza.</DialogDescription>
              </div>
              <Tabs value={playerPreviewState} onValueChange={(value) => setPlayerPreviewState(value as PlayerKnowledgePreviewState)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="unknown">Sconosciuto</TabsTrigger>
                  <TabsTrigger value="basic">Conoscenza base</TabsTrigger>
                  <TabsTrigger value="complete">Conoscenza completa</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[78vh]">
            <div className="px-6 py-6">
              {monster ? <PlayerMonsterPreviewCard monster={monster} state={playerPreviewState} /> : null}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => {
        setImportOpen(open);
        if (!open) {
          setImportJsonText("");
          setImportMode("create");
          setImportTargetId("");
          setImportFileName("");
        }
      }}>
        <DialogContent className="[&>button]:hidden flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader>
            <div className="px-6 pt-6">
              <DialogTitle>Importa mostro da JSON</DialogTitle>
              <DialogDescription>Incolla il JSON canonico del mostro oppure carica un file `.json`. Prima del salvataggio puoi vedere anteprima, rarita stimata e possibili match con il bestiario.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            <div className="grid gap-5 pb-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="monster-import-file">File JSON</Label>
                  <Input id="monster-import-file" type="file" accept=".json,application/json" onChange={(event) => void handleImportFile(event)} />
                  <p className="text-xs text-muted-foreground">{importFileName ? `File caricato: ${importFileName}` : "Puoi anche incollare direttamente il contenuto qui sotto."}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monster-import-json">JSON mostro</Label>
                  <Textarea
                    id="monster-import-json"
                    rows={20}
                    value={importJsonText}
                    onChange={(event) => setImportJsonText(event.target.value)}
                    placeholder={`{\n  "slug": "mm5-nome-mostro",\n  "general": {\n    "name": "Nome Mostro"\n  }\n}`}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-border/60 bg-background/55 p-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Anteprima import</div>
                  <div className="mt-1 text-sm text-muted-foreground">La normalizzazione finale avviene lato server al salvataggio.</div>
                </div>

                {!importPreview.ok ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                    {importPreview.error}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="font-heading text-2xl text-primary">{importPreview.name}</div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">slug {importPreview.slug}</Badge>
                        <Badge variant="outline">GS {importPreview.challengeLabel || "-"}</Badge>
                        <Badge variant="outline">{importPreview.size || "Taglia?"}</Badge>
                        <Badge variant="outline">{importPreview.typeLabel || importPreview.creatureType || "Tipo?"}</Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</div>
                        <div className="mt-1 text-foreground">{importPreview.creatureType || "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Sottotipo</div>
                        <div className="mt-1 text-foreground">{importPreview.subtype || "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Allineamento</div>
                        <div className="mt-1 text-foreground">{importPreview.alignment || "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Rarita stimata</div>
                        <div className="mt-1 text-foreground">{importPreview.rarityHint || "Non calcolabile"}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Tratti</div>
                        <div className="mt-1 text-foreground">{importPreview.traitCount}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Azioni</div>
                        <div className="mt-1 text-foreground">{importPreview.actionCount}</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Operazione</Label>
                        <Select value={importMode} onValueChange={(value: "create" | "update") => setImportMode(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Crea nuovo mostro</SelectItem>
                            <SelectItem value="update">Aggiorna mostro esistente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {importPreview.matches.length > 0 ? (
                        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
                          Trovati {importPreview.matches.length} possibili match per nome o slug.
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-950 dark:text-emerald-100">
                          Nessun match rilevato: l'import verra trattato come nuova creatura.
                        </div>
                      )}

                      {importMode === "update" ? (
                        <div className="space-y-2">
                          <Label>Mostro da aggiornare</Label>
                          <Select value={importTargetId} onValueChange={setImportTargetId}>
                            <SelectTrigger><SelectValue placeholder="Scegli il mostro bersaglio" /></SelectTrigger>
                            <SelectContent>
                              {importPreview.matches.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>
                                  {entry.name} · GS {crLabel(entry.challengeRating)}
                                </SelectItem>
                              ))}
                              {importPreview.matches.length === 0 ? <SelectItem value="__none__" disabled>Nessun match disponibile</SelectItem> : null}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Origine</div>
                        <div className="mt-1 text-sm text-foreground">{importPreview.sourceLabel}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 px-6 py-4">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => setImportOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="icon" className="rounded-full" onClick={() => void importMonsterFromJson()} disabled={!importPreview.ok || importing || (importMode === "update" && !importTargetId)}>
              <Check className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="[&>button]:hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Aggiungi mostro</DialogTitle>
            <DialogDescription>Crea un mostro vuoto oppure duplicane uno esistente per ottenere una variante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Modalità</Label><Select value={createMode} onValueChange={(value: "blank" | "duplicate") => setCreateMode(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="blank">Crea da zero</SelectItem><SelectItem value="duplicate">Duplica da esistente</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="new-monster-name">Nome mostro</Label><Input id="new-monster-name" value={newMonsterName} onChange={(event) => setNewMonsterName(event.target.value)} placeholder="Es. Aboleth antico" /></div>
            {createMode === "duplicate" ? <div className="space-y-2"><Label>Mostro di partenza</Label><Select value={duplicateFromId} onValueChange={setDuplicateFromId}><SelectTrigger><SelectValue placeholder="Scegli il mostro base" /></SelectTrigger><SelectContent>{monsters.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name} · GS {crLabel(entry.challengeRating)}</SelectItem>)}</SelectContent></Select></div> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => setCreateOpen(false)}><X className="h-4 w-4" /></Button>
            <Button size="icon" className="rounded-full" onClick={() => void createMonster()} disabled={!newMonsterName.trim()}><Check className="h-4 w-4" /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
