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
    const vehicle = { id: "ABC1234", plate: "ABC1234", primaryPolicyId: "p1", policyIds: ["p1", "renewal-1", "renewal-2"], owners: [{ name: "Δοκιμή Ιδιοκτήτη", customerId: "c1" }], make: "Toyota", model: "Yaris", year: "2022", use: "EIX", fuelType: "Βενζίνη", engineCapacity: "1490", vin: "TESTVIN123" };
    client.setQueryData(["customer-vehicles-all", "vehicle-register"], [vehicle, { ...vehicle, id: "XYZ9876", plate: "XYZ9876", primaryPolicyId: "p2", policyIds: ["p2"], make: "Opel", model: "Corsa" }]);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, createElement(MemoryRouter, null, createElement(CustomerVehiclesPage)))));
    for (const label of ["Επιλογή όλων των οχημάτων αυτής της σελίδας", "Επιλογή οχήματος ABC1234", "Επιλογή οχήματος XYZ9876"]) assert.ok(html.includes(`aria-label="${label}"`));
    const body = html.match(/<tbody\b[\s\S]*?<\/tbody>/)?.[0] ?? "";
    assert.equal((body.match(/<tr\b/g) ?? []).length, 2);
    assert.ok(!body.includes("NO-VEHICLE"));
    assert.ok(!body.includes("Πιθανό συμβόλαιο"));
    assert.ok(!body.includes("Ενεργό"));
    const header = html.match(/<thead\b[\s\S]*?<\/thead>/)?.[0] ?? "";
    assert.ok(!header.includes("Κατάσταση"));
    assert.equal((header.match(/<th\b/g) ?? []).length, 11);
    for (const text of ["Πινακίδα", "Ιδιοκτήτης / συνιδιοκτήτες", "Μάρκα", "Μοντέλο", "Έτος", "Χρήση", "Καύσιμο", "Κυβισμός (cc)", "VIN / πλαίσιο"]) assert.ok(header.includes(text), text);
    for (const text of ["Ασφαλιστική", "Συμβόλαιο", "Πελάτης", "Έναρξη", "Λήξη", "Ασφάλιστρο"]) assert.ok(!header.includes(text), text);
    for (const text of ["Δοκιμή Ιδιοκτήτη", "Toyota", "Yaris", "1490", "TESTVIN123"]) assert.ok(body.includes(text), text);
    assert.ok(!body.includes("renewal-1"));
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
    const list = source.slice(source.indexOf("export function CustomerVehiclesPage()"));
    assert.ok(!list.includes("statusFilter"), "old saved policy-status filters must not silently restrict vehicles");
    assert.ok(!list.includes("vehicleStatusLabel"));
    assert.ok(!list.includes("window.print()"), "print the filtered table, not the entire dashboard");
    for (const text of ["exportRows={filteredRows}", "snapshotExport", "actionRequest={exportAction}", 'columnSelectionId="vehicle-register"', "Εξαγωγή Excel", "Εξαγωγή PDF", "Στήλες εξαγωγής", 'api.get<VehicleRow[]>("/vehicles")', 'policyIds={selectedVehicle?.policyIds ?? []}']) assert.ok(list.includes(text), text);
    assert.ok(!list.includes("companyFilter"));
    assert.ok(!list.includes("renewalFilter"));
    assert.ok(!list.includes("totalPremium"));
    assert.ok(source.includes("vehicleStatusLabel(detail.status)"), "linked-policy tabs keep their own contract status");
    assert.ok(source.includes('value={form.condition}'), "actual vehicle condition is preserved");
  } finally { client.clear(); await server.close(); }
});
