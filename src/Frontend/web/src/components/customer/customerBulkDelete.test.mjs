import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { selectCustomerPage, deleteSelectedCustomers } from "./customerBulkDelete.ts";

test("checkboxes accumulate independent selections without Ctrl and page selection preserves other pages", () => {
  const initial = new Set();
  let selected = selectCustomerPage(initial, ["1"], true);
  selected = selectCustomerPage(selected, ["2"], true);
  selected = selectCustomerPage(selected, ["3"], true);
  assert.deepEqual([...selected], ["1", "2", "3"]);
  assert.equal(initial.size, 0);
  selected = selectCustomerPage(selected, ["2"], false);
  assert.deepEqual([...selected], ["1", "3"]);
  selected = selectCustomerPage(selected, ["4", "5"], true);
  selected = selectCustomerPage(selected, ["4", "5"], false);
  assert.deepEqual([...selected], ["1", "3"]);
});

test("bulk deletion uses the protected endpoint per selected ID and retains dependency failures", async () => {
  const called = [], progress = [];
  const targets = [{ id: "empty", label: "Χωρίς ιστορικό" }, { id: "linked", label: "Με συμβόλαια" }, { id: "last", label: "Τρίτος" }];
  const result = await deleteSelectedCustomers(targets, async id => {
    called.push(id);
    if (id === "linked") throw new Error("Δεν είναι δυνατή η διαγραφή: συμβόλαια: 2. Διαγράψτε πρώτα το ιστορικό.");
  }, error => error.message, n => progress.push(n));
  assert.deepEqual(called, ["empty", "linked", "last"]);
  assert.deepEqual(result.deletedIds, ["empty", "last"]);
  assert.equal(result.failures[0].id, "linked");
  assert.match(result.failures[0].reason, /συμβόλαια: 2/);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual([...selectCustomerPage(new Set(targets.map(row => row.id)), result.deletedIds, false)], ["linked"]);
});

test("empty selection sends no requests, duplicate IDs delete once, and all failures are surfaced", async () => {
  let calls = 0;
  const remove = async () => { calls++; throw new Error("Δεν έχετε δικαίωμα διαγραφής."); };
  assert.deepEqual(await deleteSelectedCustomers([], remove, e => e.message), { deletedIds: [], failures: [] });
  const result = await deleteSelectedCustomers([{ id: "1", label: "Πελάτης" }, { id: "1", label: "Πελάτης" }], remove, e => e.message);
  assert.equal(calls, 1);
  assert.equal(result.deletedIds.length, 0);
  assert.match(result.failures[0].reason, /δικαίωμα/);
});

test("real customer list renders one accessible checkbox per record and a select-page header", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { CustomersPage } = await server.ssrLoadModule("/src/pages/CustomersPage.tsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    await server.ssrLoadModule("/src/i18n/index.ts");
    const { CustomerBulkDeleteDialog } = await server.ssrLoadModule("/src/components/customer/CustomerBulkDeleteDialog.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `${i}`, customerNumber: `C-${i}`, type: "Individual", status: "Active", firstName: "Δοκιμή", lastName: `${i}`, createdAt: "2026-01-01" }));
    client.setQueryData(["customers", "desktop-parity-filter-list"], rows);
    client.setQueryData(["customer-accounts", "all-time"], []);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, createElement(CustomersPage))));
    assert.ok(html.includes('aria-label="Επιλογή όλων των πελατών αυτής της σελίδας"'));
    rows.forEach(row => assert.ok(html.includes(`aria-label="Επιλογή πελάτη ${row.customerNumber}"`)));
    const base = { targets: [{ id: "1", label: "C-1 · Δοκιμή" }], pending: false, completed: 0, result: null, onConfirm() {}, onClose() {} };
    const renderDialog = props => renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(CustomerBulkDeleteDialog, { ...base, ...props })));
    const confirm = renderDialog({});
    assert.ok(confirm.includes("Διαγραφή 1 πελατών"));
    assert.ok(confirm.includes("δεν θα διαγραφούν"));
    const pending = renderDialog({ pending: true });
    assert.ok(pending.includes("Έλεγχος και διαγραφή: 0 / 1"));
    assert.match(pending, /<button[^>]*disabled[^>]*>[\s\S]*?Γίνεται έλεγχος/);
    const blocked = renderDialog({ result: { deletedIds: [], failures: [{ id: "1", label: "C-1 · Δοκιμή", reason: "Υπάρχουν συνδεδεμένα συμβόλαια: 2" }] } });
    assert.ok(blocked.includes("Αιτία μη διαγραφής"));
    assert.ok(blocked.includes("Υπάρχουν συνδεδεμένα συμβόλαια: 2"));
    assert.ok(blocked.includes("Διαγράφηκαν 0 από 1"));
    assert.ok(!blocked.includes("Διαγραφή 1 πελατών"));
  } finally { client.clear(); await server.close(); }
});
