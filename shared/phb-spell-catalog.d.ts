export interface PhbSpellSource {
  readonly path: string;
  readonly line: number;
  readonly endLine: number;
  readonly page: number;
}
export interface PhbSpellDefinition {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly level: number;
  readonly school: string | null;
  readonly ritual: boolean;
  readonly attack_roll: boolean;
  /** Complete source section, including casting metadata and higher-level effects. */
  readonly description: string;
  readonly metadataText: string;
  readonly source: PhbSpellSource;
  readonly classLists: readonly { readonly classKey: string; readonly line: number; readonly page: number }[];
  readonly warnings: readonly string[];
}
export const PHB_SPELL_CATALOG: {
  readonly version: string;
  readonly source: string;
  readonly sourceSha256: string;
  readonly spells: readonly PhbSpellDefinition[];
};
export const PHB_SPELL_CATALOG_VERSION: string;
export const PHB_SPELL_CLASSES: readonly string[];
export function resolvePhbSpell(value: string | null | undefined): PhbSpellDefinition | null;
export function listPhbSpells(classKey: string, filters?: { level?: number; school?: string; ritual?: boolean; attackRoll?: boolean }): PhbSpellDefinition[];
