import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { api, setAuthToken } from "../api/client";

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
  tenantName: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  preferredLanguage: string;
  permissions: string[];
}

interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "kalypsis_auth";
const PERSISTENCE_KEY = "kalypsis_auth_persist"; // "local" | "session"

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  accessTokenExpiresAt: string;
}

/** Pick the storage tier based on a flag set at login. localStorage = remember-me on. */
function getStorageMode(): "local" | "session" {
  return (localStorage.getItem(PERSISTENCE_KEY) as "local" | "session" | null) ?? "local";
}

function getActiveStorage(): Storage {
  return getStorageMode() === "local" ? localStorage : sessionStorage;
}

function readStored(): StoredAuth | null {
  // Try both stores so a previous session survives a page reload regardless of choice.
  const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearStored() {
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PERSISTENCE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStored();
    if (!stored) {
      setLoading(false);
      return;
    }
    setAuthToken(stored.accessToken);
    setAccessToken(stored.accessToken);

    api
      .get<AuthUser>("/auth/me")
      .then((res) => {
        setUser(res.data);
        const next = JSON.stringify({ ...stored, user: res.data } satisfies StoredAuth);
        getActiveStorage().setItem(STORAGE_KEY, next);
      })
      .catch(() => {
        clearStored();
        setAuthToken(null);
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean = true) => {
      const res = await api.post<LoginResponse>("/auth/login", { email, password });
      const payload = res.data;
      const stored: StoredAuth = {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
        accessTokenExpiresAt: payload.accessTokenExpiresAt
      };

      // Always nuke both stores first so we never leak across modes.
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);

      localStorage.setItem(PERSISTENCE_KEY, rememberMe ? "local" : "session");
      (rememberMe ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(stored));

      setAuthToken(payload.accessToken);
      setAccessToken(payload.accessToken);
      setUser(payload.user);
      return payload.user;
    },
    []
  );

  const signOut = useCallback(() => {
    clearStored();
    setAuthToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, loading, signIn, signOut }),
    [user, accessToken, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
