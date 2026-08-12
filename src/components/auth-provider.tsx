import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { changePasswordRequest, fetchCurrentUser, loginRequest, logoutRequest, type AuthUser } from "@/lib/auth";
import { onRealtimeSessionRevoked, resetRealtimeSocket } from "@/realtime";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<AuthUser>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center parchment">
      <div className="text-center">
        <h2 className="text-2xl font-heading text-primary">Carico la sessione...</h2>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const nextUser = await fetchCurrentUser();
      resetRealtimeSocket({ preserveDesiredState: nextUser.id === user?.id });
      setUser(nextUser);
    } catch {
      resetRealtimeSocket();
      setUser(null);
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const nextUser = await fetchCurrentUser();
        if (active) setUser(nextUser);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return onRealtimeSessionRevoked(() => {
      // The realtime layer already invalidated queues and stopped reconnects;
      // keep its revocation latch set until the next explicit login/reset.
      setUser(null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (username, password) => {
        const nextUser = await loginRequest(username, password);
        resetRealtimeSocket();
        setUser(nextUser);
        return nextUser;
      },
      logout: async () => {
        await logoutRequest();
        resetRealtimeSocket();
        setUser(null);
      },
      changePassword: async (newPassword) => {
        const nextUser = await changePasswordRequest(newPassword);
        resetRealtimeSocket({ preserveDesiredState: nextUser.id === user?.id });
        setUser(nextUser);
        return nextUser;
      },
      refresh,
    }),
    [user, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

export function RequireRole({
  role,
  children,
}: {
  role: AuthUser["role"];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (user.role !== role) {
    const fallback = user.role === "dm" ? "/dm" : user.ownedCharacters[0] ? `/${user.ownedCharacters[0]}` : "/";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
