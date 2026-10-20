import assert from "node:assert/strict";
import test from "node:test";
import { activeCustomerFilterCount, customerAge, customerMatchesFilters, EMPTY_CUSTOMER_LIST_FILTERS } from "./customerListFilters.ts";

const row = {
  type: "Individual", status: "Active", city: "Αθήνα", email: "client@example.gr",
  phone: "2100000000", vatNumber: "123456789", birthDate: "1986-10-21",
  createdAt: "2026-01-10T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z",
  tagsJson: '["VIP","Ιδιώτης"]', childrenCount: 2, hasPortalAccount: true,
  hasPolicy: true, hasGdprConsent: true, hasMarketingConsent: false,
  hasCommunicationConsent: true, hasNeedsForm: true,
  producerIds: ["producer-a", "producer-b"], account: { balance: -25 },
};
const filters = overrides => ({ ...EMPTY_CUSTOMER_LIST_FILTERS, ...overrides });

test("customer list filters reproduce the desktop multi-select behaviour", () => {
  assert.equal(customerMatchesFilters(row, filters({ cities: ["Αθήνα", "Πάτρα"] }), new Date("2026-10-20")), true);
  assert.equal(customerMatchesFilters(row, filters({ cities: ["Πειραιάς"] }), new Date("2026-10-20")), false);
  assert.equal(customerMatchesFilters(row, filters({ producerIds: ["producer-b"] }), new Date("2026-10-20")), true);
  assert.equal(customerMatchesFilters(row, filters({ producerIds: ["producer-c"] }), new Date("2026-10-20")), false);
  assert.equal(customerMatchesFilters(row, filters({ types: ["Company", "Individual"] }), new Date("2026-10-20")), true);
});

test("presence, consent, financial and detailed ranges are combined", () => {
  assert.equal(customerAge(row.birthDate, new Date("2026-10-20")), 39);
  assert.equal(customerMatchesFilters(row, filters({
    credit: ["creditor"], gdpr: ["yes"], marketing: ["no"], hasPolicy: ["yes"],
    category: "vip", ageMin: "35", ageMax: "45", childrenMin: "2", childrenMax: "3",
    createdFrom: "2026-01-01", createdTo: "2026-02-01",
  }), new Date("2026-10-20")), true);
  assert.equal(customerMatchesFilters(row, filters({ ageMin: "40" }), new Date("2026-10-20")), false);
  assert.equal(customerMatchesFilters(row, filters({ hasEmail: ["no"] }), new Date("2026-10-20")), false);
});

test("active count treats each desktop filter group as one filter", () => {
  assert.equal(activeCustomerFilterCount(filters({ cities: ["Αθήνα", "Πάτρα"], gdpr: ["yes"], ageMin: "18" })), 3);
});
