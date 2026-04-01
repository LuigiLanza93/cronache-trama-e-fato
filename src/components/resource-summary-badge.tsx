import { cn } from "@/lib/utils";

type ResourceSummaryEntry = {
  label: string;
  remaining: number;
  total: number;
};

type ResourceSummaryBadgeProps = {
  label: string;
  entries: ResourceSummaryEntry[];
  className?: string;
};

export function ResourceSummaryBadge({ label, entries, className }: ResourceSummaryBadgeProps) {
  if (entries.length === 0) return null;
  const isManeuverSummary = label.trim().toLowerCase() === "manovre";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {entries.map((entry) => (
        <div
          key={entry.label}
          className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90"
          title={`${label} ${entry.label}: ${entry.remaining}/${entry.total}`}
        >
          <span className="min-w-4 text-center text-[10px] font-semibold text-foreground/90">
            {isManeuverSummary ? entry.label : `${entry.label}°`}
          </span>
          <div
            className={cn(
              entry.total >= 3 ? "grid grid-flow-col grid-rows-2 gap-x-1 gap-y-1" : "flex items-center gap-1"
            )}
          >
            {Array.from({ length: entry.total }).map((_, index) => {
              const available = index < entry.remaining;
              return (
                <span
                  key={`${entry.label}-${index}`}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full border transition-colors",
                    available
                      ? isManeuverSummary
                        ? "border-amber-300/80 bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.45)]"
                        : "border-sky-300/80 bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.45)]"
                      : "border-stone-500/60 bg-stone-900/50"
                  )}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
