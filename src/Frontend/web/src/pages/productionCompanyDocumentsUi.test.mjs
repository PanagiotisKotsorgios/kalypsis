import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const documentsSource = await readFile(new URL("./DocumentsPage.tsx", import.meta.url), "utf8");
const companiesSource = await readFile(new URL("./ProductionCompaniesAgenciesPage.tsx", import.meta.url), "utf8");

test("document details use the shared centred profile-dialog presentation", () => {
  assert.match(documentsSource, /<DocumentPreviewDialog/);
  assert.match(documentsSource, /function DocumentPreviewDialog/);
  assert.match(documentsSource, /maxWidth="lg"/);
  assert.match(documentsSource, /bgcolor: "#0b305c"/);
  assert.match(documentsSource, /Κλείσιμο καρτέλας εγγράφου/);
  assert.doesNotMatch(documentsSource, /<Drawer\s/);
});

test("company directory is paginated without losing the existing table actions", () => {
  const section = companiesSource.slice(
    companiesSource.indexOf("function CompanyDirectoryTable"),
    companiesSource.indexOf("function EmptyDirectory"),
  );
  assert.match(section, /companies\.slice\(safePage \* rowsPerPage/);
  assert.match(section, /<TablePagination/);
  assert.match(section, /rowsPerPageOptions=\{\[10, 25, 50, 100\]\}/);
  assert.match(section, /onOpen\(company\)/);
  assert.match(section, /onEdit\(company\)/);
  assert.match(section, /onDelete\(company\)/);
});

test("communication filters cannot collapse and connection details share one row", () => {
  assert.match(companiesSource, /maxWidth="xl"[\s\S]*?Τελευταίες επικοινωνίες/);
  assert.match(companiesSource, /minmax\(300px,1fr\) minmax\(210px,\.55fr\) minmax\(210px,\.55fr\)/);
  assert.equal((companiesSource.match(/InputLabelProps=\{\{ shrink: true \}\}/g) ?? []).length >= 3, true);
  assert.match(companiesSource, /repeat\(3, minmax\(0, 1fr\)\)/);
  for (const label of ["Πηγή γέφυρας", "Κατάσταση", "Δημιουργήθηκε"]) assert.match(companiesSource, new RegExp(label));
});
