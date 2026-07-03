import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export interface CustomerLite {
  id: string;
  customerNumber: string;
  type: "Individual" | "Company";
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Server-side customer search hook. Sends a debounced `search` query to
 * /customers so the backend hits ΑΦΜ / phone / mobile / email / name /
 * customer number across the entire tenant — no more «τα πρώτα 500» ceiling
 * hitting the picker on 12k-customer offices.
 *
 * Returns a shape that plugs straight into SearchableSelect:
 *   const { options, setInput } = useCustomerSearch(currentValue);
 *   <SearchableSelect
 *     value={id} onChange={setId}
 *     onInputChange={setInput}
 *     options={options}
 *   />
 *
 * Handles two edge cases the operator hits:
 *   • Currently-selected customer might not be in the current search
 *     result set — the hook always re-fetches THE selected customer by
 *     id so its label still renders correctly.
 *   • Empty search returns the 200 most-recent customers (backend
 *     default) so the picker isn't blank on first click.
 */
export function useCustomerSearch(currentValue?: string | null) {
  const [rawInput, setRawInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(rawInput.trim()), 250);
    return () => clearTimeout(t);
  }, [rawInput]);

  const q = useQuery({
    queryKey: ["customers", "search", debounced],
    queryFn: async () => (await api.get<CustomerLite[]>("/customers", {
      params: debounced ? { search: debounced } : undefined
    })).data,
    staleTime: 60_000,
  });

  const selected = useQuery({
    queryKey: ["customer-detail", currentValue],
    enabled: !!currentValue && !(q.data ?? []).some(c => c.id === currentValue),
    queryFn: async () => (await api.get<CustomerLite>(`/customers/${currentValue}`)).data,
    staleTime: 5 * 60_000,
  });

  const list = q.data ?? [];
  // Ensure the selected customer is always present in the picker even when
  // the current search doesn't include them.
  const includesSelected = !currentValue || list.some(c => c.id === currentValue);
  const merged = includesSelected ? list : (selected.data ? [selected.data, ...list] : list);

  const options = merged.map((c) => ({
    value: c.id,
    label: c.type === "Individual"
      ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber
      : (c.companyName ?? c.customerNumber),
    hint: [c.vatNumber, c.phone, c.customerNumber].filter(Boolean).join(" · "),
  }));

  return {
    options,
    setInput: setRawInput,
    isLoading: q.isLoading,
    rawList: merged,
  };
}
