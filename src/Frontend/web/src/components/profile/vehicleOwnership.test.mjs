import test from "node:test";
import assert from "node:assert/strict";
import { vehicleCoOwners, ownershipFieldValues, vehicleOwnerCount, mergeVehicleOwnership, ownershipCreationChanges } from "./vehicleOwnership.ts";

const raw = JSON.stringify({ ownerCount: "2", make: "Toyota", insurer: { token: "preserve" } });
test("co-owners are separate from historical policyholders and shares are never guessed", () => {
  const rows = vehicleCoOwners(raw, "Πελάτης", "123456789");
  assert.equal(rows.length, 2); assert.equal(rows[0].name, "Πελάτης");
  assert.equal(rows[0].percentage, null); assert.equal(rows[1].percentage, null);
  assert.equal(ownershipFieldValues(rows)["owner:1:percentage"], "");
  assert.equal(vehicleCoOwners("broken").length, 1);
  for (const value of ["0", "-2", "2.5", "abc", "101"]) assert.throws(() => vehicleOwnerCount(value));
});
test("partial and complete shares persist while preserving technical data", () => {
  const first = mergeVehicleOwnership(raw, { "owner:0:percentage": "60", "owner:1:name": "Συνιδιοκτήτης" }, "Πελάτης", "123456789");
  const second = mergeVehicleOwnership(first, { "owner:1:percentage": "40", "owner:1:vatNumber": "987654321" });
  const parsed = JSON.parse(second);
  assert.deepEqual(parsed.insurer, { token: "preserve" });
  assert.equal(parsed.make, "Toyota");
  assert.deepEqual(parsed.vehicleOwnership.map(row => row.percentage), [60, 40]);
  assert.equal(vehicleCoOwners(second)[1].name, "Συνιδιοκτήτης");
  assert.equal(JSON.parse(raw).vehicleOwnership, undefined);
});
test("percentages reject invalid values, totals, duplicate VAT and hidden data loss", () => {
  for (const percentage of ["0", "-1", "101", "NaN", "2.555", "letters"])
    assert.throws(() => mergeVehicleOwnership(raw, { "owner:0:percentage": percentage }));
  assert.throws(() => mergeVehicleOwnership(raw, { "owner:0:percentage": "60", "owner:1:percentage": "50" }));
  assert.throws(() => mergeVehicleOwnership(raw, { "owner:0:percentage": "40", "owner:1:percentage": "50" }));
  assert.throws(() => mergeVehicleOwnership(raw, { "owner:0:vatNumber": "123" }));
  assert.throws(() => mergeVehicleOwnership(raw, { "owner:1:vatNumber": "123456789" }, "Πελάτης", "123456789"));
  assert.throws(() => mergeVehicleOwnership(raw, { "owner:5:name": "Hidden" }));
  const saved = mergeVehicleOwnership(raw, { "owner:1:name": "Να μη χαθεί" });
  assert.throws(() => mergeVehicleOwnership(JSON.stringify({ ...JSON.parse(saved), ownerCount: 1 }), {}));
  assert.throws(() => mergeVehicleOwnership("broken", {}));
});
test("decimal shares total exactly 100 without floating point drift", () => {
  const result = JSON.parse(mergeVehicleOwnership('{"ownerCount":3}', {
    "owner:0:percentage": "33,33", "owner:1:percentage": "33.33", "owner:2:percentage": "33.34"
  }));
  assert.deepEqual(result.vehicleOwnership.map(row => row.percentage), [33.33, 33.33, 33.34]);
});

test("reducing the count on an unsaved creation form ignores hidden draft rows", () => {
  const changes = { "owner:0:percentage": "60", "owner:1:percentage": "40", "owner:2:name": "Draft" };
  assert.deepEqual(ownershipCreationChanges(changes, "1"), {});
  assert.deepEqual(ownershipCreationChanges(changes, "2"), { "owner:0:percentage": "60", "owner:1:percentage": "40" });
  assert.equal(changes["owner:2:name"], "Draft");
});
