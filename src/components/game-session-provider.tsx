import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  fetchGameSessionState,
  setPlayerWritesLocked,
  type GameSessionState,
} from "@/lib/auth";
import { onGameSessionState, setRealtimePlayerWritesLocked } from "@/realtime";

type GameSessionContextValue = {
  sessionState: GameSessionState | null;
  loading: boolean;
  isPlayerReadOnly: boolean;
  refresh: () => Promise<void>;
};

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

function syncWriteLocks(userRole: "dm" | "player" | null, sessionState: GameSessionState | null) {
  const locked = userRole === "player" && sessionState?.isOpen === false;
  setPlayerWritesLocked(locked);
  setRealtimePlayerWritesLocked(locked);
}

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [sessionState, setSessionState] = useState<GameSessionState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSessionState(null);
      setLoading(false);
      syncWriteLocks(null, null);
      return;
    }

    const nextState = await fetchGameSessionState();
    setSessionState(nextState);
    syncWriteLocks(user.role, nextState);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh().catch(() => {
      setSessionState(null);
      setLoading(false);
      syncWriteLocks(user?.role ?? null, null);
    });
  }, [authLoading, refresh, user?.id, user?.role]);

  useEffect(() => {
    if (!user) return;
    const off = onGameSessionState((nextState) => {
      setSessionState(nextState);
      syncWriteLocks(user.role, nextState);
    });
    return () => {
      off();
    };
  }, [user?.id, user?.role]);

  const value = useMemo<GameSessionContextValue>(
    () => ({
      sessionState,
      loading,
      isPlayerReadOnly: user?.role === "player" && sessionState?.isOpen === false,
      refresh,
    }),
    [loading, refresh, sessionState, user?.role]
  );

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession() {
  const context = useContext(GameSessionContext);
  if (!context) {
    throw new Error("useGameSession must be used within GameSessionProvider");
  }
  return context;
}
