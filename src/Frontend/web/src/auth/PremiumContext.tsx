import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

export type PremiumFeatureCode =
  | "recycle-bin"
  | "advanced-exports"
  | "bulk-commissions"
  | "multi-branch"
  | "premium-reports";

export interface PremiumFeatureMeta {
  code: PremiumFeatureCode;
  /** Greek display name */
  label: string;
  /** Short pitch shown in the upgrade dialog */
  description: string;
  /** Indicative monthly price in EUR for the upsell card */
  monthlyPriceEUR: number;
}

export const PREMIUM_FEATURE_CATALOGUE: Record<PremiumFeatureCode, PremiumFeatureMeta> = {
  "recycle-bin": {
    code: "recycle-bin",
    label: "Κάδος Ανακύκλωσης",
    description: "Επαναφορά διαγραμμένων εγγραφών για 30 ημέρες σε όλο το backoffice.",
    monthlyPriceEUR: 8
  },
  "advanced-exports": {
    code: "advanced-exports",
    label: "Επαγγελματικές εξαγωγές",
    description: "Branded PDF & XLSX πέρα από το βασικό CSV για κάθε λίστα.",
    monthlyPriceEUR: 6
  },
  "bulk-commissions": {
    code: "bulk-commissions",
    label: "Μαζικοί κανόνες προμηθειών",
    description: "Επεξεργασία δεκάδων κανόνων προμηθειών με ένα κλικ.",
    monthlyPriceEUR: 5
  },
  "multi-branch": {
    code: "multi-branch",
    label: "Πολλαπλά γραφεία",
    description: "Διαχείριση πολλαπλών υποκαταστημάτων κάτω από έναν λογαριασμό.",
    monthlyPriceEUR: 10
  },
  "premium-reports": {
    code: "premium-reports",
    label: "Premium Αναφορές",
    description: "Προγραμματισμένες αναφορές & advanced analytics dashboards.",
    monthlyPriceEUR: 9
  }
};

interface PremiumContextValue {
  codes: Set<PremiumFeatureCode>;
  loading: boolean;
  has: (code: PremiumFeatureCode) => boolean;
  refresh: () => Promise<void>;
  /** Open the upgrade dialog focused on a given feature (or null for the catalogue). */
  promptUpgrade: (code: PremiumFeatureCode | null) => void;
  /** Internal — used by <UpgradePlanDialogHost />. */
  _dialogFocus: PremiumFeatureCode | null;
  _dialogOpen: boolean;
  _closeDialog: () => void;
}

interface MyPremiumResponse { codes: string[] }

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [codes, setCodes] = useState<Set<PremiumFeatureCode>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFocus, setDialogFocus] = useState<PremiumFeatureCode | null>(null);

  async function refresh() {
    if (!user || !accessToken) {
      setCodes(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api.get<MyPremiumResponse>("/me/premium-features");
      setCodes(new Set(r.data.codes as PremiumFeatureCode[]));
    } catch {
      setCodes(new Set());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.userId, accessToken]);

  const value = useMemo<PremiumContextValue>(() => ({
    codes,
    loading,
    has: (c) => codes.has(c),
    refresh,
    promptUpgrade: (code) => { setDialogFocus(code); setDialogOpen(true); },
    _dialogFocus: dialogFocus,
    _dialogOpen: dialogOpen,
    _closeDialog: () => setDialogOpen(false)
  }), [codes, loading, dialogFocus, dialogOpen]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used within PremiumProvider");
  return ctx;
}
