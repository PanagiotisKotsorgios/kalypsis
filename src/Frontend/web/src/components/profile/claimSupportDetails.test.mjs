import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

test("editing one garage contact preserves all other contact and carrier data in the save payload", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
  try {
  const { claimSupportUpdate } = await server.ssrLoadModule("/src/components/profile/claimSupportProfile.ts");
  const current = { code: "G1", name: "Συνεργείο", isApproved: true, isActive: true, profile: { ownerName: "Owner", contactName: "First", contactEmail: "first@example.com", secondContactName: "Second", secondContactEmail: "second@example.com", mobilePhone: "6912345678" }, insuranceCompanies: [{ id: "company-1", name: "Company" }] };
  const body = claimSupportUpdate("garages", current, { contactEmail: "new@example.com" });
  assert.equal(body.profile.contactEmail, "new@example.com");
  for (const key of ["ownerName", "contactName", "secondContactEmail", "secondContactName", "mobilePhone"]) assert.equal(body.profile[key], current.profile[key]);
  assert.deepEqual(body.insuranceCompanyIds, ["company-1"]);
  assert.equal("contactEmail" in body, false);
  assert.equal(claimSupportUpdate("garages", current, { secondContactEmail: "" }).profile.secondContactEmail, null);
  assert.deepEqual(claimSupportUpdate("garages", { ...current, insuranceCompanyIds: [] }, {}).insuranceCompanyIds, []);
  for (const [field, value] of [["contactPhone", "abc"], ["secondContactEmail", "bad email"], ["website", "javascript:alert(1)"]]) assert.throws(() => claimSupportUpdate("garages", current, { [field]: value }));
  } finally { await server.close(); }
});

test("garage profile contact fields, compact claim context and audit history render with the existing card controls", async t => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { CLAIM_SUPPORT_SECTIONS, GARAGE_PROFILE_KEYS } = await server.ssrLoadModule("/src/components/profile/claimSupportProfile.ts");
    const { ClaimSupportFields } = await server.ssrLoadModule("/src/components/ClaimSupportDetailDialog.tsx");
    const { ClaimContextFields } = await server.ssrLoadModule("/src/components/ClaimSupportContext.tsx");
    const { EntityAuditTable } = await server.ssrLoadModule("/src/components/EntityAuditTable.tsx");
    const render = (Component, props) => renderToStaticMarkup(h(QueryClientProvider, { client }, h(Component, props)));
    await t.test("every extended garage field has copy and edit controls and remains in the same position when editing", () => {
      const values = Object.fromEntries(CLAIM_SUPPORT_SECTIONS.garages.flatMap(section => section.fields).map(field => [field.key, field.key === "isActive" || field.key === "isApproved" ? "true" : field.key]));
      const session = { values, drafts: {}, editAll: false, busy: false, change() {}, commit: async () => {}, begin() {}, saveAll() {}, cancel() {}, requestClose() {} };
      const all = CLAIM_SUPPORT_SECTIONS.garages.map((section, index) => render(ClaimSupportFields, { kind: "garages", section: index, values, session })).join("");
      for (const key of GARAGE_PROFILE_KEYS) assert.ok(all.includes(`data-profile-field="${key}"`), key);
      for (const label of ["Ιδιοκτήτης / νόμιμος εκπρόσωπος", "Email υπευθύνου", "Email δεύτερης επαφής", "Περιοχή / περιφέρεια"]) for (const action of ["Αντιγραφή", "Επεξεργασία"]) assert.ok(all.includes(`${action} ${label}`), `${action} ${label}`);
      const contact = render(ClaimSupportFields, { kind: "garages", section: 1, values, session: { ...session, editAll: true } });
      assert.ok(contact.includes("Αποθήκευση Email υπευθύνου")); assert.ok(contact.includes("Αποθήκευση Email δεύτερης επαφής"));
    });
    await t.test("indemnities and friendly settlements expose real linked claim and policy information", () => {
      const html = render(ClaimContextFields, { claim: { claimNumber: "CL1", policyNumber: "P1", customerDisplay: "Πελάτης", insuranceCompanyName: "Ασφαλιστική", incidentDate: "2026-06-01", reportedDate: "2026-06-02", status: "Approved", claimedAmount: 500, approvedAmount: 400, liabilityPercent: 50, description: "Περιγραφή" }, policy: { currency: "EUR", vehicleRegistrationPlate: "ABC1234", startDate: "2026-01-01", endDate: "2027-01-01" } });
      for (const text of ["Αριθμός ζημιάς", "Ασφαλιστική", "Πινακίδα οχήματος", "ABC1234", "Εγκεκριμένο ποσό", "400", "Ποσοστό υπαιτιότητας", "50%"]) assert.ok(html.includes(text), text);
    });
    await t.test("claim audit history is a compact table with pagination and green white details buttons", () => {
      client.setQueryData(["entity-audit-table", "Claim", "CLAIM1", 0, "", ""], { items: [{ id: "A1", action: "Update", createdAt: "2026-06-01T10:00:00Z", userDisplayName: "Χρήστης", changes: [{ field: "status", label: "Κατάσταση", before: "Reported", after: "Approved" }] }], totalCount: 30 });
      const html = render(EntityAuditTable, { entityName: "Claim", entityId: "CLAIM1" });
      assert.ok(html.includes("<table")); assert.ok(html.includes("Λεπτομέρειες")); assert.ok(html.includes("MuiButton-containedSuccess")); assert.ok(html.includes("color:#fff")); assert.ok(html.includes("30")); assert.ok(html.includes("Χρήστης"));
    });
  } finally { client.clear(); await server.close(); }
});

test("claims remove the link-card clutter; garage filters include multiple carriers and save them", async () => {
  const read = file => readFile(new URL(file, import.meta.url), "utf8");
  const claims = await read("../ClaimDetailDrawer.tsx");
  const history = claims.slice(claims.indexOf("export function HistoryTab"), claims.indexOf("export function ClaimProfileFields"));
  for (const text of ["Αριθμός εγγράφων συμβολαίου", "Παραδόθηκε συμβόλαιο", "Επόμενη ανανέωση", "Σύνδεσμοι και αρχεία"]) assert.ok(!history.includes(text));
  assert.ok(history.includes("Προβολή συμβολαίου")); assert.ok(history.includes("Προβολή πελάτη")); assert.ok(history.includes("EntityAuditTable"));
  const garages = await read("../../pages/GaragesPage.tsx");
  assert.ok(!garages.includes('t("garages.subtitle")'));
  for (const text of ["Autocomplete multiple", "companyFilter.includes(company.id)", "companyFilter,", "Συνεργαζόμενη ασφαλιστική", "insuranceCompanies", "profile?.contactName"]) assert.ok(garages.includes(text), text);
});
