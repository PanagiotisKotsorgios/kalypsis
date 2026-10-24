import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {createServer} from "vite";
import {createElement as h} from "react";
import {renderToStaticMarkup} from "react-dom/server";

test("policy desktop and web share four tabs, ordered fields and lossless field routes",async()=>{
 const file=new URL("./policy-card-layout.json",import.meta.url);const layout=JSON.parse(await readFile(file,"utf8"));
 assert.deepEqual(layout.tabs,["Καρτέλα Συμβολαίου","Καλύψεις","Οικονομικά","Ιστορικό συμβολαίου"]);assert.equal(layout.fields.length,72);assert.equal(new Set(layout.fields.map(f=>f.key)).size,72);
 if(existsSync("G:/kalypsis-desktop/src/Kalypsis.Desktop/Resources/policy-card-layout.json")){const desktop=JSON.parse((await readFile("G:/kalypsis-desktop/src/Kalypsis.Desktop/Resources/policy-card-layout.json","utf8")).replace(/^\uFEFF/,""));assert.deepEqual(layout,desktop);}
 globalThis.sessionStorage??={getItem:()=>null,setItem(){},removeItem(){}};globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
 const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});try{
  const {PolicyCardFields,policyCardFieldKey}=await server.ssrLoadModule("/src/components/profile/PolicyCardFields.tsx");
  const policy={policyNumber:"P1",startDate:"2026-01-01",endDate:"2027-01-01",createdAt:"2026-01-01T10:00:00Z",currency:"EUR",customerDisplay:"Πελάτης",customerVat:"123456789",insuranceCompanyId:"carrier",producerId:"producer"};
  const values=Object.fromEntries(layout.fields.filter(f=>f.kind!=="readonly").map(f=>[policyCardFieldKey(f.key),f.kind==="date"?"2026-10-24":f.kind==="boolean"?"true":"δοκιμή"]));
  const session={values,drafts:{},editAll:false,busy:false,change(){},commit:async()=>{},begin(){},saveAll(){},cancel(){},requestClose(){}};
  for(const section of ["main","additional","financial"]){const props={section,policy,session,options:{producerId:[{value:"producer",label:"Συνεργάτης"}]}};const view=renderToStaticMarkup(h(PolicyCardFields,props)),edit=renderToStaticMarkup(h(PolicyCardFields,{...props,session:{...session,editAll:true}}));const ids=html=>[...html.matchAll(/data-profile-field="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(ids(view),ids(edit));for(const field of layout.fields.filter(f=>f.section===section)){assert.ok(view.includes("Αντιγραφή "+field.label),field.key);if(field.kind!=="readonly")assert.ok(edit.includes("Αποθήκευση "+field.label),field.key);}}
  assert.equal(policyCardFieldKey("notes"),"risk:card:notes");assert.equal(policyCardFieldKey("policyNumber"),"policyNumber");assert.equal(policyCardFieldKey("paidOnCredit"),"risk:card:paidOnCredit");
 }finally{await server.close();}
});
