import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { advanceAllocationPreview } from "./advancePaymentModel.ts";

test("advances stay in the sidebar without a duplicate financial-movements shortcut", async () => {
  const movements = await readFile(new URL("./FinancialMovementsPage.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(movements, /advance-payments|SavingsOutlinedIcon/);
  assert.match(movements, /\/app\/reconciliation/);
  assert.match(app, /to: "\/advance-payments", labelKey: "nav.advance"/);
  assert.match(app, /path="advance-payments" element=\{<AdvancePaymentsPage/);
});

test("partial allocations validate cents and retain the unused amount", () => {
  assert.deepEqual(advanceAllocationPreview(250, "50"), {valid:true, amount:50, remaining:200});
  assert.deepEqual(advanceAllocationPreview(.3, ".1"), {valid:true, amount:.1, remaining:.2});
  assert.equal(advanceAllocationPreview(250, "250").remaining, 0);
  for (const input of ["", " ", "0", "-1", "251", "0.001", "0.000000001", "1.234", "NaN", "Infinity"]) {
    assert.equal(advanceAllocationPreview(250, input).valid, false, input);
    assert.equal(advanceAllocationPreview(250, input).remaining, 250, input);
  }
  assert.equal(advanceAllocationPreview(0, ".01").valid, false);
  assert.equal(advanceAllocationPreview(9999999999.99, "9999999999.99").valid, true);
});

test("financial screens render compact modal filters and consistent receipts", async context => {
  globalThis.sessionStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.localStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  const server = await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  try {
    const {ThemeProvider,createTheme,TextField,Stack,Button} = await server.ssrLoadModule("@mui/material");
    const {AuthProvider} = await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const {UndoProvider} = await server.ssrLoadModule("/src/components/UndoToast.tsx");
    const render = (child,width,inspectModal=false,mode="light") => {
      const theme=createTheme({palette:{mode},components:{MuiDialog:{defaultProps:{keepMounted:inspectModal,disablePortal:inspectModal}},MuiUseMediaQuery:{defaultProps:{ssrMatchMedia:query=>{
        const max=query.match(/max-width:\s*([\d.]+)px/),min=query.match(/min-width:\s*([\d.]+)px/);
        return {matches:(!max||width<=Number(max[1]))&&(!min||width>=Number(min[1]))};
      }}}}});
      return renderToStaticMarkup(h(QueryClientProvider,{client},h(ThemeProvider,{theme},h(AuthProvider,null,h(UndoProvider,null,h(MemoryRouter,null,child))))));
    };
    const names=["CashPositionPage","ReceiptsPage","PaymentsPage","FinancialMovementsPage","GeneralFinancialEntriesPage","SecuritiesPage","CreditNotesPage","CustomerAccountsPage","GeneralLedgerPage","FinancialReportPage","ProducerStatementPage","CommissionRunsPage","AdvancePaymentsPage"];
    const pages=[];
    for(const name of names){
      const module=await server.ssrLoadModule(`/src/pages/${name==="AdvancePaymentsPage"?"Phase13Pages":name}.tsx`);
      pages.push([name,module[name]]);
    }
    await context.test("all thirteen financial lists: 320–1366px use a green button, not compressed inline controls",()=>{
      for(const width of [320,360,768,1024,1366])for(const [name,Component]of pages){
        const html=render(h(Component),width);
        for(const expected of ["data-financial-filters",'aria-haspopup="dialog"',"#159B59","#107B46","color:#fff"])assert.ok(html.includes(expected),`${name} ${width}: ${expected}`);
        assert.ok(!html.includes("data-financial-filter-fields"),`${name}: fields only in modal`);
      }
    });
    await context.test("large screens retain inline fields; dark mode is supported",()=>{
      for(const width of [1536,1920])for(const [name,Component]of pages){
        const html=render(h(Component),width);
        assert.ok(html.includes("data-financial-filter-fields"),name);
        assert.ok(html.includes("minmax(180px,1fr)"),name);
      }
      assert.ok(render(h(pages[0][1]),1024,true,"dark").includes("#15263A"));
    });
    await context.test("modal fields, close/results actions and saved-filter trigger remain available",async()=>{
      const {FinancialFilters}=await server.ssrLoadModule("/src/components/FinancialFilters.tsx");
      const child=h(FinancialFilters,{title:"Φίλτρα δοκιμής",savedFilters:h(Button,null,"Αποθηκευμένα")},h(Stack,null,h(TextField,{label:"Από",type:"date"}),h(TextField,{label:"Έως",type:"date"})));
      const html=render(child,360,true);
      for(const expected of ["Φίλτρα δοκιμής","Αποθηκευμένα","Από","Έως","Κλείσιμο","Προβολή αποτελεσμάτων","data-financial-filter-fields"])assert.ok(html.includes(expected),expected);
      const closed=render(child,360);
      assert.ok(closed.includes("Αποθηκευμένα"));
      assert.ok(!closed.includes("data-financial-filter-fields"));
      for(const name of ["ReceiptsPage","PaymentsPage"]){
        const source=await readFile(new URL(`./${name}.tsx`,import.meta.url),"utf8");
        assert.match(source,/<FinancialFilters[^]*?savedFilters=\{<SavedReportsButton/);
        assert.match(source,/saveRequestToken=\{saveFilterRequest\}/);
      }
    });
    await context.test("receipt rows are plain cells with the gray palette and pagination outside scrolling",()=>{
      const Component=pages.find(([name])=>name==="ReceiptsPage")[1];
      client.setQueryData(["receipts"],Array.from({length:3},(_,i)=>({id:String(i),number:`RCPT-${i}`,receivedOn:"2026-10-22",customerId:`C${i}`,customerName:`Πελάτης ${i}`,policyId:null,policyNumber:null,method:"Cash",amount:25,currency:"EUR"})));
      const html=render(h(Component),1920),body=html.match(/<tbody\b[^>]*>[^]*?<\/tbody>/)?.[0]??"";
      for(const expected of ["RCPT-0","Πελάτης 0","#F0F2F5","#F8FAFC","overflow:auto","MuiTableCell-stickyHeader"])assert.ok(html.includes(expected),expected);
      assert.equal((body.match(/<tr\b/g)??[]).length,3);
      assert.ok(!body.includes("Αντιγραφή"));
      assert.ok(!body.includes("ContentCopy"));
      assert.ok(body.includes("EditOutlined"));
      assert.ok(html.indexOf("data-claim-list-pagination")>html.indexOf("</table>"));
    });
    await context.test("cash account selector has searchable all-accounts and per-account balances without mixing currencies",async()=>{
      const {CashAccountSelector}=await server.ssrLoadModule("/src/components/CashAccountSelector.tsx");
      const accounts=[{id:"EUR",code:"001",name:"Έδρα",currency:"EUR",currentBalance:125.5,isActive:true},{id:"USD",code:"002",name:"Δολάρια",currency:"USD",currentBalance:-20,isActive:false}];
      for(const width of [320,768,1920]){
        const html=render(h(CashAccountSelector,{accounts,value:"USD",onChange(){}}),width);
        for(const expected of ["Επιλογή ταμείου","Δολάρια","USD","Ανενεργό","combobox"])assert.ok(html.includes(expected),expected);
        assert.ok(!html.includes("125,50"));
      }
      assert.ok(render(h(CashAccountSelector,{accounts,value:"",onChange(){}}),360).includes("Όλα τα ταμεία"));
    });
  } finally {client.clear();await server.close();}
});
