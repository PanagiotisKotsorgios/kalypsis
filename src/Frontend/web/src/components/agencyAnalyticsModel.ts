export interface AnalyticsPoint { label: string; value: number }
export interface AgencyAnalyticsReport {
  monthlyPremium: AnalyticsPoint[];
  policiesByType: AnalyticsPoint[];
  policiesByStatus: AnalyticsPoint[];
  claimsByStatus: AnalyticsPoint[];
  requestsByStatus?: AnalyticsPoint[];
  topCarriers: { carrier: string; premium: number; policies: number }[];
}

export const ANALYTICS_LABELS: Record<string, string> = {
  Auto: "Οχήματα", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση", Travel: "Ταξίδι", Marine: "Μεταφορές", Other: "Άλλο",
  Draft: "Πρόχειρο", Active: "Ενεργό", Expired: "Έληξε", Cancelled: "Ακυρωμένο", Renewed: "Ανανεώθηκε", PendingRenewal: "Προς ανανέωση", Prospect: "Πιθανό",
  Undelivered: "Απαράδοτο", AwaitingIssue: "Προς έκδοση", Open: "Ανοιχτή", Reported: "Αναφέρθηκε", UnderReview: "Υπό εξέταση", InReview: "Υπό εξέταση",
  Approved: "Εγκεκριμένη", Rejected: "Απορρίφθηκε", Closed: "Κλειστή", Reopened: "Επανάνοιξη", Pending: "Εκκρεμεί", InProgress: "Σε εξέλιξη",
  Completed: "Ολοκληρώθηκε", Resolved: "Επιλύθηκε", Paid: "Πληρώθηκε",
};
const monthFormatter = new Intl.DateTimeFormat("el-GR", { month: "short", year: "2-digit", timeZone: "UTC" });
export const monthLabel = (label: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(label) ? monthFormatter.format(new Date(`${label}-01T00:00:00Z`)) : label;
export const validPoints = (points: AnalyticsPoint[] = []) => points
  .filter(point => (typeof point.value === "number" || (typeof point.value === "string" && String(point.value).trim() !== "")) && Number.isFinite(Number(point.value)))
  .map(point => ({ ...point, value: Number(point.value) }));
export const labelledPoints = (points: AnalyticsPoint[] = []) => validPoints(points).map(point => ({ ...point, label: ANALYTICS_LABELS[point.label] ?? point.label }));

/** No synthetic periods or forecasts. A moving average needs three actual observations. */
export function monthlyAnalytics(points: AnalyticsPoint[], months: number) {
  const source = validPoints(points).slice(-Math.max(1, months));
  let cumulative = 0;
  const series = source.map((point, index) => {
    cumulative = Math.round((cumulative + point.value) * 100) / 100;
    const sample = source.slice(Math.max(0, index - 2), index + 1);
    return { ...point, month: monthLabel(point.label), cumulative,
      movingAverage: sample.length === 3 ? sample.reduce((sum, item) => sum + item.value, 0) / 3 : null };
  });
  const mean = source.length ? source.reduce((sum, point) => sum + point.value, 0) / source.length : null;
  const deviation = source.length > 1 && mean !== null ? Math.sqrt(source.reduce((sum, point) => sum + (point.value - mean) ** 2, 0) / source.length) : null;
  const first = source[0]?.value;
  const last = source.at(-1)?.value;
  const change = first !== undefined && first !== 0 && last !== undefined && source.length > 1 ? ((last - first) / Math.abs(first)) * 100 : null;
  return { series, mean, deviation, change };
}
