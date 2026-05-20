import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, FileJson, FileText, FolderOpen, Home, ImageIcon, Pencil, Plus, Save, ScrollText, Trash2, Upload, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import CampaignEventMarkdown from "@/components/campaign-event-markdown";
import {
  applyDmCampaignEventsImportRequest,
  createDmCampaignDocumentRequest,
  createDmCampaignEventRequest,
  deleteDmCampaignDocumentRequest,
  deleteDmCampaignEventRequest,
  fetchDmCampaignDocumentsRequest,
  fetchDmCampaignEventsRequest,
  fetchDmCampaignSessionRequest,
  previewDmCampaignEventsImportRequest,
  publishDmCampaignDocumentRequest,
  reorderDmCampaignEventsRequest,
  updateDmCampaignDocumentRequest,
  uploadDmCampaignDocumentImageRequest,
  type CampaignDocumentEntry,
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

type DocumentDraft = {
  id: string | null;
  title: string;
  description: string;
  kind: "TEXT" | "IMAGE";
  language: string;
  contentMarkdown: string;
  imageUrl: string;
  unreadableImageUrl: string;
  sessionNumber: string;
  characterSlugs: string[];
};

const EMPTY_DOCUMENT_DRAFT: DocumentDraft = {
  id: null,
  title: "",
  description: "",
  kind: "TEXT",
  language: "Comune",
  contentMarkdown: "",
  imageUrl: "",
  unreadableImageUrl: "",
  sessionNumber: "",
  characterSlugs: [],
};

const DND_LANGUAGES = [
  "Comune",
  "Elfico",
  "Nanico",
  "Halfling",
  "Gnomesco",
  "Draconico",
  "Goblin",
  "Orchesco",
  "Gigante",
  "Abissale",
  "Celestiale",
  "Infernale",
  "Primordiale",
  "Silvano",
  "Sottocomune",
  "Gergo Ladresco",
  "Auran",
  "Aquan",
  "Ignan",
  "Terran",
];

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

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lettura file fallita."));
    reader.readAsDataURL(file);
  });
}

export default function DmCampaignLogPage() {
  const [activeWorkspace, setActiveWorkspace] = useState<"documents" | "events" | "new-event" | "import">("documents");
  const [characters, setCharacters] = useState<CampaignPg[]>([]);
  const [events, setEvents] = useState<CampaignEventEntry[]>([]);
  const [documents, setDocuments] = useState<CampaignDocumentEntry[]>([]);
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
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(EMPTY_DOCUMENT_DRAFT);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentImageUploading, setDocumentImageUploading] = useState<"image" | "unreadable" | null>(null);
  const [documentPublishingId, setDocumentPublishingId] = useState<string | null>(null);
  const [documentDeletingId, setDocumentDeletingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Diario della Campagna | Cronache della Trama e del Fato";
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchCharacters(), fetchDmCampaignSessionRequest(), fetchDmCampaignEventsRequest(), fetchDmCampaignDocumentsRequest()])
      .then(([characterItems, nextSessionState, eventsPayload, documentsPayload]) => {
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
        setDocumentDraft((prev) => ({ ...prev, sessionNumber: String(nextSessionState.currentSessionNumber || nextSessionState.suggestedSessionNumber || 1) }));
        setEvents(sortCampaignEvents(Array.isArray(eventsPayload.events) ? eventsPayload.events : []));
        setDocuments(Array.isArray(documentsPayload.documents) ? documentsPayload.documents : []);
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
  const documentLanguageOptions = useMemo(
    () => Array.from(new Set([...DND_LANGUAGES, documentDraft.language].filter(Boolean))),
    [documentDraft.language]
  );
  const sessionOptions = useMemo(
    () => Array.from(new Set(events.map((event) => event.sessionNumber))).sort((a, b) => b - a),
    [events]
  );
  const visibleEvents = useMemo(
    () => sessionFilter === "all" ? events : events.filter((event) => String(event.sessionNumber) === sessionFilter),
    [events, sessionFilter]
  );
  const documentSelectedSet = useMemo(() => new Set(documentDraft.characterSlugs), [documentDraft.characterSlugs]);
  const documentAllSelected = characters.length > 0 && documentDraft.characterSlugs.length === characters.length;

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
    setActiveWorkspace("events");
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

  const resetDocumentDraft = () => {
    setDocumentDraft({
      ...EMPTY_DOCUMENT_DRAFT,
      sessionNumber: String(sessionState?.currentSessionNumber ?? 1),
    });
  };

  const editDocument = (document: CampaignDocumentEntry) => {
    setActiveWorkspace("documents");
    setDocumentDraft({
      id: document.id,
      title: document.title,
      description: document.description,
      kind: document.kind === "image" ? "IMAGE" : "TEXT",
      language: document.language || "Comune",
      contentMarkdown: document.contentMarkdown,
      imageUrl: document.imageUrl ?? "",
      unreadableImageUrl: document.unreadableImageUrl ?? "",
      sessionNumber: document.sessionNumber ? String(document.sessionNumber) : String(sessionState?.currentSessionNumber ?? 1),
      characterSlugs: document.visibleCharacters.map((character) => character.slug),
    });
  };

  const toggleDocumentCharacter = (slug: string, checked: boolean) => {
    setDocumentDraft((prev) => ({
      ...prev,
      characterSlugs: checked
        ? Array.from(new Set([...prev.characterSlugs, slug]))
        : prev.characterSlugs.filter((entry) => entry !== slug),
    }));
  };

  const uploadDocumentImage = async (file: File | null, target: "image" | "unreadable") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un file immagine.");
      return;
    }
    setDocumentImageUploading(target);
    try {
      const data = await readFileAsBase64(file);
      const uploaded = await uploadDmCampaignDocumentImageRequest({
        fileName: file.name,
        contentType: file.type,
        data,
      });
      setDocumentDraft((prev) => ({
        ...prev,
        kind: "IMAGE",
        [target === "image" ? "imageUrl" : "unreadableImageUrl"]: uploaded.url,
      }));
      toast.success(target === "image" ? "Immagine documento caricata." : "Variante illeggibile caricata.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a caricare l'immagine.");
    } finally {
      setDocumentImageUploading(null);
    }
  };

  const saveDocument = async () => {
    if (!documentDraft.title.trim()) {
      toast.error("Inserisci un titolo documento.");
      return;
    }
    if (documentDraft.kind === "IMAGE" && !documentDraft.imageUrl.trim()) {
      toast.error("Per un documento immagine serve un URL immagine.");
      return;
    }

    const payload = {
      title: documentDraft.title.trim(),
      description: documentDraft.description.trim(),
      kind: documentDraft.kind,
      language: documentDraft.language.trim() || "Comune",
      contentMarkdown: documentDraft.contentMarkdown,
      imageUrl: documentDraft.imageUrl.trim() || null,
      unreadableImageUrl: documentDraft.unreadableImageUrl.trim() || null,
      characterSlugs: documentDraft.characterSlugs,
    };

    setDocumentSaving(true);
    try {
      const saved = documentDraft.id
        ? await updateDmCampaignDocumentRequest(documentDraft.id, payload)
        : await createDmCampaignDocumentRequest(payload);
      setDocuments((prev) => {
        const exists = prev.some((document) => document.id === saved.id);
        return exists ? prev.map((document) => document.id === saved.id ? saved : document) : [saved, ...prev];
      });
      setDocumentDraft((prev) => ({ ...prev, id: saved.id }));
      toast.success(documentDraft.id ? "Documento aggiornato." : "Documento salvato in bozza.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a salvare il documento.");
    } finally {
      setDocumentSaving(false);
    }
  };

  const publishDocument = async (document?: CampaignDocumentEntry) => {
    const sourceId = document?.id ?? documentDraft.id;
    if (!sourceId) {
      toast.error("Salva prima il documento come bozza.");
      return;
    }
    const sessionNumber = Number.parseInt(document ? String(document.sessionNumber ?? sessionState?.currentSessionNumber ?? 1) : documentDraft.sessionNumber, 10);
    const characterSlugs = document ? document.visibleCharacters.map((character) => character.slug) : documentDraft.characterSlugs;
    if (!Number.isFinite(sessionNumber) || sessionNumber <= 0) {
      toast.error("Numero sessione documento non valido.");
      return;
    }
    if (characterSlugs.length === 0) {
      toast.error("Seleziona almeno un PG destinatario.");
      return;
    }

    setDocumentPublishingId(sourceId);
    try {
      const published = await publishDmCampaignDocumentRequest(sourceId, { sessionNumber, characterSlugs });
      setDocuments((prev) => prev.map((entry) => entry.id === published.id ? published : entry));
      const refreshedEvents = await fetchDmCampaignEventsRequest();
      setEvents(sortCampaignEvents(Array.isArray(refreshedEvents.events) ? refreshedEvents.events : []));
      toast.success("Documento pubblicato nell'Archivio e registrato nel Diario.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a pubblicare il documento.");
    } finally {
      setDocumentPublishingId(null);
    }
  };

  const deleteDocument = async (document: CampaignDocumentEntry) => {
    const confirmed = window.confirm(`Eliminare "${document.title}" dall'Archivio documenti?`);
    if (!confirmed) return;

    setDocumentDeletingId(document.id);
    try {
      await deleteDmCampaignDocumentRequest(document.id);
      setDocuments((prev) => prev.filter((entry) => entry.id !== document.id));
      if (documentDraft.id === document.id) resetDocumentDraft();
      const refreshedEvents = await fetchDmCampaignEventsRequest();
      setEvents(sortCampaignEvents(Array.isArray(refreshedEvents.events) ? refreshedEvents.events : []));
      toast.success("Documento eliminato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a eliminare il documento.");
    } finally {
      setDocumentDeletingId(null);
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

        <Tabs value={activeWorkspace} onValueChange={(value) => setActiveWorkspace(value as typeof activeWorkspace)}>
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="documents">
              <FolderOpen className="mr-2 h-4 w-4" />
              Documenti
            </TabsTrigger>
            <TabsTrigger value="events">
              <ScrollText className="mr-2 h-4 w-4" />
              Cronologia
            </TabsTrigger>
            <TabsTrigger value="new-event">
              <Plus className="mr-2 h-4 w-4" />
              Nuovo evento
            </TabsTrigger>
            <TabsTrigger value="import">
              <FileJson className="mr-2 h-4 w-4" />
              Import
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <Card className="character-section">
            <div className="text-sm text-muted-foreground">Carico diario della campagna...</div>
          </Card>
        ) : (
          <div className={activeWorkspace === "documents" || activeWorkspace === "events" ? "grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]" : "grid max-w-3xl gap-6"}>
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

              <Card className={activeWorkspace === "new-event" ? "character-section space-y-4" : "hidden"}>
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

              <Card className={activeWorkspace === "documents" ? "character-section space-y-4" : "hidden"}>
                <div className="flex items-center gap-2">
                  {documentDraft.kind === "IMAGE" ? <ImageIcon className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                  <h2 className="font-heading text-2xl font-semibold text-primary">Documento</h2>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-document-title">Titolo</Label>
                    <Input
                      id="campaign-document-title"
                      value={documentDraft.title}
                      onChange={(event) => setDocumentDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Lettera macchiata di cera"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="campaign-document-kind">Tipo</Label>
                      <select
                        id="campaign-document-kind"
                        value={documentDraft.kind}
                        onChange={(event) => setDocumentDraft((prev) => ({ ...prev, kind: event.target.value === "IMAGE" ? "IMAGE" : "TEXT" }))}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="TEXT">Testo</option>
                        <option value="IMAGE">Immagine</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="campaign-document-language">Lingua</Label>
                      <select
                        id="campaign-document-language"
                        value={documentDraft.language}
                        onChange={(event) => setDocumentDraft((prev) => ({ ...prev, language: event.target.value }))}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {documentLanguageOptions.map((language) => (
                          <option key={language} value={language}>
                            {language}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-document-description">Descrizione breve</Label>
                    <Textarea
                      id="campaign-document-description"
                      value={documentDraft.description}
                      onChange={(event) => setDocumentDraft((prev) => ({ ...prev, description: event.target.value }))}
                      className="min-h-20 bg-background/80"
                      placeholder="Appunto interno per descrivere il documento nel registro."
                    />
                  </div>
                  {documentDraft.kind === "TEXT" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="campaign-document-content">Testo Markdown</Label>
                      <Textarea
                        id="campaign-document-content"
                        value={documentDraft.contentMarkdown}
                        onChange={(event) => setDocumentDraft((prev) => ({ ...prev, contentMarkdown: event.target.value }))}
                        className="min-h-44 bg-background/80"
                        placeholder="Contenuto del documento..."
                      />
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="campaign-document-image-file">Immagine documento</Label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            id="campaign-document-image-file"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => {
                              void uploadDocumentImage(event.target.files?.[0] ?? null, "image");
                              event.currentTarget.value = "";
                            }}
                          />
                          {documentImageUploading === "image" ? (
                            <span className="text-sm text-muted-foreground">Carico...</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="campaign-document-image">URL immagine</Label>
                        <Input
                          id="campaign-document-image"
                          value={documentDraft.imageUrl}
                          onChange={(event) => setDocumentDraft((prev) => ({ ...prev, imageUrl: event.target.value }))}
                          placeholder="/campaign-documents/pergamena.png"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="campaign-document-unreadable-file">Variante illeggibile</Label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            id="campaign-document-unreadable-file"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => {
                              void uploadDocumentImage(event.target.files?.[0] ?? null, "unreadable");
                              event.currentTarget.value = "";
                            }}
                          />
                          {documentImageUploading === "unreadable" ? (
                            <span className="text-sm text-muted-foreground">Carico...</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="campaign-document-unreadable-image">URL variante illeggibile</Label>
                        <Input
                          id="campaign-document-unreadable-image"
                          value={documentDraft.unreadableImageUrl}
                          onChange={(event) => setDocumentDraft((prev) => ({ ...prev, unreadableImageUrl: event.target.value }))}
                          placeholder="Opzionale"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-document-session">Sessione di conferimento</Label>
                    <Input
                      id="campaign-document-session"
                      type="number"
                      min={1}
                      value={documentDraft.sessionNumber}
                      onChange={(event) => setDocumentDraft((prev) => ({ ...prev, sessionNumber: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Destinatari pubblicazione</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDocumentDraft((prev) => ({
                            ...prev,
                            characterSlugs: documentAllSelected ? [] : characters.map((character) => character.slug),
                          }))
                        }
                      >
                        <Users className="mr-2 h-4 w-4" />
                        {documentAllSelected ? "Deseleziona tutti" : "Tutti i PG"}
                      </Button>
                    </div>
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/70 bg-background/45 p-2">
                      {characters.map((character) => (
                        <label key={`document-${character.slug}`} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/40">
                          <Checkbox
                            checked={documentSelectedSet.has(character.slug)}
                            onCheckedChange={(checked) => toggleDocumentCharacter(character.slug, checked === true)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{character.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void saveDocument()} disabled={documentSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {documentSaving ? "Salvo..." : documentDraft.id ? "Aggiorna bozza" : "Salva bozza"}
                    </Button>
                    <Button type="button" onClick={() => void publishDocument()} disabled={!documentDraft.id || documentPublishingId === documentDraft.id}>
                      <Upload className="mr-2 h-4 w-4" />
                      {documentPublishingId === documentDraft.id ? "Pubblico..." : "Pubblica"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetDocumentDraft}>
                      <X className="mr-2 h-4 w-4" />
                      Nuovo
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className={activeWorkspace === "import" ? "character-section space-y-4" : "hidden"}>
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

            <section className={activeWorkspace === "documents" || activeWorkspace === "events" ? "space-y-4" : "hidden"}>
              <div className={activeWorkspace === "documents" ? "space-y-4" : "hidden"}>
              <div>
                <h2 className="font-heading text-2xl font-bold text-primary">Archivio documenti</h2>
                <p className="text-sm text-muted-foreground">{documents.length} documenti censiti.</p>
              </div>
              {documents.length === 0 ? (
                <Card className="character-section">
                  <div className="text-sm text-muted-foreground">Nessun documento ancora censito.</div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {documents.map((document) => (
                    <Card key={document.id} className="character-section space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={document.sessionNumber ? "default" : "outline"}>
                              {document.sessionNumber ? `Sessione ${document.sessionNumber}` : "Bozza"}
                            </Badge>
                            <Badge variant="secondary">{document.kind === "image" ? "Immagine" : "Testo"}</Badge>
                            <Badge variant="outline">{document.language}</Badge>
                          </div>
                          <h3 className="mt-2 font-heading text-2xl font-semibold text-primary">{document.title}</h3>
                          {document.description ? (
                            <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {document.visibleCharacters.map((character) => (
                            <Badge key={`${document.id}-${character.slug}`} variant="secondary">{character.name}</Badge>
                          ))}
                        </div>
                      </div>
                      {document.kind === "image" && document.imageUrl ? (
                        <img
                          src={document.imageUrl}
                          alt={document.title}
                          className="max-h-72 rounded-md border border-border/70 object-contain"
                        />
                      ) : document.contentMarkdown ? (
                        <CampaignEventMarkdown content={document.contentMarkdown} />
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => editDocument(document)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifica
                        </Button>
                        <Button type="button" size="sm" onClick={() => void publishDocument(document)} disabled={document.visibleCharacters.length === 0 || documentPublishingId === document.id}>
                          <Upload className="mr-2 h-4 w-4" />
                          {document.sessionNumber ? "Ripubblica" : "Pubblica"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void deleteDocument(document)}
                          disabled={documentDeletingId === document.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Elimina
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              </div>

              <div className={activeWorkspace === "events" ? "space-y-4" : "hidden"}>
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
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
