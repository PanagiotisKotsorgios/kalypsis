import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
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
    const { DesktopCustomerFields, CustomerProfileTabs, CustomerDetailPage } = await server.ssrLoadModule("/src/pages/CustomerDetailPage.tsx");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const customer = { id: "test", customerNumber: "C-TEST", type: "Individual", status: "Active", firstName: "Δοκιμή" };
    const editing = { editAll: false, drafts: {}, saving: false, canEdit: true, onDraftChange() {}, async onCommitField() {} };
    try {
      const general = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing })));
      const expected = ["birthDate", "gender", "nationality", "fatherName", "occupation", "mobilePhone", "hasDrivingLicense", "isDriver", "isNewDriver",
        "taxOffice", "passportNumber", "maritalStatus", "spouseName", "motherName", "gemiNumber", "legalForm", "notes",
        "driverLicenseNumber", "driverLicenseClass", "driverLicenseIssueDate", "driverLicenseExpiryDate"];
      for (const field of expected) assert.equal(general.split(`data-customer-field="${field}"`).length - 1, 1, `${field} must appear once in General`);
      const orderedFields = [...general.matchAll(/data-customer-field="([^"]+)"/g)].map(match => match[1]);
      assert.deepEqual(orderedFields.slice(0, 5), ["firstName", "lastName", "fatherName", "motherName", "gender"]);
      assert.equal(orderedFields.indexOf("postalCode"), orderedFields.indexOf("city") + 1);
      const contact = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing, section: "contact" })));
      for (const field of ["city", "postalCode"]) assert.equal(contact.includes(`data-customer-field="${field}"`), false);
      for (const removedField of ["activityCode", "employer", "source", "tagsJson", "photoUrl", "zone"]) assert.equal(general.includes(`data-customer-field="${removedField}"`), false, removedField);
      assert.equal(general.includes('data-customer-field="paymentDueDate"'), false);
      assert.equal(general.includes("Προφίλ και οικογενειακή κατάσταση"), false);
      const editable = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing: { ...editing, editAll: true } })));
      for (const field of expected) assert.equal(editable.includes(`data-customer-field="${field}"`), true);
      assert.equal(editable.includes("Αποθήκευση Ηλικία"), false);
      assert.equal(editable.includes("Αποθήκευση Λήξη διπλώματος"), true);
      assert.equal(editable.includes("Αποθήκευση Έχει δίπλωμα"), true);
      const tabs = renderToStaticMarkup(createElement(CustomerProfileTabs, { value: 0, onChange() {} }));
      assert.equal(tabs.includes("Ζημιές"), false);
      assert.equal(tabs.includes("Λοιπά"), false);
      assert.equal(tabs.includes("Έγγραφα"), false);
      assert.equal(tabs.includes("Ιστορικό"), true);
      const other = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing, fieldKeys: [] })));
      assert.equal(other.includes("Δεν έχουν οριστεί ακόμη πεδία"), true);
      assert.equal(other.includes("data-customer-field="), false);
      const subset = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DesktopCustomerFields, { customer, editing, fieldKeys: ["taxOffice", "passportNumber"] })));
      assert.equal(subset.includes('data-customer-field="taxOffice"'), true);
      assert.equal(subset.includes('data-customer-field="passportNumber"'), true);
      assert.equal(subset.includes('data-customer-field="firstName"'), false);
      // The actual modal renders the clicked list row immediately, before a
      // detail request has completed, without caching that partial row as a
      // complete customer record.
      const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
      const { MemoryRouter } = await import("react-router-dom");
      const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
      const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
      const immediateCard = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(AuthProvider, null,
          createElement(MemoryRouter, { initialEntries: ["/app/customers"] },
            createElement(ThemeProvider, { theme }, createElement(CustomerDetailPage, {
              customerId: customer.id, initialCustomer: customer, onClose() {},
            }))))));
      assert.equal(immediateCard.includes('role="dialog"'), true);
      assert.equal(immediateCard.includes("Δοκιμή"), true);
      assert.equal(immediateCard.includes('data-customer-field="firstName"'), true);
      assert.equal(immediateCard.includes("MuiCircularProgress-root"), false);
      assert.equal(client.getQueryData(["customer", customer.id]), undefined);
      const { AuditFieldChanges } = await server.ssrLoadModule("/src/components/audit/AuditFieldChanges.tsx");
      const history = renderToStaticMarkup(createElement(AuditFieldChanges, { changes: [{ field: "Phone", label: "Τηλέφωνο", before: "2101234567", after: "2109876543", beforeRecorded: true, afterRecorded: true }] }));
      for (const text of ["Πριν", "Μετά", "2101234567", "2109876543"]) assert.equal(history.includes(text), true);
      const { Kpi } = await server.ssrLoadModule("/src/pages/ProductionListsPage.tsx");
      const total = renderToStaticMarkup(createElement(Kpi, { label: "Συμβόλαια", value: 0 }));
      assert.equal(total.includes('aria-label="Συμβόλαια"'), true);
      assert.equal(total.includes("min-height:36px"), true);
      assert.equal(total.includes("MuiTypography-h6"), false);
      const customersSource = await readFile(new URL("../../pages/CustomersPage.tsx", import.meta.url), "utf8");
      const exportSection = customersSource.slice(customersSource.indexOf("exportColumns={["), customersSource.indexOf("visibleColumnKeys="));
      assert.equal(exportSection.includes("paymentDueDate"), false);
    } finally { client.clear(); }
  } finally { await server.close(); }
});
