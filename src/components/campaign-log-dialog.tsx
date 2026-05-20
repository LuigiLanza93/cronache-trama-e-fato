import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, FolderOpen, ScrollText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import CampaignEventMarkdown from "@/components/campaign-event-markdown";
import {
  fetchCharacterBackstoryRequest,
  fetchPlayerCampaignEventsRequest,
  type CampaignEventEntry,
} from "@/lib/auth";

type CampaignLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCharacterSlug?: string | null;
  characterName?: string | null;
  characterInfo?: {
    slug: string;
    name: string;
    className?: string | null;
    level?: number | null;
    race?: string | null;
    background?: string | null;
    alignment?: string | null;
    portraitUrl?: string | null;
  } | null;
};

function getInitials(name: string | undefined | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function BackgroundIdentityPanel({
  character,
}: {
  character: NonNullable<CampaignLogDialogProps["characterInfo"]>;
}) {
  const portraitUrl = character.portraitUrl?.trim() ?? "";
  const classLine = [character.className, character.level ? `Lv ${character.level}` : null].filter(Boolean).join(" ");
  const rows = [
    ["Razza", character.race],
    ["Classe", classLine],
    ["Background", character.background],
    ["Allineamento", character.alignment],
  ].filter(([, value]) => String(value ?? "").trim());

  return (
    <aside className="mb-5 mr-0 w-full rounded-md border border-border/70 bg-background/65 p-3 shadow-sm sm:float-left sm:mr-5 sm:w-56">
      <Avatar className="h-40 w-full rounded-md border border-border bg-muted">
        {portraitUrl ? (
          <AvatarImage src={portraitUrl} alt={`Ritratto di ${character.name}`} className="object-cover" />
        ) : null}
        <AvatarFallback className="rounded-md bg-primary/10 font-heading text-4xl font-bold text-primary">
          {getInitials(character.name)}
        </AvatarFallback>
      </Avatar>
      <div className="mt-3 space-y-2">
        <div>
          <div className="font-heading text-xl font-semibold leading-tight text-primary">{character.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{character.slug}</div>
        </div>
        <div className="space-y-1 border-t border-border/60 pt-2 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground/90">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function CampaignLogDialog({
  open,
  onOpenChange,
  initialCharacterSlug,
  characterName,
  characterInfo,
}: CampaignLogDialogProps) {
  const [events, setEvents] = useState<CampaignEventEntry[]>([]);
  const [selectedSection, setSelectedSection] = useState<number | "background">("background");
  const [backgroundMarkdown, setBackgroundMarkdown] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);

    void Promise.all([
      fetchPlayerCampaignEventsRequest(),
      initialCharacterSlug ? fetchCharacterBackstoryRequest(initialCharacterSlug) : Promise.resolve(null),
    ])
      .then(([payload, backstory]) => {
        if (!active) return;
        setEvents(Array.isArray(payload.events) ? payload.events : []);
        setBackgroundMarkdown(backstory?.contentMarkdown ?? "");
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
  }, [open]);

  const characterEvents = useMemo(
    () =>
      initialCharacterSlug
        ? events.filter((event) => event.visibleCharacters.some((character) => character.slug === initialCharacterSlug))
        : events,
    [events, initialCharacterSlug]
  );

  const sessions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const event of characterEvents) {
      counts.set(event.sessionNumber, (counts.get(event.sessionNumber) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([sessionNumber, count]) => ({ sessionNumber, count }))
      .sort((a, b) => a.sessionNumber - b.sessionNumber);
  }, [characterEvents]);

  const filteredEvents = useMemo(
    () =>
      selectedSection === "background"
        ? []
        : characterEvents.filter((event) => event.sessionNumber === selectedSection),
    [characterEvents, selectedSection]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedSection("background");
  }, [initialCharacterSlug, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden border-primary/20 bg-card/95 p-0">
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4">
          <DialogTitle className="font-heading text-3xl text-primary">Diario della Campagna</DialogTitle>
          <DialogDescription>Eventi, background e archivio narrativo di {characterName || "questo personaggio"}.</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="default" size="sm">
              <ScrollText className="mr-2 h-4 w-4" />
              Diario
            </Button>
            <Button type="button" variant="outline" size="sm" disabled title="In arrivo">
              <FolderOpen className="mr-2 h-4 w-4" />
              Archivio documenti
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-border/60 bg-background/35 p-4 md:border-b-0 md:border-r">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessioni</div>
            <div className="mt-3 space-y-2">
              <Button
                type="button"
                variant={selectedSection === "background" ? "default" : "outline"}
                size="sm"
                className="w-full justify-between"
                onClick={() => setSelectedSection("background")}
              >
                <span>Background</span>
                <BookOpen className="h-4 w-4" />
              </Button>
              {sessions.map((session) => (
                <Button
                  key={session.sessionNumber}
                  type="button"
                  variant={selectedSection === session.sessionNumber ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => setSelectedSection(session.sessionNumber)}
                >
                  <span>Sessione #{session.sessionNumber}</span>
                  <Badge variant="secondary">{session.count}</Badge>
                </Button>
              ))}
              {!loading && sessions.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                  Nessuna sessione visibile.
                </div>
              ) : null}
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto px-5 py-5">
            {loading ? (
              <Card className="character-section">
                <div className="text-sm text-muted-foreground">Carico diario della campagna...</div>
              </Card>
            ) : selectedSection === "background" ? (
              <Card className="character-section space-y-3">
                <div>
                  <Badge variant="outline">Background</Badge>
                  <h2 className="mt-2 font-heading text-2xl font-semibold text-primary">
                    {characterName ? `Background di ${characterName}` : "Background"}
                  </h2>
                </div>
                {characterInfo ? <BackgroundIdentityPanel character={characterInfo} /> : null}
                <CampaignEventMarkdown content={backgroundMarkdown || "Nessun background ancora scritto."} />
                <div className="clear-both" />
              </Card>
            ) : filteredEvents.length === 0 ? (
              <Card className="character-section">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <ScrollText className="h-5 w-5 text-primary" />
                  Nessun evento visibile per ora.
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((event) => (
                  <Collapsible key={event.id}>
                    <Card className="character-section space-y-3">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="group flex w-full items-center justify-between gap-3 text-left"
                          aria-label={`Apri o chiudi ${event.title}`}
                        >
                          <h2 className="font-heading text-2xl font-semibold text-primary">{event.title}</h2>
                          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CampaignEventMarkdown content={event.bodyMarkdown} />
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
