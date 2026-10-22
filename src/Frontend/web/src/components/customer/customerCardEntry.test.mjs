import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { readFile } from "node:fs/promises";

test("list pencil and context edit use the standard customer card, not the retired edit form", async () => {
  const page = await readFile(new URL("../../pages/CustomersPage.tsx", import.meta.url), "utf8");
  assert.equal((page.match(/setSelectedCustomer\(\{ customer: c, editMode: true \}\)/g) ?? []).length, 2);
  assert.ok(page.includes("initialEditMode={selectedCustomer.editMode}"));
  assert.ok(page.includes("setSelectedCustomer({ customer: c, editMode: false })"));
  assert.ok(!page.includes("editingCustomer"));
  assert.ok(!page.includes("updateMutation"));
  const creation = page.slice(page.indexOf("function CreateCustomerDialog("));
  assert.ok(!creation.includes("initialCustomer"));
  assert.ok(!creation.includes("Επεξεργασία πελάτη"));
  const workspace = await readFile(new URL("./CustomerWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(!workspace.includes("Τα πιστωτικά και οι δόσεις αναφέρονται χωριστά."));
  assert.ok(workspace.includes("Ανεξόφλητες δόσεις"));
  assert.ok(workspace.includes("Πιστωτικά προς τακτοποίηση"));
});

test("edit entry renders the same card with editable fields, save/cancel and existing unsaved-change protection", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  // Test-only signed-in role; no authentication or permissions code is changed.
  const server = await createServer({
    plugins: [{ name: "test-customer-card-auth", enforce: "pre",
      resolveId(source) { if (/\/auth\/AuthContext(?:\.tsx)?$/.test(source)) return "\0test-customer-card-auth"; },
      load(id) { if (id === "\0test-customer-card-auth") return 'export const useAuth = () => ({ user: { role: "AgencyAdmin", userId: "test", permissions: [] }, loading: false });'; },
    }],
    server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom",
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { CustomerDetailPage } = await server.ssrLoadModule("/src/pages/CustomerDetailPage.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    await server.ssrLoadModule("/src/i18n/index.ts");
    const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
    const customer = { id: "entry-test", customerNumber: "C-TEST", type: "Individual", status: "Active", firstName: "Μαρία", lastName: "Δοκιμή", phone: "2101234567" };
    client.setQueryData(["customer", customer.id], customer);
    const render = (props = {}) => renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, null, createElement(ThemeProvider, { theme }, createElement(CustomerDetailPage, {
        customerId: customer.id, initialCustomer: customer, onClose() {}, ...props,
      })))));
    const view = render();
    const edit = render({ initialEditMode: true });
    const fields = html => [...html.matchAll(/data-customer-field="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(fields(edit), fields(view));
    assert.ok(fields(edit).length > 15);
    assert.ok(edit.includes("Αποθήκευση επεξεργασίας"));
    assert.ok(edit.includes("Ακύρωση επεξεργασίας"));
    assert.ok(edit.includes('value="Μαρία"'));
    assert.ok(edit.includes('value="2101234567"'));
    assert.ok(edit.includes("Αποθήκευση Τηλέφωνο"));
    assert.ok(!view.includes("Αποθήκευση επεξεργασίας"));
    assert.ok(!view.includes('value="2101234567"'));
    client.removeQueries({ queryKey: ["customer", customer.id] });
    const placeholder = render({ initialEditMode: true });
    assert.ok(placeholder.includes('data-customer-field="phone"'));
    assert.ok(!placeholder.includes("Αποθήκευση επεξεργασίας"));
    assert.ok(!placeholder.includes('value="2101234567"'));
    const source = await readFile(new URL("../../pages/CustomerDetailPage.tsx", import.meta.url), "utf8");
    assert.ok(source.includes('if (hasUnsavedChanges) setDiscardAction("close")'));
    assert.ok(source.includes("setEditAll(initialEditMode)"));
  } finally { client.clear(); await server.close(); }
});
