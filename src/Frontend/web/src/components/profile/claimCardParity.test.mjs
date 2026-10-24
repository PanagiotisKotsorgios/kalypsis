import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite";
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
test("desktop and web claim manifests match and every field survives full snapshots",async()=>{
 const local=JSON.parse(await readFile(new URL("./claim-card-layout.json",import.meta.url),"utf8"));
 const desktopPath=process.env.KALYPSIS_DESKTOP_REPO?process.env.KALYPSIS_DESKTOP_REPO+"/src/Kalypsis.Desktop/Resources/claim-card-layout.json":"G:/kalypsis-desktop/src/Kalypsis.Desktop/Resources/claim-card-layout.json";if(existsSync(desktopPath)){const desktop=JSON.parse((await readFile(desktopPath,"utf8")).replace(/^\uFEFF/,""));assert.deepEqual(local,desktop);}
 assert.deepEqual(local.tabs,["Καρτέλα Ζημιάς","Πρόσθετα στοιχεία","Όχημα","Οικονομικά","Εμπλεκόμενοι"]);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:"custom"});try{
 const {claimUpdatePayload,claimFieldValue}=await server.ssrLoadModule("/src/components/profile/claimProfile.ts");
 const current={claimNumber:"CL1",status:"Pending",kind:"Fire",incidentDate:"2026-10-01",reportedDate:"2026-10-02",claimedAmount:1200,approvedAmount:950.25,settledAmount:150,currency:"EUR",usaeCode:"U1",usaeKind:"Υλικά",usaeStatus:"Accepted",liabilityPercent:25.5,affectsBonusMalus:false,isInternalDamage:true,isFriendlySettlement:true,usaeReceiptCode:"R1",usaeSentAt:"2026-10-24T12:00:00",description:"Notes"};
 const saved=claimUpdatePayload(current,{description:"New",settledAmount:"125,5"});for(const key of Object.keys(current).filter(k=>!["description","settledAmount"].includes(k)))assert.equal(saved[key],current[key],key);assert.equal(saved.approvedAmount,950.25);assert.equal(saved.settledAmount,125.5);assert.equal(saved.replaceAdditional,true);
 for(const changes of [{liabilityPercent:"101"},{settledAmount:"-1"},{currency:"EURO"},{affectsBonusMalus:"yes"},{claimNumber:""},{usaeStatus:"other"}])assert.throws(()=>claimUpdatePayload(current,changes));
 const local=claimFieldValue("usaeSentAt","2026-10-24T12:00:00Z");assert.match(local,/^2026-10-24T\d{2}:00$/);assert.equal(claimUpdatePayload(current,{usaeSentAt:local}).usaeSentAt,"2026-10-24T12:00:00.000Z");
 const cleared=claimUpdatePayload(current,{usaeCode:"",liabilityPercent:"",usaeSentAt:"",settledAmount:""});for(const key of ["usaeCode","liabilityPercent","usaeSentAt","settledAmount"])assert.equal(cleared[key],null);
 }finally{await server.close();}
});
