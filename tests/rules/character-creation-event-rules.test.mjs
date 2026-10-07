import { expect, test } from 'vitest';
import { getLevelOneCreationOptions, materializeLevelOneCharacter, validateLevelOneCreation } from '../../shared/character-creation-rules.mjs';

function complete(classKey, initial = {}) {
  const input = {
    raceKey: 'human', classKey, backgroundKey: 'urchin',
    abilityScores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
    narrative: { personalityTraits: ['Curioso', 'Tenace'], ideal: 'Libertà', bond: 'Famiglia', flaw: 'Impulsivo' },
    selections: { ...initial },
  };
  for (let pass = 0; pass < 5; pass++) {
    const catalog = getLevelOneCreationOptions(input);
    const slots = catalog.resolved.choiceSlots;
    for (const slot of slots) {
      if (input.selections[slot.id]?.length === slot.count) continue;
      const taken = new Set(['common', ...(classKey === 'druid' ? ['druidic'] : []),
        ...catalog.backgrounds.urchin.skillProficiencies, ...catalog.backgrounds.urchin.toolProficiencies,
        ...(catalog.classes[classKey].fixed.tools ?? []),
        ...slots.filter(s => s.id !== slot.id && ['skill', 'language', 'tool', 'skillOrTool'].includes(s.kind)).flatMap(s => input.selections[s.id] ?? []),
      ]);
      input.selections[slot.id] = slot.options.map(option => option.key)
        .filter(key => !slot.excludedOptions?.includes(key))
        .filter(key => !['skill', 'language', 'tool'].includes(slot.kind) || !taken.has(key)).slice(0, slot.count);
    }
  }
  const validation = validateLevelOneCreation(input);
  expect(validation.ok, JSON.stringify(validation.issues)).toBe(true);
  return { input, character: materializeLevelOneCharacter(input) };
}

test('Druidic is automatic and cannot be offered as an unrestricted extra language', () => {
  const { character, input } = complete('druid');
  expect(character.proficiencies.languages).toContain('druidic');
  const languageSlot = getLevelOneCreationOptions(input).resolved.choiceSlots.find(s => s.id === 'race:human:language');
  expect(languageSlot.options.map(o => o.key)).not.toContain('druidic');
});

test('Draconic is granted only by the draconic sorcerer origin and duplicate selections are blocked', () => {
  const draconic = complete('sorcerer', { 'class:sorcerer:origin': ['draconic-bloodline'] });
  expect(draconic.character.proficiencies.languages).toContain('draconic');
  const wild = complete('sorcerer', { 'class:sorcerer:origin': ['wild-magic'] });
  expect(wild.character.proficiencies.languages).not.toContain('draconic');
  draconic.input.selections['race:human:language'] = ['draconic'];
  expect(validateLevelOneCreation(draconic.input).issues.some(i => i.code === 'duplicate_proficiency')).toBe(true);
});

test('Bard chooses the owned starting instrument independently from three instrument proficiencies', () => {
  const { character } = complete('bard', {
    'class:bard:instruments': ['flute', 'drum', 'horn'],
    'class:bard:starting-instrument': ['lute'],
  });
  expect(character.proficiencies.tools).toEqual(expect.arrayContaining(['flute', 'drum', 'horn']));
  expect(character.proficiencies.tools).not.toContain('lute');
  expect(character.startingEquipment.chosen).toContain('lute');
  expect(character.startingEquipment.chosen).not.toContain('flute');
});

test('Rogue expertise can use competencies obtained by feat and real duplicate replacement choices', () => {
  const options = getLevelOneCreationOptions({ raceKey: 'variant-human', classKey: 'rogue', backgroundKey: 'sailor', selections: {
    'race:variant-human:feat': ['skilled'], 'feat:skilled:proficiencies': ['medicine', 'religion', 'nature'],
    'replacement:skills': ['arcana'], 'class:rogue:skills': ['stealth', 'deception', 'insight', 'investigation'],
  } });
  const keys = options.resolved.choiceSlots.find(s => s.id === 'class:rogue:expertise').options.map(o => o.key);
  expect(keys).toEqual(expect.arrayContaining(['medicine', 'religion', 'nature', 'stealth']));
  // An unknown replacement slot must not create a phantom expertise option.
  expect(keys).not.toContain('arcana');
  const replacement = getLevelOneCreationOptions({ raceKey: 'elf', subraceKey: 'wood', classKey: 'rogue', backgroundKey: 'sailor', selections: { 'replacement:skills': ['arcana'] } });
  expect(replacement.resolved.choiceSlots.find(s => s.id === 'class:rogue:expertise').options.map(o => o.key)).toContain('arcana');
});

test('Malformed selections are rejected by the shared validator before creation can be saved', () => {
  const { input } = complete('bard');
  input.selections['class:bard:starting-instrument'] = [{ key: 'lute' }];
  expect(validateLevelOneCreation(input).issues.some(i => i.code === 'invalid_choice_shape')).toBe(true);
  input.selections['class:bard:starting-instrument'] = ['lute'];
  input.selections['class:bard:weapon'] = ['class:bard:weapon:3', 'class:bard:weapon:3'];
  expect(() => validateLevelOneCreation(input)).not.toThrow();
  expect(validateLevelOneCreation(input).issues.some(i => i.code === 'duplicate_choice')).toBe(true);
});

test('Invalid spellbook keys, scores and catalog identifiers return issues without throwing', () => {
  const { input } = complete('wizard');
  input.selections['class:wizard:spellbook'] = ['constructor', '__proto__'];
  input.abilityScores.intelligence = 'invalid';
  expect(() => validateLevelOneCreation(input)).not.toThrow();
  expect(validateLevelOneCreation(input).ok).toBe(false);
  for (const key of ['raceKey', 'classKey', 'backgroundKey']) {
    const malformed = { ...input, [key]: 'constructor' };
    expect(() => validateLevelOneCreation(malformed)).not.toThrow();
    expect(validateLevelOneCreation(malformed).ok).toBe(false);
  }
  for (const [classKey, slot] of [['warlock', 'class:warlock:patron'], ['sorcerer', 'class:sorcerer:origin'], ['cleric', 'class:cleric:domain']]) {
    const malformed = complete(classKey).input;
    malformed.selections[slot] = ['constructor'];
    expect(() => validateLevelOneCreation(malformed)).not.toThrow();
    expect(validateLevelOneCreation(malformed).ok).toBe(false);
  }
});
