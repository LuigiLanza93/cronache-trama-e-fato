import type { CurrencyBalance } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface CurrencyWalletProps {
  balance: CurrencyBalance;
  label?: string;
  compact?: boolean;
  className?: string;
}

const COINS = [
  {
    key: "gp",
    abbreviation: "GP",
    label: "Oro",
    swatchClass: "bg-gradient-to-br from-yellow-200 to-yellow-500",
    ringClass: "ring-yellow-600/30",
    textClass: "text-yellow-950",
  },
  {
    key: "ep",
    abbreviation: "EP",
    label: "Electrum",
    swatchClass: "bg-gradient-to-br from-emerald-200 to-teal-500",
    ringClass: "ring-teal-600/30",
    textClass: "text-teal-950",
  },
  {
    key: "sp",
    abbreviation: "SP",
    label: "Argento",
    swatchClass: "bg-gradient-to-br from-slate-100 to-slate-400",
    ringClass: "ring-slate-500/30",
    textClass: "text-slate-900",
  },
  {
    key: "cp",
    abbreviation: "CP",
    label: "Rame",
    swatchClass: "bg-gradient-to-br from-amber-500 to-amber-800",
    ringClass: "ring-amber-900/30",
    textClass: "text-amber-950",
  },
] as const satisfies ReadonlyArray<{
  key: keyof CurrencyBalance;
  abbreviation: string;
  label: string;
  swatchClass: string;
  ringClass: string;
  textClass: string;
}>;

export function CurrencyWallet({ balance, label, compact = false, className }: CurrencyWalletProps) {
  return (
    <div className={cn("text-sm", className)}>
      {label ? <div className="mb-1.5 font-semibold text-primary">{label}</div> : null}
      <div className="grid grid-cols-4 gap-2" role="list" aria-label={label ?? "Portafoglio"}>
        {COINS.map((coin) => {
          const accessibleLabel = `${balance[coin.key]} monete di ${coin.label} (${coin.abbreviation})`;
          return (
            <div key={coin.key} className="flex flex-col items-center gap-1" role="listitem">
              <span
                className={cn(
                  "relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/10 ring-1 shadow-[inset_0_2px_6px_rgba(255,255,255,0.18),inset_0_-6px_10px_rgba(0,0,0,0.22),0_6px_14px_rgba(0,0,0,0.18)]",
                  compact ? "h-10 w-10" : "h-12 w-12",
                  coin.ringClass,
                  coin.swatchClass,
                )}
                aria-label={accessibleLabel}
                title={accessibleLabel}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[18%] top-[10%] h-[26%] rounded-full bg-white/28 blur-[1px]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[10%] rounded-full border border-black/10"
                />
                <span className={cn("relative z-10 font-extrabold tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.24)]", compact ? "text-xs" : "text-[13px]", coin.textClass)}>
                  {balance[coin.key]}
                </span>
              </span>
              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground" aria-hidden="true">{coin.abbreviation}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
