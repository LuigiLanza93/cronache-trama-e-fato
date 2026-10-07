import { expect, test } from 'vitest';
import { evaluateRuleCondition, evaluateRuleFormula, resolveRuleEvent, validateRuleSelections } from '../../shared/character-rule-engine.mjs';
const slot = { id: 'spells', count: 1, distinct: true, options: [{ key: 'allowed' }] };
const source = { book: 'PHB-2014-it', page: 1 };

test('closed pools reject arbitrary options, including an unresolved empty pool', () => {
  expect(validateRuleSelections([{ ...slot, options: [] }], { spells: ['forged'] }).map(i => i.code)).toContain('invalid_choice');
  expect(validateRuleSelections([slot], { spells: ['allowed'], extra: ['allowed'] }).map(i => i.code)).toContain('unknown_choice_slot');
  expect(validateRuleSelections([{ ...slot, excludedOptions: ['allowed'] }], { spells: ['allowed'] }).map(i => i.code)).toContain('excluded_choice');
});

test('malformed choices fail without throwing; legacy single-name choices stay supported', () => {
  for (const selections of [null, [], { spells: {} }, { spells: [null] }, { spells: [7] }]) {
    expect(validateRuleSelections([slot], selections).some(i => i.code === 'invalid_choice_shape')).toBe(true);
  }
  expect(validateRuleSelections([slot], { spells: 'allowed' })).toEqual([]);
  expect(validateRuleSelections([slot], Object.create({ spells: ['allowed'] })).some(i => i.code === 'wrong_choice_count')).toBe(true);
});

test('cardinality and distinctness differ from equipment quantity', () => {
  expect(validateRuleSelections([{ ...slot, count: 2 }], { spells: ['allowed', 'allowed'] }).some(i => i.code === 'duplicate_choice')).toBe(true);
  expect(validateRuleSelections([{ ...slot, count: 2, distinct: false }], { spells: ['allowed', 'allowed'] })).toEqual([]);
  expect(() => validateRuleSelections([{ ...slot, options: ['same', 'same'] }], {})).toThrow();
});

test('conditions distinguish class and total levels, and support OR prerequisites', () => {
  const context = { totalLevel: 5, classLevels: { warlock: 2 }, abilities: { strength: 10, dexterity: 14 } };
  expect(evaluateRuleCondition({ op: 'totalLevelAtLeast', value: 5 }, context)).toBe(true);
  expect(evaluateRuleCondition({ op: 'classLevelAtLeast', classKey: 'warlock', value: 3 }, context)).toBe(false);
  expect(evaluateRuleCondition({ op: 'any', args: [
    { op: 'abilityAtLeast', ability: 'strength', value: 13 }, { op: 'abilityAtLeast', ability: 'dexterity', value: 13 },
  ] }, context)).toBe(true);
  expect(() => evaluateRuleCondition({ op: 'any', args: [{ op: 'always' }, { op: 'javascript' }] })).toThrow();
});

test('closed formulas handle preparation and ritual limits with explicit rounding', () => {
  const context = { totalLevel: 5, classLevels: { wizard: 2 }, abilities: { intelligence: 17 } };
  expect(evaluateRuleFormula({ op: 'max', args: [{ op: 'constant', value: 1 }, { op: 'sum', args: [
    { op: 'abilityModifier', ability: 'intelligence' }, { op: 'classLevel', classKey: 'wizard' },
  ] }] }, context)).toBe(5);
  expect(evaluateRuleFormula({ op: 'ceil', arg: { op: 'divide', left: { op: 'totalLevel' }, right: { op: 'constant', value: 2 } } }, context)).toBe(3);
  expect(evaluateRuleFormula({ op: 'proficiencyBonus' }, context)).toBe(3);
  expect(() => evaluateRuleFormula({ op: 'divide', left: { op: 'constant', value: 1 }, right: { op: 'constant', value: 0 } })).toThrow();
  expect(() => evaluateRuleFormula({ op: 'lookup', key: { op: 'constant', value: 3 }, table: { 2: 7 } })).toThrow();
});

test('event resolution orders dependencies and withholds grants on invalid decisions', () => {
  const parent = { id: 'patron', version: '1', source, trigger: { event: 'creation' }, decisions: [{ ...slot, id: 'patron', options: ['fiend', 'fey'] }] };
  const child = { id: 'fiend-options', version: '1', source, trigger: { event: 'creation' }, dependsOn: ['patron'], when: { op: 'selected', choiceId: 'patron', key: 'fiend' },
    grants: [{ id: 'fiend-list', kind: 'spellAccess', key: 'command' }] };
  const result = resolveRuleEvent([child, parent], { type: 'creation' }, {}, { patron: ['fiend'] });
  expect(result.issues).toEqual([]);
  expect(result.grants).toMatchObject([{ id: 'fiend-list', kind: 'spellAccess', ruleId: 'fiend-options', ruleVersion: '1', source }]);
  expect(resolveRuleEvent([child, parent], { type: 'creation' }, {}, { patron: ['fey'] }).grants).toEqual([]);
  expect(resolveRuleEvent([child, parent], { type: 'creation' }, {}, { patron: ['fiend', 'forged'] }).grants).toEqual([]);
  expect(() => resolveRuleEvent([{ ...parent, dependsOn: ['fiend-options'] }, child], { type: 'creation' })).toThrow(/ciclo/);
});

test('class-event triggers cannot unlock a class feature from total level alone', () => {
  const rules = [{ id: 'blade', version: '1', source, trigger: { event: 'classLevelGain', classKey: 'warlock', atClassLevel: 3 }, grants: [{ id: 'boon', kind: 'feature' }] }];
  expect(resolveRuleEvent(rules, { type: 'classLevelGain', classKey: 'warlock' }, { totalLevel: 5, classLevels: { warlock: 2 } }).grants).toEqual([]);
  expect(resolveRuleEvent(rules, { type: 'classLevelGain', classKey: 'fighter' }, { totalLevel: 5, classLevels: { warlock: 3 } }).grants).toEqual([]);
  expect(resolveRuleEvent(rules, { type: 'classLevelGain', classKey: 'warlock' }, { totalLevel: 5, classLevels: { warlock: 3 } }).grants).toHaveLength(1);
});
