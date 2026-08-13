/**
 * Pure, SRD 5.1 (2014) character combat rules.
 *
 * These resolvers deliberately accept the small, legacy-compatible shapes
 * already exposed to the client. They do not infer a proficiency from a
 * character's inventory: an unclassified weapon remains unknown and never
 * receives the proficiency bonus.
 */

export type WeaponProficiencyGroup = "SIMPLE" | "MARTIAL";
export type ArmorProficiencyCategory = "LIGHT" | "MEDIUM" | "HEAVY" | "SHIELD";
export type PassiveEffectProficiencyTarget =
  | "WEAPON_SIMPLE"
  | "WEAPON_MARTIAL"
  | "ARMOR_LIGHT"
  | "ARMOR_MEDIUM"
  | "ARMOR_HEAVY"
  | "SHIELD";

type WeaponLike = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  weaponProficiencyGroup?: WeaponProficiencyGroup | string | null;
  attackKind?: string | null;
  /** Instance id of a character inventory item, when this is an equipped item. */
  characterItemId?: string | null;
  /** Explicit marker for a virtual attack created from a Pact Weapon. */
  isPactWeapon?: boolean | null;
};

type ArmorLike = {
  armorCategory?: ArmorProficiencyCategory | string | null;
  category?: string | null;
};

type CharacterLike = {
  basicInfo?: { class?: string | null };
  proficiencies?: { weapons?: unknown };
  features?: unknown;
  capabilities?: unknown;
  pactBlade?: { bondedCharacterItemId?: string | null } | null;
};

export type WeaponProficiencyResolution = {
  known: boolean;
  proficient: boolean;
  group: WeaponProficiencyGroup | null;
  breakdown: string[];
};

export type ArmorProficiencyResolution = {
  known: boolean;
  proficient: boolean;
  category: ArmorProficiencyCategory | null;
  breakdown: string[];
};

/**
 * Compact, UI-facing representation of a proficiency the character actually
 * possesses. The resolver deliberately omits categories the character is not
 * proficient with; consumers can therefore render `entries` as a concise
 * owned-proficiencies list without filtering it again.
 */
export type CharacterProficiencySummaryEntry = {
  kind: "WEAPON_GROUP" | "ARMOR_CATEGORY";
  target: WeaponProficiencyGroup | ArmorProficiencyCategory;
  label: string;
  proficient: true;
  sources: string[];
};

/**
 * Explicit, named weapons granted by a base class. These remain separate from
 * categorical groups: e.g. a Bard is not generally proficient with martial
 * weapons just because it has proficiency with a longsword.
 */
export type CharacterSpecificWeaponProficiency = {
  label: string;
  source: string;
};

export type CharacterProficiencySummary = {
  entries: CharacterProficiencySummaryEntry[];
  specificWeapons: CharacterSpecificWeaponProficiency[];
};

const CLASS_GROUP_PROFICIENCIES: Record<string, WeaponProficiencyGroup[]> = {
  barbarian: ["SIMPLE", "MARTIAL"],
  barbaro: ["SIMPLE", "MARTIAL"],
  bard: ["SIMPLE"],
  bardo: ["SIMPLE"],
  cleric: ["SIMPLE"],
  chierico: ["SIMPLE"],
  fighter: ["SIMPLE", "MARTIAL"],
  guerriero: ["SIMPLE", "MARTIAL"],
  monk: ["SIMPLE"],
  monaco: ["SIMPLE"],
  paladin: ["SIMPLE", "MARTIAL"],
  paladino: ["SIMPLE", "MARTIAL"],
  ranger: ["SIMPLE", "MARTIAL"],
  rogue: ["SIMPLE"],
  ladro: ["SIMPLE"],
  warlock: ["SIMPLE"],
};

const CLASS_SPECIFIC_WEAPONS: Record<string, string[]> = {
  bard: ["balestra a mano", "hand crossbow", "spada lunga", "longsword", "rapier", "stocco", "spada corta", "shortsword"],
  bardo: ["balestra a mano", "hand crossbow", "spada lunga", "longsword", "rapier", "stocco", "spada corta", "shortsword"],
  druid: ["club", "clava", "randello", "dagger", "pugnale", "dart", "dardo", "javelin", "giavellotto", "mace", "mazza", "quarterstaff", "bastone", "bastone da combattimento", "scimitar", "scimitarra", "sickle", "falce", "falcetto", "sling", "fionda", "spear", "lancia"],
  druido: ["club", "clava", "randello", "dagger", "pugnale", "dart", "dardo", "javelin", "giavellotto", "mace", "mazza", "quarterstaff", "bastone", "bastone da combattimento", "scimitar", "scimitarra", "sickle", "falce", "falcetto", "sling", "fionda", "spear", "lancia"],
  monk: ["shortsword", "spada corta"],
  monaco: ["shortsword", "spada corta"],
  rogue: ["balestra a mano", "hand crossbow", "spada lunga", "longsword", "rapier", "stocco", "spada corta", "shortsword"],
  ladro: ["balestra a mano", "hand crossbow", "spada lunga", "longsword", "rapier", "stocco", "spada corta", "shortsword"],
  sorcerer: ["dagger", "pugnale", "dart", "dardo", "sling", "fionda", "quarterstaff", "bastone", "light crossbow", "balestra leggera"],
  stregone: ["dagger", "pugnale", "dart", "dardo", "sling", "fionda", "quarterstaff", "bastone", "light crossbow", "balestra leggera"],
  wizard: ["dagger", "pugnale", "dart", "dardo", "sling", "fionda", "quarterstaff", "bastone", "light crossbow", "balestra leggera"],
  mago: ["dagger", "pugnale", "dart", "dardo", "sling", "fionda", "quarterstaff", "bastone", "light crossbow", "balestra leggera"],
};

const CLASS_ARMOR_PROFICIENCIES: Record<string, ArmorProficiencyCategory[]> = {
  barbarian: ["LIGHT", "MEDIUM", "SHIELD"],
  barbaro: ["LIGHT", "MEDIUM", "SHIELD"],
  bard: ["LIGHT"],
  bardo: ["LIGHT"],
  cleric: ["LIGHT", "MEDIUM", "SHIELD"],
  chierico: ["LIGHT", "MEDIUM", "SHIELD"],
  druid: ["LIGHT", "MEDIUM", "SHIELD"],
  druido: ["LIGHT", "MEDIUM", "SHIELD"],
  fighter: ["LIGHT", "MEDIUM", "HEAVY", "SHIELD"],
  guerriero: ["LIGHT", "MEDIUM", "HEAVY", "SHIELD"],
  monk: [],
  monaco: [],
  paladin: ["LIGHT", "MEDIUM", "HEAVY", "SHIELD"],
  paladino: ["LIGHT", "MEDIUM", "HEAVY", "SHIELD"],
  ranger: ["LIGHT", "MEDIUM", "SHIELD"],
  rogue: ["LIGHT"],
  ladro: ["LIGHT"],
  sorcerer: [],
  stregone: [],
  warlock: ["LIGHT"],
  wizard: [],
  mago: [],
};

const CLASS_DISPLAY_LABELS: Record<string, string> = {
  barbarian: "Barbaro",
  barbaro: "Barbaro",
  bard: "Bardo",
  bardo: "Bardo",
  cleric: "Chierico",
  chierico: "Chierico",
  druid: "Druido",
  druido: "Druido",
  fighter: "Guerriero",
  guerriero: "Guerriero",
  monk: "Monaco",
  monaco: "Monaco",
  paladin: "Paladino",
  paladino: "Paladino",
  ranger: "Ranger",
  rogue: "Ladro",
  ladro: "Ladro",
  sorcerer: "Stregone",
  stregone: "Stregone",
  warlock: "Warlock",
  wizard: "Mago",
  mago: "Mago",
};

/** Canonical display names, separate from the legacy matching aliases above. */
const CLASS_SPECIFIC_WEAPON_SUMMARY: Record<string, string[]> = {
  bard: ["Balestra a mano", "Spada lunga", "Stocco", "Spada corta"],
  bardo: ["Balestra a mano", "Spada lunga", "Stocco", "Spada corta"],
  druid: ["Clava", "Pugnale", "Dardo", "Giavellotto", "Mazza", "Bastone da combattimento", "Scimitarra", "Falcetto", "Fionda", "Lancia"],
  druido: ["Clava", "Pugnale", "Dardo", "Giavellotto", "Mazza", "Bastone da combattimento", "Scimitarra", "Falcetto", "Fionda", "Lancia"],
  monk: ["Spada corta"],
  monaco: ["Spada corta"],
  rogue: ["Balestra a mano", "Spada lunga", "Stocco", "Spada corta"],
  ladro: ["Balestra a mano", "Spada lunga", "Stocco", "Spada corta"],
  sorcerer: ["Pugnale", "Dardo", "Fionda", "Bastone", "Balestra leggera"],
  stregone: ["Pugnale", "Dardo", "Fionda", "Bastone", "Balestra leggera"],
  wizard: ["Pugnale", "Dardo", "Fionda", "Bastone", "Balestra leggera"],
  mago: ["Pugnale", "Dardo", "Fionda", "Bastone", "Balestra leggera"],
};

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeGroup(value: unknown): WeaponProficiencyGroup | null {
  const group = normalized(value).toUpperCase();
  return group === "SIMPLE" || group === "MARTIAL" ? group : null;
}

function normalizeArmorCategory(value: unknown): ArmorProficiencyCategory | null {
  const category = normalized(value).toUpperCase();
  return category === "LIGHT" || category === "MEDIUM" || category === "HEAVY" || category === "SHIELD"
    ? category
    : null;
}

function isPassiveCapability(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return String((value as Record<string, unknown>).kind ?? "passive").trim().toLowerCase() === "passive";
}

function capabilityLabel(value: Record<string, unknown>) {
  const rawName = value.name ?? value.title;
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const sourceLabel = typeof value.sourceLabel === "string" ? value.sourceLabel.trim() : "";
  if (name && sourceLabel && normalized(name) !== normalized(sourceLabel)) return `${name} (${sourceLabel})`;
  if (name) return name;
  return sourceLabel || "Capacità passiva";
}

function passiveProficiencySourceLabel(value: Record<string, unknown>) {
  const label = capabilityLabel(value);
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const sourceType = typeof value.sourceType === "string" ? normalized(value.sourceType) : "";

  if (sourceType === "item") return `Oggetto: ${label}`;
  if (category && normalized(category) !== normalized(label)) return `${category}: ${label}`;
  return label;
}

/**
 * Only structured PROFICIENCY effects grant categorical proficiency. Effects
 * without a category remain legacy MODIFIER effects and can never grant it.
 * Proficiency effects intentionally have no trigger: their existence on a
 * passive capability is the complete activation condition.
 */
function getPassiveProficiencySources(characterData: CharacterLike, target: PassiveEffectProficiencyTarget) {
  if (!Array.isArray(characterData?.capabilities)) return [];

  return characterData.capabilities.flatMap((capability) => {
    if (!isPassiveCapability(capability) || !capability || typeof capability !== "object") return [];
    const entry = capability as Record<string, unknown>;
    if (!Array.isArray(entry.passiveEffects)) return [];
    const label = passiveProficiencySourceLabel(entry);

    return entry.passiveEffects.flatMap((effect) => {
      if (!effect || typeof effect !== "object") return [];
      const candidate = effect as Record<string, unknown>;
      const keys = Object.keys(candidate).sort();
      const category = String(candidate.category ?? "MODIFIER").trim().toUpperCase();
      const effectTarget = String(candidate.target ?? "").trim().toUpperCase();
      return category === "PROFICIENCY" && effectTarget === target && keys.length === 2 && keys[0] === "category" && keys[1] === "target"
        ? [label]
        : [];
    });
  });
}

function passiveWeaponTarget(group: WeaponProficiencyGroup): PassiveEffectProficiencyTarget {
  return group === "SIMPLE" ? "WEAPON_SIMPLE" : "WEAPON_MARTIAL";
}

function passiveArmorTarget(category: ArmorProficiencyCategory): PassiveEffectProficiencyTarget {
  switch (category) {
    case "LIGHT": return "ARMOR_LIGHT";
    case "MEDIUM": return "ARMOR_MEDIUM";
    case "HEAVY": return "ARMOR_HEAVY";
    case "SHIELD": return "SHIELD";
  }
}

function weaponGroupLabel(group: WeaponProficiencyGroup) {
  return group === "SIMPLE" ? "armi semplici" : "armi da guerra";
}

function armorCategoryLabel(category: ArmorProficiencyCategory) {
  switch (category) {
    case "LIGHT": return "armature leggere";
    case "MEDIUM": return "armature medie";
    case "HEAVY": return "armature pesanti";
    case "SHIELD": return "scudi";
  }
}

function classProficiencySource(className: string) {
  const label = CLASS_DISPLAY_LABELS[className];
  return label ? `Classe: ${label}` : null;
}

/**
 * Reads only legacy values that explicitly encode a categorical weapon group.
 * Individual legacy weapon grants are intentionally not promoted to a group.
 */
function readLegacyWeaponGroupGrants(value: unknown): Set<WeaponProficiencyGroup> {
  const grants = new Set<WeaponProficiencyGroup>();
  const addGroup = (candidate: unknown) => {
    const group = normalizeGroup(candidate);
    if (group) grants.add(group);
  };
  const visit = (entry: unknown) => {
    if (typeof entry === "string") {
      addGroup(entry);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const candidate = entry as Record<string, unknown>;
    const hasNamedIdentity = [candidate.id, candidate.slug, candidate.name, candidate.title]
      .some((identity) => typeof identity === "string" && identity.trim().length > 0);
    if (hasNamedIdentity) return;
    addGroup(candidate.group);
    addGroup(candidate.weaponProficiencyGroup);
    Object.entries(candidate).forEach(([key, enabled]) => {
      if (enabled === true) addGroup(key);
    });
  };
  if (Array.isArray(value)) value.forEach(visit);
  else visit(value);
  return grants;
}

const LEGACY_WEAPON_GROUP_ALIASES = new Set([
  "simple",
  "martial",
  "weapon_simple",
  "weapon_martial",
  "weapon simple",
  "weapon martial",
  "simple weapon",
  "simple weapons",
  "martial weapon",
  "martial weapons",
  "armi semplici",
  "armi da guerra",
  "armi marziali",
]);

function isLegacyWeaponGroupAlias(value: string) {
  return LEGACY_WEAPON_GROUP_ALIASES.has(normalized(value));
}

/**
 * Retains legacy named weapon grants for the UI without treating their labels
 * as categorical groups. The key is normalized only for deduplication; the
 * first persisted display label remains visible to the user.
 */
function readLegacyNamedWeaponGrants(value: unknown): Array<{ key: string; label: string }> {
  const grants = new Map<string, string>();
  const add = (candidate: unknown) => {
    if (typeof candidate !== "string") return;
    const label = candidate.trim();
    const key = normalized(label);
    if (!key || isLegacyWeaponGroupAlias(label)) return;
    if (!grants.has(key)) grants.set(key, label);
  };
  const visit = (entry: unknown) => {
    if (typeof entry === "string") {
      add(entry);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const candidate = entry as Record<string, unknown>;
    if (candidate.proficient === false || candidate.enabled === false) return;
    const namedLabel = typeof candidate.name === "string"
      ? candidate.name
      : typeof candidate.title === "string"
        ? candidate.title
        : candidate.id ?? candidate.slug;
    add(namedLabel);
    Object.entries(candidate).forEach(([key, enabled]) => {
      if (["id", "slug", "name", "title", "group", "weaponProficiencyGroup", "proficient", "enabled"].includes(key)) return;
      if (enabled) add(key);
    });
  };
  if (Array.isArray(value)) value.forEach(visit);
  else visit(value);
  return [...grants].map(([key, label]) => ({ key, label }));
}

/**
 * Resolves the effective categorical proficiencies with their readable
 * provenance. The result includes only proficiencies the character owns;
 * instance-specific effects such as Pact Weapon never become a general group.
 */
export function resolveCharacterProficiencySummary(characterData: CharacterLike): CharacterProficiencySummary {
  const className = normalized(characterData?.basicInfo?.class);
  const classSource = classProficiencySource(className);
  const classWeaponGroups = CLASS_GROUP_PROFICIENCIES[className] ?? [];
  const classArmorCategories = CLASS_ARMOR_PROFICIENCIES[className] ?? [];
  const legacyWeaponGroups = readLegacyWeaponGroupGrants(characterData?.proficiencies?.weapons);
  const legacyNamedWeapons = readLegacyNamedWeaponGrants(characterData?.proficiencies?.weapons);
  const entries: CharacterProficiencySummaryEntry[] = [];

  (["SIMPLE", "MARTIAL"] as const).forEach((group) => {
    const sources = [
      ...(classSource && classWeaponGroups.includes(group) ? [classSource] : []),
      ...(legacyWeaponGroups.has(group) ? ["Competenza esplicita"] : []),
      ...getPassiveProficiencySources(characterData, passiveWeaponTarget(group)),
    ];
    if (sources.length > 0) {
      entries.push({ kind: "WEAPON_GROUP", target: group, label: weaponGroupLabel(group), proficient: true, sources });
    }
  });

  (["LIGHT", "MEDIUM", "HEAVY", "SHIELD"] as const).forEach((category) => {
    const sources = [
      ...(classSource && classArmorCategories.includes(category) ? [classSource] : []),
      ...getPassiveProficiencySources(characterData, passiveArmorTarget(category)),
    ];
    if (sources.length > 0) {
      entries.push({ kind: "ARMOR_CATEGORY", target: category, label: armorCategoryLabel(category), proficient: true, sources });
    }
  });

  const specificWeaponSources = new Map<string, { label: string; sources: string[] }>();
  const addSpecificWeapon = (label: string, source: string) => {
    const key = normalized(label);
    if (!key) return;
    const existing = specificWeaponSources.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    specificWeaponSources.set(key, { label, sources: [source] });
  };
  (CLASS_SPECIFIC_WEAPON_SUMMARY[className] ?? []).forEach((label) => addSpecificWeapon(label, classSource ?? "Classe"));
  legacyNamedWeapons.forEach(({ label }) => addSpecificWeapon(label, "Competenza esplicita"));
  const specificWeapons = [...specificWeaponSources.values()].map(({ label, sources }) => ({
    label,
    source: sources.join(" · "),
  }));

  return { entries, specificWeapons };
}

function weaponIdentityKeys(weapon: WeaponLike) {
  return [weapon.id, weapon.slug, weapon.name].map(normalized).filter(Boolean);
}

function matchesSpecificWeaponName(identity: string, weaponName: string) {
  return identity === weaponName || /^[\s(+\-]/.test(identity.slice(weaponName.length)) && identity.startsWith(weaponName);
}

function readLegacyWeaponGrants(value: unknown): Set<string> {
  const grants = new Set<string>();
  const add = (entry: unknown) => {
    if (typeof entry === "string") {
      const key = normalized(entry);
      if (key) grants.add(key);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const candidate = entry as Record<string, unknown>;
    if (candidate.proficient === false || candidate.enabled === false) return;
    const namedIdentities = [candidate.id, candidate.slug, candidate.name, candidate.title]
      .filter((identity) => typeof identity === "string" && identity.trim().length > 0);
    if (namedIdentities.length > 0) {
      namedIdentities.forEach(add);
      return;
    }
    [candidate.group, candidate.weaponProficiencyGroup].forEach(add);
    Object.entries(candidate).forEach(([key, enabled]) => {
      if (["group", "weaponProficiencyGroup", "proficient", "enabled"].includes(key)) return;
      if (enabled === true) add(key);
    });
  };
  if (Array.isArray(value)) value.forEach(add);
  else if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const isStructuredGrant = ["id", "slug", "name", "title", "group", "weaponProficiencyGroup", "proficient", "enabled"]
      .some((key) => Object.prototype.hasOwnProperty.call(candidate, key));
    if (isStructuredGrant) add(candidate);
    else Object.entries(candidate).forEach(([key, enabled]) => {
      if (enabled === true) add(key);
    });
  }
  else add(value);
  return grants;
}

export function resolveWeaponProficiency(characterData: CharacterLike, weapon: WeaponLike): WeaponProficiencyResolution {
  const group = normalizeGroup(weapon.weaponProficiencyGroup);
  const className = normalized(characterData?.basicInfo?.class);
  const legacyGrants = readLegacyWeaponGrants(characterData?.proficiencies?.weapons);
  const identityKeys = weaponIdentityKeys(weapon);
  const hasExplicitGrant = identityKeys.some((key) => legacyGrants.has(key)) || (group !== null && legacyGrants.has(normalized(group)));
  const classGroups = CLASS_GROUP_PROFICIENCIES[className] ?? [];
  const specificWeapons = CLASS_SPECIFIC_WEAPONS[className] ?? [];
  const hasSpecificClassGrant = identityKeys.some((key) => specificWeapons.some((weaponName) => matchesSpecificWeaponName(key, weaponName)));
  const hasMonkSimpleWeaponGrant =
    (className === "monk" || className === "monaco") && group === "SIMPLE";
  const classIsKnown = Boolean(CLASS_GROUP_PROFICIENCIES[className] || CLASS_SPECIFIC_WEAPONS[className] || className === "monk" || className === "monaco");
  const hasPactWeaponGrant =
    className === "warlock" && (
      weapon?.isPactWeapon === true ||
      (typeof characterData?.pactBlade?.bondedCharacterItemId === "string" &&
        characterData.pactBlade.bondedCharacterItemId.length > 0 &&
        characterData.pactBlade.bondedCharacterItemId === weapon?.characterItemId)
    );
  const passiveSources = group ? getPassiveProficiencySources(characterData, passiveWeaponTarget(group)) : [];

  if (hasExplicitGrant) {
    return { known: true, proficient: true, group, breakdown: ["Competenza arma esplicita"] };
  }
  if (hasPactWeaponGrant) {
    return { known: true, proficient: true, group, breakdown: ["Competenza concessa da Arma del Patto"] };
  }
  if (passiveSources.length > 0) {
    return {
      known: true,
      proficient: true,
      group,
      breakdown: passiveSources.map((source) => `Competenza ${weaponGroupLabel(group!)} concessa da ${source}`),
    };
  }
  if (!group && !hasSpecificClassGrant) {
    return { known: false, proficient: false, group: null, breakdown: ["Classificazione competenza arma mancante"] };
  }
  if (!classIsKnown) {
    return { known: false, proficient: false, group, breakdown: ["Classe senza profilo di competenze arma"] };
  }
  if (hasSpecificClassGrant || hasMonkSimpleWeaponGrant) {
    return { known: true, proficient: true, group, breakdown: ["Competenza arma specifica della classe"] };
  }
  if (group && classGroups.includes(group)) {
    return { known: true, proficient: true, group, breakdown: [`Competenza ${group === "SIMPLE" ? "armi semplici" : "armi marziali"}`] };
  }
  return { known: true, proficient: false, group, breakdown: ["Arma non compresa nelle competenze della classe"] };
}

/** Resolve proficiency for a classified armor, shield, or raw armor category. */
export function resolveArmorProficiency(
  characterData: CharacterLike,
  armor: ArmorLike | ArmorProficiencyCategory | string
): ArmorProficiencyResolution {
  const category = normalizeArmorCategory(typeof armor === "string" ? armor : armor?.armorCategory ?? armor?.category);
  if (!category) {
    return {
      known: false,
      proficient: false,
      category: null,
      breakdown: ["Classificazione competenza armatura mancante"],
    };
  }

  const passiveSources = getPassiveProficiencySources(characterData, passiveArmorTarget(category));
  if (passiveSources.length > 0) {
    return {
      known: true,
      proficient: true,
      category,
      breakdown: passiveSources.map((source) => `Competenza ${armorCategoryLabel(category)} concessa da ${source}`),
    };
  }

  const className = normalized(characterData?.basicInfo?.class);
  const classCategories = CLASS_ARMOR_PROFICIENCIES[className];
  if (!classCategories) {
    return {
      known: false,
      proficient: false,
      category,
      breakdown: ["Classe senza profilo di competenze armatura"],
    };
  }
  if (classCategories.includes(category)) {
    return {
      known: true,
      proficient: true,
      category,
      breakdown: [`Competenza ${armorCategoryLabel(category)} della classe`],
    };
  }
  return {
    known: true,
    proficient: false,
    category,
    breakdown: ["Armatura o scudo non compreso nelle competenze della classe"],
  };
}

function entriesNamed(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (entry && typeof entry === "object") {
      const candidate = entry as Record<string, unknown>;
      return [candidate.name, candidate.title].filter((name): name is string => typeof name === "string");
    }
    return [];
  });
}

export function hasTwoWeaponFightingStyle(characterData: CharacterLike) {
  const names = [...entriesNamed(characterData?.features), ...entriesNamed(characterData?.capabilities)];
  return names.some((name) => {
    const value = normalized(name);
    return value === "combattere con due armi" || value === "two-weapon fighting" || value === "two weapon fighting";
  });
}
