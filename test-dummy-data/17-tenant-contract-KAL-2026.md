# Παράδειγμα Εμπορικού Συμβολαίου Kalypsis ↔ Γραφείου

**Αυτό είναι δείγμα** που ο SuperAdmin μπορεί να χρησιμοποιήσει για να δοκιμάσει
την καρτέλα «Συμβόλαια» στη σελίδα του tenant (`/app/tenants/{id}?tab=contracts`).

Τα κάτωθι πεδία αντιστοιχούν 1-προς-1 με τη φόρμα «Νέο συμβόλαιο».

---

| Πεδίο                        | Τιμή                                    |
| ---------------------------- | --------------------------------------- |
| **Contract Number**          | KAL-2026-LANCA-001                     |
| **Plan**                     | Pro                                     |
| **Monthly Base Amount**      | 149,00 €                                |
| **Currency**                 | EUR                                     |
| **Office Included Count**    | 2                                       |
| **Office Surcharge / Extra** | 25,00 € ανά επιπλέον υποκατάστημα      |
| **Signed At**                | 15/07/2026                             |
| **Effective From**           | 01/08/2026                             |
| **Effective To**             | (κενό — ανοιχτό)                       |
| **Auto Renew**               | true                                    |
| **Renewal Term Months**      | 12                                      |
| **Signed By Name**           | ΝΙΚΟΛΑΟΣ ΑΝΑΓΝΩΣΤΟΠΟΥΛΟΣ               |
| **Signed By Role**           | Διαχειριστής Γραφείου                  |
| **Signed By Email**          | test+p0001@example.com                  |

---

## Δείγματα για άλλα γραφεία

Επαναλάβετε την ίδια διαδικασία με:

- **Ασφάλειες Γκαναβίας** → KAL-2026-AGENCY-001, Basic, 99,00 €/μήνα, 1 office.
- **DEMO_AGENCY** → KAL-2026-DEMO, Enterprise, 299,00 €/μήνα, 5 offices.

Μετά την καταχώρηση δείτε στη σελίδα **Οικονομικά Πλατφόρμας**
(`/app/platform/economics`) πώς η μηνιαία χρέωση υπολογίζεται αυτόματα.
