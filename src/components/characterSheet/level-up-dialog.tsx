import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyCharacterProgressionRequest,
  previewCharacterProgressionRequest,
  type CharacterProgressionApplyRequest,
  type CharacterProgressionApiResponse,
  type ProgressionResourcePoolPayload,
} from "@/lib/auth";
import { toast } from "@/components/ui/sonner";
import { getSubclassPreviewRows, type DraconicAncestryProjection } from "@/lib/character-progression";

type ProgressionCharacter = {
  slug: string;
  revision?: string;
  progressionRevision?: number;
  progressionStatus?: string;
  classes?: Array<{ classKey: string; label?: string; level: number; isPrimary?: boolean; subclass?: { subclassKey?: string | null; label?: string | null } | null; draconicAncestry?: DraconicAncestryProjection | null; pactBoonKey?: string | null }>;
};

type SubclassOption = { key: string; label: string };
type PendingLevelUp = CharacterProgressionApplyRequest;

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pendingStorageKey(slug: string) { return `cronache:level-up:${slug}`; }
function readPendingLevelUp(slug: string): PendingLevelUp | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(pendingStorageKey(slug)) ?? "null") as Partial<PendingLevelUp> | null;
    return parsed && typeof parsed.requestId === "string" && typeof parsed.targetClassKey === "string"
      && typeof parsed.expectedRevision === "string" && Number.isInteger(parsed.expectedProgressionRevision)
      ? parsed as PendingLevelUp : null;
  } catch { return null; }
}
function writePendingLevelUp(slug: string, pending: PendingLevelUp | null) {
  try {
    if (pending) sessionStorage.setItem(pendingStorageKey(slug), JSON.stringify(pending));
    else sessionStorage.removeItem(pendingStorageKey(slug));
  } catch { /* A retry remains available for this mounted dialog if storage is unavailable. */ }
}

function diceText(pools: Record<string, number>) {
  const values = Object.entries(pools).filter(([, value]) => value > 0).map(([die, value]) => `${die}: ${value}`);
  return values.length ? values.join(", ") : "—";
}

function slotsText(slots: Record<string, number>) {
  const values = Object.entries(slots).filter(([, value]) => value > 0).map(([tier, value]) => `L${tier}: ${value}`);
  return values.length ? values.join(", ") : "—";
}

function pactSummary(pool: { slotCount: number; slotLevel: number | null }) {
  return pool.slotCount > 0 && pool.slotLevel ? `${pool.slotCount} × livello ${pool.slotLevel}` : "—";
}

function resourceText(pools: ProgressionResourcePoolPayload[]) {
  if (!pools.length) return "Nessun pool strutturato";
  return pools.map((pool) => {
    const tiers = Object.entries(pool.maximum).filter(([, maximum]) => maximum > 0)
      .map(([tier, maximum]) => `${tier === "0" ? "usi" : `L${tier}`}: ${pool.used[tier] ?? 0}/${maximum}`).join(", ");
    return `${pool.label || pool.kind} (${tiers || "nessun uso"})`;
  }).join(" · ");
}

function PreviewRow({ label, before, after }: { label: string; before: React.ReactNode; after: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border/50 py-2 text-sm last:border-0 sm:grid-cols-[minmax(7rem,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"><span className="text-muted-foreground">{label}</span><span className="font-medium">{before}</span><ArrowRight className="col-start-2 h-3.5 w-3.5 text-muted-foreground sm:col-start-auto" aria-hidden="true"/><span className="col-start-2 font-medium sm:col-start-auto">{after}</span></div>;
}

export default function LevelUpDialog({ characterData, onApplied }: { characterData: ProgressionCharacter; onApplied: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [previewResponse, setPreviewResponse] = useState<CharacterProgressionApiResponse | null>(null);
  const [selectedSubclass, setSelectedSubclass] = useState<string | undefined>(undefined);
  const [selectedPactBoon, setSelectedPactBoon] = useState("");
  const [selectedDraconicAncestry, setSelectedDraconicAncestry] = useState("");
  const [selectedClassKey, setSelectedClassKey] = useState<string>(() => characterData.classes?.find((entry) => entry.isPrimary)?.classKey ?? characterData.classes?.[0]?.classKey ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState<PendingLevelUp | null>(() => readPendingLevelUp(characterData.slug));
  const requestIdRef = useRef<string | null>(null);
  const previewRequestRef = useRef(0);

  // Historical characters can select their missing subclass in the preview.
  const progressionReady = ["READY", "INCOMPLETE_LEGACY"].includes(characterData.progressionStatus ?? "")
    && Boolean(characterData.classes?.length);
  const targetClass = useMemo(
    () => characterData.classes?.find((entry) => entry.classKey === selectedClassKey) ?? null,
    [characterData.classes, selectedClassKey],
  );
  const preview = previewResponse?.preview ?? null;
  const requiresSubclass = Boolean(preview?.subclassOptions.length);
  const hasRevisionTokens = Boolean(previewResponse?.revision) && Number.isInteger(previewResponse?.progressionRevision);
  const hasDeferredEffects = Boolean(previewResponse?.deferredEffects?.length);

  const reset = () => {
    previewRequestRef.current += 1;
    setLoadingPreview(false);
    setPreviewResponse(null);
    setSelectedSubclass(undefined);
    setSelectedPactBoon("");
    setSelectedDraconicAncestry("");
    setOverrideReason("");
    setError(null);
    setRefreshRequired(false);
    setRefreshFailed(false);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  useEffect(() => {
    const pending = readPendingLevelUp(characterData.slug);
    setOpen(false);
    setPendingLevelUp(pending);
    setSelectedClassKey(characterData.classes?.find((entry) => entry.isPrimary)?.classKey ?? characterData.classes?.[0]?.classKey ?? "");
    requestIdRef.current = pending?.requestId ?? null;
  }, [characterData.slug]);

  const loadPreview = async (subclassKey?: string, classKey = selectedClassKey, reason = overrideReason, ancestryKey = selectedDraconicAncestry, boonKey = selectedPactBoon) => {
    if (!progressionReady || !classKey) return;
    const previewRequest = ++previewRequestRef.current;
    setLoadingPreview(true);
    setError(null);
    try {
      const response = await previewCharacterProgressionRequest(characterData.slug, {
        targetClassKey: classKey,
        ...(subclassKey !== undefined ? { targetSubclassKey: subclassKey } : {}),
        ...(ancestryKey ? { draconicAncestryKey: ancestryKey } : {}),
        ...(boonKey ? { pactBoonKey: boonKey } : {}),
        ...(reason.trim() ? { overrideReason: reason.trim() } : {}),
        ...(characterData.revision ? { expectedRevision: characterData.revision } : {}),
        ...(Number.isInteger(characterData.progressionRevision) ? { expectedProgressionRevision: characterData.progressionRevision } : {}),
      });
      if (previewRequest !== previewRequestRef.current) return;
      setPreviewResponse(response);
      setRefreshRequired(false);
      setRefreshFailed(false);
    } catch (caught) {
      if (previewRequest !== previewRequestRef.current) return;
      setPreviewResponse(null);
      const message = caught instanceof Error ? caught.message : "Impossibile calcolare l'anteprima del level-up.";
      const status = typeof caught === "object" && caught ? (caught as { status?: number }).status : undefined;
      if (status === 409) {
        let refreshed = true;
        try { await onApplied(); } catch { refreshed = false; }
        setRefreshRequired(true);
        setRefreshFailed(!refreshed);
        setError(refreshed
          ? `${message} La scheda è stata ricaricata: rigenera l'anteprima.`
          : `${message} Non è stato possibile ricaricare la scheda: ricarica la pagina prima di continuare.`);
      } else setError(message);
    } finally {
      if (previewRequest === previewRequestRef.current) setLoadingPreview(false);
    }
  };

  const handleOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !pendingLevelUp) void loadPreview();
  };

  const handleSubclass = (key: string) => {
    setSelectedSubclass(key);
    setSelectedDraconicAncestry("");
    requestIdRef.current = null;
    void loadPreview(key, selectedClassKey, overrideReason, "");
  };

  const handleClass = (key: string) => {
    setSelectedClassKey(key);
    setSelectedSubclass(undefined);
    setSelectedPactBoon("");
    setSelectedDraconicAncestry("");
    setOverrideReason("");
    requestIdRef.current = null;
    void loadPreview(undefined, key, "", "", "");
  };

  const apply = async () => {
    if (!progressionReady || !selectedClassKey) return;
    const request = pendingLevelUp ?? (previewResponse && preview?.canApply && hasRevisionTokens ? {
      targetClassKey: selectedClassKey,
      ...(selectedSubclass !== undefined ? { targetSubclassKey: selectedSubclass } : {}),
      ...(selectedDraconicAncestry ? { draconicAncestryKey: selectedDraconicAncestry } : {}),
      ...(selectedPactBoon ? { pactBoonKey: selectedPactBoon } : {}),
      ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
      requestId: requestIdRef.current ?? createRequestId(),
      expectedRevision: previewResponse.revision,
      expectedProgressionRevision: previewResponse.progressionRevision,
    } : null);
    if (!request) return;
    const operationSlug = characterData.slug;
    setApplying(true);
    setError(null);
    requestIdRef.current = request.requestId;
    setPendingLevelUp(request);
    writePendingLevelUp(operationSlug, request);
    try {
      await applyCharacterProgressionRequest(operationSlug, request);
      setPendingLevelUp(null);
      writePendingLevelUp(operationSlug, null);
      requestIdRef.current = null;
      try {
        await onApplied();
        toast.success("Level-up applicato. La scheda è stata aggiornata.");
      } catch {
        toast.success("Level-up applicato. Ricarica la scheda per visualizzare lo stato aggiornato.");
      }
      setOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Non è stato possibile applicare il level-up.";
      const status = typeof caught === "object" && caught ? (caught as { status?: number }).status : undefined;
      if (status === 409) {
        let refreshed = true;
        try { await onApplied(); } catch { refreshed = false; }
        setPreviewResponse(null);
        setRefreshRequired(true);
        setRefreshFailed(!refreshed);
        requestIdRef.current = null;
        setPendingLevelUp(null);
        writePendingLevelUp(operationSlug, null);
        setError(refreshed
          ? `${message} La scheda è stata ricaricata: rigenera l'anteprima prima di confermare.`
          : `${message} Non è stato possibile ricaricare la scheda: ricarica la pagina prima di continuare.`);
      } else if (typeof status === "number" && status >= 400 && status < 500) {
        setPendingLevelUp(null);
        writePendingLevelUp(operationSlug, null);
        requestIdRef.current = null;
        setError(message);
      } else {
        setError(`${message} L'esito potrebbe essere incerto: usa “Riprova stessa conferma”.`);
      }
      toast.error(message);
    } finally {
      setApplying(false);
    }
  };

  const classAfter = Array.isArray(preview?.classesAfter)
    ? preview.classesAfter.find((entry) => entry.classKey === preview.targetClassKey) ?? null
    : null;
  const subclassRows = getSubclassPreviewRows(characterData.classes ?? [], preview?.classesAfter ?? []);
  const effects = preview?.effects;

  return <Dialog open={open} onOpenChange={handleOpen}>
    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent" onClick={() => handleOpen(true)} aria-label="Aumenta livello" title="Aumenta livello">
      <ChevronUp className="h-4 w-4 text-primary" />
    </Button>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Aumenta livello</DialogTitle><DialogDescription>Scegli se avanzare una classe posseduta o acquisire il primo livello in una nuova classe.</DialogDescription></DialogHeader>
      {loadingPreview ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calcolo dell'anteprima…</div> : null}
      {error ? <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {pendingLevelUp && !error ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Una conferma precedente ha avuto un esito di rete incerto. Usa “Riprova stessa conferma”: verranno riutilizzati esattamente richiesta e identificativo originali.</div> : null}
      {!progressionReady ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Level-up non disponibile: i dati di classe e livello devono essere verificati e migrati prima di procedere.</div> : null}
      {progressionReady && characterData.progressionStatus === "INCOMPLETE_LEGACY" ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Una sottoclasse della scheda esistente non è ancora registrata. Avanzando quella classe, seleziona la sottoclasse già posseduta prima di confermare.</div> : null}
      {progressionReady && !pendingLevelUp ? <div className="space-y-2"><Label htmlFor="level-up-class">Classe da avanzare</Label><Select value={selectedClassKey} onValueChange={handleClass} disabled={loadingPreview || applying}><SelectTrigger id="level-up-class"><SelectValue placeholder="Scegli una classe" /></SelectTrigger><SelectContent>{(preview?.classOptions ?? []).map((option) => <SelectItem key={option.key} value={option.key}>{option.label}{option.mode === "ADD_NEW_CLASS" ? " — nuova classe" : ` — livello ${option.currentLevel}`}</SelectItem>)}</SelectContent></Select></div> : null}
      {preview && !preview.after ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">{preview.reason ?? "Il level-up non è applicabile allo stato corrente."}</div> : null}
      {preview && preview.after ? <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <PreviewRow label="Livello totale" before={preview.before.characterLevel} after={preview.after.characterLevel}/>
          <PreviewRow label="Livello classe" before={targetClass?.level ?? 0} after={classAfter?.level ?? "—"}/>
          <PreviewRow label="Bonus competenza" before={`+${preview.before.proficiencyBonus}`} after={`+${preview.after.proficiencyBonus}`}/>
          <PreviewRow label="Dadi Vita" before={diceText(preview.before.hitDicePools)} after={diceText(preview.after.hitDicePools)}/>
          <PreviewRow label="Slot incantesimi" before={slotsText(preview.before.spellcastingSlots.slots)} after={slotsText(preview.after.spellcastingSlots.slots)}/>
          <PreviewRow label="Magia del Patto" before={pactSummary(preview.before.pactMagicSlots)} after={pactSummary(preview.after.pactMagicSlots)}/>
          {subclassRows.map((row) => <PreviewRow key={row.classKey} label={`Sottoclasse · ${row.label}`} before={row.before} after={row.after}/>)}
        </div>
        {effects?.hitPoints || effects?.hitDicePools ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">PF e Dadi Vita</p><p className="text-muted-foreground">{effects.hitPoints ? <>PF massimi: {effects.hitPoints.before.maximumHitPoints} → {effects.hitPoints.after.maximumHitPoints}; guadagno: +{effects.hitPoints.gained}.</> : "PF non modificati dal contratto."} {effects.hitDicePools ? <>Dadi disponibili: {effects.hitDicePools.before.map((pool) => `d${pool.dieSize}: ${pool.remaining}/${pool.maximum}`).join(", ")} → {effects.hitDicePools.after.map((pool) => `d${pool.dieSize}: ${pool.remaining}/${pool.maximum}`).join(", ")}.</> : null}</p></div> : null}
        {effects?.resourcePools ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Pool risorse</p><p className="text-muted-foreground">{resourceText(effects.resourcePools.before)} → {resourceText(effects.resourcePools.after)}</p></div> : null}
        {hasDeferredEffects ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Level-up bloccato finché M5/M6 non sono pronti: effetti differiti — {previewResponse?.deferredEffects.join(", ")}.</div> : null}
        <div className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Competenze, privilegi e incantesimi non censiti vengono preservati: completali o verificali manualmente dopo il level-up.</div>
        {preview.manualRuleNotes?.length ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Regole da verificare</p><ul className="mt-2 list-disc space-y-1 pl-5">{preview.manualRuleNotes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}
        {preview.mode === "ADD_NEW_CLASS" ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Prerequisiti multiclasse</p><p className="text-muted-foreground">{preview.prerequisites?.eligible || preview.prerequisites?.overridden ? "Verificati." : preview.prerequisites?.reason ?? "Verifica manuale richiesta."}</p>{preview.prerequisites?.status === "INELIGIBLE" && !preview.prerequisites.overridden ? <div className="mt-3 space-y-2"><Label htmlFor="level-up-override">Override DM motivato</Label><Textarea id="level-up-override" value={overrideReason} maxLength={500} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Motivazione obbligatoria per ignorare i prerequisiti"/><Button type="button" variant="outline" onClick={() => void loadPreview(selectedSubclass, selectedClassKey, overrideReason)} disabled={!overrideReason.trim() || loadingPreview || applying}>Ricalcola con override</Button></div> : null}</div> : null}
        {requiresSubclass ? <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-50/60 p-3"><Label htmlFor="level-up-subclass">Sottoclasse obbligatoria</Label>{preview.subclassOptions.length ? <Select value={selectedSubclass} onValueChange={handleSubclass} disabled={loadingPreview || applying}><SelectTrigger id="level-up-subclass"><SelectValue placeholder="Scegli una sottoclasse" /></SelectTrigger><SelectContent>{preview.subclassOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select> : <p className="text-sm text-amber-950">Nessuna opzione autorevole disponibile: è richiesto un passaggio manuale.</p>}</div> : null}
        {preview.pactBoonOptions?.length ? <div className="space-y-2"><Label htmlFor="level-up-pact-boon">Dono del patto</Label><Select value={selectedPactBoon || preview.pactBoonKey || ""} onValueChange={(key) => {
          setSelectedPactBoon(key); requestIdRef.current = null;
          void loadPreview(selectedSubclass, selectedClassKey, overrideReason, selectedDraconicAncestry, key);
        }} disabled={loadingPreview || applying || Boolean(pendingLevelUp)}><SelectTrigger id="level-up-pact-boon"><SelectValue placeholder="Scegli il dono del patto" /></SelectTrigger><SelectContent>{preview.pactBoonOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select><p className="text-sm text-muted-foreground">Disponibile dal livello 3 da Warlock, indipendentemente dal livello totale.</p></div> : null}
        {preview.draconicAncestryOptions?.length ? <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="level-up-dragon">Antenato draconico dello Stregone</Label>
          {targetClass?.draconicAncestry ? <p className="text-sm">Drago {targetClass.draconicAncestry.label} · {targetClass.draconicAncestry.damageLabel}. La scelta viene conservata.</p> : <Select
            value={selectedDraconicAncestry || preview.draconicAncestryKey || ""}
            onValueChange={(key) => { setSelectedDraconicAncestry(key); requestIdRef.current = null; void loadPreview(selectedSubclass, selectedClassKey, overrideReason, key); }}
            disabled={loadingPreview || applying}
          ><SelectTrigger id="level-up-dragon"><SelectValue placeholder="Scegli il colore o il tipo di drago" /></SelectTrigger><SelectContent>{preview.draconicAncestryOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label} · {option.damageLabel}</SelectItem>)}</SelectContent></Select>}
          <p className="text-sm text-muted-foreground">Registra la scelta: i privilegi e i bonus già gestiti manualmente restano invariati.</p>
        </div> : null}
        {preview.status === "MANUAL" || preview.subclassEligibility?.status === "MANUAL" ? <div className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Passaggio manuale richiesto: {preview.reason ?? preview.subclassEligibility?.reason ?? "regole non risolte dal contratto."}</div> : null}
        {!preview.canApply && preview.status !== "MANUAL" ? <div className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">{preview.reason ?? "Il level-up non è ancora applicabile."}</div> : null}
      </div> : null}
      {refreshRequired ? <p className="text-sm text-muted-foreground">{refreshFailed ? "Ricarica la pagina prima di creare una nuova anteprima." : "L'anteprima non è più valida. Usa “Aggiorna anteprima” per continuare."}</p> : null}
      <DialogFooter><Button type="button" variant="outline" onClick={() => void loadPreview(selectedSubclass)} disabled={!progressionReady || !selectedClassKey || refreshFailed || loadingPreview || applying || Boolean(pendingLevelUp)}>Aggiorna anteprima</Button>{pendingLevelUp ? <Button type="button" onClick={() => void apply()} disabled={applying}>{applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applicazione…</> : "Riprova stessa conferma"}</Button> : <Button type="button" onClick={() => void apply()} disabled={!progressionReady || !preview?.canApply || !hasRevisionTokens || hasDeferredEffects || loadingPreview || applying || refreshRequired}>{applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applicazione…</> : "Conferma level-up"}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
