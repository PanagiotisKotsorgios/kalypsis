import axios, { AxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const API_BASE_URL = baseURL;
export const api = axios.create({ baseURL });

let currentToken: string | null = null;
let impersonatedTenantId: string | null = null;

export function setAuthToken(token: string | null) {
  currentToken = token;
}

export function setImpersonatedTenant(tenantId: string | null) {
  impersonatedTenantId = tenantId;
  if (tenantId) sessionStorage.setItem("kalypsis.impersonate", tenantId);
  else sessionStorage.removeItem("kalypsis.impersonate");
}

export function getImpersonatedTenant(): string | null {
  return impersonatedTenantId ?? sessionStorage.getItem("kalypsis.impersonate");
}

// Restore impersonation on page reload so the platform admin doesn't pop out
// of the tenant they were operating inside.
impersonatedTenantId = sessionStorage.getItem("kalypsis.impersonate");

api.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  if (impersonatedTenantId) {
    config.headers["X-Impersonate-Tenant"] = impersonatedTenantId;
  }
  return config;
});

// ── Global 401 handler with silent token refresh ─────────────────────
// User was getting logged out after ~1 hour because the frontend never
// refreshed the short-lived access token. First 401 = expired token,
// so try to trade our refresh token for a fresh access token BEFORE
// giving up. Only after refresh itself fails do we fire the
// «session-expired» event that redirects to /login.
//
// /auth/* endpoints are excluded so a wrong-password login attempt
// doesn't loop through refresh — they surface their 401 to the
// caller as a normal error.
const STORAGE_KEY = "kalypsis_auth";
// In-flight refresh promise — parallel 401s in the same tick share it,
// otherwise we'd fire N refresh requests and invalidate our own token.
let refreshInFlight: Promise<string | null> | null = null;

function readAuthBlob(): { accessToken: string; refreshToken: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j?.refreshToken) return null;
    return { accessToken: j.accessToken, refreshToken: j.refreshToken };
  } catch { return null; }
}
function writeAuthBlob(patch: { accessToken: string; accessTokenExpiresAt?: string; refreshToken?: string }) {
  // Rewrite whichever storage tier currently holds the blob so remember-me
  // choice is preserved. If both are present, prefer localStorage (the
  // active-persistence guarantee).
  const store = localStorage.getItem(STORAGE_KEY) ? localStorage : sessionStorage;
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const merged = { ...JSON.parse(raw), ...patch };
    store.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch { /* corrupted — leave it and let session-expired handler clean */ }
}

async function tryRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const blob = readAuthBlob();
  if (!blob?.refreshToken) return null;
  // Bare axios (no interceptors) so a refresh-itself-401 doesn't recurse.
  refreshInFlight = (async () => {
    try {
      const r = await axios.post<{
        accessToken: string;
        accessTokenExpiresAt: string;
        refreshToken: string;
        refreshTokenExpiresAt: string;
      }>(`${baseURL}/auth/refresh`, { refreshToken: blob.refreshToken });
      currentToken = r.data.accessToken;
      writeAuthBlob({
        accessToken: r.data.accessToken,
        accessTokenExpiresAt: r.data.accessTokenExpiresAt,
        refreshToken: r.data.refreshToken,
      });
      return r.data.accessToken;
    } catch {
      return null;
    } finally {
      // Release the shared promise so a later expiry can refresh again.
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();
  return refreshInFlight;
}

let signalledExpiry = false;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const status = error.response?.status;
    const cfg = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    const url = cfg?.url ?? "";
    const isAuthCall = url.includes("/auth/");

    // Only try to refresh on the first 401 for a given request, and only
    // for non-auth calls that we actually have a session for.
    if (status === 401 && !isAuthCall && cfg && !cfg._retried && currentToken) {
      cfg._retried = true;
      const fresh = await tryRefresh();
      if (fresh) {
        cfg.headers = cfg.headers ?? {};
        (cfg.headers as Record<string, string>).Authorization = `Bearer ${fresh}`;
        return api.request(cfg);
      }
      // Refresh failed → really expired, fall through to the session-expired signal.
      if (!signalledExpiry) {
        signalledExpiry = true;
        setTimeout(() => { signalledExpiry = false; }, 5000);
        try { window.dispatchEvent(new CustomEvent("kalypsis:session-expired")); } catch { /* ignore */ }
      }
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

export function extractErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiError>;
    if (ax.response?.data?.message) return ax.response.data.message;
    if (ax.response?.status === 401) return "Invalid credentials";
    if (!ax.response) return "Network error";
  }
  return fallback;
}
