import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h, Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { buildTableExportSnapshot } from "../utils/tableExportSnapshot.ts";

test("insurer commission workspace filters and currency totals match policy-card receivables", async context => {
  globalThis.localStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.sessionStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  const server = await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  try {
    const {filterCarrierCommissions,carrierCommissionTotals}=await server.ssrLoadModule("/src/pages/CarrierCommissionsPage.tsx");
    const {PolicySettlementPanel}=await server.ssrLoadModule("/src/components/PolicyDetailDrawer.tsx");
    const base={policyId:"p1",policyNumber:"POL-1",insuranceCompanyId:"a",insuranceCompanyName:"Ασφαλιστική Α",customerName:"Άννα",startDate:"2026-01-01",currency:"EUR",expected:16,received:5,outstanding:11,credit:0};
    const rows=[base,{...base,policyId:"p2",policyNumber:"POL-2",insuranceCompanyId:"b",startDate:"2026-07-01",currency:"USD",expected:20,received:20,outstanding:0},
      {...base,policyId:"p3",policyNumber:"POL-3",startDate:"2026-08-01",received:20,outstanding:0,credit:4}];
    await context.test("company, search, inclusive dates, unpaid and overpayment filters combine correctly",()=>{
      const empty={search:"",company:"",status:"",from:"",to:""};
      assert.deepEqual(filterCarrierCommissions(rows,{...empty,status:"pending"}).map(r=>r.policyId),["p1"]);
      assert.deepEqual(filterCarrierCommissions(rows,{...empty,status:"credit"}).map(r=>r.policyId),["p3"]);
      assert.deepEqual(filterCarrierCommissions(rows,{...empty,status:"settled"}).map(r=>r.policyId),["p2"]);
      assert.deepEqual(filterCarrierCommissions(rows,{...empty,company:"a",search:"POL-3",from:"2026-08-01",to:"2026-08-01"}).map(r=>r.policyId),["p3"]);
      assert.equal(filterCarrierCommissions(rows,{...empty,company:"b",status:"pending"}).length,0);
    });
    await context.test("totals include all filtered rows and keep currencies apart; exported rows preserve filters",()=>{
      const totals=carrierCommissionTotals(rows);
      assert.deepEqual(totals,[{currency:"EUR",expected:32,received:25,outstanding:11,credit:4},{currency:"USD",expected:20,received:20,outstanding:0,credit:0}]);
      const filtered=filterCarrierCommissions(rows,{search:"",company:"a",status:"pending",from:"",to:""});
      const snapshot=buildTableExportSnapshot("Προμήθειες ασφαλιστικών",[{key:"policyNumber",label:"Συμβόλαιο"},{key:"outstanding",label:"Μας οφείλει"},{key:"currency",label:"Νόμισμα"}],filtered);
      assert.deepEqual(snapshot.rows,[["POL-1","11","EUR"]]);
    });
    await context.test("policy card uses actual insurer remittances instead of accrued/customer-derived income and opens real remittance management",()=>{
      let opened=0;
      const props={policy:{premium:134,totalReceived:134,outstanding:0,currency:"EUR",paidDirectlyToCarrier:true,
        carrierDue:0,carrierPaid:0,carrierOutstanding:0,producerDue:0,producerPaid:0,producerOutstanding:0,
        agencyCommissionExpected:16,agencyCommissionReceived:16,carrierCommissionDue:6,carrierCommissionReceived:2,carrierCommissionOutstanding:4,carrierCommissionCredit:0},
        readOnly:false,onSettle(){},onCarrierCommission(){opened++;}};
      const html=renderToStaticMarkup(h(PolicySettlementPanel,props));
      const panel=html.slice(html.indexOf('data-commission-income="agency"'));
      for(const text of ["6,00 EUR","2,00 EUR","4,00 EUR","Μας οφείλει η ασφαλιστική:","Καταβολές ασφαλιστικής"]) assert.ok(panel.includes(text),text);
      assert.ok(!panel.includes("16,00 EUR"));
      assert.ok(panel.includes("#D00000"));
      function click(node){if(!isValidElement(node))return; if(node.props.onClick===props.onCarrierCommission)node.props.onClick(); Children.forEach(node.props.children,click);}
      click(PolicySettlementPanel(props));assert.equal(opened,1);
      const readOnly=renderToStaticMarkup(h(PolicySettlementPanel,{...props,readOnly:true}));
      assert.ok(!readOnly.includes("<button"));assert.ok(readOnly.includes("Μας οφείλει η ασφαλιστική:"));
    });
  } finally {await server.close();}
});
