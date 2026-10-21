import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = name => readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("customer actions include exports, printing, columns and filters", async () => {
  const source = await read("CustomersPage.tsx");
  for (const label of ["Ενέργειες", "Αποθήκευση νέου φίλτρου", "Εξαγωγή CSV", "Εξαγωγή Excel", "Εκτύπωση", "Στήλες εξαγωγής", "Φίλτρα πελατών"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /hideActionButtons/);
});

test("vehicle and producer pages expose consolidated colored actions", async () => {
  const [vehicles, producers] = await Promise.all([read("CustomerVehiclesPage.tsx"), read("ProducersPage.tsx")]);
  for (const source of [vehicles, producers]) {
    assert.match(source, /setActionsAnchor\(event\.currentTarget\)[\s\S]{0,180}Ενέργειες/);
    assert.match(source, /Αποθήκευση νέου φίλτρου/);
    assert.match(source, /Εξαγωγή/);
    assert.match(source, /Εκτύπωση/);
  }
  assert.match(producers, /Στήλες εξαγωγής/);
  assert.match(producers, /Σύνθετα φίλτρα/);
});

test("policy lifecycle navigation is separate from record actions", async () => {
  const source = await read("PoliciesPage.tsx");
  assert.match(source, /Ενότητες συμβολαίων/);
  assert.match(source, /to="\/app\/renewals"/);
  assert.match(source, /to="\/app\/endorsements"/);
  assert.match(source, /to="\/app\/cancellations"/);
  assert.match(source, /data-tour="policies-actions"/);
  assert.match(source, /Στήλες εξαγωγής/);
  assert.match(source, /hideActionButtons/);
});

test("over-commission statements use one actions menu", async () => {
  const source = await read("OverCommissionStatementsPage.tsx");
  for (const label of ["Ενέργειες", "Νέα εγγραφή", "Μαζική καταχώρηση", "Στατιστικά", "Αποθήκευση νέου φίλτρου", "Εξαγωγή CSV", "Εξαγωγή Excel", "Εκτύπωση", "Στήλες εκτύπωσης & εξαγωγής"]) {
    assert.match(source, new RegExp(label, "i"));
  }
  assert.match(source, /Ρυθμίσεις υπερπρομηθειών/);
});

test("table toolbar accepts external actions without duplicate buttons", async () => {
  const [toolbar, picker] = await Promise.all([
    readFile(new URL("../components/TableToolbar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ExportColumnPicker.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(toolbar, /actionRequest\?:/);
  assert.match(toolbar, /hideActionButtons\?: boolean/);
  assert.match(toolbar, /actionRequest\.action === "columns"/);
  assert.match(picker, /openRequestToken/);
});

test("core record lists keep count in the heading and page size in the footer", async () => {
  const pages = await Promise.all([
    "CustomersPage.tsx",
    "PoliciesPage.tsx",
    "ClaimsPage.tsx",
    "ProducersPage.tsx",
    "ReceiptsPage.tsx",
  ].map(read));

  for (const source of pages) {
    assert.match(source, /<RecordCountChip count=\{table\.filtered\.length\}/);
    assert.match(source, /<NumberedPager[\s\S]{0,260}onPageSize=\{table\.setPageSize\}/);
  }

  const policies = pages[1];
  assert.doesNotMatch(policies, /quickFiltersOpen|policyQuickFilters/);
  assert.match(policies, /setAdvancedFiltersOpen\(true\)/);
});
