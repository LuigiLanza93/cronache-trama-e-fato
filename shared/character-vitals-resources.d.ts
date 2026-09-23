import type { ClassLevelEntry, ClassRule, HitDieSize } from "./character-class-rules";

export type HitDiePool = { dieSize: HitDieSize; maximum: number; remaining: number };
export type ResourceKind = "SPELLCASTING" | "PACT_MAGIC" | "CLASS_RESOURCE" | "MANUAL";
export type ResourceResetPolicy = "SHORT_REST" | "LONG_REST" | "MANUAL" | "NONE";
export type ResourcePool = { id: string; kind: ResourceKind; resetPolicy: ResourceResetPolicy; maximum: Record<number, number>; used: Record<number, number>; sourceClassKey?: string | null };
export const REST_POLICY_V1: Readonly<{ id: string; maxShortRestsSinceLongRest: number; hitDieSpendOrder: readonly HitDieSize[] }>;
export const RESOURCE_KINDS: readonly ResourceKind[];
export const RESOURCE_RESET_POLICIES: readonly ResourceResetPolicy[];
export const SPELLCASTING_CONVERSION_COSTS: Readonly<Record<number, number>>;
export function resolveConstitutionModifier(score: number): number;
export function resolveLevelUpHitPoints(input: { hitDieSize: HitDieSize; constitutionModifier: number }): { hitDieSize: HitDieSize; constitutionModifier: number; gained: number; method: "HOUSE_RULE_MAX"; policyVersion: string };
export function deriveHitDiePools(entries: ClassLevelEntry[], classRules?: Record<string, ClassRule> | ClassRule[]): { pools: HitDiePool[]; unresolvedClassKeys: string[] };
export function normalizeHitDiePools(pools: HitDiePool[]): HitDiePool[];
export function applyShortRestToHitDicePools(input: { pools: HitDiePool[]; currentHitPoints: number; maximumHitPoints: number; constitutionModifier: number; shortRestsUsedSinceLongRest?: number }): { applied: boolean; reason: string | null; pools: HitDiePool[]; currentHitPoints: number; healingApplied: number; hitDiceSpent: number; hitDiceSpentBySize: Record<string, number>; shortRestsUsedSinceLongRest: number };
export function applyLongRestToHitDicePools(input: { pools: HitDiePool[]; shortRestsUsedSinceLongRest?: number }): { pools: HitDiePool[]; hitDiceRecovered: number; shortRestsUsedSinceLongRest: 0 };
export function normalizeResourcePool(pool: ResourcePool): ResourcePool;
export function resetResourcePools(pools: ResourcePool[], restType: "SHORT_REST" | "LONG_REST"): ResourcePool[];
export function convertSpellcastingPool(pool: ResourcePool, input: { targetLevel: number; selections: Record<number, number>; costs?: Record<number, number> }): { pool: ResourcePool; cost: number; pointsSpent: number; excess: number };
