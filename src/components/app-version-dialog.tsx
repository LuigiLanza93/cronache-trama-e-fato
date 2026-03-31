import { FileText } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_DISPLAY_VERSION, APP_RELEASE_DATE, APP_VERSION } from "@/lib/app-version";
import { getChangelogByVersion } from "@/data/changelogs";

type AppVersionDialogProps = {
  className?: string;
};

export function AppVersionDialog({ className }: AppVersionDialogProps) {
  const changelog = getChangelogByVersion(APP_VERSION);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "text-left text-xs uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-primary"
          }
        >
          {APP_DISPLAY_VERSION}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl border-border/70 bg-background/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-3xl text-primary">
            <FileText className="h-6 w-6" />
            {APP_DISPLAY_VERSION}
          </DialogTitle>
          <DialogDescription>
            {changelog?.releasedAt
              ? `Release del ${changelog.releasedAt}.`
              : APP_RELEASE_DATE
                ? `Release del ${APP_RELEASE_DATE}.`
                : "Dettaglio della release corrente."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {changelog?.summary ? (
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                {changelog.summary}
              </div>
            ) : null}

            {changelog?.sections?.length ? (
              <Accordion type="multiple" className="w-full space-y-2">
                {changelog.sections.map((section) => (
                  <AccordionItem
                    key={section.title}
                    value={section.title}
                    className="rounded-xl border border-border/60 bg-background/30 px-4"
                  >
                    <AccordionTrigger className="py-4 text-left font-heading text-2xl font-semibold text-primary hover:no-underline">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <ul className="space-y-2 pl-5 text-sm text-foreground/90">
                        {section.items.map((item) => (
                          <li key={item} className="list-disc marker:text-primary">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                Nessun changelog disponibile per questa versione.
              </div>
            )}
          </div>
        </ScrollArea>

      </DialogContent>
    </Dialog>
  );
}
