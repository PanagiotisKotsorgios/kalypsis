import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

test("policy supplementary profile preserves compact controls and existing insurer data", async context => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { PolicyRiskFields, PolicyTaxFields, POLICY_RISK_FIELDS, policyPaymentStatus, PolicyBeneficiaries, readPolicyBeneficiaries } = await server.ssrLoadModule("/src/components/profile/PolicyRiskProfileFields.tsx");
    const { linkedVehicleSpecs } = await server.ssrLoadModule("/src/components/profile/vehicleProfile.ts");
    const { filterPolicyClaims } = await server.ssrLoadModule("/src/components/PolicyClaimsDialog.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    const session = values => ({ values, drafts: {}, editAll: false, busy: false, change() {}, commit: async () => {} });
    const ids = html => [...html.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]);
    await context.test("risk-specific fields preserve view/edit placement and responsive single/two-column CSS", () => {
      for (const type of ["Auto", "Home", "Business", "Health", "Life"]) {
        const fields = POLICY_RISK_FIELDS[type === "Business" ? "Home" : type === "Life" ? "Health" : type];
        const values = Object.fromEntries(fields.map(([key]) => ["risk:" + key, /smoker|alarm|securityDoor/.test(key) ? "false" : "Test"]));
        {
          const theme = createTheme({ breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } } });
          const render = editAll => renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(PolicyRiskFields, { policyType: type, values, session: { ...session(values), editAll } })));
          const view = render(false), edit = render(true);
          const expected = fields.map(([key]) => "risk:" + key);
          assert.deepEqual(ids(view), expected, type);
          assert.match(view, /@media\s*\(min-width:900px\)/);
          assert.deepEqual(ids(edit), expected);
          assert.ok(view.includes("Αντιγραφή " + fields[0][1]));
          assert.ok(edit.includes("Αποθήκευση " + fields[0][1]));
          if (type === "Auto") assert.ok(!view.includes("Ιατρικό ιστορικό"));
          if (type === "Health" || type === "Life") assert.ok(!view.includes("VIN"));
        }
      }
      assert.equal(renderToStaticMarkup(createElement(PolicyRiskFields, { policyType: "Travel", values: {} })), "");
    });
    await context.test("financial fields distinguish unknown totals, zero and recorded payment states", () => {
      assert.equal(policyPaymentStatus(100, 0, false), "Ανεξόφλητο");
      assert.equal(policyPaymentStatus(100, 30, false), "Μερικώς εξοφλημένο");
      assert.equal(policyPaymentStatus(100, 100, false), "Εξοφλημένο");
      assert.equal(policyPaymentStatus(0, 0, false), "Μηδενικό ασφάλιστρο");
      assert.match(policyPaymentStatus(100, 0, true), /δεν έχει επιβεβαιωθεί/);
      const values = { "risk:vatAmount": "0", "risk:otherChargesAmount": "12" };
      const html = renderToStaticMarkup(createElement(PolicyTaxFields, { values, session: session(values) }));
      assert.deepEqual(ids(html), ["risk:vatAmount", "risk:stampDutyAmount", "risk:insuranceContributionAmount", "risk:otherChargesAmount"]);
      assert.ok(!html.includes("<input"));
    });
    await context.test("beneficiaries are a compact table and retain unspecified percentages rather than guessing shares", () => {
      const rows = [{ id: "1", name: "Μαρία", relationship: "Σύζυγος", share: 60 }, { id: "2", name: "Νίκος", relationship: "Τέκνο", share: null }];
      assert.deepEqual(readPolicyBeneficiaries(JSON.stringify(rows)), rows);
      assert.deepEqual(readPolicyBeneficiaries("bad JSON"), []);
      const html = renderToStaticMarkup(createElement(PolicyBeneficiaries, { values: { "risk:beneficiaries": JSON.stringify(rows) } }));
      assert.ok(html.includes("<table")); assert.ok(html.includes("Μαρία")); assert.ok(html.includes("60%")); assert.ok(html.includes("Δεν έχει οριστεί"));
      assert.ok(!html.includes("Προσθήκη δικαιούχου"));
    });
    await context.test("vehicle linking copies technical fields but keeps the target's beneficiary, package and coverage terms", () => {
      const target = { vehicle: { make: "Old", model: "Old model", vin: "OLD" }, packageCode: "TARGET", _kalypsisPolicyProfile: { beneficiaries: "TARGET-PEOPLE", "coverDeductible:1": "100" }, keep: true };
      const source = { make: "Toyota", model: "Yaris", vin: "NEW", packageCode: "SOURCE", _kalypsisPolicyProfile: { beneficiaries: "OTHER-PEOPLE" }, vehicleOwnership: [{ name: "Owner", percentage: 100 }] };
      const result = JSON.parse(linkedVehicleSpecs(JSON.stringify(target), JSON.stringify(source)));
      assert.equal(result.vehicle.make, "Toyota"); assert.equal(result.vehicle.vin, "NEW");
      assert.equal(result.packageCode, "TARGET"); assert.deepEqual(result._kalypsisPolicyProfile, target._kalypsisPolicyProfile); assert.equal(result.keep, true);
      assert.ok(!result._kalypsisPolicyProfile.beneficiaries.includes("OTHER"));
      assert.throws(() => linkedVehicleSpecs("bad", JSON.stringify(source)));
    });
    await context.test("claims filter works on case-insensitive Greek names, dates and current status", () => {
      const rows = [{ id: "1", claimNumber: "CL-1", incidentDate: "2026-01-01", reportedDate: "2026-01-02", status: "Rejected" },
        { id: "2", claimNumber: "CL-2", incidentDate: "2026-02-01", reportedDate: "2026-02-02", status: "Approved" }];
      assert.deepEqual(filterPolicyClaims(rows, "απορρίφθηκε", ""), [rows[0]]);
      assert.deepEqual(filterPolicyClaims(rows, "2026-02", "Approved"), [rows[1]]);
      assert.deepEqual(filterPolicyClaims(rows, "02/02/2026", "Approved"), [rows[1]]);
      assert.deepEqual(filterPolicyClaims(rows, "CL-1", "Approved"), []);
    });
    await context.test("risk edits participate in existing draft acceptance and claims remain available from modal contracts", async () => {
      const source = await readFile(new URL("../PolicyDetailDrawer.tsx", import.meta.url), "utf8");
      for (const text of ["risk-profile", '<PolicyRiskFields', '<PolicyBeneficiaries', '<PolicyTaxFields', '<PolicyClaimsDialog', 'policyPaymentStatus(p.premium', 'coverDeductible:', 'accept(Object.keys(risk).map']) assert.ok(source.includes(text), text);
      assert.ok(source.includes('field={`risk:coverDeductible:${c.id}`}'));
      assert.ok(source.includes('Ημερομηνία καταχώρησης'));
      assert.ok(!source.includes('specsJson: source.specsJson ?? null'));
    });
  } finally { await server.close(); }
});
