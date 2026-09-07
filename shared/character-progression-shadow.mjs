export const CHARACTER_PROGRESSION_SCHEMA_COLUMNS = Object.freeze({
  ClassRule: Object.freeze([
    "id", "classKey", "labelIt", "labelEn", "aliases", "rulesetId", "rulesetVersion",
    "sourceReference", "hitDie", "casterKind", "spellcastingAbility", "spellcastingStartLevel",
    "subclassSelectionLevel", "isCustom", "isManual", "ruleSnapshot", "catalogHash",
    "createdAt", "updatedAt",
  ]),
  SubclassRule: Object.freeze([
    "id", "subclassKey", "classRuleId", "labelIt", "labelEn", "aliases", "rulesetId",
    "rulesetVersion", "sourceReference", "casterKind", "spellcastingAbility",
    "spellcastingStartLevel", "isCustom", "isManual", "archivedAt", "ruleSnapshot",
    "catalogHash", "createdAt", "updatedAt",
  ]),
  CharacterProgression: Object.freeze([
    "characterId", "revision", "backfillStatus", "backfillIssues", "legacySnapshot",
    "createdAt", "updatedAt",
  ]),
  CharacterClass: Object.freeze([
    "id", "characterId", "classRuleId", "subclassRuleId", "classKey", "level", "sortOrder",
    "isPrimary", "subclassStatus", "source", "ruleSnapshot", "updatedByUserId", "createdAt",
    "updatedAt",
  ]),
});

export const CHARACTER_PROGRESSION_SCHEMA_OBJECTS = Object.freeze({
  index: Object.freeze([
    "ClassRule_rulesetId_rulesetVersion_classKey_key",
    "SubclassRule_rulesetId_rulesetVersion_subclassKey_key",
    "CharacterClass_characterId_classKey_key",
    "CharacterClass_characterId_sortOrder_key",
    "CharacterClass_one_primary_key",
    "CharacterClass_m3_single_class_key",
  ]),
  trigger: Object.freeze([
    "CharacterClass_class_key_matches_rule_insert",
    "CharacterClass_class_key_matches_rule_update",
    "CharacterClass_subclass_matches_class_insert",
    "CharacterClass_subclass_matches_class_update",
  ]),
});

function diagnostic(code, details = undefined) {
  return details === undefined ? { code } : { code, ...details };
}

function parseObject(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArray(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function strictLevel(value) {
  if (typeof value === "string" && !/^\s*\d+\s*$/.test(value)) return null;
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 20 ? level : null;
}

function normalizedAlias(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function aliasesForRule(row, diagnostics) {
  const aliases = parseArray(row.ruleAliases);
  if (!aliases || aliases.some((entry) => typeof entry !== "string")) {
    diagnostics.push(diagnostic("CLASS_RULE_ALIASES_INVALID"));
    return new Set();
  }
  return new Set([
    row.ruleClassKey,
    row.ruleLabelIt,
    row.ruleLabelEn,
    ...aliases,
  ].map(normalizedAlias).filter(Boolean));
}

function sameLegacyValue(left, right) {
  return left === right || (left == null && right == null);
}

function legacyProjection(character, data) {
  return {
    className: character?.className ?? data?.basicInfo?.class ?? "",
    level: character?.level ?? data?.basicInfo?.level ?? 1,
  };
}

export function inspectCharacterProgressionSchema(tableColumns = {}, schemaObjects = {}) {
  const tableNames = Object.keys(CHARACTER_PROGRESSION_SCHEMA_COLUMNS);
  const present = tableNames.filter((tableName) => Object.prototype.hasOwnProperty.call(tableColumns, tableName));
  if (present.length === 0) {
    return {
      complete: false,
      status: "ABSENT",
      missingTables: tableNames,
      missingColumns: {},
      missingObjects: {},
    };
  }

  const missingTables = tableNames.filter((tableName) => !present.includes(tableName));
  const missingColumns = {};
  for (const tableName of present) {
    const actual = new Set(Array.isArray(tableColumns[tableName]) ? tableColumns[tableName] : []);
    const missing = CHARACTER_PROGRESSION_SCHEMA_COLUMNS[tableName].filter((column) => !actual.has(column));
    if (missing.length > 0) missingColumns[tableName] = missing;
  }
  const missingObjects = {};
  for (const [type, required] of Object.entries(CHARACTER_PROGRESSION_SCHEMA_OBJECTS)) {
    const actual = new Set(Array.isArray(schemaObjects[type]) ? schemaObjects[type] : []);
    const missing = required.filter((name) => !actual.has(name));
    if (missing.length > 0) missingObjects[type] = missing;
  }
  const complete = missingTables.length === 0
    && Object.keys(missingColumns).length === 0
    && Object.keys(missingObjects).length === 0;
  return {
    complete,
    status: complete ? "COMPLETE" : "PARTIAL",
    missingTables,
    missingColumns,
    missingObjects,
  };
}

export function resolveCharacterProgressionShadow({
  schema,
  character,
  progression = null,
  classRows = [],
} = {}) {
  const diagnostics = [];
  const parsedData = parseObject(character?.data);
  const legacy = legacyProjection(character, parsedData);
  const fallbackRevision = Number(progression?.revision);
  const fallback = () => ({
    source: "LEGACY",
    classes: [],
    totalLevel: strictLevel(legacy.level) ?? legacy.level,
    progressionRevision: progression && Number.isInteger(fallbackRevision) && fallbackRevision >= 0
      ? fallbackRevision
      : null,
    diagnostics,
  });

  if (!schema?.complete) {
    diagnostics.push(diagnostic(
      schema?.status === "PARTIAL" ? "M3_SCHEMA_PARTIAL" : "M3_SCHEMA_ABSENT",
    ));
    return fallback();
  }
  if (!progression) {
    diagnostics.push(diagnostic("CHARACTER_PROGRESSION_MISSING"));
    return fallback();
  }
  if (progression.characterId !== character?.id) {
    diagnostics.push(diagnostic("CHARACTER_PROGRESSION_OWNER_MISMATCH"));
  }
  const progressionRevision = Number(progression.revision);
  if (!Number.isInteger(progressionRevision) || progressionRevision < 0) {
    diagnostics.push(diagnostic("CHARACTER_PROGRESSION_REVISION_INVALID"));
  }
  if (progression.backfillStatus !== "BACKFILLED") {
    diagnostics.push(diagnostic("CHARACTER_PROGRESSION_NOT_BACKFILLED", {
      status: String(progression.backfillStatus ?? ""),
    }));
  }
  const recordedIssues = parseArray(progression.backfillIssues);
  if (!recordedIssues) diagnostics.push(diagnostic("CHARACTER_PROGRESSION_ISSUES_INVALID"));
  else if (recordedIssues.length > 0) diagnostics.push(diagnostic("CHARACTER_PROGRESSION_HAS_ISSUES"));
  const snapshot = parseObject(progression.legacySnapshot);
  if (!snapshot) {
    diagnostics.push(diagnostic("CHARACTER_PROGRESSION_SNAPSHOT_INVALID"));
  }

  if (!parsedData) {
    diagnostics.push(diagnostic("LEGACY_DATA_JSON_INVALID"));
  }
  const basicInfo = parsedData?.basicInfo && typeof parsedData.basicInfo === "object" && !Array.isArray(parsedData.basicInfo)
    ? parsedData.basicInfo
    : null;
  if (!basicInfo) diagnostics.push(diagnostic("LEGACY_BASIC_INFO_MISSING"));

  if (snapshot) {
    const unchanged = sameLegacyValue(snapshot?.column?.className, character?.className ?? null)
      && sameLegacyValue(snapshot?.column?.level, character?.level ?? null)
      && sameLegacyValue(snapshot?.basicInfo?.class, basicInfo?.class ?? null)
      && sameLegacyValue(snapshot?.basicInfo?.level, basicInfo?.level ?? null);
    if (!unchanged) diagnostics.push(diagnostic("LEGACY_PROJECTION_CHANGED_AFTER_BACKFILL"));
  }

  if (!Array.isArray(classRows) || classRows.length !== 1) {
    diagnostics.push(diagnostic("M3_CHARACTER_CLASS_COUNT_INVALID", {
      count: Array.isArray(classRows) ? classRows.length : 0,
    }));
    return fallback();
  }

  const primaryCount = classRows.filter((row) => Number(row.isPrimary) === 1).length;
  if (primaryCount !== 1) diagnostics.push(diagnostic("M3_PRIMARY_CLASS_COUNT_INVALID", { count: primaryCount }));
  const row = classRows[0];
  if (row.characterId !== character?.id) diagnostics.push(diagnostic("CHARACTER_CLASS_OWNER_MISMATCH"));
  if (Number(row.sortOrder) !== 0) diagnostics.push(diagnostic("M3_CHARACTER_CLASS_ORDER_INVALID"));
  const classLevel = strictLevel(row.level);
  if (classLevel == null) diagnostics.push(diagnostic("CHARACTER_CLASS_LEVEL_INVALID"));
  if (!row.ruleId) diagnostics.push(diagnostic("CLASS_RULE_MISSING"));
  if (row.ruleId && row.classRuleId !== row.ruleId) diagnostics.push(diagnostic("CLASS_RULE_REFERENCE_MISMATCH"));
  if (row.ruleClassKey && row.classKey !== row.ruleClassKey) diagnostics.push(diagnostic("CLASS_RULE_KEY_MISMATCH"));

  const aliases = row.ruleId ? aliasesForRule(row, diagnostics) : new Set();
  const columnClassAlias = normalizedAlias(character?.className);
  const jsonClassAlias = normalizedAlias(basicInfo?.class);
  if (!columnClassAlias || !aliases.has(columnClassAlias)) diagnostics.push(diagnostic("LEGACY_COLUMN_CLASS_MISMATCH"));
  if (!jsonClassAlias || !aliases.has(jsonClassAlias)) diagnostics.push(diagnostic("LEGACY_JSON_CLASS_MISMATCH"));
  const columnLevel = strictLevel(character?.level);
  const jsonLevel = strictLevel(basicInfo?.level);
  if (classLevel == null || columnLevel !== classLevel) diagnostics.push(diagnostic("LEGACY_COLUMN_LEVEL_MISMATCH"));
  if (classLevel == null || jsonLevel !== classLevel) diagnostics.push(diagnostic("LEGACY_JSON_LEVEL_MISMATCH"));

  if (row.subclassRuleId) {
    if (!row.subclassRuleIdResolved) diagnostics.push(diagnostic("SUBCLASS_RULE_MISSING"));
    if (row.subclassRuleIdResolved && row.subclassRuleClassRuleId !== row.classRuleId) {
      diagnostics.push(diagnostic("SUBCLASS_RULE_CLASS_MISMATCH"));
    }
    if (!["SELECTED", "MANUAL"].includes(String(row.subclassStatus))) {
      diagnostics.push(diagnostic("SUBCLASS_STATUS_INCOHERENT"));
    }
  } else if (String(row.subclassStatus) === "SELECTED") {
    diagnostics.push(diagnostic("SUBCLASS_SELECTION_MISSING"));
  }

  if (diagnostics.length > 0) return fallback();

  return {
    source: "STRUCTURED",
    classes: [{
      classKey: row.classKey,
      classRuleId: row.classRuleId,
      level: classLevel,
      sortOrder: Number(row.sortOrder),
      isPrimary: true,
      label: row.ruleLabelIt || row.ruleLabelEn || row.classKey,
      subclassRuleId: row.subclassRuleId ?? null,
      subclassKey: row.subclassKey ?? null,
      subclassStatus: row.subclassStatus,
      source: row.classSource,
    }],
    totalLevel: classLevel,
    progressionRevision,
    diagnostics: [],
  };
}
