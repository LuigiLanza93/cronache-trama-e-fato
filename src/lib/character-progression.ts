import { CLASS_RULES, SUBCLASS_RULES } from "../../shared/character-class-rules.mjs";
import { pactBoonSummary } from "../../shared/warlock-pact-rules.mjs";
import { draconicAncestrySummary } from "../../shared/draconic-ancestry-rules.mjs";

export type DraconicAncestryProjection = { key: string; label: string; damageType: string; damageLabel: string };

export type PactBoonProjection = { key: string; label: string };

export type CharacterSubclassProjection = {
  subclassKey: string | null;
  label: string | null;
  status: string;
};

export type CharacterClassProjection = {
  classKey: string;
  label: string;
  level: number;
  sortOrder: number;
  isPrimary: boolean;
  subclass: CharacterSubclassProjection | null;
  draconicAncestry?: DraconicAncestryProjection | null;
  pactBoonKey?: string | null;
  pactBoon?: PactBoonProjection | null;
};

type PreviewClass = { classKey: string; level: number; subclassKey?: string | null; draconicAncestryKey?: string | null; pactBoonKey?: string | null };

export function getSubclassPreviewRows(
  before: Array<{ classKey: string; label?: string; level: number; subclass?: { subclassKey?: string | null; label?: string | null } | null; draconicAncestry?: DraconicAncestryProjection | null; pactBoonKey?: string | null }>,
  after: PreviewClass[],
) {
  return after.map((entry) => {
    const previous = before.find((item) => item.classKey === entry.classKey);
    const previousAncestry = previous?.draconicAncestry;
    const nextAncestry = draconicAncestrySummary(entry.draconicAncestryKey);
    const previousLabel = previous?.subclass?.label ?? (previous?.subclass?.subclassKey
      ? SUBCLASS_RULES[previous.subclass.subclassKey]?.labels.it ?? previous.subclass.subclassKey : "Nessuna");
    const nextLabel = entry.subclassKey ? (entry.subclassKey === previous?.subclass?.subclassKey ? previous.subclass.label : null)
      ?? SUBCLASS_RULES[entry.subclassKey]?.labels.it ?? entry.subclassKey : "Nessuna";
    const beforePact = pactBoonSummary(previous?.pactBoonKey);
    const afterPact = pactBoonSummary(entry.pactBoonKey);
    const beforeText = previousAncestry ? `${previousLabel} ? ${previousAncestry.label} (${previousAncestry.damageLabel})` : previousLabel;
    const afterText = nextAncestry ? `${nextLabel} ? ${nextAncestry.label} (${nextAncestry.damageLabel})` : nextLabel;
    return {
      classKey: entry.classKey,
      label: previous?.label ?? CLASS_RULES[entry.classKey]?.labels.it ?? entry.classKey,
      before: previousAncestry ? `${previousLabel} · ${previousAncestry.label} (${previousAncestry.damageLabel})` : previousLabel,
      after: nextAncestry ? `${nextLabel} · ${nextAncestry.label} (${nextAncestry.damageLabel})` : nextLabel,
    };
  });
}

export type CharacterProgressionProjection = {
  classes?: CharacterClassProjection[];
  primaryClass?: CharacterClassProjection | null;
  totalLevel?: number | null;
  progressionRevision?: number | null;
  progressionStatus?: string;
  basicInfo?: {
    class?: string | null;
    level?: number | null;
  };
};

function validClasses(state: CharacterProgressionProjection | null | undefined) {
  return Array.isArray(state?.classes)
    ? state.classes
        .filter((entry) => entry && typeof entry.classKey === "string" && Number.isInteger(entry.level))
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];
}

export function getCharacterProgressionDisplay(state: CharacterProgressionProjection | null | undefined) {
  const classes = validClasses(state);
  const legacyClassName = String(state?.basicInfo?.class ?? "").trim();
  const legacyLevel = typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null;

  if (classes.length === 0) {
    return {
      classes,
      className: legacyClassName,
      classSummary: legacyClassName,
      totalLevel: typeof state?.totalLevel === "number" ? state.totalLevel : legacyLevel,
      structured: false,
    };
  }

  const classSummary = classes.length === 1
    ? classes[0].label || classes[0].classKey
    : classes.map((entry) => `${entry.label || entry.classKey} ${entry.level}`).join(" / ");
  const primary = state?.primaryClass ?? classes.find((entry) => entry.isPrimary) ?? classes[0];

  return {
    classes,
    className: primary?.label || primary?.classKey || legacyClassName,
    classSummary,
    totalLevel:
      typeof state?.totalLevel === "number"
        ? state.totalLevel
        : classes.reduce((sum, entry) => sum + entry.level, 0),
    structured: true,
  };
}
