import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Home, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/components/ui/sonner";
import CampaignEventMarkdown from "@/components/campaign-event-markdown";
import { fetchPlayerCampaignEventsRequest, type CampaignEventEntry } from "@/lib/auth";

export default function PlayerCampaignLogPage() {
  const [events, setEvents] = useState<CampaignEventEntry[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Diario della Campagna | Cronache della Trama e del Fato";
  }, []);

  useEffect(() => {
    let active = true;
    void fetchPlayerCampaignEventsRequest()
      .then((payload) => {
        if (!active) return;
        setEvents(Array.isArray(payload.events) ? payload.events : []);
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

  const visibleCharacters = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const event of events) {
      for (const character of event.visibleCharacters) {
        bySlug.set(character.slug, character.name);
      }
    }
    return Array.from(bySlug.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [events]);

  const filteredEvents = useMemo(
    () =>
      selectedSlug === "all"
        ? events
        : events.filter((event) => event.visibleCharacters.some((character) => character.slug === selectedSlug)),
    [events, selectedSlug]
  );

  return (
    <div className="min-h-screen parchment px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Diario della Campagna</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Cronologia degli eventi che i tuoi personaggi hanno vissuto o scoperto.
            </p>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Torna alla home">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
        </section>

        {visibleCharacters.length > 1 ? (
          <Card className="character-section">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={selectedSlug === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSlug("all")}
              >
                Tutti
              </Button>
              {visibleCharacters.map((character) => (
                <Button
                  key={character.slug}
                  type="button"
                  variant={selectedSlug === character.slug ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSlug(character.slug)}
                >
                  {character.name}
                </Button>
              ))}
            </div>
          </Card>
        ) : null}

        {loading ? (
          <Card className="character-section">
            <div className="text-sm text-muted-foreground">Carico diario della campagna...</div>
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
                      className="group flex w-full flex-col gap-2 text-left sm:flex-row sm:items-start sm:justify-between"
                      aria-label={`Apri o chiudi ${event.title}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="font-heading text-2xl font-semibold text-primary">{event.title}</span>
                        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </span>
                      <span className="flex max-w-xl flex-wrap gap-1.5">
                        {event.visibleCharacters.map((character) => (
                          <Badge key={`${event.id}-${character.slug}`} variant="secondary">{character.name}</Badge>
                        ))}
                      </span>
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
  );
}
