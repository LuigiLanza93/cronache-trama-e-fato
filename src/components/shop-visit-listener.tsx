import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeDollarSign, Check, DoorOpen, ExternalLink, MapPin, Repeat2, ShoppingCart, Store, Undo2, X } from "lucide-react";
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
  type ShopVisitItem,
} from "@/lib/auth";
import { onShopVisitClosed, onShopVisitOpened, onShopVisitUpdated } from "@/realtime";

const ITEM_CATEGORY_LABELS: Record<string, string> = {
  WEAPON: "Arma",
  ARMOR: "Armatura",
  SHIELD: "Scudo",
  WONDROUS: "Oggetto meraviglioso",
  RING: "Anello",
  ROD: "Verga",
  STAFF: "Bastone",
  WAND: "Bacchetta",
  CONSUMABLE: "Consumabile",
  AMMUNITION: "Munizioni",
  TOOL: "Strumento",
  GEAR: "Equipaggiamento",
  QUEST: "Oggetto missione",
  OTHER: "Altro",
};

const ITEM_CONDITION_LABELS: Record<string, string> = {
  ALWAYS: "sempre",
  WHILE_EQUIPPED: "se equipaggiato",
};

const FEATURE_RESET_LABELS: Record<string, string> = {
  AT_WILL: "a volontà",
  ENCOUNTER: "a incontro",
  SHORT_REST: "riposo breve",
  LONG_REST: "riposo lungo",
  DAILY: "giornaliero",
  CUSTOM: "speciale",
};

const USE_EFFECT_LABELS: Record<string, string> = {
  HEAL: "Cura",
  DAMAGE: "Danno",
  TEMP_HP: "PF temporanei",
  CONDITION: "Condizione",
  RESTORE_RESOURCE: "Ripristina risorsa",
  CUSTOM: "Effetto speciale",
};

const MODIFIER_TARGET_LABELS: Record<string, string> = {
  AC: "Classe Armatura",
  ABILITY: "Caratteristica",
  SPEED: "Velocità",
  INITIATIVE: "Iniziativa",
  MAX_HP: "PF massimi",
};

function labelFromMap(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) return "";
  return labels[value] ?? value.replace(/_/g, " ").toLowerCase();
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" · ");
}

function buildAttackSummary(attack: NonNullable<ShopVisitItem["definition"]>["attacks"][number]) {
  return joinParts([
    attack.attackBonus != null ? `tiro ${formatSigned(attack.attackBonus)}` : null,
    [attack.damageDice, attack.damageType].filter(Boolean).join(" "),
    attack.rangeNormal != null || attack.rangeLong != null ? `gittata ${attack.rangeNormal ?? "?"}/${attack.rangeLong ?? "?"}` : null,
    attack.requiresEquipped ? "richiede equipaggiamento" : null,
  ]);
}

function formatItemCategory(category: string | null | undefined) {
  return labelFromMap(category, ITEM_CATEGORY_LABELS) || "Oggetto";
}

function formatIndicativeValue(value: { currency: ShopCurrency; amount: number } | null | undefined) {
  return value && Number.isInteger(value.amount) && value.amount > 0 ? `${value.amount} ${value.currency}` : "sconosciuto";
}

type ShopVisitItemGroup = {
  item: ShopVisitItem;
  instanceCount: number;
  availableQuantity: number;
};

function groupIdenticalNonStackableItems(items: ShopVisitItem[]): ShopVisitItemGroup[] {
  const groups: ShopVisitItemGroup[] = [];
  const groupIndexes = new Map<string, number>();

  items.forEach((item) => {
    if (item.definition?.stackable !== false || !item.displayGroupKey) {
      groups.push({ item, instanceCount: 1, availableQuantity: item.quantity });
      return;
    }

    const groupKey = item.displayGroupKey;
    const existingIndex = groupIndexes.get(groupKey);

    if (existingIndex === undefined) {
      groupIndexes.set(groupKey, groups.length);
      groups.push({ item, instanceCount: 1, availableQuantity: item.quantity });
      return;
    }

    groups[existingIndex].instanceCount += 1;
    groups[existingIndex].availableQuantity += item.quantity;
  });

  return groups;
}

function buildFeatureSummary(feature: NonNullable<ShopVisitItem["definition"]>["features"][number], item: ShopVisitItem) {
  const state = item.featureStates.find((entry) => entry.itemFeatureId === feature.id);
  return joinParts([
    feature.kind === "PASSIVE" ? "passiva" : "attiva",
    labelFromMap(feature.condition, ITEM_CONDITION_LABELS),
    feature.maxUses != null ? `${Math.max(0, feature.maxUses - (state?.usesSpent ?? 0))}/${feature.maxUses} usi` : null,
    feature.resetOn ? `reset ${feature.customResetLabel || labelFromMap(feature.resetOn, FEATURE_RESET_LABELS)}` : null,
  ]);
}

function buildModifierSummary(modifier: NonNullable<ShopVisitItem["definition"]>["modifiers"][number]) {
  const amount = modifier.value != null ? formatSigned(modifier.value) : modifier.formula;
  return joinParts([
    labelFromMap(modifier.target, MODIFIER_TARGET_LABELS),
    amount,
    labelFromMap(modifier.condition, ITEM_CONDITION_LABELS),
  ]);
}

function buildUseEffectSummary(effect: NonNullable<ShopVisitItem["definition"]>["useEffects"][number]) {
  return joinParts([
    labelFromMap(effect.effectType, USE_EFFECT_LABELS),
    effect.diceExpression ?? (effect.flatValue != null ? String(effect.flatValue) : null),
    effect.damageType,
    effect.savingThrowAbility && effect.savingThrowDc != null ? `TS ${effect.savingThrowAbility} CD ${effect.savingThrowDc}` : null,
    effect.durationText,
  ]);
}

function ShopVisibleItemDetails({ item }: { item: ShopVisitItem }) {
  const definition = item.definition;
  if (!definition) return null;
  const hasDetails = definition.attacks.length || definition.features.length || definition.modifiers.length || definition.abilityRequirements.length || definition.useEffects.length || definition.slotRules.length || definition.equippable || definition.attunement || definition.weight;
  if (!hasDetails) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-1.5">
          {definition.equippable ? <span className="rounded-full bg-muted/60 px-2.5 py-1">Equipaggiabile</span> : null}
          {definition.attunement ? <span className="rounded-full bg-muted/60 px-2.5 py-1">Richiede sintonia</span> : null}
          {definition.weight != null ? <span className="rounded-full bg-muted/60 px-2.5 py-1">Peso {definition.weight}</span> : null}
          {definition.armorCategory ? <span className="rounded-full bg-muted/60 px-2.5 py-1">{definition.armorCategory}</span> : null}
        </div>

        {definition.attacks.length ? (
          <div className="space-y-1">
            <div className="font-semibold uppercase tracking-wide text-muted-foreground">Attacchi</div>
            {definition.attacks.map((attack) => (
              <div key={attack.id} className="rounded-lg bg-muted/35 px-3 py-2">
                <div className="font-medium text-foreground">{attack.name}</div>
                <div>{buildAttackSummary(attack)}</div>
                {attack.conditionText ? <div className="mt-1">{attack.conditionText}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        {definition.features.length ? (
          <div className="space-y-1">
            <div className="font-semibold uppercase tracking-wide text-muted-foreground">Feature</div>
            {definition.features.map((feature) => (
              <div key={feature.id} className="rounded-lg bg-muted/35 px-3 py-2">
                <div className="font-medium text-foreground">{feature.name}</div>
                <div>{buildFeatureSummary(feature, item)}</div>
                {feature.description ? <div className="mt-1">{feature.description}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        {definition.modifiers.length ? (
          <div className="space-y-1">
            <div className="font-semibold uppercase tracking-wide text-muted-foreground">Bonus e modificatori</div>
            {definition.modifiers.map((modifier) => (
              <div key={modifier.id} className="rounded-lg bg-muted/35 px-3 py-2">{buildModifierSummary(modifier)}</div>
            ))}
          </div>
        ) : null}

        {definition.useEffects.length ? (
          <div className="space-y-1">
            <div className="font-semibold uppercase tracking-wide text-muted-foreground">Effetti all'uso</div>
            {definition.useEffects.map((effect) => (
              <div key={effect.id} className="rounded-lg bg-muted/35 px-3 py-2">
                <div>{buildUseEffectSummary(effect)}</div>
                {effect.notes ? <div className="mt-1">{effect.notes}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        {definition.abilityRequirements.length ? (
          <div>Requisiti: {definition.abilityRequirements.map((entry) => `${entry.ability} ${entry.minScore}+`).join(", ")}</div>
        ) : null}
    </div>
  );
}

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
  const [visitClosing, setVisitClosing] = useState(false);
  const [shopUnread, setShopUnread] = useState(false);
  const [highlightedNegotiationId, setHighlightedNegotiationId] = useState<string | null>(null);
  const seenOpenKeys = useRef(new Set<string>());
  const negotiationStateKeys = useRef(new Map<string, string>());
  const dismissedVisitIdRef = useRef<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const negotiationSectionRef = useRef<HTMLElement | null>(null);

  const flashNegotiation = (negotiationId: string) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedNegotiationId(negotiationId);
    negotiationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    highlightTimerRef.current = setTimeout(() => setHighlightedNegotiationId(null), 1800);
  };

  const minimizeVisit = (visitId: string) => {
    dismissedVisitIdRef.current = visitId;
    setDismissedVisitId(visitId);
  };

  const reopenVisit = () => {
    dismissedVisitIdRef.current = null;
    setDismissedVisitId(null);
    setShopUnread(false);
  };

  const hydrateVisit = async (visit: ShopVisit, notifyChanges = false) => {
    try {
      const detail = await fetchShopVisitRequest(visit.id);
      for (const negotiation of detail.negotiations ?? []) {
        const current = negotiation.currentOffer;
        const stateKey = `${negotiation.status}:${current?.sequence ?? 0}`;
        const previousKey = negotiationStateKeys.current.get(negotiation.id);
        if (notifyChanges && previousKey !== stateKey) flashNegotiation(negotiation.id);
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
          minimizeVisit(visit.id);
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
      reopenVisit();
    });

    const offUpdated = onShopVisitUpdated(({ visit }) => {
      if (dismissedVisitIdRef.current === visit.id) setShopUnread(true);
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
      dismissedVisitIdRef.current = null;
      setShopUnread(false);
    });

    return () => {
      offOpened();
      offUpdated();
      offClosed();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [toast, user]);

  const visibleVisit = activeVisit && activeVisit.id !== dismissedVisitId ? activeVisit : null;
  const visibleItems = visibleVisit?.items ?? [];
  const visibleItemGroups = groupIdenticalNonStackableItems(visibleItems);
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
    const suggestedValue = item?.suggestedValue ?? null;
    if (item) setOfferDialog({
      kind: "proposal", direction: "CHARACTER_TO_SHOP", itemId: item.id, itemName: item.itemName,
      maxQuantity: item.quantity, equipped: !!item.isEquipped, amount: suggestedValue?.amount ?? 1, currency: suggestedValue?.currency ?? "GP",
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
    minimizeVisit(activeVisit.id);
  };

  const closeVisit = async () => {
    if (!activeVisit || visitClosing) return;
    setVisitClosing(true);
    try {
      const closed = await closeShopVisitRequest(activeVisit.id, "closed_by_player_popup");
      setActiveVisit(closed.status === "ACTIVE" ? closed : null);
      setDismissedVisitId(null);
      dismissedVisitIdRef.current = null;
      setShopUnread(false);
    } catch (error) {
      toast({
        title: "Visita non chiusa",
        description: String(error instanceof Error ? error.message : error),
        variant: "destructive",
      });
    } finally {
      setVisitClosing(false);
    }
  };

  const dialogNegotiation = offerDialog && offerDialog.kind !== "proposal" ? offerDialog.negotiation : null;
  const dialogOffer = dialogNegotiation?.currentOffer;

  return (
    <>
    <Dialog open={!!visibleVisit} onOpenChange={(open) => !open && activeVisit && minimizeVisit(activeVisit.id)}>
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
              <section className="rounded-xl border border-border/70 bg-background/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-heading text-xl text-primary">Vetrina</h3>
                  <span className="text-xs text-muted-foreground">
                    {visibleItemGroups.length} {visibleItemGroups.length === 1 ? "prodotto" : "prodotti"} · {visibleItems.reduce((total, item) => total + item.quantity, 0)} disponibili
                  </span>
                </div>
                <div className="space-y-3">
                  {visibleItemGroups.length ? visibleItemGroups.map(({ item, instanceCount, availableQuantity }) => (
                    <div key={item.id} className="group rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-card/90">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{item.name}</span>
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                              {formatItemCategory(item.definition?.category)}
                            </span>
                            {item.definition?.rarity ? (
                              <span className="rounded-full bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground">{item.definition.rarity}</span>
                            ) : null}
                            {instanceCount > 1 ? (
                              <span className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">×{instanceCount}</span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Disponibili: {availableQuantity}{instanceCount > 1 ? " · una copia per trattativa" : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Prezzo</div>
                          <div className="mt-1 font-semibold text-primary">{item.discountedPrice.amount} {item.discountedPrice.currency}</div>
                          {item.discountedPrice.amount !== item.price.amount ? (
                            <div className="text-xs text-muted-foreground line-through">{item.price.amount} {item.price.currency}</div>
                          ) : null}
                          {item.isSecret ? (
                            <div className="mt-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-100">
                              Rivelato
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {item.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      ) : null}
                      <ShopVisibleItemDetails item={item} />
                      <div className="mt-3 flex justify-end">
                        <Button type="button" size="sm" variant="outline" className="rounded-full" aria-label={`Fai un'offerta per acquistare ${item.name}`} title="Offri acquisto" onClick={() => void proposeBuy(item.id)}>
                          <ShoppingCart className="h-4 w-4" />
                          <span className="ml-2">Offri</span>
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

              <section className="rounded-xl border border-border/70 bg-background/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-heading text-xl text-primary">Inventario</h3>
                  <span className="text-xs text-muted-foreground">{inventoryItems.length} righe</span>
                </div>
                <div className="space-y-3">
                  {inventoryItems.length ? inventoryItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-card/90">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{item.itemName}</span>
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                              {formatItemCategory(item.itemCategory)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">Quantita: {item.quantity}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Valore indicativo: {formatIndicativeValue(item.suggestedValue)}</div>
                        </div>
                        {item.isEquipped ? (
                          <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                            Equipaggiato
                          </span>
                        ) : null}
                      </div>
                      {item.detailSummary ? (
                        <p className="mt-2 text-sm text-muted-foreground">{item.detailSummary}</p>
                      ) : null}
                      <div className="mt-3 flex justify-end">
                        <Button type="button" size="sm" variant="outline" className="rounded-full" aria-label={`Proponi la vendita di ${item.itemName}`} title="Proponi vendita" onClick={() => void proposeSell(item.id)}>
                          <BadgeDollarSign className="h-4 w-4" />
                          <span className="ml-2">Vendi</span>
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

            <section ref={negotiationSectionRef} className="order-1 scroll-mt-2 rounded-md border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-heading text-xl text-primary">Trattative</h3>
                <span className="text-xs text-muted-foreground">{negotiations.filter((entry) => entry.status === "OPEN").length} aperte</span>
              </div>
              <div className="space-y-2">
                {negotiations.length ? [...negotiations].sort((left, right) => Number(right.status === "OPEN") - Number(left.status === "OPEN")).map((negotiation) => {
                  const current = negotiation.currentOffer;
                  const isCurrentProposer = current?.proposerSide ? current.proposerSide === "CHARACTER" : current?.proposedByRole !== "dm";
                  return (
                    <div key={negotiation.id} className={`rounded-md border bg-card/70 p-3 transition-all ${highlightedNegotiationId === negotiation.id ? "animate-pulse border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/15" : "border-border/60"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{negotiation.itemNameSnapshot}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {negotiation.direction === "SHOP_TO_CHARACTER" ? "Acquisto dal negozio" : "Vendita al negozio"} · Qta {negotiation.quantity}
                          </div>
                          <ShopOfferComparison offers={negotiation.offers} viewerSide="CHARACTER" status={negotiation.status} className="mt-3" />
                        </div>
                        {negotiation.status === "OPEN" ? (
                          <div className="flex flex-wrap gap-2">
                            {!isCurrentProposer ? (
                              <>
                                <Button type="button" size="sm" className="rounded-full" onClick={() => void answerNegotiation(negotiation, "accept")}><Check className="mr-1.5 h-4 w-4" />Accetta</Button>
                                <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-full" aria-label={`Rilancia l'offerta per ${negotiation.itemNameSnapshot}`} title="Rilancia" onClick={() => void answerNegotiation(negotiation, "counter")}><Repeat2 className="h-4 w-4" /></Button>
                                <Button type="button" size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => void answerNegotiation(negotiation, "reject")}><X className="mr-1.5 h-4 w-4" />Rifiuta</Button>
                              </>
                            ) : (
                              <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => void answerNegotiation(negotiation, "withdraw")}><Undo2 className="mr-1.5 h-4 w-4" />Ritira</Button>
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

            <div className="sticky bottom-0 z-10 order-3 flex flex-col-reverse gap-2 border-t bg-card/95 py-3 backdrop-blur sm:flex-row sm:justify-end">
              <Button type="button" variant="destructive" className="rounded-full" disabled={visitClosing} onClick={closeVisit}>
                <DoorOpen className="mr-2 h-4 w-4" />
                {visitClosing ? "Uscita…" : "Lascia negozio"}
              </Button>
              <Button type="button" className="rounded-full" onClick={openCharacterSheet}>
                <ExternalLink className="mr-2 h-4 w-4" />Scheda
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    {activeVisit && dismissedVisitId === activeVisit.id ? (
      <div className="group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[9999]">
        <button
          type="button"
          disabled={visitClosing}
          onClick={reopenVisit}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/60 bg-card/95 text-primary shadow-2xl backdrop-blur transition-transform hover:-translate-y-0.5 disabled:opacity-60 supports-[backdrop-filter]:bg-card/90 ${shopUnread ? "animate-pulse ring-4 ring-primary/35" : ""}`}
          aria-label={`Riapri la visita presso ${activeVisit.shop.name}`}
          title={`Riapri ${activeVisit.shop.name}`}
        >
          <ShoppingCart className="h-6 w-6" />
          {shopUnread ? <span className="absolute -left-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-primary ring-2 ring-background" aria-hidden="true" /> : null}
        </button>
        <button
          type="button"
          disabled={visitClosing}
          onClick={(event) => { event.stopPropagation(); void closeVisit(); }}
          className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground shadow-sm transition-colors hover:text-destructive disabled:opacity-60"
          aria-label={`Lascia il negozio ${activeVisit.shop.name}`}
          title="Lascia negozio"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ) : null}
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
        suggestedValueLabel={offerDialog.kind === "proposal" && offerDialog.direction === "CHARACTER_TO_SHOP"
          ? formatIndicativeValue(activeVisit?.inventory?.find((item) => item.id === offerDialog.itemId)?.suggestedValue)
          : undefined}
        loading={offerSubmitting}
        onOpenChange={(open) => !open && setOfferDialog(null)}
        onConfirm={submitOfferDialog}
      />
    ) : null}
    </>
  );
}
