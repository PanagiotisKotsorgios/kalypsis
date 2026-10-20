/** Keep these format rules aligned with ContactValueRules in the API.
 * Empty optional fields are allowed. These checks don't verify ownership/existence. */
export function customerFieldError(field: string, raw: unknown): string | undefined {
  const value = raw == null ? "" : String(raw).trim();
  if (!value) return undefined;
  switch (field.toLowerCase()) {
    case "hasdrivinglicense": case "isdriver": case "isnewdriver":
      if (value !== "true" && value !== "false") return "Επιλέξτε Ναι, Όχι ή Δεν έχει οριστεί.";
      break;
    case "phone": case "altphone": case "thirdphone": case "mobilephone": case "secondarymobilephone": {
      let compact = value.replace(/[ ()-]/g, "");
      if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
      const valid = compact.startsWith("+") ? /^\+[1-9][0-9]{6,14}$/.test(compact) && (!compact.startsWith("+30") || compact.length === 13) : /^[0-9]{10}$/.test(compact);
      if (value.length > 40 || !/^\+?[0-9 ()-]+$/.test(value) || !valid)
        return "Συμπληρώστε 10 ψηφία ή διεθνή αριθμό με + / 00 και έως 15 ψηφία. Δεν επιτρέπονται γράμματα.";
      break;
    }
    case "email": case "secondaryemail": {
      const separator = value.indexOf("@");
      const local = value.slice(0, separator);
      if (value.length > 254 || separator < 1 || separator > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..") ||
        !/^[^\s@<>()\[\]:;,"\\]+@[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)+$/u.test(value))
        return "Συμπληρώστε έγκυρο email, π.χ. onoma@example.gr (έως 254 χαρακτήρες).";
      break;
    }
    case "vatnumber":
      if (!/^[0-9]{9}$/.test(value)) return "Το ΑΦΜ πρέπει να περιέχει ακριβώς 9 ψηφία, χωρίς γράμματα ή κενά.";
      break;
    case "amka":
      if (!/^[0-9]{11}$/.test(value)) return "Ο ΑΜΚΑ πρέπει να περιέχει ακριβώς 11 ψηφία.";
      break;
    case "postalcode":
      if (!/^[0-9]{3}\s?[0-9]{2}$/.test(value)) return "Ο ταχυδρομικός κώδικας πρέπει να περιέχει 5 ψηφία.";
      break;
    case "photourl": {
      let valid = false;
      try { valid = ["http:", "https:"].includes(new URL(value).protocol); } catch { /* show a useful field error */ }
      if (value.length > 500 || !valid) return "Συμπληρώστε πλήρες URL φωτογραφίας με https:// ή http:// (έως 500 χαρακτήρες).";
      break;
    }
  }
  const limit = fieldMaxLength(field);
  if (limit && value.length > limit) return `Το πεδίο δέχεται έως ${limit} χαρακτήρες.`;
  if (field === "birthDate" && value > new Date().toISOString().slice(0, 10)) return "Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική.";
  return undefined;
}

export function fieldMaxLength(field: string): number | undefined {
  return ({ vatNumber: 9, amka: 11, postalCode: 6, phone: 40, altPhone: 40, thirdPhone: 40, mobilePhone: 40,
    secondaryMobilePhone: 40, email: 254, secondaryEmail: 254, firstName: 100, lastName: 100, companyName: 200,
    taxOffice: 60, gemiNumber: 40, legalForm: 20, idNumber: 32, passportNumber: 32, address: 255, city: 100, region: 100,
    gender: 20, maritalStatus: 20, occupation: 120, employer: 200, source: 60, tagsJson: 2000, notes: 2000, photoUrl: 500 } as Record<string, number>)[field];
}

export function customerDraftErrors(values: Record<string, unknown>): string[] {
  const errors = Object.entries(values).flatMap(([field, value]) => customerFieldError(field, value) ?? []);
  if (values.driverLicenseIssueDate && values.driverLicenseExpiryDate && String(values.driverLicenseIssueDate) > String(values.driverLicenseExpiryDate))
    errors.push("Η λήξη διπλώματος δεν μπορεί να προηγείται της έκδοσης.");
  return [...new Set(errors)];
}
