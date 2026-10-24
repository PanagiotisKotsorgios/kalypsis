import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite";
import {createElement as h} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
test("claim dossier retains all related fields, validates inputs and scopes custom kinds",async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:"custom"});try{
 const {claimUpdatePayload,claimKindOptions}=await server.ssrLoadModule("/src/components/profile/claimProfile.ts");
 const current={claimNumber:"CL1",incidentDate:"2026-10-01",reportedDate:"2026-10-02",status:"Reported",kind:"GLASS",carrierClaimNumber:"INS-1",incidentTime:"14:35",incidentLocation:"Οδός",incidentCity:"Αθήνα",incidentCause:"Σύγκρουση",damageDescription:"Προφυλακτήρας",policeInvolved:true,policeStation:"Τροχαία",policeReportNumber:"P1",garageId:"12345678-1234-1234-1234-123456789abc",assessorName:"QA",assessorPhone:"6900000000",assessorEmail:"qa@example.com",carrierContactName:"Γραφείο",carrierContactPhone:"2100000000",reportedToCarrierDate:"2026-10-02",inspectionDate:"2026-10-03",repairStartedDate:"2026-10-04",repairCompletedDate:"2026-10-08",nextActionDate:"2026-10-10",closedDate:"2026-10-11"};
 const body=claimUpdatePayload(current,{description:"Changed"});for(const key of Object.keys(current))assert.equal(body[key],current[key],key);assert.equal(body.replaceDossier,true);
 const cleared=claimUpdatePayload(current,{garageId:"",policeInvolved:"",inspectionDate:"",carrierClaimNumber:""});for(const key of ["garageId","policeInvolved","inspectionDate","carrierClaimNumber"])assert.equal(cleared[key],null,key);
 for(const changes of [{incidentTime:"25:00"},{incidentTime:"3:45"},{assessorPhone:"letters"},{assessorEmail:"invalid"},{garageId:"random"},{repairCompletedDate:"2026-10-03"}])assert.throws(()=>claimUpdatePayload(current,changes));
 const kinds=[{code:"GLASS",name:"Γενικό",branchCode:"",isActive:true},{code:"GLASS",name:"Αυτοκίνητο",branchCode:"Auto",isActive:true},{code:"HOME",name:"Κατοικία",branchCode:"Home",isActive:true}];assert.deepEqual(claimKindOptions(kinds,"Auto"),[{value:"GLASS",label:"Αυτοκίνητο"}]);assert.deepEqual(claimKindOptions([...kinds,{code:"GLASS",name:"Κλειστό",branchCode:"Health",isActive:false}],"Health"),[]);
 }finally{await server.close();}
});
test("all claim fields keep customer-style copy and edit controls, including custom kinds and garages",async()=>{
 globalThis.sessionStorage??={getItem:()=>null,setItem(){},removeItem(){}};globalThis.localStorage??={getItem:()=>null,setItem(){},removeItem(){}};
 const server=await createServer({server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/@mui\//]},appType:"custom"});const client=new QueryClient({defaultOptions:{queries:{retry:false}}});try{
 const {ClaimProfileFields}=await server.ssrLoadModule("/src/components/ClaimDetailDrawer.tsx");const {CLAIM_CARD_FIELDS}=await server.ssrLoadModule("/src/components/profile/claimProfile.ts");const {ClaimDossierActions}=await server.ssrLoadModule("/src/components/profile/ClaimDossierDialogs.tsx");
 const claim={claimNumber:"CL1",incidentDate:"2026-10-01",reportedDate:"2026-10-02",status:"Reported",kind:"GLASS",incidentTime:"14:35",garageId:"12345678-1234-1234-1234-123456789abc",assessorEmail:"qa@example.com"};const values=Object.fromEntries(CLAIM_CARD_FIELDS.map(f=>[f.key,String(claim[f.key]??"")]));
 const render=(component,props)=>renderToStaticMarkup(h(QueryClientProvider,{client},h(component,props)));const session={values,drafts:{},editAll:false,busy:false,change(){},commit:async()=>{},begin(){},saveAll(){},cancel(){},requestClose(){}};
 for(const section of ["main","additional","financial"]){const props={claim,session,section,kindOptions:[{value:"GLASS",label:"Θραύση κρυστάλλων"}],garageOptions:[{value:claim.garageId,label:"Συνεργείο · G1"}]};const view=render(ClaimProfileFields,props),edit=render(ClaimProfileFields,{...props,session:{...session,editAll:true}});const ids=html=>[...html.matchAll(/data-profile-field="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(ids(view),ids(edit));for(const field of CLAIM_CARD_FIELDS.filter(f=>f.section===section)){assert.ok(view.includes("Αντιγραφή "+field.label),field.label);if(!field.path.startsWith("@"))assert.ok(edit.includes("Αποθήκευση "+field.label),field.label);}if(section==="additional")assert.ok(view.includes("Συνεργείο · G1"));}
 const actions=render(ClaimDossierActions,{claimId:"c1",branch:"Auto",kinds:[],garages:[],canEdit:true,onReload(){},onGarage:async()=>{}});assert.ok(actions.includes("Φωτογραφίες"));assert.ok(actions.includes("Είδη ζημιών ανά κλάδο"));assert.ok(actions.includes("Επιλογή συνεργείου"));const read=render(ClaimDossierActions,{claimId:"c1",branch:"Auto",kinds:[],garages:[],canEdit:false,onReload(){},onGarage:async()=>{}});assert.ok(!read.includes("Είδη ζημιών ανά κλάδο"));
 }finally{client.clear();await server.close();}
});
