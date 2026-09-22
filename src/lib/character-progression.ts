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
};

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
