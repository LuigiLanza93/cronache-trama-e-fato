import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, PlusCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { createCharacterRequest } from "@/lib/auth";
import {
  DND5E_ALIGNMENTS,
  DND5E_BACKGROUNDS,
  DND5E_CLASSES,
  DND5E_RACES,
} from "@/lib/character-options";
import { toast } from "@/components/ui/sonner";

export default function NewCharacter() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [characterType, setCharacterType] = useState<"pg" | "png">("pg");
  const [className, setClassName] = useState("");
  const [race, setRace] = useState("");
  const [alignment, setAlignment] = useState("");
  const [background, setBackground] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Crea Scheda | D&D Character Manager";
  }, []);

  useEffect(() => {
    if (user?.role !== "dm") {
      setCharacterType("pg");
    }
  }, [user?.role]);

  if (!user) return null;

  const effectiveType = user.role === "dm" ? characterType : "pg";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Inserisci il nome della scheda.");
      return;
    }
    if (!className || !race || !alignment || !background) {
      toast.error("Compila tutti i campi richiesti.");
      return;
    }

    setSaving(true);
    try {
      const result = await createCharacterRequest({
        name: trimmedName,
        characterType: effectiveType,
        className,
        race,
        alignment,
        background,
      });
      await refresh();

      if (user.role === "dm") {
        if (result.characterType === "png") {
          toast.success("PNG creato e associato automaticamente al master.");
        } else {
          toast.success("PG creato. Per ora resta non assegnato.");
        }
      } else {
        toast.success("Scheda creata e associata al tuo account.");
      }

      navigate(`/${result.slug}`);
    } catch {
      toast.error("Non sono riuscito a creare la scheda.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" asChild className="w-fit">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna alla home
          </Link>
        </Button>

        <Card className="character-section">
          <div className="flex items-center gap-3">
            <PlusCircle className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-3xl font-bold text-primary">Crea Scheda</h1>
          </div>
          <p className="mt-4 text-muted-foreground">
            Per ora creiamo una scheda quasi vuota ma con i dati base necessari per non partire da una struttura fragile.
            Il resto continuerà a essere modificabile direttamente dalla scheda; più avanti potremo costruire un wizard guidato.
          </p>
        </Card>

        <Card className="character-section">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sheet-name">Nome del personaggio</Label>
              <Input
                id="sheet-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Es. Elaris, Capitano Thorn, Ombra"
                disabled={saving}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select value={className} onValueChange={setClassName} disabled={saving}>
                  <SelectTrigger className="bg-background/80">
                    <SelectValue placeholder="Seleziona classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {DND5E_CLASSES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Razza</Label>
                <Select value={race} onValueChange={setRace} disabled={saving}>
                  <SelectTrigger className="bg-background/80">
                    <SelectValue placeholder="Seleziona razza" />
                  </SelectTrigger>
                  <SelectContent>
                    {DND5E_RACES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Allineamento</Label>
                <Select value={alignment} onValueChange={setAlignment} disabled={saving}>
                  <SelectTrigger className="bg-background/80">
                    <SelectValue placeholder="Seleziona allineamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {DND5E_ALIGNMENTS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Background</Label>
                <Select value={background} onValueChange={setBackground} disabled={saving}>
                  <SelectTrigger className="bg-background/80">
                    <SelectValue placeholder="Seleziona background" />
                  </SelectTrigger>
                  <SelectContent>
                    {DND5E_BACKGROUNDS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {user.role === "dm" ? (
              <div className="space-y-2">
                <Label>Tipo di scheda</Label>
                <Select
                  value={characterType}
                  onValueChange={(value: "pg" | "png") => setCharacterType(value)}
                  disabled={saving}
                >
                  <SelectTrigger className="bg-background/80">
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pg">Personaggio Giocante</SelectItem>
                    <SelectItem value="png">Personaggio Non Giocante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
              {user.role === "dm" ? (
                effectiveType === "png" ? (
                  "I PNG creati dal master vengono associati automaticamente al master."
                ) : (
                  "I PG creati dal master restano non assegnati finché non li colleghi da Gestione Schede."
                )
              ) : (
                "I PG creati dal giocatore vengono associati automaticamente al suo account."
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                <Sparkles className="mr-2 h-4 w-4" />
                {saving ? "Creo la scheda..." : "Crea scheda"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to={user.role === "dm" ? "/dm/assignments" : "/"}>
                  Annulla
                </Link>
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
