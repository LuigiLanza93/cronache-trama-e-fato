export type PassiveHitPointBonus = { bonusTotal: number; breakdown: Array<{ label: string; value: number }> };
export function resolvePassiveHitPointBonus(character: any, options?: { capabilities?: any[]; context?: any; resolvedAbilityScores?: Record<string, number> | null }): PassiveHitPointBonus;
export function reconcilePassiveHitPoints<T extends { maximumHitPoints: number; currentHitPoints: number; passiveBonusApplied?: number }>(state: T, desiredBonus: number): T & { passiveBonusApplied: number };
