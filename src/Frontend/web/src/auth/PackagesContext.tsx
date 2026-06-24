import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

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

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.userId, accessToken]);

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
