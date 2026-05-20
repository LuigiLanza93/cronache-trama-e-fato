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
  fetchPlayerCampaignDocumentsRequest,
  fetchPlayerCampaignEventsRequest,
  type CampaignDocumentEntry,
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
    languages?: string[];
  } | null;
};

const LANGUAGE_ALIASES: Record<string, string> = {
  common: "comune",
  elvish: "elfico",
  dwarvish: "nanico",
  halfling: "halfling",
  gnomish: "gnomesco",
  draconic: "draconico",
  goblin: "goblin",
  orc: "orchesco",
  infernal: "infernale",
  abyssal: "abissale",
  celestial: "celestiale",
  primordial: "primordiale",
  sylvan: "silvano",
  undercommon: "sottocomune",
  deep: "sottocomune",
  "thieves cant": "gergo ladresco",
  "thief cant": "gergo ladresco",
  cant: "gergo ladresco",
  ladresco: "gergo ladresco",
  auran: "auran",
  aquan: "aquan",
  ignan: "ignan",
  terran: "terran",
};

type LanguageObfuscationProfile = {
  glyphs: string[];
  preserveWordLength: boolean;
  fontClass: string;
};

function codepointGlyphs(...codepoints: number[]) {
  return codepoints.map((codepoint) => String.fromCodePoint(codepoint));
}

const languageObfuscationProfiles: Record<string, LanguageObfuscationProfile> = {
  elfico: {
    glyphs: codepointGlyphs(
      0xe000,
      0xe001,
      0xe002,
      0xe003,
      0xe004,
      0xe005,
      0xe006,
      0xe007,
      0xe008,
      0xe009,
      0xe00a,
      0xe00b,
      0xe00c,
      0xe00d,
      0xe00e,
      0xe00f
    ),
    preserveWordLength: true,
    fontClass: "font-obfuscation-script",
  },
  silvano: {
    glyphs: codepointGlyphs(
      0xe010,
      0xe011,
      0xe012,
      0xe013,
      0xe014,
      0xe015,
      0xe016,
      0xe017,
      0xe018,
      0xe019,
      0xe01a,
      0xe01b,
      0xe01c,
      0xe01d,
      0xe01e
    ),
    preserveWordLength: true,
    fontClass: "font-obfuscation-script",
  },
  nanico: {
    glyphs: Array.from("ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉ"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-runic",
  },
  gnomesco: {
    glyphs: Array.from("ᛟᛞᛝᛗᛚᛁᛜᛃᛇᛈᛉᚱᚲᚷᚹ"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-runic",
  },
  gigante: {
    glyphs: Array.from("ᛏᛒᛖᛗᛟᛞᚾᚺᚱᚲᚷᚠᚢᚦᚨ"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-runic",
  },
  draconico: {
    glyphs: codepointGlyphs(
      0x03de,
      0x03e0,
      0x03da,
      0x03d8,
      0x03d7,
      0x03d1,
      0x03d2,
      0x03dc,
      0x03df,
      0x03ea,
      0x03ec,
      0x03ee,
      0x03f0,
      0x03f7,
      0x03f9
    ),
    preserveWordLength: true,
    fontClass: "font-obfuscation-draconic",
  },
  infernale: {
    glyphs: codepointGlyphs(
      0x10330,
      0x10331,
      0x10332,
      0x10333,
      0x10334,
      0x10335,
      0x10336,
      0x10337,
      0x10339,
      0x1033a,
      0x1033b,
      0x1033c,
      0x1033d,
      0x1033e,
      0x1033f
    ),
    preserveWordLength: true,
    fontClass: "font-obfuscation-infernal",
  },
  abissale: {
    glyphs: Array.from("⌁⌂⌘⌬⌭⌯⌰⌱⌲⌳⌾⍟⍣⍥⎊"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  celestiale: {
    glyphs: Array.from("✶✷✸✹✺✻✼✽✾✿❂❃❉❋✥"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-celestial",
  },
  primordiale: {
    glyphs: Array.from("△▽◇◆○●◐◒◓◌◍◎◈◊◬"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  auran: {
    glyphs: Array.from("⌁⌇⌒⌓⌕⌖⌗⌑⌔⌐⌙⌜⌝⌞⌟"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  aquan: {
    glyphs: Array.from("≈≋∿⌇⌁◌◍◜◝◞◟◠◡◦○"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  ignan: {
    glyphs: Array.from("▲△▴▵◭◮◬◫✦✧✹✺✶✷✸"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  terran: {
    glyphs: Array.from("■□▣▤▥▦▧▨▩◆◇◈◧◨◩"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  sottocomune: {
    glyphs: Array.from("⟊⟑⟒⟓⟔⟕⟖⟗⟠⟡⟢⟣⟤⟥⟦"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  goblin: {
    glyphs: Array.from("ꝾꝿꜾꜿꞆꞇꞂꞃꞀꞁꝀꝁꝂꝃꝄ"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-ancient",
  },
  orchesco: {
    glyphs: Array.from("ᛉᛊᛏᛚᛜᛞᚱᚲᚷᚺᚾᚢᚦᚨᚹ"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-runic",
  },
  halfling: {
    glyphs: Array.from("꘎꘏ꘐꘑꘒꘓꘔꘕꘖꘗꘘꘙꘚꘛꘜ"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-script",
  },
  "gergo ladresco": {
    glyphs: Array.from("◜◝◞◟⌜⌝⌞⌟⟐⟑⟒⟓⟔⟕⟖"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-symbols",
  },
  default: {
    glyphs: Array.from("ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉ"),
    preserveWordLength: true,
    fontClass: "font-obfuscation-runic",
  },
};

function normalizeLanguage(value: string | undefined | null) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

function canReadDocumentLanguage(documentLanguage: string, knownLanguages: string[] | undefined) {
  const language = normalizeLanguage(documentLanguage);
  if (!language || language === "comune") return true;
  return (knownLanguages ?? []).some((known) => normalizeLanguage(known) === language);
}

function obfuscateMarkdown(content: string, language: string) {
  const profile = languageObfuscationProfiles[normalizeLanguage(language)] ?? languageObfuscationProfiles.default;
  const glyphs = profile.glyphs;
  let index = 0;
  return String(content || "Testo in lingua sconosciuta.")
    .split("\n")
    .map((line) => {
      const markdownPrefix = line.match(/^(\s{0,3}(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)?)/)?.[0] ?? "";
      const rest = line.slice(markdownPrefix.length);
      return markdownPrefix + rest.replace(/[\p{L}\p{N}]/gu, () => glyphs[index++ % glyphs.length]);
    })
    .join("\n");
}

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
  const [documents, setDocuments] = useState<CampaignDocumentEntry[]>([]);
  const [selectedSection, setSelectedSection] = useState<number | "background">("background");
  const [activeView, setActiveView] = useState<"diary" | "documents">("diary");
  const [backgroundMarkdown, setBackgroundMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);

    void Promise.all([
      fetchPlayerCampaignEventsRequest(),
      fetchPlayerCampaignDocumentsRequest(),
      initialCharacterSlug ? fetchCharacterBackstoryRequest(initialCharacterSlug) : Promise.resolve(null),
    ])
      .then(([payload, documentsPayload, backstory]) => {
        if (!active) return;
        setEvents(Array.isArray(payload.events) ? payload.events : []);
        setDocuments(Array.isArray(documentsPayload.documents) ? documentsPayload.documents : []);
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

  useEffect(() => {
    if (!open) setSelectedImage(null);
  }, [open]);

  const characterEvents = useMemo(
    () =>
      initialCharacterSlug
        ? events.filter((event) => event.visibleCharacters.some((character) => character.slug === initialCharacterSlug))
        : events,
    [events, initialCharacterSlug]
  );

  const characterDocuments = useMemo(
    () =>
      initialCharacterSlug
        ? documents.filter((document) => document.visibleCharacters.some((character) => character.slug === initialCharacterSlug))
        : documents,
    [documents, initialCharacterSlug]
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
  const knownLanguages = characterInfo?.languages ?? [];

  useEffect(() => {
    if (!open) return;
    setSelectedSection("background");
  }, [initialCharacterSlug, open]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden border-primary/20 bg-card/95 p-0">
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4">
          <DialogTitle className="font-heading text-3xl text-primary">Diario della Campagna</DialogTitle>
          <DialogDescription>Eventi, background e archivio narrativo di {characterName || "questo personaggio"}.</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={activeView === "diary" ? "default" : "outline"} size="sm" onClick={() => setActiveView("diary")}>
              <ScrollText className="mr-2 h-4 w-4" />
              Diario
            </Button>
            <Button type="button" variant={activeView === "documents" ? "default" : "outline"} size="sm" onClick={() => setActiveView("documents")}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Archivio documenti
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-border/60 bg-background/35 p-4 md:border-b-0 md:border-r">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {activeView === "documents" ? "Archivio" : "Sessioni"}
            </div>
            <div className="mt-3 space-y-2">
              {activeView === "documents" ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="w-full justify-between"
                >
                  <span>Documenti</span>
                  <Badge variant="secondary">{characterDocuments.length}</Badge>
                </Button>
              ) : (
                <>
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
                </>
              )}
              {!loading && activeView === "diary" && sessions.length === 0 ? (
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
            ) : activeView === "documents" ? (
              characterDocuments.length === 0 ? (
                <Card className="character-section">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    Nessun documento visibile per ora.
                  </div>
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {characterDocuments.map((document) => {
                    const canRead = canReadDocumentLanguage(document.language, knownLanguages);
                    const readableLanguage = canRead ? document.language : "Lingua sconosciuta";
                    const imageUrl = canRead ? document.imageUrl : document.unreadableImageUrl;
                    const obfuscationProfile =
                      languageObfuscationProfiles[normalizeLanguage(document.language)] ?? languageObfuscationProfiles.default;

                    return (
                    <Collapsible key={document.id}>
                      <Card className="character-section space-y-3">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="group flex w-full items-start justify-between gap-3 text-left"
                            aria-label={`Apri o chiudi ${document.title}`}
                          >
                            <span>
                              <span className="font-heading text-2xl font-semibold text-primary">{document.title}</span>
                              <span className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="outline">Sessione #{document.sessionNumber}</Badge>
                                <Badge variant="secondary">{document.kind === "image" ? "Immagine" : "Testo"}</Badge>
                                <Badge variant="outline">{readableLanguage}</Badge>
                              </span>
                            </span>
                            <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3">
                          {canRead && document.description ? (
                            <p className="text-sm text-muted-foreground">{document.description}</p>
                          ) : null}
                          {document.kind === "image" && imageUrl ? (
                            <button
                              type="button"
                              className="block w-full cursor-zoom-in rounded-md border border-border/70 bg-background/50 p-2 transition hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring"
                              onClick={() => setSelectedImage({ title: document.title, url: imageUrl ?? "" })}
                              aria-label={`Apri immagine ${document.title}`}
                            >
                              <img
                                src={imageUrl}
                                alt={document.title}
                                className="max-h-[55vh] w-full object-contain"
                              />
                            </button>
                          ) : document.kind === "image" ? (
                            <div className="rounded-md border border-dashed border-border/70 bg-background/45 px-4 py-8 text-center text-sm text-muted-foreground">
                              Testo in lingua sconosciuta
                            </div>
                          ) : (
                            canRead ? (
                              <CampaignEventMarkdown content={document.contentMarkdown || "Documento senza contenuto."} />
                            ) : (
                              <div className={obfuscationProfile.fontClass}>
                                <CampaignEventMarkdown content={obfuscateMarkdown(document.contentMarkdown, document.language)} />
                              </div>
                            )
                          )}
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                    );
                  })}
                </div>
              )
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
    <Dialog open={!!selectedImage} onOpenChange={(nextOpen) => !nextOpen && setSelectedImage(null)}>
      <DialogContent className="max-h-[94vh] max-w-[94vw] overflow-hidden border-primary/20 bg-card/95 p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-heading text-2xl text-primary">{selectedImage?.title ?? "Documento"}</DialogTitle>
          <DialogDescription>Immagine documento</DialogDescription>
        </DialogHeader>
        {selectedImage ? (
          <div className="min-h-0 overflow-auto rounded-md border border-border/70 bg-background/55 p-2">
            <img
              src={selectedImage.url}
              alt={selectedImage.title}
              className="mx-auto max-h-[78vh] max-w-full object-contain"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}
