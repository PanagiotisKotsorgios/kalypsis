import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFile } from "node:fs/promises";
import { defaultGrowthFilters, filterGrowthRows, normalizeGrowthFilters, growthGroupLabel, groupGrowthRows, growthFilterError, growthFilterSummary, growthExportColumns, GROWTH_INSURANCE_LABELS } from "./productionGrowth.ts";
import { buildTableExportSnapshot } from "../utils/tableExportSnapshot.ts";
import { printTable } from "../utils/printableTable.ts";

const home = {
  id: "home", needId: "home", customerId: "1", customerNumber: "C-1", customerName: "Μαρία Παπαδοπούλου", customerType: "Individual", customerStatus: "Active",
  city: "Αθήνα", occupation: "Υπάλληλος", email: "test@example.gr", phone: "2101234567", needKind: "Home", needTitle: "Εξοχικό", hasAsset: true,
  isInsured: false, priority: 5, nextContactAt: "2026-10-22", notes: "Επανεπικοινωνία", isOpportunity: true, coverageState: "Uncovered",
  reason: "Καταχωρημένη ανάγκη χωρίς κάλυψη", assetKinds: ["Home", "Vehicle"], activePolicyTypes: ["Auto"], activePolicyCount: 1,
  producers: [{ id: "p1", name: "Συνεργάτης Α" }], family: [{ customerId: "2", name: "Νίκος", relationship: "Child" }],
};
const health = { ...home, id: "health", needId: "health", customerId: "2", customerName: "Νίκος", city: "Πάτρα", needKind: "Health", needTitle: "Υγεία", coverageState: "DeclaredInsured", isInsured: true, isOpportunity: false, priority: 3, nextContactAt: null, producers: [{ id: "p2", name: "Συνεργάτης Β" }], assetKinds: ["Health"], activePolicyTypes: [], family: [] };
const unknown = { ...health, id: "unknown", customerId: "3", needId: null, needKind: null, needTitle: "Δεν έχουν καταχωρηθεί ανάγκες", hasAsset: null, isInsured: null, coverageState: "Unknown", priority: 0 };
const rows = [home, health, unknown];
const filters = overrides => ({ ...defaultGrowthFilters(), ...overrides });

test("default list shows actual opportunities; all-data view preserves insured and unknown clients", () => {
  assert.deepEqual(filterGrowthRows(rows, filters()), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ view: "all" })), rows);
  assert.deepEqual(filterGrowthRows(rows, filters({ view: "all", coverageStates: ["Unknown"] })), [unknown]);
});
test("multi-selection uses OR per field and AND across needs, assets, active policies and partners", () => {
  assert.deepEqual(filterGrowthRows(rows, filters({ kinds: ["Life", "Home"], assetKinds: ["Vehicle"], activePolicyTypes: ["Auto"], producerIds: ["p2", "p1"] })), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ kinds: ["Home"], activePolicyTypes: ["Health"] })), []);
  assert.deepEqual(filterGrowthRows(rows, filters({ view: "all", cities: ["Πάτρα", "Αθήνα"], customerStatuses: ["Active"] })), rows);
  assert.deepEqual(filterGrowthRows(rows, filters({ search: "παπαδοπουλου" })), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ search: "Νίκος" })), [home]);
});
test("follow-up dates, priority and family filters combine without changing stored data", () => {
  const before = structuredClone(rows);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactFrom: "2026-10-22", contactTo: "2026-10-22", priorityMin: "5", family: "with" })), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactState: "due" }), "2026-10-22"), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactState: "future" }), "2026-10-21"), [home]);
  assert.deepEqual(filterGrowthRows(rows, filters({ contactState: "unscheduled" })), []);
  assert.deepEqual(filterGrowthRows(rows, filters({ family: "without" })), []);
  assert.deepEqual(rows, before);
});
test("saved filters retain multiple values and dates, reject malformed values, and support Greek grouping", () => {
  const saved = normalizeGrowthFilters({ kinds: ["Home", "Home", "Vehicle"], cities: ["Αθήνα"], contactFrom: "2026-10-01", view: "all", groupBy: "kind" });
  assert.deepEqual(saved.kinds, ["Home", "Vehicle"]);
  assert.equal(saved.contactFrom, "2026-10-01");
  assert.equal(saved.view, "all");
  assert.deepEqual(normalizeGrowthFilters({ kinds: "Home", view: "invalid", groupBy: "invalid" }), defaultGrowthFilters());
  assert.equal(growthGroupLabel(home, "kind"), "Ασφάλιση κατοικίας");
  assert.equal(growthGroupLabel(home, "producer"), "Συνεργάτης Α");
  assert.equal(growthGroupLabel(unknown, "kind"), "Χωρίς καταχωρημένες ανάγκες");
});
test("growth export keeps only matching clients and current grouping, not the source data or current page", () => {
  const selected = filters({ view: "all", cities: ["Αθήνα"], groupBy: "producer" });
  const filtered = filterGrowthRows(rows, selected);
  const snapshot = buildTableExportSnapshot("Λίστες αύξησης παραγωγής", [{ key: "customerName", label: "Πελάτης" }, { key: "needTitle", label: "Ανάγκη" }], filtered, undefined, row => growthGroupLabel(row, selected.groupBy));
  assert.deepEqual(snapshot.headers, ["Πελάτης", "Ανάγκη"]);
  assert.deepEqual(snapshot.rows, [["ΟΜΑΔΑ: Συνεργάτης Α · 1 εγγραφές", ""], ["Μαρία Παπαδοπούλου", "Εξοχικό"]]);
  assert.equal(snapshot.recordCount, 1);
  assert.ok(!JSON.stringify(snapshot).includes("Πάτρα"));
});
test("route and office-managed sidebar entry exist once per staff role, after production lists for admins", async () => {
  const source = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const admin = source.slice(source.indexOf("  AgencyAdmin: ["), source.indexOf("  AgencyUser: ["));
  assert.match(admin, /to: "\/production-lists"[^\n]+\n\s*\{ to: "\/production-growth"/);
  assert.equal((source.match(/to: "\/production-growth"/g) ?? []).length, 3);
  assert.match(source, /path="production-growth" element=\{<PackageGate package="BackOffice"><ProductionGrowthPage/);
  const sidebar = await readFile(new URL("../config/sidebarVisibility.ts", import.meta.url), "utf8");
  assert.equal((sidebar.match(/path: "\/production-growth"/g) ?? []).length, 1);
});
test("actual page renders compact paginated rows and exports the complete filtered result", async () => {
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/@mui\//] }, appType: "custom" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const { ProductionGrowthPage } = await server.ssrLoadModule("/src/pages/ProductionGrowthPage.tsx");
    const { AuthProvider } = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    await server.ssrLoadModule("/src/i18n/index.ts");
    client.setQueryData(["production-growth"], Array.from({ length: 82 }, (_, i) => ({ ...home, id: `need-${i}`, needId: `need-${i}`, customerId: `customer-${i}`, customerName: `Πελάτης ${i}` })));
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(AuthProvider, null, createElement(ProductionGrowthPage))));
    const body = html.match(/<tbody\b[\s\S]*?<\/tbody>/)?.[0] ?? "";
    assert.equal((body.match(/<tr\b/g) ?? []).length, 25);
    for (const text of ["82 εγγραφές", "Εξοχικό", "Πρόταση ασφάλισης", "Ασφάλιση κατοικίας", "overflow:auto"]) assert.ok(html.includes(text), text);
    assert.ok(body.includes("Καρτέλα"));
    const source = await readFile(new URL("./ProductionGrowthPage.tsx", import.meta.url), "utf8");
    for (const text of ["exportRows={displayRows}", "snapshotExport", 'compactAt="xl"', "normalizeGrowthFilters(value)"]) assert.ok(source.includes(text), text);
    assert.ok(source.includes("exportGroupBy={filters.groupBy ? row => growthGroupLabel(row, filters.groupBy) : undefined}"));
    assert.ok(source.includes("visibleColumnKeys={columns.visibleColumns.map(c => c.key)}"));
    assert.ok(!source.includes("estimatedCommission"));
  } finally { client.clear(); await server.close(); }
});

test("every filter dimension selects the expected persisted-model rows, including OR and AND combinations", () => {
  const inactive = { ...home, id:"inactive", customerStatus:"Inactive", nextContactAt:"2026-12-01", priority:2 };
  const noAsset = { ...health, id:"no-asset", hasAsset:false, coverageState:"NoAsset", assetKinds:[] };
  const active = { ...health, id:"active", coverageState:"ActivePolicy", activePolicyTypes:["Health"] };
  const source = [...rows,inactive,noAsset,active];
  const cases = [
    [{search:"ασφαλιση κατοικιας"},[home,inactive]], [{kinds:["Life","Home"]},[home,inactive]],
    [{view:"all",coverageStates:["DeclaredInsured","NoAsset"]},[health,noAsset]],
    [{cities:["Αθήνα"]},[home,inactive]], [{producerIds:["p1"]},[home,inactive]],
    [{customerStatuses:["Inactive"]},[inactive]], [{assetKinds:["Vehicle"]},[home,inactive]],
    [{view:"all",activePolicyTypes:["Health"]},[active]], [{family:"with"},[home,inactive]],
    [{priorityMin:"4"},[home]], [{contactFrom:"2026-12-01",contactTo:"2026-12-01"},[inactive]],
    [{contactState:"due"},[home]], [{contactState:"future"},[inactive]],
    [{view:"all",contactState:"unscheduled"},[health,unknown,noAsset,active]],
    [{cities:["Αθήνα"],kinds:["Health"]},[]],
  ];
  const before = structuredClone(source);
  for (const [criteria,expected] of cases) assert.deepEqual(filterGrowthRows(source,filters(criteria),"2026-10-23"),expected,JSON.stringify(criteria));
  assert.deepEqual(source,before);
});

test("saved criteria reject invalid scalar states and impossible dates and restore insured-state views coherently", () => {
  const result = normalizeGrowthFilters({family:"invalid",contactState:"invalid",priorityMin:"NaN",contactFrom:"2026-02-30",cities:[" Αθήνα ","",null,"Αθήνα"],coverageStates:["DeclaredInsured"],view:"opportunities"});
  assert.equal(result.family,""); assert.equal(result.contactState,""); assert.equal(result.priorityMin,""); assert.equal(result.contactFrom,"");
  assert.deepEqual(result.cities,["Αθήνα"]); assert.equal(result.view,"all");
  assert.deepEqual(filterGrowthRows(rows,result),[]); // valid city + state combination really has no match
  assert.ok(growthFilterError(filters({contactFrom:"2026-11-01",contactTo:"2026-10-01"})));
  assert.ok(growthFilterError(filters({contactFrom:"2026-02-30"})));
  assert.deepEqual(filterGrowthRows(rows,filters({contactFrom:"2026-11-01",contactTo:"2026-10-01"})),[]);
});

test("the real export columns and grouping freeze all matching rows, in display order, beyond pagination", () => {
  const source = Array.from({length:83},(_,index)=>({...home,id:`need-${index}`,customerNumber:`C-${index}`,needTitle:`Ακίνητο ${index}`,city:index%2 ? "Πάτρα":"Αθήνα",priority:index%5+1}));
  const criteria = filters({cities:["Αθήνα"],kinds:["Home"],groupBy:"customer"});
  const matching = filterGrowthRows(source,criteria).sort((a,b)=>b.priority-a.priority);
  const displayed = groupGrowthRows(matching,criteria.groupBy);
  assert.equal(displayed.length,42);
  const columns = ["need","customer","state"].map(key=>growthExportColumns.find(column=>column.key===key));
  const summary = growthFilterSummary(criteria,source);
  const snapshot = buildTableExportSnapshot("Λίστες αύξησης παραγωγής",columns,displayed,summary,row=>growthGroupLabel(row,criteria.groupBy));
  assert.deepEqual(snapshot.headers,["Προτεινόμενη ασφάλιση / ανάγκη","Πελάτης","Κατάσταση ασφάλισης"]);
  assert.equal(snapshot.recordCount,42); assert.equal(snapshot.rows.length,84);
  const data = snapshot.rows.filter(row=>!row[0].startsWith("ΟΜΑΔΑ:"));
  assert.deepEqual(data.map(row=>row[1]),displayed.map(row=>`${row.customerNumber} · ${row.customerName}`));
  assert.ok(data.every(row=>row[0].startsWith("Ασφάλιση κατοικίας · ")));
  assert.ok(snapshot.subtitle.includes("Πόλη: Αθήνα"));
  assert.ok(!JSON.stringify(snapshot).includes("Πάτρα"));
  assert.deepEqual(buildTableExportSnapshot("Κενή λίστα",columns,[],summary).rows,[]);
  assert.equal(Object.keys(GROWTH_INSURANCE_LABELS).length,10);
});

test("every selected criterion is represented in the same metadata for all export formats and printing", () => {
  const criteria = filters({search:"Μαρία",kinds:["Home"],coverageStates:["Uncovered"],cities:["Αθήνα"],producerIds:["p1"],customerStatuses:["Active"],assetKinds:["Vehicle"],activePolicyTypes:["Auto"],family:"with",priorityMin:"4",contactState:"due",contactFrom:"2026-10-01",contactTo:"2026-10-31",groupBy:"producer"});
  const text = growthFilterSummary(criteria,rows);
  for (const value of ["Μαρία","Ασφάλιση κατοικίας","Πρόταση ασφάλισης","Αθήνα","Συνεργάτης Α","Ενεργός","Όχημα","Αυτοκίνητο","Με συνδεδεμένα μέλη","4","Σήμερα / καθυστερημένη","2026-10-01","2026-10-31","Ανά συνεργάτη"]) assert.ok(text.includes(value),value);
});

test("the actual print engine receives all filtered groups and columns, safely escapes cells and prints once", () => {
  const previousDocument = globalThis.document;
  const events = new Map(); let prints = 0, focuses = 0, appended = false;
  const frame = { style:{},srcdoc:"",setAttribute(){},remove(){},addEventListener(event,handler){events.set(event,handler);},
    contentWindow:{document:{body:{children:[{}]}},focus(){focuses++;},print(){prints++;},addEventListener(){}} };
  globalThis.document = {createElement(tag){assert.equal(tag,"iframe");return frame;},body:{appendChild(node){assert.equal(node,frame);appended=true;}}};
  try {
    const source = Array.from({length:61},(_,index)=>({...home,id:`print-${index}`,needTitle:`Ακίνητο ${index}${index===0 ? " <script>test</script>" : ""}`}));
    const criteria = filters({cities:["Αθήνα"],groupBy:"kind"});
    const displayed = groupGrowthRows(filterGrowthRows([...source,health],criteria),criteria.groupBy);
    const columns = ["customer","need","state"].map(key=>growthExportColumns.find(column=>column.key===key));
    printTable({title:"Γραφείο δοκιμής",columns,rows:displayed,subtitle:growthFilterSummary(criteria,[...source,health]),groups:[{title:growthGroupLabel(home,"kind"),rows:displayed}]});
    assert.equal(appended,true); assert.ok(frame.srcdoc.includes("Γραφείο δοκιμής"));
    assert.ok(frame.srcdoc.includes("Πόλη: Αθήνα")); assert.ok(frame.srcdoc.includes("Ακίνητο 60"));
    assert.ok(frame.srcdoc.includes("&lt;script&gt;test&lt;/script&gt;")); assert.ok(!frame.srcdoc.includes("<script>test"));
    assert.ok(!frame.srcdoc.includes("Πάτρα"));
    assert.equal((frame.srcdoc.match(/C-1 · Μαρία Παπαδοπούλου/g)??[]).length,61);
    assert.ok(frame.srcdoc.indexOf("Πελάτης</th>")<frame.srcdoc.indexOf("Προτεινόμενη ασφάλιση / ανάγκη</th>"));
    events.get("load")(); events.get("load")();
    assert.equal(prints,1); assert.equal(focuses,1);
  } finally {globalThis.document = previousDocument;}
});

test("the page routes each export action to the same complete snapshot with selected-office printing", async () => {
  const source=await readFile(new URL("./ProductionGrowthPage.tsx",import.meta.url),"utf8");
  for (const expected of ['exportRows={displayRows}','exportColumns={growthExportColumns}','printSubtitle={growthFilterSummary(filters, allRows)}','printOfficeSource="export"','groupGrowthRows(table.filtered, filters.groupBy)','query.isLoading || query.isError || !!filterError']) assert.ok(source.includes(expected),expected);
  for (const old of ['Προτεινόμενες καλύψεις','Κατάσταση κάλυψης','Ενεργές καλύψεις','Ανά κάλυψη']) assert.ok(!source.includes(old),old);
  const toolbar=await readFile(new URL("../components/TableToolbar.tsx",import.meta.url),"utf8");
  for (const expected of ['downloadSnapshot("csv")','downloadSnapshot("xlsx")','downloadSnapshot("pdf")','const printRows = exportRows','groupTableExportRows(printRows, exportGroupBy)']) assert.ok(toolbar.includes(expected),expected);
});
