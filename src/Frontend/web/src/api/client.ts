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

// ── Global 401 handler ───────────────────────────────────────────────
// When the server rejects with 401 (expired access token, missing
// refresh grant, tenant impersonation revoked, etc.) we've lost the
// session. Fire a window event that AuthContext listens for → signs
// the user out cleanly → redirects to /login. Without this the UI
// stayed on the last page showing empty data because every API call
// silently failed, and the user had to hit F5 to get bounced back to
// the login screen.
//
// /auth/* endpoints are excluded so a wrong-password login attempt
// doesn't nuke the sign-in form — they surface their 401 to the
// caller as a normal error.
let signalledExpiry = false;
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? "";
      const isAuthCall = url.includes("/auth/");
      if (!isAuthCall && currentToken && !signalledExpiry) {
        // Latch so a burst of parallel failing calls only fires once.
        signalledExpiry = true;
        // Reset the latch after the redirect settles so a subsequent
        // session that also expires still triggers the flow.
        setTimeout(() => { signalledExpiry = false; }, 5000);
        try {
          window.dispatchEvent(new CustomEvent("kalypsis:session-expired"));
        } catch { /* SSR or CSP — fall back below */ }
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
