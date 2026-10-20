import { test } from "node:test";
import assert from "node:assert/strict";
import { customerFieldError, customerDraftErrors, fieldMaxLength } from "./customerValidation.ts";
import { auditValue } from "../audit/auditValues.ts";

const cases = [
  ["phone", "2101234567", true], ["phone", "210 123 4567", true], ["phone", "+30 (210) 123-4567", true],
  ["phone", "0030 210 1234567", true], ["phone", "+442012345678", true], ["phone", "210123456", false],
  ["phone", "21012345678", false], ["phone", "abc2101234567", false], ["phone", "210+1234567", false],
  ["phone", "+1234567890123456", false], ["phone", "+3021012345678", false],
  ["mobilePhone", "6912345678", true], ["secondaryMobilePhone", "γράμματα", false], ["thirdPhone", "", true],
  ["email", "person+test@example.gr", true], ["secondaryEmail", "abc", false], ["email", "a b@example.gr", false],
  ["email", "a@@example.gr", false], ["email", "a@example", false], ["email", null, true],
  ["email", "a..b@example.gr", false], ["email", ".a@example.gr", false], ["email", "a@-example.gr", false],
  ["email", "a@exa_mple.gr", false], ["email", "δοκιμή@παράδειγμα.gr", true],
  ["vatNumber", "012345678", true], ["vatNumber", "1234567890", false], ["vatNumber", "12345678", false],
  ["vatNumber", "12345678A", false], ["vatNumber", "123 456 789", false],
  ["amka", "01234567890", true], ["amka", "12345", false], ["postalCode", "30100", true],
  ["postalCode", "301 00", true], ["postalCode", "30abc", false],
  ["photoUrl", "https://example.gr/image.png", true], ["photoUrl", "javascript:alert(1)", false], ["photoUrl", "file:///C:/image.png", false],
];
for (const [field, value, valid] of cases) test(`format ${field}: ${value}`, () => {
  assert.equal(customerFieldError(field, value) === undefined, valid);
});

test("only changed drafts are validated and licence date ordering is checked", () => {
  assert.deepEqual(customerDraftErrors({ firstName: "Νέο όνομα" }), []);
  assert.equal(customerDraftErrors({ phone: "invalid", vatNumber: "1234567890" }).length, 2);
  assert.equal(customerDraftErrors({ driverLicenseIssueDate: "2026-01-01", driverLicenseExpiryDate: "2025-01-01" }).length, 1);
  assert.equal(customerFieldError("birthDate", "2999-01-01")?.includes("μελλοντική"), true);
  assert.equal(fieldMaxLength("vatNumber"), 9);
  assert.equal(fieldMaxLength("email"), 254);
});

test("audit values distinguish missing snapshots from empty fields and translate common values", () => {
  assert.equal(auditValue("Phone", null, false), "Δεν έχει καταγραφεί");
  assert.equal(auditValue("Phone", null, true), "Κενό");
  assert.equal(auditValue("Phone", undefined, true), "Κενό");
  assert.equal(auditValue("Phone", "2101234567", true), "2101234567");
  assert.equal(auditValue("Granted", "false", true), "Όχι");
  assert.equal(auditValue("Status", "Active", true), "Ενεργό");
  assert.equal(auditValue("Notes", "Active", true), "Active");
  assert.equal(auditValue("BirthDate", "1990-01-02", true).includes("1990"), true);
});
