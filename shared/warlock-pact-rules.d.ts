export type PactBoonKey = "chain" | "blade" | "tome";
export type PactBoonOption = { key: PactBoonKey; label: string };
export const PACT_BOONS: Readonly<Record<PactBoonKey, Readonly<PactBoonOption>>>;
export const PACT_BOON_OPTIONS: readonly Readonly<PactBoonOption>[];
export function normalizePactBoonKey(value: unknown): PactBoonKey | null;
export function pactBoonSummary(value: unknown): PactBoonOption | null;
export function canUsePactBlade(character: { classes?: Array<{ classKey?: string | null; level?: number | null; pactBoonKey?: string | null; pactBoon?: { key: string } | null }> } | null | undefined): boolean;
