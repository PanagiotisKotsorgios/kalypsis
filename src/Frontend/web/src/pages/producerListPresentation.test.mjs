import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { readFile } from "node:fs/promises";
import { buildTableExportSnapshot } from "../utils/tableExportSnapshot.ts";
import { printTable } from "../utils/printableTable.ts";

test("producer list shares the compact gray table, responsive filters and exact-table exports", async context => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { ProducersPage, producerListRowSx, producerListExportColumns, filterProducerListRows } = await server.ssrLoadModule("/src/pages/ProducersPage.tsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    const { i18n } = await server.ssrLoadModule("/src/i18n/index.ts");
    await i18n.changeLanguage("el");
    const producer = { id: "p1", code: "P-0001", name: "Μαρία Παπαδοπούλου", email: "maria@example.gr", phone: "2101234567", status: "Active", tier: "A", hierarchyLevel: "Producer", policyCount: 3, createdAt: "2026-01-01", parentProducerId: null, parentProducerName: null };
    const defaults = { statusFilter: "", tierFilter: "", hierarchyFilter: "", hasPoliciesOnly: false };

    await context.test("zebra striping, hover and selected colors match policies while prospects remain orange", () => {
      assert.equal(producerListRowSx("Active", 0).bgcolor, "#f8fafc");
      assert.equal(producerListRowSx("Active", 1).bgcolor, "#f0f2f5");
      assert.equal(producerListRowSx("Active", 1)["&:hover"].bgcolor, "#e5edf7");
      assert.equal(producerListRowSx("Active", 1)["&.Mui-selected"].bgcolor, "#dcebfa");
      assert.equal(producerListRowSx("Prospect", 1).bgcolor, "#fff0d9");
    });

    await context.test("filter combinations export only matching partners with readable Greek labels", () => {
      const rows = [producer, { ...producer, id: "other-status", status: "Suspended" },
        { ...producer, id: "other-tier", tier: "B" }, { ...producer, id: "no-policies", policyCount: 0 },
        { ...producer, id: "manager", hierarchyLevel: "Manager" }];
      const before = structuredClone(rows);
      const filtered = filterProducerListRows(rows, { statusFilter: "Active", tierFilter: "A", hierarchyFilter: "Producer", hasPoliciesOnly: true });
      assert.deepEqual(filtered, [producer]);
      assert.deepEqual(filterProducerListRows(rows, defaults), rows);
      const columns = producerListExportColumns(key => i18n.t(key));
      assert.deepEqual(columns.map(column => column.key), ["code", "name", "tier", "email", "phone", "policyCount", "status"]);
      const snapshot = buildTableExportSnapshot("Συνεργάτες", columns, filtered);
      assert.equal(snapshot.rows.length, 1);
      assert.equal(snapshot.rows[0][0], "P-0001");
      assert.equal(snapshot.rows[0][2], "Κατ. Α");
      assert.equal(snapshot.rows[0][5], "3");
      assert.ok(snapshot.rows[0][6] !== "Active");
      assert.deepEqual(rows, before);
      const empty = buildTableExportSnapshot("Συνεργάτες", columns, filterProducerListRows(rows, { ...defaults, tierFilter: "E" }));
      assert.deepEqual(empty.rows, []);
      const unknown = buildTableExportSnapshot("Συνεργάτες", columns, [{ ...producer, email: null, phone: null, tier: "None", policyCount: 0, status: "Prospect" }]);
      assert.deepEqual(unknown.rows[0].slice(2), ["—", "—", "—", "0", "Πιθανός συνεργάτης"]);
    });

    await context.test("CSV/Excel/PDF/print snapshot retains sorted records beyond the current page and selected column order", () => {
      const rows = Array.from({ length: 61 }, (_, i) => ({ ...producer, id: `p-${i}`, code: `P-${i}`, policyCount: i }));
      const sorted = [...rows].sort((a, b) => b.policyCount - a.policyCount);
      const allColumns = producerListExportColumns(key => i18n.t(key));
      const selected = ["code", "policyCount", "name"].flatMap(key => allColumns.filter(column => column.key === key));
      const snapshot = buildTableExportSnapshot("Συνεργάτες", selected, sorted);
      assert.equal(snapshot.rows.length, 61);
      assert.deepEqual(snapshot.rows[0], ["P-60", "60", producer.name]);
      assert.deepEqual(snapshot.rows[60], ["P-0", "0", producer.name]);
      assert.equal(snapshot.headers.length, 3);
      assert.ok(!snapshot.headers.includes("Email"));
    });

    await context.test("partner print document keeps the complete sorted table, selected columns and office heading", () => {
      const previousDocument = globalThis.document;
      const events = new Map();
      let frame, printCount = 0;
      globalThis.document = {
        createElement: () => (frame = { style: {}, setAttribute() {}, addEventListener: (name, handler) => events.set(name, handler),
          contentWindow: { document: { body: { children: [{}] } }, focus() {}, addEventListener() {}, print() { printCount++; } } }),
        body: { appendChild(value) { assert.equal(value, frame); } },
      };
      try {
        const rows = Array.from({ length: 61 }, (_, i) => ({ ...producer, code: `P-${i}`, policyCount: i }))
          .sort((a, b) => b.policyCount - a.policyCount);
        const columns = producerListExportColumns(key => i18n.t(key)).filter(column => ["code", "name", "policyCount"].includes(column.key));
        printTable({ title: "Γραφείο Πατρών", subtitle: "Συνεργάτες · Κατηγορία: Α", columns, rows,
          office: { name: null, code: "PATRA", address: "Κορίνθου 10, Πάτρα", email: "patra@example.gr" } });
        const html = frame.srcdoc;
        assert.ok(html.includes("Γραφείο Πατρών"));
        assert.ok(html.includes("patra@example.gr"));
        assert.ok(html.includes("Συνεργάτες · Κατηγορία: Α"));
        const body = html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? "";
        assert.equal((body.match(/<tr\b/g) ?? []).length, 61);
        assert.ok(body.indexOf("P-60") < body.indexOf("P-0"));
        assert.ok(!body.includes("maria@example.gr"));
        assert.ok(body.includes(producer.name));
        assert.ok(html.includes("Kalypsis"));
        events.get("load")();
        events.get("load")();
        assert.equal(printCount, 1);
      } finally { globalThis.document = previousDocument; }
    });

    await context.test("actual partner page keeps 25 rows visible and moves filters into a green compact-screen popup", () => {
      client.setQueryData(["producers"], Array.from({ length: 61 }, (_, index) => ({ ...producer, id: `p-${index}`, code: `P-${index}`, status: index === 0 ? "Prospect" : "Active" })));
      for (const width of [360, 768, 1024, 1280, 1536, 1920]) {
        const theme = createTheme({ components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: query => {
          const max = query.match(/max-width:\s*([\d.]+)px/), min = query.match(/min-width:\s*([\d.]+)px/);
          return { matches: (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])) };
        } } } } });
        const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, createElement(MemoryRouter, null, createElement(ProducersPage))))));
        const body = html.match(/<tbody\b[\s\S]*?<\/tbody>/)?.[0] ?? "";
        assert.equal((body.match(/<tr\b/g) ?? []).length, 25);
        assert.ok(body.includes("Μαρία Παπαδοπούλου"));
        assert.ok(html.includes("61 εγγραφές"));
        for (const color of ["#f0f2f5", "#fff0d9", "#e9eef4"]) assert.ok(html.includes(`background-color:${color}`), color);
        const trigger = html.match(/<button\b[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?<\/button>/)?.[0];
        if (width < 1536) {
          assert.ok(trigger?.includes("Φίλτρα"), `${width}px`);
          assert.ok(html.includes("background-color:#159b59"));
          assert.ok(!html.includes("Αναζήτηση συνεργάτη"));
        } else {
          assert.equal(trigger, undefined);
          assert.ok(html.includes("Αναζήτηση συνεργάτη"));
          assert.ok(html.includes("Επίπεδο ιεραρχίας"));
        }
      }
    });

    await context.test("exports are snapshot-driven and remain mounted while results reload", async () => {
      const source = await readFile(new URL("./ProducersPage.tsx", import.meta.url), "utf8");
      for (const value of ["snapshotExport", "exportRows={table.filtered}", "exportColumns={producerExportColumns}", 'printTitle="Συνεργάτες"', "visibleColumnKeys={producerExportColumns.map(column => column.key)}", "{renderProducerFilters(true)}"]) assert.ok(source.includes(value), value);
      assert.ok(!source.includes('serverEntity="producers"'));
      assert.ok(!source.includes("serverParams="));
      assert.ok(source.includes('printOfficeSource="export"'));
      const toolbarSource = await readFile(new URL("../components/TableToolbar.tsx", import.meta.url), "utf8");
      assert.ok(toolbarSource.includes('"/table-exports/office"'));
      assert.ok(toolbarSource.includes('officeQuery.refetch({ throwOnError: true })'));
      assert.ok(source.indexOf("<TableToolbar<ProducerDto>") < source.indexOf("{q.isLoading ?"));
      assert.equal((source.match(/<SavedReportsButton/g) ?? []).length, 1);
    });
  } finally { client.clear(); await server.close(); }
});
