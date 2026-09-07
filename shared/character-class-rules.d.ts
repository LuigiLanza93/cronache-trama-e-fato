export type AbilityKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
export type HitDieSize = 6 | 8 | 10 | 12;
export type CasterKind = "NONE" | "FULL" | "HALF" | "THIRD" | "PACT";
export type ClassLevelEntry = { classKey: string; level: number; subclassKey?: string | null; isPrimary?: boolean };
export type AbilityRequirement = { ability: AbilityKey; minimum: number };
export type SpellSlotLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ProgressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
export type SpellSlotMaximums = Record<SpellSlotLevel, number>;
/** A table lookup result. The level can be an effective multiclass or single-source progression level. */
export type SpellcastingSlots = { progressionLevel: number; slots: SpellSlotMaximums };
export type SpellcastingProgression = {
  mode: "NONE" | "SINGLE_SOURCE" | "MULTICLASS";
  progressionLevel: number;
  slots: SpellSlotMaximums;
  activeSourceClassKeys: string[];
  unresolvedClassKeys: string[];
};
export type PactMagicSlots = { pactMagicLevel: number; slotCount: number; slotLevel: 1 | 2 | 3 | 4 | 5 | null };
export type ClassRule = {
  key: string;
  labels: { it: string; en: string };
  aliases: readonly string[];
  hitDie?: HitDieSize;
  primaryAbilities: readonly AbilityKey[];
  multiclassPrerequisites: { anyOf: readonly (readonly AbilityRequirement[])[] };
  casterKind?: CasterKind;
  /** Null means that this class has no innate Spellcasting/Pact Magic ability. */
  spellcastingAbility: AbilityKey | null;
  /** First class level at which this caster source has Spellcasting slots. */
  spellcastingStartLevel: number | null;
  subclassLevel?: number;
  source: { rulesetId: string; version: string };
};
export type SubclassRule = {
  key: string;
  classKey: string;
  labels: { it: string; en: string };
  aliases: readonly string[];
  casterKind?: CasterKind;
  /** Defined for a subclass only when it overrides the parent caster profile. */
  spellcastingAbility?: AbilityKey;
  spellcastingStartLevel?: number;
  source: { rulesetId: string; version: string };
};
export const CHARACTER_RULESET: Readonly<{ id: string; version: string; source: string }>;
export const ABILITY_KEYS: readonly AbilityKey[];
export const HIT_DIE_SIZES: readonly HitDieSize[];
export const CASTER_KINDS: readonly CasterKind[];
export const SPELLCASTING_SLOT_PROGRESSION: Readonly<Record<ProgressionLevel, readonly number[]>>;
export const PACT_MAGIC_SLOT_PROGRESSION: Readonly<Record<ProgressionLevel, Readonly<{ slotCount: number; slotLevel: 1 | 2 | 3 | 4 | 5 }>>>;
export const CLASS_RULES: Readonly<Record<string, ClassRule>>;
export const SUBCLASS_RULES: Readonly<Record<string, SubclassRule>>;
export function normalizeClassKey(value: unknown, rules?: Record<string, ClassRule> | ClassRule[]): string | null;
export function normalizeSubclassKey(value: unknown, rules?: Record<string, SubclassRule> | SubclassRule[]): string | null;
export function getClassRule(value: unknown, rules?: Record<string, ClassRule> | ClassRule[]): ClassRule | null;
export function getSubclassRule(value: unknown, rules?: Record<string, SubclassRule> | SubclassRule[]): SubclassRule | null;
export function resolveCharacterLevel(entries: ClassLevelEntry[]): number;
export function resolveClassLevel(entries: ClassLevelEntry[], classKey: string, classRules?: Record<string, ClassRule> | ClassRule[]): number;
export function resolveProficiencyBonus(levelOrEntries: number | ClassLevelEntry[]): number;
export function resolveHitDicePools(entries: ClassLevelEntry[], classRules?: Record<string, ClassRule> | ClassRule[]): { pools: Record<`d${HitDieSize}`, number>; unresolvedClassKeys: string[] };
export function resolveEffectiveCasterLevel(entries: ClassLevelEntry[], options?: { classRules?: Record<string, ClassRule> | ClassRule[]; subclassRules?: Record<string, SubclassRule> | SubclassRule[] }): { level: number; unresolvedClassKeys: string[] };
export function resolvePactMagicLevel(entries: ClassLevelEntry[], classRules?: Record<string, ClassRule> | ClassRule[]): { level: number; unresolvedClassKeys: string[] };
export function resolveSpellcastingSlots(effectiveCasterLevel: number): SpellcastingSlots;
export function resolveSpellcastingProgression(entries: ClassLevelEntry[], options?: { classRules?: Record<string, ClassRule> | ClassRule[]; subclassRules?: Record<string, SubclassRule> | SubclassRule[] }): SpellcastingProgression;
export function resolvePactMagicSlots(pactMagicLevel: number): PactMagicSlots;
export function resolveSubclassEligibility(entry: ClassLevelEntry, options?: { classRules?: Record<string, ClassRule> | ClassRule[]; subclassRules?: Record<string, SubclassRule> | SubclassRule[] }): { status: "MANUAL" | "INVALID" | "ELIGIBLE" | "NOT_YET_ELIGIBLE"; eligible: boolean; requiredLevel: number | null; reason: string | null };
export function evaluateMulticlassPrerequisites(currentEntries: ClassLevelEntry[], targetClassKey: string, abilityScores: Partial<Record<AbilityKey, number>>, classRules?: Record<string, ClassRule> | ClassRule[]): { status: "MANUAL" | "ELIGIBLE" | "INELIGIBLE"; eligible: boolean; failedClassKeys: string[]; reason: string | null };
export type ProgressionSummary = {
  characterLevel: number;
  proficiencyBonus: number;
  hitDicePools: Record<`d${HitDieSize}`, number>;
  effectiveCasterLevel: number;
  pactMagicLevel: number;
  spellcastingSlots: SpellcastingProgression;
  pactMagicSlots: PactMagicSlots;
  unresolvedClassKeys: string[];
};
export type SubclassEligibility = { status: "MANUAL" | "INVALID" | "ELIGIBLE" | "NOT_YET_ELIGIBLE"; eligible: boolean; requiredLevel: number | null; reason: string | null };
export type ClassAdvancementPreview = {
  status: "READY" | "CHARACTER_LEVEL_LIMIT" | "MANUAL" | "INVALID_SUBCLASS" | "SUBCLASS_NOT_YET_AVAILABLE" | "SUBCLASS_REQUIRED";
  canAdvance: boolean;
  reason: string | null;
  targetClassKey: string;
  mode: "INCREMENT_EXISTING" | "ADD_NEW_CLASS";
  before: ProgressionSummary;
  after: ProgressionSummary | null;
  classesAfter: ClassLevelEntry[] | null;
  subclassEligibility: SubclassEligibility | { status: "MANUAL"; eligible: false; requiredLevel: null; reason: string } | null;
};
export function resolveProgressionSummary(entries: ClassLevelEntry[], options?: { classRules?: Record<string, ClassRule> | ClassRule[]; subclassRules?: Record<string, SubclassRule> | SubclassRule[] }): ProgressionSummary;
export function resolveClassAdvancementPreview(currentEntries: ClassLevelEntry[], targetClassKey: string, options?: { classRules?: Record<string, ClassRule> | ClassRule[]; subclassRules?: Record<string, SubclassRule> | SubclassRule[]; targetSubclassKey?: string | null }): ClassAdvancementPreview;
