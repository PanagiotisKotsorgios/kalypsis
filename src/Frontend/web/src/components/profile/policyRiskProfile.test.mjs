import test from "node:test";
import assert from "node:assert/strict";
import { createElement, Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { policyPaymentStatus } from "./policyPaymentStatus.ts";

test("policy payment states distinguish zero, partial and recorded payments", () => {
  assert.equal(policyPaymentStatus(100, 0, false), "Ανεξόφλητο");
  assert.equal(policyPaymentStatus(100, 30, false), "Μερικώς εξοφλημένο");
  assert.equal(policyPaymentStatus(100, 100, false), "Εξοφλημένο");
  assert.equal(policyPaymentStatus(0, 0, false), "Μηδενικό ασφάλιστρο");
  assert.match(policyPaymentStatus(100, 0, true), /δεν έχει επιβεβαιωθεί/);
});

test("policy card removes obsolete sections without discarding stored data or lifecycle history", async () => {
  const source = await readFile(new URL("../PolicyDetailDrawer.tsx", import.meta.url), "utf8");
  for (const removed of ["PolicyRiskFields", "PolicyTaxFields", "PolicyBeneficiaries", "Στοιχεία ασφαλιζόμενου κινδύνου", "Δικαιούχοι αποζημίωσης", "Επικοινωνίες συμβολαίου", "policy-communications", "Αναλυτικές καλύψεις", "CoversBreakdown"]) assert.ok(!source.includes(removed), removed);
  assert.ok(source.includes('<PolicySummarySection title="Καλύψεις"><PolicyCoversTab'), "coverages remain in their dedicated section");
  for (const retained of ["risk-profile", "<PolicyClaimsDialog", "<PolicyLifecyclePanel", "policyPaymentStatus(p.premium", "accept(Object.keys(risk).map", "...policyPreservedAmounts(", "<PolicyCoverageTable", "renderDeductible="]) assert.ok(source.includes(retained), retained);
  for (const page of ["CreditNotesPage", "FriendlySettlementsPage"]) {
    const contents = await readFile(new URL(`../../pages/${page}.tsx`, import.meta.url), "utf8");
    assert.ok(!/label="ΦΠΑ/.test(contents));
  }
});

test("coverage table is compact, striped, internally scrollable and preserves real rows/actions", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { PolicyCoverageTable } = await server.ssrLoadModule("/src/components/PolicyCoverageTable.tsx");
    const { linkedVehicleSpecs } = await server.ssrLoadModule("/src/components/profile/vehicleProfile.ts");
    const { filterPolicyClaims } = await server.ssrLoadModule("/src/components/PolicyClaimsDialog.tsx");
    const rows = [{ id: "1", coverCode: "FIRE", coverName: "Πυρός", grossPremium: 10.5, netPremium: 8, coverageAmount: 20000, commissionPercent: 0, agencyCommissionPercent: null },
      { id: "2", coverCode: "THEFT", coverName: "Κλοπή & ολική καταστροφή", grossPremium: 20, netPremium: 16, coverageAmount: null, commissionPercent: 10, agencyCommissionPercent: 12 }];
    const events = [], props = { rows, currency: "EUR", editingId: "2", onEdit: row => events.push(["edit", row.id]), onDelete: row => events.push(["delete", row.id]) };
    const html = renderToStaticMarkup(createElement(PolicyCoverageTable, props));
    for (const text of ["#F0F2F5", "#F8FAFC", "#E9EEF4", "#DFE5ED", "overflow:auto", "max-height:380px", "MuiTableCell-stickyHeader", "Πυρός", "Κλοπή &amp; ολική καταστροφή", "20.000,00", "Επεξεργασία κάλυψης FIRE", "Διαγραφή κάλυψης THEFT"]) assert.ok(html.includes(text), text);
    for (const text of ["Μικτά", "Καθαρά", "Προμ. συν.", "Προμ. γρ.", "10,50", "30,50", "24,00", "0,00%", "<tfoot"]) assert.ok(!html.includes(text), `Removed financial column/value: ${text}`);
    assert.equal((html.match(/<thead[^]*?<\/thead>/)?.[0].match(/<th\b/g) ?? []).length, 4);
    assert.equal((html.match(/<tbody[^]*?<\/tbody>/)?.[0].match(/<tr\b/g) ?? []).length, 2);
    const nodes = [];
    const walk = node => Children.forEach(node, child => { if (isValidElement(child)) { nodes.push(child); walk(child.props.children); } });
    walk(PolicyCoverageTable(props));
    nodes.find(node => node.props["aria-label"] === "Επεξεργασία κάλυψης THEFT").props.onClick();
    nodes.find(node => node.props["aria-label"] === "Διαγραφή κάλυψης THEFT").props.onClick();
    assert.deepEqual(events, [["edit", "2"], ["delete", "2"]]);
    const readOnly = renderToStaticMarkup(createElement(PolicyCoverageTable, { ...props, readOnly: true }));
    assert.ok(!readOnly.includes("Επεξεργασία κάλυψης")); assert.ok(!readOnly.includes("Διαγραφή κάλυψης")); assert.ok(readOnly.includes("Πυρός"));
    const empty = renderToStaticMarkup(createElement(PolicyCoverageTable, { ...props, rows: [] }));
    assert.ok(empty.includes("Δεν υπάρχουν καταχωρημένες καλύψεις.")); assert.ok(!empty.includes("<tfoot"));
    const deductible = renderToStaticMarkup(createElement(PolicyCoverageTable, { ...props, renderDeductible: row => `Απαλλαγή ${row.id}` }));
    assert.ok(deductible.includes("Απαλλαγή 1")); assert.ok(deductible.includes("min-width:560px"));
    assert.equal((deductible.match(/<thead[^]*?<\/thead>/)?.[0].match(/<th\b/g) ?? []).length, 5);
    const manyRows = Array.from({ length: 60 }, (_, index) => ({ ...rows[index % 2], id: String(index), coverCode: `COVER-${index}` }));
    const longTable = renderToStaticMarkup(createElement(PolicyCoverageTable, { ...props, rows: manyRows }));
    assert.equal((longTable.match(/<tbody[^]*?<\/tbody>/)?.[0].match(/<tr\b/g) ?? []).length, 60);
    assert.ok(longTable.includes("COVER-59")); assert.ok(longTable.includes("overflow:auto"));
    const target = { vehicle: { make: "Old" }, packageCode: "TARGET", _kalypsisPolicyProfile: { beneficiaries: "TARGET-PEOPLE", "coverDeductible:1": "100" }, keep: true };
    const source = { make: "Toyota", vin: "NEW", packageCode: "SOURCE", _kalypsisPolicyProfile: { beneficiaries: "OTHER-PEOPLE" } };
    const linked = JSON.parse(linkedVehicleSpecs(JSON.stringify(target), JSON.stringify(source)));
    assert.equal(linked.vehicle.make, "Toyota"); assert.equal(linked.packageCode, "TARGET"); assert.deepEqual(linked._kalypsisPolicyProfile, target._kalypsisPolicyProfile);
    const claims = [{ id: "1", claimNumber: "CL-1", incidentDate: "2026-01-01", reportedDate: "2026-01-02", status: "Rejected" }];
    assert.deepEqual(filterPolicyClaims(claims, "απορρίφθηκε", ""), claims);
    assert.deepEqual(filterPolicyClaims(claims, "CL-1", "Approved"), []);
  } finally { await server.close(); }
});
