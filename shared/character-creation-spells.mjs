import { resolvePhbSpell } from './phb-spell-catalog.mjs';

const SPELL_ABILITIES = Object.freeze({ bard: 'charisma', cleric: 'wisdom', druid: 'wisdom', sorcerer: 'charisma', warlock: 'charisma', wizard: 'intelligence' });
function castingDetails(resolved, slot, role) {
  const feat = slot.owner === 'feat' ? slot.id.split(':')[1] : null;
  const chosenClass = feat ? resolved.choices[`feat:${feat}:class`]?.[0] : resolved.identity?.classKey;
  const ability = slot.owner === 'race' || slot.owner === 'subrace' ? 'intelligence'
    : SPELL_ABILITIES[chosenClass] ?? resolved.spellcasting?.ability ?? null;
  const usage = role === 'cantrip' ? 'A volontà, senza slot.'
    : feat === 'magicInitiate' ? 'Una volta per riposo lungo al 1° livello tramite Iniziato alla Magia.'
      : role === 'ritualbook' ? 'Solo come rituale tramite Incantatore Rituale; non concede slot.'
        : role === 'spellbook' ? 'Nel libro: da preparare per il lancio con slot; se rituale, il Mago può lanciarlo dal libro senza prepararlo.'
          : role === 'domain' ? 'Sempre preparato; non conta nel limite di preparazione. Richiede uno slot.'
            : 'Lancio con gli slot della fonte magica, secondo le regole della classe.';
  return { ability, usage, ...(chosenClass ? { classKey: chosenClass } : {}), ...(feat ? { featureKey: feat } : {}) };
}

/** Spell selections already validated and saved in a guided creation snapshot. */
export function projectGuidedCreationSpells(resolved) {
  if (!resolved || !Array.isArray(resolved.choiceSlots) || !resolved.choices) return [];
  const spells = [];
  for (const slot of resolved.choiceSlots) {
    if (!["cantrip", "spell", "preparedSpell"].includes(slot.kind)) continue;
    const choices = resolved.choices[slot.id];
    if (!Array.isArray(choices)) continue;
    const role = slot.kind === "cantrip" ? "cantrip"
      : slot.kind === "preparedSpell" ? "prepared"
        : slot.id === "class:wizard:spellbook" ? "spellbook"
          : slot.id === "feat:ritualCaster:rituals" ? "ritualbook" : "known";
    const source = slot.owner === "race" || slot.owner === "subrace" ? "Razza"
      : slot.owner === "feat" ? "Talento" : "Classe";
    for (const name of choices) {
      if (typeof name !== "string" || !name.trim()) continue;
      spells.push({ name, spellId: resolvePhbSpell(name)?.id ?? null, level: role === "cantrip" ? 0 : 1, role, source, sourceChoiceId: slot.id, ...castingDetails(resolved, slot, role) });
    }
  }
  const domainSpells = resolved.spellcasting?.domainSpells;
  if (Array.isArray(domainSpells)) for (const name of domainSpells) {
    if (typeof name === "string" && name.trim()) {
      spells.push({ name, spellId: resolvePhbSpell(name)?.id ?? null, level: 1, role: "domain", source: "Dominio divino", sourceChoiceId: 'class:cleric:domain', ...castingDetails(resolved, { owner: 'class', id: 'class:cleric:domain' }, 'domain') });
    }
  }
  const fixedCantrips = [
    [resolved.identity?.raceKey === "elf" && resolved.identity?.subraceKey === "drow", "Luci Danzanti", "Razza", 'charisma'],
    [resolved.identity?.raceKey === "gnome" && resolved.identity?.subraceKey === "forest", "Illusione Minore", "Razza", 'intelligence'],
    [resolved.identity?.raceKey === "tiefling", "Taumaturgia", "Razza", 'charisma'],
    [resolved.identity?.classKey === "cleric" && resolved.choices["class:cleric:domain"]?.includes("light-domain"), "Luce", "Dominio divino", 'wisdom'],
  ];
  for (const [granted, name, source, ability] of fixedCantrips) {
    if (granted && !spells.some((spell) => spell.role === "cantrip" && spell.name === name && spell.source === source && spell.ability === ability)) {
      spells.push({ name, spellId: resolvePhbSpell(name)?.id ?? null, level: 0, role: "cantrip", source, ability, usage: 'A volontà, senza slot.', sourceChoiceId: source === 'Razza' ? `race:${resolved.identity.raceKey}:innate-cantrip` : 'class:cleric:domain' });
    }
  }
  return spells;
}
