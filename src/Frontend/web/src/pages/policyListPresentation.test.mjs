import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { readFile } from "node:fs/promises";
import { buildTableExportSnapshot } from "../utils/tableExportSnapshot.ts";

test("policy table presentation, responsive filters and snapshot exports", async context => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { PoliciesPage, policyListRowSx, policyListExportColumns, filterPolicyListRows } = await server.ssrLoadModule("/src/pages/PoliciesPage.tsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const { UndoProvider } = await server.ssrLoadModule("/src/components/UndoToast.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    const { i18n } = await server.ssrLoadModule("/src/i18n/index.ts");
    await i18n.changeLanguage("el");
    const policy = { id: "p1", policyNumber: "POL-1", customerId: "c1", customerDisplay: "Μαρία Παπαδοπούλου", insuranceCompanyId: "child-a", insuranceCompanyName: "Εταιρεία Α", producerId: "producer-a", producerName: "Συνεργάτης Α", policyType: "Auto", status: "Active", paidDirectlyToCarrier: false, startDate: "2026-01-01", endDate: "2027-01-01", premium: 1234.56, currency: "EUR", createdAt: "2026-01-01T12:00:00Z" };
    const defaults = { carrierFilter: "", subCarrierFilter: [], producerFilter: "", dateFilterField: "start", fromDate: "", toDate: "", paymentRouteFilter: "", expiryWindow: "" };
    const carriers = [{ id: "broker", parentCompanyId: null }, { id: "child-a", parentCompanyId: "broker" }, { id: "child-b", parentCompanyId: "broker" }, { id: "outside", parentCompanyId: null }];

    await context.test("neutral zebra rows keep hover, selected rows and prospect highlights distinct", () => {
      assert.equal(policyListRowSx("Active", 0).bgcolor, "#f8fafc");
      assert.equal(policyListRowSx("Active", 1).bgcolor, "#f0f2f5");
      assert.equal(policyListRowSx("Active", 1)["&:hover"].bgcolor, "#e5edf7");
      assert.equal(policyListRowSx("Active", 1)["&.Mui-selected"].bgcolor, "#dcebfa");
      assert.equal(policyListRowSx("Prospect", 1).bgcolor, "#fff0d9");
    });

    await context.test("all client-side policy filters survive into the exported snapshot", () => {
      const rows = [policy, { ...policy, id: "wrong-partner", producerId: "producer-b" },
        { ...policy, id: "other-sub", insuranceCompanyId: "child-b" },
        { ...policy, id: "wrong-date", startDate: "2025-01-01" },
        { ...policy, id: "wrong-route", paidDirectlyToCarrier: true },
        { ...policy, id: "outside", insuranceCompanyId: "outside" }];
      const before = structuredClone(rows);
      const filters = { ...defaults, carrierFilter: "broker", subCarrierFilter: ["child-a"], producerFilter: "producer-a", fromDate: "2026-01-01", toDate: "2026-12-31", paymentRouteFilter: "office" };
      const filtered = filterPolicyListRows(rows, carriers, filters);
      assert.deepEqual(filtered, [policy]);
      assert.equal(filterPolicyListRows(rows, carriers, { ...defaults, carrierFilter: "broker" }).length, 5);
      const columns = policyListExportColumns(key => i18n.t(key));
      // Simulate the actual table's reordered, visible columns; hidden customer/producer columns stay out.
      const visibleKeys = ["number", "premium", "dates", "status", "type", "carrier"];
      const effective = visibleKeys.flatMap(key => columns.filter(column => column.key === key));
      const snapshot = buildTableExportSnapshot("Συμβόλαια", effective, filtered);
      assert.deepEqual(snapshot.headers, ["Αρ. Συμβολαίου", "Ασφάλιστρο", "Έναρξη → Λήξη", "Κατάσταση", "Κλάδος", "Ασφαλιστική"]);
      assert.equal(snapshot.rows.length, 1);
      assert.equal(snapshot.rows[0][0], "POL-1");
      assert.ok(snapshot.rows[0][1].includes("1.234,56"));
      assert.ok(snapshot.rows[0][2].includes("01/01/2026"));
      assert.ok(snapshot.rows[0][2].includes("01/01/2027"));
      assert.ok(!["Active", "Auto"].some(value => snapshot.rows[0].includes(value)));
      assert.ok(!JSON.stringify(snapshot).includes("producer-b"));
      assert.deepEqual(rows, before);
      assert.equal(filterPolicyListRows([{ ...policy, issuedAt: "2025-10-01" }], carriers, { ...defaults, dateFilterField: "issued", fromDate: "2026-01-01" }).length, 0);
      assert.equal(filterPolicyListRows([policy], carriers, { ...defaults, dateFilterField: "issued", fromDate: "2026-01-01", toDate: "2026-01-01" }).length, 1);
    });

    await context.test("export includes every matching record, not just the current 25-row page", () => {
      const filtered = Array.from({ length: 61 }, (_, i) => ({ ...policy, id: `p-${i}`, policyNumber: `POL-${i}`, premium: i }));
      const sorted = [...filtered].sort((a, b) => b.premium - a.premium);
      const snapshot = buildTableExportSnapshot("Συμβόλαια", policyListExportColumns(key => i18n.t(key)), sorted);
      assert.equal(snapshot.rows.length, 61);
      assert.equal(snapshot.rows[0][0], "POL-60");
      assert.equal(snapshot.rows[60][0], "POL-0");
      assert.deepEqual(buildTableExportSnapshot("Συμβόλαια", policyListExportColumns(key => i18n.t(key)), []).rows, []);
    });

    await context.test("actual policy page keeps its table visible while filters move behind a green mobile trigger", () => {
      const seeded = Array.from({ length: 61 }, (_, index) => ({ ...policy, id: `p-${index}`, policyNumber: `POL-${index}`, createdAt: new Date(Date.UTC(2026, 0, 1, 12, 0, index)).toISOString() }));
      client.setQueryData(["policies", ...Array(7).fill("")], seeded);
      client.setQueryData(["insurance-companies-for-filter-used"], []);
      client.setQueryData(["producers-for-filter"], []);
      for (const width of [360, 768, 1024, 1280, 1536, 1920]) {
        const theme = createTheme({ components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: query => {
          const max = query.match(/max-width:\s*([\d.]+)px/), min = query.match(/min-width:\s*([\d.]+)px/);
          return { matches: (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])) };
        } } } } });
        const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, createElement(MemoryRouter, null, createElement(UndoProvider, null, createElement(PoliciesPage)))))));
        const body = html.match(/<tbody\b[\s\S]*?<\/tbody>/)?.[0] ?? "";
        assert.equal((body.match(/<tr\b/g) ?? []).length, 25);
        assert.ok(body.indexOf("POL-60") < body.indexOf("POL-59"));
        assert.ok(html.includes("background-color:#f0f2f5"));
        assert.ok(html.includes("61 εγγραφές"));
        const trigger = html.match(/<button\b[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?<\/button>/)?.[0];
        if (width < 1536) {
          assert.ok(trigger?.includes("Φίλτρα"), `${width}px`);
          assert.ok(html.includes("background-color:#159b59"));
          assert.ok(!html.includes("Αναζήτηση συμβολαίων"));
        } else {
          assert.equal(trigger, undefined);
          assert.ok(html.includes("Αναζήτηση συμβολαίων"));
        }
      }
    });

    await context.test("all formats share the filtered/ordered visible table and do not re-export on data reload", async () => {
      const source = await readFile(new URL("./PoliciesPage.tsx", import.meta.url), "utf8");
      for (const value of ["snapshotExport", "exportRows={table.filtered}", "visibleColumnKeys={visiblePolicyColumnKeys}", 'columnSelectionId="policy-register"', 'printTitle="Συμβόλαια"', "exportColumns={policyListExportColumns(t)}"]) assert.ok(source.includes(value), value);
      assert.ok(!source.includes('serverEntity="policies"'));
      assert.ok(!source.includes("serverParams="));
      assert.ok(source.indexOf("<TableToolbar<PolicyDto>") < source.indexOf('{activeView === "delivery" ? ('));
      assert.ok(source.indexOf("<TableToolbar<PolicyDto>") < source.indexOf("{policiesQuery.isLoading ? ("));
      assert.equal((source.match(/<SavedReportsButton/g) ?? []).length, 1, "one persistent saved-filter selector");
      assert.ok(source.includes("{renderPrimaryFilters(true)}"), "date/search controls also exist inside the compact modal");
    });
  } finally { client.clear(); await server.close(); }
});
