import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Shield, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

function getDefaultRoute(role: "dm" | "player", ownedCharacters: string[]) {
  return "/";
}

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Login | D&D Character Manager";
  }, []);

  useEffect(() => {
    if (!loading && user) {
      const fallback = user.mustChangePassword ? "/change-password" : getDefaultRoute(user.role, user.ownedCharacters);
      const nextRoute = location.state?.from?.pathname || fallback;
      navigate(nextRoute, { replace: true });
    }
  }, [loading, user, navigate, location.state]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const nextUser = await login(username.trim(), password);
      navigate(nextUser.mustChangePassword ? "/change-password" : getDefaultRoute(nextUser.role, nextUser.ownedCharacters), {
        replace: true,
      });
    } catch {
      setError("Credenziali non valide.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="dnd-frame p-6">
            <h1 className="font-heading text-5xl font-bold text-primary">Accesso al tavolo</h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Ogni giocatore entra con la propria utenza e vede solo i personaggi assegnati. Il master mantiene accesso completo agli strumenti DM.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="character-section">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div className="font-semibold text-primary">Master</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Accesso al dashboard DM, tracker iniziativa e gestione completa delle schede.
              </p>
            </Card>
            <Card className="character-section">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div className="font-semibold text-primary">Giocatori</div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Accesso alle sole schede assegnate e ricezione dei popup privati inviati dal DM.
              </p>
            </Card>
          </div>
        </div>

        <Card className="character-section">
          <div className="character-section-title">Login</div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Es. roberto"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>

            {error ? <div className="text-sm text-destructive">{error}</div> : null}

            <Button type="submit" className="w-full" disabled={submitting || !username.trim() || !password}>
              {submitting ? "Accesso..." : "Entra"}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
            Password iniziali:
            <div className="mt-2 space-y-1">
              <div>`gaetano` / `gaetano`</div>
              <div>`roberto` / `roberto`</div>
              <div>`luigi_l` / `luigi_l`</div>
              <div>`luigi_f` / `luigi_f`</div>
            </div>
          </div>

        </Card>
      </div>
    </div>
  );
}
