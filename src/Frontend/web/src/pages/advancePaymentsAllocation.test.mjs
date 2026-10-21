import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("advance payments expose party-aware allocations and available balances", async () => {
  const page = await readFile(new URL("./Phase13Pages.tsx", import.meta.url), "utf8");
  const handler = await readFile(new URL("../../../../Backend/Kalypsis.Application/Features/Phase13/Phase13Handlers.cs", import.meta.url), "utf8");

  assert.match(page, /function AllocateAdvanceDialog/);
  assert.match(page, /advance-payments\/\$\{advance!\.id\}\/allocate/);
  assert.match(page, /advance\.amount - advance\.allocatedAmount/);
  assert.match(page, /row\.producerId === advance\.producerId/);
  assert.match(page, /insuranceCompanyId: advance\.insuranceCompanyId/);
  assert.match(page, /customerId: advance\.customerId/);
  assert.match(page, /advance\.allocations\.map/);

  assert.match(handler, /record AdvanceAllocationDto/);
  assert.match(handler, /"Customer" => a\.CustomerId\.HasValue && policy\.CustomerId/);
  assert.match(handler, /"Producer" => a\.ProducerId\.HasValue && policy\.ProducerId/);
  assert.match(handler, /"Carrier" => a\.InsuranceCompanyId\.HasValue && policy\.InsuranceCompanyId/);
  assert.match(handler, /advance_policy_party_mismatch/);
  assert.match(handler, /advance_currency_mismatch/);
  assert.match(handler, /advance_party_required/);
});
