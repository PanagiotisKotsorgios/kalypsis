import test from "node:test";
import assert from "node:assert/strict";
import { buildTableExportSnapshot, groupTableExportRows } from "./tableExportSnapshot.ts";
import { customerMatchesFilters, EMPTY_CUSTOMER_LIST_FILTERS } from "../pages/customerListFilters.ts";
import { printTable } from "./printableTable.ts";

test("customer export freezes only the filtered/sorted table and its requested columns", () => {
  const customers = [
    { id: "1", firstName: "Μαρία", lastName: "Ωμέγα", city: "Αθήνα", type: "Individual", status: "Active", createdAt: "2026-01-01" },
    { id: "2", firstName: "Νίκος", lastName: "Άλφα", city: "Αθήνα", type: "Individual", status: "Active", createdAt: "2026-01-01" },
    { id: "3", firstName: "Εκτός", lastName: "Φίλτρου", city: "Πάτρα", type: "Individual", status: "Active", createdAt: "2026-01-01" },
  ];
  const filtered = customers.filter(row => customerMatchesFilters(row, { ...EMPTY_CUSTOMER_LIST_FILTERS, cities: ["Αθήνα"] }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "el"));
  const snapshot = buildTableExportSnapshot("Λίστα πελατών", [
    { key: "city", label: "Πόλη" },
    { key: "name", label: "Πελάτης", map: row => `${row.firstName} ${row.lastName}` },
  ], filtered, "Πόλη: Αθήνα");
  assert.deepEqual(snapshot.headers, ["Πόλη", "Πελάτης"]);
  assert.deepEqual(snapshot.rows, [["Αθήνα", "Νίκος Άλφα"], ["Αθήνα", "Μαρία Ωμέγα"]]);
  assert.equal(JSON.stringify(snapshot).includes("Πάτρα"), false);
  customers[0].firstName = "Αλλαγή μετά το κλικ";
  assert.equal(snapshot.rows[1][1], "Μαρία Ωμέγα");
});

test("snapshot preserves zero, quoted/multiline Greek text and an empty filtered result", () => {
  const columns = [{ key: "amount", label: "Ποσό" }, { key: "notes", label: "Σημειώσεις" }, { key: "empty", label: "Κενό" }];
  assert.deepEqual(buildTableExportSnapshot("Λίστα", columns, [{ amount: 0, notes: 'Σχόλιο, "δοκιμή"\nδεύτερη γραμμή', empty: null }]).rows,
    [["0", 'Σχόλιο, "δοκιμή"\nδεύτερη γραμμή', ""]]);
  assert.deepEqual(buildTableExportSnapshot("Λίστα", columns, []).rows, []);
});

test("grouped exports and printing retain every filtered row, headings and column order across pagination", () => {
  const rows = Array.from({ length: 60 }, (_, index) => ({ name: `Πελάτης ${index}`, group: index < 35 ? "Αθήνα" : "Πάτρα" }));
  const snapshot = buildTableExportSnapshot("Αύξηση παραγωγής", [{ key: "name", label: "Πελάτης" }, { key: "group", label: "Πόλη" }], rows, "Δύο πόλεις", row => row.group);
  assert.equal(snapshot.recordCount, 60);
  assert.equal(snapshot.rows.length, 62);
  assert.deepEqual(snapshot.rows[0], ["ΟΜΑΔΑ: Αθήνα · 35 εγγραφές", ""]);
  assert.deepEqual(snapshot.rows[36], ["ΟΜΑΔΑ: Πάτρα · 25 εγγραφές", ""]);
  assert.deepEqual(snapshot.rows[61], ["Πελάτης 59", "Πάτρα"]);
  assert.deepEqual(groupTableExportRows(rows, row => row.group).flatMap(group => group.rows), rows);
  assert.equal(groupTableExportRows(rows), undefined);
  assert.deepEqual(buildTableExportSnapshot("Κενό", [{ key: "name", label: "Πελάτης" }], [], undefined, row => row.group).rows, []);
});

test("grouping does not regroup or reorder noncontiguous table sections", () => {
  const rows = [{ group: "Α", value: 1 }, { group: "Β", value: 2 }, { group: "Α", value: 3 }];
  assert.deepEqual(groupTableExportRows(rows, row => row.group).map(group => group.title), ["Α", "Β", "Α"]);
  const snapshot = buildTableExportSnapshot("Λίστα", [{ key: "value", label: "Τιμή" }], rows, undefined, row => row.group);
  assert.deepEqual(snapshot.rows.filter(row => !row[0].startsWith("ΟΜΑΔΑ:")), [["1"], ["2"], ["3"]]);
});

test("print document mirrors filtered rows and groups, escapes text, and triggers only one print", () => {
  const previousDocument = globalThis.document;
  let frame, printCount = 0;
  const events = new Map();
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "iframe");
      frame = { style: {}, setAttribute() {}, addEventListener: (name, handler) => events.set(name, handler),
        contentWindow: { document: { body: { children: [{}] } }, focus() {}, addEventListener() {}, print() { printCount++; } } };
      return frame;
    },
    body: { appendChild(value) { assert.equal(value, frame); } },
  };
  try {
    const rows = [{ plate: "ABC1234", city: "Αθήνα" }, { plate: 'XYZ <1234> & "test"', city: "Πάτρα" }];
    printTable({ title: "Γραφείο δοκιμής", subtitle: "Οχήματα", columns: [{ key: "plate", label: "Πινακίδα" }],
      rows, groups: groupTableExportRows(rows, row => row.city), office: { name: null, phone: "2101234567" } });
    assert.match(frame.srcdoc, /<h1>Γραφείο δοκιμής<\/h1>/);
    assert.ok(frame.srcdoc.includes("Σύνολο εγγραφών: 2"));
    assert.equal((frame.srcdoc.match(/class="group-header-row"/g) ?? []).length, 2);
    assert.equal((frame.srcdoc.match(/<td>ABC1234<\/td>/g) ?? []).length, 1);
    assert.ok(frame.srcdoc.includes("XYZ &lt;1234&gt; &amp; &quot;test&quot;"));
    assert.ok(frame.srcdoc.includes("2101234567"));
    assert.ok(!frame.srcdoc.includes("Kalypsis — Οχήματα"));
    events.get("load")(); events.get("load")();
    assert.equal(printCount, 1);
  } finally { globalThis.document = previousDocument; }
});
