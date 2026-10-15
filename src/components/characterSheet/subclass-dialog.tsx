import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import type { DraconicAncestryProjection } from "@/lib/character-progression";
import { pactBoonSummary } from "../../../shared/warlock-pact-rules.mjs";
import { draconicAncestrySummary } from "../../../shared/draconic-ancestry-rules.mjs";
import {
  applyCharacterSubclassRequest,
  previewCharacterSubclassRequest,
  type CharacterSubclassApiResponse,
  type CharacterSubclassApplyRequest,
} from "@/lib/auth";

type SubclassCharacter = {
  slug: string;
  revision?: string;
  progressionRevision?: number;
  classes?: Array<{ classKey: string; isPrimary?: boolean; pactBoonKey?: string | null; subclass?: { subclassKey?: string | null; label?: string | null } | null; draconicAncestry?: DraconicAncestryProjection | null }>;
};

function pendingStorageKey(slug: string) { return `cronache:subclass:${slug}`; }
function createRequestId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function readPending(slug: string): CharacterSubclassApplyRequest | null {
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingStorageKey(slug)) ?? "null") as Partial<CharacterSubclassApplyRequest> | null;
    return pending && typeof pending.targetClassKey === "string" && typeof pending.targetSubclassKey === "string"
      && typeof pending.requestId === "string" && typeof pending.expectedRevision === "string"
      && Number.isInteger(pending.expectedProgressionRevision) ? pending as CharacterSubclassApplyRequest : null;
  } catch { return null; }
}
function writePending(slug: string, pending: CharacterSubclassApplyRequest | null) {
  try {
    if (pending) sessionStorage.setItem(pendingStorageKey(slug), JSON.stringify(pending));
    else sessionStorage.removeItem(pendingStorageKey(slug));
  } catch { /* Retry stays available while the dialog remains mounted. */ }
}
function displayValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "Preservati";
}

export default function SubclassDialog({ characterData, onApplied }: { characterData: SubclassCharacter; onApplied: () => Promise<void> | void }) {
  const initialClass = characterData.classes?.find((entry) => entry.isPrimary)?.classKey ?? characterData.classes?.[0]?.classKey ?? "";
  const [open, setOpen] = useState(false);
  const [selectedClassKey, setSelectedClassKey] = useState(initialClass);
  const [selectedSubclassKey, setSelectedSubclassKey] = useState("");
  const [selectedPactBoon, setSelectedPactBoon] = useState("");
  const [selectedDraconicAncestry, setSelectedDraconicAncestry] = useState("");
  const [reason, setReason] = useState("");
  const [response, setResponse] = useState<CharacterSubclassApiResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [pending, setPending] = useState<CharacterSubclassApplyRequest | null>(() => readPending(characterData.slug));
  const previewRequestRef = useRef(0);
  const requestIdRef = useRef<string | null>(null);

  const currentInputKey = `${selectedClassKey}\u0000${selectedSubclassKey}\u0000${reason.trim()}\u0000${selectedDraconicAncestry}\u0000${selectedPactBoon}`;
  const [previewInputKey, setPreviewInputKey] = useState<string | null>(null);
  const preview = response?.preview ?? null;
  const previewIsFresh = previewInputKey === currentInputKey;
  const hasRevisionTokens = Boolean(response?.revision) && Number.isInteger(response?.progressionRevision);
  const reasonValid = !preview?.reasonRequired || (reason.trim().length >= 3 && reason.trim().length <= 500);

  const actionLabel = useMemo(() => {
    const selected = characterData.classes?.find((entry) => entry.classKey === selectedClassKey);
    return selected?.subclass?.subclassKey ? "Correggi sottoclasse" : "Imposta sottoclasse";
  }, [characterData.classes, selectedClassKey]);

  const reset = () => {
    previewRequestRef.current += 1;
    setResponse(null);
    setSelectedSubclassKey("");
    setSelectedPactBoon("");
    setSelectedDraconicAncestry("");
    setLoadingPreview(false);
    setReason("");
    setPreviewInputKey(null);
    setError(null);
    setRefreshRequired(false);
    setRefreshFailed(false);
  };

  useEffect(() => {
    const stored = readPending(characterData.slug);
    setOpen(false);
    setPending(stored);
    requestIdRef.current = stored?.requestId ?? null;
    setSelectedClassKey(characterData.classes?.find((entry) => entry.isPrimary)?.classKey ?? characterData.classes?.[0]?.classKey ?? "");
    reset();
    // `reset` deliberately clears an obsolete preview when the character changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterData.slug]);

  const loadPreview = async (classKey = selectedClassKey, subclassKey = selectedSubclassKey || characterData.classes?.find((entry) => entry.classKey === classKey)?.subclass?.subclassKey || "", nextReason = reason, ancestryKey = selectedDraconicAncestry, boonKey = selectedPactBoon) => {
    if (!classKey) return;
    const requestNumber = ++previewRequestRef.current;
    setSelectedSubclassKey(subclassKey);
    const inputKey = `${classKey}\u0000${subclassKey}\u0000${nextReason.trim()}\u0000${ancestryKey}\u0000${boonKey}`;
    setLoadingPreview(true);
    setError(null);
    try {
      const result = await previewCharacterSubclassRequest(characterData.slug, {
        targetClassKey: classKey,
        ...(subclassKey ? { targetSubclassKey: subclassKey } : {}),
        ...(ancestryKey ? { draconicAncestryKey: ancestryKey } : {}),
        ...(boonKey ? { pactBoonKey: boonKey } : {}),
        ...(nextReason.trim() ? { reason: nextReason.trim() } : {}),
        ...(characterData.revision ? { expectedRevision: characterData.revision } : {}),
        ...(Number.isInteger(characterData.progressionRevision) ? { expectedProgressionRevision: characterData.progressionRevision } : {}),
      });
      if (requestNumber !== previewRequestRef.current) return;
      setResponse(result);
      setPreviewInputKey(inputKey);
      setRefreshRequired(false);
      setRefreshFailed(false);
    } catch (caught) {
      if (requestNumber !== previewRequestRef.current) return;
      setResponse(null);
      setPreviewInputKey(null);
      const message = caught instanceof Error ? caught.message : "Impossibile calcolare l'anteprima della sottoclasse.";
      const status = typeof caught === "object" && caught ? (caught as { status?: number }).status : undefined;
      if (status === 409) {
        let refreshed = true;
        try { await onApplied(); } catch { refreshed = false; }
        setRefreshRequired(true);
        setRefreshFailed(!refreshed);
        setError(refreshed ? `${message} La scheda è stata ricaricata: rigenera l'anteprima.` : `${message} Ricarica la pagina prima di continuare.`);
      } else setError(message);
    } finally {
      if (requestNumber === previewRequestRef.current) setLoadingPreview(false);
    }
  };

  const handleOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) { reset(); return; }
    if (!pending) void loadPreview();
  };
  const handleClass = (key: string) => {
    setSelectedPactBoon("");
    const currentSubclass = characterData.classes?.find((entry) => entry.classKey === key)?.subclass?.subclassKey || "";
    setSelectedClassKey(key); setSelectedSubclassKey(currentSubclass); setSelectedDraconicAncestry(""); setReason(""); setPreviewInputKey(null); requestIdRef.current = null;
    void loadPreview(key, currentSubclass, "", "", "");
  };
  const handleSubclass = (key: string) => {
    setSelectedSubclassKey(key); setSelectedDraconicAncestry(""); setPreviewInputKey(null); requestIdRef.current = null;
    void loadPreview(selectedClassKey, key, reason, "");
  };

  const apply = async () => {
    const request = pending ?? (response && preview && previewIsFresh && preview.canApply && selectedSubclassKey && hasRevisionTokens && reasonValid ? {
      targetClassKey: selectedClassKey,
      targetSubclassKey: selectedSubclassKey,
      ...(selectedDraconicAncestry ? { draconicAncestryKey: selectedDraconicAncestry } : {}),
      ...(selectedPactBoon ? { pactBoonKey: selectedPactBoon } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      requestId: requestIdRef.current ?? createRequestId(),
      expectedRevision: response.revision,
      expectedProgressionRevision: response.progressionRevision,
    } : null);
    if (!request) return;
    const slug = characterData.slug;
    setApplying(true); setError(null); requestIdRef.current = request.requestId; setPending(request); writePending(slug, request);
    try {
      await applyCharacterSubclassRequest(slug, request);
      setPending(null); writePending(slug, null); requestIdRef.current = null;
      try { await onApplied(); toast.success("Sottoclasse registrata. La scheda è stata aggiornata."); }
      catch { toast.success("Sottoclasse registrata. Ricarica la scheda per visualizzare lo stato aggiornato."); }
      setOpen(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Non è stato possibile registrare la sottoclasse.";
      const status = typeof caught === "object" && caught ? (caught as { status?: number }).status : undefined;
      if (status === 409) {
        let refreshed = true;
        try { await onApplied(); } catch { refreshed = false; }
        setResponse(null); setPreviewInputKey(null); setRefreshRequired(true); setRefreshFailed(!refreshed);
        requestIdRef.current = null; setPending(null); writePending(slug, null);
        setError(refreshed ? `${message} La scheda è stata ricaricata: rigenera l'anteprima.` : `${message} Ricarica la pagina prima di continuare.`);
      } else if (typeof status === "number" && status >= 400 && status < 500) {
        setPending(null); writePending(slug, null); requestIdRef.current = null; setError(message);
      } else setError(`${message} L'esito potrebbe essere incerto: usa “Riprova stessa conferma”.`);
      toast.error(message);
    } finally { setApplying(false); }
  };

  return <Dialog open={open} onOpenChange={handleOpen}>
    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-accent" onClick={() => handleOpen(true)} aria-label={actionLabel} title={actionLabel}>
      <Pencil className="h-4 w-4 text-primary" />
    </Button>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{actionLabel}</DialogTitle><DialogDescription>Imposta o correggi la sottoclasse senza aumentare il livello.</DialogDescription></DialogHeader>
      {loadingPreview ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calcolo dell'anteprima…</div> : null}
      {error ? <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {pending && !error ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Una conferma precedente ha avuto un esito di rete incerto. Ripeti la stessa conferma per usare la medesima richiesta.</div> : null}
      {!pending ? <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="subclass-class">Classe posseduta</Label><Select value={selectedClassKey} onValueChange={handleClass} disabled={loadingPreview || applying}><SelectTrigger id="subclass-class"><SelectValue placeholder="Scegli una classe" /></SelectTrigger><SelectContent>{(preview?.classOptions ?? []).map((option) => <SelectItem key={option.key} value={option.key}>{option.label} — livello {option.level}{option.subclassLabel ? ` (${option.subclassLabel})` : ""}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="subclass-choice">{selectedClassKey === "warlock" ? "Patrono" : "Sottoclasse"}</Label>{preview?.subclassOptions.length ? <Select value={selectedSubclassKey} onValueChange={handleSubclass} disabled={loadingPreview || applying}><SelectTrigger id="subclass-choice"><SelectValue placeholder="Scegli una sottoclasse" /></SelectTrigger><SelectContent>{preview.subclassOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select> : <p className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">Nessuna sottoclasse disponibile per questa classe al livello attuale.</p>}</div>
        {preview?.pactBoonOptions?.length ? <div className="space-y-2">
          <Label htmlFor="subclass-pact-boon">Dono del patto</Label>
          <Select value={selectedPactBoon || preview.pactBoonKey || ""} onValueChange={(key) => {
            setSelectedPactBoon(key); setPreviewInputKey(null); requestIdRef.current = null;
            void loadPreview(selectedClassKey, selectedSubclassKey, reason, selectedDraconicAncestry, key);
          }} disabled={loadingPreview || applying}><SelectTrigger id="subclass-pact-boon"><SelectValue placeholder="Scegli il dono del patto" /></SelectTrigger><SelectContent>{preview.pactBoonOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select>
          <p className="text-sm text-muted-foreground">Scelta indipendente dal patrono, disponibile dal livello 3 da Warlock. I contenuti già gestiti manualmente restano invariati.</p>
        </div> : null}
        {preview?.draconicAncestryOptions?.length ? <div className="space-y-2">
          <Label htmlFor="subclass-dragon">Antenato draconico</Label>
          <Select value={selectedDraconicAncestry || preview.draconicAncestryKey || ""} onValueChange={(key) => {
            setSelectedDraconicAncestry(key); setPreviewInputKey(null); requestIdRef.current = null;
            void loadPreview(selectedClassKey, selectedSubclassKey, reason, key);
          }} disabled={loadingPreview || applying}><SelectTrigger id="subclass-dragon"><SelectValue placeholder="Scegli il colore o il tipo di drago" /></SelectTrigger><SelectContent>{preview.draconicAncestryOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label} · {option.damageLabel}</SelectItem>)}</SelectContent></Select>
          <p className="text-sm text-muted-foreground">La scelta appartiene alla Discendenza Draconica dello Stregone. Gli effetti già gestiti manualmente restano invariati.</p>
        </div> : null}
        {preview?.reasonRequired ? <div className="space-y-2"><Label htmlFor="subclass-reason">Motivazione della correzione</Label><Textarea id="subclass-reason" value={reason} maxLength={500} onChange={(event) => { setReason(event.target.value); setPreviewInputKey(null); }} placeholder="Almeno 3 caratteri" disabled={loadingPreview || applying} />{reason.trim().length > 0 && !reasonValid ? <p className="text-sm text-destructive">La motivazione deve contenere da 3 a 500 caratteri.</p> : null}</div> : null}
      </div> : null}
      {preview ? <div className="mt-4 space-y-3">
        {preview.pactBoonRequired ? <div className="rounded-lg border bg-muted/30 p-3 text-sm"><span className="font-medium">Dono del patto: </span>{pactBoonSummary(preview.before.pactBoonKey)?.label ?? "Non registrato"} → {pactBoonSummary(preview.after.pactBoonKey)?.label ?? "Da scegliere"}</div> : null}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"><span className="font-medium">{preview.before.subclassLabel ?? "Nessuna sottoclasse registrata"}</span><ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><span className="font-medium">{preview.after.subclassLabel ?? "—"}</span></div></div>
        {preview.before.draconicAncestryKey || preview.after.draconicAncestryKey || preview.draconicAncestryRequired ? <div className="rounded-lg border p-3 text-sm">
          Antenato draconico: {draconicAncestrySummary(preview.before.draconicAncestryKey)?.label ?? "Non registrato"}
          {" → "}{draconicAncestrySummary(preview.after.draconicAncestryKey ?? preview.draconicAncestryKey)?.label ?? (preview.draconicAncestryRequired ? "Da scegliere" : "Nessuno")}
        </div> : null}
        <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Effetti della registrazione</p><p className="mt-1 text-muted-foreground">Livello: {preview.effects.characterLevel.before} → {preview.effects.characterLevel.after}. PF: {displayValue(preview.effects.hitPoints.before)} → {displayValue(preview.effects.hitPoints.after)}.</p><p className="mt-1 text-muted-foreground">Privilegi, incantesimi e contenuti già gestiti manualmente restano invariati.</p></div>
        {preview.effects.spellSlots.maximumDeltas.length || preview.effects.spellSlots.preservedExpended.length ? <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Slot incantesimi</p>{preview.effects.spellSlots.maximumDeltas.map((slot) => <p key={`maximum-${slot.tier}`} className="text-muted-foreground">Massimo L{slot.tier}: {slot.before} → {slot.after}</p>)}{preview.effects.spellSlots.preservedExpended.map((slot) => <p key={`used-${slot.tier}`} className="text-muted-foreground">Usi consumati L{slot.tier}: {slot.before} → {slot.after}</p>)}</div> : null}
        {[...preview.warnings, ...preview.effects.spellSlots.warnings].length ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950"><p className="font-medium">Da verificare</p><ul className="mt-1 list-disc space-y-1 pl-5">{[...preview.warnings, ...preview.effects.spellSlots.warnings].map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div> : null}
        {!preview.canApply && preview.status !== "ALREADY_SELECTED" ? <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-950">{preview.reason ?? "La registrazione non è applicabile nello stato corrente."}</div> : null}
      </div> : null}
      {refreshRequired ? <p className="text-sm text-muted-foreground">{refreshFailed ? "Ricarica la pagina prima di creare una nuova anteprima." : "L'anteprima non è più valida: aggiornala prima di confermare."}</p> : null}
      <DialogFooter><Button type="button" variant="outline" onClick={() => void loadPreview()} disabled={!selectedClassKey || refreshFailed || loadingPreview || applying || Boolean(pending)}>Aggiorna anteprima</Button>{pending ? <Button type="button" onClick={() => void apply()} disabled={applying}>{applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applicazione…</> : "Riprova stessa conferma"}</Button> : <Button type="button" onClick={() => void apply()} disabled={!preview?.canApply || !selectedSubclassKey || !previewIsFresh || !hasRevisionTokens || !reasonValid || loadingPreview || applying || refreshRequired}>{applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applicazione…</> : "Conferma registrazione"}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
