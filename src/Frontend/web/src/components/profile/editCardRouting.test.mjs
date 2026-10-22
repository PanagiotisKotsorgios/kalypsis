import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile } from "node:fs/promises";

test("list edit actions use the same record cards and existing save pipelines", async context => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  try {
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const { PolicyDetailDrawer } = await server.ssrLoadModule("/src/components/PolicyDetailDrawer.tsx");
    const { ProducerDetailDrawer } = await server.ssrLoadModule("/src/components/ProducerDetailDrawer.tsx");
    const { ClaimDetailDrawer } = await server.ssrLoadModule("/src/components/ClaimDetailDrawer.tsx");
    const { ClaimSupportDetailDialog, ClaimSupportFields } = await server.ssrLoadModule("/src/components/ClaimSupportDetailDialog.tsx");
    const { CLAIM_SUPPORT_SECTIONS, claimSupportUpdate } = await server.ssrLoadModule("/src/components/profile/claimSupportProfile.ts");
    const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } }, MuiModal: { defaultProps: { disablePortal: true } }, MuiDrawer: { defaultProps: { ModalProps: { disablePortal: true } } } } });
    const render = (Component, props) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ThemeProvider, { theme }, createElement(AuthProvider, null, createElement(Component, props)))));
    const policy = { id: "POL1", policyNumber: "POL1", customerId: "C1", customerDisplay: "Πελάτης", producerId: null, insuranceCompanyId: "INS1", insuranceCompanyName: "Εταιρεία", policyType: "Auto", status: "Active", startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "2026-01-01T00:00:00Z", premium: 100, currency: "EUR", totalReceived: 0, outstanding: 100, covers: [], claimCount: 0, paymentFrequency: "Annual" };
    const producer = { id: "P1", code: "P1", name: "Συνεργάτης", status: "Active", performanceGrade: "A", byCarrier: [], byPolicyType: [] };
    const claim = { id: "CL1", claimNumber: "CL1", policyId: "POL1", policyNumber: "POL1", customerDisplay: "Πελάτης", incidentDate: "2026-01-01", reportedDate: "2026-01-02", status: "Reported", claimedAmount: 100, approvedAmount: 0, description: "Περιγραφή" };
    client.setQueryData(["policy-detail", "POL1"], policy);
    client.setQueryData(["producer-detail", "P1"], producer);
    await context.test("policy, producer and claim cards open directly with enabled fields and Save All, without replacing their layouts", () => {
      for (const [Component, props, editable] of [
        [PolicyDetailDrawer, { policyId: "POL1", open: true, presentation: "modal", onClose() {} }, { readOnly: false }],
        [ProducerDetailDrawer, { producerId: "P1", open: true, onClose() {} }, { canEdit: true }],
        [ClaimDetailDrawer, { claim, open: true, onClose() {} }, { canEdit: true }],
      ]) {
        const view = render(Component, { ...props, ...editable });
        const edit = render(Component, { ...props, ...editable, initialEditing: true });
        assert.ok(view.includes("Επεξεργασία")); assert.ok(!view.includes("Αποθήκευση επεξεργασίας"));
        assert.ok(edit.includes("Αποθήκευση επεξεργασίας"), Component.name); assert.ok(edit.includes("<input"), `${Component.name}: ${[...edit.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]).join(", ")}`);
        const fields = html => [...html.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]);
        assert.deepEqual(fields(edit), fields(view));
        assert.ok(fields(edit).length >= 6);
        const readOnly = render(Component, { ...props, initialEditing: true, readOnly: true, canEdit: false });
        assert.ok(!readOnly.includes("Αποθήκευση επεξεργασίας"));
      }
    });
    await context.test("support cards retain every field across view and edit; indemnities do not offer unsupported editing", () => {
      for (const kind of ["garages", "friendly-settlements", "indemnities"]) {
        for (let section = 0; section < CLAIM_SUPPORT_SECTIONS[kind].length; section++) {
          const fields = CLAIM_SUPPORT_SECTIONS[kind][section].fields;
          const values = Object.fromEntries(fields.map(field => [field.key, field.type === "number" ? "0" : field.type === "date" ? "2026-10-01" : field.options?.[0].value ?? "Test"]));
          const session = { values, drafts: {}, editAll: false, busy: false, dirty: false, change() {}, commit: async () => {} };
          const view = render(ClaimSupportFields, { kind, section, values, session });
          const edit = render(ClaimSupportFields, { kind, section, values, session: { ...session, editAll: true } });
          const ids = html => [...html.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]);
          assert.deepEqual(ids(view), ids(edit)); assert.equal(ids(view).length, fields.length);
          for (const field of fields.filter(field => !field.readonly)) assert.ok(edit.includes("Αποθήκευση " + field.label));
        }
      }
      const record = { id: "G1", code: "G1", name: "Συνεργείο", isApproved: true, isActive: true };
      const edit = render(ClaimSupportDetailDialog, { kind: "garages", record, initialEditing: true, canEdit: true, onClose() {} });
      assert.ok(edit.includes("Αποθήκευση επεξεργασίας")); assert.ok(edit.includes('value="Συνεργείο"'));
      const indemnity = render(ClaimSupportDetailDialog, { kind: "indemnities", record: { id: "I1", paymentNumber: "I1", amount: 100, currency: "EUR" }, initialEditing: true, canEdit: true, onClose() {} });
      assert.ok(indemnity.includes("Καρτέλα αποζημίωσης")); assert.ok(!indemnity.includes("Αποθήκευση επεξεργασίας"));
    });
    await context.test("support saves preserve hidden taxes, associations, zero and false without mutating source objects", () => {
      const garage = { id: "G1", code: "G1", name: "Garage", afm: null, phone: null, email: "old@example.gr", isApproved: true, isActive: false, iban: "GR123", notes: "Old" };
      const original = structuredClone(garage);
      const saved = claimSupportUpdate("garages", garage, { name: "New", notes: "", isApproved: "false" });
      assert.equal(saved.name, "New"); assert.equal(saved.notes, null); assert.equal(saved.isApproved, false); assert.equal(saved.isActive, false); assert.equal(saved.email, garage.email); assert.deepEqual(garage, original);
      const settlement = { id: "S1", claimId: "CL1", settlementFileNumber: "SET1", declarationDate: "2026-10-01", status: "Open", currency: "EUR", vatAmount: 24, agreedAmount: 100, feeAmount: 5 };
      const updated = claimSupportUpdate("friendly-settlements", settlement, { agreedAmount: "0", feeAmount: "", status: "Closed" });
      assert.equal(updated.agreedAmount, 0); assert.equal(updated.feeAmount, null); assert.equal(updated.claimId, "CL1"); assert.equal(updated.vatAmount, 24);
      for (const changes of [{ claimId: "other" }, { agreedAmount: "-1" }, { agreedAmount: "NaN" }, { declarationDate: "2026-02-30" }, { status: "bad" }]) assert.throws(() => claimSupportUpdate("friendly-settlements", settlement, changes));
      for (const changes of [{ name: "" }, { email: "bad" }, { isActive: "yes" }, { phone: "letters" }]) assert.throws(() => claimSupportUpdate("garages", garage, changes));
      assert.throws(() => claimSupportUpdate("indemnities", {}, { amount: "1" }));
    });
    await context.test("all list edit entry points route to cards rather than legacy forms or redirects", async () => {
      for (const [page, handler, legacy] of [["PoliciesPage", "openPolicyCard(p.id, true)", "setEditingPolicy"], ["ProducersPage", "openProducerCard(p.id, true)", "setEditing(p)"], ["ClaimsPage", "openClaimCard(c, true)", "EditClaimDialog"], ["GaragesPage", "openGarageCard(g, true)", "setEditing(g)"]]) {
        const source = await readFile(new URL(`../../pages/${page}.tsx`, import.meta.url), "utf8");
        assert.ok(source.includes(handler), page); assert.ok(source.includes("initialEditing={detailEditing")); assert.ok(!source.includes(legacy));
      }
      const policySource = await readFile(new URL("../../pages/PoliciesPage.tsx", import.meta.url), "utf8");
      assert.ok(!policySource.includes('window.location.href = `/app/policies/${p.id}`'));
      const shared = await readFile(new URL("../ClaimSupportDetailDialog.tsx", import.meta.url), "utf8");
      for (const retained of ["useProfileFieldEditor", "ProfileEditorFeedback", "session.requestClose", "accept(Object.keys(changes))", "api.put", "ProfileEditorActions"]) assert.ok(shared.includes(retained));
    });
  } finally { client.clear(); await server.close(); }
});
