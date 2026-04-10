import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
import { AuthProvider, RequireAuth, RequireRole } from "@/components/auth-provider";
import Index from "./pages/Index";
import DMDashboard from "./pages/DMDashboard";
import InitiativeTracker from "./pages/InitiativeTracker";
import CharacterSheet from "./pages/CharacterSheet";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import UserManagement from "./pages/UserManagement";
import CharacterAssignments from "./pages/CharacterAssignments";
import NewCharacter from "./pages/NewCharacter";
import BestiaryManagement from "./pages/BestiaryManagement";
import ItemManagement from "./pages/ItemManagement";
import CharacterInventoryManagement from "./pages/CharacterInventoryManagement";
import InventoryTransactionsPage from "./pages/InventoryTransactionsPage";
import CurrencyTransactionsPage from "./pages/CurrencyTransactionsPage";
import PlayerMonsterCompendium from "./pages/PlayerMonsterCompendium";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
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
          </AuthProvider>
        </BrowserRouter>
        <ThemeToggle />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
