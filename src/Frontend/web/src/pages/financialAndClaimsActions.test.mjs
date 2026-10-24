import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readPage = name => readFile(new URL(`./${name}`, import.meta.url), "utf8");
const readComponent = name => readFile(new URL(`../components/${name}`, import.meta.url), "utf8");

test("claims and claims support pages use the unified actions menu", async () => {
  const pages = await Promise.all([
    "ClaimsPage.tsx", "GaragesPage.tsx", "ClaimIndemnitiesPage.tsx", "FriendlySettlementsPage.tsx",
  ].map(readPage));
  for (const source of pages) {
    assert.match(source, /UnifiedActionsMenu/);
    assert.match(source, /onSaveFilter/);
    assert.match(source, /onExport/);
    assert.match(source, /SavedReportsButton/);
  }
  assert.match(pages[0], /hideActionButtons/);
  assert.match(pages[0], /onFilters=\{!isCustomer \? \(\) => setAdvancedFiltersOpen\(true\) : undefined\}/);
  assert.doesNotMatch(pages[0], /QuickFilterBar|quickFiltersOpen|ResponsiveFilterPanel/);
  assert.doesNotMatch(pages[1], /startIcon=\{<DownloadIcon/);
  assert.doesNotMatch(pages[2], /startIcon=\{<DownloadIcon/);
  assert.doesNotMatch(pages[3], /startIcon=\{<DownloadIcon/);
});

test("receipts and payments expose exports and columns through one menu", async () => {
  const pages = await Promise.all(["ReceiptsPage.tsx", "PaymentsPage.tsx"].map(readPage));
  for (const source of pages) {
    assert.match(source, /UnifiedActionsMenu/);
    if(source.includes("snapshotExport")) {
      assert.match(source,/TableToolbar[\s\S]*hideActionButtons[\s\S]*snapshotExport/);
      assert.match(source,/exportRows=\{table.filtered\}/);
      assert.match(source,/actionRequest=\{exportAction\}/);
    } else assert.match(source, /DataExportButton[\s\S]{0,180}actionRequest=\{exportAction\}[\s\S]{0,80}hideButton/);
    assert.match(source, /SavedReportsButton/);
    assert.match(source, /saveRequestToken=\{saveFilterRequest\}/);
    assert.match(source, /openRequestToken=\{columnsRequest\}/);
    assert.match(source, /ColumnPreferencesButton[\s\S]{0,600}hideButton/);
  }
});

test("shared export and column controls support external menu commands", async () => {
  const [exports, columns, menu] = await Promise.all([
    readComponent("DataExportButton.tsx"),
    readComponent("ColumnPreferencesButton.tsx"),
    readComponent("UnifiedActionsMenu.tsx"),
  ]);
  assert.match(exports, /actionRequest\?:/);
  assert.match(exports, /hideButton\?: boolean/);
  assert.match(columns, /openRequestToken\?: number/);
  assert.match(columns, /hideButton\?: boolean/);
  for (const label of ["Ενέργειες", "Αποθήκευση νέου φίλτρου", "Εξαγωγή CSV", "Εξαγωγή Excel", "Εκτύπωση", "Στήλες πίνακα"]) {
    assert.match(menu, new RegExp(label));
  }
});
