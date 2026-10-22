import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile } from "node:fs/promises";
import { defaultGrowthFilters, filterGrowthRows, normalizeGrowthFilters, growthGroupLabel } from "./productionGrowth.ts";
import { buildTableExportSnapshot } from "../utils/tableExportSnapshot.ts";

const home = {
  id: "home", needId: "home", customerId: "1", customerNumber: "C-1", customerName: "Μαρία Παπαδοπούλου", customerType: "Individual", customerStatus: "Active",
  city: "Αθήνα", occupation: "Υπάλληλος", email: "test@example.gr", phone: "2101234567", needKind: "Home", needTitle: "Εξοχικό", hasAsset: true,
  isInsured: false, priority: 5, nextContactAt: "2026-10-22", notes: "Επανεπικοινωνία", isOpportunity: true, coverageState: "Uncovered",
  reason: "Καταχωρημένη ανάγκη χωρίς κάλυψη", assetKinds: ["Home", "Vehicle"], activePolicyTypes: ["Auto"], activePolicyCount: 1,
  producers: [{ id: "p1", name: "Συνεργάτης Α" }], family: [{ customerId: "2", name: "Νίκος", relationship: "Child" }],
};
const health = { ...home, id: "health", needId: "health", customerId: "2", customerName: "Νίκος", city: "Πάτρα", needKind: "Health", needTitle: "Υγεία", coverageState: "DeclaredInsured", isInsured: true, isOpportunity: false, priority: 3, nextContactAt: null, producers: [{ id: "p2", name: "Συνεργάτης Β" }], assetKinds: ["Health"], activePolicyTypes: [], family: [] };
const unknown = { ...health, id: "unknown", customerId: "3", needId: null, needKind: null, needTitle: "Δεν έχουν καταχωρηθεί ανάγκες", hasAsset: null, isInsured: null, coverageState: "Unknown", priority: 0 };
const rows = [home, health, unknown];
const filters = overrides => ({ ...defaultGrowthFilters(), ...overrides });

test("default list shows actual opportunities; all-data view preserves insured and unknown clients", () => {
  assert.deepEqual(filterGrowthRows(rows, filters()), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ view: "all" })), rows);
  assert.deepEqual(filterGrowthRows(rows, filters({ view: "all", coverageStates: ["Unknown"] })), [unknown]);
});
test("multi-selection uses OR per field and AND across needs, assets, active policies and partners", () => {
  assert.deepEqual(filterGrowthRows(rows, filters({ kinds: ["Life", "Home"], assetKinds: ["Vehicle"], activePolicyTypes: ["Auto"], producerIds: ["p2", "p1"] })), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ kinds: ["Home"], activePolicyTypes: ["Health"] })), []);
  assert.deepEqual(filterGrowthRows(rows, filters({ view: "all", cities: ["Πάτρα", "Αθήνα"], customerStatuses: ["Active"] })), rows);
  assert.deepEqual(filterGrowthRows(rows, filters({ search: "παπαδοπουλου" })), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ search: "Νίκος" })), [home]);
});
test("follow-up dates, priority and family filters combine without changing stored data", () => {
  const before = structuredClone(rows);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactFrom: "2026-10-22", contactTo: "2026-10-22", priorityMin: "5", family: "with" })), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactState: "due" }), "2026-10-22"), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactState: "future" }), "2026-10-21"), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactState: "unscheduled" })), []);
  assert.deepEqual(filterGrowthRows(rows, filters({ family: "without" })), []);
  assert.deepEqual(rows, before);
});
test("saved filters retain multiple values and dates, reject malformed values, and support Greek grouping", () => {
  const saved = normalizeGrowthFilters({ kinds: ["Home", "Home", "Vehicle"], cities: ["Αθήνα"], contactFrom: "2026-10-01", view: "all", groupBy: "kind" });
  assert.deepEqual(saved.kinds, ["Home", "Vehicle"]);
  assert.equal(saved.contactFrom, "2026-10-01");
  assert.equal(saved.view, "all");
  assert.deepEqual(normalizeGrowthFilters({ kinds: "Home", view: "invalid", groupBy: "invalid" }), defaultGrowthFilters());
  assert.equal(growthGroupLabel(home, "kind"), "Κατοικία");
  assert.equal(growthGroupLabel(home, "producer"), "Συνεργάτης Α");
  assert.equal(growthGroupLabel(unknown, "kind"), "Χωρίς καταχωρημένες ανάγκες");
});
test("growth export keeps only matching clients and current grouping, not the source data or current page", () => {
  const selected = filters({ view: "all", cities: ["Αθήνα"], groupBy: "producer" });
  const filtered = filterGrowthRows(rows, selected);
  const snapshot = buildTableExportSnapshot("Λίστες αύξησης παραγωγής", [{ key: "customerName", label: "Πελάτης" }, { key: "needTitle", label: "Ανάγκη" }], filtered, undefined, row => growthGroupLabel(row, selected.groupBy));
  assert.deepEqual(snapshot.headers, ["Πελάτης", "Ανάγκη"]);
  assert.deepEqual(snapshot.rows, [["ΟΜΑΔΑ: Συνεργάτης Α · 1 εγγραφές", ""], ["Μαρία Παπαδοπούλου", "Εξοχικό"]]);
  assert.equal(snapshot.recordCount, 1);
  assert.ok(!JSON.stringify(snapshot).includes("Πάτρα"));
});
test("route and office-managed sidebar entry exist once per staff role, after production lists for admins", async () => {
  const source = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const admin = source.slice(source.indexOf("  AgencyAdmin: ["), source.indexOf("  AgencyUser: ["));
  assert.match(admin, /to: "\/production-lists"[^\n]+\n\s*\{ to: "\/production-growth"/);
  assert.equal((source.match(/to: "\/production-growth"/g) ?? []).length, 3);
  assert.match(source, /path="production-growth" element=\{<PackageGate package="BackOffice"><ProductionGrowthPage/);
  const sidebar = await readFile(new URL("../config/sidebarVisibility.ts", import.meta.url), "utf8");
  assert.equal((sidebar.match(/path: "\/production-growth"/g) ?? []).length, 1);
});
test("actual page renders compact paginated rows and exports the complete filtered result", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { ProductionGrowthPage } = await server.ssrLoadModule("/src/pages/ProductionGrowthPage.tsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    await server.ssrLoadModule("/src/i18n/index.ts");
    client.setQueryData(["production-growth"], Array.from({ length: 82 }, (_, i) => ({ ...home, id: `need-${i}`, needId: `need-${i}`, customerId: `customer-${i}`, customerName: `Πελάτης ${i}` })));
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, createElement(ProductionGrowthPage))));
    const body = html.match(/<tbody\b[\s\S]*?<\/tbody>/)?.[0] ?? "";
    assert.equal((body.match(/<tr\b/g) ?? []).length, 25);
    for (const text of ["82 εγγραφές", "Εξοχικό", "Προτεινόμενη κάλυψη", "overflow:auto"]) assert.ok(html.includes(text), text);
    assert.ok(body.includes("Καρτέλα"));
    const source = await readFile(new URL("./ProductionGrowthPage.tsx", import.meta.url), "utf8");
    for (const text of ["exportRows={displayRows}", "snapshotExport", 'compactAt="xl"', "normalizeGrowthFilters(value)"]) assert.ok(source.includes(text), text);
    assert.ok(source.includes("exportGroupBy={filters.groupBy ? row => growthGroupLabel(row, filters.groupBy) : undefined}"));
    assert.ok(source.includes("visibleColumnKeys={columns.visibleColumns.map(c => c.key)}"));
    assert.ok(!source.includes("estimatedCommission"));
  } finally { client.clear(); await server.close(); }
});
