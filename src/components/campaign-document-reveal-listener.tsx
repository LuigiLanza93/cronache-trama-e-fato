import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FolderOpen, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import CampaignEventMarkdown from "@/components/campaign-event-markdown";
import {
  canReadDocumentLanguage,
  languageObfuscationProfiles,
  normalizeCampaignDocumentLanguage,
  obfuscateMarkdown,
} from "@/components/campaign-log-dialog";
import { fetchCharacter, onCampaignDocumentReveal, type CampaignDocumentRevealPayload } from "@/realtime";

type RevealQueueEntry = CampaignDocumentRevealPayload & {
  knownLanguages: string[];
};

export default function CampaignDocumentRevealListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<RevealQueueEntry[]>([]);
  const seenRevealKeys = useRef(new Set<string>());

  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    return onCampaignDocumentReveal((payload) => {
      const key = `${payload.document.id}:${payload.character.slug}:${payload.document.updatedAt ?? payload.revealedAt}`;
      if (seenRevealKeys.current.has(key)) return;
      seenRevealKeys.current.add(key);
      void fetchCharacter(payload.character.slug)
        .then((characterData) => {
          const knownLanguages = Array.isArray(characterData?.proficiencies?.languages)
            ? characterData.proficiencies.languages
            : [];
          setQueue((current) => [...current, { ...payload, knownLanguages }]);
        })
        .catch(() => {
          setQueue((current) => [...current, { ...payload, knownLanguages: [] }]);
        });
    });
  }, [user]);

  const activeReveal = queue[0] ?? null;
  const document = activeReveal?.document ?? null;
  const canRead = document ? canReadDocumentLanguage(document.language, activeReveal?.knownLanguages ?? []) : true;
  const readableLanguage = document ? canRead ? document.language : "Lingua sconosciuta" : "";
  const imageUrl = document ? canRead ? document.imageUrl : document.unreadableImageUrl : null;
  const obfuscationProfile = document
    ? languageObfuscationProfiles[normalizeCampaignDocumentLanguage(document.language)] ?? languageObfuscationProfiles.default
    : languageObfuscationProfiles.default;
  const closeActive = () => setQueue((prev) => prev.slice(1));

  const openCharacterArchive = () => {
    if (!activeReveal) return;
    navigate(`/${activeReveal.character.slug}`);
    closeActive();
  };

  return (
    <Dialog open={!!activeReveal} onOpenChange={(open) => !open && closeActive()}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col overflow-hidden border-primary/25 bg-card/95 p-0">
        <DialogHeader>
          <div className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="font-heading text-3xl text-primary">Documento rivelato</DialogTitle>
          <DialogDescription>
            {activeReveal ? `${activeReveal.character.name} riceve un nuovo documento.` : ""}
          </DialogDescription>
          </div>
        </DialogHeader>
        {document ? (
          <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="rounded-md border border-border/70 bg-background/60 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
                  {document.kind === "image" ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Sessione #{document.sessionNumber ?? "?"}</Badge>
                    <Badge variant="secondary">{document.kind === "image" ? "Immagine" : "Testo"}</Badge>
                    <Badge variant="outline">{readableLanguage}</Badge>
                  </div>
                  <h2 className="mt-3 font-heading text-2xl font-semibold leading-tight text-primary">{document.title}</h2>
                  {canRead && document.description ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{document.description}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-background/55 p-4">
              {document.kind === "image" && imageUrl ? (
                <img
                  src={imageUrl}
                  alt={document.title}
                  className="mx-auto max-h-[60vh] max-w-full rounded-md object-contain"
                />
              ) : document.kind === "image" ? (
                <div className="rounded-md border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  Testo in lingua sconosciuta
                </div>
              ) : canRead ? (
                <CampaignEventMarkdown content={document.contentMarkdown || "Documento senza contenuto."} />
              ) : (
                <div className={obfuscationProfile.fontClass}>
                  <CampaignEventMarkdown content={obfuscateMarkdown(document.contentMarkdown, document.language)} />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-5 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeActive}>
              Chiudi
            </Button>
            <Button type="button" onClick={openCharacterArchive}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Apri archivio
            </Button>
          </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
