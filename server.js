// server.js (ESM)
import { createServer } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs";
import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { Server as SocketIOServer } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;

// ---- Disk paths ----
const CHAR_DIR = path.resolve(__dirname, "src/data/characters");
const PORTRAIT_DIR = path.resolve(__dirname, "public/portraits");

// ---- Utilities ----
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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

function writeCharacter(slug, data) {
  ensureDir(CHAR_DIR);
  const filePath = path.join(CHAR_DIR, `${slug}.json`);
  const tmpPath = filePath + ".tmp";
  const json = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(tmpPath, json, "utf-8");
  fs.renameSync(tmpPath, filePath); // atomic replace
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
      // console.log(`[server] persisted ${slug}.json`);
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

  // REST: fetch current state from disk
  app.get("/api/characters/:slug", (req, res) => {
    const slug = req.params.slug;
    const state = readCharacter(slug);
    if (!state) return res.status(404).json({ error: "Character not found" });
    res.json(state);
  });

  app.post("/api/uploads/avatar", (req, res) => {
    const { slug, fileName, contentType, data } = req.body ?? {};
    const ext = extensionFromType(contentType, fileName);

    if (!slug || !data || !ext) {
      return res.status(400).json({ error: "Invalid upload payload" });
    }

    const safeSlug = sanitizeSlug(slug);

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

    const fileBase = `${safeSlug}-${Date.now()}.${ext}`;
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
  const viewersBySlug = new Map(); // slug -> Set<socketId>
  const slugBySocket = new Map();  // socketId -> slug

  const broadcastPresence = () => {
    const payload = Array.from(viewersBySlug.entries())
      .map(([slug, set]) => ({ slug, count: set.size }))
      .filter(({ count }) => count > 0);
    io.emit("presence:update", payload);
  };

  io.on("connection", (socket) => {
    // ========== Characters ==========
    socket.on("character:join", (slug) => {
      socket.join(`char:${slug}`);
      const state = readCharacter(slug);
      if (state) socket.emit("character:state", state);
    });

    socket.on("character:update", ({ slug, patch }) => {
      if (!slug || !patch) return;
      const current = readCharacter(slug) || {};
      const next = deepMerge(current, patch);
      scheduleWrite(slug, next);
      socket.to(`char:${slug}`).emit("character:patch", { slug, patch });
      socket.emit("character:state", next);
    });

    // ========== Presence ==========
    socket.on("presence:snapshot", () => {
      const payload = Array.from(viewersBySlug.entries())
        .map(([slug, set]) => ({ slug, count: set.size }))
        .filter(({ count }) => count > 0);
      socket.emit("presence:update", payload);
    });

    socket.on("presence:enter", ({ slug }) => {
      if (!slug) return;
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
    // Vite in middleware mode (dev)
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
    // Production: serve built assets
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
        // Prendi solo indirizzi IPv4 non interni (no 127.0.0.1)
        if (net.family === "IPv4" && !net.internal) {
          console.log(` → Network: http://${net.address}:${PORT}`);
        }
      }
    }
  });
}

start();
