/** First verified declarative grants. Legacy creation slot IDs/snapshots remain unchanged. */
import { resolveRuleEvent } from './character-rule-engine.mjs';

export const LEVEL_ONE_EVENT_RULES = Object.freeze([
  Object.freeze({
    id: 'phb2014:druid:druidic', version: '1',
    source: { book: 'PHB-2014-it', path: 'docs/Manuale_del_Giocatore_5.0.md', line: 2613, page: 66 },
    trigger: { event: 'creation', classKey: 'druid', atClassLevel: 1 },
    grants: [{ id: 'language:druidic', kind: 'proficiency', category: 'languages', key: 'druidic' }],
  }),
  Object.freeze({
    id: 'phb2014:sorcerer:draconic-language', version: '1',
    source: { book: 'PHB-2014-it', path: 'docs/Manuale_del_Giocatore_5.0.md', line: 5207, page: 110 },
    trigger: { event: 'creation', classKey: 'sorcerer', atClassLevel: 1 },
    when: { op: 'hasFeature', key: 'draconic-bloodline' },
    grants: [{ id: 'language:draconic', kind: 'proficiency', category: 'languages', key: 'draconic' }],
  }),
]);

export function resolveLevelOneEventGrants(classKey, selections = {}) {
  const origin = selections?.['class:sorcerer:origin'];
  return resolveRuleEvent(LEVEL_ONE_EVENT_RULES, { type: 'creation', classKey }, {
    totalLevel: 1, classLevels: { [classKey]: 1 },
    features: Array.isArray(origin) ? origin : typeof origin === 'string' ? [origin] : [],
  }).grants;
}
