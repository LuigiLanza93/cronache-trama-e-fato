import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CapabilityKind = "passive" | "active";
type CapabilityReset = "atWill" | "encounter" | "shortRest" | "longRest" | "custom";

type CapabilityEntry = {
  name: string;
  category?: string;
  kind: CapabilityKind;
  shortDescription: string;
  description?: string;
  usage?: {
    resetOn: CapabilityReset;
    customLabel?: string;
    used: boolean[];
  };
};

type CapabilityFormState = {
  name: string;
  category: string;
  kind: CapabilityKind;
  shortDescription: string;
  description: string;
  resetOn: CapabilityReset;
  customLabel: string;
  maxUses: string;
};

const RESET_LABELS: Record<CapabilityReset, string> = {
  atWill: "A volontà",
  encounter: "Incontro",
  shortRest: "Riposo breve",
  longRest: "Riposo lungo",
  custom: "Personalizzato",
};

const DEFAULT_FORM: CapabilityFormState = {
  name: "",
  category: "",
  kind: "passive",
  shortDescription: "",
  description: "",
  resetOn: "atWill",
  customLabel: "",
  maxUses: "1",
};

function usageLabel(usage?: CapabilityEntry["usage"]) {
  if (!usage) return "";
  if (usage.resetOn === "custom") return usage.customLabel?.trim() || "Personalizzato";
  return RESET_LABELS[usage.resetOn];
}

function toFormState(entry: CapabilityEntry): CapabilityFormState {
  return {
    name: entry.name ?? "",
    category: entry.category ?? "",
    kind: entry.kind,
    shortDescription: entry.shortDescription ?? "",
    description: entry.description ?? "",
    resetOn: entry.usage?.resetOn ?? "atWill",
    customLabel: entry.usage?.customLabel ?? "",
    maxUses: String(entry.usage?.used?.length ?? 1),
  };
}

export default function Capabilities({
  characterData,
  addCapability,
  updateCapability,
  removeCapability,
  toggleCapabilityUse,
}: {
  characterData: any;
  addCapability: (entry: CapabilityEntry) => void;
  updateCapability: (capabilityIndex: number, entry: CapabilityEntry) => void;
  removeCapability: (capabilityIndex: number) => void;
  toggleCapabilityUse: (capabilityIndex: number, useIndex: number) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState<CapabilityFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState("");

  const capabilities = Array.isArray(characterData?.capabilities) ? characterData.capabilities : [];
  const activeCapabilities = useMemo(
    () => capabilities.map((cap: CapabilityEntry, index: number) => ({ cap, index })).filter(({ cap }) => cap.kind === "active"),
    [capabilities]
  );
  const passiveCapabilities = useMemo(
    () => capabilities.map((cap: CapabilityEntry, index: number) => ({ cap, index })).filter(({ cap }) => cap.kind === "passive"),
    [capabilities]
  );

  const detailCapability =
    detailIndex !== null && capabilities[detailIndex] ? (capabilities[detailIndex] as CapabilityEntry) : null;

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setFormError("");
    setEditingIndex(null);
  };

  const openDetail = (index: number) => {
    setDetailIndex(index);
    setDetailOpen(true);
  };

  const openAddForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = () => {
    if (detailIndex === null || !detailCapability) return;
    setForm(toFormState(detailCapability));
    setFormError("");
    setEditingIndex(detailIndex);
    setDetailOpen(false);
    setFormOpen(true);
  };

  const submitCapability = () => {
    const name = form.name.trim();
    const shortDescription = form.shortDescription.trim();
    const category = form.category.trim();
    const description = form.description.trim();

    if (!name) {
      setFormError("Il nome è obbligatorio.");
      return;
    }

    if (!shortDescription) {
      setFormError("La descrizione breve è obbligatoria.");
      return;
    }

    const entry: CapabilityEntry = {
      name,
      kind: form.kind,
      shortDescription,
      ...(category ? { category } : {}),
      ...(description ? { description } : {}),
    };

    if (form.kind === "active") {
      const customLabel = form.customLabel.trim();
      if (form.resetOn === "custom" && !customLabel) {
        setFormError("Inserisci un'etichetta personalizzata per il tipo di utilizzo.");
        return;
      }

      let used: boolean[] = [];
      if (form.resetOn !== "atWill") {
        const maxUses = parseInt(form.maxUses, 10);
        if (!Number.isFinite(maxUses) || maxUses <= 0) {
          setFormError("Inserisci un numero di utilizzi valido.");
          return;
        }

        used = Array.from({ length: maxUses }, () => false);
        if (editingIndex !== null) {
          const previous = capabilities[editingIndex]?.usage?.used ?? [];
          used = Array.from({ length: maxUses }, (_, index) => previous[index] ?? false);
        }
      }

      entry.usage = {
        resetOn: form.resetOn,
        used,
        ...(form.resetOn === "custom" && customLabel ? { customLabel } : {}),
      };
    }

    if (editingIndex !== null) {
      updateCapability(editingIndex, entry);
    } else {
      addCapability(entry);
    }

    setFormOpen(false);
    resetForm();
  };

  const confirmDelete = () => {
    if (detailIndex === null) return;
    removeCapability(detailIndex);
    setConfirmDeleteOpen(false);
    setDetailOpen(false);
    setDetailIndex(null);
  };

  return (
    <Card className="character-section">
      <div className="character-section-title flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Skills
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={openAddForm}
          className="h-8 w-8 rounded-full border border-border/70 bg-background/70 text-primary transition hover:bg-muted"
          aria-label="Aggiungi skill"
          title="Aggiungi skill"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="font-semibold text-primary">Attive</div>
          {activeCapabilities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessuna skill attiva censita.</div>
          ) : (
            activeCapabilities.map(({ cap, index }) => (
              <div key={`active-${index}`} className="dnd-frame rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openDetail(index)}
                    className="min-w-0 flex-1 rounded-sm text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-primary">{cap.name}</div>
                      {cap.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {cap.category}
                        </Badge>
                      )}
                      {cap.usage && (
                        <Badge variant="secondary" className="text-[10px]">
                          {usageLabel(cap.usage)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{cap.shortDescription}</div>
                  </button>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2 pt-0.5">
                    {(cap.usage?.used ?? []).map((used, useIndex) => (
                      <label
                        key={`cap-${index}-use-${useIndex}`}
                        className="inline-flex cursor-pointer items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={used}
                          onChange={() => toggleCapabilityUse(index, useIndex)}
                          className="h-4 w-4"
                          aria-label={`${cap.name} uso ${useIndex + 1}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-primary">Passive</div>
          {passiveCapabilities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nessuna skill passiva censita.</div>
          ) : (
            passiveCapabilities.map(({ cap, index }) => (
              <button
                key={`passive-${index}`}
                type="button"
                onClick={() => openDetail(index)}
                className="w-full rounded dnd-frame p-3 text-left transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-primary">{cap.name}</div>
                    <div className="whitespace-pre-line text-xs text-muted-foreground">{cap.shortDescription}</div>
                  </div>
                  {cap.category && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {cap.category}
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Modifica skill" : "Aggiungi skill"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block">Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Es. Ispirazione bardica"
                />
              </div>
              <div>
                <Label className="mb-1 block">Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Es. Suppliche"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Tipologia</Label>
              <select
                value={form.kind}
                onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as CapabilityKind }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="passive">Passiva</option>
                <option value="active">Attiva</option>
              </select>
            </div>

            <div>
              <Label className="mb-1 block">Descrizione breve *</Label>
              <Textarea
                value={form.shortDescription}
                onChange={(e) => setForm((prev) => ({ ...prev, shortDescription: e.target.value }))}
                rows={2}
                placeholder="Testo breve mostrato direttamente nel componente"
              />
            </div>

            <div>
              <Label className="mb-1 block">Descrizione completa</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={5}
                placeholder="Dettagli aggiuntivi visibili nel pannello di dettaglio"
              />
            </div>

            {form.kind === "active" && (
              <div className="space-y-4 rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1 block">Tipo di utilizzo</Label>
                    <select
                      value={form.resetOn}
                      onChange={(e) => setForm((prev) => ({ ...prev, resetOn: e.target.value as CapabilityReset }))}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="atWill">A volontà</option>
                      <option value="encounter">Incontro</option>
                      <option value="shortRest">Riposo breve</option>
                      <option value="longRest">Riposo lungo</option>
                      <option value="custom">Personalizzato</option>
                    </select>
                  </div>
                  {form.resetOn !== "atWill" && (
                    <div>
                      <Label className="mb-1 block">Numero utilizzi</Label>
                      <Input
                        inputMode="numeric"
                        value={form.maxUses}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxUses: e.target.value }))}
                        placeholder="Es. 3"
                      />
                    </div>
                  )}
                </div>

                {form.resetOn === "custom" && (
                  <div>
                    <Label className="mb-1 block">Etichetta personalizzata</Label>
                    <Input
                      value={form.customLabel}
                      onChange={(e) => setForm((prev) => ({ ...prev, customLabel: e.target.value }))}
                      placeholder="Es. 1 volta al giorno"
                    />
                  </div>
                )}
              </div>
            )}

            {formError && <div className="text-sm text-destructive">{formError}</div>}
          </div>

          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">Annulla</Button>
            </DialogClose>
            <Button onClick={submitCapability}>{editingIndex !== null ? "Salva modifiche" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailIndex(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailCapability?.name || "Dettaglio skill"}</DialogTitle>
          </DialogHeader>

          {detailCapability && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {detailCapability.kind === "passive" ? "Passiva" : "Attiva"}
                </Badge>
                {detailCapability.category && <Badge variant="outline">{detailCapability.category}</Badge>}
                {detailCapability.usage && <Badge variant="outline">{usageLabel(detailCapability.usage)}</Badge>}
              </div>

              <div className="whitespace-pre-line text-muted-foreground">{detailCapability.shortDescription}</div>

              {detailCapability.description && <div className="whitespace-pre-line">{detailCapability.description}</div>}

              {detailCapability.usage && detailCapability.usage.used.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-primary">Utilizzi</div>
                  <div className="flex flex-wrap gap-2">
                    {detailCapability.usage.used.map((used, useIndex) => (
                      <label
                        key={`detail-cap-${detailIndex}-use-${useIndex}`}
                        className="inline-flex items-center rounded border border-border px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={used}
                          onChange={() => {
                            if (detailIndex !== null) toggleCapabilityUse(detailIndex, useIndex);
                          }}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
              Elimina
            </Button>
            <Button variant="outline" onClick={openEditForm}>
              Modifica
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Chiudi</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa skill?</AlertDialogTitle>
            <AlertDialogDescription>
              La skill verrà rimossa definitivamente dalla scheda del personaggio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
