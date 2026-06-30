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
 * IMPORTANT: this hook returns EMPTY arrays when no carrier is selected or
 * when the carrier has no parametrics. There is intentionally NO fallback to
 * the PolicyType / VehicleUseCategory enums — every Κλάδος / Χρήση / Κάλυψη
 * the agency-facing app shows must be real data the superadmin entered.
 */

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

  const branches = useMemo<CarrierOption[]>(() =>
    merged.filter(p => p.kind === "Branch").map(p => ({
      key: `branch:${p.id}`,
      value: p.policyType ?? p.code,
      label: p.policyType ? `${p.name}` : p.name,
      code: p.code,
      parentCode: p.parentCode,
    })), [merged]);

  const uses = useMemo<CarrierOption[]>(() =>
    merged
      .filter(p => p.kind === "Use" && p.vehicleUseCategory && p.vehicleUseCategory !== "None")
      .map(p => ({
        key: `use:${p.id}`,
        value: p.vehicleUseCategory!,
        label: p.name,
        code: p.code,
        parentCode: p.parentCode,
      })), [merged]);

  const coverages = useMemo<CarrierOption[]>(() =>
    merged.filter(p => p.kind === "Coverage").map(p => ({
      key: `cov:${p.id}`,
      value: p.code,
      label: `${p.name} (${p.code})`,
      code: p.code,
      parentCode: p.parentCode,
    })), [merged]);

  const packages = useMemo<CarrierOption[]>(() =>
    merged.filter(p => p.kind === "Package").map(p => ({
      key: `pkg:${p.id}`,
      value: p.code,
      label: `${p.name} (${p.code})`,
      code: p.code,
      parentCode: p.parentCode,
    })), [merged]);

  return {
    branches, uses, coverages, packages,
    isLoading: primaryQ.isLoading || subQs.some(q => q.isLoading),
    hasParametrics: merged.length > 0,
  };
}
