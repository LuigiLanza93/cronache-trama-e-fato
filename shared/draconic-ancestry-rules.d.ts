export type DraconicDamageType = "acid" | "cold" | "fire" | "lightning" | "poison";

export interface DraconicAncestrySummary {
  key: string;
  label: string;
  damageType: DraconicDamageType;
  damageLabel: string;
}

export const DRACONIC_BLOODLINE_SUBCLASS_KEY: "draconic-bloodline";
export const DRACONIC_ANCESTRIES: Readonly<Record<string, Readonly<DraconicAncestrySummary>>>;
export const DRACONIC_ANCESTRY_OPTIONS: readonly Readonly<DraconicAncestrySummary>[];
export function normalizeDraconicAncestryKey(value: unknown): string | null;
export function draconicAncestrySummary(value: unknown): DraconicAncestrySummary | null;
export function requiresDraconicAncestry(classKey: unknown, subclassKey: unknown): boolean;
