import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile } from "node:fs/promises";

test("producer workspace keeps contact editing, red debts and filtered live statistics", async context => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const render = (Component, props) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Component, props)));
  try {
    const { ProducerDebtField, ProducerBalancesPanel, ProducerBalanceEntriesTable, producerMonthEntries, ProducerMonthBalance, producerMonthMovementBalance } = await server.ssrLoadModule("/src/components/ProducerBalancesPanel.tsx");
    const { ProducerContactFields, PRODUCER_CONTACT_FIELDS, producerContactError } = await server.ssrLoadModule("/src/components/ProducerContactFields.tsx");
    const { ProducerStatisticsDashboard, producerStatisticsParams, producerStatisticsCharts, producerStatisticsRefreshMs } = await server.ssrLoadModule("/src/components/ProducerStatisticsDialog.tsx");
    await context.test("positive debt has red value/copy controls with white foreground; zero is not falsely highlighted as debt", () => {
      const debt = render(ProducerDebtField, { value: 60, currency: "EUR" });
      assert.ok(debt.includes('data-producer-debt="outstanding"')); assert.ok(debt.includes("#D00000")); assert.ok(debt.includes("#fff"));
      assert.ok(debt.includes("60,00 EUR")); assert.ok(debt.includes("Αντιγραφή Οφειλή προς συνεργάτη"));
      assert.ok(!render(ProducerDebtField, { value: 0, currency: "EUR" }).includes("#D00000"));
    });
    await context.test("monthly commissions never carry forward and their footer reconciles all months beyond pagination", () => {
      const monthly = Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(12 - i).padStart(2, "0")}-01`, currency: "EUR", earned: 10, paid: 5, entryCount: 2 }));
      client.setQueryData(["producer-balances", "P1"], { producerId: "P1", currencies: [{ currency: "EUR", earned: 120, paid: 60, toProducer: 60, fromProducer: 0 }], monthly, entries: [] });
      const html = render(ProducerBalancesPanel, { producerId: "P1" });
      for (const text of ["ανά μήνα", "Προμήθειες συμβολαίων μήνα", "Καταβολές μέσα στον μήνα", "Υπόλοιπο κινήσεων μήνα", "Δεκέμβριος 2026", "120,00 EUR", "60,00 EUR", "Συνολικές προμήθειες", "Συνολικά καταβλήθηκαν"]) assert.ok(html.includes(text), text);
      assert.ok(!html.includes("Εκ μεταφοράς")); assert.ok(!html.includes("Υπόλοιπο τέλους μήνα"));
      assert.ok(html.indexOf("Σύνολα όλου του καταχωρημένου ιστορικού") > html.indexOf("</table>"));
      assert.ok(html.includes('aria-label="Κινήσεις Δεκέμβριος 2026 EUR"'));
      assert.ok(!html.includes("Αναζήτηση συμβολαίου ή πληρωμής")); assert.ok(html.includes("από 12"));
      const body = html.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0] ?? "";
      assert.equal((body.match(/<tr\b/g) ?? []).length, 10); assert.ok(html.includes("background-color:#f0f2f5"));
      const footer = html.match(/<tfoot\b[^>]*>[\s\S]*?<\/tfoot>/)?.[0] ?? "";
      assert.ok(footer.includes("120,00 EUR")); assert.ok(footer.includes("60,00 EUR"));
      for (const text of ["Τα σύνολα αθροίζουν", "Συνολικό υπόλοιπο =", "Οφειλές καταχωρημένων προμηθειών", "Το πιστωτικό από υπερπληρωμή", "Ανεξάρτητες προκαταβολές", "Κάθε μήνας δείχνει", "Οι καταβολές εμφανίζονται", "Υπόλοιπο κινήσεων μήνα ="]) assert.ok(!html.includes(text), text);
    });
    await context.test("monthly movement differences are red/white only when positive, never cumulative and tolerate older cached responses", () => {
      assert.equal(producerMonthMovementBalance({ earned: .3, paid: .1 }), .2);
      assert.equal(producerMonthMovementBalance({ earned: 46.50, paid: 0, balance: 46.50 }), 46.50);
      assert.equal(producerMonthMovementBalance({ earned: 80.85, paid: 80.85, balance: 0 }), 0);
      assert.equal(producerMonthMovementBalance({ earned: 0, paid: 20, balance: -20 }), -20);
      const positive = render(ProducerMonthBalance, { value: 46.50, currency: "EUR" });
      assert.ok(positive.includes('data-month-balance="positive"')); assert.ok(positive.includes("#D00000")); assert.ok(positive.includes("color:#fff")); assert.ok(positive.includes("46,50 EUR"));
      for (const value of [0, -20]) {
        const html = render(ProducerMonthBalance, { value, currency: "EUR" });
        assert.ok(!html.includes("#D00000")); assert.ok(html.includes(value < 0 ? 'data-month-balance="negative"' : 'data-month-balance="zero"'));
      }
    });
    await context.test("May/June/July remain 68.30/63.22/46.50 while the separate total debt is 178.02, not a sum of cumulative balances", () => {
      const monthly = [{ month: "2026-07-01", earned: 46.50, paid: 0 }, { month: "2026-06-01", earned: 63.22, paid: 0 },
        { month: "2026-05-01", earned: 68.30, paid: 0 }, { month: "2025-11-01", earned: 80.85, paid: 80.85 }].map(row => ({ ...row, currency: "EUR", entryCount: row.paid ? 2 : 1 }));
      client.setQueryData(["producer-balances", "SUMMER"], { producerId: "SUMMER", currencies: [{ currency: "EUR", earned: 258.87, paid: 80.85, toProducer: 178.02, fromProducer: 0 }], monthly, entries: [] });
      const html = render(ProducerBalancesPanel, { producerId: "SUMMER" });
      const body = html.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0] ?? "";
      for (const value of ["46,50 EUR", "63,22 EUR", "68,30 EUR", "80,85 EUR"]) assert.ok(body.includes(value), value);
      assert.ok(!body.includes("178,02 EUR")); assert.ok(!body.includes("131,52 EUR"));
      assert.equal((body.match(/<td\b/g) ?? []).length, 20, "four independent rows, five columns each");
      assert.equal((body.match(/data-month-balance="positive"/g) ?? []).length, 3);
      assert.equal((body.match(/data-month-balance="zero"/g) ?? []).length, 1);
      const summary = html.slice(html.indexOf("Σύνολα όλου του καταχωρημένου ιστορικού"));
      for (const value of ["258,87 EUR", "80,85 EUR", "178,02 EUR"]) assert.ok(summary.includes(value), value);
    });
    await context.test("monthly details retain every entry with pagination and isolate both month and currency", () => {
      const entries = Array.from({ length: 12 }, (_, i) => ({ id: String(i), date: "2026-01-15", kind: i % 2 ? "Payment" : "Commission", reference: `REF-${i}`, policyNumber: `POL-${i}`, earned: i % 2 ? 0 : 10, paid: i % 2 ? 5 : 0, currency: "EUR" }));
      const allEntries = [...entries, { ...entries[0], id: "USD", currency: "USD" }, { ...entries[0], id: "FEB", date: "2026-02-15" }];
      const original = structuredClone(allEntries);
      assert.deepEqual(producerMonthEntries(allEntries, { month: "2026-01-01", currency: "EUR" }), entries);
      assert.deepEqual(allEntries, original);
      const html = render(ProducerBalanceEntriesTable, { entries });
      for (const text of ["15/1/2026", "Προμήθεια", "Πληρωμή", "POL-0", "REF-1", "από 12"]) assert.ok(html.includes(text), text);
      assert.equal((html.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0].match(/<tr\b/g) ?? []).length, 10);
    });
    await context.test("empty financial history stays explicit and never invents a debt", () => {
      client.setQueryData(["producer-balances", "EMPTY"], { producerId: "EMPTY", currencies: [], entries: [], monthly: [] });
      const html = render(ProducerBalancesPanel, { producerId: "EMPTY" });
      assert.ok(html.includes("Δεν υπάρχουν καταχωρημένες κινήσεις")); assert.ok(!html.includes('data-producer-debt="outstanding"'));
    });
    await context.test("base and additional contact fields keep copy, pencil/save and parent-owned drafts", () => {
      const fields = [{ id: "field-1", label: "Γραμματεία", kind: "Email", value: "secretary@example.gr" }];
      const values = { email: "base@example.gr", phone: "2101234567", "contact:field-1": "secretary@example.gr" };
      const session = { values, drafts: {}, editAll: false, busy: false, dirty: false, change() {}, commit: async () => {} };
      const props = { producerId: "P1", values, session, fields, loading: false, retry() {} };
      const view = render(ProducerContactFields, props);
      for (const [key] of PRODUCER_CONTACT_FIELDS) assert.ok(view.includes(`data-profile-field="${key}"`));
      assert.ok(view.includes('data-profile-field="contact:field-1"')); assert.ok(view.includes("Προσθήκη πεδίου επικοινωνίας")); assert.ok(view.includes("Ιστορικό επικοινωνίας"));
      assert.ok(view.includes("Αντιγραφή Γραμματεία")); assert.ok(view.includes("Επεξεργασία Γραμματεία"));
      const edit = render(ProducerContactFields, { ...props, session: { ...session, editAll: true, drafts: { "contact:field-1": "new@example.gr" } } });
      assert.ok(edit.includes("Αποθήκευση Γραμματεία")); assert.ok(edit.includes('value="new@example.gr"'));
      const readOnly = render(ProducerContactFields, { ...props, session: undefined });
      assert.ok(!readOnly.includes("Προσθήκη πεδίου επικοινωνίας"));
      const editButton = [...readOnly.matchAll(/<button\b[^>]*>/g)].map(match => match[0]).find(button => button.includes('aria-label="Επεξεργασία Γραμματεία"'));
      assert.match(editButton, /\bdisabled/);
      assert.ok(producerContactError("Email", "bad email")); assert.ok(producerContactError("Phone", "abc")); assert.ok(producerContactError("Url", "javascript:alert(1)"));
      assert.equal(producerContactError("Phone", "2631028971"), undefined);
    });
    await context.test("all statistics filters participate in the request/cache identity and charts use the returned real data", () => {
      const filters = { from: "2026-01-01", to: "2026-02-28", dateField: "issued", insuranceCompanyId: "C1", policyType: "Auto", currency: "USD" };
      assert.deepEqual(producerStatisticsParams(filters), filters);
      assert.equal(producerStatisticsParams({ ...filters, currency: "", insuranceCompanyId: "", policyType: "" }).currency, undefined);
      assert.equal(producerStatisticsRefreshMs, 30_000);
      const data = { producerId: "P1", from: filters.from, to: filters.to, dateField: "issued", currency: "USD", currencies: ["USD"], carriers: [],
        totalPolicies: 3, activePolicies: 1, renewedPolicies: 1, cancelledPolicies: 1, customers: 1, claims: 2, premium: 300, netPremium: null, recordedCommissions: 45,
        monthly: [{ month: "2026-01", policies: 1, premium: 100, recordedCommissions: 15 }, { month: "2026-02", policies: 2, premium: 200, recordedCommissions: 30 }],
        byCarrier: [{ key: "C1", name: "Ασφαλιστική", policies: 3, premium: 300 }], byType: [{ key: "Auto", name: "Auto", policies: 3, premium: 300 }], byStatus: [{ key: "Active", name: "Active", policies: 3, premium: 300 }] };
      const original = structuredClone(data);
      const charts = producerStatisticsCharts(data);
      assert.equal(charts.monthly[0].name, "Ιαν 26"); assert.equal(charts.byType[0].name, "Αυτοκίνητο"); assert.equal(charts.byStatus[0].name, "Ενεργά"); assert.deepEqual(data, original);
      const html = render(ProducerStatisticsDashboard, { data });
      for (const label of ["300,00 USD", "45,00 USD", "Δεν έχει οριστεί", "Εξέλιξη παραγωγής", "Συμβόλαια ανά μήνα", "Παραγωγή ανά ασφαλιστική", "Συμβόλαια ανά κλάδο", "Κατάσταση συμβολαίων"]) assert.ok(html.includes(label), label);
      assert.ok(!html.includes("300,00 EUR"));
      const empty = render(ProducerStatisticsDashboard, { data: { ...data, totalPolicies: 0, premium: 0, monthly: [], byCarrier: [], byType: [], byStatus: [] } });
      assert.ok(empty.includes("Δεν υπάρχουν δεδομένα"));
    });
    await context.test("statistics are a footer button before edit, not a nav tab; contacts use persisted endpoints", async () => {
      const source = await readFile(new URL("../ProducerDetailDrawer.tsx", import.meta.url), "utf8");
      const nav = source.slice(source.indexOf("<DetailProfileTabs"), source.indexOf("<ProfileEditorFeedback"));
      assert.ok(nav.includes('label: "Παραγωγή"')); assert.ok(!nav.includes('label: "Στατιστικά"')); assert.ok(!source.includes('Παραγωγή & συμβόλαια'));
      const footer = source.slice(source.indexOf("<DialogActions"));
      assert.ok(footer.indexOf(">Στατιστικά</Button>") < footer.indexOf("<ProfileEditorActions"));
      assert.ok(source.includes('accept([key])')); assert.ok(source.includes('"contact:" + row.id')); assert.ok(source.includes('<ProducerContactFields'));
      const stats = await readFile(new URL("../ProducerStatisticsDialog.tsx", import.meta.url), "utf8");
      assert.ok(stats.includes('["producer-statistics", producerId, params]')); assert.ok(stats.includes('refetchInterval: open && valid ? producerStatisticsRefreshMs : false'));
    });
  } finally { client.clear(); await server.close(); }
});
