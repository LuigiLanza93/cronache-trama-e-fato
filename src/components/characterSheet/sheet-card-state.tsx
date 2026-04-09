import { createContext, useContext } from "react";

type SheetCardStateContextValue = {
  collapsedCards: Record<string, boolean>;
  setCardCollapsed: (cardId: string, collapsed: boolean) => void;
};

const SheetCardStateContext = createContext<SheetCardStateContextValue | null>(null);

export function SheetCardStateProvider({
  value,
  children,
}: {
  value: SheetCardStateContextValue;
  children: React.ReactNode;
}) {
  return (
    <SheetCardStateContext.Provider value={value}>
      {children}
    </SheetCardStateContext.Provider>
  );
}

export function useSheetCardState() {
  return useContext(SheetCardStateContext);
}
