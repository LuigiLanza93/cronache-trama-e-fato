import { io, Socket } from "socket.io-client";
import type { CampaignDocumentEntry, GameSessionState, InitiativeEncounterState, PlayerInitiativeTrackerView, ShopVisit } from "@/lib/auth";

let socket: Socket | null = null;
type PrivateMessagePayload = {
  slug: string;
  title?: string;
  message: string;
  sentAt: string;
};
export type ChatContact = {
  slug: string;
  name: string;
  portraitUrl?: string;
  ownerUserId?: string | null;
};
export type ChatConversationParticipant = {
  slug: string;
  name: string;
  portraitUrl?: string;
};
export type ChatConversationSummary = {
  id: string;
  kind: "player-player" | "dm-player";
  updatedAt: string;
  participants: ChatConversationParticipant[];
};
export type ChatConversationMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: "dm" | "player";
  senderName: string;
  senderCharacterSlug?: string | null;
  senderCharacterName?: string | null;
  text: string;
  createdAt: string;
};
export type InitiativeTurnPayload = {
  slug: string;
  startedAt: string;
};
export type InitiativeStatePayload = InitiativeEncounterState;
export type PlayerInitiativeStatePayload = PlayerInitiativeTrackerView;
export type GameSessionStatePayload = GameSessionState;
export type CampaignDocumentRevealPayload = {
  document: CampaignDocumentEntry;
  character: {
    slug: string;
    name: string;
  };
  revealedAt: string;
};
export type ShopVisitRealtimePayload = {
  visit: ShopVisit;
  occurredAt: string;
};

let playerWritesLocked = false;
let realtimeGeneration = 0;
let sessionRevokedGeneration: number | null = null;
const characterRevisions = new Map<string, string>();
const characterUpdateQueues = new Map<string, Promise<void>>();
const characterQueueGenerations = new Map<string, number>();
const desiredCharacterRooms = new Map<string, number>();
let desiredPresenceSlug: string | null = null;
let presenceSubscriberCount = 0;
const invalidatedCharacterSlugs = new Set<string>();
const characterUpdateErrorListeners = new Set<(error: CharacterUpdateError, slug: string) => void>();
export type CharacterPersistenceStatus = "idle" | "saving" | "saved" | "error";
export type CharacterPersistenceState = {
  status: CharacterPersistenceStatus;
  pendingCount: number;
  error?: CharacterUpdateError;
};
const characterPersistenceStates = new Map<string, CharacterPersistenceState>();
const characterPersistenceListeners = new Set<(state: CharacterPersistenceState, slug: string) => void>();
const characterAccessRevokedListeners = new Set<(slug: string) => void>();
const realtimeSessionRevokedListeners = new Set<() => void>();
type PendingCharacterUpdate = { slug: string; realtimeGeneration: number; queueGeneration: number; reject: (reason: CharacterUpdateError) => void };
const pendingCharacterUpdates = new Set<PendingCharacterUpdate>();

function publishCharacterPersistence(slug: string, next: CharacterPersistenceState) {
  characterPersistenceStates.set(slug, next);
  characterPersistenceListeners.forEach((listener) => listener(next, slug));
}

function startCharacterPersistence(slug: string) {
  const previous = characterPersistenceStates.get(slug);
  publishCharacterPersistence(slug, { status: "saving", pendingCount: (previous?.pendingCount ?? 0) + 1 });
}

function finishCharacterPersistence(slug: string, error?: CharacterUpdateError) {
  const previous = characterPersistenceStates.get(slug);
  const pendingCount = Math.max(0, (previous?.pendingCount ?? 1) - 1);
  if (pendingCount > 0) {
    publishCharacterPersistence(slug, { status: "saving", pendingCount, ...(error ? { error } : {}) });
    return;
  }
  publishCharacterPersistence(slug, { status: error ? "error" : "saved", pendingCount, ...(error ? { error } : {}) });
}

export function setRealtimePlayerWritesLocked(locked: boolean) {
  playerWritesLocked = locked;
}

export function resetRealtimeSocket({ preserveDesiredState = false }: { preserveDesiredState?: boolean } = {}) {
  realtimeGeneration += 1;
  sessionRevokedGeneration = null;
  characterRevisions.clear();
  characterUpdateQueues.clear();
  characterQueueGenerations.clear();
  const resetError = characterUpdateError("Il salvataggio precedente Ã¨ stato annullato dal cambio sessione.", undefined, "REALTIME_RESET");
  characterPersistenceStates.forEach((state, slug) => {
    if (state.pendingCount > 0) {
      publishCharacterPersistence(slug, { status: "error", pendingCount: 0, error: resetError });
    }
  });
  if (!preserveDesiredState) {
    desiredCharacterRooms.clear();
    desiredPresenceSlug = null;
    invalidatedCharacterSlugs.clear();
  }
  const error = characterUpdateError("La sessione è cambiata: il salvataggio precedente è stato annullato.", undefined, "REALTIME_RESET");
  pendingCharacterUpdates.forEach((pending) => pending.reject(error));
  pendingCharacterUpdates.clear();
  if (!socket) return;
  try {
    socket.disconnect();
  } catch {}
  if (preserveDesiredState) socket.connect();
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(); // same origin
    socket.on("connect", () => {
      desiredCharacterRooms.forEach((count, slug) => {
        if (count > 0 && !invalidatedCharacterSlugs.has(slug)) emitCharacterJoin(slug);
      });
      if (desiredPresenceSlug) socket?.emit("presence:enter", { slug: desiredPresenceSlug });
      if (presenceSubscriberCount > 0) socket?.emit("presence:snapshot");
    });
    socket.on("character:access-revoked", (payload: unknown) => {
      const slug = typeof payload === "string"
        ? payload
        : payload && typeof payload === "object" && typeof (payload as { slug?: unknown }).slug === "string"
          ? (payload as { slug: string }).slug
          : "";
      if (!slug) return;
      notifyCharacterAccessRevoked(slug);
    });
    socket.on("auth:session-revoked", () => {
      notifyRealtimeSessionRevoked();
    });
  } else if (!socket.connected && sessionRevokedGeneration === null) {
    socket.connect();
  }
  return socket;
}

async function fetchJsonOrThrow(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
  });

  if (!res.ok) {
    const error = new Error(res.status === 404 ? "Not found" : "Request failed") as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function fetchCharacter(slug: string) {
  return fetchJsonOrThrow(`/api/characters/${slug}`);
}

export async function fetchCharacters() {
  return fetchJsonOrThrow("/api/characters");
}

export async function fetchChatContacts() {
  return fetchJsonOrThrow("/api/chat/contacts") as Promise<ChatContact[]>;
}

export async function fetchChatConversations() {
  return fetchJsonOrThrow("/api/chat/conversations") as Promise<ChatConversationSummary[]>;
}

export async function fetchChatConversation(conversationId: string) {
  return fetchJsonOrThrow(`/api/chat/conversations/${conversationId}`) as Promise<ChatConversationSummary>;
}

export async function fetchChatConversationMessages(conversationId: string) {
  return fetchJsonOrThrow(`/api/chat/conversations/${conversationId}/messages`) as Promise<ChatConversationMessage[]>;
}

export async function getOrCreateDirectConversation(sourceSlug: string, targetSlug: string) {
  return fetchJsonOrThrow("/api/chat/conversations/direct", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sourceSlug, targetSlug }),
  }) as Promise<ChatConversationSummary>;
}

export async function getOrCreateDmConversation(slug: string) {
  return fetchJsonOrThrow("/api/chat/conversations/dm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slug }),
  }) as Promise<ChatConversationSummary>;
}

type CharacterJoinAck = { ok: true } | { ok: false; code?: string; error?: string };

function notifyRealtimeSessionRevoked() {
  if (sessionRevokedGeneration === realtimeGeneration) return;
  realtimeGeneration += 1;
  sessionRevokedGeneration = realtimeGeneration;
  characterRevisions.clear();
  characterUpdateQueues.clear();
  characterQueueGenerations.clear();
  desiredCharacterRooms.clear();
  desiredPresenceSlug = null;
  invalidatedCharacterSlugs.clear();
  const error = characterUpdateError("La sessione non è più valida.", undefined, "AUTH_REQUIRED");
  pendingCharacterUpdates.forEach((pending) => pending.reject(error));
  pendingCharacterUpdates.clear();
  try {
    socket?.disconnect();
  } catch {}
  realtimeSessionRevokedListeners.forEach((listener) => listener());
}

function notifyCharacterAccessRevoked(slug: string) {
  invalidateCharacterRealtime(slug);
  characterAccessRevokedListeners.forEach((listener) => listener(slug));
}

function emitCharacterJoin(slug: string) {
  const currentSocket = socket;
  if (!currentSocket?.connected || invalidatedCharacterSlugs.has(slug)) return;
  currentSocket.timeout(7_000).emit(
    "character:join",
    { slug },
    (timeoutError: Error | null, response?: CharacterJoinAck) => {
      if (timeoutError || response?.ok !== false) return;
      if (response.code === "AUTH_REQUIRED") {
        notifyRealtimeSessionRevoked();
      } else if (response.code === "FORBIDDEN" || response.code === "CHARACTER_NOT_FOUND") {
        notifyCharacterAccessRevoked(slug);
      }
    }
  );
}

export function joinCharacterRoom(slug: string) {
  if (invalidatedCharacterSlugs.has(slug)) return;
  desiredCharacterRooms.set(slug, (desiredCharacterRooms.get(slug) ?? 0) + 1);
  const currentSocket = getSocket();
  if (currentSocket.connected) emitCharacterJoin(slug);
}

export function leaveCharacterRoom(slug: string) {
  const nextCount = (desiredCharacterRooms.get(slug) ?? 0) - 1;
  if (nextCount > 0) {
    desiredCharacterRooms.set(slug, nextCount);
    return;
  }
  desiredCharacterRooms.delete(slug);
  socket?.emit("character:leave", { slug });
}

function invalidateCharacterQueue(slug: string, message: string, code: string) {
  characterQueueGenerations.set(slug, (characterQueueGenerations.get(slug) ?? 0) + 1);
  const error = characterUpdateError(message, undefined, code);
  pendingCharacterUpdates.forEach((pending) => {
    if (pending.slug === slug) pending.reject(error);
  });
  return error;
}

export function invalidateCharacterRealtime(slug: string) {
  invalidatedCharacterSlugs.add(slug);
  characterRevisions.delete(slug);
  desiredCharacterRooms.delete(slug);
  if (desiredPresenceSlug === slug) {
    desiredPresenceSlug = null;
    socket?.emit("presence:leave");
  }
  invalidateCharacterQueue(slug, "L'accesso a questa scheda è stato revocato.", "CHARACTER_ACCESS_REVOKED");
  if (socket?.connected) socket.emit("character:leave", { slug });
}

export type CharacterStatePayload<T = Record<string, unknown>> = {
  slug: string;
  state: T;
  revision?: string;
};

export type CharacterPatchPayload = {
  slug: string;
  patch: Record<string, unknown>;
  revision?: string;
};

export type CharacterInventoryUpdatedPayload = {
  slug: string;
  reason?: string;
  occurredAt?: string;
};

function normalizeCharacterStatePayload(payload: unknown): CharacterStatePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const state = record.state && typeof record.state === "object" ? record.state as Record<string, unknown> : record;
  const slug = typeof record.slug === "string" ? record.slug : typeof state.slug === "string" ? state.slug : "";
  if (!slug) return null;
  return {
    slug,
    state: state.slug === slug ? state : { ...state, slug },
    revision: typeof record.revision === "string" ? record.revision : undefined,
  };
}

function normalizeCharacterPatchPayload(payload: unknown): CharacterPatchPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.slug !== "string" || !record.patch || typeof record.patch !== "object") return null;
  return {
    slug: record.slug,
    patch: record.patch as Record<string, unknown>,
    revision: typeof record.revision === "string" ? record.revision : undefined,
  };
}

export function onCharacterState(cb: (payload: CharacterStatePayload) => void) {
  const s = getSocket();
  const handler = (payload: unknown) => {
    const normalized = normalizeCharacterStatePayload(payload);
    if (normalized) {
      if (normalized.revision) characterRevisions.set(normalized.slug, normalized.revision);
      cb(normalized);
    }
  };
  s.on("character:state", handler);
  // ⬇️ cleanup che NON ritorna Socket
  return () => {
    s.off("character:state", handler);
  };
}

export function onCharacterPatch(cb: (patch: CharacterPatchPayload) => void) {
  const s = getSocket();
  const handler = (payload: unknown) => {
    const normalized = normalizeCharacterPatchPayload(payload);
    if (normalized) {
      if (normalized.revision) characterRevisions.set(normalized.slug, normalized.revision);
      cb(normalized);
    }
  };
  s.on("character:patch", handler);
  // ⬇️ cleanup che NON ritorna Socket
  return () => {
    s.off("character:patch", handler);
  };
}

export function onCharacterInventoryUpdated(
  cb: (payload: CharacterInventoryUpdatedPayload) => void
): () => void {
  const s = getSocket();
  const handler = (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const record = payload as Record<string, unknown>;
    if (typeof record.slug !== "string" || !record.slug.trim()) return;
    cb({
      slug: record.slug,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      occurredAt: typeof record.occurredAt === "string" ? record.occurredAt : undefined,
    });
  };
  s.on("character:inventory-updated", handler);
  return () => {
    s.off("character:inventory-updated", handler);
  };
}

export function onCharacterAccessRevoked(cb: (slug: string) => void) {
  getSocket();
  characterAccessRevokedListeners.add(cb);
  return () => characterAccessRevokedListeners.delete(cb);
}

export function onRealtimeSessionRevoked(cb: () => void) {
  getSocket();
  realtimeSessionRevokedListeners.add(cb);
  return () => realtimeSessionRevokedListeners.delete(cb);
}

export type CharacterUpdateAck =
  | { ok: true; slug: string; revision?: string; state?: Record<string, unknown> }
  | { ok: false; error: string; code?: string; revision?: string; state?: Record<string, unknown> };

export type CharacterUpdateError = Error & { code?: string; state?: Record<string, unknown>; revision?: string };

function characterUpdateError(message: string, response?: Exclude<CharacterUpdateAck, { ok: true }>, fallbackCode?: string): CharacterUpdateError {
  const error = new Error(message) as CharacterUpdateError;
  error.name = "CharacterUpdateError";
  error.code = response?.code ?? fallbackCode;
  error.state = response?.state;
  error.revision = response?.revision;
  return error;
}

export function updateCharacterWithAck(
  slug: string,
  patch: Record<string, unknown>
): Promise<Extract<CharacterUpdateAck, { ok: true }>> {
  if (playerWritesLocked) return Promise.reject(characterUpdateError("La sessione è chiusa. Le modifiche del personaggio sono bloccate."));
  if (invalidatedCharacterSlugs.has(slug)) return Promise.reject(characterUpdateError("L'accesso a questa scheda è stato revocato.", undefined, "CHARACTER_ACCESS_REVOKED"));
  startCharacterPersistence(slug);
  const requestRealtimeGeneration = realtimeGeneration;
  const requestQueueGeneration = characterQueueGenerations.get(slug) ?? 0;
  const previous = characterUpdateQueues.get(slug) ?? Promise.resolve();
  const request = previous.then(() => new Promise<Extract<CharacterUpdateAck, { ok: true }>>((resolve, reject) => {
    if (
      requestRealtimeGeneration !== realtimeGeneration ||
      requestQueueGeneration !== (characterQueueGenerations.get(slug) ?? 0) ||
      invalidatedCharacterSlugs.has(slug)
    ) {
      reject(characterUpdateError("Il salvataggio non è più valido.", undefined, "STALE_CHARACTER_UPDATE"));
      return;
    }
    const pending: PendingCharacterUpdate = {
      slug,
      realtimeGeneration: requestRealtimeGeneration,
      queueGeneration: requestQueueGeneration,
      reject,
    };
    pendingCharacterUpdates.add(pending);
    const complete = (callback: () => void) => {
      pendingCharacterUpdates.delete(pending);
      callback();
    };
    getSocket()
      .timeout(7_000)
      .emit(
        "character:update",
        {
          slug,
          patch,
          ...(characterRevisions.get(slug) ? { revision: characterRevisions.get(slug) } : {}),
        },
        (timeoutError: Error | null, response?: CharacterUpdateAck) => {
          if (
            requestRealtimeGeneration !== realtimeGeneration ||
            requestQueueGeneration !== (characterQueueGenerations.get(slug) ?? 0) ||
            invalidatedCharacterSlugs.has(slug)
          ) {
            complete(() => reject(characterUpdateError("Il salvataggio non è più valido.", undefined, "STALE_CHARACTER_UPDATE")));
            return;
          }
          if (timeoutError || !response) {
            const error = characterUpdateError("Il server non ha confermato il salvataggio della scheda.");
            characterUpdateErrorListeners.forEach((listener) => listener(error, slug));
            complete(() => reject(error));
            return;
          }
          if (!response.ok) {
            const error = characterUpdateError(response.error, response);
            if (response.revision) characterRevisions.set(slug, response.revision);
            if (response.code === "REVISION_CONFLICT") {
              characterUpdateErrorListeners.forEach((listener) => listener(error, slug));
              invalidateCharacterQueue(slug, error.message, "REVISION_CONFLICT");
            } else {
              characterUpdateErrorListeners.forEach((listener) => listener(error, slug));
            }
            complete(() => reject(error));
            return;
          }
          if (response.revision) characterRevisions.set(slug, response.revision);
          complete(() => resolve(response));
        }
      );
  }));
  const trackedRequest = request.then(
    (response) => {
      finishCharacterPersistence(slug);
      return response;
    },
    (error: CharacterUpdateError) => {
      finishCharacterPersistence(slug, error);
      throw error;
    }
  );
  characterUpdateQueues.set(slug, trackedRequest.then(() => undefined, () => undefined));
  return trackedRequest;
}

export function updateCharacter(slug: string, patch: Record<string, unknown>) {
  void updateCharacterWithAck(slug, patch).catch(() => {
    // Errors are exposed to the active sheet through onCharacterUpdateError.
  });
}

export function onCharacterUpdateError(listener: (error: CharacterUpdateError, slug: string) => void) {
  characterUpdateErrorListeners.add(listener);
  return () => characterUpdateErrorListeners.delete(listener);
}

export function onCharacterPersistenceChange(listener: (state: CharacterPersistenceState, slug: string) => void) {
  characterPersistenceListeners.add(listener);
  return () => characterPersistenceListeners.delete(listener);
}

export function getCharacterPersistenceState(slug: string): CharacterPersistenceState {
  return characterPersistenceStates.get(slug) ?? { status: "idle", pendingCount: 0 };
}

export type SpellSlotConversionResult = {
  ok: true;
  requestId: string;
  targetLevel: number;
  selections: Record<number, number>;
  cost: number;
  pointsSpent: number;
  excess: number;
};

export type SpellSlotStateSnapshot = string;
export type SpellSlotConversionError = Error & { code?: string };

type SpellSlotConversionAck =
  | SpellSlotConversionResult
  | { ok: false; error: string; code?: string };

function spellSlotConversionError(message: string, code?: string): SpellSlotConversionError {
  const error = new Error(message) as SpellSlotConversionError;
  error.name = "SpellSlotConversionError";
  if (code) error.code = code;
  return error;
}

export function convertSpellSlots(
  slug: string,
  targetLevel: number,
  selections: Record<number, number>,
  requestId: string = globalThis.crypto.randomUUID(),
  expectedSlotState?: SpellSlotStateSnapshot
): Promise<SpellSlotConversionResult> {
  if (playerWritesLocked) {
    return Promise.reject(
      spellSlotConversionError("La sessione \u00e8 chiusa. Le modifiche del personaggio sono bloccate.")
    );
  }

  return new Promise((resolve, reject) => {
    getSocket()
      .timeout(7_000)
      .emit(
        "character:convert-spell-slots",
        { slug, targetLevel, selections, requestId, expectedSlotState },
        (timeoutError: Error | null, response?: SpellSlotConversionAck) => {
          if (timeoutError) {
            reject(spellSlotConversionError("Il server non ha risposto alla conversione degli slot."));
            return;
          }
          if (!response) {
            reject(spellSlotConversionError("Risposta non valida durante la conversione degli slot."));
            return;
          }
          if (!response.ok) {
            reject(spellSlotConversionError(response.error, response.code));
            return;
          }
          resolve(response);
        }
      );
  });
}

export function applyPatch<T>(target: T, patch: any): T {
  if (Array.isArray(target) && Array.isArray(patch)) {
    return patch as any;
  }
  if (typeof target === "object" && target !== null && typeof patch === "object" && patch !== null) {
    const out: any = { ...(target as any) };
    for (const key of Object.keys(patch)) {
      if (key in out) out[key] = applyPatch((out as any)[key], patch[key]);
      else out[key] = patch[key];
    }
    return out;
  }
  return patch as any;
}

/* ===== Presence helpers ===== */

export function announceEnter(slug: string) {
  desiredPresenceSlug = slug;
  const currentSocket = getSocket();
  if (currentSocket.connected) currentSocket.emit("presence:enter", { slug });
}

export function announceLeave() {
  desiredPresenceSlug = null;
  socket?.emit("presence:leave");
}

export function requestPresenceSnapshot() {
  getSocket().emit("presence:snapshot");
}

export function subscribePresence(
  cb: (list: Array<{ slug: string; count: number }>) => void
): () => void {
  const s = getSocket();
  const handler = (payload: Array<{ slug: string; count: number }>) => cb(payload);
  presenceSubscriberCount += 1;
  s.on("presence:update", handler);
  // ⬇️ cleanup che NON ritorna Socket
  return () => {
    s.off("presence:update", handler);
    presenceSubscriberCount = Math.max(0, presenceSubscriberCount - 1);
  };
}

export function sendPrivateMessage(payload: { slug: string; title?: string; message: string }) {
  getSocket().emit("dm:private-message", payload);
}

export function onPrivateMessage(cb: (payload: PrivateMessagePayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: PrivateMessagePayload) => cb(payload);
  s.on("dm:private-message", handler);
  return () => {
    s.off("dm:private-message", handler);
  };
}

export function sendConversationMessage(payload: { conversationId: string; text: string }) {
  getSocket().emit("chat:conversation-message", payload);
}

export function onConversationMessage(cb: (payload: ChatConversationMessage) => void): () => void {
  const s = getSocket();
  const handler = (payload: ChatConversationMessage) => cb(payload);
  s.on("chat:conversation-message", handler);
  return () => {
    s.off("chat:conversation-message", handler);
  };
}

export function notifyInitiativeTurn(slug: string) {
  getSocket().emit("initiative:turn-start", { slug });
}

export function onInitiativeTurnStart(cb: (payload: InitiativeTurnPayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: InitiativeTurnPayload) => cb(payload);
  s.on("initiative:turn-start", handler);
  return () => {
    s.off("initiative:turn-start", handler);
  };
}

export function joinInitiativeDmRoom() {
  getSocket().emit("initiative:join-dm");
}

export function joinInitiativeCharacterRoom(slug: string) {
  getSocket().emit("initiative:join-character", slug);
}

export function onInitiativeState(cb: (payload: InitiativeStatePayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: InitiativeStatePayload) => cb(payload);
  s.on("initiative:state", handler);
  return () => {
    s.off("initiative:state", handler);
  };
}

export function onPlayerInitiativeState(cb: (payload: PlayerInitiativeStatePayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: PlayerInitiativeStatePayload) => cb(payload);
  s.on("initiative:player-state", handler);
  return () => {
    s.off("initiative:player-state", handler);
  };
}

export function onGameSessionState(cb: (payload: GameSessionStatePayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: GameSessionStatePayload) => cb(payload);
  s.on("game-session:state", handler);
  return () => {
    s.off("game-session:state", handler);
  };
}

export function onCampaignDocumentReveal(cb: (payload: CampaignDocumentRevealPayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: CampaignDocumentRevealPayload) => cb(payload);
  s.on("campaign-document:reveal", handler);
  return () => {
    s.off("campaign-document:reveal", handler);
  };
}

export function onShopVisitOpened(cb: (payload: ShopVisitRealtimePayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: ShopVisitRealtimePayload) => cb(payload);
  s.on("shop-visit:opened", handler);
  return () => {
    s.off("shop-visit:opened", handler);
  };
}

export function onShopVisitUpdated(cb: (payload: ShopVisitRealtimePayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: ShopVisitRealtimePayload) => cb(payload);
  s.on("shop-visit:updated", handler);
  return () => {
    s.off("shop-visit:updated", handler);
  };
}

export function onShopVisitClosed(cb: (payload: ShopVisitRealtimePayload) => void): () => void {
  const s = getSocket();
  const handler = (payload: ShopVisitRealtimePayload) => cb(payload);
  s.on("shop-visit:closed", handler);
  return () => {
    s.off("shop-visit:closed", handler);
  };
}

export function updateInitiativeState(payload: InitiativeEncounterState) {
  getSocket().emit("initiative:update-state", payload);
}
