export interface CustomerDeletionTarget { id: string; label: string; }
export interface CustomerDeletionFailure extends CustomerDeletionTarget { reason: string; }
export interface CustomerDeletionResult { deletedIds: string[]; failures: CustomerDeletionFailure[]; }

/** Page selection never toggles unrelated pages or needs a modifier key. */
export function selectCustomerPage(selected: ReadonlySet<string>, pageIds: string[], checked: boolean) {
  const next = new Set(selected);
  pageIds.forEach(id => checked ? next.add(id) : next.delete(id));
  return next;
}

/** Reuse the protected single-customer endpoint; never cascade or force-delete. */
export async function deleteSelectedCustomers(
  customers: CustomerDeletionTarget[],
  deleteCustomer: (id: string) => Promise<unknown>,
  errorMessage: (error: unknown) => string,
  onProgress: (completed: number) => void = () => {},
): Promise<CustomerDeletionResult> {
  const result: CustomerDeletionResult = { deletedIds: [], failures: [] };
  const unique = [...new Map(customers.map(customer => [customer.id, customer])).values()];
  for (const customer of unique) {
    try {
      await deleteCustomer(customer.id);
      result.deletedIds.push(customer.id);
    } catch (error) {
      result.failures.push({ ...customer, reason: errorMessage(error) });
    }
    onProgress(result.deletedIds.length + result.failures.length);
  }
  return result;
}
