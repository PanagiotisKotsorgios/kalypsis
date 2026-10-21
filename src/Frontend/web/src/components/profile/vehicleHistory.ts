interface VehicleHistoryPolicy {
  id: string;
  customerId?: string;
  customerDisplay: string;
  customerVat?: string | null;
  policyNumber: string;
  startDate: string;
  endDate: string;
}

/** Coverage history of recorded policyholders, not inferred legal ownership dates. */
export function vehicleOwnerHistory(details: readonly VehicleHistoryPolicy[]) {
  const owners = new Map<string, {
    key: string; customerId?: string; customerDisplay: string; customerVat?: string | null;
    from: string; to: string; policyNumbers: string[];
  }>();
  for (const policy of [...details].sort((a, b) => b.startDate.localeCompare(a.startDate))) {
    const key = policy.customerId || policy.customerVat || policy.customerDisplay;
    const existing = owners.get(key);
    if (!existing) {
      owners.set(key, { key, customerId: policy.customerId, customerDisplay: policy.customerDisplay,
        customerVat: policy.customerVat, from: policy.startDate, to: policy.endDate, policyNumbers: [policy.policyNumber] });
    } else {
      if (policy.startDate < existing.from) existing.from = policy.startDate;
      if (policy.endDate > existing.to) existing.to = policy.endDate;
      if (!existing.policyNumbers.includes(policy.policyNumber)) existing.policyNumbers.push(policy.policyNumber);
    }
  }
  return [...owners.values()].sort((a, b) => b.to.localeCompare(a.to));
}
