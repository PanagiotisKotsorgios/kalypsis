import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export interface ProducerCategoryOption { id: string; code: string; name: string; displayOrder: number; isActive: boolean }
export function useProducerCategories(enabled = true) {
  return useQuery({ queryKey: ["catalog", "/lookups/producer-categories"], enabled,
    queryFn: async () => (await api.get<ProducerCategoryOption[]>("/lookups/producer-categories")).data });
}
