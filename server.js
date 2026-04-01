// server.js (ESM)
import { createServer } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { Server as SocketIOServer } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;

// ---- Disk paths ----
const DATA_DIR = path.resolve(__dirname, "src/data");
const MONSTERS_DIR = path.resolve(DATA_DIR, "monsters");
const PORTRAIT_DIR = path.resolve(__dirname, "public/portraits");
const SESSION_COOKIE = "ctf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SQLITE_DB_FILE = path.resolve(__dirname, "prisma", "migration.db");
const sqlite = new DatabaseSync(SQLITE_DB_FILE);
sqlite.exec("PRAGMA foreign_keys = ON;");

// ---- Utilities ----
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "character";
}

function extensionFromType(contentType = "", fileName = "") {
  const normalizedType = String(contentType).toLowerCase();
  if (normalizedType === "image/png") return "png";
  if (normalizedType === "image/jpeg") return "jpg";
  if (normalizedType === "image/webp") return "webp";

  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return null;
}

function parseJsonString(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function runInTransaction(work) {
  sqlite.exec("BEGIN");
  try {
    const result = work();
    sqlite.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // Surface the original failure even if rollback also fails.
    }
    throw error;
  }
}

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: String(row.role).toLowerCase() === "dm" ? "dm" : "player",
    passwordSalt: row.passwordSalt,
    passwordHash: row.passwordHash,
    mustChangePassword: !!row.mustChangePassword,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeCharacterRow(row) {
  if (!row) return null;
  const data = parseJsonString(row.data, {});
  return {
    ...data,
    slug: row.slug,
    characterType: String(row.characterType).toLowerCase(),
    basicInfo: {
      ...(data.basicInfo ?? {}),
      characterName: row.name,
      class: row.className ?? data?.basicInfo?.class ?? "",
      race: row.race ?? data?.basicInfo?.race ?? "",
      alignment: row.alignment ?? data?.basicInfo?.alignment ?? "",
      background: row.background ?? data?.basicInfo?.background ?? "",
      level: row.level ?? data?.basicInfo?.level ?? 1,
      portraitUrl: row.portraitUrl ?? data?.basicInfo?.portraitUrl ?? "",
    },
  };
}

function normalizeMonsterDbRow(row) {
  if (!row) return null;
  const data = parseJsonString(row.data, {});
  if (!data?.general && data?.name) {
    const legacyCr = String(data.challengeRating ?? "");
    const legacyDecimal =
      legacyCr === "1/8" ? 0.125 :
      legacyCr === "1/4" ? 0.25 :
      legacyCr === "1/2" ? 0.5 :
      Number.isFinite(Number(legacyCr)) ? Number(legacyCr) : null;

    return normalizeMonsterRecord(
      {
        slug: row.slug,
        general: {
          name: String(data.name),
          challengeRating: {
            fraction: legacyCr,
            decimal: legacyDecimal,
            display: legacyCr,
            xp: typeof row.challengeRatingXp === "number" ? row.challengeRatingXp : 0,
          },
          size: String(data.size ?? ""),
          creatureType: String(data.type ?? ""),
          subtype: "",
          typeLabel: String(data.type ?? ""),
          alignment: String(data.alignment ?? ""),
          environments: [],
        },
        combat: {
          armorClass: {
            value: Number.isFinite(Number(data.armorClass)) ? Number(data.armorClass) : 0,
            note: "",
          },
          hitPoints: {
            average: Number.isFinite(Number(data.hitPoints)) ? Number(data.hitPoints) : 0,
            formula: String(data.hitDice ?? ""),
          },
          speed: Object.fromEntries(
            Object.entries(data.speed ?? {}).map(([key, value]) => [key, typeof value === "number" ? `${value}` : String(value)])
          ),
        },
        abilities: {
          strength: Number(data?.abilityScores?.strength ?? 10),
          dexterity: Number(data?.abilityScores?.dexterity ?? 10),
          constitution: Number(data?.abilityScores?.constitution ?? 10),
          intelligence: Number(data?.abilityScores?.intelligence ?? 10),
          wisdom: Number(data?.abilityScores?.wisdom ?? 10),
          charisma: Number(data?.abilityScores?.charisma ?? 10),
        },
        details: {
          savingThrows: [],
          skills: Array.isArray(data.skills)
            ? data.skills.map((skill) => ({ name: String(skill), bonus: 0 }))
            : [],
          damageVulnerabilities: [],
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: [],
          senses: Array.isArray(data.senses)
            ? data.senses.map((sense) => ({ name: String(sense) }))
            : [],
          languages: Array.isArray(data.languages)
            ? data.languages.map((language) => ({ name: String(language) }))
            : [],
          proficiencyBonus: Number.isFinite(Number(data.proficiencyBonus)) ? Number(data.proficiencyBonus) : 2,
        },
        traits: Array.isArray(data.specialAbilities)
          ? data.specialAbilities.map((item) => ({
              name: String(item.name ?? ""),
              usage: null,
              description: String(item.description ?? ""),
            }))
          : [],
        actions: Array.isArray(data.actions)
          ? data.actions.map((item) => ({
              name: String(item.name ?? ""),
              usage: null,
              description: String(item.description ?? ""),
            }))
          : [],
        bonusActions: [],
        reactions: [],
        legendaryActions: {
          description: "",
          actions: [],
        },
        lairActions: [],
        regionalEffects: [],
        notes: [],
        source: {},
      },
      row.id,
      row.sourceFile ?? row.filePath ?? ""
    );
  }
  return normalizeMonsterRecord(
    data,
    row.id,
    row.sourceFile ?? row.filePath ?? ""
  );
}

function normalizeSpellRow(row) {
  if (!row) return null;
  const data = parseJsonString(row.data, {});
  const classes = parseJsonString(row.classes, []);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    level: Number.isFinite(Number(row.level)) ? Number(row.level) : 0,
    school: row.school ?? "",
    casting_time: row.castingTime ?? data?.casting_time ?? "",
    range: row.range ?? data?.range ?? "",
    components: data?.components ?? "",
    duration: row.duration ?? data?.duration ?? "",
    concentration: !!row.concentration,
    saving_throw: data?.saving_throw ?? null,
    attack_roll: !!data?.attack_roll,
    damage: data?.damage ?? null,
    scaling: data?.scaling ?? null,
    ritual: !!row.ritual,
    description: data?.description ?? "",
    usage: data?.usage ?? null,
    rest: data?.rest ?? null,
    _source: row.sourceUrl ?? data?._source ?? null,
    classes: Array.isArray(classes) ? classes : [],
  };
}

function normalizeSkillRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ability: row.ability,
    sourceType: String(row.sourceType).toLowerCase(),
  };
}

function readUsers() {
  return sqlite
    .prepare('SELECT * FROM "User" ORDER BY username COLLATE NOCASE')
    .all()
    .map(normalizeUserRow);
}

function readSkills() {
  const skills = sqlite
    .prepare('SELECT * FROM "Skill" ORDER BY name COLLATE NOCASE')
    .all()
    .map(normalizeSkillRow)
    .filter(Boolean);
  return { skills };
}

function readOwnership() {
  const rows = sqlite
    .prepare('SELECT slug, ownerUserId FROM "Character" WHERE archivedAt IS NULL AND ownerUserId IS NOT NULL')
    .all();
  return Object.fromEntries(rows.map((row) => [row.slug, row.ownerUserId]));
}

function writeOwnership(ownership) {
  const allCharacters = sqlite.prepare('SELECT id, slug FROM "Character"').all();
  const clear = sqlite.prepare('UPDATE "Character" SET ownerUserId = NULL WHERE id = ?');
  const set = sqlite.prepare('UPDATE "Character" SET ownerUserId = ? WHERE slug = ?');

  runInTransaction(() => {
    for (const character of allCharacters) {
      clear.run(character.id);
    }
    for (const [slug, userId] of Object.entries(ownership)) {
      set.run(userId, slug);
    }
  });
}

function readChats() {
  const rows = sqlite.prepare(`
    SELECT
      m.id,
      c.slug AS slug,
      m.senderUserId,
      m.senderRole,
      COALESCE(u.displayName, u.username, CASE WHEN m.senderRole = 'DM' THEN 'DM' ELSE 'Player' END) AS senderName,
      m.text,
      m.createdAt
    FROM "ChatMessage" m
    JOIN "Character" c ON c.id = m.characterId
    LEFT JOIN "User" u ON u.id = m.senderUserId
    ORDER BY m.createdAt ASC
  `).all();

  return rows.reduce((acc, row) => {
    if (!acc[row.slug]) acc[row.slug] = [];
    acc[row.slug].push({
      id: row.id,
      slug: row.slug,
      senderUserId: row.senderUserId,
      senderRole: String(row.senderRole).toLowerCase(),
      senderName: row.senderName,
      text: row.text,
      createdAt: row.createdAt,
    });
    return acc;
  }, {});
}

function writeChats(chats) {
  const deleteAll = sqlite.prepare('DELETE FROM "ChatMessage"');
  const findCharacterId = sqlite.prepare('SELECT id FROM "Character" WHERE slug = ?');
  const insert = sqlite.prepare(`
    INSERT INTO "ChatMessage" (id, characterId, senderUserId, senderRole, text, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  runInTransaction(() => {
    deleteAll.run();
    for (const [slug, messages] of Object.entries(chats ?? {})) {
      const character = findCharacterId.get(slug);
      if (!character || !Array.isArray(messages)) continue;
      for (const message of messages) {
        insert.run(
          message.id ?? crypto.randomUUID(),
          character.id,
          message.senderUserId ?? null,
          String(message.senderRole).toLowerCase() === "dm" ? "DM" : "PLAYER",
          message.text ?? "",
          message.createdAt ?? new Date().toISOString()
        );
      }
    }
  });
}

function readEncounterScenarios() {
  const scenarios = sqlite.prepare(`
    SELECT id, name, createdByUserId, createdAt, updatedAt
    FROM "EncounterScenario"
    ORDER BY name COLLATE NOCASE
  `).all();
  const entries = sqlite.prepare(`
    SELECT id, scenarioId, entryType, sortOrder, monsterId, name, count, armorClass, hitPoints, powerTag, createdAt, updatedAt
    FROM "EncounterScenarioEntry"
    ORDER BY sortOrder ASC
  `).all();

  return scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    createdByUserId: scenario.createdByUserId ?? null,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
    entries: entries
      .filter((entry) => entry.scenarioId === scenario.id)
      .map((entry) => ({
        type: entry.entryType === "BESTIARY" ? "bestiary" : "manual",
        monsterId: entry.monsterId ?? undefined,
        name: entry.name,
        count: entry.count,
        armorClass: entry.armorClass ?? undefined,
        hitPoints: entry.hitPoints ?? undefined,
        powerTag: entry.powerTag ? String(entry.powerTag).toLowerCase() : null,
      })),
  }));
}

function readSpellsByClass() {
  const rows = sqlite
    .prepare('SELECT * FROM "Spell" ORDER BY level ASC, name COLLATE NOCASE ASC')
    .all();

  const byClass = {};
  for (const row of rows) {
    const spell = normalizeSpellRow(row);
    if (!spell) continue;
    for (const className of spell.classes) {
      if (!byClass[className]) byClass[className] = [];
      byClass[className].push({
        name: spell.name,
        level: spell.level,
        school: spell.school,
        casting_time: spell.casting_time,
        range: spell.range,
        components: spell.components,
        duration: spell.duration,
        concentration: spell.concentration,
        saving_throw: spell.saving_throw,
        attack_roll: spell.attack_roll,
        damage: spell.damage,
        scaling: spell.scaling,
        ritual: spell.ritual,
        description: spell.description,
        usage: spell.usage,
        rest: spell.rest,
        _source: spell._source,
      });
    }
  }

  return Object.fromEntries(
    Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  );
}

function readSpellSlotProgressions() {
  const rows = sqlite
    .prepare('SELECT className, classSlug, characterLevel, slots FROM "SpellSlotProgression" ORDER BY className COLLATE NOCASE, characterLevel ASC')
    .all();

  const table = {};
  for (const row of rows) {
    const className = String(row.className);
    if (!table[className]) table[className] = {};
    table[className][String(row.characterLevel)] = parseJsonString(row.slots, {});
  }
  return table;
}

function writeEncounterScenarios(scenarios) {
  const deleteEntries = sqlite.prepare('DELETE FROM "EncounterScenarioEntry"');
  const deleteScenarios = sqlite.prepare('DELETE FROM "EncounterScenario"');
  const insertScenario = sqlite.prepare(`
    INSERT INTO "EncounterScenario" (id, name, createdByUserId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertEntry = sqlite.prepare(`
    INSERT INTO "EncounterScenarioEntry" (
      id, scenarioId, entryType, sortOrder, monsterId, name, count, armorClass, hitPoints, powerTag, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  runInTransaction(() => {
    deleteEntries.run();
    deleteScenarios.run();

    for (const scenario of scenarios ?? []) {
      insertScenario.run(
        scenario.id,
        scenario.name,
        scenario.createdByUserId ?? null,
        scenario.createdAt ?? new Date().toISOString(),
        scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString()
      );

      (Array.isArray(scenario.entries) ? scenario.entries : []).forEach((entry, index) => {
        insertEntry.run(
          `${scenario.id}:${index + 1}`,
          scenario.id,
          entry.type === "bestiary" ? "BESTIARY" : "MANUAL",
          index + 1,
          entry.monsterId ?? null,
          entry.name ?? "",
          Math.max(1, parseInt(entry.count, 10) || 1),
          entry.armorClass ?? null,
          entry.hitPoints ?? null,
          entry.powerTag ? String(entry.powerTag).toUpperCase() : null,
          scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString(),
          scenario.updatedAt ?? scenario.createdAt ?? new Date().toISOString()
        );
      });
    }
  });
}

function createScenarioId(name) {
  return `scenario_${sanitizeSlug(name)}_${crypto.randomBytes(4).toString("hex")}`;
}

function encodeMonsterId(relativePath) {
  return Buffer.from(relativePath, "utf-8").toString("base64url");
}

function decodeMonsterId(monsterId) {
  try {
    const relativePath = Buffer.from(String(monsterId), "base64url").toString("utf-8");
    if (!relativePath || relativePath.includes("..")) return null;
    return relativePath.replace(/\\/g, "/");
  } catch {
    return null;
  }
}

function parseMonsterHitPointRange(formula = "", average = 0) {
  const normalized = String(formula)
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "");

  if (!normalized) return null;

  const terms = normalized.match(/[+-]?\d+d\d+|[+-]?\d+/gi);
  if (!terms || terms.length === 0) return null;

  let min = 0;
  let max = 0;
  let consumed = "";

  for (const rawTerm of terms) {
    const term = rawTerm.replace(/\s+/g, "");
    consumed += term;

    const diceMatch = term.match(/^([+-]?)(\d+)d(\d+)$/i);
    if (diceMatch) {
      const sign = diceMatch[1] === "-" ? -1 : 1;
      const count = parseInt(diceMatch[2], 10);
      const sides = parseInt(diceMatch[3], 10);
      if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return null;

      if (sign >= 0) {
        min += count;
        max += count * sides;
      } else {
        min -= count * sides;
        max -= count;
      }
      continue;
    }

    const flat = parseInt(term, 10);
    if (!Number.isFinite(flat)) return null;
    min += flat;
    max += flat;
  }

  if (consumed !== normalized) return null;

  const safeMin = Math.max(0, min);
  const safeMax = Math.max(safeMin, max);
  const safeAverage = Math.min(safeMax, Math.max(safeMin, Math.round(average)));

  return { min: safeMin, max: safeMax, average: safeAverage };
}

function classifyMonsterPowerTag(hitPoints, range) {
  if (!range || !Number.isFinite(hitPoints)) return null;
  if (hitPoints <= range.min) return "debolissimo";
  if (hitPoints >= range.max) return "fortissimo";

  const span = range.max - range.min;
  if (span <= 0) return null;

  const edgeBand = Math.max(1, Math.floor(span * 0.2));
  if (hitPoints <= range.min + edgeBand) return "debole";
  if (hitPoints >= range.max - edgeBand) return "forte";
  return null;
}

function isBestiaryJsonFile(entryName) {
  if (!entryName.endsWith(".json")) return false;
  if (entryName.startsWith("_")) return false;
  if (entryName.endsWith(".example.json")) return false;
  return true;
}

function listMonsterFiles(dirPath = MONSTERS_DIR, prefix = "") {
  ensureDir(dirPath);

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return listMonsterFiles(fullPath, relativePath);
    }

    return isBestiaryJsonFile(entry.name) ? [relativePath] : [];
  });
}

function normalizeMonsterRecord(data = {}, fileId, relativePath) {
  const general = data?.general ?? {};
  const combat = data?.combat ?? {};
  const details = data?.details ?? {};
  const abilities = data?.abilities ?? {};
  const challengeRating = general?.challengeRating ?? {};

  return {
    id: fileId,
    filePath: relativePath,
    slug: typeof data?.slug === "string" ? data.slug : sanitizeSlug(general?.name ?? path.basename(relativePath, ".json")),
    general: {
      name: String(general?.name ?? path.basename(relativePath, ".json")),
      challengeRating: {
        fraction: String(challengeRating?.fraction ?? challengeRating?.display ?? ""),
        decimal: typeof challengeRating?.decimal === "number" ? challengeRating.decimal : null,
        display: String(challengeRating?.display ?? challengeRating?.fraction ?? ""),
        xp: typeof challengeRating?.xp === "number" ? challengeRating.xp : 0,
      },
      size: String(general?.size ?? ""),
      creatureType: String(general?.creatureType ?? ""),
      subtype: String(general?.subtype ?? ""),
      typeLabel: String(general?.typeLabel ?? ""),
      alignment: String(general?.alignment ?? ""),
      environments: Array.isArray(general?.environments) ? general.environments.filter(Boolean) : [],
    },
    combat: {
      armorClass: {
        value: typeof combat?.armorClass?.value === "number" ? combat.armorClass.value : 0,
        note: String(combat?.armorClass?.note ?? ""),
      },
      hitPoints: {
        average: typeof combat?.hitPoints?.average === "number" ? combat.hitPoints.average : 0,
        formula: String(combat?.hitPoints?.formula ?? ""),
      },
      speed: typeof combat?.speed === "object" && combat?.speed !== null ? combat.speed : {},
    },
    abilities: {
      strength: typeof abilities?.strength === "number" ? abilities.strength : 10,
      dexterity: typeof abilities?.dexterity === "number" ? abilities.dexterity : 10,
      constitution: typeof abilities?.constitution === "number" ? abilities.constitution : 10,
      intelligence: typeof abilities?.intelligence === "number" ? abilities.intelligence : 10,
      wisdom: typeof abilities?.wisdom === "number" ? abilities.wisdom : 10,
      charisma: typeof abilities?.charisma === "number" ? abilities.charisma : 10,
    },
    details: {
      savingThrows: Array.isArray(details?.savingThrows) ? details.savingThrows : [],
      skills: Array.isArray(details?.skills) ? details.skills : [],
      damageVulnerabilities: Array.isArray(details?.damageVulnerabilities) ? details.damageVulnerabilities : [],
      damageResistances: Array.isArray(details?.damageResistances) ? details.damageResistances : [],
      damageImmunities: Array.isArray(details?.damageImmunities) ? details.damageImmunities : [],
      conditionImmunities: Array.isArray(details?.conditionImmunities) ? details.conditionImmunities : [],
      senses: Array.isArray(details?.senses) ? details.senses : [],
      languages: Array.isArray(details?.languages) ? details.languages : [],
      proficiencyBonus: typeof details?.proficiencyBonus === "number" ? details.proficiencyBonus : 2,
    },
    traits: Array.isArray(data?.traits) ? data.traits : [],
    actions: Array.isArray(data?.actions) ? data.actions : [],
    bonusActions: Array.isArray(data?.bonusActions) ? data.bonusActions : [],
    reactions: Array.isArray(data?.reactions) ? data.reactions : [],
    legendaryActions:
      typeof data?.legendaryActions === "object" && data?.legendaryActions !== null
        ? {
            description: String(data.legendaryActions.description ?? ""),
            actions: Array.isArray(data.legendaryActions.actions) ? data.legendaryActions.actions : [],
          }
        : { description: "", actions: [] },
    lairActions: Array.isArray(data?.lairActions) ? data.lairActions : [],
    regionalEffects: Array.isArray(data?.regionalEffects) ? data.regionalEffects : [],
    notes: Array.isArray(data?.notes) ? data.notes : [],
    source:
      typeof data?.source === "object" && data?.source !== null
        ? data.source
        : {
            extractedFrom: "",
            rawText: "",
          },
  };
}

function readMonsterByRelativePath(relativePath) {
  const row = sqlite
    .prepare('SELECT * FROM "Monster" WHERE sourceFile = ? LIMIT 1')
    .get(relativePath);
  return normalizeMonsterDbRow(row);
}

function listMonsters() {
  return sqlite
    .prepare('SELECT * FROM "Monster" ORDER BY name COLLATE NOCASE')
    .all()
    .map(normalizeMonsterDbRow)
    .filter(Boolean);
}

function createEmptyMonster(name) {
  const safeName = String(name).trim() || "Nuovo Mostro";
  return normalizeMonsterRecord(
    {
      slug: sanitizeSlug(safeName),
      general: {
        name: safeName,
        challengeRating: {
          fraction: "0",
          decimal: 0,
          display: "0",
          xp: 0,
        },
        size: "Media",
        creatureType: "",
        subtype: "",
        typeLabel: "",
        alignment: "",
        environments: [],
      },
      combat: {
        armorClass: {
          value: 10,
          note: "",
        },
        hitPoints: {
          average: 1,
          formula: "1d8",
        },
        speed: {
          walk: "9 m",
        },
      },
      abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      details: {
        savingThrows: [],
        skills: [],
        damageVulnerabilities: [],
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
        senses: [],
        languages: [],
        proficiencyBonus: 2,
      },
      traits: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      legendaryActions: {
        description: "",
        actions: [],
      },
      lairActions: [],
      regionalEffects: [],
      notes: [],
      source: {
        extractedFrom: "",
        rawText: "",
      },
    },
    "",
    ""
  );
}

function createUniqueMonsterFileName(baseName) {
  const baseSlug = sanitizeSlug(baseName || "monster");
  const existing = new Set(
    sqlite
      .prepare(`SELECT sourceFile FROM "Monster" WHERE sourceType = 'CUSTOM' AND sourceFile IS NOT NULL`)
      .all()
      .map((row) => String(row.sourceFile).replace(/^custom\//, "").replace(/\.json$/i, ""))
  );

  if (!existing.has(baseSlug)) return `${baseSlug}.json`;

  let index = 2;
  while (existing.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}.json`;
}

function listCharacterSlugs() {
  return sqlite
    .prepare('SELECT slug FROM "Character" WHERE archivedAt IS NULL ORDER BY slug COLLATE NOCASE')
    .all()
    .map((row) => row.slug);
}

function readCharacter(slug) {
  const row = sqlite
    .prepare('SELECT * FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(slug);
  return normalizeCharacterRow(row);
}

function listCharacters() {
  return sqlite
    .prepare('SELECT * FROM "Character" WHERE archivedAt IS NULL ORDER BY name COLLATE NOCASE')
    .all()
    .map(normalizeCharacterRow)
    .filter(Boolean);
}

function writeCharacter(slug, data) {
  const basicInfo = data?.basicInfo ?? {};
  const createdByUserId = data?.createdBy?.userId ?? null;
  const existing = sqlite
    .prepare('SELECT id, ownerUserId, createdByUserId, createdAt, archivedAt FROM "Character" WHERE slug = ? LIMIT 1')
    .get(slug);

  const payload = {
    id: existing?.id ?? slug,
    slug,
    name: String(basicInfo.characterName ?? slug),
    characterType: String(data?.characterType).toLowerCase() === "png" ? "PNG" : "PG",
    ownerUserId: existing?.ownerUserId ?? null,
    createdByUserId: existing?.createdByUserId ?? createdByUserId,
    className: basicInfo.class ? String(basicInfo.class) : null,
    race: basicInfo.race ? String(basicInfo.race) : null,
    alignment: basicInfo.alignment ? String(basicInfo.alignment) : null,
    background: basicInfo.background ? String(basicInfo.background) : null,
    level: Number.isFinite(Number(basicInfo.level)) ? Number(basicInfo.level) : null,
    portraitUrl: basicInfo.portraitUrl ? String(basicInfo.portraitUrl) : null,
    archivedAt: existing?.archivedAt ?? null,
    data: JSON.stringify(data),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    sqlite.prepare(`
      UPDATE "Character"
      SET
        name = ?,
        characterType = ?,
        ownerUserId = ?,
        createdByUserId = ?,
        className = ?,
        race = ?,
        alignment = ?,
        background = ?,
        level = ?,
        portraitUrl = ?,
        archivedAt = ?,
        data = ?,
        updatedAt = ?
      WHERE slug = ?
    `).run(
      payload.name,
      payload.characterType,
      payload.ownerUserId,
      payload.createdByUserId,
      payload.className,
      payload.race,
      payload.alignment,
      payload.background,
      payload.level,
      payload.portraitUrl,
      payload.archivedAt,
      payload.data,
      payload.updatedAt,
      slug
    );
    return;
  }

  sqlite.prepare(`
    INSERT INTO "Character" (
      id, slug, name, characterType, ownerUserId, createdByUserId, className, race, alignment, background,
      level, portraitUrl, archivedAt, data, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.id,
    payload.slug,
    payload.name,
    payload.characterType,
    payload.ownerUserId,
    payload.createdByUserId,
    payload.className,
    payload.race,
    payload.alignment,
    payload.background,
    payload.level,
    payload.portraitUrl,
    payload.archivedAt,
    payload.data,
    payload.createdAt,
    payload.updatedAt
  );
}

function archiveCharacter(slug) {
  const archivedAt = new Date().toISOString();
  const result = sqlite
    .prepare('UPDATE "Character" SET archivedAt = ?, updatedAt = ? WHERE slug = ? AND archivedAt IS NULL')
    .run(archivedAt, archivedAt, slug);
  if (!result.changes) return null;
  return archivedAt;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  if (!user?.passwordSalt || !user?.passwordHash) return false;

  const computed = hashPassword(password, user.passwordSalt);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(user.passwordHash, "hex"));
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function serializeSessionCookie(value) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

function serializeExpiredSessionCookie() {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

function createSessionId() {
  return crypto.randomBytes(24).toString("hex");
}

function cleanupExpiredSessions() {
  sqlite.prepare('DELETE FROM "Session" WHERE expiresAt <= ?').run(new Date().toISOString());
}

function getSessionById(sessionId) {
  if (!sessionId) return null;
  cleanupExpiredSessions();
  const session = sqlite
    .prepare('SELECT id, userId, createdAt, expiresAt, lastSeenAt FROM "Session" WHERE id = ? LIMIT 1')
    .get(sessionId);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    sqlite.prepare('DELETE FROM "Session" WHERE id = ?').run(sessionId);
    return null;
  }
  return session;
}

function touchSession(sessionId) {
  if (!sessionId) return;
  const nextExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sqlite
    .prepare('UPDATE "Session" SET lastSeenAt = ?, expiresAt = ? WHERE id = ?')
    .run(new Date().toISOString(), nextExpiresAt, sessionId);
}

function createSession(userId) {
  const sessionId = createSessionId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sqlite
    .prepare('INSERT INTO "Session" (id, userId, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, ?, ?)')
    .run(sessionId, userId, now, expiresAt, now);
  return sessionId;
}

function deleteSessionById(sessionId) {
  if (!sessionId) return;
  sqlite.prepare('DELETE FROM "Session" WHERE id = ?').run(sessionId);
}

function deleteSessionsByUserId(userId) {
  if (!userId) return;
  sqlite.prepare('DELETE FROM "Session" WHERE userId = ?').run(userId);
}

function sanitizeUser(user, ownership) {
  if (!user) return null;

  const ownedCharacters = Object.entries(ownership)
    .filter(([, ownerUserId]) => ownerUserId === user.id)
    .map(([slug]) => slug)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? user.username,
    role: user.role,
    mustChangePassword: !!user.mustChangePassword,
    ownedCharacters,
  };
}

function getUserById(userId) {
  const row = sqlite
    .prepare('SELECT * FROM "User" WHERE id = ? LIMIT 1')
    .get(userId);
  return normalizeUserRow(row);
}

function createUserRecord(user) {
  sqlite.prepare(`
    INSERT INTO "User" (
      id, username, displayName, role, passwordSalt, passwordHash, mustChangePassword, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.displayName ?? user.username,
    String(user.role).toLowerCase() === "dm" ? "DM" : "PLAYER",
    user.passwordSalt ?? "",
    user.passwordHash ?? "",
    user.mustChangePassword ? 1 : 0,
    user.createdAt ?? new Date().toISOString(),
    user.updatedAt ?? user.createdAt ?? new Date().toISOString()
  );
}

function updateUserCredentials(userId, { passwordSalt, passwordHash, mustChangePassword }) {
  const updatedAt = new Date().toISOString();
  const result = sqlite.prepare(`
    UPDATE "User"
    SET passwordSalt = ?, passwordHash = ?, mustChangePassword = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    passwordSalt,
    passwordHash,
    mustChangePassword ? 1 : 0,
    updatedAt,
    userId
  );

  if (!result.changes) return null;
  return getUserById(userId);
}

function deleteUserRecord(userId) {
  return sqlite.prepare('DELETE FROM "User" WHERE id = ?').run(userId);
}

function canAccessCharacter(user, slug, ownership) {
  if (!user) return false;
  if (user.role === "dm") return true;
  return ownership[slug] === user.id;
}

function canEditCharacter(user, slug, ownership) {
  return canAccessCharacter(user, slug, ownership);
}

function sanitizeUserForAdmin(user, ownership) {
  const base = sanitizeUser(user, ownership);
  if (!base) return null;

  return {
    ...base,
    createdAt: user.createdAt ?? null,
  };
}

function createUserId(username) {
  return `user_${sanitizeSlug(username)}_${crypto.randomBytes(4).toString("hex")}`;
}

function createUniqueCharacterSlug(baseSlug) {
  const existing = new Set(
    sqlite.prepare('SELECT slug FROM "Character"').all().map((row) => row.slug)
  );
  if (!existing.has(baseSlug)) return baseSlug;

  let index = 2;
  while (existing.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}`;
}

function createEmptyCharacter({
  slug,
  name,
  characterType,
  className,
  race,
  alignment,
  background,
  creator,
  ownerUser,
}) {
  const skills = readSkills().skills ?? [];

  return {
    slug,
    characterType,
    basicInfo: {
      characterName: name,
      class: className,
      level: 1,
      background,
      playerName: creator.displayName ?? creator.username,
      race,
      alignment,
      experiencePoints: 0,
      portraitUrl: "",
    },
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    combatStats: {
      armorClass: 10,
      initiative: 0,
      speed: 9,
      hitPointMaximum: 1,
      currentHitPoints: 1,
      temporaryHitPoints: 0,
      hitDice: "",
      deathSaves: {
        successes: 0,
        failures: 0,
      },
      spellSlots: {
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
        7: [],
        8: [],
        9: [],
        10: [],
        11: [],
        12: [],
      },
    },
    proficiencies: {
      proficiencyBonus: 2,
      savingThrows: [],
      skills: skills.map((skill) => ({
        name: skill.name,
        ability: skill.ability,
        proficient: false,
      })),
      languages: [],
    },
    equipment: {
      attacks: [],
      equipment: [],
      items: [],
      coins: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: 0,
        pp: 0,
      },
    },
    features: [],
    capabilities: [],
    createdBy: {
      userId: creator.id,
      role: creator.role,
      username: creator.username,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Deep merge (objects merged, arrays replaced, scalars overwritten) */
function deepMerge(target, patch) {
  if (Array.isArray(target) && Array.isArray(patch)) {
    return patch.slice();
  }
  if (
    typeof target === "object" && target !== null &&
    typeof patch === "object" && patch !== null
  ) {
    const out = { ...target };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = k in target ? deepMerge(target[k], v) : v;
    }
    return out;
  }
  return patch;
}

// Optional: debounce writes per slug to avoid hammering the disk
const persistTimers = new Map();
function scheduleWrite(slug, state) {
  clearTimeout(persistTimers.get(slug));
  const t = setTimeout(() => {
    try {
      writeCharacter(slug, state);
    } catch (e) {
      console.error(`[server] persist failed for ${slug}:`, e);
    }
  }, 200);
  persistTimers.set(slug, t);
}

// ---- App ----
async function start() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  ensureDir(PORTRAIT_DIR);
  app.use("/portraits", express.static(PORTRAIT_DIR));

  app.use((req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    const session = getSessionById(sessionId);
    const user = session?.userId ? getUserById(session.userId) : null;
    req.sessionId = sessionId ?? null;
    req.user = user ?? null;
    if (sessionId && session) touchSession(sessionId);
    next();
  });

  function requireAuth(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  }

  function requireRole(role) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
      next();
    };
  }

  // ===== Auth =====
  app.get("/api/auth/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    return res.json(sanitizeUser(req.user, readOwnership()));
  });

  app.post("/api/auth/login", (req, res) => {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const users = readUsers();
    const user = users.find((entry) => String(entry.username).toLowerCase() === username);

    if (!user || !verifyPassword(password, user)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionId = createSession(user.id);
    res.setHeader("Set-Cookie", serializeSessionCookie(sessionId));
    return res.json(sanitizeUser(user, readOwnership()));
  });

  app.post("/api/auth/logout", (req, res) => {
    if (req.sessionId) deleteSessionById(req.sessionId);
    res.setHeader("Set-Cookie", serializeExpiredSessionCookie());
    return res.status(204).end();
  });

  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const newPassword = String(req.body?.newPassword ?? "");

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ error: "Password too short" });
    }

    if (!getUserById(req.user.id)) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const updatedUser = updateUserCredentials(req.user.id, {
      passwordSalt,
      passwordHash: hashPassword(newPassword, passwordSalt),
      mustChangePassword: false,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    deleteSessionsByUserId(req.user.id);
    const sessionId = createSession(updatedUser.id);
    res.setHeader("Set-Cookie", serializeSessionCookie(sessionId));
    return res.json(sanitizeUser(updatedUser, readOwnership()));
  });

  // ===== User management =====
  app.get("/api/users", requireRole("dm"), (req, res) => {
    const ownership = readOwnership();
    const users = readUsers()
      .map((user) => sanitizeUserForAdmin(user, ownership))
      .filter(Boolean)
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }));

    return res.json(users);
  });

  app.post("/api/users", requireRole("dm"), (req, res) => {
    const username = String(req.body?.username ?? "").trim().toLowerCase();
    const role = req.body?.role === "dm" ? "dm" : "player";
    const displayNameRaw = String(req.body?.displayName ?? "").trim();
    const users = readUsers();

    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    if (!/^[a-z0-9_]+$/i.test(username)) {
      return res.status(400).json({ error: "Invalid username" });
    }

    if (users.some((user) => user.username.toLowerCase() === username)) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const newUser = {
      id: createUserId(username),
      username,
      displayName: displayNameRaw || username,
      role,
      passwordSalt,
      passwordHash: hashPassword(username, passwordSalt),
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };

    createUserRecord(newUser);
    return res.status(201).json(sanitizeUserForAdmin(newUser, readOwnership()));
  });

  app.post("/api/users/:userId/reset-password", requireRole("dm"), (req, res) => {
    const userId = req.params.userId;
    const currentUser = getUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextPassword = currentUser.username;
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const updatedUser = updateUserCredentials(userId, {
      passwordSalt,
      passwordHash: hashPassword(nextPassword, passwordSalt),
      mustChangePassword: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    deleteSessionsByUserId(userId);
    return res.json(sanitizeUserForAdmin(updatedUser, readOwnership()));
  });

  app.delete("/api/users/:userId", requireRole("dm"), (req, res) => {
    const userId = req.params.userId;
    if (req.user.id === userId) {
      return res.status(400).json({ error: "Cannot delete current user" });
    }

    const result = deleteUserRecord(userId);
    if (!result.changes) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(204).end();
  });

  app.get("/api/character-ownership", requireRole("dm"), (req, res) => {
    const ownership = readOwnership();
    const users = readUsers();
    const validUserIds = new Set(users.map((user) => user.id));
    const characters = new Set(listCharacterSlugs());

    const sanitizedOwnership = Object.fromEntries(
      Object.entries(ownership).filter(([slug, userId]) => characters.has(slug) && validUserIds.has(userId))
    );

    return res.json(sanitizedOwnership);
  });

  app.put("/api/character-ownership/:slug", requireRole("dm"), (req, res) => {
    const slug = req.params.slug;
    const userId = req.body?.userId ?? null;
    const ownership = readOwnership();

    if (!listCharacterSlugs().includes(slug)) {
      return res.status(404).json({ error: "Character not found" });
    }

    if (userId !== null) {
      const user = getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      ownership[slug] = userId;
    } else {
      delete ownership[slug];
    }

    writeOwnership(ownership);
    return res.json({ slug, userId: ownership[slug] ?? null });
  });

  app.get("/api/chats/:slug", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const chats = readChats();
    return res.json(Array.isArray(chats[slug]) ? chats[slug] : []);
  });

  // ===== Bestiary =====
  app.get("/api/monsters", requireRole("dm"), (req, res) => {
    const monsters = listMonsters().map((monster) => ({
      id: monster.id,
      slug: monster.slug,
      name: monster.general.name,
      challengeRating: monster.general.challengeRating,
      size: monster.general.size,
      creatureType: monster.general.creatureType || monster.general.typeLabel,
      alignment: monster.general.alignment,
      filePath: monster.filePath,
      armorClass: monster.combat.armorClass.value,
      hitPointsAverage: monster.combat.hitPoints.average,
    }));

    return res.json(monsters);
  });

  app.get("/api/monsters/:monsterId", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const monster = readMonsterByRelativePath(relativePath);
    if (!monster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    return res.json(monster);
  });

  app.get("/api/spells", requireAuth, (req, res) => {
    return res.json(readSpellsByClass());
  });

  app.get("/api/rules/skills", requireAuth, (req, res) => {
    return res.json(readSkills());
  });

  app.get("/api/rules/spell-slots", requireAuth, (req, res) => {
    return res.json(readSpellSlotProgressions());
  });

  app.put("/api/monsters/:monsterId", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const currentMonster = readMonsterByRelativePath(relativePath);
    if (!currentMonster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    const payload = req.body?.monster;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Monster payload required" });
    }

    const nextMonster = normalizeMonsterRecord(payload, currentMonster.id, relativePath);
    if (!nextMonster.general.name.trim()) {
      return res.status(400).json({ error: "Monster name required" });
    }

    sqlite.prepare(`
      UPDATE "Monster"
      SET
        slug = ?,
        name = ?,
        challengeRatingDisplay = ?,
        challengeRatingDecimal = ?,
        challengeRatingXp = ?,
        size = ?,
        creatureType = ?,
        alignment = ?,
        data = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(
      nextMonster.slug || sanitizeSlug(nextMonster.general.name),
      nextMonster.general.name,
      nextMonster.general.challengeRating.display || null,
      nextMonster.general.challengeRating.decimal,
      nextMonster.general.challengeRating.xp,
      nextMonster.general.size || null,
      nextMonster.general.creatureType || nextMonster.general.typeLabel || null,
      nextMonster.general.alignment || null,
      JSON.stringify({
        slug: nextMonster.slug || sanitizeSlug(nextMonster.general.name),
        general: nextMonster.general,
        combat: nextMonster.combat,
        abilities: nextMonster.abilities,
        details: nextMonster.details,
        traits: nextMonster.traits,
        actions: nextMonster.actions,
        bonusActions: nextMonster.bonusActions,
        reactions: nextMonster.reactions,
        legendaryActions: nextMonster.legendaryActions,
        lairActions: nextMonster.lairActions,
        regionalEffects: nextMonster.regionalEffects,
        notes: nextMonster.notes,
        source: nextMonster.source,
      }),
      new Date().toISOString(),
      nextMonster.id
    );

    return res.json(readMonsterByRelativePath(relativePath));
  });

  app.post("/api/monsters", requireRole("dm"), (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const duplicateFromId = typeof req.body?.duplicateFromId === "string" ? req.body.duplicateFromId : null;

    if (!name) {
      return res.status(400).json({ error: "Monster name required" });
    }

    let nextMonster = createEmptyMonster(name);
    if (duplicateFromId) {
      const sourceRelativePath = decodeMonsterId(duplicateFromId);
      if (!sourceRelativePath) {
        return res.status(400).json({ error: "Invalid source monster id" });
      }

      const sourceMonster = readMonsterByRelativePath(sourceRelativePath);
      if (!sourceMonster) {
        return res.status(404).json({ error: "Source monster not found" });
      }

      nextMonster = normalizeMonsterRecord(
        {
          ...sourceMonster,
          slug: sanitizeSlug(name),
          general: {
            ...sourceMonster.general,
            name,
          },
        },
        "",
        ""
      );
    } else {
      nextMonster.general.name = name;
      nextMonster.slug = sanitizeSlug(name);
    }

    const fileName = createUniqueMonsterFileName(name);
    const relativePath = `custom/${fileName}`;
    const now = new Date().toISOString();
    const monsterId = encodeMonsterId(relativePath);

    sqlite.prepare(`
      INSERT INTO "Monster" (
        id, slug, name, sourceType, sourceFile, challengeRatingDisplay, challengeRatingDecimal,
        challengeRatingXp, size, creatureType, alignment, data, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      monsterId,
      nextMonster.slug || sanitizeSlug(name),
      nextMonster.general.name,
      "CUSTOM",
      relativePath,
      nextMonster.general.challengeRating.display || null,
      nextMonster.general.challengeRating.decimal,
      nextMonster.general.challengeRating.xp,
      nextMonster.general.size || null,
      nextMonster.general.creatureType || nextMonster.general.typeLabel || null,
      nextMonster.general.alignment || null,
      JSON.stringify({
        slug: nextMonster.slug || sanitizeSlug(name),
        general: nextMonster.general,
        combat: nextMonster.combat,
        abilities: nextMonster.abilities,
        details: nextMonster.details,
        traits: nextMonster.traits,
        actions: nextMonster.actions,
        bonusActions: nextMonster.bonusActions,
        reactions: nextMonster.reactions,
        legendaryActions: nextMonster.legendaryActions,
        lairActions: nextMonster.lairActions,
        regionalEffects: nextMonster.regionalEffects,
        notes: nextMonster.notes,
        source: nextMonster.source,
      }),
      now,
      now
    );

    return res.status(201).json(readMonsterByRelativePath(relativePath));
  });

  // ===== Encounter scenarios =====
  app.get("/api/encounter-scenarios", requireRole("dm"), (req, res) => {
    const scenarios = readEncounterScenarios()
      .filter((scenario) => scenario && typeof scenario === "object" && typeof scenario.id === "string")
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" }));

    return res.json(scenarios);
  });

  app.post("/api/encounter-scenarios", requireRole("dm"), (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

    if (!name) {
      return res.status(400).json({ error: "Scenario name required" });
    }

    if (entries.length === 0) {
      return res.status(400).json({ error: "Scenario entries required" });
    }

    const normalizedEntries = [];
    for (const entry of entries) {
      const type = entry?.type === "bestiary" ? "bestiary" : "manual";
      const count = Math.max(1, parseInt(entry?.count, 10) || 1);

      if (type === "bestiary") {
        const monsterId = typeof entry?.monsterId === "string" ? entry.monsterId : "";
        const hitPoints = parseInt(entry?.hitPoints, 10);
        const relativePath = decodeMonsterId(monsterId);
        const monster = relativePath ? readMonsterByRelativePath(relativePath) : null;
        if (!monster) {
          return res.status(400).json({ error: "Invalid bestiary monster in scenario" });
        }

        const normalizedHitPoints = Number.isFinite(hitPoints)
          ? Math.max(0, hitPoints)
          : monster.combat.hitPoints.average;
        const powerTag = classifyMonsterPowerTag(
          normalizedHitPoints,
          parseMonsterHitPointRange(monster.combat.hitPoints.formula, monster.combat.hitPoints.average)
        );

        normalizedEntries.push({
          type: "bestiary",
          monsterId: monster.id,
          name: monster.general.name,
          hitPoints: normalizedHitPoints,
          powerTag,
          count,
        });
        continue;
      }

      const manualName = String(entry?.name ?? "").trim();
      const armorClass = parseInt(entry?.armorClass, 10);
      const hitPoints = parseInt(entry?.hitPoints, 10);
      if (!manualName) {
        return res.status(400).json({ error: "Manual scenario entry requires a name" });
      }

      normalizedEntries.push({
        type: "manual",
        name: manualName,
        armorClass: Number.isFinite(armorClass) ? armorClass : 0,
        hitPoints: Number.isFinite(hitPoints) ? Math.max(0, hitPoints) : 0,
        count,
      });
    }

    const scenarios = readEncounterScenarios();
    const scenario = {
      id: createScenarioId(name),
      name,
      entries: normalizedEntries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    scenarios.push(scenario);
    writeEncounterScenarios(scenarios);
    return res.status(201).json(scenario);
  });

  app.delete("/api/encounter-scenarios/:scenarioId", requireRole("dm"), (req, res) => {
    const scenarioId = req.params.scenarioId;
    const scenarios = readEncounterScenarios();
    const nextScenarios = scenarios.filter((scenario) => scenario.id !== scenarioId);
    if (nextScenarios.length === scenarios.length) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    writeEncounterScenarios(nextScenarios);
    return res.status(204).end();
  });

  // ===== Characters =====
  app.get("/api/characters", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const characters = listCharacters().filter((character) =>
      canAccessCharacter(req.user, character.slug, ownership)
    );

    return res.json(characters);
  });

  app.get("/api/characters/:slug", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();

    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const state = readCharacter(slug);
    if (!state) return res.status(404).json({ error: "Character not found" });
    return res.json(state);
  });

  app.post("/api/characters", requireAuth, (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const requestedType = req.body?.characterType === "png" ? "png" : "pg";
    const className = String(req.body?.className ?? "").trim();
    const race = String(req.body?.race ?? "").trim();
    const alignment = String(req.body?.alignment ?? "").trim();
    const background = String(req.body?.background ?? "").trim();

    if (!name) {
      return res.status(400).json({ error: "Name required" });
    }

    if (!className || !race || !alignment || !background) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const characterType = req.user.role === "dm" ? requestedType : "pg";
    const baseSlug = sanitizeSlug(name);
    const slug = createUniqueCharacterSlug(baseSlug);

    let ownerUserId = null;
    if (req.user.role === "dm") {
      if (characterType === "png") ownerUserId = req.user.id;
    } else {
      ownerUserId = req.user.id;
    }

    const ownerUser = ownerUserId ? getUserById(ownerUserId) : null;
    const character = createEmptyCharacter({
      slug,
      name,
      characterType,
      className,
      race,
      alignment,
      background,
      creator: req.user,
      ownerUser,
    });

    writeCharacter(slug, character);

    if (ownerUserId) {
      const ownership = readOwnership();
      ownership[slug] = ownerUserId;
      writeOwnership(ownership);
    }

    return res.status(201).json({
      slug,
      characterType,
      ownerUserId,
      character,
    });
  });

  app.delete("/api/characters/:slug", requireRole("dm"), (req, res) => {
    const slug = req.params.slug;

    if (!listCharacterSlugs().includes(slug)) {
      return res.status(404).json({ error: "Character not found" });
    }

    const archivedPath = archiveCharacter(slug);
    if (!archivedPath) {
      return res.status(500).json({ error: "Archive failed" });
    }

    const ownership = readOwnership();
    if (slug in ownership) {
      delete ownership[slug];
      writeOwnership(ownership);
    }

    const chats = readChats();
    if (slug in chats) {
      delete chats[slug];
      writeChats(chats);
    }

    return res.status(204).end();
  });

  app.post("/api/uploads/avatar", requireAuth, (req, res) => {
    const { slug, fileName, contentType, data } = req.body ?? {};
    const ext = extensionFromType(contentType, fileName);
    const normalizedSlug = sanitizeSlug(slug);
    const ownership = readOwnership();

    if (!normalizedSlug || !data || !ext) {
      return res.status(400).json({ error: "Invalid upload payload" });
    }

    if (!canEditCharacter(req.user, normalizedSlug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    let buffer;
    try {
      buffer = Buffer.from(String(data), "base64");
    } catch {
      return res.status(400).json({ error: "Invalid image encoding" });
    }

    if (!buffer?.length) {
      return res.status(400).json({ error: "Empty image payload" });
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: "Image too large" });
    }

    const fileBase = `${normalizedSlug}-${Date.now()}.${ext}`;
    const filePath = path.join(PORTRAIT_DIR, fileBase);

    try {
      fs.writeFileSync(filePath, buffer);
      return res.json({ url: `/portraits/${fileBase}` });
    } catch (error) {
      console.error("[server] avatar upload failed:", error);
      return res.status(500).json({ error: "Upload failed" });
    }
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // ===== Presence state =====
  const viewersBySlug = new Map();
  const slugBySocket = new Map();

  const broadcastPresence = () => {
    const payload = Array.from(viewersBySlug.entries())
      .map(([slug, set]) => ({ slug, count: set.size }))
      .filter(({ count }) => count > 0);
    io.emit("presence:update", payload);
  };

  function getSocketUser(socket) {
    const cookies = parseCookies(socket.request.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    const session = getSessionById(sessionId);
    if (sessionId && session) touchSession(sessionId);
    return session?.userId ? getUserById(session.userId) : null;
  }

  io.on("connection", (socket) => {
    const user = getSocketUser(socket);
    socket.data.user = user;
    if (user?.id) {
      socket.join(`user:${user.id}`);
    }

    socket.on("character:join", (slug) => {
      const ownership = readOwnership();
      if (!canAccessCharacter(socket.data.user, slug, ownership)) return;

      socket.join(`char:${slug}`);
      const state = readCharacter(slug);
      if (state) socket.emit("character:state", state);
    });

    socket.on("character:update", ({ slug, patch }) => {
      if (!slug || !patch) return;

      const ownership = readOwnership();
      if (!canEditCharacter(socket.data.user, slug, ownership)) return;

      const current = readCharacter(slug) || {};
      const next = deepMerge(current, patch);
      scheduleWrite(slug, next);
      socket.to(`char:${slug}`).emit("character:patch", { slug, patch });
      socket.emit("character:state", next);
    });

    socket.on("dm:private-message", ({ slug, title, message }) => {
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const normalizedMessage = typeof message === "string" ? message.trim() : "";
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      const ownership = readOwnership();

      if (socket.data.user?.role !== "dm" || !normalizedSlug || !normalizedMessage) return;

      const ownerUserId = ownership[normalizedSlug];
      if (!ownerUserId) return;

      io.to(`user:${ownerUserId}`).emit("dm:private-message", {
        slug: normalizedSlug,
        title: normalizedTitle || undefined,
        message: normalizedMessage,
        sentAt: new Date().toISOString(),
      });
    });

    socket.on("chat:join", (slug) => {
      const ownership = readOwnership();
      if (!slug || !canAccessCharacter(socket.data.user, slug, ownership)) return;
      socket.join(`chat:${slug}`);
    });

    socket.on("chat:message", ({ slug, text }) => {
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const normalizedText = typeof text === "string" ? text.trim() : "";
      const ownership = readOwnership();

      if (!normalizedSlug || !normalizedText || !canAccessCharacter(socket.data.user, normalizedSlug, ownership)) {
        return;
      }

      const chats = readChats();
      const nextMessage = {
        id: crypto.randomUUID(),
        slug: normalizedSlug,
        senderUserId: socket.data.user.id,
        senderRole: socket.data.user.role,
        senderName: socket.data.user.displayName ?? socket.data.user.username,
        text: normalizedText,
        createdAt: new Date().toISOString(),
      };

      const thread = Array.isArray(chats[normalizedSlug]) ? chats[normalizedSlug] : [];
      chats[normalizedSlug] = [...thread, nextMessage];
      writeChats(chats);

      io.to(`chat:${normalizedSlug}`).emit("chat:message", nextMessage);
    });

    socket.on("initiative:turn-start", ({ slug }) => {
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const ownership = readOwnership();

      if (socket.data.user?.role !== "dm" || !normalizedSlug) return;

      const ownerUserId = ownership[normalizedSlug];
      if (!ownerUserId) return;

      io.to(`user:${ownerUserId}`).emit("initiative:turn-start", {
        slug: normalizedSlug,
        startedAt: new Date().toISOString(),
      });
    });

    socket.on("presence:snapshot", () => {
      const payload = Array.from(viewersBySlug.entries())
        .map(([slug, set]) => ({ slug, count: set.size }))
        .filter(({ count }) => count > 0);
      socket.emit("presence:update", payload);
    });

    socket.on("presence:enter", ({ slug }) => {
      const ownership = readOwnership();
      if (!slug || !canAccessCharacter(socket.data.user, slug, ownership)) return;
      if (!viewersBySlug.has(slug)) viewersBySlug.set(slug, new Set());
      viewersBySlug.get(slug).add(socket.id);
      slugBySocket.set(socket.id, slug);
      broadcastPresence();
    });

    socket.on("presence:leave", () => {
      const slug = slugBySocket.get(socket.id);
      if (!slug) return;
      const set = viewersBySlug.get(slug);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) viewersBySlug.delete(slug);
      }
      slugBySocket.delete(socket.id);
      broadcastPresence();
    });

    socket.on("disconnect", () => {
      const slug = slugBySocket.get(socket.id);
      if (!slug) return;
      const set = viewersBySlug.get(slug);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) viewersBySlug.delete(slug);
      }
      slugBySocket.delete(socket.id);
      broadcastPresence();
    });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res) => {
      try {
        const url = req.originalUrl;
        const html = await vite.transformIndexHtml(
          url,
          fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8")
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace?.(e);
        console.error(e);
        res.status(500).end(e.message);
      }
    });
  } else {
    app.use(compression());
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist/index.html"));
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);

    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(` -> Network: http://${net.address}:${PORT}`);
        }
      }
    }
  });
}

start();
