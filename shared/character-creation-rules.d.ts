export type AbilityKey = "strength"|"dexterity"|"constitution"|"intelligence"|"wisdom"|"charisma";
export type CreationSelection = Record<string, string | string[] | undefined>;
export interface CustomBackgroundInput {name:string;featureBackgroundKey:string;equipmentBackgroundKey:string;backgroundDetails?:string;}
export interface LevelOneCreationInput { raceKey:string; subraceKey?:string; classKey:string; backgroundKey:string; customBackground?:CustomBackgroundInput; abilityScores:Record<AbilityKey,number>; selections?:CreationSelection; narrative?:{personalityTraits:string[];ideal:string;bond:string;flaw:string;backgroundDetails?:string}; }
export interface CreationIssue { path:string; code:string; message:string; meta?:Record<string,unknown>; }
export const CHARACTER_CREATION_RULESET: Readonly<Record<string,string>>;
export const POINT_BUY_COSTS: Readonly<Record<number,number>>;
export const SKILLS: Readonly<Record<string,string>>;
export const LANGUAGES: Readonly<Record<string,string>>;
export const RACES: Readonly<Record<string,unknown>>;
export const LEVEL_ONE_CLASSES: Readonly<Record<string,unknown>>;
export const BACKGROUNDS: Readonly<Record<string,unknown>>;
export const FEAT_FIXED_BONUSES: Readonly<Record<string,Readonly<Record<AbilityKey,number>>>>;
export const CLERIC_DOMAINS: Readonly<Record<string,unknown>>;
export const FIRST_LEVEL_SUBCLASS_FEATURES: Readonly<Record<string,unknown>>;
export const CLASS_FIXED_EQUIPMENT: Readonly<Record<string,readonly string[]>>;
export const GENERIC_EQUIPMENT: Readonly<Record<string,unknown>>;
export function getLevelOneCreationOptions(input?: Partial<LevelOneCreationInput>): Readonly<Record<string,unknown>>;
export function normalizeLevelOneCreationInput(input: LevelOneCreationInput): LevelOneCreationInput;
export function validateLevelOneCreation(input: LevelOneCreationInput): { ok:boolean; issues:readonly CreationIssue[]; normalizedInput:LevelOneCreationInput; resolved:Record<string,unknown>|null };
export function materializeLevelOneCharacter(input: LevelOneCreationInput): { ok:boolean; issues?:readonly CreationIssue[]; identity?:Record<string,string|null>; [key:string]:unknown };
export function resolveLevelOneCreationPreview(input?: Partial<LevelOneCreationInput>): {ok:boolean;issues:readonly CreationIssue[];resolved:Record<string,unknown>|null};
