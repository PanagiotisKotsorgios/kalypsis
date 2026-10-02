import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PackageCode } from "./PackagesContext";
import { useAuth } from "./AuthContext";
import { useImpersonation } from "../impersonation/ImpersonationContext";

const STORAGE_KEY = "kalypsis.workspace";

interface WorkspaceCtx {
  workspace: PackageCode | null;
  setWorkspace: (w: PackageCode | null) => void;
  enter: (w: PackageCode) => void;
  exitToHub: () => void;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

/**
 * Phase 8 — workspace switcher state. After login the user lands on a 5-card
 * hub; entering a card sets the workspace state and filters the sidebar +
 * top-bar chips.
 *
 * The active workspace is persisted to BOTH sessionStorage (per-tab identity,
 * so different tabs can hold different workspaces once the user diverges) AND
 * localStorage (per-browser last-known, so a NEW tab opened via
 * right-click → «Open link in new tab» inherits the current workspace filter
 * instead of dumping the full unfiltered sidebar with items the tenant
 * doesn't own). Session wins over local; local is the fallback for fresh
 * tabs where session is empty.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tenantId: impersonatedTenantId } = useImpersonation();
  const officeSession = !!impersonatedTenantId
    || user?.role === "AgencyAdmin"
    || user?.role === "AgencyOfficeAdmin"
    || user?.role === "AgencyUser";
  const [workspace, setW] = useState<PackageCode | null>(() => {
    if (typeof window === "undefined") return null;
    // Offices always open on the operational BackOffice navigation. Other
    // workspaces remain available from the hub and can be selected explicitly.
    if (officeSession) return "BackOffice";
    const sess = sessionStorage.getItem(STORAGE_KEY);
    if (sess) return sess as PackageCode;
    const local = localStorage.getItem(STORAGE_KEY);
    return (local as PackageCode | null) ?? null;
  });

  useEffect(() => {
    if (workspace) {
      sessionStorage.setItem(STORAGE_KEY, workspace);
      localStorage.setItem(STORAGE_KEY, workspace);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      // Intentionally leave localStorage untouched — an exitToHub in one
      // tab shouldn't force every other open tab to snap back to Hub on
      // their next render.
    }
  }, [workspace]);

  // Reset workspace when the signed-in user or impersonated tenant changes.
  // A fresh office session always starts in BackOffice so /app never leaks a
  // previous tab's CRM/Intelligence selection into the office sidebar.
  const sessionKey = `${user?.userId ?? "anonymous"}:${impersonatedTenantId ?? ""}`;
  const lastSessionRef = useRef<string | undefined>(sessionKey);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = lastSessionRef.current;
    if (prev !== undefined && prev !== sessionKey) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      setW(officeSession ? "BackOffice" : null);
    }
    lastSessionRef.current = sessionKey;
  }, [sessionKey, officeSession]);

  const enter = useCallback((w: PackageCode) => setW(w), []);
  const exitToHub = useCallback(() => setW(null), []);

  const value = useMemo<WorkspaceCtx>(() => ({
    workspace, setWorkspace: setW, enter, exitToHub
  }), [workspace, enter, exitToHub]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

/** Mapping each package to the page the "Open workspace" button navigates to. */
export const WORKSPACE_DEFAULT_ROUTE: Record<PackageCode, string> = {
  // BackOffice lands on the agency dashboard (charts + KPIs), not a leaf page.
  BackOffice:   "/app",
  FrontOffice:  "/app/office-website",
  // CRM uses the same workspace hub entry point as BackOffice.  Entering the
  // CRM card changes the active sidebar package without sending the user to a
  // separate customer page/URL.
  Crm:          "/app",
  Intelligence: "/app/reports",
  Integrations: "/app/dias",
  Ermes:        "/app/ermes"
};
