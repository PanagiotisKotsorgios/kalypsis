export interface GreenCardWorkflowState {
  id: string;
  status: string;
  policyDocumentId: string | null;
}

/** Issue first, then record delivery. Never report delivery if PDF issuance failed.
 * The existing delivery endpoint records a state; it does not send email. */
export async function issueAndRecordGreenCardDelivery<T extends GreenCardWorkflowState>(
  card: T,
  issue: (id: string) => Promise<T>,
  deliver: (id: string) => Promise<T>,
  onProgress: (card: T) => void,
): Promise<T> {
  const issued = await issue(card.id);
  onProgress(issued);
  if (!issued.policyDocumentId || issued.status !== "Issued" || issued.id !== card.id) throw new Error("Δεν δημιουργήθηκε το PDF της πράσινης κάρτας. Δοκιμάστε ξανά την αποθήκευση.");
  const delivered = await deliver(issued.id);
  if (delivered.status !== "Delivered" || delivered.id !== issued.id) throw new Error("Η παράδοση δεν επιβεβαιώθηκε στο σύστημα. Δοκιμάστε ξανά την αποθήκευση.");
  onProgress(delivered);
  return delivered;
}
