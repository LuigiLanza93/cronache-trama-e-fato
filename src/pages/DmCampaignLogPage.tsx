import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, FileJson, Home, Pencil, Plus, Save, ScrollText, Trash2, Upload, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import CampaignEventMarkdown from "@/components/campaign-event-markdown";
import {
  applyDmCampaignEventsImportRequest,
  createDmCampaignEventRequest,
  deleteDmCampaignEventRequest,
  fetchDmCampaignEventsRequest,
  fetchDmCampaignSessionRequest,
  previewDmCampaignEventsImportRequest,
  reorderDmCampaignEventsRequest,
  updateDmCampaignEventRequest,
  updateDmCampaignSessionRequest,
  type CampaignEventEntry,
  type CampaignEventImportResponse,
  type CampaignSessionStatePayload,
} from "@/lib/auth";
import { fetchCharacters } from "@/realtime";

type CharacterState = Record<string, any>;

type CampaignPg = {
  slug: string;
  name: string;
  className: string;
  level: number | null;
};

type EventDraft = {
  sessionNumber: string;
  sortOrder: string;
  title: string;
  bodyMarkdown: string;
  characterSlugs: string[];
};

function toCampaignPg(state: CharacterState): CampaignPg | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug || state?.characterType === "png") return null;
  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
  };
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

function sortCampaignEvents(events: CampaignEventEntry[]) {
  return events
    .slice()
    .sort(
      (a, b) =>
        b.sessionNumber - a.sessionNumber ||
        Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
        String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
    );
}

export default function DmCampaignLogPage() {
  const [characters, setCharacters] = useState<CampaignPg[]>([]);
  const [events, setEvents] = useState<CampaignEventEntry[]>([]);
  const [sessionState, setSessionState] = useState<CampaignSessionStatePayload | null>(null);
  const [sessionDraft, setSessionDraft] = useState("1");
  const [eventSession, setEventSession] = useState("1");
  const [eventSortOrder, setEventSortOrder] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventBody, setEventBody] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [importJson, setImportJson] = useState("");
  const [importPreview, setImportPreview] = useState<CampaignEventImportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<string>("all");

  useEffect(() => {
    document.title = "Diario della Campagna | Cronache della Trama e del Fato";
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchCharacters(), fetchDmCampaignSessionRequest(), fetchDmCampaignEventsRequest()])
      .then(([characterItems, nextSessionState, eventsPayload]) => {
        if (!active) return;
        const nextCharacters = Array.isArray(characterItems)
          ? characterItems
              .map((item) => toCampaignPg(item))
              .filter((item): item is CampaignPg => !!item)
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
          : [];
        setCharacters(nextCharacters);
        setSessionState(nextSessionState);
        setSessionDraft(String(nextSessionState.currentSessionNumber));
        setEventSession(String(nextSessionState.currentSessionNumber || nextSessionState.suggestedSessionNumber || 1));
        setEvents(sortCampaignEvents(Array.isArray(eventsPayload.events) ? eventsPayload.events : []));
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "Non sono riuscito a caricare il diario.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const allSelected = characters.length > 0 && selectedSlugs.length === characters.length;
  const sessionOptions = useMemo(
    () => Array.from(new Set(events.map((event) => event.sessionNumber))).sort((a, b) => b - a),
    [events]
  );
  const visibleEvents = useMemo(
    () => sessionFilter === "all" ? events : events.filter((event) => String(event.sessionNumber) === sessionFilter),
    [events, sessionFilter]
  );

  const toggleCharacter = (slug: string, checked: boolean) => {
    setSelectedSlugs((prev) => checked ? Array.from(new Set([...prev, slug])) : prev.filter((entry) => entry !== slug));
  };

  const saveSession = async () => {
    const next = Number.parseInt(sessionDraft, 10);
    if (!Number.isFinite(next) || next <= 0) {
      toast.error("Inserisci un numero sessione valido.");
      return;
    }

    setSessionSaving(true);
    try {
      const payload = await updateDmCampaignSessionRequest(next);
      setSessionState(payload);
      setSessionDraft(String(payload.currentSessionNumber));
      setEventSession(String(payload.currentSessionNumber));
      toast.success(`Sessione corrente impostata a ${payload.currentSessionNumber}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito ad aggiornare la sessione.");
    } finally {
      setSessionSaving(false);
    }
  };

  const createEvent = async () => {
    const sessionNumber = Number.parseInt(eventSession, 10);
    if (!Number.isFinite(sessionNumber) || sessionNumber <= 0) {
      toast.error("Numero sessione evento non valido.");
      return;
    }
    if (!eventTitle.trim()) {
      toast.error("Inserisci un titolo evento.");
      return;
    }
    if (selectedSlugs.length === 0) {
      toast.error("Seleziona almeno un PG destinatario.");
      return;
    }
    const sortOrder = eventSortOrder.trim() ? Number.parseInt(eventSortOrder, 10) : undefined;
    if (eventSortOrder.trim() && (!Number.isFinite(sortOrder) || sortOrder < 0)) {
      toast.error("Ordine evento non valido.");
      return;
    }

    setEventSaving(true);
    try {
      const created = await createDmCampaignEventRequest({
        sessionNumber,
        sortOrder,
        title: eventTitle.trim(),
        bodyMarkdown: eventBody,
        characterSlugs: selectedSlugs,
      });
      setEvents((prev) => sortCampaignEvents([created, ...prev]));
      setEventTitle("");
      setEventBody("");
      setEventSortOrder("");
      setSelectedSlugs([]);
      toast.success("Evento aggiunto al diario.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a creare l'evento.");
    } finally {
      setEventSaving(false);
    }
  };

  const parseImportJson = () => {
    try {
      return JSON.parse(importJson);
    } catch {
      toast.error("JSON non valido.");
      return null;
    }
  };

  const previewImport = async () => {
    const payload = parseImportJson();
    if (!payload) return;
    setImportPreviewLoading(true);

    try {
      const preview = await previewDmCampaignEventsImportRequest(payload);
      setImportPreview(preview);
      if (preview.ok) {
        toast.success(`Anteprima valida: ${preview.events.length} eventi pronti.`);
      } else {
        toast.warning(`Anteprima con ${preview.errors.length} errori.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a validare l'import.");
    } finally {
      setImportPreviewLoading(false);
    }
  };

  const applyImport = async () => {
    const payload = parseImportJson();
    if (!payload) return;
    setImportApplying(true);

    try {
      const result = await applyDmCampaignEventsImportRequest(payload);
      setImportPreview(result);
      if (!result.ok) {
        toast.error("Import bloccato: correggi gli errori indicati.");
        return;
      }
      const importedEvents = Array.isArray(result.importedEvents) ? result.importedEvents : [];
      const refreshed = await fetchDmCampaignEventsRequest();
      setEvents(sortCampaignEvents(Array.isArray(refreshed.events) ? refreshed.events : []));
      setImportJson("");
      setImportPreview(null);
      toast.success(`Importati ${importedEvents.length} eventi nel diario.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a importare gli eventi.");
    } finally {
      setImportApplying(false);
    }
  };

  const startEditing = (event: CampaignEventEntry) => {
    setEditingEventId(event.id);
    setEventDraft({
      sessionNumber: String(event.sessionNumber),
      sortOrder: String(event.sortOrder ?? 0),
      title: event.title,
      bodyMarkdown: event.bodyMarkdown,
      characterSlugs: event.visibleCharacters.map((character) => character.slug),
    });
  };

  const cancelEditing = () => {
    setEditingEventId(null);
    setEventDraft(null);
  };

  const toggleDraftCharacter = (slug: string, checked: boolean) => {
    setEventDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        characterSlugs: checked
          ? Array.from(new Set([...prev.characterSlugs, slug]))
          : prev.characterSlugs.filter((entry) => entry !== slug),
      };
    });
  };

  const saveEditedEvent = async () => {
    if (!editingEventId || !eventDraft) return;
    const sessionNumber = Number.parseInt(eventDraft.sessionNumber, 10);
    const sortOrder = Number.parseInt(eventDraft.sortOrder, 10);
    if (!Number.isFinite(sessionNumber) || sessionNumber <= 0) {
      toast.error("Numero sessione evento non valido.");
      return;
    }
    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      toast.error("Ordine evento non valido.");
      return;
    }
    if (!eventDraft.title.trim()) {
      toast.error("Inserisci un titolo evento.");
      return;
    }
    if (eventDraft.characterSlugs.length === 0) {
      toast.error("Seleziona almeno un PG destinatario.");
      return;
    }

    setEditingSaving(true);
    try {
      const updated = await updateDmCampaignEventRequest(editingEventId, {
        sessionNumber,
        sortOrder,
        title: eventDraft.title.trim(),
        bodyMarkdown: eventDraft.bodyMarkdown,
        characterSlugs: eventDraft.characterSlugs,
      });
      setEvents((prev) => sortCampaignEvents(prev.map((event) => event.id === updated.id ? updated : event)));
      cancelEditing();
      toast.success("Evento aggiornato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito ad aggiornare l'evento.");
    } finally {
      setEditingSaving(false);
    }
  };

  const deleteEvent = async (event: CampaignEventEntry) => {
    const confirmed = window.confirm(`Eliminare "${event.title}" dal diario?`);
    if (!confirmed) return;

    setDeletingEventId(event.id);
    try {
      await deleteDmCampaignEventRequest(event.id);
      setEvents((prev) => prev.filter((entry) => entry.id !== event.id));
      if (editingEventId === event.id) cancelEditing();
      toast.success("Evento eliminato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a eliminare l'evento.");
    } finally {
      setDeletingEventId(null);
    }
  };

  const moveEvent = async (eventId: string, direction: -1 | 1) => {
    const event = events.find((entry) => entry.id === eventId);
    const activeList = visibleEvents.filter((entry) => entry.sessionNumber === event?.sessionNumber);
    const index = activeList.findIndex((event) => event.id === eventId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= activeList.length) return;

    const targetEvent = activeList[nextIndex];
    const nextEvents = events.map((entry) => {
      if (entry.id === eventId) return { ...entry, sortOrder: targetEvent.sortOrder };
      if (entry.id === targetEvent.id) return { ...entry, sortOrder: event?.sortOrder ?? entry.sortOrder };
      return entry;
    });
    setEvents(sortCampaignEvents(nextEvents));
    setReordering(true);
    try {
      const payload = await reorderDmCampaignEventsRequest(eventId, targetEvent.id);
      setEvents(sortCampaignEvents(Array.isArray(payload.events) ? payload.events : nextEvents));
      toast.success("Ordine aggiornato.");
    } catch (error) {
      setEvents(events);
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a riordinare gli eventi.");
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Diario della Campagna</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Crea eventi narrativi, assegna la visibilita ai PG e tieni ordinata la cronologia della campagna.
            </p>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Torna alla home">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
        </section>

        {loading ? (
          <Card className="character-section">
            <div className="text-sm text-muted-foreground">Carico diario della campagna...</div>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="character-section space-y-4">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-2xl font-semibold text-primary">Sessione Corrente</h2>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="campaign-session-number">Numero sessione</Label>
                  <div className="flex gap-2">
                    <Input
                      id="campaign-session-number"
                      type="number"
                      min={1}
                      value={sessionDraft}
                      onChange={(event) => setSessionDraft(event.target.value)}
                    />
                    <Button type="button" onClick={() => void saveSession()} disabled={sessionSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      Salva
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/55 px-3 py-2 text-xs text-muted-foreground">
                  Ultima sessione nel diario: {sessionState?.lastSessionNumber || "nessuna"}.
                  Suggerita: {sessionState?.suggestedSessionNumber ?? 1}.
                </div>
              </Card>

              <Card className="character-section space-y-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-2xl font-semibold text-primary">Nuovo Evento</h2>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="campaign-event-session">Sessione</Label>
                      <Input
                        id="campaign-event-session"
                        type="number"
                        min={1}
                        value={eventSession}
                        onChange={(event) => setEventSession(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="campaign-event-sort-order">Ordine</Label>
                      <Input
                        id="campaign-event-sort-order"
                        type="number"
                        min={0}
                        value={eventSortOrder}
                        onChange={(event) => setEventSortOrder(event.target.value)}
                        placeholder="Automatico"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-event-title">Titolo</Label>
                    <Input
                      id="campaign-event-title"
                      value={eventTitle}
                      onChange={(event) => setEventTitle(event.target.value)}
                      placeholder="Una scritta sul muro"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-event-body">Testo Markdown</Label>
                    <Textarea
                      id="campaign-event-body"
                      value={eventBody}
                      onChange={(event) => setEventBody(event.target.value)}
                      className="min-h-40 bg-background/80"
                      placeholder="Descrivi l'evento, l'indizio o la scena..."
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Destinatari</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSlugs(allSelected ? [] : characters.map((character) => character.slug))}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        {allSelected ? "Deseleziona tutti" : "Tutti i PG"}
                      </Button>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border/70 bg-background/45 p-2">
                      {characters.map((character) => (
                        <label key={character.slug} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/40">
                          <Checkbox
                            checked={selectedSet.has(character.slug)}
                            onCheckedChange={(checked) => toggleCharacter(character.slug, checked === true)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{character.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {character.className || "Classe?"}
                            {character.level ? ` ${character.level}` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="button" onClick={() => void createEvent()} disabled={eventSaving}>
                    <Check className="mr-2 h-4 w-4" />
                    {eventSaving ? "Creo..." : "Aggiungi al diario"}
                  </Button>
                </div>
              </Card>

              <Card className="character-section space-y-4">
                <div className="flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-2xl font-semibold text-primary">Import JSON</h2>
                </div>
                <div className="space-y-3">
                  <div className="rounded-md border border-border/70 bg-background/55 px-3 py-2 text-xs text-muted-foreground">
                    Formato: array o oggetto con `events`. Campi accettati: `sessionNumber`, `sortOrder`, `title`, `bodyMarkdown`, `visibleTo`.
                    In `visibleTo` puoi usare slug, nome PG, oppure `all`. Ordine piu basso = evento mostrato prima nella sessione; l'automatico avanza di 100 per sessione.
                  </div>
                  <Textarea
                    value={importJson}
                    onChange={(event) => {
                      setImportJson(event.target.value);
                      setImportPreview(null);
                    }}
                    className="min-h-56 bg-background/80 font-mono text-xs leading-5"
                    placeholder={`{
  "events": [
    {
      "sessionNumber": 1,
      "sortOrder": 100,
      "title": "Risveglio",
      "bodyMarkdown": "Vi svegliate in una cella...",
      "visibleTo": ["all"]
    }
  ]
}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void previewImport()}
                      disabled={!importJson.trim() || importPreviewLoading || importApplying}
                    >
                      <FileJson className="mr-2 h-4 w-4" />
                      {importPreviewLoading ? "Controllo..." : "Anteprima"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void applyImport()}
                      disabled={!importPreview?.ok || importApplying || importPreviewLoading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {importApplying ? "Importo..." : "Importa eventi"}
                    </Button>
                  </div>
                  {importPreview ? (
                    <div className="space-y-3 rounded-md border border-border/70 bg-background/45 p-3">
                      {importPreview.errors.length > 0 ? (
                        <div className="space-y-1 text-sm text-destructive">
                          {importPreview.errors.map((error) => (
                            <div key={error}>{error}</div>
                          ))}
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Eventi riconosciuti: {importPreview.events.length}
                        </div>
                        {importPreview.events.slice(0, 8).map((event) => (
                          <div key={event.index} className="rounded border border-border/60 bg-background/50 px-3 py-2 text-sm">
                            <div className="font-medium text-primary">
                              #{event.index} - Sessione {event.sessionNumber ?? "?"}, ordine {event.sortOrder ?? "auto"}: {event.title || "Senza titolo"}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Destinatari: {event.visibleCharacters.map((character) => character.name).join(", ") || "-"}
                            </div>
                          </div>
                        ))}
                        {importPreview.events.length > 8 ? (
                          <div className="text-xs text-muted-foreground">
                            Altri {importPreview.events.length - 8} eventi non mostrati in anteprima.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-primary">Cronologia</h2>
                  <p className="text-sm text-muted-foreground">
                    {visibleEvents.length} di {events.length} eventi registrati.
                  </p>
                </div>
                <div className="grid gap-2 sm:w-52">
                  <Label htmlFor="campaign-session-filter">Filtra sessione</Label>
                  <select
                    id="campaign-session-filter"
                    value={sessionFilter}
                    onChange={(event) => setSessionFilter(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Tutte le sessioni</option>
                    {sessionOptions.map((sessionNumber) => (
                      <option key={sessionNumber} value={String(sessionNumber)}>
                        Sessione #{sessionNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {visibleEvents.length === 0 ? (
                <Card className="character-section">
                  <div className="text-sm text-muted-foreground">Nessun evento ancora registrato.</div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {visibleEvents.map((event, index) => {
                    const isEditing = editingEventId === event.id && eventDraft;
                    const draftSelectedSet = new Set(eventDraft?.characterSlugs ?? []);
                    const draftAllSelected = eventDraft ? eventDraft.characterSlugs.length === characters.length && characters.length > 0 : false;
                    const sameSessionEvents = visibleEvents.filter((entry) => entry.sessionNumber === event.sessionNumber);
                    const sameSessionIndex = sameSessionEvents.findIndex((entry) => entry.id === event.id);

                    return (
                      <Card key={event.id} className="character-section space-y-3">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline">Modifica evento</Badge>
                              <Button type="button" variant="ghost" size="icon" onClick={cancelEditing} aria-label="Annulla modifica">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-[140px_140px_minmax(0,1fr)]">
                              <div className="grid gap-2">
                                <Label htmlFor={`edit-session-${event.id}`}>Sessione</Label>
                                <Input
                                  id={`edit-session-${event.id}`}
                                  type="number"
                                  min={1}
                                  value={eventDraft.sessionNumber}
                                  onChange={(changeEvent) => setEventDraft((prev) => prev ? { ...prev, sessionNumber: changeEvent.target.value } : prev)}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`edit-order-${event.id}`}>Ordine</Label>
                                <Input
                                  id={`edit-order-${event.id}`}
                                  type="number"
                                  min={0}
                                  value={eventDraft.sortOrder}
                                  onChange={(changeEvent) => setEventDraft((prev) => prev ? { ...prev, sortOrder: changeEvent.target.value } : prev)}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`edit-title-${event.id}`}>Titolo</Label>
                                <Input
                                  id={`edit-title-${event.id}`}
                                  value={eventDraft.title}
                                  onChange={(changeEvent) => setEventDraft((prev) => prev ? { ...prev, title: changeEvent.target.value } : prev)}
                                />
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`edit-body-${event.id}`}>Testo Markdown</Label>
                              <Textarea
                                id={`edit-body-${event.id}`}
                                value={eventDraft.bodyMarkdown}
                                onChange={(changeEvent) => setEventDraft((prev) => prev ? { ...prev, bodyMarkdown: changeEvent.target.value } : prev)}
                                className="min-h-44 bg-background/80"
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label>Visibilita</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setEventDraft((prev) =>
                                      prev ? { ...prev, characterSlugs: draftAllSelected ? [] : characters.map((character) => character.slug) } : prev
                                    )
                                  }
                                >
                                  <Users className="mr-2 h-4 w-4" />
                                  {draftAllSelected ? "Deseleziona tutti" : "Tutti i PG"}
                                </Button>
                              </div>
                              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/70 bg-background/45 p-2">
                                {characters.map((character) => (
                                  <label key={`${event.id}-${character.slug}`} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/40">
                                    <Checkbox
                                      checked={draftSelectedSet.has(character.slug)}
                                      onCheckedChange={(checked) => toggleDraftCharacter(character.slug, checked === true)}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm">{character.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {character.className || "Classe?"}
                                      {character.level ? ` ${character.level}` : ""}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button type="button" variant="outline" onClick={cancelEditing}>Annulla</Button>
                              <Button type="button" onClick={() => void saveEditedEvent()} disabled={editingSaving}>
                                <Save className="mr-2 h-4 w-4" />
                                {editingSaving ? "Salvo..." : "Salva evento"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline">Sessione {event.sessionNumber}</Badge>
                                  <Badge variant="secondary">Ordine {event.sortOrder}</Badge>
                                </div>
                                <h3 className="mt-2 font-heading text-2xl font-semibold text-primary">{event.title}</h3>
                                <div className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</div>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="flex max-w-xl flex-wrap justify-end gap-1.5">
                                  {event.visibleCharacters.map((character) => (
                                    <Badge key={`${event.id}-${character.slug}`} variant="secondary">{character.name}</Badge>
                                  ))}
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void moveEvent(event.id, -1)}
                                    disabled={sameSessionIndex === 0 || reordering}
                                    aria-label="Sposta evento verso l'alto"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void moveEvent(event.id, 1)}
                                    disabled={sameSessionIndex === sameSessionEvents.length - 1 || reordering}
                                    aria-label="Sposta evento verso il basso"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => startEditing(event)} aria-label="Modifica evento">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void deleteEvent(event)}
                                    disabled={deletingEventId === event.id}
                                    aria-label="Elimina evento"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <CampaignEventMarkdown content={event.bodyMarkdown} />
                          </>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
