import { resolvePhbSpell } from '../../shared/phb-spell-catalog.mjs';
import type { SpellEntry } from './auth';

/** Read-only adapter to the existing spell detail UI; does not rewrite saved spell names. */
export function getPhbSpellDetails(value: string): SpellEntry | null {
  const spell = resolvePhbSpell(value);
  if (!spell) return null;
  return {
    name: spell.name, level: spell.level, school: spell.school,
    casting_time: null, range: null, components: null, duration: null,
    // The complete source text below includes all casting facts, even OCR fields not parsed.
    concentration: /Durata:\s*[,.;]?\s*Concentrazione/i.test(spell.description),
    ritual: spell.ritual, attack_roll: spell.attack_roll,
    description: spell.description,
    _source: `Manuale del Giocatore 5.0, pagina ${spell.source.page}`,
  };
}
