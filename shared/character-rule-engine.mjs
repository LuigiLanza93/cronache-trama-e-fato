/** Pure, closed rule expressions and choice validation shared by preview and writers. */
const ABILITIES = new Set(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']);
const EVENTS = new Set(['creation', 'classLevelGain', 'totalLevelGain', 'preparationChange', 'bookCopy', 'rest', 'manualAdjustment']);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (value, key) => record(value) && Object.hasOwn(value, key);
const identifier = (value) => typeof value === 'string' && value.length > 0 && !['__proto__', 'prototype', 'constructor'].includes(value);
const requireRule = (condition, message) => { if (!condition) throw new TypeError(`Definizione di regola non valida: ${message}`); };
const number = (value) => { requireRule(Number.isFinite(value), 'valore numerico non finito'); return value; };
const read = (values, key) => owns(values, key) ? number(values[key]) : 0;
const member = (values, key) => Array.isArray(values) && values.includes(key);

function expression(node, depth) {
  requireRule(depth < 32 && record(node) && typeof node.op === 'string', 'espressione o profondità');
}

export function evaluateRuleFormula(node, context = {}, depth = 0) {
  expression(node, depth);
  const next = (child) => evaluateRuleFormula(child, context, depth + 1);
  switch (node.op) {
    case 'constant': return number(node.value);
    case 'abilityScore': case 'abilityModifier': {
      requireRule(ABILITIES.has(node.ability), 'caratteristica');
      const score = read(context.abilities, node.ability);
      return node.op === 'abilityScore' ? score : Math.floor((score - 10) / 2);
    }
    case 'classLevel': requireRule(identifier(node.classKey), 'classe'); return read(context.classLevels, node.classKey);
    case 'totalLevel': return number(context.totalLevel ?? 0);
    case 'proficiencyBonus': {
      const level = number(context.totalLevel ?? 0);
      requireRule(Number.isInteger(level) && level >= 1 && level <= 20, 'livello per competenza');
      return 2 + Math.floor((level - 1) / 4);
    }
    case 'sum': case 'multiply': case 'min': case 'max': {
      requireRule(Array.isArray(node.args) && node.args.length > 0, 'operandi');
      const args = node.args.map(next);
      return number(node.op === 'sum' ? args.reduce((a, b) => a + b, 0)
        : node.op === 'multiply' ? args.reduce((a, b) => a * b, 1)
          : node.op === 'min' ? Math.min(...args) : Math.max(...args));
    }
    case 'floor': return Math.floor(next(node.arg));
    case 'ceil': return Math.ceil(next(node.arg));
    case 'divide': {
      const dividend = next(node.left); const divisor = next(node.right);
      requireRule(divisor !== 0, 'divisione per zero'); return number(dividend / divisor);
    }
    case 'lookup': {
      const key = String(next(node.key));
      requireRule(record(node.table) && Object.hasOwn(node.table, key), 'riga della tabella assente');
      return number(node.table[key]);
    }
    default: throw new TypeError(`Operatore di formula sconosciuto: ${node.op}`);
  }
}

export function evaluateRuleCondition(node, context = {}, depth = 0) {
  expression(node, depth);
  const next = (child) => evaluateRuleCondition(child, context, depth + 1);
  switch (node.op) {
    case 'always': return true;
    case 'all': case 'any': {
      requireRule(Array.isArray(node.args) && node.args.length > 0, 'condizioni');
      // Evaluate every branch so invalid operators cannot hide behind short circuiting.
      const args = node.args.map(next); return node.op === 'all' ? args.every(Boolean) : args.some(Boolean);
    }
    case 'not': return !next(node.arg);
    case 'abilityAtLeast':
      requireRule(ABILITIES.has(node.ability), 'caratteristica'); return read(context.abilities, node.ability) >= number(node.value);
    case 'classLevelAtLeast':
      requireRule(identifier(node.classKey), 'classe'); return read(context.classLevels, node.classKey) >= number(node.value);
    case 'totalLevelAtLeast': return number(context.totalLevel ?? 0) >= number(node.value);
    case 'hasProficiency':
      requireRule(['skills', 'tools', 'languages', 'armor', 'weapons', 'savingThrows'].includes(node.category) && identifier(node.key), 'competenza');
      return member(owns(context.proficiencies, node.category) ? context.proficiencies[node.category] : [], node.key);
    case 'hasFeature': case 'hasKnownSpell':
      requireRule(identifier(node.key), 'identificatore'); return member(node.op === 'hasFeature' ? context.features : context.knownSpells, node.key);
    case 'campaignOption':
      requireRule(identifier(node.key), 'opzione campagna'); return owns(context.campaignOptions, node.key) && context.campaignOptions[node.key] === true;
    case 'selected': {
      requireRule(identifier(node.choiceId) && identifier(node.key), 'scelta dipendente');
      const value = owns(context.selections, node.choiceId) ? context.selections[node.choiceId] : [];
      return value === node.key || member(value, node.key);
    }
    default: throw new TypeError(`Operatore di condizione sconosciuto: ${node.op}`);
  }
}

/** Strings remain accepted as a single selection for existing snapshots/API clients. */
export function validateRuleSelections(slots, selections = {}, { pathPrefix = 'selections' } = {}) {
  requireRule(Array.isArray(slots), 'elenco decisioni');
  const issues = [];
  const issue = (id, code, message, meta) => issues.push({ path: id ? `${pathPrefix}.${id}` : pathPrefix, code, message, ...(meta ? { meta } : {}) });
  if (!record(selections)) {
    issue('', 'invalid_choice_shape', 'Le scelte devono essere un oggetto.'); selections = {};
  }
  const ids = new Set();
  for (const slot of slots) {
    requireRule(record(slot) && identifier(slot.id) && !ids.has(slot.id), 'identificatore decisione duplicato/non valido'); ids.add(slot.id);
    requireRule(slot.count === null || (Number.isInteger(slot.count) && slot.count >= 0), 'cardinalità');
    requireRule(Array.isArray(slot.options), 'elenco opzioni');
    const optionKeys = slot.options.map((option) => typeof option === 'string' ? option : option?.key);
    requireRule(optionKeys.every(identifier) && new Set(optionKeys).size === optionKeys.length, 'opzioni duplicate/non valide');
    requireRule(slot.excludedOptions === undefined || (Array.isArray(slot.excludedOptions) && slot.excludedOptions.every(identifier)), 'esclusioni');
    const raw = owns(selections, slot.id) ? selections[slot.id] : [];
    const values = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
    if ((!Array.isArray(raw) && typeof raw !== 'string') || values.some((value) => typeof value !== 'string')) {
      issue(slot.id, 'invalid_choice_shape', 'Le opzioni scelte devono essere nomi o identificatori testuali.'); continue;
    }
    if (slot.count !== null && values.length !== slot.count) issue(slot.id, 'wrong_choice_count', `Questa scelta richiede ${slot.count} opzione/i.`, { expected: slot.count, actual: values.length });
    if (slot.distinct && new Set(values).size !== values.length) issue(slot.id, 'duplicate_choice', 'Le opzioni scelte devono essere distinte.');
    for (const value of values) {
      if (!optionKeys.includes(value)) issue(slot.id, 'invalid_choice', 'Opzione non ammessa per questa scelta.', { value });
      if (slot.excludedOptions?.includes(value)) issue(slot.id, 'excluded_choice', 'Questa opzione è esclusa da questa scelta.', { value });
    }
  }
  for (const id of Object.keys(selections)) if (!ids.has(id)) issue(id, 'unknown_choice_slot', 'La scelta non è disponibile per questo evento.');
  return issues;
}

/** Resolves one event only; event history, replacement and persistence are separate layers. */
export function resolveRuleEvent(definitions, event, context = {}, selections = {}) {
  requireRule(Array.isArray(definitions) && record(event) && EVENTS.has(event.type), 'evento');
  const byId = new Map();
  for (const rule of definitions) {
    requireRule(record(rule) && identifier(rule.id) && !byId.has(rule.id), 'identificatore regola');
    requireRule(record(rule.trigger) && EVENTS.has(rule.trigger.event), 'trigger');
    requireRule(typeof rule.version === 'string' && rule.version.length > 0 && record(rule.source), 'versione/fonte');
    requireRule(rule.dependsOn === undefined || (Array.isArray(rule.dependsOn) && rule.dependsOn.every(identifier)), 'dipendenze');
    byId.set(rule.id, rule);
  }
  const ordered = []; const visiting = new Set(); const visited = new Set();
  function visit(rule) {
    requireRule(!visiting.has(rule.id), 'ciclo di dipendenze');
    if (visited.has(rule.id)) return;
    visiting.add(rule.id);
    for (const id of rule.dependsOn ?? []) { requireRule(byId.has(id), 'dipendenza mancante'); visit(byId.get(id)); }
    visiting.delete(rule.id); visited.add(rule.id); ordered.push(rule);
  }
  for (const rule of definitions) visit(rule);
  const slots = []; const grants = []; const active = new Set(); const ctx = { ...context, selections };
  for (const rule of ordered) {
    const trigger = rule.trigger;
    if (trigger.event !== event.type || (trigger.classKey && trigger.classKey !== event.classKey)) continue;
    if (trigger.atClassLevel !== undefined) {
      requireRule(identifier(trigger.classKey) && Number.isInteger(trigger.atClassLevel) && trigger.atClassLevel >= 1, 'soglia classe');
      if (read(ctx.classLevels, trigger.classKey) !== trigger.atClassLevel) continue;
    }
    if (trigger.atTotalLevel !== undefined) {
      requireRule(Number.isInteger(trigger.atTotalLevel) && trigger.atTotalLevel >= 1, 'soglia totale');
      if (number(ctx.totalLevel ?? 0) !== trigger.atTotalLevel) continue;
    }
    if (!(rule.dependsOn ?? []).every((id) => active.has(id)) || (rule.when && !evaluateRuleCondition(rule.when, ctx))) continue;
    active.add(rule.id);
    for (const decision of rule.decisions ?? []) slots.push({ ...decision, count: decision.countFormula ? evaluateRuleFormula(decision.countFormula, ctx) : decision.count, ruleId: rule.id, ruleVersion: rule.version, source: rule.source });
    for (const grant of rule.grants ?? []) {
      requireRule(record(grant) && identifier(grant.id) && identifier(grant.kind), 'concession');
      grants.push({ ...grant, ...(grant.valueFormula ? { value: evaluateRuleFormula(grant.valueFormula, ctx) } : {}), ruleId: rule.id, ruleVersion: rule.version, source: rule.source });
    }
  }
  const issues = validateRuleSelections(slots, selections);
  return { slots, grants: issues.length ? [] : grants, issues };
}
