import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

  assert.match(source, /compactAt="xl"/);
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
  for (const key of ["dateField", "from", "to", "carrier", "producer", "type", "use", "coverage", "package", "status", "groupBy"]) {
    assert.match(source, new RegExp(`filterVisibility\\.visible\\("${key}"\\)`));
  }
  assert.match(picker, /localStorage\.setItem/);
  assert.match(picker, /Εμφανιζόμενα φίλτρα/);
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
