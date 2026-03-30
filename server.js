// server.js (ESM)
import { createServer } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
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
const CHAR_DIR = path.resolve(DATA_DIR, "characters");
const USERS_FILE = path.resolve(DATA_DIR, "users.json");
const OWNERSHIP_FILE = path.resolve(DATA_DIR, "character-ownership.json");
const CHATS_FILE = path.resolve(DATA_DIR, "chats.json");
const PORTRAIT_DIR = path.resolve(__dirname, "public/portraits");
const SESSION_COOKIE = "ctf_session";

// ---- Utilities ----
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`[server] Failed to read ${filePath}:`, error);
    return fallback;
  }
}

function sanitizeSlug(value = "") {
  return String(value)
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

function readUsers() {
  return readJsonFile(USERS_FILE, []);
}

function readOwnership() {
  return readJsonFile(OWNERSHIP_FILE, {});
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + "\n", "utf-8");
}

function writeOwnership(ownership) {
  fs.writeFileSync(OWNERSHIP_FILE, JSON.stringify(ownership, null, 2) + "\n", "utf-8");
}

function readChats() {
  return readJsonFile(CHATS_FILE, {});
}

function writeChats(chats) {
  fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2) + "\n", "utf-8");
}

function listCharacterSlugs() {
  ensureDir(CHAR_DIR);
  return fs
    .readdirSync(CHAR_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/i, ""));
}

function readCharacter(slug) {
  ensureDir(CHAR_DIR);
  const filePath = path.join(CHAR_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error(`[server] Failed to read ${slug}.json:`, e);
    return null;
  }
}

function listCharacters() {
  return listCharacterSlugs()
    .map((slug) => readCharacter(slug))
    .filter(Boolean);
}

function writeCharacter(slug, data) {
  ensureDir(CHAR_DIR);
  const filePath = path.join(CHAR_DIR, `${slug}.json`);
  const tmpPath = filePath + ".tmp";
  const json = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(tmpPath, json, "utf-8");
  fs.renameSync(tmpPath, filePath);
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
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
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
  return readUsers().find((user) => user.id === userId) ?? null;
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
  const sessions = new Map();

  app.use(express.json({ limit: "10mb" }));
  ensureDir(PORTRAIT_DIR);
  app.use("/portraits", express.static(PORTRAIT_DIR));

  app.use((req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    const session = sessionId ? sessions.get(sessionId) : null;
    const user = session?.userId ? getUserById(session.userId) : null;
    req.sessionId = sessionId ?? null;
    req.user = user ?? null;
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

    const sessionId = createSessionId();
    sessions.set(sessionId, { userId: user.id, createdAt: Date.now() });
    res.setHeader("Set-Cookie", serializeSessionCookie(sessionId));
    return res.json(sanitizeUser(user, readOwnership()));
  });

  app.post("/api/auth/logout", (req, res) => {
    if (req.sessionId) sessions.delete(req.sessionId);
    res.setHeader("Set-Cookie", serializeExpiredSessionCookie());
    return res.status(204).end();
  });

  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const newPassword = String(req.body?.newPassword ?? "");

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ error: "Password too short" });
    }

    const users = readUsers();
    const userIndex = users.findIndex((entry) => entry.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordSalt = crypto.randomBytes(16).toString("hex");
    users[userIndex] = {
      ...users[userIndex],
      passwordSalt,
      passwordHash: hashPassword(newPassword, passwordSalt),
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    };

    writeUsers(users);
    return res.json(sanitizeUser(users[userIndex], readOwnership()));
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

    users.push(newUser);
    writeUsers(users);
    return res.status(201).json(sanitizeUserForAdmin(newUser, readOwnership()));
  });

  app.post("/api/users/:userId/reset-password", requireRole("dm"), (req, res) => {
    const userId = req.params.userId;
    const users = readUsers();
    const userIndex = users.findIndex((entry) => entry.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextPassword = users[userIndex].username;
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    users[userIndex] = {
      ...users[userIndex],
      passwordSalt,
      passwordHash: hashPassword(nextPassword, passwordSalt),
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    };

    writeUsers(users);
    return res.json(sanitizeUserForAdmin(users[userIndex], readOwnership()));
  });

  app.delete("/api/users/:userId", requireRole("dm"), (req, res) => {
    const userId = req.params.userId;
    if (req.user.id === userId) {
      return res.status(400).json({ error: "Cannot delete current user" });
    }

    const users = readUsers();
    const nextUsers = users.filter((entry) => entry.id !== userId);
    if (nextUsers.length === users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    writeUsers(nextUsers);
    const ownership = readOwnership();
    const nextOwnership = Object.fromEntries(
      Object.entries(ownership).filter(([, ownerUserId]) => ownerUserId !== userId)
    );
    writeOwnership(nextOwnership);

    for (const [sessionId, session] of sessions.entries()) {
      if (session.userId === userId) {
        sessions.delete(sessionId);
      }
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
    const session = sessionId ? sessions.get(sessionId) : null;
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
