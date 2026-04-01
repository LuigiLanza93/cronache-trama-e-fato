import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Home,
  KeyRound,
  Plus,
  Trash2,
  UserCog,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import {
  createUserRequest,
  deleteUserRequest,
  fetchUsers,
  resetUserPasswordRequest,
  type ManagedUser,
} from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"dm" | "player">("player");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Gestione Utenti | D&D Character Manager";
  }, []);

  const loadUsers = async () => {
    try {
      const nextUsers = await fetchUsers();
      setUsers(nextUsers);
    } catch {
      toast.error("Non sono riuscito a caricare gli utenti.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" })),
    [users]
  );

  const resetCreateForm = () => {
    setUsername("");
    setDisplayName("");
    setRole("player");
    setError("");
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const createdUser = await createUserRequest({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        role,
      });

      setUsers((prev) =>
        [...prev, createdUser].sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }))
      );
      setCreateOpen(false);
      resetCreateForm();
      toast.success(`Utente ${createdUser.username} creato. Password iniziale: ${createdUser.username}`);
    } catch (createError: any) {
      setError(createError?.status === 409 ? "Username già esistente." : "Non sono riuscito a creare l'utente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setSubmitting(true);

    try {
      const updatedUser = await resetUserPasswordRequest(resetTarget.id);
      setUsers((prev) => prev.map((entry) => (entry.id === updatedUser.id ? updatedUser : entry)));
      toast.success(`Password resettata per ${updatedUser.username}. Password temporanea: ${updatedUser.username}`);
      setResetTarget(null);
    } catch {
      toast.error("Non sono riuscito a resettare la password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);

    try {
      await deleteUserRequest(deleteTarget.id);
      setUsers((prev) => prev.filter((entry) => entry.id !== deleteTarget.id));
      toast.success(`Utente ${deleteTarget.username} eliminato.`);
      setDeleteTarget(null);
    } catch {
      toast.error("Non sono riuscito a eliminare l'utente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen parchment px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="space-y-3 text-center">
          <div>
            <h1 className="font-heading text-4xl font-bold text-primary">Gestione utenti</h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
              Elenco completo delle utenze censite. I nuovi utenti e quelli con password resettata entrano con una password temporanea uguale allo username e devono cambiarla subito dopo il login.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                  <Link to="/" aria-label="Torna alla home">
                    <Home className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Torna alla home</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{users.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Utenti totali</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <UserCog className="h-4 w-4 text-primary" />
                  <span>{user?.username ?? "-"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Utente in sessione</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setCreateOpen(true)}
                  aria-label="Aggiungi utente"
                >
                  <UserRoundPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aggiungi utente</TooltipContent>
            </Tooltip>
          </div>
        </section>

        <section className="grid gap-4">
          {loading ? (
            <Card className="character-section">
              <div className="text-sm text-muted-foreground">Carico gli utenti...</div>
            </Card>
          ) : sortedUsers.length === 0 ? (
            <Card className="character-section">
              <div className="text-sm text-muted-foreground">Non ci sono utenti censiti.</div>
            </Card>
          ) : (
            sortedUsers.map((managedUser) => {
              const isCurrentUser = managedUser.id === user?.id;

              return (
                <Card key={managedUser.id} className="character-section">
                  <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.5fr)_110px] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-heading text-2xl font-semibold text-primary">{managedUser.username}</div>
                        <Badge variant={managedUser.role === "dm" ? "default" : "secondary"}>
                          {managedUser.role === "dm" ? "Master" : "Giocatore"}
                        </Badge>
                        {managedUser.mustChangePassword && <Badge variant="outline">Cambio password richiesto</Badge>}
                        {isCurrentUser && <Badge variant="outline">Tu</Badge>}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {managedUser.displayName || managedUser.username}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                        <span className="text-muted-foreground">PG</span>{" "}
                        <span>{managedUser.ownedCharacters.length}</span>
                      </div>
                      {managedUser.ownedCharacters.length > 0 && (
                        <div className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/90">
                          <span className="text-muted-foreground">Associati</span>{" "}
                          <span>{managedUser.ownedCharacters.join(" · ")}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                        title="Reset password"
                        aria-label="Reset password"
                        onClick={() => setResetTarget(managedUser)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
                        title="Elimina utente"
                        aria-label="Elimina utente"
                        onClick={() => setDeleteTarget(managedUser)}
                        disabled={isCurrentUser}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </section>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo utente</DialogTitle>
            <DialogDescription>
              La password temporanea sarà uguale allo username. Al primo login verrà richiesto il cambio password.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateUser}>
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Es. martina"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-display-name">Nome visualizzato</Label>
              <Input
                id="new-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Es. Martina"
              />
            </div>

            <div className="space-y-2">
              <Label>Ruolo</Label>
              <Select value={role} onValueChange={(value: "dm" | "player") => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Giocatore</SelectItem>
                  <SelectItem value="dm">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error ? <div className="text-sm text-destructive">{error}</div> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={submitting || !username.trim()}>
                <UserRoundPlus className="mr-2 h-4 w-4" />
                Crea utente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resettare la password?</AlertDialogTitle>
            <AlertDialogDescription>
              {resetTarget
                ? `La password temporanea di ${resetTarget.username} tornerà a essere "${resetTarget.username}" e verrà richiesto il cambio password al prossimo login.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={submitting}>
              Reset password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l&apos;utente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `L'utente ${deleteTarget.username} verrà rimosso dall'elenco. Le associazioni dei personaggi resteranno da sistemare nella pagina dedicata.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteUser}
              disabled={submitting}
            >
              Elimina utente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
