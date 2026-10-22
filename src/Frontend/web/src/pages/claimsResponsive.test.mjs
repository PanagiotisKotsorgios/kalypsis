import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

test("all four claims lists use customer-table styling and compact green modal filters", async context => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  try {
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const definitions = [
      ["ClaimsPage", "Ζημιές", ["claims", ""], "CLAIM-0", { id: "0", claimNumber: "CLAIM-0", policyNumber: "POL-0", policyId: "P0", customerDisplay: "Πελάτης δοκιμής", customerId: "C0", policyType: "Auto", insuranceCompanyName: "Εταιρεία", insuranceCompanyId: null, incidentDate: "2026-10-01", reportedDate: "2026-10-02", status: "Reported", claimedAmount: 100, approvedAmount: 0, createdAt: "2026-10-01" }],
      ["GaragesPage", "Συνεργεία", ["garages"], "GARAGE-0", { id: "0", code: "GARAGE-0", name: "Συνεργείο δοκιμής", city: "Αθήνα", isApproved: true, isActive: true }],
      ["ClaimIndemnitiesPage", "Αποζημιώσεις", ["indemnities"], "PAYMENT-0", { id: "0", paymentNumber: "PAYMENT-0", claimNumber: "CLAIM-0", claimId: "0", paidOn: "2026-10-01", amount: 100, currency: "EUR", payeeType: "Customer", payeeName: "Δικαιούχος", paymentMethod: "Cash" }],
      ["FriendlySettlementsPage", "Φιλικοί διακανονισμοί", ["friendly-settlements"], "SETTLEMENT-0", { id: "0", settlementFileNumber: "SETTLEMENT-0", claimNumber: "CLAIM-0", claimId: "0", declarationDate: "2026-10-01", status: "Open", agreedAmount: 100, currency: "EUR", victimCount: 2 }],
    ];
    const pages = [];
    for (const [name, label, key, marker, record] of definitions) {
      const module = await server.ssrLoadModule(`/src/pages/${name}.tsx`);
      client.setQueryData(key, Array.from({ length: 55 }, (_, index) => Object.fromEntries(Object.entries(record).map(([field, value]) => [field, field === "id" ? String(index) : typeof value === "string" && /-0$/.test(value) ? value.slice(0, -1) + index : value]))));
      pages.push({ name, label, key, marker, Component: module[name] });
    }
    const render = (Component, width, mode = "light", inspectModals = false) => {
      const theme = createTheme({ palette: { mode }, components: { MuiDialog: { defaultProps: { keepMounted: inspectModals, disablePortal: inspectModals } }, MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: query => {
        const max = query.match(/max-width:\s*([\d.]+)px/), min = query.match(/min-width:\s*([\d.]+)px/);
        return { matches: (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])) };
      } } } } });
      return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ThemeProvider, { theme }, createElement(AuthProvider, null, createElement(MemoryRouter, null, createElement(Component))))));
    };
    await context.test("320–1366px: full filters no longer occupy the page, but saved filters, records and pagination remain", () => {
      for (const width of [320, 360, 768, 1024, 1366]) for (const page of pages) {
        const html = render(page.Component, width);
        for (const expected of ['aria-haspopup="dialog"', "#159B59", "#107B46", "color:#fff", "Αποθηκευμένα", page.marker, "data-claim-list-pagination", `data-claim-list-table="${page.label}"`]) assert.ok(html.includes(expected), `${page.name} ${width}: ${expected}`);
        assert.ok(!html.includes("data-claim-filter-fields"), `${page.name}: fields only in the opened modal`);
        const body = html.match(/<tbody\b[^>]*>[^]*?<\/tbody>/)?.[0] ?? "";
        assert.equal((body.match(/<tr\b/g) ?? []).length, 25, `${page.name}: pagination retained`);
      }
    });
    await context.test("large desktop layouts keep all inline fields with the same gray table palette and internal scrolling", () => {
      for (const width of [1536, 1920]) for (const page of pages) {
        const html = render(page.Component, width);
        assert.ok(html.includes("data-claim-filter-fields"), page.name);
        for (const expected of ["#F0F2F5", "#F8FAFC", "#E9EEF4", "#DFE5ED", "overflow:auto", "max-height:min(660px,65dvh)", "MuiTableCell-stickyHeader", "font-size:13px", page.marker]) assert.ok(html.includes(expected), `${page.name}: ${expected}`);
        assert.ok(html.indexOf("data-claim-list-pagination") > html.indexOf("</table>"), "pagination stays outside the scroll container");
        assert.ok(!html.includes(">Φίλτρα</button>"));
      }
    });
    await context.test("dark mode stays readable and empty queries retain their empty-state rows", () => {
      for (const page of pages) {
        assert.ok(render(page.Component, 1024, "dark").includes("#1B3046"), page.name);
        client.setQueryData(page.key, []);
        const empty = render(page.Component, 1920);
        assert.ok(!empty.includes(page.marker));
        assert.equal((empty.match(/<tbody\b[^>]*>[^]*?<\/tbody>/)?.[0].match(/<tr\b/g) ?? []).length, 1);
      }
    });
    await context.test("compact filter dialogs retain every existing basic and advanced filter", () => {
      const expected = {
        ClaimsPage: ["Πελάτης / συμβόλαιο / ΑΦΜ", "Συμβάν από", "Συμβάν έως", "Χρονικό διάστημα", "Εταιρία", "Κλάδος", "Χρήση οχήματος", "Κάλυψη", "Πακέτο"],
        GaragesPage: ["Έγκριση", "Κατάσταση", "Πόλη"],
        ClaimIndemnitiesPage: ["Τύπος δικαιούχου", "Μέθοδος", "Από", "Έως"],
        FriendlySettlementsPage: ["Κατάσταση", "Ασφαλιστική", "Από", "Έως"],
      };
      for (const page of pages) {
        const html = render(page.Component, 360, "light", true);
        for (const text of [...expected[page.name], "data-claim-filter-fields", "Κλείσιμο", "Προβολή αποτελεσμάτων"]) assert.ok(html.includes(text), `${page.name}: ${text}`);
      }
    });
    await context.test("existing filtering, saved-filter controls and action handlers are still wired", async () => {
      for (const page of pages) {
        const source = await readFile(new URL(`./${page.name}.tsx`, import.meta.url), "utf8");
        for (const expected of ["ClaimListFilters", "ClaimListTableFrame", "SavedReportsButton", "onLoad=", "onClear=", "saveRequestToken={saveFilterRequest}", "UnifiedActionsMenu", "onExport=", "onChange="]) assert.ok(source.includes(expected), `${page.name}: ${expected}`);
      }
      const shared = await readFile(new URL("../components/ClaimListLayout.tsx", import.meta.url), "utf8");
      assert.ok(shared.includes('theme.breakpoints.down("xl")'));
      assert.ok(shared.includes("customerTableSx(dark)")); assert.ok(shared.includes("CUSTOMER_TABLE_COLORS.even"));
      assert.ok(shared.includes("onClick={() => setOpen(true)}")); assert.ok(shared.includes("open={compact && open}"));
    });
  } finally { client.clear(); await server.close(); }
});
