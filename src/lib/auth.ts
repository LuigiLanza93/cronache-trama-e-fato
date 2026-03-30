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

export type MonsterSummary = {
  id: string;
  slug: string;
  name: string;
  challengeRating: {
    fraction: string;
    decimal: number | null;
    display: string;
    xp: number;
  };
  size: string;
  creatureType: string;
  alignment: string;
  filePath: string;
};

export type MonsterEntry = {
  id: string;
  filePath: string;
  slug: string;
  general: {
    name: string;
    challengeRating: {
      fraction: string;
      decimal: number | null;
      display: string;
      xp: number;
    };
    size: string;
    creatureType: string;
    subtype: string;
    typeLabel: string;
    alignment: string;
    environments: string[];
  };
  combat: {
    armorClass: {
      value: number;
      note: string;
    };
    hitPoints: {
      average: number;
      formula: string;
    };
    speed: Record<string, string>;
  };
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  details: {
    savingThrows: Array<{ ability: string; bonus: number }>;
    skills: Array<{ name: string; bonus: number }>;
    damageVulnerabilities: string[];
    damageResistances: string[];
    damageImmunities: string[];
    conditionImmunities: string[];
    senses: Array<{ name: string; value?: string }>;
    languages: Array<{ name: string; value?: string }>;
    proficiencyBonus: number;
  };
  traits: Array<{ name: string; usage: string | null; description: string }>;
  actions: Array<{ name: string; usage: string | null; description: string }>;
  bonusActions: Array<{ name: string; usage: string | null; description: string }>;
  reactions: Array<{ name: string; usage: string | null; description: string }>;
  legendaryActions: {
    description: string;
    actions: Array<{ name: string; description: string; cost: number }>;
  };
  lairActions: Array<{ name: string; usage: string | null; description: string }>;
  regionalEffects: Array<{ name: string; usage: string | null; description: string }>;
  notes: string[];
  source: {
    extractedFrom?: string;
    rawText?: string;
  };
};

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

export function fetchMonsters() {
  return authFetch<MonsterSummary[]>("/api/monsters", { method: "GET" });
}

export function fetchMonster(monsterId: string) {
  return authFetch<MonsterEntry>(`/api/monsters/${monsterId}`, { method: "GET" });
}

export function updateMonsterRequest(monsterId: string, monster: MonsterEntry) {
  return authFetch<MonsterEntry>(`/api/monsters/${monsterId}`, {
    method: "PUT",
    body: JSON.stringify({ monster }),
  });
}

export function createMonsterRequest(payload: { name: string; duplicateFromId?: string | null }) {
  return authFetch<MonsterEntry>("/api/monsters", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
