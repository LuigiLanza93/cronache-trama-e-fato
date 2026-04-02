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
  compendiumKnowledgeState?: PlayerMonsterKnowledgeState;
  challengeRating: {
    fraction: string;
    decimal: number | null;
    display: string;
    xp: number;
  };
  size: string;
  creatureType: string;
  typeLabel: string;
  rarity: string;
  alignment: string;
  filePath: string;
  armorClass: number;
  hitPointsAverage: number;
  analysisDc: number | null;
  researchDc: number | null;
  discoverSkill: string;
};

export type PlayerMonsterKnowledgeState = "UNKNOWN" | "BASIC" | "COMPLETE";

export type PlayerCompendiumMonsterSummary = {
  id: string;
  knowledgeState: Exclude<PlayerMonsterKnowledgeState, "UNKNOWN">;
  name: string;
  size: string;
  typeLabel: string;
  armorClass: number;
  hitPointsAverage: number;
  speedLabel: string;
  strengthScore: number;
  dexterityScore: number;
  constitutionScore: number;
  intelligenceScore: number;
  wisdomScore: number;
  charismaScore: number;
  strengthDisplay: string | null;
  dexterityDisplay: string | null;
  constitutionDisplay: string | null;
  intelligenceDisplay: string | null;
  wisdomDisplay: string | null;
  charismaDisplay: string | null;
};

export type PlayerCompendiumMonsterDetail =
  | {
      id: string;
      knowledgeState: "BASIC";
      monster: MonsterEntry;
    }
  | {
      id: string;
      knowledgeState: "COMPLETE";
      monster: MonsterEntry;
    };

export type MonsterEntry = {
  id: string;
  filePath: string;
  slug: string;
  rarity: string;
  compendiumKnowledgeState?: PlayerMonsterKnowledgeState;
  analysisDc: number | null;
  researchDc: number | null;
  discoverSkill: string;
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

export type EncounterScenarioEntry =
  | {
      type: "bestiary";
      monsterId: string;
      name: string;
      hitPoints?: number;
      powerTag?: "debolissimo" | "debole" | "forte" | "fortissimo" | null;
      count: number;
    }
  | {
      type: "manual";
      name: string;
      armorClass: number;
      hitPoints: number;
      count: number;
    };

export type EncounterScenario = {
  id: string;
  name: string;
  entries: EncounterScenarioEntry[];
  createdAt: string;
  updatedAt: string;
};

export type SpellEntry = {
  name: string;
  level: number;
  school: string | null;
  casting_time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  concentration: boolean;
  saving_throw?: string | null;
  attack_roll?: boolean;
  damage?: string | null;
  scaling?: string | null;
  ritual: boolean;
  description: string;
  usage?: string | null;
  rest?: string | null;
  _source?: string | null;
};

export type SpellsByClass = Record<string, SpellEntry[]>;

export type SkillEntry = {
  name: string;
  ability: string;
};

export type SkillsPayload = {
  skills: SkillEntry[];
};

export type SpellSlotTable = Record<string, Record<string, Record<string, number>>>;

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

export function fetchSpells() {
  return authFetch<SpellsByClass>("/api/spells", { method: "GET" });
}

export function fetchSkills() {
  return authFetch<SkillsPayload>("/api/rules/skills", { method: "GET" });
}

export function fetchSpellSlots() {
  return authFetch<SpellSlotTable>("/api/rules/spell-slots", { method: "GET" });
}

export function fetchMonster(monsterId: string) {
  return authFetch<MonsterEntry>(`/api/monsters/${monsterId}`, { method: "GET" });
}

export function fetchPlayerCompendiumMonsters() {
  return authFetch<PlayerCompendiumMonsterSummary[]>("/api/player-compendium/monsters", { method: "GET" });
}

export function fetchPlayerCompendiumMonster(monsterId: string) {
  return authFetch<PlayerCompendiumMonsterDetail>(`/api/player-compendium/monsters/${monsterId}`, { method: "GET" });
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

export function archiveMonsterRequest(monsterId: string) {
  return authFetch<null>(`/api/monsters/${monsterId}`, {
    method: "DELETE",
  });
}

export function updateMonsterCompendiumKnowledgeRequest(
  monsterId: string,
  knowledgeState: PlayerMonsterKnowledgeState
) {
  return authFetch<{ monsterId: string; knowledgeState: PlayerMonsterKnowledgeState }>(
    `/api/monsters/${monsterId}/compendium-knowledge`,
    {
      method: "PUT",
      body: JSON.stringify({ knowledgeState }),
    }
  );
}

export function fetchEncounterScenarios() {
  return authFetch<EncounterScenario[]>("/api/encounter-scenarios", { method: "GET" });
}

export function createEncounterScenarioRequest(payload: {
  name: string;
  entries: EncounterScenarioEntry[];
}) {
  return authFetch<EncounterScenario>("/api/encounter-scenarios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteEncounterScenarioRequest(scenarioId: string) {
  return authFetch<null>(`/api/encounter-scenarios/${scenarioId}`, {
    method: "DELETE",
  });
}
