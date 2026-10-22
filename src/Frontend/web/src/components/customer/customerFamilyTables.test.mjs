import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile } from "node:fs/promises";
import { filterCustomerNeeds, filterFamilyMembers, matchesFamilySearch } from "./customerFamilyData.ts";

const needs = [
  { id: "1", kind: "Home", title: "Κατοικία Αθήνας", hasAsset: true, isInsured: false, priority: 3, nextContactAt: "2026-12-01", notes: "Εξοχικό" },
  { id: "2", kind: "Vehicle", title: "ΙΒΧ 1234", hasAsset: true, isInsured: true, priority: 1, nextContactAt: null, notes: null },
  { id: "3", kind: "Health", title: "Υγεία", hasAsset: true, isInsured: false, priority: 5, nextContactAt: null, notes: "Οικογένεια" },
];
const members = [
  { relationshipId: "rel1", customerId: "cust1", displayName: "Μαρία Παπαδοπούλου", customerType: "Individual", relationshipType: "Spouse", notes: "Σχέση", policies: [{ id: "p1", policyNumber: "ABC-123", policyType: "Auto", status: "Active", startDate: "2026-01-01", endDate: "2027-01-01", premium: 123, currency: "EUR" }], needs },
  { relationshipId: "rel2", customerId: "cust2", displayName: "Νίκος Παπαδόπουλος", customerType: "Individual", relationshipType: "Child", notes: null, policies: [], needs: [needs[1]] },
];

test("family popup keeps editable needs and related customers, but never renders the redundant recommendation card", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  try {
    const { FamilyNeedsTab } = await server.ssrLoadModule("/src/pages/CustomerDetailPage.tsx");
    for(const opportunities of [[],[{customerId:"cust1",customerName:"Recommendation should not render",needKind:"Home",needTitle:"Hidden proposal",reason:"Proposal reason",priority:5}]]) {
      const data={profile:{id:"family-test",displayName:"Πελάτης"},needs,family:members,opportunities};
      const before=structuredClone(data);
      client.setQueryData(["customer-family","family-test"],data);
      const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(FamilyNeedsTab,{customerId:"family-test"})));
      assert.equal((html.match(/<table\b/g)??[]).length,2);
      for(const text of ["Περιουσία και ανάγκες ασφάλισης","Οικογένεια και συνδεδεμένοι πελάτες","Νέα ανάγκη","Έχει σπίτι","Έχει όχημα","Υγεία","Σύνδεση μέλους","Κατοικία Αθήνας","Επεξεργασία Κατοικία Αθήνας","Μαρία Παπαδοπούλου"]) assert.ok(html.includes(text),text);
      for(const removed of ["Προτεινόμενες καλύψεις","Παράγονται από την καταχωρημένη","Δεν υπάρχουν ανοικτές προτάσεις","Hidden proposal","Recommendation should not render"]) assert.ok(!html.includes(removed),removed);
      assert.deepEqual(client.getQueryData(["customer-family","family-test"]),before);
    }
    const source=await readFile(new URL("../../pages/CustomerDetailPage.tsx",import.meta.url),"utf8");
    assert.ok(!source.includes("OpportunitiesCard"));
    const growth=await readFile(new URL("../../pages/ProductionGrowthPage.tsx",import.meta.url),"utf8");
    assert.ok(growth.includes('"/production-growth"')); assert.ok(growth.includes("Λίστες αύξησης παραγωγής"));
  } finally {client.clear();await server.close();}
});

test("asset filters combine type and insurance state without changing source records", () => {
  const before = structuredClone(needs);
  assert.deepEqual(filterCustomerNeeds(needs, "Home", "uninsured").map(row => row.id), ["1"]);
  assert.deepEqual(filterCustomerNeeds(needs, "Home", "insured"), []);
  assert.deepEqual(filterCustomerNeeds(needs, "", "insured").map(row => row.id), ["2"]);
  assert.deepEqual(filterCustomerNeeds(needs, "", ""), needs);
  assert.deepEqual(needs, before);
  assert.ok(matchesFamilySearch("Κατοικία Αθήνας — Εξοχικό", "κατοικια αθηνας"));
  assert.ok(matchesFamilySearch("ΙΒΧ 1234", " 1234 "));
  assert.ok(!matchesFamilySearch("Κατοικία", "υγεία"));
});

test("family filters preserve all related policies and needs and support uncovered cases", () => {
  assert.deepEqual(filterFamilyMembers(members, "", "policies"), [members[0]]);
  assert.deepEqual(filterFamilyMembers(members, "Child", "uninsured"), []);
  assert.deepEqual(filterFamilyMembers(members, "Spouse", "uninsured"), [members[0]]);
  assert.equal(filterFamilyMembers(members, "", "needs").length, 2);
  assert.equal(filterFamilyMembers(members, "", "")[0].policies[0].policyNumber, "ABC-123");
});

test("large customer family datasets render compact paginated tables with intact action controls", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  try {
    const { CustomerNeedsTable, FamilyMembersTable } = await server.ssrLoadModule("/src/components/customer/CustomerFamilyTables.tsx");
    const manyNeeds = Array.from({ length: 127 }, (_, index) => ({ ...needs[index % needs.length], id: `need-${index}`, title: `Ανάγκη ${index}` }));
    const manyMembers = Array.from({ length: 92 }, (_, index) => ({ ...members[index % members.length], relationshipId: `relation-${index}`, customerId: `customer-${index}`, displayName: `Μέλος ${index}` }));
    for (const [Component, props, count] of [[CustomerNeedsTable, { needs: manyNeeds, onEdit() {}, onDelete() {} }, 127], [FamilyMembersTable, { members: manyMembers, onRemove() {} }, 92]]) {
      const html = renderToStaticMarkup(createElement(Component, props));
      const body = html.match(/<tbody\b[\s\S]*?<\/tbody>/)?.[0] ?? "";
      assert.equal((body.match(/<tr\b/g) ?? []).length, 5);
      assert.ok(html.includes(`${count} εγγραφές`));
      assert.ok(html.includes(`1–5 από ${count}`));
      assert.ok(html.includes("Αναζήτηση"));
      assert.ok(html.includes("Ενέργειες"));
      assert.ok(body.includes(Component === CustomerNeedsTable ? "Επεξεργασία Ανάγκη 0" : "Προβολή Μέλος 0"));
    }
  } finally { await server.close(); }
});
