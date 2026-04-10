import { useEffect, useMemo, useState } from "react";
import { Home, Package, Plus, Shield, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { fetchCharacters } from "@/realtime";
import {
  assignItemToCharacterRequest,
  deleteCharacterInventoryItemRequest,
  fetchCharacterInventoryItemsForDm,
  fetchItemDefinitions,
  type CharacterInventoryItemEntry,
  type ItemDefinitionSummary,
} from "@/lib/auth";

type CharacterSummary = {
  slug: string;
  name: string;
  characterType: "pg" | "png";
  className: string;
  level: number | null;
};

function normalizeCharacter(state: any): CharacterSummary | null {
  const slug = typeof state?.slug === "string" ? state.slug : "";
  if (!slug) return null;

  return {
    slug,
    name: state?.basicInfo?.characterName ?? slug,
    characterType: state?.characterType === "png" ? "png" : "pg",
    className: state?.basicInfo?.class ?? "",
    level: typeof state?.basicInfo?.level === "number" ? state.basicInfo.level : null,
  };
}

function isAvailableForAssignment(item: ItemDefinitionSummary) {
  return !(item.rarity === "UNIQUE" && item.assignedCharacterItemCount > 0);
}

export default function CharacterInventoryManagement() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [items, setItems] = useState<ItemDefinitionSummary[]>([]);
  const [selectedCharacterSlug, setSelectedCharacterSlug] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemQuery, setItemQuery] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [inventoryItems, setInventoryItems] = useState<CharacterInventoryItemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    document.title = "Assegna Oggetti | D&D Character Manager";
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.all([fetchCharacters(), fetchItemDefinitions()])
      .then(([characterStates, itemDefinitions]) => {
        if (!active) return;
        const nextCharacters = (Array.isArray(characterStates) ? characterStates : [])
          .map(normalizeCharacter)
          .filter((entry): entry is CharacterSummary => !!entry)
          .sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));

        const nextItems = (Array.isArray(itemDefinitions) ? itemDefinitions : [])
          .filter(isAvailableForAssignment)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));

        setCharacters(nextCharacters);
        setItems(nextItems);
        setSelectedCharacterSlug((prev) => prev || nextCharacters[0]?.slug || "");
        setSelectedItemId((prev) => prev || nextItems[0]?.id || "");
      })
      .catch(() => {
        if (active) toast.error("Non sono riuscito a caricare personaggi o catalogo oggetti.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (!isAvailableForAssignment(item)) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query);
    });
  }, [itemQuery, items]);

  useEffect(() => {
    if (!selectedItemId && filteredItems[0]?.id) {
      setSelectedItemId(filteredItems[0].id);
      return;
    }

    if (selectedItemId && !filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0]?.id ?? "");
    }
  }, [filteredItems, selectedItemId]);

  const selectedCharacter = characters.find((entry) => entry.slug === selectedCharacterSlug) ?? null;

  const refreshInventory = async (slug: string) => {
    setInventoryLoading(true);
    try {
      const nextInventory = await fetchCharacterInventoryItemsForDm(slug);
      setInventoryItems(Array.isArray(nextInventory) ? nextInventory : []);
    } catch {
      toast.error("Non sono riuscito a caricare l'inventario relazionale del personaggio.");
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCharacterSlug) {
      setInventoryItems([]);
      return;
    }
    void refreshInventory(selectedCharacterSlug);
  }, [selectedCharacterSlug]);

  const assignItem = async () => {
    if (!selectedCharacterSlug || !selectedItemId) return;
    setAssigning(true);
    try {
      const nextInventory = await assignItemToCharacterRequest(selectedCharacterSlug, {
        itemDefinitionId: selectedItemId,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || null,
      });
      setInventoryItems(Array.isArray(nextInventory) ? nextInventory : []);
      setQuantity("1");
      setNotes("");
      toast.success("Oggetto assegnato al personaggio.");
    } catch (error: any) {
      toast.error(error?.message || "Non sono riuscito ad assegnare l'oggetto.");
    } finally {
      setAssigning(false);
    }
  };

  const removeItem = async (characterItemId: string) => {
    if (!selectedCharacterSlug) return;
    try {
      await deleteCharacterInventoryItemRequest(selectedCharacterSlug, characterItemId);
      setInventoryItems((prev) => prev.filter((entry) => entry.id !== characterItemId));
      toast.success("Oggetto rimosso dall'inventario relazionale.");
    } catch (error: any) {
      toast.error(error?.message || "Non sono riuscito a rimuovere l'oggetto.");
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Assegna Oggetti</h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
              Workflow DM per creare le prime istanze oggetto dei personaggi partendo dal catalogo censito.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to="/" aria-label="Torna alla home DM">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to="/dm/items" aria-label="Apri gestione oggetti">
                <Shield className="h-4 w-4" />
              </Link>
            </Button>
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
              <Package className="h-4 w-4 text-primary" />
              <span>{inventoryItems.length}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="character-section space-y-4">
            <div className="space-y-2">
              <Label>Personaggi</Label>
              <ScrollArea className="h-[68vh] rounded-2xl border border-border/60 bg-background/45">
                <div className="divide-y divide-border/50">
                  {loading ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">Carico personaggi...</div>
                  ) : characters.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">Nessun personaggio disponibile.</div>
                  ) : (
                    characters.map((character) => (
                      <button
                        key={character.slug}
                        type="button"
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent/20 ${selectedCharacterSlug === character.slug ? "bg-accent/20" : ""}`}
                        onClick={() => setSelectedCharacterSlug(character.slug)}
                      >
                        <div className="font-medium text-primary">{character.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {character.characterType.toUpperCase()} · {character.className || "Classe?"}
                          {character.level ? ` · Lv ${character.level}` : ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="character-section space-y-4">
              <div>
                <h2 className="font-heading text-2xl text-primary">
                  {selectedCharacter ? `Assegna a ${selectedCharacter.name}` : "Seleziona un personaggio"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ogni assegnazione crea una vera `CharacterItem`, non un semplice link alla definizione.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dm/inventory/transactions">Transazioni oggetti</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dm/currency-transactions">Transazioni monete</Link>
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Cerca nel catalogo</Label>
                  <Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Nome o slug oggetto" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Oggetto</Label>
                  <Select value={selectedItemId || "__none__"} onValueChange={(value) => setSelectedItemId(value === "__none__" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona un oggetto" /></SelectTrigger>
                    <SelectContent>
                      {filteredItems.length === 0 ? (
                        <SelectItem value="__none__">Nessun risultato</SelectItem>
                      ) : (
                        filteredItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {item.category}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantità</Label>
                  <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Note assegnazione</Label>
                  <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opzionale" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void assignItem()} disabled={!selectedCharacterSlug || !selectedItemId || assigning}>
                  <Plus className="mr-2 h-4 w-4" />
                  Assegna oggetto
                </Button>
              </div>
            </Card>

            <Card className="character-section space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-primary">Inventario relazionale attuale</h3>
                  <p className="text-sm text-muted-foreground">
                    Vista tecnica delle `CharacterItem` create per il personaggio selezionato.
                  </p>
                </div>
                {selectedCharacterSlug ? (
                  <Button variant="outline" size="sm" onClick={() => void refreshInventory(selectedCharacterSlug)} disabled={inventoryLoading}>
                    Ricarica
                  </Button>
                ) : null}
              </div>

              <ScrollArea className="h-[42vh] rounded-2xl border border-border/60 bg-background/45">
                <div className="divide-y divide-border/50">
                  {!selectedCharacterSlug ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">Seleziona un personaggio.</div>
                  ) : inventoryLoading ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">Carico oggetti assegnati...</div>
                  ) : inventoryItems.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-muted-foreground">Nessun oggetto assegnato con il nuovo modello.</div>
                  ) : (
                    inventoryItems.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-primary">{item.itemName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.itemCategory ?? "Senza categoria"} · qty {item.quantity}
                            {item.isEquipped ? " · equipaggiato" : ""}
                          </div>
                          {item.notes ? <div className="mt-1 text-xs text-muted-foreground">{item.notes}</div> : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-full text-destructive hover:text-destructive"
                          onClick={() => void removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
