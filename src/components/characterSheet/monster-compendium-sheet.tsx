import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, BookOpen, Eye } from "lucide-react";
import {
  fetchPlayerCompendiumMonster,
  fetchPlayerCompendiumMonsters,
  type PlayerCompendiumMonsterDetail,
  type PlayerCompendiumMonsterSummary,
} from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MonsterStatBlock, PlayerMonsterPreviewCard } from "@/pages/BestiaryManagement";

const COMPENDIUM_GRID = "minmax(168px,1.1fr) 92px 44px 68px minmax(112px,0.85fr) 64px minmax(108px,0.8fr) repeat(6, 78px)";
const COMPENDIUM_REFRESH_MS = 15000;

type CompendiumSortKey =
  | "name"
  | "knowledgeState"
  | "armorClass"
  | "hitPointsAverage"
  | "speedLabel"
  | "size"
  | "typeLabel"
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

type MonsterCompendiumSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "sheet" | "page";
};

function compareText(a: string, b: string) {
  return a.localeCompare(b, "it", { sensitivity: "base", numeric: true });
}

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined) {
  const left = typeof a === "number" ? a : Number.NEGATIVE_INFINITY;
  const right = typeof b === "number" ? b : Number.NEGATIVE_INFINITY;
  return left - right;
}

function knowledgeLabel(state: PlayerCompendiumMonsterSummary["knowledgeState"] | PlayerCompendiumMonsterDetail["knowledgeState"]) {
  return state === "COMPLETE" ? "Completa" : "Base";
}

function knowledgeBadgeClass(state: PlayerCompendiumMonsterSummary["knowledgeState"] | PlayerCompendiumMonsterDetail["knowledgeState"]) {
  return state === "COMPLETE"
    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
    : "border-sky-500/35 bg-sky-500/10 text-sky-100";
}

function AbilityCell({ value }: { value: string | null }) {
  if (value) {
    return <div className="text-[13px] text-foreground">{value}</div>;
  }

  return <span className="inline-flex h-4 w-16 rounded-full bg-foreground/15 blur-sm" aria-hidden="true" />;
}

function SortHeader({
  label,
  sortKey,
  activeSort,
  direction,
  onToggle,
}: {
  label: string;
  sortKey: CompendiumSortKey;
  activeSort: CompendiumSortKey;
  direction: "asc" | "desc";
  onToggle: (key: CompendiumSortKey) => void;
}) {
  const isActive = activeSort === sortKey;

  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-left transition-colors ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      onClick={() => onToggle(sortKey)}
    >
      <span>{label}</span>
      <ArrowUpDown className={`h-3 w-3 ${isActive ? "opacity-100" : "opacity-45"}`} />
    </button>
  );
}

export default function MonsterCompendiumSheet({
  open = true,
  onOpenChange,
  mode = "sheet",
}: MonsterCompendiumSheetProps) {
  const [items, setItems] = useState<PlayerCompendiumMonsterSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [knowledgeFilter, setKnowledgeFilter] = useState<"all" | "BASIC" | "COMPLETE">("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [armorClassMin, setArmorClassMin] = useState("");
  const [hitPointsMin, setHitPointsMin] = useState("");
  const [sortKey, setSortKey] = useState<CompendiumSortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerCompendiumMonsterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const shouldStayLive = mode === "page" || open;

  const loadCompendiumList = async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      const nextItems = await fetchPlayerCompendiumMonsters();
      setItems(nextItems);
      setHasLoaded(true);
      if (!background) setError(null);
    } catch {
      if (!background) {
        setError("Non riesco a leggere il compendio mostri.");
        setHasLoaded(true);
      }
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    if (!shouldStayLive || hasLoaded || loading) return;

    let active = true;
    void loadCompendiumList(false).then(() => {
      if (!active) return;
    });

    return () => {
      active = false;
    };
  }, [hasLoaded, loading, shouldStayLive]);

  useEffect(() => {
    if (!shouldStayLive || !hasLoaded) return;

    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState === "hidden" || cancelled) return;
      void loadCompendiumList(true);
    };

    const intervalId = window.setInterval(refresh, COMPENDIUM_REFRESH_MS);
    const handleVisibilityChange = () => refresh();
    const handleFocus = () => refresh();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [hasLoaded, shouldStayLive]);

  useEffect(() => {
    if (!selectedMonsterId) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);

    void fetchPlayerCompendiumMonster(selectedMonsterId)
      .then((payload) => {
        if (active) setDetail(payload);
      })
      .catch(() => {
        if (active) setDetail(null);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedMonsterId]);

  useEffect(() => {
    if (!shouldStayLive || !selectedMonsterId) return;

    let cancelled = false;
    const refreshDetail = () => {
      if (document.visibilityState === "hidden" || cancelled || !selectedMonsterId) return;
      void fetchPlayerCompendiumMonster(selectedMonsterId)
        .then((payload) => {
          if (!cancelled) setDetail(payload);
        })
        .catch(() => {
          if (!cancelled) setDetail(null);
        });
    };

    const intervalId = window.setInterval(refreshDetail, COMPENDIUM_REFRESH_MS);
    const handleVisibilityChange = () => refreshDetail();
    const handleFocus = () => refreshDetail();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedMonsterId, shouldStayLive]);

  const sizeOptions = useMemo(() => Array.from(new Set(items.map((item) => item.size).filter(Boolean))).sort(compareText), [items]);
  const typeOptions = useMemo(() => Array.from(new Set(items.map((item) => item.typeLabel).filter(Boolean))).sort(compareText), [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const nextItems = items.filter((item) => {
      if (knowledgeFilter !== "all" && item.knowledgeState !== knowledgeFilter) return false;
      if (sizeFilter !== "all" && item.size !== sizeFilter) return false;
      if (typeFilter !== "all" && item.typeLabel !== typeFilter) return false;
      if (armorClassMin && item.armorClass < Number(armorClassMin)) return false;
      if (hitPointsMin && item.hitPointsAverage < Number(hitPointsMin)) return false;
      if (!query) return true;

      return [
        item.name,
        item.typeLabel,
        item.size,
        item.speedLabel,
        item.strengthDisplay ?? "",
        item.dexterityDisplay ?? "",
        item.constitutionDisplay ?? "",
        item.intelligenceDisplay ?? "",
        item.wisdomDisplay ?? "",
        item.charismaDisplay ?? "",
      ].some((value) => value.toLowerCase().includes(query));
    });

    nextItems.sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      let comparison = 0;

      switch (sortKey) {
        case "name":
          comparison = compareText(left.name, right.name);
          break;
        case "knowledgeState":
          comparison = compareText(knowledgeLabel(left.knowledgeState), knowledgeLabel(right.knowledgeState));
          break;
        case "armorClass":
          comparison = compareNullableNumber(left.armorClass, right.armorClass);
          break;
        case "hitPointsAverage":
          comparison = compareNullableNumber(left.hitPointsAverage, right.hitPointsAverage);
          break;
        case "speedLabel":
          comparison = compareText(left.speedLabel, right.speedLabel);
          break;
        case "size":
          comparison = compareText(left.size, right.size);
          break;
        case "typeLabel":
          comparison = compareText(left.typeLabel, right.typeLabel);
          break;
        case "strength":
          comparison = compareNullableNumber(left.strengthScore, right.strengthScore);
          break;
        case "dexterity":
          comparison = compareNullableNumber(left.dexterityScore, right.dexterityScore);
          break;
        case "constitution":
          comparison = compareNullableNumber(left.constitutionScore, right.constitutionScore);
          break;
        case "intelligence":
          comparison = compareNullableNumber(left.intelligenceScore, right.intelligenceScore);
          break;
        case "wisdom":
          comparison = compareNullableNumber(left.wisdomScore, right.wisdomScore);
          break;
        case "charisma":
          comparison = compareNullableNumber(left.charismaScore, right.charismaScore);
          break;
      }

      return comparison * direction;
    });

    return nextItems;
  }, [armorClassMin, hitPointsMin, items, knowledgeFilter, search, sizeFilter, sortDirection, sortKey, typeFilter]);

  const handleSortToggle = (key: CompendiumSortKey) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        return current;
      }

      setSortDirection("asc");
      return key;
    });
  };

  const content = (
    <div className="flex h-full flex-col">
      {mode === "sheet" ? (
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="font-heading text-3xl text-primary">Compendio mostri</SheetTitle>
              <SheetDescription>Mostra solo le creature già conosciute, rispettando il livello di conoscenza disponibile.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
      ) : (
        <div className="border-b border-border/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-3xl text-primary">Compendio mostri</h1>
              <p className="text-sm text-muted-foreground">Mostra solo le creature già conosciute, rispettando il livello di conoscenza disponibile.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 border-b border-border/60 px-6 py-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.3fr)_repeat(3,minmax(140px,0.7fr))_120px_120px_auto] xl:items-end">
        <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Mostro</div><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca per nome o tipo" /></div>
        <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Conoscenza</div><Select value={knowledgeFilter} onValueChange={(value) => setKnowledgeFilter(value as "all" | "BASIC" | "COMPLETE")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutte</SelectItem><SelectItem value="BASIC">Base</SelectItem><SelectItem value="COMPLETE">Completa</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Taglia</div><Select value={sizeFilter} onValueChange={setSizeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutte</SelectItem>{sizeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tipo</div><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti</SelectItem>{typeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">CA min</div><Input value={armorClassMin} onChange={(event) => setArmorClassMin(event.target.value.replace(/[^\d]/g, ""))} placeholder="Es. 15" inputMode="numeric" /></div>
        <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">PF min</div><Input value={hitPointsMin} onChange={(event) => setHitPointsMin(event.target.value.replace(/[^\d]/g, ""))} placeholder="Es. 50" inputMode="numeric" /></div>
        <div className="self-center justify-self-end text-sm text-muted-foreground">{filteredItems.length} / {items.length} visibili</div>
      </div>

      <div className="min-h-0 flex-1 px-6 py-5">
        <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-border/60 bg-card/30">
          <div className="min-h-0 flex-1 overflow-auto">
            <div>
              <div className="sticky top-0 z-10 grid gap-1.5 border-b border-border/60 bg-[rgba(29,22,18,0.96)] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur" style={{ gridTemplateColumns: COMPENDIUM_GRID }}>
                <SortHeader label="Mostro" sortKey="name" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="Conoscenza" sortKey="knowledgeState" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="CA" sortKey="armorClass" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="PF medi" sortKey="hitPointsAverage" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="Velocità" sortKey="speedLabel" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="Taglia" sortKey="size" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="Tipo" sortKey="typeLabel" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="FOR" sortKey="strength" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="DES" sortKey="dexterity" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="COS" sortKey="constitution" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="INT" sortKey="intelligence" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="SAG" sortKey="wisdom" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
                <SortHeader label="CAR" sortKey="charisma" activeSort={sortKey} direction={sortDirection} onToggle={handleSortToggle} />
              </div>

              {loading ? <div className="px-5 py-8 text-sm text-muted-foreground">Carico il compendio mostri...</div> : null}
              {error ? <div className="px-5 py-8 text-sm text-destructive">{error}</div> : null}
              {!loading && !error && filteredItems.length === 0 ? <div className="px-5 py-8 text-sm text-muted-foreground">Nessun mostro conosciuto corrisponde ai filtri attivi.</div> : null}
              {!loading && !error && filteredItems.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedMonsterId(item.id)} className="grid w-full gap-1.5 border-b border-border/40 px-3 py-3 text-left transition hover:bg-accent/20" style={{ gridTemplateColumns: COMPENDIUM_GRID }}>
                  <div><div className="font-heading text-[1.55rem] leading-none text-primary">{item.name}</div><div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Apri scheda</div></div>
                  <div><Badge variant="outline" className={knowledgeBadgeClass(item.knowledgeState)}>{knowledgeLabel(item.knowledgeState)}</Badge></div>
                  <div className="text-[13px] font-semibold text-foreground">{item.armorClass || "-"}</div>
                  <div className="text-[13px] font-semibold text-foreground">{item.hitPointsAverage || "-"}</div>
                  <div className="text-[13px] text-foreground">{item.speedLabel || "-"}</div>
                  <div className="text-[13px] text-foreground">{item.size || "-"}</div>
                  <div className="text-[13px] text-foreground">{item.typeLabel || "-"}</div>
                  <AbilityCell value={item.strengthDisplay} />
                  <AbilityCell value={item.dexterityDisplay} />
                  <AbilityCell value={item.constitutionDisplay} />
                  <AbilityCell value={item.intelligenceDisplay} />
                  <AbilityCell value={item.wisdomDisplay} />
                  <AbilityCell value={item.charismaDisplay} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mode === "sheet" ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="right" className="w-[96vw] max-w-none border-primary/20 bg-[linear-gradient(180deg,rgba(28,21,18,0.98),rgba(20,15,13,0.98))] p-0 text-foreground sm:max-w-[96vw]">
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        content
      )}

      <Dialog open={Boolean(selectedMonsterId)} onOpenChange={(nextOpen) => !nextOpen && setSelectedMonsterId(null)}>
        <DialogContent className="max-w-5xl overflow-hidden border-primary/20 bg-card/95 p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-4">
            <DialogTitle className="font-heading text-3xl text-primary">{detail?.monster.general.name ?? "Compendio mostri"}</DialogTitle>
            <DialogDescription className="flex items-center gap-2"><Eye className="h-4 w-4" /><span>{detail ? `Livello di conoscenza: ${knowledgeLabel(detail.knowledgeState)}` : "Carico la scheda..."}</span></DialogDescription>
          </DialogHeader>
          {detailLoading || !detail ? <div className="px-6 py-8 text-sm text-muted-foreground">Carico la scheda del mostro...</div> : <ScrollArea className="max-h-[78vh]"><div className="space-y-6 px-6 py-6">{detail.knowledgeState === "COMPLETE" ? <MonsterStatBlock monster={detail.monster} /> : <PlayerMonsterPreviewCard monster={detail.monster} state="basic" />}</div></ScrollArea>}
        </DialogContent>
      </Dialog>
    </>
  );
}
