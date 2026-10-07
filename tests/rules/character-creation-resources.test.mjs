import { expect, test } from 'vitest';
import { resolveCreationResourcePools, reconcileCreationResourcePools } from '../../shared/character-creation-resources.mjs';

const character = (classKey, features) => ({ identity: { classKey }, features: features.map(key => ({ key })), abilities: { final: { charisma: 12, wisdom: 12 } } });

test('acquired resources follow their class level and current abilities without restoring spent uses', () => {
  const bard = character('bard', ['bardic-inspiration']);
  const pools = resolveCreationResourcePools(bard);
  pools[0].used['0'] = 1;
  const next = reconcileCreationResourcePools(pools, bard, { classLevels: { bard: 5, fighter: 10 }, abilities: { charisma: 18 } });
  expect(next[0]).toMatchObject({ label: 'Ispirazione Bardica · d8', resetPolicy: 'SHORT_REST', maximum: { '0': 4 }, used: { '0': 1 } });
  const paladin = character('paladin', ['lay-on-hands', 'divine-sense']);
  expect(resolveCreationResourcePools(paladin, { classLevels: { paladin: 3 } }).find(p => p.featureId === 'lay-on-hands').maximum).toEqual({ '0': 15 });
  expect(resolveCreationResourcePools(character('barbarian', ['rage']), { classLevels: { barbarian: 20 } })[0]).toMatchObject({ resetPolicy: 'NONE', maximum: { '0': 0 } });
});

test('manual overrides remain effective while the derived capacity updates', () => {
  const bard = character('bard', ['bardic-inspiration']);
  const pool = { ...resolveCreationResourcePools(bard)[0], tiers: [{ tierKey: '0', derivedMaximum: 1, maximumOverride: 7 }], used: { '0': 2 } };
  const next = reconcileCreationResourcePools([pool], bard, { abilities: { charisma: 18 } })[0];
  expect(next.maximum).toEqual({ '0': 7 });
  expect(next.tiers[0]).toMatchObject({ derivedMaximum: 4, maximumOverride: 7 });
  expect(next.used).toEqual({ '0': 2 });
  expect(reconcileCreationResourcePools([], bard)).toEqual([]);
});
