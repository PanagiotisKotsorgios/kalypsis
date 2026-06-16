import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getImpersonatedTenant, setImpersonatedTenant } from "../api/client";

interface ImpersonationState {
  tenantId: string | null;
  tenantName: string | null;
}

interface ImpersonationCtx extends ImpersonationState {
  enter: (tenantId: string, tenantName: string) => void;
  exit: () => void;
}

const Ctx = createContext<ImpersonationCtx | null>(null);

const NAME_KEY = "kalypsis.impersonate.name";

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<ImpersonationState>(() => ({
    tenantId: getImpersonatedTenant(),
    tenantName: sessionStorage.getItem(NAME_KEY)
  }));

  const enter = useCallback((tenantId: string, tenantName: string) => {
    setImpersonatedTenant(tenantId);
    sessionStorage.setItem(NAME_KEY, tenantName);
    setState({ tenantId, tenantName });
    // Drop every cached query — they're scoped to the old tenant view.
    qc.clear();
  }, [qc]);

  const exit = useCallback(() => {
    setImpersonatedTenant(null);
    sessionStorage.removeItem(NAME_KEY);
    setState({ tenantId: null, tenantName: null });
    qc.clear();
  }, [qc]);

  // Sync header on first mount (already done at module level but be safe).
  useEffect(() => {
    if (state.tenantId) setImpersonatedTenant(state.tenantId);
  }, [state.tenantId]);

  const value = useMemo<ImpersonationCtx>(() => ({ ...state, enter, exit }), [state, enter, exit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useImpersonation() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useImpersonation must be used inside ImpersonationProvider");
  return ctx;
}
