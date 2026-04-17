import type { CharacterInventoryItemEntry, ItemDefinitionEntry } from "@/lib/auth";

export type PactBladeWeaponTemplate = {
  id: string;
  name: string;
  damageDice: string;
  damageType: string;
  weaponHandling: "ONE_HANDED" | "TWO_HANDED" | "VERSATILE";
  rangeNormal?: number | null;
  rangeLong?: number | null;
  properties?: string[];
};

export const PACT_BLADE_TEMPLATE_ITEM_ID_PREFIX = "__pact_blade_item__:";
export const PACT_BLADE_TEMPLATE_DEFINITION_ID_PREFIX = "__pact_blade_definition__:";

export const PACT_BLADE_WEAPON_TEMPLATES: PactBladeWeaponTemplate[] = [
  { id: "club", name: "Randello", damageDice: "1d4", damageType: "contundente", weaponHandling: "ONE_HANDED", properties: ["Leggera"] },
  { id: "dagger", name: "Pugnale", damageDice: "1d4", damageType: "perforante", weaponHandling: "ONE_HANDED", rangeNormal: 6, rangeLong: 18, properties: ["Accurata", "Lancio", "Leggera"] },
  { id: "greatclub", name: "Randello Pesante", damageDice: "1d8", damageType: "contundente", weaponHandling: "TWO_HANDED", properties: ["Due Mani"] },
  { id: "handaxe", name: "Ascia", damageDice: "1d6", damageType: "tagliente", weaponHandling: "ONE_HANDED", rangeNormal: 6, rangeLong: 18, properties: ["Lancio", "Leggera"] },
  { id: "javelin", name: "Giavellotto", damageDice: "1d6", damageType: "perforante", weaponHandling: "ONE_HANDED", rangeNormal: 9, rangeLong: 36, properties: ["Lancio"] },
  { id: "light-hammer", name: "Martello Leggero", damageDice: "1d4", damageType: "contundente", weaponHandling: "ONE_HANDED", rangeNormal: 6, rangeLong: 18, properties: ["Lancio", "Leggera"] },
  { id: "mace", name: "Mazza", damageDice: "1d6", damageType: "contundente", weaponHandling: "ONE_HANDED" },
  { id: "quarterstaff", name: "Bastone Ferrato", damageDice: "1d6", damageType: "contundente", weaponHandling: "VERSATILE", properties: ["Versatile"] },
  { id: "sickle", name: "Falcetto", damageDice: "1d4", damageType: "tagliente", weaponHandling: "ONE_HANDED", properties: ["Leggera"] },
  { id: "spear", name: "Lancia", damageDice: "1d6", damageType: "perforante", weaponHandling: "VERSATILE", rangeNormal: 6, rangeLong: 18, properties: ["Lancio", "Versatile"] },
  { id: "battleaxe", name: "Ascia da Battaglia", damageDice: "1d8", damageType: "tagliente", weaponHandling: "VERSATILE", properties: ["Versatile"] },
  { id: "flail", name: "Flagello", damageDice: "1d8", damageType: "contundente", weaponHandling: "ONE_HANDED" },
  { id: "glaive", name: "Alabarda", damageDice: "1d10", damageType: "tagliente", weaponHandling: "TWO_HANDED", properties: ["Due Mani", "Pesante", "Portata"] },
  { id: "greataxe", name: "Ascia Bipenne", damageDice: "1d12", damageType: "tagliente", weaponHandling: "TWO_HANDED", properties: ["Due Mani", "Pesante"] },
  { id: "greatsword", name: "Spadone", damageDice: "2d6", damageType: "tagliente", weaponHandling: "TWO_HANDED", properties: ["Due Mani", "Pesante"] },
  { id: "halberd", name: "Falcione", damageDice: "1d10", damageType: "tagliente", weaponHandling: "TWO_HANDED", properties: ["Due Mani", "Pesante", "Portata"] },
  { id: "lance", name: "Lancia da Cavaliere", damageDice: "1d12", damageType: "perforante", weaponHandling: "ONE_HANDED", properties: ["Portata", "Speciale"] },
  { id: "longsword", name: "Spada Lunga", damageDice: "1d8", damageType: "tagliente", weaponHandling: "VERSATILE", properties: ["Versatile"] },
  { id: "maul", name: "Maglio", damageDice: "2d6", damageType: "contundente", weaponHandling: "TWO_HANDED", properties: ["Due Mani", "Pesante"] },
  { id: "morningstar", name: "Morning Star", damageDice: "1d8", damageType: "perforante", weaponHandling: "ONE_HANDED" },
  { id: "pike", name: "Picca", damageDice: "1d10", damageType: "perforante", weaponHandling: "TWO_HANDED", properties: ["Due Mani", "Pesante", "Portata"] },
  { id: "rapier", name: "Stocco", damageDice: "1d8", damageType: "perforante", weaponHandling: "ONE_HANDED", properties: ["Accurata"] },
  { id: "scimitar", name: "Scimitarra", damageDice: "1d6", damageType: "tagliente", weaponHandling: "ONE_HANDED", properties: ["Accurata", "Leggera"] },
  { id: "shortsword", name: "Spada Corta", damageDice: "1d6", damageType: "perforante", weaponHandling: "ONE_HANDED", properties: ["Accurata", "Leggera"] },
  { id: "trident", name: "Tridente", damageDice: "1d6", damageType: "perforante", weaponHandling: "VERSATILE", rangeNormal: 6, rangeLong: 18, properties: ["Lancio", "Versatile"] },
  { id: "war-pick", name: "Piccone da Guerra", damageDice: "1d8", damageType: "perforante", weaponHandling: "ONE_HANDED" },
  { id: "warhammer", name: "Martello da Guerra", damageDice: "1d8", damageType: "contundente", weaponHandling: "VERSATILE", properties: ["Versatile"] },
  { id: "whip", name: "Frusta", damageDice: "1d4", damageType: "tagliente", weaponHandling: "ONE_HANDED", properties: ["Accurata", "Portata"] },
];

export function getPactBladeTemplate(templateId: string | null | undefined) {
  if (!templateId) return null;
  return PACT_BLADE_WEAPON_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function getPactBladeTemplateDefinitionId(templateId: string) {
  return `${PACT_BLADE_TEMPLATE_DEFINITION_ID_PREFIX}${templateId}`;
}

export function getPactBladeTemplateItemId(templateId: string) {
  return `${PACT_BLADE_TEMPLATE_ITEM_ID_PREFIX}${templateId}`;
}

export function buildPactBladeVirtualDefinition(template: PactBladeWeaponTemplate): ItemDefinitionEntry {
  const definitionId = getPactBladeTemplateDefinitionId(template.id);
  const slotRules =
    template.weaponHandling === "TWO_HANDED"
      ? [
          {
            id: `${definitionId}:slot-right`,
            groupKey: "pact-blade-hands",
            selectionMode: "ALL_REQUIRED",
            slot: "WEAPON_HAND_RIGHT",
            required: true,
            sortOrder: 0,
          },
          {
            id: `${definitionId}:slot-left`,
            groupKey: "pact-blade-hands",
            selectionMode: "ALL_REQUIRED",
            slot: "WEAPON_HAND_LEFT",
            required: true,
            sortOrder: 1,
          },
        ]
      : [
          {
            id: `${definitionId}:slot-right`,
            groupKey: "pact-blade-hand",
            selectionMode: "ALL_REQUIRED",
            slot: "WEAPON_HAND_RIGHT",
            required: true,
            sortOrder: 0,
          },
        ];

  return {
    id: definitionId,
    slug: `pact-blade-${template.id}`,
    name: template.name,
    category: "WEAPON",
    subcategory: "PACT_BLADE",
    weaponHandling: template.weaponHandling,
    gloveWearMode: null,
    armorCategory: null,
    armorClassCalculation: null,
    armorClassBase: null,
    armorClassBonus: null,
    rarity: null,
    description: [
      "Arma evocata tramite Patto della Lama.",
      template.properties?.length ? `Proprieta: ${template.properties.join(", ")}.` : "",
    ].filter(Boolean).join(" "),
    playerVisible: true,
    stackable: false,
    equippable: true,
    attunement: false,
    weight: null,
    valueCp: null,
    data: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    slotRules,
    attacks: [
      {
        id: `${definitionId}:attack`,
        name: template.name,
        kind: "MELEE_WEAPON",
        handRequirement: template.weaponHandling === "TWO_HANDED" ? "TWO_HANDED" : "ONE_HANDED",
        ability: "STRENGTH",
        attackBonus: 0,
        damageDice: template.damageDice,
        damageType: template.damageType,
        rangeNormal: template.rangeNormal ?? null,
        rangeLong: template.rangeLong ?? null,
        twoHandedOnly: template.weaponHandling === "TWO_HANDED",
        requiresEquipped: true,
        conditionText: template.properties?.length ? `Proprieta: ${template.properties.join(", ")}` : null,
        sortOrder: 0,
      },
    ],
    modifiers: [],
    features: [],
    abilityRequirements: [],
    useEffects: [],
  };
}

export function buildPactBladeVirtualItem(
  characterId: string,
  characterSlug: string,
  characterName: string,
  template: PactBladeWeaponTemplate
): CharacterInventoryItemEntry {
  const now = new Date(0).toISOString();
  const equippedSlots =
    template.weaponHandling === "TWO_HANDED"
      ? ["WEAPON_HAND_RIGHT", "WEAPON_HAND_LEFT"]
      : ["WEAPON_HAND_RIGHT"];

  return {
    id: getPactBladeTemplateItemId(template.id),
    characterId,
    characterSlug,
    characterName,
    itemDefinitionId: getPactBladeTemplateDefinitionId(template.id),
    itemName: template.name,
    itemCategory: "WEAPON",
    description: "Arma evocata dal Patto della Lama.",
    detailSummary: template.properties?.join(", ") ?? null,
    equippable: false,
    stackable: false,
    quantity: 1,
    isEquipped: true,
    equippedSlots,
    nameOverride: null,
    descriptionOverride: null,
    notes: "Arma evocata dal Patto della Lama.",
    featureStates: [],
    createdAt: now,
    updatedAt: now,
  };
}
