import layout from "./claim-card-layout.json";
/** datetime-local inputs require a local date without the API's UTC suffix. */
export function claimFieldValue(key:string,value:unknown):string {
 if(key!=="usaeSentAt"||!value)return String(value??"");const date=new Date(String(value));if(!Number.isFinite(date.getTime()))return String(value);
 const pad=(n:number)=>String(n).padStart(2,"0");return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export const CLAIM_CARD_TABS = layout.tabs;
export const CLAIM_CARD_FIELDS = layout.fields;
export const CLAIM_FIELDS = layout.fields.filter(field=>!field.path.startsWith("@")).map(field=>[field.key,field.label] as const);
export const CLAIM_PROFILE_GROUPS = [layout.fields.filter(f=>f.section==="main").slice(0,7).map(f=>f.key),layout.fields.filter(f=>f.section==="main").slice(7).map(f=>f.key)];
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
  const sent=next.usaeSentAt?String(next.usaeSentAt):null;if(sent&&!Number.isFinite(Date.parse(sent)))throw new Error("Συμπληρώστε έγκυρη ημερομηνία αποστολής.");
  const claimNumber=next.claimNumber==null?undefined:String(next.claimNumber).trim();if(claimNumber!==undefined&&(!claimNumber||claimNumber.length>64))throw new Error("Συμπληρώστε αριθμό ζημιάς έως 64 χαρακτήρες.");
  return {incidentDate:date("incidentDate"),reportedDate:date("reportedDate"),claimedAmount:amount("claimedAmount"),approvedAmount:amount("approvedAmount"),settledAmount:amount("settledAmount"),description:String(next.description??"").trim()||null,
    claimNumber,status:selected("status","Reported"),kind:selected("kind","VehicleDamage"),currency,affectsBonusMalus:bool("affectsBonusMalus",true),isInternalDamage:bool("isInternalDamage"),isFriendlySettlement:bool("isFriendlySettlement"),
    usaeCode:String(next.usaeCode??"").trim()||null,usaeKind:String(next.usaeKind??"").trim()||null,usaeStatus:selected("usaeStatus","NotSent"),liabilityPercent,usaeSentAt:changes.usaeSentAt?new Date(changes.usaeSentAt).toISOString():sent,usaeReceiptCode:String(next.usaeReceiptCode??"").trim()||null,replaceAdditional:true};
}
