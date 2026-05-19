import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookMarked, Edit3, Save, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type CharacterBackstoryInfo = {
  slug: string;
  name: string;
  className?: string | null;
  level?: number | null;
  race?: string | null;
  background?: string | null;
  alignment?: string | null;
  portraitUrl?: string | null;
};

type CharacterBackstoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: CharacterBackstoryInfo | null;
  contentMarkdown: string;
  loading?: boolean;
  editable?: boolean;
  saving?: boolean;
  defaultEditing?: boolean;
  closeOnSave?: boolean;
  onSave?: (contentMarkdown: string) => Promise<void> | void;
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

function MarkdownBackstory({ content }: { content: string }) {
  const normalized = content.trim();

  if (!normalized) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-6 text-sm italic text-muted-foreground">
        Nessuna backstory ancora scritta.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[15px] leading-7 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="font-heading text-3xl font-bold leading-tight text-primary">{children}</h1>,
          h2: ({ children }) => <h2 className="font-heading text-2xl font-semibold leading-tight text-primary">{children}</h2>,
          h3: ({ children }) => <h3 className="font-heading text-xl font-semibold leading-tight text-primary">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 bg-primary/5 px-4 py-2 italic text-foreground/90">
              {children}
            </blockquote>
          ),
          hr: () => <div className="my-5 border-t border-border/70" />,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-border/70 bg-muted/40 px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-t border-border/50 px-3 py-2 align-top">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">{children}</code>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

function CharacterIdentityPanel({ character }: { character: CharacterBackstoryInfo }) {
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

export default function CharacterBackstoryDialog({
  open,
  onOpenChange,
  character,
  contentMarkdown,
  loading = false,
  editable = false,
  saving = false,
  defaultEditing = false,
  closeOnSave = false,
  onSave,
}: CharacterBackstoryDialogProps) {
  const [editing, setEditing] = useState(defaultEditing);
  const [draft, setDraft] = useState(contentMarkdown);

  useEffect(() => {
    if (!open) return;
    setDraft(contentMarkdown);
    setEditing(defaultEditing);
  }, [contentMarkdown, defaultEditing, open]);

  const title = useMemo(() => (character ? `Storia di ${character.name}` : "Backstory"), [character]);

  const handleSave = async () => {
    if (!onSave) return;
    await onSave(draft);
    setEditing(false);
    if (closeOnSave) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden border-primary/20 bg-card/95 p-0">
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle className="font-heading text-3xl text-primary">{title}</DialogTitle>
              <DialogDescription>
                {editable ? "Scrivi in Markdown e controlla l'anteprima prima di salvare." : "Memoria narrativa del personaggio."}
              </DialogDescription>
            </div>
            {editable && !editing ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit3 className="mr-2 h-4 w-4" />
                Modifica
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading || !character ? (
            <div className="rounded-md border border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
              Carico backstory...
            </div>
          ) : editing ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <BookMarked className="h-4 w-4" />
                  Markdown
                </div>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-[52vh] resize-y bg-background/80 font-mono text-sm leading-6"
                  placeholder={"# Origini\n\nScrivi qui la storia del personaggio..."}
                />
              </div>
              <div className="rounded-md border border-border/70 bg-background/55 p-4">
                <CharacterIdentityPanel character={character} />
                <MarkdownBackstory content={draft} />
                <div className="clear-both" />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border/70 bg-background/55 p-4">
              <CharacterIdentityPanel character={character} />
              <MarkdownBackstory content={contentMarkdown} />
              <div className="clear-both" />
            </div>
          )}
        </div>

        {editable && editing ? (
          <DialogFooter className="shrink-0 border-t border-border/70 bg-card/95 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              <X className="mr-2 h-4 w-4" />
              Annulla
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvo..." : "Salva backstory"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
