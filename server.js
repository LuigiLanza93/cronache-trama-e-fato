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
const TRUST_PROXY = String(process.env.TRUST_PROXY ?? (isProd ? "1" : "0")).trim();

// ---- Disk paths ----
const DATA_DIR = path.resolve(__dirname, "src/data");
const MONSTERS_DIR = path.resolve(DATA_DIR, "monsters");
const DEFAULT_SQLITE_DB_FILE = path.resolve(__dirname, "prisma", "migration.db");
const DEFAULT_PORTRAIT_DIR = path.resolve(__dirname, "public/portraits");
const DEFAULT_CAMPAIGN_DOCUMENT_DIR = path.resolve(__dirname, "app-data", "campaign-documents");
const APP_DATA_DIR = process.env.APP_DATA_DIR ? path.resolve(process.env.APP_DATA_DIR) : null;
const PORTRAIT_DIR = process.env.PORTRAIT_DIR
  ? path.resolve(process.env.PORTRAIT_DIR)
  : APP_DATA_DIR
    ? path.resolve(APP_DATA_DIR, "portraits")
    : DEFAULT_PORTRAIT_DIR;
const CAMPAIGN_DOCUMENT_DIR = process.env.CAMPAIGN_DOCUMENT_DIR
  ? path.resolve(process.env.CAMPAIGN_DOCUMENT_DIR)
  : APP_DATA_DIR
    ? path.resolve(APP_DATA_DIR, "campaign-documents")
    : DEFAULT_CAMPAIGN_DOCUMENT_DIR;
const INITIATIVE_TRACKER_FILE = path.resolve(DATA_DIR, "initiative-tracker.json");
const INITIATIVE_TRACKER_STATE_KEY = "initiative-tracker";
const SESSION_COOKIE = "ctf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SQLITE_DB_FILE = resolveSqliteDbFile();
const DM_NOTES_ROOT = process.env.DM_NOTES_ROOT
  ? path.resolve(process.env.DM_NOTES_ROOT)
  : path.resolve("C:\\Users\\Gscot\\Documents\\Le Cronache della Trama e del Fato\\Le Cronache della Trama e del Fato");
const SLOW_REQUEST_THRESHOLD_MS = 1000;
const PORTRAIT_CACHE_MAX_AGE = "7d";
const STATIC_CACHE_MAX_AGE = "1y";
const CAMPAIGN_DOCUMENT_CACHE_MAX_AGE = "30d";
const LOGIN_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 15;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 8);
const BACKUP_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 15;
const BACKUP_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.BACKUP_RATE_LIMIT_MAX_ATTEMPTS ?? 5);
const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH ?? 10);
const REQUEST_LOG_PATHS = new Set([
  "/",
  "/api/auth/me",
  "/api/auth/login",
  "/api/game-session",
]);
const loginAttempts = new Map();
const backupAttempts = new Map();

function resolveSqliteDbFile() {
  const raw = String(process.env.SQLITE_DB_FILE || process.env.DATABASE_PATH || process.env.DATABASE_URL || "").trim();
  if (!raw) return DEFAULT_SQLITE_DB_FILE;
  if (!raw.startsWith("file:")) return path.resolve(raw);

  const filePath = decodeURIComponent(raw.slice("file:".length));
  return path.resolve(__dirname, filePath);
}

function getAllowedOrigins() {
  return String(process.env.APP_ORIGIN || process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getRequestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "http")
    .split(",")[0]
    .trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? `${proto}://${host}` : "";
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] ?? "")
    .split(",")[0]
    .trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || "unknown";
}

function generateTemporaryPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

function getConfiguredBackupToken() {
  return String(process.env.DATABASE_BACKUP_TOKEN || process.env.BACKUP_TOKEN || "").trim();
}

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function timingSafeStringEqual(a, b) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function getBackupRateLimitStatus(req) {
  const key = getClientIp(req);
  const now = Date.now();
  const entry = backupAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    backupAttempts.set(key, { count: 1, resetAt: now + BACKUP_RATE_LIMIT_WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > BACKUP_RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

function clearBackupRateLimit(req) {
  backupAttempts.delete(getClientIp(req));
}

function escapeSqliteStringLiteral(value) {
  return String(value).replace(/'/g, "''");
}

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

bootstrapPersistentStorage();

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

function createSqliteBackupFile() {
  ensureSqliteConnectionFresh();

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const backupDir = APP_DATA_DIR
    ? path.join(APP_DATA_DIR, ".tmp-db-backups")
    : path.join(os.tmpdir(), "cronache-db-backups");
  ensureDir(backupDir);

  const fileName = `cronache-prod-${timestamp}-${crypto.randomBytes(4).toString("hex")}.db`;
  const backupPath = path.join(backupDir, fileName);

  sqlite.exec(`VACUUM INTO '${escapeSqliteStringLiteral(backupPath)}';`);

  const stat = fs.statSync(backupPath);
  if (!stat.isFile() || stat.size <= 0) {
    try {
      fs.rmSync(backupPath, { force: true });
    } catch {
      // Best-effort cleanup; the failing backup response is more important.
    }
    throw new Error("SQLite backup file was not created correctly.");
  }

  const checksum = crypto.createHash("sha256").update(fs.readFileSync(backupPath)).digest("hex");
  return { backupPath, fileName, size: stat.size, checksum };
}

function copyDirectoryIfEmpty(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  ensureDir(targetDir);

  const targetHasFiles = fs.readdirSync(targetDir).some((entry) => {
    const fullPath = path.join(targetDir, entry);
    return fs.statSync(fullPath).isFile();
  });
  if (targetHasFiles) return;

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function bootstrapPersistentStorage() {
  ensureDir(path.dirname(SQLITE_DB_FILE));
  ensureDir(CAMPAIGN_DOCUMENT_DIR);
  if (SQLITE_DB_FILE !== DEFAULT_SQLITE_DB_FILE && !fs.existsSync(SQLITE_DB_FILE) && fs.existsSync(DEFAULT_SQLITE_DB_FILE)) {
    fs.copyFileSync(DEFAULT_SQLITE_DB_FILE, SQLITE_DB_FILE);
    console.log(`[server] initialized sqlite database at ${SQLITE_DB_FILE}`);
  }

  copyDirectoryIfEmpty(DEFAULT_PORTRAIT_DIR, PORTRAIT_DIR);
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

let transactionDepth = 0;

function runInTransaction(work) {
  if (transactionDepth > 0) {
    transactionDepth += 1;
    try {
      return work();
    } finally {
      transactionDepth -= 1;
    }
  }

  sqlite.exec("BEGIN");
  transactionDepth = 1;
  try {
    const result = work();
    sqlite.exec("COMMIT");
    transactionDepth = 0;
    return result;
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // Surface the original failure even if rollback also fails.
    }
    transactionDepth = 0;
    throw error;
  }
}

ensureRaceSpeedReferenceTable();
ensureUserLayoutPreferenceTable();
ensureAppStateTable();
ensureCharacterBackstoryTable();
ensureCampaignSessionStateTable();
ensureCampaignEventTables();
ensureCampaignDocumentTables();
ensureGameSessionStateTable();
ensureCharacterCurrencyBalanceTable();
ensureCurrencyTransactionTable();
ensureChatConversationTables();
ensureCampaignSessionStateRow();
ensureGameSessionStateRow();
ensureInitiativeTrackerStateMigrated();
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

function ensureAppStateTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "AppState" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function ensureCharacterBackstoryTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CharacterBackstory" (
      "characterId" TEXT NOT NULL PRIMARY KEY,
      "contentMarkdown" TEXT NOT NULL DEFAULT '',
      "updatedByUserId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CharacterBackstory_updatedByUserId_idx"
    ON "CharacterBackstory"("updatedByUserId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CharacterBackstory_updatedAt_idx"
    ON "CharacterBackstory"("updatedAt");
  `);
}

function ensureCampaignSessionStateTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CampaignSessionState" (
      "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
      "currentSessionNumber" INTEGER NOT NULL DEFAULT 1,
      "updatedByUserId" TEXT,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
}

function ensureCampaignEventTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CampaignEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionNumber" INTEGER NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "title" TEXT NOT NULL,
      "bodyMarkdown" TEXT NOT NULL DEFAULT '',
      "eventType" TEXT NOT NULL DEFAULT 'NOTE',
      "createdByUserId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  const campaignEventColumns = sqlite.prepare(`PRAGMA table_info("CampaignEvent")`).all();
  if (!campaignEventColumns.some((column) => column.name === "sortOrder")) {
    sqlite.exec(`ALTER TABLE "CampaignEvent" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0`);
  }
  sqlite.exec(`
    UPDATE "CampaignEvent"
    SET "sortOrder" = (
      CAST(COALESCE(strftime('%s', "createdAt"), '0') AS INTEGER) * 1000 + rowid
    )
    WHERE "sortOrder" = 0
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignEvent_sessionNumber_sortOrder_idx"
    ON "CampaignEvent"("sessionNumber", "sortOrder");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignEvent_sortOrder_idx"
    ON "CampaignEvent"("sortOrder");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignEvent_createdByUserId_idx"
    ON "CampaignEvent"("createdByUserId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignEvent_eventType_idx"
    ON "CampaignEvent"("eventType");
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CampaignEventVisibility" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "eventId" TEXT NOT NULL,
      "characterId" TEXT NOT NULL,
      FOREIGN KEY ("eventId") REFERENCES "CampaignEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CampaignEventVisibility_eventId_characterId_key"
    ON "CampaignEventVisibility"("eventId", "characterId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignEventVisibility_eventId_idx"
    ON "CampaignEventVisibility"("eventId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignEventVisibility_characterId_idx"
    ON "CampaignEventVisibility"("characterId");
  `);
}

function ensureCampaignDocumentTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CampaignDocument" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "kind" TEXT NOT NULL DEFAULT 'TEXT',
      "language" TEXT NOT NULL DEFAULT 'Comune',
      "contentMarkdown" TEXT NOT NULL DEFAULT '',
      "imageUrl" TEXT,
      "unreadableImageUrl" TEXT,
      "sessionNumber" INTEGER,
      "revealEventId" TEXT,
      "createdByUserId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("revealEventId") REFERENCES "CampaignEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignDocument_sessionNumber_idx"
    ON "CampaignDocument"("sessionNumber");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignDocument_kind_idx"
    ON "CampaignDocument"("kind");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignDocument_language_idx"
    ON "CampaignDocument"("language");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignDocument_createdByUserId_idx"
    ON "CampaignDocument"("createdByUserId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignDocument_revealEventId_idx"
    ON "CampaignDocument"("revealEventId");
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "CampaignDocumentVisibility" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "documentId" TEXT NOT NULL,
      "characterId" TEXT NOT NULL,
      FOREIGN KEY ("documentId") REFERENCES "CampaignDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CampaignDocumentVisibility_documentId_characterId_key"
    ON "CampaignDocumentVisibility"("documentId", "characterId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignDocumentVisibility_documentId_idx"
    ON "CampaignDocumentVisibility"("documentId");
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "CampaignDocumentVisibility_characterId_idx"
    ON "CampaignDocumentVisibility"("characterId");
  `);
}

function ensureCampaignSessionStateRow() {
  sqlite.exec(`
    INSERT OR IGNORE INTO "CampaignSessionState" ("id", "currentSessionNumber", "updatedByUserId", "updatedAt")
    VALUES (1, 1, NULL, CURRENT_TIMESTAMP)
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

const SHOP_CURRENCIES = new Set(["CP", "SP", "EP", "GP"]);

function requireShopTables() {
  if (!tableExists("Shop") || !tableExists("ShopItem")) {
    throw new Error("Shop database migration has not been applied");
  }
}

function normalizeShopInteger(value, field, { min = 0, max = 1_000_000_000, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function createUniqueShopExternalKey(name) {
  const base = sanitizeSlug(name);
  let candidate = base;
  let suffix = 2;
  const exists = sqlite.prepare('SELECT 1 FROM "Shop" WHERE externalKey = ? LIMIT 1');
  while (exists.get(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function serializeDmShop(row, items = []) {
  return {
    id: row.id, externalKey: row.externalKey, name: row.name, description: row.description,
    ownerName: row.ownerName, ownerDescription: row.ownerDescription, city: row.city,
    dmNotes: row.dmNotes ?? "",
    discountDc: row.discountDc ?? null,
    balance: { cp: Number(row.cp), sp: Number(row.sp), ep: Number(row.ep), gp: Number(row.gp) },
    archivedAt: row.archivedAt ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt, items,
  };
}

function serializeDmShopItem(row) {
  const definition = row.itemDefinitionId ? readItemDefinition(row.itemDefinitionId) : null;
  return {
    id: row.id, shopId: row.shopId, itemDefinitionId: row.itemDefinitionId ?? null,
    nameOverride: row.nameOverride ?? null, descriptionOverride: row.descriptionOverride ?? null,
    quantity: Number(row.quantity), price: { currency: row.priceCurrency, amount: Number(row.priceAmount) },
    isSecret: !!row.isSecret, discoveryDc: row.discoveryDc ?? null, sortOrder: Number(row.sortOrder),
    dmNotes: row.dmNotes ?? null, instanceNotes: row.instanceNotes ?? null,
    data: parseJsonString(row.data, null), createdAt: row.createdAt, updatedAt: row.updatedAt,
    definition,
  };
}

function readDmShops({ includeArchived = false } = {}) {
  requireShopTables();
  const rows = sqlite.prepare(`SELECT * FROM "Shop" ${includeArchived ? "" : "WHERE archivedAt IS NULL"} ORDER BY city COLLATE NOCASE, name COLLATE NOCASE`).all();
  const itemStatement = sqlite.prepare('SELECT * FROM "ShopItem" WHERE shopId = ? ORDER BY sortOrder, createdAt');
  return rows.map((row) => serializeDmShop(row, itemStatement.all(row.id).map(serializeDmShopItem)));
}

function readDmShop(shopId) {
  requireShopTables();
  const row = sqlite.prepare('SELECT * FROM "Shop" WHERE id = ?').get(shopId);
  if (!row) return null;
  const items = sqlite.prepare('SELECT * FROM "ShopItem" WHERE shopId = ? ORDER BY sortOrder, createdAt').all(shopId).map(serializeDmShopItem);
  return serializeDmShop(row, items);
}

function normalizeShopPayload(payload, { partial = false } = {}) {
  const text = (key, required = false) => {
    if (partial && payload?.[key] === undefined) return undefined;
    const value = String(payload?.[key] ?? "").trim();
    if (required && !value) throw new Error(`${key} is required`);
    return value;
  };
  const result = {
    externalKey: text("externalKey"), name: text("name", true), description: text("description"),
    ownerName: text("ownerName", true), ownerDescription: text("ownerDescription"), city: text("city", true),
    dmNotes: text("dmNotes"),
  };
  if (result.externalKey && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.externalKey)) {
    throw new Error("externalKey must use kebab-case");
  }
  if (!partial || payload?.discountDc !== undefined) result.discountDc = normalizeShopInteger(payload?.discountDc, "discountDc", { min: 1, max: 1000, nullable: true });
  const balance = payload?.balance ?? payload;
  for (const currency of ["cp", "sp", "ep", "gp"]) {
    if (!partial || balance?.[currency] !== undefined) result[currency] = normalizeShopInteger(balance?.[currency] ?? 0, currency);
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
}

function normalizeShopItemPayload(payload, { partial = false } = {}) {
  const result = {};
  if (!partial || payload?.itemDefinitionId !== undefined) {
    const id = String(payload?.itemDefinitionId ?? "").trim();
    if (!id || !readItemDefinition(id)) throw new Error("A valid itemDefinitionId is required");
    result.itemDefinitionId = id;
  }
  for (const key of ["nameOverride", "descriptionOverride", "dmNotes", "instanceNotes"]) {
    if (!partial || payload?.[key] !== undefined) result[key] = payload?.[key] == null ? null : String(payload[key]).trim() || null;
  }
  if (!partial || payload?.quantity !== undefined) result.quantity = normalizeShopInteger(payload?.quantity ?? 1, "quantity", { min: 1 });
  const price = payload?.price ?? payload;
  if (!partial || price?.currency !== undefined || payload?.priceCurrency !== undefined) {
    const currency = String(price?.currency ?? payload?.priceCurrency ?? "").toUpperCase();
    if (!SHOP_CURRENCIES.has(currency)) throw new Error("price currency must be CP, SP, EP or GP");
    result.priceCurrency = currency;
  }
  if (!partial || price?.amount !== undefined || payload?.priceAmount !== undefined) result.priceAmount = normalizeShopInteger(price?.amount ?? payload?.priceAmount, "price amount", { min: 1 });
  if (!partial || payload?.isSecret !== undefined) result.isSecret = payload?.isSecret ? 1 : 0;
  if (!partial || payload?.discoveryDc !== undefined) result.discoveryDc = normalizeShopInteger(payload?.discoveryDc, "discoveryDc", { min: 1, max: 1000, nullable: true });
  if (!partial || payload?.sortOrder !== undefined) result.sortOrder = normalizeShopInteger(payload?.sortOrder ?? 0, "sortOrder", { min: 0 });
  if (!partial || payload?.data !== undefined) result.data = payload?.data == null ? null : JSON.stringify(payload.data);
  return result;
}

function validateShopItemInstance(definition, quantity, data, currentShopItemId = null) {
  const hasPerCopyFeatures = definition?.features?.some((feature) => Number(feature.maxUses ?? 0) > 0);
  if ((!definition?.stackable || hasPerCopyFeatures || data != null) && quantity !== 1) {
    throw new Error("This item carries per-copy state and must have quantity 1");
  }
  if (String(definition?.rarity ?? "").toUpperCase() !== "UNIQUE") return;
  const characterCount = Number(sqlite.prepare('SELECT COUNT(*) AS count FROM "CharacterItem" WHERE itemDefinitionId = ?').get(definition.id)?.count ?? 0);
  const shopCount = Number(sqlite.prepare('SELECT COUNT(*) AS count FROM "ShopItem" WHERE itemDefinitionId = ? AND id <> ?').get(definition.id, currentShopItemId ?? "")?.count ?? 0);
  if (characterCount + shopCount > 0) throw new Error("A UNIQUE item can only exist once across inventories and shops");
}

function readOrCreateShopCharacterProfile(shopId, slug) {
  requireShopTables();
  if (!tableExists("ShopCharacterProfile")) throw new Error("Shop profile database migration has not been applied");
  const shop = sqlite.prepare('SELECT id, name FROM "Shop" WHERE id = ? LIMIT 1').get(shopId);
  if (!shop) return null;
  const character = sqlite
    .prepare('SELECT id, slug, name, characterType FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(slug);
  if (!character || String(character.characterType).toUpperCase() !== "PG") {
    const error = new Error("Character not found");
    error.status = 404;
    throw error;
  }

  let profile = sqlite
    .prepare('SELECT * FROM "ShopCharacterProfile" WHERE shopId = ? AND characterId = ? LIMIT 1')
    .get(shopId, character.id);
  if (!profile) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO "ShopCharacterProfile" (id, shopId, characterId, visitCount, dmNotes, usualDiscountPercent, lastVisitedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, 0, '', NULL, NULL, ?, ?)`)
      .run(id, shopId, character.id, now, now);
    profile = sqlite.prepare('SELECT * FROM "ShopCharacterProfile" WHERE id = ?').get(id);
  }

  return {
    id: profile.id,
    shopId: profile.shopId,
    characterId: profile.characterId,
    character: {
      slug: character.slug,
      name: character.name,
    },
    visitCount: Number(profile.visitCount ?? 0),
    dmNotes: profile.dmNotes ?? "",
    usualDiscountPercent: profile.usualDiscountPercent ?? null,
    lastVisitedAt: profile.lastVisitedAt ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function readShopVisitById(visitId) {
  if (!tableExists("ShopVisit")) throw new Error("Shop visit database migration has not been applied");
  return sqlite.prepare(`
    SELECT
      v.*,
      s.name AS shopName,
      s.ownerName AS shopOwnerName,
      s.city AS shopCity,
      s.archivedAt AS shopArchivedAt,
      c.slug AS characterSlug,
      c.name AS characterName
    FROM "ShopVisit" v
    JOIN "Shop" s ON s.id = v.shopId
    JOIN "Character" c ON c.id = v.characterId
    WHERE v.id = ?
    LIMIT 1
  `).get(visitId);
}

function readActiveShopVisit() {
  if (!tableExists("ShopVisit")) throw new Error("Shop visit database migration has not been applied");
  return sqlite.prepare(`
    SELECT
      v.*,
      s.name AS shopName,
      s.ownerName AS shopOwnerName,
      s.city AS shopCity,
      s.archivedAt AS shopArchivedAt,
      c.slug AS characterSlug,
      c.name AS characterName
    FROM "ShopVisit" v
    JOIN "Shop" s ON s.id = v.shopId
    JOIN "Character" c ON c.id = v.characterId
    WHERE v.status = 'ACTIVE'
    ORDER BY v.openedAt DESC
    LIMIT 1
  `).get();
}

function canAccessShopVisit(user, visitRow) {
  if (!visitRow) return false;
  if (user?.role === "dm") return true;
  return canAccessCharacter(user, visitRow.characterSlug, readOwnership());
}

function serializeShopVisit(row, { dm = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    shopId: row.shopId,
    characterId: row.characterId,
    status: row.status,
    discountPercent: Number(row.discountPercent ?? 0),
    openedAt: row.openedAt,
    closedAt: row.closedAt ?? null,
    closeReason: row.closeReason ?? null,
    updatedAt: row.updatedAt,
    shop: {
      id: row.shopId,
      name: row.shopName,
      ownerName: row.shopOwnerName,
      city: row.shopCity,
    },
    character: {
      slug: row.characterSlug,
      name: row.characterName,
    },
  };
  if (!dm) return base;
  return {
    ...base,
    dmNotes: row.dmNotes ?? "",
    openedByUserId: row.openedByUserId ?? null,
    closedByUserId: row.closedByUserId ?? null,
  };
}

function readShopItemFeatureStates(shopItemIds) {
  if (!tableExists("ShopItemFeatureState") || !Array.isArray(shopItemIds) || !shopItemIds.length) return {};
  return sqlite.prepare(`
    SELECT shopItemId, itemFeatureId, usesSpent, lastResetAt
    FROM "ShopItemFeatureState"
    WHERE shopItemId IN (${shopItemIds.map(() => "?").join(",")})
  `).all(...shopItemIds).reduce((acc, row) => {
    if (!acc[row.shopItemId]) acc[row.shopItemId] = [];
    acc[row.shopItemId].push({
      itemFeatureId: row.itemFeatureId,
      usesSpent: Number(row.usesSpent ?? 0),
      lastResetAt: row.lastResetAt ?? null,
    });
    return acc;
  }, {});
}

function readKnownShopItemIds(shopId, characterId) {
  if (!tableExists("ShopItemKnowledge")) return new Set();
  return new Set(
    sqlite.prepare('SELECT shopItemId FROM "ShopItemKnowledge" WHERE shopId = ? AND characterId = ?')
      .all(shopId, characterId)
      .map((row) => String(row.shopItemId))
  );
}

function serializeShopVisitItem(row, { dm = false, known = false, featureStates = [] } = {}) {
  const definition = row.itemDefinitionId ? readItemDefinition(row.itemDefinitionId) : null;
  const definitionPlayerVisible = definition ? definition.playerVisible !== false : true;
  const visibleToPlayer = definitionPlayerVisible && (!row.isSecret || known);
  if (!dm && !visibleToPlayer) return null;
  const base = {
    id: row.id,
    shopId: row.shopId,
    itemDefinitionId: row.itemDefinitionId ?? null,
    name: row.nameOverride ?? definition?.name ?? "Oggetto senza nome",
    description: row.descriptionOverride ?? definition?.description ?? null,
    nameOverride: row.nameOverride ?? null,
    descriptionOverride: row.descriptionOverride ?? null,
    quantity: Number(row.quantity ?? 0),
    isSecret: !!row.isSecret,
    revealed: !row.isSecret || known,
    sortOrder: Number(row.sortOrder ?? 0),
    instanceNotes: row.instanceNotes ?? null,
    data: parseJsonString(row.data, null),
    featureStates,
    definition,
  };
  if (!dm) return base;
  return {
    ...base,
    visibleToPlayer,
    price: { currency: row.priceCurrency, amount: Number(row.priceAmount ?? 0) },
    discoveryDc: row.discoveryDc ?? null,
    dmNotes: row.dmNotes ?? null,
  };
}

function readShopVisitItemsForCharacter(visitRow, { dm = false } = {}) {
  if (!visitRow || !tableExists("ShopItem")) return [];
  const rows = sqlite.prepare('SELECT * FROM "ShopItem" WHERE shopId = ? ORDER BY sortOrder ASC, createdAt ASC').all(visitRow.shopId);
  const featureStatesByItemId = readShopItemFeatureStates(rows.map((row) => row.id));
  const knownIds = readKnownShopItemIds(visitRow.shopId, visitRow.characterId);
  return rows
    .map((row) => serializeShopVisitItem(row, {
      dm,
      known: knownIds.has(row.id),
      featureStates: featureStatesByItemId[row.id] ?? [],
    }))
    .filter(Boolean);
}

function serializeShopVisitDetail(row, { dm = false } = {}) {
  const visit = serializeShopVisit(row, { dm });
  if (!visit) return null;
  return {
    ...visit,
    items: readShopVisitItemsForCharacter(row, { dm }),
    inventory: readCharacterInventoryItemsBySlug(row.characterSlug) ?? [],
    negotiations: readShopVisitNegotiations(row, { dm }),
  };
}

function shopTradeSellerSide(direction) {
  return direction === "CHARACTER_TO_SHOP" ? "CHARACTER" : "SHOP";
}

function readShopNegotiationById(negotiationId) {
  if (!tableExists("ShopNegotiation")) throw new Error("Shop negotiation database migration has not been applied");
  return sqlite.prepare(`
    SELECT
      n.*,
      v.shopId,
      v.status AS visitStatus,
      c.slug AS characterSlug,
      c.name AS characterName
    FROM "ShopNegotiation" n
    JOIN "ShopVisit" v ON v.id = n.visitId
    JOIN "Character" c ON c.id = n.characterId
    WHERE n.id = ?
    LIMIT 1
  `).get(negotiationId);
}

function readShopOffersByNegotiationIds(negotiationIds) {
  if (!tableExists("ShopOffer") || !Array.isArray(negotiationIds) || !negotiationIds.length) return {};
  return sqlite.prepare(`
    SELECT o.*, u.displayName AS proposedByName, u.role AS proposedByRole
    FROM "ShopOffer" o
    LEFT JOIN "User" u ON u.id = o.proposedByUserId
    WHERE o.negotiationId IN (${negotiationIds.map(() => "?").join(",")})
    ORDER BY o.negotiationId ASC, o.sequence ASC
  `).all(...negotiationIds).reduce((acc, row) => {
    if (!acc[row.negotiationId]) acc[row.negotiationId] = [];
    acc[row.negotiationId].push({
      id: row.id,
      negotiationId: row.negotiationId,
      sequence: Number(row.sequence ?? 0),
      proposedByUserId: row.proposedByUserId,
      proposedByName: row.proposedByName ?? null,
      proposedByRole: row.proposedByRole ?? null,
      sellerSide: row.sellerSide,
      currency: row.currency,
      amount: Number(row.amount ?? 0),
      createdAt: row.createdAt,
    });
    return acc;
  }, {});
}

function serializeShopNegotiation(row, offers = []) {
  const sortedOffers = [...offers].sort((a, b) => a.sequence - b.sequence);
  return {
    id: row.id,
    visitId: row.visitId,
    characterId: row.characterId,
    direction: row.direction,
    shopItemId: row.shopItemId ?? null,
    characterItemId: row.characterItemId ?? null,
    quantity: Number(row.quantity ?? 1),
    status: row.status,
    itemNameSnapshot: row.itemNameSnapshot,
    itemDetailsSnapshot: row.itemDetailsSnapshot ?? null,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null,
    updatedAt: row.updatedAt,
    offers: sortedOffers,
    currentOffer: sortedOffers[sortedOffers.length - 1] ?? null,
  };
}

function readShopVisitNegotiations(visitRow) {
  if (!visitRow || !tableExists("ShopNegotiation")) return [];
  const rows = sqlite.prepare(`
    SELECT *
    FROM "ShopNegotiation"
    WHERE visitId = ?
    ORDER BY createdAt DESC
  `).all(visitRow.id);
  const offersByNegotiationId = readShopOffersByNegotiationIds(rows.map((row) => row.id));
  return rows.map((row) => serializeShopNegotiation(row, offersByNegotiationId[row.id] ?? []));
}

function normalizeShopOfferPayload(payload) {
  const amount = normalizeShopInteger(payload?.amount, "amount", { min: 1 });
  const currency = String(payload?.currency ?? "GP").toUpperCase();
  if (!["CP", "SP", "EP", "GP"].includes(currency)) throw new Error("currency must be CP, SP, EP or GP");
  return { amount, currency };
}

function createShopOffer(negotiationId, sequence, proposedByUserId, sellerSide, payload) {
  const offer = normalizeShopOfferPayload(payload);
  sqlite.prepare(`INSERT INTO "ShopOffer" (id, negotiationId, sequence, proposedByUserId, sellerSide, currency, amount, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), negotiationId, sequence, proposedByUserId, sellerSide, offer.currency, offer.amount, new Date().toISOString());
}

function broadcastShopNegotiationState(io, visitId) {
  const visit = readShopVisitById(visitId);
  broadcastShopVisit(io, "shop-visit:updated", visit);
}

function readItemDefinitionBySlug(slug) {
  const row = tableExists("ItemDefinition")
    ? sqlite.prepare('SELECT id FROM "ItemDefinition" WHERE slug = ? LIMIT 1').get(slug)
    : null;
  return row?.id ? readItemDefinition(row.id) : null;
}

function buildShopImportCatalogIndex() {
  return readItemDefinitions().map((item) => ({
    slug: item.slug,
    name: item.name,
    category: item.category,
    rarity: item.rarity ?? null,
    stackable: !!item.stackable,
    equippable: !!item.equippable,
    playerVisible: !!item.playerVisible,
  }));
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function validateImportObjectKeys(value, allowedKeys, label, errors) {
  for (const key of Object.keys(value ?? {})) {
    if (!allowedKeys.includes(key)) errors.push(`${label}: unsupported field "${key}"`);
  }
}

function validateShopImportPayload(payload) {
  requireShopTables();
  assertPlainObject(payload, "payload");

  const errors = [];
  const warnings = [];
  const prepared = [];
  const externalKeys = new Set();
  const inlineSlugs = new Set();
  const importedUniqueDefinitionIds = new Set();
  const existingShopKey = sqlite.prepare('SELECT 1 FROM "Shop" WHERE externalKey = ? LIMIT 1');
  const existingSlug = sqlite.prepare('SELECT 1 FROM "ItemDefinition" WHERE slug = ? LIMIT 1');
  const kebabPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  validateImportObjectKeys(payload, ["formatVersion", "shops"], "root", errors);
  if (payload.formatVersion !== 1) errors.push("root.formatVersion must be 1");
  if (!Array.isArray(payload.shops) || payload.shops.length === 0) errors.push("root.shops must be a non-empty array");

  const shops = Array.isArray(payload.shops) ? payload.shops : [];
  shops.forEach((shop, shopIndex) => {
    const shopLabel = `shops[${shopIndex}]`;
    if (!shop || typeof shop !== "object" || Array.isArray(shop)) {
      errors.push(`${shopLabel} must be an object`);
      return;
    }

    validateImportObjectKeys(shop, ["externalKey", "name", "description", "city", "owner", "balance", "discountDc", "dmNotes", "items"], shopLabel, errors);
    const externalKey = String(shop.externalKey ?? "").trim();
    const name = String(shop.name ?? "").trim();
    const description = String(shop.description ?? "");
    const city = String(shop.city ?? "").trim();
    const owner = shop.owner && typeof shop.owner === "object" && !Array.isArray(shop.owner) ? shop.owner : {};
    const balance = shop.balance && typeof shop.balance === "object" && !Array.isArray(shop.balance) ? shop.balance : {};

    if (!externalKey || !kebabPattern.test(externalKey)) errors.push(`${shopLabel}.externalKey must use kebab-case`);
    if (externalKey && externalKeys.has(externalKey)) errors.push(`${shopLabel}.externalKey duplicates another shop in the import`);
    if (externalKey) externalKeys.add(externalKey);
    if (externalKey && existingShopKey.get(externalKey)) errors.push(`${shopLabel}.externalKey already exists`);
    if (!name) errors.push(`${shopLabel}.name is required`);
    if (!city) errors.push(`${shopLabel}.city is required`);
    validateImportObjectKeys(owner, ["name", "description"], `${shopLabel}.owner`, errors);
    if (!String(owner.name ?? "").trim()) errors.push(`${shopLabel}.owner.name is required`);
    validateImportObjectKeys(balance, ["cp", "sp", "ep", "gp"], `${shopLabel}.balance`, errors);
    for (const currency of ["cp", "sp", "ep", "gp"]) {
      try { normalizeShopInteger(balance[currency], `${shopLabel}.balance.${currency}`); }
      catch (error) { errors.push(String(error?.message ?? error)); }
    }
    try { normalizeShopInteger(shop.discountDc, `${shopLabel}.discountDc`, { min: 1, max: 1000, nullable: true }); }
    catch (error) { errors.push(String(error?.message ?? error)); }
    if (!Array.isArray(shop.items) || shop.items.length === 0) errors.push(`${shopLabel}.items must be a non-empty array`);

    const preparedItems = [];
    const items = Array.isArray(shop.items) ? shop.items : [];
    items.forEach((item, itemIndex) => {
      const itemLabel = `${shopLabel}.items[${itemIndex}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`${itemLabel} must be an object`);
        return;
      }
      validateImportObjectKeys(item, ["catalogSlug", "definition", "quantity", "price", "isSecret", "discoveryDc", "nameOverride", "descriptionOverride", "dmNotes", "instanceNotes", "data", "featureStates"], itemLabel, errors);

      const hasCatalogSlug = item.catalogSlug !== undefined && item.catalogSlug !== null;
      const hasDefinition = item.definition !== undefined && item.definition !== null;
      if (hasCatalogSlug === hasDefinition) errors.push(`${itemLabel} must include exactly one of catalogSlug or definition`);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) errors.push(`${itemLabel}.quantity must be a positive integer`);
      const price = item.price && typeof item.price === "object" && !Array.isArray(item.price) ? item.price : {};
      validateImportObjectKeys(price, ["currency", "amount"], `${itemLabel}.price`, errors);
      const priceCurrency = String(price.currency ?? "").toUpperCase();
      if (!SHOP_CURRENCIES.has(priceCurrency)) errors.push(`${itemLabel}.price.currency must be CP, SP, EP or GP`);
      const priceAmount = Number(price.amount);
      if (!Number.isInteger(priceAmount) || priceAmount < 1) errors.push(`${itemLabel}.price.amount must be a positive integer`);
      if (typeof item.isSecret !== "boolean") errors.push(`${itemLabel}.isSecret must be boolean`);
      try { normalizeShopInteger(item.discoveryDc, `${itemLabel}.discoveryDc`, { min: 1, max: 1000, nullable: true }); }
      catch (error) { errors.push(String(error?.message ?? error)); }

      let definition = null;
      let definitionSource = "catalog";
      if (hasCatalogSlug) {
        const catalogSlug = String(item.catalogSlug ?? "").trim();
        if (!kebabPattern.test(catalogSlug)) errors.push(`${itemLabel}.catalogSlug must use kebab-case`);
        definition = readItemDefinitionBySlug(catalogSlug);
        if (!definition) errors.push(`${itemLabel}.catalogSlug "${catalogSlug}" was not found`);
      } else if (hasDefinition) {
        definitionSource = "inline";
        const rawDefinition = item.definition;
        if (!rawDefinition || typeof rawDefinition !== "object" || Array.isArray(rawDefinition)) {
          errors.push(`${itemLabel}.definition must be an object`);
        } else {
          const slug = String(rawDefinition.slug ?? "").trim();
          if (!slug || !kebabPattern.test(slug)) errors.push(`${itemLabel}.definition.slug must use kebab-case`);
          if (slug && inlineSlugs.has(slug)) errors.push(`${itemLabel}.definition.slug duplicates another inline definition in the import`);
          if (slug) inlineSlugs.add(slug);
          if (slug && existingSlug.get(slug)) errors.push(`${itemLabel}.definition.slug already exists`);
          try {
            definition = normalizeItemDefinitionPayload(rawDefinition);
            if (definition.slug !== slug) errors.push(`${itemLabel}.definition.slug would be normalized to "${definition.slug}"`);
          } catch (error) {
            errors.push(`${itemLabel}.definition: ${String(error?.message ?? error)}`);
          }
        }
      }

      const featureStates = Array.isArray(item.featureStates) ? item.featureStates : [];
      if (item.featureStates !== undefined && !Array.isArray(item.featureStates)) errors.push(`${itemLabel}.featureStates must be an array`);
      if (featureStates.length > 0) {
        if (quantity !== 1) errors.push(`${itemLabel}.featureStates require quantity 1`);
        if (definition?.stackable) errors.push(`${itemLabel}.featureStates are not allowed on stackable items`);
        const featureNames = new Map();
        for (const feature of definition?.features ?? []) {
          const key = String(feature.name ?? "").trim().toLowerCase();
          featureNames.set(key, (featureNames.get(key) ?? 0) + 1);
        }
        for (const state of featureStates) {
          const featureName = String(state?.featureName ?? "").trim();
          const key = featureName.toLowerCase();
          if (!featureName) errors.push(`${itemLabel}.featureStates.featureName is required`);
          else if (!featureNames.has(key)) errors.push(`${itemLabel}.featureStates "${featureName}" does not match a feature`);
          else if (featureNames.get(key) > 1) errors.push(`${itemLabel}.featureStates "${featureName}" is ambiguous`);
          if (!Number.isInteger(Number(state?.usesSpent)) || Number(state?.usesSpent) < 0) errors.push(`${itemLabel}.featureStates "${featureName}" usesSpent must be a non-negative integer`);
          if (state?.lastResetAt !== null && state?.lastResetAt !== undefined && Number.isNaN(Date.parse(String(state.lastResetAt)))) errors.push(`${itemLabel}.featureStates "${featureName}" lastResetAt must be a date-time or null`);
        }
      }

      if (definition && Number.isInteger(quantity)) {
        try { validateShopItemInstance(definition, quantity, item.data ?? null); }
        catch (error) { errors.push(`${itemLabel}: ${String(error?.message ?? error)}`); }
        if (String(definition.rarity ?? "").toUpperCase() === "UNIQUE") {
          if (importedUniqueDefinitionIds.has(definition.id)) {
            errors.push(`${itemLabel}: UNIQUE item "${definition.name}" is duplicated in the import`);
          }
          importedUniqueDefinitionIds.add(definition.id);
        }
      }

      preparedItems.push({
        source: definitionSource,
        catalogSlug: hasCatalogSlug ? String(item.catalogSlug ?? "").trim() : null,
        inlineDefinition: hasDefinition ? item.definition : null,
        normalizedInlineDefinition: definitionSource === "inline" ? definition : null,
        definition,
        quantity,
        priceCurrency,
        priceAmount,
        isSecret: item.isSecret === true,
        discoveryDc: item.discoveryDc ?? null,
        nameOverride: item.nameOverride == null ? null : String(item.nameOverride).trim() || null,
        descriptionOverride: item.descriptionOverride == null ? null : String(item.descriptionOverride).trim() || null,
        dmNotes: item.dmNotes == null ? null : String(item.dmNotes).trim() || null,
        instanceNotes: item.instanceNotes == null ? null : String(item.instanceNotes).trim() || null,
        data: item.data ?? null,
        featureStates,
      });
    });

    prepared.push({
      externalKey,
      name,
      description,
      city,
      ownerName: String(owner.name ?? "").trim(),
      ownerDescription: String(owner.description ?? ""),
      dmNotes: shop.dmNotes == null ? "" : String(shop.dmNotes),
      discountDc: shop.discountDc ?? null,
      balance: {
        cp: Number(balance.cp ?? 0),
        sp: Number(balance.sp ?? 0),
        ep: Number(balance.ep ?? 0),
        gp: Number(balance.gp ?? 0),
      },
      items: preparedItems,
    });
  });

  return { errors, warnings, prepared };
}

function previewShopImport(prepared, errors, warnings) {
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      shops: prepared.length,
      items: prepared.reduce((sum, shop) => sum + shop.items.length, 0),
      newDefinitions: prepared.reduce((sum, shop) => sum + shop.items.filter((item) => item.source === "inline").length, 0),
      reusedDefinitions: prepared.reduce((sum, shop) => sum + shop.items.filter((item) => item.source === "catalog").length, 0),
    },
    shops: prepared.map((shop) => ({
      externalKey: shop.externalKey,
      name: shop.name,
      city: shop.city,
      ownerName: shop.ownerName,
      balance: shop.balance,
      items: shop.items.map((item) => ({
        source: item.source,
        catalogSlug: item.catalogSlug,
        definitionSlug: item.source === "inline" ? item.normalizedInlineDefinition?.slug ?? null : item.definition?.slug ?? null,
        name: item.nameOverride || item.definition?.name || item.normalizedInlineDefinition?.name || "Oggetto",
        quantity: item.quantity,
        price: { currency: item.priceCurrency, amount: item.priceAmount },
        isSecret: item.isSecret,
      })),
    })),
  };
}

function applyShopImport(prepared) {
  const createdShopIds = [];
  runInTransaction(() => {
    const now = new Date().toISOString();
    const insertShop = sqlite.prepare(`INSERT INTO "Shop" (id, externalKey, name, description, ownerName, ownerDescription, city, dmNotes, discountDc, cp, sp, ep, gp, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertShopItem = sqlite.prepare(`INSERT INTO "ShopItem" (id, shopId, itemDefinitionId, nameOverride, descriptionOverride, quantity, priceCurrency, priceAmount, isSecret, discoveryDc, sortOrder, dmNotes, instanceNotes, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertFeatureState = sqlite.prepare(`INSERT INTO "ShopItemFeatureState" (id, shopItemId, itemFeatureId, usesSpent, lastResetAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)`);

    for (const shop of prepared) {
      const shopId = crypto.randomUUID();
      createdShopIds.push(shopId);
      insertShop.run(
        shopId,
        shop.externalKey,
        shop.name,
        shop.description,
        shop.ownerName,
        shop.ownerDescription,
        shop.city,
        shop.dmNotes,
        shop.discountDc,
        shop.balance.cp,
        shop.balance.sp,
        shop.balance.ep,
        shop.balance.gp,
        now,
        now
      );

      for (const [index, item] of shop.items.entries()) {
        const definition = item.source === "inline"
          ? saveItemDefinition(item.normalizedInlineDefinition)
          : item.definition;
        if (!definition) throw new Error(`Missing item definition for ${shop.name}`);
        const shopItemId = crypto.randomUUID();
        insertShopItem.run(
          shopItemId,
          shopId,
          definition.id,
          item.nameOverride,
          item.descriptionOverride,
          item.quantity,
          item.priceCurrency,
          item.priceAmount,
          item.isSecret ? 1 : 0,
          item.discoveryDc,
          index * 100,
          item.dmNotes,
          item.instanceNotes,
          item.data == null ? null : JSON.stringify(item.data),
          now,
          now
        );

        if (item.featureStates.length > 0) {
          const fullDefinition = readItemDefinition(definition.id);
          for (const state of item.featureStates) {
            const feature = fullDefinition.features.find((entry) => entry.name.toLowerCase() === String(state.featureName).trim().toLowerCase());
            if (!feature) throw new Error(`Feature not found after import: ${state.featureName}`);
            insertFeatureState.run(
              crypto.randomUUID(),
              shopItemId,
              feature.id,
              Number(state.usesSpent),
              state.lastResetAt ?? null,
              now
            );
          }
        }
      }
    }
  });
  return createdShopIds.map((id) => readDmShop(id)).filter(Boolean);
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

function readAppStateValue(key) {
  if (!tableExists("AppState")) return null;
  const row = sqlite
    .prepare('SELECT value FROM "AppState" WHERE "key" = ? LIMIT 1')
    .get(key);
  return typeof row?.value === "string" ? row.value : null;
}

function writeAppStateValue(key, value) {
  const now = new Date().toISOString();
  sqlite
    .prepare(`
      INSERT INTO "AppState" ("key", "value", "createdAt", "updatedAt")
      VALUES (?, ?, ?, ?)
      ON CONFLICT("key") DO UPDATE SET
        "value" = excluded."value",
        "updatedAt" = excluded."updatedAt"
    `)
    .run(key, value, now, now);
}

function readJsonAppState(key, fallback) {
  const value = readAppStateValue(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureInitiativeTrackerStateMigrated() {
  if (readAppStateValue(INITIATIVE_TRACKER_STATE_KEY)) return;
  if (!fs.existsSync(INITIATIVE_TRACKER_FILE)) {
    writeAppStateValue(
      INITIATIVE_TRACKER_STATE_KEY,
      JSON.stringify(emptyInitiativeTrackerState())
    );
    return;
  }

  try {
    const raw = fs.readFileSync(INITIATIVE_TRACKER_FILE, "utf8");
    const normalized = normalizeInitiativeTrackerState(JSON.parse(raw));
    writeAppStateValue(INITIATIVE_TRACKER_STATE_KEY, JSON.stringify(normalized));
  } catch {
    writeAppStateValue(
      INITIATIVE_TRACKER_STATE_KEY,
      JSON.stringify(emptyInitiativeTrackerState())
    );
  }
}

function readInitiativeTrackerState() {
  ensureInitiativeTrackerStateMigrated();
  return normalizeInitiativeTrackerState(
    readJsonAppState(INITIATIVE_TRACKER_STATE_KEY, emptyInitiativeTrackerState())
  );
}

function writeInitiativeTrackerState(state) {
  const normalized = normalizeInitiativeTrackerState({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  writeAppStateValue(INITIATIVE_TRACKER_STATE_KEY, JSON.stringify(normalized));
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
    const temporaryHitPoints = Math.max(0, Number(character?.combatStats?.temporaryHitPoints ?? 0) || 0);
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
      temporaryHitPoints,
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
      currentHitPoints: entry.type === "player" ? entry.currentHitPoints : null,
      maxHitPoints: entry.type === "player" ? entry.maxHitPoints : null,
      temporaryHitPoints: entry.type === "player" ? entry.temporaryHitPoints ?? 0 : null,
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

function normalizeCharacterBackstoryRow(row, character) {
  const contentMarkdown = typeof row?.contentMarkdown === "string" ? row.contentMarkdown : "";
  return {
    slug: character?.slug ?? row?.slug ?? null,
    characterId: character?.id ?? row?.characterId ?? null,
    contentMarkdown,
    hasBackstory: contentMarkdown.trim().length > 0,
    updatedAt: row?.updatedAt ?? null,
    updatedByUserId: row?.updatedByUserId ?? null,
  };
}

function getActiveCharacterRecordBySlug(slug) {
  ensureSqliteConnectionFresh();
  return sqlite
    .prepare('SELECT id, slug, characterType, archivedAt FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1')
    .get(slug);
}

function readCharacterBackstory(slug) {
  ensureSqliteConnectionFresh();
  const character = getActiveCharacterRecordBySlug(slug);
  if (!character) return null;

  const row = sqlite
    .prepare('SELECT * FROM "CharacterBackstory" WHERE characterId = ? LIMIT 1')
    .get(character.id);
  return normalizeCharacterBackstoryRow(row, character);
}

function writeCharacterBackstory(slug, contentMarkdown, updatedByUserId = null) {
  ensureSqliteConnectionFresh();
  const character = getActiveCharacterRecordBySlug(slug);
  if (!character) return null;

  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO "CharacterBackstory" (
      "characterId", "contentMarkdown", "updatedByUserId", "createdAt", "updatedAt"
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT("characterId") DO UPDATE SET
      "contentMarkdown" = excluded."contentMarkdown",
      "updatedByUserId" = excluded."updatedByUserId",
      "updatedAt" = excluded."updatedAt"
  `).run(character.id, String(contentMarkdown ?? ""), updatedByUserId, now, now);

  return readCharacterBackstory(slug);
}

function getLatestCampaignSessionNumber() {
  ensureSqliteConnectionFresh();
  const row = sqlite.prepare('SELECT MAX(sessionNumber) AS maxSession FROM "CampaignEvent"').get();
  const latest = Number(row?.maxSession ?? 0);
  return Number.isFinite(latest) && latest > 0 ? latest : 0;
}

function readCampaignSessionState() {
  ensureSqliteConnectionFresh();
  ensureCampaignSessionStateRow();
  const row = sqlite.prepare('SELECT * FROM "CampaignSessionState" WHERE id = 1 LIMIT 1').get();
  const lastSessionNumber = getLatestCampaignSessionNumber();
  const currentSessionNumber = Math.max(1, Number(row?.currentSessionNumber ?? lastSessionNumber + 1) || 1);
  return {
    currentSessionNumber,
    suggestedSessionNumber: Math.max(1, lastSessionNumber + 1),
    lastSessionNumber,
    updatedAt: row?.updatedAt ?? null,
    updatedByUserId: row?.updatedByUserId ?? null,
  };
}

function writeCampaignSessionState(sessionNumber, updatedByUserId = null) {
  ensureSqliteConnectionFresh();
  const currentSessionNumber = Math.max(1, Math.floor(Number(sessionNumber)) || 1);
  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO "CampaignSessionState" ("id", "currentSessionNumber", "updatedByUserId", "updatedAt")
    VALUES (1, ?, ?, ?)
    ON CONFLICT("id") DO UPDATE SET
      "currentSessionNumber" = excluded."currentSessionNumber",
      "updatedByUserId" = excluded."updatedByUserId",
      "updatedAt" = excluded."updatedAt"
  `).run(currentSessionNumber, updatedByUserId, now);
  return readCampaignSessionState();
}

function normalizeCampaignEventRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionNumber: Number(row.sessionNumber ?? 1),
    sortOrder: Number(row.sortOrder ?? 0),
    title: row.title ?? "",
    bodyMarkdown: row.bodyMarkdown ?? "",
    eventType: String(row.eventType ?? "NOTE").toLowerCase() === "document_reveal" ? "document_reveal" : "note",
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function getNextCampaignEventSortOrder(sessionNumber) {
  ensureSqliteConnectionFresh();
  const normalizedSessionNumber = Math.max(1, Math.floor(Number(sessionNumber)) || 1);
  const row = sqlite.prepare('SELECT MAX("sortOrder") AS maxSortOrder FROM "CampaignEvent" WHERE "sessionNumber" = ?').get(normalizedSessionNumber);
  const maxSortOrder = Number(row?.maxSortOrder ?? 0);
  return (Number.isFinite(maxSortOrder) ? maxSortOrder : 0) + 100;
}

function readCampaignEventVisibility(eventIds) {
  const ids = (Array.isArray(eventIds) ? eventIds : []).map((id) => String(id ?? "").trim()).filter(Boolean);
  if (ids.length === 0) return new Map();

  const placeholders = ids.map(() => "?").join(", ");
  const rows = sqlite.prepare(`
    SELECT
      ev.eventId,
      c.slug,
      c.name,
      c.className,
      c.level,
      c.characterType
    FROM "CampaignEventVisibility" ev
    JOIN "Character" c ON c.id = ev.characterId
    WHERE ev.eventId IN (${placeholders})
      AND c.archivedAt IS NULL
    ORDER BY c.name COLLATE NOCASE
  `).all(...ids);

  const byEvent = new Map(ids.map((id) => [id, []]));
  for (const row of rows) {
    const list = byEvent.get(row.eventId) ?? [];
    list.push({
      slug: row.slug,
      name: row.name,
      className: row.className ?? null,
      level: row.level == null ? null : Number(row.level),
      characterType: String(row.characterType).toLowerCase() === "png" ? "png" : "pg",
    });
    byEvent.set(row.eventId, list);
  }
  return byEvent;
}

function attachCampaignEventVisibility(events) {
  const visibilityByEvent = readCampaignEventVisibility(events.map((event) => event.id));
  return events.map((event) => ({
    ...event,
    visibleCharacters: visibilityByEvent.get(event.id) ?? [],
  }));
}

function listCampaignEventsForDm() {
  ensureSqliteConnectionFresh();
  const events = sqlite.prepare(`
    SELECT * FROM "CampaignEvent"
    ORDER BY sessionNumber DESC, sortOrder ASC, createdAt ASC
  `).all().map(normalizeCampaignEventRow).filter(Boolean);
  return attachCampaignEventVisibility(events);
}

function listCampaignEventsForCharacterSlugs(slugs) {
  ensureSqliteConnectionFresh();
  const normalizedSlugs = (Array.isArray(slugs) ? slugs : [])
    .map((slug) => String(slug ?? "").trim())
    .filter(Boolean);
  if (normalizedSlugs.length === 0) return [];

  const placeholders = normalizedSlugs.map(() => "?").join(", ");
  const events = sqlite.prepare(`
    SELECT DISTINCT e.*
    FROM "CampaignEvent" e
    JOIN "CampaignEventVisibility" ev ON ev.eventId = e.id
    JOIN "Character" c ON c.id = ev.characterId
    WHERE c.slug IN (${placeholders})
      AND c.archivedAt IS NULL
    ORDER BY e.sessionNumber DESC, e.sortOrder ASC, e.createdAt ASC
  `).all(...normalizedSlugs).map(normalizeCampaignEventRow).filter(Boolean);
  return attachCampaignEventVisibility(events).map((event) => ({
    ...event,
    visibleCharacters: event.visibleCharacters.filter((character) => normalizedSlugs.includes(character.slug)),
  }));
}

function createCampaignEvent(payload, createdByUserId = null) {
  ensureSqliteConnectionFresh();
  const sessionNumber = Math.max(1, Math.floor(Number(payload?.sessionNumber)) || 1);
  const title = String(payload?.title ?? "").trim();
  const bodyMarkdown = String(payload?.bodyMarkdown ?? "").trim();
  const eventType = String(payload?.eventType ?? "NOTE").trim().toUpperCase() === "DOCUMENT_REVEAL" ? "DOCUMENT_REVEAL" : "NOTE";
  const requestedSortOrder = Math.floor(Number(payload?.sortOrder));
  const sortOrder = Number.isFinite(requestedSortOrder) ? requestedSortOrder : getNextCampaignEventSortOrder(sessionNumber);
  const characterSlugs = Array.from(
    new Set(
      (Array.isArray(payload?.characterSlugs) ? payload.characterSlugs : [])
        .map((slug) => String(slug ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!title) {
    throw new Error("Titolo evento richiesto.");
  }
  if (characterSlugs.length === 0) {
    throw new Error("Seleziona almeno un PG destinatario.");
  }

  const placeholders = characterSlugs.map(() => "?").join(", ");
  const characters = sqlite.prepare(`
    SELECT id, slug
    FROM "Character"
    WHERE slug IN (${placeholders})
      AND archivedAt IS NULL
      AND characterType = 'PG'
  `).all(...characterSlugs);

  if (characters.length === 0) {
    throw new Error("Nessun PG valido selezionato.");
  }

  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  runInTransaction(() => {
    sqlite.prepare(`
      INSERT INTO "CampaignEvent" (
        id, sessionNumber, sortOrder, title, bodyMarkdown, eventType, createdByUserId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, sessionNumber, sortOrder, title, bodyMarkdown, eventType, createdByUserId, now, now);

    const insertVisibility = sqlite.prepare(`
      INSERT OR IGNORE INTO "CampaignEventVisibility" (id, eventId, characterId)
      VALUES (?, ?, ?)
    `);
    for (const character of characters) {
      insertVisibility.run(crypto.randomUUID(), eventId, character.id);
    }
  });

  const created = sqlite.prepare('SELECT * FROM "CampaignEvent" WHERE id = ? LIMIT 1').get(eventId);
  return attachCampaignEventVisibility([normalizeCampaignEventRow(created)]).at(0) ?? null;
}

function resolveCampaignEventCharacters(characterSlugs) {
  ensureSqliteConnectionFresh();
  const slugs = Array.from(
    new Set(
      (Array.isArray(characterSlugs) ? characterSlugs : [])
        .map((slug) => String(slug ?? "").trim())
        .filter(Boolean)
    )
  );
  if (slugs.length === 0) {
    throw new Error("Seleziona almeno un PG destinatario.");
  }

  const placeholders = slugs.map(() => "?").join(", ");
  const characters = sqlite.prepare(`
    SELECT id, slug
    FROM "Character"
    WHERE slug IN (${placeholders})
      AND archivedAt IS NULL
      AND characterType = 'PG'
  `).all(...slugs);

  if (characters.length === 0) {
    throw new Error("Nessun PG valido selezionato.");
  }
  return characters;
}

function readCampaignEventById(eventId) {
  ensureSqliteConnectionFresh();
  const row = sqlite.prepare('SELECT * FROM "CampaignEvent" WHERE id = ? LIMIT 1').get(String(eventId ?? ""));
  const event = normalizeCampaignEventRow(row);
  return event ? attachCampaignEventVisibility([event]).at(0) ?? null : null;
}

function updateCampaignEvent(eventId, payload) {
  ensureSqliteConnectionFresh();
  const id = String(eventId ?? "").trim();
  const existing = sqlite.prepare('SELECT * FROM "CampaignEvent" WHERE id = ? LIMIT 1').get(id);
  if (!existing) {
    const error = new Error("Evento non trovato.");
    error.status = 404;
    throw error;
  }

  const sessionNumber = Math.max(1, Math.floor(Number(payload?.sessionNumber ?? existing.sessionNumber)) || 1);
  const title = String(payload?.title ?? existing.title ?? "").trim();
  const bodyMarkdown = String(payload?.bodyMarkdown ?? existing.bodyMarkdown ?? "").trim();
  const eventType = String(payload?.eventType ?? existing.eventType ?? "NOTE").trim().toUpperCase() === "DOCUMENT_REVEAL" ? "DOCUMENT_REVEAL" : "NOTE";
  const sortOrderValue = Math.floor(Number(payload?.sortOrder ?? existing.sortOrder ?? 0));
  const sortOrder = Number.isFinite(sortOrderValue) ? sortOrderValue : Number(existing.sortOrder ?? 0);
  const shouldUpdateVisibility = Array.isArray(payload?.characterSlugs);
  const characters = shouldUpdateVisibility ? resolveCampaignEventCharacters(payload.characterSlugs) : [];
  if (!title) {
    throw new Error("Titolo evento richiesto.");
  }

  const now = new Date().toISOString();
  runInTransaction(() => {
    sqlite.prepare(`
      UPDATE "CampaignEvent"
      SET
        "sessionNumber" = ?,
        "sortOrder" = ?,
        "title" = ?,
        "bodyMarkdown" = ?,
        "eventType" = ?,
        "updatedAt" = ?
      WHERE "id" = ?
    `).run(sessionNumber, sortOrder, title, bodyMarkdown, eventType, now, id);

    if (shouldUpdateVisibility) {
      sqlite.prepare('DELETE FROM "CampaignEventVisibility" WHERE "eventId" = ?').run(id);
      const insertVisibility = sqlite.prepare(`
        INSERT OR IGNORE INTO "CampaignEventVisibility" (id, eventId, characterId)
        VALUES (?, ?, ?)
      `);
      for (const character of characters) {
        insertVisibility.run(crypto.randomUUID(), id, character.id);
      }
    }
  });

  return readCampaignEventById(id);
}

function deleteCampaignEvent(eventId) {
  ensureSqliteConnectionFresh();
  const info = sqlite.prepare('DELETE FROM "CampaignEvent" WHERE id = ?').run(String(eventId ?? "").trim());
  return info.changes > 0;
}

function swapCampaignEventSortOrders(eventId, targetEventId) {
  ensureSqliteConnectionFresh();
  const firstId = String(eventId ?? "").trim();
  const secondId = String(targetEventId ?? "").trim();
  if (!firstId || !secondId || firstId === secondId) {
    throw new Error("Eventi da scambiare non validi.");
  }

  const first = sqlite.prepare('SELECT id, sessionNumber, sortOrder FROM "CampaignEvent" WHERE id = ? LIMIT 1').get(firstId);
  const second = sqlite.prepare('SELECT id, sessionNumber, sortOrder FROM "CampaignEvent" WHERE id = ? LIMIT 1').get(secondId);
  if (!first || !second) {
    throw new Error("Uno o piu eventi non esistono.");
  }
  if (Number(first.sessionNumber) !== Number(second.sessionNumber)) {
    throw new Error("Puoi riordinare solo eventi della stessa sessione.");
  }

  runInTransaction(() => {
    const update = sqlite.prepare('UPDATE "CampaignEvent" SET "sortOrder" = ?, "updatedAt" = ? WHERE "id" = ?');
    const now = new Date().toISOString();
    update.run(Number(second.sortOrder ?? 0), now, first.id);
    update.run(Number(first.sortOrder ?? 0), now, second.id);
  });

  return listCampaignEventsForDm();
}

function normalizeCampaignImportJson(rawPayload) {
  if (Array.isArray(rawPayload)) return rawPayload;
  if (Array.isArray(rawPayload?.events)) return rawPayload.events;
  if (Array.isArray(rawPayload?.eventi)) return rawPayload.eventi;
  return null;
}

function resolveCampaignImportRecipients(rawRecipients, activePgCharacters) {
  const recipients = Array.isArray(rawRecipients)
    ? rawRecipients
    : typeof rawRecipients === "string"
      ? [rawRecipients]
      : [];

  const allAliases = new Set(["all", "tutti", "party", "gruppo"]);
  if (recipients.some((entry) => allAliases.has(String(entry ?? "").trim().toLowerCase()))) {
    return {
      slugs: activePgCharacters.map((character) => character.slug),
      unresolved: [],
    };
  }

  const bySlug = new Map(activePgCharacters.map((character) => [String(character.slug).toLowerCase(), character.slug]));
  const byName = new Map(activePgCharacters.map((character) => [String(character.basicInfo?.characterName ?? character.slug).toLowerCase(), character.slug]));
  const slugs = [];
  const unresolved = [];

  for (const rawRecipient of recipients) {
    const key = String(rawRecipient ?? "").trim();
    if (!key) continue;
    const normalized = key.toLowerCase();
    const slug = bySlug.get(normalized) ?? byName.get(normalized);
    if (slug) slugs.push(slug);
    else unresolved.push(key);
  }

  return {
    slugs: Array.from(new Set(slugs)),
    unresolved,
  };
}

function previewCampaignEventImportPayload(rawPayload) {
  ensureSqliteConnectionFresh();
  const rawEvents = normalizeCampaignImportJson(rawPayload);
  const activePgCharacters = listCharacters().filter((character) => character.characterType === "pg");

  if (!rawEvents) {
    return {
      ok: false,
      errors: ["Il JSON deve essere un array o un oggetto con proprieta 'events'."],
      events: [],
    };
  }

  const errors = [];
  const events = rawEvents.map((entry, index) => {
    const rowNumber = index + 1;
    const sessionNumber = Math.floor(Number(entry?.sessionNumber ?? entry?.sessione ?? entry?.session));
    const explicitSortOrder = Math.floor(Number(entry?.sortOrder ?? entry?.order ?? entry?.ordine));
    const title = String(entry?.title ?? entry?.titolo ?? "").trim();
    const bodyMarkdown = String(entry?.bodyMarkdown ?? entry?.body ?? entry?.text ?? entry?.testo ?? entry?.description ?? "").trim();
    const recipients = entry?.characterSlugs ?? entry?.visibleTo ?? entry?.destinatari ?? entry?.pg ?? entry?.characters;
    const resolved = resolveCampaignImportRecipients(recipients, activePgCharacters);

    if (!Number.isFinite(sessionNumber) || sessionNumber <= 0) {
      errors.push(`Evento #${rowNumber}: sessionNumber/sessione non valido.`);
    }
    if (!title) {
      errors.push(`Evento #${rowNumber}: titolo mancante.`);
    }
    if (resolved.slugs.length === 0) {
      errors.push(`Evento #${rowNumber}: nessun PG destinatario valido.`);
    }
    if (resolved.unresolved.length > 0) {
      errors.push(`Evento #${rowNumber}: destinatari non riconosciuti: ${resolved.unresolved.join(", ")}.`);
    }

    return {
      index: rowNumber,
      sessionNumber: Number.isFinite(sessionNumber) ? sessionNumber : null,
      sortOrder: Number.isFinite(explicitSortOrder) ? explicitSortOrder : null,
      title,
      bodyMarkdown,
      characterSlugs: resolved.slugs,
      visibleCharacters: resolved.slugs.map((slug) => {
        const character = activePgCharacters.find((entry) => entry.slug === slug);
        return {
          slug,
          name: character?.basicInfo?.characterName ?? slug,
        };
      }),
    };
  });

  return {
    ok: errors.length === 0,
    errors,
    events,
  };
}

function importCampaignEvents(rawPayload, createdByUserId = null) {
  const preview = previewCampaignEventImportPayload(rawPayload);
  if (!preview.ok) return { ...preview, importedEvents: [] };

  const nextSortOrderBySession = new Map();
  const importedEvents = preview.events.map((event) =>
    {
      const sessionNumber = Number(event.sessionNumber);
      if (!nextSortOrderBySession.has(sessionNumber)) {
        nextSortOrderBySession.set(sessionNumber, getNextCampaignEventSortOrder(sessionNumber));
      }
      const fallbackSortOrder = nextSortOrderBySession.get(sessionNumber);
      nextSortOrderBySession.set(sessionNumber, fallbackSortOrder + 100);
      return createCampaignEvent(
        {
          sessionNumber: event.sessionNumber,
          sortOrder: event.sortOrder ?? fallbackSortOrder,
          title: event.title,
          bodyMarkdown: event.bodyMarkdown,
          characterSlugs: event.characterSlugs,
        },
        createdByUserId
      );
    }
  ).filter(Boolean);

  return {
    ...preview,
    importedEvents,
  };
}

function normalizeCampaignDocumentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    kind: String(row.kind ?? "TEXT").toLowerCase() === "image" ? "image" : "text",
    language: row.language ?? "Comune",
    contentMarkdown: row.contentMarkdown ?? "",
    imageUrl: row.imageUrl ?? null,
    unreadableImageUrl: row.unreadableImageUrl ?? null,
    sessionNumber: row.sessionNumber == null ? null : Number(row.sessionNumber),
    revealEventId: row.revealEventId ?? null,
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function readCampaignDocumentVisibility(documentIds) {
  const ids = (Array.isArray(documentIds) ? documentIds : []).map((id) => String(id ?? "").trim()).filter(Boolean);
  if (ids.length === 0) return new Map();

  const placeholders = ids.map(() => "?").join(", ");
  const rows = sqlite.prepare(`
    SELECT
      dv.documentId,
      c.slug,
      c.name,
      c.className,
      c.level,
      c.characterType
    FROM "CampaignDocumentVisibility" dv
    JOIN "Character" c ON c.id = dv.characterId
    WHERE dv.documentId IN (${placeholders})
      AND c.archivedAt IS NULL
    ORDER BY c.name COLLATE NOCASE
  `).all(...ids);

  const byDocument = new Map(ids.map((id) => [id, []]));
  for (const row of rows) {
    const list = byDocument.get(row.documentId) ?? [];
    list.push({
      slug: row.slug,
      name: row.name,
      className: row.className ?? null,
      level: row.level == null ? null : Number(row.level),
      characterType: String(row.characterType).toLowerCase() === "png" ? "png" : "pg",
    });
    byDocument.set(row.documentId, list);
  }
  return byDocument;
}

function attachCampaignDocumentVisibility(documents) {
  const visibilityByDocument = readCampaignDocumentVisibility(documents.map((document) => document.id));
  return documents.map((document) => ({
    ...document,
    visibleCharacters: visibilityByDocument.get(document.id) ?? [],
  }));
}

function listCampaignDocumentsForDm() {
  ensureSqliteConnectionFresh();
  const documents = sqlite.prepare(`
    SELECT * FROM "CampaignDocument"
    ORDER BY COALESCE(sessionNumber, 999999) ASC, title COLLATE NOCASE ASC, createdAt ASC
  `).all().map(normalizeCampaignDocumentRow).filter(Boolean);
  return attachCampaignDocumentVisibility(documents);
}

function listCampaignDocumentsForCharacterSlugs(slugs) {
  ensureSqliteConnectionFresh();
  const normalizedSlugs = (Array.isArray(slugs) ? slugs : [])
    .map((slug) => String(slug ?? "").trim())
    .filter(Boolean);
  if (normalizedSlugs.length === 0) return [];

  const placeholders = normalizedSlugs.map(() => "?").join(", ");
  const documents = sqlite.prepare(`
    SELECT DISTINCT d.*
    FROM "CampaignDocument" d
    JOIN "CampaignDocumentVisibility" dv ON dv.documentId = d.id
    JOIN "Character" c ON c.id = dv.characterId
    WHERE c.slug IN (${placeholders})
      AND c.archivedAt IS NULL
      AND d.sessionNumber IS NOT NULL
    ORDER BY d.sessionNumber ASC, d.title COLLATE NOCASE ASC
  `).all(...normalizedSlugs).map(normalizeCampaignDocumentRow).filter(Boolean);
  return attachCampaignDocumentVisibility(documents).map((document) => ({
    ...document,
    visibleCharacters: document.visibleCharacters.filter((character) => normalizedSlugs.includes(character.slug)),
  }));
}

function normalizeCampaignDocumentPayload(payload) {
  const title = String(payload?.title ?? "").trim();
  const kind = String(payload?.kind ?? "TEXT").trim().toUpperCase() === "IMAGE" ? "IMAGE" : "TEXT";
  const language = String(payload?.language ?? "Comune").trim() || "Comune";
  const description = String(payload?.description ?? "").trim();
  const contentMarkdown = String(payload?.contentMarkdown ?? payload?.bodyMarkdown ?? "").trim();
  const imageUrl = String(payload?.imageUrl ?? "").trim() || null;
  const unreadableImageUrl = String(payload?.unreadableImageUrl ?? "").trim() || null;

  if (!title) {
    throw new Error("Titolo documento richiesto.");
  }
  if (kind === "IMAGE" && !imageUrl) {
    throw new Error("Per un documento immagine serve un URL immagine.");
  }

  return {
    title,
    kind,
    language,
    description,
    contentMarkdown,
    imageUrl,
    unreadableImageUrl,
  };
}

function writeCampaignDocumentVisibility(documentId, characterSlugs) {
  sqlite.prepare('DELETE FROM "CampaignDocumentVisibility" WHERE "documentId" = ?').run(documentId);
  const slugs = Array.isArray(characterSlugs) ? characterSlugs.filter((slug) => String(slug ?? "").trim()) : [];
  if (slugs.length === 0) return [];

  const characters = resolveCampaignEventCharacters(slugs);
  const insertVisibility = sqlite.prepare(`
    INSERT OR IGNORE INTO "CampaignDocumentVisibility" (id, documentId, characterId)
    VALUES (?, ?, ?)
  `);
  for (const character of characters) {
    insertVisibility.run(crypto.randomUUID(), documentId, character.id);
  }
  return characters;
}

function readCampaignDocumentById(documentId) {
  ensureSqliteConnectionFresh();
  const row = sqlite.prepare('SELECT * FROM "CampaignDocument" WHERE id = ? LIMIT 1').get(String(documentId ?? "").trim());
  const document = normalizeCampaignDocumentRow(row);
  return document ? attachCampaignDocumentVisibility([document]).at(0) ?? null : null;
}

function createCampaignDocument(payload, createdByUserId = null) {
  ensureSqliteConnectionFresh();
  const normalized = normalizeCampaignDocumentPayload(payload);
  const documentId = crypto.randomUUID();
  const now = new Date().toISOString();
  runInTransaction(() => {
    sqlite.prepare(`
      INSERT INTO "CampaignDocument" (
        id, title, description, kind, language, contentMarkdown, imageUrl, unreadableImageUrl,
        sessionNumber, revealEventId, createdByUserId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    `).run(
      documentId,
      normalized.title,
      normalized.description,
      normalized.kind,
      normalized.language,
      normalized.contentMarkdown,
      normalized.imageUrl,
      normalized.unreadableImageUrl,
      createdByUserId,
      now,
      now
    );
    if (Array.isArray(payload?.characterSlugs)) {
      writeCampaignDocumentVisibility(documentId, payload.characterSlugs);
    }
  });

  return readCampaignDocumentById(documentId);
}

function updateCampaignDocument(documentId, payload) {
  ensureSqliteConnectionFresh();
  const id = String(documentId ?? "").trim();
  const existing = sqlite.prepare('SELECT * FROM "CampaignDocument" WHERE id = ? LIMIT 1').get(id);
  if (!existing) {
    const error = new Error("Documento non trovato.");
    error.status = 404;
    throw error;
  }

  const normalized = normalizeCampaignDocumentPayload({ ...existing, ...(payload ?? {}) });
  const now = new Date().toISOString();
  runInTransaction(() => {
    sqlite.prepare(`
      UPDATE "CampaignDocument"
      SET
        "title" = ?,
        "description" = ?,
        "kind" = ?,
        "language" = ?,
        "contentMarkdown" = ?,
        "imageUrl" = ?,
        "unreadableImageUrl" = ?,
        "updatedAt" = ?
      WHERE "id" = ?
    `).run(
      normalized.title,
      normalized.description,
      normalized.kind,
      normalized.language,
      normalized.contentMarkdown,
      normalized.imageUrl,
      normalized.unreadableImageUrl,
      now,
      id
    );
    if (Array.isArray(payload?.characterSlugs)) {
      writeCampaignDocumentVisibility(id, payload.characterSlugs);
    }
  });

  return readCampaignDocumentById(id);
}

function deleteCampaignDocument(documentId) {
  ensureSqliteConnectionFresh();
  const id = String(documentId ?? "").trim();
  const existing = sqlite.prepare('SELECT revealEventId FROM "CampaignDocument" WHERE id = ? LIMIT 1').get(id);
  if (!existing) return false;

  runInTransaction(() => {
    sqlite.prepare('DELETE FROM "CampaignDocument" WHERE id = ?').run(id);
    if (existing.revealEventId) {
      sqlite.prepare('DELETE FROM "CampaignEvent" WHERE id = ?').run(existing.revealEventId);
    }
  });
  return true;
}

function buildCampaignDocumentRevealMarkdown(document) {
  const lines = [`Documento disponibile nell'Archivio documenti: **${document.title}**.`];
  if (document.description) {
    lines.push("", document.description);
  }
  return lines.join("\n");
}

function publishCampaignDocument(documentId, payload, createdByUserId = null) {
  ensureSqliteConnectionFresh();
  const id = String(documentId ?? "").trim();
  const existing = readCampaignDocumentById(id);
  if (!existing) {
    const error = new Error("Documento non trovato.");
    error.status = 404;
    throw error;
  }

  const sessionNumber = Math.max(1, Math.floor(Number(payload?.sessionNumber ?? existing.sessionNumber)) || 1);
  const characters = resolveCampaignEventCharacters(payload?.characterSlugs ?? existing.visibleCharacters.map((character) => character.slug));
  const characterSlugs = characters.map((character) => character.slug);
  let revealEventId = existing.revealEventId;
  const now = new Date().toISOString();

  writeCampaignDocumentVisibility(id, characterSlugs);

  const eventPayload = {
    sessionNumber,
    title: `Documento: ${existing.title}`,
    bodyMarkdown: buildCampaignDocumentRevealMarkdown(existing),
    eventType: "DOCUMENT_REVEAL",
    characterSlugs,
  };

  if (revealEventId) {
    updateCampaignEvent(revealEventId, eventPayload);
  } else {
    const event = createCampaignEvent(eventPayload, createdByUserId);
    revealEventId = event?.id ?? null;
  }

  sqlite.prepare(`
    UPDATE "CampaignDocument"
    SET "sessionNumber" = ?, "revealEventId" = ?, "updatedAt" = ?
    WHERE "id" = ?
  `).run(sessionNumber, revealEventId, now, id);

  return readCampaignDocumentById(id);
}

function broadcastCampaignDocumentReveal(io, document) {
  if (!io || !document) return;
  const ownership = readOwnership();
  for (const character of document.visibleCharacters ?? []) {
    const payload = {
      document,
      character: {
        slug: character.slug,
        name: character.name,
      },
      revealedAt: new Date().toISOString(),
    };
    const ownerUserId = ownership[character.slug];
    if (ownerUserId) {
      io.to(`user:${ownerUserId}`).emit("campaign-document:reveal", payload);
    }
    io.to(`char:${character.slug}`).emit("campaign-document:reveal", payload);
  }
}

function broadcastShopVisit(io, eventName, visitRow) {
  if (!io || !visitRow) return;
  const payload = {
    visit: serializeShopVisit(visitRow),
    occurredAt: new Date().toISOString(),
  };
  const ownership = readOwnership();
  const ownerUserId = ownership[visitRow.characterSlug];
  if (ownerUserId) {
    io.to(`user:${ownerUserId}`).emit(eventName, payload);
  }
  io.to(`char:${visitRow.characterSlug}`).emit(eventName, payload);
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

function getLoginRateLimitKeys(req, username) {
  const ip = getClientIp(req);
  const normalizedUsername = String(username || "").trim().toLowerCase() || "unknown";
  return [`ip:${ip}`, `user:${normalizedUsername}`];
}

function getLoginRateLimitStatus(req, username) {
  const now = Date.now();
  const keys = getLoginRateLimitKeys(req, username);

  for (const key of keys) {
    const entry = loginAttempts.get(key);
    if (!entry) continue;
    if (entry.resetAt <= now) {
      loginAttempts.delete(key);
      continue;
    }
    if (entry.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }
  }

  return { limited: false, retryAfterSeconds: 0 };
}

function recordFailedLogin(req, username) {
  const now = Date.now();
  for (const key of getLoginRateLimitKeys(req, username)) {
    const entry = loginAttempts.get(key);
    if (!entry || entry.resetAt <= now) {
      loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
      continue;
    }
    entry.count += 1;
  }
}

function clearLoginRateLimit(req, username) {
  for (const key of getLoginRateLimitKeys(req, username)) {
    loginAttempts.delete(key);
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

const HIT_DICE_BY_CLASS = {
  barbaro: "1d12",
  barbarian: "1d12",
  guerriero: "1d10",
  fighter: "1d10",
  paladino: "1d10",
  paladin: "1d10",
  ranger: "1d10",
  bardo: "1d8",
  bard: "1d8",
  chierico: "1d8",
  cleric: "1d8",
  druido: "1d8",
  druid: "1d8",
  monaco: "1d8",
  monk: "1d8",
  ladro: "1d8",
  rogue: "1d8",
  warlock: "1d8",
  stregone: "1d6",
  sorcerer: "1d6",
  mago: "1d6",
  wizard: "1d6",
};

function normalizeRestClassName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseHitDieSize(hitDice, className) {
  const fallback = HIT_DICE_BY_CLASS[normalizeRestClassName(className)] ?? "1d8";
  const source = String(hitDice || fallback);
  const match = source.match(/d\s*(\d+)/i);
  const size = match ? Number(match[1]) : 8;
  return Number.isFinite(size) && size > 0 ? size : 8;
}

function getFixedHitDieHealing(hitDieSize, constitutionScore) {
  const conScore = Number.isFinite(Number(constitutionScore)) ? Number(constitutionScore) : 10;
  const conMod = Math.floor((conScore - 10) / 2);
  return Math.max(1, Math.floor(hitDieSize / 2) + 1 + conMod);
}

function resetCapabilityUses(capabilities, restType) {
  return (Array.isArray(capabilities) ? capabilities : []).map((capability) => {
    const usage = capability?.usage;
    if (!usage || !Array.isArray(usage.used)) return capability;

    const resetOn = String(usage.resetOn ?? "").trim();
    const shouldReset =
      restType === "long"
        ? resetOn === "shortRest" || resetOn === "longRest"
        : resetOn === "shortRest";
    if (!shouldReset) return capability;

    return {
      ...capability,
      usage: {
        ...usage,
        used: usage.used.map(() => false),
      },
    };
  });
}

function resetSpellSlotsForRest(spellSlots, className, restType) {
  const normalizedClass = normalizeRestClassName(className);
  const resetOnShortRest = normalizedClass === "warlock" || normalizedClass === "guerriero" || normalizedClass === "fighter";
  if (restType === "short" && !resetOnShortRest) return spellSlots;

  const next = {};
  for (const [level, slots] of Object.entries(spellSlots ?? {})) {
    next[level] = Array.isArray(slots) ? slots.map((slot) => ({ ...slot, active: false })) : slots;
  }
  return next;
}

function applyCharacterRest(character, restType) {
  const data = character && typeof character === "object" ? character : {};
  const basicInfo = data.basicInfo ?? {};
  const combatStats = data.combatStats ?? {};
  const level = Math.max(1, Math.floor(Number(basicInfo.level ?? 1)) || 1);
  const maxHp = Math.max(0, Math.floor(Number(combatStats.hitPointMaximum ?? 0)) || 0);
  const currentHp = Math.max(0, Math.floor(Number(combatStats.currentHitPoints ?? 0)) || 0);
  const hitDieSize = parseHitDieSize(combatStats.hitDice, basicInfo.class);
  const restState = combatStats.restState && typeof combatStats.restState === "object" ? combatStats.restState : {};
  const maxHitDice = Math.max(1, level, Math.floor(Number(restState.maxHitDice ?? level)) || level);
  const hitDiceRemaining = Math.max(
    0,
    Math.min(maxHitDice, Math.floor(Number(restState.hitDiceRemaining ?? maxHitDice)) || 0)
  );
  const shortRestsUsed = Math.max(0, Math.floor(Number(restState.shortRestsUsedSinceLongRest ?? 0)) || 0);

  let nextCombatStats = {
    ...combatStats,
    deathSaves: { successes: 0, failures: 0 },
    spellSlots: resetSpellSlotsForRest(combatStats.spellSlots ?? {}, basicInfo.class, restType),
  };
  let healingApplied = 0;
  let hitDiceSpent = 0;
  let restApplied = true;
  let blockedReason = null;

  if (restType === "long") {
    nextCombatStats = {
      ...nextCombatStats,
      currentHitPoints: maxHp,
      temporaryHitPoints: 0,
      restState: {
        ...restState,
        maxHitDice,
        hitDiceRemaining: maxHitDice,
        shortRestsUsedSinceLongRest: 0,
        lastLongRestAt: new Date().toISOString(),
      },
    };
  } else {
    if (shortRestsUsed >= 2) {
      restApplied = false;
      blockedReason = "Limite di 2 riposi brevi raggiunto.";
    } else {
      const missingHp = Math.max(0, maxHp - currentHp);
      const budget = maxHitDice > 0 ? Math.max(1, Math.floor(maxHitDice / 2)) : 0;
      const usableHitDice = Math.min(budget, hitDiceRemaining);
      const healingPerDie = getFixedHitDieHealing(hitDieSize, data.abilityScores?.constitution);

      if (missingHp > 0 && usableHitDice > 0) {
        hitDiceSpent = Math.min(usableHitDice, Math.ceil(missingHp / healingPerDie));
        healingApplied = Math.min(missingHp, hitDiceSpent * healingPerDie);
      }

      nextCombatStats = {
        ...nextCombatStats,
        currentHitPoints: Math.min(maxHp, currentHp + healingApplied),
        restState: {
          ...restState,
          maxHitDice,
          hitDiceRemaining: Math.max(0, hitDiceRemaining - hitDiceSpent),
          shortRestsUsedSinceLongRest: shortRestsUsed + 1,
          lastShortRestAt: new Date().toISOString(),
        },
      };
    }
  }

  if (!restApplied) {
    return {
      character: data,
      summary: {
        slug: data.slug,
        name: basicInfo.characterName ?? data.slug,
        applied: false,
        reason: blockedReason,
        currentHitPointsBefore: currentHp,
        currentHitPointsAfter: currentHp,
        maxHitPoints: maxHp,
        temporaryHitPointsBefore: Math.max(0, Math.floor(Number(combatStats.temporaryHitPoints ?? 0)) || 0),
        temporaryHitPointsAfter: Math.max(0, Math.floor(Number(combatStats.temporaryHitPoints ?? 0)) || 0),
        healingApplied: 0,
        hitDiceSpent: 0,
        hitDiceRemaining,
        hitDiceRemainingAfter: hitDiceRemaining,
        maxHitDice,
        shortRestsUsedSinceLongRest: shortRestsUsed,
        shortRestsUsedSinceLongRestAfter: shortRestsUsed,
      },
    };
  }

  const nextCurrentHp = Math.max(0, Math.floor(Number(nextCombatStats.currentHitPoints ?? currentHp)) || 0);
  const tempHpBefore = Math.max(0, Math.floor(Number(combatStats.temporaryHitPoints ?? 0)) || 0);
  const tempHpAfter = Math.max(0, Math.floor(Number(nextCombatStats.temporaryHitPoints ?? tempHpBefore)) || 0);
  const nextHitDiceRemaining = nextCombatStats.restState?.hitDiceRemaining ?? hitDiceRemaining;
  const nextShortRestsUsed = nextCombatStats.restState?.shortRestsUsedSinceLongRest ?? shortRestsUsed;

  return {
    character: {
      ...data,
      combatStats: nextCombatStats,
      capabilities: resetCapabilityUses(data.capabilities, restType),
    },
    summary: {
      slug: data.slug,
      name: basicInfo.characterName ?? data.slug,
      applied: true,
      currentHitPointsBefore: currentHp,
      currentHitPointsAfter: nextCurrentHp,
      maxHitPoints: maxHp,
      temporaryHitPointsBefore: tempHpBefore,
      temporaryHitPointsAfter: tempHpAfter,
      healingApplied,
      hitDiceSpent,
      hitDiceRemaining,
      hitDiceRemainingAfter: nextHitDiceRemaining,
      maxHitDice,
      shortRestsUsedSinceLongRest: shortRestsUsed,
      shortRestsUsedSinceLongRestAfter: nextShortRestsUsed,
    },
  };
}

function resetCharacterItemFeatureStatesForRest(characterSlugs, restType) {
  if (!tableExists("CharacterItemFeatureState")) return;
  const normalizedSlugs = (Array.isArray(characterSlugs) ? characterSlugs : [])
    .map((slug) => String(slug ?? "").trim())
    .filter(Boolean);
  if (normalizedSlugs.length === 0) return;

  const resetValues =
    restType === "long"
      ? ["SHORT_REST", "LONG_REST", "DAILY"]
      : ["SHORT_REST"];
  const now = new Date().toISOString();
  const slugPlaceholders = normalizedSlugs.map(() => "?").join(", ");
  const resetPlaceholders = resetValues.map(() => "?").join(", ");

  sqlite.prepare(`
    UPDATE "CharacterItemFeatureState"
    SET usesSpent = 0, lastResetAt = ?, updatedAt = ?
    WHERE characterItemId IN (
      SELECT ci.id
      FROM "CharacterItem" ci
      JOIN "Character" c ON c.id = ci.characterId
      JOIN "ItemFeature" f ON f.itemDefinitionId = ci.itemDefinitionId
      WHERE c.slug IN (${slugPlaceholders})
        AND f.id = "CharacterItemFeatureState".itemFeatureId
        AND f.resetOn IN (${resetPlaceholders})
    )
  `).run(now, now, ...normalizedSlugs, ...resetValues);
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
  if (TRUST_PROXY !== "0" && TRUST_PROXY.toLowerCase() !== "false") {
    app.set("trust proxy", TRUST_PROXY === "1" || TRUST_PROXY.toLowerCase() === "true" ? 1 : TRUST_PROXY);
  }
  app.use(express.json({ limit: "10mb" }));
  ensureDir(PORTRAIT_DIR);
  ensureDir(CAMPAIGN_DOCUMENT_DIR);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    if (isProd && shouldUseSecureSessionCookie(req)) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });
  app.use((req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();

    const origin = req.headers.origin;
    if (!origin) return next();

    const allowedOrigins = new Set([getRequestOrigin(req), ...getAllowedOrigins()]);
    if (allowedOrigins.has(origin)) return next();

    return res.status(403).json({ error: "Invalid request origin" });
  });
  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const shouldLogRequest = REQUEST_LOG_PATHS.has(req.path) || req.path.startsWith("/socket.io/");
    if (shouldLogRequest) {
      console.log(`[server] request start ${req.method} ${req.originalUrl} from ${req.ip}`);
    }
    res.on("finish", () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (shouldLogRequest) {
        console.log(
          `[server] request done ${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(0)}ms from ${req.ip}`
        );
      }
      if (elapsedMs >= SLOW_REQUEST_THRESHOLD_MS) {
        console.warn(
          `[server] slow request ${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(0)}ms from ${req.ip}`
        );
      }
    });
    next();
  });
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

  app.use("/portraits", requireAuth, express.static(PORTRAIT_DIR, {
    maxAge: PORTRAIT_CACHE_MAX_AGE,
  }));
  app.use("/campaign-documents", requireAuth, express.static(CAMPAIGN_DOCUMENT_DIR, {
    maxAge: CAMPAIGN_DOCUMENT_CACHE_MAX_AGE,
  }));

  // ===== Auth =====
  app.get("/healthz", (_req, res) => {
    return res.json({ ok: true });
  });

  app.post("/api/admin/backups/database", (req, res) => {
    const rateLimit = getBackupRateLimitStatus(req);
    if (rateLimit.limited) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return res.status(429).json({ error: "Too many requests" });
    }

    const configuredToken = getConfiguredBackupToken();
    const providedToken = getBearerToken(req);
    if (
      configuredToken.length < 32 ||
      !providedToken ||
      !timingSafeStringEqual(providedToken, configuredToken)
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    clearBackupRateLimit(req);

    let backup = null;
    const cleanup = () => {
      if (!backup?.backupPath) return;
      try {
        fs.rmSync(backup.backupPath, { force: true });
      } catch (error) {
        console.warn(`[server] failed to remove temporary database backup ${backup.backupPath}: ${error.message}`);
      }
    };

    try {
      backup = createSqliteBackupFile();
      console.log(`[server] database backup created for download: ${backup.fileName} (${backup.size} bytes)`);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Backup-Sha256", backup.checksum);
      res.setHeader("X-Backup-Size", String(backup.size));
      res.download(backup.backupPath, backup.fileName, (error) => {
        cleanup();
        if (error && !res.headersSent) {
          return res.status(500).json({ error: "Backup download failed" });
        }
        if (error) {
          console.warn(`[server] database backup download failed: ${error.message}`);
        }
      });
    } catch (error) {
      cleanup();
      console.error(`[server] database backup failed: ${error.message}`);
      return res.status(500).json({ error: "Backup failed" });
    }
  });

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
    const rateLimit = getLoginRateLimitStatus(req, username);

    if (rateLimit.limited) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return res.status(429).json({ error: "Too many login attempts. Try again later." });
    }

    const users = readUsers();
    const user = users.find((entry) => String(entry.username).toLowerCase() === username);

    if (!user || !verifyPassword(password, user)) {
      recordFailedLogin(req, username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearLoginRateLimit(req, username);
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

    if (newPassword.trim().length < PASSWORD_MIN_LENGTH) {
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

    const temporaryPassword = generateTemporaryPassword();
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const newUser = {
      id: createUserId(username),
      username,
      displayName: displayNameRaw || username,
      role,
      passwordSalt,
      passwordHash: hashPassword(temporaryPassword, passwordSalt),
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };

    createUserRecord(newUser);
    return res.status(201).json({
      ...sanitizeUserForAdmin(newUser, readOwnership()),
      temporaryPassword,
    });
  });

  app.post("/api/users/:userId/reset-password", requireRole("dm"), (req, res) => {
    const userId = req.params.userId;
    const currentUser = getUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const updatedUser = updateUserCredentials(userId, {
      passwordSalt,
      passwordHash: hashPassword(temporaryPassword, passwordSalt),
      mustChangePassword: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    deleteSessionsByUserId(userId);
    return res.json({
      ...sanitizeUserForAdmin(updatedUser, readOwnership()),
      temporaryPassword,
    });
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

  // ===== Shops: phase 1 administration =====
  app.get("/api/dm/shops", requireRole("dm"), (req, res) => {
    try {
      return res.json(readDmShops({ includeArchived: req.query.includeArchived === "true" }));
    } catch (error) {
      return res.status(503).json({ error: String(error?.message ?? error) });
    }
  });

  app.get("/api/dm/shops/import/catalog-index", requireRole("dm"), (req, res) => {
    try {
      requireShopTables();
      return res.json({ items: buildShopImportCatalogIndex() });
    } catch (error) {
      return res.status(503).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/dm/shops/import", requireRole("dm"), (req, res) => {
    try {
      const dryRun = req.body?.dryRun !== false;
      const payload = req.body?.payload;
      const { errors, warnings, prepared } = validateShopImportPayload(payload);
      const preview = previewShopImport(prepared, errors, warnings);
      if (errors.length > 0) {
        return res.status(400).json({ error: "Shop import contains validation errors", details: preview });
      }
      if (dryRun) {
        return res.json(preview);
      }
      const shops = applyShopImport(prepared);
      return res.status(201).json({ ...preview, createdShops: shops });
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.get("/api/dm/shops/:shopId", requireRole("dm"), (req, res) => {
    try {
      const shop = readDmShop(req.params.shopId);
      return shop ? res.json(shop) : res.status(404).json({ error: "Shop not found" });
    } catch (error) {
      return res.status(503).json({ error: String(error?.message ?? error) });
    }
  });

  app.get("/api/dm/shops/:shopId/characters/:slug/profile", requireRole("dm"), (req, res) => {
    try {
      const profile = readOrCreateShopCharacterProfile(req.params.shopId, req.params.slug);
      return profile ? res.json(profile) : res.status(404).json({ error: "Shop not found" });
    } catch (error) {
      const status = Number(error?.status ?? 400);
      return res.status(status).json({ error: String(error?.message ?? error) });
    }
  });

  app.patch("/api/dm/shops/:shopId/characters/:slug/profile", requireRole("dm"), (req, res) => {
    try {
      const current = readOrCreateShopCharacterProfile(req.params.shopId, req.params.slug);
      if (!current) return res.status(404).json({ error: "Shop not found" });
      const value = {};
      if (req.body?.dmNotes !== undefined) value.dmNotes = String(req.body.dmNotes ?? "");
      if (req.body?.usualDiscountPercent !== undefined) {
        value.usualDiscountPercent = normalizeShopInteger(req.body.usualDiscountPercent, "usualDiscountPercent", { min: 0, max: 100, nullable: true });
      }
      const entries = Object.entries(value);
      if (!entries.length) return res.status(400).json({ error: "No profile fields supplied" });
      sqlite.prepare(`UPDATE "ShopCharacterProfile" SET ${entries.map(([key]) => `"${key}" = ?`).join(", ")}, updatedAt = ? WHERE id = ?`)
        .run(...entries.map(([, item]) => item), new Date().toISOString(), current.id);
      return res.json(readOrCreateShopCharacterProfile(req.params.shopId, req.params.slug));
    } catch (error) {
      const status = Number(error?.status ?? 400);
      return res.status(status).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/dm/shops", requireRole("dm"), (req, res) => {
    try {
      requireShopTables();
      const value = normalizeShopPayload(req.body ?? {});
      if (!value.externalKey) value.externalKey = createUniqueShopExternalKey(value.name);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      sqlite.prepare(`INSERT INTO "Shop" (id, externalKey, name, description, ownerName, ownerDescription, city, dmNotes, discountDc, cp, sp, ep, gp, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, value.externalKey, value.name, value.description, value.ownerName, value.ownerDescription, value.city, value.dmNotes, value.discountDc, value.cp, value.sp, value.ep, value.gp, now, now);
      return res.status(201).json(readDmShop(id));
    } catch (error) {
      const message = String(error?.message ?? error);
      return res.status(message.includes("UNIQUE constraint") ? 409 : 400).json({ error: message });
    }
  });

  app.patch("/api/dm/shops/:shopId", requireRole("dm"), (req, res) => {
    try {
      if (!readDmShop(req.params.shopId)) return res.status(404).json({ error: "Shop not found" });
      const value = normalizeShopPayload(req.body ?? {}, { partial: true });
      const entries = Object.entries(value);
      if (!entries.length) return res.status(400).json({ error: "No shop fields supplied" });
      sqlite.prepare(`UPDATE "Shop" SET ${entries.map(([key]) => `"${key}" = ?`).join(", ")}, updatedAt = ? WHERE id = ?`)
        .run(...entries.map(([, item]) => item), new Date().toISOString(), req.params.shopId);
      return res.json(readDmShop(req.params.shopId));
    } catch (error) {
      const message = String(error?.message ?? error);
      return res.status(message.includes("UNIQUE constraint") ? 409 : 400).json({ error: message });
    }
  });

  app.delete("/api/dm/shops/:shopId", requireRole("dm"), (req, res) => {
    try {
      const shop = readDmShop(req.params.shopId);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      const activeVisit = tableExists("ShopVisit") && sqlite.prepare('SELECT id FROM "ShopVisit" WHERE shopId = ? AND status = ? LIMIT 1').get(req.params.shopId, "ACTIVE");
      if (activeVisit) return res.status(409).json({ error: "Cannot archive a shop with an active visit" });
      sqlite.prepare('UPDATE "Shop" SET archivedAt = ?, updatedAt = ? WHERE id = ?').run(new Date().toISOString(), new Date().toISOString(), req.params.shopId);
      return res.json(readDmShop(req.params.shopId));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/dm/shops/:shopId/items", requireRole("dm"), (req, res) => {
    try {
      const shop = readDmShop(req.params.shopId);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      if (shop.archivedAt) return res.status(409).json({ error: "Cannot add stock to an archived shop" });
      const value = normalizeShopItemPayload(req.body ?? {});
      const definition = readItemDefinition(value.itemDefinitionId);
      validateShopItemInstance(definition, value.quantity, value.data);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO "ShopItem" (id, shopId, itemDefinitionId, nameOverride, descriptionOverride, quantity, priceCurrency, priceAmount, isSecret, discoveryDc, sortOrder, dmNotes, instanceNotes, data, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, req.params.shopId, value.itemDefinitionId, value.nameOverride, value.descriptionOverride, value.quantity, value.priceCurrency, value.priceAmount, value.isSecret, value.discoveryDc, value.sortOrder, value.dmNotes, value.instanceNotes, value.data, now, now);
      return res.status(201).json(readDmShop(req.params.shopId).items.find((item) => item.id === id));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.patch("/api/dm/shops/:shopId/items/:shopItemId", requireRole("dm"), (req, res) => {
    try {
      const current = sqlite.prepare('SELECT * FROM "ShopItem" WHERE id = ? AND shopId = ?').get(req.params.shopItemId, req.params.shopId);
      if (!current) return res.status(404).json({ error: "Shop item not found" });
      const value = normalizeShopItemPayload(req.body ?? {}, { partial: true });
      const definition = readItemDefinition(value.itemDefinitionId ?? current.itemDefinitionId);
      const quantity = value.quantity ?? Number(current.quantity);
      validateShopItemInstance(definition, quantity, value.data !== undefined ? value.data : current.data, current.id);
      const entries = Object.entries(value);
      if (!entries.length) return res.status(400).json({ error: "No shop item fields supplied" });
      sqlite.prepare(`UPDATE "ShopItem" SET ${entries.map(([key]) => `"${key}" = ?`).join(", ")}, updatedAt = ? WHERE id = ?`)
        .run(...entries.map(([, item]) => item), new Date().toISOString(), req.params.shopItemId);
      return res.json(readDmShop(req.params.shopId).items.find((item) => item.id === req.params.shopItemId));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.delete("/api/dm/shops/:shopId/items/:shopItemId", requireRole("dm"), (req, res) => {
    try {
      requireShopTables();
      const result = sqlite.prepare('DELETE FROM "ShopItem" WHERE id = ? AND shopId = ?').run(req.params.shopItemId, req.params.shopId);
      return result.changes ? res.status(204).end() : res.status(404).json({ error: "Shop item not found" });
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/dm/shop-visits", requireRole("dm"), (req, res) => {
    try {
      requireShopTables();
      if (!tableExists("ShopVisit") || !tableExists("ShopCharacterProfile")) throw new Error("Shop visit database migration has not been applied");
      const shopId = String(req.body?.shopId ?? "").trim();
      const characterSlug = String(req.body?.characterSlug ?? req.body?.slug ?? "").trim();
      const discountPercent = normalizeShopInteger(req.body?.discountPercent ?? 0, "discountPercent", { min: 0, max: 100 });
      const dmNotes = String(req.body?.dmNotes ?? "");
      const shop = sqlite.prepare('SELECT * FROM "Shop" WHERE id = ? LIMIT 1').get(shopId);
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      if (shop.archivedAt) return res.status(409).json({ error: "Cannot open a visit for an archived shop" });
      const character = sqlite.prepare('SELECT id, slug, name, characterType FROM "Character" WHERE slug = ? AND archivedAt IS NULL LIMIT 1').get(characterSlug);
      if (!character || String(character.characterType).toUpperCase() !== "PG") return res.status(404).json({ error: "Character not found" });

      const visitId = crypto.randomUUID();
      const now = new Date().toISOString();
      runInTransaction(() => {
        const active = sqlite.prepare('SELECT id FROM "ShopVisit" WHERE status = ? LIMIT 1').get("ACTIVE");
        if (active) throw new Error("Another shop visit is already active");
        sqlite.prepare(`INSERT INTO "ShopVisit" (id, shopId, characterId, status, discountPercent, openedByUserId, closedByUserId, closeReason, dmNotes, openedAt, closedAt, updatedAt)
          VALUES (?, ?, ?, 'ACTIVE', ?, ?, NULL, NULL, ?, ?, NULL, ?)`)
          .run(visitId, shopId, character.id, discountPercent, req.user?.id ?? null, dmNotes, now, now);

        const profile = sqlite.prepare('SELECT id, visitCount FROM "ShopCharacterProfile" WHERE shopId = ? AND characterId = ? LIMIT 1').get(shopId, character.id);
        if (profile) {
          sqlite.prepare('UPDATE "ShopCharacterProfile" SET visitCount = ?, lastVisitedAt = ?, updatedAt = ? WHERE id = ?')
            .run(Number(profile.visitCount ?? 0) + 1, now, now, profile.id);
        } else {
          sqlite.prepare(`INSERT INTO "ShopCharacterProfile" (id, shopId, characterId, visitCount, dmNotes, usualDiscountPercent, lastVisitedAt, createdAt, updatedAt)
            VALUES (?, ?, ?, 1, '', NULL, ?, ?, ?)`)
            .run(crypto.randomUUID(), shopId, character.id, now, now, now);
        }
      });

      const createdVisit = readShopVisitById(visitId);
      broadcastShopVisit(io, "shop-visit:opened", createdVisit);
      return res.status(201).json(serializeShopVisitDetail(createdVisit, { dm: true }));
    } catch (error) {
      const message = String(error?.message ?? error);
      return res.status(message.includes("already active") ? 409 : 400).json({ error: message });
    }
  });

  app.get("/api/shop-visits/active", requireAuth, (req, res) => {
    try {
      const visit = readActiveShopVisit();
      if (!visit) return res.json(null);
      if (!canAccessShopVisit(req.user, visit)) return res.json(null);
      return res.json(serializeShopVisitDetail(visit, { dm: req.user?.role === "dm" }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.get("/api/shop-visits/:visitId", requireAuth, (req, res) => {
    try {
      const visit = readShopVisitById(req.params.visitId);
      if (!visit) return res.status(404).json({ error: "Shop visit not found" });
      if (!canAccessShopVisit(req.user, visit)) return res.status(403).json({ error: "Forbidden" });
      return res.json(serializeShopVisitDetail(visit, { dm: req.user?.role === "dm" }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.patch("/api/dm/shop-visits/:visitId", requireRole("dm"), (req, res) => {
    try {
      const visit = readShopVisitById(req.params.visitId);
      if (!visit) return res.status(404).json({ error: "Shop visit not found" });
      const value = {};
      if (req.body?.discountPercent !== undefined) value.discountPercent = normalizeShopInteger(req.body.discountPercent, "discountPercent", { min: 0, max: 100 });
      if (req.body?.dmNotes !== undefined) value.dmNotes = String(req.body.dmNotes ?? "");
      const entries = Object.entries(value);
      if (!entries.length) return res.status(400).json({ error: "No visit fields supplied" });
      sqlite.prepare(`UPDATE "ShopVisit" SET ${entries.map(([key]) => `"${key}" = ?`).join(", ")}, updatedAt = ? WHERE id = ?`)
        .run(...entries.map(([, item]) => item), new Date().toISOString(), req.params.visitId);
      const updatedVisit = readShopVisitById(req.params.visitId);
      broadcastShopVisit(io, "shop-visit:updated", updatedVisit);
      return res.json(serializeShopVisitDetail(updatedVisit, { dm: true }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/dm/shop-visits/:visitId/reveal/:shopItemId", requireRole("dm"), (req, res) => {
    try {
      requireShopTables();
      if (!tableExists("ShopItemKnowledge")) throw new Error("Shop item knowledge database migration has not been applied");
      const visit = readShopVisitById(req.params.visitId);
      if (!visit) return res.status(404).json({ error: "Shop visit not found" });
      if (visit.status !== "ACTIVE") return res.status(409).json({ error: "Shop visit is not active" });
      const shopItem = sqlite.prepare('SELECT id, shopId FROM "ShopItem" WHERE id = ? AND shopId = ? LIMIT 1').get(req.params.shopItemId, visit.shopId);
      if (!shopItem) return res.status(404).json({ error: "Shop item not found in this visit" });
      const now = new Date().toISOString();
      const revealNote = String(req.body?.revealNote ?? "").trim() || null;
      sqlite.prepare(`INSERT OR IGNORE INTO "ShopItemKnowledge" (id, shopId, shopItemId, characterId, revealedByUserId, revealNote, revealedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(crypto.randomUUID(), visit.shopId, shopItem.id, visit.characterId, req.user?.id ?? null, revealNote, now);
      const updatedVisit = readShopVisitById(req.params.visitId);
      broadcastShopVisit(io, "shop-visit:updated", updatedVisit);
      return res.json(serializeShopVisitDetail(updatedVisit, { dm: true }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/shop-visits/:visitId/negotiations", requireAuth, (req, res) => {
    try {
      requireShopTables();
      if (!tableExists("ShopNegotiation") || !tableExists("ShopOffer")) throw new Error("Shop negotiation database migration has not been applied");
      const visit = readShopVisitById(req.params.visitId);
      if (!visit) return res.status(404).json({ error: "Shop visit not found" });
      if (!canAccessShopVisit(req.user, visit)) return res.status(403).json({ error: "Forbidden" });
      if (visit.status !== "ACTIVE") return res.status(409).json({ error: "Shop visit is not active" });

      const direction = String(req.body?.direction ?? "").toUpperCase();
      if (!["SHOP_TO_CHARACTER", "CHARACTER_TO_SHOP"].includes(direction)) throw new Error("direction must be SHOP_TO_CHARACTER or CHARACTER_TO_SHOP");
      const quantity = normalizeShopInteger(req.body?.quantity ?? 1, "quantity", { min: 1 });
      const negotiationId = crypto.randomUUID();
      const now = new Date().toISOString();
      const sellerSide = shopTradeSellerSide(direction);
      let shopItemId = null;
      let characterItemId = null;
      let itemNameSnapshot = "";
      let itemDetailsSnapshot = null;

      if (direction === "SHOP_TO_CHARACTER") {
        shopItemId = String(req.body?.shopItemId ?? "").trim();
        const shopItem = sqlite.prepare('SELECT * FROM "ShopItem" WHERE id = ? AND shopId = ? LIMIT 1').get(shopItemId, visit.shopId);
        if (!shopItem) return res.status(404).json({ error: "Shop item not found in this visit" });
        if (quantity > Number(shopItem.quantity ?? 0)) return res.status(409).json({ error: "Requested quantity is not available" });
        if (req.user?.role !== "dm") {
          const visibleItem = readShopVisitItemsForCharacter(visit, { dm: false }).find((item) => item.id === shopItemId);
          if (!visibleItem) return res.status(403).json({ error: "Shop item is not visible to this character" });
        }
        const definition = shopItem.itemDefinitionId ? readItemDefinition(shopItem.itemDefinitionId) : null;
        itemNameSnapshot = shopItem.nameOverride ?? definition?.name ?? "Oggetto senza nome";
        itemDetailsSnapshot = shopItem.descriptionOverride ?? definition?.description ?? null;
      } else {
        characterItemId = String(req.body?.characterItemId ?? "").trim();
        const inventoryItem = (readCharacterInventoryItemsBySlug(visit.characterSlug) ?? []).find((item) => item.id === characterItemId);
        if (!inventoryItem) return res.status(404).json({ error: "Character item not found in this visit" });
        if (quantity > Number(inventoryItem.quantity ?? 0)) return res.status(409).json({ error: "Requested quantity is not available" });
        itemNameSnapshot = inventoryItem.itemName ?? "Oggetto senza nome";
        itemDetailsSnapshot = inventoryItem.description ?? inventoryItem.detailSummary ?? null;
      }

      runInTransaction(() => {
        sqlite.prepare(`INSERT INTO "ShopNegotiation" (
          id, visitId, characterId, direction, shopItemId, characterItemId, quantity, status,
          itemNameSnapshot, itemDetailsSnapshot, createdAt, resolvedAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, NULL, ?)`)
          .run(negotiationId, visit.id, visit.characterId, direction, shopItemId, characterItemId, quantity, itemNameSnapshot, itemDetailsSnapshot, now, now);
        createShopOffer(negotiationId, 1, req.user.id, sellerSide, req.body ?? {});
      });

      broadcastShopNegotiationState(io, visit.id);
      return res.status(201).json(serializeShopVisitDetail(readShopVisitById(visit.id), { dm: req.user?.role === "dm" }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/shop-negotiations/:negotiationId/counter-offers", requireAuth, (req, res) => {
    try {
      const negotiation = readShopNegotiationById(req.params.negotiationId);
      if (!negotiation) return res.status(404).json({ error: "Shop negotiation not found" });
      const visit = readShopVisitById(negotiation.visitId);
      if (!canAccessShopVisit(req.user, visit)) return res.status(403).json({ error: "Forbidden" });
      if (negotiation.status !== "OPEN" || negotiation.visitStatus !== "ACTIVE") return res.status(409).json({ error: "Negotiation is not open" });
      const offers = readShopOffersByNegotiationIds([negotiation.id])[negotiation.id] ?? [];
      const currentOffer = offers[offers.length - 1] ?? null;
      if (currentOffer?.proposedByUserId === req.user.id) return res.status(409).json({ error: "The other side must answer the current offer first" });
      createShopOffer(negotiation.id, Number(currentOffer?.sequence ?? 0) + 1, req.user.id, shopTradeSellerSide(negotiation.direction), req.body ?? {});
      sqlite.prepare('UPDATE "ShopNegotiation" SET updatedAt = ? WHERE id = ?').run(new Date().toISOString(), negotiation.id);
      broadcastShopNegotiationState(io, negotiation.visitId);
      return res.json(serializeShopVisitDetail(readShopVisitById(negotiation.visitId), { dm: req.user?.role === "dm" }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/shop-negotiations/:negotiationId/accept", requireAuth, (req, res) => {
    try {
      const negotiation = readShopNegotiationById(req.params.negotiationId);
      if (!negotiation) return res.status(404).json({ error: "Shop negotiation not found" });
      const visit = readShopVisitById(negotiation.visitId);
      if (!canAccessShopVisit(req.user, visit)) return res.status(403).json({ error: "Forbidden" });
      if (negotiation.status !== "OPEN" || negotiation.visitStatus !== "ACTIVE") return res.status(409).json({ error: "Negotiation is not open" });
      const offers = readShopOffersByNegotiationIds([negotiation.id])[negotiation.id] ?? [];
      const currentOffer = offers[offers.length - 1] ?? null;
      if (!currentOffer) return res.status(409).json({ error: "Negotiation has no offer" });
      if (currentOffer.proposedByUserId === req.user.id) return res.status(409).json({ error: "The other side must accept this offer" });
      const now = new Date().toISOString();
      const result = sqlite.prepare('UPDATE "ShopNegotiation" SET status = ?, resolvedAt = ?, updatedAt = ? WHERE id = ? AND status = ?')
        .run("ACCEPTED", now, now, negotiation.id, "OPEN");
      if (!result.changes) return res.status(409).json({ error: "Negotiation is already resolved" });
      broadcastShopNegotiationState(io, negotiation.visitId);
      return res.json(serializeShopVisitDetail(readShopVisitById(negotiation.visitId), { dm: req.user?.role === "dm" }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/shop-negotiations/:negotiationId/reject", requireAuth, (req, res) => {
    try {
      const negotiation = readShopNegotiationById(req.params.negotiationId);
      if (!negotiation) return res.status(404).json({ error: "Shop negotiation not found" });
      const visit = readShopVisitById(negotiation.visitId);
      if (!canAccessShopVisit(req.user, visit)) return res.status(403).json({ error: "Forbidden" });
      if (negotiation.status !== "OPEN") return res.status(409).json({ error: "Negotiation is not open" });
      const offers = readShopOffersByNegotiationIds([negotiation.id])[negotiation.id] ?? [];
      const currentOffer = offers[offers.length - 1] ?? null;
      if (!currentOffer) return res.status(409).json({ error: "Negotiation has no offer" });
      if (currentOffer.proposedByUserId === req.user.id) return res.status(409).json({ error: "The other side must reject this offer" });
      const now = new Date().toISOString();
      const result = sqlite.prepare('UPDATE "ShopNegotiation" SET status = ?, resolvedAt = ?, updatedAt = ? WHERE id = ? AND status = ?')
        .run("REJECTED", now, now, negotiation.id, "OPEN");
      if (!result.changes) return res.status(409).json({ error: "Negotiation is already resolved" });
      broadcastShopNegotiationState(io, negotiation.visitId);
      return res.json(serializeShopVisitDetail(readShopVisitById(negotiation.visitId), { dm: req.user?.role === "dm" }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/shop-negotiations/:negotiationId/withdraw", requireAuth, (req, res) => {
    try {
      const negotiation = readShopNegotiationById(req.params.negotiationId);
      if (!negotiation) return res.status(404).json({ error: "Shop negotiation not found" });
      const visit = readShopVisitById(negotiation.visitId);
      if (!canAccessShopVisit(req.user, visit)) return res.status(403).json({ error: "Forbidden" });
      if (negotiation.status !== "OPEN") return res.status(409).json({ error: "Negotiation is not open" });
      const offers = readShopOffersByNegotiationIds([negotiation.id])[negotiation.id] ?? [];
      const currentOffer = offers[offers.length - 1] ?? null;
      if (currentOffer?.proposedByUserId !== req.user.id && req.user?.role !== "dm") return res.status(403).json({ error: "Only the current proposer can withdraw" });
      const now = new Date().toISOString();
      const result = sqlite.prepare('UPDATE "ShopNegotiation" SET status = ?, resolvedAt = ?, updatedAt = ? WHERE id = ? AND status = ?')
        .run("WITHDRAWN", now, now, negotiation.id, "OPEN");
      if (!result.changes) return res.status(409).json({ error: "Negotiation is already resolved" });
      broadcastShopNegotiationState(io, negotiation.visitId);
      return res.json(serializeShopVisitDetail(readShopVisitById(negotiation.visitId), { dm: req.user?.role === "dm" }));
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/shop-visits/:visitId/close", requireAuth, (req, res) => {
    try {
      const visit = readShopVisitById(req.params.visitId);
      if (!visit) return res.status(404).json({ error: "Shop visit not found" });
      if (!canAccessShopVisit(req.user, visit)) return res.status(403).json({ error: "Forbidden" });
      if (visit.status !== "ACTIVE") return res.status(409).json({ error: "Shop visit is already closed" });
      const now = new Date().toISOString();
      const status = req.user?.role === "dm" ? "CLOSED_BY_DM" : "CLOSED_BY_PLAYER";
      const closeReason = String(req.body?.closeReason ?? "").trim() || null;
      runInTransaction(() => {
        const result = sqlite.prepare('UPDATE "ShopVisit" SET status = ?, closedByUserId = ?, closeReason = ?, closedAt = ?, updatedAt = ? WHERE id = ? AND status = ?')
          .run(status, req.user?.id ?? null, closeReason, now, now, req.params.visitId, "ACTIVE");
        if (!result.changes) throw new Error("Shop visit is already closed");
        if (tableExists("ShopNegotiation")) {
          sqlite.prepare('UPDATE "ShopNegotiation" SET status = ?, resolvedAt = ?, updatedAt = ? WHERE visitId = ? AND status = ?')
            .run("EXPIRED", now, now, req.params.visitId, "OPEN");
        }
      });
      const closedVisit = readShopVisitById(req.params.visitId);
      broadcastShopVisit(io, "shop-visit:closed", closedVisit);
      return res.json(serializeShopVisitDetail(closedVisit, { dm: req.user?.role === "dm" }));
    } catch (error) {
      const message = String(error?.message ?? error);
      return res.status(message.includes("already closed") ? 409 : 400).json({ error: message });
    }
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

  app.get("/api/dm/campaign/session", requireRole("dm"), (_req, res) => {
    return res.json(readCampaignSessionState());
  });

  app.put("/api/dm/campaign/session", requireRole("dm"), (req, res) => {
    const sessionNumber = Math.floor(Number(req.body?.currentSessionNumber ?? req.body?.sessionNumber));
    if (!Number.isFinite(sessionNumber) || sessionNumber <= 0) {
      return res.status(400).json({ error: "Numero sessione non valido." });
    }
    return res.json(writeCampaignSessionState(sessionNumber, req.user?.id ?? null));
  });

  app.get("/api/dm/campaign/events", requireRole("dm"), (_req, res) => {
    return res.json({ events: listCampaignEventsForDm() });
  });

  app.get("/api/dm/campaign/documents", requireRole("dm"), (_req, res) => {
    return res.json({ documents: listCampaignDocumentsForDm() });
  });

  app.post("/api/dm/campaign/documents", requireRole("dm"), (req, res) => {
    try {
      const document = createCampaignDocument(req.body ?? {}, req.user?.id ?? null);
      return res.status(201).json(document);
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.patch("/api/dm/campaign/documents/:documentId", requireRole("dm"), (req, res) => {
    try {
      const document = updateCampaignDocument(req.params.documentId, req.body ?? {});
      return res.json(document);
    } catch (error) {
      return res.status(error?.status || 400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/dm/campaign/documents/:documentId/publish", requireRole("dm"), (req, res) => {
    try {
      const document = publishCampaignDocument(req.params.documentId, req.body ?? {}, req.user?.id ?? null);
      broadcastCampaignDocumentReveal(io, document);
      return res.json(document);
    } catch (error) {
      return res.status(error?.status || 400).json({ error: String(error?.message ?? error) });
    }
  });

  app.delete("/api/dm/campaign/documents/:documentId", requireRole("dm"), (req, res) => {
    const deleted = deleteCampaignDocument(req.params.documentId);
    if (!deleted) return res.status(404).json({ error: "Documento non trovato." });
    return res.status(204).send();
  });

  app.post("/api/dm/campaign/documents/upload-image", requireRole("dm"), (req, res) => {
    const { fileName, contentType, data } = req.body ?? {};
    const ext = extensionFromType(contentType, fileName);

    if (!data || !ext) {
      return res.status(400).json({ error: "Upload immagine non valido." });
    }

    let buffer;
    try {
      buffer = Buffer.from(String(data), "base64");
    } catch {
      return res.status(400).json({ error: "Codifica immagine non valida." });
    }

    if (!buffer?.length) {
      return res.status(400).json({ error: "Immagine vuota." });
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: "Immagine troppo grande. Limite: 5 MB." });
    }

    const fileBase = `document-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const filePath = path.join(CAMPAIGN_DOCUMENT_DIR, fileBase);

    try {
      fs.writeFileSync(filePath, buffer);
      return res.json({ url: `/campaign-documents/${fileBase}` });
    } catch (error) {
      console.error("[server] campaign document image upload failed:", error);
      return res.status(500).json({ error: "Upload documento fallito." });
    }
  });

  app.post("/api/dm/campaign/events", requireRole("dm"), (req, res) => {
    try {
      const event = createCampaignEvent(req.body ?? {}, req.user?.id ?? null);
      return res.status(201).json(event);
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.post("/api/dm/campaign/events/import", requireRole("dm"), (req, res) => {
    try {
      const dryRun = req.body?.dryRun !== false;
      const payload = req.body?.payload ?? req.body;
      const result = dryRun
        ? previewCampaignEventImportPayload(payload)
        : importCampaignEvents(payload, req.user?.id ?? null);

      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.patch("/api/dm/campaign/events/order", requireRole("dm"), (req, res) => {
    try {
      const events = swapCampaignEventSortOrders(req.body?.eventId, req.body?.targetEventId);
      return res.json({ events });
    } catch (error) {
      return res.status(400).json({ error: String(error?.message ?? error) });
    }
  });

  app.patch("/api/dm/campaign/events/:eventId", requireRole("dm"), (req, res) => {
    try {
      const event = updateCampaignEvent(req.params.eventId, req.body ?? {});
      return res.json(event);
    } catch (error) {
      return res.status(error?.status || 400).json({ error: String(error?.message ?? error) });
    }
  });

  app.delete("/api/dm/campaign/events/:eventId", requireRole("dm"), (req, res) => {
    const deleted = deleteCampaignEvent(req.params.eventId);
    if (!deleted) return res.status(404).json({ error: "Evento non trovato." });
    return res.status(204).send();
  });

  app.get("/api/campaign/events", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const visibleSlugs =
      req.user?.role === "dm"
        ? listCharacters().filter((character) => character.characterType === "pg").map((character) => character.slug)
        : Object.entries(ownership)
            .filter(([, userId]) => userId === req.user?.id)
            .map(([slug]) => slug);

    return res.json({ events: listCampaignEventsForCharacterSlugs(visibleSlugs) });
  });

  app.get("/api/campaign/documents", requireAuth, (req, res) => {
    const ownership = readOwnership();
    const visibleSlugs =
      req.user?.role === "dm"
        ? listCharacters().filter((character) => character.characterType === "pg").map((character) => character.slug)
        : Object.entries(ownership)
            .filter(([, userId]) => userId === req.user?.id)
            .map(([slug]) => slug);

    return res.json({ documents: listCampaignDocumentsForCharacterSlugs(visibleSlugs) });
  });

  app.post("/api/dm/rests/apply", requireRole("dm"), (req, res) => {
    const restType = String(req.body?.type ?? "").trim().toLowerCase();
    if (restType !== "short" && restType !== "long") {
      return res.status(400).json({ error: "Tipo di riposo non valido." });
    }

    const requestedSlugs = Array.isArray(req.body?.slugs)
      ? req.body.slugs.map((slug) => String(slug ?? "").trim()).filter(Boolean)
      : [];
    const requestedSet = new Set(requestedSlugs);
    const targetCharacters = listCharacters()
      .filter((character) => character.characterType === "pg")
      .filter((character) => requestedSet.size === 0 || requestedSet.has(character.slug));

    if (targetCharacters.length === 0) {
      return res.status(400).json({ error: "Nessun PG valido selezionato per il riposo." });
    }

    const changedCharacters = [];
    const summaries = [];

    runInTransaction(() => {
      for (const character of targetCharacters) {
        const result = applyCharacterRest(character, restType);
        summaries.push(result.summary);
        if (!result.summary.applied) continue;

        writeCharacter(result.character.slug, result.character);
        changedCharacters.push(result.character);
      }

      resetCharacterItemFeatureStatesForRest(
        changedCharacters.map((character) => character.slug),
        restType
      );
    });

    for (const character of changedCharacters) {
      const state = readCharacter(character.slug);
      if (state) {
        io.to(`char:${character.slug}`).emit("character:state", state);
      }
    }

    const initiativeState = readInitiativeTrackerState();
    if (
      changedCharacters.some((character) =>
        initiativeState.players.some((entry) => entry.slug === character.slug)
      )
    ) {
      broadcastInitiativeTrackerState(io);
    }

    return res.json({
      ok: true,
      type: restType,
      updatedCharacters: changedCharacters.map((character) => readCharacter(character.slug)).filter(Boolean),
      summaries,
    });
  });

  app.post("/api/dm/rests/preview", requireRole("dm"), (req, res) => {
    const restType = String(req.body?.type ?? "").trim().toLowerCase();
    if (restType !== "short" && restType !== "long") {
      return res.status(400).json({ error: "Tipo di riposo non valido." });
    }

    const requestedSlugs = Array.isArray(req.body?.slugs)
      ? req.body.slugs.map((slug) => String(slug ?? "").trim()).filter(Boolean)
      : [];
    const requestedSet = new Set(requestedSlugs);
    const targetCharacters = listCharacters()
      .filter((character) => character.characterType === "pg")
      .filter((character) => requestedSet.size === 0 || requestedSet.has(character.slug));

    if (targetCharacters.length === 0) {
      return res.json({
        ok: true,
        type: restType,
        summaries: [],
      });
    }

    return res.json({
      ok: true,
      type: restType,
      summaries: targetCharacters.map((character) => applyCharacterRest(character, restType).summary),
    });
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

  app.get("/api/characters/:slug/backstory", requireAuth, (req, res) => {
    const slug = req.params.slug;
    const ownership = readOwnership();

    if (!canAccessCharacter(req.user, slug, ownership)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const backstory = readCharacterBackstory(slug);
    if (!backstory) return res.status(404).json({ error: "Character not found" });
    return res.json(backstory);
  });

  app.put("/api/dm/characters/:slug/backstory", requireRole("dm"), (req, res) => {
    const slug = req.params.slug;
    const contentMarkdown = String(req.body?.contentMarkdown ?? "");

    const backstory = writeCharacterBackstory(slug, contentMarkdown, req.user?.id ?? null);
    if (!backstory) return res.status(404).json({ error: "Character not found" });
    return res.json(backstory);
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
    console.log(`[server] socket connected ${socket.id} from ${socket.handshake.address} user=${user?.username ?? "anon"}`);
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
      console.log(`[server] socket disconnected ${socket.id} from ${socket.handshake.address}`);
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
    app.use(express.static(path.resolve(__dirname, "dist"), {
      maxAge: STATIC_CACHE_MAX_AGE,
      immutable: true,
      setHeaders(res, filePath) {
        if (!filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=0");
        }
      },
    }));
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



