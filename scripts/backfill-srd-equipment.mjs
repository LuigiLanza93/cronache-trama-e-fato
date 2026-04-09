import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DB_PATH = path.resolve(ROOT_DIR, "prisma", "migration.db");

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA foreign_keys = ON;");

function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function copperFromPrice(price) {
  const source = String(price ?? "").trim().toLowerCase();
  const match = source.match(/^([\d.,]+)\s*(mr|ma|me|mo|mp)$/);
  if (!match) return null;
  const amount = Number.parseFloat(match[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  const multipliers = { mr: 1, ma: 10, me: 50, mo: 100, mp: 1000 };
  return Math.round(amount * multipliers[match[2]]);
}

function kilograms(value) {
  if (value == null) return null;
  const amount = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

function buildRequiredSlots(groupKey, slots) {
  return slots.map((slot, index) => ({
    id: crypto.randomUUID(),
    groupKey,
    selectionMode: "ALL_REQUIRED",
    slot,
    required: true,
    sortOrder: index,
  }));
}

function buildSingleSlotChoice(groupKey, slots) {
  return slots.map((slot, index) => ({
    id: crypto.randomUUID(),
    groupKey,
    selectionMode: "ANY_ONE",
    slot,
    required: true,
    sortOrder: index,
  }));
}

function buildWeaponSlotRules(handling) {
  if (handling === "TWO_HANDED") {
    return buildRequiredSlots("two-handed", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]);
  }
  if (handling === "VERSATILE") {
    return [
      ...buildSingleSlotChoice("one-handed", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]),
      ...buildRequiredSlots("two-handed", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]).map((entry, index) => ({
        ...entry,
        groupKey: "two-handed",
        sortOrder: index,
      })),
    ];
  }
  return buildSingleSlotChoice("one-handed", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]);
}

function makeAttack({
  name,
  kind,
  handRequirement,
  attackBonus = null,
  damageDice = null,
  damageType = null,
  rangeNormal = null,
  rangeLong = null,
  twoHandedOnly = false,
  conditionText = null,
  sortOrder = 0,
}) {
  return {
    id: crypto.randomUUID(),
    name,
    kind,
    handRequirement,
    ability: null,
    attackBonus,
    damageDice,
    damageType,
    rangeNormal,
    rangeLong,
    twoHandedOnly,
    requiresEquipped: true,
    conditionText,
    sortOrder,
  };
}

function weaponDefinition({
  name,
  price,
  weight,
  damageDice,
  damageType,
  handling,
  kind,
  rangeNormal = null,
  rangeLong = null,
  finesse = false,
  thrown = false,
  reach = false,
  heavy = false,
  loading = false,
  light = false,
  special = null,
  versatileDamage = null,
}) {
  const baseDescription = [];
  if (light) baseDescription.push("Leggera");
  if (finesse) baseDescription.push("Precisione");
  if (thrown && rangeNormal && rangeLong) baseDescription.push(`Da lancio (${rangeNormal}/${rangeLong})`);
  if (kind === "RANGED_WEAPON" && rangeNormal && rangeLong) baseDescription.push(`Gittata ${rangeNormal}/${rangeLong}`);
  if (reach) baseDescription.push("Portata");
  if (heavy) baseDescription.push("Pesante");
  if (loading) baseDescription.push("Ricarica");
  if (special) baseDescription.push(`Speciale: ${special}`);

  const attacks = [];
  if (handling === "VERSATILE") {
    attacks.push(
      makeAttack({
        name,
        kind,
        handRequirement: "ONE_HANDED",
        damageDice,
        damageType,
        rangeNormal,
        rangeLong,
        sortOrder: 0,
      })
    );
    attacks.push(
      makeAttack({
        name: `${name} (due mani)`,
        kind,
        handRequirement: "TWO_HANDED",
        damageDice: versatileDamage ?? damageDice,
        damageType,
        rangeNormal,
        rangeLong,
        twoHandedOnly: true,
        sortOrder: 1,
      })
    );
  } else {
    attacks.push(
      makeAttack({
        name,
        kind,
        handRequirement: handling === "TWO_HANDED" ? "TWO_HANDED" : "ONE_HANDED",
        damageDice,
        damageType,
        rangeNormal,
        rangeLong,
        twoHandedOnly: handling === "TWO_HANDED",
      })
    );
  }

  return {
    name,
    category: "WEAPON",
    description: baseDescription.join(" - ") || null,
    weaponHandling: handling,
    stackable: false,
    equippable: true,
    weight: kilograms(weight),
    valueCp: copperFromPrice(price),
    slotRules: buildWeaponSlotRules(handling),
    attacks,
    modifiers: [],
    features: [],
    useEffects: [],
  };
}

function armorDefinition({ name, price, weight, armorCategory, armorClassBase, armorClassCalculation, description = null }) {
  return {
    name,
    category: "ARMOR",
    description,
    armorCategory,
    armorClassCalculation,
    armorClassBase,
    stackable: false,
    equippable: true,
    weight: kilograms(weight),
    valueCp: copperFromPrice(price),
    slotRules: buildRequiredSlots("wear", ["ARMOR"]),
    attacks: [],
    modifiers: [],
    features: [],
    useEffects: [],
  };
}

function shieldDefinition({ name, price, weight, armorClassBonus = 2, description = null }) {
  return {
    name,
    category: "SHIELD",
    description,
    armorCategory: "SHIELD",
    armorClassCalculation: "BONUS_ONLY",
    armorClassBonus,
    stackable: false,
    equippable: true,
    weight: kilograms(weight),
    valueCp: copperFromPrice(price),
    slotRules: buildSingleSlotChoice("wear", ["WEAPON_HAND_LEFT", "WEAPON_HAND_RIGHT"]),
    attacks: [],
    modifiers: [],
    features: [],
    useEffects: [],
  };
}

function gearDefinition({
  name,
  category = "GEAR",
  price = null,
  weight = null,
  description = null,
  stackable = false,
  equippable = false,
  slotRules = [],
  useEffects = [],
}) {
  return {
    name,
    category,
    description,
    stackable,
    equippable,
    weight: kilograms(weight),
    valueCp: copperFromPrice(price),
    slotRules,
    attacks: [],
    modifiers: [],
    features: [],
    useEffects,
  };
}

function useEffect({
  effectType,
  targetType = "CREATURE",
  diceExpression = null,
  flatValue = null,
  damageType = null,
  savingThrowAbility = null,
  savingThrowDc = null,
  successOutcome = null,
  durationText = null,
  notes = null,
  sortOrder = 0,
}) {
  return {
    id: crypto.randomUUID(),
    effectType,
    targetType,
    diceExpression,
    flatValue,
    damageType,
    savingThrowAbility,
    savingThrowDc,
    successOutcome,
    durationText,
    notes,
    sortOrder,
  };
}

const SRD_ITEMS = [
  armorDefinition({ name: "Imbottita", price: "5 mo", weight: 4, armorCategory: "LIGHT", armorClassBase: 11, armorClassCalculation: "BASE_PLUS_DEX", description: "Svantaggio a Furtività." }),
  armorDefinition({ name: "Cuoio", price: "10 mo", weight: 5, armorCategory: "LIGHT", armorClassBase: 11, armorClassCalculation: "BASE_PLUS_DEX" }),
  armorDefinition({ name: "Cuoio borchiato", price: "45 mo", weight: 6.5, armorCategory: "LIGHT", armorClassBase: 12, armorClassCalculation: "BASE_PLUS_DEX" }),
  armorDefinition({ name: "Pelle", price: "10 mo", weight: 6, armorCategory: "MEDIUM", armorClassBase: 12, armorClassCalculation: "BASE_PLUS_DEX_MAX_2" }),
  armorDefinition({ name: "Giaco di Maglia", price: "50 mo", weight: 10, armorCategory: "MEDIUM", armorClassBase: 13, armorClassCalculation: "BASE_PLUS_DEX_MAX_2" }),
  armorDefinition({ name: "Scaglie", price: "50 mo", weight: 22.5, armorCategory: "MEDIUM", armorClassBase: 14, armorClassCalculation: "BASE_PLUS_DEX_MAX_2", description: "Svantaggio a Furtività." }),
  armorDefinition({ name: "Corazza a Piastre", price: "400 mo", weight: 10, armorCategory: "MEDIUM", armorClassBase: 14, armorClassCalculation: "BASE_PLUS_DEX_MAX_2" }),
  armorDefinition({ name: "Mezza a Piastre", price: "750 mo", weight: 20, armorCategory: "MEDIUM", armorClassBase: 15, armorClassCalculation: "BASE_PLUS_DEX_MAX_2", description: "Svantaggio a Furtività." }),
  armorDefinition({ name: "Anelli", price: "30 mo", weight: 20, armorCategory: "HEAVY", armorClassBase: 14, armorClassCalculation: "BASE_ONLY", description: "Svantaggio a Furtività." }),
  armorDefinition({ name: "Strisce", price: "200 mo", weight: 30, armorCategory: "HEAVY", armorClassBase: 17, armorClassCalculation: "BASE_ONLY", description: "For 15, svantaggio a Furtività." }),
  armorDefinition({ name: "Completa a Piastre", price: "1500 mo", weight: 32.5, armorCategory: "HEAVY", armorClassBase: 18, armorClassCalculation: "BASE_ONLY", description: "For 15, svantaggio a Furtività." }),
  shieldDefinition({ name: "Scudo", price: "10 mo", weight: 3 }),

  weaponDefinition({ name: "Ascia", price: "5 mo", weight: 1, damageDice: "1d6", damageType: "tagliente", handling: "ONE_HANDED", kind: "MELEE_WEAPON", rangeNormal: 6, rangeLong: 18, thrown: true, light: true }),
  weaponDefinition({ name: "Bastone da combattimento", price: "2 ma", weight: 2, damageDice: "1d6", damageType: "contundente", handling: "VERSATILE", kind: "MELEE_WEAPON", versatileDamage: "1d8" }),
  weaponDefinition({ name: "Falcetto", price: "1 mo", weight: 1, damageDice: "1d4", damageType: "tagliente", handling: "ONE_HANDED", kind: "MELEE_WEAPON", light: true }),
  weaponDefinition({ name: "Giavellotto", price: "5 ma", weight: 1, damageDice: "1d6", damageType: "perforante", handling: "ONE_HANDED", kind: "MELEE_WEAPON", rangeNormal: 9, rangeLong: 36, thrown: true }),
  weaponDefinition({ name: "Lancia", price: "1 mo", weight: 1.5, damageDice: "1d6", damageType: "perforante", handling: "VERSATILE", kind: "MELEE_WEAPON", rangeNormal: 6, rangeLong: 18, thrown: true, versatileDamage: "1d8" }),
  weaponDefinition({ name: "Martello leggero", price: "2 mo", weight: 1, damageDice: "1d4", damageType: "contundente", handling: "ONE_HANDED", kind: "MELEE_WEAPON", rangeNormal: 6, rangeLong: 18, thrown: true, light: true }),
  weaponDefinition({ name: "Mazza", price: "5 mo", weight: 2, damageDice: "1d6", damageType: "contundente", handling: "ONE_HANDED", kind: "MELEE_WEAPON" }),
  weaponDefinition({ name: "Randello", price: "1 ma", weight: 1, damageDice: "1d4", damageType: "contundente", handling: "ONE_HANDED", kind: "MELEE_WEAPON", light: true }),
  weaponDefinition({ name: "Randello pesante", price: "2 mo", weight: 5, damageDice: "1d8", damageType: "contundente", handling: "TWO_HANDED", kind: "MELEE_WEAPON" }),
  weaponDefinition({ name: "Balestra leggera", price: "25 mo", weight: 2.5, damageDice: "1d8", damageType: "perforante", handling: "TWO_HANDED", kind: "RANGED_WEAPON", rangeNormal: 24, rangeLong: 96, loading: true }),
  weaponDefinition({ name: "Dardo", price: "5 mr", weight: 0.12, damageDice: "1d4", damageType: "perforante", handling: "ONE_HANDED", kind: "RANGED_WEAPON", rangeNormal: 9, rangeLong: 36, finesse: true }),
  weaponDefinition({ name: "Fionda", price: "1 ma", weight: null, damageDice: "1d4", damageType: "contundente", handling: "ONE_HANDED", kind: "RANGED_WEAPON", rangeNormal: 9, rangeLong: 36 }),
  weaponDefinition({ name: "Alabarda", price: "20 mo", weight: 3, damageDice: "1d10", damageType: "tagliente", handling: "TWO_HANDED", kind: "MELEE_WEAPON", reach: true, heavy: true }),
  weaponDefinition({ name: "Ascia da battaglia", price: "10 mo", weight: 2, damageDice: "1d8", damageType: "tagliente", handling: "VERSATILE", kind: "MELEE_WEAPON", versatileDamage: "1d10" }),
  weaponDefinition({ name: "Falcione", price: "20 mo", weight: 3, damageDice: "1d10", damageType: "tagliente", handling: "TWO_HANDED", kind: "MELEE_WEAPON", reach: true, heavy: true }),
  weaponDefinition({ name: "Frusta", price: "2 mo", weight: 1.5, damageDice: "1d4", damageType: "tagliente", handling: "ONE_HANDED", kind: "MELEE_WEAPON", finesse: true, reach: true }),
  weaponDefinition({ name: "Lancia da cavaliere", price: "10 mo", weight: 3, damageDice: "1d12", damageType: "perforante", handling: "TWO_HANDED", kind: "MELEE_WEAPON", reach: true, special: "A una mano solo in sella; svantaggio entro 1,5 m." }),
  weaponDefinition({ name: "Maglio", price: "10 mo", weight: 5, damageDice: "2d6", damageType: "contundente", handling: "TWO_HANDED", kind: "MELEE_WEAPON", heavy: true }),
  weaponDefinition({ name: "Martello da guerra", price: "15 mo", weight: 1, damageDice: "1d8", damageType: "contundente", handling: "VERSATILE", kind: "MELEE_WEAPON", versatileDamage: "1d10" }),
  weaponDefinition({ name: "Mazzafrusto", price: "10 mo", weight: 1, damageDice: "1d8", damageType: "contundente", handling: "ONE_HANDED", kind: "MELEE_WEAPON" }),
  weaponDefinition({ name: "Morning star", price: "15 mo", weight: 2, damageDice: "1d8", damageType: "perforante", handling: "ONE_HANDED", kind: "MELEE_WEAPON" }),
  weaponDefinition({ name: "Picca", price: "5 mo", weight: 9, damageDice: "1d10", damageType: "perforante", handling: "TWO_HANDED", kind: "MELEE_WEAPON", heavy: true, reach: true }),
  weaponDefinition({ name: "Piccone da guerra", price: "5 mo", weight: 1, damageDice: "1d8", damageType: "perforante", handling: "ONE_HANDED", kind: "MELEE_WEAPON" }),
  weaponDefinition({ name: "Scimitarra", price: "25 mo", weight: 1.5, damageDice: "1d6", damageType: "tagliente", handling: "ONE_HANDED", kind: "MELEE_WEAPON", finesse: true, light: true }),
  weaponDefinition({ name: "Spadone", price: "50 mo", weight: 3, damageDice: "2d6", damageType: "tagliente", handling: "TWO_HANDED", kind: "MELEE_WEAPON", heavy: true }),
  weaponDefinition({ name: "Stocco", price: "25 mo", weight: 1, damageDice: "1d8", damageType: "perforante", handling: "ONE_HANDED", kind: "MELEE_WEAPON", finesse: true }),
  weaponDefinition({ name: "Tridente", price: "5 mo", weight: 2, damageDice: "1d6", damageType: "perforante", handling: "VERSATILE", kind: "MELEE_WEAPON", rangeNormal: 6, rangeLong: 18, thrown: true, versatileDamage: "1d8" }),
  weaponDefinition({ name: "Balestra pesante", price: "50 mo", weight: 9, damageDice: "1d10", damageType: "perforante", handling: "TWO_HANDED", kind: "RANGED_WEAPON", rangeNormal: 30, rangeLong: 120, loading: true, heavy: true }),
  weaponDefinition({ name: "Balestra a mano", price: "75 mo", weight: 1.5, damageDice: "1d6", damageType: "perforante", handling: "ONE_HANDED", kind: "RANGED_WEAPON", rangeNormal: 9, rangeLong: 36, loading: true, light: true }),
  weaponDefinition({ name: "Cerbottana", price: "10 mo", weight: 0.5, damageDice: "1", damageType: "perforante", handling: "ONE_HANDED", kind: "RANGED_WEAPON", rangeNormal: 7.5, rangeLong: 30, loading: true }),
  weaponDefinition({ name: "Rete", price: "1 mo", weight: 1.5, damageDice: null, damageType: null, handling: "ONE_HANDED", kind: "SPECIAL", rangeNormal: 1.5, rangeLong: 4.5, special: "Intralcia su colpo; una sola rete per azione/bonus/reazione." }),

  gearDefinition({ name: "Aghi da cerbottana (50)", category: "AMMUNITION", price: "1 mo", weight: 0.5, stackable: true }),
  gearDefinition({ name: "Proiettili da fionda (20)", category: "AMMUNITION", price: "4 mr", weight: 0.75, stackable: true }),
  gearDefinition({ name: "Acido (fiala)", category: "CONSUMABLE", price: "25 mo", weight: 0.5, stackable: true, description: "Tiro improvvisato entro 6 m.", useEffects: [useEffect({ effectType: "DAMAGE", diceExpression: "2d6", damageType: "acido", targetType: "CREATURE" })] }),
  gearDefinition({ name: "Acqua Sacra (ampolla)", category: "CONSUMABLE", price: "25 mo", weight: 0.5, stackable: true, description: "Tiro improvvisato entro 6 m contro immondi o non morti.", useEffects: [useEffect({ effectType: "DAMAGE", diceExpression: "2d6", damageType: "radiante", targetType: "CREATURE", notes: "Contro immondi o non morti." })] }),
  gearDefinition({ name: "Antitossina (fiala)", category: "CONSUMABLE", price: "50 mo", weight: null, stackable: true, description: "Vantaggio ai tiri salvezza contro il veleno per 1 ora." }),
  gearDefinition({ name: "Ariete Portatile", price: "4 mo", weight: 17.5, description: "Bonus +4 alle prove di Forza per abbattere porte; vantaggio se aiutato." }),
  gearDefinition({ name: "Attrezzi da Scasso", category: "TOOL", price: "25 mo", weight: 0.5, description: "Per disarmare trappole e aprire serrature." }),
  gearDefinition({ name: "Attrezzatura da Pesca", category: "TOOL", price: "1 mo", weight: 2, description: "Asta, filo, ami, esche e retino." }),
  gearDefinition({ name: "Biglie di Metallo", category: "CONSUMABLE", price: "1 mo", weight: 1, stackable: true, description: "Coprono un quadrato di 3 m; TS Des CD 10 o prono." }),
  gearDefinition({ name: "Bilancia da Mercante", category: "TOOL", price: "5 mo", weight: 1.5, description: "Per pesare oggetti di piccolo taglio fino a 1 kg." }),
  gearDefinition({ name: "Borsa dei Componenti", price: "25 mo", weight: 1, description: "Contiene componenti materiali comuni senza costo specifico." }),
  gearDefinition({ name: "Borsello", price: "5 ma", weight: 0.5, description: "Borsello da cintura per piccoli oggetti e munizioni." }),
  gearDefinition({ name: "Candela", category: "CONSUMABLE", price: "1 mr", weight: null, stackable: true, description: "Luce intensa 1,5 m e fioca per altri 1,5 m per 1 ora." }),
  gearDefinition({ name: "Cannocchiale", price: "1000 mo", weight: 0.5, description: "Ingrandisce gli oggetti al doppio delle dimensioni." }),
  gearDefinition({ name: "Carrucola e Paranco", price: "1 mo", weight: 2.5, description: "Permette di tirare fino a quattro volte il peso normale." }),
  gearDefinition({ name: "Catena (3 metri)", price: "5 mo", weight: 5, description: "10 PF; prova di Forza CD 20 per spezzarla." }),
  gearDefinition({ name: "Corda di canapa (15 metri)", price: "1 mo", weight: 5, description: "2 PF; prova di Forza CD 17 per spezzarla." }),
  gearDefinition({ name: "Corda di seta (15 metri)", price: "10 mo", weight: 2.5, description: "2 PF; prova di Forza CD 17 per spezzarla." }),
  gearDefinition({ name: "Faretra", price: "1 mo", weight: 0.5, description: "Contiene fino a 20 frecce." }),
  gearDefinition({ name: "Focus Arcano", price: "10 mo", weight: 1, description: "Oggetto per incanalare la magia arcana." }),
  gearDefinition({ name: "Focus Druidico", price: "1 mo", weight: 0.5, description: "Oggetto sacro naturale per lanciare incantesimi druidici." }),
  gearDefinition({ name: "Fuoco dell’Alchimista (ampolla)", category: "CONSUMABLE", price: "50 mo", weight: 0.5, stackable: true, description: "Tiro improvvisato entro 6 m; il bersaglio brucia finché non spegne le fiamme.", useEffects: [useEffect({ effectType: "DAMAGE", diceExpression: "1d4", damageType: "fuoco", targetType: "CREATURE", notes: "All'inizio di ogni turno finché non viene spento con una prova di Destrezza CD 10." })] }),
  gearDefinition({ name: "Kit da Guaritore", category: "CONSUMABLE", price: "5 mo", weight: 1.5, description: "10 usi; stabilizza una creatura a 0 PF senza prova di Medicina." }),
  gearDefinition({ name: "Kit da Pranzo", category: "TOOL", price: "2 ma", weight: 0.5, description: "Scatola con ciotola e posate; usabile anche come pentola o piatto." }),
  gearDefinition({ name: "Kit da Scalatore", category: "TOOL", price: "25 mo", weight: 6, description: "Permette di ancorarsi e limitare una caduta a 7,5 m." }),
  gearDefinition({ name: "Lampada", price: "5 ma", weight: 0.5, description: "Brucia 6 ore con 1 ampolla d'olio." }),
  gearDefinition({ name: "Lanterna a lente sporgente", price: "10 mo", weight: 1, description: "Brucia 6 ore con 1 ampolla d'olio." }),
  gearDefinition({ name: "Lanterna schermabile", price: "5 mo", weight: 1, description: "Brucia 6 ore con 1 ampolla d'olio; puo essere schermata." }),
  gearDefinition({ name: "Libro", price: "25 mo", weight: 2.5, description: "Tomo rilegato per testi e disegni." }),
  gearDefinition({ name: "Libro degli Incantesimi", price: "50 mo", weight: 1.5, description: "Tomo essenziale per i maghi." }),
  gearDefinition({ name: "Olio (ampolla)", category: "CONSUMABLE", price: "1 ma", weight: 0.5, stackable: true, description: "Usato per lampade o incendiato su bersagli e superfici." }),
  gearDefinition({ name: "Piede di Porco", price: "2 mo", weight: 2.5, description: "Vantaggio alle prove di Forza se la leva puo essere applicata." }),
  gearDefinition({ name: "Razioni (1 giorno)", category: "CONSUMABLE", price: "5 ma", weight: 1, stackable: true }),
  gearDefinition({ name: "Simbolo sacro", category: "AMULET", price: "5 mo", weight: 0.5, equippable: true, slotRules: buildRequiredSlots("wear", ["NECK"]), description: "Amuleto, emblema o reliquiario consacrato." }),
  gearDefinition({ name: "Torcia", category: "CONSUMABLE", price: "1 mr", weight: 0.5, stackable: true, description: "Brucia per 1 ora." }),
  gearDefinition({ name: "Trappola da caccia", category: "TOOL", price: "5 mo", weight: 12.5, description: "TS Des CD 13 o perforanti e velocita azzerata finché non si libera." }),
  gearDefinition({ name: "Triboli (borsa di 20)", category: "CONSUMABLE", price: "1 mo", weight: 1, stackable: true, description: "Coprono 1,5 m quadrati; rallentano e infliggono 1 perforante." }),
  gearDefinition({ name: "Zaino", price: "2 mo", weight: 2.5, description: "Contenitore base da viaggio." }),
  gearDefinition({ name: "Zaino da Diplomatico", price: "39 mo", weight: null, description: "Pack SRD con forziere, mappe, abiti eleganti, inchiostro, lampada, olio, carta, profumo, ceralacca e sapone." }),
  gearDefinition({ name: "Zaino da Esploratore", price: "10 mo", weight: null, description: "Pack SRD con zaino, giaciglio, kit da pranzo, esca, torce, razioni, otre e corda." }),
  gearDefinition({ name: "Zaino da Intrattenitore", price: "40 mo", weight: null, description: "Pack SRD con zaino, giaciglio, abiti personalizzati, candele, razioni, otre e kit da camuffamento." }),
  gearDefinition({ name: "Zaino da Rapinatore", price: "16 mo", weight: null, description: "Pack SRD con biglie, lacci, campanella, candele, piede di porco, martello, chiodi, lanterna, olio, razioni, esca, otre e corda." }),
  gearDefinition({ name: "Zaino da Sacerdote", price: "19 mo", weight: null, description: "Pack SRD con zaino, coperta, candele, esca, cassetta per l'elemosina, incenso, incensiere, paramenti, razioni e otre." }),
  gearDefinition({ name: "Zaino da Speleologo", price: "12 mo", weight: null, description: "Pack SRD con piede di porco, martello, chiodi, torce, esca, razioni, otre e corda." }),
  gearDefinition({ name: "Zaino da Studioso", price: "40 mo", weight: null, description: "Pack SRD con libro di studio, inchiostro, pennino, pergamene, sabbia e coltellino." }),
];

const DUPLICATE_HINTS = {
  "Cuoio": ["Armatura di cuoio"],
  "Completa a Piastre": ["Armatura completa"],
  "Kit da Guaritore": ["Kit del guaritore"],
  "Zaino da Esploratore": ["Dotazione da Esploratore", "Explorer's pack"],
  "Borsa dei Componenti": ["Componenti Arcani"],
  "Scudo": ["Scudo borchiato"],
  "Attrezzi da Scasso": ["Grimaldello"],
};

const existingRows = sqlite
  .prepare('SELECT id, slug, name FROM "ItemDefinition" ORDER BY name COLLATE NOCASE')
  .all();

const existingByNormalizedName = new Map(existingRows.map((row) => [normalizeName(row.name), row]));
const usedSlugs = new Set(existingRows.map((row) => row.slug));

const insertItemDefinition = sqlite.prepare(`
  INSERT INTO "ItemDefinition" (
    id, slug, name, category, subcategory, weaponHandling, gloveWearMode, armorCategory,
    armorClassCalculation, armorClassBase, armorClassBonus, rarity, description, playerVisible,
    stackable, equippable, attunement, weight, valueCp, data, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSlotRule = sqlite.prepare(`
  INSERT INTO "ItemSlotRule" (id, itemDefinitionId, groupKey, selectionMode, slot, required, sortOrder)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAttack = sqlite.prepare(`
  INSERT INTO "ItemAttack" (
    id, itemDefinitionId, name, kind, handRequirement, ability, attackBonus, damageDice,
    damageType, rangeNormal, rangeLong, twoHandedOnly, requiresEquipped, conditionText,
    sortOrder, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertUseEffect = sqlite.prepare(`
  INSERT INTO "ItemUseEffect" (
    id, itemDefinitionId, effectType, targetType, diceExpression, flatValue, damageType,
    savingThrowAbility, savingThrowDc, successOutcome, durationText, notes, sortOrder, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function nextUniqueSlug(baseName) {
  const base = sanitizeSlug(baseName);
  let candidate = base;
  let counter = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  usedSlugs.add(candidate);
  return candidate;
}

const inserted = [];
const skippedExisting = [];
const duplicateCandidates = [];
const now = new Date().toISOString();

sqlite.exec("BEGIN");
try {
  for (const item of SRD_ITEMS) {
    const normalized = normalizeName(item.name);
    const existing = existingByNormalizedName.get(normalized);
    if (existing) {
      skippedExisting.push({ name: item.name, existing: existing.name });
      continue;
    }

    const id = crypto.randomUUID();
    const slug = nextUniqueSlug(item.name);
    insertItemDefinition.run(
      id,
      slug,
      item.name,
      item.category ?? "GEAR",
      null,
      item.weaponHandling ?? null,
      null,
      item.armorCategory ?? null,
      item.armorClassCalculation ?? null,
      item.armorClassBase ?? null,
      item.armorClassBonus ?? null,
      null,
      item.description ?? null,
      1,
      item.stackable ? 1 : 0,
      item.equippable ? 1 : 0,
      0,
      item.weight ?? null,
      item.valueCp ?? null,
      JSON.stringify({ importedFrom: "srd05_05_equipaggiamento.pdf", importedAt: now }),
      now,
      now
    );

    for (const slotRule of item.slotRules ?? []) {
      insertSlotRule.run(
        String(slotRule.id ?? crypto.randomUUID()),
        id,
        String(slotRule.groupKey ?? "default"),
        String(slotRule.selectionMode ?? "ALL_REQUIRED"),
        String(slotRule.slot),
        slotRule.required === false ? 0 : 1,
        Number.isFinite(Number(slotRule.sortOrder)) ? Number(slotRule.sortOrder) : 0
      );
    }

    for (const attack of item.attacks ?? []) {
      insertAttack.run(
        String(attack.id ?? crypto.randomUUID()),
        id,
        attack.name,
        attack.kind ?? "MELEE_WEAPON",
        attack.handRequirement ?? "ANY",
        attack.ability ?? null,
        attack.attackBonus ?? null,
        attack.damageDice ?? null,
        attack.damageType ?? null,
        attack.rangeNormal ?? null,
        attack.rangeLong ?? null,
        attack.twoHandedOnly ? 1 : 0,
        attack.requiresEquipped === false ? 0 : 1,
        attack.conditionText ?? null,
        Number.isFinite(Number(attack.sortOrder)) ? Number(attack.sortOrder) : 0,
        now,
        now
      );
    }

    for (const effect of item.useEffects ?? []) {
      insertUseEffect.run(
        String(effect.id ?? crypto.randomUUID()),
        id,
        effect.effectType,
        effect.targetType ?? "CREATURE",
        effect.diceExpression ?? null,
        effect.flatValue ?? null,
        effect.damageType ?? null,
        effect.savingThrowAbility ?? null,
        effect.savingThrowDc ?? null,
        effect.successOutcome ?? null,
        effect.durationText ?? null,
        effect.notes ?? null,
        Number.isFinite(Number(effect.sortOrder)) ? Number(effect.sortOrder) : 0,
        now,
        now
      );
    }

    inserted.push({ name: item.name, category: item.category, slug });

    const hints = DUPLICATE_HINTS[item.name] ?? [];
    const matchedHints = hints.filter((hint) => existingRows.some((row) => normalizeName(row.name) === normalizeName(hint)));
    if (matchedHints.length > 0) {
      duplicateCandidates.push({ inserted: item.name, candidates: matchedHints });
    }
  }

  sqlite.exec("COMMIT");
} catch (error) {
  try {
    sqlite.exec("ROLLBACK");
  } catch {}
  throw error;
}

console.log(JSON.stringify({
  insertedCount: inserted.length,
  skippedExistingCount: skippedExisting.length,
  duplicateCandidateCount: duplicateCandidates.length,
  inserted,
  skippedExisting,
  duplicateCandidates,
}, null, 2));
