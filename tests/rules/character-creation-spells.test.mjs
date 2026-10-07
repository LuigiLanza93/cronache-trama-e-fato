import { expect, test } from 'vitest';
import { projectGuidedCreationSpells } from '../../shared/character-creation-spells.mjs';

test('same cantrip from race and class keeps both casting abilities and sources', () => {
  const spells = projectGuidedCreationSpells({
    identity: { raceKey: 'gnome', subraceKey: 'forest', classKey: 'bard' },
    spellcasting: { ability: 'charisma' },
    choiceSlots: [{ id: 'class:bard:cantrips', kind: 'cantrip', owner: 'class' }],
    choices: { 'class:bard:cantrips': ['Illusione Minore'] },
  });
  expect(spells).toHaveLength(2);
  expect(spells).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'Classe', ability: 'charisma' }),
    expect.objectContaining({ source: 'Razza', ability: 'intelligence' }),
  ]));
  expect(spells[0].spellId).toBe(spells[1].spellId);
});

test('magic initiate and ritual book have their own usage and casting ability', () => {
  const spells = projectGuidedCreationSpells({
    identity: { raceKey: 'variant-human', classKey: 'fighter' },
    choiceSlots: [
      { id: 'feat:magicInitiate:spell', kind: 'spell', owner: 'feat' },
      { id: 'feat:ritualCaster:rituals', kind: 'spell', owner: 'feat' },
    ],
    choices: { 'feat:magicInitiate:class': ['cleric'], 'feat:magicInitiate:spell': ['Benedizione'],
      'feat:ritualCaster:class': ['wizard'], 'feat:ritualCaster:rituals': ['Allarme'] },
  });
  expect(spells[0]).toMatchObject({ ability: 'wisdom', featureKey: 'magicInitiate' });
  expect(spells[0].usage).toContain('Una volta per riposo lungo');
  expect(spells[1]).toMatchObject({ ability: 'intelligence', role: 'ritualbook' });
  expect(spells[1].usage).toContain('Solo come rituale');
});
