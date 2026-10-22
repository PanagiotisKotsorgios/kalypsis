export function policyPaymentStatus(premium: number, received: number, direct: boolean) {
  if (premium <= 0) return "Μηδενικό ασφάλιστρο";
  if (received >= premium - .005) return "Εξοφλημένο";
  if (received > 0) return "Μερικώς εξοφλημένο";
  return direct ? "Πληρωμή στην ασφαλιστική — δεν έχει επιβεβαιωθεί" : "Ανεξόφλητο";
}
