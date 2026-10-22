export interface PolicyCoverDraft {
  coverCode: string; coverName: string; policyObjectId: string; netPremium: string; coverageAmount: string;
  commissionPercent: string; agencyCommissionPercent: string;
}

/** Gross belongs to the policy, not this editor. Omission preserves imported historical gross in the API. */
export function policyCoverPayload(form: PolicyCoverDraft) {
  if (!form.coverCode.trim()) throw new Error("Επιλέξτε κάλυψη.");
  const amount = (value: string, label: string, nullable = false, maximum = Infinity) => {
    if (!value.trim()) return nullable ? null : 0;
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0 || result > maximum) throw new Error(`Συμπληρώστε έγκυρη τιμή στο πεδίο «${label}».`);
    return result;
  };
  return {
    coverCode: form.coverCode.trim().toUpperCase(), coverName: form.coverName.trim() || null, policyObjectId: form.policyObjectId || null,
    netPremium: amount(form.netPremium, "Καθαρά ασφάλιστρα"), coverageAmount: amount(form.coverageAmount, "Κεφάλαιο", true),
    commissionPercent: amount(form.commissionPercent, "Προμήθεια συνεργάτη", true, 100), agencyCommissionPercent: amount(form.agencyCommissionPercent, "Προμήθεια γραφείου", true, 100),
  };
}
