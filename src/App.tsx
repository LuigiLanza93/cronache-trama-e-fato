import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
import { AuthProvider, RequireAuth, RequireRole } from "@/components/auth-provider";
import { GameSessionProvider } from "@/components/game-session-provider";

const Index = lazy(() => import("./pages/Index"));
const DMDashboard = lazy(() => import("./pages/DMDashboard"));
const InitiativeTracker = lazy(() => import("./pages/InitiativeTracker"));
const CharacterSheet = lazy(() => import("./pages/CharacterSheet"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const CharacterAssignments = lazy(() => import("./pages/CharacterAssignments"));
const NewCharacter = lazy(() => import("./pages/NewCharacter"));
const BestiaryManagement = lazy(() => import("./pages/BestiaryManagement"));
const ItemManagement = lazy(() => import("./pages/ItemManagement"));
const CharacterInventoryManagement = lazy(() => import("./pages/CharacterInventoryManagement"));
const InventoryTransactionsPage = lazy(() => import("./pages/InventoryTransactionsPage"));
const CurrencyTransactionsPage = lazy(() => import("./pages/CurrencyTransactionsPage"));
const DmNotesPage = lazy(() => import("./pages/DmNotesPage"));
const PlayerMonsterCompendium = lazy(() => import("./pages/PlayerMonsterCompendium"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function RouteLoading() {
  return (
    <div className="min-h-screen parchment flex items-center justify-center px-6 text-center">
      <div>
        <div className="font-heading text-2xl text-primary">Carico la pagina...</div>
        <div className="mt-2 text-sm text-muted-foreground">Preparo solo i moduli necessari.</div>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <GameSessionProvider>
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route
                    path="/change-password"
                    element={
                      <RequireAuth>
                        <ChangePassword />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/dm"
                    element={
                      <RequireRole role="dm">
                        <DMDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/initiative"
                    element={
                      <RequireRole role="dm">
                        <InitiativeTracker />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/users"
                    element={
                      <RequireRole role="dm">
                        <UserManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/assignments"
                    element={
                      <RequireRole role="dm">
                        <CharacterAssignments />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/items"
                    element={
                      <RequireRole role="dm">
                        <ItemManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/inventory"
                    element={
                      <RequireRole role="dm">
                        <CharacterInventoryManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/inventory/transactions"
                    element={
                      <RequireRole role="dm">
                        <InventoryTransactionsPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/currency-transactions"
                    element={
                      <RequireRole role="dm">
                        <CurrencyTransactionsPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/notes"
                    element={
                      <RequireRole role="dm">
                        <DmNotesPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/dm/bestiary"
                    element={
                      <RequireRole role="dm">
                        <BestiaryManagement />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/characters/new"
                    element={
                      <RequireAuth>
                        <NewCharacter />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/compendium/monsters"
                    element={
                      <RequireAuth>
                        <PlayerMonsterCompendium />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/:character"
                    element={
                      <RequireAuth>
                        <CharacterSheet />
                      </RequireAuth>
                    }
                  />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </GameSessionProvider>
          </AuthProvider>
        </BrowserRouter>
        <ThemeToggle />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
