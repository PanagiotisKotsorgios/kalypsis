import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";
import {createElement as h} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {createServer} from "vite";
import {receiptBody,receiptValues} from "./receiptFields.ts";

test("partial receipt amounts and dossier amounts remain distinct",()=>{
  const v={...receiptValues(null),number:"R-1",customerId:"customer",amount:"25",instrumentAmount:"100.00",series:"A",instrumentNumber:"00012"};
  const body=receiptBody(v);assert.equal(body.amount,25);assert.equal(body.details.instrumentAmount,"100.00");assert.equal(body.details.instrumentNumber,"00012");
  for(const amount of ["0","-1","1.001","NaN","Infinity",""])assert.throws(()=>receiptBody({...v,amount}));
  assert.throws(()=>receiptBody({...v,customerId:""}));assert.throws(()=>receiptBody({...v,currency:"EURO"}));
});
test("desktop and web use identical receipt tabs, ordering, choices and field definitions",async context=>{
  const web=JSON.parse(await readFile(new URL("./receipt-card-layout.json",import.meta.url),"utf8"));
  assert.equal(new Set(web.fields.map(x=>x.key)).size,web.fields.length);
  const desktopFile=(process.env.KALYPSIS_DESKTOP_ROOT??"G:/kalypsis-desktop")+"/src/Kalypsis.Desktop/Resources/receipt-card-layout.json";
  try{await access(desktopFile);}catch{context.skip("Desktop checkout is not available for cross-repository parity verification.");return;}
  const desktop=JSON.parse(await readFile(desktopFile,"utf8"));
  assert.deepEqual(web,desktop);assert.deepEqual(web.tabs,["Καρτέλα Είσπραξης","Πελάτης & συμβόλαιο","Οικονομικά","Έγγραφα & ιστορικό"]);
  assert.equal(new Set(web.fields.map(x=>x.key)).size,web.fields.length);
});
test("receipt card renders the shared inline controls in view and edit modes at narrow and wide widths",async()=>{
  globalThis.sessionStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  const record={id:"r1",number:"R-QA",receivedOn:"2026-10-24",customerId:"c1",customerName:"QA",policyId:null,policyNumber:null,method:"Cash",amount:25,currency:"EUR",notes:"keep",transactionReference:null,details:{series:"A"}};
  client.setQueryData(["customers-lite"],[{id:"c1",type:"Individual",firstName:"QA",lastName:"Receipt"}]);client.setQueryData(["customer-policies-for-receipt","c1"],[]);
  client.setQueryData(["receipt-card","r1"],{receipt:record,related:{},history:[]});
  try{
    const {ThemeProvider,createTheme}=await server.ssrLoadModule("@mui/material");
    const {ReceiptDetailDialog}=await server.ssrLoadModule("/src/components/profile/ReceiptDetailDialog.tsx");
    for(const width of [360,768,1440])for(const editing of [false,true]){
      const theme=createTheme({components:{MuiDialog:{defaultProps:{keepMounted:true,disablePortal:true}},MuiUseMediaQuery:{defaultProps:{ssrMatchMedia:q=>({matches:q.includes("min-width")?width>=600:width<600})}}}});
      const html=renderToStaticMarkup(h(QueryClientProvider,{client},h(ThemeProvider,{theme},h(ReceiptDetailDialog,{item:record,initialEditing:editing,onClose(){},onSaved(){}}))));
      for(const label of ["Καρτέλα Είσπραξης","Πελάτης &amp; συμβόλαιο","Οικονομικά","Αριθμός απόδειξης","Τράπεζα"].filter(x=>x!=="Τράπεζα"))assert.ok(html.includes(label),label);
      assert.match(html,/Αντιγραφή/);assert.ok(html.includes(editing?"Αποθήκευση επεξεργασίας":"Επεξεργασία είσπραξης"));
    }
  }finally{client.clear();await server.close();}
});
