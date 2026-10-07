import { expect, test } from 'vitest';
import { getPhbSpellDetails } from '../../src/lib/phb-spell-details';

test('Guided spell details work without the persisted spell catalog and retain historical aliases', () => {
  expect(getPhbSpellDetails('Dardo Stregato')).toMatchObject({ level: 1, attack_roll: true, concentration: true });
  expect(getPhbSpellDetails('Dardo Stregato')?.description).toContain('fulmini');
  expect(getPhbSpellDetails('Sortilegio')?.ritual).toBe(false);
  expect(getPhbSpellDetails('Benedizione')?.concentration).toBe(true);
  expect(getPhbSpellDetails('Risata Incontenibile')?.name).toBe('Risata Incontenibile di Tasha');
  expect(getPhbSpellDetails('Magia personalizzata')).toBeNull();
});
