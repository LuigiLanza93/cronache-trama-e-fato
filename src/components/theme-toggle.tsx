import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="fixed bottom-5 right-5 z-50 h-11 w-11 rounded-full border-border/80 bg-card/90 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/75"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Attiva tema chiaro" : "Attiva tema scuro"}
      title={isDark ? "Attiva tema chiaro" : "Attiva tema scuro"}
    >
      {isDark ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4 text-primary" />}
    </Button>
  );
}
