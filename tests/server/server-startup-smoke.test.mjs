import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DATABASE = path.join(REPOSITORY_ROOT, "prisma", "migration.db");
const temporaryDirectories = [];
const childProcesses = [];

afterEach(async () => {
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
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(url, child, readLogs) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Il server e terminato prima dello health check.\n${readLogs()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Il socket puo non essere ancora in ascolto durante il bootstrap SQLite.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timeout durante lo health check del server.\n${readLogs()}`);
}

describe("server startup", () => {
  it("boots against an isolated database and serves /healthz", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cronache-server-smoke-"));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, "migration.db");
    const appDataPath = path.join(directory, "app-data");
    const dmNotesPath = path.join(directory, "dm-notes");
    copyFileSync(SOURCE_DATABASE, databasePath);
    mkdirSync(appDataPath, { recursive: true });
    mkdirSync(dmNotesPath, { recursive: true });

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

    const response = await waitForHealth(
      `http://127.0.0.1:${port}/healthz`,
      child,
      () => `${stdout}\n${stderr}`,
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(stdout).toContain(`Server listening on http://127.0.0.1:${port}`);
  }, 30_000);
});
