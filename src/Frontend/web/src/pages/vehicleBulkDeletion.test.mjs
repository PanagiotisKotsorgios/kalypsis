import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { readFile } from "node:fs/promises";
import { deleteSelectedRecords, selectPageRecords } from "../utils/bulkDeletion.ts";

test("vehicle multi-selection accumulates without Ctrl; dependency failures remain selected and report every contract", async () => {
  let selected = selectPageRecords(new Set(), ["p1"], true);
  selected = selectPageRecords(selected, ["p2"], true);
  assert.deepEqual([...selected], ["p1", "p2"]);
  const calls = [], progress = [];
  const result = await deleteSelectedRecords([{ id: "p1", label: "ABC1234 · P-1" }, { id: "p2", label: "XYZ9876 · P-2" }], async id => {
    calls.push(id); throw new Error(`Δεν επιτρέπεται η διαγραφή: συνδεδεμένο συμβόλαιο ${id}`);
  }, error => error.message, done => progress.push(done));
  assert.deepEqual(calls, ["p1", "p2"]);
  assert.deepEqual(progress, [1, 2]);
  assert.equal(result.deletedIds.length, 0);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0].reason, /συνδεδεμένο συμβόλαιο p1/);
  assert.deepEqual([...selectPageRecords(selected, result.deletedIds, false)], ["p1", "p2"]);
});

test("real vehicle list and shared confirmation show selectable vehicle rows and full protected-deletion feedback", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { CustomerVehiclesPage } = await server.ssrLoadModule("/src/pages/CustomerVehiclesPage.tsx");
    const { BulkDeleteDialog } = await server.ssrLoadModule("/src/components/BulkDeleteDialog.tsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    await server.ssrLoadModule("/src/i18n/index.ts");
    const policy = { id: "p1", customerId: "c1", customerDisplay: "Δοκιμή", policyNumber: "P-1", insuranceCompanyName: "Εταιρεία", policyType: "Auto", status: "Active", startDate: "2026-01-01", endDate: "2027-01-01", premium: 100, currency: "EUR", vehicleRegistrationPlate: "ABC1234" };
    client.setQueryData(["customer-vehicles-all"], [policy, { ...policy, id: "p2", policyNumber: "P-2", vehicleRegistrationPlate: "XYZ9876" }, { ...policy, id: "empty", policyNumber: "NO-VEHICLE", vehicleRegistrationPlate: null }]);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, createElement(MemoryRouter, null, createElement(CustomerVehiclesPage)))));
    for (const label of ["Επιλογή όλων των οχημάτων αυτής της σελίδας", "Επιλογή οχήματος ABC1234 · P-1", "Επιλογή οχήματος XYZ9876 · P-2"]) assert.ok(html.includes(`aria-label="${label}"`));
    const body = html.match(/<tbody\b[\s\S]*?<\/tbody>/)?.[0] ?? "";
    assert.equal((body.match(/<tr\b/g) ?? []).length, 2);
    assert.ok(!body.includes("NO-VEHICLE"));
    const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
    const props = { entity: "vehicles", targets: [{ id: "p1", label: "ABC1234 · P-1" }], pending: false, completed: 1, result: { deletedIds: [], failures: [{ id: "p1", label: "ABC1234 · P-1", reason: "Δεν επιτρέπεται η διαγραφή λόγω συσχετίσεων με το συμβόλαιο P-1" }] }, onConfirm() {}, onClose() {} };
    const blocked = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(BulkDeleteDialog, props)));
    for (const text of ["Αποτέλεσμα διαγραφής οχημάτων", "Διαγράφηκαν 0 από 1 οχήματα", "Αιτία μη διαγραφής", "λόγω συσχετίσεων", "ABC1234 · P-1"]) assert.ok(blocked.includes(text), text);
    assert.ok(!blocked.includes("Διαγραφή 1 οχημάτων"));
    const source = await readFile(new URL("./CustomerVehiclesPage.tsx", import.meta.url), "utf8");
    assert.ok(source.includes('entity="vehicles"'));
    assert.ok(source.includes("selectPageRecords(previous, [row.id], checked)"));
    assert.ok(source.includes("selectedRows.map(row => row.id)"));
    assert.ok(!source.includes("Πληκτρολόγησε ΔΙΑΓΡΑΦΗ"));
  } finally { client.clear(); await server.close(); }
});
