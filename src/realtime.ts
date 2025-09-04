import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(); // same origin
  }
  return socket;
}

export async function fetchCharacter(slug: string) {
  const res = await fetch(`/api/characters/${slug}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
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
