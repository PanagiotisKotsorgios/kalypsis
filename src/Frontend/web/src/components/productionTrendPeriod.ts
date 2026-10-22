export type TrendRange = { from: string; to: string };
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

/** Calendar months including the current one; local dates avoid UTC rollover. */
export function presetTrendRange(months: number, today = new Date()): TrendRange {
  return { from: iso(new Date(today.getFullYear(), today.getMonth()-months+1, 1)), to: iso(today) };
}

export function trendRangeError({ from, to }: TrendRange) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number(value.slice(0,4)) >= 1 && value !== "0001-01-01"
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
  if (!valid(from) || !valid(to)) return "Συμπληρώστε και τις δύο ημερομηνίες.";
  if (from > to) return "Η ημερομηνία «Από» πρέπει να προηγείται της «Έως».";
  const months = (Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7))+1;
  if (months > 120) return "Επιλέξτε περίοδο έως 120 μήνες.";
  return "";
}
