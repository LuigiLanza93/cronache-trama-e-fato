import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShopOfferDialog, { type ShopOfferDialogPayload } from "@/components/shop-offer-dialog";
import { CurrencyWallet } from "@/components/currency-wallet";
import { ShopOfferComparison } from "@/components/shop-offer-comparison";
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
  const [offerDialog, setOfferDialog] = useState<
    | { kind: "proposal"; direction: "SHOP_TO_CHARACTER" | "CHARACTER_TO_SHOP"; itemId: string; itemName: string; maxQuantity: number; equipped: boolean; amount: number; currency: ShopCurrency }
    | { kind: "counter" | "accept"; negotiation: ShopNegotiation }
    | null
  >(null);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const seenOpenKeys = useRef(new Set<string>());
  const negotiationStateKeys = useRef(new Map<string, string>());

  const hydrateVisit = async (visit: ShopVisit, notifyChanges = false) => {
    try {
      const detail = await fetchShopVisitRequest(visit.id);
      for (const negotiation of detail.negotiations ?? []) {
        const current = negotiation.currentOffer;
        const stateKey = `${negotiation.status}:${current?.sequence ?? 0}`;
        const previousKey = negotiationStateKeys.current.get(negotiation.id);
        if (notifyChanges && previousKey && previousKey !== stateKey) {
          const proposerSide = current?.proposerSide ?? (current?.proposedByRole === "dm" ? "SHOP" : "CHARACTER");
          if (negotiation.status === "OPEN" && proposerSide === "SHOP" && current) {
            toast({ title: "Nuova proposta dal negozio", description: `${negotiation.itemNameSnapshot}: ${current.amount} ${current.currency}` });
          } else if (negotiation.status !== "OPEN") {
            const outcome = negotiation.status === "ACCEPTED" ? "accettata" : negotiation.status === "REJECTED" ? "rifiutata" : negotiation.status === "WITHDRAWN" ? "ritirata" : "scaduta";
            toast({ title: `Trattativa ${outcome}`, description: negotiation.itemNameSnapshot });
          }
        }
        negotiationStateKeys.current.set(negotiation.id, stateKey);
      }
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
        void hydrateVisit(visit, true);
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

  const proposeBuy = (shopItemId: string) => {
    const item = activeVisit?.items?.find((candidate) => candidate.id === shopItemId);
    if (item) setOfferDialog({
      kind: "proposal", direction: "SHOP_TO_CHARACTER", itemId: item.id, itemName: item.name,
      maxQuantity: item.quantity, equipped: false, amount: item.discountedPrice.amount, currency: item.discountedPrice.currency,
    });
  };

  const proposeSell = (characterItemId: string) => {
    const item = activeVisit?.inventory?.find((candidate) => candidate.id === characterItemId);
    if (item) setOfferDialog({
      kind: "proposal", direction: "CHARACTER_TO_SHOP", itemId: item.id, itemName: item.itemName,
      maxQuantity: item.quantity, equipped: !!item.isEquipped, amount: 1, currency: "GP",
    });
  };

  const submitOfferDialog = async (payload: ShopOfferDialogPayload) => {
    if (!activeVisit || !offerDialog) return;
    setOfferSubmitting(true);
    try {
      let detail: ShopVisit;
      if (offerDialog.kind === "proposal") {
        detail = await createShopNegotiationRequest(activeVisit.id, {
          direction: offerDialog.direction,
          ...(offerDialog.direction === "SHOP_TO_CHARACTER" ? { shopItemId: offerDialog.itemId } : { characterItemId: offerDialog.itemId }),
          ...payload,
        });
      } else if (offerDialog.kind === "counter") {
        detail = await createShopCounterOfferRequest(offerDialog.negotiation.id, { amount: payload.amount, currency: payload.currency });
      } else {
        detail = await acceptShopNegotiationRequest(offerDialog.negotiation.id);
      }
      setActiveVisit(detail);
      setOfferDialog(null);
    } catch (error) {
      toast({ title: "Trattativa non aggiornata", description: String(error instanceof Error ? error.message : error), variant: "destructive" });
    } finally {
      setOfferSubmitting(false);
    }
  };

  const answerNegotiation = async (negotiation: ShopNegotiation, action: "accept" | "reject" | "withdraw" | "counter") => {
    if (action === "accept" || action === "counter") {
      setOfferDialog({ kind: action, negotiation });
      return;
    }
    try {
      const detail = action === "reject"
        ? await rejectShopNegotiationRequest(negotiation.id)
        : await withdrawShopNegotiationRequest(negotiation.id);
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

  const dialogNegotiation = offerDialog && offerDialog.kind !== "proposal" ? offerDialog.negotiation : null;
  const dialogOffer = dialogNegotiation?.currentOffer;

  return (
    <>
    <Dialog open={!!visibleVisit} onOpenChange={(open) => !open && activeVisit && setDismissedVisitId(activeVisit.id)}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden border-primary/25 bg-card/95">
        <DialogHeader>
          <DialogTitle className="font-heading text-3xl text-primary">Visita al negozio</DialogTitle>
          <DialogDescription>
            {visibleVisit ? `${visibleVisit.character.name} entra da ${visibleVisit.shop.name}.` : ""}
          </DialogDescription>
        </DialogHeader>
        {visibleVisit ? (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
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

            <CurrencyWallet balance={visibleVisit.character.balance} label="Il tuo portafoglio" compact className="rounded-md border border-primary/25 bg-primary/5 p-3" />

            {visibleVisit.discountPercent > 0 ? (
              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                Sconto abituale applicato: {visibleVisit.discountPercent}%
              </div>
            ) : null}

            <div className="order-2 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
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
                      <div className="mt-3 flex items-baseline gap-2 text-sm">
                        <span className="text-muted-foreground">Prezzo unitario:</span>
                        {item.discountedPrice.amount !== item.price.amount ? (
                          <span className="text-muted-foreground line-through">{item.price.amount} {item.price.currency}</span>
                        ) : null}
                        <span className="font-semibold text-primary">{item.discountedPrice.amount} {item.discountedPrice.currency}</span>
                      </div>
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

            <section className="order-1 rounded-md border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-heading text-xl text-primary">Trattative</h3>
                <span className="text-xs text-muted-foreground">{negotiations.filter((entry) => entry.status === "OPEN").length} aperte</span>
              </div>
              <div className="space-y-2">
                {negotiations.length ? [...negotiations].sort((left, right) => Number(right.status === "OPEN") - Number(left.status === "OPEN")).map((negotiation) => {
                  const current = negotiation.currentOffer;
                  const isCurrentProposer = current?.proposerSide ? current.proposerSide === "CHARACTER" : current?.proposedByRole !== "dm";
                  return (
                    <div key={negotiation.id} className="rounded-md border border-border/60 bg-card/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{negotiation.itemNameSnapshot}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {negotiation.direction === "SHOP_TO_CHARACTER" ? "Acquisto dal negozio" : "Vendita al negozio"} · Qta {negotiation.quantity} · {negotiation.status}
                          </div>
                          <ShopOfferComparison offers={negotiation.offers} viewerSide="CHARACTER" status={negotiation.status} className="mt-3" />
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

            <div className="order-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
    {offerDialog ? (
      <ShopOfferDialog
        open
        mode={offerDialog.kind}
        itemName={offerDialog.kind === "proposal" ? offerDialog.itemName : offerDialog.negotiation.itemNameSnapshot}
        actionDescription={offerDialog.kind === "accept"
          ? "Controlla i dettagli: confermando, oggetto e monete verranno trasferiti immediatamente."
          : offerDialog.kind === "counter"
            ? "Inserisci il nuovo importo da proporre alla controparte."
            : offerDialog.direction === "SHOP_TO_CHARACTER"
              ? "Proponi l'acquisto di uno o più oggetti dal negozio."
              : "Proponi la vendita di uno o più oggetti al negozio."}
        initialValue={{
          quantity: offerDialog.kind === "proposal" ? 1 : offerDialog.negotiation.quantity,
          amount: offerDialog.kind === "proposal" ? offerDialog.amount : dialogOffer?.amount ?? 1,
          currency: offerDialog.kind === "proposal" ? offerDialog.currency : dialogOffer?.currency ?? "GP",
        }}
        minQuantity={offerDialog.kind === "proposal" ? 1 : offerDialog.negotiation.quantity}
        maxQuantity={offerDialog.kind === "proposal" ? offerDialog.maxQuantity : offerDialog.negotiation.quantity}
        equippedWarning={offerDialog.kind === "proposal" ? offerDialog.equipped : false}
        suggestedUnitAmount={offerDialog.kind === "proposal" ? offerDialog.amount : undefined}
        loading={offerSubmitting}
        onOpenChange={(open) => !open && setOfferDialog(null)}
        onConfirm={submitOfferDialog}
      />
    ) : null}
    </>
  );
}
