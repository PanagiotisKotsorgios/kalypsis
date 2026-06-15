import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Role =
  | "PlatformAdmin"
  | "PlatformEmployee"
  | "AgencyAdmin"
  | "AgencyUser"
  | "Producer"
  | "Customer";

export interface AuthUser {
  userId: string;
  tenantId: string | null;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  signIn: (user: AuthUser, accessToken: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "kalypsis_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { user: AuthUser; accessToken: string };
        setUser(parsed.user);
        setAccessToken(parsed.accessToken);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      signIn: (u, token) => {
        setUser(u);
        setAccessToken(token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, accessToken: token }));
      },
      signOut: () => {
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    }),
    [user, accessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
