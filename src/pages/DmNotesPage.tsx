import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  FileText,
  FolderOpen,
  Image as ImageIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  fetchDmNoteDocument,
  fetchDmNotesTree,
  getDmNoteAssetUrl,
  type DmNoteDocument,
  type DmNotesTreeEntry,
} from "@/lib/auth";

type NotesMarkdownListItem = {
  text: string;
  checked?: boolean;
  indent: number;
  line: number;
};

type NotesMarkdownBlock =
  | { type: "heading"; level: number; text: string; line: number }
  | { type: "paragraph"; lines: string[]; line: number }
  | { type: "list"; items: NotesMarkdownListItem[]; line: number }
  | { type: "blockquote"; lines: string[]; line: number }
  | { type: "table"; rows: string[][]; line: number }
  | { type: "hr"; line: number };

const LAST_OPEN_DM_NOTE_STORAGE_KEY = "ctf:dm-notes:last-open-path";

function formatNotesTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function flattenNoteFiles(entries: DmNotesTreeEntry[]): DmNotesTreeEntry[] {
  return entries.flatMap((entry) =>
    entry.kind === "directory" ? flattenNoteFiles(entry.children ?? []) : [entry]
  );
}

function findNoteEntryByPath(entries: DmNotesTreeEntry[], targetPath: string): DmNotesTreeEntry | null {
  for (const entry of entries) {
    if (entry.path === targetPath) return entry;
    if (entry.kind === "directory") {
      const nested = findNoteEntryByPath(entry.children ?? [], targetPath);
      if (nested) return nested;
    }
  }
  return null;
}

function parseMarkdownTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableDivider(line: string) {
  return /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line.trim());
}

function parseNotesMarkdown(content: string): NotesMarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: NotesMarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
        line: index,
      });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr", line: index });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      const startLine = index;
      while (index < lines.length) {
        const quoteRaw = lines[index].trimEnd();
        if (!quoteRaw.trim().startsWith(">")) break;
        quoteLines.push(quoteRaw.replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines, line: startLine });
      continue;
    }

    if (trimmed.startsWith("|")) {
      const rows: string[][] = [];
      const startLine = index;
      while (index < lines.length) {
        const tableLine = lines[index].trimEnd();
        if (!tableLine.trim().startsWith("|")) break;
        if (!isMarkdownTableDivider(tableLine)) {
          rows.push(parseMarkdownTableRow(tableLine));
        }
        index += 1;
      }
      if (rows.length > 0) {
        blocks.push({ type: "table", rows, line: startLine });
        continue;
      }
    }

    const checklistMatch = line.match(/^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/);
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (checklistMatch || bulletMatch) {
      const items: NotesMarkdownListItem[] = [];
      const startLine = index;
      while (index < lines.length) {
        const currentLine = lines[index].trimEnd();
        const currentChecklistMatch = currentLine.match(/^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/);
        const currentBulletMatch = currentLine.match(/^(\s*)[-*+]\s+(.*)$/);
        if (!currentChecklistMatch && !currentBulletMatch) break;
        items.push({
          text: (currentChecklistMatch?.[3] ?? currentBulletMatch?.[2] ?? "").trim(),
          checked: currentChecklistMatch ? currentChecklistMatch[2].toLowerCase() === "x" : undefined,
          indent: Math.floor(((currentChecklistMatch?.[1] ?? currentBulletMatch?.[1] ?? "").length || 0) / 2),
          line: index,
        });
        index += 1;
      }
      blocks.push({ type: "list", items, line: startLine });
      continue;
    }

    const paragraphLines = [trimmed];
    const startLine = index;
    index += 1;
    while (index < lines.length) {
      const nextRawLine = lines[index].trimEnd();
      const nextTrimmed = nextRawLine.trim();
      if (
        !nextTrimmed ||
        /^(#{1,6})\s+/.test(nextTrimmed) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrimmed) ||
        nextTrimmed.startsWith(">") ||
        nextTrimmed.startsWith("|") ||
        /^(\s*)[-*+]\s+/.test(nextRawLine)
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraphLines, line: startLine });
  }

  return blocks;
}

function getHeadingClasses(level: number) {
  if (level <= 1) return "font-heading text-3xl font-semibold text-primary";
  if (level === 2) return "font-heading text-2xl font-semibold text-primary";
  if (level === 3) return "font-heading text-xl font-semibold text-foreground";
  return "font-heading text-lg font-semibold text-foreground/90";
}

function resolveWikiLinkTarget(
  target: string,
  currentPath: string | null,
  allFiles: DmNotesTreeEntry[]
) {
  const normalizedTarget = target.trim().replace(/\\/g, "/");
  if (!normalizedTarget) return null;

  const currentDir = currentPath?.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/")) : "";
  const candidatePaths = new Set<string>([
    normalizedTarget,
    currentDir ? `${currentDir}/${normalizedTarget}` : normalizedTarget,
  ]);

  for (const candidate of candidatePaths) {
    const exactMatch = allFiles.find((entry) => entry.path === candidate);
    if (exactMatch) return exactMatch;
    const suffixMatch = allFiles.find((entry) => entry.path.endsWith(`/${candidate}`));
    if (suffixMatch) return suffixMatch;
  }

  const targetBaseName = normalizedTarget.split("/").pop() ?? normalizedTarget;
  const targetNameWithoutExtension = targetBaseName.replace(/\.[^.]+$/, "");
  return (
    allFiles.find((entry) => entry.name === targetBaseName) ??
    allFiles.find((entry) => entry.name.replace(/\.[^.]+$/, "") === targetNameWithoutExtension) ??
    null
  );
}

function renderInlineMarkdown(
  text: string,
  options: {
    keyPrefix: string;
    currentPath: string | null;
    allFiles: DmNotesTreeEntry[];
    onOpenInternalLink: (path: string) => void;
  }
): ReactNode[] {
  const tokens = text.split(/(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|\*\*.*?\*\*|`.*?`|\*[^*]+\*)/g).filter(Boolean);

  return tokens.map((token, index) => {
    const key = `${options.keyPrefix}-${index}`;

    if (token.startsWith("[[") && token.endsWith("]]")) {
      const body = token.slice(2, -2);
      const [target, alias] = body.split("|");
      const resolved = resolveWikiLinkTarget(target ?? "", options.currentPath, options.allFiles);
      const label = (alias ?? target ?? "").trim();
      if (resolved) {
        return (
          <button
            key={key}
            type="button"
            className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"
            onClick={() => options.onOpenInternalLink(resolved.path)}
          >
            {label}
          </button>
        );
      }
      return (
        <span key={key} className="font-medium text-foreground/85">
          {label}
        </span>
      );
    }

    if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const match = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const [, label, href] = match;
        if (/^https?:\/\//i.test(href)) {
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-primary/80"
            >
              {label}
            </a>
          );
        }
      }
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={key} className="rounded bg-background px-1.5 py-0.5 text-[0.95em] text-foreground/90">
          {token.slice(1, -1)}
        </code>
      );
    }

    if (token.startsWith("*") && token.endsWith("*")) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }

    return <span key={key}>{token}</span>;
  });
}

const DmNotesPage = () => {
  const [dmNotesTree, setDmNotesTree] = useState<DmNotesTreeEntry[]>([]);
  const [dmNotesRootName, setDmNotesRootName] = useState("Appunti");
  const [selectedDmNotePath, setSelectedDmNotePath] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const storedPath = window.localStorage.getItem(LAST_OPEN_DM_NOTE_STORAGE_KEY);
    return storedPath && storedPath.trim() ? storedPath : null;
  });
  const [selectedDmNoteDocument, setSelectedDmNoteDocument] = useState<DmNoteDocument | null>(null);
  const [dmNotesExpandedPaths, setDmNotesExpandedPaths] = useState<string[]>([]);
  const [dmNotesCheckboxState, setDmNotesCheckboxState] = useState<Record<string, boolean>>({});
  const [collapsedHeadings, setCollapsedHeadings] = useState<Record<string, boolean>>({});
  const [dmNotesLoading, setDmNotesLoading] = useState(false);
  const [dmNotesDocumentLoading, setDmNotesDocumentLoading] = useState(false);
  const [dmNotesError, setDmNotesError] = useState("");

  useEffect(() => {
    document.title = "Appunti del DM | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;
    setDmNotesLoading(true);
    setDmNotesError("");

    void fetchDmNotesTree()
      .then((payload) => {
        if (!active) return;
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        const files = flattenNoteFiles(entries);
        setDmNotesTree(entries);
        setDmNotesRootName(payload?.rootName || "Appunti");
        setDmNotesExpandedPaths((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            if (entry.kind === "directory") next.add(entry.path);
          });
          return Array.from(next);
        });
        setSelectedDmNotePath((prev) => {
          if (prev && files.some((entry) => entry.path === prev)) return prev;
          return files[0]?.path ?? null;
        });
      })
      .catch((error) => {
        if (!active) return;
        setDmNotesTree([]);
        setDmNotesRootName("Appunti");
        setSelectedDmNotePath(null);
        setSelectedDmNoteDocument(null);
        setDmNotesError(error instanceof Error ? error.message : "Impossibile leggere il vault Obsidian.");
      })
      .finally(() => {
        if (active) setDmNotesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDmNotePath) {
      setSelectedDmNoteDocument(null);
      setDmNotesDocumentLoading(false);
      return;
    }

    const entry = findNoteEntryByPath(dmNotesTree, selectedDmNotePath);
    if (!entry) {
      setSelectedDmNoteDocument(null);
      setDmNotesDocumentLoading(false);
      return;
    }

    if (entry.fileType !== "markdown") {
      setSelectedDmNoteDocument(null);
      setDmNotesDocumentLoading(false);
      return;
    }

    let active = true;
    setDmNotesDocumentLoading(true);
    setDmNotesError("");

    void fetchDmNoteDocument(selectedDmNotePath)
      .then((document) => {
        if (active) setSelectedDmNoteDocument(document);
      })
      .catch((error) => {
        if (!active) return;
        setSelectedDmNoteDocument(null);
        setDmNotesError(error instanceof Error ? error.message : "Impossibile aprire la nota selezionata.");
      })
      .finally(() => {
        if (active) setDmNotesDocumentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dmNotesTree, selectedDmNotePath]);

  const dmNotesFiles = useMemo(() => flattenNoteFiles(dmNotesTree), [dmNotesTree]);
  const selectedDmNoteEntry = useMemo(
    () => (selectedDmNotePath ? findNoteEntryByPath(dmNotesTree, selectedDmNotePath) : null),
    [dmNotesTree, selectedDmNotePath]
  );
  const parsedDmMarkdown = useMemo(
    () => (selectedDmNoteDocument?.content ? parseNotesMarkdown(selectedDmNoteDocument.content) : []),
    [selectedDmNoteDocument]
  );
  const visibleDmMarkdown = useMemo(() => {
    const hiddenLevels: number[] = [];

    return parsedDmMarkdown.map((block, index) => {
      while (hiddenLevels.length > 0 && block.type === "heading" && block.level <= hiddenLevels[hiddenLevels.length - 1]) {
        hiddenLevels.pop();
      }

      const key = `${selectedDmNotePath ?? "note"}:${block.line}`;
      const visible = hiddenLevels.length === 0;
      const nextBlock = parsedDmMarkdown[index + 1];
      const canCollapse =
        block.type === "heading" &&
        !!nextBlock &&
        (nextBlock.type !== "heading" || nextBlock.level > block.level);
      const isCollapsed = block.type === "heading" ? collapsedHeadings[key] === true : false;

      if (block.type === "heading" && visible && canCollapse && isCollapsed) {
        hiddenLevels.push(block.level);
      }

      return {
        block,
        key,
        visible,
        canCollapse,
        isCollapsed,
      };
    });
  }, [collapsedHeadings, parsedDmMarkdown, selectedDmNotePath]);

  useEffect(() => {
    if (!selectedDmNotePath) return;

    const segments = selectedDmNotePath.split("/").slice(0, -1);
    if (segments.length === 0) return;

    setDmNotesExpandedPaths((prev) => {
      const expanded = new Set(prev);
      let currentPath = "";
      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        expanded.add(currentPath);
      }
      return Array.from(expanded);
    });
  }, [selectedDmNotePath]);

  useEffect(() => {
    setCollapsedHeadings({});
  }, [selectedDmNotePath]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (selectedDmNotePath) {
      window.localStorage.setItem(LAST_OPEN_DM_NOTE_STORAGE_KEY, selectedDmNotePath);
      return;
    }

    window.localStorage.removeItem(LAST_OPEN_DM_NOTE_STORAGE_KEY);
  }, [selectedDmNotePath]);

  const openDmNotePath = (notePath: string) => {
    setSelectedDmNotePath(notePath);
  };

  const toggleDmNotesFolder = (folderPath: string) => {
    setDmNotesExpandedPaths((prev) =>
      prev.includes(folderPath) ? prev.filter((path) => path !== folderPath) : [...prev, folderPath]
    );
  };

  const renderDmNotesTree = (entries: DmNotesTreeEntry[], depth = 0): ReactNode =>
    entries.map((entry) => {
      if (entry.kind === "directory") {
        const expanded = dmNotesExpandedPaths.includes(entry.path);
        return (
          <div key={entry.path} className="space-y-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-accent/45"
              style={{ paddingLeft: `${10 + depth * 14}px` }}
              onClick={() => toggleDmNotesFolder(entry.path)}
            >
              {expanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="truncate">{entry.name}</span>
            </button>
            {expanded ? <div className="space-y-1">{renderDmNotesTree(entry.children ?? [], depth + 1)}</div> : null}
          </div>
        );
      }

      const isSelected = selectedDmNotePath === entry.path;
      const Icon = entry.fileType === "markdown" ? FileText : entry.fileType === "image" ? ImageIcon : FileIcon;
      return (
        <button
          key={entry.path}
          type="button"
          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
            isSelected ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent/45"
          }`}
          style={{ paddingLeft: `${24 + depth * 14}px` }}
          onClick={() => openDmNotePath(entry.path)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{entry.name}</span>
        </button>
      );
    });

  const renderMarkdownLines = (lines: string[], keyPrefix: string) =>
    lines.map((line, lineIndex) => (
      <span key={`${keyPrefix}-${lineIndex}`}>
        {renderInlineMarkdown(line, {
          keyPrefix: `${keyPrefix}-${lineIndex}`,
          currentPath: selectedDmNoteDocument?.path ?? selectedDmNotePath,
          allFiles: dmNotesFiles,
          onOpenInternalLink: openDmNotePath,
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    ));

  const renderMarkdownBlock = (
    block: NotesMarkdownBlock,
    index: number,
    options?: { collapseKey?: string; canCollapse?: boolean; isCollapsed?: boolean }
  ) => {
    if (block.type === "heading") {
      return (
        <button
          key={`heading-${block.line}-${index}`}
          type="button"
          className={`flex w-full items-center gap-2 text-left ${options?.canCollapse ? "group" : ""}`}
          onClick={() => {
            if (!options?.canCollapse || !options.collapseKey) return;
            setCollapsedHeadings((prev) => ({
              ...prev,
              [options.collapseKey!]: !prev[options.collapseKey!],
            }));
          }}
        >
          {options?.canCollapse ? (
            options.isCollapsed ? (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            ) : (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            )
          ) : (
            <span className="w-4 shrink-0" aria-hidden="true" />
          )}
          <div className={getHeadingClasses(block.level)}>
            {renderInlineMarkdown(block.text, {
              keyPrefix: `heading-${block.line}-${index}`,
              currentPath: selectedDmNoteDocument?.path ?? selectedDmNotePath,
              allFiles: dmNotesFiles,
              onOpenInternalLink: openDmNotePath,
            })}
          </div>
        </button>
      );
    }

    if (block.type === "paragraph") {
      return (
        <p key={`paragraph-${block.line}-${index}`} className="text-[15px] leading-7 text-foreground/88">
          {renderMarkdownLines(block.lines, `paragraph-${block.line}-${index}`)}
        </p>
      );
    }

    if (block.type === "blockquote") {
      return (
        <blockquote
          key={`blockquote-${block.line}-${index}`}
          className="border-l-2 border-primary/30 pl-4 text-[15px] italic leading-7 text-muted-foreground"
        >
          {renderMarkdownLines(block.lines, `blockquote-${block.line}-${index}`)}
        </blockquote>
      );
    }

    if (block.type === "hr") {
      return <Separator key={`hr-${block.line}-${index}`} className="bg-primary/15" />;
    }

    if (block.type === "table") {
      const [headerRow, ...bodyRows] = block.rows;
      return (
        <div key={`table-${block.line}-${index}`} className="overflow-hidden rounded-2xl border border-border/60">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {headerRow.map((cell, cellIndex) => (
                    <th key={`head-${cellIndex}`} className="border-b border-border/60 px-3 py-2 text-left font-medium text-foreground/85">
                      {renderInlineMarkdown(cell, {
                        keyPrefix: `table-head-${block.line}-${cellIndex}`,
                        currentPath: selectedDmNoteDocument?.path ?? selectedDmNotePath,
                        allFiles: dmNotesFiles,
                        onOpenInternalLink: openDmNotePath,
                      })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="align-top odd:bg-background even:bg-muted/20">
                    {row.map((cell, cellIndex) => (
                      <td key={`cell-${rowIndex}-${cellIndex}`} className="border-t border-border/50 px-3 py-2 text-foreground/80">
                        {renderInlineMarkdown(cell, {
                          keyPrefix: `table-cell-${block.line}-${rowIndex}-${cellIndex}`,
                          currentPath: selectedDmNoteDocument?.path ?? selectedDmNotePath,
                          allFiles: dmNotesFiles,
                          onOpenInternalLink: openDmNotePath,
                        })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <ul key={`list-${block.line}-${index}`} className="space-y-2">
        {block.items.map((item) => {
          const checkboxKey = `${selectedDmNotePath ?? "note"}:${item.line}`;
          const checked = dmNotesCheckboxState[checkboxKey] ?? item.checked ?? false;
          return (
            <li
              key={`item-${item.line}`}
              className="flex items-start gap-3 text-[15px] leading-7 text-foreground/88"
              style={{ marginLeft: `${item.indent * 18}px` }}
            >
              {typeof item.checked === "boolean" ? (
                <Checkbox
                  checked={checked}
                  className="mt-1"
                  onCheckedChange={(value) =>
                    setDmNotesCheckboxState((prev) => ({
                      ...prev,
                      [checkboxKey]: value === true,
                    }))
                  }
                />
              ) : (
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden="true" />
              )}
              <span>
                {renderInlineMarkdown(item.text, {
                  keyPrefix: `list-${item.line}`,
                  currentPath: selectedDmNoteDocument?.path ?? selectedDmNotePath,
                  allFiles: dmNotesFiles,
                  onOpenInternalLink: openDmNotePath,
                })}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-primary/80">
              <FolderOpen className="h-3.5 w-3.5" />
              Vault Obsidian
            </div>
            <div>
              <h1 className="font-heading text-4xl font-bold text-primary">Appunti del DM</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Esplora cartelle, note Markdown, immagini e PDF del tuo vault direttamente dall&apos;app.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alla home
            </Link>
          </Button>
        </div>

        <Card className="character-section overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border/60 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-heading text-2xl font-semibold text-primary">{dmNotesRootName}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Le checklist restano cliccabili in lettura, mentre i wiki-link Obsidian aprono il file corrispondente quando viene trovato nel vault.
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              File supportati: <span className="font-medium text-foreground/85">{dmNotesFiles.length}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/45">
              <div className="border-b border-border/60 px-4 py-3">
                <div className="text-sm font-medium text-foreground/85">Esplora file</div>
                <div className="mt-1 text-xs text-muted-foreground">Cartelle a sinistra, anteprima a destra</div>
              </div>
              <ScrollArea className="h-[68vh]">
                <div className="space-y-1 p-3">
                  {dmNotesLoading ? (
                    <div className="rounded-xl border border-dashed border-primary/20 bg-background/55 px-3 py-4 text-sm text-muted-foreground">
                      Carico la struttura del vault...
                    </div>
                  ) : dmNotesTree.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-primary/20 bg-background/55 px-3 py-4 text-sm text-muted-foreground">
                      Nessun file `md`, immagine o `pdf` trovato nella cartella configurata.
                    </div>
                  ) : (
                    renderDmNotesTree(dmNotesTree)
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/35">
              <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground/90">
                    {selectedDmNoteEntry?.name ?? "Seleziona un file"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selectedDmNoteEntry?.path ?? "Apri una nota dal pannello a sinistra"}
                  </div>
                </div>
                {selectedDmNoteDocument ? (
                  <div className="text-xs text-muted-foreground">
                    Aggiornato: {formatNotesTimestamp(selectedDmNoteDocument.updatedAt)}
                  </div>
                ) : null}
              </div>

              <ScrollArea className="h-[68vh]">
                <div className="p-5">
                  {dmNotesError ? (
                    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
                      {dmNotesError}
                    </div>
                  ) : !selectedDmNoteEntry ? (
                    <div className="rounded-2xl border border-dashed border-primary/20 bg-background/55 px-4 py-8 text-sm text-muted-foreground">
                      Seleziona un documento per iniziare la lettura.
                    </div>
                  ) : selectedDmNoteEntry.fileType === "markdown" ? (
                    dmNotesDocumentLoading || !selectedDmNoteDocument ? (
                      <div className="rounded-2xl border border-dashed border-primary/20 bg-background/55 px-4 py-8 text-sm text-muted-foreground">
                        Apro la nota selezionata...
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {visibleDmMarkdown.map(({ block, visible, key, canCollapse, isCollapsed }, index) =>
                          visible ? renderMarkdownBlock(block, index, { collapseKey: key, canCollapse, isCollapsed }) : null
                        )}
                      </div>
                    )
                  ) : selectedDmNoteEntry.fileType === "image" ? (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">Anteprima immagine del vault.</div>
                      <img
                        src={getDmNoteAssetUrl(selectedDmNoteEntry.path)}
                        alt={selectedDmNoteEntry.name}
                        className="w-full rounded-2xl border border-border/60 bg-background object-contain"
                      />
                    </div>
                  ) : selectedDmNoteEntry.fileType === "pdf" ? (
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">Anteprima PDF integrata nel browser.</div>
                      <iframe
                        title={selectedDmNoteEntry.name}
                        src={getDmNoteAssetUrl(selectedDmNoteEntry.path)}
                        className="h-[60vh] w-full rounded-2xl border border-border/60 bg-background"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-primary/20 bg-background/55 px-4 py-8 text-sm text-muted-foreground">
                      Questo formato non ha ancora un renderer dedicato.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default DmNotesPage;
