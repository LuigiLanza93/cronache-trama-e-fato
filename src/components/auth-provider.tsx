import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { changePasswordRequest, fetchCurrentUser, loginRequest, logoutRequest, type AuthUser } from "@/lib/auth";

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

  const refresh = async () => {
    try {
      const nextUser = await fetchCurrentUser();
      setUser(nextUser);
    } catch {
      setUser(null);
    }
  };

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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (username, password) => {
        const nextUser = await loginRequest(username, password);
        setUser(nextUser);
        return nextUser;
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
      },
      changePassword: async (newPassword) => {
        const nextUser = await changePasswordRequest(newPassword);
        setUser(nextUser);
        return nextUser;
      },
      refresh,
    }),
    [user, loading]
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
