import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

test("partner-related list layouts use compact filters at narrow widths and retain readable desktop forms", async context => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  try {
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material");
    const { PartnerNetworksPage } = await server.ssrLoadModule("/src/pages/PartnerNetworksPage.tsx");
    const { OverCommissionStatementsPage } = await server.ssrLoadModule("/src/pages/OverCommissionStatementsPage.tsx");
    const { ProducerBalancesPanel } = await server.ssrLoadModule("/src/components/ProducerBalancesPanel.tsx");
    const render = (Component, width, props = {}) => {
      const theme = createTheme({ components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: query => {
        const max = query.match(/max-width:\s*([\d.]+)px/); const min = query.match(/min-width:\s*([\d.]+)px/);
        return { matches: (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])) };
      } } } } });
      return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ThemeProvider, { theme }, createElement(MemoryRouter, {}, createElement(Component, props)))));
    };
    const now = new Date();
    client.setQueryData(["partner-networks", "", "all", "all"], [{ id: "N1", code: "NET1", name: "Δίκτυο δοκιμής", networkType: "Δίκτυο συνεργατών", status: "Ενεργό", memberCount: 4, activeMemberCount: 3, policyCount: 15, grossPremium: 1200, producerCommission: 100, officeCommission: 50 }]);
    client.setQueryData(["over-commission-statements", now.getFullYear(), now.getMonth() + 1, "", "", ""], [{ id: "S1", insuranceCompanyName: "Ασφαλιστική", producerName: "Συνεργάτης", producerCode: "P1", year: now.getFullYear(), month: now.getMonth() + 1, grossAmount: 40, netAmount: 40, producerSharePercent: 50, producerAmount: 20, officeAmount: 20, currency: "EUR", paidOn: null }]);
    await context.test("320, 360, 768 and 1024px layouts replace the full filters with green/white buttons while retaining table records", () => {
      for (const width of [320, 360, 768, 1024]) {
        const network = render(PartnerNetworksPage, width);
        assert.ok(network.includes("Φίλτρα δικτύων"), String(width));
        assert.ok(network.includes('aria-haspopup="dialog"')); assert.ok(network.includes("#159B59")); assert.ok(network.includes("color:#fff"));
        assert.ok(!network.includes("Αναζήτηση κωδικού, δικτύου")); assert.ok(network.includes("Δίκτυο δοκιμής")); assert.ok(network.includes("Ενέργειες"));
        const statement = render(OverCommissionStatementsPage, width);
        assert.ok(statement.includes("Φίλτρα υπερπρομηθειών")); assert.ok(statement.includes("#159B59"));
        assert.ok(!statement.includes('placeholder="όνομα / κωδικός / reference"')); assert.ok(statement.includes("20,00"));
        assert.ok(statement.includes("Αποθηκευμένα"), "saved filters stay mounted outside the closed filter drawer");
      }
    });
    await context.test("1920px layouts retain full filter fields without an extra compact trigger", () => {
      const network = render(PartnerNetworksPage, 1920);
      assert.ok(network.includes("Αναζήτηση κωδικού, δικτύου")); assert.ok(!network.includes(">Φίλτρα δικτύων<"));
      const statement = render(OverCommissionStatementsPage, 1920);
      assert.ok(statement.includes('placeholder="όνομα / κωδικός / reference"')); assert.ok(!statement.includes(">Φίλτρα υπερπρομηθειών<"));
      const laptop = render(OverCommissionStatementsPage, 1366);
      assert.ok(laptop.includes("Φίλτρα υπερπρομηθειών")); assert.ok(!laptop.includes('placeholder="όνομα / κωδικός / reference"'));
    });
    await context.test("monthly commissions keep compact independent amounts and green/white movement buttons", () => {
      client.setQueryData(["producer-balances", "P1"], { currencies: [{ currency: "EUR", earned: 100, paid: 40, toProducer: 60, fromProducer: 0 }], entries: [],
        monthly: [{ month: "2026-10-01", currency: "EUR", earned: 100, paid: 40, entryCount: 2 }] });
      const html = render(ProducerBalancesPanel, 1024, { producerId: "P1" });
      assert.ok(html.includes("2 κινήσεις")); assert.ok(html.includes("#159B59")); assert.ok(html.includes("#107B46"));
      assert.ok(html.includes("100,00 EUR")); assert.ok(!html.includes("Εκ μεταφοράς")); assert.ok(html.includes("padding-top:3.6px"));
    });
    await context.test("network tables scroll internally and detail dialogs wrap long content, tabs, member actions and statistics", async () => {
      const source = await readFile(new URL("./PartnerNetworksPage.tsx", import.meta.url), "utf8");
      for (const expected of ['overflowX: "auto"', 'width: { xs: "calc(100% - 16px)"', 'overflowWrap: "anywhere"', 'allowScrollButtonsMobile', 'repeat(2, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))', 'flex: "1 1 160px"']) assert.ok(source.includes(expected), expected);
      assert.ok(source.includes('onClick={clearFilters}')); assert.ok(source.includes('setStatus(e.target.value)')); assert.ok(source.includes('setType(e.target.value)'));
    });
  } finally { client.clear(); await server.close(); }
});
