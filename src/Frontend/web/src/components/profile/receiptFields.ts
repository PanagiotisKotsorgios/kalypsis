export interface ReceiptRecord {
  id: string; number: string; receivedOn: string; customerId: string; customerName: string;
  policyId: string | null; policyNumber: string | null; method: string; amount: number;
  currency: string; notes: string | null; transactionReference: string | null; details?: Record<string, string | null>;
}
export function receiptValues(record: ReceiptRecord | null): Record<string, string> {
  if (!record) return { number: `R-${crypto.randomUUID().slice(0, 12)}`, receivedOn: new Date().toLocaleDateString("sv-SE"), customerId: "", policyId: "", method: "Cash", amount: "", currency: "EUR", notes: "", transactionReference: "" };
  return { ...Object.fromEntries(Object.entries(record.details ?? {}).map(([k,v])=>[k,v??""])), number: record.number, receivedOn: record.receivedOn.slice(0,10), customerId: record.customerId, policyId: record.policyId ?? "", method: record.method, amount: String(record.amount), currency: record.currency, notes: record.notes ?? "", transactionReference: record.transactionReference ?? "" };
}
const detailKeys = ["series","documentType","sourceDocumentNumber","documentIssuedOn","withoutDocument","bankName","instrumentNumber","instrumentDueOn","instrumentAmount","settledOn","receivedBy","collectionCentreCode","deliveryAcknowledgedOn","deliveryAcknowledgedBy"];
export function receiptBody(values: Record<string, string>) {
  const amount=Number(values.amount);
  if (!values.number?.trim() || values.number.trim().length>40) throw new Error("Συμπληρώστε αριθμό απόδειξης έως 40 χαρακτήρες.");
  if (!values.customerId) throw new Error("Επιλέξτε πελάτη στην καρτέλα Πελάτης & συμβόλαιο.");
  if (!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>0.00001) throw new Error("Συμπληρώστε θετικό ποσό με έως δύο δεκαδικά.");
  if (!/^[A-Za-z]{3}$/.test(values.currency??"")) throw new Error("Συμπληρώστε νόμισμα τριών γραμμάτων.");
  return { number:values.number.trim(), receivedOn:values.receivedOn, customerId:values.customerId, policyId:values.policyId||null, method:values.method, amount, currency:values.currency.toUpperCase(), notes:values.notes||null, transactionReference:values.transactionReference||null, details:Object.fromEntries(detailKeys.filter(k=>values[k]!==undefined).map(k=>[k,values[k]||null])) };
}
