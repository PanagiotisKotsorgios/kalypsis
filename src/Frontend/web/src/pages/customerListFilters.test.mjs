import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
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

test("customer page consolidates creation, import and saved filters under colored actions", async () => {
  const source = await readFile(new URL("./CustomersPage.tsx", import.meta.url), "utf8");
  assert.match(source, />\s*Ενέργειες\s*<\/Button>/);
  assert.match(source, /primary="Αποθήκευση νέου φίλτρου"/);
  assert.match(source, /saveRequestToken=\{saveFilterRequest\}/);
  assert.match(source, /primary="Εισαγωγή Excel"/);
  assert.match(source, /setCreateStatus\("Active"\)/);
  assert.match(source, /setCreateStatus\("Prospect"\)/);
  assert.match(source, /#0877c9/);
  assert.match(source, /#a45b00/);
  assert.match(source, /#167c45/);
  assert.match(source, /#5b55a5/);
  assert.equal(source.includes("<ExcelImportButton"), false);
  assert.equal(source.includes("<SavedReportsButton compact"), false);
});

test("customer filters adapt cleanly from phones to desktop", async () => {
  const [page, dialog] = await Promise.all([
    readFile(new URL("./CustomersPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/customer/CustomerDesktopFilters.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /display: \{ xs: "flex", lg: "none" \}/);
  assert.match(page, /display: \{ xs: "none", lg: "contents" \}/);
  assert.match(page, /Περισσότερα\{activeCustomerFilterCount/);
  assert.match(page, /gridTemplateColumns: \{ xs: "minmax\(0, 1fr\)", lg:/);
  assert.match(dialog, /fullScreen=\{fullScreen\}/);
  assert.match(dialog, /maxHeight: fullScreen \? "100dvh" : "92dvh"/);
  assert.match(dialog, /position: "sticky", bottom: 0/);
  assert.match(dialog, /gridTemplateColumns: \{ xs: "repeat\(2, minmax\(0, 1fr\)\)"/);
});
