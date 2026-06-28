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
  /** Phase 7 — log in as a specific user (PlatformAdmin only). Backs up the original session. */
  startUserImpersonation: (userId: string) => Promise<void>;
  /** Restore the original admin session. Returns true if there was something to restore. */
  endUserImpersonation: () => Promise<boolean>;
  /** True when a user-level impersonation is currently active. */
  isImpersonatingUser: boolean;
  /** Email of the admin who initiated the current impersonation (if any). */
  impersonatorEmail: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "kalypsis_auth";
const PERSISTENCE_KEY = "kalypsis_auth_persist"; // "local" | "session"
const IMPERSONATION_BACKUP_KEY = "kalypsis_auth_impersonation_backup";
const IMPERSONATION_INFO_KEY = "kalypsis_auth_impersonation_info";
const SESSION_DEADLINE_PREFIX = "kalypsis.session.deadline.";

interface ImpersonationInfo {
  originalUserEmail: string;
  impersonatorEmail: string;
  targetUserId: string;
  targetEmail: string;
}

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
      // Drop any stale inactivity-countdown deadline for this user so a previously
      // expired session can't auto-logout a freshly authenticated tab on mount.
      localStorage.removeItem(`${SESSION_DEADLINE_PREFIX}${payload.user.userId}`);

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
    // If we're impersonating, end it gracefully so the admin returns to their own session.
    if (sessionStorage.getItem(IMPERSONATION_BACKUP_KEY)) {
      sessionStorage.removeItem(IMPERSONATION_BACKUP_KEY);
      sessionStorage.removeItem(IMPERSONATION_INFO_KEY);
    }
    clearStored();
    setAuthToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const startUserImpersonation = useCallback(async (userId: string) => {
    // Back up current admin session
    const currentRaw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (!currentRaw || !user) throw new Error("Δεν υπάρχει ενεργή συνεδρία διαχειριστή.");

    interface ImpResponse {
      accessToken: string;
      expiresAt: string;
      targetUser: { userId: string; email: string; firstName: string; lastName: string; role: string;
        tenantId: string | null; tenantName: string | null };
      impersonatorUserId: string;
      impersonatorEmail: string;
    }
    const res = await api.post<ImpResponse>(`/platform/impersonate/${userId}`);
    const imp = res.data;

    // Stash original session
    sessionStorage.setItem(IMPERSONATION_BACKUP_KEY, currentRaw);
    const info: ImpersonationInfo = {
      originalUserEmail: user.email,
      impersonatorEmail: imp.impersonatorEmail,
      targetUserId: imp.targetUser.userId,
      targetEmail: imp.targetUser.email
    };
    sessionStorage.setItem(IMPERSONATION_INFO_KEY, JSON.stringify(info));

    // Build a synthetic AuthUser from the impersonation response — same shape as /auth/me.
    const synthetic: AuthUser = {
      userId: imp.targetUser.userId,
      tenantId: imp.targetUser.tenantId,
      tenantName: imp.targetUser.tenantName,
      email: imp.targetUser.email,
      firstName: imp.targetUser.firstName,
      lastName: imp.targetUser.lastName,
      role: imp.targetUser.role as Role,
      preferredLanguage: "el",
      permissions: []
    };

    // Swap in
    const newStored: StoredAuth = {
      accessToken: imp.accessToken,
      refreshToken: "",
      user: synthetic,
      accessTokenExpiresAt: imp.expiresAt
    };
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newStored));
    setAuthToken(imp.accessToken);
    setAccessToken(imp.accessToken);
    setUser(synthetic);
  }, [user]);

  const endUserImpersonation = useCallback(async (): Promise<boolean> => {
    const backup = sessionStorage.getItem(IMPERSONATION_BACKUP_KEY);
    if (!backup) return false;
    // Best-effort: audit the impersonation end while we still have the impersonation token
    try { await api.post("/platform/impersonate/end"); } catch { /* ignore */ }

    sessionStorage.removeItem(IMPERSONATION_BACKUP_KEY);
    sessionStorage.removeItem(IMPERSONATION_INFO_KEY);
    const stored = JSON.parse(backup) as StoredAuth;
    sessionStorage.removeItem(STORAGE_KEY);
    // Restore to whichever store the original used (best guess: localStorage if rememberMe was on)
    const mode = getStorageMode();
    (mode === "local" ? localStorage : sessionStorage).setItem(STORAGE_KEY, backup);
    setAuthToken(stored.accessToken);
    setAccessToken(stored.accessToken);
    setUser(stored.user);
    return true;
  }, []);

  const isImpersonatingUser = !!(typeof window !== "undefined" && sessionStorage.getItem(IMPERSONATION_BACKUP_KEY));
  const impersonatorEmail = (() => {
    const raw = typeof window === "undefined" ? null : sessionStorage.getItem(IMPERSONATION_INFO_KEY);
    if (!raw) return null;
    try { return (JSON.parse(raw) as ImpersonationInfo).impersonatorEmail; } catch { return null; }
  })();

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, loading, signIn, signOut, startUserImpersonation, endUserImpersonation, isImpersonatingUser, impersonatorEmail }),
    [user, accessToken, loading, signIn, signOut, startUserImpersonation, endUserImpersonation, isImpersonatingUser, impersonatorEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
