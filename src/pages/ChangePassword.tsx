import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Cambio Password | D&D Character Manager";
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.trim().length < 4) {
      setError("La nuova password deve contenere almeno 4 caratteri.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await changePassword(newPassword);
      navigate("/", { replace: true });
    } catch {
      setError("Non sono riuscito ad aggiornare la password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-xl">
        <Card className="character-section">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-heading text-3xl font-bold text-primary">Imposta una nuova password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {user?.username
                  ? `L'utenza ${user.username} deve aggiornare la password prima di continuare.`
                  : "Devi aggiornare la password prima di continuare."}
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nuova password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Conferma password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error ? <div className="text-sm text-destructive">{error}</div> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting || !newPassword || !confirmPassword}>
                {submitting ? "Salvataggio..." : "Salva password"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void logout()}>
                Esci
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
