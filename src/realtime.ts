import { io, Socket } from "socket.io-client";
import type { GameSessionState, InitiativeEncounterState, PlayerInitiativeTrackerView } from "@/lib/auth";

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

let playerWritesLocked = false;

export function setRealtimePlayerWritesLocked(locked: boolean) {
  playerWritesLocked = locked;
}

export function resetRealtimeSocket() {
  if (!socket) return;
  try {
    socket.disconnect();
  } catch {}
  socket = null;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(); // same origin
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

export function joinCharacterRoom(slug: string) {
  getSocket().emit("character:join", slug);
}

export function onCharacterState(cb: (state: any) => void) {
  const s = getSocket();
  const handler = (state: any) => cb(state);
  s.on("character:state", handler);
  // ⬇️ cleanup che NON ritorna Socket
  return () => {
    s.off("character:state", handler);
  };
}

export function onCharacterPatch(cb: (patch: any) => void) {
  const s = getSocket();
  const handler = (patch: any) => cb(patch);
  s.on("character:patch", handler);
  // ⬇️ cleanup che NON ritorna Socket
  return () => {
    s.off("character:patch", handler);
  };
}

export function updateCharacter(slug: string, patch: any) {
  if (playerWritesLocked) return;
  getSocket().emit("character:update", { slug, patch });
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
  getSocket().emit("presence:enter", { slug });
}

export function announceLeave() {
  getSocket().emit("presence:leave");
}

export function requestPresenceSnapshot() {
  getSocket().emit("presence:snapshot");
}

export function subscribePresence(
  cb: (list: Array<{ slug: string; count: number }>) => void
): () => void {
  const s = getSocket();
  const handler = (payload: Array<{ slug: string; count: number }>) => cb(payload);
  s.on("presence:update", handler);
  // ⬇️ cleanup che NON ritorna Socket
  return () => {
    s.off("presence:update", handler);
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

export function updateInitiativeState(payload: InitiativeEncounterState) {
  getSocket().emit("initiative:update-state", payload);
}
