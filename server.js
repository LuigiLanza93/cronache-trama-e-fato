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
import { normalizeMonsterTypeFields } from "./shared/monster-type-normalization.mjs";
import { computeMonsterRarity } from "./shared/monster-rarity-rules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || undefined;

// ---- Disk paths ----
const DATA_DIR = path.resolve(__dirname, "src/data");
const MONSTERS_DIR = path.resolve(DATA_DIR, "monsters");
const PORTRAIT_DIR = path.resolve(__dirname, "public/portraits");
const INITIATIVE_TRACKER_FILE = path.resolve(DATA_DIR, "initiative-tracker.json");
const SESSION_COOKIE = "ctf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SQLITE_DB_FILE = path.resolve(__dirname, "prisma", "migration.db");
const DM_NOTES_ROOT = process.env.DM_NOTES_ROOT
  ? path.resolve(process.env.DM_NOTES_ROOT)
  : path.resolve("C:\\Users\\Gscot\\Documents\\Le Cronache della Trama e del Fato\\Le Cronache della Trama e del Fato");

function createSqliteConnection() {
  const connection = new DatabaseSync(SQLITE_DB_FILE);
  connection.exec("PRAGMA foreign_keys = ON;");
  return connection;
}

function getSqliteDbMtimeMs() {
  try {
    return fs.statSync(SQLITE_DB_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

let sqlite = createSqliteConnection();
let sqliteLastKnownMtimeMs = getSqliteDbMtimeMs();

function ensureSqliteConnectionFresh() {
  const currentMtimeMs = getSqliteDbMtimeMs();
  if (!currentMtimeMs || currentMtimeMs === sqliteLastKnownMtimeMs) {
    return;
  }

  try {
    sqlite.close();
  } catch {
    // If close fails, reopen anyway and let the next operation surface real issues.
  }

  sqlite = createSqliteConnection();
  sqliteLastKnownMtimeMs = currentMtimeMs;
}

const CHARACTER_SHEET_LAYOUT_KEY = "character-sheet";
const ALLOWED_CHARACTER_SHEET_CARD_IDS = new Set([
  "abilityScores",
  "proficiencies",
  "languages",
  "combatStats",
  "hitPoints",
  "capabilities",
  "attacksAndEquipment",
  "features",
  "inventory",
]);
const CURRENCY_KEYS = new Set(["cp", "sp", "ep", "gp"]);
const CURRENCY_ORDER = ["cp", "sp", "ep", "gp"];
const CURRENCY_EXCHANGE_UP = {
  cp: 10,
  sp: 5,
  ep: 2,
};

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

function getDmNotesFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".md" || extension === ".markdown") return "markdown";
  if (extension === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"].includes(extension)) return "image";
  return "other";
}

function isSupportedDmNotesFile(filePath) {
  return getDmNotesFileType(filePath) !== "other";
}

function resolveDmNotesPath(relativePath = "") {
  const requestedPath = String(relativePath ?? "").replace(/\\/g, "/").trim();
  const resolvedPath = path.resolve(DM_NOTES_ROOT, requestedPath);
  const relativeToRoot = path.relative(DM_NOTES_ROOT, resolvedPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return resolvedPath;
}

function buildDmNotesTree(currentDir, relativeDir = "") {
  let directoryEntries = [];
  try {
    directoryEntries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }

  return directoryEntries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.posix.join(relativeDir, entry.name).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        const children = buildDmNotesTree(absolutePath, relativePath);
        if (children.length === 0) return null;
        return {
          kind: "directory",
          name: entry.name,
          path: relativePath,
          children,
        };
      }

      if (!entry.isFile() || !isSupportedDmNotesFile(absolutePath)) {
        return null;
      }

      return {
        kind: "file",
        name: entry.name,
        path: relativePath,
        fileType: getDmNotesFileType(absolutePath),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, "it", { sensitivity: "base" });
    });
}

function normalizeCurrencyBalance(value) {
  return {
    cp: Number(value?.cp ?? 0) || 0,
    sp: Number(value?.sp ?? 0) || 0,
    ep: Number(value?.ep ?? 0) || 0,
    gp: Number(value?.gp ?? 0) || 0,
  };
}

function makeCurrencyChangeStep(balance, fromKey) {
  const fromIndex = CURRENCY_ORDER.indexOf(fromKey);
  if (fromIndex <= 0 || balance[fromKey] <= 0) return false;

  const lowerKey = CURRENCY_ORDER[fromIndex - 1];
  const factor = CURRENCY_EXCHANGE_UP[lowerKey];
  if (!factor) return false;

  balance[fromKey] -= 1;
  balance[lowerKey] += factor;
  return true;
}

function removeCurrencyWithChange(baseBalance, currencyKey, amount) {
  const detailed = removeCurrencyWithChangeDetailed(baseBalance, currencyKey, amount);
  return detailed ? detailed.balance : null;
}

function removeCurrencyWithChangeDetailed(baseBalance, currencyKey, amount) {
  const nextBalance = normalizeCurrencyBalance(baseBalance);
  const conversions = [];
  const targetIndex = CURRENCY_ORDER.indexOf(currencyKey);
  if (targetIndex < 0) return null;

  for (let i = 0; i < amount; i += 1) {
    if (nextBalance[currencyKey] > 0) {
      nextBalance[currencyKey] -= 1;
      continue;
    }

    let borrowed = false;
    for (let higherIndex = targetIndex + 1; higherIndex < CURRENCY_ORDER.length; higherIndex += 1) {
      const higherKey = CURRENCY_ORDER[higherIndex];
      if (nextBalance[higherKey] <= 0) continue;

      for (let step = higherIndex; step > targetIndex; step -= 1) {
        const currentKey = CURRENCY_ORDER[step];
        const lowerKey = CURRENCY_ORDER[step - 1];
        const factor = CURRENCY_EXCHANGE_UP[lowerKey];
        if (!makeCurrencyChangeStep(nextBalance, currentKey)) {
          return null;
        }
        conversions.push({
          outgoing: normalizeCurrencyBalance({ [currentKey]: 1 }),
          incoming: normalizeCurrencyBalance({ [lowerKey]: factor }),
        });
      }

      borrowed = true;
      break;
    }

    if (!borrowed || nextBalance[currencyKey] <= 0) {
      return null;
    }

    nextBalance[currencyKey] -= 1;
  }

  return {
    balance: normalizeCurrencyBalance(nextBalance),
    conversions,
  };
}

function compactCurrencyAtTier(baseBalance, currencyKey) {
  const nextBalance = normalizeCurrencyBalance(baseBalance);
  const currencyIndex = CURRENCY_ORDER.indexOf(currencyKey);
  if (currencyIndex < 0 || currencyIndex >= CURRENCY_ORDER.length - 1) {
    return nextBalance;
  }

  const nextKey = CURRENCY_ORDER[currencyIndex + 1];
  const factor = CURRENCY_EXCHANGE_UP[currencyKey];
  if (!factor) return nextBalance;

  const promoted = Math.floor(nextBalance[currencyKey] / factor);
  if (promoted <= 0) return nextBalance;

  nextBalance[currencyKey] = nextBalance[currencyKey] % factor;
  nextBalance[nextKey] += promoted;
  return nextBalance;
}

function convertCurrencyAmountUpDetailed(baseBalance, currencyKey, amount) {
  const nextBalance = normalizeCurrencyBalance(baseBalance);
  const currencyIndex = CURRENCY_ORDER.indexOf(currencyKey);
  if (currencyIndex < 0 || currencyIndex >= CURRENCY_ORDER.length - 1) {
    return null;
  }

  if (nextBalance[currencyKey] < amount) {
    return null;
  }

  nextBalance[currencyKey] -= amount;
  const outgoing = normalizeCurrencyBalance({ [currencyKey]: amount });
  const incoming = normalizeCurrencyBalance({ [currencyKey]: amount });

  for (let index = currencyIndex; index < CURRENCY_ORDER.length - 1; index += 1) {
    const currentKey = CURRENCY_ORDER[index];
    const factor = CURRENCY_EXCHANGE_UP[currentKey];
    const nextKey = CURRENCY_ORDER[index + 1];
    if (!factor || !nextKey) continue;

    const promoted = Math.floor(incoming[currentKey] / factor);
    if (promoted > 0) {
      incoming[currentKey] = incoming[currentKey] % factor;
      incoming[nextKey] += promoted;
    }
  }

  for (const key of CURRENCY_ORDER) {
    nextBalance[key] += incoming[key];
  }

  return {
    balance: normalizeCurrencyBalance(nextBalance),
    outgoing,
    incoming,
  };
}

function addCurrencyAmounts(baseBalance, amounts) {
  const nextBalance = normalizeCurrencyBalance(baseBalance);
  const normalizedAmounts = normalizeCurrencyBalance(amounts);
  for (const key of CURRENCY_ORDER) {
    nextBalance[key] += normalizedAmounts[key];
  }
  return normalizeCurrencyBalance(nextBalance);
}

function removeCurrencyAmountsWithChange(baseBalance, amounts) {
  let nextBalance = normalizeCurrencyBalance(baseBalance);
  const normalizedAmounts = normalizeCurrencyBalance(amounts);
  for (const key of CURRENCY_ORDER) {
    const qty = normalizedAmounts[key];
    if (!qty) continue;
    nextBalance = removeCurrencyWithChange(nextBalance, key, qty);
    if (!nextBalance) return null;
  }
  return normalizeCurrencyBalance(nextBalance);
}

function formatCurrencyAmounts(amounts) {
  const normalized = normalizeCurrencyBalance(amounts);
  const parts = [];
  if (normalized.gp) parts.push(`${normalized.gp} MO`);
  if (normalized.ep) parts.push(`${normalized.ep} ME`);
  if (normalized.sp) parts.push(`${normalized.sp} MA`);
  if (normalized.cp) parts.push(`${normalized.cp} MR`);
  return parts.join(", ") || "0";
}

function readCharacterCurrencyBalance(characterId) {
  if (!characterId) return null;
  const row = sqlite
    .prepare('SELECT cp, sp, ep, gp FROM "CharacterCurrencyBalance" WHERE characterId = ? LIMIT 1')
    .get(characterId);
  if (!row) return null;
  return {
    cp: Number(row.cp ?? 0) || 0,
    sp: Number(row.sp ?? 0) || 0,
    ep: Number(row.ep ?? 0) || 0,
    gp: Number(row.gp ?? 0) || 0,
  };
}

function writeCharacterCurrencyBalance(characterId, balance) {
  const normalized = normalizeCurrencyBalance(balance);
  sqlite
    .prepare(
      `UPDATE "CharacterCurrencyBalance"
       SET cp = ?, sp = ?, ep = ?, gp = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE characterId = ?`
    )
    .run(normalized.cp, normalized.sp, normalized.ep, normalized.gp, characterId);
  return normalized;
}

function getCharacterRecordBySlug(slug) {
  return sqlite
    .prepare('SELECT id, slug, name, characterType, archivedAt FROM "Character" WHERE slug = ? LIMIT 1')
    .get(slug);
}

function createCurrencyTransactionRecord(payload) {
  const transaction = {
    id: payload.id ?? crypto.randomUUID(),
    operationId: payload.operationId ?? payload.id ?? null,
    fromCharacterId: payload.fromCharacterId ?? null,
    toCharacterId: payload.toCharacterId ?? null,
    fromExternalName: payload.fromExternalName ?? null,
    toExternalName: payload.toExternalName ?? null,
    reason: payload.reason ?? null,
    purchaseDescription: payload.purchaseDescription ?? null,
    note: payload.note ?? null,
    cp: Number(payload.cp ?? 0) || 0,
    sp: Number(payload.sp ?? 0) || 0,
    ep: Number(payload.ep ?? 0) || 0,
    gp: Number(payload.gp ?? 0) || 0,
    createdByUserId: payload.createdByUserId ?? null,
    reversalOfTransactionId: payload.reversalOfTransactionId ?? null,
    reversedAt: payload.reversedAt ?? null,
  };

  sqlite
    .prepare(
      `INSERT INTO "CurrencyTransaction" (
        id, operationId, fromCharacterId, toCharacterId, fromExternalName, toExternalName,
        reason, purchaseDescription, note, cp, sp, ep, gp,
        createdByUserId, reversalOfTransactionId, reversedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      transaction.id,
      transaction.operationId,
      transaction.fromCharacterId,
      transaction.toCharacterId,
      transaction.fromExternalName,
      transaction.toExternalName,
      transaction.reason,
      transaction.purchaseDescription,
      transaction.note,
      transaction.cp,
      transaction.sp,
      transaction.ep,
      transaction.gp,
      transaction.createdByUserId,
      transaction.reversalOfTransactionId,
      transaction.reversedAt
    );

  return transaction;
}

function readGameSessionState() {
  ensureGameSessionStateRow();
  const row = sqlite
    .prepare('SELECT id, isOpen, updatedAt, updatedByUserId FROM "GameSessionState" WHERE id = 1 LIMIT 1')
    .get();

  return {
    isOpen: Number(row?.isOpen ?? 1) === 1,
    updatedAt: row?.updatedAt ?? null,
    updatedByUserId: row?.updatedByUserId ?? null,
  };
}

function writeGameSessionState(isOpen, updatedByUserId = null) {
  sqlite
    .prepare(
      `UPDATE "GameSessionState"
       SET "isOpen" = ?, "updatedAt" = CURRENT_TIMESTAMP, "updatedByUserId" = ?
       WHERE "id" = 1`
    )
    .run(isOpen ? 1 : 0, updatedByUserId);

  return readGameSessionState();
}

function canUserWriteDuringSession(user) {
  if (!user) return false;
  if (user.role === "dm") return true;
  return readGameSessionState().isOpen;
}

function rejectIfSessionClosedForPlayer(res, user) {
  if (canUserWriteDuringSession(user)) return false;
  res.status(423).json({
    error: "La sessione è chiusa. Per i giocatori sono disponibili solo funzioni di lettura.",
  });
  return true;
}

function isTechnicalCurrencyChangeRow(row) {
  return (
    String(row?.reason ?? "") === "Cambio valuta" &&
    (
      (!!row?.fromCharacterId && !row?.toCharacterId && row?.toExternalName === "Cambio valuta") ||
      (!!row?.toCharacterId && !row?.fromCharacterId && row?.fromExternalName === "Cambio valuta")
    )
  );
}

function legacyCurrencyOperationKey(row) {
  if (row?.operationId) return row.operationId;
  if (!isTechnicalCurrencyChangeRow(row)) return row?.id;

  const normalizedNote = String(row?.note ?? "").trim();
  const normalizedCreatedAt = String(row?.createdAt ?? "").trim();
  const normalizedCharacterId = String(row?.fromCharacterId ?? row?.toCharacterId ?? "").trim();

  if (normalizedNote && normalizedCreatedAt && normalizedCharacterId) {
    return `legacy-convert:${normalizedCharacterId}:${normalizedNote}:${normalizedCreatedAt}`;
  }

  return row?.id;
}

function classifyCurrencyOperationGroup(ordered) {
  const first = ordered[0];
  const technicalChangeRows = ordered.filter((row) => isTechnicalCurrencyChangeRow(row));
  const businessRows = ordered.filter((row) => !isTechnicalCurrencyChangeRow(row));
  const isConversion =
    businessRows.length === 0 &&
    technicalChangeRows.length === ordered.length &&
    ordered.length === 2;
  const primaryRow = businessRows[0] ?? first;
  const isAutomaticTechnicalConversion =
    isConversion &&
    String(primaryRow?.note ?? "").toLowerCase().startsWith("cambio automatico per");

  let actionLabel = "Movimento";
  let summary = formatCurrencyAmounts(primaryRow);
  if (isConversion) {
    const outgoing = ordered.find((row) => row.fromCharacterId && !row.toCharacterId) ?? ordered[0];
    const incoming = ordered.find((row) => row.toCharacterId && !row.fromCharacterId) ?? ordered[1] ?? ordered[0];
    actionLabel = "Cambio valuta";
    summary = `${formatCurrencyAmounts(outgoing)} -> ${formatCurrencyAmounts(incoming)}`;
  } else if (primaryRow.fromCharacterId && primaryRow.toCharacterId) {
    actionLabel = "Trasferimento";
  } else if (primaryRow.toCharacterId && !primaryRow.fromCharacterId) {
    actionLabel = primaryRow.reason === "Assegnazione iniziale" ? "Assegnazione iniziale" : "Entrata";
  } else if (primaryRow.fromCharacterId && !primaryRow.toCharacterId) {
    actionLabel = "Spesa";
  }

  return {
    first,
    primaryRow,
    technicalChangeRows,
    businessRows,
    isConversion,
    isAutomaticTechnicalConversion,
    actionLabel,
    summary,
  };
}

function readCurrencyTransactionsForDm() {
  if (!tableExists("CurrencyTransaction")) return [];

  const reversedOriginalIds = new Set(
    sqlite
      .prepare(`
        SELECT reversalOfTransactionId
        FROM "CurrencyTransaction"
        WHERE reversalOfTransactionId IS NOT NULL
      `)
      .all()
      .map((row) => String(row.reversalOfTransactionId ?? "").trim())
      .filter(Boolean)
  );

  const rows = sqlite.prepare(`
    SELECT
      t.id,
      t.operationId,
      t.fromCharacterId,
      t.toCharacterId,
      t.fromExternalName,
      t.toExternalName,
      t.reason,
      t.purchaseDescription,
      t.note,
      t.cp,
      t.sp,
      t.ep,
      t.gp,
      t.createdByUserId,
      t.reversalOfTransactionId,
      t.reversedAt,
      t.createdAt,
      fc.slug AS fromCharacterSlug,
      fc.name AS fromCharacterName,
      tc.slug AS toCharacterSlug,
      tc.name AS toCharacterName
    FROM "CurrencyTransaction" t
    LEFT JOIN "Character" fc ON fc.id = t.fromCharacterId
    LEFT JOIN "Character" tc ON tc.id = t.toCharacterId
    WHERE t.reversalOfTransactionId IS NULL
    ORDER BY t.createdAt DESC, t.id DESC
  `).all();

  const grouped = new Map();
  for (const row of rows) {
    const key = legacyCurrencyOperationKey(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.entries())
    .map(([operationId, operationRows]) => {
      const ordered = operationRows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const undone = ordered.every((row) => !!row.reversedAt) || ordered.some((row) => reversedOriginalIds.has(String(row.id)));
      const {
        primaryRow,
        isConversion,
        isAutomaticTechnicalConversion,
        actionLabel,
        summary,
      } = classifyCurrencyOperationGroup(ordered);

      if (isAutomaticTechnicalConversion) {
        return null;
      }

      return {
        id: operationId,
        actionLabel,
        summary,
        createdAt: primaryRow.createdAt,
        fromCharacterSlug: primaryRow.fromCharacterSlug ?? null,
        fromCharacterName: primaryRow.fromCharacterName ?? null,
        toCharacterSlug: primaryRow.toCharacterSlug ?? null,
        toCharacterName: primaryRow.toCharacterName ?? null,
        fromExternalName: primaryRow.fromExternalName ?? null,
        toExternalName: primaryRow.toExternalName ?? null,
        reason: primaryRow.reason ?? null,
        purchaseDescription: primaryRow.purchaseDescription ?? null,
        note: primaryRow.note ?? null,
        undone,
        canUndo: !undone && ordered.every((row) => !reversedOriginalIds.has(String(row.id))),
        operationType: isConversion
          ? "CONVERT"
          : primaryRow.fromCharacterId && primaryRow.toCharacterId
            ? "TRANSFER"
            : primaryRow.toCharacterId && !primaryRow.fromCharacterId
              ? "ADD"
              : "REMOVE",
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function readCharacterCurrencyTransactionsForPlayer(characterId) {
  if (!characterId || !tableExists("CurrencyTransaction")) return [];

  const rows = sqlite.prepare(`
    SELECT
      t.id,
      t.operationId,
      t.fromCharacterId,
      t.toCharacterId,
      t.fromExternalName,
      t.toExternalName,
      t.reason,
      t.purchaseDescription,
      t.note,
      t.cp,
      t.sp,
      t.ep,
      t.gp,
      t.reversedAt,
      t.createdAt,
      fc.slug AS fromCharacterSlug,
      fc.name AS fromCharacterName,
      tc.slug AS toCharacterSlug,
      tc.name AS toCharacterName
    FROM "CurrencyTransaction" t
    LEFT JOIN "Character" fc ON fc.id = t.fromCharacterId
    LEFT JOIN "Character" tc ON tc.id = t.toCharacterId
    WHERE t.reversalOfTransactionId IS NULL
      AND t.reversedAt IS NULL
      AND (t.fromCharacterId = ? OR t.toCharacterId = ?)
    ORDER BY t.createdAt DESC, t.id DESC
  `).all(characterId, characterId);

  const grouped = new Map();
  for (const row of rows) {
    const key = legacyCurrencyOperationKey(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.entries())
    .map(([operationId, operationRows]) => {
      const ordered = operationRows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const {
        primaryRow,
        isConversion,
        isAutomaticTechnicalConversion,
        actionLabel,
        summary,
      } = classifyCurrencyOperationGroup(ordered);

      if (isAutomaticTechnicalConversion) {
        return null;
      }

      let direction = "neutral";
      let counterpartLabel = null;

      if (isConversion) {
        direction = "neutral";
        counterpartLabel = "Portafoglio";
      } else if (primaryRow.toCharacterId === characterId && primaryRow.fromCharacterId === characterId) {
        direction = "neutral";
        counterpartLabel = "Portafoglio";
      } else if (primaryRow.toCharacterId === characterId) {
        direction = "in";
        counterpartLabel = primaryRow.fromCharacterName ?? primaryRow.fromExternalName ?? null;
      } else if (primaryRow.fromCharacterId === characterId) {
        direction = "out";
        counterpartLabel = primaryRow.toCharacterName ?? primaryRow.toExternalName ?? null;
      }

      return {
        id: operationId,
        actionLabel,
        signedSummary: direction === "in" ? `+${summary}` : direction === "out" ? `-${summary}` : summary,
        summary,
        counterpartLabel,
        reason: primaryRow.reason ?? null,
        purchaseDescription: primaryRow.purchaseDescription ?? null,
        note: primaryRow.note ?? null,
        createdAt: primaryRow.createdAt,
        direction,
        operationType: isConversion
          ? "CONVERT"
          : primaryRow.fromCharacterId && primaryRow.toCharacterId
            ? "TRANSFER"
            : primaryRow.toCharacterId && !primaryRow.fromCharacterId
              ? "ADD"
              : "REMOVE",
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function undoCurrencyTransactionOperation(operationId, actorUserId = null) {
  if (!operationId || !tableExists("CurrencyTransaction")) {
    throw new Error("Operazione non trovata");
  }

  const reversedOriginalIds = new Set(
    sqlite
      .prepare(`
        SELECT reversalOfTransactionId
        FROM "CurrencyTransaction"
        WHERE reversalOfTransactionId IS NOT NULL
      `)
      .all()
      .map((row) => String(row.reversalOfTransactionId ?? "").trim())
      .filter(Boolean)
  );

  const rows = sqlite.prepare(`
    SELECT *
    FROM "CurrencyTransaction"
    WHERE COALESCE(operationId, id) = ?
      AND reversalOfTransactionId IS NULL
    ORDER BY createdAt ASC, id ASC
  `).all(operationId);

  if (!rows.length) {
    throw new Error("Operazione non trovata");
  }

  if (rows.some((row) => !!row.reversedAt || reversedOriginalIds.has(String(row.id)))) {
    throw new Error("Questa operazione è già stata annullata");
  }

  const now = new Date().toISOString();
  const undoOperationId = crypto.randomUUID();
  const affectedCharacterIds = new Set();

  runInTransaction(() => {
    for (const row of rows) {
      const amounts = normalizeCurrencyBalance(row);
      if (row.fromCharacterId) affectedCharacterIds.add(row.fromCharacterId);
      if (row.toCharacterId) affectedCharacterIds.add(row.toCharacterId);

      if (row.fromCharacterId && row.toCharacterId) {
        const targetBalance = readCharacterCurrencyBalance(row.toCharacterId) ?? normalizeCurrencyBalance();
        const nextTargetBalance = removeCurrencyAmountsWithChange(targetBalance, amounts);
        if (!nextTargetBalance) {
          throw new Error("Non posso annullare: il destinatario non ha più monete sufficienti.");
        }
        const sourceBalance = readCharacterCurrencyBalance(row.fromCharacterId) ?? normalizeCurrencyBalance();
        writeCharacterCurrencyBalance(row.toCharacterId, nextTargetBalance);
        writeCharacterCurrencyBalance(row.fromCharacterId, addCurrencyAmounts(sourceBalance, amounts));
      } else if (row.toCharacterId && !row.fromCharacterId) {
        const targetBalance = readCharacterCurrencyBalance(row.toCharacterId) ?? normalizeCurrencyBalance();
        const nextTargetBalance = removeCurrencyAmountsWithChange(targetBalance, amounts);
        if (!nextTargetBalance) {
          throw new Error("Non posso annullare: il personaggio non ha più monete sufficienti.");
        }
        writeCharacterCurrencyBalance(row.toCharacterId, nextTargetBalance);
      } else if (row.fromCharacterId && !row.toCharacterId) {
        const sourceBalance = readCharacterCurrencyBalance(row.fromCharacterId) ?? normalizeCurrencyBalance();
        writeCharacterCurrencyBalance(row.fromCharacterId, addCurrencyAmounts(sourceBalance, amounts));
      }

      sqlite
        .prepare(`UPDATE "CurrencyTransaction" SET reversedAt = ? WHERE id = ?`)
        .run(now, row.id);

      createCurrencyTransactionRecord({
        operationId: undoOperationId,
        fromCharacterId: row.toCharacterId ?? null,
        toCharacterId: row.fromCharacterId ?? null,
        fromExternalName: row.toExternalName ?? null,
        toExternalName: row.fromExternalName ?? null,
        reason: row.reason ?? "Annullamento",
        purchaseDescription: row.purchaseDescription ?? null,
        note: `Annullamento di ${row.id}`,
        createdByUserId: actorUserId,
        reversalOfTransactionId: row.id,
        ...amounts,
      });
    }
  });

  return { ok: true, affectedCharacterIds: Array.from(affectedCharacterIds) };
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

ensureRaceSpeedReferenceTable();
ensureUserLayoutPreferenceTable();
ensureGameSessionStateTable();
ensureCharacterCurrencyBalanceTable();
ensureCurrencyTransactionTable();
ensureChatConversationTables();
ensureGameSessionStateRow();
ensureCharacterCurrencyBalanceRows();
ensureLegacyCharacterCurrencyBalancesMigrated();
ensureLegacyCharacterChatConversationsMigrated();

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
  const currencyBalance = readCharacterCurrencyBalance(row.id);
  return {
    ...data,
    slug: row.slug,
    characterType: String(row.characterType).toLowerCase(),
    currencyBalance,
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
        rarity: row.rarity ?? data?.rarity ?? "",
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
    {
      ...data,
      rarity: row.rarity ?? data?.rarity ?? "",
    },
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

function normalizeRaceSpeedReferenceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    raceName: row.raceName,
    subraceName: row.subraceName ?? null,
    speedMeters: Number(row.speedMeters ?? 0),
    notes: row.notes ?? null,
  };
}

const ABILITY_LABELS = {
  strength: "Forza",
  dexterity: "Destrezza",
  constitution: "Costituzione",
  intelligence: "Intelligenza",
  wisdom: "Saggezza",
  charisma: "Carisma",
};

const ITEM_ABILITY_SCORE_VALUES = ["STRENGTH", "DEXTERITY", "CONSTITUTION", "INTELLIGENCE", "WISDOM", "CHARISMA"];
const ITEM_USE_EFFECT_TYPE_VALUES = ["HEAL", "DAMAGE", "TEMP_HP", "APPLY_CONDITION", "REMOVE_CONDITION", "RESTORE_RESOURCE", "CUSTOM"];
const ITEM_USE_TARGET_TYPE_VALUES = ["SELF", "CREATURE", "OBJECT", "AREA", "CUSTOM"];
const ITEM_USE_SUCCESS_OUTCOME_VALUES = ["NONE", "HALF", "NEGATES", "CUSTOM"];

function tableExists(tableName) {
  return !!sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(tableName);
}

function columnExists(tableName, columnName) {
  return sqlite
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .some((column) => String(column.name) === columnName);
}

function formatSkillLabel(skillName, ability) {
  const normalizedSkillName = String(skillName ?? "").trim();
  const normalizedAbility = String(ability ?? "").trim().toLowerCase();
  const abilityLabel = ABILITY_LABELS[normalizedAbility] ?? String(ability ?? "").trim();

  if (!normalizedSkillName) return "";
  return abilityLabel ? `${normalizedSkillName} (${abilityLabel})` : normalizedSkillName;
}

function readMonsterDiscoveryRules() {
  const crRules = tableExists("MonsterDiscoveryDcByCrRule")
    ? sqlite
        .prepare('SELECT minCr, maxCr, dc FROM "MonsterDiscoveryDcByCrRule" ORDER BY minCr ASC')
        .all()
    : [];

  const rarityRules = tableExists("MonsterDiscoveryDcByRarityRule")
    ? sqlite
        .prepare('SELECT rarity, dc FROM "MonsterDiscoveryDcByRarityRule"')
        .all()
    : [];

  const discoverSkillRules = tableExists("MonsterDiscoverSkillRule")
    ? sqlite.prepare(`
        SELECT
          r.creatureType,
          r.subtype,
          s.id AS skillId,
          s.name AS skillName,
          s.ability AS skillAbility
        FROM "MonsterDiscoverSkillRule" r
        JOIN "Skill" s ON s.id = r.skillId
      `).all()
    : [];

  return {
    crRules,
    rarityRuleMap: new Map(
      rarityRules.map((rule) => [String(rule.rarity ?? "").trim(), Number(rule.dc)])
    ),
    discoverSkillRuleMap: new Map(
      discoverSkillRules.map((rule) => [
        `${String(rule.creatureType ?? "").trim()}::${String(rule.subtype ?? "").trim()}`,
        {
          id: String(rule.skillId ?? "").trim(),
          name: String(rule.skillName ?? "").trim(),
          ability: String(rule.skillAbility ?? "").trim(),
        },
      ])
    ),
  };
}

function resolveAnalysisDc(challengeRating, crRules) {
  const decimal = typeof challengeRating?.decimal === "number" && Number.isFinite(challengeRating.decimal)
    ? challengeRating.decimal
    : null;

  if (decimal === null) return null;

  const rule = crRules.find((entry) => (
    decimal >= Number(entry.minCr) &&
    (entry.maxCr === null || decimal <= Number(entry.maxCr))
  ));

  return rule ? Number(rule.dc) : null;
}

function resolveResearchDc(rarity, rarityRuleMap) {
  const normalizedRarity = String(rarity ?? "").trim();
  if (!normalizedRarity) return null;
  const dc = rarityRuleMap.get(normalizedRarity);
  return typeof dc === "number" && Number.isFinite(dc) ? dc : null;
}

function resolveDiscoverSkill(general, discoverSkillRuleMap) {
  const creatureType = String(general?.creatureType ?? "").trim();
  const subtype = String(general?.subtype ?? "").trim();
  if (!creatureType) return null;

  return (
    (subtype ? discoverSkillRuleMap.get(`${creatureType}::${subtype}`) : null) ??
    discoverSkillRuleMap.get(`${creatureType}::`) ??
    null
  );
}

function enrichMonsterWithDiscovery(monster, discoveryRules = readMonsterDiscoveryRules()) {
  if (!monster) return null;

  const discoverSkill = resolveDiscoverSkill(monster.general, discoveryRules.discoverSkillRuleMap);

  return {
    ...monster,
    analysisDc: resolveAnalysisDc(monster.general.challengeRating, discoveryRules.crRules),
    researchDc: resolveResearchDc(monster.rarity, discoveryRules.rarityRuleMap),
    discoverSkill: formatSkillLabel(discoverSkill?.name, discoverSkill?.ability),
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

function readRaceSpeedReferences() {
  const entries = sqlite
    .prepare(`
      SELECT * FROM "RaceSpeedReference"
      ORDER BY raceName COLLATE NOCASE, subraceName COLLATE NOCASE
    `)
    .all()
    .map(normalizeRaceSpeedReferenceRow)
    .filter(Boolean);
  return { entries };
}

function normalizeNullableString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function normalizeNullableInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNullableFloat(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasMeaningfulValue(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  return value !== null && value !== undefined;
}

function assertNamedEntries(entries, label, fields = []) {
  const invalidIndex = entries.findIndex((entry) => {
    const name = String(entry?.name ?? "").trim();
    if (name) return false;
    return fields.some((field) => hasMeaningfulValue(entry?.[field]));
  });

  if (invalidIndex >= 0) {
    throw new Error(`${label} #${invalidIndex + 1} richiede un nome.`);
  }
}

function ensureRaceSpeedReferenceTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "RaceSpeedReference" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "raceName" TEXT NOT NULL,
      "subraceName" TEXT,
      "speedMeters" REAL NOT NULL,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RaceSpeedReference_raceName_subraceName_key"
    ON "RaceSpeedReference"("raceName", "subraceName");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "RaceSpeedReference_raceName_subraceName_idx"
    ON "RaceSpeedReference"("raceName", "subraceName");
  `);

}

function ensureUserLayoutPreferenceTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "UserLayoutPreference" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "layoutKey" TEXT NOT NULL,
      "layoutJson" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "UserLayoutPreference_userId_layoutKey_key"
    ON "UserLayoutPreference"("userId", "layoutKey");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "UserLayoutPreference_userId_idx"
    ON "UserLayoutPreference"("userId");
  `);
}

function ensureGameSessionStateTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "GameSessionState" (
      "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
      "isOpen" INTEGER NOT NULL DEFAULT 1,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedByUserId" TEXT,
      FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
}

function ensureGameSessionStateRow() {
  sqlite.exec(`
    INSERT OR IGNORE INTO "GameSessionState" ("id", "isOpen", "updatedAt", "updatedByUserId")
    VALUES (1, 1, CURRENT_TIMESTAMP, NULL)
  `);
}

function ensureCharacterCurrencyBalanceTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CharacterCurrencyBalance" (
      "characterId" TEXT NOT NULL PRIMARY KEY,
      "cp" INTEGER NOT NULL DEFAULT 0,
      "sp" INTEGER NOT NULL DEFAULT 0,
      "ep" INTEGER NOT NULL DEFAULT 0,
      "gp" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

function ensureCharacterCurrencyBalanceRows() {
  if (!tableExists("Character")) return;

  sqlite.exec(`
    INSERT INTO "CharacterCurrencyBalance" ("characterId", "cp", "sp", "ep", "gp", "updatedAt")
    SELECT c."id", 0, 0, 0, 0, CURRENT_TIMESTAMP
    FROM "Character" c
    LEFT JOIN "CharacterCurrencyBalance" b ON b."characterId" = c."id"
    WHERE b."characterId" IS NULL
  `);
}

function ensureCharacterCurrencyBalanceForCharacter(characterId) {
  if (!characterId) return;
  sqlite.prepare(`
    INSERT OR IGNORE INTO "CharacterCurrencyBalance" (
      "characterId", "cp", "sp", "ep", "gp", "updatedAt"
    ) VALUES (?, 0, 0, 0, 0, ?)
  `).run(characterId, new Date().toISOString());
}

function ensureCurrencyTransactionTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CurrencyTransaction" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "operationId" TEXT,
      "fromCharacterId" TEXT,
      "toCharacterId" TEXT,
      "fromExternalName" TEXT,
      "toExternalName" TEXT,
      "reason" TEXT,
      "purchaseDescription" TEXT,
      "note" TEXT,
      "cp" INTEGER NOT NULL DEFAULT 0,
      "sp" INTEGER NOT NULL DEFAULT 0,
      "ep" INTEGER NOT NULL DEFAULT 0,
      "gp" INTEGER NOT NULL DEFAULT 0,
      "createdByUserId" TEXT,
      "reversalOfTransactionId" TEXT,
      "reversedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("fromCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY ("toCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CurrencyTransaction_fromCharacterId_idx"
    ON "CurrencyTransaction"("fromCharacterId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CurrencyTransaction_toCharacterId_idx"
    ON "CurrencyTransaction"("toCharacterId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CurrencyTransaction_createdByUserId_idx"
    ON "CurrencyTransaction"("createdByUserId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CurrencyTransaction_createdAt_idx"
    ON "CurrencyTransaction"("createdAt");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CurrencyTransaction_reversalOfTransactionId_idx"
    ON "CurrencyTransaction"("reversalOfTransactionId");
  `);

  if (!columnExists("CurrencyTransaction", "operationId")) {
    sqlite.exec(`ALTER TABLE "CurrencyTransaction" ADD COLUMN "operationId" TEXT;`);
  }

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CurrencyTransaction_operationId_idx"
    ON "CurrencyTransaction"("operationId");
  `);
}

function ensureChatConversationTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "ChatConversation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "kind" TEXT NOT NULL,
      "title" TEXT,
      "legacyCharacterId" TEXT,
      "createdByUserId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("legacyCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ChatConversation_legacyCharacterId_key"
    ON "ChatConversation"("legacyCharacterId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversation_kind_idx"
    ON "ChatConversation"("kind");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversation_createdByUserId_idx"
    ON "ChatConversation"("createdByUserId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversation_updatedAt_idx"
    ON "ChatConversation"("updatedAt");
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "ChatConversationParticipant" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "userId" TEXT,
      "characterId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ChatConversationParticipant_conversationId_userId_key"
    ON "ChatConversationParticipant"("conversationId", "userId");
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ChatConversationParticipant_conversationId_characterId_key"
    ON "ChatConversationParticipant"("conversationId", "characterId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversationParticipant_conversationId_idx"
    ON "ChatConversationParticipant"("conversationId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversationParticipant_userId_idx"
    ON "ChatConversationParticipant"("userId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversationParticipant_characterId_idx"
    ON "ChatConversationParticipant"("characterId");
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "ChatConversationMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "senderUserId" TEXT,
      "senderCharacterId" TEXT,
      "senderRole" TEXT NOT NULL,
      "text" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY ("senderCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversationMessage_conversationId_createdAt_idx"
    ON "ChatConversationMessage"("conversationId", "createdAt");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversationMessage_senderUserId_idx"
    ON "ChatConversationMessage"("senderUserId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "ChatConversationMessage_senderCharacterId_idx"
    ON "ChatConversationMessage"("senderCharacterId");
  `);
}

function ensureLegacyCharacterChatConversationsMigrated() {
  if (!tableExists("ChatMessage")) return;
  if (!tableExists("ChatConversation")) return;
  if (!tableExists("ChatConversationParticipant")) return;
  if (!tableExists("ChatConversationMessage")) return;

  const legacyRows = sqlite.prepare(`
    SELECT
      m.id,
      m.characterId,
      m.senderUserId,
      m.senderRole,
      m.text,
      m.createdAt
    FROM "ChatMessage" m
    ORDER BY m.createdAt ASC
  `).all();

  if (legacyRows.length === 0) return;

  const findConversationByLegacyCharacter = sqlite.prepare(`
    SELECT id
    FROM "ChatConversation"
    WHERE legacyCharacterId = ?
    LIMIT 1
  `);
  const insertConversation = sqlite.prepare(`
    INSERT INTO "ChatConversation" (
      id, kind, title, legacyCharacterId, createdByUserId, createdAt, updatedAt
    ) VALUES (?, 'DIRECT', NULL, ?, NULL, ?, ?)
  `);
  const insertCharacterParticipant = sqlite.prepare(`
    INSERT OR IGNORE INTO "ChatConversationParticipant" (
      id, conversationId, userId, characterId, createdAt
    ) VALUES (?, ?, NULL, ?, ?)
  `);
  const insertMessage = sqlite.prepare(`
    INSERT OR IGNORE INTO "ChatConversationMessage" (
      id, conversationId, senderUserId, senderCharacterId, senderRole, text, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const conversationIdByCharacterId = new Map();

  runInTransaction(() => {
    for (const row of legacyRows) {
      const characterId = String(row.characterId ?? "").trim();
      if (!characterId) continue;

      let conversationId = conversationIdByCharacterId.get(characterId);
      if (!conversationId) {
        const existingConversation = findConversationByLegacyCharacter.get(characterId);
        conversationId = String(existingConversation?.id ?? "");
        if (!conversationId) {
          conversationId = crypto.randomUUID();
          const createdAt = row.createdAt ?? new Date().toISOString();
          insertConversation.run(conversationId, characterId, createdAt, createdAt);
        }
        insertCharacterParticipant.run(crypto.randomUUID(), conversationId, characterId, row.createdAt ?? new Date().toISOString());
        conversationIdByCharacterId.set(characterId, conversationId);
      }

      const senderRole = String(row.senderRole ?? "").toUpperCase() === "DM" ? "DM" : "PLAYER";
      const senderCharacterId = senderRole === "PLAYER" ? characterId : null;
      insertMessage.run(
        row.id ?? crypto.randomUUID(),
        conversationId,
        row.senderUserId ?? null,
        senderCharacterId,
        senderRole,
        row.text ?? "",
        row.createdAt ?? new Date().toISOString()
      );
    }
  });
}

function normalizeLegacyCoinsForMigration(value) {
  const raw = value && typeof value === "object" ? value : {};
  const platinumAsGold = Number(raw.pp ?? 0) * 10;

  return {
    cp: Number(raw.cp ?? 0) || 0,
    sp: Number(raw.sp ?? 0) || 0,
    ep: Number(raw.ep ?? 0) || 0,
    gp: (Number(raw.gp ?? 0) || 0) + platinumAsGold,
  };
}

function ensureLegacyCharacterCurrencyBalancesMigrated() {
  if (!tableExists("Character")) return;
  if (!tableExists("CharacterCurrencyBalance")) return;
  if (!tableExists("CurrencyTransaction")) return;

  const characters = sqlite
    .prepare('SELECT id, data FROM "Character"')
    .all();

  const getBalance = sqlite.prepare(`
    SELECT cp, sp, ep, gp
    FROM "CharacterCurrencyBalance"
    WHERE characterId = ?
    LIMIT 1
  `);

  const getInitialTransaction = sqlite.prepare(`
    SELECT id
    FROM "CurrencyTransaction"
    WHERE id = ?
    LIMIT 1
  `);

  const updateBalance = sqlite.prepare(`
    UPDATE "CharacterCurrencyBalance"
    SET cp = ?, sp = ?, ep = ?, gp = ?, updatedAt = ?
    WHERE characterId = ?
  `);

  const insertInitialTransaction = sqlite.prepare(`
    INSERT INTO "CurrencyTransaction" (
      id, operationId, fromCharacterId, toCharacterId, fromExternalName, toExternalName,
      reason, purchaseDescription, note, cp, sp, ep, gp,
      createdByUserId, reversalOfTransactionId, reversedAt, createdAt
    ) VALUES (?, ?, NULL, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
  `);

  const now = new Date().toISOString();

  runInTransaction(() => {
    for (const row of characters) {
      const data = parseJsonString(row.data, {});
      const legacyCoins = normalizeLegacyCoinsForMigration(data?.equipment?.coins);
      const total =
        legacyCoins.cp +
        legacyCoins.sp +
        legacyCoins.ep +
        legacyCoins.gp;

      if (total <= 0) continue;

      const transactionId = `currency_init_${row.id}`;
      if (getInitialTransaction.get(transactionId)) continue;

      const balance = getBalance.get(row.id);
      const currentTotal =
        Number(balance?.cp ?? 0) +
        Number(balance?.sp ?? 0) +
        Number(balance?.ep ?? 0) +
        Number(balance?.gp ?? 0);

      if (currentTotal > 0) continue;

      updateBalance.run(
        legacyCoins.cp,
        legacyCoins.sp,
        legacyCoins.ep,
        legacyCoins.gp,
        now,
        row.id
      );

      insertInitialTransaction.run(
        transactionId,
        transactionId,
        row.id,
        "DM",
        "Assegnazione iniziale",
        "Inizializzazione portafoglio",
        legacyCoins.cp,
        legacyCoins.sp,
        legacyCoins.ep,
        legacyCoins.gp,
        now
      );
    }
  });
}

function normalizeCharacterSheetLayoutEntries(entries) {
  if (!Array.isArray(entries)) return [];

  const seen = new Set();
  const normalized = [];

  for (const rawEntry of entries) {
    const cardId = String(rawEntry?.cardId ?? "").trim();
    const column = Number(rawEntry?.column);
    const order = Number(rawEntry?.order);

    if (!ALLOWED_CHARACTER_SHEET_CARD_IDS.has(cardId)) continue;
    if (seen.has(cardId)) continue;
    if (!Number.isInteger(column) || column < 0 || column > 2) continue;
    if (!Number.isInteger(order) || order < 0) continue;

    seen.add(cardId);
    normalized.push({ cardId, column, order });
  }

  return normalized;
}

function readUserLayoutPreference(userId, layoutKey) {
  if (!userId) return null;
  const row = sqlite
    .prepare('SELECT * FROM "UserLayoutPreference" WHERE userId = ? AND layoutKey = ? LIMIT 1')
    .get(userId, layoutKey);

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    layoutKey: row.layoutKey,
    entries: normalizeCharacterSheetLayoutEntries(parseJsonString(row.layoutJson, [])),
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function upsertUserLayoutPreference(userId, layoutKey, entries) {
  const now = new Date().toISOString();
  const normalizedEntries = normalizeCharacterSheetLayoutEntries(entries);
  const existing = sqlite
    .prepare('SELECT id FROM "UserLayoutPreference" WHERE userId = ? AND layoutKey = ? LIMIT 1')
    .get(userId, layoutKey);

  if (existing?.id) {
    sqlite.prepare(`
      UPDATE "UserLayoutPreference"
      SET layoutJson = ?, updatedAt = ?
      WHERE id = ?
    `).run(JSON.stringify(normalizedEntries), now, existing.id);
    return readUserLayoutPreference(userId, layoutKey);
  }

  const id = `layout_${sanitizeSlug(layoutKey)}_${crypto.randomBytes(4).toString("hex")}`;
  sqlite.prepare(`
    INSERT INTO "UserLayoutPreference" (
      id, userId, layoutKey, layoutJson, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, layoutKey, JSON.stringify(normalizedEntries), now, now);
  return readUserLayoutPreference(userId, layoutKey);
}

function createUniqueItemSlug(baseSlug, excludeId = null) {
  const safeBaseSlug = sanitizeSlug(baseSlug || "item");
  const rows = tableExists("ItemDefinition")
    ? sqlite.prepare('SELECT id, slug FROM "ItemDefinition"').all()
    : [];
  const used = new Set(
    rows
      .filter((row) => !excludeId || row.id !== excludeId)
      .map((row) => String(row.slug ?? "").trim())
      .filter(Boolean)
  );

  if (!used.has(safeBaseSlug)) return safeBaseSlug;

  let counter = 2;
  while (used.has(`${safeBaseSlug}-${counter}`)) {
    counter += 1;
  }
  return `${safeBaseSlug}-${counter}`;
}

function createEmptyItemDefinition(name = "Nuovo oggetto") {
  const safeName = String(name).trim() || "Nuovo oggetto";
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    slug: createUniqueItemSlug(safeName),
    name: safeName,
    category: "OTHER",
    subcategory: null,
    weaponHandling: null,
    gloveWearMode: null,
    armorCategory: null,
    armorClassCalculation: null,
    armorClassBase: null,
    armorClassBonus: null,
    rarity: null,
    description: null,
    playerVisible: true,
    stackable: false,
    equippable: false,
    attunement: false,
    weight: null,
    valueCp: null,
    data: null,
    createdAt: now,
    updatedAt: now,
    slotRules: [],
    attacks: [],
    modifiers: [],
    features: [],
    abilityRequirements: [],
    useEffects: [],
  };
}

function readItemDefinitions() {
  if (!tableExists("ItemDefinition")) return [];
  const hasPlayerVisible = columnExists("ItemDefinition", "playerVisible");

  return sqlite.prepare(`
    SELECT
      d.id,
      d.slug,
      d.name,
      d.category,
      d.rarity,
      d.description,
      ${hasPlayerVisible ? "d.playerVisible" : "1 AS playerVisible"},
      d.stackable,
      d.equippable,
      d.updatedAt,
      (SELECT COUNT(*) FROM "CharacterItem" ci WHERE ci.itemDefinitionId = d.id) AS assignedCharacterItemCount,
      (SELECT COUNT(*) FROM "ItemAttack" a WHERE a.itemDefinitionId = d.id) AS attackCount,
      (SELECT COUNT(*) FROM "ItemSlotRule" s WHERE s.itemDefinitionId = d.id) AS slotRuleCount
    FROM "ItemDefinition" d
    ORDER BY d.name COLLATE NOCASE ASC
  `).all().map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    rarity: row.rarity ?? null,
    description: row.description ?? null,
    playerVisible: !!row.playerVisible,
    stackable: !!row.stackable,
    equippable: !!row.equippable,
    assignedCharacterItemCount: Number(row.assignedCharacterItemCount ?? 0),
    attackCount: Number(row.attackCount ?? 0),
    slotRuleCount: Number(row.slotRuleCount ?? 0),
    updatedAt: row.updatedAt,
  }));
}

function readItemDefinition(itemId) {
  if (!tableExists("ItemDefinition")) return null;

  const base = sqlite.prepare('SELECT * FROM "ItemDefinition" WHERE id = ? LIMIT 1').get(itemId);
  if (!base) return null;

  const slotRules = sqlite
    .prepare('SELECT * FROM "ItemSlotRule" WHERE itemDefinitionId = ? ORDER BY groupKey ASC, sortOrder ASC, slot ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      groupKey: row.groupKey,
      selectionMode: row.selectionMode,
      slot: row.slot,
      required: !!row.required,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const attacks = sqlite
    .prepare('SELECT * FROM "ItemAttack" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, name COLLATE NOCASE ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      handRequirement: row.handRequirement,
      ability: row.ability ?? null,
      attackBonus: row.attackBonus ?? null,
      damageDice: row.damageDice ?? null,
      damageType: row.damageType ?? null,
      rangeNormal: row.rangeNormal ?? null,
      rangeLong: row.rangeLong ?? null,
      twoHandedOnly: !!row.twoHandedOnly,
      requiresEquipped: !!row.requiresEquipped,
      conditionText: row.conditionText ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const modifiers = sqlite
    .prepare('SELECT * FROM "ItemModifier" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, target ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      target: row.target,
      type: row.type,
      value: row.value ?? null,
      formula: row.formula ?? null,
      condition: row.condition,
      stackKey: row.stackKey ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const features = sqlite
    .prepare('SELECT * FROM "ItemFeature" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, name COLLATE NOCASE ASC')
    .all(itemId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      kind: columnExists("ItemFeature", "kind")
        ? String(row.kind ?? "ACTIVE").toUpperCase()
        : (row.resetOn != null || row.maxUses != null ? "ACTIVE" : "PASSIVE"),
      description: row.description ?? null,
      resetOn: row.resetOn ?? null,
      customResetLabel: row.customResetLabel ?? null,
      maxUses: row.maxUses ?? null,
      passiveEffects: columnExists("ItemFeature", "passiveEffects")
        ? (Array.isArray(parseJsonString(row.passiveEffects, [])) ? parseJsonString(row.passiveEffects, []) : [])
        : [],
      condition: row.condition,
      sortOrder: Number(row.sortOrder ?? 0),
    }));

  const abilityRequirements = tableExists("ItemAbilityRequirement")
    ? sqlite
        .prepare('SELECT * FROM "ItemAbilityRequirement" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, ability ASC')
        .all(itemId)
        .map((row) => ({
          id: row.id,
          ability: row.ability,
          minScore: Number(row.minScore ?? 0),
          sortOrder: Number(row.sortOrder ?? 0),
        }))
    : [];

  const useEffects = tableExists("ItemUseEffect")
    ? sqlite
        .prepare('SELECT * FROM "ItemUseEffect" WHERE itemDefinitionId = ? ORDER BY sortOrder ASC, effectType ASC')
        .all(itemId)
        .map((row) => ({
          id: row.id,
          effectType: row.effectType,
          targetType: row.targetType,
          diceExpression: row.diceExpression ?? null,
          flatValue: row.flatValue ?? null,
          damageType: row.damageType ?? null,
          savingThrowAbility: row.savingThrowAbility ?? null,
          savingThrowDc: row.savingThrowDc ?? null,
          successOutcome: row.successOutcome ?? null,
          durationText: row.durationText ?? null,
          notes: row.notes ?? null,
          sortOrder: Number(row.sortOrder ?? 0),
        }))
    : [];

  return {
    id: base.id,
    slug: base.slug,
    name: base.name,
    category: base.category,
    subcategory: base.subcategory ?? null,
    weaponHandling: base.weaponHandling ?? null,
    gloveWearMode: base.gloveWearMode ?? null,
    armorCategory: base.armorCategory ?? null,
    armorClassCalculation: base.armorClassCalculation ?? null,
    armorClassBase: base.armorClassBase ?? null,
    armorClassBonus: base.armorClassBonus ?? null,
    rarity: base.rarity ?? null,
    description: base.description ?? null,
    playerVisible: columnExists("ItemDefinition", "playerVisible") ? !!base.playerVisible : true,
    stackable: !!base.stackable,
    equippable: !!base.equippable,
    attunement: !!base.attunement,
    weight: base.weight ?? null,
    valueCp: base.valueCp ?? null,
    data: base.data ?? null,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    slotRules,
    attacks,
    modifiers,
    features,
    abilityRequirements,
    useEffects,
  };
}

function normalizeItemDefinitionPayload(payload, existingId = null) {
  const base = createEmptyItemDefinition(String(payload?.name ?? "Nuovo oggetto"));
  const safeName = String(payload?.name ?? "").trim();
  if (!safeName) {
    throw new Error("Item name required");
  }

  const rawAttacks = Array.isArray(payload?.attacks) ? payload.attacks : [];
  const rawFeatures = Array.isArray(payload?.features) ? payload.features : [];
  const rawAbilityRequirements = Array.isArray(payload?.abilityRequirements) ? payload.abilityRequirements : [];
  const rawUseEffects = Array.isArray(payload?.useEffects) ? payload.useEffects : [];
  const normalizedRarity = normalizeNullableString(payload?.rarity);

  assertNamedEntries(rawAttacks, "Attacco", ["kind", "handRequirement", "ability", "attackBonus", "damageDice", "damageType", "rangeNormal", "rangeLong", "conditionText"]);
  assertNamedEntries(rawFeatures, "Feature", ["description", "resetOn", "customResetLabel", "maxUses", "condition"]);

  return {
    ...base,
    id: existingId ?? String(payload?.id ?? base.id),
    slug: createUniqueItemSlug(String(payload?.slug ?? safeName), existingId),
    name: safeName,
    category: String(payload?.category ?? "OTHER").trim() || "OTHER",
    subcategory: normalizeNullableString(payload?.subcategory),
    weaponHandling: normalizeNullableString(payload?.weaponHandling),
    gloveWearMode: normalizeNullableString(payload?.gloveWearMode),
    armorCategory: normalizeNullableString(payload?.armorCategory),
    armorClassCalculation: normalizeNullableString(payload?.armorClassCalculation),
    armorClassBase: normalizeNullableInt(payload?.armorClassBase),
    armorClassBonus: normalizeNullableInt(payload?.armorClassBonus),
    rarity: normalizedRarity,
    description: normalizeNullableString(payload?.description),
    playerVisible: payload?.playerVisible !== false,
    stackable: normalizedRarity === "UNIQUE" ? false : !!payload?.stackable,
    equippable: !!payload?.equippable,
    attunement: !!payload?.attunement,
    weight: normalizeNullableFloat(payload?.weight),
    valueCp: normalizeNullableInt(payload?.valueCp),
    data: typeof payload?.data === "string" ? payload.data : payload?.data ? JSON.stringify(payload.data) : null,
    slotRules: Array.isArray(payload?.slotRules)
      ? payload.slotRules.map((entry, index) => ({
          id: String(entry?.id ?? crypto.randomUUID()),
          groupKey: String(entry?.groupKey ?? "default").trim() || "default",
          selectionMode: String(entry?.selectionMode ?? "ALL_REQUIRED").trim() || "ALL_REQUIRED",
          slot: String(entry?.slot ?? "").trim(),
          required: entry?.required !== false,
          sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
        })).filter((entry) => entry.slot)
      : [],
    attacks: rawAttacks
      ? rawAttacks.map((entry, index) => ({
          id: String(entry?.id ?? crypto.randomUUID()),
          name: String(entry?.name ?? "").trim(),
          kind: String(entry?.kind ?? "MELEE_WEAPON").trim() || "MELEE_WEAPON",
          handRequirement: String(entry?.handRequirement ?? "ANY").trim() || "ANY",
          ability: normalizeNullableString(entry?.ability),
          attackBonus: normalizeNullableInt(entry?.attackBonus),
          damageDice: normalizeNullableString(entry?.damageDice),
          damageType: normalizeNullableString(entry?.damageType),
          rangeNormal: normalizeNullableInt(entry?.rangeNormal),
          rangeLong: normalizeNullableInt(entry?.rangeLong),
          twoHandedOnly: !!entry?.twoHandedOnly,
          requiresEquipped: entry?.requiresEquipped !== false,
          conditionText: normalizeNullableString(entry?.conditionText),
          sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
        })).filter((entry) => entry.name)
      : [],
    modifiers: Array.isArray(payload?.modifiers)
      ? payload.modifiers.map((entry, index) => ({
          id: String(entry?.id ?? crypto.randomUUID()),
          target: String(entry?.target ?? "").trim(),
          type: String(entry?.type ?? "FLAT").trim() || "FLAT",
          value: normalizeNullableInt(entry?.value),
          formula: normalizeNullableString(entry?.formula),
          condition: String(entry?.condition ?? "WHILE_EQUIPPED").trim() || "WHILE_EQUIPPED",
          stackKey: normalizeNullableString(entry?.stackKey),
          sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
        })).filter((entry) => entry.target)
      : [],
    features: rawFeatures
      ? rawFeatures.map((entry, index) => {
          const kind = String(entry?.kind ?? "ACTIVE").trim().toUpperCase() === "PASSIVE" ? "PASSIVE" : "ACTIVE";
          return {
            id: String(entry?.id ?? crypto.randomUUID()),
            name: String(entry?.name ?? "").trim(),
            kind,
            description: normalizeNullableString(entry?.description),
            resetOn: kind === "ACTIVE" ? normalizeNullableString(entry?.resetOn) : null,
            customResetLabel: kind === "ACTIVE" ? normalizeNullableString(entry?.customResetLabel) : null,
            maxUses: kind === "ACTIVE" ? normalizeNullableInt(entry?.maxUses) : null,
            passiveEffects: kind === "PASSIVE" && Array.isArray(entry?.passiveEffects) ? entry.passiveEffects : [],
            condition: String(entry?.condition ?? "WHILE_EQUIPPED").trim() || "WHILE_EQUIPPED",
            sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
          };
        }).filter((entry) => entry.name)
      : [],
    abilityRequirements: rawAbilityRequirements
      ? rawAbilityRequirements.map((entry, index) => {
          const ability = String(entry?.ability ?? "").trim().toUpperCase();
          const minScore = normalizeNullableInt(entry?.minScore);
          return {
            id: String(entry?.id ?? crypto.randomUUID()),
            ability,
            minScore,
            sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
          };
        }).filter((entry) => ITEM_ABILITY_SCORE_VALUES.includes(entry.ability) && entry.minScore != null)
      : [],
    useEffects: rawUseEffects
      ? rawUseEffects.map((entry, index) => {
          const effectType = String(entry?.effectType ?? "").trim().toUpperCase();
          const targetType = String(entry?.targetType ?? "").trim().toUpperCase();
          const savingThrowAbility = normalizeNullableString(entry?.savingThrowAbility)?.toUpperCase() ?? null;
          const successOutcome = normalizeNullableString(entry?.successOutcome)?.toUpperCase() ?? null;
          return {
            id: String(entry?.id ?? crypto.randomUUID()),
            effectType,
            targetType,
            diceExpression: normalizeNullableString(entry?.diceExpression),
            flatValue: normalizeNullableInt(entry?.flatValue),
            damageType: normalizeNullableString(entry?.damageType),
            savingThrowAbility,
            savingThrowDc: normalizeNullableInt(entry?.savingThrowDc),
            successOutcome,
            durationText: normalizeNullableString(entry?.durationText),
            notes: normalizeNullableString(entry?.notes),
            sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : index,
          };
        }).filter((entry) => (
          ITEM_USE_EFFECT_TYPE_VALUES.includes(entry.effectType) &&
          ITEM_USE_TARGET_TYPE_VALUES.includes(entry.targetType) &&
          (!entry.savingThrowAbility || ITEM_ABILITY_SCORE_VALUES.includes(entry.savingThrowAbility)) &&
          (!entry.successOutcome || ITEM_USE_SUCCESS_OUTCOME_VALUES.includes(entry.successOutcome))
        ))
      : [],
  };
}

function saveItemDefinition(payload, existingId = null) {
  const normalized = normalizeItemDefinitionPayload(payload, existingId);
  const now = new Date().toISOString();
  const existing = tableExists("ItemDefinition")
    ? sqlite.prepare('SELECT id, createdAt FROM "ItemDefinition" WHERE id = ? LIMIT 1').get(normalized.id)
    : null;
  const hasPlayerVisible = columnExists("ItemDefinition", "playerVisible");

  runInTransaction(() => {
    if (existing) {
      sqlite.prepare(`
        UPDATE "ItemDefinition"
        SET
          slug = ?,
          name = ?,
          category = ?,
          subcategory = ?,
          weaponHandling = ?,
          gloveWearMode = ?,
          armorCategory = ?,
          armorClassCalculation = ?,
          armorClassBase = ?,
          armorClassBonus = ?,
          rarity = ?,
          description = ?,
          ${hasPlayerVisible ? "playerVisible = ?," : ""}
          stackable = ?,
          equippable = ?,
          attunement = ?,
          weight = ?,
          valueCp = ?,
          data = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(
        normalized.slug,
        normalized.name,
        normalized.category,
        normalized.subcategory,
        normalized.weaponHandling,
        normalized.gloveWearMode,
        normalized.armorCategory,
        normalized.armorClassCalculation,
        normalized.armorClassBase,
        normalized.armorClassBonus,
        normalized.rarity,
        normalized.description,
        ...(hasPlayerVisible ? [normalized.playerVisible ? 1 : 0] : []),
        normalized.stackable ? 1 : 0,
        normalized.equippable ? 1 : 0,
        normalized.attunement ? 1 : 0,
        normalized.weight,
        normalized.valueCp,
        normalized.data,
        now,
        normalized.id
      );
    } else {
      sqlite.prepare(`
        INSERT INTO "ItemDefinition" (
          id, slug, name, category, subcategory, weaponHandling, gloveWearMode, armorCategory,
          armorClassCalculation, armorClassBase, armorClassBonus, rarity, description,
          ${hasPlayerVisible ? "playerVisible," : ""}
          stackable, equippable, attunement, weight, valueCp, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${hasPlayerVisible ? "?, " : ""}?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalized.id,
        normalized.slug,
        normalized.name,
        normalized.category,
        normalized.subcategory,
        normalized.weaponHandling,
        normalized.gloveWearMode,
        normalized.armorCategory,
        normalized.armorClassCalculation,
        normalized.armorClassBase,
        normalized.armorClassBonus,
        normalized.rarity,
        normalized.description,
        ...(hasPlayerVisible ? [normalized.playerVisible ? 1 : 0] : []),
        normalized.stackable ? 1 : 0,
        normalized.equippable ? 1 : 0,
        normalized.attunement ? 1 : 0,
        normalized.weight,
        normalized.valueCp,
        normalized.data,
        now,
        now
      );
    }

    sqlite.prepare('DELETE FROM "ItemSlotRule" WHERE itemDefinitionId = ?').run(normalized.id);
    sqlite.prepare('DELETE FROM "ItemAttack" WHERE itemDefinitionId = ?').run(normalized.id);
    sqlite.prepare('DELETE FROM "ItemModifier" WHERE itemDefinitionId = ?').run(normalized.id);
    sqlite.prepare('DELETE FROM "ItemFeature" WHERE itemDefinitionId = ?').run(normalized.id);
    if (tableExists("ItemAbilityRequirement")) {
      sqlite.prepare('DELETE FROM "ItemAbilityRequirement" WHERE itemDefinitionId = ?').run(normalized.id);
    }
    if (tableExists("ItemUseEffect")) {
      sqlite.prepare('DELETE FROM "ItemUseEffect" WHERE itemDefinitionId = ?').run(normalized.id);
    }

    const insertSlotRule = sqlite.prepare(`
      INSERT INTO "ItemSlotRule" (id, itemDefinitionId, groupKey, selectionMode, slot, required, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAttack = sqlite.prepare(`
      INSERT INTO "ItemAttack" (
        id, itemDefinitionId, name, kind, handRequirement, ability, attackBonus, damageDice,
        damageType, rangeNormal, rangeLong, twoHandedOnly, requiresEquipped, conditionText,
        sortOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertModifier = sqlite.prepare(`
      INSERT INTO "ItemModifier" (
        id, itemDefinitionId, target, type, value, formula, condition, stackKey, sortOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFeature = sqlite.prepare(`
      INSERT INTO "ItemFeature" (
        id, itemDefinitionId, name, kind, description, resetOn, customResetLabel, maxUses, passiveEffects, condition, sortOrder, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAbilityRequirement = tableExists("ItemAbilityRequirement")
      ? sqlite.prepare(`
          INSERT INTO "ItemAbilityRequirement" (
            id, itemDefinitionId, ability, minScore, sortOrder, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
      : null;
    const insertUseEffect = tableExists("ItemUseEffect")
      ? sqlite.prepare(`
          INSERT INTO "ItemUseEffect" (
            id, itemDefinitionId, effectType, targetType, diceExpression, flatValue, damageType,
            savingThrowAbility, savingThrowDc, successOutcome, durationText, notes, sortOrder, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
      : null;

    for (const entry of normalized.slotRules) {
      insertSlotRule.run(
        entry.id,
        normalized.id,
        entry.groupKey,
        entry.selectionMode,
        entry.slot,
        entry.required ? 1 : 0,
        entry.sortOrder
      );
    }

    for (const entry of normalized.attacks) {
      insertAttack.run(
        entry.id,
        normalized.id,
        entry.name,
        entry.kind,
        entry.handRequirement,
        entry.ability,
        entry.attackBonus,
        entry.damageDice,
        entry.damageType,
        entry.rangeNormal,
        entry.rangeLong,
        entry.twoHandedOnly ? 1 : 0,
        entry.requiresEquipped ? 1 : 0,
        entry.conditionText,
        entry.sortOrder,
        now,
        now
      );
    }

    for (const entry of normalized.modifiers) {
      insertModifier.run(
        entry.id,
        normalized.id,
        entry.target,
        entry.type,
        entry.value,
        entry.formula,
        entry.condition,
        entry.stackKey,
        entry.sortOrder,
        now,
        now
      );
    }

    for (const entry of normalized.features) {
      insertFeature.run(
        entry.id,
        normalized.id,
        entry.name,
        entry.kind,
        entry.description,
        entry.resetOn,
        entry.customResetLabel,
        entry.maxUses,
        entry.passiveEffects?.length ? JSON.stringify(entry.passiveEffects) : null,
        entry.condition,
        entry.sortOrder,
        now,
        now
      );
    }

    if (insertAbilityRequirement) {
      for (const entry of normalized.abilityRequirements) {
        insertAbilityRequirement.run(
          entry.id,
          normalized.id,
          entry.ability,
          entry.minScore,
          entry.sortOrder,
          now,
          now
        );
      }
    }

    if (insertUseEffect) {
      for (const entry of normalized.useEffects) {
        insertUseEffect.run(
          entry.id,
          normalized.id,
          entry.effectType,
          entry.targetType,
          entry.diceExpression,
          entry.flatValue,
          entry.damageType,
          entry.savingThrowAbility,
          entry.savingThrowDc,
          entry.successOutcome,
          entry.durationText,
          entry.notes,
          entry.sortOrder,
          now,
          now
        );
      }
    }
  });

  return readItemDefinition(normalized.id);
}

function buildCharacterInventoryDetailSummary(itemDefinitionId, itemCategory) {
  if (!itemDefinitionId) return { description: null, detailSummary: null };

  const definition = sqlite
    .prepare('SELECT description FROM "ItemDefinition" WHERE id = ? LIMIT 1')
    .get(itemDefinitionId);

  let detailSummary = null;
  const abilityLabels = {
    STRENGTH: "Forza",
    DEXTERITY: "Destrezza",
    CONSTITUTION: "Costituzione",
    INTELLIGENCE: "Intelligenza",
    WISDOM: "Saggezza",
    CHARISMA: "Carisma",
  };
  const successOutcomeLabels = {
    NONE: "Nessun effetto al successo",
    HALF: "Effetto dimezzato al successo",
    NEGATES: "Nessun effetto con successo",
    CUSTOM: "Effetto personalizzato al successo",
  };
  const effectTypeLabels = {
    HEAL: "Cura",
    DAMAGE: "Danno",
    TEMP_HP: "Punti ferita temporanei",
    APPLY_CONDITION: "Applica condizione",
    REMOVE_CONDITION: "Rimuove condizione",
    RESTORE_RESOURCE: "Recupero risorsa",
    CUSTOM: "Effetto speciale",
  };

  if (itemCategory === "WEAPON" && tableExists("ItemAttack")) {
    const attack = sqlite
      .prepare(`
        SELECT name, attackBonus, damageDice, damageType, rangeNormal, rangeLong
        FROM "ItemAttack"
        WHERE itemDefinitionId = ?
        ORDER BY sortOrder ASC, name COLLATE NOCASE ASC
        LIMIT 1
      `)
      .get(itemDefinitionId);

    if (attack) {
      const parts = [];
      if (attack.attackBonus !== null && attack.attackBonus !== undefined) {
        parts.push(`${Number(attack.attackBonus) >= 0 ? "+" : ""}${attack.attackBonus}`);
      }
      if (attack.damageDice || attack.damageType) {
        parts.push([attack.damageDice, attack.damageType].filter(Boolean).join(" "));
      }
      if (attack.rangeNormal != null || attack.rangeLong != null) {
        parts.push(`gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}`);
      }
      detailSummary = parts.filter(Boolean).join(" - ") || null;
    }
  } else if ((itemCategory === "CONSUMABLE" || itemCategory === "AMMUNITION") && tableExists("ItemUseEffect")) {
    const effect = sqlite
      .prepare(`
        SELECT effectType, diceExpression, flatValue, damageType, savingThrowAbility, savingThrowDc, successOutcome
        FROM "ItemUseEffect"
        WHERE itemDefinitionId = ?
        ORDER BY sortOrder ASC
        LIMIT 1
      `)
      .get(itemDefinitionId);

    if (effect) {
      const parts = [];
      const baseLabel = effectTypeLabels[effect.effectType] ?? String(effect.effectType ?? "");
      const amount = effect.diceExpression ?? effect.flatValue ?? "";
      const damageType = typeof effect.damageType === "string" && effect.damageType
        ? effect.damageType.charAt(0).toUpperCase() + effect.damageType.slice(1)
        : "";
      const headline = effect.effectType === "DAMAGE"
        ? [amount, damageType].filter(Boolean).join(" ")
        : effect.effectType === "HEAL"
          ? [baseLabel, amount].filter(Boolean).join(" ")
          : [baseLabel, amount, damageType].filter(Boolean).join(" ").trim();
      parts.push(headline);
      if (effect.savingThrowAbility && effect.savingThrowDc != null) {
        parts.push(`TS ${abilityLabels[effect.savingThrowAbility] ?? effect.savingThrowAbility} CD ${effect.savingThrowDc}`);
      }
      if (effect.successOutcome) {
        parts.push(successOutcomeLabels[effect.successOutcome] ?? String(effect.successOutcome).toLowerCase());
      }
      detailSummary = parts.filter(Boolean).join(" - ") || null;
    }
  }

  return {
    description: definition?.description ?? null,
    detailSummary,
  };
}

function createDetailedError(message, details = null) {
  const error = new Error(message);
  if (details) error.details = details;
  return error;
}

function buildSlotGroups(slotRules) {
  const grouped = new Map();
  (Array.isArray(slotRules) ? slotRules : []).forEach((rule, index) => {
    const groupKey = String(rule?.groupKey ?? "").trim() || `default-${index}`;
    const bucket = grouped.get(groupKey) ?? [];
    bucket.push({
      slot: String(rule?.slot ?? "").trim(),
      selectionMode: String(rule?.selectionMode ?? "ALL_REQUIRED").trim() || "ALL_REQUIRED",
      sortOrder: Number(rule?.sortOrder ?? index),
    });
    grouped.set(groupKey, bucket);
  });

  return Array.from(grouped.entries())
    .map(([groupKey, rules]) => ({
      groupKey,
      selectionMode: String(rules[0]?.selectionMode ?? "ALL_REQUIRED"),
      rules: rules
        .filter((rule) => rule.slot)
        .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
    }))
    .filter((group) => group.rules.length > 0)
    .sort((a, b) => Number(a.rules[0]?.sortOrder ?? 0) - Number(b.rules[0]?.sortOrder ?? 0));
}

function getEquipmentSlotSortWeight(slot) {
  const order = [
    "WEAPON_HAND_RIGHT",
    "WEAPON_HAND_LEFT",
    "HEAD",
    "ARMOR",
    "BACK",
    "NECK",
    "RING_1",
    "RING_2",
    "RING_3",
    "RING_4",
    "RING_5",
    "RING_6",
    "RING_7",
    "RING_8",
    "RING_9",
    "RING_10",
    "GLOVE_LEFT",
    "GLOVE_RIGHT",
    "FEET",
  ];
  const index = order.indexOf(String(slot ?? "").trim());
  return index === -1 ? 999 : index;
}

function readCharacterSlotOccupancy(characterId, excludedItemIds = []) {
  if (!tableExists("CharacterItemEquip")) return new Map();

  const rows = sqlite.prepare(`
    SELECT
      cie.slot,
      ci.id AS characterItemId,
      ci.nameOverride,
      d.name AS itemDefinitionName
    FROM "CharacterItemEquip" cie
    JOIN "CharacterItem" ci ON ci.id = cie.characterItemId
    LEFT JOIN "ItemDefinition" d ON d.id = ci.itemDefinitionId
    WHERE ci.characterId = ?
      AND ci.isEquipped = 1
  `).all(characterId);

  const excluded = new Set((Array.isArray(excludedItemIds) ? excludedItemIds : []).filter(Boolean));
  const occupancy = new Map();
  rows.forEach((row) => {
    if (excluded.has(row.characterItemId)) return;
    occupancy.set(String(row.slot), {
      slot: String(row.slot),
      itemId: row.characterItemId,
      itemName: row.nameOverride ?? row.itemDefinitionName ?? "Oggetto senza nome",
    });
  });
  return occupancy;
}

function buildEquipOptionsForItem(itemDefinition, occupancyMap) {
  const groups = buildSlotGroups(itemDefinition?.slotRules ?? []);
  return groups.flatMap((group) => {
    if (group.selectionMode === "ANY_ONE") {
      return group.rules.map((rule) => {
        const occupied = occupancyMap.get(rule.slot);
        return {
          optionId: `${group.groupKey}::${rule.slot}`,
          groupKey: group.groupKey,
          selectionMode: group.selectionMode,
          slots: [rule.slot],
          conflicts: occupied ? [occupied] : [],
        };
      });
    }

    const slots = Array.from(new Set(group.rules.map((rule) => rule.slot)));
    const conflicts = slots
      .map((slot) => occupancyMap.get(slot))
      .filter(Boolean)
      .filter((entry, index, array) => array.findIndex((candidate) => candidate.itemId === entry.itemId) === index);

    return [{
      optionId: `${group.groupKey}::${slots.join("|")}`,
      groupKey: group.groupKey,
      selectionMode: group.selectionMode,
      slots,
      conflicts,
    }];
  });
}

function chooseEquipOption(existing, itemDefinition, options, equipConfig) {
  if (!Array.isArray(options) || options.length === 0) {
    throw createDetailedError("Questo oggetto non ha slot configurati per l'equipaggiamento", {
      code: "EQUIP_SLOT_RULES_MISSING",
    });
  }

  const normalizedCategory = String(itemDefinition?.category ?? "").toUpperCase();
  const requestedOptionId = String(equipConfig?.optionId ?? "").trim();
  const requestedSlots = Array.isArray(equipConfig?.slots)
    ? equipConfig.slots.map((slot) => String(slot ?? "").trim()).filter(Boolean).sort()
    : null;

  const selectedByRequest =
    (requestedOptionId ? options.find((option) => option.optionId === requestedOptionId) : null)
    ?? (requestedSlots
      ? options.find((option) => {
          const sortedSlots = [...option.slots].sort();
          return sortedSlots.length === requestedSlots.length &&
            sortedSlots.every((slot, index) => slot === requestedSlots[index]);
        })
      : null);
  if (selectedByRequest) return selectedByRequest;

  const conflictFreeOptions = options.filter((option) => option.conflicts.length === 0);

  if (normalizedCategory === "RING" && conflictFreeOptions.length > 0) {
    return [...conflictFreeOptions].sort(
      (a, b) => getEquipmentSlotSortWeight(a.slots[0]) - getEquipmentSlotSortWeight(b.slots[0])
    )[0];
  }

  if (conflictFreeOptions.length === 1) {
    return conflictFreeOptions[0];
  }

  if (conflictFreeOptions.length > 1) {
    throw createDetailedError("Scegli come equipaggiare questo oggetto", {
      code: "EQUIP_RESOLUTION_REQUIRED",
      mode: "choice",
      itemId: existing.id,
      itemName: existing.nameOverride ?? itemDefinition?.name ?? "Oggetto senza nome",
      options: conflictFreeOptions,
    });
  }

  const swappableOptions = options.filter((option) => option.conflicts.length > 0);
  throw createDetailedError("Gli slot richiesti sono gia occupati", {
    code: "EQUIP_RESOLUTION_REQUIRED",
    mode: "swap",
    itemId: existing.id,
    itemName: existing.nameOverride ?? itemDefinition?.name ?? "Oggetto senza nome",
    options: swappableOptions,
  });
}

function readCharacterInventoryItemsBySlug(slug) {
  if (!tableExists("CharacterItem")) return [];

  const character = sqlite
    .prepare('SELECT id, slug, name FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(slug);
  if (!character) return null;

  const rows = sqlite.prepare(`
    SELECT
      ci.id,
      ci.characterId,
      ci.itemDefinitionId,
      ci.nameOverride,
      ci.descriptionOverride,
      ci.quantity,
      ci.isEquipped,
      ci.sortOrder,
      ci.notes,
      ci.data,
      ci.createdAt,
      ci.updatedAt,
      d.name AS itemDefinitionName,
      d.category AS itemDefinitionCategory,
      d.equippable AS itemDefinitionEquippable,
      d.stackable AS itemDefinitionStackable
    FROM "CharacterItem" ci
    LEFT JOIN "ItemDefinition" d ON d.id = ci.itemDefinitionId
    WHERE ci.characterId = ?
    ORDER BY ci.sortOrder ASC, ci.createdAt ASC
    `).all(character.id);

  const equippedSlotsByItemId = tableExists("CharacterItemEquip") && rows.length > 0
    ? sqlite
        .prepare(`
          SELECT characterItemId, slot
          FROM "CharacterItemEquip"
          WHERE characterItemId IN (${rows.map(() => "?").join(",") || "NULL"})
          ORDER BY slot ASC
        `)
        .all(...rows.map((row) => row.id))
        .reduce((acc, row) => {
          if (!acc[row.characterItemId]) acc[row.characterItemId] = [];
          acc[row.characterItemId].push(String(row.slot));
          return acc;
        }, {})
    : {};

  const featureStatesByItemId = tableExists("CharacterItemFeatureState")
    ? sqlite
        .prepare(`
          SELECT characterItemId, itemFeatureId, usesSpent, lastResetAt
          FROM "CharacterItemFeatureState"
          WHERE characterItemId IN (${rows.map(() => "?").join(",") || "NULL"})
        `)
        .all(...rows.map((row) => row.id))
        .reduce((acc, row) => {
          if (!acc[row.characterItemId]) acc[row.characterItemId] = [];
          acc[row.characterItemId].push({
            itemFeatureId: row.itemFeatureId,
            usesSpent: Number(row.usesSpent ?? 0),
            lastResetAt: row.lastResetAt ?? null,
          });
          return acc;
        }, {})
    : {};

  return rows.map((row) => {
    const category = row.itemDefinitionCategory ?? null;
    const details = buildCharacterInventoryDetailSummary(row.itemDefinitionId ?? null, category);

    return {
      id: row.id,
      characterId: character.id,
      characterSlug: character.slug,
      characterName: character.name,
      itemDefinitionId: row.itemDefinitionId ?? null,
      itemName: row.nameOverride ?? row.itemDefinitionName ?? "Oggetto senza nome",
      itemCategory: category,
      description: row.descriptionOverride ?? details.description ?? null,
      detailSummary: details.detailSummary,
      equippable: !!row.itemDefinitionEquippable,
      stackable: !!row.itemDefinitionStackable,
        quantity: Number(row.quantity ?? 1),
        isEquipped: !!row.isEquipped,
        equippedSlots: Array.isArray(equippedSlotsByItemId[row.id]) ? equippedSlotsByItemId[row.id] : [],
        nameOverride: row.nameOverride ?? null,
        descriptionOverride: row.descriptionOverride ?? null,
        notes: row.notes ?? null,
        data: row.data ?? null,
      featureStates: Array.isArray(featureStatesByItemId[row.id]) ? featureStatesByItemId[row.id] : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

function assignItemDefinitionToCharacter(characterSlug, payload, actorUserId = null) {
  if (!tableExists("CharacterItem")) {
    throw new Error("Character inventory not available");
  }

  const character = sqlite
    .prepare('SELECT id, slug, name FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(characterSlug);
  if (!character) {
    throw new Error("Character not found");
  }

  let itemDefinition = null;
  const itemDefinitionId = String(payload?.itemDefinitionId ?? "").trim();
  const quickCreateItem = payload?.quickCreateItem && typeof payload.quickCreateItem === "object"
    ? payload.quickCreateItem
    : null;

  if (itemDefinitionId) {
    itemDefinition = sqlite
      .prepare('SELECT id, name, category, stackable, rarity FROM "ItemDefinition" WHERE id = ? LIMIT 1')
      .get(itemDefinitionId);
    if (!itemDefinition) {
      throw new Error("Item definition not found");
    }
  } else if (quickCreateItem) {
    const created = saveItemDefinition(buildQuickCreateItemDefinitionPayload(quickCreateItem));
    itemDefinition = {
      id: created.id,
      name: created.name,
      category: created.category,
      stackable: created.stackable ? 1 : 0,
      rarity: created.rarity ?? null,
    };
  } else {
    throw new Error("Item definition required");
  }

  if (String(itemDefinition.rarity ?? "").toUpperCase() === "UNIQUE") {
    const existingInstances = Number(
      sqlite
        .prepare('SELECT COUNT(*) AS count FROM "CharacterItem" WHERE itemDefinitionId = ?')
        .get(itemDefinition.id)?.count ?? 0
    );
    if (existingInstances > 0) {
      throw new Error("Questo oggetto unico esiste gia e non puo avere piu istanze.");
    }
  }

  const requestedQuantity = Math.max(1, normalizeNullableInt(payload?.quantity) ?? 1);
  const notes = normalizeNullableString(payload?.notes);
  const currentMaxSortOrder = Number(
    sqlite.prepare('SELECT MAX(sortOrder) AS maxSortOrder FROM "CharacterItem" WHERE characterId = ?').get(character.id)?.maxSortOrder ?? -1
  );
  const entriesToCreate = !!itemDefinition.stackable
    ? [{ quantity: requestedQuantity }]
    : Array.from({ length: requestedQuantity }, () => ({ quantity: 1 }));

  runInTransaction(() => {
    const now = new Date().toISOString();
    const insertCharacterItem = sqlite.prepare(`
      INSERT INTO "CharacterItem" (
        id, characterId, itemDefinitionId, nameOverride, descriptionOverride, quantity, isEquipped,
        sortOrder, notes, data, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTransaction = tableExists("InventoryTransaction")
      ? sqlite.prepare(`
          INSERT INTO "InventoryTransaction" (
            id, type, fromOwnerType, fromCharacterId, fromNpcName, toOwnerType, toCharacterId, toNpcName,
            notes, createdByUserId, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
      : null;

    const insertTransactionItem = tableExists("InventoryTransactionItem")
      ? sqlite.prepare(`
          INSERT INTO "InventoryTransactionItem" (
            id, transactionId, characterItemId, itemDefinitionId, descriptionSnapshot, quantity
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
      : null;

    const transactionId = insertTransaction ? crypto.randomUUID() : null;
    if (insertTransaction && transactionId) {
      insertTransaction.run(
        transactionId,
        "INITIAL_GRANT",
        "SYSTEM",
        null,
        null,
        "CHARACTER",
        character.id,
        null,
        `Assegnazione DM: ${itemDefinition.name}`,
        actorUserId,
        now
      );
    }

    entriesToCreate.forEach((entry, index) => {
      const characterItemId = crypto.randomUUID();
      insertCharacterItem.run(
        characterItemId,
        character.id,
        itemDefinition.id,
        null,
        null,
        entry.quantity,
        0,
        currentMaxSortOrder + index + 1,
        notes,
        JSON.stringify({ assignedFromCatalog: true }),
        now,
        now
      );

        if (insertTransactionItem && transactionId) {
          const snapshot = {
            mode: "dm_grant",
            toCharacterId: character.id,
            characterItemId,
            quantity: entry.quantity,
            itemDefinitionId: itemDefinition.id,
            itemName: itemDefinition.name,
          };
          insertTransactionItem.run(
            crypto.randomUUID(),
            transactionId,
            characterItemId,
            itemDefinition.id,
            JSON.stringify(snapshot),
            entry.quantity
          );
        }
      });
  });

  return readCharacterInventoryItemsBySlug(characterSlug);
}

function isUndoTransactionNotes(notes) {
  return typeof notes === "string" && notes.startsWith("UNDO::");
}

function isAnnulledTransactionNotes(notes) {
  return typeof notes === "string" && notes.startsWith("ANNULLED::");
}

function transferCharacterItemBetweenCharacters(fromCharacterSlug, characterItemId, payload, actorUserId = null) {
  if (!tableExists("CharacterItem")) {
    throw new Error("Character inventory not available");
  }

  const fromCharacter = sqlite
    .prepare('SELECT id, slug, name, characterType FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(fromCharacterSlug);
  if (!fromCharacter) {
    throw new Error("Character not found");
  }

  const toCharacterSlug = String(payload?.toCharacterSlug ?? "").trim();
  if (!toCharacterSlug) {
    throw new Error("Target character required");
  }

  const toCharacter = sqlite
    .prepare('SELECT id, slug, name, characterType FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(toCharacterSlug);
  if (!toCharacter) {
    throw new Error("Target character not found");
  }
  if (String(toCharacter.characterType).toUpperCase() === "PNG") {
    throw new Error("Transfers to PNG are not supported");
  }
  if (fromCharacter.id === toCharacter.id) {
    throw new Error("Choose a different target character");
  }

  const existing = sqlite.prepare(`
    SELECT
      ci.*,
      d.name AS itemDefinitionName,
      d.stackable AS itemDefinitionStackable
    FROM "CharacterItem" ci
    LEFT JOIN "ItemDefinition" d ON d.id = ci.itemDefinitionId
    WHERE ci.id = ? AND ci.characterId = ?
    LIMIT 1
  `).get(characterItemId, fromCharacter.id);
  if (!existing) {
    throw new Error("Character item not found");
  }

  const availableQuantity = Math.max(1, Number(existing.quantity ?? 1));
  const requestedQuantity = Math.max(1, normalizeNullableInt(payload?.quantity) ?? 1);
  const transferQuantity = Math.min(availableQuantity, requestedQuantity);
  const isStackable = !!existing.itemDefinitionStackable;
  if (!isStackable && transferQuantity !== 1) {
    throw new Error("This item cannot be transferred in multiple quantities");
  }

  const destinationMergeCandidate = isStackable
    ? sqlite.prepare(`
        SELECT id, quantity
        FROM "CharacterItem"
        WHERE characterId = ?
          AND id <> ?
          AND (
            (itemDefinitionId IS NULL AND ? IS NULL)
            OR itemDefinitionId = ?
          )
          AND COALESCE(nameOverride, '') = COALESCE(?, '')
          AND COALESCE(descriptionOverride, '') = COALESCE(?, '')
          AND COALESCE(notes, '') = COALESCE(?, '')
          AND isEquipped = 0
        ORDER BY sortOrder ASC, createdAt ASC
        LIMIT 1
      `).get(
        toCharacter.id,
        existing.id,
        existing.itemDefinitionId ?? null,
        existing.itemDefinitionId ?? null,
        existing.nameOverride ?? null,
        existing.descriptionOverride ?? null,
        existing.notes ?? null
      )
    : null;

  const destinationSortOrder = Number(
    sqlite.prepare('SELECT MAX(sortOrder) AS maxSortOrder FROM "CharacterItem" WHERE characterId = ?').get(toCharacter.id)?.maxSortOrder ?? -1
  );
  const now = new Date().toISOString();
  const transactionId = crypto.randomUUID();
  const transferMode = destinationMergeCandidate
    ? "merge"
    : (isStackable && transferQuantity < availableQuantity ? "split" : "move");
  const movedItemId =
    transferMode === "move"
      ? existing.id
      : (transferMode === "merge" ? destinationMergeCandidate.id : crypto.randomUUID());
  const sourceWillBeDeleted = transferMode === "merge" && transferQuantity >= availableQuantity;
  const snapshot = {
    mode: transferMode,
    fromCharacterId: fromCharacter.id,
    toCharacterId: toCharacter.id,
    sourceItemId: existing.id,
    destinationItemId: movedItemId,
    quantity: transferQuantity,
    itemDefinitionId: existing.itemDefinitionId ?? null,
    itemName: existing.nameOverride ?? existing.itemDefinitionName ?? "Oggetto senza nome",
    sourceDeletedAfterTransfer: sourceWillBeDeleted,
    sourceSnapshot: {
      itemDefinitionId: existing.itemDefinitionId ?? null,
      nameOverride: existing.nameOverride ?? null,
      descriptionOverride: existing.descriptionOverride ?? null,
      notes: existing.notes ?? null,
      data: existing.data ?? null,
    },
  };

  runInTransaction(() => {
    sqlite.prepare(`
      INSERT INTO "InventoryTransaction" (
        id, type, fromOwnerType, fromCharacterId, fromNpcName, toOwnerType, toCharacterId, toNpcName,
        notes, createdByUserId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transactionId,
      "TRANSFER",
      "CHARACTER",
      fromCharacter.id,
      null,
      "CHARACTER",
      toCharacter.id,
      null,
      null,
      actorUserId,
      now
    );

      if (transferMode === "move") {
        sqlite.prepare('DELETE FROM "CharacterItemEquip" WHERE characterItemId = ?').run(existing.id);
        sqlite.prepare(`
          UPDATE "CharacterItem"
          SET characterId = ?, sortOrder = ?, isEquipped = 0, updatedAt = ?
          WHERE id = ?
        `).run(toCharacter.id, destinationSortOrder + 1, now, existing.id);
      } else if (transferMode === "merge") {
        const destinationQuantity = Math.max(0, Number(destinationMergeCandidate.quantity ?? 0));

        sqlite.prepare(`
          UPDATE "CharacterItem"
          SET quantity = ?, updatedAt = ?
          WHERE id = ?
        `).run(destinationQuantity + transferQuantity, now, destinationMergeCandidate.id);

        const nextSourceQuantity = availableQuantity - transferQuantity;
        if (nextSourceQuantity <= 0) {
          sqlite.prepare('DELETE FROM "CharacterItem" WHERE id = ?').run(existing.id);
        } else {
          sqlite.prepare(`
            UPDATE "CharacterItem"
            SET quantity = ?, updatedAt = ?
            WHERE id = ?
          `).run(nextSourceQuantity, now, existing.id);
        }
      } else {
        sqlite.prepare(`
          UPDATE "CharacterItem"
          SET quantity = ?, updatedAt = ?
          WHERE id = ?
      `).run(Math.max(0, availableQuantity - transferQuantity), now, existing.id);

      sqlite.prepare(`
        INSERT INTO "CharacterItem" (
          id, characterId, itemDefinitionId, nameOverride, descriptionOverride, quantity, isEquipped,
          sortOrder, notes, data, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        movedItemId,
        toCharacter.id,
        existing.itemDefinitionId ?? null,
        existing.nameOverride ?? null,
        existing.descriptionOverride ?? null,
        transferQuantity,
        0,
        destinationSortOrder + 1,
        existing.notes ?? null,
        existing.data ?? null,
        now,
        now
      );
    }

    sqlite.prepare(`
      INSERT INTO "InventoryTransactionItem" (
        id, transactionId, characterItemId, itemDefinitionId, descriptionSnapshot, quantity
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      transactionId,
      movedItemId,
      existing.itemDefinitionId ?? null,
      JSON.stringify(snapshot),
      transferQuantity
    );
  });

  return readCharacterInventoryItemsBySlug(fromCharacterSlug);
}

function readInventoryTransfers() {
  if (!tableExists("InventoryTransaction")) return [];

  const rows = sqlite.prepare(`
    SELECT
      t.id,
      t.type,
      t.notes,
      t.createdAt,
      fc.slug AS fromCharacterSlug,
      fc.name AS fromCharacterName,
      tc.slug AS toCharacterSlug,
      tc.name AS toCharacterName,
      ti.quantity,
      ti.descriptionSnapshot
      FROM "InventoryTransaction" t
      LEFT JOIN "Character" fc ON fc.id = t.fromCharacterId
      LEFT JOIN "Character" tc ON tc.id = t.toCharacterId
      LEFT JOIN "InventoryTransactionItem" ti ON ti.transactionId = t.id
      WHERE t.type IN ('TRANSFER', 'INITIAL_GRANT', 'REMOVAL')
      ORDER BY t.createdAt DESC
    `).all();

    return rows
      .filter((row) => !isUndoTransactionNotes(row.notes))
      .map((row) => {
        const snapshot = parseJsonString(row.descriptionSnapshot, {});
        const rawSnapshotLabel =
          typeof row.descriptionSnapshot === "string" && row.descriptionSnapshot.trim()
            ? row.descriptionSnapshot.trim()
            : null;
        const type = String(row.type ?? "TRANSFER");
        const actionLabel =
          type === "INITIAL_GRANT"
            ? "Assegnazione DM"
            : type === "REMOVAL"
              ? "Rimozione DM"
              : "Trasferimento";
        return {
          id: row.id,
          type,
          actionLabel,
          fromCharacterSlug: row.fromCharacterSlug ?? null,
          fromCharacterName: row.fromCharacterName ?? null,
          toCharacterSlug: row.toCharacterSlug ?? null,
          toCharacterName: row.toCharacterName ?? null,
          itemName:
            (snapshot && typeof snapshot === "object" ? snapshot.itemName : null)
            ?? rawSnapshotLabel
            ?? "Oggetto senza nome",
          quantity: Number(row.quantity ?? snapshot?.quantity ?? 1),
          createdAt: row.createdAt,
          notes: row.notes ?? null,
          undone: isAnnulledTransactionNotes(row.notes),
          canUndo: type === "TRANSFER" && !isAnnulledTransactionNotes(row.notes),
        };
      });
  }

function undoInventoryTransfer(transactionId, actorUserId = null) {
  const transaction = sqlite
    .prepare(`
      SELECT *
      FROM "InventoryTransaction"
      WHERE id = ? AND type = 'TRANSFER'
      LIMIT 1
    `)
    .get(transactionId);
  if (!transaction || isUndoTransactionNotes(transaction.notes)) {
    throw new Error("Transfer transaction not found");
  }
  if (isAnnulledTransactionNotes(transaction.notes)) {
    throw new Error("This transfer has already been undone");
  }

  const itemRow = sqlite
    .prepare('SELECT * FROM "InventoryTransactionItem" WHERE transactionId = ? ORDER BY rowid ASC LIMIT 1')
    .get(transactionId);
  if (!itemRow) {
    throw new Error("Transfer payload not found");
  }

  const snapshot = parseJsonString(itemRow.descriptionSnapshot, {});
  if (!snapshot?.fromCharacterId || !snapshot?.toCharacterId || !snapshot?.destinationItemId) {
    throw new Error("Transfer snapshot is invalid");
  }

  const sourceSortOrder = Number(
    sqlite.prepare('SELECT MAX(sortOrder) AS maxSortOrder FROM "CharacterItem" WHERE characterId = ?').get(snapshot.fromCharacterId)?.maxSortOrder ?? -1
  );
  const now = new Date().toISOString();
  const undoTransactionId = crypto.randomUUID();

  runInTransaction(() => {
      if (snapshot.mode === "move") {
        const movedItem = sqlite
          .prepare('SELECT id, characterId FROM "CharacterItem" WHERE id = ? LIMIT 1')
          .get(snapshot.destinationItemId);
        if (!movedItem || movedItem.characterId !== snapshot.toCharacterId) {
          throw new Error("Cannot undo this transfer anymore");
      }

      sqlite.prepare('DELETE FROM "CharacterItemEquip" WHERE characterItemId = ?').run(snapshot.destinationItemId);
      sqlite.prepare(`
        UPDATE "CharacterItem"
        SET characterId = ?, sortOrder = ?, isEquipped = 0, updatedAt = ?
        WHERE id = ?
      `).run(snapshot.fromCharacterId, sourceSortOrder + 1, now, snapshot.destinationItemId);
      } else if (snapshot.mode === "merge") {
        const destinationItem = sqlite
          .prepare('SELECT id, quantity FROM "CharacterItem" WHERE id = ? AND characterId = ? LIMIT 1')
          .get(snapshot.destinationItemId, snapshot.toCharacterId);

        if (!destinationItem || Number(destinationItem.quantity ?? 0) < Number(snapshot.quantity ?? 0)) {
          throw new Error("Cannot undo this transfer anymore");
        }

        const existingSourceItem = sqlite
          .prepare('SELECT id, quantity FROM "CharacterItem" WHERE id = ? AND characterId = ? LIMIT 1')
          .get(snapshot.sourceItemId, snapshot.fromCharacterId);

        if (existingSourceItem) {
          sqlite.prepare(`
            UPDATE "CharacterItem"
            SET quantity = ?, updatedAt = ?
            WHERE id = ?
          `).run(Number(existingSourceItem.quantity ?? 0) + Number(snapshot.quantity ?? 0), now, snapshot.sourceItemId);
        } else if (snapshot.sourceDeletedAfterTransfer) {
          sqlite.prepare(`
            INSERT INTO "CharacterItem" (
              id, characterId, itemDefinitionId, nameOverride, descriptionOverride, quantity, isEquipped,
              sortOrder, notes, data, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            snapshot.sourceItemId,
            snapshot.fromCharacterId,
            snapshot.sourceSnapshot?.itemDefinitionId ?? snapshot.itemDefinitionId ?? null,
            snapshot.sourceSnapshot?.nameOverride ?? null,
            snapshot.sourceSnapshot?.descriptionOverride ?? null,
            Number(snapshot.quantity ?? 0),
            0,
            sourceSortOrder + 1,
            snapshot.sourceSnapshot?.notes ?? null,
            snapshot.sourceSnapshot?.data ?? null,
            now,
            now
          );
        } else {
          throw new Error("Cannot undo this transfer anymore");
        }

        const nextDestinationQuantity = Number(destinationItem.quantity ?? 0) - Number(snapshot.quantity ?? 0);
        if (nextDestinationQuantity <= 0) {
          sqlite.prepare('DELETE FROM "CharacterItem" WHERE id = ?').run(snapshot.destinationItemId);
        } else {
          sqlite.prepare(`
            UPDATE "CharacterItem"
            SET quantity = ?, updatedAt = ?
            WHERE id = ?
          `).run(nextDestinationQuantity, now, snapshot.destinationItemId);
        }
      } else {
        const sourceItem = sqlite
          .prepare('SELECT id, quantity FROM "CharacterItem" WHERE id = ? AND characterId = ? LIMIT 1')
          .get(snapshot.sourceItemId, snapshot.fromCharacterId);
        const destinationItem = sqlite
          .prepare('SELECT id, quantity FROM "CharacterItem" WHERE id = ? AND characterId = ? LIMIT 1')
        .get(snapshot.destinationItemId, snapshot.toCharacterId);

      if (!sourceItem || !destinationItem || Number(destinationItem.quantity ?? 0) < Number(snapshot.quantity ?? 0)) {
        throw new Error("Cannot undo this transfer anymore");
      }

      sqlite.prepare(`
        UPDATE "CharacterItem"
        SET quantity = ?, updatedAt = ?
        WHERE id = ?
      `).run(Number(sourceItem.quantity ?? 0) + Number(snapshot.quantity ?? 0), now, snapshot.sourceItemId);

      const nextDestinationQuantity = Number(destinationItem.quantity ?? 0) - Number(snapshot.quantity ?? 0);
      if (nextDestinationQuantity <= 0) {
        sqlite.prepare('DELETE FROM "CharacterItem" WHERE id = ?').run(snapshot.destinationItemId);
      } else {
        sqlite.prepare(`
          UPDATE "CharacterItem"
          SET quantity = ?, updatedAt = ?
          WHERE id = ?
        `).run(nextDestinationQuantity, now, snapshot.destinationItemId);
      }
    }

    sqlite.prepare(`
      UPDATE "InventoryTransaction"
      SET notes = ?, createdByUserId = COALESCE(createdByUserId, ?)
      WHERE id = ?
    `).run(`ANNULLED::${transaction.notes ?? ""}`, actorUserId, transactionId);

    sqlite.prepare(`
      INSERT INTO "InventoryTransaction" (
        id, type, fromOwnerType, fromCharacterId, fromNpcName, toOwnerType, toCharacterId, toNpcName,
        notes, createdByUserId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      undoTransactionId,
      "TRANSFER",
      transaction.toOwnerType ?? "CHARACTER",
      transaction.toCharacterId ?? null,
      null,
      transaction.fromOwnerType ?? "CHARACTER",
      transaction.fromCharacterId ?? null,
      null,
      `UNDO::${transactionId}`,
      actorUserId,
      now
    );

    sqlite.prepare(`
      INSERT INTO "InventoryTransactionItem" (
        id, transactionId, characterItemId, itemDefinitionId, descriptionSnapshot, quantity
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      undoTransactionId,
      snapshot.mode === "move" ? snapshot.destinationItemId : snapshot.sourceItemId,
      snapshot.itemDefinitionId ?? null,
      itemRow.descriptionSnapshot,
      Number(snapshot.quantity ?? 1)
    );
  });

  return { ok: true };
}

function buildQuickCreateWeaponSlotRules(weaponHandling) {
  if (weaponHandling === "TWO_HANDED") {
    return [
      { groupKey: "hands", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 0 },
      { groupKey: "hands", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 1 },
    ];
  }

  if (weaponHandling === "VERSATILE") {
    return [
      { groupKey: "one-hand", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 0 },
      { groupKey: "one-hand", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 1 },
      { groupKey: "two-hand", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 2 },
      { groupKey: "two-hand", selectionMode: "ALL_REQUIRED", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 3 },
    ];
  }

  return [
    { groupKey: "hands", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_LEFT", required: true, sortOrder: 0 },
    { groupKey: "hands", selectionMode: "ANY_ONE", slot: "WEAPON_HAND_RIGHT", required: true, sortOrder: 1 },
  ];
}

function buildQuickCreateItemDefinitionPayload(raw) {
  const mode = String(raw?.kind ?? "object").trim();
  const name = String(raw?.name ?? "").trim();
  if (!name) {
    throw new Error("Item name required");
  }

  const base = createEmptyItemDefinition(name);
  const description = normalizeNullableString(raw?.description);
  const notes = normalizeNullableString(raw?.notes);
  const mergedDescription = [description, notes].filter(Boolean).join("\n\n") || null;

  if (mode === "weapon") {
    const weaponHandling = String(raw?.weaponHandling ?? "ONE_HANDED").trim() || "ONE_HANDED";
    const attackKind = String(raw?.attackKind ?? "MELEE_WEAPON").trim() || "MELEE_WEAPON";
    const damageDice = normalizeNullableString(raw?.damageDice);
    const damageType = normalizeNullableString(raw?.damageType);
    const attackBonus = normalizeNullableInt(raw?.attackBonus);
    const rangeNormal = normalizeNullableInt(raw?.rangeNormal);
    const rangeLong = normalizeNullableInt(raw?.rangeLong);
    const versatileDamageDice = normalizeNullableString(raw?.versatileDamageDice);

    const attacks = [];
    if (damageDice || damageType || attackBonus != null) {
      attacks.push({
        name,
        kind: attackKind,
        handRequirement: weaponHandling === "TWO_HANDED" ? "TWO_HANDED" : weaponHandling === "VERSATILE" ? "ONE_HANDED" : "ANY",
        attackBonus,
        damageDice,
        damageType,
        rangeNormal,
        rangeLong,
        requiresEquipped: true,
        sortOrder: 0,
      });
    }
    if (weaponHandling === "VERSATILE" && versatileDamageDice) {
      attacks.push({
        name: `${name} (2 mani)`,
        kind: attackKind,
        handRequirement: "TWO_HANDED",
        attackBonus,
        damageDice: versatileDamageDice,
        damageType,
        rangeNormal,
        rangeLong,
        requiresEquipped: true,
        sortOrder: 1,
      });
    }

    return {
      ...base,
      category: "WEAPON",
      description: mergedDescription,
      equippable: true,
      stackable: false,
      weaponHandling,
      slotRules: buildQuickCreateWeaponSlotRules(weaponHandling),
      attacks,
    };
  }

  if (mode === "consumable") {
    const consumableCategory = String(raw?.consumableCategory ?? "CONSUMABLE").trim() || "CONSUMABLE";
    const effectType = normalizeNullableString(raw?.effectType)?.toUpperCase() ?? null;
    const effectDice = normalizeNullableString(raw?.effectDice);
    const effectFlatValue = normalizeNullableInt(raw?.effectFlatValue);
    const useEffects = effectType
      ? [{
          effectType,
          targetType: "CREATURE",
          diceExpression: effectDice,
          flatValue: effectFlatValue,
          damageType: normalizeNullableString(raw?.effectDamageType),
          savingThrowAbility: normalizeNullableString(raw?.savingThrowAbility)?.toUpperCase() ?? null,
          savingThrowDc: normalizeNullableInt(raw?.savingThrowDc),
          successOutcome: normalizeNullableString(raw?.successOutcome)?.toUpperCase() ?? null,
          notes: normalizeNullableString(raw?.effectNotes),
          sortOrder: 0,
        }]
      : [];

    return {
      ...base,
      category: consumableCategory,
      description: mergedDescription,
      equippable: false,
      stackable: true,
      useEffects,
    };
  }

  return {
    ...base,
    category: String(raw?.objectCategory ?? "OTHER").trim() || "OTHER",
    description: mergedDescription,
    equippable: !!raw?.equippable,
    stackable: !!raw?.stackable,
  };
}

function updateCharacterInventoryItem(characterSlug, characterItemId, payload) {
  if (!tableExists("CharacterItem")) {
    throw new Error("Character inventory not available");
  }

  const character = sqlite
    .prepare('SELECT id, slug FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(characterSlug);
  if (!character) {
    throw new Error("Character not found");
  }

    const existing = sqlite.prepare(`
      SELECT
        ci.id,
        ci.characterId,
        ci.itemDefinitionId,
        ci.nameOverride,
        ci.data,
        ci.quantity,
        ci.isEquipped,
        d.name AS itemDefinitionName,
        d.category AS itemDefinitionCategory,
        d.equippable AS itemDefinitionEquippable
      FROM "CharacterItem" ci
      LEFT JOIN "ItemDefinition" d ON d.id = ci.itemDefinitionId
      WHERE ci.id = ? AND ci.characterId = ?
      LIMIT 1
    `).get(characterItemId, character.id);
  if (!existing) {
    throw new Error("Character item not found");
  }

  const quantity = payload?.quantity === undefined ? Number(existing.quantity ?? 1) : Math.max(0, normalizeNullableInt(payload?.quantity) ?? 0);
  const isEquipped = payload?.isEquipped === undefined ? !!existing.isEquipped : !!payload.isEquipped;
  if (isEquipped && !existing.itemDefinitionEquippable) {
    throw new Error("Item is not equippable");
  }
  if (isEquipped && !existing.itemDefinitionId) {
    throw new Error("This item has no catalog definition");
  }

  const featureStatePayload =
    payload?.featureState && typeof payload.featureState === "object"
      ? payload.featureState
      : null;
  const equipConfig =
    payload?.equipConfig && typeof payload.equipConfig === "object"
      ? payload.equipConfig
      : {};
  const nextData =
    payload && Object.prototype.hasOwnProperty.call(payload, "data")
      ? typeof payload?.data === "string"
        ? payload.data
        : payload?.data
          ? JSON.stringify(payload.data)
          : null
      : existing.data ?? null;

  const now = new Date().toISOString();

  runInTransaction(() => {
      if (payload?.isEquipped !== undefined) {
        sqlite.prepare('DELETE FROM "CharacterItemEquip" WHERE characterItemId = ?').run(existing.id);
      }

      if (payload?.isEquipped !== undefined && isEquipped) {
        const itemDefinition = readItemDefinition(existing.itemDefinitionId);
        const occupancy = readCharacterSlotOccupancy(character.id, [existing.id]);
        const options = buildEquipOptionsForItem(itemDefinition, occupancy);
        const selectedOption = chooseEquipOption(existing, itemDefinition, options, equipConfig);
        const requiredSwapIds = new Set(
          selectedOption.conflicts.map((conflict) => String(conflict.itemId))
        );
        const providedSwapIds = new Set(
          (Array.isArray(equipConfig?.swapItemIds) ? equipConfig.swapItemIds : [])
            .map((id) => String(id ?? "").trim())
            .filter(Boolean)
        );

        if (requiredSwapIds.size > 0) {
          const matchesAll = Array.from(requiredSwapIds).every((itemId) => providedSwapIds.has(itemId));
          if (!matchesAll) {
            throw createDetailedError("Conferma quale oggetto sostituire per liberare gli slot", {
              code: "EQUIP_RESOLUTION_REQUIRED",
              mode: "swap",
              itemId: existing.id,
              itemName: existing.nameOverride ?? existing.itemDefinitionName ?? "Oggetto senza nome",
              options: options.filter((option) => option.conflicts.length > 0),
            });
          }

          for (const itemId of requiredSwapIds) {
            sqlite.prepare(`
              UPDATE "CharacterItem"
              SET isEquipped = 0, updatedAt = ?
              WHERE id = ? AND characterId = ?
            `).run(now, itemId, character.id);
            sqlite.prepare('DELETE FROM "CharacterItemEquip" WHERE characterItemId = ?').run(itemId);
          }
        }

        selectedOption.slots.forEach((slot) => {
          sqlite.prepare(`
            INSERT INTO "CharacterItemEquip" (id, characterItemId, slot)
            VALUES (?, ?, ?)
          `).run(crypto.randomUUID(), existing.id, slot);
        });
      }

      sqlite.prepare(`
        UPDATE "CharacterItem"
        SET quantity = ?, isEquipped = ?, data = ?, updatedAt = ?
        WHERE id = ? AND characterId = ?
      `).run(
      quantity,
      isEquipped ? 1 : 0,
      nextData,
      now,
      existing.id,
      character.id
    );

    if (featureStatePayload && tableExists("CharacterItemFeatureState")) {
      const itemFeatureId = String(featureStatePayload.itemFeatureId ?? "").trim();
      if (!itemFeatureId) {
        throw new Error("Item feature required");
      }

      const itemFeature = sqlite
        .prepare(`
          SELECT f.id, f.maxUses
          FROM "ItemFeature" f
          JOIN "CharacterItem" ci ON ci.itemDefinitionId = f.itemDefinitionId
          WHERE f.id = ? AND ci.id = ? AND ci.characterId = ?
          LIMIT 1
        `)
        .get(itemFeatureId, existing.id, character.id);

      if (!itemFeature) {
        throw new Error("Item feature not found");
      }

      const maxUses = itemFeature.maxUses == null ? null : Math.max(0, Number(itemFeature.maxUses));
      const usesSpent = Math.max(
        0,
        Math.min(
          maxUses ?? Number(featureStatePayload.usesSpent ?? 0),
          normalizeNullableInt(featureStatePayload.usesSpent) ?? 0
        )
      );

      const existingState = sqlite
        .prepare(`
          SELECT id
          FROM "CharacterItemFeatureState"
          WHERE characterItemId = ? AND itemFeatureId = ?
          LIMIT 1
        `)
        .get(existing.id, itemFeatureId);

      if (existingState) {
        sqlite.prepare(`
          UPDATE "CharacterItemFeatureState"
          SET usesSpent = ?, updatedAt = ?
          WHERE id = ?
        `).run(usesSpent, now, existingState.id);
      } else {
        sqlite.prepare(`
          INSERT INTO "CharacterItemFeatureState" (
            id, characterItemId, itemFeatureId, usesSpent, lastResetAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), existing.id, itemFeatureId, usesSpent, null, now);
      }
    }
  });

  return readCharacterInventoryItemsBySlug(characterSlug)?.find((item) => item.id === existing.id) ?? null;
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

function getChatConversationByLegacyCharacterId(characterId) {
  if (!characterId) return null;
  return sqlite.prepare(`
    SELECT id, kind, title, legacyCharacterId, createdByUserId, createdAt, updatedAt
    FROM "ChatConversation"
    WHERE legacyCharacterId = ?
    LIMIT 1
  `).get(characterId);
}

function ensureCharacterParticipantInConversation(conversationId, characterId, createdAt = new Date().toISOString()) {
  if (!conversationId || !characterId) return;
  sqlite.prepare(`
    INSERT OR IGNORE INTO "ChatConversationParticipant" (
      id, conversationId, userId, characterId, createdAt
    ) VALUES (?, ?, NULL, ?, ?)
  `).run(crypto.randomUUID(), conversationId, characterId, createdAt);
}

function getOrCreateLegacyCharacterChatConversation(slug, createdByUserId = null) {
  const character = getCharacterRecordBySlug(slug);
  if (!character) return null;

  const existingConversation = getChatConversationByLegacyCharacterId(character.id);
  if (existingConversation) {
    ensureCharacterParticipantInConversation(
      existingConversation.id,
      character.id,
      existingConversation.createdAt ?? new Date().toISOString()
    );
    return {
      id: existingConversation.id,
      legacyCharacterId: character.id,
      slug: character.slug,
      name: character.name,
    };
  }

  const conversationId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  runInTransaction(() => {
    sqlite.prepare(`
      INSERT INTO "ChatConversation" (
        id, kind, title, legacyCharacterId, createdByUserId, createdAt, updatedAt
      ) VALUES (?, 'DIRECT', NULL, ?, ?, ?, ?)
    `).run(conversationId, character.id, createdByUserId ?? null, timestamp, timestamp);
    ensureCharacterParticipantInConversation(conversationId, character.id, timestamp);
  });

  return {
    id: conversationId,
    legacyCharacterId: character.id,
    slug: character.slug,
    name: character.name,
  };
}

function readLegacyCharacterChatMessages(slug) {
  const conversation = getOrCreateLegacyCharacterChatConversation(slug);
  if (!conversation) return [];

  return sqlite.prepare(`
    SELECT
      m.id,
      ? AS slug,
      m.senderUserId,
      m.senderRole,
      COALESCE(sc.name, u.displayName, u.username, CASE
        WHEN m.senderRole = 'DM' THEN 'DM'
        WHEN m.senderRole = 'PLAYER' THEN 'Player'
        ELSE 'System'
      END) AS senderName,
      m.text,
      m.createdAt
    FROM "ChatConversationMessage" m
    LEFT JOIN "User" u ON u.id = m.senderUserId
    LEFT JOIN "Character" sc ON sc.id = m.senderCharacterId
    WHERE m.conversationId = ?
    ORDER BY m.createdAt ASC
  `).all(conversation.slug, conversation.id).map((row) => ({
    id: row.id,
    slug: row.slug,
    senderUserId: row.senderUserId,
    senderRole: String(row.senderRole ?? "").toLowerCase(),
    senderName: row.senderName,
    text: row.text,
    createdAt: row.createdAt,
  }));
}

function appendLegacyCharacterChatMessage(slug, user, text) {
  const conversation = getOrCreateLegacyCharacterChatConversation(slug, user?.id ?? null);
  if (!conversation) return null;

  const senderRole = user?.role === "dm" ? "DM" : "PLAYER";
  const senderCharacterId = senderRole === "PLAYER" ? conversation.legacyCharacterId : null;
  const createdAt = new Date().toISOString();
  const nextMessage = {
    id: crypto.randomUUID(),
    slug: conversation.slug,
    senderUserId: user?.id ?? null,
    senderRole: senderRole.toLowerCase(),
    senderName:
      senderRole === "DM"
        ? (user?.displayName ?? user?.username ?? "DM")
        : (conversation.name ?? user?.displayName ?? user?.username ?? "Player"),
    text,
    createdAt,
  };

  sqlite.prepare(`
    INSERT INTO "ChatConversationMessage" (
      id, conversationId, senderUserId, senderCharacterId, senderRole, text, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    nextMessage.id,
    conversation.id,
    nextMessage.senderUserId,
    senderCharacterId,
    senderRole,
    nextMessage.text,
    nextMessage.createdAt
  );

  sqlite.prepare(`
    UPDATE "ChatConversation"
    SET updatedAt = ?
    WHERE id = ?
  `).run(nextMessage.createdAt, conversation.id);

  return {
    ...nextMessage,
    conversationId: conversation.id,
  };
}

function deleteLegacyCharacterChatConversation(slug) {
  const character = getCharacterRecordBySlug(slug);
  if (!character) return;

  sqlite.prepare(`
    DELETE FROM "ChatConversation"
    WHERE legacyCharacterId = ?
  `).run(character.id);
}

function listOwnedCharacterSlugsForUser(user, ownership) {
  if (!user || user.role === "dm") return [];
  return Object.entries(ownership)
    .filter(([_slug, ownerUserId]) => ownerUserId === user.id)
    .map(([slug]) => slug);
}

function listChatContactsForUser(user, ownership) {
  const ownedSlugs = new Set(listOwnedCharacterSlugsForUser(user, ownership));
  return listCharacters()
    .filter((character) => character?.characterType === "pg")
    .filter((character) => user?.role === "dm" || !ownedSlugs.has(character.slug))
    .map((character) => ({
      slug: character.slug,
      name: character.basicInfo?.characterName ?? character.slug,
      portraitUrl: character.basicInfo?.portraitUrl ?? "",
      ownerUserId: ownership[character.slug] ?? null,
    }));
}

function listConversationCharacterParticipants(conversationId) {
  return sqlite.prepare(`
    SELECT
      c.id,
      c.slug,
      c.name,
      c.ownerUserId,
      c.portraitUrl
    FROM "ChatConversationParticipant" p
    JOIN "Character" c ON c.id = p.characterId
    WHERE p.conversationId = ?
      AND p.characterId IS NOT NULL
      AND c.archivedAt IS NULL
    ORDER BY c.name COLLATE NOCASE, c.slug COLLATE NOCASE
  `).all(conversationId).map((row) => ({
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? row.slug ?? ""),
    ownerUserId: row.ownerUserId ?? null,
    portraitUrl: row.portraitUrl ?? "",
  }));
}

function canAccessConversation(user, conversationId, ownership) {
  if (!user) return false;
  if (user.role === "dm") return true;
  const participants = listConversationCharacterParticipants(conversationId);
  return participants.some((participant) => ownership[participant.slug] === user.id);
}

function getCanonicalDirectConversationId(slugA, slugB) {
  const ordered = [String(slugA ?? "").trim(), String(slugB ?? "").trim()]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  if (ordered.length !== 2 || ordered[0] === ordered[1]) return null;
  return `direct:${ordered[0]}::${ordered[1]}`;
}

function getConversationRowById(conversationId) {
  if (!conversationId) return null;
  return sqlite.prepare(`
    SELECT id, kind, title, legacyCharacterId, createdByUserId, createdAt, updatedAt
    FROM "ChatConversation"
    WHERE id = ?
    LIMIT 1
  `).get(conversationId);
}

function buildConversationSummary(conversationId) {
  const row = getConversationRowById(conversationId);
  if (!row) return null;
  const participants = listConversationCharacterParticipants(conversationId);
  if (participants.length === 0) return null;
  return {
    id: String(row.id),
    kind: row.legacyCharacterId ? "dm-player" : "player-player",
    updatedAt: row.updatedAt,
    participants: participants.map((participant) => ({
      slug: participant.slug,
      name: participant.name,
      portraitUrl: participant.portraitUrl ?? "",
    })),
  };
}

function getOrCreateCanonicalDirectConversation(slugA, slugB, createdByUserId = null) {
  const conversationId = getCanonicalDirectConversationId(slugA, slugB);
  if (!conversationId) return null;

  const participants = [slugA, slugB]
    .map((slug) => getCharacterRecordBySlug(slug))
    .filter((character) => !!character && String(character.characterType).toUpperCase() === "PG");

  if (participants.length !== 2) return null;

  const existingConversation = getConversationRowById(conversationId);
  if (!existingConversation) {
    const timestamp = new Date().toISOString();
    runInTransaction(() => {
      sqlite.prepare(`
        INSERT INTO "ChatConversation" (
          id, kind, title, legacyCharacterId, createdByUserId, createdAt, updatedAt
        ) VALUES (?, 'DIRECT', NULL, NULL, ?, ?, ?)
      `).run(conversationId, createdByUserId ?? null, timestamp, timestamp);

      for (const participant of participants) {
        ensureCharacterParticipantInConversation(conversationId, participant.id, timestamp);
      }
    });
  } else {
    for (const participant of participants) {
      ensureCharacterParticipantInConversation(
        conversationId,
        participant.id,
        existingConversation.createdAt ?? new Date().toISOString()
      );
    }
  }

  return buildConversationSummary(conversationId);
}

function listAccessiblePlayerConversations(user, ownership) {
  const allRows = sqlite.prepare(`
    SELECT id
    FROM "ChatConversation"
    ORDER BY updatedAt DESC, createdAt DESC
  `).all();

  return allRows
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean)
    .filter((conversationId) => canAccessConversation(user, conversationId, ownership))
    .map((conversationId) => buildConversationSummary(conversationId))
    .filter(Boolean);
}

function readConversationMessages(conversationId) {
  return sqlite.prepare(`
    SELECT
      m.id,
      m.conversationId,
      m.senderUserId,
      m.senderRole,
      m.text,
      m.createdAt,
      sc.slug AS senderCharacterSlug,
      sc.name AS senderCharacterName,
      COALESCE(sc.name, u.displayName, u.username, CASE
        WHEN m.senderRole = 'DM' THEN 'DM'
        WHEN m.senderRole = 'PLAYER' THEN 'Player'
        ELSE 'System'
      END) AS senderName
    FROM "ChatConversationMessage" m
    LEFT JOIN "User" u ON u.id = m.senderUserId
    LEFT JOIN "Character" sc ON sc.id = m.senderCharacterId
    WHERE m.conversationId = ?
    ORDER BY m.createdAt ASC
  `).all(conversationId).map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    senderUserId: row.senderUserId,
    senderRole: String(row.senderRole ?? "").toLowerCase(),
    senderName: row.senderName,
    senderCharacterSlug: row.senderCharacterSlug ?? null,
    senderCharacterName: row.senderCharacterName ?? null,
    text: row.text,
    createdAt: row.createdAt,
  }));
}

function appendConversationMessage(conversationId, user, text, ownership) {
  const conversation = getConversationRowById(conversationId);
  if (!conversation || !text?.trim() || !user || !canAccessConversation(user, conversationId, ownership)) {
    return null;
  }

  const participants = listConversationCharacterParticipants(conversationId);
  let senderCharacter = null;
  let senderName = user.displayName ?? user.username ?? "DM";
  const senderRole = user.role === "dm" ? "DM" : "PLAYER";

  if (senderRole === "PLAYER") {
    senderCharacter = participants.find((participant) => ownership[participant.slug] === user.id) ?? null;
    if (!senderCharacter) return null;
    senderName = senderCharacter.name;
  }

  const nextMessage = {
    id: crypto.randomUUID(),
    conversationId,
    senderUserId: user.id,
    senderRole: senderRole.toLowerCase(),
    senderName,
    senderCharacterSlug: senderCharacter?.slug ?? null,
    senderCharacterName: senderCharacter?.name ?? null,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  runInTransaction(() => {
    sqlite.prepare(`
      INSERT INTO "ChatConversationMessage" (
        id, conversationId, senderUserId, senderCharacterId, senderRole, text, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      nextMessage.id,
      nextMessage.conversationId,
      nextMessage.senderUserId,
      senderCharacter?.id ?? null,
      senderRole,
      nextMessage.text,
      nextMessage.createdAt
    );

    sqlite.prepare(`
      UPDATE "ChatConversation"
      SET updatedAt = ?
      WHERE id = ?
    `).run(nextMessage.createdAt, conversationId);
  });

  return nextMessage;
}

function listConversationRecipientUserIds(conversationId) {
  const participantUserIds = listConversationCharacterParticipants(conversationId)
    .map((participant) => participant.ownerUserId)
    .filter((userId) => !!userId);
  const dmUserIds = sqlite.prepare(`
    SELECT id
    FROM "User"
    WHERE role = 'DM'
  `).all().map((row) => String(row.id ?? "").trim()).filter(Boolean);

  return Array.from(new Set([...participantUserIds, ...dmUserIds]));
}

function emptyInitiativeTrackerState() {
  return {
    players: [],
    monsters: [],
    started: false,
    round: 1,
    currentTurnId: null,
    nextSortOrder: 1,
    revealedCombatantIds: [],
    updatedAt: null,
  };
}

function normalizeInitiativeTrackerState(raw) {
  const base = emptyInitiativeTrackerState();
  const state = raw && typeof raw === "object" ? raw : {};

  return {
    players: Array.isArray(state.players)
      ? state.players
          .map((entry) => ({
            id: typeof entry?.id === "string" ? entry.id : "",
            type: "player",
            slug: typeof entry?.slug === "string" ? entry.slug : "",
            initiativeRoll: Number.isFinite(Number(entry?.initiativeRoll)) ? Number(entry.initiativeRoll) : 0,
            initiative: Number.isFinite(Number(entry?.initiative)) ? Number(entry.initiative) : 0,
            statuses: Array.isArray(entry?.statuses) ? entry.statuses.filter((value) => typeof value === "string") : [],
            sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : 0,
          }))
          .filter((entry) => entry.id && entry.slug)
      : base.players,
    monsters: Array.isArray(state.monsters)
      ? state.monsters
          .map((entry) => ({
            id: typeof entry?.id === "string" ? entry.id : "",
            type: "monster",
            name: typeof entry?.name === "string" ? entry.name : "Mostro",
            initiative: Number.isFinite(Number(entry?.initiative)) ? Number(entry.initiative) : 0,
            armorClass: Number.isFinite(Number(entry?.armorClass)) ? Number(entry.armorClass) : 0,
            currentHitPoints: Number.isFinite(Number(entry?.currentHitPoints)) ? Number(entry.currentHitPoints) : 0,
            maxHitPoints: Number.isFinite(Number(entry?.maxHitPoints)) ? Number(entry.maxHitPoints) : 0,
            statuses: Array.isArray(entry?.statuses) ? entry.statuses.filter((value) => typeof value === "string") : [],
            sortOrder: Number.isFinite(Number(entry?.sortOrder)) ? Number(entry.sortOrder) : 0,
            source: entry?.source === "bestiary" ? "bestiary" : "custom",
            sourceMonsterId: typeof entry?.sourceMonsterId === "string" ? entry.sourceMonsterId : null,
            powerTag:
              entry?.powerTag === "debolissimo" ||
              entry?.powerTag === "debole" ||
              entry?.powerTag === "forte" ||
              entry?.powerTag === "fortissimo"
                ? entry.powerTag
                : null,
          }))
          .filter((entry) => entry.id)
      : base.monsters,
    started: !!state.started,
    round: Number.isFinite(Number(state.round)) && Number(state.round) > 0 ? Number(state.round) : 1,
    currentTurnId: typeof state.currentTurnId === "string" ? state.currentTurnId : null,
    nextSortOrder:
      Number.isFinite(Number(state.nextSortOrder)) && Number(state.nextSortOrder) > 0
        ? Number(state.nextSortOrder)
        : 1,
    revealedCombatantIds: Array.isArray(state.revealedCombatantIds)
      ? state.revealedCombatantIds.filter((value) => typeof value === "string")
      : [],
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : null,
  };
}

function readInitiativeTrackerState() {
  try {
    if (!fs.existsSync(INITIATIVE_TRACKER_FILE)) return emptyInitiativeTrackerState();
    const raw = fs.readFileSync(INITIATIVE_TRACKER_FILE, "utf8");
    return normalizeInitiativeTrackerState(JSON.parse(raw));
  } catch {
    return emptyInitiativeTrackerState();
  }
}

function writeInitiativeTrackerState(state) {
  const normalized = normalizeInitiativeTrackerState({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(INITIATIVE_TRACKER_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

function compareInitiativeEntries(a, b) {
  if (b.initiative !== a.initiative) return b.initiative - a.initiative;
  return a.sortOrder - b.sortOrder;
}

function initiativeHealthTone(currentHitPoints, maxHitPoints) {
  const current = Math.max(0, Number(currentHitPoints ?? 0) || 0);
  const max = Math.max(1, Number(maxHitPoints ?? 0) || 1);
  const pct = (current / max) * 100;

  if (current <= 0) return "down";
  if (pct <= 25) return "critical";
  if (pct <= 50) return "wounded";
  return "healthy";
}

function buildInitiativeCombatants(state) {
  const normalized = normalizeInitiativeTrackerState(state);

  const players = normalized.players.map((entry) => {
    const character = readCharacter(entry.slug);
    const currentHitPoints = Math.max(0, Number(character?.combatStats?.currentHitPoints ?? 0) || 0);
    const maxHitPoints = Math.max(1, Number(character?.combatStats?.hitPointMaximum ?? 0) || 1);
    const name =
      typeof character?.basicInfo?.characterName === "string" && character.basicInfo.characterName.trim()
        ? character.basicInfo.characterName.trim()
        : entry.slug;
    const deathSaves = {
      successes: Math.max(0, Math.min(3, Number(character?.combatStats?.deathSaves?.successes ?? 0) || 0)),
      failures: Math.max(0, Math.min(3, Number(character?.combatStats?.deathSaves?.failures ?? 0) || 0)),
    };

    return {
      id: entry.id,
      type: "player",
      slug: entry.slug,
      name,
      initiative: entry.initiative,
      sortOrder: entry.sortOrder,
      statuses: entry.statuses,
      currentHitPoints,
      maxHitPoints,
      sourceMonsterId: null,
      deathSaves,
    };
  });

  const monsters = normalized.monsters.map((entry) => ({
    id: entry.id,
    type: "monster",
    name: entry.name,
    initiative: entry.initiative,
    sortOrder: entry.sortOrder,
    statuses: entry.statuses,
    currentHitPoints: Math.max(0, Number(entry.currentHitPoints ?? 0) || 0),
    maxHitPoints: Math.max(1, Number(entry.maxHitPoints ?? 0) || 1),
    sourceMonsterId: entry.source === "bestiary" ? entry.sourceMonsterId : null,
    deathSaves: null,
  }));

  return [...players, ...monsters].sort(compareInitiativeEntries);
}

function buildPlayerInitiativeTrackerView(state, slug) {
  const normalized = normalizeInitiativeTrackerState(state);
  const ownsSeat = normalized.players.some((entry) => entry.slug === slug);
  const visible = normalized.started && ownsSeat;

  if (!visible) {
    return {
      slug,
      visible: false,
      started: false,
      round: 1,
      currentTurnId: null,
      entries: [],
      updatedAt: normalized.updatedAt,
    };
  }

  const revealed = new Set(normalized.revealedCombatantIds);
  const entries = buildInitiativeCombatants(normalized)
    .filter((entry) => revealed.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      type: entry.type,
      name: entry.name,
      initiative: entry.initiative,
      sortOrder: entry.sortOrder,
      statuses: entry.statuses,
      healthTone: initiativeHealthTone(entry.currentHitPoints, entry.maxHitPoints),
      isCurrentTurn: entry.id === normalized.currentTurnId,
      sourceMonsterId: entry.type === "monster" ? entry.sourceMonsterId ?? null : null,
      knowledgeState:
        entry.type === "monster" && entry.sourceMonsterId
          ? readMonsterCompendiumKnowledgeState(entry.sourceMonsterId)
          : null,
      deathSaves: entry.type === "player" ? entry.deathSaves ?? null : null,
    }));

  return {
    slug,
    visible: true,
    started: normalized.started,
    round: normalized.round,
    currentTurnId: normalized.currentTurnId,
    entries,
    updatedAt: normalized.updatedAt,
  };
}

function broadcastInitiativeTrackerState(io, providedState = null) {
  const normalized = normalizeInitiativeTrackerState(providedState ?? readInitiativeTrackerState());
  io.to("initiative:dm").emit("initiative:state", normalized);

  const ownership = readOwnership();
  for (const [slug, ownerUserId] of Object.entries(ownership)) {
    if (!ownerUserId) continue;
    io.to(`user:${ownerUserId}`).emit("initiative:player-state", buildPlayerInitiativeTrackerView(normalized, slug));
  }
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
  const normalizedType = normalizeMonsterTypeFields({
    creatureType: general?.creatureType ?? "",
    subtype: general?.subtype ?? "",
    typeLabel: general?.typeLabel ?? "",
  });
  const normalizedChallengeRating = {
    fraction: String(challengeRating?.fraction ?? challengeRating?.display ?? ""),
    decimal: typeof challengeRating?.decimal === "number" ? challengeRating.decimal : null,
    display: String(challengeRating?.display ?? challengeRating?.fraction ?? ""),
    xp: typeof challengeRating?.xp === "number" ? challengeRating.xp : 0,
  };
  const computedRarity = computeMonsterRarity({
    creatureType: normalizedType.creatureType,
    challengeRating: normalizedChallengeRating,
  });
  const explicitRarity = typeof data?.rarity === "string" ? data.rarity.trim() : "";
  const rarity = explicitRarity || computedRarity;

  return {
    id: fileId,
    filePath: relativePath,
    slug: typeof data?.slug === "string" ? data.slug : sanitizeSlug(general?.name ?? path.basename(relativePath, ".json")),
    rarity,
    general: {
      name: String(general?.name ?? path.basename(relativePath, ".json")),
      challengeRating: normalizedChallengeRating,
      size: String(general?.size ?? ""),
      creatureType: normalizedType.creatureType,
      subtype: normalizedType.subtype,
      typeLabel: normalizedType.typeLabel,
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
  const hasArchivedAt = columnExists("Monster", "archivedAt");
  const row = sqlite
    .prepare(`SELECT * FROM "Monster" WHERE sourceFile = ? ${hasArchivedAt ? 'AND archivedAt IS NULL' : ""} LIMIT 1`)
    .get(relativePath);
  return enrichMonsterWithDiscovery(normalizeMonsterDbRow(row));
}

function listMonsters() {
  const discoveryRules = readMonsterDiscoveryRules();
  const hasArchivedAt = columnExists("Monster", "archivedAt");
  return sqlite
    .prepare(`SELECT * FROM "Monster" ${hasArchivedAt ? 'WHERE archivedAt IS NULL' : ""} ORDER BY name COLLATE NOCASE`)
    .all()
    .map(normalizeMonsterDbRow)
    .filter(Boolean)
    .map((monster) => enrichMonsterWithDiscovery(monster, discoveryRules));
}

function summarizeMonsterSpeed(speed = {}) {
  const speedLabels = {
    walk: "Camminare",
    fly: "Volare",
    swim: "Nuotare",
    climb: "Scalare",
    burrow: "Scavare",
  };

  return ["walk", "fly", "swim", "climb", "burrow"]
    .filter((key) => speed[key])
    .map((key) => `${speedLabels[key]} ${speed[key]}`)
    .join(", ");
}

function qualitativeAbilityLabel(score) {
  if (score <= 5) return "Molto bassa";
  if (score <= 9) return "Bassa";
  if (score <= 11) return "Nella media";
  if (score <= 15) return "Alta";
  if (score <= 19) return "Molto alta";
  return "Eccezionale";
}

function signedAbilityModifier(score) {
  const modifier = Math.floor((Number(score) - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

function fullAbilityLabel(score) {
  return `${score} (${signedAbilityModifier(score)})`;
}

function readKnownMonsterCompendiumStateById() {
  if (!tableExists("MonsterCompendiumEntry")) {
    return new Map();
  }

  return new Map(
    sqlite
      .prepare(`
        SELECT monsterId, knowledgeState
        FROM "MonsterCompendiumEntry"
        WHERE knowledgeState IS NOT NULL
          AND knowledgeState <> 'UNKNOWN'
      `)
      .all()
      .map((row) => [row.monsterId, row.knowledgeState])
  );
}

function buildPlayerCompendiumBasicSummary(monster, knowledgeState = "BASIC") {
  const isComplete = knowledgeState === "COMPLETE";

  return {
    id: monster.id,
    knowledgeState,
    name: monster.general.name,
    size: monster.general.size,
    typeLabel: monster.general.typeLabel || monster.general.creatureType,
    armorClass: monster.combat.armorClass.value,
    hitPointsAverage: monster.combat.hitPoints.average,
    speedLabel: summarizeMonsterSpeed(monster.combat.speed),
    strengthScore: monster.abilities.strength,
    dexterityScore: monster.abilities.dexterity,
    constitutionScore: monster.abilities.constitution,
    intelligenceScore: monster.abilities.intelligence,
    wisdomScore: monster.abilities.wisdom,
    charismaScore: monster.abilities.charisma,
    strengthDisplay: isComplete ? fullAbilityLabel(monster.abilities.strength) : qualitativeAbilityLabel(monster.abilities.strength),
    dexterityDisplay: isComplete ? fullAbilityLabel(monster.abilities.dexterity) : qualitativeAbilityLabel(monster.abilities.dexterity),
    constitutionDisplay: isComplete ? fullAbilityLabel(monster.abilities.constitution) : qualitativeAbilityLabel(monster.abilities.constitution),
    intelligenceDisplay: isComplete ? fullAbilityLabel(monster.abilities.intelligence) : null,
    wisdomDisplay: isComplete ? fullAbilityLabel(monster.abilities.wisdom) : null,
    charismaDisplay: isComplete ? fullAbilityLabel(monster.abilities.charisma) : null,
  };
}

function readMonsterCompendiumKnowledgeState(monsterId) {
  if (!tableExists("MonsterCompendiumEntry")) {
    return "UNKNOWN";
  }

  return (
    sqlite
      .prepare(`
        SELECT knowledgeState
        FROM "MonsterCompendiumEntry"
        WHERE monsterId = ?
        LIMIT 1
      `)
      .get(monsterId)?.knowledgeState ?? "UNKNOWN"
  );
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

function serializeMonsterData(monster) {
  return JSON.stringify({
    slug: monster.slug || sanitizeSlug(monster.general?.name || "monster"),
    general: monster.general,
    combat: monster.combat,
    abilities: monster.abilities,
    details: monster.details,
    traits: monster.traits,
    actions: monster.actions,
    bonusActions: monster.bonusActions,
    reactions: monster.reactions,
    legendaryActions: monster.legendaryActions,
    lairActions: monster.lairActions,
    regionalEffects: monster.regionalEffects,
    notes: monster.notes,
    source: monster.source,
  });
}

function ensureMonsterCompendiumEntry(monsterId, now = new Date().toISOString()) {
  if (!tableExists("MonsterCompendiumEntry")) return;
  sqlite.prepare(`
    INSERT OR IGNORE INTO "MonsterCompendiumEntry" (
      monsterId, knowledgeState, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?)
  `).run(
    monsterId,
    "UNKNOWN",
    now,
    now
  );
}

function importMonsterFromJsonPayload(payload, targetMonsterId = null) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Monster payload required");
  }

  if (targetMonsterId) {
    const relativePath = decodeMonsterId(targetMonsterId);
    if (!relativePath) {
      throw new Error("Invalid target monster id");
    }

    const currentMonster = readMonsterByRelativePath(relativePath);
    if (!currentMonster) {
      throw new Error("Target monster not found");
    }

    const nextMonster = normalizeMonsterRecord(payload, currentMonster.id, relativePath);
    if (!nextMonster.general.name.trim()) {
      throw new Error("Monster name required");
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
        rarity = ?,
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
      nextMonster.rarity || null,
      nextMonster.general.alignment || null,
      serializeMonsterData(nextMonster),
      new Date().toISOString(),
      nextMonster.id
    );

    return readMonsterByRelativePath(relativePath);
  }

  const name = String(payload?.general?.name ?? payload?.name ?? "").trim();
  if (!name) {
    throw new Error("Monster name required");
  }

  const fileName = createUniqueMonsterFileName(payload?.slug || name);
  const relativePath = `custom/${fileName}`;
  const monsterId = encodeMonsterId(relativePath);
  const nextMonster = normalizeMonsterRecord(payload, monsterId, relativePath);
  const now = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO "Monster" (
      id, slug, name, sourceType, sourceFile, challengeRatingDisplay, challengeRatingDecimal,
      challengeRatingXp, size, creatureType, rarity, alignment, data, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    nextMonster.rarity || null,
    nextMonster.general.alignment || null,
    serializeMonsterData(nextMonster),
    now,
    now
  );

  ensureMonsterCompendiumEntry(monsterId, now);
  return readMonsterByRelativePath(relativePath);
}

function listCharacterSlugs() {
  ensureSqliteConnectionFresh();
  return sqlite
    .prepare('SELECT slug FROM "Character" WHERE archivedAt IS NULL ORDER BY slug COLLATE NOCASE')
    .all()
    .map((row) => row.slug);
}

function readCharacter(slug) {
  ensureSqliteConnectionFresh();
  const row = sqlite
    .prepare('SELECT * FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(slug);
  return normalizeCharacterRow(row);
}

function listCharacters() {
  ensureSqliteConnectionFresh();
  return sqlite
    .prepare('SELECT * FROM "Character" WHERE archivedAt IS NULL ORDER BY name COLLATE NOCASE')
    .all()
    .map(normalizeCharacterRow)
    .filter(Boolean);
}

function listCharacterTransferTargets() {
  ensureSqliteConnectionFresh();
  return sqlite
    .prepare('SELECT slug, name, characterType FROM "Character" WHERE archivedAt IS NULL AND characterType = \'PG\' ORDER BY name COLLATE NOCASE')
    .all()
    .map((row) => ({
      slug: row.slug,
      characterType: "pg",
      basicInfo: {
        characterName: row.name,
      },
    }));
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
  ensureCharacterCurrencyBalanceForCharacter(payload.id);
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

function shouldUseSecureSessionCookie(req) {
  const override = String(process.env.SESSION_COOKIE_SECURE ?? "").trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;
  if (!isProd) return false;

  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase());

  return req?.secure || forwardedProto.includes("https");
}

function serializeSessionCookie(value, req) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (shouldUseSecureSessionCookie(req)) parts.push("Secure");
  return parts.join("; ");
}

function serializeExpiredSessionCookie(req) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (shouldUseSecureSessionCookie(req)) parts.push("Secure");
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

  app.get("/api/game-session", requireAuth, (_req, res) => {
    return res.json(readGameSessionState());
  });

  app.put("/api/game-session", requireRole("dm"), (req, res) => {
    const nextIsOpen = !!req.body?.isOpen;
    const nextState = writeGameSessionState(nextIsOpen, req.user?.id ?? null);
    io.emit("game-session:state", nextState);
    return res.json(nextState);
  });

  app.get("/api/dm-notes/tree", requireRole("dm"), (_req, res) => {
    if (!fs.existsSync(DM_NOTES_ROOT)) {
      return res.status(404).json({ error: "La cartella degli appunti del DM non esiste." });
    }

    return res.json({
      rootName: path.basename(DM_NOTES_ROOT),
      entries: buildDmNotesTree(DM_NOTES_ROOT),
    });
  });

  app.get("/api/dm-notes/document", requireRole("dm"), (req, res) => {
    const resolvedPath = resolveDmNotesPath(req.query?.path);
    if (!resolvedPath || !fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return res.status(404).json({ error: "Documento non trovato." });
    }

    const fileType = getDmNotesFileType(resolvedPath);
    if (fileType !== "markdown") {
      return res.status(400).json({ error: "Questo endpoint supporta soltanto documenti Markdown." });
    }

    try {
      const stat = fs.statSync(resolvedPath);
      const content = fs.readFileSync(resolvedPath, "utf8");
      return res.json({
        name: path.basename(resolvedPath),
        path: path.relative(DM_NOTES_ROOT, resolvedPath).replace(/\\/g, "/"),
        fileType,
        updatedAt: stat.mtime.toISOString(),
        size: stat.size,
        content,
      });
    } catch {
      return res.status(500).json({ error: "Impossibile leggere il documento richiesto." });
    }
  });

  app.get("/api/dm-notes/asset", requireRole("dm"), (req, res) => {
    const resolvedPath = resolveDmNotesPath(req.query?.path);
    if (!resolvedPath || !fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return res.status(404).json({ error: "Risorsa non trovata." });
    }

    const fileType = getDmNotesFileType(resolvedPath);
    if (fileType !== "image" && fileType !== "pdf") {
      return res.status(400).json({ error: "Risorsa non supportata." });
    }

    return res.sendFile(resolvedPath);
  });

  app.get("/api/preferences/character-sheet-layout", requireAuth, (req, res) => {
    const preference = readUserLayoutPreference(req.user.id, CHARACTER_SHEET_LAYOUT_KEY);
    return res.json({
      layoutKey: CHARACTER_SHEET_LAYOUT_KEY,
      entries: preference?.entries ?? [],
    });
  });

  app.put("/api/preferences/character-sheet-layout", requireAuth, (req, res) => {
    if (rejectIfSessionClosedForPlayer(res, req.user)) return;
    const entries = normalizeCharacterSheetLayoutEntries(req.body?.entries);
    const preference = upsertUserLayoutPreference(req.user.id, CHARACTER_SHEET_LAYOUT_KEY, entries);
    return res.json({
      layoutKey: CHARACTER_SHEET_LAYOUT_KEY,
      entries: preference?.entries ?? [],
    });
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
    res.setHeader("Set-Cookie", serializeSessionCookie(sessionId, req));
    return res.json(sanitizeUser(user, readOwnership()));
  });

  app.post("/api/auth/logout", (req, res) => {
    if (req.sessionId) deleteSessionById(req.sessionId);
    res.setHeader("Set-Cookie", serializeExpiredSessionCookie(req));
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
    res.setHeader("Set-Cookie", serializeSessionCookie(sessionId, req));
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

  app.get("/api/chat/contacts", requireAuth, (req, res) => {
    const ownership = readOwnership();
    return res.json(listChatContactsForUser(req.user, ownership));
  });

  app.get("/api/chat/conversations", requireAuth, (req, res) => {
    const ownership = readOwnership();
    return res.json(listAccessiblePlayerConversations(req.user, ownership));
  });

  app.post("/api/chat/conversations/direct", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const sourceSlug = typeof req.body?.sourceSlug === "string" ? req.body.sourceSlug.trim() : "";
    const targetSlug = typeof req.body?.targetSlug === "string" ? req.body.targetSlug.trim() : "";

    if (!sourceSlug || !targetSlug || sourceSlug === targetSlug) {
      return res.status(400).json({ error: "Direct conversation requires two distinct characters." });
    }

    if (req.user?.role !== "dm" && ownership[sourceSlug] !== req.user?.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const conversation = getOrCreateCanonicalDirectConversation(sourceSlug, targetSlug, req.user?.id ?? null);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation target not found." });
    }

    if (!canAccessConversation(req.user, conversation.id, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.status(201).json(conversation);
  });

  app.post("/api/chat/conversations/dm", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";

    if (!slug) {
      return res.status(400).json({ error: "Character slug required." });
    }

    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const conversation = buildConversationSummary(
      getOrCreateLegacyCharacterChatConversation(slug, req.user?.id ?? null)?.id
    );
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    return res.status(201).json(conversation);
  });

  app.get("/api/chat/conversations/:conversationId", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const conversationId = String(req.params.conversationId ?? "").trim();
    if (!conversationId || !canAccessConversation(req.user, conversationId, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const conversation = buildConversationSummary(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json(conversation);
  });

  app.get("/api/chat/conversations/:conversationId/messages", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const conversationId = String(req.params.conversationId ?? "").trim();
    if (!conversationId || !canAccessConversation(req.user, conversationId, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const conversation = buildConversationSummary(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json(readConversationMessages(conversationId));
  });

  app.get("/api/initiative-tracker", requireRole("dm"), (_req, res) => {
    return res.json(readInitiativeTrackerState());
  });

  app.put("/api/initiative-tracker", requireRole("dm"), (req, res) => {
    const nextState = writeInitiativeTrackerState(req.body);
    broadcastInitiativeTrackerState(io, nextState);
    return res.json(nextState);
  });

  app.get("/api/characters/:slug/initiative-tracker", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(buildPlayerInitiativeTrackerView(readInitiativeTrackerState(), slug));
  });

  // ===== Item definitions =====
  app.get("/api/items", requireAuth, (req, res) => {
    const items = readItemDefinitions();
    if (req.user?.role === "dm") {
      return res.json(items);
    }
    const assignedUniqueIds = tableExists("CharacterItem")
      ? new Set(
          sqlite
            .prepare(`
              SELECT DISTINCT itemDefinitionId
              FROM "CharacterItem"
              WHERE itemDefinitionId IS NOT NULL
            `)
            .all()
            .map((row) => String(row.itemDefinitionId))
        )
      : new Set();
    return res.json(
      items.filter((item) => {
        if (!item.playerVisible) return false;
        if (String(item.rarity ?? "").toUpperCase() !== "UNIQUE") return true;
        return !assignedUniqueIds.has(String(item.id));
      })
    );
  });

  app.get("/api/items/:itemId", requireAuth, (req, res) => {
    const item = readItemDefinition(req.params.itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    if (
      req.user?.role !== "dm" &&
      (
        !item.playerVisible ||
        (
          String(item.rarity ?? "").toUpperCase() === "UNIQUE" &&
          tableExists("CharacterItem") &&
          Number(
            sqlite
              .prepare('SELECT COUNT(*) AS count FROM "CharacterItem" WHERE itemDefinitionId = ?')
              .get(item.id)?.count ?? 0
          ) > 0
        )
      )
    ) {
      return res.status(404).json({ error: "Item not found" });
    }
    return res.json(item);
  });

  app.post("/api/items", requireRole("dm"), (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "Item name required" });
    }

    const created = saveItemDefinition(createEmptyItemDefinition(name));
    return res.status(201).json(created);
  });

  app.put("/api/items/:itemId", requireRole("dm"), (req, res) => {
    const current = readItemDefinition(req.params.itemId);
    if (!current) {
      return res.status(404).json({ error: "Item not found" });
    }

    const payload = req.body?.item;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Item payload required" });
    }

    try {
      const saved = saveItemDefinition({ ...payload, id: current.id }, current.id);
      return res.json(saved);
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.delete("/api/items/:itemId", requireRole("dm"), (req, res) => {
    const itemId = req.params.itemId;
    const item = readItemDefinition(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    const linkedCount = tableExists("CharacterItem")
      ? Number(
          sqlite
            .prepare('SELECT COUNT(*) AS count FROM "CharacterItem" WHERE itemDefinitionId = ?')
            .get(itemId)?.count ?? 0
        )
      : 0;
    if (linkedCount > 0) {
      return res.status(409).json({ error: "Cannot delete item definition linked to character inventory" });
    }

    runInTransaction(() => {
      sqlite.prepare('DELETE FROM "ItemSlotRule" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemAttack" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemModifier" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemFeature" WHERE itemDefinitionId = ?').run(itemId);
      sqlite.prepare('DELETE FROM "ItemDefinition" WHERE id = ?').run(itemId);
    });

    return res.status(204).end();
  });

  app.get("/api/characters/:slug/inventory-items", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const items = readCharacterInventoryItemsBySlug(slug);
    if (items === null) {
      return res.status(404).json({ error: "Character not found" });
    }
    return res.json(items);
  });

  app.post("/api/characters/:slug/inventory-items", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canEditCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (rejectIfSessionClosedForPlayer(res, req.user)) return;

    try {
      const items = assignItemDefinitionToCharacter(slug, req.body ?? {}, req.user?.id ?? null);
      return res.status(201).json(items);
    } catch (error) {
      const message = String(error?.message ?? error);
      const status = /not found/i.test(message) ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.delete("/api/characters/:slug/inventory-items/:characterItemId", requireRole("dm"), (req, res) => {
    if (!tableExists("CharacterItem")) {
      return res.status(500).json({ error: "Character inventory not available" });
    }

    const character = sqlite
      .prepare('SELECT id, slug FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
      .get(req.params.slug);
    if (!character) {
      return res.status(404).json({ error: "Character not found" });
    }

      const characterItem = sqlite
        .prepare(`
          SELECT
            ci.*,
            d.name AS itemDefinitionName
          FROM "CharacterItem" ci
          LEFT JOIN "ItemDefinition" d ON d.id = ci.itemDefinitionId
          WHERE ci.id = ? AND ci.characterId = ?
          LIMIT 1
        `)
        .get(req.params.characterItemId, character.id);
      if (!characterItem) {
        return res.status(404).json({ error: "Character item not found" });
      }

      const now = new Date().toISOString();
      const transactionId = crypto.randomUUID();
      const itemName = characterItem.nameOverride ?? characterItem.itemDefinitionName ?? "Oggetto senza nome";
      const snapshot = {
        mode: "dm_remove",
        fromCharacterId: character.id,
        sourceItemId: characterItem.id,
        quantity: Number(characterItem.quantity ?? 1),
        itemDefinitionId: characterItem.itemDefinitionId ?? null,
        itemName,
      };

      runInTransaction(() => {
        sqlite.prepare(`
          INSERT INTO "InventoryTransaction" (
            id, type, fromOwnerType, fromCharacterId, fromNpcName, toOwnerType, toCharacterId, toNpcName,
            notes, createdByUserId, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          transactionId,
          "REMOVAL",
          "CHARACTER",
          character.id,
          null,
          "SYSTEM",
          null,
          null,
          `Rimozione DM: ${itemName}`,
          req.user?.id ?? null,
          now
        );

        sqlite.prepare(`
          INSERT INTO "InventoryTransactionItem" (
            id, transactionId, characterItemId, itemDefinitionId, descriptionSnapshot, quantity
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          transactionId,
          characterItem.id,
          characterItem.itemDefinitionId ?? null,
          JSON.stringify(snapshot),
          Number(characterItem.quantity ?? 1)
        );

        sqlite.prepare('DELETE FROM "CharacterItem" WHERE id = ?').run(characterItem.id);
      });

      return res.status(204).end();
    });

    app.patch("/api/characters/:slug/inventory-items/:characterItemId", requireAuth, (req, res) => {
      const slug = req.params.slug;
      const ownership = readOwnership();
      if (!canEditCharacter(req.user, slug, ownership)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (rejectIfSessionClosedForPlayer(res, req.user)) return;

      try {
      const item = updateCharacterInventoryItem(slug, req.params.characterItemId, req.body ?? {});
      if (!item) {
        return res.status(404).json({ error: "Character item not found" });
      }
      return res.json(item);
      } catch (error) {
        const message = String(error?.message ?? error);
        const status = /not found/i.test(message) ? 404 : /forbidden/i.test(message) ? 403 : 400;
        return res.status(status).json({ error: message, details: error?.details ?? null });
      }
    });

  app.post("/api/characters/:slug/inventory-items/:characterItemId/transfer", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();
    if (!canEditCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (rejectIfSessionClosedForPlayer(res, req.user)) return;

    try {
      const items = transferCharacterItemBetweenCharacters(
        slug,
        req.params.characterItemId,
        req.body ?? {},
        req.user?.id ?? null
      );
      return res.json(items);
    } catch (error) {
      const message = String(error?.message ?? error);
      const status = /not found/i.test(message) ? 404 : /forbidden/i.test(message) ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.get("/api/inventory-transactions", requireRole("dm"), (req, res) => {
    return res.json(readInventoryTransfers());
  });

  app.post("/api/inventory-transactions/:transactionId/undo", requireRole("dm"), (req, res) => {
    try {
      return res.json(undoInventoryTransfer(req.params.transactionId, req.user?.id ?? null));
    } catch (error) {
      const message = String(error?.message ?? error);
      const status = /not found/i.test(message) ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.get("/api/currency-transactions", requireRole("dm"), (req, res) => {
    return res.json(readCurrencyTransactionsForDm());
  });

  app.get("/api/characters/:slug/currency-transactions/history", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();

    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const character = getCharacterRecordBySlug(slug);
    if (!character || character.archivedAt) {
      return res.status(404).json({ error: "Character not found" });
    }

    return res.json(readCharacterCurrencyTransactionsForPlayer(character.id));
  });

  app.post("/api/currency-transactions/:operationId/undo", requireRole("dm"), (req, res) => {
    try {
      const result = undoCurrencyTransactionOperation(req.params.operationId, req.user?.id ?? null);
      for (const characterId of result.affectedCharacterIds ?? []) {
        const row = sqlite
          .prepare('SELECT slug FROM "Character" WHERE id = ? LIMIT 1')
          .get(characterId);
        if (!row?.slug) continue;
        const state = readCharacter(row.slug);
        if (state) {
          io.to(`char:${row.slug}`).emit("character:state", state);
        }
      }
      return res.json({ ok: true });
    } catch (error) {
      const message = String(error?.message ?? error);
      const status = /not found/i.test(message) ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  // ===== Bestiary =====
  app.get("/api/monsters", requireRole("dm"), (req, res) => {
    const monsters = listMonsters().map((monster) => ({
      id: monster.id,
      slug: monster.slug,
      name: monster.general.name,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(monster.id),
      challengeRating: monster.general.challengeRating,
      size: monster.general.size,
      creatureType: monster.general.creatureType,
      typeLabel: monster.general.typeLabel || monster.general.creatureType,
      rarity: monster.rarity,
      alignment: monster.general.alignment,
      filePath: monster.filePath,
      armorClass: monster.combat.armorClass.value,
      hitPointsAverage: monster.combat.hitPoints.average,
      analysisDc: monster.analysisDc,
      researchDc: monster.researchDc,
      discoverSkill: monster.discoverSkill,
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

    return res.json({
      ...monster,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(monster.id),
    });
  });

  app.get("/api/player-compendium/monsters", requireAuth, (req, res) => {
    const knownStates = readKnownMonsterCompendiumStateById();
    const monsters = listMonsters()
      .filter((monster) => knownStates.has(monster.id))
      .map((monster) => buildPlayerCompendiumBasicSummary(monster, knownStates.get(monster.id)));

    return res.json(monsters);
  });

  app.get("/api/player-compendium/monsters/:monsterId", requireAuth, (req, res) => {
    const monsterId = req.params.monsterId;
    const knowledgeStateRow = tableExists("MonsterCompendiumEntry")
      ? sqlite
          .prepare(`
            SELECT knowledgeState
            FROM "MonsterCompendiumEntry"
            WHERE monsterId = ?
            LIMIT 1
          `)
          .get(monsterId)
      : null;

    const knowledgeState = knowledgeStateRow?.knowledgeState ?? "UNKNOWN";
    if (knowledgeState === "UNKNOWN") {
      return res.status(404).json({ error: "Monster not available in compendium" });
    }

    const relativePath = decodeMonsterId(monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const monster = readMonsterByRelativePath(relativePath);
    if (!monster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    if (knowledgeState === "COMPLETE") {
      return res.json({
        id: monster.id,
        knowledgeState,
        monster,
      });
    }

    return res.json({
      id: monster.id,
      knowledgeState: "BASIC",
      monster,
    });
  });

  app.get("/api/spells", requireAuth, (req, res) => {
    return res.json(readSpellsByClass());
  });

  app.get("/api/rules/skills", requireAuth, (req, res) => {
    return res.json(readSkills());
  });

  app.get("/api/rules/race-speeds", requireAuth, (req, res) => {
    return res.json(readRaceSpeedReferences());
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
        rarity = ?,
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
      nextMonster.rarity || null,
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

    const savedMonster = readMonsterByRelativePath(relativePath);
    return res.json({
      ...savedMonster,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(savedMonster.id),
    });
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
        challengeRatingXp, size, creatureType, rarity, alignment, data, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      nextMonster.rarity || null,
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

    if (tableExists("MonsterCompendiumEntry")) {
      sqlite.prepare(`
        INSERT OR IGNORE INTO "MonsterCompendiumEntry" (
          monsterId, knowledgeState, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?)
      `).run(
        monsterId,
        "UNKNOWN",
        now,
        now
      );
    }

    const createdMonster = readMonsterByRelativePath(relativePath);
    return res.status(201).json({
      ...createdMonster,
      compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(createdMonster.id),
    });
  });

  app.post("/api/monsters/import-json", requireRole("dm"), (req, res) => {
    const payload = req.body?.monster;
    const targetMonsterId = typeof req.body?.targetMonsterId === "string" && req.body.targetMonsterId.trim()
      ? req.body.targetMonsterId.trim()
      : null;

    try {
      const savedMonster = importMonsterFromJsonPayload(payload, targetMonsterId);
      return res.status(targetMonsterId ? 200 : 201).json({
        ...savedMonster,
        compendiumKnowledgeState: readMonsterCompendiumKnowledgeState(savedMonster.id),
      });
    } catch (error) {
      const message = String(error?.message ?? error);
      const status =
        /not found/i.test(message) ? 404
          : /invalid/i.test(message) ? 400
            : /required/i.test(message) ? 400
              : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.put("/api/monsters/:monsterId/compendium-knowledge", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const monster = readMonsterByRelativePath(relativePath);
    if (!monster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    if (!tableExists("MonsterCompendiumEntry")) {
      return res.status(500).json({ error: "Monster compendium not available" });
    }

    const knowledgeState = String(req.body?.knowledgeState ?? "UNKNOWN").toUpperCase();
    if (!["UNKNOWN", "BASIC", "COMPLETE"].includes(knowledgeState)) {
      return res.status(400).json({ error: "Invalid knowledge state" });
    }

    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO "MonsterCompendiumEntry" (
        monsterId, knowledgeState, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(monsterId) DO UPDATE SET
        knowledgeState = excluded.knowledgeState,
        updatedAt = excluded.updatedAt
    `).run(monster.id, knowledgeState, now, now);

    return res.json({ monsterId: monster.id, knowledgeState });
  });

  app.delete("/api/monsters/:monsterId", requireRole("dm"), (req, res) => {
    const relativePath = decodeMonsterId(req.params.monsterId);
    if (!relativePath) {
      return res.status(400).json({ error: "Invalid monster id" });
    }

    const currentMonster = readMonsterByRelativePath(relativePath);
    if (!currentMonster) {
      return res.status(404).json({ error: "Monster not found" });
    }

    if (!columnExists("Monster", "archivedAt")) {
      return res.status(500).json({ error: "Monster archive not available" });
    }

    sqlite.prepare(`
      UPDATE "Monster"
      SET archivedAt = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      new Date().toISOString(),
      new Date().toISOString(),
      currentMonster.id
    );

    return res.status(204).end();
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

  app.get("/api/characters/transfer-targets", requireAuth, (_req, res) => {
    return res.json(listCharacterTransferTargets());
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

  app.post("/api/characters/:slug/currency-transactions", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();

    if (!canEditCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (rejectIfSessionClosedForPlayer(res, req.user)) return;

    const sourceCharacter = getCharacterRecordBySlug(slug);
    if (!sourceCharacter || sourceCharacter.archivedAt) {
      return res.status(404).json({ error: "Character not found" });
    }

    const operation = typeof req.body?.operation === "string" ? req.body.operation.trim() : "";
    if (!["add", "remove", "transfer", "convert"].includes(operation)) {
      return res.status(400).json({ error: "Operazione monete non valida." });
    }

    const currency = typeof req.body?.currency === "string" ? req.body.currency.trim().toLowerCase() : "";
    if (!CURRENCY_KEYS.has(currency)) {
      return res.status(400).json({ error: "Taglio moneta non valido." });
    }

    const amount = Number.parseInt(String(req.body?.amount ?? ""), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Inserisci una quantità positiva di monete." });
    }

    const counterpartyName = typeof req.body?.counterpartyName === "string" ? req.body.counterpartyName.trim() : "";
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const purchaseDescription =
      typeof req.body?.purchaseDescription === "string" ? req.body.purchaseDescription.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    const targetCharacterSlug =
      typeof req.body?.targetCharacterSlug === "string" ? req.body.targetCharacterSlug.trim() : "";

    let targetCharacter = null;
    if (operation === "transfer") {
      if (!targetCharacterSlug) {
        return res.status(400).json({ error: "Seleziona il personaggio destinatario." });
      }
      if (targetCharacterSlug === slug) {
        return res.status(400).json({ error: "Non puoi trasferire monete allo stesso personaggio." });
      }
      targetCharacter = getCharacterRecordBySlug(targetCharacterSlug);
      if (!targetCharacter || targetCharacter.archivedAt || String(targetCharacter.characterType).toUpperCase() !== "PG") {
        return res.status(400).json({ error: "Destinatario non valido." });
      }
    }

    const transactionAmounts = {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      [currency]: amount,
    };

    let sourceBalance = null;
    let targetBalance = null;
    let createdTransaction = null;
    const operationId = crypto.randomUUID();

    try {
      runInTransaction(() => {
        const currentSourceBalance = readCharacterCurrencyBalance(sourceCharacter.id) ?? normalizeCurrencyBalance();

        if (operation === "add") {
          sourceBalance = {
            ...currentSourceBalance,
            [currency]: currentSourceBalance[currency] + amount,
          };
          writeCharacterCurrencyBalance(sourceCharacter.id, sourceBalance);
          createdTransaction = createCurrencyTransactionRecord({
            operationId,
            toCharacterId: sourceCharacter.id,
            fromExternalName: counterpartyName || null,
            reason: reason || null,
            purchaseDescription: purchaseDescription || null,
            note: note || null,
            createdByUserId: req.user?.id ?? null,
            ...transactionAmounts,
          });
          return;
        }

        if (operation === "convert") {
          const conversion = convertCurrencyAmountUpDetailed(currentSourceBalance, currency, amount);
          if (!conversion) {
            if (currency === "gp") {
              throw new Error("Le monete d'oro non possono essere convertite oltre.");
            }
            throw new Error("Monete insufficienti o conversione non valida.");
          }
          sourceBalance = conversion.balance;
          writeCharacterCurrencyBalance(sourceCharacter.id, sourceBalance);
          const conversionLabel = "Cambio valuta";
          const conversionNote = note || `Conversione ${amount} ${currency.toUpperCase()}`;
          const outgoingTransaction = createCurrencyTransactionRecord({
            operationId,
            fromCharacterId: sourceCharacter.id,
            toExternalName: conversionLabel,
            reason: conversionLabel,
            purchaseDescription: null,
            note: conversionNote,
            createdByUserId: req.user?.id ?? null,
            ...conversion.outgoing,
          });
          createCurrencyTransactionRecord({
            operationId,
            toCharacterId: sourceCharacter.id,
            fromExternalName: conversionLabel,
            reason: conversionLabel,
            purchaseDescription: null,
            note: conversionNote,
            createdByUserId: req.user?.id ?? null,
            ...conversion.incoming,
          });
          createdTransaction = outgoingTransaction;
          return;
        }

        if (operation === "remove") {
          const removal = removeCurrencyWithChangeDetailed(currentSourceBalance, currency, amount);
          if (!removal) {
            throw new Error("Monete insufficienti per questa operazione.");
          }
          sourceBalance = removal.balance;
          writeCharacterCurrencyBalance(sourceCharacter.id, sourceBalance);
          for (const conversion of removal.conversions) {
            createCurrencyTransactionRecord({
              operationId,
              fromCharacterId: sourceCharacter.id,
              toExternalName: "Cambio valuta",
              reason: "Cambio valuta",
              purchaseDescription: null,
              note: "Cambio automatico per spesa",
              createdByUserId: req.user?.id ?? null,
              ...conversion.outgoing,
            });
            createCurrencyTransactionRecord({
              operationId,
              toCharacterId: sourceCharacter.id,
              fromExternalName: "Cambio valuta",
              reason: "Cambio valuta",
              purchaseDescription: null,
              note: "Cambio automatico per spesa",
              createdByUserId: req.user?.id ?? null,
              ...conversion.incoming,
            });
          }
          createdTransaction = createCurrencyTransactionRecord({
            operationId,
            fromCharacterId: sourceCharacter.id,
            toExternalName: counterpartyName || null,
            reason: reason || null,
            purchaseDescription: purchaseDescription || null,
            note: note || null,
            createdByUserId: req.user?.id ?? null,
            ...transactionAmounts,
          });
          return;
        }

        const transferRemoval = removeCurrencyWithChangeDetailed(currentSourceBalance, currency, amount);
        if (!transferRemoval) {
          throw new Error("Monete insufficienti per questa operazione.");
        }
        sourceBalance = transferRemoval.balance;

        const currentTargetBalance = readCharacterCurrencyBalance(targetCharacter.id) ?? normalizeCurrencyBalance();
        targetBalance = {
          ...currentTargetBalance,
          [currency]: currentTargetBalance[currency] + amount,
        };

        writeCharacterCurrencyBalance(sourceCharacter.id, sourceBalance);
        writeCharacterCurrencyBalance(targetCharacter.id, targetBalance);
        for (const conversion of transferRemoval.conversions) {
          createCurrencyTransactionRecord({
            operationId,
            fromCharacterId: sourceCharacter.id,
            toExternalName: "Cambio valuta",
            reason: "Cambio valuta",
            purchaseDescription: null,
            note: "Cambio automatico per trasferimento",
            createdByUserId: req.user?.id ?? null,
            ...conversion.outgoing,
          });
          createCurrencyTransactionRecord({
            operationId,
            toCharacterId: sourceCharacter.id,
            fromExternalName: "Cambio valuta",
            reason: "Cambio valuta",
            purchaseDescription: null,
            note: "Cambio automatico per trasferimento",
            createdByUserId: req.user?.id ?? null,
            ...conversion.incoming,
          });
        }
        createdTransaction = createCurrencyTransactionRecord({
          operationId,
          fromCharacterId: sourceCharacter.id,
          toCharacterId: targetCharacter.id,
          reason: reason || null,
          purchaseDescription: purchaseDescription || null,
          note: note || null,
          createdByUserId: req.user?.id ?? null,
          ...transactionAmounts,
        });
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error && error.message ? error.message : "Operazione monete non riuscita.",
      });
    }

    const sourceState = readCharacter(slug);
    if (sourceState) {
      io.to(`char:${slug}`).emit("character:state", sourceState);
    }
    if (targetCharacter?.slug) {
      const targetState = readCharacter(targetCharacter.slug);
      if (targetState) {
        io.to(`char:${targetCharacter.slug}`).emit("character:state", targetState);
      }
    }

    return res.status(201).json({
      ok: true,
      balance: sourceBalance,
      targetBalance,
      transaction: createdTransaction,
    });
  });

  app.post("/api/characters", requireAuth, (req, res) => {
    if (rejectIfSessionClosedForPlayer(res, req.user)) return;
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

    deleteLegacyCharacterChatConversation(slug);

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
    if (rejectIfSessionClosedForPlayer(res, req.user)) return;

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
  const PRESENCE_DISCONNECT_GRACE_MS = 1000 * 60 * 8;
  const viewersBySlug = new Map();
  const slugBySocket = new Map();
  const pendingPresenceRemovalBySocket = new Map();

  const broadcastPresence = () => {
    const payload = Array.from(viewersBySlug.entries())
      .map(([slug, set]) => ({ slug, count: set.size }))
      .filter(({ count }) => count > 0);
    io.emit("presence:update", payload);
  };

  const cancelPendingPresenceRemoval = (socketId) => {
    const timer = pendingPresenceRemovalBySocket.get(socketId);
    if (!timer) return;
    clearTimeout(timer);
    pendingPresenceRemovalBySocket.delete(socketId);
  };

  const removePresenceSocketNow = (socketId, { broadcast = true } = {}) => {
    cancelPendingPresenceRemoval(socketId);
    const slug = slugBySocket.get(socketId);
    if (!slug) return;
    const set = viewersBySlug.get(slug);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) viewersBySlug.delete(slug);
    }
    slugBySocket.delete(socketId);
    if (broadcast) broadcastPresence();
  };

  const removePendingPresenceSocketsForSlug = (slug) => {
    const set = viewersBySlug.get(slug);
    if (!set) return;
    for (const socketId of Array.from(set)) {
      if (!pendingPresenceRemovalBySocket.has(socketId)) continue;
      removePresenceSocketNow(socketId, { broadcast: false });
    }
  };

  const schedulePresenceSocketRemoval = (socketId) => {
    if (!slugBySocket.has(socketId) || pendingPresenceRemovalBySocket.has(socketId)) return;
    const timer = setTimeout(() => {
      removePresenceSocketNow(socketId);
    }, PRESENCE_DISCONNECT_GRACE_MS);
    pendingPresenceRemovalBySocket.set(socketId, timer);
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
      socket.emit("game-session:state", readGameSessionState());
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
      if (!canUserWriteDuringSession(socket.data.user)) {
        socket.emit("game-session:state", readGameSessionState());
        return;
      }

      const current = readCharacter(slug) || {};
      const next = deepMerge(current, patch);
      scheduleWrite(slug, next);
      socket.to(`char:${slug}`).emit("character:patch", { slug, patch });
      socket.emit("character:state", next);

      const initiativeState = readInitiativeTrackerState();
      if (initiativeState.players.some((entry) => entry.slug === slug)) {
        setTimeout(() => {
          try {
            broadcastInitiativeTrackerState(io);
          } catch {}
        }, 60);
      }
    });

    socket.on("initiative:join-dm", () => {
      if (socket.data.user?.role !== "dm") return;
      socket.join("initiative:dm");
      socket.emit("initiative:state", readInitiativeTrackerState());
    });

    socket.on("initiative:join-character", (slug) => {
      const normalizedSlug = typeof slug === "string" ? slug.trim() : "";
      const ownership = readOwnership();
      if (!normalizedSlug || !canAccessCharacter(socket.data.user, normalizedSlug, ownership)) return;
      socket.emit("initiative:player-state", buildPlayerInitiativeTrackerView(readInitiativeTrackerState(), normalizedSlug));
    });

    socket.on("initiative:update-state", (payload) => {
      if (socket.data.user?.role !== "dm") return;
      const nextState = writeInitiativeTrackerState(payload);
      broadcastInitiativeTrackerState(io, nextState);
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

    socket.on("chat:conversation-message", ({ conversationId, text }) => {
      const normalizedConversationId = typeof conversationId === "string" ? conversationId.trim() : "";
      const normalizedText = typeof text === "string" ? text.trim() : "";
      const ownership = readOwnership();

      if (!normalizedConversationId || !normalizedText) return;

      const nextMessage = appendConversationMessage(
        normalizedConversationId,
        socket.data.user,
        normalizedText,
        ownership
      );
      if (!nextMessage) return;

      const recipientUserIds = listConversationRecipientUserIds(normalizedConversationId);
      for (const userId of recipientUserIds) {
        io.to(`user:${userId}`).emit("chat:conversation-message", nextMessage);
      }
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
      if (socket.data.user?.role !== "player") return;
      if (ownership[slug] !== socket.data.user?.id) return;
      removePendingPresenceSocketsForSlug(slug);
      cancelPendingPresenceRemoval(socket.id);
      if (!viewersBySlug.has(slug)) viewersBySlug.set(slug, new Set());
      viewersBySlug.get(slug).add(socket.id);
      slugBySocket.set(socket.id, slug);
      broadcastPresence();
    });

    socket.on("presence:leave", () => {
      removePresenceSocketNow(socket.id);
    });

    socket.on("disconnect", () => {
      const slug = slugBySocket.get(socket.id);
      if (!slug) return;
      const set = viewersBySlug.get(slug);
      if (set && set.size > 1) {
        removePresenceSocketNow(socket.id);
        return;
      }
      schedulePresenceSocketRemoval(socket.id);
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

  httpServer.listen(PORT, HOST, () => {
    const bindLabel = HOST ?? "0.0.0.0";
    console.log(`Server listening on http://${bindLabel === "0.0.0.0" ? "localhost" : bindLabel}:${PORT}`);

    if (!HOST || HOST === "0.0.0.0" || HOST === "::") {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === "IPv4" && !net.internal) {
            console.log(` -> Network: http://${net.address}:${PORT}`);
          }
        }
      }
    }
  });
}

start();



