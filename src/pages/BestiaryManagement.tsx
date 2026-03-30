import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, Plus, Save, ScrollText, Sparkles, WandSparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMonsterRequest, fetchMonster, fetchMonsters, updateMonsterRequest, type MonsterEntry, type MonsterSummary } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

const ABILITIES = [
  ["strength", "FOR"],
  ["dexterity", "DES"],
  ["constitution", "COS"],
  ["intelligence", "INT"],
  ["wisdom", "SAG"],
  ["charisma", "CAR"],
] as const;

const SPEED_KEYS = ["walk", "fly", "swim", "climb", "burrow"] as const;
const SPEED_LABELS: Record<string, string> = { walk: "Camminare", fly: "Volare", swim: "Nuotare", climb: "Scalare", burrow: "Scavare" };

function cloneMonster(monster: MonsterEntry) {
  return structuredClone(monster);
}

function crLabel(challengeRating: { display: string; fraction: string }) {
  return challengeRating.display || challengeRating.fraction || "-";
}

function speedSummary(speed: Record<string, string>) {
  return SPEED_KEYS.filter((key) => speed[key]).map((key) => `${SPEED_LABELS[key]}: ${speed[key]}`).join(" · ");
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function listToText(items: string[]) {
  return items.join("\n");
}

function textToList(value: string) {
  return value.split("\n").map((entry) => entry.trim()).filter(Boolean);
}

function bonusListToText(items: Array<{ ability?: string; name?: string; bonus: number }>) {
  return items.map((item) => `${item.ability ?? item.name ?? ""}|${item.bonus}`).join("\n");
}

function textToBonusList(value: string, key: "ability" | "name") {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, bonus] = line.split("|");
    return { [key]: (label ?? "").trim(), bonus: Number((bonus ?? "0").trim()) };
  });
}

function taggedListToText(items: Array<{ name: string; value?: string }>) {
  return items.map((item) => `${item.name}|${item.value ?? ""}`).join("\n");
}

function textToTaggedList(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, taggedValue] = line.split("|");
    return { name: (name ?? "").trim(), value: (taggedValue ?? "").trim() || undefined };
  });
}

function featuresToText(items: Array<{ name: string; usage: string | null; description: string }>) {
  return items.map((item) => `${item.name}|${item.usage ?? ""}|${item.description}`).join("\n\n");
}

function textToFeatures(value: string) {
  return value.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean).map((chunk) => {
    const [name, usage, ...rest] = chunk.split("|");
    return { name: (name ?? "").trim(), usage: (usage ?? "").trim() || null, description: rest.join("|").trim() };
  });
}

function legendaryToText(legendary: MonsterEntry["legendaryActions"]) {
  const intro = legendary.description ? `# ${legendary.description}` : "";
  const actions = legendary.actions.map((item) => `${item.name}|${item.cost}|${item.description}`);
  return [intro, ...actions].filter(Boolean).join("\n\n");
}

function textToLegendary(value: string) {
  const blocks = value.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
  const descriptionBlock = blocks.find((block) => block.startsWith("# "));
  const actionBlocks = blocks.filter((block) => !block.startsWith("# "));
  return {
    description: descriptionBlock ? descriptionBlock.slice(2).trim() : "",
    actions: actionBlocks.map((block) => {
      const [name, cost, ...rest] = block.split("|");
      return { name: (name ?? "").trim(), cost: Number((cost ?? "1").trim()), description: rest.join("|").trim() };
    }),
  };
}

function summaryFromMonster(monster: MonsterEntry): MonsterSummary {
  return {
    id: monster.id,
    slug: monster.slug,
    name: monster.general.name,
    challengeRating: monster.general.challengeRating,
    size: monster.general.size,
    creatureType: monster.general.creatureType || monster.general.typeLabel,
    alignment: monster.general.alignment,
    filePath: monster.filePath,
  };
}

export default function BestiaryManagement() {
  const [monsters, setMonsters] = useState<MonsterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ name: "", challenge: "__all__", size: "__all__", creatureType: "__all__", alignment: "__all__" });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [selectedMonster, setSelectedMonster] = useState<MonsterEntry | null>(null);
  const [draftMonster, setDraftMonster] = useState<MonsterEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "duplicate">("blank");
  const [newMonsterName, setNewMonsterName] = useState("");
  const [duplicateFromId, setDuplicateFromId] = useState("");

  useEffect(() => {
    document.title = "Gestione Bestiario | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;
    void fetchMonsters().then((items) => {
      if (active) setMonsters(items);
    }).catch(() => {
      if (active) toast.error("Non sono riuscito a caricare il bestiario.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const filterOptions = useMemo(() => ({
    challenges: Array.from(new Set(monsters.map((monster) => crLabel(monster.challengeRating)).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    sizes: Array.from(new Set(monsters.map((monster) => monster.size).filter(Boolean))).sort(),
    types: Array.from(new Set(monsters.map((monster) => monster.creatureType).filter(Boolean))).sort(),
    alignments: Array.from(new Set(monsters.map((monster) => monster.alignment).filter(Boolean))).sort(),
  }), [monsters]);

  const filteredMonsters = useMemo(() => monsters.filter((monster) => {
    const nameMatch = !filters.name || monster.name.toLowerCase().includes(filters.name.toLowerCase()) || monster.slug.toLowerCase().includes(filters.name.toLowerCase());
    const challengeMatch = filters.challenge === "__all__" || crLabel(monster.challengeRating) === filters.challenge;
    const sizeMatch = filters.size === "__all__" || monster.size === filters.size;
    const typeMatch = filters.creatureType === "__all__" || monster.creatureType === filters.creatureType;
    const alignmentMatch = filters.alignment === "__all__" || monster.alignment === filters.alignment;
    return nameMatch && challengeMatch && sizeMatch && typeMatch && alignmentMatch;
  }), [filters, monsters]);

  const monster = editing ? draftMonster : selectedMonster;

  const openMonster = async (monsterId: string) => {
    setSelectedMonsterId(monsterId);
    setDetailOpen(true);
    setDetailLoading(true);
    setEditing(false);
    try {
      const nextMonster = await fetchMonster(monsterId);
      setSelectedMonster(nextMonster);
      setDraftMonster(cloneMonster(nextMonster));
    } catch {
      toast.error("Non sono riuscito ad aprire il mostro.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveMonster = async () => {
    if (!selectedMonsterId || !draftMonster) return;
    setSaving(true);
    try {
      const savedMonster = await updateMonsterRequest(selectedMonsterId, draftMonster);
      setSelectedMonster(savedMonster);
      setDraftMonster(cloneMonster(savedMonster));
      setMonsters((prev) => prev.map((entry) => (entry.id === savedMonster.id ? summaryFromMonster(savedMonster) : entry)).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
      setEditing(false);
      toast.success(`${savedMonster.general.name} salvato.`);
    } catch {
      toast.error("Non sono riuscito a salvare il mostro.");
    } finally {
      setSaving(false);
    }
  };

  const createMonster = async () => {
    if (!newMonsterName.trim()) return;
    if (createMode === "duplicate" && !duplicateFromId) {
      toast.error("Scegli il mostro da duplicare.");
      return;
    }
    try {
      const createdMonster = await createMonsterRequest({ name: newMonsterName.trim(), duplicateFromId: createMode === "duplicate" ? duplicateFromId : null });
      setMonsters((prev) => [...prev, summaryFromMonster(createdMonster)].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
      setCreateOpen(false);
      setCreateMode("blank");
      setNewMonsterName("");
      setDuplicateFromId("");
      toast.success(`${createdMonster.general.name} creato.`);
      await openMonster(createdMonster.id);
      setEditing(true);
    } catch {
      toast.error("Non sono riuscito a creare il mostro.");
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" asChild className="w-fit"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Torna alla home</Link></Button>
          <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Aggiungi mostro</Button>
        </div>

        <section className="dnd-frame p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-heading text-4xl font-bold text-primary">Gestione Bestiario</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">Filtri rapidi, dettaglio da combattimento, modifica opzionale e creazione di nuove varianti.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Card className="min-w-36 border-primary/15 bg-background/80 px-4 py-3"><div className="flex items-center gap-3"><ScrollText className="h-4 w-4 text-primary" /><div><div className="text-xs uppercase tracking-wide text-muted-foreground">Mostri</div><div className="text-lg font-semibold text-foreground">{monsters.length}</div></div></div></Card>
              <Card className="min-w-36 border-primary/15 bg-background/80 px-4 py-3"><div className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-primary" /><div><div className="text-xs uppercase tracking-wide text-muted-foreground">Filtrati</div><div className="text-lg font-semibold text-foreground">{filteredMonsters.length}</div></div></div></Card>
            </div>
          </div>
        </section>

        <Card className="character-section">
          <div className="grid gap-4 lg:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))]">
            <div className="space-y-2"><Label htmlFor="monster-filter-name">Mostro</Label><Input id="monster-filter-name" value={filters.name} onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))} placeholder="Cerca per nome o slug" /></div>
            <div className="space-y-2"><Label>GS</Label><Select value={filters.challenge} onValueChange={(value) => setFilters((prev) => ({ ...prev, challenge: value }))}><SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{filterOptions.challenges.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Taglia</Label><Select value={filters.size} onValueChange={(value) => setFilters((prev) => ({ ...prev, size: value }))}><SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutte</SelectItem>{filterOptions.sizes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tipo</Label><Select value={filters.creatureType} onValueChange={(value) => setFilters((prev) => ({ ...prev, creatureType: value }))}><SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{filterOptions.types.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Allineamento</Label><Select value={filters.alignment} onValueChange={(value) => setFilters((prev) => ({ ...prev, alignment: value }))}><SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{filterOptions.alignments.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </Card>

        <section className="space-y-3">
          {loading ? <Card className="character-section"><div className="text-sm text-muted-foreground">Carico il bestiario...</div></Card> : filteredMonsters.length === 0 ? <Card className="character-section"><div className="text-sm text-muted-foreground">Nessun mostro corrisponde ai filtri attivi.</div></Card> : filteredMonsters.map((entry) => <Card key={entry.id} className="character-section"><div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_90px_120px_minmax(0,1.2fr)_minmax(0,1.2fr)_64px] lg:items-center"><div className="min-w-0"><div className="font-heading text-2xl font-semibold text-primary">{entry.name}</div><div className="mt-1 text-xs text-muted-foreground">{entry.filePath}</div></div><div className="text-sm text-foreground">GS {crLabel(entry.challengeRating)}</div><div className="text-sm text-foreground">{entry.size || "-"}</div><div className="text-sm text-foreground">{entry.creatureType || "-"}</div><div className="text-sm text-foreground">{entry.alignment || "-"}</div><div className="flex justify-end"><Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => void openMonster(entry.id)}><Eye className="h-4 w-4" /></Button></div></div></Card>)}
        </section>
      </div>
      <Dialog open={detailOpen} onOpenChange={(open) => {
        setDetailOpen(open);
        if (!open) {
          setSelectedMonsterId(null);
          setSelectedMonster(null);
          setDraftMonster(null);
          setEditing(false);
        }
      }}>
        <DialogContent className="max-w-6xl border-primary/20 bg-card/95 p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <DialogTitle className="font-heading text-3xl text-primary">{monster?.general.name || "Dettaglio mostro"}</DialogTitle>
                <DialogDescription>Vista rapida da combattimento e scheda modificabile.</DialogDescription>
                {monster ? <div className="flex flex-wrap gap-2"><Badge variant="outline">GS {crLabel(monster.general.challengeRating)}</Badge><Badge variant="outline">{monster.general.size || "Taglia?"}</Badge><Badge variant="outline">{monster.general.typeLabel || monster.general.creatureType || "Tipo?"}</Badge><Badge variant="outline">{monster.general.alignment || "Allineamento?"}</Badge></div> : null}
              </div>
              {monster ? <div className="flex flex-wrap gap-2">{editing ? <><Button variant="outline" onClick={() => { setDraftMonster(selectedMonster ? cloneMonster(selectedMonster) : null); setEditing(false); }}>Annulla</Button><Button onClick={() => void saveMonster()} disabled={saving}><Save className="mr-2 h-4 w-4" />Salva</Button></> : <Button variant="outline" onClick={() => setEditing(true)}><WandSparkles className="mr-2 h-4 w-4" />Abilita modifica</Button>}</div> : null}
            </div>
          </DialogHeader>

          {detailLoading || !monster ? <div className="px-6 py-8 text-sm text-muted-foreground">Carico il dettaglio del mostro...</div> : <ScrollArea className="max-h-[78vh]"><div className="space-y-8 px-6 py-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-primary/15 bg-background/70 p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Classe Armatura</div><div className="mt-2 text-3xl font-semibold text-foreground">{monster.combat.armorClass.value || "-"}</div><div className="mt-1 text-sm text-muted-foreground">{monster.combat.armorClass.note || "-"}</div></Card>
              <Card className="border-primary/15 bg-background/70 p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Punti Ferita</div><div className="mt-2 text-3xl font-semibold text-foreground">{monster.combat.hitPoints.average || "-"}</div><div className="mt-1 text-sm text-muted-foreground">{monster.combat.hitPoints.formula || "-"}</div></Card>
              <Card className="border-primary/15 bg-background/70 p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Velocità</div><div className="mt-2 text-sm leading-relaxed text-foreground">{speedSummary(monster.combat.speed) || "-"}</div></Card>
              <Card className="border-primary/15 bg-background/70 p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Competenza</div><div className="mt-2 text-3xl font-semibold text-foreground">{monster.details.proficiencyBonus >= 0 ? `+${monster.details.proficiencyBonus}` : monster.details.proficiencyBonus}</div><div className="mt-1 text-sm text-muted-foreground">PE {monster.general.challengeRating.xp.toLocaleString("it-IT")}</div></Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Informazioni generali</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="space-y-2"><Label>Nome</Label><Input value={monster.general.name} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, name: event.target.value } })} /></div><div className="space-y-2"><Label>GS</Label><Input value={monster.general.challengeRating.display} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, challengeRating: { ...draftMonster.general.challengeRating, display: event.target.value, fraction: event.target.value } } })} /></div><div className="space-y-2"><Label>PE</Label><Input type="number" value={monster.general.challengeRating.xp} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, challengeRating: { ...draftMonster.general.challengeRating, xp: Number(event.target.value || 0) } } })} /></div><div className="space-y-2"><Label>Taglia</Label><Input value={monster.general.size} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, size: event.target.value } })} /></div><div className="space-y-2"><Label>Tipo</Label><Input value={monster.general.creatureType} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, creatureType: event.target.value } })} /></div><div className="space-y-2"><Label>Sottotipo</Label><Input value={monster.general.subtype} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, subtype: event.target.value } })} /></div><div className="space-y-2"><Label>Etichetta tipo</Label><Input value={monster.general.typeLabel} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, typeLabel: event.target.value } })} /></div><div className="space-y-2 md:col-span-2"><Label>Allineamento</Label><Input value={monster.general.alignment} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, alignment: event.target.value } })} /></div></div><div className="space-y-2"><Label>Ambienti</Label><Textarea rows={2} readOnly={!editing} value={listToText(monster.general.environments)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, general: { ...draftMonster.general, environments: textToList(event.target.value) } })} /></div></div></Card>
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Caratteristiche</h3><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{ABILITIES.map(([key, label]) => <div key={key} className="rounded-2xl border border-border/60 bg-background/60 p-4 text-center"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>{editing ? <Input type="number" className="mt-3 text-center" value={monster.abilities[key]} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, abilities: { ...draftMonster.abilities, [key]: Number(event.target.value || 0) } })} /> : <><div className="mt-3 text-3xl font-semibold text-foreground">{monster.abilities[key]}</div><div className="mt-1 text-sm text-muted-foreground">{abilityModifier(monster.abilities[key]) >= 0 ? `+${abilityModifier(monster.abilities[key])}` : abilityModifier(monster.abilities[key])}</div></>}</div>)}</div></div></Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Difese e movimento</h3><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>CA</Label><Input type="number" value={monster.combat.armorClass.value} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, armorClass: { ...draftMonster.combat.armorClass, value: Number(event.target.value || 0) } } })} /></div><div className="space-y-2"><Label>Nota CA</Label><Input value={monster.combat.armorClass.note} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, armorClass: { ...draftMonster.combat.armorClass, note: event.target.value } } })} /></div><div className="space-y-2"><Label>PF medi</Label><Input type="number" value={monster.combat.hitPoints.average} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, hitPoints: { ...draftMonster.combat.hitPoints, average: Number(event.target.value || 0) } } })} /></div><div className="space-y-2"><Label>Formula PF</Label><Input value={monster.combat.hitPoints.formula} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, hitPoints: { ...draftMonster.combat.hitPoints, formula: event.target.value } } })} /></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{SPEED_KEYS.map((key) => <div key={key} className="space-y-2"><Label>{SPEED_LABELS[key]}</Label><Input value={monster.combat.speed[key] ?? ""} readOnly={!editing} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, combat: { ...draftMonster.combat, speed: { ...draftMonster.combat.speed, [key]: event.target.value } } })} /></div>)}</div></div></Card>
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Blocchi modificabili</h3><div className="space-y-2"><Label>Tiri salvezza (`nome|bonus`)</Label><Textarea rows={4} readOnly={!editing} value={bonusListToText(monster.details.savingThrows)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, savingThrows: textToBonusList(event.target.value, "ability") as MonsterEntry["details"]["savingThrows"] } })} /></div><div className="space-y-2"><Label>Abilità (`nome|bonus`)</Label><Textarea rows={4} readOnly={!editing} value={bonusListToText(monster.details.skills)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, skills: textToBonusList(event.target.value, "name") as MonsterEntry["details"]["skills"] } })} /></div><div className="space-y-2"><Label>Sensi (`nome|valore`)</Label><Textarea rows={4} readOnly={!editing} value={taggedListToText(monster.details.senses)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, senses: textToTaggedList(event.target.value) } })} /></div><div className="space-y-2"><Label>Linguaggi (`nome|valore`)</Label><Textarea rows={4} readOnly={!editing} value={taggedListToText(monster.details.languages)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, languages: textToTaggedList(event.target.value) } })} /></div></div></Card>
            </section>
            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Difese speciali</h3><div className="space-y-2"><Label>Resistenze ai danni</Label><Textarea rows={3} readOnly={!editing} value={listToText(monster.details.damageResistances)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, damageResistances: textToList(event.target.value) } })} /></div><div className="space-y-2"><Label>Immunità ai danni</Label><Textarea rows={3} readOnly={!editing} value={listToText(monster.details.damageImmunities)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, damageImmunities: textToList(event.target.value) } })} /></div><div className="space-y-2"><Label>Vulnerabilità ai danni</Label><Textarea rows={3} readOnly={!editing} value={listToText(monster.details.damageVulnerabilities)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, damageVulnerabilities: textToList(event.target.value) } })} /></div><div className="space-y-2"><Label>Immunità alle condizioni</Label><Textarea rows={3} readOnly={!editing} value={listToText(monster.details.conditionImmunities)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, details: { ...draftMonster.details, conditionImmunities: textToList(event.target.value) } })} /></div></div></Card>
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Testi estesi</h3><div className="space-y-2"><Label>Tratti (`nome|uso|descrizione`, separa le voci con una riga vuota)</Label><Textarea rows={8} readOnly={!editing} value={featuresToText(monster.traits)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, traits: textToFeatures(event.target.value) })} /></div><div className="space-y-2"><Label>Azioni</Label><Textarea rows={8} readOnly={!editing} value={featuresToText(monster.actions)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, actions: textToFeatures(event.target.value) })} /></div><div className="space-y-2"><Label>Azioni bonus</Label><Textarea rows={6} readOnly={!editing} value={featuresToText(monster.bonusActions)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, bonusActions: textToFeatures(event.target.value) })} /></div><div className="space-y-2"><Label>Reazioni</Label><Textarea rows={6} readOnly={!editing} value={featuresToText(monster.reactions)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, reactions: textToFeatures(event.target.value) })} /></div></div></Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Sezioni avanzate</h3><div className="space-y-2"><Label>Azioni leggendarie (`# descrizione` per l'intro, poi `nome|costo|descrizione`)</Label><Textarea rows={8} readOnly={!editing} value={legendaryToText(monster.legendaryActions)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, legendaryActions: textToLegendary(event.target.value) })} /></div><div className="space-y-2"><Label>Azioni di tana</Label><Textarea rows={6} readOnly={!editing} value={featuresToText(monster.lairActions)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, lairActions: textToFeatures(event.target.value) })} /></div><div className="space-y-2"><Label>Effetti regionali</Label><Textarea rows={6} readOnly={!editing} value={featuresToText(monster.regionalEffects)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, regionalEffects: textToFeatures(event.target.value) })} /></div><div className="space-y-2"><Label>Note</Label><Textarea rows={4} readOnly={!editing} value={listToText(monster.notes)} onChange={(event) => draftMonster && setDraftMonster({ ...draftMonster, notes: textToList(event.target.value) })} /></div></div></Card>
              <Card className="border-border/60 bg-background/50 p-5"><div className="space-y-4"><h3 className="font-heading text-xl font-semibold text-primary">Sorgente</h3><div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">File: {monster.filePath}</div><div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">Origine: {monster.source.extractedFrom || "Custom / manuale"}</div><Textarea rows={12} readOnly value={monster.source.rawText ?? ""} /></div></Card>
            </section>
          </div></ScrollArea>}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Aggiungi mostro</DialogTitle>
            <DialogDescription>Crea un mostro vuoto oppure duplicane uno esistente per ottenere una variante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Modalità</Label><Select value={createMode} onValueChange={(value: "blank" | "duplicate") => setCreateMode(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="blank">Crea da zero</SelectItem><SelectItem value="duplicate">Duplica da esistente</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="new-monster-name">Nome mostro</Label><Input id="new-monster-name" value={newMonsterName} onChange={(event) => setNewMonsterName(event.target.value)} placeholder="Es. Aboleth antico" /></div>
            {createMode === "duplicate" ? <div className="space-y-2"><Label>Mostro di partenza</Label><Select value={duplicateFromId} onValueChange={setDuplicateFromId}><SelectTrigger><SelectValue placeholder="Scegli il mostro base" /></SelectTrigger><SelectContent>{monsters.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name} · GS {crLabel(entry.challengeRating)}</SelectItem>)}</SelectContent></Select></div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={() => void createMonster()} disabled={!newMonsterName.trim()}><Plus className="mr-2 h-4 w-4" />Crea mostro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
