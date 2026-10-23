import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

test("company and agency General fields read down semantic columns in identical view/edit order at every breakpoint", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ids = html => [...html.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]);
  try {
    const { CompanyProfileFields } = await server.ssrLoadModule("/src/pages/ProductionCompaniesAgenciesPage.tsx");
    const { ProfileEditableField } = await server.ssrLoadModule("/src/components/profile/ProfileFieldEditor.tsx");
    const { policyFieldColumns } = await server.ssrLoadModule("/src/components/profile/PolicyFieldColumns.tsx");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    for (const isBroker of [false,true]) for (const additionalCount of [0,9]) {
      const values = { name: "Εταιρεία δοκιμής", code: "TEST", afmVat: "012345678", country: "GR", website: "https://example.test", isActive: "false", contactName: "Υπεύθυνος", contactEmail: "contact@example.test", contactPhone: "2101234567", notes: "Υπάρχουσες σημειώσεις",
        "custom:address": "Οδός 1", "custom:city": "Αθήνα", "custom:postal": "10558", "custom:maps": "https://maps.example.test", "custom:contract": "Σύμβαση", "custom:expiry": "2026-12-31" };
      for(let index=0;index<additionalCount;index++) values[`custom:extra-${index}`]=String(index);
      const before = JSON.stringify(values);
      const groups = [
        ["name","code","afmVat","isActive","isProspect","Τύπος"],
        ["country","custom:address","custom:city","custom:postal","website","custom:maps"],
        ["contactName","contactEmail","contactPhone","custom:contract","custom:expiry","notes",...Array.from({length:additionalCount},(_,index)=>`custom:extra-${index}`)],
      ];
      for (const [width,count] of [[320,1],[600,1],[900,2],[1199,2],[1200,3],[1920,3]]) for(const editAll of [false,true]) {
        const session = { values, drafts: {}, editAll, busy: false, change() {}, commit: async () => {} };
        const field = (key,type="text") => createElement(ProfileEditableField,{key,field:key,label:key,session,type});
        const generalFields = {
          address: ["custom:address","custom:city","custom:postal"].map(key=>field(key)), maps: field("custom:maps"),
          cooperation: [field("custom:contract"),field("custom:expiry","date")],
          additional: Array.from({length:additionalCount},(_,index)=>field(`custom:extra-${index}`,"number")),
        };
        const theme=createTheme({components:{MuiUseMediaQuery:{defaultProps:{ssrMatchMedia:query=>({matches:width>=Number(query.match(/min-width:\s*(\d+)/)?.[1]??Infinity)})}}}});
        const render = props=>renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(ThemeProvider,{theme},createElement(CompanyProfileFields,props))));
        const html=render({session,isBroker,generalFields});
        assert.ok(html.includes('data-policy-layout="company-general"'));
        assert.ok(html.includes(`data-policy-columns="${count}"`));
        assert.deepEqual(ids(html),groups.flat());
        assert.deepEqual(html.split(/data-policy-column="\d+"/).slice(1).map(ids),policyFieldColumns(groups,count));
        assert.equal(new Set(ids(html)).size,18+additionalCount);
        assert.ok(html.includes(isBroker ? "Πρακτορείο" : "Ασφαλιστική εταιρεία"));
        assert.ok(html.includes(editAll ? "Αποθήκευση Επωνυμία" : "Αντιγραφή Επωνυμία"));
        assert.ok(!html.includes("Αποθήκευση Τύπος"));
        const contact=render({session,contact:true,isBroker,generalFields});
        assert.deepEqual(ids(contact),["contactName","contactEmail","contactPhone","notes"]);
        assert.ok(!contact.includes('data-policy-layout="company-general"'));
      }
      assert.equal(JSON.stringify(values),before);
    }
    const source = await readFile(new URL("../../pages/ProductionCompaniesAgenciesPage.tsx",import.meta.url),"utf8");
    assert.ok(source.includes('generalFields={{'));
    assert.ok(source.includes('!knownCustomIds.has(field.id) && !isSocialCustomField(field) && !isDuplicateCoreField(field)'));
    assert.ok(source.includes('maps: renderCustomField(...addressFields[5])'));
  } finally { client.clear(); await server.close(); }
});

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
    assert.match(source, /startIcon=\{<LogoutIcon fontSize="small" \/>\}/);
    assert.match(source, />\s*Έξοδος\s*<\/Button>/);
  }
  assert.match(layout, /spacing=\{\{ xs: 1\.5, md: 2\.5 \}\}/);
  assert.match(layout, /ml: \{ xs: 2, sm: 3 \}/);
});

test("notification dropdown follows the compact notification-board design", async () => {
  const source = await readFile(new URL("../NotificationBell.tsx", import.meta.url), "utf8");
  for (const label of ["Ειδοποίηση", "Ημερομηνία", "Κατάσταση"]) assert.equal(source.includes(label), true, label);
  assert.match(source, /sm: 560, md: 610/);
  assert.match(source, /bgcolor: "#173a60", color: "#fff"/);
  assert.match(source, /ArticleOutlinedIcon/);
  assert.equal(source.includes("Όλες οι κατηγορίες"), false);
  assert.equal(source.includes('{ key: "info", label: "Ενημερώσεις" }'), false);
  assert.equal(source.includes("#fff0cf"), false);
  assert.match(source, /FILTER_TONES/);
  assert.match(source, /bgcolor: active \? tone\.active : tone\.soft/);
});

test("notifications page uses a compact responsive Kalypsis table and modal filters", async () => {
  const source = await readFile(new URL("../../pages/NotificationsPage.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-label="Πίνακας ειδοποιήσεων"/);
  for (const label of ["Ειδοποίηση", "Κατηγορία", "Ημερομηνία", "Κατάσταση", "Ενέργειες"]) assert.equal(source.includes(label), true, label);
  assert.match(source, /showInlineFilters = useMediaQuery/);
  assert.match(source, /Φίλτρα ειδοποιήσεων/);
  assert.match(source, /bgcolor: "#159b59", color: "#fff"/);
  assert.match(source, /markSelectedRead/);
  assert.match(source, /deleteSelected/);
  assert.match(source, /Επιλογή όλων των ειδοποιήσεων της σελίδας/);
  assert.equal(source.includes("Σύνολο ·"), false);
  assert.equal(source.includes('label="Ανά σελίδα"'), false);
});

test("unlisted insurance intake requires login, validates submissions and persists to the platform inbox", async () => {
  const app = await readFile(new URL("../../App.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../pages/InsuranceRequestPage.tsx", import.meta.url), "utf8");
  const controller = await readFile(new URL("../../../../../Backend/Kalypsis.Api/Controllers/OfficeWebsiteController.cs", import.meta.url), "utf8");
  assert.match(app, /path="\/insurance-request" element=\{<ProtectedRoute><InsuranceRequestPage \/><\/ProtectedRoute>\}/);
  for (const label of ["Κλάδος ασφάλισης", "Ονοματεπώνυμο", "Email", "Τηλέφωνο", "Αποστολή αιτήματος ασφάλισης"]) assert.equal(page.includes(label), true, label);
  assert.match(page, /kalypsis\/insurance-request/);
  assert.match(controller, /EnableRateLimiting\("public-contact"\)/);
  assert.match(controller, /x\.Code == "PLATFORM"/);
  assert.match(controller, /IsPublished = false/);
  assert.match(controller, /Source = "kalypsis-hidden-insurance-form"/);
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
    const { SavedReportsButton, SavedFilterForm, savedFilterPayload, parseSavedFilter } = await server.ssrLoadModule("/src/components/SavedReportsButton.tsx");
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
    assert.deepEqual(parseSavedFilter(payload.filtersJson), filters);
    for (const invalid of ["null", "[]", "42", '"text"', "broken-json"]) assert.throws(() => parseSavedFilter(invalid));
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
