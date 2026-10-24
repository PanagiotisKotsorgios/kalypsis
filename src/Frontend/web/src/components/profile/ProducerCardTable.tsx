import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import { api, extractErrorMessage } from "../../api/client";
import { FinancialFilters } from "../FinancialFilters";
import { NumberedPager, RecordCountChip, TableToolbar } from "../TableToolbar";
import { SearchableSelect } from "../SearchableSelect";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, useProfileFieldEditor } from "./ProfileFieldEditor";
import schema from "./producer-card-layout.json";

export type ProducerTableDefinition = typeof schema.tables[number];
export interface ProducerEntry { id: string; kind: string; values: Record<string,string>; createdAt: string; updatedAt?: string }
export interface ProducerLookup { value: string; label: string }
export type ProducerLookups = Record<string, ProducerLookup[]>;
export const producerTableSx = { minWidth: 650, "& th": { bgcolor: "#e3eaf1", color: "#173958", fontWeight: 800, py: .8 }, "& td": { py: .6, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, "& tbody tr:nth-of-type(even)": { bgcolor: "#e8edf3" }, "& tbody tr.Mui-selected, & tbody tr.Mui-selected:hover": { bgcolor: "#0b64ad", "& td, & .MuiButton-root": { color: "#fff" } } };

export function producerEntryDisplay(entry: ProducerEntry, field: ProducerTableDefinition["fields"][number], lookups: ProducerLookups) {
  const value=entry.values[field.key]??"";
  const options=("choices" in field ? field.choices : undefined) ?? lookups[field.kind];
  if(field.kind==="date" && /^\d{4}-\d{2}-\d{2}$/.test(value))return new Date(value+"T12:00:00").toLocaleDateString("el-GR");
  return options?.find(x=>x.value===value)?.label??value;
}

export function ProducerCardTable({ producerId, section, canEdit, lookups, onChanged }: { producerId:string; section:string; canEdit:boolean; lookups:ProducerLookups; onChanged:()=>void }) {
  const definitions=schema.tables.filter(d=>d.section===section);
  const [kind,setKind]=useState(definitions[0]?.key??"");
  const def=definitions.find(d=>d.key===kind)??definitions[0];
  const [search,setSearch]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(20),[selected,setSelected]=useState<ProducerEntry|null>(null);
  const [editing,setEditing]=useState<{row:ProducerEntry|null;edit:boolean}|null>(null);
  const [exportAction,setExportAction]=useState<{token:number;action:"csv"|"xlsx"|"pdf"|"print"}>({token:0,action:"xlsx"});
  const qc=useQueryClient();
  const q=useQuery({queryKey:["producer-card-entries",producerId,kind],enabled:!!def,queryFn:async()=>(await api.get<ProducerEntry[]>(`/producers/${producerId}/card/entries/${kind}`)).data});
  const remove=useMutation({mutationFn:async(row:ProducerEntry)=>api.delete(`/producers/${producerId}/card/entries/${kind}/${row.id}`),onSuccess:()=>{setSelected(null);refresh();}});
  const refresh=()=>{void qc.invalidateQueries({queryKey:["producer-card-entries",producerId]});onChanged();};
  const rows=useMemo(()=>(q.data??[]).filter(row=>{
    const date=row.values.effectiveFrom||row.values.date||row.createdAt.slice(0,10);
    return (!from||date>=from)&&(!to||date<=to)&&(!search||def.fields.some(f=>f.kind!=="secret"&&producerEntryDisplay(row,f,lookups).toLocaleLowerCase("el-GR").includes(search.toLocaleLowerCase("el-GR"))));
  }),[q.data,search,from,to,def,lookups]);
  if(!def)return null;
  const columns=def.fields.filter(f=>f.kind!=="secret");
  const last=Math.max(1,Math.ceil(rows.length/pageSize)),visiblePage=Math.min(page,last);
  const error=q.error??remove.error;
  return <Stack spacing={.75} sx={{minWidth:0,mt:.75}}>
    <Stack direction="row" alignItems="center" spacing={.75} useFlexGap flexWrap="wrap">
      {definitions.length>1?<Box sx={{width:{xs:"100%",sm:240}}}><SearchableSelect label="Ενότητα" value={kind} onChange={value=>{setKind(value);setSelected(null);setSearch("");setPage(1);}} options={definitions.map(d=>({value:d.key,label:d.label}))}/></Box>:<Typography fontWeight={800}>{def.label}</Typography>}
      <RecordCountChip count={rows.length}/>
      {canEdit&&kind!=="transfers"&&<><Button color="success" variant="contained" size="small" onClick={()=>setEditing({row:null,edit:true})}>Προσθήκη</Button><Button color="success" variant="contained" size="small" onClick={()=>selected?setEditing({row:selected,edit:true}):window.alert("Παρακαλώ επιλέξτε εγγραφή για επεξεργασία.")}>Επεξεργασία</Button><Button color="error" variant="contained" size="small" disabled={remove.isPending} onClick={()=>{if(!selected){window.alert("Παρακαλώ επιλέξτε εγγραφή για διαγραφή.");return;}if(window.confirm("Να διαγραφεί η επιλεγμένη εγγραφή;"))remove.mutate(selected);}}>Διαγραφή</Button></>}
      <Button size="small" onClick={()=>setExportAction(x=>({token:x.token+1,action:"xlsx"}))}>Excel</Button><Button size="small" onClick={()=>setExportAction(x=>({token:x.token+1,action:"csv"}))}>CSV</Button><Button size="small" onClick={()=>setExportAction(x=>({token:x.token+1,action:"pdf"}))}>PDF</Button><Button size="small" onClick={()=>setExportAction(x=>({token:x.token+1,action:"print"}))}>Εκτύπωση</Button>
    </Stack>
    <FinancialFilters title="Φίλτρα εγγραφών συνεργάτη"><Stack direction="row" gap={.75} flexWrap="wrap"><TextField size="small" placeholder="Αναζήτηση…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} sx={{flex:"1 1 200px"}}/><TextField size="small" label="Από" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}} InputLabelProps={{shrink:true}} sx={{width:160}}/><TextField size="small" label="Έως" type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1);}} InputLabelProps={{shrink:true}} sx={{width:160}}/></Stack></FinancialFilters>
    {error&&<Alert severity="error">{extractErrorMessage(error)}</Alert>}{q.isLoading&&<CircularProgress size={22}/>}
    <TableToolbar query="" onQuery={()=>{}} count={q.data?.length??0} filteredCount={rows.length} pageSize={pageSize} onPageSize={setPageSize} exportRows={rows} exportFileName={"producer-"+kind} exportColumns={columns.map(f=>({key:f.key,label:f.label,map:(row:ProducerEntry)=>producerEntryDisplay(row,f,lookups)}))} printTitle={def.label} hideSearch hideCount hidePageSize hideActionButtons hideColumnPicker snapshotExport actionRequest={exportAction}/>
    <Box sx={{overflow:"auto",maxHeight:410,border:"1px solid #c5d3e1",borderRadius:1}}><Table size="small" stickyHeader sx={producerTableSx}><TableHead><TableRow>{columns.slice(0,7).map(f=><TableCell key={f.key}>{f.label}</TableCell>)}<TableCell>Ενέργειες</TableCell></TableRow></TableHead><TableBody>
      {rows.slice((visiblePage-1)*pageSize,visiblePage*pageSize).map(row=><TableRow key={row.id} hover selected={selected?.id===row.id} onClick={()=>setSelected(row)} onDoubleClick={()=>setEditing({row,edit:false})}>{columns.slice(0,7).map(f=><TableCell key={f.key} title={producerEntryDisplay(row,f,lookups)}>{producerEntryDisplay(row,f,lookups)||"—"}</TableCell>)}<TableCell><Button size="small" color="success" variant="contained" onClick={e=>{e.stopPropagation();setEditing({row,edit:false});}}>Λεπτομέρειες</Button></TableCell></TableRow>)}
      {!rows.length&&!q.isLoading&&<TableRow><TableCell colSpan={Math.min(columns.length,7)+1}>Δεν υπάρχουν εγγραφές για αυτήν την επιλογή.</TableCell></TableRow>}
    </TableBody></Table></Box><NumberedPager page={visiblePage} totalPages={last} onPage={setPage} totalRows={rows.length} pageSize={pageSize} onPageSize={value=>{setPageSize(value);setPage(1);}}/>
    {editing&&<ProducerEntryDialog producerId={producerId} definition={def} item={editing.row} initialEditing={editing.edit&&canEdit} canEdit={canEdit&&kind!=="transfers"} lookups={lookups} onClose={()=>setEditing(null)} onSaved={refresh}/>}
  </Stack>;
}

function ProducerEntryDialog({producerId,definition:definition,item,initialEditing,canEdit,lookups,onClose,onSaved}:{producerId:string;definition:ProducerTableDefinition;item:ProducerEntry|null;initialEditing:boolean;canEdit:boolean;lookups:ProducerLookups;onClose:()=>void;onSaved:()=>void}){
  const [saved,setSaved]=useState(item),[staged,setStaged]=useState<Record<string,string>>(()=>({currency:"EUR",isActive:"true",effectiveFrom:new Date().toLocaleDateString("sv-SE"),year:String(new Date().getFullYear()),month:String(new Date().getMonth()+1),status:"Pending",...(definition.key==="contacts"?{kind:"Email"}:{})})),[blob,setBlob]=useState("");
  const [fileError,setFileError]=useState("");const values=saved?.values??staged;
  const write=async(changes:Record<string,string|null>)=>{const response=saved?await api.put<ProducerEntry>(`/producers/${producerId}/card/entries/${definition.key}/${saved.id}`,{values:changes}):await api.post<ProducerEntry>(`/producers/${producerId}/card/entries/${definition.key}`,{values:changes});setSaved(response.data);onSaved();};
  const session=useProfileFieldEditor({sessionKey:definition.key+":"+(item?.id??"new"),values,initialEditing,
    write:async(changes,accept)=>{if(!saved){setStaged(v=>({...v,...changes}));accept(Object.keys(changes));return;}await write(changes);accept(Object.keys(changes));},refresh:()=>{},onClose:()=>{if(!saved&&Object.values(staged).some(v=>v)&&!window.confirm("Να κλείσει χωρίς καταχώρηση της νέας εγγραφής;"))return;if(blob&&!window.confirm("Το νέο αρχείο δεν έχει αποθηκευτεί. Να κλείσει;"))return;onClose();}});
  const creation=useMutation({mutationFn:async()=>{const all={...values,...session.drafts,...Object.fromEntries(Object.entries(secrets).filter(([,v])=>!!v)),...(blob?{contentBase64:blob}:{})};const body=Object.fromEntries(Object.entries(all).filter(([key])=>definition.fields.some(f=>f.key===key)||key==="contentBase64"));await write(body);},onSuccess:()=>{setBlob("");onClose();}});
  const [secrets,setSecrets]=useState<Record<string,string>>({});
  const save=()=>{for(const[key,value]of Object.entries(secrets))if(value)session.change(key,value);creation.mutate();};
  const download=useMutation({mutationFn:async()=>{if(!saved)return;const response=await api.get(`/producers/${producerId}/card/entries/documents/${saved.id}/file`,{responseType:"blob"});const url=URL.createObjectURL(response.data);const a=document.createElement("a");a.href=url;a.download=saved.values.fileName||"document";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}});
  const chooseFile=(file:File)=>{if(file.size>5*1024*1024){setFileError("Το αρχείο πρέπει να είναι έως 5 MB.");return;}const reader=new FileReader();reader.onload=()=>{setBlob(String(reader.result).split(",")[1]);for(const[key,value]of Object.entries({fileName:file.name,sizeBytes:String(file.size),contentType:file.type||"application/octet-stream",title:values.title||file.name}))session.change(key,value);setFileError("");};reader.readAsDataURL(file);};
  return <Dialog open onClose={()=>{if(!creation.isPending)session.requestClose();}} fullWidth maxWidth="lg" PaperProps={{sx:{bgcolor:"#edf3f9",maxHeight:"calc(100dvh - 20px)"}}}><DialogTitle sx={{bgcolor:"#0d4f8d",color:"white",fontWeight:800,py:1}}>{definition.label}</DialogTitle><DialogContent sx={{p:1.25}}>
    <ProfileEditorFeedback session={{...session,toast:!saved&&session.toast?"Το πεδίο συμπληρώθηκε. Πατήστε Αποθήκευση για καταχώρηση.":session.toast}}/>{(creation.error||download.error||fileError)&&<Alert severity="error">{fileError||extractErrorMessage(creation.error??download.error)}</Alert>}
    {definition.key==="documents"&&<Stack direction="row" gap={1} my={1}>{canEdit&&<Button component="label" color="success" variant="contained">Επιλογή αρχείου<input type="file" hidden onChange={e=>{const file=e.target.files?.[0];if(file)chooseFile(file);}}/></Button>}{saved&&<Button color="success" variant="contained" onClick={()=>download.mutate()}>Λήψη αρχείου</Button>}</Stack>}
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2,minmax(0,1fr))"},gap:1}}>{[0,1].map(column=><Stack key={column} spacing={.5} sx={{minWidth:0}}>{definition.fields.filter((_f,index)=>column===(index<Math.ceil(definition.fields.length/2)?0:1)).map(f=>{
      if(f.kind==="secret")return <Stack key={f.key} direction="row" gap={.5} alignItems="center"><TextField fullWidth size="small" type="password" label={f.label} value={secrets[f.key]??""} disabled={!canEdit} placeholder={saved?.values["has"+f.key[0].toUpperCase()+f.key.slice(1)]==="true"?"Έχει οριστεί — αφήστε κενό για διατήρηση":""} onChange={e=>{setSecrets(v=>({...v,[f.key]:e.target.value}));session.change(f.key,e.target.value);}}/>{canEdit&&saved?.values["has"+f.key[0].toUpperCase()+f.key.slice(1)]==="true"&&<Button color="error" onClick={()=>{if(window.confirm("Να καταργηθεί ο αποθηκευμένος κωδικός;"))void write({[f.key]:null});}}>Κατάργηση</Button>}</Stack>;
      const options=("choices" in f?f.choices:undefined)??lookups[f.kind];return <ProfileEditableField key={f.key} field={f.key} label={f.label} session={canEdit?session:undefined} value={values[f.key]??""} options={options} type={f.kind==="date"?"date":["number","percent","integer"].includes(f.kind)?"number":"text"} multiline={f.kind==="multiline"}/>;
    })}</Stack>)}</Box>
  </DialogContent><DialogActions sx={{p:1,gap:.5}}>{canEdit&&(!saved||blob||Object.values(secrets).some(Boolean))?<><Button color="success" variant="contained" startIcon={<SaveIcon/>} disabled={creation.isPending} onClick={save}>Αποθήκευση</Button><Button color="error" variant="contained" startIcon={<CloseIcon/>} onClick={session.requestClose}>Κλείσιμο</Button></>:canEdit?<ProfileEditorActions session={session} label="εγγραφής"/>:<Button color="error" variant="contained" onClick={session.requestClose}>Κλείσιμο</Button>}</DialogActions></Dialog>;
}
