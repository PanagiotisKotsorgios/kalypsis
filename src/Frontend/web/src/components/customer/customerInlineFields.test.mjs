import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

test("card-wide editing uses the existing field controls without autofocus or editable read-only values", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { InlineValueField } = await server.ssrLoadModule("/src/components/InlineValueField.tsx");
    const base = { label: "Τηλέφωνο", value: "2101234567", onCommit: async () => {}, compact: true, showActions: true };
    const view = renderToStaticMarkup(createElement(InlineValueField, base));
    assert.equal(view.includes("<input"), false);
    assert.equal(view.includes("Επεξεργασία Τηλέφωνο"), true);
    const edit = renderToStaticMarkup(createElement(InlineValueField, { ...base, editMode: true, draftValue: "2610123456" }));
    assert.equal(edit.includes('<input'), true);
    assert.equal(edit.includes('value="2610123456"'), true);
    assert.equal(edit.includes("Αποθήκευση Τηλέφωνο"), true);
    assert.equal(edit.includes("autofocus"), false);
    const restored = renderToStaticMarkup(createElement(InlineValueField, { ...base, draftValue: "2610123456" }));
    assert.equal(restored.includes('value="2610123456"'), true);
    assert.equal(restored.includes("autofocus"), false);
    const readOnly = renderToStaticMarkup(createElement(InlineValueField, { ...base, onCommit: undefined, editMode: true }));
    assert.equal(readOnly.includes("<input"), false);
    assert.equal(readOnly.includes("Αντιγραφή Τηλέφωνο"), true);
    const select = renderToStaticMarkup(createElement(InlineValueField, { ...base, label: "Κατάσταση", value: "Active", editMode: true,
      options: [{ value: "Active", label: "Ενεργός" }, { value: "Prospect", label: "Πιθανός" }] }));
    assert.equal(select.includes('role="combobox"'), true);
    assert.equal(select.includes("Αποθήκευση Κατάσταση"), true);
    const invalid = renderToStaticMarkup(createElement(InlineValueField, { ...base, editMode: true, draftValue: "letters",
      validate: () => "Μη έγκυρο τηλέφωνο", maxLength: 40, inputMode: "tel" }));
    assert.equal(invalid.includes('aria-invalid="true"'), true);
    assert.equal(invalid.includes("Μη έγκυρο τηλέφωνο"), true);
    assert.match(invalid, /<button[^>]*disabled[^>]*aria-label="Αποθήκευση Τηλέφωνο"/);
    const suggestions = renderToStaticMarkup(createElement(InlineValueField, { ...base, label: "Εθνικότητα", value: "Ελληνική", editMode: true, suggestions: ["Ελληνική", "Κυπριακή"] }));
    assert.equal(suggestions.includes('role="combobox"'), true);
    const afm = renderToStaticMarkup(createElement(InlineValueField, { ...base, label: "ΑΦΜ", value: "012345678", editMode: true, maxLength: 9, inputMode: "numeric" }));
    assert.equal(afm.includes('maxLength="9"'), true);

    // Load the actual General sheet, not a duplicate test-only implementation.
    globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
    globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
    const { DesktopCustomerFields } = await server.ssrLoadModule("/src/pages/CustomerDetailPage.tsx");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const customer = { id: "test", customerNumber: "C-TEST", type: "Individual", status: "Active", firstName: "Δοκιμή" };
    const editing = { editAll: false, drafts: {}, saving: false, canEdit: true, onDraftChange() {}, async onCommitField() {} };
    try {
      const general = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing })));
      const expected = ["birthDate", "gender", "nationality", "maritalStatus", "passportNumber", "fatherName", "motherName", "spouseName",
        "gemiNumber", "legalForm", "source", "tagsJson", "photoUrl", "zone", "driverLicenseNumber", "driverLicenseClass", "driverLicenseIssueDate", "driverLicenseExpiryDate", "paymentDueDate", "occupation", "employer", "mobilePhone", "activityCode"];
      for (const field of expected) assert.equal(general.split(`data-customer-field="${field}"`).length - 1, 1, `${field} must appear once in General`);
      assert.equal(general.includes("Προφίλ και οικογενειακή κατάσταση"), false);
      const editable = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing: { ...editing, editAll: true } })));
      for (const field of expected) assert.equal(editable.includes(`data-customer-field="${field}"`), true);
      assert.equal(editable.includes("Αποθήκευση Λήξη διπλώματος"), true);
      const other = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing, fieldKeys: [] })));
      assert.equal(other.includes("Δεν έχουν οριστεί ακόμη πεδία"), true);
      assert.equal(other.includes("data-customer-field="), false);
      const subset = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing, fieldKeys: ["zone", "source"] })));
      assert.equal(subset.includes('data-customer-field="zone"'), true);
      assert.equal(subset.includes('data-customer-field="source"'), true);
      assert.equal(subset.includes('data-customer-field="firstName"'), false);
      const { AuditFieldChanges } = await server.ssrLoadModule("/src/components/audit/AuditFieldChanges.tsx");
      const history = renderToStaticMarkup(createElement(AuditFieldChanges, { changes: [{ field: "Phone", label: "Τηλέφωνο", before: "2101234567", after: "2109876543", beforeRecorded: true, afterRecorded: true }] }));
      for (const text of ["Πριν", "Μετά", "2101234567", "2109876543"]) assert.equal(history.includes(text), true);
    } finally { client.clear(); }
  } finally { await server.close(); }
});
