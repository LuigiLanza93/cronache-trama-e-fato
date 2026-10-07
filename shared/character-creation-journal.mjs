import crypto from 'node:crypto';
import { CHARACTER_CREATION_RULESET, CLERIC_DOMAINS, FIRST_LEVEL_SUBCLASS_FEATURES, FEAT_FIXED_BONUSES, SKILLS, LANGUAGES,
  getLevelOneCreationOptions, validateLevelOneCreation, materializeLevelOneCharacter } from './character-creation-rules.mjs';
import { resolveLevelOneEventGrants } from './character-creation-event-rules.mjs';
import { projectGuidedCreationSpells } from './character-creation-spells.mjs';
import { projectGuidedCreationCapabilities } from './character-creation-capabilities.mjs';
import { resolveCreationResourcePools } from './character-creation-resources.mjs';

export const CREATION_RESOLVER_VERSION = 'creation-event-v1';
export function canonicalJson(value) {
  const canonical = item => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  return JSON.stringify(canonical(value));
}
const hash = value => crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
const label = entry => entry?.label?.it ?? entry?.label ?? entry?.key;
const source = (kind, key, entry) => ({ kind, key, label: label(entry), book: 'PHB-2014-it', path: 'docs/Manuale_del_Giocatore_5.0.md' });

/** Creates an acquisition ledger from definitions and validated selections, never from legacy data. */
export function resolveLevelOneCreationJournal(input) {
  const validation = validateLevelOneCreation(input);
  if (!validation.ok) return { ok: false, issues: validation.issues, normalizedInput: validation.normalizedInput };
  const normalizedInput = validation.normalizedInput;
  const materialized = materializeLevelOneCharacter(normalizedInput);
  const definitions = getLevelOneCreationOptions(normalizedInput).resolved;
  const { raceKey, subraceKey, classKey, backgroundKey } = materialized.identity;
  const levels = { totalLevel: 1, classKey, classLevel: 1 };
  const decisions = []; const grants = [];
  const decision = (definitionId, decisionKind, selectedOptions, definitionSnapshot, src) => {
    decisions.push({ definitionId, decisionKind, operation: 'ACQUIRE', selectedOptions,
      definitionSnapshot, levelSnapshot: levels, ruleId: `${src.kind}:${src.key}`, ruleVersion: '1' });
  };
  const grant = (kind, key, payload, src, decisionDefinitionId) => {
    const ruleId = `${src.kind}:${src.key}`;
    grants.push({ grantInstanceKey: `${ruleId}:${kind}:${key}:${grants.length}`, grantKind: kind,
      aggregateKey: `${kind}:${key}`, payload, ruleId, ruleVersion: '1', sourceSnapshot: src,
      ...(decisionDefinitionId ? { decisionDefinitionId } : {}) });
  };
  const raceSource = source('race', raceKey, definitions.race);
  const subraceSource = source('subrace', subraceKey, definitions.subrace);
  const classSource = source('class', classKey, definitions.class);
  const bgSource = source('background', backgroundKey, definitions.background);
  decision('creation:race', 'race', [raceKey], definitions.race, raceSource);
  if (subraceKey) decision('creation:subrace', 'subrace', [subraceKey], definitions.subrace, subraceSource);
  decision('creation:class', 'class', [classKey], definitions.class, classSource);
  decision('creation:background', 'background', [backgroundKey], definitions.background, bgSource);
  decision('creation:point-buy', 'pointBuy', Object.entries(normalizedInput.abilityScores).map(([key, score]) => `${key}:${score}`), { budget: 27, abilityScores: normalizedInput.abilityScores }, source('creation', 'point-buy', { label: 'Punteggi base' }));
  grant('CLASS_MEMBERSHIP', classKey, { classKey, level: 1 }, classSource, 'creation:class');
  const fixed = (entry, src, id, isClass = false) => {
    if (!entry) return;
    const p = isClass ? entry.fixed : entry;
    const categories = { skills: 'skillProficiencies', languages: 'languages', tools: 'toolProficiencies', armor: 'armorProficiencies', weapons: 'weaponProficiencies', savingThrows: 'savingThrows' };
    for (const [category, field] of Object.entries(categories)) {
      const values = isClass ? p?.[category] : p?.[field];
      for (const key of Array.isArray(values) ? values : []) grant('PROFICIENCY', `${category}:${key}`, { category, key, multiplier: 1 }, src, id);
    }
    for (const [ability, value] of Object.entries(entry.abilityBonuses ?? {})) grant('ABILITY_INCREASE', ability, { ability, value, projection: 'NATIVE' }, src, id);
  };
  fixed(definitions.race, raceSource, 'creation:race');
  fixed(definitions.subrace, subraceSource, 'creation:subrace');
  fixed(definitions.class, classSource, 'creation:class', true);
  fixed(definitions.background, bgSource, 'creation:background');
  const ownerSource = slot => ['race', 'subrace'].includes(slot.owner) ? (slot.owner === 'race' ? raceSource : subraceSource)
    : slot.owner === 'background' ? bgSource : slot.owner === 'feat' ? source('feat', materialized.choices['race:variant-human:feat']?.[0], { label: 'Talento' })
      : slot.owner === 'replacement' ? { ...source('replacement', slot.id, slot), conflicts: slot.conflicts } : classSource;
  for (const slot of materialized.choiceSlots) {
    const selectedOptions = materialized.choices[slot.id] ?? [];
    const src = ownerSource(slot);
    decision(slot.id, slot.kind, selectedOptions, slot, src);
    for (const key of selectedOptions) {
      const category = slot.kind === 'skill' ? 'skills' : slot.kind === 'tool' ? 'tools' : slot.kind === 'language' ? 'languages'
        : slot.kind === 'skillOrTool' ? (Object.hasOwn(SKILLS, key) ? 'skills' : 'tools')
          : slot.kind === 'toolOrLanguage' ? (Object.hasOwn(LANGUAGES, key) ? 'languages' : 'tools') : null;
      if (category) grant('PROFICIENCY', `${category}:${key}`, { category, key, multiplier: 1 }, src, slot.id);
      if (slot.kind === 'expertise' || slot.id === 'class:cleric:knowledge:skills') grant('PROFICIENCY', `${Object.hasOwn(SKILLS, key) ? 'skills' : 'tools'}:${key}`, { category: Object.hasOwn(SKILLS, key) ? 'skills' : 'tools', key, multiplier: 2 }, src, slot.id);
      if (slot.kind === 'ability') grant('ABILITY_INCREASE', key, { ability: key, value: 1, projection: 'NATIVE' }, src, slot.id);
      if (slot.kind === 'weapon') grant('PROFICIENCY', `weapons:${key}`, { category: 'weapons', key, multiplier: 1 }, src, slot.id);
    }
  }
  const featKey = materialized.choices['race:variant-human:feat']?.[0];
  const featSource = source('feat', featKey, { label: featKey });
  for (const [ability, value] of Object.entries(FEAT_FIXED_BONUSES[featKey] ?? {})) grant('ABILITY_INCREASE', ability, { ability, value, projection: 'NATIVE' }, featSource, 'race:variant-human:feat');
  const domainKey = materialized.choices['class:cleric:domain']?.[0];
  const domain = CLERIC_DOMAINS[domainKey];
  for (const category of ['armor', 'weapons']) for (const key of domain?.[category] ?? []) grant('PROFICIENCY', `${category}:${key}`, { category, key, multiplier: 1 }, source('subclass', domainKey, domain), 'class:cleric:domain');
  const featArmor = { lightlyArmored: ['light'], moderatelyArmored: ['medium', 'shields'], heavilyArmored: ['heavy'] }[featKey] ?? [];
  for (const key of featArmor) grant('PROFICIENCY', `armor:${key}`, { category: 'armor', key, multiplier: 1 }, featSource, 'race:variant-human:feat');
  if (featKey === 'resilient') for (const key of materialized.choices['feat:resilient:ability']) grant('PROFICIENCY', `savingThrows:${key}`, { category: 'savingThrows', key, multiplier: 1 }, featSource, 'feat:resilient:ability');
  for (const automatic of resolveLevelOneEventGrants(classKey, normalizedInput.selections)) grant('PROFICIENCY', `${automatic.category}:${automatic.key}`, { category: automatic.category, key: automatic.key, multiplier: 1 }, { ...classSource, reference: automatic.source }, 'creation:class');
  for (const capability of projectGuidedCreationCapabilities(materialized)) {
    const featureKey = capability.sourceFeatureId.replace(/^creation:/, '');
    // Summary cards are a view of proficiencies, not an additional acquired feature.
    if (featureKey.startsWith('proficiencies:')) continue;
    const subclassSlot = materialized.choiceSlots.find(item => item.kind === 'subclass');
    const subclassKey = subclassSlot ? materialized.choices[subclassSlot.id]?.[0] : null;
    const subclassFeatures = [...(domain?.features ?? []), ...(FIRST_LEVEL_SUBCLASS_FEATURES[subclassKey] ?? [])];
    const src = featureKey.startsWith('background:') ? bgSource : featureKey.startsWith('feat:') ? featSource
      : (definitions.subrace?.features ?? []).some(f => f.key === featureKey) ? subraceSource
        : (definitions.race.features ?? []).some(f => f.key === featureKey) ? raceSource
          : subclassFeatures.some(f => f.key === featureKey) ? source('subclass', subclassKey, { label: subclassKey }) : classSource;
    const originDecision = src === bgSource ? 'creation:background' : src === subraceSource ? 'creation:subrace' : src === raceSource ? 'creation:race'
      : src === featSource ? 'race:variant-human:feat' : src.kind === 'subclass' ? subclassSlot.id : 'creation:class';
    grant('FEATURE', featureKey, capability, src, originDecision);
    for (const effect of capability.passiveEffects ?? []) grant('STATISTIC_EFFECT', `${featureKey}:${effect.target}`, effect, src);
  }
  for (const spell of projectGuidedCreationSpells(materialized)) {
    const slot = materialized.choiceSlots.find(item => item.id === spell.sourceChoiceId);
    const src = spell.source === 'Dominio divino' ? source('subclass', domainKey, domain)
      : slot ? ownerSource(slot) : spell.source === 'Razza' ? (subraceKey ? subraceSource : raceSource) : classSource;
    const decisionId = spell.source === 'Dominio divino' ? 'class:cleric:domain'
      : slot?.id ?? (src === subraceSource ? 'creation:subrace' : src === raceSource ? 'creation:race' : 'creation:class');
    grant('SPELL_GRANT', `${spell.spellId ?? spell.name}:${spell.role}`, spell, src, decisionId);
  }
  // Equipment records preserve the source of each acquisition without recording child choices twice.
  for (const [index, item] of materialized.startingEquipment.grants.entries()) {
    const src = item.source.kind === 'background' ? bgSource : classSource;
    grant('EQUIPMENT', `${item.key}:${index}`, { key: item.key, quantity: 1, acquisition: item.acquisition }, src, item.choiceId ?? (src === bgSource ? 'creation:background' : 'creation:class'));
  }
  grant('CURRENCY', 'gp', { unit: 'gp', value: materialized.startingEquipment.currency.gp }, bgSource, 'creation:background');
  const resourcePools = resolveCreationResourcePools(materialized);
  for (const pool of resourcePools) {
    const acquiredFeature = grants.find(item => item.grantKind === 'FEATURE' && item.payload.sourceFeatureId === `creation:${pool.featureId}`);
    const origin = acquiredFeature?.sourceSnapshot ?? (pool.sourceClassKey ? classSource : source('feature', pool.featureId, { label: pool.label }));
    grant('RESOURCE', pool.poolKey, pool, { ...origin, reference: pool.source }, acquiredFeature?.decisionDefinitionId);
  }
  const catalogSnapshot = { ruleset: CHARACTER_CREATION_RULESET, resolverVersion: CREATION_RESOLVER_VERSION,
    source: { book: 'PHB-2014-it', path: 'docs/Manuale_del_Giocatore_5.0.md' }, definitions: decisions.map(d => d.definitionSnapshot) };
  return { ok: true, issues: [], normalizedInput, materialized, decisions, grants, resourcePools,
    resolverVersion: CREATION_RESOLVER_VERSION, ruleset: CHARACTER_CREATION_RULESET, catalogSnapshot,
    catalogHash: hash({ catalogSnapshot, grants }) };
}

export function buildCreationPreviewHash({ name, alignment }, journal) {
  if (!journal.ok) return null;
  return hash({ name: String(name).trim(), alignment, creation: journal.normalizedInput,
    resolverVersion: journal.resolverVersion, catalogHash: journal.catalogHash, decisions: journal.decisions, grants: journal.grants });
}
