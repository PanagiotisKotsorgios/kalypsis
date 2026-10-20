import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptProfileDrafts, persistProfileWrites } from "./profileDrafts.ts";

test("core edits are merged into one write and workspace values use independent writes", async () => {
  const calls = [], accepted = [];
  await persistProfileWrites({ name: "Νέα επωνυμία", contactEmail: "new@example.gr", "custom:address": "Νέα διεύθυνση" },
    async changes => calls.push(["core", changes]), async (key, value) => calls.push([key, value]), keys => accepted.push(keys));
  assert.deepEqual(calls, [["core", { name: "Νέα επωνυμία", contactEmail: "new@example.gr" }], ["custom:address", "Νέα διεύθυνση"]]);
  assert.deepEqual(accepted, [["name", "contactEmail"], ["custom:address"]]);
});

test("a failed core save accepts nothing and does not submit workspace values", async () => {
  const accepted = [];
  await assert.rejects(persistProfileWrites({ name: "Νέα", "custom:address": "Οδός" }, async () => { throw new Error("failed"); },
    async () => assert.fail("workspace must not be submitted"), keys => accepted.push(keys)), /failed/);
  assert.deepEqual(accepted, []);
});

test("partial failures retain only outstanding drafts and retries do not repeat completed saves", async () => {
  let drafts = { name: "Νέα", "custom:one": "1", "custom:two": "2" };
  const submitted = { ...drafts };
  let coreCalls = 0;
  await assert.rejects(persistProfileWrites(submitted, async () => { coreCalls++; }, async key => {
    if (key === "custom:two") throw new Error("failed");
  }, keys => { drafts = acceptProfileDrafts(drafts, submitted, keys); }), /failed/);
  assert.deepEqual(drafts, { "custom:two": "2" });
  const retry = { ...drafts };
  await persistProfileWrites(retry, async () => { coreCalls++; }, async key => assert.equal(key, "custom:two"),
    keys => { drafts = acceptProfileDrafts(drafts, retry, keys); });
  assert.deepEqual(drafts, {});
  assert.equal(coreCalls, 1);
});

test("accepting an earlier submitted value never discards a newer draft", () => {
  assert.deepEqual(acceptProfileDrafts({ name: "Πιο πρόσφατη", phone: "2101234567" }, { name: "Παλιά", phone: "2101234567" }, ["name", "phone"]), { name: "Πιο πρόσφατη" });
});

test("clearing fields is persisted and empty edit sessions do no work", async () => {
  const calls = [];
  await persistProfileWrites({ notes: "", "custom:one": "" }, async fields => calls.push(fields), async (key, value) => calls.push([key, value]), () => {});
  assert.deepEqual(calls, [{ notes: "" }, ["custom:one", ""]]);
  await persistProfileWrites({}, async () => assert.fail(), async () => assert.fail(), () => assert.fail());
});
