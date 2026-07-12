import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Check, DoorClosed, Download, Eye, EyeOff, FileJson, HandCoins, PackagePlus, Pencil, Plus, Repeat2, ScanSearch, ShoppingBasket, Store, Trash2, Undo2, Upload, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchCharacters, onShopVisitClosed, onShopVisitOpened, onShopVisitUpdated } from "@/realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ShopOfferDialog, { type ShopOfferDialogPayload } from "@/components/shop-offer-dialog";
import { CurrencyWallet } from "@/components/currency-wallet";
import { ShopOfferComparison } from "@/components/shop-offer-comparison";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  acceptShopNegotiationRequest,
  archiveDmShopRequest,
  createDmShopItemRequest,
  createDmShopRequest,
  createShopCounterOfferRequest,
  createShopNegotiationRequest,
  deleteDmShopItemRequest,
  fetchDmShops,
  fetchDmShopImportCatalogIndex,
  fetchDmShopCharacterProfile,
  fetchActiveShopVisitRequest,
  fetchShopVisitRequest,
  fetchItemDefinitions,
  importDmShopsRequest,
  openDmShopVisitRequest,
  closeShopVisitRequest,
  rejectShopNegotiationRequest,
  revealDmShopVisitItemRequest,
  withdrawShopNegotiationRequest,
  updateDmShopCharacterProfile,
  updateDmShopItemRequest,
  updateDmShopRequest,
  type DmShop,
  type DmShopItem,
  type DmShopCharacterProfile,
  type ItemDefinitionSummary,
  type ShopImportPreview,
  type ShopVisit,
  type ShopCurrency,
  type ShopNegotiation,
  type ShopFormPayload,
  type ShopItemFormPayload,
} from "@/lib/auth";

const emptyShop = (): ShopFormPayload => ({
  externalKey: "", name: "", description: "", ownerName: "", ownerDescription: "", city: "",
  dmNotes: "", discountDc: null, balance: { cp: 0, sp: 0, ep: 0, gp: 0 },
});

const emptyItem = (): ShopItemFormPayload => ({
  itemDefinitionId: "", quantity: 1, price: { currency: "GP", amount: 1 },
  isSecret: false, discoveryDc: null, sortOrder: 0,
  nameOverride: null, descriptionOverride: null, dmNotes: null, instanceNotes: null,
});

type ShopCharacterOption = {
  slug: string;
  name: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}

function shopKeyFromName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toShopForm(shop: DmShop): ShopFormPayload {
  return {
    externalKey: shop.externalKey, name: shop.name, description: shop.description,
    ownerName: shop.ownerName, ownerDescription: shop.ownerDescription, city: shop.city,
    dmNotes: shop.dmNotes, discountDc: shop.discountDc, balance: { ...shop.balance },
  };
}

function toItemForm(item: DmShopItem): ShopItemFormPayload {
  return {
    itemDefinitionId: item.itemDefinitionId ?? "", quantity: item.quantity, price: { ...item.price },
    isSecret: item.isSecret, discoveryDc: item.discoveryDc, sortOrder: item.sortOrder,
    nameOverride: item.nameOverride, descriptionOverride: item.descriptionOverride,
    dmNotes: item.dmNotes, instanceNotes: item.instanceNotes,
  };
}

export default function DmShopsPage() {
  const [shops, setShops] = useState<DmShop[]>([]);
  const [catalog, setCatalog] = useState<ItemDefinitionSummary[]>([]);
  const [characters, setCharacters] = useState<ShopCharacterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [shopDialogOpen, setShopDialogOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<DmShop | null>(null);
  const [shopForm, setShopForm] = useState<ShopFormPayload>(emptyShop);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemShop, setItemShop] = useState<DmShop | null>(null);
  const [editingItem, setEditingItem] = useState<DmShopItem | null>(null);
  const [itemForm, setItemForm] = useState<ShopItemFormPayload>(emptyItem);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ShopImportPreview | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileShop, setProfileShop] = useState<DmShop | null>(null);
  const [profileSlug, setProfileSlug] = useState("");
  const [profile, setProfile] = useState<DmShopCharacterProfile | null>(null);
  const [profileNotes, setProfileNotes] = useState("");
  const [profileDiscount, setProfileDiscount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeVisit, setActiveVisit] = useState<ShopVisit | null>(null);
  const [visitDetailOpen, setVisitDetailOpen] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [visitShop, setVisitShop] = useState<DmShop | null>(null);
  const [visitSlug, setVisitSlug] = useState("");
  const [visitDiscount, setVisitDiscount] = useState(0);
  const [visitNotes, setVisitNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const negotiationStateKeys = useRef(new Map<string, string>());
  const realtimeReady = useRef(false);
  const [highlightedNegotiationId, setHighlightedNegotiationId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const negotiationSectionRef = useRef<HTMLElement | null>(null);
  const [offerDialog, setOfferDialog] = useState<
    | { kind: "proposal"; direction: "SHOP_TO_CHARACTER" | "CHARACTER_TO_SHOP"; itemId: string; itemName: string; maxQuantity: number; equipped: boolean; amount: number; currency: ShopCurrency }
    | { kind: "counter" | "accept"; negotiation: ShopNegotiation }
    | null
  >(null);

  const flashNegotiation = (negotiationId: string) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedNegotiationId(negotiationId);
    negotiationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    highlightTimerRef.current = setTimeout(() => setHighlightedNegotiationId(null), 1800);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const [nextShops, nextCatalog, nextCharacters, nextActiveVisit] = await Promise.all([fetchDmShops(includeArchived), fetchItemDefinitions(), fetchCharacters(), fetchActiveShopVisitRequest()]);
      setShops(nextShops);
      setCatalog(nextCatalog);
      setActiveVisit(nextActiveVisit);
      for (const negotiation of nextActiveVisit?.negotiations ?? []) {
        negotiationStateKeys.current.set(negotiation.id, `${negotiation.status}:${negotiation.currentOffer?.sequence ?? 0}`);
      }
      realtimeReady.current = true;
      setCharacters(
        (Array.isArray(nextCharacters) ? nextCharacters : [])
          .filter((item: any) => item?.characterType === "pg")
          .map((item: any) => ({ slug: String(item.slug), name: String(item?.basicInfo?.characterName ?? item.name ?? item.slug) }))
          .sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }))
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [includeArchived]);

  useEffect(() => {
    const refreshVisit = ({ visit }: { visit: ShopVisit }) => {
      if (visit.status !== "ACTIVE") {
        setActiveVisit(null);
        setVisitDetailOpen(false);
        return;
      }
      void fetchShopVisitRequest(visit.id)
        .then((detail) => {
          setActiveVisit(detail);
          for (const negotiation of detail.negotiations ?? []) {
            const current = negotiation.currentOffer;
            const stateKey = `${negotiation.status}:${current?.sequence ?? 0}`;
            const previousKey = negotiationStateKeys.current.get(negotiation.id);
            const proposerSide = current?.proposerSide ?? (current?.proposedByRole === "dm" ? "SHOP" : "CHARACTER");
            if (realtimeReady.current && previousKey && previousKey !== stateKey) {
              flashNegotiation(negotiation.id);
              if (negotiation.status === "OPEN" && proposerSide === "CHARACTER" && current) {
                setVisitDetailOpen(true);
              }
            } else if (realtimeReady.current && !previousKey && negotiation.status === "OPEN" && proposerSide === "CHARACTER" && current) {
              flashNegotiation(negotiation.id);
              setVisitDetailOpen(true);
            }
            negotiationStateKeys.current.set(negotiation.id, stateKey);
          }
        })
        .catch((error) => toast.error(errorMessage(error)));
    };
    const offOpened = onShopVisitOpened(refreshVisit);
    const offUpdated = onShopVisitUpdated(refreshVisit);
    const offClosed = onShopVisitClosed(refreshVisit);
    return () => {
      offOpened(); offUpdated(); offClosed();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const groupedShops = useMemo(() => {
    const groups = new Map<string, DmShop[]>();
    for (const shop of shops) {
      const city = shop.city || "Senza città";
      groups.set(city, [...(groups.get(city) ?? []), shop]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "it"));
  }, [shops]);

  const filteredCatalog = useMemo(() => {
    const needle = catalogFilter.trim().toLowerCase();
    return catalog.filter((item) => !needle || `${item.name} ${item.slug}`.toLowerCase().includes(needle)).slice(0, 100);
  }, [catalog, catalogFilter]);

  const openNewShop = () => {
    setEditingShop(null); setShopForm(emptyShop()); setShopDialogOpen(true);
  };

  const openEditShop = (shop: DmShop) => {
    setEditingShop(shop); setShopForm(toShopForm(shop)); setShopDialogOpen(true);
  };

  const saveShop = async () => {
    setSubmitting(true);
    try {
      if (editingShop) await updateDmShopRequest(editingShop.id, shopForm);
      else await createDmShopRequest(shopForm);
      toast.success(editingShop ? "Negozio aggiornato." : "Negozio creato.");
      setShopDialogOpen(false);
      await reload();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const archiveShop = async (shop: DmShop) => {
    if (!window.confirm(`Archiviare “${shop.name}”? Lo storico resterà disponibile.`)) return;
    try { await archiveDmShopRequest(shop.id); toast.success("Negozio archiviato."); await reload(); }
    catch (error) { toast.error(errorMessage(error)); }
  };

  const openNewItem = (shop: DmShop) => {
    setItemShop(shop); setEditingItem(null); setItemForm({ ...emptyItem(), sortOrder: shop.items.length * 100 });
    setCatalogFilter(""); setItemDialogOpen(true);
  };

  const openEditItem = (shop: DmShop, item: DmShopItem) => {
    setItemShop(shop); setEditingItem(item); setItemForm(toItemForm(item));
    setCatalogFilter(item.definition?.name ?? ""); setItemDialogOpen(true);
  };

  const saveItem = async () => {
    if (!itemShop) return;
    setSubmitting(true);
    try {
      if (editingItem) await updateDmShopItemRequest(itemShop.id, editingItem.id, itemForm);
      else await createDmShopItemRequest(itemShop.id, itemForm);
      toast.success(editingItem ? "Prodotto aggiornato." : "Prodotto aggiunto allo stock.");
      setItemDialogOpen(false);
      await reload();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const deleteItem = async (shop: DmShop, item: DmShopItem) => {
    if (!window.confirm(`Rimuovere “${item.nameOverride || item.definition?.name || "oggetto"}” dallo stock?`)) return;
    try { await deleteDmShopItemRequest(shop.id, item.id); toast.success("Prodotto rimosso."); await reload(); }
    catch (error) { toast.error(errorMessage(error)); }
  };

  const parseImportText = () => {
    try {
      return JSON.parse(importText);
    } catch {
      throw new Error("JSON non valido.");
    }
  };

  const previewImport = async () => {
    setSubmitting(true);
    try {
      const preview = await importDmShopsRequest(parseImportText(), true);
      setImportPreview(preview);
      toast.success("Anteprima import pronta.");
    } catch (error) {
      const details = (error as Error & { details?: unknown }).details;
      if (details && typeof details === "object") setImportPreview(details as ShopImportPreview);
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const applyImport = async () => {
    if (!importPreview?.ok) return;
    setSubmitting(true);
    try {
      const result = await importDmShopsRequest(parseImportText(), false);
      toast.success(`Import completato: ${result.summary.shops} negozi creati.`);
      setImportDialogOpen(false);
      setImportText("");
      setImportPreview(null);
      await reload();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const readImportFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setImportPreview(null);
  };

  const downloadCatalogIndex = async () => {
    try {
      const index = await fetchDmShopImportCatalogIndex();
      const blob = new Blob([JSON.stringify(index, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "shop-catalog-index.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const loadProfile = async (shop: DmShop, slug: string) => {
    if (!slug) {
      setProfile(null);
      setProfileNotes("");
      setProfileDiscount(null);
      return;
    }
    setProfileLoading(true);
    try {
      const nextProfile = await fetchDmShopCharacterProfile(shop.id, slug);
      setProfile(nextProfile);
      setProfileNotes(nextProfile.dmNotes);
      setProfileDiscount(nextProfile.usualDiscountPercent);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setProfileLoading(false); }
  };

  const openProfiles = (shop: DmShop) => {
    setProfileShop(shop);
    setProfile(null);
    setProfileNotes("");
    setProfileDiscount(null);
    const firstSlug = characters[0]?.slug ?? "";
    setProfileSlug(firstSlug);
    setProfileDialogOpen(true);
    if (firstSlug) void loadProfile(shop, firstSlug);
  };

  const changeProfileCharacter = (slug: string) => {
    setProfileSlug(slug);
    if (profileShop) void loadProfile(profileShop, slug);
  };

  const saveProfile = async () => {
    if (!profileShop || !profileSlug) return;
    setSubmitting(true);
    try {
      const saved = await updateDmShopCharacterProfile(profileShop.id, profileSlug, {
        dmNotes: profileNotes,
        usualDiscountPercent: profileDiscount,
      });
      setProfile(saved);
      toast.success("Profilo negozio-PG salvato.");
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const applyVisitProfileDefaults = async (shop: DmShop, slug: string) => {
    if (!slug) {
      setVisitDiscount(0);
      return;
    }
    try {
      const nextProfile = await fetchDmShopCharacterProfile(shop.id, slug);
      setVisitDiscount(nextProfile.usualDiscountPercent ?? 0);
    } catch {
      setVisitDiscount(0);
    }
  };

  const openVisitDialog = (shop: DmShop) => {
    setVisitShop(shop);
    const firstSlug = characters[0]?.slug ?? "";
    setVisitSlug(firstSlug);
    setVisitDiscount(0);
    setVisitNotes("");
    setVisitDialogOpen(true);
    if (firstSlug) void applyVisitProfileDefaults(shop, firstSlug);
  };

  const changeVisitCharacter = (slug: string) => {
    setVisitSlug(slug);
    if (visitShop) void applyVisitProfileDefaults(visitShop, slug);
  };

  const openVisit = async () => {
    if (!visitShop || !visitSlug) return;
    setSubmitting(true);
    try {
      const visit = await openDmShopVisitRequest({
        shopId: visitShop.id,
        characterSlug: visitSlug,
        discountPercent: visitDiscount,
        dmNotes: visitNotes,
      });
      setActiveVisit(visit);
      setVisitDialogOpen(false);
      setVisitDetailOpen(true);
      toast.success("Visita negozio aperta.");
      await reload();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const closeActiveVisit = async () => {
    if (!activeVisit) return;
    setSubmitting(true);
    try {
      await closeShopVisitRequest(activeVisit.id);
      setActiveVisit(null);
      setVisitDetailOpen(false);
      toast.success("Visita negozio chiusa.");
      await reload();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const openActiveVisitDetail = async () => {
    if (!activeVisit) return;
    try {
      const detail = await fetchShopVisitRequest(activeVisit.id);
      setActiveVisit(detail);
      setVisitDetailOpen(true);
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const revealVisitItem = async (shopItemId: string) => {
    if (!activeVisit) return;
    setSubmitting(true);
    try {
      const detail = await revealDmShopVisitItemRequest(activeVisit.id, shopItemId);
      setActiveVisit(detail);
      toast.success("Oggetto rivelato al player.");
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const proposeVisitShopItem = (shopItemId: string) => {
    const item = activeVisit?.items?.find((candidate) => candidate.id === shopItemId);
    if (item) setOfferDialog({
      kind: "proposal", direction: "SHOP_TO_CHARACTER", itemId: item.id, itemName: item.name,
      maxQuantity: item.quantity, equipped: false, amount: item.discountedPrice.amount, currency: item.discountedPrice.currency,
    });
  };

  const proposeVisitCharacterItem = (characterItemId: string) => {
    const item = activeVisit?.inventory?.find((candidate) => candidate.id === characterItemId);
    if (item) setOfferDialog({
      kind: "proposal", direction: "CHARACTER_TO_SHOP", itemId: item.id, itemName: item.itemName,
      maxQuantity: item.quantity, equipped: !!item.isEquipped, amount: 1, currency: "GP",
    });
  };

  const submitVisitOfferDialog = async (payload: ShopOfferDialogPayload) => {
    if (!activeVisit || !offerDialog) return;
    setSubmitting(true);
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
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  const answerVisitNegotiation = async (negotiation: ShopNegotiation, action: "accept" | "reject" | "withdraw" | "counter") => {
    if (action === "accept" || action === "counter") {
      setOfferDialog({ kind: action, negotiation });
      return;
    }
    setSubmitting(true);
    try {
      const detail = action === "reject"
        ? await rejectShopNegotiationRequest(negotiation.id)
        : await withdrawShopNegotiationRequest(negotiation.id);
      setActiveVisit(detail);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen parchment p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" asChild><Link to="/dm" aria-label="Torna alla dashboard DM" title="Torna alla dashboard DM"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div><h1 className="font-heading text-3xl font-bold text-primary">Negozi</h1><p className="text-sm text-muted-foreground">Gestione permanente di botteghe, saldi e stock.</p></div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <label className="flex items-center gap-2 text-sm"><Switch checked={includeArchived} onCheckedChange={setIncludeArchived} /> Archiviati</label>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label="Importa negozi da JSON" title="Importa negozi da JSON" onClick={() => setImportDialogOpen(true)}><FileJson className="h-4 w-4" /></Button>
            <Button className="rounded-full px-4" aria-label="Crea nuovo negozio" onClick={openNewShop}><Plus className="mr-2 h-4 w-4" />Negozio</Button>
          </div>
        </header>

        {activeVisit && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5 p-4">
            <div>
              <div className="font-medium">Visita attiva: {activeVisit.shop.name}</div>
              <p className="text-sm text-muted-foreground">{activeVisit.character.name} presso {activeVisit.shop.ownerName} - sconto visita {activeVisit.discountPercent}%</p>
            </div>
            <div className="flex gap-2">
              <Button className="rounded-full" onClick={() => void openActiveVisitDetail()}><Store className="mr-2 h-4 w-4" />Gestisci</Button>
              <Button variant="destructive" className="rounded-full" disabled={submitting} onClick={() => void closeActiveVisit()}><DoorClosed className="mr-2 h-4 w-4" />Chiudi visita</Button>
            </div>
          </Card>
        )}

        {loading ? <Card className="p-8 text-center text-muted-foreground">Carico i negozi…</Card> : groupedShops.length === 0 ? (
          <Card className="p-10 text-center"><Store className="mx-auto mb-3 h-10 w-10 text-primary/60" /><p className="font-heading text-xl">Nessun negozio</p><p className="mt-1 text-sm text-muted-foreground">Crea la prima bottega per iniziare a comporre lo stock.</p></Card>
        ) : groupedShops.map(([city, cityShops]) => (
          <section key={city} className="space-y-3">
            <h2 className="font-heading text-2xl text-primary">{city}</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {cityShops.map((shop) => (
                <Card key={shop.id} className={`p-5 ${shop.archivedAt ? "opacity-65" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-xl font-semibold">{shop.name}</h3>{shop.archivedAt && <Badge variant="secondary">Archiviato</Badge>}</div><p className="text-sm text-muted-foreground">{shop.ownerName} · {shop.externalKey}</p></div>
                    <div className="flex gap-1"><Button variant="ghost" size="icon" className="rounded-full" aria-label={`Apri visita presso ${shop.name}`} title="Apri visita" disabled={!!activeVisit || !!shop.archivedAt} onClick={() => openVisitDialog(shop)}><Store className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="rounded-full" aria-label={`Gestisci rapporti di ${shop.name}`} title="Rapporti con i PG" onClick={() => openProfiles(shop)}><Users className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="rounded-full" aria-label={`Modifica ${shop.name}`} title="Modifica negozio" onClick={() => openEditShop(shop)}><Pencil className="h-4 w-4" /></Button>{!shop.archivedAt && <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Archivia ${shop.name}`} title="Archivia negozio" onClick={() => void archiveShop(shop)}><Archive className="h-4 w-4" /></Button>}</div>
                  </div>
                  {shop.description && <p className="mt-3 text-sm">{shop.description}</p>}
                  {shop.dmNotes && <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-900">Note DM: {shop.dmNotes}</p>}
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">{(["cp", "sp", "ep", "gp"] as const).map((currency) => <Badge key={currency} variant="outline">{shop.balance[currency]} {currency.toUpperCase()}</Badge>)}{shop.discountDc && <Badge variant="outline">CD sconto {shop.discountDc}</Badge>}</div>
                  <div className="mt-5 flex items-center justify-between"><h4 className="font-medium">Stock ({shop.items.length})</h4>{!shop.archivedAt && <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" aria-label={`Aggiungi prodotto a ${shop.name}`} title="Aggiungi prodotto" onClick={() => openNewItem(shop)}><PackagePlus className="h-4 w-4" /></Button>}</div>
                  <div className="mt-2 divide-y rounded-md border">
                    {shop.items.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Stock vuoto</p> : shop.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-medium">{item.nameOverride || item.definition?.name || "Definizione rimossa"}</span>{item.isSecret && <EyeOff className="h-3.5 w-3.5 text-amber-600" />}</div><p className="text-xs text-muted-foreground">Qtà {item.quantity} · {item.price.amount} {item.price.currency}{item.discoveryDc ? ` · CD ${item.discoveryDc}` : ""}</p></div>
                        <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="rounded-full" aria-label="Modifica prodotto" title="Modifica prodotto" onClick={() => openEditItem(shop, item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="rounded-full" aria-label="Elimina prodotto" title="Elimina prodotto" onClick={() => void deleteItem(shop, item)}><Trash2 className="h-4 w-4" /></Button></div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={shopDialogOpen} onOpenChange={setShopDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editingShop ? "Modifica negozio" : "Nuovo negozio"}</DialogTitle><DialogDescription>I dati amministrativi e i saldi sono visibili soltanto al DM.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <Field label="Nome"><Input value={shopForm.name} onChange={(e) => { const name = e.target.value; setShopForm({ ...shopForm, name, externalKey: editingShop ? shopForm.externalKey : "" }); }} /></Field>
            <Field label="Chiave generata automaticamente"><Input value={shopForm.externalKey || shopKeyFromName(shopForm.name)} readOnly className="bg-muted/50 text-muted-foreground" /></Field>
            <Field label="Città"><Input value={shopForm.city} onChange={(e) => setShopForm({ ...shopForm, city: e.target.value })} /></Field>
            <Field label="Proprietario"><Input value={shopForm.ownerName} onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })} /></Field>
            <Field label="Descrizione" wide><Textarea value={shopForm.description} onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })} /></Field>
            <Field label="Descrizione proprietario" wide><Textarea value={shopForm.ownerDescription} onChange={(e) => setShopForm({ ...shopForm, ownerDescription: e.target.value })} /></Field>
            <Field label="Note DM" wide><Textarea value={shopForm.dmNotes} onChange={(e) => setShopForm({ ...shopForm, dmNotes: e.target.value })} /></Field>
            <Field label="CD sconto"><Input type="number" min={1} value={shopForm.discountDc ?? ""} onChange={(e) => setShopForm({ ...shopForm, discountDc: e.target.value ? Number(e.target.value) : null })} /></Field>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["cp", "sp", "ep", "gp"] as const).map((currency) => <Field key={currency} label={currency.toUpperCase()}><Input type="number" min={0} value={shopForm.balance[currency]} onChange={(e) => setShopForm({ ...shopForm, balance: { ...shopForm.balance, [currency]: Number(e.target.value) } })} /></Field>)}</div>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-full" onClick={() => setShopDialogOpen(false)}>Annulla</Button><Button className="rounded-full" disabled={submitting || !shopForm.name || !shopForm.city || !shopForm.ownerName} onClick={() => void saveShop()}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editingItem ? "Modifica prodotto" : `Aggiungi prodotto · ${itemShop?.name ?? ""}`}</DialogTitle><DialogDescription>Il prezzo censito sarà mostrato durante la visita; l'eventuale sconto personale viene calcolato separatamente.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <Field label="Cerca catalogo" wide><Input placeholder="Nome o slug…" value={catalogFilter} onChange={(e) => setCatalogFilter(e.target.value)} /></Field>
            <Field label="Oggetto di catalogo" wide><Select value={itemForm.itemDefinitionId} onValueChange={(value) => setItemForm({ ...itemForm, itemDefinitionId: value })}><SelectTrigger><SelectValue placeholder="Seleziona un oggetto" /></SelectTrigger><SelectContent>{filteredCatalog.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.category}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Quantità"><Input type="number" min={1} value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Importo"><Input type="number" min={1} value={itemForm.price.amount} onChange={(e) => setItemForm({ ...itemForm, price: { ...itemForm.price, amount: Number(e.target.value) } })} /></Field><Field label="Valuta"><Select value={itemForm.price.currency} onValueChange={(currency: ShopCurrency) => setItemForm({ ...itemForm, price: { ...itemForm.price, currency } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["CP", "SP", "EP", "GP"].map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent></Select></Field></div>
            <Field label="Nome personalizzato"><Input value={itemForm.nameOverride ?? ""} onChange={(e) => setItemForm({ ...itemForm, nameOverride: e.target.value || null })} /></Field>
            <Field label="Ordine"><Input type="number" min={0} value={itemForm.sortOrder} onChange={(e) => setItemForm({ ...itemForm, sortOrder: Number(e.target.value) })} /></Field>
            <div className="flex items-center gap-3 rounded-md border p-3"><Switch checked={itemForm.isSecret} onCheckedChange={(isSecret) => setItemForm({ ...itemForm, isSecret, discoveryDc: isSecret ? itemForm.discoveryDc : null })} /><Label>Oggetto segreto</Label></div>
            <Field label="CD scoperta"><Input type="number" min={1} disabled={!itemForm.isSecret} value={itemForm.discoveryDc ?? ""} onChange={(e) => setItemForm({ ...itemForm, discoveryDc: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Note DM" wide><Textarea value={itemForm.dmNotes ?? ""} onChange={(e) => setItemForm({ ...itemForm, dmNotes: e.target.value || null })} /></Field>
            <Field label="Note dell'istanza" wide><Textarea value={itemForm.instanceNotes ?? ""} onChange={(e) => setItemForm({ ...itemForm, instanceNotes: e.target.value || null })} /></Field>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-full" onClick={() => setItemDialogOpen(false)}>Annulla</Button><Button className="rounded-full" disabled={submitting || !itemForm.itemDefinitionId || itemForm.quantity < 1 || itemForm.price.amount < 1} onClick={() => void saveItem()}>Salva prodotto</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apri visita negozio</DialogTitle>
            <DialogDescription>{visitShop ? `Avvia una visita presso ${visitShop.name}.` : "Seleziona negozio e personaggio."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <Field label="Personaggio" wide>
              <Select value={visitSlug} onValueChange={changeVisitCharacter}>
                <SelectTrigger><SelectValue placeholder="Seleziona un PG" /></SelectTrigger>
                <SelectContent>{characters.map((character) => <SelectItem key={character.slug} value={character.slug}>{character.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Sconto visita %"><Input type="number" min={0} max={100} value={visitDiscount} onChange={(event) => setVisitDiscount(Number(event.target.value) || 0)} /></Field>
            <Field label="Note visita" wide><Textarea value={visitNotes} onChange={(event) => setVisitNotes(event.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setVisitDialogOpen(false)}>Annulla</Button>
            <Button className="rounded-full" disabled={submitting || !visitShop || !visitSlug || !!activeVisit} onClick={() => void openVisit()}>Apri visita</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visitDetailOpen} onOpenChange={setVisitDetailOpen}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden border-primary/25 bg-card/95">
          <DialogHeader>
            <DialogTitle>Gestisci visita</DialogTitle>
            <DialogDescription>
              {activeVisit ? `${activeVisit.character.name} presso ${activeVisit.shop.name}.` : ""}
            </DialogDescription>
          </DialogHeader>
          {activeVisit ? (
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              {activeVisit.shop.balance ? (
                <CurrencyWallet balance={activeVisit.shop.balance} label="Cassa del negozio" compact className="rounded-md border bg-muted/20 p-3" />
              ) : null}
              <div className="order-2 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-md border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-heading text-xl text-primary">Stock DM</h3>
                    <span className="text-xs text-muted-foreground">{activeVisit.items?.length ?? 0} righe</span>
                  </div>
                  <div className="space-y-2">
                    {(activeVisit.items ?? []).length ? (activeVisit.items ?? []).map((item) => (
                      <div key={item.id} className="rounded-md border bg-card/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              {item.isSecret ? <Badge variant="secondary">Segreto</Badge> : null}
                              {item.visibleToPlayer === false ? <Badge variant="outline">Non visibile</Badge> : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Qta {item.quantity}
                              {` · ${item.price.amount} ${item.price.currency}`}
                              {item.discoveryDc ? ` · CD ${item.discoveryDc}` : ""}
                            </div>
                            {item.discountedPrice.amount !== item.price.amount ? (
                              <div className="mt-2 text-sm">
                                Prezzo personale: <span className="text-muted-foreground line-through">{item.price.amount} {item.price.currency}</span>{" "}
                                <span className="font-semibold text-primary">{item.discountedPrice.amount} {item.discountedPrice.currency}</span>
                              </div>
                            ) : null}
                          </div>
                          {item.isSecret && item.visibleToPlayer === false ? (
                            <Button size="sm" variant="outline" className="rounded-full border-amber-500/40 text-amber-700" disabled={submitting} onClick={() => void revealVisitItem(item.id)}>
                              <Eye className="mr-2 h-4 w-4" />Rivela
                            </Button>
                          ) : null}
                          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" aria-label={`Proponi la vendita di ${item.name}`} title="Proponi vendita" disabled={submitting} onClick={() => void proposeVisitShopItem(item.id)}>
                            <HandCoins className="h-4 w-4" />
                          </Button>
                        </div>
                        {item.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p> : null}
                        {item.dmNotes ? <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-900">Note DM: {item.dmNotes}</p> : null}
                      </div>
                    )) : (
                      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Stock vuoto.</div>
                    )}
                  </div>
                </section>

                <section className="rounded-md border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-heading text-xl text-primary">Inventario PG</h3>
                    <span className="text-xs text-muted-foreground">{activeVisit.inventory?.length ?? 0} righe</span>
                  </div>
                  <div className="space-y-2">
                    {(activeVisit.inventory ?? []).length ? (activeVisit.inventory ?? []).map((item) => (
                      <div key={item.id} className="rounded-md border bg-card/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">{item.itemName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Qta {item.quantity}{item.itemCategory ? ` · ${item.itemCategory}` : ""}
                            </div>
                          </div>
                          {item.isEquipped ? <Badge variant="outline">Equipaggiato</Badge> : null}
                          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" aria-label={`Proponi l'acquisto di ${item.itemName}`} title="Proponi acquisto" disabled={submitting} onClick={() => void proposeVisitCharacterItem(item.id)}>
                            <ShoppingBasket className="h-4 w-4" />
                          </Button>
                        </div>
                        {item.detailSummary ? <p className="mt-2 text-sm text-muted-foreground">{item.detailSummary}</p> : null}
                      </div>
                    )) : (
                      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Inventario vuoto.</div>
                    )}
                  </div>
                </section>
              </div>
              <section ref={negotiationSectionRef} className="order-1 scroll-mt-2 rounded-md border border-primary/30 bg-primary/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-heading text-xl text-primary">Trattative</h3>
                  <span className="text-xs text-muted-foreground">{activeVisit.negotiations?.filter((entry) => entry.status === "OPEN").length ?? 0} aperte</span>
                </div>
                <div className="space-y-2">
                  {(activeVisit.negotiations ?? []).length ? [...(activeVisit.negotiations ?? [])].sort((left, right) => Number(right.status === "OPEN") - Number(left.status === "OPEN")).map((negotiation) => {
                    const current = negotiation.currentOffer;
                    const isDmProposal = current?.proposerSide ? current.proposerSide === "SHOP" : current?.proposedByRole === "dm";
                    return (
                      <div key={negotiation.id} className={`rounded-md border bg-card/70 p-3 transition-all ${highlightedNegotiationId === negotiation.id ? "animate-pulse border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/15" : ""}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{negotiation.itemNameSnapshot}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {negotiation.direction === "SHOP_TO_CHARACTER" ? "Vendita negozio a PG" : "Acquisto dal PG"} · Qta {negotiation.quantity}
                            </div>
                            <ShopOfferComparison offers={negotiation.offers} viewerSide="SHOP" status={negotiation.status} className="mt-3" />
                          </div>
                          {negotiation.status === "OPEN" ? (
                            <div className="flex flex-wrap gap-2">
                              {!isDmProposal ? (
                                <>
                                  <Button size="sm" className="rounded-full" disabled={submitting} onClick={() => void answerVisitNegotiation(negotiation, "accept")}><Check className="mr-1.5 h-4 w-4" />Accetta</Button>
                                  <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" aria-label={`Rilancia l'offerta per ${negotiation.itemNameSnapshot}`} title="Rilancia" disabled={submitting} onClick={() => void answerVisitNegotiation(negotiation, "counter")}><Repeat2 className="h-4 w-4" /></Button>
                                  <Button size="sm" variant="outline" className="rounded-full text-destructive" disabled={submitting} onClick={() => void answerVisitNegotiation(negotiation, "reject")}><X className="mr-1.5 h-4 w-4" />Rifiuta</Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" className="rounded-full" disabled={submitting} onClick={() => void answerVisitNegotiation(negotiation, "withdraw")}><Undo2 className="mr-1.5 h-4 w-4" />Ritira</Button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nessuna trattativa.</div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setVisitDetailOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rapporto con i PG</DialogTitle>
            <DialogDescription>{profileShop ? `Note private e sconto abituale per ${profileShop.name}.` : "Memoria negozio-personaggio."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <Field label="Personaggio" wide>
              <Select value={profileSlug} onValueChange={changeProfileCharacter}>
                <SelectTrigger><SelectValue placeholder="Seleziona un PG" /></SelectTrigger>
                <SelectContent>{characters.map((character) => <SelectItem key={character.slug} value={character.slug}>{character.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Visite registrate"><Input value={profile?.visitCount ?? 0} readOnly className="bg-muted/50 text-muted-foreground" /></Field>
            <Field label="Sconto abituale %"><Input type="number" min={0} max={100} value={profileDiscount ?? ""} onChange={(event) => setProfileDiscount(event.target.value === "" ? null : Number(event.target.value))} /></Field>
            <Field label="Ultima visita"><Input value={profile?.lastVisitedAt ? new Date(profile.lastVisitedAt).toLocaleString("it-IT") : "Mai"} readOnly className="bg-muted/50 text-muted-foreground" /></Field>
            <Field label="Note private" wide><Textarea disabled={profileLoading || !profileSlug} value={profileNotes} onChange={(event) => setProfileNotes(event.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setProfileDialogOpen(false)}>Chiudi</Button>
            <Button className="rounded-full" disabled={submitting || profileLoading || !profileSlug} onClick={() => void saveProfile()}>Salva profilo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setImportPreview(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import negozi JSON</DialogTitle>
            <DialogDescription>Anteprima e conferma usano la validazione del server; nessun negozio viene creato durante il dry-run.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label="Scarica indice catalogo" title="Scarica indice catalogo" onClick={() => void downloadCatalogIndex()}><Download className="h-4 w-4" /></Button>
                <Label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-medium">
                  <Upload className="mr-2 h-4 w-4" />Carica file
                  <Input className="hidden" type="file" accept="application/json,.json" onChange={(event) => void readImportFile(event.target.files?.[0] ?? null)} />
                </Label>
              </div>
              <Textarea
                className="min-h-[420px] font-mono text-xs"
                value={importText}
                onChange={(event) => { setImportText(event.target.value); setImportPreview(null); }}
                placeholder='{"formatVersion":1,"shops":[]}'
              />
            </div>

            <Card className="p-4">
              <h3 className="font-heading text-lg font-semibold">Anteprima</h3>
              {!importPreview ? (
                <p className="mt-2 text-sm text-muted-foreground">Esegui il dry-run per vedere negozi, prodotti, errori e avvisi.</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <Badge variant="outline">{importPreview.summary.shops} negozi</Badge>
                    <Badge variant="outline">{importPreview.summary.items} prodotti</Badge>
                    <Badge variant="outline">{importPreview.summary.newDefinitions} nuovi oggetti</Badge>
                    <Badge variant="outline">{importPreview.summary.reusedDefinitions} da catalogo</Badge>
                  </div>
                  {importPreview.errors.length > 0 && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3"><p className="font-medium text-destructive">Errori</p><ul className="mt-2 list-disc space-y-1 pl-5">{importPreview.errors.map((entry, index) => <li key={index}>{entry}</li>)}</ul></div>}
                  {importPreview.warnings.length > 0 && <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3"><p className="font-medium text-amber-700">Avvisi</p><ul className="mt-2 list-disc space-y-1 pl-5">{importPreview.warnings.map((entry, index) => <li key={index}>{entry}</li>)}</ul></div>}
                  <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                    {importPreview.shops.map((shop) => (
                      <div key={shop.externalKey} className="rounded-md border p-3">
                        <div className="font-medium">{shop.name}</div>
                        <div className="text-xs text-muted-foreground">{shop.city} · {shop.ownerName} · {shop.externalKey}</div>
                        <div className="mt-2 space-y-1">
                          {shop.items.map((item, index) => (
                            <div key={`${item.definitionSlug}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate">{item.name}</span>
                              <span className="shrink-0 text-muted-foreground">x{item.quantity} · {item.price.amount} {item.price.currency} · {item.source === "inline" ? "nuovo" : "catalogo"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setImportDialogOpen(false)}>Annulla</Button>
            <Button variant="outline" className="rounded-full" disabled={submitting || !importText.trim()} onClick={() => void previewImport()}><ScanSearch className="mr-2 h-4 w-4" />Anteprima</Button>
            <Button className="rounded-full" disabled={submitting || !importPreview?.ok} onClick={() => void applyImport()}><Upload className="mr-2 h-4 w-4" />Conferma import</Button>
          </DialogFooter>
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
              ? "Inserisci il nuovo importo da proporre al player."
              : offerDialog.direction === "SHOP_TO_CHARACTER"
                ? "Formula una proposta di vendita al player."
                : "Formula una proposta di acquisto dal player."}
          initialValue={{
            quantity: offerDialog.kind === "proposal" ? 1 : offerDialog.negotiation.quantity,
            amount: offerDialog.kind === "proposal" ? offerDialog.amount : offerDialog.negotiation.currentOffer?.amount ?? 1,
            currency: offerDialog.kind === "proposal" ? offerDialog.currency : offerDialog.negotiation.currentOffer?.currency ?? "GP",
          }}
          minQuantity={offerDialog.kind === "proposal" ? 1 : offerDialog.negotiation.quantity}
          maxQuantity={offerDialog.kind === "proposal" ? offerDialog.maxQuantity : offerDialog.negotiation.quantity}
          equippedWarning={offerDialog.kind === "proposal" ? offerDialog.equipped : false}
          suggestedUnitAmount={offerDialog.kind === "proposal" ? offerDialog.amount : undefined}
          loading={submitting}
          onOpenChange={(open) => !open && setOfferDialog(null)}
          onConfirm={submitVisitOfferDialog}
        />
      ) : null}
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={`space-y-1.5 ${wide ? "md:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>;
}
