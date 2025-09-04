import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Heart, Shield, Zap, Sword, FastForward, X } from "lucide-react";
import {
  joinCharacterRoom,
  fetchCharacter,
  onCharacterState,
  onCharacterPatch,
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
import spellsData from "@/data/spells.json"; // JSON raggruppato per classe: { bardo: Spell[], warlock: Spell[], ... }

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
  mr: "cp", // rame
  ma: "sp", // argento
  me: "ep", // electrum
  mo: "gp", // oro
  mp: "pp", // platino
} as const;
type CoinAbbr = keyof typeof COIN_KEYS;

const CharacterSheet = () => {
  const { character } = useParams();
  const [characterData, setCharacterData] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editDiceMode, setEditDiceMode] = useState(false);

  // ======= INVENTORY state (modal) =======
  const [invOpen, setInvOpen] = useState(false);
  const [mode, setMode] = useState<"coins" | "item">("coins");

  // coins form
  const [coinType, setCoinType] = useState<CoinAbbr>("mo");
  const [coinQty, setCoinQty] = useState<string>("");
  // add/remove coins flow
  const [coinFlow, setCoinFlow] = useState<"add" | "remove">("add");

  // item form
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
  const [modalDescription, setModalDescription] = useState<string>(""); // fallback per feature non-spell

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

  // --- helpers per riconoscere un feature come incantesimo e aprire la modale completa ---
  const stripName = (full: string) => {
    // es. "Parola Guaritrice (bardo, Lv 1)" -> "Parola Guaritrice"
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
    // priorità: classe + livello se disponibili
    if (maybeClass && spells[maybeClass]) {
      const byClass = spells[maybeClass];
      const precise = byClass.find((s) => s.name.toLowerCase() === lcName && (maybeLevel ? s.level === maybeLevel : true));
      if (precise) return precise;
      const loose = byClass.find((s) => s.name.toLowerCase() === lcName);
      if (loose) return loose;
    }
    // altrimenti cerca su tutte le classi
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
      setModalDescription(""); // non serve
    } else {
      // non è un incantesimo, o non trovato: modale generica feature
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

  // Unified dynamic onChange factory
  const makeChangeHandler = useCallback(
    (path: string, kind: "string" | "int" | "float" = "string") =>
      (e: React.ChangeEvent<InputEl>) => {
        const v = coerce(e.target.value, kind);

        // local state update (immutable)
        setCharacterData((prev) => (prev ? setAtPathImmutable(prev, path, v) : prev));

        // realtime patch
        if (character) {
          updateCharacter(character, buildPatch(path, v));
        }
      },
    [character]
  );

  // Toggle equip helper (in INVENTARIO)
  const toggleEquipAttack = (index: number) => {
    if (!characterData) return;
    const nextAttacks = characterData.equipment.attacks.map((a, i) =>
      i === index ? { ...a, equipped: !a.equipped } : a
    );
    const patch = { equipment: { attacks: nextAttacks } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, attacks: nextAttacks } } : prev));
    if (character) updateCharacter(character, patch);
  };

  // remove single attack
  const removeAttack = (index: number) => {
    if (!characterData) return;
    const nextAttacks = characterData.equipment.attacks.filter((_, i) => i !== index);
    const patch = { equipment: { attacks: nextAttacks } };
    setCharacterData((prev) => (prev ? { ...prev, equipment: { ...prev.equipment, attacks: nextAttacks } } : prev));
    if (character) updateCharacter(character, patch);
  };

  // remove single item
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
        nextAmount = Math.max(0, coins[stdKey] - qty); // clamp a 0
      }

      const nextCoins: Coins = { ...coins, [stdKey]: nextAmount };
      const nextEquip = { ...characterData.equipment, coins: nextCoins };
      setCharacterData((prev) => (prev ? { ...prev, equipment: nextEquip } : prev));
      if (character) updateCharacter(character, { equipment: { coins: nextCoins } });

      setInvOpen(false);
      resetInvForm();
      return;
    }

    // mode === "item"
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

  // Load from API if available, else fallback to JSON import
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
        // falls back to existing dynamic import logic below
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

    // annuncia presenza quando la scheda è aperta
    announceEnter(character);
  }, [character]);

  useEffect(() => {
    setSelectedClass(characterData?.basicInfo.class.toLowerCase());
  }, [characterData?.basicInfo.class]);

  // Fallback loader from bundled JSON (dev-first)
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
        {/* Character Header */}
        <div className="dnd-frame-thick p-6 text-center">
          <h1 className="text-4xl font-heading font-bold text-primary mb-2">
            {characterData.basicInfo.characterName}
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="grid grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Classe</Label>
                {editMode ? (
                  <Input value={characterData.basicInfo.class} onChange={makeChangeHandler("basicInfo.class")} />
                ) : (
                  <div className="font-semibold">{characterData.basicInfo.class}</div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Livello</Label>
                {editMode ? (
                  <Input value={characterData.basicInfo.level} onChange={makeChangeHandler("basicInfo.level", "int")} />
                ) : (
                  <div className="font-semibold">{characterData.basicInfo.level}</div>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Background</Label>
              {editMode ? (
                <Input value={characterData.basicInfo.background} onChange={makeChangeHandler("basicInfo.background")} />
              ) : (
                <div className="font-semibold">{characterData.basicInfo.background}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nome giocatore</Label>
              {editMode ? (
                <Input value={characterData.basicInfo.playerName} onChange={makeChangeHandler("basicInfo.playerName")} />
              ) : (
                <div className="font-semibold">{characterData.basicInfo.playerName}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Razza</Label>
              {editMode ? (
                <Input value={characterData.basicInfo.race} onChange={makeChangeHandler("basicInfo.race")} />
              ) : (
                <div className="font-semibold">{characterData.basicInfo.race}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Allineamento</Label>
              {editMode ? (
                <Input value={characterData.basicInfo.alignment} onChange={makeChangeHandler("basicInfo.alignment")} />
              ) : (
                <div className="font-semibold">{characterData.basicInfo.alignment}</div>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Punti Esperienza</Label>
              {editMode ? (
                <Input
                  value={characterData.basicInfo.experiencePoints}
                  onChange={makeChangeHandler("basicInfo.experiencePoints", "int")}
                />
              ) : (
                <div className="font-semibold">{characterData.basicInfo.experiencePoints}</div>
              )}
            </div>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 bg-primary text-white"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? "Salva" : "Modifica"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Ability Scores */}
          <div className="space-y-6">
            <Card className="character-section">
              <div className="character-section-title">Punti abilità</div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(characterData.abilityScores).map(([ability, data]) => (
                  <div key={ability} className="ability-score flex flex-col items-center">
                    <div className="text-xs text-center font-medium text-muted-foreground uppercase">
                      {ability.slice(0, 3)}
                    </div>
                    <Input
                      value={data}
                      className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                      onChange={makeChangeHandler(`abilityScores.${ability}`, "int")}
                    />
                    <div className="ability-score-modifier">{abilityModifier(data)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="character-section">
              <div className="character-section-title">Competenze & Abilità</div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Bonus competenze</Label>
                  <div className="text-lg font-bold text-primary">
                    +{proficiencyBonus(characterData.basicInfo.level)}
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Tiri salvezza</Label>
                  <div className="space-y-1">
                    {characterData.proficiencies.savingThrows.map((save) => (
                      <Badge key={save} variant="secondary" className="mr-1">
                        {save}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Abilità</Label>
                  <div className="space-y-1 text-sm">
                    {calculateSkillValues(characterData).map((skill) => (
                      <div key={skill.name} className="text-primary font-medium">
                        {skill.name} ({skill.ability.slice(0, 3)}):{" "}
                        <span className="text-black">{skill.value >= 0 ? `+${skill.value}` : skill.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Center Column - Combat Stats */}
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="flex flex-col dnd-frame p-4 text-center">
                <Shield className="w-6 h-6 mx-auto text-primary mb-1" />
                <div className="text-xs text-muted-foreground">Classe armatura</div>
                <div className="text-2xl font-bold text-primary mt-auto">
                  <Input
                    value={characterData.combatStats.armorClass}
                    className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                    onChange={makeChangeHandler("combatStats.armorClass", "int")}
                  />
                </div>
              </Card>
              <Card className="flex flex-col dnd-frame p-4 text-center">
                <Zap className="w-6 h-6 mx-auto text-primary mb-1" />
                <div className="text-xs text-muted-foreground">Iniziativa</div>
                <div className="text-2xl font-bold text-primary mt-auto">
                  <Input
                    value={characterData.combatStats.initiative}
                    className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                    onChange={makeChangeHandler("combatStats.initiative", "int")}
                  />
                </div>
              </Card>
              <Card className="flex flex-col dnd-frame p-4 text-center">
                <FastForward className="w-6 h-6 mx-auto text-primary mb-1" />
                <div className="text-xs text-muted-foreground">Velocità</div>
                <div className="text-2xl font-bold text-primary mt-auto">
                  <Input
                    value={characterData.combatStats.speed}
                    className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                    onChange={makeChangeHandler("combatStats.speed", "int")}
                  />
                </div>
              </Card>
            </div>

            <Card className="character-section">
              <div className="character-section-title flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Punti ferita
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <Label className="text-xs text-muted-foreground">Totali</Label>
                    <div className="flex items-center justify-center text-xl gap-2 font-bold text-primary">
                      <Input
                        value={characterData.combatStats.currentHitPoints}
                        className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                        onChange={makeChangeHandler("combatStats.currentHitPoints", "int")}
                      />
                      /
                      {editDiceMode ? (
                        <Input
                          value={characterData.combatStats.hitPointMaximum}
                          className="text-center text-xl md:text-xl font-bold max-w-[70px]"
                          onChange={makeChangeHandler("combatStats.hitPointMaximum", "int")}
                        />
                      ) : (
                        characterData.combatStats.hitPointMaximum + characterData.combatStats.temporaryHitPoints
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Temporanei</Label>
                    <Input
                      value={characterData.combatStats.temporaryHitPoints}
                      className="text-center text-lg font-bold"
                      onChange={makeChangeHandler("combatStats.temporaryHitPoints", "int")}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <Label className="text-xs text-muted-foreground">Dado per colpire</Label>
                  {editDiceMode ? (
                    <Input value={characterData.combatStats.hitDice} onChange={makeChangeHandler("combatStats.hitDice")} />
                  ) : (
                    <div className="text-lg font-bold text-primary">{characterData.combatStats.hitDice}</div>
                  )}
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 bg-primary text-white"
                      onClick={() => setEditDiceMode(!editDiceMode)}
                    >
                      {editDiceMode ? "Salva" : "Modifica"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="character-section">
              <div className="character-section-title flex items-center gap-2">
                <Sword className="w-5 h-5 text-primary" />
                Attacchi e incantesimi
              </div>
              <div className="space-y-3">
                {characterData.equipment.attacks.map((attack, index) => {
                  if (attack.equipped) {
                    return (
                      <div key={`${attack.name}-${index}`} className="flex items-center justify-between text-sm dnd-frame p-2">
                        <div className="flex-1">
                          <div className="font-medium">
                            {attack.name} {attack.equipped ? "(equipaggiata)" : ""}
                          </div>
                          <div className="text-muted-foreground">+{attack.attackBonus} • {attack.damageType}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => toggleEquipAttack(index)}>
                            Disequipaggia
                          </Button>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </Card>
          </div>

          {/* Right Column - Features & Equipment */}
          <div className="space-y-6">
            <Card className="character-section">
              <div className="character-section-title flex items-center justify-between">
                <span>Tratti e Abilità</span>
              </div>

              {/* SOLO INFO PRINCIPALI — riga cliccabile per aprire modale dettagli */}
              <div className="space-y-3">
                {characterData.features.map((feature, index) => {
                  const baseName = stripName(feature.name);
                  const cls = parseClassFromFeatureTitle(feature.name);
                  const lvl = parseLevelFromFeatureTitle(feature.name);
                  const match = findSpell(baseName, cls, lvl);

                  // riga compatta
                  return (
                    <button
                      key={index}
                      onClick={() => openFeatureModal(feature)}
                      className="w-full text-left dnd-frame p-3 rounded hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <div className="font-semibold text-primary truncate">{baseName}</div>
                          {/* Sottotitolo compatto: se è spell, mostra livello/scuola/tag; altrimenti prima riga della descrizione */}
                          {match ? (
                            <div className="text-xs text-muted-foreground">
                              Lv {match.level} · {match.school}
                              {match.concentration ? " · Concentrazione" : ""}{match.ritual ? " · Rituale" : ""}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground line-clamp-1">{feature.description}</div>
                          )}
                        </div>
                        {feature.uses && (
                          <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                            {feature.uses}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button size="sm" onClick={() => setAddSpellOpen(true)}>Aggiungi incantesimo</Button>
            </Card>

            {/* ===== INVENTARIO con CTA + Modale + Toggle Equip + Rimozione monete + Rimozione item/armi ===== */}
            <Card className="character-section">
              <div className="character-section-title">Inventario</div>

              {/* Monete */}
              <div className="mb-4 text-sm">
                <div className="font-semibold text-primary mb-2">Monete</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    ["MR", "cp"] as const,
                    ["MA", "sp"] as const,
                    ["ME", "ep"] as const,
                    ["MO", "gp"] as const,
                    ["MP", "pp"] as const,
                  ]).map(([label, key]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span>
                        {label}: {coins[key as keyof Coins]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex mt-3 gap-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      setMode("coins");
                      setCoinFlow("add");
                      setInvOpen(true);
                    }}
                  >
                    Aggiungi
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMode("coins");
                      setCoinFlow("remove");
                      setInvOpen(true);
                    }}
                  >
                    Rimuovi
                  </Button>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Armi (toggle + X) */}
              {characterData.equipment.attacks?.length > 0 && (
                <div className="space-y-2 mb-4">
                  <div className="font-semibold text-primary">Armi</div>
                  {characterData.equipment.attacks.map((atk, i) => (
                    <div key={`${atk.name}-${i}`} className="flex items-center justify-between text-sm dnd-frame p-2">
                      <div className="flex-1">
                        <div className="font-medium">
                          {atk.name} {atk.equipped ? "(equipaggiata)" : ""}
                        </div>
                        <div className="text-muted-foreground">
                          +{atk.attackBonus} • {atk.damageType}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {atk.name && atk.attackBonus !== undefined && atk.damageType && (
                          <Button
                            size="sm"
                            variant={atk.equipped ? "outline" : "default"}
                            onClick={() => toggleEquipAttack(i)}
                          >
                            {atk.equipped ? "Disequipaggia" : "Equipaggia"}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" aria-label="Rimuovi arma" onClick={() => removeAttack(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Oggetti semplici (X per rimuovere) */}
              <div>
                <div className="font-semibold text-primary">Oggetti</div>
                {characterData.equipment.equipment.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>• {item}</span>
                    <Button size="icon" variant="ghost" aria-label="Rimuovi oggetto" onClick={() => removeItem(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Modale riutilizzabile (inventario) */}
              <Dialog
                open={invOpen}
                onOpenChange={(v) => {
                  setInvOpen(v);
                  if (!v) resetInvForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { setCoinFlow("add"); }}>
                    Aggiungi
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {mode === "coins"
                        ? coinFlow === "add"
                          ? "Aggiungi monete"
                          : "Rimuovi monete"
                        : "Aggiungi oggetto"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Tipo</Label>
                      <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-2 gap-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="coins" id="r-coins" />
                          <Label htmlFor="r-coins">Monete</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="item" id="r-item" />
                          <Label htmlFor="r-item">Oggetto</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {mode === "coins" ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-3">
                          <Label className="mb-1 block">Taglio</Label>
                          <div className="grid grid-cols-5 gap-2">
                            {(["mr", "ma", "me", "mo", "mp"] as CoinAbbr[]).map((abbr) => (
                              <Button
                                key={abbr}
                                type="button"
                                variant={coinType === abbr ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCoinType(abbr)}
                              >
                                {abbr.toUpperCase()}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="col-span-3">
                          <Label className="mb-1 block">
                            Quantità {coinFlow === "remove" ? "da rimuovere" : "da aggiungere"}
                          </Label>
                          <Input
                            inputMode="numeric"
                            value={coinQty}
                            onChange={(e) => setCoinQty(e.target.value)}
                            placeholder="Es. 10"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label className="mb-1 block">Nome *</Label>
                          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Es. Spada lunga" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="mb-1 block">Bonus attacco</Label>
                            <Input
                              inputMode="numeric"
                              value={itemAtkBonus}
                              onChange={(e) => setItemAtkBonus(e.target.value)}
                              placeholder="Es. 5"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block">Tipo di danno</Label>
                            <Input
                              value={itemDmgType}
                              onChange={(e) => setItemDmgType(e.target.value)}
                              placeholder="Es. 1d8+3 tagliente"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {invError && <div className="text-sm text-red-600">{invError}</div>}
                  </div>

                  <DialogFooter className="mt-2">
                    <DialogClose asChild>
                      <Button variant="outline">Annulla</Button>
                    </DialogClose>
                    <Button onClick={handleInventorySubmit}>Salva</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>

            <Card className="character-section">
              <div className="character-section-title">Linguaggi</div>
              <div className="flex flex-wrap gap-1">
                {characterData.proficiencies.languages.map((language) => (
                  <Badge key={language} variant="outline">
                    {language}
                  </Badge>
                ))}
              </div>
            </Card>
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
            {/* Classe */}
            <div className="space-y-2">
              <Label>Classe</Label>
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

            {/* Ricerca per nome */}
            <div className="space-y-2">
              <Label>Cerca per nome</Label>
              <Input
                value={spellQuery}
                onChange={(e) => setSpellQuery(e.target.value)}
                placeholder="Es. Parola Guaritrice"
                disabled={!selectedClass}
              />
            </div>

            {/* Lista incantesimi */}
            <div className="space-y-2">
              <Label>Incantesimi</Label>
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

          {/* Se è uno spell, render completo; altrimenti testo del feature */}
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
