import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
import Index from "./pages/Index";
import DMDashboard from "./pages/DMDashboard";
import InitiativeTracker from "./pages/InitiativeTracker";
import CharacterSheet from "./pages/CharacterSheet";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dm" element={<DMDashboard />} />
            <Route path="/dm/initiative" element={<InitiativeTracker />} />
            <Route path="/:character" element={<CharacterSheet />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <ThemeToggle />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
