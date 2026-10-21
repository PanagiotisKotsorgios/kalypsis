import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

test("authenticated top bars hide the language toggle and use a compact red logout action", async () => {
  const layout = await readFile(new URL("../AppLayout.tsx", import.meta.url), "utf8");
  const maintenance = await readFile(new URL("../../pages/UnderMaintenancePage.tsx", import.meta.url), "utf8");
  const ermes = await readFile(new URL("../../pages/ErmesStandalonePage.tsx", import.meta.url), "utf8");

  for (const source of [layout, maintenance]) {
    assert.equal(source.includes('import { LanguageToggle }'), false);
    assert.equal(source.includes("<LanguageToggle"), false);
  }
  assert.equal(layout.includes('data-tour="topbar-language"'), false);
  for (const source of [layout, maintenance, ermes]) {
    assert.match(source, /bgcolor: "#d32f2f", color: "#fff"/);
    assert.match(source, /<LogoutIcon fontSize="small" \/>/);
  }
});

test("production profiles reuse client fields, pencil/save actions and compact tabs; filters retain API payloads", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const render = (Component, props) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Component, props)));
  try {
    const { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback } = await server.ssrLoadModule("/src/components/profile/ProfileFieldEditor.tsx");
    const { CompanyProfileFields, OfficeProfileFields, WorkspaceProfileTabs, buildOfficeProfileUpdate, toCompanyApiPayload } = await server.ssrLoadModule("/src/pages/ProductionCompaniesAgenciesPage.tsx");
    const { SavedReportsButton, SavedFilterForm, savedFilterPayload } = await server.ssrLoadModule("/src/components/SavedReportsButton.tsx");
    const events = [];
    const session = { values: { name: "Εταιρεία", code: "DEMO", country: "GR", isActive: "false", contactEmail: "info@example.gr", contactPhone: "2101234567" },
      drafts: {}, editAll: false, busy: false, change: (field, value) => events.push(["change", field, value]), commit: async (field, value) => events.push(["commit", field, value]),
      begin: () => events.push("begin"), saveAll: () => events.push("saveAll"), cancel: () => events.push("cancel"), requestClose: () => events.push("close"),
      error: null, toast: "", confirm: null, clearToast() {}, dismissConfirm() {}, discard() {} };
    const view = render(CompanyProfileFields, { session });
    const keys = ["name", "code", "afmVat", "country", "website", "contactName", "contactEmail", "contactPhone", "isActive", "notes"];
    assert.equal(view.includes('data-profile-field="agentCode"'), false);
    for (const key of keys) assert.equal(view.split(`data-profile-field="${key}"`).length - 1, 1, key);
    assert.equal(view.includes("<input"), false);
    assert.equal(view.includes("Αντιγραφή Επωνυμία"), true);
    assert.equal(view.includes("Επεξεργασία Επωνυμία"), true);
    const editing = render(CompanyProfileFields, { session: { ...session, editAll: true, drafts: { name: "Νέα επωνυμία" } } });
    for (const key of keys) assert.equal(editing.includes(`data-profile-field="${key}"`), true);
    assert.equal(editing.includes('value="Νέα επωνυμία"'), true);
    assert.equal(editing.includes("Αποθήκευση Επωνυμία"), true);
    assert.equal(editing.includes("Αποθήκευση Τύπος"), false);
    assert.equal(editing.includes("autofocus"), false);
    const restored = render(ProfileEditableField, { label: "Επωνυμία", field: "name", session: { ...session, drafts: { name: "Μη αποθηκευμένη" } } });
    assert.equal(restored.includes('value="Μη αποθηκευμένη"'), true);
    assert.equal(restored.includes("Αποθήκευση Επωνυμία"), true);
    const fieldElement = ProfileEditableField({ label: "Επωνυμία", field: "name", session });
    const fieldControl = fieldElement.props.children[1];
    fieldControl.props.onDraftChange("Νέα"); await fieldControl.props.onCommit("Νέα");
    assert.deepEqual(events.slice(0, 2), [["change", "name", "Νέα"], ["commit", "name", "Νέα"]]);
    const nodes = [];
    const walk = node => Children.forEach(node, child => { if (isValidElement(child)) { nodes.push(child); walk(child.props.children); } });
    walk(ProfileEditorActions({ session: { ...session, editAll: true } }));
    nodes.find(node => node.props.children === "Αποθήκευση επεξεργασίας").props.onClick();
    nodes.find(node => node.props.children === "Ακύρωση επεξεργασίας").props.onClick();
    nodes.find(node => node.props.children === "Κλείσιμο").props.onClick();
    assert.deepEqual(events.slice(-3), ["saveAll", "cancel", "close"]);
    assert.equal(render(ProfileEditorFeedback, { session: { ...session, error: "Αποτυχία δοκιμής" } }).includes("μη αποθηκευμένες"), true);
    const nav = render(WorkspaceProfileTabs, { value: 0, onChange() {}, splitWorkspace: true });
    for (const label of ["Γενικά", "Παραγωγή", "Επικοινωνία", "Έγγραφα", "Πεδία"]) assert.equal(nav.includes(label), true, label);
    assert.equal(nav.includes("Παραγωγή &amp; συμβόλαια"), false);
    assert.equal(nav.includes(">Στατιστικά<"), false);
    assert.equal(nav.includes("height:36px"), true);
    assert.equal(nav.includes("height:54px"), false);

    const office = { id: "office", code: "OFFICE", name: "Πρακτορείο", phone: "2101234567", email: "info@example.gr", city: "Αθήνα", address: "Οδός 1", postalCode: "10431", isActive: false, isHeadquarters: false, notes: "Σημειώσεις", userCount: 2,
      profileJson: JSON.stringify({ vatNumber: "123456789", website: "https://example.gr", futureData: { mustStay: true } }) };
    const changed = buildOfficeProfileUpdate(office, { name: "Νέο πρακτορείο", "profile:vatNumber": "987654321" });
    assert.equal(changed.phone, office.phone); assert.equal(changed.isActive, false);
    assert.equal(JSON.parse(changed.profileJson).futureData.mustStay, true);
    assert.equal(JSON.parse(changed.profileJson).vatNumber, "987654321");
    assert.equal(buildOfficeProfileUpdate(office, { name: "Νέο" }).profileJson, office.profileJson);
    assert.equal(buildOfficeProfileUpdate(office, { notes: "" }).notes, null);
    for (const changes of [{ email: "invalid" }, { phone: "letters" }, { name: "" }, { isActive: "invalid" }, { "profile:__proto__": "bad" }]) assert.throws(() => buildOfficeProfileUpdate(office, changes));
    assert.throws(() => buildOfficeProfileUpdate({ ...office, profileJson: "broken" }, { "profile:vatNumber": "123" }));
    const companyBody = toCompanyApiPayload({ name: " Εταιρεία ", code: " demo ", isActive: false, isBroker: true, contactName: "Υπεύθυνος", contactEmail: "info@example.gr", contactPhone: "2101234567", afmVat: "GB123", country: "GB", notes: "Σημειώσεις", website: null,
      address: "workspace-only", createBridge: true, installZeroCommissionDefaults: true }, { createBridge: false, installZeroCommissionDefaults: false });
    assert.equal(companyBody.code, "DEMO"); assert.equal(companyBody.name, "Εταιρεία");
    assert.equal(companyBody.isBroker, true); assert.equal(companyBody.isActive, false);
    assert.equal(companyBody.createBridge, false); assert.equal(companyBody.installZeroCommissionDefaults, false);
    assert.equal("address" in companyBody, false);
    for (let tab = 0; tab < 5; tab++) {
      const officeView = render(OfficeProfileFields, { tab, session });
      const officeEdit = render(OfficeProfileFields, { tab, session: { ...session, editAll: true } });
      const viewFields = [...officeView.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]);
      const editFields = [...officeEdit.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]);
      assert.ok(viewFields.length > 0); assert.deepEqual(editFields, viewFields);
      assert.equal(/<(input|textarea)\b/.test(officeView), false); assert.equal(/<(input|textarea)\b/.test(officeEdit), true);
    }
    for (const entity of ["customers", "production-lists"]) {
      const compact = render(SavedReportsButton, { entity, compact: true, currentFilters: { status: "Active" }, onLoad() {} });
      assert.equal(compact.includes("Αποθήκευση φίλτρου"), true);
      assert.equal(compact.includes("Έτοιμα φίλτρα"), true);
      assert.equal(compact.includes("<input"), false);
    }
    const legacy = render(SavedReportsButton, { entity: "policies", inline: true, currentFilters: {}, onLoad() {} });
    assert.equal(legacy.includes("<input"), true);
    const form = render(SavedFilterForm, { name: "", isShared: false, pending: false, onChange() {}, onSave() {}, onClose() {} });
    assert.equal(form.includes("Όνομα φίλτρου"), true); assert.match(form, /<button[^>]*disabled/);
    const failedForm = render(SavedFilterForm, { name: "Δοκιμή", isShared: false, pending: false, error: "Αποτυχία αποθήκευσης", onChange() {}, onSave() {}, onClose() {} });
    assert.equal(failedForm.includes('role="alert"'), true);
    const filters = { status: "Active", city: ["Αθήνα", "Πάτρα"], paid: false, amount: 0, from: null };
    const payload = savedFilterPayload("customers", filters, " Δοκιμή ", true);
    assert.equal(payload.name, "Δοκιμή"); assert.equal(payload.isShared, true); assert.deepEqual(JSON.parse(payload.filtersJson), filters);
    assert.throws(() => savedFilterPayload("customers", {}, "  ", false));
    assert.throws(() => savedFilterPayload("customers", {}, "x".repeat(201), false));

    const companySource = await readFile(new URL("../../pages/ProductionCompaniesAgenciesPage.tsx", import.meta.url), "utf8");
    assert.equal(companySource.includes('label: "Παραγωγή & συμβόλαια"'), false);
    assert.equal(companySource.includes('title="Όλα τα συμβόλαια εταιρείας"'), false);
    assert.equal(companySource.includes('title="Όλα τα συμβόλαια στην εταιρεία"'), true);
    assert.equal(companySource.includes('label="Έναρξη από"'), true);
    assert.equal(companySource.includes('label="Έναρξη έως"'), true);
    assert.equal(companySource.split("<TablePagination").length >= 3, true);
    assert.equal(companySource.includes('label="Κωδικός από γέφυρα"'), true);
    for (const removed of ["Κλάδος / τύπος συμβολαίου (προαιρετικό)", "Κατηγορία χρήσης οχήματος (προαιρετικό)", "Γονικός κωδικός"]) assert.equal(companySource.includes(`label="${removed}"`), false, removed);
    assert.equal(companySource.includes('>Τελευταίες επικοινωνίες ({communications.length})</Button>'), true);
    for (const heading of ["Ημερομηνία", "Κανάλι", "Κατεύθυνση", "Επαφή", "Θέμα / σημείωση"]) assert.equal(companySource.includes(`<TableCell>${heading}</TableCell>`), true, heading);
    assert.equal(companySource.includes('label="Αναζήτηση" placeholder="Θέμα, επαφή, email, τηλέφωνο…"'), true);
    assert.equal(companySource.includes('aria-label={`Προεπισκόπηση ${document.fileName}`}'), true);
    assert.equal(companySource.includes('title={`Προεπισκόπηση ${previewDocument.fileName}`}'), true);
    for (const field of ["Διεύθυνση", "Πόλη", "Τ.Κ.", "Σύμβαση με ασφαλιστική εταιρεία", "Ημερομηνία λήξης σύμβασης"]) assert.equal(companySource.includes(`["${field}"`), true, field);
    assert.equal(companySource.includes("Διαχείριση προσαρμόσιμων πεδίων"), true);
    assert.equal(companySource.includes("Νέο προσαρμόσιμο πεδίο"), true);
    assert.equal(companySource.includes('label="Εμφάνιση στο tab"'), true);
    assert.equal(companySource.includes("predefinedFields"), false);
    assert.equal(companySource.includes('label: "Έγγραφα & πεδία"'), true);
    assert.equal(companySource.includes('label: "Έγγραφα"'), true);
    assert.equal(companySource.includes('label: "Πεδία"'), true);
  } finally { client.clear(); await server.close(); }
});
