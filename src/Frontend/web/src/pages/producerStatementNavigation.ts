export const COMMISSION_SETTLEMENTS_URL = "/app/producer-statement?tab=settlements";
export type ProducerStatementTab = "statement" | "settlements";
export function producerStatementTab(search: URLSearchParams): ProducerStatementTab {
  return search.get("tab") === "settlements" ? "settlements" : "statement";
}
