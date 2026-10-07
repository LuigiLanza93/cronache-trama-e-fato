import { ARTISAN_TOOL_LABELS, BACKGROUNDS, EQUIPMENT, LANGUAGES, LEVEL_ONE_CLASSES, RACES, SKILLS, TOOLS, WEAPON_LABELS } from "./character-creation-rules.mjs";
import { CLASS_RULES } from "./character-class-rules.mjs";
import { BACKGROUND_RULE_DESCRIPTIONS, CLASS_FEATURE_RULE_DESCRIPTIONS, DRACONIC_ANCESTRY_DETAILS, FEATURE_RULE_DESCRIPTIONS, FEAT_RULE_DESCRIPTIONS } from "./character-creation-feature-descriptions.mjs";

// Only bonuses represented by the current passive-effect engine belong here.
// Skill ranks, expertise, ability scores, speed and starting hit points are
// already projected through their native fields and must not be counted twice.
const AUTOMATIC_EFFECTS = Object.freeze({
  "fighting-style:archery": [{ target: "RANGED_ATTACK_ROLL", operationType: "BONUS", valueMode: "FLAT", value: 2, trigger: "ALWAYS" }],
  "fighting-style:defense": [{ target: "ARMOR_CLASS", operationType: "BONUS", valueMode: "FLAT", value: 1, trigger: "WHILE_ARMORED" }],
  "fighting-style:dueling": [{ target: "MELEE_DAMAGE_ROLL", operationType: "BONUS", valueMode: "FLAT", value: 2, trigger: "WHILE_WIELDING_SINGLE_MELEE_WEAPON" }],
});

const ACTIVE_FEATURES = new Set([
  "rage", "second-wind", "bardic-inspiration", "divine-sense", "lay-on-hands",
  "arcane-recovery", "breath-weapon", "warding-flare", "wrath-of-the-storm",
  "war-priest", "relentless-endurance", "tides-of-chaos", "fey-presence",
]);

const FEATURE_DESCRIPTIONS = Object.freeze({
  lucky: "Se ottieni 1 con il d20 per un tiro per colpire, una prova di caratteristica o un tiro salvezza, puoi ritirare il dado e usare il nuovo risultato.",
  brave: "Hai vantaggio ai tiri salvezza contro la condizione di spaventato.",
  "halfling-nimbleness": "Puoi attraversare lo spazio di una creatura di taglia superiore alla tua.",
  "naturally-stealthy": "Puoi tentare di nasconderti anche quando sei oscurato soltanto da una creatura di almeno una taglia superiore alla tua.",
  expertise: "Due competenze scelte ottengono il doppio del bonus di competenza. Il grado è già applicato alle rispettive abilità nella scheda.",
  "sneak-attack": "Una volta per turno puoi infliggere 1d6 danni extra a una creatura colpita con un'arma accurata o a distanza, quando ricorrono le condizioni di Attacco Furtivo.",
  "thieves-cant": "Conosci il Gergo Ladresco, usato per comunicare messaggi segreti tra ladri.",
  "keen-senses": "Ottieni competenza in Percezione; il grado è già applicato nell'elenco delle abilità.",
  "dwarven-combat-training": "Ottieni le competenze nelle armi naniche indicate nella sezione Competenze della scheda.",
  "elf-weapon-training": "Ottieni le competenze nelle armi elfiche indicate nella sezione Competenze della scheda.",
  "drow-weapon-training": "Ottieni le competenze nelle armi drow indicate nella sezione Competenze della scheda.",
  "skill-versatility": "Ottieni due competenze nelle abilità scelte; sono già applicate nell'elenco delle abilità.",
  menacing: "Ottieni competenza in Intimidire; il grado è già applicato nell'elenco delle abilità.",
  "fighting-style": "Lo stile scelto è registrato tra le Skills. I suoi bonus supportati vengono calcolati come effetti passivi.",
  "fighting-style:archery": "Ottieni +2 ai tiri per colpire effettuati con armi a distanza.",
  "fighting-style:defense": "Ottieni +1 alla Classe Armatura mentre indossi un'armatura.",
  "fighting-style:dueling": "Ottieni +2 ai danni con un'arma da mischia impugnata in una mano, quando non impugni altre armi.",
  "favored-enemy": "La scelta del nemico prescelto e i relativi benefici sono registrati nella creazione guidata.",
  "natural-explorer": "La scelta del terreno prescelto e i relativi benefici sono registrati nella creazione guidata.",
});

function ruleDescription(materialized, feature, key, name) {
  if (key.startsWith("background:") && materialized.background?.privilege?.key === key) {
    const full = BACKGROUND_RULE_DESCRIPTIONS[key.slice("background:".length)];
    return full ?? materialized.background.privilege.description ?? feature.description;
  }
  const classKey = materialized.identity?.classKey;
  const fixedDescription = key.startsWith("background:")
    ? BACKGROUND_RULE_DESCRIPTIONS[key.slice("background:".length)]
    : key.startsWith("feat:")
      ? FEAT_RULE_DESCRIPTIONS[key.slice("feat:".length)]
      : CLASS_FEATURE_RULE_DESCRIPTIONS[`${classKey}:${key}`]
        ?? FEATURE_RULE_DESCRIPTIONS[key]
        ?? (key.includes(":") ? FEATURE_RULE_DESCRIPTIONS[key.split(":")[0]] : undefined);
  const detail = String(feature?.description ?? "").trim();
  if (fixedDescription) {
    const ancestry = materialized.choices?.["race:dragonborn:ancestry"]?.[0];
    if (["draconic-ancestry", "breath-weapon", "damage-resistance"].includes(key) && DRACONIC_ANCESTRY_DETAILS[ancestry]) {
      return `${fixedDescription}\n\nLa tua scelta: ${DRACONIC_ANCESTRY_DETAILS[ancestry]}`;
    }
    if (detail && detail !== fixedDescription && key.startsWith("domain-spells:")) {
      return `${fixedDescription}\n\nIncantesimi concessi al 1° livello: ${detail}`;
    }
    if (detail && detail !== fixedDescription && key.startsWith("feat:")) {
      return `${fixedDescription}\n\nScelte del personaggio: ${detail}`;
    }
    return fixedDescription;
  }
  return detail || FEATURE_DESCRIPTIONS[key] || `Descrizione di ${name} non disponibile nel catalogo locale.`;
}

function displayLabel(entry, fallback = "") {
  return String(entry?.label?.it ?? entry?.label?.en ?? entry?.label ?? fallback).trim();
}

function classLabel(key) {
  return CLASS_RULES[key]?.labels?.it ?? CLASS_RULES[key]?.labels?.en ?? key;
}

function featureSource(materialized, feature) {
  const identity = materialized?.identity ?? {};
  const race = RACES[identity.raceKey];
  const subrace = race?.subraces?.[identity.subraceKey];
  const background = BACKGROUNDS[identity.backgroundKey] ?? materialized?.background ?? {};
  const classData = LEVEL_ONE_CLASSES[identity.classKey];
  const key = String(feature?.key ?? "");
  if (identity.backgroundKey === "custom" && (key.startsWith("background:custom:") || key === materialized?.background?.privilege?.key)) {
    return { category: "Background", sourceLabel: displayLabel(materialized?.background, "Background personalizzato") };
  }
  if (key.startsWith("background:") || key === background?.privilege?.key) {
    return { category: "Background", sourceLabel: displayLabel(background, identity.backgroundKey) };
  }
  const racialFeatures = [...(race?.features ?? []), ...(subrace?.features ?? [])];
  if (racialFeatures.some((entry) => entry.key === key) || key.startsWith("feat:") || key.startsWith("draconic-ancestry:")) {
    return { category: "Razza", sourceLabel: displayLabel(subrace ?? race, identity.raceKey) };
  }
  return { category: "Classe", sourceLabel: classLabel(identity.classKey) };
}

const ARMOR_LABELS = Object.freeze({ light: "armature leggere", medium: "armature medie", heavy: "armature pesanti", all: "tutte le armature", shields: "scudi", "medium-nonmetal": "armature medie non metalliche", "shields-nonmetal": "scudi non metallici" });
const ARMOR_TARGETS = Object.freeze({ light: ["ARMOR_LIGHT"], medium: ["ARMOR_MEDIUM"], heavy: ["ARMOR_HEAVY"], all: ["ARMOR_LIGHT", "ARMOR_MEDIUM", "ARMOR_HEAVY"], shields: ["SHIELD"], "medium-nonmetal": ["ARMOR_MEDIUM"], "shields-nonmetal": ["SHIELD"] });
const FEAT_ARMOR = Object.freeze({ lightlyArmored: ["light"], moderatelyArmored: ["medium", "shields"], heavilyArmored: ["heavy"] });

function addAll(target, values) {
  for (const value of values ?? []) if (value) target.add(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function proficiencyCards(materialized) {
  const identity = materialized.identity ?? {};
  const race = RACES[identity.raceKey];
  const subrace = race?.subraces?.[identity.subraceKey];
  const classData = LEVEL_ONE_CLASSES[identity.classKey];
  const background = BACKGROUNDS[identity.backgroundKey] ?? materialized?.background ?? {};
  if (!race || !classData || !background) return [];
  const featKey = materialized.choices?.["race:variant-human:feat"]?.[0];
  const raceArmor = new Set([...(race.armorProficiencies ?? []), ...(subrace?.armorProficiencies ?? []), ...(FEAT_ARMOR[featKey] ?? [])]);
  const classArmor = new Set(classData.fixed?.armor ?? []);
  const extraClassArmor = (materialized.proficiencies?.armor ?? []).filter((value) => !raceArmor.has(value) && !classArmor.has(value));
  const groups = [
    { category: "Razza", name: "Competenze razziali", sourceLabel: displayLabel(subrace ?? race, identity.raceKey), skills: new Set([...list(race.skillProficiencies), ...list(subrace?.skillProficiencies)]), languages: new Set([...list(race.languages), ...list(subrace?.languages)]), tools: new Set([...list(race.toolProficiencies), ...list(subrace?.toolProficiencies)]), armor: raceArmor, weapons: new Set([...list(race.weaponProficiencies), ...list(subrace?.weaponProficiencies)]), savingThrows: new Set() },
    { category: "Classe", name: "Competenze di classe", sourceLabel: classLabel(identity.classKey), skills: new Set(), languages: new Set(), tools: new Set(classData.fixed?.tools ?? []), armor: classArmor, weapons: new Set(classData.fixed?.weapons ?? []), savingThrows: new Set(classData.fixed?.savingThrows ?? []) },
    { category: "Background", name: "Competenze del background", sourceLabel: displayLabel(background, identity.backgroundKey), skills: new Set(list(background.skillProficiencies)), languages: new Set(list(background.languages)), tools: new Set(list(background.toolProficiencies)), armor: new Set(), weapons: new Set(), savingThrows: new Set() },
    { category: "Alternative ai doppioni", name: "Competenze alternative", sourceLabel: "Competenze concesse da più fonti", skills: new Set(), languages: new Set(), tools: new Set(), armor: new Set(), weapons: new Set(), savingThrows: new Set() },
  ];
  addAll(groups[1].armor, extraClassArmor);
  for (const slot of materialized.choiceSlots ?? []) {
    const index = ["race", "subrace", "feat"].includes(slot.owner) ? 0 : slot.owner === "background" ? 2 : ["class", "classDomain", "classSubclass"].includes(slot.owner) ? 1 : slot.owner === "replacement" ? 3 : -1;
    if (index < 0) continue;
    for (const key of materialized.choices?.[slot.id] ?? []) {
      const kind = slot.kind === "skillOrTool" ? (key in SKILLS ? "skill" : "tool") : slot.kind === "toolOrLanguage" ? (key in LANGUAGES ? "language" : "tool") : slot.kind;
      if (kind === "skill") groups[index].skills.add(key);
      if (kind === "language") groups[index].languages.add(key);
      if (kind === "tool") groups[index].tools.add(key);
    }
  }
  const labels = (values, catalog) => [...values].map((key) => catalog[key] ?? key).join(", ");
  return groups.flatMap((group, index) => {
    const lines = [
      group.skills.size ? `Abilità: ${labels(group.skills, SKILLS)}` : null,
      group.languages.size ? `Lingue: ${labels(group.languages, LANGUAGES)}` : null,
      group.tools.size ? `Strumenti: ${labels(group.tools, { ...TOOLS, ...ARTISAN_TOOL_LABELS })}` : null,
      group.armor.size ? `Armature: ${labels(group.armor, ARMOR_LABELS)}` : null,
      group.weapons.size ? `Armi: ${labels(group.weapons, { ...EQUIPMENT, ...WEAPON_LABELS, simple: "armi semplici", martial: "armi da guerra" })}` : null,
      group.savingThrows.size ? `Tiri salvezza: ${labels(group.savingThrows, { strength: "Forza", dexterity: "Destrezza", constitution: "Costituzione", intelligence: "Intelligenza", wisdom: "Saggezza", charisma: "Carisma" })}` : null,
    ].filter(Boolean);
    if (!lines.length) return [];
    const armorEffects = [...(index === 0 ? group.armor : index === 1 ? extraClassArmor : [])]
      .flatMap((key) => ARMOR_TARGETS[key] ?? [])
      .filter((target, position, all) => all.indexOf(target) === position)
      .map((target) => ({ category: "PROFICIENCY", target }));
    return [{
      name: group.name,
      category: group.category,
      kind: "passive",
      shortDescription: lines.join("; "),
      description: `${lines.join("\n")}. Le competenze nelle abilità e i tiri salvezza sono già applicati ai valori della scheda.`,
      ...(armorEffects.length ? { passiveEffects: armorEffects } : {}),
      sourceType: "character",
      sourceLabel: group.sourceLabel,
      sourceFeatureId: `creation:proficiencies:${group.category.toLowerCase()}`,
      readOnly: true,
    }];
  });
}

export function projectGuidedCreationCapabilities(materialized) {
  if (!materialized?.ok || !Array.isArray(materialized.features)) return [];
  const seen = new Set();
  return [...proficiencyCards(materialized), ...materialized.features.flatMap((feature) => {
    const key = String(feature?.key ?? "");
    if (!key || seen.has(key) || key === "feat" || key.startsWith("expertise:") || key.startsWith("knowledge-expertise:")) return [];
    seen.add(key);
    const source = featureSource(materialized, feature);
    const name = displayLabel(feature, key);
    const description = ruleDescription(materialized, feature, key, name);
    const shortDescription = String(feature?.description ?? FEATURE_DESCRIPTIONS[key] ?? description.split(/\n|(?<=\.)\s/)[0]).trim();
    const passiveEffects = AUTOMATIC_EFFECTS[key];
    return [{
      name,
      category: source.category,
      kind: ACTIVE_FEATURES.has(key) ? "active" : "passive",
      shortDescription,
      description,
      ...(passiveEffects ? { passiveEffects } : {}),
      sourceType: "character",
      sourceLabel: source.sourceLabel,
      sourceFeatureId: `creation:${key}`,
      readOnly: true,
    }];
  })];
}

export function isLegacyGuidedCreationFeature(feature, materialized) {
  if (!feature || !Array.isArray(materialized?.features)) return false;
  return materialized.features.some((grant) =>
    feature.name === displayLabel(grant, grant?.key)
    && feature.description === String(grant?.description ?? "Privilegio ottenuto durante la creazione guidata.")
  );
}

export function guidedCreationHitPointsPerLevel(materialized) {
  if (!materialized?.ok) return 0;
  const hillDwarf = materialized.identity?.raceKey === "dwarf" && materialized.identity?.subraceKey === "hill";
  const toughFeat = materialized.choices?.["race:variant-human:feat"]?.includes("tough") === true;
  return (hillDwarf ? 1 : 0) + (toughFeat ? 2 : 0);
}
