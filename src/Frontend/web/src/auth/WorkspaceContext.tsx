import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PackageCode } from "./PackagesContext";

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
 * top-bar chips. The state survives a hard refresh via sessionStorage.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Phase 15.1 — restored hub flow: user lands on hub (workspace = null) and
  // picks BackOffice or CRM Client Portal. State survives reload via sessionStorage.
  const [workspace, setW] = useState<PackageCode | null>(() => {
    if (typeof window === "undefined") return null;
    const v = sessionStorage.getItem(STORAGE_KEY);
    return (v as PackageCode | null) ?? null;
  });

  useEffect(() => {
    if (workspace) sessionStorage.setItem(STORAGE_KEY, workspace);
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [workspace]);

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
  FrontOffice:  "/app/quote-builder",
  Crm:          "/app/customers",
  Intelligence: "/app/report-builder",
  Integrations: "/app/dias"
};
