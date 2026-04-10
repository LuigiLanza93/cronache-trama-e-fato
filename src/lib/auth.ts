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
export type CurrencyBalance = {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
};
export type CharacterTransferTarget = {
  slug: string;
  characterType: "pg";
  basicInfo: {
    characterName: string;
  };
};
export type CurrencyTransactionRequestPayload = {
  operation: "add" | "remove" | "transfer";
  currency: keyof CurrencyBalance;
  amount: number;
  compactOnAdd?: boolean;
  counterpartyName?: string | null;
  reason?: string | null;
  purchaseDescription?: string | null;
  note?: string | null;
  targetCharacterSlug?: string | null;
};
export type CurrencyTransactionResponse = {
  ok: true;
  balance: CurrencyBalance;
  targetBalance: CurrencyBalance | null;
  transaction: {
    id: string;
  };
};

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

export type RaceSpeedEntry = {
  id: string;
  raceName: string;
  subraceName: string | null;
  speedMeters: number;
  notes: string | null;
};

export type RaceSpeedsPayload = {
  entries: RaceSpeedEntry[];
};

export type CharacterSheetLayoutEntry = {
  cardId: string;
  column: number;
  order: number;
};

export type CharacterSheetLayoutPayload = {
  layoutKey: string;
  entries: CharacterSheetLayoutEntry[];
};

export type SpellSlotTable = Record<string, Record<string, Record<string, number>>>;

export type ItemDefinitionSummary = {
  id: string;
  slug: string;
  name: string;
  category: string;
  rarity: string | null;
  description: string | null;
  playerVisible: boolean;
  stackable: boolean;
  equippable: boolean;
  assignedCharacterItemCount: number;
  attackCount: number;
  slotRuleCount: number;
  updatedAt: string;
};

export type ItemSlotRuleEntry = {
  id: string;
  groupKey: string;
  selectionMode: string;
  slot: string;
  required: boolean;
  sortOrder: number;
};

export type ItemAttackEntry = {
  id: string;
  name: string;
  kind: string;
  handRequirement: string;
  ability: string | null;
  attackBonus: number | null;
  damageDice: string | null;
  damageType: string | null;
  rangeNormal: number | null;
  rangeLong: number | null;
  twoHandedOnly: boolean;
  requiresEquipped: boolean;
  conditionText: string | null;
  sortOrder: number;
};

export type ItemModifierEntry = {
  id: string;
  target: string;
  type: string;
  value: number | null;
  formula: string | null;
  condition: string;
  stackKey: string | null;
  sortOrder: number;
};

export type ItemFeatureEntry = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  resetOn: string | null;
  customResetLabel: string | null;
  maxUses: number | null;
  passiveEffects: Array<Record<string, unknown>>;
  condition: string;
  sortOrder: number;
};

export type CharacterItemFeatureStateEntry = {
  itemFeatureId: string;
  usesSpent: number;
  lastResetAt: string | null;
};

export type ItemAbilityRequirementEntry = {
  id: string;
  ability: string;
  minScore: number;
  sortOrder: number;
};

export type ItemUseEffectEntry = {
  id: string;
  effectType: string;
  targetType: string;
  diceExpression: string | null;
  flatValue: number | null;
  damageType: string | null;
  savingThrowAbility: string | null;
  savingThrowDc: number | null;
  successOutcome: string | null;
  durationText: string | null;
  notes: string | null;
  sortOrder: number;
};

export type ItemDefinitionEntry = {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  weaponHandling: string | null;
  gloveWearMode: string | null;
  armorCategory: string | null;
  armorClassCalculation: string | null;
  armorClassBase: number | null;
  armorClassBonus: number | null;
  rarity: string | null;
  description: string | null;
  playerVisible: boolean;
  stackable: boolean;
  equippable: boolean;
  attunement: boolean;
  weight: number | null;
  valueCp: number | null;
  data: string | null;
  createdAt: string;
  updatedAt: string;
  slotRules: ItemSlotRuleEntry[];
  attacks: ItemAttackEntry[];
  modifiers: ItemModifierEntry[];
  features: ItemFeatureEntry[];
  abilityRequirements: ItemAbilityRequirementEntry[];
  useEffects: ItemUseEffectEntry[];
};

export type CharacterInventoryItemEntry = {
  id: string;
  characterId: string;
  characterSlug: string;
  characterName: string;
  itemDefinitionId: string | null;
  itemName: string;
  itemCategory: string | null;
  description: string | null;
  detailSummary: string | null;
  equippable: boolean;
  stackable: boolean;
  quantity: number;
  isEquipped: boolean;
  equippedSlots: string[];
  nameOverride: string | null;
  descriptionOverride: string | null;
  notes: string | null;
  featureStates: CharacterItemFeatureStateEntry[];
  createdAt: string;
  updatedAt: string;
};

export type EquipResolutionOption = {
  optionId: string;
  groupKey: string;
  selectionMode: string;
  slots: string[];
  conflicts: Array<{
    slot: string;
    itemId: string;
    itemName: string;
  }>;
};

export type EquipResolutionDetails = {
  code: string;
  mode?: "choice" | "swap";
  itemId?: string;
  itemName?: string;
  options?: EquipResolutionOption[];
};

export type InventoryTransferEntry = {
  id: string;
  type: string;
  actionLabel: string;
  fromCharacterSlug: string | null;
  fromCharacterName: string | null;
  toCharacterSlug: string | null;
  toCharacterName: string | null;
  itemName: string;
  quantity: number;
  createdAt: string;
  notes: string | null;
  undone: boolean;
  canUndo: boolean;
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
    let message = res.status === 401 ? "Unauthorized" : "Request failed";
    try {
      const payload = await res.clone().json();
      if (typeof payload?.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch {}

      const error = new Error(message) as Error & {
        status?: number;
        details?: unknown;
      };
      error.status = res.status;
      try {
        const payload = await res.clone().json();
        error.details = payload?.details;
      } catch {}
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

export function fetchCharacterTransferTargets() {
  return authFetch<CharacterTransferTarget[]>("/api/characters/transfer-targets", { method: "GET" });
}

export function createCharacterCurrencyTransactionRequest(slug: string, payload: CurrencyTransactionRequestPayload) {
  return authFetch<CurrencyTransactionResponse>(`/api/characters/${slug}/currency-transactions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

export function fetchRaceSpeeds() {
  return authFetch<RaceSpeedsPayload>("/api/rules/race-speeds", { method: "GET" });
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

export function fetchItemDefinitions() {
  return authFetch<ItemDefinitionSummary[]>("/api/items", { method: "GET" });
}

export function fetchCharacterSheetLayout() {
  return authFetch<CharacterSheetLayoutPayload>("/api/preferences/character-sheet-layout", {
    method: "GET",
  });
}

export function saveCharacterSheetLayout(entries: CharacterSheetLayoutEntry[]) {
  return authFetch<CharacterSheetLayoutPayload>("/api/preferences/character-sheet-layout", {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

export function fetchItemDefinition(itemId: string) {
  return authFetch<ItemDefinitionEntry>(`/api/items/${itemId}`, { method: "GET" });
}

export function createItemDefinitionRequest(payload: { name: string }) {
  return authFetch<ItemDefinitionEntry>("/api/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateItemDefinitionRequest(itemId: string, item: ItemDefinitionEntry) {
  return authFetch<ItemDefinitionEntry>(`/api/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ item }),
  });
}

export function deleteItemDefinitionRequest(itemId: string) {
  return authFetch<null>(`/api/items/${itemId}`, {
    method: "DELETE",
  });
}

export function fetchCharacterInventoryItemsForDm(slug: string) {
  return authFetch<CharacterInventoryItemEntry[]>(`/api/characters/${slug}/inventory-items`, {
    method: "GET",
  });
}

export function fetchCharacterInventoryItems(slug: string) {
  return authFetch<CharacterInventoryItemEntry[]>(`/api/characters/${slug}/inventory-items`, {
    method: "GET",
  });
}

export function assignItemToCharacterRequest(
  slug: string,
  payload: {
    itemDefinitionId?: string;
    quantity?: number;
    notes?: string | null;
    quickCreateItem?: Record<string, unknown>;
  }
) {
  return authFetch<CharacterInventoryItemEntry[]>(`/api/characters/${slug}/inventory-items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteCharacterInventoryItemRequest(slug: string, characterItemId: string) {
  return authFetch<null>(`/api/characters/${slug}/inventory-items/${characterItemId}`, {
    method: "DELETE",
  });
}

export function updateCharacterInventoryItemRequest(
  slug: string,
  characterItemId: string,
    payload: {
      quantity?: number;
      isEquipped?: boolean;
      equipConfig?: {
        optionId?: string;
        slots?: string[];
        swapItemIds?: string[];
      };
      featureState?: {
        itemFeatureId: string;
        usesSpent: number;
    };
  }
) {
  return authFetch<CharacterInventoryItemEntry>(`/api/characters/${slug}/inventory-items/${characterItemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function transferCharacterInventoryItemRequest(
  slug: string,
  characterItemId: string,
  payload: {
    toCharacterSlug: string;
    quantity?: number;
  }
) {
  return authFetch<CharacterInventoryItemEntry[]>(`/api/characters/${slug}/inventory-items/${characterItemId}/transfer`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchInventoryTransfers() {
  return authFetch<InventoryTransferEntry[]>("/api/inventory-transactions", { method: "GET" });
}

export function undoInventoryTransactionRequest(transactionId: string) {
  return authFetch<{ ok: true }>(`/api/inventory-transactions/${transactionId}/undo`, {
    method: "POST",
  });
}
