import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../../api/client";
import { DetailProfileTabs } from "./DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, useProfileFieldEditor } from "./ProfileFieldEditor";
import { ProducerCardTable, producerTableSx, type ProducerLookups } from "./ProducerCardTable";
import { ProducerBalancesPanel } from "../ProducerBalancesPanel";
import { ProducerStatisticsDialog } from "../ProducerStatisticsDialog";
import { ProducerCommunicationHistory } from "../ProducerContactFields";
import { useProducerCategories } from "../useProducerCategories";
import { PolicyDetailDrawer } from "../PolicyDetailDrawer";
import { FinancialFilters } from "../FinancialFilters";
import { NumberedPager, RecordCountChip, TableToolbar } from "../TableToolbar";
import { SearchableSelect } from "../SearchableSelect";
import schema from "./producer-card-layout.json";

interface ProducerCardData { id:string;values:Record<string,string>;createdAt:string;updatedAt:string|null }
interface Lookup {id:string;name:string;code?:string}
const statuses=[{value:"Active",label:"Ενεργός"},{value:"Prospect",label:"Πιθανός συνεργάτης"},{value:"Suspended",label:"Σε αναστολή"},{value:"Terminated",label:"Λήξη συνεργασίας"}];
const hierarchy=[{value:"Producer",label:"Συνεργάτης"},{value:"Manager",label:"Υπεύθυνος παραγωγής"},{value:"Unit",label:"Μονάδα"},{value:"Assistant",label:"Βοηθός"},{value:"Agency",label:"Γραφείο"}];
export function ProducerUnifiedCard({producerId,open,onClose,onEdit,canEdit:explicitCanEdit,initialEditing=false}:{producerId:string|null;open:boolean;onClose:()=>void;onEdit?:()=>void;canEdit?:boolean;initialEditing?:boolean}){
  const canEdit=explicitCanEdit??!!onEdit,qc=useQueryClient();
  const q=useQuery({queryKey:["producer-card",producerId],enabled:open&&!!producerId,queryFn:async()=>(await api.get<ProducerCardData>(`/producers/${producerId}/card`)).data});
  const producers=useQuery({queryKey:["producers"],enabled:open,queryFn:async()=>(await api.get<Lookup[]>("/producers")).data});
  const companies=useQuery({queryKey:["producer-card-companies"],enabled:open,queryFn:async()=>(await api.get<Lookup[]>("/insurance-companies")).data});
  const offices=useQuery({queryKey:["agency-offices"],enabled:open,queryFn:async()=>(await api.get<Lookup[]>("/agency-offices")).data});
  const policies=useQuery({queryKey:["producer-card-production",producerId],enabled:open&&!!producerId,queryFn:async()=>(await api.get<ProducerProductionRow[]>(`/producers/${producerId}/card/production`)).data});
  const categories=useProducerCategories(open);const [tab,setTab]=useState(0),[statistics,setStatistics]=useState(false),[extraContacts,setExtraContacts]=useState(false),[communicationHistory,setCommunicationHistory]=useState(false);
  useEffect(()=>{if(open){setTab(0);setStatistics(false);setExtraContacts(false);setCommunicationHistory(false);}},[producerId,open]);
  const refresh=()=>{for(const key of ["producer-card","producer-detail","producer-card-production","producer-balances","producer-statistics","producer-card-history","producer-card-network"])void qc.invalidateQueries({queryKey:[key,producerId]});void qc.invalidateQueries({queryKey:["producers"]});};
  const session=useProfileFieldEditor({sessionKey:open?(producerId??""):"",values:q.data?.values??{},initialEditing:initialEditing&&canEdit,onClose,refresh,
    write:async(changes,accept)=>{if(!canEdit)throw new Error("Δεν επιτρέπεται η επεξεργασία συνεργάτη.");const saved=(await api.patch<ProducerCardData>(`/producers/${producerId}/card/fields`,changes)).data;qc.setQueryData(["producer-card",producerId],saved);accept(Object.keys(changes));}});
  const lookups:ProducerLookups=useMemo(()=>({company:[{value:"",label:"Χωρίς περιορισμό"},...(companies.data??[]).map(x=>({value:x.id,label:x.name+(x.code?" · "+x.code:"")}))],office:[{value:"",label:"Χωρίς σύνδεση"},...(offices.data??[]).map(x=>({value:x.id,label:x.name}))],producer:[{value:"",label:"Χωρίς σύνδεση"},...(producers.data??[]).map(x=>({value:x.id,label:x.name+(x.code?" · "+x.code:"")}))],policy:[{value:"",label:"Χωρίς σύνδεση"},...(policies.data??[]).map(x=>({value:x.id,label:x.policyNumber}))]}),[companies.data,offices.data,producers.data,policies.data]);
  const section=schema.tabs[tab]?.key??"general";
  const fields=(key:string)=><ProducerUnifiedFields section={key} producerId={producerId} session={session} canEdit={canEdit} lookups={lookups} categories={categories.data??[]}/>;
  return <Dialog open={open} onClose={session.requestClose} fullWidth maxWidth={false} PaperProps={{sx:profileDialogPaperSx}}><DialogTitle sx={{py:1,px:1.5,bgcolor:"#0d4f8d",color:"white",flexShrink:0}}><Typography component="span" fontSize={11}>ΚΑΡΤΕΛΑ ΣΥΝΕΡΓΑΤΗ</Typography><Typography fontSize={22} fontWeight={800}>{q.data?.values.name??"Συνεργάτης"}</Typography><Typography fontSize={12}>{q.data?.values.code} · {statuses.find(x=>x.value===q.data?.values.status)?.label}</Typography></DialogTitle>
    <DialogContent sx={{p:1,minHeight:0}}><DetailProfileTabs value={tab} onChange={setTab} items={schema.tabs.map(t=>({label:t.label,icon:<PersonIcon/>}))}/><ProfileEditorFeedback session={session}/>
      {q.isLoading&&<CircularProgress size={24}/>} {q.isError&&<Alert severity="error">{extractErrorMessage(q.error)}</Alert>}
      {q.data&&<>
        {fields(section)}
        {section==="general"&&categories.isError&&<Alert severity="error">Δεν φορτώθηκαν οι κατηγορίες συνεργατών.</Alert>}
        {section==="communication"&&<Stack direction="row" gap={.75} mb={1} flexWrap="wrap"><Button color="success" variant="contained" size="small" onClick={()=>setExtraContacts(true)}>Διεύθυνση αλληλογραφίας</Button><Button color="success" variant="contained" size="small" onClick={()=>setCommunicationHistory(true)}>Ιστορικό επικοινωνίας</Button></Stack>}
        {section==="production"&&producerId&&<ProducerProductionTable rows={policies.data??[]} loading={policies.isLoading} error={policies.error} canEdit={canEdit}/>}
        {section==="financial"&&producerId&&<ProducerBalancesPanel producerId={producerId}/>}
        {section==="network"&&producerId&&<ProducerNetworkTable producerId={producerId} onChanged={refresh} canEdit={canEdit}/>}
        {section==="history"&&producerId&&<ProducerCardHistory producerId={producerId}/>}
        {schema.tables.some(t=>t.section===section)&&producerId&&<ProducerCardTable key={section} producerId={producerId} section={section} canEdit={canEdit} lookups={lookups} onChanged={refresh}/>}
        {extraContacts&&<Dialog open onClose={()=>setExtraContacts(false)} fullWidth maxWidth="lg"><DialogTitle>Διεύθυνση αλληλογραφίας</DialogTitle><DialogContent sx={{bgcolor:"#edf3f9"}}>{fields("contactExtra")}</DialogContent><DialogActions><Button color="error" variant="contained" onClick={()=>setExtraContacts(false)}>Κλείσιμο</Button></DialogActions></Dialog>}
      </>}
    </DialogContent><DialogActions sx={{p:1,gap:.75,flexWrap:"wrap",bgcolor:"#f8fbff"}}><Button size="small" color="primary" variant="contained" startIcon={<BarChartIcon/>} disabled={!q.data} onClick={()=>setStatistics(true)}>Στατιστικά</Button>{canEdit?<ProfileEditorActions session={session} label="συνεργάτη"/>:<Button color="error" variant="contained" onClick={session.requestClose}>Κλείσιμο</Button>}</DialogActions>
    {producerId&&<><ProducerStatisticsDialog producerId={producerId} name={q.data?.values.name??"Συνεργάτης"} open={statistics} onClose={()=>setStatistics(false)}/><ProducerCommunicationHistory producerId={producerId} open={communicationHistory} onClose={()=>setCommunicationHistory(false)}/></>}
  </Dialog>;
}

interface ProducerProductionRow {id:string;policyNumber:string;customerName:string;company:string;startDate:string;endDate:string;premium:number;netPremium:number|null;commission:number;currency:string;status:string;policyType:string}
const policyStatus:Record<string,string>={Active:"Ενεργό",Prospect:"Πιθανό",Draft:"Πρόχειρο",Expired:"Ληγμένο",Cancelled:"Ακυρωμένο",Renewed:"Ανανεωμένο",Pending:"Σε αναμονή"};
export function ProducerProductionTable({rows,loading,error,canEdit}:{rows:ProducerProductionRow[];loading:boolean;error:unknown;canEdit:boolean}){
  const [search,setSearch]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[currency,setCurrency]=useState(""),[company,setCompany]=useState("");const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(20),[policyId,setPolicyId]=useState<string|null>(null);
  const [action,setAction]=useState<{token:number;action:"csv"|"xlsx"|"pdf"|"print"}>({token:0,action:"xlsx"});
  const filtered=rows.filter(r=>(!search||[r.policyNumber,r.customerName,r.company].join(" ").toLocaleLowerCase("el-GR").includes(search.toLocaleLowerCase("el-GR")))&&(!from||r.startDate>=from)&&(!to||r.startDate<=to)&&(!currency||r.currency===currency)&&(!company||r.company===company));
  const columns=[{key:"policyNumber",label:"Αριθμός συμβολαίου"},{key:"customerName",label:"Πελάτης"},{key:"company",label:"Ασφαλιστική"},{key:"startDate",label:"Έναρξη",map:(r:ProducerProductionRow)=>new Date(r.startDate+"T12:00:00").toLocaleDateString("el-GR")},{key:"endDate",label:"Λήξη",map:(r:ProducerProductionRow)=>new Date(r.endDate+"T12:00:00").toLocaleDateString("el-GR")},{key:"premium",label:"Μικτά"},{key:"netPremium",label:"Καθαρά"},{key:"commission",label:"Προμήθεια"},{key:"currency",label:"Νόμισμα"},{key:"status",label:"Κατάσταση",map:(r:ProducerProductionRow)=>policyStatus[r.status]??r.status}];
  const last=Math.max(1,Math.ceil(filtered.length/pageSize)),visible=Math.min(page,last);
  return <Stack gap={.75}><Stack direction="row" alignItems="center" gap={1} flexWrap="wrap"><Typography fontWeight={800}>Παραγωγή συνεργάτη</Typography><RecordCountChip count={filtered.length}/><Button size="small" onClick={()=>setAction(x=>({token:x.token+1,action:"xlsx"}))}>Excel</Button><Button size="small" onClick={()=>setAction(x=>({token:x.token+1,action:"csv"}))}>CSV</Button><Button size="small" onClick={()=>setAction(x=>({token:x.token+1,action:"pdf"}))}>PDF</Button><Button size="small" onClick={()=>setAction(x=>({token:x.token+1,action:"print"}))}>Εκτύπωση</Button></Stack>
    <FinancialFilters title="Φίλτρα παραγωγής συνεργάτη"><Stack direction="row" gap={.75} flexWrap="wrap"><TextField size="small" label="Αναζήτηση συμβολαίου / πελάτη" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} sx={{flex:"1 1 230px"}}/><TextField size="small" label="Έναρξη από" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}} InputLabelProps={{shrink:true}} sx={{width:170}}/><TextField size="small" label="Έναρξη έως" type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1);}} InputLabelProps={{shrink:true}} sx={{width:170}}/><Box width={160}><SearchableSelect label="Νόμισμα" value={currency} onChange={v=>{setCurrency(v);setPage(1);}} options={[{value:"",label:"Όλα"},...Array.from(new Set(rows.map(r=>r.currency))).map(v=>({value:v,label:v}))]}/></Box><Box width={210}><SearchableSelect label="Ασφαλιστική" value={company} onChange={v=>{setCompany(v);setPage(1);}} options={[{value:"",label:"Όλες"},...Array.from(new Set(rows.map(r=>r.company))).map(v=>({value:v,label:v}))]}/></Box></Stack></FinancialFilters>
    {loading&&<CircularProgress size={22}/>} {!!error&&<Alert severity="error">{extractErrorMessage(error)}</Alert>}
    <TableToolbar query="" onQuery={()=>{}} count={rows.length} filteredCount={filtered.length} pageSize={pageSize} onPageSize={setPageSize} exportRows={filtered} exportFileName="producer-production" exportColumns={columns} printTitle="Παραγωγή συνεργάτη" hideSearch hideCount hidePageSize hideActionButtons hideColumnPicker snapshotExport actionRequest={action}/>
    <Box sx={{overflow:"auto",maxHeight:460,border:"1px solid #c5d3e1",borderRadius:1}}><Table size="small" stickyHeader sx={producerTableSx}><TableHead><TableRow>{columns.map(c=><TableCell key={c.key}>{c.label}</TableCell>)}<TableCell>Ενέργειες</TableCell></TableRow></TableHead><TableBody>{filtered.slice((visible-1)*pageSize,visible*pageSize).map(r=><TableRow key={r.id} hover onDoubleClick={()=>setPolicyId(r.id)} sx={r.status==="Prospect"?{bgcolor:"#fff0d5 !important"}:undefined}>{columns.map(c=><TableCell key={c.key}>{c.map?c.map(r):String(r[c.key as keyof ProducerProductionRow]??"—")}</TableCell>)}<TableCell><Button color="success" variant="contained" size="small" onClick={()=>setPolicyId(r.id)}>Καρτέλα συμβολαίου</Button></TableCell></TableRow>)}{!filtered.length&&!loading&&<TableRow><TableCell colSpan={columns.length+1}>Δεν υπάρχουν συμβόλαια για αυτήν την επιλογή.</TableCell></TableRow>}</TableBody></Table></Box><NumberedPager page={visible} totalPages={last} onPage={setPage} totalRows={filtered.length} pageSize={pageSize} onPageSize={v=>{setPageSize(v);setPage(1);}}/>
    <PolicyDetailDrawer policyId={policyId} open={!!policyId} onClose={()=>setPolicyId(null)} readOnly={!canEdit} presentation="modal"/>
  </Stack>;
}

function ProducerNetworkTable({producerId,onChanged,canEdit}:{producerId:string;onChanged:()=>void;canEdit:boolean}){
  const q=useQuery({queryKey:["producer-card-network",producerId],queryFn:async()=>(await api.get<(Lookup&{status:string;hierarchyLevel:string})[]>(`/producers/${producerId}/card/network`)).data});
  const [child,setChild]=useState<string|null>(null),[search,setSearch]=useState("");const [page,setPage]=useState(1);const rows=(q.data??[]).filter(r=>(r.name+" "+r.code).toLocaleLowerCase("el-GR").includes(search.toLocaleLowerCase("el-GR")));
  return <Stack spacing={.75}><Typography fontWeight={800}>Υφιστάμενοι συνεργάτες</Typography><TextField size="small" label="Αναζήτηση συνεργάτη" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{q.isError&&<Alert severity="error">{extractErrorMessage(q.error)}</Alert>}<Box sx={{overflow:"auto",maxHeight:330}}><Table size="small" stickyHeader sx={producerTableSx}><TableHead><TableRow><TableCell>Κωδικός</TableCell><TableCell>Συνεργάτης</TableCell><TableCell>Επίπεδο</TableCell><TableCell>Κατάσταση</TableCell><TableCell/></TableRow></TableHead><TableBody>{rows.slice((Math.min(page,Math.max(1,Math.ceil(rows.length/20)))-1)*20,Math.min(page,Math.max(1,Math.ceil(rows.length/20)))*20).map(r=><TableRow key={r.id}><TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{hierarchy.find(x=>x.value===r.hierarchyLevel)?.label??r.hierarchyLevel}</TableCell><TableCell>{statuses.find(x=>x.value===r.status)?.label??r.status}</TableCell><TableCell><Button color="success" variant="contained" size="small" onClick={()=>setChild(r.id)}>Καρτέλα συνεργάτη</Button></TableCell></TableRow>)}</TableBody></Table></Box><NumberedPager page={Math.min(page,Math.max(1,Math.ceil(rows.length/20)))} totalPages={Math.max(1,Math.ceil(rows.length/20))} totalRows={rows.length} pageSize={20} onPage={setPage}/>{child&&<ProducerUnifiedCard producerId={child} open onClose={()=>{setChild(null);onChanged();}} canEdit={canEdit}/>}</Stack>;
}
interface HistoryRow{id:string;date:string;action:string;user:string;entity:string;changes:{field:string;before:string;after:string}[]}
function ProducerCardHistory({producerId}:{producerId:string}){
  const q=useQuery({queryKey:["producer-card-history",producerId],queryFn:async()=>(await api.get<HistoryRow[]>(`/producers/${producerId}/card/history`)).data});
  const [search,setSearch]=useState(""),[page,setPage]=useState(1),[detail,setDetail]=useState<HistoryRow|null>(null);const rows=(q.data??[]).filter(x=>(x.user+" "+x.action+" "+x.changes.map(c=>c.field).join(" ")).toLocaleLowerCase("el-GR").includes(search.toLocaleLowerCase("el-GR")));const last=Math.max(1,Math.ceil(rows.length/20));
  return <Stack gap={.75}><Typography fontWeight={800}>Ιστορικό μεταβολών</Typography><TextField size="small" label="Αναζήτηση ιστορικού" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{q.isError&&<Alert severity="error">{extractErrorMessage(q.error)}</Alert>}<Box sx={{overflow:"auto",maxHeight:440}}><Table size="small" stickyHeader sx={producerTableSx}><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Ενέργεια</TableCell><TableCell>Χρήστης</TableCell><TableCell>Αλλαγές</TableCell><TableCell/></TableRow></TableHead><TableBody>{rows.slice((Math.min(page,last)-1)*20,Math.min(page,last)*20).map(r=><TableRow key={r.id}><TableCell>{new Date(r.date).toLocaleString("el-GR")}</TableCell><TableCell>{{Create:"Δημιουργία",Update:"Επεξεργασία",Delete:"Διαγραφή",Added:"Δημιουργία",Modified:"Επεξεργασία"}[r.action]??r.action}</TableCell><TableCell>{r.user}</TableCell><TableCell>{r.changes.map(x=>x.field).join(", ")}</TableCell><TableCell><Button color="success" variant="contained" size="small" onClick={()=>setDetail(r)}>Λεπτομέρειες</Button></TableCell></TableRow>)}{!rows.length&&!q.isLoading&&<TableRow><TableCell colSpan={5}>Δεν υπάρχουν καταγεγραμμένες μεταβολές.</TableCell></TableRow>}</TableBody></Table></Box><NumberedPager page={Math.min(page,last)} totalPages={last} onPage={setPage} totalRows={rows.length}/>
    <Dialog open={!!detail} onClose={()=>setDetail(null)} fullWidth maxWidth="md"><DialogTitle>Λεπτομέρειες μεταβολής</DialogTitle><DialogContent><Table size="small" sx={producerTableSx}><TableHead><TableRow><TableCell>Πεδίο</TableCell><TableCell>Πριν</TableCell><TableCell>Μετά</TableCell></TableRow></TableHead><TableBody>{detail?.changes.map((c,i)=><TableRow key={i}><TableCell>{c.field}</TableCell><TableCell sx={{whiteSpace:"pre-wrap !important"}}>{c.before||"—"}</TableCell><TableCell sx={{whiteSpace:"pre-wrap !important"}}>{c.after||"—"}</TableCell></TableRow>)}</TableBody></Table></DialogContent><DialogActions><Button color="error" variant="contained" onClick={()=>setDetail(null)}>Κλείσιμο</Button></DialogActions></Dialog>
  </Stack>;
}

export function ProducerUnifiedFields({section:key,producerId,session,canEdit,lookups,categories=[]}:{section:string;producerId:string|null;session:ReturnType<typeof useProfileFieldEditor>;canEdit:boolean;lookups:ProducerLookups;categories?:{id:string;name:string;isActive:boolean}[]}){
  return <Box data-producer-section={key} sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",md:"repeat(2,minmax(0,1fr))"},gap:1.5,py:.5,alignItems:"start"}}>{[0,1].map(column=><Stack key={column} spacing={.5} sx={{minWidth:0}}>{schema.fields.filter(f=>f.section===key&&f.column===column).map(f=>{
    let options="choices" in f?f.choices:undefined;
    if(f.key==="status")options=statuses;
    if(f.kind==="hierarchy")options=hierarchy;
    if(f.kind==="producer")options=lookups.producer.filter(x=>x.value!==producerId);
    if(f.kind==="tier")options=["None","A","B","C","D","E"].map(value=>({value,label:value==="None"?"Χωρίς βαθμίδα":value}));
    if(f.kind==="category")options=[{value:"",label:"Χωρίς κατηγορία"},...(categories).filter(x=>x.isActive||x.id===session.values.categoryId).map(x=>({value:x.id,label:x.name}))];
    return <ProfileEditableField key={f.key} label={f.label} field={f.key} session={canEdit?session:undefined} value={session.values[f.key]??""} options={options} type={f.kind==="date"?"date":f.kind==="email"?"email":["number","integer","percent"].includes(f.kind)?"number":"text"} multiline={f.kind==="multiline"}/>;
  })}</Stack>)}</Box>;
}
