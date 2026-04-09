import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Check, GripVertical, LayoutTemplate, RotateCcw } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import {
  joinCharacterRoom,
  fetchCharacter,
  fetchCharacters,
  onCharacterState,
  onCharacterPatch,
  onInitiativeTurnStart,
  updateCharacter,
  applyPatch,
  announceEnter,
  announceLeave,
} from "@/realtime";
import {
  coerce,
  setAtPathImmutable,
  buildPatch,
  abilityModifier,
  proficiencyBonus,
  calculateSkillValues,
} from "@/utils";
import {
  assignItemToCharacterRequest,
  fetchItemDefinition,
  fetchSkills,
  fetchSpellSlots,
  fetchSpells,
  fetchItemDefinitions,
  fetchCharacterInventoryItems,
  fetchCharacterSheetLayout,
  saveCharacterSheetLayout,
  transferCharacterInventoryItemRequest,
  updateCharacterInventoryItemRequest,
  type CharacterSheetLayoutEntry,
  type CharacterInventoryItemEntry,
  type ItemDefinitionEntry,
  type ItemDefinitionSummary,
  type SkillEntry as SkillCatalogEntry,
  type SpellEntry as SpellFromApi,
  type SpellSlotTable,
  type SpellsByClass as SpellsByClassFromApi,
} from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

import CharacterHeader from "@/components/characterSheet/character-header";
import AbilityScores from "@/components/characterSheet/ability-scores";
import Proficiencies from "@/components/characterSheet/proficiencies";
import CombatStats from "@/components/characterSheet/combat-stats";
import HitPoints from "@/components/characterSheet/hit-points";
import Capabilities from "@/components/characterSheet/capabilities";
import AttacksAndSpells from "@/components/characterSheet/attacks-and-spells";
import Features from "@/components/characterSheet/features";
import Inventory from "@/components/characterSheet/inventory";
import Languages from "@/components/characterSheet/languages";
import FloatingCharacterChat from "@/components/chat/floating-character-chat";
import { SheetCardStateProvider } from "@/components/characterSheet/sheet-card-state";

type InputEl = HTMLInputElement | HTMLTextAreaElement;
type Coins = { cp: number; sp: number; ep: number; gp: number; pp: number };

/** === Nuovi tipi per skills categorizzate === */
type SkillType = "volonta" | "incontro" | "riposoBreve" | "riposoLungo";
type SkillEntry = { name: string; used: boolean };
type SkillsByType = {
  volonta: SkillEntry[];
  incontro: SkillEntry[];
  riposoBreve: SkillEntry[];
  riposoLungo: SkillEntry[];
};

/** === Tipi nuovi per items strutturati === */
type StructuredObjectItem = {
  type: "object";
  name: string;
  description?: string;
  equippable?: boolean;
  equipped?: boolean;
  skillsByType?: Partial<SkillsByType>;
};
type StructuredConsumableItem = {
  type: "consumable";
  name: string;
  quantity: number;
  subtype?: "generic" | "potion";
  dice?: string; // per pozioni (es. "2d4+2")
  skillsByType?: Partial<SkillsByType>;
};
type StructuredItem = StructuredObjectItem | StructuredConsumableItem;
type InventoryEditTarget =
  | { kind: "weapon"; index: number }
  | { kind: "object"; index: number }
  | { kind: "consumable"; index: number }
  | { kind: "legacyObject"; index: number };
type CapabilityKind = "passive" | "active";
type CapabilityReset = "atWill" | "encounter" | "shortRest" | "longRest" | "custom";
type PassiveEffectTarget =
  | "ARMOR_CLASS"
  | "INITIATIVE"
  | "SPEED"
  | "HIT_POINT_MAX"
  | "STRENGTH_SCORE"
  | "DEXTERITY_SCORE"
  | "CONSTITUTION_SCORE"
  | "INTELLIGENCE_SCORE"
  | "WISDOM_SCORE"
  | "CHARISMA_SCORE"
  | "ATTACK_ROLL"
  | "DAMAGE_ROLL"
  | "MELEE_ATTACK_ROLL"
  | "MELEE_DAMAGE_ROLL"
  | "RANGED_ATTACK_ROLL"
  | "RANGED_DAMAGE_ROLL"
  | "OFF_HAND_DAMAGE_ROLL"
  | "CUSTOM";
type PassiveEffectTrigger =
  | "ALWAYS"
  | "WHILE_ARMORED"
  | "WHILE_SHIELD_EQUIPPED"
  | "WHILE_WIELDING_SINGLE_MELEE_WEAPON"
  | "WHILE_DUAL_WIELDING"
  | "WHILE_WIELDING_TWO_HANDED_WEAPON"
  | "CUSTOM";
type PassiveEffectValueMode =
  | "FLAT"
  | "ABILITY_MODIFIER"
  | "ABILITY_SCORE"
  | "PROFICIENCY_BONUS"
  | "CHARACTER_LEVEL";
type PassiveEffectRounding = "FLOOR" | "CEIL";
type PassiveEffectSourceAbility =
  | "STRENGTH"
  | "DEXTERITY"
  | "CONSTITUTION"
  | "INTELLIGENCE"
  | "WISDOM"
  | "CHARISMA";
type PassiveEffectEntry = {
  target: PassiveEffectTarget;
  valueMode?: PassiveEffectValueMode;
  value: number;
  sourceAbility?: PassiveEffectSourceAbility;
  multiplierNumerator?: number;
  multiplierDenominator?: number;
  rounding?: PassiveEffectRounding;
  trigger: PassiveEffectTrigger;
  customTargetLabel?: string;
  customTriggerLabel?: string;
  notes?: string;
};
type CapabilityEntry = {
  name: string;
  category?: string;
  kind: CapabilityKind;
  shortDescription: string;
  description?: string;
  passiveEffects?: PassiveEffectEntry[];
  sourceType?: "character" | "item";
  sourceLabel?: string;
  sourceItemId?: string;
  sourceFeatureId?: string;
  readOnly?: boolean;
  usage?: {
    resetOn: CapabilityReset;
    customLabel?: string;
    used: boolean[];
  };
};
type TransferTarget = {
  slug: string;
  name: string;
};

interface Character {
  slug: string;
  basicInfo: {
    characterName: string;
    class: string;
    level: number;
    background: string;
    playerName: string;
    race: string;
    alignment: string;
    experiencePoints: number;
    portraitUrl?: string;
  };
  abilityScores: {
    [key: string]: number;
  };
  combatStats: {
    armorClass: number;
    initiative: number;
    speed: number;
    hitPointMaximum: number;
    currentHitPoints: number;
    temporaryHitPoints: number;
    hitDice: string;
    // opzionale: struttura slot, usata anche per manovre
    spellSlots?: Record<number, Array<{ active: boolean }>>;
  };
  proficiencies: {
    proficiencyBonus: number;
    savingThrows: string[];
    skills: Array<{ name: string; ability: string; value: number }>;
    languages: string[];
  };
  equipment: {
    attacks: Array<{
      name: string;
      attackBonus: number;
      /** nuovo */
      damageDice?: string; // es. "1d8+3"
      damageType?: "tagliente" | "perforante" | "contundente"; // nuovo significato (solo tipo)
      category?: "melee" | "ranged";
      hands?: "1" | "2" | "versatile";
      range?: string;
      /** legacy: manteniamo compatibilità */
      equipped?: boolean;
      skill?: string;
      skills?: string[];
      skillsByType?: Partial<SkillsByType>;
      /** legacy totale: alcuni vecchi record hanno damageType="1d8+3 tagliente" */
    }>;
    equipment: string[]; // legacy lista piatta (non aggiorniamo più)
    items?: StructuredItem[]; // nuovo inventario strutturato
    coins?: Partial<Coins>;
  };
  features: Array<{ name: string; description: string; uses?: string }>;
  capabilities?: CapabilityEntry[];
}

type Spell = SpellFromApi;
type SpellsByClass = SpellsByClassFromApi;

const COIN_KEYS = {
  mr: "cp",
  ma: "sp",
  me: "ep",
  mo: "gp",
  mp: "pp",
} as const;
type CoinAbbr = keyof typeof COIN_KEYS;

const COIN_VALUES_CP: Record<keyof Coins, number> = {
  cp: 1,
  sp: 10,
  ep: 50,
  gp: 100,
  pp: 1000,
};

const COIN_ORDER: Array<keyof Coins> = ["cp", "sp", "ep", "gp", "pp"];
const COIN_EXCHANGE_UP: Partial<Record<keyof Coins, number>> = {
  cp: 10, // 10 cp = 1 sp
  sp: 5,  // 5 sp = 1 ep
  ep: 2,  // 2 ep = 1 gp
  gp: 10, // 10 gp = 1 pp
};

function coinsToCopper(coins: Partial<Coins> | undefined): number {
  if (!coins) return 0;

  return (
    (coins.cp ?? 0) * COIN_VALUES_CP.cp +
    (coins.sp ?? 0) * COIN_VALUES_CP.sp +
    (coins.ep ?? 0) * COIN_VALUES_CP.ep +
    (coins.gp ?? 0) * COIN_VALUES_CP.gp +
    (coins.pp ?? 0) * COIN_VALUES_CP.pp
  );
}

function normalizeCoinsShape(coins: Partial<Coins> | undefined): Coins {
  return {
    cp: coins?.cp ?? 0,
    sp: coins?.sp ?? 0,
    ep: coins?.ep ?? 0,
    gp: coins?.gp ?? 0,
    pp: coins?.pp ?? 0,
  };
}

function makeChangeStep(coins: Coins, fromKey: keyof Coins): boolean {
  const fromIndex = COIN_ORDER.indexOf(fromKey);
  if (fromIndex <= 0 || coins[fromKey] <= 0) return false;

  const lowerKey = COIN_ORDER[fromIndex - 1];
  const factor = COIN_EXCHANGE_UP[lowerKey];
  if (!factor) return false;

  coins[fromKey] -= 1;
  coins[lowerKey] += factor;
  return true;
}

function removeCoinsWithChange(baseCoins: Partial<Coins> | undefined, coinKey: keyof Coins, qty: number): Coins | null {
  const nextCoins = normalizeCoinsShape(baseCoins);

  for (let i = 0; i < qty; i++) {
    if (nextCoins[coinKey] > 0) {
      nextCoins[coinKey] -= 1;
      continue;
    }

    let borrowed = false;
    for (let higherIndex = COIN_ORDER.indexOf(coinKey) + 1; higherIndex < COIN_ORDER.length; higherIndex++) {
      const higherKey = COIN_ORDER[higherIndex];
      if (nextCoins[higherKey] <= 0) continue;

      for (let step = higherIndex; step > COIN_ORDER.indexOf(coinKey); step--) {
        const currentKey = COIN_ORDER[step];
        if (!makeChangeStep(nextCoins, currentKey)) {
          return null;
        }
      }

      borrowed = true;
      break;
    }

    if (!borrowed || nextCoins[coinKey] <= 0) {
      return null;
    }

    nextCoins[coinKey] -= 1;
  }

  return nextCoins;
}

function compactCoinsAtTier(baseCoins: Partial<Coins> | undefined, coinKey: keyof Coins): Coins {
  const nextCoins = normalizeCoinsShape(baseCoins);
  const coinIndex = COIN_ORDER.indexOf(coinKey);

  if (coinIndex < 0 || coinIndex >= COIN_ORDER.length - 1) {
    return nextCoins;
  }

  const nextKey = COIN_ORDER[coinIndex + 1];
  const factor = COIN_EXCHANGE_UP[coinKey];

  if (!factor) return nextCoins;

  const promoted = Math.floor(nextCoins[coinKey] / factor);
  if (promoted <= 0) return nextCoins;

  nextCoins[coinKey] = nextCoins[coinKey] % factor;
  nextCoins[nextKey] += promoted;

  return nextCoins;
}

const SKILL_TYPES: SkillType[] = ["volonta", "incontro", "riposoBreve", "riposoLungo"];

type CharacterSheetCardId =
  | "abilityScores"
  | "proficiencies"
  | "languages"
  | "combatStats"
  | "hitPoints"
  | "capabilities"
  | "attacksAndEquipment"
  | "features"
  | "inventory";

type CharacterSheetLayoutCardEntry = {
  cardId: CharacterSheetCardId;
  column: 0 | 1 | 2;
  order: number;
};

const DEFAULT_CHARACTER_SHEET_LAYOUT: CharacterSheetLayoutCardEntry[] = [
  { cardId: "abilityScores", column: 0, order: 0 },
  { cardId: "proficiencies", column: 0, order: 1 },
  { cardId: "languages", column: 0, order: 2 },
  { cardId: "combatStats", column: 1, order: 0 },
  { cardId: "hitPoints", column: 1, order: 1 },
  { cardId: "capabilities", column: 1, order: 2 },
  { cardId: "attacksAndEquipment", column: 1, order: 3 },
  { cardId: "features", column: 2, order: 0 },
  { cardId: "inventory", column: 2, order: 1 },
];

function normalizeCharacterSheetLayout(
  entries: CharacterSheetLayoutEntry[] | CharacterSheetLayoutCardEntry[] | undefined | null
): CharacterSheetLayoutCardEntry[] {
  const fallbackMap = new Map(
    DEFAULT_CHARACTER_SHEET_LAYOUT.map((entry) => [entry.cardId, entry])
  );

  const filtered = Array.isArray(entries)
    ? entries
        .map((entry) => ({
          cardId: entry.cardId as CharacterSheetCardId,
          column: entry.column as 0 | 1 | 2,
          order: entry.order,
        }))
        .filter(
          (entry) =>
            fallbackMap.has(entry.cardId) &&
            Number.isInteger(entry.column) &&
            entry.column >= 0 &&
            entry.column <= 2 &&
            Number.isInteger(entry.order) &&
            entry.order >= 0
        )
    : [];

  const uniqueEntries = Array.from(
    new Map(filtered.map((entry) => [entry.cardId, entry])).values()
  );

  const completed = [...uniqueEntries];
  for (const fallbackEntry of DEFAULT_CHARACTER_SHEET_LAYOUT) {
    if (!completed.some((entry) => entry.cardId === fallbackEntry.cardId)) {
      completed.push(fallbackEntry);
    }
  }

  const byColumn = [0, 1, 2].map((column) =>
    completed
      .filter((entry) => entry.column === column)
      .sort((a, b) => a.order - b.order)
      .map((entry, index) => ({ ...entry, order: index }))
  );

  return byColumn.flat();
}

function moveCharacterSheetCard(
  layout: CharacterSheetLayoutCardEntry[],
  cardId: CharacterSheetCardId,
  direction: "up" | "down" | "left" | "right"
): CharacterSheetLayoutCardEntry[] {
  const columns = [0, 1, 2].map((column) =>
    layout
      .filter((entry) => entry.column === column)
      .sort((a, b) => a.order - b.order)
      .map((entry) => ({ ...entry }))
  );

  const sourceColumnIndex = columns.findIndex((columnEntries) =>
    columnEntries.some((entry) => entry.cardId === cardId)
  );
  if (sourceColumnIndex < 0) return layout;

  const sourceEntries = columns[sourceColumnIndex];
  const sourceIndex = sourceEntries.findIndex((entry) => entry.cardId === cardId);
  if (sourceIndex < 0) return layout;

  const [entry] = sourceEntries.splice(sourceIndex, 1);

  const rebuildLayoutFromColumns = () =>
    normalizeCharacterSheetLayout(
      columns.flatMap((columnEntries, columnIndex) =>
        columnEntries.map((columnEntry, orderIndex) => ({
          ...columnEntry,
          column: columnIndex as 0 | 1 | 2,
          order: orderIndex,
        }))
      )
    );

  if (direction === "up" || direction === "down") {
    const nextIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (nextIndex < 0 || nextIndex > sourceEntries.length) {
      sourceEntries.splice(sourceIndex, 0, entry);
      return rebuildLayoutFromColumns();
    }
    sourceEntries.splice(nextIndex, 0, entry);
    return rebuildLayoutFromColumns();
  }

  const targetColumnIndex = direction === "left" ? sourceColumnIndex - 1 : sourceColumnIndex + 1;
  if (targetColumnIndex < 0 || targetColumnIndex > 2) {
    sourceEntries.splice(sourceIndex, 0, entry);
    return rebuildLayoutFromColumns();
  }

  const targetEntries = columns[targetColumnIndex];
  const insertIndex = Math.min(sourceIndex, targetEntries.length);
  targetEntries.splice(insertIndex, 0, { ...entry, column: targetColumnIndex as 0 | 1 | 2 });

  return rebuildLayoutFromColumns();
}

function buildCharacterSheetLayoutColumns(layout: CharacterSheetLayoutCardEntry[]) {
  return [0, 1, 2].map((column) =>
    layout
      .filter((entry) => entry.column === column)
      .sort((a, b) => a.order - b.order)
  );
}

function moveCharacterSheetCardToPosition(
  layout: CharacterSheetLayoutCardEntry[],
  cardId: CharacterSheetCardId,
  targetColumn: 0 | 1 | 2,
  targetIndex: number
) {
  const columns = buildCharacterSheetLayoutColumns(layout).map((columnEntries) =>
    columnEntries.map((entry) => ({ ...entry }))
  );

  const sourceColumnIndex = columns.findIndex((columnEntries) =>
    columnEntries.some((entry) => entry.cardId === cardId)
  );
  if (sourceColumnIndex < 0) return layout;

  const sourceEntries = columns[sourceColumnIndex];
  const sourceIndex = sourceEntries.findIndex((entry) => entry.cardId === cardId);
  if (sourceIndex < 0) return layout;

  const [entry] = sourceEntries.splice(sourceIndex, 1);
  const destinationEntries = columns[targetColumn];

  const normalizedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, destinationEntries.length)
  );

  destinationEntries.splice(normalizedTargetIndex, 0, {
    ...entry,
    column: targetColumn,
  });

  return normalizeCharacterSheetLayout(
    columns.flatMap((columnEntries, columnIndex) =>
      columnEntries.map((columnEntry, orderIndex) => ({
        ...columnEntry,
        column: columnIndex as 0 | 1 | 2,
        order: orderIndex,
      }))
    )
  );
}

function LayoutColumnDropZone({
  columnId,
  children,
}: {
  columnId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: {
      type: "column",
      columnId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-6 rounded-xl transition ${
        isOver ? "border-primary/70 bg-primary/5" : "border-border/60"
      }`}
    >
      {children}
    </div>
  );
}

function SortableLayoutCard({
  cardId,
  layoutEditMode,
  children,
}: {
  cardId: CharacterSheetCardId;
  layoutEditMode: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cardId,
    data: {
      type: "card",
      cardId,
    },
    disabled: !layoutEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative transition ${
        layoutEditMode ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      {...(layoutEditMode ? attributes : {})}
      {...(layoutEditMode ? listeners : {})}
    >
      <div
        className={`transition ${layoutEditMode ? "pointer-events-none select-none" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

const CharacterSheet = () => {
  const { character } = useParams();
  const [characterData, setCharacterData] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [turnAlertActive, setTurnAlertActive] = useState(false);

  // death saves state (local only)
  const [deathSaves, setDeathSaves] = useState<{ success: boolean[]; fail: boolean[] }>({
    success: [false, false, false],
    fail: [false, false, false],
  });

  // ======= INVENTORY state (modal) =======
  const [invOpen, setInvOpen] = useState(false);
  const [mode, setMode] = useState<"coins" | "item">("coins");
  const [coinType, setCoinType] = useState<CoinAbbr>("mo");
  const [coinQty, setCoinQty] = useState<string>("");
  const [coinFlow, setCoinFlow] = useState<"add" | "remove">("add");
  const [compactCoinsOnAdd, setCompactCoinsOnAdd] = useState(false);

  // campi comuni item/weapon legacy
  const [itemName, setItemName] = useState("");
  const [itemAtkBonus, setItemAtkBonus] = useState<string>("");
  const [itemDmgType, setItemDmgType] = useState<string>("");
  const [invError, setInvError] = useState<string>("");

  /** legacy singola skill (manteniamo fino all’update di Inventory) */
  const [itemSkill, setItemSkill] = useState<string>("");

  /** === NUOVO: gestione per categoria nel form === */
  const [itemSkillType, setItemSkillType] = useState<SkillType>("volonta");
  const [itemSkillInput, setItemSkillInput] = useState<string>("");
  const [itemSkillsByType, setItemSkillsByType] = useState<SkillsByType>({
    volonta: [],
    incontro: [],
    riposoBreve: [],
    riposoLungo: [],
  });

  // campi per oggetto/consumabile nella modale
  const [itemDescription, setItemDescription] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<string>("");
  const [itemConsumableSubtype, setItemConsumableSubtype] = useState<"generic" | "potion">("generic");
  const [itemKind, setItemKind] = useState<"weapon" | "object" | "consumable">("weapon");
  const [potionDice, setPotionDice] = useState<string>("");
  const [itemEquippable, setItemEquippable] = useState<boolean>(false);

  // ======= ADD SPELL dialog (CTA) =======
  const [addSpellOpen, setAddSpellOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>(characterData?.basicInfo.class?.toLowerCase?.() ?? "");
  const [spellQuery, setSpellQuery] = useState("");

  // ======= SPELL DETAILS modal (click su riga) =======
  const [spellModalOpen, setSpellModalOpen] = useState(false);
  const [modalSpell, setModalSpell] = useState<Spell | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalDescription, setModalDescription] = useState<string>("");
  const [modalFeatureIndex, setModalFeatureIndex] = useState<number | null>(null);
  const [confirmRemoveFeatureOpen, setConfirmRemoveFeatureOpen] = useState(false);
  const [spells, setSpells] = useState<SpellsByClass>({});
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogEntry[]>([]);
  const [spellSlotTable, setSpellSlotTable] = useState<SpellSlotTable>({});
  const [relationalInventoryItems, setRelationalInventoryItems] = useState<CharacterInventoryItemEntry[]>([]);
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinitionSummary[]>([]);
  const [itemDefinitionDetailsById, setItemDefinitionDetailsById] = useState<Record<string, ItemDefinitionEntry>>({});
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [characterSheetLayout, setCharacterSheetLayout] = useState<CharacterSheetLayoutCardEntry[]>(
    DEFAULT_CHARACTER_SHEET_LAYOUT
  );
  const [draggedCardId, setDraggedCardId] = useState<CharacterSheetCardId | null>(null);
  const [dragStartLayout, setDragStartLayout] = useState<CharacterSheetLayoutCardEntry[] | null>(null);
  const [collapsedLayoutCards, setCollapsedLayoutCards] = useState<Record<string, boolean>>({});
  const [preEditCollapsedCards, setPreEditCollapsedCards] = useState<Record<string, boolean> | null>(null);

  const refreshRelationalInventory = useCallback(async (slug: string) => {
    const items = await fetchCharacterInventoryItems(slug);
    const normalized = Array.isArray(items) ? items : [];
    setRelationalInventoryItems(normalized);
    return normalized;
  }, []);

  useEffect(() => {
    const nextClass = characterData?.basicInfo?.class?.toLowerCase?.() ?? "";
    setSelectedClass((current) => current || nextClass);
  }, [characterData?.basicInfo?.class]);

  useEffect(() => {
    let active = true;

    void fetchCharacterSheetLayout()
      .then((payload) => {
        if (!active) return;
        setCharacterSheetLayout(normalizeCharacterSheetLayout(payload?.entries));
      })
      .catch(() => {
        if (!active) return;
        setCharacterSheetLayout(DEFAULT_CHARACTER_SHEET_LAYOUT);
      });

    return () => {
      active = false;
    };
  }, []);

  const classOptions = useMemo(() => Object.keys(spells).sort(), [spells]);
  const filteredSpells = useMemo(() => {
    if (!selectedClass) return [];
    const list = spells[selectedClass] ?? [];
    const q = spellQuery.trim().toLowerCase();
    return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
  }, [selectedClass, spellQuery, spells]);

  const formatSpellBlock = (s: Spell) => {
    const tags: string[] = [];
    if (s.concentration) tags.push("Concentrazione");
    if (s.ritual) tags.push("Rituale");
    return [
      `Livello ${s.level} · ${s.school}${tags.length ? ` · ${tags.join(" · ")}` : ""}`,
      `Tempo di lancio: ${s.casting_time}`,
      `Gittata: ${s.range}`,
      `Componenti: ${s.components || "-"}`,
      `Durata: ${s.duration}`,
      "",
      s.description?.trim() || "",
      s.usage ? `\nUso: ${s.usage}` : "",
    ].join("\n");
  };

  const handleAddSpellToFeatures = (spell: Spell) => {
    if (!characterData) return;
    const next = [
      ...characterData.features,
      {
        name: `${spell.name} (${selectedClass}, Lv ${spell.level})`,
        description: formatSpellBlock(spell),
      },
    ];
    setCharacterData((prev) => (prev ? { ...prev, features: next } : prev));
    if (character) updateCharacter(character, { features: next });
    setSpellQuery("");
    setAddSpellOpen(false);
  };

  const stripName = (full: string) => {
    const i = full.indexOf(" (");
    return i > -1 ? full.slice(0, i) : full;
  };
  const parseClassFromFeatureTitle = (full: string): string | null => {
    const m = full.match(/\(([^,]+),\s*Lv\s*\d+\)/i);
    if (!m) return null;
    return m[1].trim().toLowerCase();
  };
  const parseLevelFromFeatureTitle = (full: string): number | null => {
    const m = full.match(/Lv\s*(\d+)/i);
    return m ? Number(m[1]) : null;
  };
  const findSpell = (name: string, maybeClass?: string | null, maybeLevel?: number | null): Spell | null => {
    const lcName = name.toLowerCase();
    if (maybeClass && spells[maybeClass]) {
      const byClass = spells[maybeClass];
      const precise = byClass.find((s) => s.name.toLowerCase() === lcName && (maybeLevel ? s.level === maybeLevel : true));
      if (precise) return precise;
      const loose = byClass.find((s) => s.name.toLowerCase() === lcName);
      if (loose) return loose;
    }
    for (const cls of Object.keys(spells)) {
      const list = spells[cls];
      const precise = list.find((s) => s.name.toLowerCase() === lcName && (maybeLevel ? s.level === maybeLevel : true));
      if (precise) return precise;
    }
    for (const cls of Object.keys(spells)) {
      const list = spells[cls];
      const loose = list.find((s) => s.name.toLowerCase() === lcName);
      if (loose) return loose;
    }
    return null;
  };

  const openFeatureModal = (feature: { name: string; description: string }, index?: number) => {
    const baseName = stripName(feature.name);
    const cls = parseClassFromFeatureTitle(feature.name);
    const lvl = parseLevelFromFeatureTitle(feature.name);
    const found = findSpell(baseName, cls, lvl);
    setModalFeatureIndex(typeof index === "number" ? index : null);

    if (found) {
      setModalSpell(found);
      setModalTitle(`${found.name} ${cls ? `(${cls}, Lv ${found.level})` : `(Lv ${found.level})`}`);
      setModalDescription("");
    } else {
      setModalSpell(null);
      setModalTitle(feature.name);
      setModalDescription(feature.description);
    }
    setSpellModalOpen(true);
  };

  const removeFeature = (index: number) => {
    if (!characterData) return;
    const nextFeatures = characterData.features.filter((_, i) => i !== index);
    setCharacterData((prev) => (prev ? { ...prev, features: nextFeatures } : prev));
    if (character) updateCharacter(character, { features: nextFeatures });
  };

  const addCapability = (entry: CapabilityEntry) => {
    if (!characterData) return;
    const nextCapabilities = [...(characterData.capabilities ?? []), entry];
    setCharacterData((prev) => (prev ? { ...prev, capabilities: nextCapabilities } : prev));
    if (character) updateCharacter(character, { capabilities: nextCapabilities });
  };

  const updateCapability = (capabilityIndex: number, entry: CapabilityEntry) => {
    if (!characterData) return;
    const nextCapabilities = (characterData.capabilities ?? []).map((capability, index) =>
      index === capabilityIndex ? entry : capability
    );
    setCharacterData((prev) => (prev ? { ...prev, capabilities: nextCapabilities } : prev));
    if (character) updateCharacter(character, { capabilities: nextCapabilities });
  };

  const removeCapability = (capabilityIndex: number) => {
    if (!characterData) return;
    const nextCapabilities = (characterData.capabilities ?? []).filter((_, index) => index !== capabilityIndex);
    setCharacterData((prev) => (prev ? { ...prev, capabilities: nextCapabilities } : prev));
    if (character) updateCharacter(character, { capabilities: nextCapabilities });
  };

  const toggleCapabilityUse = (capabilityIndex: number, useIndex: number) => {
    if (!characterData) return;
    const currentCapabilities = characterData.capabilities ?? [];
    const capability = currentCapabilities[capabilityIndex];
    if (!capability?.usage?.used?.[useIndex] && capability?.usage?.used?.[useIndex] !== false) return;

    const nextCapabilities = currentCapabilities.map((entry, index) => {
      if (index !== capabilityIndex || !entry.usage) return entry;
      const nextUsed = entry.usage.used.map((used, idx) => (idx === useIndex ? !used : used));
      return {
        ...entry,
        usage: {
          ...entry.usage,
          used: nextUsed,
        },
      };
    });

    setCharacterData((prev) => (prev ? { ...prev, capabilities: nextCapabilities } : prev));
    if (character) updateCharacter(character, { capabilities: nextCapabilities });
  };

  const toggleDerivedCapabilityUse = async (
    characterItemId: string,
    itemFeatureId: string,
    useIndex: number,
    currentUsed: boolean
  ) => {
    if (!character) return;
    const item = relationalInventoryItems.find((entry) => entry.id === characterItemId);
    if (!item) return;

    const currentState = item.featureStates?.find((entry) => entry.itemFeatureId === itemFeatureId);
    const currentUsesSpent = currentState?.usesSpent ?? 0;
    const nextUsesSpent = Math.max(0, currentUsesSpent + (currentUsed ? -1 : 1));

    try {
      const updated = await updateCharacterInventoryItemRequest(character, characterItemId, {
        featureState: {
          itemFeatureId,
          usesSpent: nextUsesSpent,
        },
      });
      setRelationalInventoryItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch {
      // silent fail for now to keep the legacy UX consistent
    }
  };

  const confirmRemoveFeature = () => {
    if (modalFeatureIndex === null) return;
    removeFeature(modalFeatureIndex);
    setConfirmRemoveFeatureOpen(false);
    setSpellModalOpen(false);
    setModalFeatureIndex(null);
  };

  const coins: Coins = useMemo(() => {
    const c = characterData?.equipment.coins ?? {};
    return {
      cp: c?.cp ?? 0,
      sp: c?.sp ?? 0,
      ep: c?.ep ?? 0,
      gp: c?.gp ?? 0,
      pp: c?.pp ?? 0,
    };
  }, [characterData?.equipment.coins]);

  const resetInvForm = () => {
    setMode("coins");
    setCoinType("mo");
    setCoinQty("");
    setCompactCoinsOnAdd(false);
    setItemName("");
    setItemAtkBonus("");
    setItemDmgType("");
    setItemSkill(""); // legacy
    // nuovi stati categorizzati
    setItemSkillType("volonta");
    setItemSkillInput("");
    setItemSkillsByType({ volonta: [], incontro: [], riposoBreve: [], riposoLungo: [] });
    // oggetti/consumabili
    setItemDescription("");
    setItemQuantity("");
    setItemConsumableSubtype("generic");
    setItemKind("weapon");
    setPotionDice("");
    setItemEquippable(false);
    setInvError("");
    setCoinFlow("add");
  };

  const makeChangeHandler = useCallback(
    (path: string, kind: "string" | "int" | "float" = "string") =>
      (e: React.ChangeEvent<InputEl>) => {
        const v = coerce(e.target.value, kind);
        setCharacterData((prev) => (prev ? setAtPathImmutable(prev, path, v) : prev));
        if (character) {
          updateCharacter(character, buildPatch(path, v));
        }
      },
    [character]
  );

  const toggleEquipAttack = (index: number) => {
    if (!characterData) return;
    const nextAttacks = characterData.equipment.attacks.map((a, i) =>
      i === index ? { ...a, equipped: !a.equipped } : a
    );
    const patch = { equipment: { attacks: nextAttacks } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, attacks: nextAttacks } } : prev));
    if (character) updateCharacter(character, patch);
  };

  /** === NUOVO: toggle per oggetti equipaggiabili === */
  const toggleEquipItem = (index: number) => {
    if (!characterData) return;
    const items = characterData.equipment.items ?? [];
    const nextItems = items.map((it, i) =>
      i === index && it?.type === "object" && (it as StructuredObjectItem).equippable
        ? { ...it, equipped: !(it as StructuredObjectItem).equipped }
        : it
    );
    const patch = { equipment: { items: nextItems } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, items: nextItems } } : prev));
    if (character) updateCharacter(character, patch);
  };

  /** === NUOVO: consumabili +/- quantità === */
  const bumpConsumableQuantity = (index: number, delta: number) => {
    if (!characterData) return;
    const items = characterData.equipment.items ?? [];
    const it = items[index];
    if (!it || it.type !== "consumable") return;
    const q = Math.max(0, (it.quantity ?? 0) + delta);
    const nextItems = items.map((x, i) => (i === index ? { ...x, quantity: q } : x));
    const patch = { equipment: { items: nextItems } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, items: nextItems } } : prev));
    if (character) updateCharacter(character, patch);
  };

  /** === NUOVO: rimozione item strutturato (object/consumable) === */
  const removeStructuredItem = (index: number) => {
    if (!characterData) return;
    const items = characterData.equipment.items ?? [];
    const nextItems = items.filter((_, i) => i !== index);
    const patch = { equipment: { items: nextItems } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, items: nextItems } } : prev));
    if (character) updateCharacter(character, patch);
  };

  const toggleEquipRelationalItem = async (
    characterItemId: string,
    payload?: {
      isEquipped?: boolean;
      equipConfig?: {
        optionId?: string;
        slots?: string[];
        swapItemIds?: string[];
      };
    }
  ) => {
    if (!character) return;
    const current = relationalInventoryItems.find((item) => item.id === characterItemId);
    if (!current || !current.equippable) return;

    try {
      await updateCharacterInventoryItemRequest(character, characterItemId, {
        isEquipped: payload?.isEquipped ?? !current.isEquipped,
        equipConfig: payload?.equipConfig,
      });
      const nextInventory = await refreshRelationalInventory(character);
      return nextInventory.find((item) => item.id === characterItemId) ?? null;
    } catch (error) {
      throw error;
    }
  };

  const decrementRelationalConsumable = async (characterItemId: string) => {
    if (!character) return;
    const current = relationalInventoryItems.find((item) => item.id === characterItemId);
    if (!current || current.quantity <= 0) return;

    try {
      const updated = await updateCharacterInventoryItemRequest(character, characterItemId, {
        quantity: Math.max(0, current.quantity - 1),
      });
      setRelationalInventoryItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      // keep legacy UX quiet for now; failed command simply won't update the row
    }
  };

  const incrementRelationalConsumable = async (characterItemId: string) => {
    if (!character) return;
    const current = relationalInventoryItems.find((item) => item.id === characterItemId);
    if (!current) return;

    try {
      const updated = await updateCharacterInventoryItemRequest(character, characterItemId, {
        quantity: Math.max(0, current.quantity + 1),
      });
      setRelationalInventoryItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      // keep legacy UX quiet for now; failed command simply won't update the row
    }
  };

  const assignRelationalInventoryItem = async (payload: {
    itemDefinitionId?: string;
    quantity?: number;
    notes?: string | null;
    quickCreateItem?: Record<string, unknown>;
  }) => {
    if (!character) throw new Error("Character slug mancante");
    const nextInventory = await assignItemToCharacterRequest(character, payload);
    setRelationalInventoryItems(Array.isArray(nextInventory) ? nextInventory : []);
  };

  const transferRelationalInventoryItem = async (
    characterItemId: string,
    payload: { toCharacterSlug: string; quantity?: number }
  ) => {
    if (!character) throw new Error("Character slug mancante");
    const nextInventory = await transferCharacterInventoryItemRequest(character, characterItemId, payload);
    setRelationalInventoryItems(Array.isArray(nextInventory) ? nextInventory : []);
  };

  /** === NUOVO: toggle checkbox “usata” per una skill categorizzata su ATTACCO === */
  const toggleAttackSkillUsed = (attackIndex: number, type: SkillType, skillIndex: number) => {
    if (!characterData) return;
    const prevAttack = characterData.equipment.attacks[attackIndex];
    const byType = prevAttack.skillsByType ?? {};
    const list = [...(byType[type] ?? [])];
    if (!list[skillIndex]) return;
    const updated = { ...list[skillIndex], used: !list[skillIndex].used };
    list[skillIndex] = updated;
    const nextSkillsByType = { ...byType, [type]: list };
    const nextAttack = { ...prevAttack, skillsByType: nextSkillsByType };
    const nextAttacks = characterData.equipment.attacks.map((a, i) => (i === attackIndex ? nextAttack : a));
    const patch = { equipment: { attacks: nextAttacks } };

    setCharacterData((p) => (p ? { ...p, equipment: { ...p.equipment, attacks: nextAttacks } } : p));
    if (character) updateCharacter(character, patch);
  };

  /** === NEW: toggle checkbox “usata” per una skill categorizzata su OGGETTO === */
  const toggleItemSkillUsed = (itemIndex: number, type: SkillType, skillIndex: number) => {
    if (!characterData) return;
    const items = characterData.equipment.items ?? [];
    const it = items[itemIndex];
    if (!it || it.type !== "object" || !it.skillsByType) return;

    const list = [...(it.skillsByType[type] ?? [])];
    if (!list[skillIndex]) return;
    list[skillIndex] = { ...list[skillIndex], used: !list[skillIndex].used };

    const nextItems = items.map((x, i) =>
      i === itemIndex ? { ...x, skillsByType: { ...(x.skillsByType ?? {}), [type]: list } } : x
    );
    const patch = { equipment: { items: nextItems } };
    setCharacterData((p) => (p ? { ...p, equipment: { ...p.equipment, items: nextItems } } : p));
    if (character) updateCharacter(character, patch);
  };

  const removeAttack = (index: number) => {
    if (!characterData) return;
    const nextAttacks = characterData.equipment.attacks.filter((_, i) => i !== index);
    const patch = { equipment: { attacks: nextAttacks } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, attacks: nextAttacks } } : prev));
    if (character) updateCharacter(character, patch);
  };

  /** === NUOVO: submit inventario parametrico === */
  const handleInventorySubmit = (payload?: {
    editTarget?: InventoryEditTarget;
    kind?: "weapon" | "object" | "consumable";
    // weapon
    weaponCategory?: "melee" | "ranged";
    weaponHands?: "1" | "2" | "versatile";
    weaponRange?: string;
    damageKind?: "tagliente" | "perforante" | "contundente";
    // object
    description?: string;
    equippable?: boolean;
    // consumable
    consumableSubtype?: "generic" | "potion";
    quantity?: number;
    potionDice?: string;
  }) => {
    if (!characterData) return;
    setInvError("");

    // === Monete
    if (mode === "coins") {
      const qty = parseInt(coinQty, 10);
      if (isNaN(qty) || qty <= 0) {
        setInvError("Inserisci una quantità positiva di monete.");
        return;
      }
      const stdKey = COIN_KEYS[coinType] as keyof Coins;
      const deltaCp = qty * COIN_VALUES_CP[stdKey];
      const currentTotalCp = coinsToCopper(coins);

      if (coinFlow === "remove" && currentTotalCp < deltaCp) {
        setInvError("Monete insufficienti per questa operazione.");
        return;
      }

      const nextCoins =
        coinFlow === "add"
          ? compactCoinsOnAdd
            ? compactCoinsAtTier({ ...coins, [stdKey]: coins[stdKey] + qty }, stdKey)
            : { ...coins, [stdKey]: coins[stdKey] + qty }
          : removeCoinsWithChange(coins, stdKey, qty);

      if (!nextCoins) {
        setInvError("Monete insufficienti per questa operazione.");
        return;
      }

      const nextEquip = { ...characterData.equipment, coins: nextCoins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: nextEquip } : prev));
      if (character) updateCharacter(character, { equipment: { coins: nextCoins } });
      setInvOpen(false);
      resetInvForm();
      return;
    }

    // === Validazioni di base
    if (!itemName.trim()) {
      setInvError("Il nome è obbligatorio.");
      return;
    }

    // calcolo skills categorizzate usate nella modale
    const hasAnyCategorized = SKILL_TYPES.some((t) => (itemSkillsByType[t]?.length ?? 0) > 0);
    const prunedSkillsByType = SKILL_TYPES.reduce((acc, t) => {
      const arr = itemSkillsByType[t] ?? [];
      if (arr.length) acc[t] = arr;
      return acc;
    }, {} as Partial<SkillsByType>);

    const prevEq = characterData.equipment;
    const itemsArray: StructuredItem[] = Array.isArray(prevEq.items) ? prevEq.items : [];
    const editTarget = payload?.editTarget;

    // === Weapon
    if ((payload?.kind ?? itemKind) === "weapon") {
      const attackFieldsFilled =
        itemAtkBonus.trim() !== "" && itemDmgType.trim() !== "" && payload?.damageKind && payload?.weaponCategory;
      if (!attackFieldsFilled) {
        setInvError("Compila Bonus attacco, Dado del danno, Tipo di danno e Categoria (mischia/distanza).");
        return;
      }

      const attack = {
        name: itemName.trim(),
        attackBonus: Number(itemAtkBonus),
        damageDice: itemDmgType.trim(),
        damageType: payload!.damageKind, // nuovo
        category: payload!.weaponCategory,
        hands: payload!.weaponCategory === "melee" ? payload?.weaponHands : undefined,
        range: payload!.weaponCategory === "ranged" ? payload?.weaponRange : undefined,
        equipped: editTarget?.kind === "weapon" ? !!prevEq.attacks[editTarget.index]?.equipped : false,
        ...(hasAnyCategorized ? { skillsByType: prunedSkillsByType } : {}),
        ...(!hasAnyCategorized && itemSkill.trim() ? { skill: itemSkill.trim() } : {}),
      };

      const nextAttacks =
        editTarget?.kind === "weapon"
          ? prevEq.attacks.map((existing, index) => (index === editTarget.index ? attack : existing))
          : [...prevEq.attacks, attack];
      const next = { ...prevEq, attacks: nextAttacks, items: itemsArray, coins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: next } : prev));
      if (character) updateCharacter(character, { equipment: next });
      setInvOpen(false);
      resetInvForm();
      return;
    }

    // === Object
    if ((payload?.kind ?? itemKind) === "object") {
      const newObj: StructuredObjectItem = {
        type: "object",
        name: itemName.trim(),
        description: payload?.description || undefined,
        equippable: !!payload?.equippable,
        equipped: editTarget?.kind === "object" ? !!(itemsArray[editTarget.index] as StructuredObjectItem | undefined)?.equipped : false,
        ...(hasAnyCategorized ? { skillsByType: prunedSkillsByType } : {}),
      };
      const nextItems =
        editTarget?.kind === "object"
          ? itemsArray.map((item, index) => (index === editTarget.index ? newObj : item))
          : [...itemsArray, newObj];
      const next = { ...prevEq, items: nextItems, coins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: next } : prev));
      if (character) updateCharacter(character, { equipment: next });
      setInvOpen(false);
      resetInvForm();
      return;
    }

    // === Consumable
    if ((payload?.kind ?? itemKind) === "consumable") {
      const qty = Number.isFinite(payload?.quantity) ? Math.max(0, Number(payload!.quantity)) : 0;
      const newCons: StructuredConsumableItem = {
        type: "consumable",
        name: itemName.trim(),
        quantity: qty,
        subtype: payload?.consumableSubtype ?? "generic",
        dice: payload?.potionDice || undefined,
        ...(hasAnyCategorized ? { skillsByType: prunedSkillsByType } : {}),
      };
      const nextItems =
        editTarget?.kind === "consumable"
          ? itemsArray.map((item, index) => (index === editTarget.index ? newCons : item))
          : [...itemsArray, newCons];
      const next = { ...prevEq, items: nextItems, coins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: next } : prev));
      if (character) updateCharacter(character, { equipment: next });
      setInvOpen(false);
      resetInvForm();
      return;
    }
  };

  useEffect(() => {
    const slug = character;
    if (!slug) return;
    let unsubState: any = null;
    let unsubPatch: any = null;
    let active = true;
    (async () => {
      try {
        const data = await fetchCharacter(slug);
        if (active) setCharacterData(data);
        if (active) setLoadError(null);
      } catch (error: any) {
        if (active) {
          setCharacterData(null);
          setLoadError(error?.status === 403 ? "Non hai accesso a questa scheda." : null);
        }
      } finally {
        if (active) setLoading(false);
      }
      joinCharacterRoom(slug);
      unsubState = onCharacterState((state) => setCharacterData(state));
      unsubPatch = onCharacterPatch((patch) =>
        setCharacterData((prev) => (prev ? applyPatch(prev, patch) : prev))
      );
    })();
    announceEnter(character);
    return () => {
      active = false;
      try { unsubState?.(); } catch {}
      try { unsubPatch?.(); } catch {}
      try { announceLeave(); } catch {}
    };
  }, [character]);

  useEffect(() => {
    const slug = character;
    if (!slug) return;
    let active = true;
    void refreshRelationalInventory(slug)
      .then((items) => {
        if (active) setRelationalInventoryItems(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setRelationalInventoryItems([]);
      });

    return () => {
      active = false;
    };
  }, [character, refreshRelationalInventory]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [nextSpells, nextSkills, nextSpellSlots, nextCharacters] = await Promise.all([
          fetchSpells(),
          fetchSkills(),
          fetchSpellSlots(),
          fetchCharacters(),
        ]);
        if (active) {
          setSpells(nextSpells);
          setSkillsCatalog(Array.isArray(nextSkills?.skills) ? nextSkills.skills : []);
          setSpellSlotTable(nextSpellSlots ?? {});
          setTransferTargets(
            (Array.isArray(nextCharacters) ? nextCharacters : [])
              .filter((entry) => entry?.characterType !== "png" && entry?.slug !== character)
              .map((entry) => ({
                slug: entry.slug,
                name: entry?.basicInfo?.characterName ?? entry.slug,
              }))
              .sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }))
          );
        }
      } catch {
        if (active) {
          setSpells({});
          setSkillsCatalog([]);
          setSpellSlotTable({});
          setTransferTargets([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [character]);

  useEffect(() => {
    let active = true;
    void fetchItemDefinitions()
      .then((items) => {
        if (active) setItemDefinitions(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setItemDefinitions([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const missingDefinitionIds = Array.from(
      new Set(
        relationalInventoryItems
          .filter((item) => item.isEquipped && item.itemDefinitionId)
          .map((item) => item.itemDefinitionId)
          .filter(
            (itemDefinitionId): itemDefinitionId is string =>
              !!itemDefinitionId && !itemDefinitionDetailsById[itemDefinitionId]
          )
      )
    );

    if (missingDefinitionIds.length === 0) return;

    let active = true;

    void Promise.all(
      missingDefinitionIds.map(async (itemDefinitionId) => {
        try {
          const detail = await fetchItemDefinition(itemDefinitionId);
          return [itemDefinitionId, detail] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (!active) return;
      const validResults = results.filter(
        (entry): entry is readonly [string, ItemDefinitionEntry] => Array.isArray(entry)
      );
      if (validResults.length === 0) return;
      setItemDefinitionDetailsById((prev) => ({
        ...prev,
        ...Object.fromEntries(validResults),
      }));
    });

    return () => {
      active = false;
    };
  }, [relationalInventoryItems, itemDefinitionDetailsById]);

  const derivedItemCapabilities = useMemo<CapabilityEntry[]>(() => {
    return relationalInventoryItems.flatMap((item) => {
      if (!item.isEquipped || !item.itemDefinitionId) return [];
      const detail = itemDefinitionDetailsById[item.itemDefinitionId];
      if (!detail || !Array.isArray(detail.features) || detail.features.length === 0) return [];

      return detail.features.map((feature) => {
        const isPassiveFeature = String(feature.kind ?? "").toUpperCase() === "PASSIVE";
        const isActiveFeature =
          !isPassiveFeature && (!!feature.resetOn || (typeof feature.maxUses === "number" && feature.maxUses > 0) || String(feature.kind ?? "").toUpperCase() === "ACTIVE");
        const resetMap: Record<string, CapabilityReset> = {
          AT_WILL: "atWill",
          ENCOUNTER: "encounter",
          SHORT_REST: "shortRest",
          LONG_REST: "longRest",
          DAILY: "longRest",
          CUSTOM: "custom",
        };
        const usesSpent = Math.max(
          0,
          Number(item.featureStates?.find((entry) => entry.itemFeatureId === feature.id)?.usesSpent ?? 0)
        );
        const usage =
          isActiveFeature
            ? {
                resetOn: resetMap[feature.resetOn ?? "AT_WILL"] ?? "atWill",
                customLabel: feature.resetOn === "CUSTOM" ? feature.customResetLabel ?? undefined : undefined,
                used:
                  typeof feature.maxUses === "number" && feature.maxUses > 0
                    ? Array.from({ length: feature.maxUses }, (_, index) => index < usesSpent)
                    : [],
              }
            : undefined;

        return {
          name: feature.name,
          category: item.itemName,
          kind: (String(feature.kind ?? "").toUpperCase() === "PASSIVE" ? "passive" : (isActiveFeature ? "active" : "passive")),
          shortDescription:
            feature.description?.trim() ||
            `Feature concessa da ${item.itemName} mentre l'oggetto e' equipaggiato.`,
          description: feature.description?.trim() || undefined,
          passiveEffects: Array.isArray(feature.passiveEffects) ? (feature.passiveEffects as PassiveEffectEntry[]) : undefined,
          sourceType: "item",
          sourceLabel: item.itemName,
          sourceItemId: item.id,
          sourceFeatureId: feature.id,
          readOnly: true,
          usage,
        } satisfies CapabilityEntry;
      });
    });
  }, [itemDefinitionDetailsById, relationalInventoryItems]);

  useEffect(() => {
    if (characterData?.basicInfo?.class) {
      setSelectedClass(characterData.basicInfo.class.toLowerCase());
    }
  }, [characterData?.basicInfo?.class]);

  useEffect(() => {
    const characterName = characterData?.basicInfo?.characterName?.trim();
    document.title = characterName || "Scheda personaggio";
  }, [characterData?.basicInfo?.characterName]);

  useEffect(() => {
    if (!characterData || characterData.characterType === "png") return;

    let timeoutId: number | null = null;
    const offTurnStart = onInitiativeTurnStart((payload) => {
      if (payload.slug !== characterData.slug) return;

      setTurnAlertActive(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.([180, 90, 180]);
        } catch {}
      }

      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setTurnAlertActive(false);
      }, 4200);
    });

    return () => {
      try {
        offTurnStart();
      } catch {}
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [characterData]);

  const persistCharacterSheetLayout = useCallback(
    async (nextLayout: CharacterSheetLayoutCardEntry[]) => {
      const normalized = normalizeCharacterSheetLayout(nextLayout);
      await saveCharacterSheetLayout(normalized);
      setCharacterSheetLayout(normalized);
    },
    []
  );

  const resetCharacterSheetLayout = async () => {
    try {
      await persistCharacterSheetLayout(DEFAULT_CHARACTER_SHEET_LAYOUT);
      toast.success("Layout ripristinato.");
    } catch {
      toast.error("Non sono riuscito a ripristinare il layout.");
    }
  };

  const cardRegistry = useMemo(
    () =>
      ({
        abilityScores: {
          label: "Punti abilità",
          render: (
            <AbilityScores
              characterData={characterData}
              makeChangeHandler={makeChangeHandler}
              abilityModifier={abilityModifier}
            />
          ),
        },
        proficiencies: {
          label: "Competenze & Abilità",
          render: (
            <Proficiencies
              characterData={characterData}
              proficiencyBonus={proficiencyBonus}
              abilityModifier={abilityModifier}
              deathSaves={deathSaves}
              setDeathSaves={setDeathSaves}
              calculateSkillValues={calculateSkillValues}
              skillsCatalog={skillsCatalog}
            />
          ),
        },
        languages: {
          label: "Linguaggi",
          render: <Languages characterData={characterData} />,
        },
        combatStats: {
          label: "Combattimento",
          render: (
            <CombatStats
              characterData={characterData}
              makeChangeHandler={makeChangeHandler}
              abilityModifier={abilityModifier}
              relationalInventoryItems={relationalInventoryItems}
            />
          ),
        },
        hitPoints: {
          label: "Punti ferita",
          render: (
            <HitPoints
              characterData={characterData}
              setCharacterData={setCharacterData}
              abilityModifier={abilityModifier}
            />
          ),
        },
        capabilities: {
          label: "Skills",
          render: (
            <Capabilities
              characterData={characterData}
              addCapability={addCapability}
              updateCapability={updateCapability}
              removeCapability={removeCapability}
              toggleCapabilityUse={toggleCapabilityUse}
              toggleDerivedCapabilityUse={toggleDerivedCapabilityUse}
              derivedCapabilities={derivedItemCapabilities}
            />
          ),
        },
        attacksAndEquipment: {
          label: "Attack & Equipment",
          render: (
            <AttacksAndSpells
              characterData={characterData}
              toggleEquipAttack={toggleEquipAttack}
              toggleAttackSkillUsed={toggleAttackSkillUsed}
              toggleEquipItem={toggleEquipItem}
              toggleItemSkillUsed={toggleItemSkillUsed}
              relationalInventoryItems={relationalInventoryItems}
              toggleEquipRelationalItem={toggleEquipRelationalItem}
            />
          ),
        },
        features: {
          label: "Tratti e Abilità",
          render: (
            <Features
              characterData={characterData}
              stripName={stripName}
              parseClassFromFeatureTitle={parseClassFromFeatureTitle}
              parseLevelFromFeatureTitle={parseLevelFromFeatureTitle}
              findSpell={findSpell}
              openFeatureModal={openFeatureModal}
              setAddSpellOpen={setAddSpellOpen}
              spellSlotTable={spellSlotTable}
            />
          ),
        },
        inventory: {
          label: "Inventario",
          render: (
            <Inventory
              coins={coins}
              characterData={characterData}
              setMode={setMode}
              setCoinFlow={setCoinFlow}
              setInvOpen={setInvOpen}
              invOpen={invOpen}
              mode={mode}
              coinType={coinType}
              setCoinType={setCoinType}
              coinQty={coinQty}
              setCoinQty={setCoinQty}
              coinFlow={coinFlow}
              compactCoinsOnAdd={compactCoinsOnAdd}
              setCompactCoinsOnAdd={setCompactCoinsOnAdd}
              handleInventorySubmit={handleInventorySubmit}
              resetInvForm={resetInvForm}
              itemName={itemName}
              setItemName={setItemName}
              itemAtkBonus={itemAtkBonus}
              setItemAtkBonus={setItemAtkBonus}
              itemDmgType={itemDmgType}
              setItemDmgType={setItemDmgType}
              itemSkill={itemSkill}
              setItemSkill={setItemSkill}
              itemSkillType={itemSkillType}
              setItemSkillType={setItemSkillType}
              itemSkillInput={itemSkillInput}
              setItemSkillInput={setItemSkillInput}
              itemSkillsByType={itemSkillsByType}
              setItemSkillsByType={setItemSkillsByType}
              invError={invError}
              removeAttack={removeAttack}
              toggleEquipAttack={toggleEquipAttack}
              itemDescription={itemDescription}
              setItemDescription={setItemDescription}
              itemQuantity={itemQuantity}
              setItemQuantity={setItemQuantity}
              itemConsumableSubtype={itemConsumableSubtype}
              setItemConsumableSubtype={setItemConsumableSubtype}
              itemKind={itemKind}
              setItemKind={setItemKind}
              potionDice={potionDice}
              setPotionDice={setPotionDice}
              itemEquippable={itemEquippable}
              setItemEquippable={setItemEquippable}
              removeStructuredItem={removeStructuredItem}
              bumpConsumableQuantity={bumpConsumableQuantity}
              toggleEquipItem={toggleEquipItem}
              relationalInventoryItems={relationalInventoryItems}
              itemDefinitions={itemDefinitions}
              assignRelationalInventoryItem={assignRelationalInventoryItem}
              toggleEquipRelationalItem={toggleEquipRelationalItem}
              decrementRelationalConsumable={decrementRelationalConsumable}
              incrementRelationalConsumable={incrementRelationalConsumable}
              transferTargets={transferTargets}
              transferRelationalInventoryItem={transferRelationalInventoryItem}
            />
          ),
        },
      }) satisfies Record<CharacterSheetCardId, { label: string; render: React.ReactNode }>,
    [
      abilityModifier,
      characterData,
      coinFlow,
      coinQty,
      coinType,
      coins,
      compactCoinsOnAdd,
      deathSaves,
      decrementRelationalConsumable,
      derivedItemCapabilities,
      handleInventorySubmit,
      incrementRelationalConsumable,
      invError,
      invOpen,
      itemAtkBonus,
      itemConsumableSubtype,
      itemDefinitions,
      itemDescription,
      itemDmgType,
      itemEquippable,
      itemKind,
      itemName,
      itemQuantity,
      itemSkill,
      itemSkillInput,
      itemSkillType,
      itemSkillsByType,
      mode,
      potionDice,
      relationalInventoryItems,
      removeAttack,
      removeItem,
      resetInvForm,
      setCoinFlow,
      setCoinQty,
      setCoinType,
      setCompactCoinsOnAdd,
      setDeathSaves,
      setInvOpen,
      setItemAtkBonus,
      setItemConsumableSubtype,
      setItemDescription,
      setItemDmgType,
      setItemEquippable,
      setItemKind,
      setItemName,
      setItemQuantity,
      setItemSkill,
      setItemSkillInput,
      setItemSkillType,
      setItemSkillsByType,
      setMode,
      setPotionDice,
      setCharacterData,
      skillsCatalog,
      spellSlotTable,
      toggleAttackSkillUsed,
      toggleCapabilityUse,
      toggleDerivedCapabilityUse,
      toggleEquipAttack,
      toggleEquipItem,
      toggleEquipRelationalItem,
      toggleItemSkillUsed,
      transferRelationalInventoryItem,
      transferTargets,
      updateCapability,
      removeCapability,
      addCapability,
      assignRelationalInventoryItem,
      updateLegacyItem,
      bumpConsumableQuantity,
      stripName,
      parseClassFromFeatureTitle,
      parseLevelFromFeatureTitle,
      findSpell,
      openFeatureModal,
      setAddSpellOpen,
    ]
  );

  const layoutColumns = useMemo(
    () => buildCharacterSheetLayoutColumns(characterSheetLayout),
    [characterSheetLayout]
  );

  const layoutSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (layoutEditMode) {
      setPreEditCollapsedCards(collapsedLayoutCards);
      setCollapsedLayoutCards(
        Object.fromEntries(
          DEFAULT_CHARACTER_SHEET_LAYOUT.map((entry) => [entry.cardId, true])
        )
      );
      return;
    }

    if (preEditCollapsedCards) {
      setCollapsedLayoutCards(preEditCollapsedCards);
      setPreEditCollapsedCards(null);
    }
  }, [layoutEditMode]);

  const handleLayoutDragStart = (event: DragStartEvent) => {
    const cardId = String(event.active.id) as CharacterSheetCardId;
    setDraggedCardId(cardId);
    setDragStartLayout(characterSheetLayout);
  };

  const persistLayoutAfterDrag = async (nextLayout: CharacterSheetLayoutCardEntry[], previousLayout: CharacterSheetLayoutCardEntry[] | null) => {
    if (!previousLayout) return;
    if (JSON.stringify(previousLayout) === JSON.stringify(nextLayout)) return;

    try {
      await persistCharacterSheetLayout(nextLayout);
    } catch {
      setCharacterSheetLayout(previousLayout);
      toast.error("Non sono riuscito a salvare il layout.");
    }
  };

  const handleLayoutDragOver = (event: DragOverEvent) => {
    const activeId = String(event.active.id ?? "") as CharacterSheetCardId;
    const overId = String(event.over?.id ?? "");
    if (!activeId || !overId || activeId === overId) return;

    let targetColumn: 0 | 1 | 2 | null = null;
    let targetIndex = 0;

    if (overId.startsWith("column-")) {
      const parsedColumn = Number(overId.replace("column-", ""));
      if (![0, 1, 2].includes(parsedColumn)) return;
      targetColumn = parsedColumn as 0 | 1 | 2;
      targetIndex = layoutColumns[targetColumn].length;
    } else {
      const overCardId = overId as CharacterSheetCardId;
      const overEntry = characterSheetLayout.find((entry) => entry.cardId === overCardId);
      if (!overEntry) return;
      targetColumn = overEntry.column;
      targetIndex = layoutColumns[targetColumn].findIndex((entry) => entry.cardId === overCardId);
      if (targetIndex < 0) return;
    }

    const nextLayout = moveCharacterSheetCardToPosition(
      characterSheetLayout,
      activeId,
      targetColumn,
      targetIndex
    );

    if (JSON.stringify(nextLayout) !== JSON.stringify(characterSheetLayout)) {
      setCharacterSheetLayout(nextLayout);
    }
  };

  const handleLayoutDragCancel = () => {
    const previousLayout = dragStartLayout;
    setDraggedCardId(null);
    setDragStartLayout(null);
    if (previousLayout) {
      setCharacterSheetLayout(previousLayout);
    }
  };

  const handleLayoutDragEnd = async (event: DragEndEvent) => {
    const previousLayout = dragStartLayout;
    const nextLayout = characterSheetLayout;
    const overId = String(event.over?.id ?? "");

    setDraggedCardId(null);
    setDragStartLayout(null);

    if (!overId && previousLayout) {
      setCharacterSheetLayout(previousLayout);
      return;
    }

    await persistLayoutAfterDrag(nextLayout, previousLayout);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center parchment">
        <div className="text-center">
          <h2 className="text-2xl font-heading text-primary">Carico la scheda...</h2>
        </div>
      </div>
    );
  }

  if (!characterData) {
    return (
      <div className="min-h-screen flex items-center justify-center parchment">
        <div className="text-center">
          <h2 className="text-2xl font-heading text-primary">
            {loadError ? "Accesso negato" : "Il personaggio non esiste"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {loadError ?? `"${character}" non esiste.`}
          </p>
          <Button asChild className="mt-4">
            <a href="/">Torna alla Home</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen parchment p-6">
      <div className={`max-w-5xl mx-auto space-y-6 rounded-[1.75rem] transition-all ${turnAlertActive ? "turn-highlight-active" : ""}`}>
        <CharacterHeader
          characterData={characterData}
          editMode={editMode}
          setEditMode={setEditMode}
          monsterCompendiumHref="/compendium/monsters"
          makeChangeHandler={makeChangeHandler}
          layoutActions={
            layoutEditMode ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent"
                  onClick={() => void resetCharacterSheetLayout()}
                  title="Ripristina layout"
                  aria-label="Ripristina layout"
                >
                  <RotateCcw className="h-4 w-4 text-primary" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent"
                  onClick={() => setLayoutEditMode(false)}
                  title="Fine modifica layout"
                  aria-label="Fine modifica layout"
                >
                  <Check className="h-4 w-4 text-primary" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent"
                onClick={() => setLayoutEditMode(true)}
                title="Modifica layout"
                aria-label="Modifica layout"
              >
                <LayoutTemplate className="h-4 w-4 text-primary" />
              </Button>
            )
          }
        />
        {characterData.characterType !== "png" ? (
          <FloatingCharacterChat
            slug={characterData.slug}
            title={characterData.basicInfo.characterName}
            avatarUrl={characterData.basicInfo.portraitUrl}
          />
        ) : null}
        <SheetCardStateProvider
          value={{
            collapsedCards: collapsedLayoutCards,
            setCardCollapsed: (cardId, collapsed) =>
              setCollapsedLayoutCards((prev) => ({ ...prev, [cardId]: collapsed })),
          }}
        >
          <DndContext
            sensors={layoutSensors}
            collisionDetection={closestCenter}
            onDragStart={handleLayoutDragStart}
            onDragOver={handleLayoutDragOver}
            onDragEnd={handleLayoutDragEnd}
            onDragCancel={handleLayoutDragCancel}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {layoutColumns.map((columnEntries, columnIndex) => (
                <LayoutColumnDropZone key={`layout-column-${columnIndex}`} columnId={`column-${columnIndex}`}>
                  <SortableContext
                    items={columnEntries.map((entry) => entry.cardId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      className={`space-y-6 rounded-xl transition ${
                        layoutEditMode ? "min-h-[10rem] border border-dashed border-border/60 p-3" : ""
                      }`}
                    >
                      {layoutEditMode && columnEntries.length === 0 ? (
                        <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
                          Trascina qui una card
                        </div>
                      ) : null}
                      {columnEntries.map((entry) => {
                        const card = cardRegistry[entry.cardId];
                        if (!card) return null;

                        return (
                          <SortableLayoutCard
                            key={entry.cardId}
                            cardId={entry.cardId}
                            layoutEditMode={layoutEditMode}
                          >
                            {card.render}
                          </SortableLayoutCard>
                        );
                      })}
                    </div>
                  </SortableContext>
                </LayoutColumnDropZone>
              ))}
            </div>
            <DragOverlay>
              {draggedCardId ? (
                <div className="rounded-lg border border-border/70 bg-background/95 px-3 py-2 text-xs shadow-xl">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span>{cardRegistry[draggedCardId]?.label ?? "Card"}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </SheetCardStateProvider>
      </div>

      {/* ===== Dialog: Aggiungi incantesimo ===== */}
      <Dialog open={addSpellOpen} onOpenChange={setAddSpellOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aggiungi incantesimo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label>Classe</label>
              <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una classe" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls.charAt(0).toUpperCase() + cls.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label>Cerca per nome</label>
              <input
                value={spellQuery}
                onChange={(e) => setSpellQuery(e.target.value)}
                placeholder="Es. Parola Guaritrice"
                disabled={!selectedClass}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div className="space-y-2">
              <label>Incantesimi</label>
              <div className="max-h-80 overflow-auto rounded border p-2">
                {selectedClass && filteredSpells.length === 0 && (
                  <div className="text-sm text-muted-foreground px-1 py-2">Nessun risultato.</div>
                )}
                {selectedClass &&
                  filteredSpells.map((s) => (
                    <div
                      key={`${s.name}-${s.level}`}
                      className="flex items-start justify-between gap-3 p-2 rounded hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-primary truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Lv {s.level} · {s.school}
                          {s.concentration ? " · Concentrazione" : ""} {s.ritual ? " · Rituale" : ""}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleAddSpellToFeatures(s)}>
                        Aggiungi
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">Chiudi</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Dettagli incantesimo/feature ===== */}
      <Dialog open={spellModalOpen} onOpenChange={setSpellModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="whitespace-pre-line">
              {modalTitle || (modalSpell ? modalSpell.name : "Dettaglio")}
            </DialogTitle>
          </DialogHeader>
          {modalSpell ? (
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">
                Livello {modalSpell.level} · {modalSpell.school}
                {modalSpell.concentration ? " · Concentrazione" : ""} {modalSpell.ritual ? " · Rituale" : ""}
              </div>
              <div><span className="font-medium">Tempo di lancio:</span> {modalSpell.casting_time}</div>
              <div><span className="font-medium">Gittata:</span> {modalSpell.range}</div>
              <div><span className="font-medium">Componenti:</span> {modalSpell.components || "-"}</div>
              <div><span className="font-medium">Durata:</span> {modalSpell.duration}</div>
              <Separator />
              <div className="whitespace-pre-line">{modalSpell.description}</div>
              {modalSpell.usage && (
                <div className="whitespace-pre-line">
                  <span className="font-medium">Uso:</span> {modalSpell.usage}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm whitespace-pre-line">{modalDescription}</div>
          )}
          <DialogFooter className="mt-2">
            {modalFeatureIndex !== null && (
              <Button
                variant="destructive"
                onClick={() => setConfirmRemoveFeatureOpen(true)}
              >
                Elimina
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline">Chiudi</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemoveFeatureOpen} onOpenChange={setConfirmRemoveFeatureOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo incantesimo?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione rimuoverà definitivamente la voce dalla lista dei tratti e incantesimi del personaggio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemoveFeature}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default CharacterSheet;
