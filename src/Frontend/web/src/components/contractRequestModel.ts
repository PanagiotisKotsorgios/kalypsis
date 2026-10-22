export interface ContractRequestFields {
  firstName: string; lastName: string; email: string; phone: string;
  companyName: string; region: string; message: string; consent: boolean; website: string;
}
export const emptyContractRequest = (): ContractRequestFields => ({ firstName: "", lastName: "", email: "", phone: "", companyName: "", region: "", message: "", consent: false, website: "" });

export function contractRequestError(form: ContractRequestFields) {
  if (!form.firstName.trim() || !form.lastName.trim()) return "Συμπληρώστε όνομα και επώνυμο.";
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Συμπληρώστε έγκυρο email.";
  const digits = form.phone.replace(/\D/g, "").length;
  if (digits < 10 || digits > 15 || !/^\+?[0-9 ()-]+$/.test(form.phone.trim())) return "Συμπληρώστε έγκυρο τηλέφωνο με 10–15 ψηφία.";
  if (!form.companyName.trim()) return "Συμπληρώστε επωνυμία γραφείου / εταιρείας.";
  if (form.firstName.length > 120 || form.lastName.length > 120 || form.email.length > 160 || form.phone.length > 40 || form.companyName.length > 200 || form.region.length > 120 || form.message.length > 2000) return "Κάποιο πεδίο υπερβαίνει το επιτρεπόμενο μήκος.";
  if (!form.consent) return "Απαιτείται συγκατάθεση επικοινωνίας για το αίτημα.";
  return "";
}

export function contractRequestPayload(form: ContractRequestFields) {
  return {
    inquiryType: "contract", firstName: form.firstName.trim(), lastName: form.lastName.trim(),
    email: form.email.trim(), phone: form.phone.trim(), companyName: form.companyName.trim(),
    agencyOrCity: form.region.trim() || null, subject: "Αίτημα σύμβασης συνεργασίας KALYPSIS",
    message: `Παρακαλώ αποστείλετε τη σύμβαση συνεργασίας KALYPSIS.\nΕπωνυμία: ${form.companyName.trim()}\nΠεριοχή: ${form.region.trim() || "Δεν έχει οριστεί"}\n\n${form.message.trim() || "Χωρίς επιπλέον μήνυμα."}`,
    consent: form.consent, website: form.website,
  };
}
