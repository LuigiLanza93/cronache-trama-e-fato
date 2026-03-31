import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DATA_DIR = path.resolve(repoRoot, "src/data");
const CHAR_DIR = path.resolve(DATA_DIR, "characters");
const ARCHIVED_CHAR_DIR = path.resolve(DATA_DIR, "archived-characters");
const MONSTERS_DIR = path.resolve(DATA_DIR, "monsters");
const SPELLS_FILE = path.resolve(DATA_DIR, "spells.json");
const SKILLS_FILE = path.resolve(DATA_DIR, "skills.json");
const SPELL_SLOTS_FILE = path.resolve(DATA_DIR, "spellSlots.json");
const USERS_FILE = path.resolve(DATA_DIR, "users.json");
const OWNERSHIP_FILE = path.resolve(DATA_DIR, "character-ownership.json");
const CHATS_FILE = path.resolve(DATA_DIR, "chats.json");
const ENCOUNTER_SCENARIOS_FILE = path.resolve(DATA_DIR, "encounter-scenarios.json");
const SQLITE_CLI = path.resolve(repoRoot, "tools/sqlite/sqlite3.exe");
const DATABASE_FILE = path.resolve(repoRoot, "prisma/migration.db");
const IMPORT_SQL_FILE = path.resolve(repoRoot, "prisma/import-json.sql");
const CMD_EXE = "C:\\Windows\\System32\\cmd.exe";

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "record";
}

function encodeMonsterId(relativePath) {
  return Buffer.from(relativePath, "utf-8").toString("base64url");
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toSqlInsert(tableName, record) {
  const keys = Object.keys(record);
  const columns = keys.map((key) => `"${key}"`).join(", ");
  const values = keys.map((key) => sqlValue(record[key])).join(", ");
  return `INSERT INTO "${tableName}" (${columns}) VALUES (${values});`;
}

function listJsonFilesRecursive(dirPath, prefix = "") {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) return listJsonFilesRecursive(fullPath, relativePath);
    if (!entry.name.endsWith(".json")) return [];
    if (entry.name.startsWith("_")) return [];
    if (entry.name.endsWith(".example.json")) return [];
    return [relativePath];
  });
}

function collectUsers() {
  const users = readJson(USERS_FILE, []);
  return Array.isArray(users)
    ? users.map((user) => ({
        id: String(user.id),
        username: String(user.username),
        displayName: String(user.displayName ?? user.username),
        role: String(user.role).toLowerCase() === "dm" ? "DM" : "PLAYER",
        passwordSalt: String(user.passwordSalt ?? ""),
        passwordHash: String(user.passwordHash ?? ""),
        mustChangePassword: !!user.mustChangePassword,
        createdAt: String(user.createdAt ?? user.updatedAt ?? new Date().toISOString()),
        updatedAt: String(user.updatedAt ?? user.createdAt ?? new Date().toISOString()),
      }))
    : [];
}

function collectCharacters() {
  const ownership = readJson(OWNERSHIP_FILE, {});
  const activeFiles = fs.existsSync(CHAR_DIR)
    ? fs.readdirSync(CHAR_DIR).filter((name) => name.endsWith(".json"))
    : [];
  const archivedFiles = fs.existsSync(ARCHIVED_CHAR_DIR)
    ? fs.readdirSync(ARCHIVED_CHAR_DIR).filter((name) => name.endsWith(".json"))
    : [];

  const activeRecords = activeFiles.map((fileName) => {
    const fullPath = path.join(CHAR_DIR, fileName);
    const data = readJson(fullPath, null);
    if (!data?.slug) return null;
    return {
      id: String(data.slug),
      slug: String(data.slug),
      name: String(data?.basicInfo?.characterName ?? data.slug),
      characterType: String(data.characterType).toLowerCase() === "png" ? "PNG" : "PG",
      ownerUserId: typeof ownership[data.slug] === "string" ? ownership[data.slug] : null,
      createdByUserId: null,
      className: data?.basicInfo?.class ? String(data.basicInfo.class) : null,
      race: data?.basicInfo?.race ? String(data.basicInfo.race) : null,
      alignment: data?.basicInfo?.alignment ? String(data.basicInfo.alignment) : null,
      background: data?.basicInfo?.background ? String(data.basicInfo.background) : null,
      level: Number.isFinite(Number(data?.basicInfo?.level)) ? Number(data.basicInfo.level) : null,
      portraitUrl: data?.basicInfo?.portraitUrl ? String(data.basicInfo.portraitUrl) : null,
      archivedAt: null,
      data: JSON.stringify(data),
      createdAt: new Date(fs.statSync(fullPath).birthtimeMs || fs.statSync(fullPath).mtimeMs).toISOString(),
      updatedAt: new Date(fs.statSync(fullPath).mtimeMs).toISOString(),
    };
  }).filter(Boolean);

  const archivedRecords = archivedFiles.map((fileName) => {
    const fullPath = path.join(ARCHIVED_CHAR_DIR, fileName);
    const data = readJson(fullPath, null);
    if (!data?.slug) return null;
    const archivedAt = new Date(fs.statSync(fullPath).mtimeMs).toISOString();
    return {
      id: String(data.slug),
      slug: String(data.slug),
      name: String(data?.basicInfo?.characterName ?? data.slug),
      characterType: String(data.characterType).toLowerCase() === "png" ? "PNG" : "PG",
      ownerUserId: typeof ownership[data.slug] === "string" ? ownership[data.slug] : null,
      createdByUserId: null,
      className: data?.basicInfo?.class ? String(data.basicInfo.class) : null,
      race: data?.basicInfo?.race ? String(data.basicInfo.race) : null,
      alignment: data?.basicInfo?.alignment ? String(data.basicInfo.alignment) : null,
      background: data?.basicInfo?.background ? String(data.basicInfo.background) : null,
      level: Number.isFinite(Number(data?.basicInfo?.level)) ? Number(data.basicInfo.level) : null,
      portraitUrl: data?.basicInfo?.portraitUrl ? String(data.basicInfo.portraitUrl) : null,
      archivedAt,
      data: JSON.stringify(data),
      createdAt: archivedAt,
      updatedAt: archivedAt,
    };
  }).filter(Boolean);

  return [...activeRecords, ...archivedRecords];
}

function collectMonsters() {
  const files = listJsonFilesRecursive(MONSTERS_DIR);
  return files.map((relativePath) => {
    const fullPath = path.join(MONSTERS_DIR, relativePath);
    const data = readJson(fullPath, null);
    const stats = fs.statSync(fullPath);
    const challenge = data?.general?.challengeRating ?? {};

    return {
      id: encodeMonsterId(relativePath),
      slug: String(data?.slug ?? sanitizeSlug(data?.general?.name ?? path.basename(relativePath, ".json"))),
      name: String(data?.general?.name ?? path.basename(relativePath, ".json")),
      sourceType: relativePath.startsWith("custom/") ? "CUSTOM" : "SRD",
      sourceFile: relativePath.replace(/\\/g, "/"),
      challengeRatingDisplay: challenge?.display ? String(challenge.display) : null,
      challengeRatingDecimal: typeof challenge?.decimal === "number" ? challenge.decimal : null,
      challengeRatingXp: typeof challenge?.xp === "number" ? challenge.xp : null,
      size: data?.general?.size ? String(data.general.size) : null,
      creatureType: data?.general?.creatureType ? String(data.general.creatureType) : null,
      alignment: data?.general?.alignment ? String(data.general.alignment) : null,
      data: JSON.stringify(data),
      createdAt: new Date(stats.birthtimeMs || stats.mtimeMs).toISOString(),
      updatedAt: new Date(stats.mtimeMs).toISOString(),
    };
  });
}

function collectSpells() {
  const catalog = readJson(SPELLS_FILE, {});
  const deduped = new Map();

  for (const [className, spells] of Object.entries(catalog)) {
    if (!Array.isArray(spells)) continue;

    for (const spell of spells) {
      const normalizedName = String(spell?.name ?? "").trim();
      if (!normalizedName) continue;

      const key = sanitizeSlug(normalizedName);
      const now = new Date().toISOString();

      if (!deduped.has(key)) {
        deduped.set(key, {
          id: key,
          slug: key,
          name: normalizedName,
          level: Number.isFinite(Number(spell?.level)) ? Number(spell.level) : 0,
          school: spell?.school ? String(spell.school) : null,
          castingTime: spell?.casting_time ? String(spell.casting_time) : null,
          range: spell?.range ? String(spell.range) : null,
          duration: spell?.duration ? String(spell.duration) : null,
          concentration: !!spell?.concentration,
          ritual: !!spell?.ritual,
          sourceType: "SRD",
          sourceUrl: spell?._source ? String(spell._source) : null,
          classes: new Set(),
          payload: {
            name: normalizedName,
            level: Number.isFinite(Number(spell?.level)) ? Number(spell.level) : 0,
            school: spell?.school ?? null,
            casting_time: spell?.casting_time ?? null,
            range: spell?.range ?? null,
            components: spell?.components ?? null,
            duration: spell?.duration ?? null,
            concentration: !!spell?.concentration,
            saving_throw: spell?.saving_throw ?? null,
            attack_roll: !!spell?.attack_roll,
            damage: spell?.damage ?? null,
            scaling: spell?.scaling ?? null,
            ritual: !!spell?.ritual,
            description: spell?.description ?? "",
            usage: spell?.usage ?? null,
            rest: spell?.rest ?? null,
            _source: spell?._source ?? null,
          },
          createdAt: now,
          updatedAt: now,
        });
      }

      const entry = deduped.get(key);
      entry.classes.add(String(className));
    }
  }

  return Array.from(deduped.values())
    .map((entry) => ({
      id: entry.id,
      slug: entry.slug,
      name: entry.name,
      level: entry.level,
      school: entry.school,
      castingTime: entry.castingTime,
      range: entry.range,
      duration: entry.duration,
      concentration: entry.concentration,
      ritual: entry.ritual,
      sourceType: entry.sourceType,
      sourceUrl: entry.sourceUrl,
      classes: JSON.stringify(Array.from(entry.classes).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))),
      data: JSON.stringify({
        ...entry.payload,
        classes: Array.from(entry.classes).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
      }),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function collectSkills() {
  const data = readJson(SKILLS_FILE, { skills: [] });
  const skills = Array.isArray(data?.skills) ? data.skills : [];
  const now = new Date().toISOString();

  return skills
    .filter((skill) => skill?.name && skill?.ability)
    .map((skill) => ({
      id: sanitizeSlug(String(skill.name)),
      slug: sanitizeSlug(String(skill.name)),
      name: String(skill.name),
      ability: String(skill.ability),
      sourceType: "SRD",
      createdAt: now,
      updatedAt: now,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function collectSpellSlotProgressions() {
  const data = readJson(SPELL_SLOTS_FILE, {});
  const now = new Date().toISOString();
  const rows = [];

  for (const [className, levels] of Object.entries(data)) {
    const classSlug = sanitizeSlug(className);
    if (!levels || typeof levels !== "object") continue;

    for (const [characterLevel, slots] of Object.entries(levels)) {
      rows.push({
        id: `${classSlug}:${characterLevel}`,
        classSlug,
        className: String(className),
        characterLevel: Number(characterLevel),
        slots: JSON.stringify(slots ?? {}),
        sourceType: "SRD",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return rows.sort((a, b) => {
    const classDiff = a.className.localeCompare(b.className, undefined, { sensitivity: "base" });
    if (classDiff !== 0) return classDiff;
    return a.characterLevel - b.characterLevel;
  });
}

function collectChatMessages() {
  const chats = readJson(CHATS_FILE, {});
  const messages = [];

  for (const [slug, thread] of Object.entries(chats)) {
    if (!Array.isArray(thread)) continue;
    thread.forEach((message, index) => {
      messages.push({
        id: String(message?.id ?? `chat_${slug}_${index + 1}`),
        characterId: slug,
        senderUserId: typeof message?.senderUserId === "string" ? message.senderUserId : null,
        senderRole: String(message?.senderRole).toLowerCase() === "dm" ? "DM" : "PLAYER",
        text: String(message?.text ?? ""),
        createdAt: String(message?.createdAt ?? new Date().toISOString()),
      });
    });
  }

  return messages;
}

function collectScenarios() {
  const scenarios = readJson(ENCOUNTER_SCENARIOS_FILE, []);
  if (!Array.isArray(scenarios)) return { scenarios: [], entries: [] };

  const scenarioRows = [];
  const entryRows = [];

  scenarios.forEach((scenario) => {
    const scenarioId = String(scenario.id);
    scenarioRows.push({
      id: scenarioId,
      name: String(scenario.name ?? scenarioId),
      createdByUserId: typeof scenario.createdByUserId === "string" ? scenario.createdByUserId : null,
      createdAt: String(scenario.createdAt ?? new Date().toISOString()),
      updatedAt: String(scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString()),
    });

    const entries = Array.isArray(scenario.entries) ? scenario.entries : [];
    entries.forEach((entry, index) => {
      const entryType = entry?.type === "bestiary" ? "BESTIARY" : "MANUAL";
      entryRows.push({
        id: `${scenarioId}:${index + 1}`,
        scenarioId,
        entryType,
        sortOrder: index + 1,
        monsterId: entryType === "BESTIARY" && typeof entry?.monsterId === "string" ? entry.monsterId : null,
        name: String(entry?.name ?? ""),
        count: Math.max(1, parseInt(entry?.count, 10) || 1),
        armorClass: entryType === "MANUAL" && Number.isFinite(parseInt(entry?.armorClass, 10)) ? parseInt(entry.armorClass, 10) : null,
        hitPoints: Number.isFinite(parseInt(entry?.hitPoints, 10)) ? parseInt(entry.hitPoints, 10) : null,
        powerTag:
          typeof entry?.powerTag === "string"
            ? String(entry.powerTag).toUpperCase()
            : null,
        createdAt: String(scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString()),
        updatedAt: String(scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString()),
      });
    });
  });

  return { scenarios: scenarioRows, entries: entryRows };
}

function buildImportSql() {
  const users = collectUsers();
  const characters = collectCharacters();
  const monsters = collectMonsters();
  const spells = collectSpells();
  const skills = collectSkills();
  const spellSlotProgressions = collectSpellSlotProgressions();
  const chatMessages = collectChatMessages();
  const { scenarios, entries } = collectScenarios();

  const lines = [
    "PRAGMA foreign_keys = OFF;",
    "BEGIN TRANSACTION;",
    'DELETE FROM "ChatMessage";',
    'DELETE FROM "EncounterScenarioEntry";',
    'DELETE FROM "EncounterScenario";',
    'DELETE FROM "SpellSlotProgression";',
    'DELETE FROM "Skill";',
    'DELETE FROM "Spell";',
    'DELETE FROM "Monster";',
    'DELETE FROM "Character";',
    'DELETE FROM "User";',
    ...users.map((row) => toSqlInsert("User", row)),
    ...characters.map((row) => toSqlInsert("Character", row)),
    ...monsters.map((row) => toSqlInsert("Monster", row)),
    ...spells.map((row) => toSqlInsert("Spell", row)),
    ...skills.map((row) => toSqlInsert("Skill", row)),
    ...spellSlotProgressions.map((row) => toSqlInsert("SpellSlotProgression", row)),
    ...scenarios.map((row) => toSqlInsert("EncounterScenario", row)),
    ...entries.map((row) => toSqlInsert("EncounterScenarioEntry", row)),
    ...chatMessages.map((row) => toSqlInsert("ChatMessage", row)),
    "COMMIT;",
    "PRAGMA foreign_keys = ON;",
    "",
  ];

  return {
    sql: lines.join("\n"),
    summary: {
      users: users.length,
      characters: characters.length,
      monsters: monsters.length,
      spells: spells.length,
      skills: skills.length,
      spellSlotProgressions: spellSlotProgressions.length,
      scenarios: scenarios.length,
      scenarioEntries: entries.length,
      chatMessages: chatMessages.length,
    },
  };
}

function ensureRequirements() {
  if (!fs.existsSync(SQLITE_CLI)) {
    throw new Error(`SQLite CLI non trovato: ${SQLITE_CLI}`);
  }
  if (!fs.existsSync(DATABASE_FILE)) {
    throw new Error(`Database SQLite non trovato: ${DATABASE_FILE}`);
  }
}

function applyImportSql() {
  const command = `"${SQLITE_CLI}" "${DATABASE_FILE}" < "${IMPORT_SQL_FILE}"`;
  const result = spawnSync(CMD_EXE, ["/d", "/s", "/c", command], {
    cwd: repoRoot,
    encoding: "utf-8",
    shell: false,
  });

  if (result.status !== 0) {
    const manualCommand = `tools\\sqlite\\sqlite3.exe prisma\\migration.db < prisma\\import-json.sql`;
    throw new Error(
      `Import SQLite fallito (exit ${result.status})\nERROR:\n${result.error?.message ?? ""}\nSTDOUT:\n${result.stdout ?? ""}\nSTDERR:\n${result.stderr ?? ""}\n\nFallback manuale da Prompt dei comandi:\n${manualCommand}`
    );
  }
}

function main() {
  ensureRequirements();

  const dryRun = process.argv.includes("--dry-run");
  const { sql, summary } = buildImportSql();
  fs.writeFileSync(IMPORT_SQL_FILE, sql, "utf-8");

  console.log("[import-json-to-sqlite] SQL generato in prisma/import-json.sql");
  console.log("[import-json-to-sqlite] Riepilogo:", summary);

  if (dryRun) {
    console.log("[import-json-to-sqlite] Dry run: nessun dato importato nel DB.");
    return;
  }

  applyImportSql();
  console.log("[import-json-to-sqlite] Import completato in prisma/migration.db");
}

main();
