import axios, { AxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

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
