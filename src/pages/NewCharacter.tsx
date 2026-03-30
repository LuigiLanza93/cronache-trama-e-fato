import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NewCharacter() {
  useEffect(() => {
    document.title = "Nuovo Personaggio | D&D Character Manager";
  }, []);

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
            <h1 className="font-heading text-3xl font-bold text-primary">Nuovo personaggio</h1>
          </div>
          <p className="mt-4 text-muted-foreground">
            La creazione guidata del personaggio arriverà qui. Per ora la funzionalità è vuota, come concordato.
          </p>
        </Card>
      </div>
    </div>
  );
}
