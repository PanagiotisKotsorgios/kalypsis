import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("the policy card shows office commission as income, separately from payment obligations", async t => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { PolicySettlementPanel } = await server.ssrLoadModule("/src/components/PolicyDetailDrawer.tsx");
    const policy = { premium: 100, totalReceived: 0, outstanding: 100, currency: "EUR",
      carrierDue: 100, carrierPaid: 0, carrierOutstanding: 100, producerDue: 10, producerPaid: 0, producerOutstanding: 10,
      agencyCommissionExpected: 16, agencyCommissionReceived: 0, agencyCommissionOutstanding: 16 };
    const render = (overrides = {}, readOnly = false) => renderToStaticMarkup(h(PolicySettlementPanel, {
      policy: { ...policy, ...overrides }, readOnly, onSettle() {}
    }));
    const income = html => html.slice(html.indexOf('data-commission-income="agency"'));
    await t.test("office income never has a due, paid or balance field, including stale cached balances", () => {
      const html = render({ totalReceived: 100, outstanding: 0, agencyCommissionReceived: 16 });
      const office = income(html);
      for (const label of ["Προμήθεια έδρας", "Προμήθεια συμβολαίου:", "Εισπραχθείσα προμήθεια:", "16,00 EUR"]) assert.ok(office.includes(label), label);
      for (const label of ["Υποχρέωση:", "Πληρωμένο:", "Υπόλοιπο:", "Αναμενόμενη προμήθεια έδρας", "#D00000"]) assert.ok(!office.includes(label), label);
      assert.equal((html.match(/data-settlement-obligation=/g) ?? []).length, 3);
    });
    await t.test("partial collection displays the received share without pretending it is a payment debt", () => {
      const html = render({ totalReceived: 50, outstanding: 50, agencyCommissionReceived: 8, agencyCommissionOutstanding: 8 });
      assert.ok(income(html).includes("8,00 EUR"));
      for (const label of ["Καταχώρηση είσπραξης", "Πληρωμή ασφαλιστικής", "Πληρωμή συνεργάτη"]) assert.ok(html.includes(label));
    });
    await t.test("read-only profiles retain income and amounts but never offer settlement actions", () => {
      const html = render({}, true);
      assert.ok(income(html).includes("0,00 EUR"));
      assert.ok(!html.includes("<button"));
    });
    await t.test("fully settled obligations hide their actions and leave office income visible", () => {
      const html = render({ outstanding: 0, carrierOutstanding: 0, producerOutstanding: 0, agencyCommissionReceived: 16 });
      assert.ok(!html.includes("<button"));
      assert.ok(income(html).includes("16,00 EUR"));
    });
    await t.test("direct carrier payment has no customer or insurer payable, including stale cached balances, and never fabricates office commission income", () => {
      const html = render({ paidDirectlyToCarrier: true });
      const customer = html.slice(html.indexOf('data-settlement-obligation="receipt"'), html.indexOf('data-settlement-obligation="carrierPayment"'));
      assert.ok(customer.includes("Πελάτης προς γραφείο"));
      assert.ok(!customer.includes("100,00 EUR"));
      assert.ok(!customer.includes("#D00000"));
      assert.ok(!html.includes("Καταχώρηση είσπραξης"));
      assert.ok(!html.includes("Πληρωμή ασφαλιστικής"));
      assert.ok(html.includes("Πληρωμή συνεργάτη"));
      const office = income(html);
      assert.ok(office.includes("Προμήθεια έδρας από ασφαλιστική"));
      assert.ok(office.includes("16,00 EUR"));
      assert.ok(office.includes("0,00 EUR"));
      assert.ok(html.includes("Δεν υπάρχει οφειλή πελάτη προς το γραφείο"));
    });
  } finally { await server.close(); }
});
