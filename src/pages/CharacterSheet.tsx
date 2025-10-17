import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import {
  joinCharacterRoom,
  fetchCharacter,
  onCharacterState,
  onCharacterPatch,
  updateCharacter,
  applyPatch,
  announceEnter,
} from "@/realtime";
import {
  coerce,
  setAtPathImmutable,
  buildPatch,
  abilityModifier,
  proficiencyBonus,
  calculateSkillValues,
} from "@/utils";
import spellsData from "@/data/spells.json";

import CharacterHeader from "@/components/characterSheet/character-header";
import AbilityScores from "@/components/characterSheet/ability-scores";
import Proficiencies from "@/components/characterSheet/proficiencies";
import CombatStats from "@/components/characterSheet/combat-stats";
import HitPoints from "@/components/characterSheet/hit-points";
import AttacksAndSpells from "@/components/characterSheet/attacks-and-spells";
import Features from "@/components/characterSheet/features";
import Inventory from "@/components/characterSheet/inventory";
import Languages from "@/components/characterSheet/languages";

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
}

type Spell = {
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  usage?: string | null;
};

type SpellsByClass = Record<string, Spell[]>;
const spells = spellsData as SpellsByClass;

const COIN_KEYS = {
  mr: "cp",
  ma: "sp",
  me: "ep",
  mo: "gp",
  mp: "pp",
} as const;
type CoinAbbr = keyof typeof COIN_KEYS;

const SKILL_TYPES: SkillType[] = ["volonta", "incontro", "riposoBreve", "riposoLungo"];

const CharacterSheet = () => {
  const { character } = useParams();
  const [characterData, setCharacterData] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editDiceMode, setEditDiceMode] = useState(false);

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
  const [selectedClass, setSelectedClass] = useState<string>(characterData?.basicInfo.class?.toLowerCase?.());
  const [spellQuery, setSpellQuery] = useState("");

  // ======= SPELL DETAILS modal (click su riga) =======
  const [spellModalOpen, setSpellModalOpen] = useState(false);
  const [modalSpell, setModalSpell] = useState<Spell | null>(null);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalDescription, setModalDescription] = useState<string>("");

  const classOptions = useMemo(() => Object.keys(spells).sort(), []);
  const filteredSpells = useMemo(() => {
    if (!selectedClass) return [];
    const list = spells[selectedClass] ?? [];
    const q = spellQuery.trim().toLowerCase();
    return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
  }, [selectedClass, spellQuery]);

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

  const openFeatureModal = (feature: { name: string; description: string }) => {
    const baseName = stripName(feature.name);
    const cls = parseClassFromFeatureTitle(feature.name);
    const lvl = parseLevelFromFeatureTitle(feature.name);
    const found = findSpell(baseName, cls, lvl);

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

  const removeItem = (index: number) => {
    if (!characterData) return;
    const nextItems = characterData.equipment.equipment.filter((_, i) => i !== index);
    const patch = { equipment: { equipment: nextItems } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, equipment: nextItems } } : prev));
    if (character) updateCharacter(character, patch);
  };

  /** === NUOVO: submit inventario parametrico === */
  const handleInventorySubmit = (payload?: {
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
      let nextAmount = coins[stdKey];
      nextAmount = coinFlow === "add" ? coins[stdKey] + qty : Math.max(0, coins[stdKey] - qty);
      const nextCoins: Coins = { ...coins, [stdKey]: nextAmount };
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
        equipped: false,
        ...(hasAnyCategorized ? { skillsByType: prunedSkillsByType } : {}),
        ...(!hasAnyCategorized && itemSkill.trim() ? { skill: itemSkill.trim() } : {}),
      };

      const nextAttacks = [...prevEq.attacks, attack];
      const next = { ...prevEq, attacks: nextAttacks, items: itemsArray, coins }; // non aggiorno più equipment legacy
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
        equipped: false,
        ...(hasAnyCategorized ? { skillsByType: prunedSkillsByType } : {}),
      };
      const nextItems = [...itemsArray, newObj];
      const next = { ...prevEq, items: nextItems, coins }; // non tocco lista legacy
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
      const nextItems = [...itemsArray, newCons];
      const next = { ...prevEq, items: nextItems, coins }; // non tocco lista legacy
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
    (async () => {
      try {
        const data = await fetchCharacter(slug);
        setCharacterData(data);
      } catch {
      } finally {
        setLoading(false);
      }
      joinCharacterRoom(slug);
      unsubState = onCharacterState((state) => setCharacterData(state));
      unsubPatch = onCharacterPatch((patch) =>
        setCharacterData((prev) => (prev ? applyPatch(prev, patch) : prev))
      );
    })();
    if (!character) return;
    announceEnter(character);
  }, [character]);

  useEffect(() => {
    if (characterData?.basicInfo?.class) {
      setSelectedClass(characterData.basicInfo.class.toLowerCase());
    }
  }, [characterData?.basicInfo?.class]);

  useEffect(() => {
    const loadCharacter = async () => {
      try {
        const data = await import(`@/data/characters/${character}.json`);
        setCharacterData(data.default);
      } catch (error) {
        console.error("Character not found:", error);
      } finally {
        setLoading(false);
      }
    };
    if (character) {
      loadCharacter();
    }
  }, [character]);

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
          <h2 className="text-2xl font-heading text-primary">Il personaggio non esiste</h2>
          <p className="text-muted-foreground mt-2">"{character}"non esiste.</p>
          <Button asChild className="mt-4">
            <a href="/">Torna alla Home</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen parchment p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <CharacterHeader
          characterData={characterData}
          editMode={editMode}
          setEditMode={setEditMode}
          makeChangeHandler={makeChangeHandler}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <AbilityScores
              characterData={characterData}
              makeChangeHandler={makeChangeHandler}
              abilityModifier={abilityModifier}
            />
            <Proficiencies
              characterData={characterData}
              proficiencyBonus={proficiencyBonus}
              deathSaves={deathSaves}
              setDeathSaves={setDeathSaves}
              calculateSkillValues={calculateSkillValues}
            />
            <Languages characterData={characterData} />
          </div>
          <div className="space-y-6">
            <CombatStats
              characterData={characterData}
              makeChangeHandler={makeChangeHandler}
              abilityModifier={abilityModifier}
            />
            <HitPoints
              characterData={characterData}
              setCharacterData={setCharacterData}
              editDiceMode={editDiceMode}
              setEditDiceMode={setEditDiceMode}
              makeChangeHandler={makeChangeHandler}
              abilityModifier={abilityModifier}
            />
            <AttacksAndSpells
              characterData={characterData}
              toggleEquipAttack={toggleEquipAttack}
              toggleAttackSkillUsed={toggleAttackSkillUsed}
              toggleEquipItem={toggleEquipItem}
              toggleItemSkillUsed={toggleItemSkillUsed}
            />
          </div>
          <div className="space-y-6">
            <Features
              characterData={characterData}
              stripName={stripName}
              parseClassFromFeatureTitle={parseClassFromFeatureTitle}
              parseLevelFromFeatureTitle={parseLevelFromFeatureTitle}
              findSpell={findSpell}
              openFeatureModal={openFeatureModal}
              setAddSpellOpen={setAddSpellOpen}
            />
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
              handleInventorySubmit={handleInventorySubmit} // payload-aware
              resetInvForm={resetInvForm}
              itemName={itemName}
              setItemName={setItemName}
              itemAtkBonus={itemAtkBonus}
              setItemAtkBonus={setItemAtkBonus}
              itemDmgType={itemDmgType}
              setItemDmgType={setItemDmgType}
              /** legacy singolo campo */
              itemSkill={itemSkill}
              setItemSkill={setItemSkill}
              /** nuove props per skills categorizzate */
              itemSkillType={itemSkillType}
              setItemSkillType={setItemSkillType}
              itemSkillInput={itemSkillInput}
              setItemSkillInput={setItemSkillInput}
              itemSkillsByType={itemSkillsByType}
              setItemSkillsByType={setItemSkillsByType}
              invError={invError}
              removeAttack={removeAttack}
              removeItem={removeItem}
              toggleEquipAttack={toggleEquipAttack}
              /** oggetti/consumabili */
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
              /** handlers elenco strutturato */
              removeStructuredItem={removeStructuredItem}
              bumpConsumableQuantity={bumpConsumableQuantity}
              toggleEquipItem={toggleEquipItem}
            />
          </div>
        </div>
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
            <DialogClose asChild>
              <Button variant="outline">Chiudi</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CharacterSheet;
