import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

/**
 * Carrier-driven catalogue hook.
 *
 * Fetches the παραμετρικά (CompanyParameterItem rows) for a primary carrier
 * and any selected subcompanies (when the primary is a broker), then exposes
 * them as ready-to-use dropdown option arrays.
 *
 * When the carrier's Παραμετρικά don't cover Κλάδοι / Χρήσεις (many were
 * seeded before policyType / vehicleUseCategory were wired), the hook falls
 * back to the PolicyType / VehicleUseCategory enum lists so the filter
 * dropdowns still populate instead of rendering «Δεν υπάρχουν παραμετρικά».
 * Coverages and Packages have no fallback — they're carrier-specific codes
 * and there's no sensible enum to substitute.
 *
 * Each returned CarrierOption carries `source: "parametric" | "fallback"`
 * so consumers can nudge the operator when they're looking at fallback
 * values instead of the carrier's own catalogue.
 */

const POLICY_TYPE_FALLBACK_LABELS: Record<string, string> = {
  Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωής",
  Business: "Επιχείρηση", Travel: "Ταξιδιωτικό", Other: "Άλλο",
};
const VEHICLE_USE_FALLBACK_LABELS: Record<string, string> = {
  EIX: "Ε.Ι.Χ. — Επιβατικό Ι.Χ.", EDX: "Ε.Δ.Χ. — Ταξί / Δημ.Χρ.",
  FIX: "Φ.Ι.Χ. — Φορτηγό Ι.Χ.",   FDX: "Φ.Δ.Χ. — Φορτηγό Δ.Χ.",
  LIX: "Λ.Ι.Χ. — Λεωφορείο Ι.Χ.", LDX: "Λ.Δ.Χ. — Λεωφορείο Δ.Χ.",
  Motorcycle: "ΜΟΤ — Μοτοσικλέτα", Agricultural: "ΑΓΡ — Αγροτικό",
  Construction: "ΕΡΓ — Εργοταξιακό",
};

export type ParameterKind =
  | "Branch" | "Coverage" | "Use" | "Package" | "BridgeCode" | "Field" | "Other";

export interface CarrierParamItem {
  id: string;
  kind: ParameterKind;
  code: string;
  name: string;
  policyType: string | null;
  vehicleUseCategory: string | null;
  parentCode: string | null;
}

export interface CarrierOption {
  /** Stable react key. */
  key: string;
  /** Underlying value to submit — for branches this is the PolicyType enum
   *  string (Auto/Home/...) so it matches the Policy row in the database;
   *  for uses it's the VehicleUseCategory enum; for coverages/packages it's
   *  the carrier's own code. */
  value: string;
  /** Human-readable display label from the carrier's catalogue. */
  label: string;
  /** Carrier's own code (for cascading). */
  code: string;
  /** parentCode link, used to narrow children by selected parents. */
  parentCode: string | null;
  /** Whether this option came from the carrier's Παραμετρικά or from the
   *  enum fallback list (used when the carrier hasn't filled in
   *  policyType / vehicleUseCategory on their catalogue rows). */
  source: "parametric" | "fallback";
}

export interface UseCarrierCatalogueResult {
  branches: CarrierOption[];
  uses: CarrierOption[];
  coverages: CarrierOption[];
  packages: CarrierOption[];
  isLoading: boolean;
  hasParametrics: boolean;
}

/**
 * Fetches CompanyParameterItem rows for `carrierId` and (optionally) for
 * `subCarrierIds` and merges them. Returns categorized option lists.
 */
export function useCarrierCatalogue(
  carrierId: string | null | undefined,
  subCarrierIds: string[] = []
): UseCarrierCatalogueResult {
  const primaryQ = useQuery({
    queryKey: ["company-parameters-catalogue", carrierId],
    queryFn: async () => (await api.get<CarrierParamItem[]>("/company-parameters", {
      params: { insuranceCompanyId: carrierId }
    })).data,
    enabled: !!carrierId,
  });

  const subQs = useQueries({
    queries: subCarrierIds.map((id) => ({
      queryKey: ["company-parameters-catalogue", id],
      queryFn: async () => (await api.get<CarrierParamItem[]>("/company-parameters", {
        params: { insuranceCompanyId: id }
      })).data,
      enabled: !!id,
    })),
  });

  const merged = useMemo<CarrierParamItem[]>(() => {
    const out: CarrierParamItem[] = [];
    if (primaryQ.data) out.push(...primaryQ.data);
    for (const q of subQs) if (q.data) out.push(...q.data);
    return out;
  }, [primaryQ.data, subQs.map(q => q.data).join(",")]);

  const branches = useMemo<CarrierOption[]>(() => {
    const parametric = merged
      .filter(p => p.kind === "Branch" && p.policyType)
      .map<CarrierOption>(p => ({
        key: `branch:${p.id}`,
        value: p.policyType!,
        label: p.name,
        code: p.code,
        parentCode: p.parentCode,
        source: "parametric",
      }));
    if (parametric.length > 0) return parametric;
    return Object.entries(POLICY_TYPE_FALLBACK_LABELS).map<CarrierOption>(([value, label]) => ({
      key: `branch:fb:${value}`, value, label, code: value, parentCode: null, source: "fallback",
    }));
  }, [merged]);

  const uses = useMemo<CarrierOption[]>(() => {
    const parametric = merged
      .filter(p => p.kind === "Use" && p.vehicleUseCategory && p.vehicleUseCategory !== "None")
      .map<CarrierOption>(p => ({
        key: `use:${p.id}`,
        value: p.vehicleUseCategory!,
        label: p.name,
        code: p.code,
        parentCode: p.parentCode,
        source: "parametric",
      }));
    if (parametric.length > 0) return parametric;
    return Object.entries(VEHICLE_USE_FALLBACK_LABELS).map<CarrierOption>(([value, label]) => ({
      key: `use:fb:${value}`, value, label, code: value, parentCode: null, source: "fallback",
    }));
  }, [merged]);

  const coverages = useMemo<CarrierOption[]>(() =>
    merged.filter(p => p.kind === "Coverage").map<CarrierOption>(p => ({
      key: `cov:${p.id}`,
      value: p.code,
      label: `${p.name} (${p.code})`,
      code: p.code,
      parentCode: p.parentCode,
      source: "parametric",
    })), [merged]);

  const packages = useMemo<CarrierOption[]>(() =>
    merged.filter(p => p.kind === "Package").map<CarrierOption>(p => ({
      key: `pkg:${p.id}`,
      value: p.code,
      label: `${p.name} (${p.code})`,
      code: p.code,
      parentCode: p.parentCode,
      source: "parametric",
    })), [merged]);

  return {
    branches, uses, coverages, packages,
    isLoading: primaryQ.isLoading || subQs.some(q => q.isLoading),
    hasParametrics: merged.length > 0,
  };
}
