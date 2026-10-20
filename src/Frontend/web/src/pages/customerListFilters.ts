export type CustomerTypeFilter = "Individual" | "Company" | "Prospect";
export type CustomerStatusFilter = "Active" | "Inactive" | "Churned" | "Blocked";
export type CreditFilter = "creditor" | "non-creditor";
export type YesNoFilter = "yes" | "no";

export interface CustomerListFilters {
  types: CustomerTypeFilter[];
  cities: string[];
  producerIds: string[];
  statuses: CustomerStatusFilter[];
  credit: CreditFilter[];
  communication: YesNoFilter[];
  gdpr: YesNoFilter[];
  marketing: YesNoFilter[];
  portal: YesNoFilter[];
  needsForm: YesNoFilter[];
  category: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
  birthFrom: string;
  birthTo: string;
  ageMin: string;
  ageMax: string;
  childrenMin: string;
  childrenMax: string;
  hasEmail: YesNoFilter[];
  hasPhone: YesNoFilter[];
  hasVat: YesNoFilter[];
  hasPolicy: YesNoFilter[];
  hasProducer: YesNoFilter[];
}

export const EMPTY_CUSTOMER_LIST_FILTERS: CustomerListFilters = {
  types: [], cities: [], producerIds: [], statuses: [], credit: [],
  communication: [], gdpr: [], marketing: [], portal: [], needsForm: [],
  category: "", createdFrom: "", createdTo: "", updatedFrom: "", updatedTo: "",
  birthFrom: "", birthTo: "", ageMin: "", ageMax: "", childrenMin: "", childrenMax: "",
  hasEmail: [], hasPhone: [], hasVat: [], hasPolicy: [], hasProducer: [],
};

export interface CustomerFilterRow {
  type: "Individual" | "Company";
  status: string;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  mobilePhone?: string | null;
  vatNumber?: string | null;
  birthDate?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  tagsJson?: string | null;
  childrenCount?: number;
  hasPortalAccount?: boolean;
  hasPolicy?: boolean;
  hasGdprConsent?: boolean;
  hasMarketingConsent?: boolean;
  hasCommunicationConsent?: boolean;
  hasNeedsForm?: boolean;
  producerIds?: string[] | null;
  account?: { balance: number };
}

function matchesAnyBoolean(selected: YesNoFilter[], value: boolean): boolean {
  return selected.length === 0 || selected.includes(value ? "yes" : "no");
}

function validDate(value?: string | null): Date | null {
  if (!value) return null;
  const result = new Date(value.slice(0, 10) + "T00:00:00");
  return Number.isNaN(result.getTime()) ? null : result;
}

export function customerAge(birthDate?: string | null, today = new Date()): number | null {
  const birth = validDate(birthDate);
  if (!birth) return null;
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function inDateRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const date = validDate(value);
  if (!date) return false;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59`)) return false;
  return true;
}

function inNumberRange(value: number | null | undefined, minimum: string, maximum: string): boolean {
  if (!minimum && !maximum) return true;
  if (value == null) return false;
  if (minimum && value < Number(minimum)) return false;
  if (maximum && value > Number(maximum)) return false;
  return true;
}

export function activeCustomerFilterCount(filters: CustomerListFilters): number {
  return Object.values(filters).filter(value => Array.isArray(value) ? value.length > 0 : Boolean(value)).length;
}

export function customerMatchesFilters(row: CustomerFilterRow, filters: CustomerListFilters, today = new Date()): boolean {
  if (filters.types.length) {
    const prospect = row.status === "Prospect";
    const matches = filters.types.some(value => value === "Prospect" ? prospect : row.type === value);
    if (!matches) return false;
  }
  if (filters.cities.length && !filters.cities.includes((row.city ?? "").trim())) return false;
  if (filters.producerIds.length && !row.producerIds?.some(id => filters.producerIds.includes(id))) return false;
  if (filters.statuses.length && !filters.statuses.includes(row.status as CustomerStatusFilter)) return false;
  if (filters.credit.length) {
    const isCreditor = (row.account?.balance ?? 0) < -0.005;
    if (!filters.credit.includes(isCreditor ? "creditor" : "non-creditor")) return false;
  }
  if (!matchesAnyBoolean(filters.communication, Boolean(row.hasCommunicationConsent))) return false;
  if (!matchesAnyBoolean(filters.gdpr, Boolean(row.hasGdprConsent))) return false;
  if (!matchesAnyBoolean(filters.marketing, Boolean(row.hasMarketingConsent))) return false;
  if (!matchesAnyBoolean(filters.portal, Boolean(row.hasPortalAccount))) return false;
  if (!matchesAnyBoolean(filters.needsForm, Boolean(row.hasNeedsForm))) return false;
  if (!matchesAnyBoolean(filters.hasEmail, Boolean(row.email?.trim()))) return false;
  if (!matchesAnyBoolean(filters.hasPhone, Boolean(row.phone?.trim() || row.altPhone?.trim() || row.mobilePhone?.trim()))) return false;
  if (!matchesAnyBoolean(filters.hasVat, Boolean(row.vatNumber?.trim()))) return false;
  if (!matchesAnyBoolean(filters.hasPolicy, Boolean(row.hasPolicy))) return false;
  if (!matchesAnyBoolean(filters.hasProducer, Boolean(row.producerIds?.length))) return false;
  if (filters.category && !(row.tagsJson ?? "").toLocaleLowerCase("el").includes(filters.category.trim().toLocaleLowerCase("el"))) return false;
  if (!inDateRange(row.createdAt, filters.createdFrom, filters.createdTo)) return false;
  if (!inDateRange(row.updatedAt, filters.updatedFrom, filters.updatedTo)) return false;
  if (!inDateRange(row.birthDate, filters.birthFrom, filters.birthTo)) return false;
  if (!inNumberRange(customerAge(row.birthDate, today), filters.ageMin, filters.ageMax)) return false;
  if (!inNumberRange(row.childrenCount ?? 0, filters.childrenMin, filters.childrenMax)) return false;
  return true;
}
