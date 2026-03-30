export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: "dm" | "player";
  mustChangePassword: boolean;
  ownedCharacters: string[];
};

export type ManagedUser = AuthUser & {
  createdAt: string | null;
};

export type CharacterOwnership = Record<string, string>;

async function authFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const error = new Error(res.status === 401 ? "Unauthorized" : "Request failed") as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export function fetchCurrentUser() {
  return authFetch<AuthUser>("/api/auth/me", { method: "GET" });
}

export function loginRequest(username: string, password: string) {
  return authFetch<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logoutRequest() {
  return authFetch<null>("/api/auth/logout", {
    method: "POST",
  });
}

export function changePasswordRequest(newPassword: string) {
  return authFetch<AuthUser>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export function fetchUsers() {
  return authFetch<ManagedUser[]>("/api/users", { method: "GET" });
}

export function createUserRequest(payload: {
  username: string;
  displayName?: string;
  role: "dm" | "player";
}) {
  return authFetch<ManagedUser>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetUserPasswordRequest(userId: string) {
  return authFetch<ManagedUser>(`/api/users/${userId}/reset-password`, {
    method: "POST",
  });
}

export function deleteUserRequest(userId: string) {
  return authFetch<null>(`/api/users/${userId}`, {
    method: "DELETE",
  });
}

export function fetchCharacterOwnership() {
  return authFetch<CharacterOwnership>("/api/character-ownership", { method: "GET" });
}

export function updateCharacterOwnership(slug: string, userId: string | null) {
  return authFetch<{ slug: string; userId: string | null }>(`/api/character-ownership/${slug}`, {
    method: "PUT",
    body: JSON.stringify({ userId }),
  });
}

export function archiveCharacterRequest(slug: string) {
  return authFetch<null>(`/api/characters/${slug}`, {
    method: "DELETE",
  });
}

export function createCharacterRequest(payload: {
  name: string;
  characterType: "pg" | "png";
  className: string;
  race: string;
  alignment: string;
  background: string;
}) {
  return authFetch<{
    slug: string;
    characterType: "pg" | "png";
    ownerUserId: string | null;
  }>("/api/characters", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
