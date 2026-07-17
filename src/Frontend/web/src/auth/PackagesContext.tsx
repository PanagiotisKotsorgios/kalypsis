import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { useImpersonation } from "../impersonation/ImpersonationContext";

export type PackageCode = "BackOffice" | "FrontOffice" | "Crm" | "Intelligence" | "Integrations";

interface PackagesContextValue {
  packages: Set<PackageCode>;
  isPlatformBypass: boolean;
  loading: boolean;
  has: (pkg: PackageCode) => boolean;
  refresh: () => Promise<void>;
}

interface MyPackagesResponse {
  packages: string[];
  isPlatformBypass: boolean;
}

const PackagesContext = createContext<PackagesContextValue | undefined>(undefined);

/**
 * Reads /api/me/packages on login and on impersonation change. Provides a fast
 * `has(pkg)` check that the nav, route guards, and individual pages use to
 * decide whether to show a feature.
 *
 * PlatformAdmin / PlatformEmployee NOT impersonating get `isPlatformBypass=true`
 * which means every check returns true (matching the backend filter's bypass).
 */
export function PackagesProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { tenantId: impersonatedTenantId } = useImpersonation();
  const [packages, setPackages] = useState<Set<PackageCode>>(new Set());
  const [isPlatformBypass, setBypass] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!user || !accessToken) {
      setPackages(new Set());
      setBypass(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api.get<MyPackagesResponse>("/me/packages");
      setPackages(new Set(r.data.packages as PackageCode[]));
      setBypass(r.data.isPlatformBypass);
    } catch {
      // On failure we err on the side of empty packages — feature lookups
      // return false and the user sees a polite locked screen rather than a
      // broken page.
      setPackages(new Set());
      setBypass(false);
    } finally {
      setLoading(false);
    }
  }

  // Refresh on login/logout AND every time the impersonated tenant changes.
  // Without the impersonation dep, entering a tenant kept showing the
  // SuperAdmin's bypass flag until the next 5-minute poll — LANCA-style
  // «my BackOffice package is enabled but sidebar still empty» bug.
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [user?.userId, accessToken, impersonatedTenantId]);

  // Auto-refresh whenever the user returns to the tab or the browser
  // reconnects. Ensures that a package removed from the superadmin panel
  // (e.g. CRM disabled for a tenant) takes effect on the next interaction
  // instead of only after a full logout / login cycle.
  useEffect(() => {
    if (!user || !accessToken) return;
    const onFocus = () => { void refresh(); };
    const onOnline = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    // Also poll every 5 minutes for users who leave the tab open. Cheap
    // (~200-byte GET) and beats stale UI for hours.
    const iv = window.setInterval(onFocus, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, accessToken]);

  const value = useMemo<PackagesContextValue>(() => ({
    packages,
    isPlatformBypass,
    loading,
    has: (pkg: PackageCode) => isPlatformBypass || packages.has(pkg),
    refresh
  }), [packages, isPlatformBypass, loading]);

  return <PackagesContext.Provider value={value}>{children}</PackagesContext.Provider>;
}

export function usePackages(): PackagesContextValue {
  const ctx = useContext(PackagesContext);
  if (!ctx) throw new Error("usePackages must be used within PackagesProvider");
  return ctx;
}
