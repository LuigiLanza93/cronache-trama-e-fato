import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/auth-provider";
import {
  acceptShopNegotiationRequest,
  closeShopVisitRequest,
  createShopCounterOfferRequest,
  createShopNegotiationRequest,
  fetchActiveShopVisitRequest,
  fetchShopVisitRequest,
  rejectShopNegotiationRequest,
  withdrawShopNegotiationRequest,
  type ShopCurrency,
  type ShopNegotiation,
  type ShopVisit,
} from "@/lib/auth";
import { onShopVisitClosed, onShopVisitOpened, onShopVisitUpdated } from "@/realtime";

export default function ShopVisitListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeVisit, setActiveVisit] = useState<ShopVisit | null>(null);
  const [dismissedVisitId, setDismissedVisitId] = useState<string | null>(null);
  const seenOpenKeys = useRef(new Set<string>());

  const hydrateVisit = async (visit: ShopVisit) => {
    try {
      const detail = await fetchShopVisitRequest(visit.id);
      setActiveVisit(detail);
    } catch {
      setActiveVisit(visit);
    }
  };

  useEffect(() => {
    if (!user || user.mustChangePassword || user.role === "dm") return;
    let cancelled = false;
    void fetchActiveShopVisitRequest()
      .then((visit) => {
        if (!cancelled && visit?.status === "ACTIVE") {
          void hydrateVisit(visit);
          setDismissedVisitId(null);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.mustChangePassword || user.role === "dm") return;

    const offOpened = onShopVisitOpened(({ visit, occurredAt }) => {
      if (visit.status !== "ACTIVE") return;
      const key = `${visit.id}:${occurredAt}`;
      if (seenOpenKeys.current.has(key)) return;
      seenOpenKeys.current.add(key);
      void hydrateVisit(visit);
      setDismissedVisitId(null);
    });

    const offUpdated = onShopVisitUpdated(({ visit }) => {
      setActiveVisit((current) => {
        if (!current || current.id !== visit.id) return current;
        if (visit.status !== "ACTIVE") return null;
        void hydrateVisit(visit);
        return current;
      });
    });

    const offClosed = onShopVisitClosed(({ visit }) => {
      setActiveVisit((current) => (current?.id === visit.id ? null : current));
      setDismissedVisitId((current) => (current === visit.id ? null : current));
      toast({
        title: "Visita conclusa",
        description: `${visit.shop.name} non e piu una visita attiva.`,
      });
    });

    return () => {
      offOpened();
      offUpdated();
      offClosed();
    };
  }, [toast, user]);

  const visibleVisit = activeVisit && activeVisit.id !== dismissedVisitId ? activeVisit : null;
  const visibleItems = visibleVisit?.items ?? [];
  const inventoryItems = visibleVisit?.inventory ?? [];
  const negotiations = visibleVisit?.negotiations ?? [];

  const askMoney = () => {
    const amount = Number(window.prompt("Importo dell'offerta", "1") ?? 0);
    if (!Number.isFinite(amount) || amount < 1) return null;
    const currency = String(window.prompt("Valuta: CP, SP, EP, GP", "GP") ?? "GP").toUpperCase();
    if (!["CP", "SP", "EP", "GP"].includes(currency)) return null;
    return { amount: Math.floor(amount), currency: currency as ShopCurrency };
  };

  const proposeBuy = async (shopItemId: string) => {
    if (!activeVisit) return;
    const money = askMoney();
    if (!money) return;
    try {
      const detail = await createShopNegotiationRequest(activeVisit.id, {
        direction: "SHOP_TO_CHARACTER",
        shopItemId,
        quantity: 1,
        ...money,
      });
      setActiveVisit(detail);
    } catch (error) {
      toast({ title: "Offerta non inviata", description: String(error instanceof Error ? error.message : error), variant: "destructive" });
    }
  };

  const proposeSell = async (characterItemId: string) => {
    if (!activeVisit) return;
    const money = askMoney();
    if (!money) return;
    try {
      const detail = await createShopNegotiationRequest(activeVisit.id, {
        direction: "CHARACTER_TO_SHOP",
        characterItemId,
        quantity: 1,
        ...money,
      });
      setActiveVisit(detail);
    } catch (error) {
      toast({ title: "Offerta non inviata", description: String(error instanceof Error ? error.message : error), variant: "destructive" });
    }
  };

  const answerNegotiation = async (negotiation: ShopNegotiation, action: "accept" | "reject" | "withdraw" | "counter") => {
    try {
      let detail: ShopVisit;
      if (action === "accept") detail = await acceptShopNegotiationRequest(negotiation.id);
      else if (action === "reject") detail = await rejectShopNegotiationRequest(negotiation.id);
      else if (action === "withdraw") detail = await withdrawShopNegotiationRequest(negotiation.id);
      else {
        const money = askMoney();
        if (!money) return;
        detail = await createShopCounterOfferRequest(negotiation.id, money);
      }
      setActiveVisit(detail);
    } catch (error) {
      toast({ title: "Trattativa non aggiornata", description: String(error instanceof Error ? error.message : error), variant: "destructive" });
    }
  };

  const openCharacterSheet = () => {
    if (!activeVisit) return;
    navigate(`/${activeVisit.character.slug}`);
    setDismissedVisitId(activeVisit.id);
  };

  const closeVisit = async () => {
    if (!activeVisit) return;
    try {
      const closed = await closeShopVisitRequest(activeVisit.id, "closed_by_player_popup");
      setActiveVisit(closed.status === "ACTIVE" ? closed : null);
      setDismissedVisitId(null);
    } catch (error) {
      toast({
        title: "Visita non chiusa",
        description: String(error instanceof Error ? error.message : error),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={!!visibleVisit} onOpenChange={(open) => !open && activeVisit && setDismissedVisitId(activeVisit.id)}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden border-primary/25 bg-card/95">
        <DialogHeader>
          <DialogTitle className="font-heading text-3xl text-primary">Visita al negozio</DialogTitle>
          <DialogDescription>
            {visibleVisit ? `${visibleVisit.character.name} entra da ${visibleVisit.shop.name}.` : ""}
          </DialogDescription>
        </DialogHeader>
        {visibleVisit ? (
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-md border border-border/70 bg-background/60 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-2xl leading-tight text-primary">{visibleVisit.shop.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{visibleVisit.shop.ownerName || "Mercante sconosciuto"}</span>
                    {visibleVisit.shop.city ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {visibleVisit.shop.city}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {visibleVisit.discountPercent > 0 ? (
              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                Sconto abituale applicato: {visibleVisit.discountPercent}%
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-md border border-border/70 bg-background/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-heading text-xl text-primary">Vetrina</h3>
                  <span className="text-xs text-muted-foreground">{visibleItems.length} oggetti visibili</span>
                </div>
                <div className="space-y-2">
                  {visibleItems.length ? visibleItems.map((item) => (
                    <div key={item.id} className="rounded-md border border-border/60 bg-card/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Qta {item.quantity}
                            {item.definition?.category ? ` · ${item.definition.category}` : ""}
                            {item.definition?.rarity ? ` · ${item.definition.rarity}` : ""}
                          </div>
                        </div>
                        {item.isSecret ? (
                          <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-100">
                            Rivelato
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      ) : null}
                      {item.definition?.features?.length ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Feature: {item.definition.features.slice(0, 3).map((feature) => feature.name).join(", ")}
                          {item.definition.features.length > 3 ? "..." : ""}
                        </div>
                      ) : null}
                      <div className="mt-3 flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => void proposeBuy(item.id)}>
                          Offri acquisto
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                      Nessun oggetto visibile in questa visita.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-md border border-border/70 bg-background/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-heading text-xl text-primary">Inventario</h3>
                  <span className="text-xs text-muted-foreground">{inventoryItems.length} righe</span>
                </div>
                <div className="space-y-2">
                  {inventoryItems.length ? inventoryItems.map((item) => (
                    <div key={item.id} className="rounded-md border border-border/60 bg-card/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{item.itemName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Qta {item.quantity}
                            {item.itemCategory ? ` · ${item.itemCategory}` : ""}
                          </div>
                        </div>
                        {item.isEquipped ? (
                          <span className="shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs text-primary">
                            Equipaggiato
                          </span>
                        ) : null}
                      </div>
                      {item.detailSummary ? (
                        <p className="mt-2 text-sm text-muted-foreground">{item.detailSummary}</p>
                      ) : null}
                      <div className="mt-3 flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => void proposeSell(item.id)}>
                          Proponi vendita
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                      Inventario vuoto.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-md border border-border/70 bg-background/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-heading text-xl text-primary">Trattative</h3>
                <span className="text-xs text-muted-foreground">{negotiations.length} catene</span>
              </div>
              <div className="space-y-2">
                {negotiations.length ? negotiations.map((negotiation) => {
                  const current = negotiation.currentOffer;
                  const isCurrentProposer = current?.proposedByUserId === user?.id;
                  return (
                    <div key={negotiation.id} className="rounded-md border border-border/60 bg-card/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{negotiation.itemNameSnapshot}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {negotiation.direction === "SHOP_TO_CHARACTER" ? "Acquisto dal negozio" : "Vendita al negozio"} · Qta {negotiation.quantity} · {negotiation.status}
                          </div>
                          {current ? (
                            <div className="mt-2 text-sm">
                              Offerta corrente: {current.amount} {current.currency}
                            </div>
                          ) : null}
                        </div>
                        {negotiation.status === "OPEN" ? (
                          <div className="flex flex-wrap gap-2">
                            {!isCurrentProposer ? (
                              <>
                                <Button type="button" size="sm" onClick={() => void answerNegotiation(negotiation, "accept")}>Accetta</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => void answerNegotiation(negotiation, "counter")}>Rilancia</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => void answerNegotiation(negotiation, "reject")}>Rifiuta</Button>
                              </>
                            ) : (
                              <Button type="button" size="sm" variant="outline" onClick={() => void answerNegotiation(negotiation, "withdraw")}>Ritira</Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nessuna trattativa aperta.
                  </div>
                )}
              </div>
            </section>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDismissedVisitId(visibleVisit.id)}>
                Nascondi
              </Button>
              <Button type="button" variant="destructive" onClick={closeVisit}>
                <DoorOpen className="mr-2 h-4 w-4" />
                Lascia negozio
              </Button>
              <Button type="button" onClick={openCharacterSheet}>
                Apri scheda
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
