import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

test("unified producer fields retain the same layout in view and edit across every section",async t=>{
  globalThis.sessionStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
  const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  try{
    const schema=JSON.parse(await readFile(new URL("./producer-card-layout.json",import.meta.url),"utf8"));
    const {ProducerUnifiedFields,ProducerProductionTable}=await server.ssrLoadModule("/src/components/profile/ProducerUnifiedCard.tsx");
    const {ProducerCardTable}=await server.ssrLoadModule("/src/components/profile/ProducerCardTable.tsx");
    const {AuthProvider}=await server.ssrLoadModule("/src/auth/AuthContext.tsx");
    const {ThemeProvider,createTheme}=await server.ssrLoadModule("@mui/material/styles");
    const theme=createTheme();
    const render=(C,p)=>renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(ThemeProvider,{theme},createElement(AuthProvider,null,createElement(C,p)))));
    const session={values:Object.fromEntries(schema.fields.map(f=>[f.key,""])),drafts:{},editAll:false,busy:false,change(){},commit:async()=>{},begin(){},saveAll(){},cancel(){},requestClose(){}};
    const lookups={producer:[],company:[],office:[],policy:[]};
    const fields=html=>[...html.matchAll(/data-profile-field="([^"]+)"/g)].map(m=>m[1]);
    for(const section of [...new Set(schema.fields.map(f=>f.section))])await t.test(section,()=>{
      const props={section,producerId:"P1",session,canEdit:true,lookups};
      const view=render(ProducerUnifiedFields,props),edit=render(ProducerUnifiedFields,{...props,session:{...session,editAll:true}});
      assert.deepEqual(fields(view),fields(edit));assert.equal(fields(view).length,schema.fields.filter(f=>f.section===section).length);
      assert.ok(!view.includes("<input"));assert.ok(/<(input|textarea)\b/.test(edit));
      assert.ok(view.includes("Αντιγραφή"));assert.ok(view.includes("Επεξεργασία"));assert.ok(edit.includes("Αποθήκευση"));
    });
    await t.test("existing records display compactly, without exporting secret values",()=>{
      client.setQueryData(["producer-card-entries","P1","companies"],[{id:"E1",kind:"companies",createdAt:"2026-10-25",values:{insuranceCompanyId:"C1",producerCode:"001;002",quotePassword:"never-show"}}]);
      const html=render(ProducerCardTable,{producerId:"P1",section:"companies",canEdit:true,lookups:{...lookups,company:[{value:"C1",label:"Δοκιμαστική εταιρεία"}]},onChanged(){}});
      assert.ok(html.includes("Δοκιμαστική εταιρεία"));assert.ok(html.includes("001;002"));assert.ok(!html.includes("never-show"));
      for(const label of ["Προσθήκη","Επεξεργασία","Διαγραφή","Λεπτομέρειες","CSV","PDF","Εκτύπωση"])assert.ok(html.includes(label),label);
      assert.ok(html.includes("overflow:auto"));
    });
    await t.test("production retains all actual records and a filtered snapshot export path",async()=>{
      const html=render(ProducerProductionTable,{rows:[{id:"X",policyNumber:"POL-0001",customerName:"Δοκιμή Πελάτη",company:"Εταιρεία",startDate:"2026-01-01",endDate:"2027-01-01",premium:100,netPremium:80,commission:12,currency:"EUR",status:"Active",policyType:"Auto"}],loading:false,error:null,canEdit:true});
      assert.ok(html.includes("POL-0001"));assert.ok(html.includes("Δοκιμή Πελάτη"));assert.ok(html.includes("Καθαρά"));assert.ok(!html.includes("Φόρος ασφαλίστρων"));
      const source=await readFile(new URL("./ProducerUnifiedCard.tsx",import.meta.url),"utf8");assert.ok(source.includes("exportRows={filtered}"));assert.ok(source.includes("snapshotExport"));
    });
  }finally{client.clear();await server.close();}
});
