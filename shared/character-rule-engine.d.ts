export interface RuleIssue { path: string; code: string; message: string; meta?: Record<string, unknown>; }
export interface RuleChoice { id: string; kind?: string; count: number | null; distinct?: boolean; options: readonly (string | { key: string; [key: string]: unknown })[]; excludedOptions?: readonly string[]; countFormula?: RuleFormula; [key: string]: unknown; }
export interface RuleContext { totalLevel?: number; classLevels?: Record<string, number>; abilities?: Record<string, number>; proficiencies?: Record<string, string[]>; features?: string[]; knownSpells?: string[]; campaignOptions?: Record<string, boolean>; selections?: Record<string, string | string[]>; }
export type RuleFormula =
  | { op: 'constant'; value: number }
  | { op: 'abilityScore' | 'abilityModifier'; ability: string }
  | { op: 'classLevel'; classKey: string }
  | { op: 'totalLevel' | 'proficiencyBonus' }
  | { op: 'sum' | 'multiply' | 'min' | 'max'; args: RuleFormula[] }
  | { op: 'floor' | 'ceil'; arg: RuleFormula }
  | { op: 'divide'; left: RuleFormula; right: RuleFormula }
  | { op: 'lookup'; key: RuleFormula; table: Record<string, number> };
export type RuleCondition =
  | { op: 'always' }
  | { op: 'all' | 'any'; args: RuleCondition[] }
  | { op: 'not'; arg: RuleCondition }
  | { op: 'abilityAtLeast'; ability: string; value: number }
  | { op: 'classLevelAtLeast'; classKey: string; value: number }
  | { op: 'totalLevelAtLeast'; value: number }
  | { op: 'hasProficiency'; category: string; key: string }
  | { op: 'hasFeature' | 'hasKnownSpell' | 'campaignOption'; key: string }
  | { op: 'selected'; choiceId: string; key: string };
export type RuleEventType = 'creation' | 'classLevelGain' | 'totalLevelGain' | 'preparationChange' | 'bookCopy' | 'rest' | 'manualAdjustment';
export interface RuleDefinition { id: string; version: string; source: Record<string, unknown>; trigger: { event: RuleEventType; classKey?: string; atClassLevel?: number; atTotalLevel?: number }; when?: RuleCondition; dependsOn?: string[]; decisions?: RuleChoice[]; grants?: { id: string; kind: string; valueFormula?: RuleFormula; [key: string]: unknown }[]; }
export function evaluateRuleFormula(formula: RuleFormula, context?: RuleContext): number;
export function evaluateRuleCondition(condition: RuleCondition, context?: RuleContext): boolean;
export function validateRuleSelections(slots: readonly RuleChoice[], selections?: unknown, options?: { pathPrefix?: string }): RuleIssue[];
export function resolveRuleEvent(definitions: readonly RuleDefinition[], event: { type: RuleEventType; classKey?: string }, context?: RuleContext, selections?: Record<string, string | string[]>): { slots: RuleChoice[]; grants: Record<string, unknown>[]; issues: RuleIssue[] };
