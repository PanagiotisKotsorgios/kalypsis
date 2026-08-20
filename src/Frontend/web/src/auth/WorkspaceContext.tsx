import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PackageCode } from "./PackagesContext";
import { useAuth } from "./AuthContext";

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
  const [workspace, setW] = useState<PackageCode | null>(() => {
    if (typeof window === "undefined") return null;
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

  // Reset workspace when the SIGNED-IN USER changes (login switch on the
  // same browser). Persistence across page reloads for the SAME user is
  // preserved — we compare against the last-seen userId in a ref instead
  // of firing on first mount. Without this, a previous user's persisted
  // workspace (say «FrontOffice») would leak into a fresh login and the
  // sidebar filter downstream would hide every package-gated item because
  // item.package !== stale workspace.
  const lastUserRef = useRef<string | null | undefined>(user?.userId);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = lastUserRef.current;
    const now = user?.userId;
    if (prev !== undefined && prev !== now) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      setW(null);
    }
    lastUserRef.current = now;
  }, [user?.userId]);

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
