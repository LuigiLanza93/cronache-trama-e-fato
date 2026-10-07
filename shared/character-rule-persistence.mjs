import crypto from "node:crypto";

const EVENT_COLUMNS = Object.freeze([
  "id", "characterId", "sequence", "eventType", "requestId", "requestSignature",
  "previewHash", "previousVersion", "resultVersion", "rulesetId", "rulesetVersion",
  "resolverVersion", "catalogHash", "sourceSnapshot", "resultSnapshot",
  "appliedByUserId", "appliedBySnapshot", "createdAt",
]);
const DECISION_COLUMNS = Object.freeze([
  "id", "eventId", "definitionId", "decisionKind", "operation", "selectedOptions",
  "ruleId", "ruleVersion", "definitionSnapshot", "levelSnapshot", "createdAt",
]);
const GRANT_COLUMNS = Object.freeze([
  "id", "eventId", "decisionId", "grantInstanceKey", "grantKind", "aggregateKey",
  "payload", "ruleId", "ruleVersion", "sourceSnapshot", "createdAt",
]);
const EXPECTED_INDEXES = Object.freeze([
  "CharacterRuleEvent_characterId_sequence_key",
  "CharacterRuleEvent_requestId_key",
  "CharacterRuleDecision_eventId_definitionId_key",
  "CharacterRuleGrant_eventId_grantInstanceKey_key",
]);
const EXPECTED_TRIGGERS = Object.freeze([
  "CharacterRuleGrant_decision_event_match_insert",
  "CharacterRuleGrant_decision_event_match_update",
]);

const parseJson = (value, fallback) => {
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

export function inspectCharacterRuleEventSchema(database) {
  const tableNames = new Set(
    database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name),
  );
  const expectedTables = {
    CharacterRuleEvent: EVENT_COLUMNS,
    CharacterRuleDecision: DECISION_COLUMNS,
    CharacterRuleGrant: GRANT_COLUMNS,
  };
  const missingTables = Object.keys(expectedTables).filter((table) => !tableNames.has(table));
  const missingColumns = {};
  for (const [table, columns] of Object.entries(expectedTables)) {
    if (!tableNames.has(table)) continue;
    const actual = new Set(database.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name));
    const missing = columns.filter((column) => !actual.has(column));
    if (missing.length) missingColumns[table] = missing;
  }
  const indexNames = new Set(
    database.prepare("SELECT name FROM sqlite_schema WHERE type = 'index'").all().map((row) => row.name),
  );
  const triggerNames = new Set(
    database.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger'").all().map((row) => row.name),
  );
  const missingIndexes = EXPECTED_INDEXES.filter((name) => !indexNames.has(name));
  const missingTriggers = EXPECTED_TRIGGERS.filter((name) => !triggerNames.has(name));
  return {
    ready: missingTables.length === 0
      && Object.keys(missingColumns).length === 0
      && missingIndexes.length === 0
      && missingTriggers.length === 0,
    missingTables,
    missingColumns,
    missingIndexes,
    missingTriggers,
  };
}

export function readCharacterCreationJournal(database, characterId) {
  if (!characterId || !inspectCharacterRuleEventSchema(database).ready) return null;
  const event = database.prepare(`
    SELECT * FROM "CharacterRuleEvent"
    WHERE "characterId" = ? AND "eventType" = 'CREATION'
    ORDER BY "sequence" ASC
    LIMIT 1
  `).get(characterId);
  if (!event) return null;
  const decisions = database.prepare(`
    SELECT * FROM "CharacterRuleDecision" WHERE "eventId" = ? ORDER BY "definitionId"
  `).all(event.id).map((row) => ({
    id: row.id,
    definitionId: row.definitionId,
    decisionKind: row.decisionKind,
    operation: row.operation,
    selectedOptions: parseJson(row.selectedOptions, []),
    ruleId: row.ruleId,
    ruleVersion: row.ruleVersion,
    definitionSnapshot: parseJson(row.definitionSnapshot, {}),
    levelSnapshot: parseJson(row.levelSnapshot, {}),
  }));
  const grants = database.prepare(`
    SELECT g.*, decision.definitionId AS decisionDefinitionId
    FROM "CharacterRuleGrant" g
    LEFT JOIN "CharacterRuleDecision" decision ON decision.id = g.decisionId
    WHERE g."eventId" = ?
    ORDER BY g."grantInstanceKey"
  `).all(event.id).map((row) => ({
    id: row.id,
    decisionDefinitionId: row.decisionDefinitionId ?? null,
    grantInstanceKey: row.grantInstanceKey,
    grantKind: row.grantKind,
    aggregateKey: row.aggregateKey,
    payload: parseJson(row.payload, {}),
    ruleId: row.ruleId,
    ruleVersion: row.ruleVersion,
    sourceSnapshot: parseJson(row.sourceSnapshot, {}),
  }));
  return {
    event: {
      id: event.id,
      sequence: Number(event.sequence),
      eventType: event.eventType,
      requestId: event.requestId,
      previewHash: event.previewHash,
      previousVersion: Number(event.previousVersion),
      resultVersion: Number(event.resultVersion),
      ruleset: { id: event.rulesetId, version: event.rulesetVersion },
      resolverVersion: event.resolverVersion,
      catalogHash: event.catalogHash,
      sourceSnapshot: parseJson(event.sourceSnapshot, {}),
      resultSnapshot: parseJson(event.resultSnapshot, {}),
      appliedBySnapshot: parseJson(event.appliedBySnapshot, {}),
      createdAt: event.createdAt,
    },
    decisions,
    grants,
  };
}

export function readCharacterRuleEventReceipt(database, requestId) {
  if (!requestId || !inspectCharacterRuleEventSchema(database).ready) return null;
  return database.prepare(`
    SELECT event.*, character.slug, character.ownerUserId, character.createdByUserId
    FROM "CharacterRuleEvent" event
    JOIN "Character" character ON character.id = event.characterId
    WHERE event.requestId = ?
    LIMIT 1
  `).get(requestId) ?? null;
}

export function persistCharacterCreationJournal(database, {
  characterId,
  requestId,
  requestSignature,
  previewHash,
  journal,
  appliedBy,
  createdAt = new Date().toISOString(),
}) {
  const schema = inspectCharacterRuleEventSchema(database);
  if (!schema.ready) {
    const error = new Error("La migrazione del registro regole del personaggio non e disponibile.");
    error.code = "CHARACTER_RULE_EVENT_SCHEMA_NOT_READY";
    throw error;
  }
  if (!journal?.ok || !Array.isArray(journal.decisions) || !Array.isArray(journal.grants)) {
    throw new TypeError("A valid creation journal is required.");
  }

  const eventId = crypto.randomUUID();
  const appliedBySnapshot = appliedBy ? {
    id: appliedBy.id,
    username: appliedBy.username,
    displayName: appliedBy.displayName,
    role: appliedBy.role,
  } : { kind: "SYSTEM" };
  database.prepare(`
    INSERT INTO "CharacterRuleEvent" (
      "id", "characterId", "sequence", "eventType", "requestId", "requestSignature",
      "previewHash", "previousVersion", "resultVersion", "rulesetId", "rulesetVersion",
      "resolverVersion", "catalogHash", "sourceSnapshot", "resultSnapshot",
      "appliedByUserId", "appliedBySnapshot", "createdAt"
    ) VALUES (?, ?, 1, 'CREATION', ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    characterId,
    requestId,
    requestSignature,
    previewHash,
    journal.ruleset.id,
    journal.ruleset.version,
    journal.resolverVersion,
    journal.catalogHash,
    JSON.stringify(journal.catalogSnapshot ?? {}),
    JSON.stringify(journal.materialized ?? {}),
    appliedBy?.id ?? null,
    JSON.stringify(appliedBySnapshot),
    createdAt,
  );

  const decisionIds = new Map();
  const insertDecision = database.prepare(`
    INSERT INTO "CharacterRuleDecision" (
      "id", "eventId", "definitionId", "decisionKind", "operation", "selectedOptions",
      "ruleId", "ruleVersion", "definitionSnapshot", "levelSnapshot", "createdAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const decision of journal.decisions) {
    const decisionId = crypto.randomUUID();
    decisionIds.set(decision.definitionId, decisionId);
    insertDecision.run(
      decisionId,
      eventId,
      decision.definitionId,
      decision.decisionKind,
      decision.operation,
      JSON.stringify(decision.selectedOptions),
      decision.ruleId,
      decision.ruleVersion,
      JSON.stringify(decision.definitionSnapshot ?? {}),
      JSON.stringify(decision.levelSnapshot ?? {}),
      createdAt,
    );
  }

  const insertGrant = database.prepare(`
    INSERT INTO "CharacterRuleGrant" (
      "id", "eventId", "decisionId", "grantInstanceKey", "grantKind", "aggregateKey",
      "payload", "ruleId", "ruleVersion", "sourceSnapshot", "createdAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const grant of journal.grants) {
    const decisionId = grant.decisionDefinitionId
      ? decisionIds.get(grant.decisionDefinitionId)
      : null;
    if (grant.decisionDefinitionId && !decisionId) {
      throw new TypeError(`Grant references missing decision: ${grant.decisionDefinitionId}`);
    }
    insertGrant.run(
      crypto.randomUUID(),
      eventId,
      decisionId,
      grant.grantInstanceKey,
      grant.grantKind,
      grant.aggregateKey,
      JSON.stringify(grant.payload ?? {}),
      grant.ruleId,
      grant.ruleVersion,
      JSON.stringify({ ...(grant.sourceSnapshot ?? {}), ruleId: grant.ruleId, ruleVersion: grant.ruleVersion }),
      createdAt,
    );
  }

  return readCharacterCreationJournal(database, characterId);
}
