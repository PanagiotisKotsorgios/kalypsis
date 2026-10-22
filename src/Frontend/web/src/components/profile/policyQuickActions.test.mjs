import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { issueAndRecordGreenCardDelivery } from "./greenCardWorkflow.ts";

const read = path => readFile(new URL(path,import.meta.url),"utf8");
const draft = {id:"card-1",status:"Draft",policyDocumentId:null};
const issued = {...draft,status:"Issued",policyDocumentId:"pdf-1"};
const delivered = {...issued,status:"Delivered"};

test("new green card issues the PDF before recording delivery, using the same saved card ID",async()=>{
  const events=[];
  const result=await issueAndRecordGreenCardDelivery(draft,async id=>{events.push(["issue",id]);return issued;},async id=>{events.push(["deliver",id]);return delivered;},card=>events.push(["progress",card.status]));
  assert.equal(result,delivered);
  assert.deepEqual(events,[["issue","card-1"],["progress","Issued"],["deliver","card-1"],["progress","Delivered"]]);
  assert.equal(draft.status,"Draft");
});

test("failed issuance never records delivery or reports success",async()=>{
  let deliveries=0,progress=0;
  await assert.rejects(issueAndRecordGreenCardDelivery(draft,async()=>{throw new Error("PDF failed");},async()=>{deliveries++;return delivered;},()=>progress++),/PDF failed/);
  assert.equal(deliveries,0);assert.equal(progress,0);
  await assert.rejects(issueAndRecordGreenCardDelivery(draft,async()=>({...issued,policyDocumentId:null}),async()=>{deliveries++;return delivered;},()=>{}),/Δεν δημιουργήθηκε το PDF/);
  assert.equal(deliveries,0);
  await assert.rejects(issueAndRecordGreenCardDelivery(draft,async()=>({...issued,status:"Draft"}),async()=>{deliveries++;return delivered;},()=>{}),/Δεν δημιουργήθηκε το PDF/);
  assert.equal(deliveries,0);
});

test("delivery failure retains issued progress and can retry the same card without another creation",async()=>{
  const progress=[];const ids=[];
  const issue=async id=>{ids.push(id);return issued;};
  await assert.rejects(issueAndRecordGreenCardDelivery(draft,issue,async()=>{throw new Error("Delivery failed");},card=>progress.push(card)),/Delivery failed/);
  assert.deepEqual(progress,[issued]);
  assert.equal(await issueAndRecordGreenCardDelivery(issued,issue,async()=>delivered,card=>progress.push(card)),delivered);
  assert.deepEqual(ids,["card-1","card-1"]);
  await assert.rejects(issueAndRecordGreenCardDelivery(issued,issue,async()=>issued,()=>{}),/Η παράδοση δεν επιβεβαιώθηκε/);
});

test("policy-only coverage creation has exactly code, name and notes; advanced catalogue editing stays intact",async()=>{
  globalThis.sessionStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  try{
    const {CatalogueItemDialog}=await server.ssrLoadModule("/src/components/CompanyCatalogueDialog.tsx");
    const {ThemeProvider,createTheme}=await server.ssrLoadModule("@mui/material/styles");
    const render=props=>renderToStaticMarkup(h(QueryClientProvider,{client},h(ThemeProvider,{theme:createTheme({components:{MuiDialog:{defaultProps:{disablePortal:true}}}})},h(CatalogueItemDialog,{open:true,onClose(){},insuranceCompanyId:"company-1",defaultKind:"Coverage",editing:null,onSaved(){},lockKind:true,...props}))));
    const simple=render({simpleCoverage:true});
    for(const label of ["Νέα κάλυψη","Κωδικός","Όνομα","Σημείωση","Αποθήκευση"])assert.ok(simple.includes(label));
    for(const label of ["Κλάδος / τύπος","Parent code","Bridge system","Bridge code","Σειρά","Κατηγορία χρήσης"])assert.ok(!simple.includes(label),label);
    assert.equal((simple.match(/<input\b/g)??[]).length,2);
    assert.equal((simple.match(/<textarea\b/g)??[]).length,2); // visible editor + MUI autosize measurement
    const full=render({simpleCoverage:false});
    for(const label of ["Κλάδος / τύπος","Parent code","Bridge system","Bridge code","Σειρά"])assert.ok(full.includes(label),label);
    const edit=render({simpleCoverage:true,editing:{id:"coverage-1",kind:"Coverage",code:"CODE",name:"Name",parentCode:"PARENT",bridgeSystem:"ERGO",bridgeCode:"BRIDGE",policyType:"Auto",displayOrder:2,isActive:true,notes:"Notes"}});
    for(const value of ["PARENT","ERGO","BRIDGE","Auto"])assert.ok(edit.includes(value));
  }finally{client.clear();await server.close();}
});

test("page text removals and automatic save are scoped to their intended pages and new cards",async()=>{
  for(const language of ["el","en"]){
    const locale=JSON.parse(await read(`../../i18n/locales/${language}.json`));
    assert.equal(locale.policies.agencyLead,language==="el"?"Όλα τα συμβόλαια του γραφείου σας.":"All policies for your agency.");
  }
  for(const [file,key] of [["ClaimsPage","claims.agencyLead"],["ClaimIndemnitiesPage","indemnities.subtitle"],["FriendlySettlementsPage","friendly.subtitle"]])assert.ok(!(await read(`../../pages/${file}.tsx`)).includes(`t("${key}")`));
  assert.ok((await read("../../pages/ClaimsPage.tsx")).includes('t("claims.customerLead")'));
  const source=await read("../PolicyDetailDrawer.tsx");
  for(const expected of ['defaultKind="Coverage" lockKind simpleCoverage','setAutoCompleteGreenCard(!card)','setGreenCardEditingId(card.id)','if (autoCompleteGreenCard)','issueAndRecordGreenCardDelivery(card,','onSuccess: () => setGreenCardDialog(false)','onSettled: () =>','δεν αποστέλλεται αυτόματα email'])assert.ok(source.includes(expected),expected);
  assert.ok(source.indexOf("setGreenCardEditingId(card.id)",source.indexOf("const saveGreenCard"))<source.indexOf("issueAndRecordGreenCardDelivery(card,"));
});
