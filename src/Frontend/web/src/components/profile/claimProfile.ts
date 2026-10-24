import layout from "./claim-card-layout.json";
/** datetime-local inputs require a local date without the API's UTC suffix. */
export function claimFieldValue(key:string,value:unknown):string {
 if(key!=="usaeSentAt"||!value)return String(value??"");const date=new Date(String(value));if(!Number.isFinite(date.getTime()))return String(value);
 const pad=(n:number)=>String(n).padStart(2,"0");return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export const CLAIM_CARD_TABS = layout.tabs;
export const CLAIM_CARD_FIELDS = layout.fields;
export const CLAIM_FIELDS = layout.fields.filter(field=>!field.path.startsWith("@")).map(field=>[field.key,field.label] as const);
const mainFields=layout.fields.filter(f=>f.section==="main");
export const CLAIM_PROFILE_GROUPS=[mainFields.slice(0,mainFields.findIndex(f=>f.key==="customerName")).map(f=>f.key),mainFields.slice(mainFields.findIndex(f=>f.key==="customerName")).map(f=>f.key)];
export function claimKindOptions(kinds:{code:string;name:string;branchCode:string;isActive:boolean}[],branch:string,current?:string){const matching=kinds.filter(k=>!k.branchCode||k.branchCode===branch).sort((a,b)=>Number(!!b.branchCode)-Number(!!a.branchCode));const result=[...new Map(matching.map(k=>k.code).map(code=>[code,matching.find(k=>k.code===code)!])).values()].filter(k=>k.isActive||k.code===current).map(k=>({value:k.code,label:k.name}));if(current&&!result.some(k=>k.value===current))result.push({value:current,label:current});return result;}
/** Read each semantic column from top to bottom. */
export function claimInformationGroups<T>(fields: readonly T[]): readonly (readonly T[])[] {
  const size=Math.max(1,Math.ceil(fields.length/2));return [fields.slice(0,size),fields.slice(size)].filter(group=>group.length);
}
export function claimUpdatePayload(current: Record<string, unknown>, changes: Record<string, string>) {
  for(const key of Object.keys(changes))if(!CLAIM_FIELDS.some(([field])=>field===key))throw new Error("Μη υποστηριζόμενο πεδίο ζημιάς.");
  const next={...current,...changes};
  const amount=(key:string)=>{if(next[key]===""||next[key]==null)return null;const value=Number(String(next[key]).replace(",","."));if(!Number.isFinite(value)||value<0)throw new Error("Το ποσό πρέπει να είναι μη αρνητικός αριθμός.");return value;};
  const date=(key:string)=>{const value=String(next[key]??"");if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error("Συμπληρώστε έγκυρη ημερομηνία.");return value;};
  const bool=(key:string,fallback=false)=>{const raw=next[key];if(raw==null||raw==="")return fallback;if(raw===true||raw==="true")return true;if(raw===false||raw==="false")return false;throw new Error("Επιλέξτε Ναι ή Όχι.");};
  const selected=(key:string,fallback:string)=>{const value=String(next[key]??fallback);const field=layout.fields.find(f=>f.key===key);if(!field?.choices?.some(c=>c.value===value))throw new Error("Επιλέξτε έγκυρη τιμή.");return value;};
  const liabilityPercent=amount("liabilityPercent");if(liabilityPercent!=null&&liabilityPercent>100)throw new Error("Η ευθύνη πρέπει να είναι από 0 έως 100%.");
  const currency=String(next.currency||"EUR").trim().toUpperCase();if(!/^[A-Z]{3}$/.test(currency))throw new Error("Συμπληρώστε νόμισμα 3 λατινικών χαρακτήρων.");
  const text=(key:string,max=300)=>{const value=String(next[key]??"").trim();if(value.length>max)throw new Error("Το κείμενο είναι πολύ μεγάλο.");return value||null;};
  const optionalDate=(key:string)=>next[key]==null||next[key]===""?null:date(key);
  const incidentTime=text("incidentTime");if(incidentTime&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(incidentTime))throw new Error("Συμπληρώστε ώρα ΩΩ:ΛΛ (00:00–23:59).");
  for(const key of ["assessorPhone","carrierContactPhone"])if(next[key]&&!/^[+0-9 ()-]{7,40}$/.test(String(next[key])))throw new Error("Συμπληρώστε έγκυρο τηλέφωνο.");
  if(next.assessorEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(next.assessorEmail)))throw new Error("Συμπληρώστε έγκυρο email.");
  const kind=text("kind",60)||"VehicleDamage";
  const repairStartedDate=optionalDate("repairStartedDate"),repairCompletedDate=optionalDate("repairCompletedDate");if(repairStartedDate&&repairCompletedDate&&repairCompletedDate<repairStartedDate)throw new Error("Η ολοκλήρωση επισκευής πρέπει να είναι μετά την έναρξή της.");
  const garageId=text("garageId");if(garageId&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(garageId))throw new Error("Επιλέξτε συνεργείο από τη λίστα.");
  const sent=next.usaeSentAt?String(next.usaeSentAt):null;if(sent&&!Number.isFinite(Date.parse(sent)))throw new Error("Συμπληρώστε έγκυρη ημερομηνία αποστολής.");
  const claimNumber=next.claimNumber==null?undefined:String(next.claimNumber).trim();if(claimNumber!==undefined&&(!claimNumber||claimNumber.length>64))throw new Error("Συμπληρώστε αριθμό ζημιάς έως 64 χαρακτήρες.");
  return {incidentDate:date("incidentDate"),reportedDate:date("reportedDate"),claimedAmount:amount("claimedAmount"),approvedAmount:amount("approvedAmount"),settledAmount:amount("settledAmount"),description:String(next.description??"").trim()||null,
    claimNumber,status:selected("status","Reported"),kind,currency,affectsBonusMalus:bool("affectsBonusMalus",true),isInternalDamage:bool("isInternalDamage"),isFriendlySettlement:bool("isFriendlySettlement"),
    usaeCode:String(next.usaeCode??"").trim()||null,usaeKind:String(next.usaeKind??"").trim()||null,usaeStatus:selected("usaeStatus","NotSent"),liabilityPercent,usaeSentAt:changes.usaeSentAt?new Date(changes.usaeSentAt).toISOString():sent,usaeReceiptCode:String(next.usaeReceiptCode??"").trim()||null,replaceAdditional:true,replaceDossier:true,
    carrierClaimNumber:text("carrierClaimNumber"),incidentTime,incidentLocation:text("incidentLocation"),incidentCity:text("incidentCity"),incidentCause:text("incidentCause"),damageDescription:text("damageDescription",4000),policeInvolved:next.policeInvolved==null||next.policeInvolved===""?null:bool("policeInvolved"),policeStation:text("policeStation"),policeReportNumber:text("policeReportNumber"),garageId,
    assessorName:text("assessorName"),assessorPhone:text("assessorPhone"),assessorEmail:text("assessorEmail"),carrierContactName:text("carrierContactName"),carrierContactPhone:text("carrierContactPhone"),reportedToCarrierDate:optionalDate("reportedToCarrierDate"),inspectionDate:optionalDate("inspectionDate"),repairStartedDate,repairCompletedDate,nextActionDate:optionalDate("nextActionDate"),closedDate:optionalDate("closedDate")};
}
