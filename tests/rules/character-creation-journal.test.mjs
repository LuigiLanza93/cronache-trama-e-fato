import { expect, test } from 'vitest';
import { RACES, LEVEL_ONE_CLASSES, BACKGROUNDS, FEATS, materializeLevelOneCharacter, resolveLevelOneCreationPreview } from '../../shared/character-creation-rules.mjs';
import { resolveLevelOneCreationJournal, buildCreationPreviewHash } from '../../shared/character-creation-journal.mjs';
import { completeGuidedCreation } from '../helpers/complete-guided-creation.mjs';

test('all PHB origins, starting classes and backgrounds have a completable guided path', () => {
  for (const [raceKey, race] of Object.entries(RACES)) for (const subraceKey of race.subraces ? Object.keys(race.subraces) : [undefined]) {
    for (const classKey of Object.keys(LEVEL_ONE_CLASSES)) for (const backgroundKey of Object.keys(BACKGROUNDS)) {
      const input = completeGuidedCreation({ raceKey, subraceKey, classKey, backgroundKey });
      const character = materializeLevelOneCharacter(input);
      expect(character.ok).toBe(true);
      expect(character.startingEquipment.fixed.concat(character.startingEquipment.chosen)).not.toContain(undefined);
      expect(character.startingEquipment.grants.map(g => g.key)).toEqual(character.startingEquipment.fixed.concat(character.startingEquipment.chosen));
    }
  }
}, 30_000);

test('all 42 talents expose and validate their level-one nested choices when prerequisites are met', () => {
  for (const feat of Object.keys(FEATS)) {
    const selections = { 'race:variant-human:feat': [feat], 'race:variant-human:abilities': ['wisdom', 'charisma'], 'class:cleric:domain': ['life-domain'] };
    for (const key of ['magicInitiate', 'ritualCaster', 'spellSniper']) if (feat === key) selections[`feat:${key}:class`] = ['wizard'];
    const input = completeGuidedCreation({ raceKey: 'variant-human', classKey: 'cleric', selections });
    const result = resolveLevelOneCreationJournal(input);
    expect(result.ok, feat).toBe(true);
    expect(result.grants.some(g => g.grantKind === 'FEATURE' && g.payload.sourceFeatureId === `creation:feat:${feat}`)).toBe(true);
    expect(resolveLevelOneCreationPreview(input).resolved.abilities).toEqual(result.materialized.abilities);
  }
});

test('ledger preserves duplicate sources, expertise and exact equipment acquisition links', () => {
  const input = completeGuidedCreation({ raceKey: 'elf', subraceKey: 'wood', classKey: 'rogue', backgroundKey: 'sailor' });
  const journal = resolveLevelOneCreationJournal(input);
  expect(journal.grants.filter(g => g.grantKind === 'FEATURE').some(g => g.payload.sourceFeatureId?.includes('proficiencies:'))).toBe(false);
  const perception = journal.grants.filter(g => g.aggregateKey === 'PROFICIENCY:skills:perception' && g.payload.multiplier === 1);
  expect(perception.map(g => g.sourceSnapshot.kind).sort()).toEqual(['background', 'race']);
  for (const grant of journal.grants.filter(g => g.grantKind === 'EQUIPMENT')) {
    expect(['background', 'class']).toContain(grant.sourceSnapshot.kind);
    expect(journal.decisions.some(d => d.definitionId === grant.decisionDefinitionId)).toBe(true);
  }
  expect(journal.grants.filter(g => g.grantKind === 'EQUIPMENT')).toHaveLength(journal.materialized.startingEquipment.fixed.length + journal.materialized.startingEquipment.chosen.length);
  const envelope = { name: 'Arin', alignment: 'Neutrale' };
  expect(buildCreationPreviewHash(envelope, journal)).toBe(buildCreationPreviewHash(envelope, resolveLevelOneCreationJournal(input)));
  expect(buildCreationPreviewHash({ ...envelope, name: 'Different' }, journal)).not.toBe(buildCreationPreviewHash(envelope, journal));
});

test('innate spells and domain grants preserve their actual origin', () => {
  const gnome = resolveLevelOneCreationJournal(completeGuidedCreation({ raceKey: 'gnome', subraceKey: 'forest', classKey: 'rogue' }));
  expect(gnome.grants.filter(g => g.grantKind === 'SPELL_GRANT')).toContainEqual(expect.objectContaining({ sourceSnapshot: expect.objectContaining({ kind: 'subrace', key: 'forest' }), decisionDefinitionId: 'creation:subrace' }));
  const cleric = resolveLevelOneCreationJournal(completeGuidedCreation({ classKey: 'cleric', selections: { 'class:cleric:domain': ['life-domain'] } }));
  expect(cleric.grants.filter(g => g.grantKind === 'SPELL_GRANT' && g.decisionDefinitionId === 'class:cleric:domain')).toHaveLength(2);
});

test('background alternatives replace privileges and do not manufacture additional proficiencies', () => {
  for (const backgroundKey of ['sailor', 'pirate']) {
    const input = completeGuidedCreation({ backgroundKey, selections: { [`background:${backgroundKey}:privilege`]: ['badReputation'] } });
    const result = materializeLevelOneCharacter(input);
    expect(result.background.privilege.label.it).toBe('Pessima Fama');
    expect(result.features.filter(f => f.key.startsWith('background:'))).toHaveLength(1);
  }
  const noble = materializeLevelOneCharacter(completeGuidedCreation({ backgroundKey: 'noble', selections: { 'background:noble:privilege': ['retainers'] } }));
  expect(noble.background.privilege.label.it).toBe('Servitù');
  expect(noble.features.filter(f => f.key.startsWith('background:'))).toHaveLength(1);
  expect(noble.background.privilege.description).toContain('Tre servitori');
  const custom = completeGuidedCreation({ backgroundKey: 'custom', customBackground: { name: 'Custode', featureBackgroundKey: 'acolyte', equipmentBackgroundKey: 'guildArtisan' } });
  const result = materializeLevelOneCharacter(custom);
  expect(result.choiceSlots.filter(s => s.owner === 'background' && ['skill', 'language', 'tool', 'toolOrLanguage'].includes(s.kind)).map(s => s.count)).toEqual([2, 2]);
  expect(result.startingEquipment.fixed).not.toContain('artisansTools');
});

test('background instrument ownership is independent from proficiency and resources use correct resets', () => {
  const input = completeGuidedCreation({ classKey: 'bard', backgroundKey: 'entertainer', selections: {
    'class:bard:instruments': ['flute', 'drum', 'horn'], 'background:entertainer:instrument': ['lyre'],
    'background:entertainer:owned-instrument': ['lute'], 'class:bard:starting-instrument': ['viol'],
  } });
  const journal = resolveLevelOneCreationJournal(input);
  expect(journal.materialized.proficiencies.tools).toContain('lyre');
  expect(journal.materialized.proficiencies.tools).not.toContain('lute');
  expect(journal.materialized.startingEquipment.fixed).toContain('lute');
  expect(journal.resourcePools.find(p => p.featureId === 'bardic-inspiration')).toMatchObject({ resetPolicy: 'LONG_REST', maximum: { '0': 1 } });
  expect(journal.grants.find(g => g.grantKind === 'RESOURCE' && g.payload.featureId === 'bardic-inspiration')).toMatchObject({ sourceSnapshot: { kind: 'class', key: 'bard' }, decisionDefinitionId: 'creation:class' });
  const wizard = resolveLevelOneCreationJournal(completeGuidedCreation({ classKey: 'wizard' }));
  expect(wizard.resourcePools.find(p => p.featureId === 'arcane-recovery').resetPolicy).toBe('MANUAL');
  const invalid = { ...input, selections: { ...input.selections, injected: ['anything'] } };
  expect(resolveLevelOneCreationJournal(invalid)).not.toHaveProperty('grants');
});
