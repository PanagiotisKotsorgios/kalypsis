import test from "node:test";
import assert from "node:assert/strict";
import { filterVehicleRegister, vehicleRegisterColumns, vehicleOwnerText, vehicleUseLabel, vehicleBelongsToCustomer } from "./vehicleRegister.ts";
import { buildTableExportSnapshot } from "../utils/tableExportSnapshot.ts";

const toyota = { id: "ABC1234", plate: "ABC1234", primaryPolicyId: "p1", policyIds: ["p1", "p2", "p3"], owners: [
  { name: "Μαρία", vatNumber: "123456789", percentage: 60, customerId: "c1" }, { name: "Νίκος", percentage: 40 }],
  make: "Toyota", model: "Yaris", year: "2022", vin: "VIN123", engineCapacity: "1490", use: "EIX", fuelType: "Βενζίνη" };
const opel = { ...toyota, id: "XYZ9876", plate: "XYZ9876", primaryPolicyId: "p4", policyIds: ["p4"], owners: [{ name: "Ελένη" }], make: "Opel", model: "Corsa", vin: null, fuelType: "Πετρέλαιο" };
const defaults = { search: "", make: "", fuelType: "", use: "" };

test("vehicle filters use actual vehicle and owner properties, including co-owners and VAT, without mutation", () => {
  const rows = [toyota, opel], before = structuredClone(rows);
  for (const search of ["μαρια", "Νίκος", "123456789", "Yaris", "ABC", "VIN123", "1490", "Επιβατικό"]) {
    const result = filterVehicleRegister(rows, { ...defaults, search });
    assert.ok(result.includes(toyota), search);
  }
  assert.deepEqual(filterVehicleRegister(rows, { ...defaults, make: "Toyota", fuelType: "Βενζίνη", use: "EIX" }), [toyota]);
  assert.deepEqual(filterVehicleRegister(rows, { ...defaults, make: "Toyota", fuelType: "Πετρέλαιο" }), []);
  assert.deepEqual(filterVehicleRegister(rows, defaults), rows);
  assert.deepEqual(rows, before);
  assert.deepEqual(filterVehicleRegister(rows, { ...defaults, search: "ΑΒC-1234" }), [toyota]);
});

test("every vehicle export has the exact vehicle column order and filtered rows, never policy data or renewals", () => {
  const filtered = filterVehicleRegister([toyota, opel], { ...defaults, make: "Toyota" });
  const result = buildTableExportSnapshot("Οχήματα", vehicleRegisterColumns, filtered);
  assert.deepEqual(result.headers, ["Πινακίδα", "Ιδιοκτήτης / συνιδιοκτήτες", "Μάρκα", "Μοντέλο", "Έτος", "Χρήση", "Καύσιμο", "Κυβισμός (cc)", "VIN / πλαίσιο"]);
  assert.deepEqual(result.rows, [["ABC1234", "Μαρία (60%), Νίκος (40%)", "Toyota", "Yaris", "2022", "Επιβατικό Ι.Χ.", "Βενζίνη", "1490", "VIN123"]]);
  assert.ok(!JSON.stringify(result).includes("p1"));
  assert.ok(!JSON.stringify(result).includes("Opel"));
  assert.equal(vehicleOwnerText(opel), "Ελένη");
  assert.equal(vehicleUseLabel("CUSTOM"), "CUSTOM");
});

test("customer vehicle lists follow current linked ownership, including co-owners, not former policyholders",()=>{
  assert.equal(vehicleBelongsToCustomer(toyota,"c1"),true);
  const transferred={...toyota,owners:[{name:"Νέος",customerId:"c2",percentage:100}]};
  assert.equal(vehicleBelongsToCustomer(transferred,"c1"),false);assert.equal(vehicleBelongsToCustomer(transferred,"c2"),true);
  const shared={...toyota,owners:[{name:"Α",customerId:"c1",percentage:75},{name:"Β",customerId:"c2",percentage:25}]};
  assert.equal(vehicleBelongsToCustomer(shared,"c2"),true);
});
