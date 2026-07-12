import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ShopNegotiation, ShopOffer } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface ShopOfferComparisonProps {
  offers: ShopOffer[];
  viewerSide: "SHOP" | "CHARACTER";
  status: ShopNegotiation["status"];
  className?: string;
}

function proposerLabel(offer: ShopOffer, viewerSide: "SHOP" | "CHARACTER") {
  const proposerSide = offer.proposerSide ?? (offer.proposedByRole === "dm" ? "SHOP" : "CHARACTER");
  if (proposerSide === viewerSide) return "Tu";
  return viewerSide === "SHOP" ? "Player" : "Negozio";
}

function statusLabel(status: ShopNegotiation["status"]) {
  if (status === "ACCEPTED") return "Accettata";
  if (status === "REJECTED") return "Rifiutata";
  if (status === "WITHDRAWN") return "Ritirata";
  if (status === "EXPIRED") return "Scaduta";
  return "In trattativa";
}

function OfferValue({
  offer,
  viewerSide,
  previous = false,
}: {
  offer: ShopOffer;
  viewerSide: "SHOP" | "CHARACTER";
  previous?: boolean;
}) {
  return (
    <div className={cn("min-w-0", previous && "text-muted-foreground")}>
      <div className="text-xs font-medium uppercase tracking-wide">
        {previous ? "Precedente" : "Attuale"} · {proposerLabel(offer, viewerSide)}
      </div>
      <div className={cn("mt-1 tabular-nums", previous ? "text-sm line-through decoration-1" : "text-lg font-semibold text-primary")}>
        {offer.amount} {offer.currency}
      </div>
    </div>
  );
}

export function ShopOfferComparison({ offers, viewerSide, status, className }: ShopOfferComparisonProps) {
  const orderedOffers = [...offers].sort((left, right) => left.sequence - right.sequence);
  const current = orderedOffers.at(-1);
  const previous = orderedOffers.at(-2);

  if (!current) return null;

  const delta = previous && previous.currency === current.currency ? current.amount - previous.amount : null;
  const deltaLabel = delta == null ? null : `${delta > 0 ? "+" : ""}${delta} ${current.currency}`;

  return (
    <div className={cn("rounded-md border border-border/60 bg-background/55 p-3", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {previous ? "Ultimo rilancio" : "Proposta iniziale"}
        </span>
        <Badge variant={status === "OPEN" ? "default" : "secondary"}>{statusLabel(status)}</Badge>
      </div>

      {previous ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3" aria-label={`Offerta precedente ${previous.amount} ${previous.currency}; offerta attuale ${current.amount} ${current.currency}`}>
          <OfferValue offer={previous} viewerSide={viewerSide} previous />
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <OfferValue offer={current} viewerSide={viewerSide} />
        </div>
      ) : (
        <div aria-label={`Proposta iniziale ${current.amount} ${current.currency}`}>
          <OfferValue offer={current} viewerSide={viewerSide} />
        </div>
      )}

      {deltaLabel ? (
        <div className="mt-2 text-right text-xs font-medium tabular-nums text-muted-foreground" aria-label={`Variazione ${deltaLabel}`}>
          Variazione: {deltaLabel}
        </div>
      ) : null}
    </div>
  );
}
