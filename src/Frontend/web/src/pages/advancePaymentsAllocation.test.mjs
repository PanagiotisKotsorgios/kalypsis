import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { advanceBalances, advanceDirectionLabel } from "./advancePaymentModel.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

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

test("incoming, outgoing, legacy and currencies never get silently mixed", () => {
  const row = { amount: 100, allocatedAmount: 30, currency: "EUR", status: "PartiallyAllocated" };
  assert.deepEqual(advanceBalances([{...row,direction:"Incoming"},{...row,amount:40,allocatedAmount:10,direction:"Outgoing"},{...row,amount:200,direction:null}, {...row,amount:50,currency:"USD",direction:"Incoming"}]), [
    {currency:"EUR",incoming:100,outgoing:40,incomingAvailable:70,outgoingAvailable:30,unspecified:200},
    {currency:"USD",incoming:50,outgoing:0,incomingAvailable:20,outgoingAvailable:0,unspecified:0}
  ]);
  assert.equal(row.amount,100); assert.deepEqual(advanceBalances([]),[]);
});

test("refunded records have no usable balance and decimal totals use cents", () => {
  const row={currency:"EUR",amount:.1,allocatedAmount:0,status:"Open",direction:"Incoming"};
  const [balance]=advanceBalances([row,{...row,amount:.2},{...row,amount:100,status:"Refunded"}]);
  assert.equal(balance.incoming,100.3); assert.equal(balance.incomingAvailable,.3);
});

test("direction selection, filters and migration preserve explicit legacy classification", async () => {
  const page=await readFile(new URL("./Phase13Pages.tsx",import.meta.url),"utf8");
  const rules=await readFile(new URL("../../../../Backend/Kalypsis.Application/Features/Phase13/AdvancePaymentRules.cs",import.meta.url),"utf8");
  assert.match(page,/direction: form.direction/); assert.match(page,/direction: directionFilter \|\| undefined/);
  assert.match(page,/advance-payments\/\$\{advance!\.id\}\/direction/);
  assert.match(page,/!form.direction/); assert.match(page,/Χωρίς χαρακτηρισμό/);
  assert.match(page,/targetType, amount:/); assert.match(page,/advance-commission-runs/);
  assert.match(rules,/advance.Direction != null && advance.AllocatedAmount > 0/);
  assert.match(rules,/DbUpdateConcurrencyException/);
});

test("directions render clear Greek labels, distinct colors and real SVG icons", async () => {
  globalThis.sessionStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.localStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  try {
    const {AdvanceDirectionChip}=await server.ssrLoadModule("/src/pages/Phase13Pages.tsx");
    for(const [direction,label,color] of [["Incoming","Εισερχόμενη","colorSuccess"],["Outgoing","Εξερχόμενη","colorError"]]) {
      const html=renderToStaticMarkup(createElement(AdvanceDirectionChip,{direction}));
      assert.match(html,new RegExp(label)); assert.match(html,new RegExp(color)); assert.match(html,/<svg/);
    }
    assert.match(renderToStaticMarkup(createElement(AdvanceDirectionChip,{})),/Χωρίς χαρακτηρισμό/);
    assert.equal(advanceDirectionLabel("invalid"),"Χωρίς χαρακτηρισμό");
  } finally { await server.close(); }
});
