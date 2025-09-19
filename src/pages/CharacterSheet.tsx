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
  };
  proficiencies: {
    proficiencyBonus: number;
    savingThrows: string[];
    skills: Array<{ name: string; ability: string; value: number }>;
    languages: string[];
  };
  equipment: {
    attacks: Array<{ name: string; attackBonus: number; damageType: string; equipped?: boolean }>;
    equipment: string[];
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
  const [itemName, setItemName] = useState("");
  const [itemAtkBonus, setItemAtkBonus] = useState<string>("");
  const [itemDmgType, setItemDmgType] = useState<string>("");
  const [invError, setInvError] = useState<string>("");

  // ======= ADD SPELL dialog (CTA) =======
  const [addSpellOpen, setAddSpellOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>(characterData?.basicInfo.class.toLowerCase());
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

  const handleInventorySubmit = () => {
    if (!characterData) return;
    setInvError("");
    if (mode === "coins") {
      const qty = parseInt(coinQty, 10);
      if (isNaN(qty) || qty <= 0) {
        setInvError("Inserisci una quantità positiva di monete.");
        return;
      }
      const stdKey = COIN_KEYS[coinType] as keyof Coins;
      let nextAmount = coins[stdKey];
      if (coinFlow === "add") {
        nextAmount = coins[stdKey] + qty;
      } else {
        nextAmount = Math.max(0, coins[stdKey] - qty);
      }
      const nextCoins: Coins = { ...coins, [stdKey]: nextAmount };
      const nextEquip = { ...characterData.equipment, coins: nextCoins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: nextEquip } : prev));
      if (character) updateCharacter(character, { equipment: { coins: nextCoins } });
      setInvOpen(false);
      resetInvForm();
      return;
    }
    if (!itemName.trim()) {
      setInvError("Il nome dell'oggetto è obbligatorio.");
      return;
    }
    const attackFieldsFilled = itemAtkBonus.trim() !== "" || itemDmgType.trim() !== "";
    if (attackFieldsFilled && (itemAtkBonus.trim() === "" || itemDmgType.trim() === "")) {
      setInvError("Se compili uno tra Bonus attacco o Tipo di danno, devi compilare anche l'altro.");
      return;
    }
    const prevEq = characterData.equipment;
    if (attackFieldsFilled) {
      const attack = {
        name: itemName.trim(),
        attackBonus: Number(itemAtkBonus),
        damageType: itemDmgType.trim(),
        equipped: false,
      };
      const nextAttacks = [...prevEq.attacks, attack];
      const alsoList = prevEq.equipment.includes(itemName.trim()) ? prevEq.equipment : [...prevEq.equipment, itemName.trim()];
      const next = { ...prevEq, attacks: nextAttacks, equipment: alsoList, coins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: next } : prev));
      if (character) updateCharacter(character, { equipment: next });
    } else {
      const nextList = [...prevEq.equipment, itemName.trim()];
      const next = { ...prevEq, equipment: nextList, coins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: next } : prev));
      if (character) updateCharacter(character, { equipment: next });
    }
    setInvOpen(false);
    resetInvForm();
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
    setSelectedClass(characterData?.basicInfo.class.toLowerCase());
  }, [characterData?.basicInfo.class]);

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
              handleInventorySubmit={handleInventorySubmit}
              resetInvForm={resetInvForm}
              itemName={itemName}
              setItemName={setItemName}
              itemAtkBonus={itemAtkBonus}
              setItemAtkBonus={setItemAtkBonus}
              itemDmgType={itemDmgType}
              setItemDmgType={setItemDmgType}
              invError={invError}
              removeAttack={removeAttack}
              removeItem={removeItem}
              toggleEquipAttack={toggleEquipAttack}
            />
            <Languages characterData={characterData} />
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