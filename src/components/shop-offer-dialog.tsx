import { useEffect, useId, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShopCurrency } from "@/lib/auth";

const SHOP_CURRENCIES: readonly ShopCurrency[] = ["CP", "SP", "EP", "GP"];

export type ShopOfferDialogMode = "proposal" | "counter" | "accept";

export interface ShopOfferDialogPayload {
  quantity: number;
  amount: number;
  currency: ShopCurrency;
}

export interface ShopOfferDialogProps {
  open: boolean;
  mode: ShopOfferDialogMode;
  itemName: string;
  actionDescription: string;
  initialValue: ShopOfferDialogPayload;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: ShopOfferDialogPayload) => void | Promise<void>;
  minQuantity?: number;
  maxQuantity?: number;
  equippedWarning?: boolean;
  loading?: boolean;
  title?: string;
  confirmLabel?: string;
  suggestedUnitAmount?: number;
}

function defaultTitle(mode: ShopOfferDialogMode) {
  if (mode === "counter") return "Rilancia offerta";
  if (mode === "accept") return "Conferma scambio";
  return "Nuova offerta";
}

function defaultConfirmLabel(mode: ShopOfferDialogMode) {
  if (mode === "counter") return "Invia rilancio";
  if (mode === "accept") return "Conferma e accetta";
  return "Invia offerta";
}

export default function ShopOfferDialog({
  open,
  mode,
  itemName,
  actionDescription,
  initialValue,
  onOpenChange,
  onConfirm,
  minQuantity = 1,
  maxQuantity = 1,
  equippedWarning = false,
  loading = false,
  title,
  confirmLabel,
  suggestedUnitAmount,
}: ShopOfferDialogProps) {
  const quantityId = useId();
  const amountId = useId();
  const currencyId = useId();
  const [quantity, setQuantity] = useState(initialValue.quantity);
  const [amount, setAmount] = useState(initialValue.amount);
  const [currency, setCurrency] = useState<ShopCurrency>(initialValue.currency);

  useEffect(() => {
    if (!open) return;
    setQuantity(initialValue.quantity);
    setAmount(initialValue.amount);
    setCurrency(initialValue.currency);
  }, [initialValue.amount, initialValue.currency, initialValue.quantity, open]);

  const normalizedMin = Math.max(1, Math.floor(minQuantity));
  const normalizedMax = Math.max(normalizedMin, Math.floor(maxQuantity));
  const valuesAreEditable = mode !== "accept";
  const isValid =
    Number.isInteger(quantity) &&
    quantity >= normalizedMin &&
    quantity <= normalizedMax &&
    Number.isInteger(amount) &&
    amount > 0 &&
    SHOP_CURRENCIES.includes(currency);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!loading) onOpenChange(nextOpen);
  };

  const handleConfirm = () => {
    if (!isValid || loading) return;
    void onConfirm({ quantity, amount, currency });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" aria-busy={loading}>
        <DialogHeader>
          <DialogTitle>{title ?? defaultTitle(mode)}</DialogTitle>
          <DialogDescription>{actionDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Oggetto</div>
            <div className="mt-1 font-medium">{itemName}</div>
          </div>

          {equippedWarning ? (
            <div className="flex gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>L'oggetto è equipaggiato: completando la vendita verrà disequipaggiato.</span>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={quantityId}>Quantità</Label>
              <Input
                id={quantityId}
                type="number"
                inputMode="numeric"
                min={normalizedMin}
                max={normalizedMax}
                step={1}
                value={quantity}
                disabled={!valuesAreEditable || loading}
                onChange={(event) => {
                  const nextQuantity = Number(event.target.value);
                  setQuantity(nextQuantity);
                  if (mode === "proposal" && suggestedUnitAmount && Number.isInteger(nextQuantity) && nextQuantity > 0) {
                    setAmount(suggestedUnitAmount * nextQuantity);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Da {normalizedMin} a {normalizedMax}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={amountId}>Importo totale</Label>
              <Input
                id={amountId}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={amount}
                disabled={!valuesAreEditable || loading}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label id={currencyId}>Valuta</Label>
            <Select
              value={currency}
              disabled={!valuesAreEditable || loading}
              onValueChange={(value: ShopCurrency) => setCurrency(value)}
            >
              <SelectTrigger aria-labelledby={currencyId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOP_CURRENCIES.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isValid ? (
            <p className="text-sm text-destructive" role="alert">
              Inserisci quantità e importo come numeri interi positivi entro i limiti indicati.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="button" disabled={!isValid || loading} onClick={handleConfirm}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loading ? "Operazione in corso…" : (confirmLabel ?? defaultConfirmLabel(mode))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
