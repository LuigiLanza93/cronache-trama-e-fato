import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/components/auth-provider";
import { DND5E_ALIGNMENTS } from "@/lib/character-options";
import { createGuidedCharacterRequest, previewGuidedCharacterRequest, type GuidedCharacterPreview, type GuidedCharacterCreationPayload, type SpellEntry } from "@/lib/auth";
import { getPhbSpellDetails } from "@/lib/phb-spell-details";
import { getLevelOneCreationOptions, resolveLevelOneCreationPreview, validateLevelOneCreation } from "../../shared/character-creation-rules.mjs";

type Ability = keyof GuidedCharacterCreationPayload["creation"]["abilityScores"];
type Labeled = { it?: string; en?: string };
type CatalogEntry = {
  key: string;
  label?: Labeled;
  subraces?: Record<string, CatalogEntry>;
  abilityBonuses?: Partial<Record<Ability, number>>;
  languages?: string[];
  skillProficiencies?: string[];
  privilege?: { label?: Labeled; description?: string };
};
type ChoiceOption = string | { key: string; label?: Labeled | string; items?: string[] };
type ChoiceSlot = {
  id: string;
  owner?: string;
  label?: Labeled | string;
  kind: string;
  count: number | null;
  options: ChoiceOption[];
  excludedOptions?: string[];
  conflicts?: { name: string; sources: string[] }[];
  optionsSource?: { type: string };
};
type Catalog = {
  abilities: Ability[];
  pointBuy: { budget: number; costs: Record<number, number> };
  skills: Record<string, string>;
  languages: Record<string, string>;
  tools?: Record<string, string>;
  equipment?: Record<string, string>;
  feats?: Record<string, string>;
  races: Record<string, CatalogEntry>;
  classes: Record<string, CatalogEntry>;
  backgrounds: Record<string, CatalogEntry>;
  resolved?: { choiceSlots: ChoiceSlot[] } | null;
};

const ABILITY_LABELS: Record<Ability, string> = {
  strength: "Forza", dexterity: "Destrezza", constitution: "Costituzione",
  intelligence: "Intelligenza", wisdom: "Saggezza", charisma: "Carisma",
};
const ABILITIES = Object.keys(ABILITY_LABELS) as Ability[];
const INITIAL_SCORES = Object.fromEntries(ABILITIES.map((key) => [key, 8])) as GuidedCharacterCreationPayload["creation"]["abilityScores"];
const SLOT_LABELS: Record<string, string> = {
  skill: "Abilità", language: "Lingua", tool: "Strumento", ability: "Caratteristica da aumentare",
  subclass: "Privilegio di classe", equipment: "Equipaggiamento iniziale", cantrip: "Trucchetto",
  spell: "Incantesimo", preparedSpell: "Incantesimo preparato", feat: "Talento",
  equipmentItem: "Oggetto della dotazione", toolOrLanguage: "Strumento o lingua", skillOrTool: "Abilità o strumento", backgroundPrivilege: "Privilegio del background",
  expertise: "Competenza migliorata", fightingStyle: "Stile di combattimento",
  draconicAncestry: "Antenato draconico", favoredEnemy: "Nemico prescelto", favoredTerrain: "Terreno prescelto",
};
const CLASS_LABELS: Record<string, string> = {
  barbarian: "Barbaro", bard: "Bardo", cleric: "Chierico", druid: "Druido", fighter: "Guerriero",
  monk: "Monaco", paladin: "Paladino", ranger: "Ranger", rogue: "Ladro", sorcerer: "Stregone",
  warlock: "Warlock", wizard: "Mago",
};
const HUMANIZED: Record<string, string> = {
  black: "Nero", blue: "Blu", brass: "Ottone", bronze: "Bronzo", copper: "Rame", gold: "Oro",
  green: "Verde", red: "Rosso", silver: "Argento", white: "Bianco",
  archery: "Tiro con l'arco", defense: "Difesa", dueling: "Duellare",
  greatWeaponFighting: "Combattere con Armi Possenti", protection: "Protezione", twoWeaponFighting: "Combattere con Due Armi",
};
const labelOf = (value?: Labeled | string) => typeof value === "string" ? value : value?.it ?? value?.en ?? "";
const optionKey = (option: ChoiceOption) => typeof option === "string" ? option : option.key;
const readableKey = (value: string) => HUMANIZED[value] ?? value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_:]/g, " ");

function SpellChoiceDescription({ details }: { details: SpellEntry }) {
  const facts = [
    details.casting_time && `Tempo di lancio: ${details.casting_time}`,
    details.range && `Gittata: ${details.range}`,
    details.components && `Componenti: ${details.components}`,
    details.duration && `Durata: ${details.duration}`,
    details.saving_throw && `Tiro salvezza: ${details.saving_throw}`,
    details.damage && `Danni: ${details.damage}`,
    details.usage && `Uso: ${details.usage}`,
  ].filter(Boolean);
  return (
    <details className="border-t border-border/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer text-primary">Leggi dettagli</summary>
      <div className="space-y-2 pt-2">
        <p className="text-xs text-muted-foreground">
          {details.level === 0 ? "Trucchetto" : `Livello ${details.level}`}
          {details.school ? ` · ${details.school}` : ""}
          {details.concentration ? " · Concentrazione" : ""}
          {details.ritual ? " · Rituale" : ""}
        </p>
        {facts.length > 0 && <p className="whitespace-pre-line text-xs">{facts.join("\n")}</p>}
        {details.description && <p className="whitespace-pre-line">{details.description}</p>}
        {details.scaling && <p className="whitespace-pre-line text-xs text-muted-foreground">Ai livelli superiori: {details.scaling}</p>}
      </div>
    </details>
  );
}

export default function GuidedCharacter({ onChoosePng }: { onChoosePng: () => void }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [alignment, setAlignment] = useState("");
  const [raceKey, setRaceKey] = useState("");
  const [subraceKey, setSubraceKey] = useState("");
  const [classKey, setClassKey] = useState("");
  const [backgroundKey, setBackgroundKey] = useState("");
  const [customBackground, setCustomBackground] = useState({ name: "", featureBackgroundKey: "", equipmentBackgroundKey: "" });
  const [abilityScores, setAbilityScores] = useState({ ...INITIAL_SCORES });
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [optionSearch, setOptionSearch] = useState<Record<string, string>>({});
  const [narrative, setNarrative] = useState<GuidedCharacterCreationPayload["creation"]["narrative"]>({ personalityTraits: ["", ""], ideal: "", bond: "", flaw: "" });
  const [saving, setSaving] = useState(false);
  const [serverPreview, setServerPreview] = useState<GuidedCharacterPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const pendingRequest = useRef<{ signature: string; id: string } | null>(null);
  const creation = useMemo(() => ({ raceKey, ...(subraceKey ? { subraceKey } : {}), classKey, backgroundKey, ...(backgroundKey === "custom" ? { customBackground } : {}), abilityScores, selections, narrative }), [raceKey, subraceKey, classKey, backgroundKey, customBackground, abilityScores, selections, narrative]);
  const catalog = useMemo(() => getLevelOneCreationOptions(creation) as Catalog, [creation]);
  const race = catalog.races[raceKey];
  const subrace = race?.subraces?.[subraceKey];
  const draft = useMemo(() => resolveLevelOneCreationPreview(creation), [creation]);
  const background = (draft.resolved?.background as CatalogEntry | undefined) ?? catalog.backgrounds[backgroundKey];
  const slots = catalog.resolved?.choiceSlots ?? [];
  const validation = useMemo(() => validateLevelOneCreation(creation), [creation]);
  const spent = ABILITIES.reduce((total, key) => total + (catalog.pointBuy.costs[abilityScores[key]] ?? 0), 0);
  const abilityResolution = draft.resolved?.abilities as { racialBonuses: Record<Ability, number>; final: Record<Ability, number> } | undefined;
  const resolvedProficiencies = validation.resolved?.proficiencies as { skills: string[]; languages: string[]; tools: string[] } | undefined;
  const previewBonuses = ABILITIES.reduce((out, key) => {
    out[key] = (race?.abilityBonuses?.[key] ?? 0) + (subrace?.abilityBonuses?.[key] ?? 0);
    if (selections["race:half-elf:abilities"]?.includes(key) || selections["race:variant-human:abilities"]?.includes(key)) out[key] += 1;
    return out;
  }, {} as Record<Ability, number>);
  const racialBonuses = abilityResolution?.racialBonuses ?? previewBonuses;
  const resolvedScores = abilityResolution?.final ?? ABILITIES.reduce((out, key) => { out[key] = abilityScores[key] + racialBonuses[key]; return out; }, {} as Record<Ability, number>);

  useEffect(() => { document.title = "Crea PG guidato | Cronache della Trama e del Fato"; }, []);
  useEffect(() => { setSubraceKey(""); setSelections({}); }, [raceKey]);
  useEffect(() => { setSelections((old) => Object.fromEntries(Object.entries(old).filter(([id]) => !id.startsWith("class:") && !id.startsWith("replacement:")))); }, [classKey]);
  useEffect(() => { setSelections((old) => Object.fromEntries(Object.entries(old).filter(([id]) => !id.startsWith("background:") && !id.startsWith("replacement:")))); }, [backgroundKey]);
  useEffect(() => { setSelections((old) => Object.fromEntries(Object.entries(old).filter(([id]) => (!id.startsWith("race:") || !id.includes(":high:")) && !id.startsWith("replacement:")))); }, [subraceKey]);
  useEffect(() => { setSelections((old) => Object.fromEntries(Object.entries(old).filter(([id]) => !id.startsWith("background:custom:") && !id.startsWith("replacement:")))); }, [customBackground.featureBackgroundKey, customBackground.equipmentBackgroundKey]);
  useEffect(() => {
    if (step !== 4 || !validation.ok) { setServerPreview(null); return; }
    let active = true;
    setServerPreview(null); setPreviewError(""); setPreviewLoading(true);
    previewGuidedCharacterRequest({ name: name.trim(), alignment, creation })
      .then(result => { if (active) setServerPreview(result); })
      .catch(error => { if (active) setPreviewError(error instanceof Error ? error.message : "Impossibile verificare il riepilogo."); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [step, name, alignment, creation, validation.ok]);

  const selectionCount = (slot: ChoiceSlot) => {
    if (slot.count !== null) return slot.count;
    if (slot.kind === "preparedSpell") {
      const ability = classKey === "wizard" ? "intelligence" : "wisdom";
      return Math.max(1, Math.floor((resolvedScores[ability] - 10) / 2) + 1);
    }
    return 0;
  };
  const optionLabel = (slot: ChoiceSlot, option: ChoiceOption) => {
    const key = optionKey(option);
    if (typeof option !== "string" && option.items) return option.items.map((item) => catalog.equipment?.[item] ?? readableKey(item)).join(" + ");
    if (typeof option !== "string" && option.label) return labelOf(option.label);
    return catalog.skills[key] ?? catalog.languages[key] ?? catalog.tools?.[key] ?? catalog.feats?.[key] ?? ABILITY_LABELS[key as Ability] ?? HUMANIZED[key] ?? readableKey(key);
  };
  const setChoice = (slot: ChoiceSlot, key: string) => {
    const max = selectionCount(slot);
    setSelections((current) => {
      const base = slot.kind === "equipment"
        ? Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith(`${slot.id}:detail:`)))
        : slot.kind === "feat"
          ? Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith("feat:")))
          : slot.kind === "spellClass"
            ? Object.fromEntries(Object.entries(current).filter(([id]) => id === slot.id || !id.startsWith(slot.id.split(":").slice(0, 2).join(":") + ":")))
            : slot.id === "class:cleric:domain"
              ? Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith("class:cleric:knowledge:") && !id.startsWith("class:cleric:nature:")))
              : slot.id === "class:sorcerer:origin"
                ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== "class:sorcerer:dragon-ancestor"))
                : slot.id === "class:warlock:patron"
                  ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== "class:warlock:spells"))
                : slot.id === "class:ranger:enemy"
                  ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== "class:ranger:humanoid-races" && id !== "class:ranger:enemy-language"))
            : current;
      const previous = current[slot.id] ?? [];
      if (max === 1) return { ...base, [slot.id]: [key] };
      const next = previous.includes(key) ? previous.filter((value) => value !== key) : [...previous, key].slice(-max);
      return { ...base, [slot.id]: next };
    });
  };
  const availableOptions = (slot: ChoiceSlot) => slot.options.filter((option) => !slot.excludedOptions?.includes(optionKey(option)));
  const visibleOptions = (slot: ChoiceSlot) => {
    const query = (optionSearch[slot.id] ?? "").trim().toLocaleLowerCase("it");
    return availableOptions(slot).filter((option) => !query || optionLabel(slot, option).toLocaleLowerCase("it").includes(query) || (selections[slot.id] ?? []).includes(optionKey(option)));
  };
  const slotIsComplete = (slot: ChoiceSlot) => slot.count === null || (selections[slot.id] ?? []).length === selectionCount(slot);
  const replacementExplanation = (slot: ChoiceSlot) => {
    const conflicts = slot.conflicts?.map(({ name, sources }) => `${sources.join(" e ")} concedono entrambi ${name}`).join("; ");
    const kind = slot.kind === "skill" ? "un'altra abilità" : "un altro strumento";
    return `${conflicts ? `${conflicts}. ` : ""}Il manuale permette di scegliere ${kind} dello stesso tipo al suo posto.`;
  };
  const identityReady = Boolean(name.trim() && alignment && raceKey && classKey && (!race?.subraces || subraceKey));
  const abilitiesReady = spent === catalog.pointBuy.budget;
  const choiceIssues = validation.issues.filter((issue) => !issue.path.startsWith("narrative"));
  const choicesReady = Boolean(backgroundKey && slots.every(slotIsComplete) && choiceIssues.length === 0);
  const narrativeReady = narrative.personalityTraits.every((value) => value.trim()) && narrative.ideal.trim() && narrative.bond.trim() && narrative.flaw.trim();
  const canAdvance = step === 0 ? identityReady : step === 1 ? abilitiesReady : step === 2 ? choicesReady : step === 3 ? Boolean(narrativeReady && validation.ok) : true;
  const steps = ["Identità e origini", "Caratteristiche", "Background e scelte", "Personalità", "Riepilogo"];

  const submit = async () => {
    const checked = validateLevelOneCreation(creation);
    if (!checked.ok) {
      toast.error(checked.issues[0]?.message ?? "Completa tutte le scelte richieste.");
      setStep(checked.issues[0]?.path.startsWith("narrative") ? 3 : 2);
      return;
    }
    setSaving(true);
    try {
      const signature = JSON.stringify({ name: name.trim(), alignment, creation });
      if (pendingRequest.current?.signature !== signature) pendingRequest.current = { signature, id: crypto.randomUUID() };
      if (!serverPreview?.ok || !serverPreview.ruleEvent?.previewHash) throw new Error("Attendi la verifica del riepilogo prima di creare il PG.");
      const result = await createGuidedCharacterRequest({ requestId: pendingRequest.current.id, previewHash: serverPreview.ruleEvent.previewHash, name: name.trim(), alignment, creation });
      await refresh();
      toast.success("PG di livello 1 creato con tutte le scelte guidate.");
      navigate(`/${result.slug}`);
    } catch (error) {
      const details = (error as { details?: Array<{ message?: string }> })?.details;
      toast.error(details?.[0]?.message ?? (error instanceof Error ? error.message : "Impossibile creare il PG."));
    } finally {
      setSaving(false);
    }
  };

  return <div className="min-h-screen parchment px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" asChild><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Torna alla home</Link></Button>{user?.role === "dm" && <Button type="button" variant="outline" onClick={onChoosePng}>Crea un PNG</Button>}</div>
    <Card className="character-section"><h1 className="font-heading text-3xl font-bold text-primary">Crea PG di livello 1</h1><p className="mt-3 text-muted-foreground">Segui le regole del Manuale del Giocatore 5.0. I 27 punti vengono spesi prima dei bonus razziali; tutte le scelte vengono controllate prima del salvataggio.</p></Card>
    <nav aria-label="Passaggi di creazione" className="grid grid-cols-2 gap-2 sm:grid-cols-5">{steps.map((title, index) => <button key={title} type="button" disabled={index > step} onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`rounded-lg border p-3 text-left text-sm ${step === index ? "border-primary bg-primary/10 font-semibold" : "border-border bg-background/60"}`}>{index + 1}. {title}</button>)}</nav>
    <Card className="character-section space-y-6">
      {step === 0 && <><h2 className="font-heading text-xl font-semibold">Identità, razza e classe</h2><div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="pg-name">Nome del personaggio</Label><Input id="pg-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></div>
        <SelectField id="pg-alignment" label="Allineamento" value={alignment} onChange={setAlignment} options={DND5E_ALIGNMENTS.map((value) => ({ value, label: value }))} />
        <SelectField id="pg-race" label="Razza" value={raceKey} onChange={setRaceKey} options={Object.entries(catalog.races).map(([key, value]) => ({ value: key, label: labelOf(value.label) }))} />
        {race?.subraces && <SelectField id="pg-subrace" label="Sottorazza" value={subraceKey} onChange={setSubraceKey} options={Object.entries(race.subraces).map(([key, value]) => ({ value: key, label: labelOf(value.label) }))} />}
        <SelectField id="pg-class" label="Classe iniziale" value={classKey} onChange={setClassKey} options={Object.keys(catalog.classes).map((key) => ({ value: key, label: CLASS_LABELS[key] ?? readableKey(key) }))} />
      </div>{race && <p className="rounded-lg bg-background/60 p-3 text-sm">{labelOf(race.label)}{subrace ? ` · ${labelOf(subrace.label)}` : ""} · Lingue automatiche: {(race.languages ?? []).map((key) => catalog.languages[key] ?? key).join(", ") || "nessuna"}</p>}</>}
      {step === 1 && <><h2 className="font-heading text-xl font-semibold">Punteggi di caratteristica</h2><p className="text-sm text-muted-foreground">Costo in punti del manuale: 8→0, 9→1, 10→2, 11→3, 12→4, 13→5, 14→7, 15→9. Spendi esattamente 27 punti.</p><p className={`font-semibold ${spent === 27 ? "text-green-700" : "text-primary"}`} aria-live="polite">Punti spesi: {spent} / 27</p><div className="grid gap-3 sm:grid-cols-2">{ABILITIES.map((key) => <div key={key} className="flex items-center justify-between rounded-lg border bg-background/60 p-3"><div><p className="font-medium">{ABILITY_LABELS[key]}</p><p className="text-xs text-muted-foreground">Base {abilityScores[key]} · razza +{racialBonuses[key]} · finale {resolvedScores[key]}</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" aria-label={`Riduci ${ABILITY_LABELS[key]}`} disabled={abilityScores[key] <= 8} onClick={() => setAbilityScores((old) => ({ ...old, [key]: old[key] - 1 }))}>−</Button><span className="w-5 text-center">{abilityScores[key]}</span><Button type="button" size="sm" variant="outline" aria-label={`Aumenta ${ABILITY_LABELS[key]}`} disabled={abilityScores[key] >= 15 || spent + (catalog.pointBuy.costs[abilityScores[key] + 1] - catalog.pointBuy.costs[abilityScores[key]]) > 27} onClick={() => setAbilityScores((old) => ({ ...old, [key]: old[key] + 1 }))}>+</Button></div></div>)}</div></>}
      {step === 2 && <><h2 className="font-heading text-xl font-semibold">Background e scelte</h2><SelectField id="pg-background" label="Background" value={backgroundKey} onChange={setBackgroundKey} options={[...Object.entries(catalog.backgrounds).map(([key, value]) => ({ value: key, label: labelOf(value.label) })), { value: "custom", label: "Background personalizzato" }]} />{backgroundKey === "custom" && <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><p className="text-sm text-muted-foreground sm:col-span-2">Scegli due abilità e un totale di due strumenti o lingue. Privilegio e dotazione provengono dai background del manuale; un privilegio inventato richiede accordo con il DM.</p><div className="space-y-2"><Label htmlFor="custom-background-name">Nome del background</Label><Input id="custom-background-name" maxLength={120} value={customBackground.name} onChange={event => setCustomBackground(old => ({ ...old, name: event.target.value }))} /></div><SelectField id="custom-background-feature" label="Privilegio da" value={customBackground.featureBackgroundKey} onChange={value => setCustomBackground(old => ({ ...old, featureBackgroundKey: value }))} options={Object.entries(catalog.backgrounds).map(([key, value]) => ({ value: key, label: labelOf(value.label) }))} /><SelectField id="custom-background-equipment" label="Dotazione da" value={customBackground.equipmentBackgroundKey} onChange={value => setCustomBackground(old => ({ ...old, equipmentBackgroundKey: value }))} options={Object.entries(catalog.backgrounds).map(([key, value]) => ({ value: key, label: labelOf(value.label) }))} /></div>}{background && <div className="rounded-lg bg-background/60 p-3 text-sm"><strong>Privilegio:</strong> {labelOf(background.privilege?.label) || "—"}{background.privilege?.description && <details className="my-2"><summary className="cursor-pointer text-primary">Leggi il privilegio completo</summary><p className="mt-2 whitespace-pre-line">{background.privilege.description}</p></details>}<br /><strong>Abilità automatiche:</strong> {(background.skillProficiencies ?? []).map((key) => catalog.skills[key] ?? key).join(", ") || "nessuna"}</div>}
        {background && <div className="space-y-5">{slots.map((slot) => <fieldset key={slot.id} className="rounded-lg border bg-background/50 p-4"><legend className="px-1 font-medium">{labelOf(slot.label) || SLOT_LABELS[slot.kind] || readableKey(slot.kind)} · {selectionCount(slot)} scelta/e</legend><p className="mb-3 text-xs text-muted-foreground">{slot.owner === "race" ? "Razza" : slot.owner === "subrace" ? "Sottorazza" : slot.owner === "background" ? "Background" : slot.owner === "replacement" ? "Competenza alternativa" : "Classe"} · {(selections[slot.id] ?? []).length}/{selectionCount(slot)}</p>{slot.owner === "replacement" && <p className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">{replacementExplanation(slot)}</p>}{availableOptions(slot).length > 24 && <div className="mb-3 space-y-1"><Label htmlFor={`search-${slot.id}`}>Cerca un'opzione</Label><Input id={`search-${slot.id}`} type="search" value={optionSearch[slot.id] ?? ""} onChange={(event) => setOptionSearch((old) => ({ ...old, [slot.id]: event.target.value }))} placeholder="Nome dell'opzione" /></div>}<div className="grid gap-2 sm:grid-cols-2">{visibleOptions(slot).map((option) => { const key = optionKey(option); const selected = (selections[slot.id] ?? []).includes(key); return <div key={key} className={`rounded-md border ${selected ? "border-primary bg-primary/10" : "border-border"}`}><label className="flex cursor-pointer items-center gap-2 p-2 text-sm"><input type={selectionCount(slot) === 1 ? "radio" : "checkbox"} name={slot.id} checked={selected} onChange={() => setChoice(slot, key)} /><span>{optionLabel(slot, option)}</span></label>{["cantrip", "spell", "preparedSpell"].includes(slot.kind) && (getPhbSpellDetails(key) ? <SpellChoiceDescription details={getPhbSpellDetails(key)!} /> : <p className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">Dettagli non disponibili per questo incantesimo.</p>)}</div>; })}</div>{visibleOptions(slot).length === 0 && <p className="text-sm text-muted-foreground">{availableOptions(slot).length === 0 ? "Opzioni non disponibili nel catalogo: questa scelta non può essere completata." : "Nessuna opzione corrisponde alla ricerca."}</p>}</fieldset>)}{slots.every(slotIsComplete) && choiceIssues.length > 0 && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{choiceIssues.slice(0, 4).map((issue, index) => <p key={`${issue.path}-${index}`}>{issue.message}</p>)}</div>}</div>}</>}
      {step === 3 && <><div className="space-y-2"><Label htmlFor="background-details">Origine e dettagli del background (facoltativo)</Label><Textarea id="background-details" maxLength={500} value={narrative.backgroundDetails ?? ""} onChange={event => setNarrative(old => ({ ...old, backgroundDetails: event.target.value }))} placeholder="Fede, gilda, specializzazione, rango, contatti o identità: descrivi ciò che conta per il personaggio." /></div><h2 className="font-heading text-xl font-semibold">Personalità</h2><p className="text-sm text-muted-foreground">Scrivi due tratti della personalità, un ideale, un legame e un difetto. Puoi ispirarti alle tabelle del background nel manuale.</p><div className="grid gap-4 sm:grid-cols-2">{([0, 1] as const).map((index) => <div key={index} className="space-y-2"><Label htmlFor={`trait-${index}`}>Tratto della personalità {index + 1}</Label><Input id={`trait-${index}`} maxLength={500} value={narrative.personalityTraits[index]} onChange={(event) => setNarrative((old) => ({ ...old, personalityTraits: old.personalityTraits.map((value, item) => item === index ? event.target.value : value) as [string, string] }))} /></div>)}{(["ideal", "bond", "flaw"] as const).map((key) => <div key={key} className="space-y-2"><Label htmlFor={`narrative-${key}`}>{key === "ideal" ? "Ideale" : key === "bond" ? "Legame" : "Difetto"}</Label><Input id={`narrative-${key}`} maxLength={500} value={narrative[key]} onChange={(event) => setNarrative((old) => ({ ...old, [key]: event.target.value }))} /></div>)}</div></>}
      {step === 4 && <><h2 className="font-heading text-xl font-semibold">Riepilogo</h2><p role="status" className="text-sm">{previewLoading ? "Verifico tutte le scelte prima della creazione..." : serverPreview?.ok ? "Scelte verificate. Puoi creare il personaggio." : previewError || serverPreview?.issues?.[0]?.message || "Riepilogo in attesa di verifica."}</p><div className="grid gap-3 text-sm sm:grid-cols-2"><p><strong>Personaggio:</strong> {name}</p><p><strong>Allineamento:</strong> {alignment}</p><p><strong>Razza:</strong> {labelOf(race?.label)} {labelOf(subrace?.label)}</p><p><strong>Classe:</strong> {CLASS_LABELS[classKey]}</p><p><strong>Background:</strong> {labelOf(background?.label)}</p><p><strong>Privilegio del background:</strong> {labelOf(background?.privilege?.label)}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ABILITIES.map((key) => <p key={key} className="rounded-lg bg-background/60 p-3 text-sm"><strong>{ABILITY_LABELS[key]}</strong> {resolvedScores[key]} <span className="text-muted-foreground">({abilityScores[key]} + {racialBonuses[key]})</span></p>)}</div><div className="rounded-lg border bg-background/60 p-4 text-sm"><h3 className="font-semibold">Competenze e lingue finali</h3><p className="mt-2"><strong>Abilità:</strong> {resolvedProficiencies?.skills.map((key) => catalog.skills[key] ?? key).join(", ") || "nessuna"}</p><p className="mt-1"><strong>Lingue:</strong> {resolvedProficiencies?.languages.map((key) => catalog.languages[key] ?? key).join(", ") || "nessuna"}</p><p className="mt-1"><strong>Strumenti:</strong> {resolvedProficiencies?.tools.map((key) => catalog.tools?.[key] ?? readableKey(key)).join(", ") || "nessuno"}</p></div><div className="space-y-2"><h3 className="font-semibold">Scelte effettuate</h3>{slots.map((slot) => <p key={slot.id} className="rounded-lg border bg-background/60 p-3 text-sm"><strong>{labelOf(slot.label) || SLOT_LABELS[slot.kind] || readableKey(slot.kind)}:</strong> {(selections[slot.id] ?? []).map((key) => optionLabel(slot, slot.options.find((option) => optionKey(option) === key) ?? key)).join(", ") || "—"}</p>)}</div></>}
      <div className="flex flex-wrap justify-between gap-3 border-t pt-5"><Button type="button" variant="outline" disabled={step === 0 || saving} onClick={() => setStep((old) => old - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Indietro</Button>{step < 4 ? <Button type="button" disabled={!canAdvance} onClick={() => setStep((old) => old + 1)}>Continua<ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button type="button" disabled={saving || previewLoading || !serverPreview?.ok || !serverPreview.ruleEvent?.previewHash} onClick={submit}><Sparkles className="mr-2 h-4 w-4" />{saving ? "Creo il PG..." : "Crea PG"}</Button>}</div>
    </Card>
  </div></div>;
}

function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><select id={id} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Seleziona...</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
