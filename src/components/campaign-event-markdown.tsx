import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CampaignEventMarkdown({ content }: { content: string }) {
  const normalized = content.trim();
  if (!normalized) {
    return <div className="text-sm italic text-muted-foreground">Nessun dettaglio aggiuntivo.</div>;
  }

  return (
    <div className="space-y-3 text-[15px] leading-7 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="font-heading text-2xl font-bold leading-tight text-primary">{children}</h1>,
          h2: ({ children }) => <h2 className="font-heading text-xl font-semibold leading-tight text-primary">{children}</h2>,
          h3: ({ children }) => <h3 className="font-heading text-lg font-semibold leading-tight text-primary">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 bg-primary/5 px-4 py-2 italic text-foreground/90">
              {children}
            </blockquote>
          ),
          hr: () => <div className="my-4 border-t border-border/70" />,
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
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">{children}</code>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
