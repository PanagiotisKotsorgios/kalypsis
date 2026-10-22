import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STATEMENT_COLUMNS, DEFAULT_STATEMENT_COLUMNS, normalizeStatementColumns, statementSections, statementTableLines, statementExportSnapshot, statementOfficeTotal, statementDisplayedColumns } from "./overCommissionTable.ts";
import { printTable } from "../utils/printableTable.ts";

const record = (id, producerName, grossAmount, overrides = {}) => ({ id, producerName, producerCode: null, producerId: id,
  insuranceCompanyId: "carrier", insuranceCompanyName: "Ασφαλιστική", year: 2026, month: 10, grossAmount,
  netAmount: grossAmount, producerAmount: grossAmount / 2, officeAmount: grossAmount / 2, producerSharePercent: 50,
  currency: "EUR", reference: null, notes: null, paidOn: null, basePremiumsGross: 9999, basePremiumsNet: 8888,
  ...overrides });
const columns = STATEMENT_COLUMNS.filter(column => DEFAULT_STATEMENT_COLUMNS.includes(column.key));
const records = [record("z", "Ζήτα", 10), record("a", "Άλφα", 20, { paidOn: "2026-10-21" }), record("b", "Ζήτα", 5, { insuranceCompanyName: "Άλλη", month: 9 })];

for (const groupBy of ["none", "producer", "month", "carrier"]) {
  test(`every export freezes the visible ${groupBy} sections, record order, selected columns and subtotals`, () => {
    const filtered = records.filter(row => !row.paidOn);
    const before = structuredClone(records);
    const sections = statementSections(filtered, groupBy);
    const lines = statementTableLines(filtered, sections, columns);
    const snapshot = statementExportSnapshot(lines, columns, filtered.length, "Μόνο απλήρωτα");
    assert.equal(snapshot.recordCount, 2);
    assert.deepEqual(snapshot.headers, columns.map(column => column.label));
    assert.deepEqual(snapshot.rows, lines.map(line => line.cells));
    assert.deepEqual(lines.filter(line => line.record).map(line => line.record.id), (sections.length ? sections.flatMap(section => section.rows) : filtered).map(row => row.id));
    assert.equal(lines.filter(line => line.kind === "group").length, sections.length);
    assert.equal(lines.filter(line => line.kind === "subtotal").length, sections.length);
    assert.ok(snapshot.rows.every(row => row.length === columns.length));
    assert.ok(!JSON.stringify(snapshot).includes("Άλφα"));
    const total = lines.find(line => line.kind === "total");
    assert.match(total.cells[columns.findIndex(column => column.key === "gross")], /^15,00/);
    assert.match(total.cells[columns.findIndex(column => column.key === "net")], /^15,00/);
    assert.equal(JSON.stringify(snapshot).includes("9999"), false, "base premiums are not over-commission totals");
    filtered[0] = { ...filtered[0], grossAmount: 600 };
    assert.match(total.cells[columns.findIndex(column => column.key === "gross")], /^15,00/);
    assert.deepEqual(records, before);
  });
}

test("column selection and legacy preferences match the visible table without discarding an intentionally empty selection", () => {
  assert.deepEqual([...normalizeStatementColumns(null)], DEFAULT_STATEMENT_COLUMNS);
  assert.deepEqual([...normalizeStatementColumns(["year", "month", "gross", "notes"], true)], ["gross", "notes", "period"]);
  assert.deepEqual([...normalizeStatementColumns(["gross", "gross", "unrecognized", 17])], ["gross"]);
  assert.deepEqual([...normalizeStatementColumns([])], []);
  const onlyGross = STATEMENT_COLUMNS.filter(column => column.key === "gross");
  const total = statementTableLines(records, [], onlyGross).at(-1);
  assert.match(total.cells[0], /Σύνολα · EUR · 35,00/);
  const displayed = statementDisplayedColumns(columns, ["officeAmount", "producer", "carrier", "officeAmount", "actions"]);
  assert.deepEqual(displayed.map(column => column.key), ["officeAmount", "producer", "carrier"]);
  assert.deepEqual(statementExportSnapshot(statementTableLines(records, [], displayed), displayed, records.length, "").headers, ["Στην έδρα", "Παραγωγός", "Ασφαλιστική"]);
});

test("multiple currencies stay separate, zero and quoted Greek text survive, and empty tables have no invented totals", () => {
  const rows = [record("eur", 'Όνομα, "δοκιμή"\nδεύτερη γραμμή', 0), record("usd", "USD", 12, { currency: "USD", officeAmount: 4 })];
  const lines = statementTableLines(rows, [], columns);
  const snapshot = statementExportSnapshot(lines, columns, rows.length, "");
  assert.equal(lines.filter(line => line.kind === "total").length, 2);
  assert.match(statementOfficeTotal(rows), /0,00/); assert.match(statementOfficeTotal(rows), /4,00/);
  assert.ok(snapshot.rows[0].includes('Όνομα, "δοκιμή"\nδεύτερη γραμμή'));
  assert.deepEqual(statementTableLines([], [], columns), []);
});

test("print uses the identical frozen table, full-width group headings, actual record count and escaped text", () => {
  const previousDocument = globalThis.document;
  let frame; const events = new Map();
  globalThis.document = { createElement(tag) { assert.equal(tag, "iframe"); frame = { style: {}, setAttribute() {}, addEventListener: (name, callback) => events.set(name, callback),
    contentWindow: { document: { body: { children: [{}] } }, focus() {}, print() {}, addEventListener() {} } }; return frame; }, body: { appendChild() {} } };
  try {
    const rows = [record("one", "<script>δοκιμή</script>", 20)];
    const snapshot = statementExportSnapshot(statementTableLines(rows, statementSections(rows, "producer"), columns), columns, rows.length, "Δοκιμή");
    printTable({ title: "Το γραφείο μας", columns: snapshot.headers.map((label, index) => ({ key: String(index), label, map: row => row[index] })), rows: snapshot.rows, recordCount: snapshot.recordCount });
    assert.ok(frame.srcdoc.includes("Σύνολο εγγραφών: 1"));
    assert.match(frame.srcdoc, /class="group-header-row"><td colspan="10"/);
    assert.ok(frame.srcdoc.includes("&lt;script&gt;δοκιμή&lt;/script&gt;"));
    assert.ok(!frame.srcdoc.includes("<script>δοκιμή</script>"));
    assert.ok(frame.srcdoc.includes("Υποσύνολο")); assert.ok(frame.srcdoc.includes("Σύνολα"));
    assert.equal((frame.srcdoc.match(/class="total-row"/g) ?? []).length, 2);
  } finally { globalThis.document = previousDocument; }
});

test("page exports all formats from the rendered table snapshot and disables stale/error/loading exports", async () => {
  const source = await readFile(new URL("./OverCommissionStatementsPage.tsx", import.meta.url), "utf8");
  assert.match(source, /tableLines\.map\(line/);
  assert.match(source, /statementExportSnapshot\(statementTableLines\(rows, groupedSections, displayedColumns\), displayedColumns, rows\.length/);
  assert.match(source, /cell\.style\.display !== "none"/);
  assert.match(source, /api\.post\("\/table-exports", snapshot/);
  assert.match(source, /"csv" \| "xlsx" \| "pdf" \| "print"/);
  assert.match(source, /exportBusy \|\| listQ\.isFetching \|\| listQ\.isError/);
  assert.match(source, /\/table-exports\/office/);
  assert.doesNotMatch(source, /import\("xlsx"\)|window\.open|document\.write/);
});
