import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useSheetCardState } from "@/components/characterSheet/sheet-card-state";

type SectionCardProps = {
  cardId?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
};

const SectionCard = ({
  cardId,
  title,
  actions,
  children,
  defaultCollapsed = false,
  className = "character-section",
}: SectionCardProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const cardState = useSheetCardState();
  const isControlled = !!cardId && !!cardState;
  const effectiveCollapsed = isControlled
    ? !!cardState.collapsedCards[cardId]
    : collapsed;

  const handleCollapsedChange = (nextCollapsed: boolean) => {
    if (isControlled && cardId) {
      cardState.setCardCollapsed(cardId, nextCollapsed);
      return;
    }
    setCollapsed(nextCollapsed);
  };

  return (
    <Card className={className}>
      <div className="character-section-title flex items-center justify-between gap-3">
        <div className="min-w-0">{title}</div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => handleCollapsedChange(!effectiveCollapsed)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
            aria-expanded={!effectiveCollapsed}
            aria-label={effectiveCollapsed ? "Espandi sezione" : "Comprimi sezione"}
            title={effectiveCollapsed ? "Espandi sezione" : "Comprimi sezione"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${effectiveCollapsed ? "" : "rotate-180"}`} />
          </button>
        </div>
      </div>

      {!effectiveCollapsed ? children : null}
    </Card>
  );
};

export default SectionCard;
