import { getLevelOneCreationOptions, validateLevelOneCreation } from '../../shared/character-creation-rules.mjs';

/** Builds a legal sample through the public choices API, including dependent slots. */
export function completeGuidedCreation(overrides = {}) {
  const input = {
    raceKey: 'human', classKey: 'fighter', backgroundKey: 'urchin',
    abilityScores: { strength: 13, dexterity: 13, constitution: 13, intelligence: 12, wisdom: 12, charisma: 12 },
    narrative: { personalityTraits: ['Curioso', 'Leale'], ideal: 'Giustizia', bond: 'Famiglia', flaw: 'Impulsivo' },
    ...overrides, selections: { ...(overrides.selections ?? {}) },
  };
  for (let pass = 0; pass < 12; pass++) {
    const catalog = getLevelOneCreationOptions(input).resolved;
    if (!catalog) throw new Error('Unresolved sample catalog');
    const slots = catalog.choiceSlots;
    for (const slot of slots) {
      const previous = input.selections[slot.id] ?? [];
      if (previous.length === slot.count && previous.every(key => slot.options.some(o => o.key === key) && !slot.excludedOptions?.includes(key))) continue;
      const fixed = new Set([
        ...(catalog.race.skillProficiencies ?? []), ...(catalog.subrace?.skillProficiencies ?? []), ...(catalog.background.skillProficiencies ?? []),
        ...(catalog.race.languages ?? []), ...(catalog.subrace?.languages ?? []),
        ...(input.classKey === 'druid' ? ['druidic'] : []),
        ...(input.selections['class:sorcerer:origin']?.includes('draconic-bloodline') ? ['draconic'] : []),
        ...(catalog.race.toolProficiencies ?? []), ...(catalog.subrace?.toolProficiencies ?? []), ...(catalog.class.fixed.tools ?? []), ...(catalog.background.toolProficiencies ?? []),
        ...slots.filter(other => other.id !== slot.id && ['skill', 'tool', 'language', 'skillOrTool', 'toolOrLanguage'].includes(other.kind)).flatMap(other => input.selections[other.id] ?? []),
      ]);
      const proficiency = ['skill', 'tool', 'language', 'skillOrTool', 'toolOrLanguage'].includes(slot.kind);
      input.selections[slot.id] = slot.options.filter(o => !slot.excludedOptions?.includes(o.key) && (!proficiency || !fixed.has(o.key)))
        .slice(0, slot.count ?? 0).map(o => o.key);
    }
    if (validateLevelOneCreation(input).ok) return input;
  }
  throw new Error(`${input.raceKey}/${input.classKey}/${input.backgroundKey}: ${JSON.stringify(validateLevelOneCreation(input).issues)}`);
}
