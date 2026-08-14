import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

import {
  createCharacterMutationCoordinator,
  createDurableOperationReceiptStore,
} from "../../server.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const openDatabases = new Set();

function createPersistenceHarness(initialStates, { beforeWrite } = {}) {
  const database = new DatabaseSync(":memory:");
  openDatabases.add(database);
  database.exec(`
    CREATE TABLE CharacterState (
      slug TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      revision INTEGER NOT NULL
    );
    CREATE TABLE AppState (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  const insert = database.prepare(
    "INSERT INTO CharacterState (slug, state, revision) VALUES (?, ?, ?)"
  );
  for (const [slug, state] of Object.entries(initialStates)) {
    insert.run(slug, JSON.stringify(state), 1);
  }

  const readSnapshot = (slug) => {
    const row = database
      .prepare("SELECT state, revision FROM CharacterState WHERE slug = ?")
      .get(slug);
    if (!row) return null;
    return { state: JSON.parse(row.state), revision: String(row.revision) };
  };

  const writeState = (slug, state, { expectedRevision }) => {
    beforeWrite?.(slug, state);
    const nextRevision = Number(expectedRevision) + 1;
    const result = database.prepare(`
      UPDATE CharacterState
      SET state = ?, revision = ?
      WHERE slug = ? AND revision = ?
    `).run(JSON.stringify(state), nextRevision, slug, Number(expectedRevision));
    if (result.changes !== 1) {
      const error = new Error("Revision conflict");
      error.code = "REVISION_CONFLICT";
      throw error;
    }
    return String(nextRevision);
  };

  const transact = (work) => {
    database.exec("BEGIN");
    try {
      const result = work();
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  };

  const coordinator = createCharacterMutationCoordinator({ readSnapshot, writeState, transact });
  return { coordinator, database, readSnapshot };
}

function createReceiptStore(database, options = {}) {
  return createDurableOperationReceiptStore({
    read: (key) => database.prepare("SELECT value FROM AppState WHERE key = ?").get(key)?.value ?? null,
    write: (key, value) => database.prepare(`
      INSERT INTO AppState (key, value, updatedAt) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `).run(key, value, new Date().toISOString()),
    remove: (key) => database.prepare("DELETE FROM AppState WHERE key = ?").run(key),
    list: (prefix) => database.prepare(
      "SELECT key, value, updatedAt FROM AppState WHERE key LIKE ? ORDER BY updatedAt, key"
    ).all(`${prefix}%`),
    ...options,
  });
}

afterEach(() => {
  for (const database of openDatabases) database.close();
  openDatabases.clear();
});

describe("character persistence coordinator", () => {
  it("commits concurrent mutations for the same slug in FIFO order without lost updates", async () => {
    const { coordinator, readSnapshot } = createPersistenceHarness({ mira: { count: 0, order: [] } });
    const observedCounts = [];

    const first = coordinator.commit("mira", {
      mutate: (state) => {
        observedCounts.push(state.count);
        return { state: { count: state.count + 1, order: [...state.order, "first"] } };
      },
    });
    const second = coordinator.commit("mira", {
      mutate: (state) => {
        observedCounts.push(state.count);
        return { state: { count: state.count + 1, order: [...state.order, "second"] } };
      },
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(observedCounts).toEqual([0, 1]);
    expect(firstResult.revision).toBe("2");
    expect(secondResult.revision).toBe("3");
    expect(readSnapshot("mira")).toEqual({
      revision: "3",
      state: { count: 2, order: ["first", "second"] },
    });
  });

  it("does not poison the queue when one mutation fails", async () => {
    const { coordinator, readSnapshot } = createPersistenceHarness({ mira: { count: 0 } });

    const failed = coordinator.commit("mira", {
      mutate: () => {
        throw new Error("deterministic failure");
      },
    });
    const retry = coordinator.commit("mira", {
      mutate: (state) => ({ state: { count: state.count + 1 } }),
    });

    await expect(failed).rejects.toThrow("deterministic failure");
    await expect(retry).resolves.toMatchObject({ committed: true, revision: "2" });
    expect(readSnapshot("mira")).toEqual({ revision: "2", state: { count: 1 } });
  });

  it("rejects a stale revision without overwriting the committed state", async () => {
    const { coordinator, readSnapshot } = createPersistenceHarness({ mira: { count: 0 } });
    const originalRevision = readSnapshot("mira").revision;

    await coordinator.commit("mira", {
      expectedRevision: originalRevision,
      mutate: () => ({ state: { count: 5 } }),
    });
    const staleWrite = coordinator.commit("mira", {
      expectedRevision: originalRevision,
      mutate: () => ({ state: { count: 99 } }),
    });

    await expect(staleWrite).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(readSnapshot("mira")).toEqual({ revision: "2", state: { count: 5 } });
  });

  it("rolls back every character when a multi-character write fails", async () => {
    const { coordinator, readSnapshot } = createPersistenceHarness(
      { alfa: { rests: 0 }, beta: { rests: 0 } },
      {
        beforeWrite: (slug) => {
          if (slug === "beta") throw new Error("second character write failed");
        },
      },
    );

    const rest = coordinator.commitMany(["alfa", "beta"], {
      prepare: (snapshots) => ["alfa", "beta"].map((slug) => ({
        slug,
        state: { rests: snapshots.get(slug).state.rests + 1 },
      })),
    });

    await expect(rest).rejects.toThrow("second character write failed");
    expect(readSnapshot("alfa")).toEqual({ revision: "1", state: { rests: 0 } });
    expect(readSnapshot("beta")).toEqual({ revision: "1", state: { rests: 0 } });
  });

  it("rolls the character write back if receipt registration fails", async () => {
    const { coordinator, database, readSnapshot } = createPersistenceHarness({ mira: { converted: false } });
    const receipts = createReceiptStore(database);

    const conversion = coordinator.commit("mira", {
      mutate: () => ({ state: { converted: true } }),
      afterWrite: () => {
        receipts.save("conversion-1", "signature-1", { ok: true });
        throw new Error("receipt write failed");
      },
    });

    await expect(conversion).rejects.toThrow("receipt write failed");
    expect(receipts.lookup("conversion-1", "signature-1").status).toBe("miss");
    expect(readSnapshot("mira")).toEqual({ revision: "1", state: { converted: false } });
  });

  it("revalidates authorization when a queued mutation actually starts", async () => {
    const { coordinator, readSnapshot } = createPersistenceHarness({ mira: { count: 0 } });
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const blocker = coordinator.enqueue("mira", () => firstGate);
    let authorized = true;
    const queued = coordinator.commit("mira", {
      authorize: () => {
        if (!authorized) {
          const error = new Error("Session revoked");
          error.code = "AUTH_REQUIRED";
          throw error;
        }
      },
      mutate: (state) => ({ state: { count: state.count + 1 } }),
    });

    authorized = false;
    releaseFirst();
    await blocker;

    await expect(queued).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(readSnapshot("mira")).toEqual({ revision: "1", state: { count: 0 } });
  });

  it("serializes a single-character patch before an overlapping multi-character operation", async () => {
    const { coordinator, readSnapshot } = createPersistenceHarness({
      alfa: { patched: false, rests: 0 },
      beta: { patched: false, rests: 0 },
    });

    const patch = coordinator.commit("alfa", {
      mutate: (state) => ({ state: { ...state, patched: true } }),
    });
    const rest = coordinator.commitMany(["beta", "alfa"], {
      prepare: (snapshots) => ["alfa", "beta"].map((slug) => ({
        slug,
        state: { ...snapshots.get(slug).state, rests: snapshots.get(slug).state.rests + 1 },
      })),
    });

    await Promise.all([patch, rest]);
    expect(readSnapshot("alfa").state).toEqual({ patched: true, rests: 1 });
    expect(readSnapshot("beta").state).toEqual({ patched: false, rests: 1 });
  });

  it("loads a matching durable receipt after recreating the store and rejects a different signature", () => {
    const { database } = createPersistenceHarness({ mira: { count: 0 } });
    const firstProcess = createReceiptStore(database);
    firstProcess.save("dm-1/rest/request-1", "short:[mira]", {
      ok: true,
      requestId: "request-1",
      summaries: [{ slug: "mira", applied: true }],
    });

    const restartedProcess = createReceiptStore(database);
    expect(restartedProcess.lookup("dm-1/rest/request-1", "short:[mira]")).toMatchObject({
      status: "match",
      receipt: { result: { ok: true, requestId: "request-1" } },
    });
    expect(restartedProcess.lookup("dm-1/rest/request-1", "long:[mira]").status).toBe("conflict");
  });

  it("does not reapply a mutation when the durable request receipt is retried after restart", async () => {
    const { coordinator, database, readSnapshot } = createPersistenceHarness({ mira: { rests: 0 } });
    const identity = "dm-1/rest/request-retry";
    const applyWithStore = (receipts, signature) => coordinator.commit("mira", {
      mutate: (state) => {
        const lookup = receipts.lookup(identity, signature);
        if (lookup.status === "conflict") {
          const error = new Error("Request ID reused");
          error.code = "REQUEST_ID_REUSED";
          throw error;
        }
        if (lookup.status === "match") return { write: false, meta: { receipt: lookup.receipt.result } };
        return { state: { rests: state.rests + 1 }, meta: { result: { ok: true, requestId: "request-retry" } } };
      },
      afterWrite: (_state, mutation) => receipts.save(identity, signature, mutation.meta.result),
    });

    const firstProcess = createReceiptStore(database);
    await expect(applyWithStore(firstProcess, "short:[mira]")).resolves.toMatchObject({ committed: true });

    const restartedProcess = createReceiptStore(database);
    await expect(applyWithStore(restartedProcess, "short:[mira]")).resolves.toMatchObject({
      committed: false,
      meta: { receipt: { ok: true, requestId: "request-retry" } },
    });
    await expect(applyWithStore(restartedProcess, "long:[mira]")).rejects.toMatchObject({
      code: "REQUEST_ID_REUSED",
    });
    expect(readSnapshot("mira")).toEqual({ revision: "2", state: { rests: 1 } });
  });

  it("prunes expired durable receipts and enforces the configured limit", () => {
    const { database } = createPersistenceHarness({ mira: { count: 0 } });
    let clock = 1_000;
    const receipts = createReceiptStore(database, { now: () => clock, ttlMs: 100, limit: 2 });

    receipts.save("request-1", "signature", { sequence: 1 });
    clock += 1;
    receipts.save("request-2", "signature", { sequence: 2 });
    clock += 1;
    receipts.save("request-3", "signature", { sequence: 3 });

    expect(receipts.lookup("request-1", "signature").status).toBe("miss");
    expect(receipts.lookup("request-2", "signature").status).toBe("match");
    expect(receipts.lookup("request-3", "signature").status).toBe("match");

    clock = 1_200;
    expect(receipts.lookup("request-2", "signature").status).toBe("miss");
    expect(database.prepare("SELECT COUNT(*) AS count FROM AppState").get().count).toBe(1);
    expect(receipts.lookup("request-3", "signature").status).toBe("miss");
    expect(database.prepare("SELECT COUNT(*) AS count FROM AppState").get().count).toBe(0);
  });

  it("checks only the requested receipt key during lookup", () => {
    const { database } = createPersistenceHarness({ mira: { count: 0 } });
    let listCalls = 0;
    const receipts = createReceiptStore(database, {
      list: () => {
        listCalls += 1;
        return [];
      },
    });

    expect(receipts.lookup("missing-request", "signature").status).toBe("miss");
    expect(listCalls).toBe(0);
  });

  it("can replay a receipt inside the lock before reading mutable character state", async () => {
    let snapshotReads = 0;
    const coordinator = createCharacterMutationCoordinator({
      readSnapshot: () => {
        snapshotReads += 1;
        return null;
      },
      writeState: () => {
        throw new Error("must not write");
      },
      transact: (work) => work(),
    });

    await expect(coordinator.commitMany(["archived-character"], {
      beforeRead: () => [],
      prepare: () => {
        throw new Error("must not prepare");
      },
    })).resolves.toEqual([]);
    expect(snapshotReads).toBe(0);
  });

  it("rejects an expired retry when its durable character revision is stale", async () => {
    const { coordinator, database, readSnapshot } = createPersistenceHarness({ mira: { rests: 0 } });
    let clock = 1_000;
    const receipts = createReceiptStore(database, { now: () => clock, ttlMs: 5 });
    const identity = "dm-1/rest/expired-request";
    const signature = "short:[mira]:revision-1";

    await coordinator.commit("mira", {
      expectedRevision: "1",
      mutate: (state) => ({ state: { rests: state.rests + 1 } }),
      afterWrite: () => receipts.save(identity, signature, { ok: true }),
    });
    clock = 1_010;
    expect(receipts.lookup(identity, signature).status).toBe("miss");

    await expect(coordinator.commit("mira", {
      expectedRevision: "1",
      mutate: (state) => ({ state: { rests: state.rests + 1 } }),
    })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(readSnapshot("mira")).toEqual({ revision: "2", state: { rests: 1 } });
  });
});
