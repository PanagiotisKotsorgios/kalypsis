export const CLAIM_FIELDS = [["incidentDate", "Ημερομηνία συμβάντος"], ["reportedDate", "Ημερομηνία δήλωσης"], ["claimedAmount", "Αιτούμενο ποσό"], ["approvedAmount", "Εγκεκριμένο ποσό"], ["status", "Κατάσταση"], ["description", "Περιγραφή"]] as const;
export function claimUpdatePayload(current: Record<string, unknown>, changes: Record<string, string>) {
  for (const key of Object.keys(changes)) if (!CLAIM_FIELDS.some(([field]) => field === key)) throw new Error("Μη υποστηριζόμενο πεδίο ζημιάς.");
  const next = { ...current, ...changes };
  const amount = (key: string) => {
    if (next[key] === "" || next[key] == null) return null;
    const value = Number(next[key]);
    if (!Number.isFinite(value) || value < 0) throw new Error("Το ποσό πρέπει να είναι μη αρνητικός αριθμός.");
    return value;
  };
  const date = (key: string) => {
    const value = String(next[key] ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Συμπληρώστε έγκυρη ημερομηνία.");
    return value;
  };
  return { incidentDate: date("incidentDate"), reportedDate: date("reportedDate"), claimedAmount: amount("claimedAmount"), approvedAmount: amount("approvedAmount"), description: String(next.description ?? "").trim() || null };
}
