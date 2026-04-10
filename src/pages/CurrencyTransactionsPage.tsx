import { useEffect, useMemo, useState } from "react";
import { Coins, Home, Package, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { fetchCurrencyTransactions, undoCurrencyTransactionRequest, type CurrencyTransactionEntry } from "@/lib/auth";

const CURRENCY_TRANSACTIONS_GRID =
  "132px minmax(140px,0.9fr) minmax(160px,0.9fr) minmax(160px,0.9fr) minmax(180px,1fr) minmax(200px,1.2fr) 156px 88px 88px";

function currencyFrom(entry: CurrencyTransactionEntry) {
  if (entry.operationType === "ADD") return entry.fromExternalName ?? "Origine esterna";
  if (entry.operationType === "REMOVE") return entry.fromCharacterName ?? "—";
  if (entry.operationType === "TRANSFER") return entry.fromCharacterName ?? "—";
  return entry.fromCharacterName ?? entry.toCharacterName ?? "Portafoglio";
}

function currencyTo(entry: CurrencyTransactionEntry) {
  if (entry.operationType === "ADD") return entry.toCharacterName ?? "—";
  if (entry.operationType === "REMOVE") return entry.toExternalName ?? "Destinazione esterna";
  if (entry.operationType === "TRANSFER") return entry.toCharacterName ?? "—";
  return entry.toCharacterName ?? entry.fromCharacterName ?? "Portafoglio";
}

function currencyDetail(entry: CurrencyTransactionEntry) {
  return [entry.purchaseDescription, entry.note].filter(Boolean).join(" · ") || "—";
}

export default function CurrencyTransactionsPage() {
  const [entries, setEntries] = useState<CurrencyTransactionEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Transazioni Monete | D&D Character Manager";
  }, []);

  const loadEntries = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    else setRefreshing(true);

    try {
      const nextEntries = await fetchCurrencyTransactions();
      setEntries(Array.isArray(nextEntries) ? nextEntries : []);
    } catch {
      toast.error("Non sono riuscito a caricare lo storico monete.");
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

    return entries.filter((entry) =>
      [
        entry.actionLabel,
        entry.summary,
        currencyFrom(entry),
        currencyTo(entry),
        entry.reason ?? "",
        entry.purchaseDescription ?? "",
        entry.note ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [entries, query]);

  const undoEntry = async (operationId: string) => {
    setUndoingId(operationId);
    try {
      await undoCurrencyTransactionRequest(operationId);
      await loadEntries();
      toast.success("Operazione monete annullata.");
    } catch (error: any) {
      toast.error(error?.message || "Non sono riuscito ad annullare l'operazione monete.");
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Transazioni Monete</h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
              Registro dedicato dei movimenti valuta, con controparti, causali e dettaglio leggibili a colpo d'occhio.
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
              <Coins className="h-4 w-4 text-primary" />
              <span>{filteredEntries.length}</span>
            </div>
          </div>
        </section>

        <Card className="character-section space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-md space-y-2">
              <Label htmlFor="currency-transaction-query">Cerca</Label>
              <Input
                id="currency-transaction-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Operazione, importo, motivo, controparti"
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
              style={{ gridTemplateColumns: CURRENCY_TRANSACTIONS_GRID }}
            >
              <span>Operazione</span>
              <span>Importo</span>
              <span>Da</span>
              <span>A</span>
              <span>Motivo</span>
              <span>Dettaglio</span>
              <span>Data</span>
              <span>Stato</span>
              <span className="text-right">Azioni</span>
            </div>

            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Carico transazioni monete...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Nessuna transazione monete corrisponde ai filtri attivi.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`grid min-w-[1410px] gap-3 px-4 py-3 text-sm ${entry.undone ? "bg-muted/20 text-muted-foreground" : ""}`}
                    style={{ gridTemplateColumns: CURRENCY_TRANSACTIONS_GRID }}
                  >
                    <div className={entry.undone ? "font-medium text-muted-foreground" : "font-medium text-primary"}>{entry.actionLabel}</div>
                    <div className={entry.undone ? "font-medium text-muted-foreground line-through decoration-muted-foreground/60" : "font-medium text-foreground"}>{entry.summary}</div>
                    <div className={entry.undone ? "truncate text-muted-foreground" : "truncate text-foreground"}>{currencyFrom(entry)}</div>
                    <div className={entry.undone ? "truncate text-muted-foreground" : "truncate text-foreground"}>{currencyTo(entry)}</div>
                    <div className="min-w-0 text-muted-foreground">{entry.reason?.trim() || "—"}</div>
                    <div className="min-w-0 text-muted-foreground">{currencyDetail(entry)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("it-IT")}</div>
                    <div className={entry.undone ? "text-xs font-medium text-amber-500" : "text-xs font-medium text-emerald-500"}>
                      {entry.undone ? "Annullata" : entry.canUndo ? "Attiva" : "Registrata"}
                    </div>
                    <div className="flex justify-end">
                      {entry.canUndo ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => void undoEntry(entry.id)}
                          disabled={undoingId === entry.id}
                          aria-label="Annulla operazione monete"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="px-2 text-xs text-muted-foreground">{entry.undone ? "Chiusa" : "—"}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
