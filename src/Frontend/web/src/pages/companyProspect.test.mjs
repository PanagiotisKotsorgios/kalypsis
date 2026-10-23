import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

test("prospective cooperation is explicit at creation, orange in both directories and editable in the standard card", async () => {
  globalThis.localStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.sessionStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  try {
    const {ThemeProvider,createTheme}=await server.ssrLoadModule("@mui/material");
    const {ProductionCompanyQuickCreateDialog,CompanyDirectoryTable,CompanyProfileFields,toCompanyApiPayload}=await server.ssrLoadModule("/src/pages/ProductionCompaniesAgenciesPage.tsx");
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const render=child=>renderToStaticMarkup(h(QueryClientProvider,{client},h(ThemeProvider,{theme:createTheme({components:{MuiDialog:{defaultProps:{disablePortal:true}}}})},child)));
    for(const isBroker of [false,true]){
      const form=render(h(ProductionCompanyQuickCreateDialog,{open:true,isBroker,onClose(){},onSaved(){}}));
      assert.ok(form.includes("Πιθανή συνεργασία")); assert.ok(form.includes(isBroker ? "Νέο πρακτορείο" : "Νέα ασφαλιστική"));
      const table=render(h(CompanyDirectoryTable,{isBroker,companies:[{id:"prospect",name:"Υπό συζήτηση",isProspect:true,isActive:true},{id:"active",name:"Κανονική",isActive:true}],selectedIds:new Set(),onToggle(){},onToggleAll(){},onOpen(){},onEdit(){},onDelete(){}}));
      assert.ok(table.includes("Πιθανή συνεργασία")); assert.ok(table.includes("#FFF0D9")); assert.ok(table.includes("#FFE3B5")); assert.ok(table.includes("Ενεργή"));
    }
    const form={name:"Δοκιμή",code:"TEST",isActive:true,isBroker:false};
    assert.equal(toCompanyApiPayload({...form,isProspect:true}).isProspect,true);
    assert.equal(toCompanyApiPayload({...form,isProspect:false}).isProspect,false);
    assert.ok(!("isProspect" in toCompanyApiPayload(form)),"omitted state must not be silently reset by older forms");
    const values={name:"Δοκιμή",code:"TEST",isActive:"true",isProspect:"true"};
    const session={values,drafts:{},editing:[],editAll:false,copied:null,busy:false,error:null,message:null,start(){},change(){},save(){},copy(){}};
    const card=render(h(CompanyProfileFields,{session}));
    assert.ok(card.includes('data-profile-field="isProspect"')); assert.ok(card.includes("Πιθανή συνεργασία"));
  }finally{await server.close();}
});
