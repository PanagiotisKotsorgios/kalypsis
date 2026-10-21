import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { defaultProductionListFilters } from "./productionListFilters.ts";

test("clearing a saved production filter restores fresh defaults without keeping previous criteria", () => {
  const today = new Date(2026, 9, 21, 1, 15);
  const initial = defaultProductionListFilters(today);
  assert.equal(initial.from, "2026-10-01"); assert.equal(initial.to, "2026-10-21");
  const active = { ...initial, insuranceCompanyId: "carrier", producerId: "producer", status: "Active", coverCode: "GLASS", groupBy: "producer", dateField: "issued" };
  const reset = defaultProductionListFilters(today);
  for (const key of ["insuranceCompanyId", "producerId", "policyType", "vehicleUseCategory", "coverCode", "packageCode", "status"]) assert.equal(reset[key], "", key);
  assert.equal(reset.groupBy, "carrier"); assert.equal(reset.dateField, "start");
  assert.equal(active.coverCode, "GLASS"); assert.notEqual(reset, initial);
  const nextSaved = { ...defaultProductionListFilters(today), status: "Expired" };
  assert.equal(nextSaved.insuranceCompanyId, ""); assert.equal(nextSaved.producerId, "");
  assert.equal(defaultProductionListFilters(new Date(2026, 10, 2)).from, "2026-11-01");
});

test("production saved-filter reset clears selection and restores the button without deleting storage", async () => {
  const source = await readFile(new URL("./ProductionListsPage.tsx", import.meta.url), "utf8");
  const saved = await readFile(new URL("../components/SavedReportsButton.tsx", import.meta.url), "utf8");
  assert.match(source, /onClear=\{clearFilters\} clearRequestToken=\{clearSavedFilterRequest\}/);
  assert.match(source, /onClick=\{clearFilters\}/);
  assert.match(source, /setF\(defaultProductionListFilters\(\)\)/);
  assert.match(source, /setClearSavedFilterRequest\(value => value \+ 1\)/);
  assert.match(source, /setF\(\{ \.\.\.defaultProductionListFilters\(\), \.\.\.next \}\)/);
  const reset=saved.slice(saved.indexOf("const clearSelection"), saved.indexOf("const q ="));
  assert.match(reset, /setActiveId\(null\)/); assert.match(reset, /setAnchor\(null\)/); assert.match(reset, /onClear\?\.\(\)/);
  assert.doesNotMatch(reset, /api\.|del\.mutate/);
  assert.match(saved, /onClear && <MenuItem selected=\{!activeId\} onClick=\{clearSelection\}/);
  assert.match(saved, /Χωρίς αποθηκευμένο φίλτρο \(προεπιλογή\)/);
  assert.match(saved, /activeName \?\? \(compact \? "Έτοιμα φίλτρα" : inline \? "Όνομα νέου φίλτρου" : "Αποθηκευμένα"\)/);
  assert.match(saved, /\[entity, clearRequestToken\]/);
});

test("production list keeps a single green coverage action and removes redundant columns", async () => {
  const source = await readFile(new URL("./ProductionListsPage.tsx", import.meta.url), "utf8");

  assert.equal(source.includes('key: "check"'), false);
  assert.equal(source.includes('key: "totals"'), false);
  assert.equal(source.includes('label: "Έλεγχος"'), false);
  assert.equal(source.includes('label: "Σύνολα"'), false);
  assert.equal(source.includes("καλύψεις`"), false);
  assert.match(source, /key: "cover"[\s\S]*?variant="contained"[\s\S]*?color="success"[\s\S]*?>\s*Καλύψεις\s*<\/Button>/);
  assert.match(source, /onClick=\{\(\) => setCoveragePolicyId\(r\.policyId\)\}/);
  assert.match(source, /open=\{coveragePolicyId !== null\}/);
  assert.equal(source.includes('t("productionList.filters")'), false);
  assert.equal(source.includes('<FilterAltIcon color="primary" fontSize="small" />'), false);
});

test("production filters collapse early and their visible fields are user configurable", async () => {
  const source = await readFile(new URL("./ProductionListsPage.tsx", import.meta.url), "utf8");
  const picker = await readFile(new URL("../components/FilterVisibilityPicker.tsx", import.meta.url), "utf8");
  const responsivePanel = await readFile(new URL("../components/ResponsiveFilterPanel.tsx", import.meta.url), "utf8");

  assert.match(source, /compactAt="xl"/);
  assert.match(source, /compactButtonPlacement="external"/);
  assert.match(source, /compactOpen=\{compactFiltersOpen\}/);
  assert.match(source, /onCompactOpenChange=\{setCompactFiltersOpen\}/);
  assert.match(source, /onClick=\{\(\) => setCompactFiltersOpen\(true\)\}/);
  assert.match(source, /bgcolor: "#159b59"/);
  assert.match(source, /color: "#fff"/);
  assert.equal(source.includes('justifyContent="flex-end" mt={1.5}'), false);
  assert.match(responsivePanel, /compactButtonPlacement\?: "panel" \| "external"/);
  assert.match(responsivePanel, /controlledCompactOpen \?\? internalCompactOpen/);
  assert.match(source, /useFilterVisibility\("production-lists", PRODUCTION_FILTERS\)/);
  assert.equal(source.includes("<QuickFilterBar"), false);
  assert.equal(source.includes("quickFiltersOpen"), false);
  assert.equal(source.includes("<FilterVisibilityPicker"), false);
  assert.match(source, /setFilterSettingsOpen\(true\)/);
  assert.match(source, /setColumnSettingsOpen\(true\)/);
  assert.match(source, /setActionsAnchor\(event\.currentTarget\)/);
  assert.match(source, /downloadExport\("csv"\)/);
  assert.match(source, /downloadExport\("xlsx"\)/);
  assert.match(source, /downloadExport\("pdf"\)/);
  assert.match(source, /Αποθήκευση νέου φίλτρου/);
  assert.match(source, /setSaveFilterRequest\(value => value \+ 1\)/);
  assert.match(source, /saveRequestToken=\{saveFilterRequest\}/);
  assert.match(source, /#087f73/);
  assert.match(source, /#167c45/);
  assert.match(source, /#c73545/);
  for (const key of ["dateField", "from", "to", "carrier", "producer", "type", "use", "coverage", "package", "status", "groupBy"]) {
    assert.match(source, new RegExp(`filterVisibility\\.visible\\("${key}"\\)`));
  }
  assert.match(picker, /localStorage\.setItem/);
  assert.match(picker, /Εμφανιζόμενα φίλτρα/);
  for (const label of ["Ημερομηνία Έκδοσης", "Ημερομηνία Έναρξης", "Ημερομηνία Καταχώρησης"]) {
    assert.match(source, new RegExp(label));
  }
});

test("company workspace tabs follow the requested operational order", async () => {
  const source = await readFile(new URL("./ProductionCompaniesAgenciesPage.tsx", import.meta.url), "utf8");
  const tabs = source.slice(source.indexOf("const SPLIT_WORKSPACE_TAB_LABELS"), source.indexOf("export function WorkspaceProfileTabs"));
  const positions = ["Γενικά", "Επικοινωνία", "Παραγωγή", "Παραμετρικά", "Έγγραφα", "Πεδία"].map(label => tabs.indexOf(`label: "${label}"`));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(source, />Εταιρείες &amp; Πρακτορεία</);
  assert.match(source, /Λειτουργική εικόνα ασφαλιστικών εταιρειών και συνεργαζόμενων πρακτορείων\./);
  assert.equal(source.includes("Εταιρείες &amp; Πρακτορεία Παραγωγής"), false);
  assert.equal(source.includes("παραγωγή, συμβόλαια, ζημιές, επαφές και υπεύθυνοι"), false);
});

test("production exports use the office heading and the selected table grouping", async () => {
  const page = await readFile(new URL("./ProductionListsPage.tsx", import.meta.url), "utf8");
  const handler = await readFile(new URL("../../../../Backend/Kalypsis.Application/Features/ProductionLists/ProductionListsHandlers.cs", import.meta.url), "utf8");
  const formatter = await readFile(new URL("../../../../Backend/Kalypsis.Application/Common/Exports/ExportFormatter.cs", import.meta.url), "utf8");

  assert.match(page, /title: officeProfile\.data\?\.name\?\.trim\(\) \|\| "Λίστες παραγωγής"/);
  assert.match(page, /params: \{ \.\.\.params, format: fmt, columns: columnsParam \}/);
  assert.match(handler, /BuildSelectedSheetAsync\(rows, q\.Columns \?\? "", q\.Filters, ct\)/);
  assert.equal(handler.includes('("vat", "Φόρος ασφαλίστρων")'), false);
  assert.equal(handler.includes("Gross,Net,VAT"), false);
  assert.match(handler, /GroupForExport\(rows, filters\.GroupBy\)/);
  for (const group of ["carrier", "producer", "type", "month"]) {
    assert.match(handler, new RegExp(`"${group}" =>`));
  }
  assert.match(handler, /HeaderTitle: string\.IsNullOrWhiteSpace\(label\) \? "Λίστες παραγωγής" : label/);
  assert.match(formatter, /string\? HeaderTitle = null/);
  assert.match(formatter, /sheet\.HeaderTitle/);
});

test("document folders page and legacy route no longer exist", async () => {
  const documents = await readFile(new URL("./DocumentsPage.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

  assert.equal(documents.includes("DocumentManagerPage"), false);
  assert.equal(documents.includes("tab=folders"), false);
  assert.equal(documents.includes("Φάκελοι εγγράφων"), false);
  assert.equal(app.includes('path="document-manager"'), false);
  assert.equal(app.includes("documents?tab=folders"), false);
});
