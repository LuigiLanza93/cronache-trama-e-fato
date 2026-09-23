import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  applyCharacterProgressionRequest,
  previewCharacterProgressionRequest,
  type CharacterProgressionApplyRequest,
  type CharacterProgressionApiResponse,
  type ProgressionResourcePoolPayload,
} from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

type ProgressionCharacter = {
  slug: string;
  revision?: string;
  progressionRevision?: number;
  progressionStatus?: string;
  classes?: Array<{ classKey: string; label?: string; level: number; isPrimary?: boolean; subclass?: { subclassKey?: string | null; label?: string | null } | null }>;
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
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState<PendingLevelUp | null>(() => readPendingLevelUp(characterData.slug));
  const requestIdRef = useRef<string | null>(null);

  const ownedClass = useMemo(
    () => characterData.progressionStatus === "READY" && characterData.classes?.length === 1
      ? characterData.classes[0]
      : null,
    [characterData.classes, characterData.progressionStatus],
  );
  const preview = previewResponse?.preview ?? null;
  const requiresSubclass = preview?.status === "SUBCLASS_REQUIRED";
  const hasRevisionTokens = Boolean(previewResponse?.revision) && Number.isInteger(previewResponse?.progressionRevision);
  const hasDeferredEffects = Boolean(previewResponse?.deferredEffects?.length);

  const reset = () => {
    setPreviewResponse(null);
    setSelectedSubclass(undefined);
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
    requestIdRef.current = pending?.requestId ?? null;
  }, [characterData.slug]);

  const loadPreview = async (subclassKey?: string) => {
    if (!ownedClass) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const response = await previewCharacterProgressionRequest(characterData.slug, {
        targetClassKey: ownedClass.classKey,
        ...(subclassKey !== undefined ? { targetSubclassKey: subclassKey } : {}),
        ...(characterData.revision ? { expectedRevision: characterData.revision } : {}),
        ...(Number.isInteger(characterData.progressionRevision) ? { expectedProgressionRevision: characterData.progressionRevision } : {}),
      });
      setPreviewResponse(response);
      setRefreshRequired(false);
      setRefreshFailed(false);
    } catch (caught) {
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
      setLoadingPreview(false);
    }
  };

  const handleOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !pendingLevelUp) void loadPreview();
  };

  const handleSubclass = (key: string) => {
    setSelectedSubclass(key);
    requestIdRef.current = null;
    void loadPreview(key);
  };

  const apply = async () => {
    if (!ownedClass) return;
    const request = pendingLevelUp ?? (previewResponse && preview?.canApply && hasRevisionTokens ? {
      targetClassKey: ownedClass.classKey,
      ...(selectedSubclass !== undefined ? { targetSubclassKey: selectedSubclass } : {}),
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

  const currentSubclass = ownedClass?.subclass?.label ?? ownedClass?.subclass?.subclassKey ?? "Nessuna";
  const classAfter = Array.isArray(preview?.classesAfter) ? preview.classesAfter[0] : null;
  const nextSubclass = preview?.subclassOptions.find((option) => option.key === classAfter?.subclassKey)?.label ?? currentSubclass;
  const effects = preview?.effects;

  return <Dialog open={open} onOpenChange={handleOpen}>
    <Button type="button" variant="outline" className="gap-2" onClick={() => handleOpen(true)} aria-label="Aumenta livello">
      <ChevronUp className="h-4 w-4" /> Aumenta livello
    </Button>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Aumenta livello{ownedClass ? ` — ${ownedClass.label ?? ownedClass.classKey}` : ""}</DialogTitle><DialogDescription>Anteprima autorevole prima della conferma. L'operazione incrementa solo la classe già posseduta.</DialogDescription></DialogHeader>
      {loadingPreview ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calcolo dell'anteprima…</div> : null}
      {error ? <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {pendingLevelUp && !error ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Una conferma precedente ha avuto un esito di rete incerto. Usa “Riprova stessa conferma”: verranno riutilizzati esattamente richiesta e identificativo originali.</div> : null}
      {!ownedClass ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Level-up guidato L1 non applicabile: la progressione strutturata è assente/incompleta oppure il personaggio non è monoclasse.</div> : null}
      {preview && !preview.after ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">{preview.reason ?? "Il level-up non è applicabile allo stato corrente."}</div> : null}
      {preview && preview.after ? <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <PreviewRow label="Livello totale" before={preview.before.characterLevel} after={preview.after.characterLevel}/>
          <PreviewRow label="Livello classe" before={ownedClass?.level ?? "—"} after={classAfter?.level ?? "—"}/>
          <PreviewRow label="Bonus competenza" before={`+${preview.before.proficiencyBonus}`} after={`+${preview.after.proficiencyBonus}`}/>
          <PreviewRow label="Dadi Vita" before={diceText(preview.before.hitDicePools)} after={diceText(preview.after.hitDicePools)}/>
          <PreviewRow label="Slot incantesimi" before={slotsText(preview.before.spellcastingSlots.slots)} after={slotsText(preview.after.spellcastingSlots.slots)}/>
          <PreviewRow label="Magia del Patto" before={pactSummary(preview.before.pactMagicSlots)} after={pactSummary(preview.after.pactMagicSlots)}/>
          <PreviewRow label="Sottoclasse" before={currentSubclass} after={nextSubclass}/>
        </div>
        {effects?.hitPoints || effects?.hitDicePools ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">PF e Dadi Vita</p><p className="text-muted-foreground">{effects.hitPoints ? <>PF massimi: {effects.hitPoints.before.maximumHitPoints} → {effects.hitPoints.after.maximumHitPoints}; guadagno: +{effects.hitPoints.gained}.</> : "PF non modificati dal contratto."} {effects.hitDicePools ? <>Dadi disponibili: {effects.hitDicePools.before.map((pool) => `d${pool.dieSize}: ${pool.remaining}/${pool.maximum}`).join(", ")} → {effects.hitDicePools.after.map((pool) => `d${pool.dieSize}: ${pool.remaining}/${pool.maximum}`).join(", ")}.</> : null}</p></div> : null}
        {effects?.resourcePools ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Pool risorse</p><p className="text-muted-foreground">{resourceText(effects.resourcePools.before)} → {resourceText(effects.resourcePools.after)}</p></div> : null}
        {hasDeferredEffects ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Level-up bloccato finché M5/M6 non sono pronti: effetti differiti — {previewResponse?.deferredEffects.join(", ")}.</div> : null}
        <div className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Competenze, privilegi e incantesimi non censiti vengono preservati: completali o verificali manualmente dopo il level-up.</div>
        {requiresSubclass ? <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-50/60 p-3"><Label htmlFor="level-up-subclass">Sottoclasse obbligatoria</Label>{preview.subclassOptions.length ? <Select value={selectedSubclass} onValueChange={handleSubclass} disabled={loadingPreview || applying}><SelectTrigger id="level-up-subclass"><SelectValue placeholder="Scegli una sottoclasse" /></SelectTrigger><SelectContent>{preview.subclassOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select> : <p className="text-sm text-amber-950">Nessuna opzione autorevole disponibile: è richiesto un passaggio manuale.</p>}</div> : null}
        {preview.status === "MANUAL" || preview.subclassEligibility?.status === "MANUAL" ? <div className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Passaggio manuale richiesto: {preview.reason ?? preview.subclassEligibility?.reason ?? "regole non risolte dal contratto."}</div> : null}
        {!preview.canApply && preview.status !== "MANUAL" ? <div className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">{preview.reason ?? "Il level-up non è ancora applicabile."}</div> : null}
      </div> : null}
      {refreshRequired ? <p className="text-sm text-muted-foreground">{refreshFailed ? "Ricarica la pagina prima di creare una nuova anteprima." : "L'anteprima non è più valida. Usa “Aggiorna anteprima” per continuare."}</p> : null}
      <DialogFooter><Button type="button" variant="outline" onClick={() => void loadPreview(selectedSubclass)} disabled={!ownedClass || refreshFailed || loadingPreview || applying || Boolean(pendingLevelUp)}>Aggiorna anteprima</Button>{pendingLevelUp ? <Button type="button" onClick={() => void apply()} disabled={applying}>{applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applicazione…</> : "Riprova stessa conferma"}</Button> : <Button type="button" onClick={() => void apply()} disabled={!ownedClass || !preview?.canApply || !hasRevisionTokens || hasDeferredEffects || loadingPreview || applying || refreshRequired}>{applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applicazione…</> : "Conferma level-up"}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
