import layout from "./policy-card-layout.json";
import { ProfileEditableField, type ProfileFieldSession } from "./ProfileFieldEditor";
import { PolicyFieldColumns } from "./PolicyFieldColumns";
import type { PolicyDetail } from "../PolicyDetailDrawer";
import { contractDurationLabel } from "../../utils/contractDuration";

export const POLICY_CARD_LAYOUT=layout;
export type PolicyCardOption={value:string;label:string;hint?:string};
const direct=new Set(["policyNumber","applicationNumber","insuranceCompanyId","previousInsuranceCompanyId","policyType","status","issuedAt","startDate","endDate","vehicleRegistrationPlate","vehicleUseCategory","packageCode","coverCode","contractPartyCustomerId","producerId","premium","netPremium","currency","driverVatNumber","reasonForCirculation","deliveredAt","deliveredTo","deliveryMethod","nextRenewalDate","renewalTransferToProducerId","renewalTransferToCarrierId","renewalInstructions","specialCommissionPercent","paymentFrequency","paymentCollectionMethod","paidDirectlyToCarrier"]);
export function policyCardFieldKey(key:string){return direct.has(key)?key:"risk:card:"+key;}
const statusLabels:Record<string,string>={Active:"Ενεργό",Prospect:"Πιθανό",Draft:"Πρόχειρο",Cancelled:"Ακυρωμένο",Expired:"Ληγμένο",Renewed:"Ανανεωμένο",Undelivered:"Απαράδοτο",AwaitingIssue:"Προς έκδοση",PendingRenewal:"Προς ανανέωση"};
const types:Record<string,string>={Auto:"Αυτοκίνητο",Home:"Περιουσία",Health:"Υγεία",Life:"Ζωή",Business:"Επιχείρηση",Travel:"Ταξίδι",Other:"Άλλος κλάδος"};
const frequency:Record<string,string>={Single:"Εφάπαξ",Monthly:"Μηνιαία",Quarterly:"Τριμηνιαία",Semiannual:"Εξαμηνιαία",Annual:"Ετήσια"};
const uses:Record<string,string>={EIX:"Επιβατικό ιδιωτικής χρήσης",FIX:"Φορτηγό ιδιωτικής χρήσης",FDX:"Φορτηγό δημόσιας χρήσης",Taxi:"Ταξί",Motorcycle:"Μοτοσικλέτα",Bus:"Λεωφορείο",Other:"Άλλη χρήση"};
const methods:Record<string,string>={Cash:"Μετρητά",BankDeposit:"Κατάθεση τραπέζης",Card:"Κάρτα",DebitOrder:"Πάγια εντολή",Cheque:"Επιταγή",Other:"Άλλο"};
export function PolicyCardFields({section,policy,session,options={},commission,omit=[]}: {
  section:string;omit?:string[];policy:PolicyDetail;session?:ProfileFieldSession;options?:Record<string,PolicyCardOption[]>;
  commission?:{agency?:number;producer?:number};
}){
  const derived:Record<string,string>={customerId:policy.customerDisplay,customerVat:policy.customerVat??"",customerPhone:policy.customerPhone??"",customerEmail:policy.customerEmail??"",partyVat:policy.contractPartyVat??(!policy.contractPartyCustomerId?policy.customerVat:"")??"",partyPhone:policy.contractPartyPhone??(!policy.contractPartyCustomerId?policy.customerPhone:"")??"",partyEmail:policy.contractPartyEmail??(!policy.contractPartyCustomerId?policy.customerEmail:"")??"",producerCode:policy.producerCode??"",duration:contractDurationLabel(policy.startDate,policy.endDate),createdAt:new Date(policy.createdAt).toLocaleString("el-GR"),updatedAt:policy.updatedAt?new Date(policy.updatedAt).toLocaleString("el-GR"):"",agencyCommission:commission?.agency==null?"Δεν έχει υπολογιστεί":`${commission.agency.toLocaleString("el-GR",{minimumFractionDigits:2})} ${policy.currency}`,producerCommission:commission?.producer==null?"Δεν έχει υπολογιστεί":`${commission.producer.toLocaleString("el-GR",{minimumFractionDigits:2})} ${policy.currency}`,overCommission:""};
  const defaultOptions:Record<string,PolicyCardOption[]>={status:Object.entries(statusLabels).map(([value,label])=>({value,label})),policyType:Object.entries(types).map(([value,label])=>({value,label})),paymentFrequency:Object.entries(frequency).map(([value,label])=>({value,label})),vehicleUseCategory:Object.entries(uses).map(([value,label])=>({value,label})),paymentCollectionMethod:Object.entries(methods).map(([value,label])=>({value,label})),deliveryMethod:[{value:"Hand",label:"Με το χέρι"},{value:"Email",label:"Email"},{value:"Post",label:"Ταχυδρομείο"},{value:"Courier",label:"Ταχυμεταφορά"}]};
  const fields=layout.fields.filter(field=>field.section===section&&!omit.includes(field.key));
  return <PolicyFieldColumns section={section} groups={[0,1].map(column=>fields.filter(f=>f.column===column).map(field=>{
    const key=policyCardFieldKey(field.key);const readOnly=field.kind==="readonly";const value=readOnly?derived[field.key]??"":session?.values[key]??String((policy as unknown as Record<string,unknown>)[field.key]??"");
    let choices=field.kind==="boolean"?[{value:"true",label:"Ναι"},{value:"false",label:"Όχι"}]:options[field.key]??defaultOptions[field.key];
    if(choices){choices=[{value:"",label:field.key==="contractPartyCustomerId"?"Ίδιος με τον ασφαλισμένο":"Δεν έχει οριστεί"},...choices];if(value&&!choices.some(option=>option.value===value))choices.push({value,label:value});}
    return <ProfileEditableField key={field.key} label={field.label} field={session&&!readOnly?key:undefined} session={session&&!readOnly?session:undefined} value={value} options={choices} multiline={field.kind==="multiline"} type={field.kind==="date"?"date":field.kind==="number"||field.kind==="integer"?"number":"text"} />;
  }))} />;
}
