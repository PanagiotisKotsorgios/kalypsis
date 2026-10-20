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

test("document folders page and legacy route no longer exist", async () => {
  const documents = await readFile(new URL("./DocumentsPage.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

  assert.equal(documents.includes("DocumentManagerPage"), false);
  assert.equal(documents.includes("tab=folders"), false);
  assert.equal(documents.includes("Φάκελοι εγγράφων"), false);
  assert.equal(app.includes('path="document-manager"'), false);
  assert.equal(app.includes("documents?tab=folders"), false);
});
