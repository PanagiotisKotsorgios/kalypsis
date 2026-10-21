export type AdvanceDirection = "Incoming" | "Outgoing";
export const advanceDirectionLabels = { Incoming: "Εισερχόμενη", Outgoing: "Εξερχόμενη" };
export const advanceDirectionLabel = (direction?: string | null) => direction === "Incoming" || direction === "Outgoing" ? advanceDirectionLabels[direction] : "Χωρίς χαρακτηρισμό";

export function advanceBalances(rows: ReadonlyArray<{ direction?: string | null; amount: number; allocatedAmount: number; currency: string; status: string }>) {
  const result = new Map<string, { currency: string; incoming: number; outgoing: number; incomingAvailable: number; outgoingAvailable: number; unspecified: number }>();
  for (const row of rows) {
    const currency = row.currency.trim().toUpperCase();
    const value = result.get(currency) ?? { currency, incoming: 0, outgoing: 0, incomingAvailable: 0, outgoingAvailable: 0, unspecified: 0 };
    // Refunded advances have no available funds; don't present them as usable cash.
    const available = row.status === "Refunded" || row.status === "FullyAllocated" ? 0 : Math.max(0, row.amount - row.allocatedAmount);
    const add = (a: number, b: number) => Math.round((Math.round(a * 100) + Math.round(b * 100))) / 100;
    if (row.direction === "Incoming") { value.incoming = add(value.incoming, row.amount); value.incomingAvailable = add(value.incomingAvailable, available); }
    else if (row.direction === "Outgoing") { value.outgoing = add(value.outgoing, row.amount); value.outgoingAvailable = add(value.outgoingAvailable, available); }
    else value.unspecified = add(value.unspecified, row.amount);
    result.set(currency, value);
  }
  return [...result.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
