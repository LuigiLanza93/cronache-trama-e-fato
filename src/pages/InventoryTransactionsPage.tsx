import { useEffect, useMemo, useState } from "react";
import { Home, Link2, Package, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { fetchInventoryTransfers, undoInventoryTransactionRequest, type InventoryTransferEntry } from "@/lib/auth";

const OBJECT_TRANSACTIONS_GRID =
  "144px minmax(220px,1.6fr) 72px minmax(160px,1fr) minmax(160px,1fr) minmax(220px,1.2fr) 156px 88px 88px";

function directionFromEntry(entry: InventoryTransferEntry) {
  if (entry.type === "INITIAL_GRANT") {
    return {
      from: "DM",
      to: entry.toCharacterName ?? "—",
    };
  }

  if (entry.type === "REMOVAL") {
    return {
      from: entry.fromCharacterName ?? "—",
      to: "DM",
    };
  }

  return {
    from: entry.fromCharacterName ?? "—",
    to: entry.toCharacterName ?? "—",
  };
}

export default function InventoryTransactionsPage() {
  const [entries, setEntries] = useState<InventoryTransferEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Transazioni Oggetti | D&D Character Manager";
  }, []);

  const loadEntries = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    else setRefreshing(true);

    try {
      const nextEntries = await fetchInventoryTransfers();
      setEntries(Array.isArray(nextEntries) ? nextEntries : []);
    } catch {
      toast.error("Non sono riuscito a caricare lo storico oggetti.");
    } finally {
      if (showLoadingState) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadEntries(true);
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return entries;

    return entries.filter((entry) => {
      const direction = directionFromEntry(entry);
      return [
        entry.actionLabel,
        entry.itemName,
        direction.from,
        direction.to,
        entry.notes ?? "",
        String(entry.quantity),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [entries, query]);

  const undoEntry = async (transactionId: string) => {
    setUndoingId(transactionId);
    try {
      await undoInventoryTransactionRequest(transactionId);
      await loadEntries();
      toast.success("Transazione oggetto annullata.");
    } catch (error: any) {
      toast.error(error?.message || "Non sono riuscito ad annullare la transazione.");
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Transazioni Oggetti</h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
              Storico dedicato di assegnazioni, rimozioni e trasferimenti tra personaggi, con colonne stabili e annullo immediato.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to="/" aria-label="Torna alla home DM">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to="/dm/inventory" aria-label="Torna ad assegna oggetti">
                <Package className="h-4 w-4" />
              </Link>
            </Button>
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
              <Link2 className="h-4 w-4 text-primary" />
              <span>{filteredEntries.length}</span>
            </div>
          </div>
        </section>

        <Card className="character-section space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-md space-y-2">
              <Label htmlFor="inventory-transaction-query">Cerca</Label>
              <Input
                id="inventory-transaction-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Oggetto, operazione, mittente, destinatario"
              />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{filteredEntries.length}</span> / {entries.length} visibili
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadEntries()} disabled={refreshing}>
                Ricarica
              </Button>
            </div>
          </div>

          <div className="h-[calc(100vh-19rem)] min-h-[320px] overflow-auto rounded-2xl border border-border/60 bg-background/45">
            <div
              className="sticky top-0 z-10 grid min-w-[1410px] gap-3 border-b border-border/60 bg-muted/95 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
              style={{ gridTemplateColumns: OBJECT_TRANSACTIONS_GRID }}
            >
              <span>Operazione</span>
              <span>Oggetto</span>
              <span>Qty</span>
              <span>Da</span>
              <span>A</span>
              <span>Note</span>
              <span>Data</span>
              <span>Stato</span>
              <span className="text-right">Azioni</span>
            </div>

            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Carico transazioni oggetti...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Nessuna transazione oggetto corrisponde ai filtri attivi.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredEntries.map((entry) => {
                  const direction = directionFromEntry(entry);

                  return (
                    <div
                      key={entry.id}
                      className="grid min-w-[1410px] gap-3 px-4 py-3 text-sm"
                      style={{ gridTemplateColumns: OBJECT_TRANSACTIONS_GRID }}
                    >
                      <div className="font-medium text-primary">{entry.actionLabel}</div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{entry.itemName}</div>
                      </div>
                      <div className="text-foreground">{entry.quantity}</div>
                      <div className="truncate text-foreground">{direction.from}</div>
                      <div className="truncate text-foreground">{direction.to}</div>
                      <div className="min-w-0 text-muted-foreground">{entry.notes?.trim() || "—"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("it-IT")}</div>
                      <div className={entry.undone ? "text-xs font-medium text-amber-500" : "text-xs font-medium text-emerald-500"}>
                        {entry.undone ? "Annullata" : "Registrata"}
                      </div>
                      <div className="flex justify-end">
                        {entry.canUndo ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => void undoEntry(entry.id)}
                            disabled={undoingId === entry.id}
                            aria-label="Annulla transazione"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="px-2 text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
