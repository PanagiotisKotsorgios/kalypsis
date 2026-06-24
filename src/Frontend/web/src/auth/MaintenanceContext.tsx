import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";

export interface MaintenanceState {
  launchGateEnabled: boolean;
  launchGateTitle: string | null;
  launchGateMessage: string | null;
  maintenanceModeEnabled: boolean;
  maintenanceTitle: string | null;
  maintenanceMessage: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<MaintenanceState | null>(null);

const DEFAULT: Omit<MaintenanceState, "loading" | "refresh"> = {
  launchGateEnabled: false,
  launchGateTitle: null,
  launchGateMessage: null,
  maintenanceModeEnabled: false,
  maintenanceTitle: null,
  maintenanceMessage: null
};

/**
 * Reads /api/public/maintenance on mount. Two toggles:
 *   - launchGateEnabled: agency-side roles see the under-construction page
 *   - maintenanceModeEnabled: EVERYONE sees the maintenance page
 *
 * Polls every 60s in case the superadmin flips it.
 */
export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ ...DEFAULT, loading: true });

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<typeof DEFAULT>("/public/maintenance");
      setState({ ...r.data, loading: false });
    } catch {
      // If we can't reach the API, default both flags OFF so nobody is
      // stuck on a gate that doesn't exist.
      setState({ ...DEFAULT, loading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const value = useMemo<MaintenanceState>(() => ({ ...state, refresh }), [state, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMaintenance(): MaintenanceState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMaintenance must be used within MaintenanceProvider");
  return ctx;
}
