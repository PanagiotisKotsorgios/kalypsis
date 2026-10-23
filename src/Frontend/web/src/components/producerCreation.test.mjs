import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

test("minimal partner creation opens the standard editor and office categories roundtrip independently of commission tiers", async context => {
  globalThis.localStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.sessionStorage ??= {getItem:()=>null,setItem(){},removeItem(){}};
  const server = await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});
  try {
    const {ThemeProvider,createTheme} = await server.ssrLoadModule("@mui/material");
    const {ProducerCreateDialog} = await server.ssrLoadModule("/src/components/ProducerCreateDialog.tsx");
    const {ProducerProfileFields} = await server.ssrLoadModule("/src/components/ProducerDetailDrawer.tsx");
    const {producerUpdatePayload} = await server.ssrLoadModule("/src/components/profile/producerProfile.ts");
    const {filterProducerListRows,producerListExportColumns} = await server.ssrLoadModule("/src/pages/ProducersPage.tsx");
    const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
    const render = child => renderToStaticMarkup(h(QueryClientProvider,{client},h(ThemeProvider,{theme:createTheme({components:{MuiDialog:{defaultProps:{disablePortal:true}}}})},child)));
    await context.test("only name, email, phone and prospect are requested initially; save is a real form submission", () => {
      const html = render(h(ProducerCreateDialog,{open:true,onClose(){},onSaved(){}}));
      for (const label of ["Ονοματεπώνυμο / επωνυμία","Email","Τηλέφωνο","Πιθανός συνεργάτης","Αποθήκευση &amp; καρτέλα"]) assert.ok(html.includes(label),label);
      assert.equal((html.match(/<input\b/g)??[]).length,4);
      for (const obsolete of ["Επίπεδο ιεραρχίας","Αριθμός σύμβασης","Αρχικός κωδικός πρόσβασης","IBAN"]) assert.ok(!html.includes(obsolete),obsolete);
      assert.ok(html.includes('form="new-producer-form"')); assert.ok(html.includes('type="submit"'));
    });
    await context.test("empty catalogue stays unclassified; actual office names are shown instead of hardcoded A-E labels", () => {
      const values={code:"P1",name:"Συνεργάτης",status:"Active",tier:"B",categoryId:"",hasContract:"false"};
      const empty=render(h(ProducerProfileFields,{values,categories:[]}));
      assert.ok(empty.includes("Κατηγορία συνεργάτη")); assert.ok(!empty.includes("Χωρίς κατηγορία")); assert.ok(!empty.includes("Κατηγορία B"));
      const own=render(h(ProducerProfileFields,{values:{...values,categoryId:"custom-id"},categories:[{id:"custom-id",code:"EXT",name:"Εξωτερικό δίκτυο",isActive:true,displayOrder:0}]}));
      assert.ok(own.includes("Εξωτερικό δίκτυο")); assert.ok(own.includes("Βαθμίδα B"));
      const updated=producerUpdatePayload({...values,tier:"B",additionalInfoJson:'{"keep":true}'},{categoryId:"custom-id"});
      assert.equal(updated.categoryId,"custom-id"); assert.equal(updated.tier,"B"); assert.equal(updated.additionalInfoJson,'{"keep":true}');
      assert.equal(producerUpdatePayload(updated,{categoryId:""}).categoryId,null);
    });
    await context.test("category filters and exports use office-defined categories, including uncategorised records", () => {
      const rows=[{id:"1",name:"Πρώτος",categoryId:"one",categoryName:"Ειδικό δίκτυο",tier:"A"},{id:"2",name:"Δεύτερος",categoryId:null,tier:"A"}];
      const filters={statusFilter:"",tierFilter:"",hasPoliciesOnly:false,hierarchyFilter:""};
      assert.deepEqual(filterProducerListRows(rows,{...filters,categoryFilter:"one"}).map(row=>row.id),["1"]);
      assert.deepEqual(filterProducerListRows(rows,{...filters,categoryFilter:"None"}).map(row=>row.id),["2"]);
      const category=producerListExportColumns(key=>key).find(column=>column.key==="tier");
      assert.equal(category.map(rows[0]),"Ειδικό δίκτυο"); assert.equal(category.map(rows[1]),"—");
    });
    await context.test("creation uses the returned producer ID and credentials remain above its standard card", async () => {
      const page=await readFile(new URL("../pages/ProducersPage.tsx",import.meta.url),"utf8");
      assert.ok(page.includes("openProducerCard(result.producer.id, true)"));
      assert.ok(page.indexOf("<CredentialsDialog")>page.indexOf("<ProducerDetailDrawer"));
      assert.ok(!page.includes("function ProducerDialog("));
      const lookup=await readFile(new URL("./useProducerCategories.ts",import.meta.url),"utf8");
      assert.ok(lookup.includes('"/lookups/producer-categories"'));
    });
  } finally { await server.close(); }
});
