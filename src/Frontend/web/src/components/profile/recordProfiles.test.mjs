import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { readFile } from "node:fs/promises";

test("vehicle, policy, producer and claim profiles reuse client controls and preserve existing data", async t => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = i18next.createInstance(); await i18n.init({ lng: "el", resources: { el: { translation: {} } }, initImmediate: false });
  const render = (Component, props) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(I18nextProvider, { i18n }, createElement(Component, props))));
  const session = values => ({ values, drafts: {}, editAll: false, busy: false, change() {}, commit: async () => {}, begin() {}, saveAll() {}, cancel() {}, requestClose() {} });
  const ids = html => [...html.matchAll(/data-profile-field="([^"]+)"/g)].map(match => match[1]);
  try {
    const { VehicleProfileFields } = await server.ssrLoadModule("/src/pages/CustomerVehiclesPage.tsx");
    const { VehicleOwnershipFields, VehicleOwnershipInputs } = await server.ssrLoadModule("/src/components/profile/VehicleOwnershipFields.tsx");
    const { PolicyProfileFields, PolicyPremiumFields, PolicyContractFields, PolicyOutstandingField, policyOverlayTheme } = await server.ssrLoadModule("/src/components/PolicyDetailDrawer.tsx");
    const { vehicleOwnerHistory } = await server.ssrLoadModule("/src/components/profile/vehicleHistory.ts");
    const { ProducerProfileFields } = await server.ssrLoadModule("/src/components/ProducerDetailDrawer.tsx");
    const { ClaimProfileFields, ClaimInfoFields } = await server.ssrLoadModule("/src/components/ClaimDetailDrawer.tsx");
    const { ProfileEditableField } = await server.ssrLoadModule("/src/components/profile/ProfileFieldEditor.tsx");
    const { mergeVehicleSpecs, VEHICLE_SPEC_FIELDS, VEHICLE_GENERAL_COLUMNS, vehicleGeneralColumns } = await server.ssrLoadModule("/src/components/profile/vehicleProfile.ts");
    const { producerUpdatePayload, PRODUCER_FIELDS, PRODUCER_GENERAL_COLUMNS, producerGeneralColumns } = await server.ssrLoadModule("/src/components/profile/producerProfile.ts");
    const { ThemeProvider, createTheme } = await server.ssrLoadModule("@mui/material/styles");
    const { CLAIM_FIELDS, CLAIM_PROFILE_GROUPS, claimInformationGroups, claimUpdatePayload } = await server.ssrLoadModule("/src/components/profile/claimProfile.ts");
    const { policyCorePayload, policyPreservedAmounts } = await server.ssrLoadModule("/src/components/profile/policyProfile.ts");
    const layout = (Component, props) => {
      const view = render(Component, props), edit = render(Component, { ...props, session: { ...props.session, editAll: true } });
      assert.deepEqual(ids(view), ids(edit)); assert.equal(view.includes("<input"), false); assert.equal(/<(input|textarea)\b/.test(edit), true);
      return { view, edit };
    };
    await t.test("vehicle has every technical field in both modes; no contract-only fields; owner VAT readonly", () => {
      const values = { vehicleRegistrationPlate: "ABC1234", "spec:make": "Toyota", "spec:sunroof": "true" };
      const {view,edit} = layout(VehicleProfileFields, { values, owner: "Ιδιοκτήτης", ownerVat: "012345678", session: session(values) });
      for (const [key] of VEHICLE_SPEC_FIELDS) assert.equal(ids(view).filter(id => id === "spec:" + key).length, 1, key);
      for (const key of ["wheelbaseMm", "doors", "grossWeightKg", "tonnage", "wheelCount", "rearDualWheels", "alarm", "immobilizer", "storageLocation", "emissionsCo2", "inspectionDate", "nextInspectionDate"]) {
        assert.equal(ids(view).includes("spec:" + key), true, key);
      }
      assert.equal(view.includes("Αντιγραφή Μάρκα"), true); assert.equal(view.includes("Επεξεργασία Ηλιοροφή"), true);
      assert.equal(edit.includes("Αποθήκευση Ηλιοροφή"), true); assert.equal(edit.includes("Αποθήκευση ΑΦΜ ιδιοκτήτη"), false); assert.equal(view.includes("012345678"), true);
      for (const text of ["Χαρακτηριστικό", "Απαλλαγή", "Θέση / spot", "Τρόπος είσπραξης", "Πληρωμή απευθείας"]) assert.equal(view.includes(text), false);
      const fieldOrder = VEHICLE_GENERAL_COLUMNS.flat();
      const expectedIds = fieldOrder.map(key => key === "owner" ? "Ιδιοκτήτης / πελάτης" : key === "ownerVat" ? "ΑΦΜ ιδιοκτήτη (αυτόματο)" : key);
      assert.deepEqual(ids(view), expectedIds);
      assert.deepEqual(ids(edit), expectedIds);
      assert.equal(new Set(fieldOrder).size, VEHICLE_SPEC_FIELDS.length + 5);
      for (const count of [1, 2, 3]) {
        const columns = vehicleGeneralColumns(count);
        assert.equal(columns.length, count);
        assert.deepEqual(columns.flat(), fieldOrder);
        assert.ok(columns.every(column => column.length > 0));
      }
      assert.deepEqual(fieldOrder.slice(0, 5), ["vehicleRegistrationPlate", "spec:make", "spec:model", "spec:year", "spec:vin"]);
      assert.equal(fieldOrder.indexOf("spec:enginePowerKw"), fieldOrder.indexOf("spec:engineCapacity") + 1);
      assert.equal(fieldOrder.indexOf("spec:nextInspectionDate"), fieldOrder.indexOf("spec:inspectionDate") + 1);
      assert.equal(fieldOrder.at(-1), "spec:vehicleNotes");
      assert.ok(view.includes('data-vehicle-general-columns="1"'));
      assert.ok(view.includes('data-vehicle-column="1"'));
    });
    await t.test("multiple owners get individual percentage fields in view/edit and creation; single owners do not", () => {
      const values = { "spec:ownerCount": "2", "owner:0:name": "Άννα", "owner:0:percentage": "60", "owner:1:name": "Γιάννης", "owner:1:percentage": "40" };
      const {view, edit} = layout(VehicleOwnershipFields, { values, session: session(values) });
      for (const key of ["owner:0:percentage", "owner:1:percentage"]) assert.equal(ids(view).includes(key), true);
      assert.match(view, /100%/);
      assert.match(edit, /Αποθήκευση Ποσοστό ιδιοκτησίας/);
      assert.equal(render(VehicleOwnershipFields, { values: { "spec:ownerCount": "1" } }), "");
      const create = render(VehicleOwnershipInputs, { count: "2", values: {}, onChange() {} });
      assert.match(create, /Ιδιοκτήτης 1/); assert.match(create, /Ιδιοκτήτης 2/);
      assert.equal((create.match(/type="number"/g) ?? []).length, 2);
    });
    await t.test("vehicle JSON updates preserve nested insurer data, support clearing and reject broken source", () => {
      const raw = JSON.stringify({make:"Old",sunroof:true,insurer:{reference:"keep",items:[1,2]}});
      const result = JSON.parse(mergeVehicleSpecs(raw, {make:"New",sunroof:"",vehicleNotes:"Vehicle only"}));
      assert.equal(result.make,"New"); assert.equal(result.sunroof,null); assert.deepEqual(result.insurer,{reference:"keep",items:[1,2]}); assert.equal(JSON.parse(raw).make,"Old");
      for (const value of ["broken","[]","null"]) assert.throws(()=>mergeVehicleSpecs(value,{make:"New"}));
      assert.throws(()=>mergeVehicleSpecs("{}",{premium:"100"}));
    });
    await t.test("producer General exposes all original fields, copy and pencil/save controls", () => {
      const values = Object.fromEntries(PRODUCER_FIELDS.map(([key])=>[key,""])); Object.assign(values,{name:"Συνεργάτης",code:"P1",status:"Active",hasContract:"false",tier:"None",hierarchyLevel:"Producer"});
      const {view,edit}=layout(ProducerProfileFields,{values,session:session(values)});
      assert.equal(ids(view).length,PRODUCER_FIELDS.length); assert.equal(view.includes("Επεξεργασία Ονοματεπώνυμο"),true); assert.equal(edit.includes("Αποθήκευση Ονοματεπώνυμο"),true);
    });
    await t.test("producer fields read top-to-bottom in responsive columns with identical view/edit placement", () => {
      const expected = PRODUCER_FIELDS.map(([key]) => key);
      assert.deepEqual(PRODUCER_GENERAL_COLUMNS.flat(), expected);
      assert.equal(new Set(expected).size, expected.length);
      for (const count of [1, 2, 3]) {
        const columns = producerGeneralColumns(count);
        assert.equal(columns.length, count);
        assert.deepEqual(columns.flat(), expected);
        assert.ok(columns.every(column => column.length));
      }
      assert.deepEqual(PRODUCER_GENERAL_COLUMNS[1], ["email", "secondaryEmail", "phone", "secondaryPhone", "address", "city", "postalCode", "website"]);
      const values = Object.fromEntries(PRODUCER_FIELDS.map(([key]) => [key, ""]));
      Object.assign(values, { name: "Συνεργάτης", code: "P1", email: "info@example.gr", phone: "2101234567", status: "Active", hasContract: "true" });
      for (const width of [360, 768, 1024, 1280, 1920]) {
        const count = width >= 1200 ? 3 : width >= 900 ? 2 : 1;
        const theme = createTheme({ components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: query => {
          const min = query.match(/min-width:\s*([\d.]+)px/);
          return { matches: !min || width >= Number(min[1]) };
        } } } } });
        for (const editAll of [false, true]) {
          const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(ProducerProfileFields,
            { values, session: { ...session(values), editAll } })));
          assert.ok(html.includes(`data-producer-general-columns="${count}"`));
          assert.deepEqual(ids(html), expected);
          const columns = html.split(/data-producer-column="\d+"/).slice(1);
          assert.deepEqual(columns.map(ids), producerGeneralColumns(count));
          for (const key of expected) assert.equal(ids(html).filter(id => id === key).length, 1, `${width}px: ${key}`);
          if (!editAll) assert.ok(html.includes("Αντιγραφή Ονοματεπώνυμο"));
          assert.ok(html.includes(editAll ? "Αποθήκευση Ονοματεπώνυμο" : "Επεξεργασία Ονοματεπώνυμο"));
          assert.ok(html.includes("info@example.gr"));
        }
      }
    });
    await t.test("producer update preserves hierarchy, contract, unknown JSON and unchanged legacy values", () => {
      const current={code:"P1",name:"Old",tier:"E",hierarchyLevel:"Agency",parentProducerId:"parent",hasContract:true,contractNumber:"C1",email:"legacy",additionalInfoJson:'{"future":{"a":1}}'};
      const result=producerUpdatePayload(current,{name:"New",hasContract:"false",phone:"2101234567"});
      for(const key of ["tier","hierarchyLevel","parentProducerId","contractNumber","email","additionalInfoJson"]) assert.equal(result[key],current[key]);
      assert.equal(result.name,"New"); assert.equal(result.hasContract,false); assert.equal("id" in result,false);
      for(const changes of [{email:"invalid"},{name:""},{hasContract:"yes"},{totalPremiumYtd:"42"}]) assert.throws(()=>producerUpdatePayload(current,changes));
    });
    await t.test("claim General keeps identical placement; claim number is readonly", () => {
      const claim={claimNumber:"CL1",incidentDate:"2026-10-01",reportedDate:"2026-10-02",claimedAmount:0,approvedAmount:null,status:"Reported",description:"Description"};
      const values=Object.fromEntries(Object.entries(claim).map(([key,value])=>[key,String(value??"")]));
      const {view,edit}=layout(ClaimProfileFields,{claim,session:session(values)});
      assert.equal(ids(view).length,7); assert.equal(edit.includes("Αποθήκευση Περιγραφή"),true); assert.equal(edit.includes("Αποθήκευση Αριθμός ζημιάς"),false);
    });
    await t.test("claim payload keeps zero and null, clears text and rejects invalid dates/amounts", () => {
      const current={incidentDate:"2026-10-01",reportedDate:"2026-10-02",claimedAmount:50,approvedAmount:null,description:"Old"};
      const result=claimUpdatePayload(current,{claimedAmount:"0",description:""});
      assert.equal(result.claimedAmount,0); assert.equal(result.description,null); assert.equal(result.approvedAmount,null);
      for(const changes of [{claimedAmount:"NaN"},{approvedAmount:"-1"},{incidentDate:"2026-02-30"},{policyId:"other"}]) assert.throws(()=>claimUpdatePayload(current,changes));
    });
    await t.test("claim fields and every related-info section read down responsive columns in identical view/edit order", async () => {
      const { policyFieldColumns } = await server.ssrLoadModule("/src/components/profile/PolicyFieldColumns.tsx");
      const claim = { claimNumber: "CL-1", incidentDate: "2026-10-01", reportedDate: "2026-10-02", claimedAmount: 0, approvedAmount: 150.5, status: "Reported", description: "Αναλυτική περιγραφή ζημιάς" };
      const values = Object.fromEntries(Object.entries(claim).map(([key, value]) => [key, String(value)]));
      const expectedGroups = CLAIM_PROFILE_GROUPS.map(group => group.map(key => key === "claimNumber" ? "Αριθμός ζημιάς" : key));
      assert.deepEqual(new Set(CLAIM_PROFILE_GROUPS.flat()), new Set(["claimNumber", ...CLAIM_FIELDS.map(([key]) => key)]));
      assert.equal(CLAIM_PROFILE_GROUPS.flat().length, 7);
      assert.deepEqual(CLAIM_PROFILE_GROUPS[1], ["incidentDate", "reportedDate"]);
      assert.deepEqual(CLAIM_PROFILE_GROUPS[2], ["claimedAmount", "approvedAmount"]);
      for (const width of [320, 360, 768, 1024, 1280, 1920]) {
        const count = width >= 1200 ? 3 : width >= 900 ? 2 : 1;
        const theme = createTheme({ components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: query => {
          const min = query.match(/min-width:\s*([\d.]+)px/); return { matches: !min || width >= Number(min[1]) };
        } } } } });
        const themedRender = (Component, props) => renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(I18nextProvider, { i18n }, createElement(Component, props))));
        for (const editAll of [false, true]) {
          const html = themedRender(ClaimProfileFields, { claim, session: { ...session(values), editAll } });
          const expected = policyFieldColumns(expectedGroups, count);
          assert.ok(html.includes('data-policy-layout="claim-general"'));
          assert.ok(html.includes(`data-policy-columns="${count}"`));
          assert.deepEqual(html.split(/data-policy-column="\d+"/).slice(1).map(ids), expected);
          assert.deepEqual(ids(html), expectedGroups.flat());
          assert.equal(new Set(ids(html)).size, 7);
          assert.ok(html.includes(editAll ? "Αποθήκευση Περιγραφή" : "Αντιγραφή Περιγραφή"));
          assert.ok(!html.includes("Αποθήκευση Αριθμός ζημιάς"));
        }
        for (const length of [1, 2, 6, 9, 10]) {
          const keys = Array.from({ length }, (_, index) => `Related field ${index}`);
          const groups = claimInformationGroups(keys);
          assert.deepEqual(groups.flat(), keys); assert.ok(groups.every(group => group.length));
          const children = keys.map(key => createElement(ProfileEditableField, { key, label: key, value: "Πλήρες κείμενο" }));
          const html = themedRender(ClaimInfoFields, { children });
          assert.ok(html.includes('data-policy-layout="claim-related"'));
          assert.deepEqual(html.split(/data-policy-column="\d+"/).slice(1).map(ids), policyFieldColumns(groups, count));
        }
      }
      const source = await readFile(new URL("../ClaimDetailDrawer.tsx", import.meta.url), "utf8");
      assert.equal((source.match(/<ClaimInfoFields>/g) ?? []).length, 6);
      assert.ok(!source.includes("InfoGrid"));
      assert.ok(!source.includes("profileFieldGridSx"));
      const item = source.slice(source.indexOf("function InfoItem("), source.indexOf("function KPI("));
      assert.ok(!item.includes("<Grid")); assert.ok(item.includes("minWidth: 0"));
    });
    await t.test("policy General retains field order, readonly computed values and actual edit/save controls", () => {
      const policy={policyNumber:"POL1",customerDisplay:"Πελάτης",customerVat:"012345678",insuranceCompanyId:"carrier",insuranceCompanyName:"Ασφαλιστική",producerName:"Συνεργάτης",startDate:"2026-01-01",endDate:"2026-12-31"};
      const values={...policy,status:"Active",policyType:"Auto",premium:"100",currency:"EUR"};
      const {view,edit}=layout(PolicyProfileFields,{policy,values,session:session(values),companies:[],customers:[]});
      assert.equal(view.includes("Επεξεργασία Έναρξη"),true); assert.equal(edit.includes("Αποθήκευση Έναρξη"),true);
      assert.equal(edit.includes("Αποθήκευση Διάρκεια"),false); assert.equal(edit.includes("Αποθήκευση Αριθμός συμβολαίου"),false);
    });
    await t.test("policy General, contract details and premiums read top-to-bottom at all breakpoints without losing view/edit controls", async () => {
      const { policyFieldColumns } = await server.ssrLoadModule("/src/components/profile/PolicyFieldColumns.tsx");
      const policy = { policyNumber: "POL1", customerDisplay: "Πελάτης", customerVat: "012345678", insuranceCompanyId: "carrier", insuranceCompanyName: "Ασφαλιστική", producerName: "Συνεργάτης", startDate: "2026-01-01", endDate: "2026-12-31", premium: 100, netPremium: 80, currency: "EUR" };
      const values = { ...policy, status: "Active", policyType: "Auto", premium: "100", netPremium: "80", currency: "EUR" };
      const generalGroups = [["Αριθμός συμβολαίου", "applicationNumber", "insuranceCompanyId", "previousInsuranceCompanyId", "policyType", "status", "issuedAt", "startDate", "endDate", "Διάρκεια"],
        ["Πελάτης / ασφαλισμένος", "ΑΦΜ πελάτη", "Email ασφαλισμένου", "Τηλέφωνο ασφαλισμένου", "contractPartyCustomerId", "ΑΦΜ συμβαλλομένου", "Email συμβαλλομένου", "Τηλέφωνο συμβαλλομένου"],
        ["Συνεργάτης", "Κωδικός συνεργάτη", "Προμήθεια συνεργάτη (%)", "vehicleRegistrationPlate", "driverVatNumber", "reasonForCirculation", "premium", "netPremium", "currency"]];
      const cases = [[PolicyProfileFields, { policy, values, companies: [], customers: [] }, generalGroups],
        [PolicyContractFields, { policy, values }, [["vehicleUseCategory", "packageCode", "Επόμενη ανανέωση (αυτόματα)", "renewalInstructions"], ["deliveredAt", "deliveredTo", "deliveryMethod", "Σημειώσεις συμβολαίου"]]],
        [PolicyPremiumFields, { policy, matrixLoading: false }, [["premium", "netPremium"], ["Προμήθεια γραφείου", "Προμήθεια συνεργάτη"]]]];
      for (const width of [320, 360, 768, 1024, 1280, 1920]) {
        const count = width >= 1200 ? 3 : width >= 900 ? 2 : 1;
        const theme = createTheme({ components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: query => {
          const min = query.match(/min-width:\s*([\d.]+)px/); return { matches: !min || width >= Number(min[1]) };
        } } } } });
        for (const [Component, props, groups] of cases) {
          const expectedColumns = policyFieldColumns(groups, count);
          for (const editAll of [false, true]) {
            const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(Component, { ...props, session: { ...session(values), editAll } })));
            assert.deepEqual(ids(html), groups.flat());
            assert.ok(html.includes(`data-policy-columns="${expectedColumns.length}"`));
            assert.deepEqual(html.split(/data-policy-column="\d+"/).slice(1).map(ids), expectedColumns);
            assert.equal(new Set(ids(html)).size, groups.flat().length);
            assert.ok(html.includes(editAll ? "Αποθήκευση " : "Αντιγραφή "));
          }
          assert.equal(ids(render(Component, props)).length, groups.flat().length, "read-only permissions preserve every field");
        }
      }
    });
    await t.test("policy contract details exclude General duplicates, hide JSON and keep editable catalogue values", () => {
      const policy = { endDate: "2027-01-01", nextRenewalDate: null, currency: "EUR", deductible: 100, policyNotes: "Όροι" };
      const values = { vehicleUseCategory: "Private", packageCode: "BASIC", coverCode: "FIRE,GLASS", deliveredAt: "2026-01-01", deliveredTo: "Πελάτης" };
      const {view,edit} = layout(PolicyContractFields, { policy, values, session: session(values), uses: [{value:"Private",label:"Ιδιωτική χρήση"}], packages: [{value:"BASIC",label:"Βασικό πακέτο"}] });
      assert.match(view, /Βασικό πακέτο/); assert.match(view, /Ιδιωτική χρήση/); assert.match(view, /2027-01-01/);
      assert.equal(ids(view).includes("specsJson"), false);
      for (const key of ["insuranceCompanyId", "policyType", "customerDisplay", "startDate", "endDate", "premium", "applicationNumber", "deductible", "characteristic", "position", "coverCode"])
        assert.equal(ids(view).includes(key), false, key);
      assert.match(edit, /Αποθήκευση Πακέτο/);
      assert.equal(edit.includes("Αποθήκευση Επόμενη ανανέωση"), false);
      const payload = policyCorePayload({ insuranceCompanyId:"carrier", policyType:"Auto", currency:"EUR", status:"Active", premium:100, startDate:"2026-01-01", endDate:"2027-01-01", coverCode:"OLD" }, { vehicleUseCategory:"Private", packageCode:"BASIC", coverCode:"FIRE,GLASS" });
      assert.equal(payload.packageCode,"BASIC"); assert.equal(payload.coverCode,"FIRE,GLASS");
    });
    await t.test("policy debt has a red value surface and nested popups stay above the policy modal", async () => {
      const unpaid = render(PolicyOutstandingField, { amount: 100, currency: "EUR" });
      assert.match(unpaid, /#D00000/); assert.match(unpaid, /#fff/); assert.match(unpaid, /100,00 EUR/);
      assert.equal(render(PolicyOutstandingField, { amount: 0, currency: "EUR" }).includes("#D00000"), false);
      const childTheme = policyOverlayTheme({ zIndex: { modal: 1300, drawer: 1200, snackbar: 1400, tooltip: 1500 } });
      assert.equal(childTheme.zIndex.modal,1800); assert.equal(childTheme.zIndex.drawer,1200);
      const source = await readFile(new URL("../PolicyDetailDrawer.tsx",import.meta.url),"utf8");
      assert.match(source, /<Dialog open=\{commissionDetailsOpen\}[^\n]+zIndex: 1800/);
      assert.match(source, /label:"Έγγραφα",icon:<DescriptionOutlinedIcon \/>\}, \{label:"Ιστορικό"/);
      assert.equal(source.includes("Παραμετρικά στοιχεία (JSON)"),false);
      assert.equal(source.includes('<PolicyBooleanField profileKey="retain'),false);
      const movements = source.slice(source.indexOf("{showMovements &&"),source.indexOf("{showDocuments &&"));
      assert.equal(movements.includes(">Ζημιές<"),false);
    });
    await t.test("compact financial fields retain copy/save controls and sum each commission level exactly once", () => {
      const policy = { premium: 100, netPremium: 80, currency: "EUR", producerName: "Συνεργάτης" };
      const values = { premium: "100", netPremium: "80" };
      const matrix = { rows: [
        { hierarchyLevel: "Agency", grossAmount: 16 },
        { hierarchyLevel: "Producer", grossAmount: 4 },
        { hierarchyLevel: "Manager", grossAmount: 2 }
      ] };
      const { view, edit } = layout(PolicyPremiumFields, { policy, matrix, matrixLoading: false, session: session(values) });
      assert.deepEqual(ids(view), ["premium", "netPremium", "Προμήθεια γραφείου", "Προμήθεια συνεργάτη"]);
      assert.match(view, /16,00 EUR/); assert.match(view, /6,00 EUR/);
      assert.equal(view.includes("<table"), false);
      assert.equal(view.includes("Φόρος"), false);
      assert.equal(edit.includes("Αποθήκευση Μικτά"), true);
      assert.equal(edit.includes("Αποθήκευση Προμήθεια γραφείου"), false);
      assert.match(view, /data-policy-layout="premiums"/);
      const empty = render(PolicyPremiumFields, { policy: { ...policy, netPremium: null }, matrixLoading: false });
      assert.match(empty, /Δεν έχει υπολογιστεί/);
      assert.equal(empty.includes("16,00 EUR"), false);
      const loading = render(PolicyPremiumFields, { policy, matrixLoading: true });
      assert.match(loading, /Υπολογισμός/);
      const zero = render(PolicyPremiumFields, { policy, matrixLoading: false, matrix: { rows: [{ hierarchyLevel: "Agency", grossAmount: 0 }] } });
      assert.match(zero, /0,00 EUR/);
    });
    await t.test("owner history derives dates from real policy records without merging different customer IDs", () => {
      const policy = { id: "1", policyNumber: "POL-1", customerId: "a", customerDisplay: "Ίδιο όνομα", customerVat: "111111111", startDate: "2024-01-01", endDate: "2025-01-01" };
      const rows = [policy, { ...policy, id: "2", policyNumber: "POL-2", startDate: "2025-01-01", endDate: "2026-01-01" },
        { ...policy, id: "3", policyNumber: "POL-3", customerId: "b", customerVat: "222222222", startDate: "2026-01-01", endDate: "2027-01-01" }];
      const history = vehicleOwnerHistory(rows);
      assert.equal(history.length, 2); assert.equal(history[0].customerId, "b");
      assert.equal(history[1].from, "2024-01-01"); assert.equal(history[1].to, "2026-01-01");
      assert.deepEqual(history[1].policyNumbers, ["POL-2", "POL-1"]);
      assert.equal(rows[0].id, "1");
      assert.deepEqual(vehicleOwnerHistory([]), []);
    });
    await t.test("policy single-field PUT retains nonvisible cover/package and finance settings", () => {
      const current={insuranceCompanyId:"carrier",producerId:"producer",policyType:"Auto",startDate:"2026-01-01",endDate:"2026-12-31",premium:100,currency:"EUR",status:"Active",coverCode:"COVER",packageCode:"PACKAGE",specialCommissionPercent:15,paidDirectlyToCarrier:false,vehicleRegistrationPlate:"ABC1234",id:"NO"};
      const result=policyCorePayload(current,{premium:"0"}); assert.equal(result.premium,0); assert.equal("id" in result,false);
      for(const key of ["coverCode","packageCode","specialCommissionPercent","paidDirectlyToCarrier","vehicleRegistrationPlate"]) assert.equal(result[key],current[key]);
      assert.equal("delivered" in result,false);
      assert.deepEqual(policyPreservedAmounts({netPremium:75,vatAmount:25,stampDutyAmount:0,insuranceContributionAmount:2,otherChargesAmount:null}),{netPremium:75,vatAmount:25,stampDutyAmount:0,insuranceContributionAmount:2,otherChargesAmount:null});
      for(const changes of [{startDate:"2026-02-30"},{endDate:"2025-01-01"},{premium:"-1"},{premium:""}]) assert.throws(()=>policyCorePayload(current,changes));
    });
    await t.test("green card defaults use contract vehicle fields and safely handle missing legacy JSON", async () => {
      const { greenCardVehicleDefaults } = await server.ssrLoadModule("/src/components/profile/greenCardVehicleDefaults.ts");
      assert.deepEqual(greenCardVehicleDefaults({ vehicleRegistrationPlate:" ABC1234 ", specsJson:'{"make":"Toyota","model":"Yaris","vin":"VIN1"}' }),
        { vehicleRegistrationPlate:"ABC1234", vehicleMakeModel:"Toyota Yaris", vehicleVin:"VIN1" });
      assert.equal(greenCardVehicleDefaults({specsJson:'{"vehicle":{"make":"Ford","model":"Focus","vin":"VIN2"}}'}).vehicleVin,"VIN2");
      for(const specsJson of [null,"broken","[]","null"]) assert.deepEqual(greenCardVehicleDefaults({specsJson}),{vehicleRegistrationPlate:"",vehicleMakeModel:"",vehicleVin:""});
    });
    await t.test("lifecycle history renders real policy events rather than audit changes", async () => {
      const { PolicyHistoryTable } = await server.ssrLoadModule("/src/components/PolicyLifecyclePanel.tsx");
      const rows = ["Initial","Renewal","Endorsement","Cancellation"].map((kind,index)=>({id:String(index),policyId:"p",kind,date:"2026-01-01",number:"EVENT"+index,policyNumber:"POL1",status:kind==="Cancellation"?"Effective":"Active",amount:kind==="Cancellation"?-30:100,currency:"EUR"}));
      const html = render(PolicyHistoryTable,{rows,currentPolicyId:"p"});
      for(const label of ["Αρχικό ασφαλιστήριο","Ανανέωση","Πρόσθετη πράξη","Ακύρωση","-30,00","Σε ισχύ"]) assert.equal(html.includes(label),true,label);
      const source = await readFile(new URL("../PolicyDetailDrawer.tsx",import.meta.url),"utf8");
      assert.doesNotMatch(source,/EntityAuditTimeline/); assert.match(source,/<PolicyLifecyclePanel/);
    });
    await t.test("producer financial balances keep currencies separate and reuse copyable client fields", async () => {
      const { ProducerBalanceSummary } = await server.ssrLoadModule("/src/components/ProducerBalancesPanel.tsx");
      const html = render(ProducerBalanceSummary,{currencies:[{currency:"EUR",earned:100,paid:40,toProducer:60,fromProducer:0},{currency:"USD",earned:50,paid:80,toProducer:0,fromProducer:30}]});
      for(const label of ["100,00 EUR","60,00 EUR","30,00 USD","Αντιγραφή Οφειλή προς συνεργάτη"]) assert.equal(html.includes(label),true,label);
      assert.equal(html.includes("<input"),false);
    });
    await t.test("policy coverage entry is catalogue-driven and editing opens in a modal", async () => {
      const source = await readFile(new URL("../PolicyDetailDrawer.tsx",import.meta.url),"utf8");
      const covers=source.slice(source.indexOf("function PolicyCoversTabInner"),source.indexOf("function BulkCoversImportDialog"));
      assert.match(covers,/Προσθήκη νέας κάλυψης/); assert.match(covers,/<Autocomplete[^]*options=\{catalogue.coverages\}/);
      assert.match(covers,/<Dialog open=\{coverDialogOpen/); assert.match(covers,/<CatalogueItemDialog/); assert.match(covers,/defaultKind="Coverage" lockKind/);
      assert.equal(covers.slice(0,covers.indexOf("<Dialog open={coverDialogOpen")).includes('<TextField'),false);
      assert.match(covers,/setCoverDialogOpen\(true\)/);
    });
  } finally { client.clear(); await server.close(); }
});
