import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";

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
    const { PolicyProfileFields, PolicyPremiumFields } = await server.ssrLoadModule("/src/components/PolicyDetailDrawer.tsx");
    const { vehicleOwnerHistory } = await server.ssrLoadModule("/src/components/profile/vehicleHistory.ts");
    const { ProducerProfileFields } = await server.ssrLoadModule("/src/components/ProducerDetailDrawer.tsx");
    const { ClaimProfileFields } = await server.ssrLoadModule("/src/components/ClaimDetailDrawer.tsx");
    const { mergeVehicleSpecs, VEHICLE_SPEC_FIELDS } = await server.ssrLoadModule("/src/components/profile/vehicleProfile.ts");
    const { producerUpdatePayload, PRODUCER_FIELDS } = await server.ssrLoadModule("/src/components/profile/producerProfile.ts");
    const { claimUpdatePayload } = await server.ssrLoadModule("/src/components/profile/claimProfile.ts");
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
    await t.test("policy General retains field order, readonly computed values and actual edit/save controls", () => {
      const policy={policyNumber:"POL1",customerDisplay:"Πελάτης",customerVat:"012345678",insuranceCompanyId:"carrier",insuranceCompanyName:"Ασφαλιστική",producerName:"Συνεργάτης",startDate:"2026-01-01",endDate:"2026-12-31"};
      const values={...policy,status:"Active",policyType:"Auto",premium:"100",currency:"EUR"};
      const {view,edit}=layout(PolicyProfileFields,{policy,values,session:session(values),companies:[],customers:[]});
      assert.equal(view.includes("Επεξεργασία Έναρξη"),true); assert.equal(edit.includes("Αποθήκευση Έναρξη"),true);
      assert.equal(edit.includes("Αποθήκευση Διάρκεια"),false); assert.equal(edit.includes("Αποθήκευση Αριθμός συμβολαίου"),false);
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
      assert.match(view, /minmax\(min\(100%, 300px\), 1fr\)/);
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
  } finally { client.clear(); await server.close(); }
});
