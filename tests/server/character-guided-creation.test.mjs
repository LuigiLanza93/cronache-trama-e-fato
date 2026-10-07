import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  persistGuidedCharacterCreation,
  projectGuidedLevelOneCharacter,
  readCharacterCreationFromDatabase,
  resolveGuidedCreationSubclassKey,
  serializeCharacterSnapshot,
  buildCharacterProgressionEffects,
} from "../../server.js";
import { getLevelOneCreationOptions, normalizeLevelOneCreationInput } from "../../shared/character-creation-rules.mjs";
import { guidedCreationHitPointsPerLevel, projectGuidedCreationCapabilities } from "../../shared/character-creation-capabilities.mjs";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const databases = [];
const temporaryDirectories = [];
const childProcesses = [];
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

it('level-up resource projection preserves separate acquired pools and manual overrides', () => {
  const creation = { identity: { classKey: 'paladin' }, features: [{ key: 'lay-on-hands' }, { key: 'divine-sense' }] };
  const snapshot = { schema: { m6Ready: true }, creation: { resolved: creation }, state: { abilityScores: { charisma: 16 } }, resourcePools: [
    { poolKey: 'creation:lay-on-hands', kind: 'CLASS_RESOURCE', maximum: { '0': 5 }, used: { '0': 3 }, tiers: [{ tierKey: '0', derivedMaximum: 5, maximumOverride: 20 }] },
    { poolKey: 'creation:divine-sense', kind: 'CLASS_RESOURCE', maximum: { '0': 2 }, used: { '0': 1 } },
  ] };
  const effects = buildCharacterProgressionEffects(snapshot, { after: {}, targetClassKey: 'paladin', classesAfter: [{ classKey: 'paladin', level: 2 }] });
  expect(effects.resourcePools.after).toHaveLength(2);
  expect(effects.resourcePools.after[0]).toMatchObject({ maximum: { '0': 20 }, used: { '0': 3 }, tiers: [{ derivedMaximum: 10, maximumOverride: 20 }] });
  expect(effects.resourcePools.after[1]).toMatchObject({ maximum: { '0': 4 }, used: { '0': 1 } });
});

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  for (const child of childProcesses.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function reserveAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForHealth(url, child, readLogs) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Server terminated before health check.\n${readLogs()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The isolated server may still be booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server health check timed out.\n${readLogs()}`);
}

function insertTestUser(database, { id, username, role = "player", password = "guided-test-password" }) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO "User" (
      id, username, displayName, role, passwordSalt, passwordHash,
      mustChangePassword, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, username, username, role.toUpperCase(), salt, passwordHash, now, now);
  return password;
}

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie").split(";", 1)[0];
}

function clericCreation() {
  const creation = {
    raceKey: "human",
    classKey: "cleric",
    backgroundKey: "soldier",
    narrative: { personalityTraits: ["Leale", "Paziente"], ideal: "Giustizia", bond: "Il mio ordine", flaw: "Diffidente" },
    abilityScores: { strength: 15, dexterity: 12, constitution: 13, intelligence: 8, wisdom: 15, charisma: 8 },
    selections: {
      "race:human:language": ["dwarvish"],
      "class:cleric:skills": ["history", "religion"],
      "class:cleric:weapon": ["class:cleric:weapon:1"],
      "class:cleric:pack": ["class:cleric:pack:1"],
      "class:cleric:armor": ["class:cleric:armor:1"],
      "class:cleric:ranged": ["class:cleric:ranged:1"],
      "class:cleric:domain": ["life-domain"],
      "background:soldier:gaming-set": ["diceSet"],
    },
  };
  for (let pass = 0; pass < 5; pass++) {
    const slots = getLevelOneCreationOptions(creation).resolved.choiceSlots;
    for (const slot of slots) {
      if (creation.selections[slot.id]?.length === slot.count) continue;
      creation.selections[slot.id] = slot.options
        .filter((option) => !slot.excludedOptions?.includes(option.key))
        .slice(0, slot.count)
        .map((option) => option.key);
    }
  }
  return creation;
}

function openCreationDatabase() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "Character" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "CharacterCreation" (
      "characterId" TEXT PRIMARY KEY,
      "requestId" TEXT UNIQUE,
      "requestSignature" TEXT,
      "rulesetVersion" TEXT NOT NULL,
      "selections" TEXT NOT NULL CHECK (json_valid("selections")),
      "resolvedSnapshot" TEXT NOT NULL CHECK (json_valid("resolvedSnapshot")),
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE
    );
    INSERT INTO "Character" ("id") VALUES ('mira');
  `);
  return database;
}

describe("guided character creation persistence", () => {
  it("keeps normal reads available if only the first migration stage is present", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    database.exec(`
      CREATE TABLE "CharacterCreation" (
        "characterId" TEXT PRIMARY KEY,
        "rulesetVersion" TEXT NOT NULL,
        "selections" TEXT NOT NULL,
        "resolvedSnapshot" TEXT NOT NULL,
        "createdAt" TEXT NOT NULL
      );
      INSERT INTO "CharacterCreation" VALUES ('mira', '2014', '{}', '{}', '2026-09-25T00:00:00Z');
    `);
    expect(readCharacterCreationFromDatabase(database, "mira")).toBeNull();
  });

  it("stores and reads the validated input and authoritative resolution", () => {
    const database = openCreationDatabase();
    const selections = {
      raceKey: "human",
      classKey: "fighter",
      backgroundKey: "soldier",
      abilityScores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 10, charisma: 10 },
      selections: { "class:fighter:skills": ["athletics", "perception"] },
    };
    const resolved = { ok: true, identity: { classKey: "fighter" }, provenance: { ruleset: { version: "2014" } } };

    persistGuidedCharacterCreation(database, {
      characterId: "mira",
      rulesetVersion: "2014",
      selections,
      resolved,
      createdAt: "2026-09-25T10:00:00.000Z",
    });

    expect(readCharacterCreationFromDatabase(database, "mira")).toEqual({
      rulesetVersion: "2014",
      requestId: null,
      selections,
      resolved,
      createdAt: "2026-09-25T10:00:00.000Z",
    });
  });

  it("fails closed when the additive creation table is unavailable", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    expect(() => persistGuidedCharacterCreation(database, {
      characterId: "mira",
      rulesetVersion: "2014",
      selections: {},
      resolved: {},
    })).toThrowError(expect.objectContaining({ code: "GUIDED_CREATION_SCHEMA_NOT_READY" }));
  });
});

describe("guided character creation projection", () => {
  it("projects rule output into the existing character sheet without trusting client grants", () => {
    const baseCharacter = {
      slug: "mira",
      characterType: "pg",
      basicInfo: { characterName: "Mira", class: "", level: 1, background: "", race: "", alignment: "NB" },
      abilityScores: {},
      combatStats: { speed: 9 },
      proficiencies: { proficiencyBonus: 2, savingThrows: [], skills: [], languages: [] },
      equipment: { equipment: [], attacks: [], items: [], coins: {} },
      features: [],
    };
    const materialized = {
      ok: true,
      identity: { raceKey: "elf", subraceKey: "high", classKey: "wizard", backgroundKey: "sage" },
      abilities: {
        final: { strength: 8, dexterity: 16, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
      },
      proficiencies: {
        skills: ["arcana", "history"],
        languages: ["common", "elvish"],
        tools: [],
        armor: [],
        weapons: ["dagger"],
        savingThrows: ["intelligence", "wisdom"],
      },
      features: [{ key: "darkvision", label: { it: "Scurovisione" }, description: "Vede al buio." }],
      startingEquipment: { fixed: ["commonClothes"], chosen: ["quarterstaff"] },
      spellcasting: { ability: "intelligence", knownCantrips: 3 },
      choices: { "class:wizard:cantrips": ["Luce", "Mano Magica", "Prestidigitazione"] },
      choiceSlots: [],
    };
    const projected = projectGuidedLevelOneCharacter({
      baseCharacter,
      materialized,
      skillDefinitions: [
        { id: "arcano", slug: "arcano", name: "Arcano", ability: "intelligence" },
        { id: "furtivita", slug: "furtivita", name: "Furtività", ability: "dexterity" },
        { id: "storia", slug: "storia", name: "Storia", ability: "intelligence" },
      ],
    });

    expect(projected.basicInfo).toMatchObject({ class: "Mago", race: "Elfo Alto", background: "Sapiente", level: 1 });
    expect(projected.abilityScores).toEqual(materialized.abilities.final);
    expect(projected.combatStats.speed).toBe(9);
    expect(projected.combatStats.initiative).toBe(3);
    expect(projected.combatStats.armorClass).toBe(13);
    expect(projected.proficiencies.skills).toEqual([
      expect.objectContaining({ name: "Arcano", proficient: true, rank: "proficient" }),
      expect.objectContaining({ name: "Furtività", proficient: false, rank: "none" }),
      expect.objectContaining({ name: "Storia", proficient: true, rank: "proficient" }),
    ]);
    expect(projected.proficiencies.languages).toEqual(["Comune", "Elfico"]);
    expect(projected.equipment.equipment).toEqual(["Abiti comuni", "Bastone ferrato"]);
    expect(projected.features).toEqual([]);
    expect(projected.spellcasting.choices["class:wizard:cantrips"]).toHaveLength(3);
  });

  it("extracts a level-one subclass choice for structured progression", () => {
    expect(resolveGuidedCreationSubclassKey({
      choiceSlots: [{ id: "class:cleric:domain", kind: "subclass" }],
      choices: { "class:cleric:domain": ["life-domain"] },
    })).toBe("life-domain");
    expect(resolveGuidedCreationSubclassKey({ choiceSlots: [], choices: {} })).toBeNull();
  });

  it("moves existing creation traits into source-grouped Skills without doubling native skill ranks", () => {
    const resolved = {
      ok: true,
      identity: { raceKey: "halfling", subraceKey: "lightfoot", classKey: "rogue", backgroundKey: "criminal" },
      features: [
        { key: "lucky", label: { it: "Fortunato" }, description: null },
        { key: "naturally-stealthy", label: { it: "Furtività Innata" }, description: null },
        { key: "expertise", label: { it: "Competenza" }, description: null },
        { key: "sneak-attack", label: { it: "Attacco Furtivo" }, description: null },
        { key: "expertise:sleightOfHand", label: { it: "Competenza doppia: Rapidità di Mano" }, description: null },
      ],
    };
    const capabilities = projectGuidedCreationCapabilities(resolved);
    expect(capabilities.filter((entry) => !entry.name.startsWith("Competenze ")).map((entry) => [entry.name, entry.category, entry.kind])).toEqual([
      ["Fortunato", "Razza", "passive"],
      ["Furtività Innata", "Razza", "passive"],
      ["Competenza", "Classe", "passive"],
      ["Attacco Furtivo", "Classe", "passive"],
    ]);
    expect(capabilities.every((entry) => entry.readOnly && entry.sourceLabel)).toBe(true);
    expect(capabilities.every((entry) => !entry.passiveEffects?.length)).toBe(true);
    const displayed = serializeCharacterSnapshot({
      state: { basicInfo: { level: 1 }, features: [
        { name: "Fortunato", description: "Privilegio ottenuto durante la creazione guidata." },
        { name: "Fortunato", description: "Descrizione personalizzata dal giocatore." },
      ] },
      creation: { resolved },
    });
    expect(displayed.features).toEqual([{ name: "Fortunato", description: "Descrizione personalizzata dal giocatore." }]);
    expect(displayed.creationCapabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Competenze razziali", category: "Razza" }),
      expect.objectContaining({ name: "Competenze di classe", category: "Classe" }),
    ]));
  });

  it("applies only supported fighting-style bonuses as passive effects", () => {
    const resolved = {
      ok: true,
      identity: { raceKey: "human", classKey: "fighter", backgroundKey: "soldier" },
      features: [{ key: "fighting-style:defense", label: { it: "Stile di Combattimento: Difesa" } }],
    };
    expect(projectGuidedCreationCapabilities(resolved).find((entry) => entry.name === "Stile di Combattimento: Difesa")?.passiveEffects).toEqual([
      { target: "ARMOR_CLASS", operationType: "BONUS", valueMode: "FLAT", value: 1, trigger: "WHILE_ARMORED" },
    ]);
  });

  it("shows full origin rules for existing guided snapshots with short saved descriptions", () => {
    const resolved = {
      ok: true,
      identity: { raceKey: "halfling", subraceKey: "lightfoot", classKey: "rogue", backgroundKey: "criminal" },
      features: [
        { key: "lucky", label: { it: "Fortunato" }, description: null },
        { key: "sneak-attack", label: { it: "Attacco Furtivo" }, description: null },
        { key: "background:criminal", label: { it: "Contatti Criminali" }, description: "Ha un contatto affidabile nella rete criminale." },
      ],
    };
    const entries = projectGuidedCreationCapabilities(resolved);
    for (const key of ["creation:lucky", "creation:sneak-attack", "creation:background:criminal"]) {
      const entry = entries.find((item) => item.sourceFeatureId === key);
      expect(entry?.description?.length).toBeGreaterThan(150);
      expect(entry.description).not.toMatch(/condizioni sono nel Manuale|non disponibile nel catalogo/i);
    }
    expect(entries.find((item) => item.sourceFeatureId === "creation:background:criminal")?.description)
      .not.toBe("Ha un contatto affidabile nella rete criminale.");
  });

  it("includes selected ancestry and feat choices in the full privilege rules", () => {
    const dragonborn = projectGuidedCreationCapabilities({
      ok: true,
      identity: { raceKey: "dragonborn", classKey: "fighter", backgroundKey: "soldier" },
      choices: { "race:dragonborn:ancestry": ["gold"] },
      features: [
        { key: "breath-weapon", label: { it: "Arma a Soffio" } },
        { key: "damage-resistance", label: { it: "Resistenza ai Danni" } },
      ],
    });
    expect(dragonborn.find((entry) => entry.name === "Arma a Soffio")?.description)
      .toMatch(/drago d'oro.*fuoco.*cono.*Destrezza/i);
    expect(dragonborn.find((entry) => entry.name === "Resistenza ai Danni")?.description)
      .toMatch(/drago d'oro.*fuoco/i);

    const ritualCaster = projectGuidedCreationCapabilities({
      ok: true,
      identity: { raceKey: "variant-human", classKey: "fighter", backgroundKey: "sage" },
      features: [{ key: "feat:ritualCaster", label: { it: "Talento: Incantatore Rituale" }, description: "spellClass: Mago; spell: Allarme, Identificare" }],
    }).find((entry) => entry.name === "Talento: Incantatore Rituale");
    expect(ritualCaster?.description).toMatch(/Carisma.*Saggezza.*Intelligenza/s);
    expect(ritualCaster?.description).toMatch(/2 ore e 50 mo/);
    expect(ritualCaster?.description).toContain("Allarme, Identificare");
  });

  it("projects saved spell choices into the existing sheet for already created characters", () => {
    const displayed = serializeCharacterSnapshot({
      state: { basicInfo: { level: 1 }, features: [] },
      creation: { resolved: {
        choiceSlots: [
          { id: "class:wizard:cantrips", kind: "cantrip", owner: "class" },
          { id: "class:wizard:spellbook", kind: "spell", owner: "class" },
          { id: "class:wizard:prepared-spells", kind: "preparedSpell", owner: "class" },
        ],
        choices: {
          "class:wizard:cantrips": ["Luce"],
          "class:wizard:spellbook": ["Allarme"],
          "class:wizard:prepared-spells": ["Allarme"],
        },
      } },
    });
    expect(displayed.creationSpells).toMatchObject([
      { name: "Luce", level: 0, role: "cantrip", source: "Classe" },
      { name: "Allarme", level: 1, role: "spellbook", source: "Classe" },
      { name: "Allarme", level: 1, role: "prepared", source: "Classe" },
    ]);
    expect(displayed.features).toEqual([]);
  });

  it("exposes racial armor grants through proficiency effects", () => {
    const resolved = {
      ok: true,
      identity: { raceKey: "dwarf", subraceKey: "mountain", classKey: "rogue", backgroundKey: "soldier" },
      proficiencies: { armor: ["light", "medium"] },
      features: [],
    };
    expect(projectGuidedCreationCapabilities(resolved).find((entry) => entry.name === "Competenze razziali")?.passiveEffects).toEqual([
      { category: "PROFICIENCY", target: "ARMOR_LIGHT" },
      { category: "PROFICIENCY", target: "ARMOR_MEDIUM" },
    ]);
  });

  it("adds only the chosen level-one hit-point grants", () => {
    expect(guidedCreationHitPointsPerLevel({ ok: true, identity: { raceKey: "dwarf", subraceKey: "hill" }, choices: {} })).toBe(1);
    expect(guidedCreationHitPointsPerLevel({ ok: true, identity: { raceKey: "variant-human" }, choices: { "race:variant-human:feat": ["tough"] } })).toBe(2);
    expect(guidedCreationHitPointsPerLevel({ ok: true, identity: { raceKey: "dwarf", subraceKey: "mountain" }, choices: {} })).toBe(0);
  });
});

describe("guided character creation HTTP flow", () => {
  it("authenticates, validates, persists ownership and subclass, serializes provenance, and rolls back failures", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "cronache-guided-creation-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "migration.db");
    const appDataPath = path.join(directory, "app-data");
    const dmNotesPath = path.join(directory, "dm-notes");
    copyFileSync(path.join(REPOSITORY_ROOT, "prisma", "migration.db"), databasePath);
    mkdirSync(appDataPath, { recursive: true });
    mkdirSync(dmNotesPath, { recursive: true });

    const setupDatabase = new DatabaseSync(databasePath);
    insertTestUser(setupDatabase, { id: "guided-player", username: "guided-player" });
    insertTestUser(setupDatabase, { id: "other-player", username: "other-player" });
    setupDatabase.prepare('UPDATE "GameSessionState" SET isOpen = 1 WHERE id = 1').run();
    setupDatabase.close();

    const port = await reserveAvailablePort();
    const child = spawn(process.execPath, [path.join(REPOSITORY_ROOT, "server.js")], {
      cwd: REPOSITORY_ROOT,
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(port),
        SQLITE_DB_FILE: databasePath,
        APP_DATA_DIR: appDataPath,
        DM_NOTES_ROOT: dmNotesPath,
        SESSION_COOKIE_SECURE: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    childProcesses.push(child);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/healthz`, child, () => `${stdout}\n${stderr}`);

    expect((await fetch(`${baseUrl}/api/characters/guided/options`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No session", alignment: "NB", creation: clericCreation() }),
    })).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/characters/guided/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No preview session", alignment: "Neutrale", creation: clericCreation() }),
    })).status).toBe(401);

    const ownerCookie = await login(baseUrl, "guided-player", "guided-test-password");
    const legacyResponse = await fetch(`${baseUrl}/api/characters`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bypass", characterType: "pg", className: "Mago", race: "Umano", alignment: "Neutrale", background: "Sapiente" }),
    });
    expect(legacyResponse.status).toBe(409);
    await expect(legacyResponse.json()).resolves.toMatchObject({ code: "GUIDED_CREATION_REQUIRED" });
    const optionsResponse = await fetch(`${baseUrl}/api/characters/guided/options`, {
      headers: { Cookie: ownerCookie },
    });
    expect(optionsResponse.status).toBe(200);
    await expect(optionsResponse.json()).resolves.toMatchObject({ ruleset: { version: "2014" } });
    const previewResponse = await fetch(`${baseUrl}/api/characters/guided/preview`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Guided Cleric", alignment: "Legale buono", creation: clericCreation() }),
    });
    expect(previewResponse.status).toBe(200);
    const previewBody = await previewResponse.json();
    expect(previewBody).toMatchObject({
      ok: true,
      issues: [],
      resolved: { identity: { classKey: "cleric" } },
      ruleEvent: {
        resolverVersion: "creation-event-v1",
        ruleset: { version: "2014" },
        previewHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        catalogHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    const stalePreviewResponse = await fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "00000000-0000-4000-8000-000000000007",
        name: "Stale Preview",
        alignment: "Neutrale",
        previewHash: "0".repeat(64),
        creation: clericCreation(),
      }),
    });
    expect(stalePreviewResponse.status).toBe(409);
    await expect(stalePreviewResponse.json()).resolves.toMatchObject({
      code: "GUIDED_CREATION_PREVIEW_STALE",
      ruleEvent: { previewHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
    });

    const invalid = clericCreation();
    invalid.abilityScores.wisdom = 16;
    const invalidResponse = await fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000001", name: "Invalid", alignment: "Neutrale", creation: invalid }),
    });
    expect(invalidResponse.status).toBe(422);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      code: "GUIDED_CREATION_INVALID",
      issues: expect.arrayContaining([expect.objectContaining({ code: "point_buy_budget" })]),
    });

    const createResponse = await fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000002", name: "Guided Cleric", alignment: "Legale buono", previewHash: previewBody.ruleEvent.previewHash, creation: clericCreation() }),
    });
    const createBody = await createResponse.json();
    expect(createResponse.status, JSON.stringify(createBody)).toBe(201);
    const retryResponse = await fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000002", name: "Guided Cleric", alignment: "Legale buono", creation: clericCreation() }),
    });
    expect(retryResponse.status).toBe(200);
    await expect(retryResponse.json()).resolves.toMatchObject({ slug: "guided-cleric", replayed: true });
    expect(createBody).toMatchObject({
      slug: "guided-cleric",
      ownerUserId: "guided-player",
      creation: { rulesetVersion: "2014", resolved: { identity: { classKey: "cleric" } } },
      character: {
        creation: { rulesetVersion: "2014" },
        creationModelStatus: "EVENT_V1",
        creationRuleEvent: { event: { eventType: "CREATION", sequence: 1, previousVersion: 0, resultVersion: 1 } },
        progressionStatus: "READY",
        primaryClass: { classKey: "cleric", subclass: { subclassKey: "life-domain", status: "SELECTED" } },
      },
    });
    const currencyDatabase = new DatabaseSync(databasePath, { readOnly: true });
    expect(currencyDatabase.prepare('SELECT gp FROM "CharacterCurrencyBalance" WHERE characterId = ?').get("guided-cleric").gp).toBe(10);
    expect(currencyDatabase.prepare('SELECT COUNT(*) AS count FROM "CharacterCreation" WHERE requestId = ?').get("00000000-0000-4000-8000-000000000002").count).toBe(1);
    expect(currencyDatabase.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleEvent" WHERE requestId = ?').get("00000000-0000-4000-8000-000000000002").count).toBe(1);
    expect(currencyDatabase.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleDecision" decision JOIN "CharacterRuleEvent" event ON event.id = decision.eventId WHERE event.characterId = ?').get("guided-cleric").count).toBeGreaterThan(4);
    expect(currencyDatabase.prepare('SELECT COUNT(*) AS count FROM "CharacterRuleGrant" grantRow JOIN "CharacterRuleEvent" event ON event.id = grantRow.eventId WHERE event.characterId = ?').get("guided-cleric").count).toBeGreaterThan(4);
    expect(currencyDatabase.prepare('SELECT COUNT(*) AS count FROM "CharacterItem" WHERE characterId = ?').get("guided-cleric").count).toBeGreaterThan(0);
    expect(currencyDatabase.prepare('SELECT quantity FROM "CharacterItem" WHERE characterId = ? AND nameOverride = ?').get("guided-cleric", "Quadrello").quantity).toBe(20);
    expect(currencyDatabase.prepare('SELECT contentMarkdown FROM "CharacterBackstory" WHERE characterId = ?').get("guided-cleric").contentMarkdown).toContain("**Ideale:** Giustizia");
    currencyDatabase.close();

    const characterResponse = await fetch(`${baseUrl}/api/characters/guided-cleric`, {
      headers: { Cookie: ownerCookie },
    });
    expect(characterResponse.status).toBe(200);
    await expect(characterResponse.json()).resolves.toMatchObject({
      creation: { rulesetVersion: "2014", selections: { classKey: "cleric" } },
      primaryClass: { subclass: { subclassKey: "life-domain" } },
    });

    const hillDwarf = clericCreation();
    hillDwarf.raceKey = "dwarf";
    hillDwarf.subraceKey = "hill";
    delete hillDwarf.selections["race:human:language"];
    hillDwarf.selections["race:dwarf:tool"] = ["smithsTools"];
    const hillPrepared = getLevelOneCreationOptions(hillDwarf).resolved.choiceSlots.find((slot) => slot.id === "class:cleric:prepared-spells");
    hillDwarf.selections[hillPrepared.id] = hillPrepared.options.slice(0, hillPrepared.count).map((option) => option.key);
    const hillResponse = await fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000004", name: "Hill Dwarf Cleric", alignment: "Neutrale", creation: hillDwarf }),
    });
    const hillBody = await hillResponse.json();
    expect(hillResponse.status, JSON.stringify(hillBody)).toBe(201);
    expect(hillBody.character.hitPointState.maximumHitPoints).toBe(11);
    expect(hillBody.character.creationCapabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Competenze razziali", category: "Razza" }),
    ]));

    const otherCookie = await login(baseUrl, "other-player", "guided-test-password");
    expect((await fetch(`${baseUrl}/api/characters/guided-cleric`, {
      headers: { Cookie: otherCookie },
    })).status).toBe(403);

    const bard = { ...clericCreation(), classKey: "bard", backgroundKey: "urchin", selections: {} };
    for (let pass = 0; pass < 5; pass++) {
      const catalog = getLevelOneCreationOptions(bard);
      const slots = catalog.resolved.choiceSlots;
      for (const slot of slots) {
        if (bard.selections[slot.id]?.length === slot.count) continue;
        const taken = new Set(['common', ...catalog.backgrounds.urchin.skillProficiencies,
          ...catalog.backgrounds.urchin.toolProficiencies,
          ...slots.filter(s => s.id !== slot.id && ['skill', 'language', 'tool'].includes(s.kind)).flatMap(s => bard.selections[s.id] ?? []),
        ]);
        bard.selections[slot.id] = slot.options.filter(o => !slot.excludedOptions?.includes(o.key))
          .filter(o => !['skill', 'language', 'tool'].includes(slot.kind) || !taken.has(o.key))
          .slice(0, slot.count).map(o => o.key);
      }
    }
    const bardRequest = { requestId: "00000000-0000-4000-8000-000000000005", name: "Guided Bard", alignment: "Neutrale", creation: bard };
    const postCreation = (body, cookie = ownerCookie) => fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const bardResponse = await postCreation(bardRequest);
    expect(bardResponse.status).toBe(201);
    const bardBody = await bardResponse.json();
    expect(bardBody.character.resourcePools).toEqual(expect.arrayContaining([
      expect.objectContaining({ poolKey: "creation:bardic-inspiration", kind: "CLASS_RESOURCE", resetPolicy: "LONG_REST" }),
    ]));
    const resourceDatabase = new DatabaseSync(databasePath, { readOnly: true });
    expect(resourceDatabase.prepare(`
      SELECT pool.kind, pool.resetPolicy, source.sourceKind
      FROM "CharacterResourcePool" pool
      LEFT JOIN "CharacterResourcePoolSource" source ON source.poolId = pool.id
      WHERE pool.characterId = ? AND pool.poolKey = ?
    `).get("guided-bard", "creation:bardic-inspiration")).toMatchObject({
      kind: "CLASS_RESOURCE",
      resetPolicy: "LONG_REST",
      sourceKind: "CLASS",
    });
    resourceDatabase.close();
    // Simulate a receipt accepted before the separate starting-instrument choice existed.
    const legacyRequest = structuredClone(bardRequest);
    delete legacyRequest.creation.selections['class:bard:starting-instrument'];
    const legacySignature = crypto.createHash('sha256').update(JSON.stringify({
      userId: 'guided-player', name: legacyRequest.name, alignment: legacyRequest.alignment,
      creation: normalizeLevelOneCreationInput(legacyRequest.creation),
    })).digest('hex');
    const mutationDatabase = new DatabaseSync(databasePath);
    mutationDatabase.prepare('UPDATE "CharacterCreation" SET requestSignature = ? WHERE requestId = ?')
      .run(legacySignature, legacyRequest.requestId);
    mutationDatabase.prepare('DELETE FROM "CharacterRuleEvent" WHERE requestId = ?').run(legacyRequest.requestId);
    const legacyReplay = await postCreation(legacyRequest);
    expect(legacyReplay.status).toBe(200);
    expect(await legacyReplay.json()).toMatchObject({ replayed: true, slug: 'guided-bard' });
    expect((await postCreation(legacyRequest, otherCookie)).status).toBe(409);
    expect((await postCreation({ ...legacyRequest, name: 'Different Bard' })).status).toBe(409);
    expect((await postCreation({ ...legacyRequest, requestId: '00000000-0000-4000-8000-000000000006' })).status).toBe(422);
    mutationDatabase.prepare('UPDATE "Character" SET ownerUserId = ? WHERE slug = ?').run('other-player', 'guided-bard');
    expect((await postCreation(legacyRequest)).status).toBe(403);
    mutationDatabase.prepare(`
      UPDATE "SubclassRule" SET subclassKey = 'life-domain-unavailable' WHERE subclassKey = 'life-domain'
    `).run();
    mutationDatabase.close();
    const failedResponse = await fetch(`${baseUrl}/api/characters/guided`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000003", name: "Rolled Back Cleric", alignment: "Neutrale", creation: clericCreation() }),
    });
    expect(failedResponse.status).toBe(503);

    const verificationDatabase = new DatabaseSync(databasePath, { readOnly: true });
    expect(verificationDatabase.prepare('SELECT id FROM "Character" WHERE slug = ?').get("rolled-back-cleric")).toBeUndefined();
    expect(verificationDatabase.prepare('SELECT characterId FROM "CharacterCreation" WHERE characterId = ?').get("rolled-back-cleric")).toBeUndefined();
    expect(verificationDatabase.prepare('SELECT characterId FROM "CharacterRuleEvent" WHERE characterId = ?').get("rolled-back-cleric")).toBeUndefined();
    const persistedClass = verificationDatabase.prepare(`
      SELECT cc.subclassStatus, sr.subclassKey
      FROM "CharacterClass" cc
      LEFT JOIN "SubclassRule" sr ON sr.id = cc.subclassRuleId
      WHERE cc.characterId = ?
    `).get("guided-cleric");
    expect(persistedClass).toMatchObject({ subclassStatus: "SELECTED", subclassKey: "life-domain-unavailable" });
    verificationDatabase.close();

    const schemaMutationDatabase = new DatabaseSync(databasePath);
    schemaMutationDatabase.exec(`
      DROP TABLE "CharacterRuleGrant";
      DROP TABLE "CharacterRuleDecision";
      DROP TABLE "CharacterRuleEvent";
    `);
    schemaMutationDatabase.close();
    const snapshotReplayResponse = await postCreation({
      requestId: "00000000-0000-4000-8000-000000000002",
      name: "Guided Cleric",
      alignment: "Legale buono",
      creation: clericCreation(),
    });
    expect(snapshotReplayResponse.status).toBe(200);
    await expect(snapshotReplayResponse.json()).resolves.toMatchObject({
      replayed: true,
      character: { creationModelStatus: "SNAPSHOT_ONLY" },
    });
    const unavailableSchemaResponse = await postCreation({
      requestId: "00000000-0000-4000-8000-000000000008",
      name: "Missing Event Schema",
      alignment: "Neutrale",
      creation: clericCreation(),
    });
    expect(unavailableSchemaResponse.status).toBe(503);
    await expect(unavailableSchemaResponse.json()).resolves.toMatchObject({
      code: "GUIDED_CREATION_RULE_EVENT_SCHEMA_NOT_READY",
    });
  }, 40_000);
});
