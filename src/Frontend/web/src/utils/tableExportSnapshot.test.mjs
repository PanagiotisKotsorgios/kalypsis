import test from "node:test";
import assert from "node:assert/strict";
import { buildTableExportSnapshot } from "./tableExportSnapshot.ts";
import { customerMatchesFilters, EMPTY_CUSTOMER_LIST_FILTERS } from "../pages/customerListFilters.ts";

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
