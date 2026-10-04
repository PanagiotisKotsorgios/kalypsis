/**
 * Returns the completed calendar-month duration of a contract.
 *
 * Calendar arithmetic is used instead of milliseconds so a contract from
 * 26/09 to 26/12 is consistently shown as three months even around DST.
 * A partial final month is not rounded up.
 */
export function contractDurationMonths(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number | null {
  if (!startDate || !endDate) return null;

  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;

  const months = (end.getFullYear() - start.getFullYear()) * 12
    + end.getMonth() - start.getMonth();
  const anniversary = new Date(start);
  anniversary.setMonth(start.getMonth() + months);
  return Math.max(0, months - (anniversary > end ? 1 : 0));
}

export function formatContractDurationMonths(months: number | null): string {
  if (months === null) return "Δεν υπολογίζεται";
  return `${months} ${months === 1 ? "μήνας" : "μήνες"}`;
}

export function contractDurationLabel(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  return formatContractDurationMonths(contractDurationMonths(startDate, endDate));
}
