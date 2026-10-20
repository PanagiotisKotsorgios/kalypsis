import { test } from "node:test";
import assert from "node:assert/strict";
import { persistCustomerEdits } from "./customerEditSession.ts";

test("driving facts are independently patched, never string booleans in the legacy PUT", async () => {
  let customer = { firstName: "Αρχικό", hasDrivingLicense: null, isDriver: true, isNewDriver: false };
  const writes = [];
  const result = await persistCustomerEdits(customer, { firstName: "Νέο", hasDrivingLicense: "false", isDriver: "", isNewDriver: "true" },
    async (current, fields) => { assert.deepEqual(fields, { firstName: "Νέο" }); return { ...current, ...fields }; },
    async (key, value) => { writes.push(key); return { ...customer, [key]: value === "" ? null : value === "true" }; },
    current => { customer = current; });
  assert.deepEqual(writes, ["hasDrivingLicense", "isDriver", "isNewDriver"]);
  assert.equal(result.hasDrivingLicense, false);
  assert.equal(result.isDriver, null);
  assert.equal(result.isNewDriver, true);
});

test("edits from different tabs use one merged primary update and retain untouched data", async () => {
  const customer = { firstName: "Αρχικό", city: "Πάτρα", phone: "2100000000", assignedAdvisorId: "advisor-1" };
  const writes = [];
  const saved = [];
  const result = await persistCustomerEdits(customer, { firstName: "Νέο", phone: "2610123456" },
    async (current, changes) => { writes.push(changes); return { ...current, ...changes }; },
    async () => { throw new Error("No additional channels expected"); },
    (current, keys) => saved.push({ current, keys }));
  assert.deepEqual(writes, [{ firstName: "Νέο", phone: "2610123456" }]);
  assert.equal(result.city, "Πάτρα");
  assert.equal(result.assignedAdvisorId, "advisor-1");
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].keys, ["firstName", "phone"]);
});

test("a failed additional channel retains only unsaved drafts and can be retried", async () => {
  let current = { firstName: "Αρχικό", secondaryEmail: "", thirdPhone: "" };
  let pending = { firstName: "Νέο", secondaryEmail: "second@example.test", thirdPhone: "2610123456" };
  const accepted = (updated, keys) => { current = updated; keys.forEach(key => delete pending[key]); };
  let primaryCalls = 0;
  const primary = async (customer, changes) => { primaryCalls++; return { ...customer, ...changes }; };
  await assert.rejects(persistCustomerEdits(current, pending, primary,
    async (key, value) => {
      if (key === "thirdPhone") throw new Error("Connection interrupted");
      return { ...current, [key]: value };
    }, accepted), /Connection interrupted/);
  assert.deepEqual(pending, { thirdPhone: "2610123456" });
  assert.equal(current.firstName, "Νέο");
  assert.equal(current.secondaryEmail, "second@example.test");
  await persistCustomerEdits(current, pending, primary,
    async (key, value) => ({ ...current, [key]: value }), accepted);
  assert.deepEqual(pending, {});
  assert.equal(primaryCalls, 1);
  assert.equal(current.thirdPhone, "2610123456");
});

test("a primary failure never submits additional channels or accepts unsaved values", async () => {
  let additionalCalled = false;
  let acceptedCalled = false;
  await assert.rejects(persistCustomerEdits({}, { phone: "123", secondaryEmail: "next@example.test" },
    async () => { throw new Error("Validation error"); },
    async () => { additionalCalled = true; return {}; },
    () => { acceptedCalled = true; }), /Validation error/);
  assert.equal(additionalCalled, false);
  assert.equal(acceptedCalled, false);
});

test("clearing values is saved and an empty edit session performs no requests", async () => {
  let calls = 0;
  const write = async (customer, changes) => { calls++; return { ...customer, ...changes }; };
  const accepted = () => {};
  const initial = { phone: "123", notes: "Σημειώσεις" };
  const unchanged = await persistCustomerEdits(initial, {}, write, async () => { throw new Error("Unexpected write"); }, accepted);
  assert.equal(unchanged, initial);
  assert.equal(calls, 0);
  const cleared = await persistCustomerEdits(initial, { phone: "", notes: "" }, write, async () => { throw new Error("Unexpected write"); }, accepted);
  assert.equal(cleared.phone, "");
  assert.equal(cleared.notes, "");
  assert.equal(calls, 1);
});
