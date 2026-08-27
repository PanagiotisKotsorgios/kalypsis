import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { useImpersonation } from "../impersonation/ImpersonationContext";

export type PackageCode = "BackOffice" | "FrontOffice" | "Crm" | "Intelligence" | "Integrations" | "Ermes";

interface PackagesContextValue {
  packages: Set<PackageCode>;
  isPlatformBypass: boolean;
  loading: boolean;
  has: (pkg: PackageCode) => boolean;
  /** True when the tenant is licensed for ΕΡΜΗΣ ONLY — no back-office
   *  package at all. Used by the router to bypass the full app shell and
   *  drop the user straight into the standalone ΕΡΜΗΣ workspace. */
  isErmesOnly: boolean;
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

  // `initialLoad` gates the loading-Spinner render in ErmesOnlyGate.
  // We flip it to false after the FIRST successful fetch and never
  // flip it back to true — otherwise every background refresh (which
  // used to happen every 30s + on every window-focus event) would
  // briefly show `loading:true`, unmount the entire route tree, and
  // wipe any open dialogs / drawers / scroll positions. That was the
  // user-visible "the popup goes down when I switch to Explorer and
  // come back" bug.
  async function refresh() {
    if (!user || !accessToken) {
      setPackages(new Set());
      setBypass(false);
      setLoading(false);
      return;
    }
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
  // SuperAdmin's bypass flag — LANCA-style «my BackOffice package is
  // enabled but sidebar still empty» bug. No other polling — a package
  // toggle from the superadmin console is rare enough that users can
  // hit a hard refresh once when it happens, in exchange for the tab
  // never re-mounting behind them mid-work.
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [user?.userId, accessToken, impersonatedTenantId]);

  const value = useMemo<PackagesContextValue>(() => {
    // «Ermes only» means the tenant is licensed for ΕΡΜΗΣ AND nothing
    // else. PlatformAdmin bypass is never Ermes-only — they see the
    // whole app. Zero packages → not Ermes-only either (that's a
    // misconfigured tenant, not an intentional Ermes-only setup).
    const isErmesOnly = !isPlatformBypass
      && packages.has("Ermes")
      && packages.size === 1;
    return {
      packages,
      isPlatformBypass,
      loading,
      isErmesOnly,
      has: (pkg: PackageCode) => isPlatformBypass || packages.has(pkg),
      refresh,
    };
  }, [packages, isPlatformBypass, loading]);

  return <PackagesContext.Provider value={value}>{children}</PackagesContext.Provider>;
}

export function usePackages(): PackagesContextValue {
  const ctx = useContext(PackagesContext);
  if (!ctx) throw new Error("usePackages must be used within PackagesProvider");
  return ctx;
}
