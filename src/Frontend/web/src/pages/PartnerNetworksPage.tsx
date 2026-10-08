import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Tab, Tabs,
  TextField, Tooltip, Typography
} from "@mui/material";
import HubIcon from "@mui/icons-material/Hub";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type Network = {
  id: string; code: string; name: string; description?: string | null; networkType: string; status: string;
  managerName?: string | null; email?: string | null; phone?: string | null; secondaryEmail?: string | null;
  secondaryPhone?: string | null; taxId?: string | null; taxOffice?: string | null; businessType?: string | null;
  professionalCategory?: string | null; address?: string | null; city?: string | null; postalCode?: string | null;
  website?: string | null; logoPath?: string | null; contractNumber?: string | null; contractStartDate?: string | null;
  contractEndDate?: string | null; commissionPolicyJson?: string | null; notes?: string | null;
  memberCount: number; activeMemberCount: number; policyCount: number; grossPremium: number;
  producerCommission: number; officeCommission: number; createdAt: string;
};
type Member = { id: string; producerId: string; producerName: string; producerCode: string; role: string; isActive: boolean; joinedAt?: string | null; leftAt?: string | null; commissionPercentOverride?: number | null; targetPercent?: number | null; notes?: string | null };
type NetworkDocument = { id: string; fileName: string; mimeType: string; sizeBytes: number; category: string; notes?: string | null; createdAt: string };
type Detail = { network: Network; members: Member[]; documents: NetworkDocument[] };
type Producer = { id: string; code: string; name: string; email?: string | null };

const emptyForm: Partial<Network> = { code: "", name: "", description: "", networkType: "Δίκτυο συνεργατών", status: "Ενεργό" };
const statusLabel = (value: string) => value === "Ενεργό" ? "Ενεργό" : value === "Ανενεργό" ? "Ανενεργό" : value;
const money = (value: number) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value || 0);
const dateValue = (value?: string | null) => value ? value.slice(0, 10) : "";

export function PartnerNetworksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [editing, setEditing] = useState<Network | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);
  const networks = useQuery({
    queryKey: ["partner-networks", search, status, type],
    queryFn: async () => (await api.get<Network[]>("/partner-networks", { params: { search: search || undefined, status: status === "all" ? undefined : status, type: type === "all" ? undefined : type } })).data,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/partner-networks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["partner-networks"] }),
    onError: e => setError(extractErrorMessage(e)),
  });
  const types = useMemo(() => Array.from(new Set((networks.data ?? []).map(x => x.networkType))).filter(Boolean), [networks.data]);
  const exportCsv = () => {
    const rows = networks.data ?? [];
    const csv = [["Κωδικός", "Δίκτυο", "Τύπος", "Κατάσταση", "Μέλη", "Συμβόλαια", "Μικτά", "Προμήθεια συνεργατών", "Μερίδιο έδρας"], ...rows.map(x => [x.code, x.name, x.networkType, x.status, x.memberCount, x.policyCount, x.grossPremium.toFixed(2), x.producerCommission.toFixed(2), x.officeCommission.toFixed(2)])].map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "δικτυα-συνεργατων.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return <Box sx={{ p: { xs: 1, md: 2 } }}>
    <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} gap={1.5} mb={2}>
      <HubIcon sx={{ fontSize: 38, color: "#0b4f8a" }} />
      <Box flex={1}><Typography variant="h4" fontWeight={850}>Δίκτυα συνεργατών</Typography><Typography color="text.secondary">Ομαδοποιήστε συνεργάτες, ομάδες και πρακτορειακές σχέσεις χωρίς να αλλάζετε τα μεμονωμένα συμβόλαια.</Typography></Box>
      <Button variant="outlined" onClick={exportCsv}>Εξαγωγή</Button>
      <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={() => setEditing({ ...emptyForm, id: "" } as Network)}>Νέο δίκτυο</Button>
    </Stack>
    <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5, bgcolor: "#f4f7fb" }}>
      <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ sm: "center" }}>
        <TextField size="small" fullWidth placeholder="Αναζήτηση κωδικού, δικτύου, υπευθύνου ή email" value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: .75, color: "text.secondary" }} /> }} />
        <TextField select size="small" label="Κατάσταση" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 145 }}><MenuItem value="all">Όλες</MenuItem><MenuItem value="Ενεργό">Ενεργά</MenuItem><MenuItem value="Ανενεργό">Ανενεργά</MenuItem></TextField>
        <TextField select size="small" label="Τύπος" value={type} onChange={e => setType(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value="all">Όλοι οι τύποι</MenuItem>{types.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
        <Button color="error" startIcon={<ClearIcon />} onClick={() => { setSearch(""); setStatus("all"); setType("all"); }}>Καθαρισμός</Button>
      </Stack>
    </Paper>
    {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
    <Card variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ overflowX: "auto" }}><Box component="table" sx={{ width: "100%", minWidth: 930, borderCollapse: "collapse", "& th": { bgcolor: "#e8edf3", color: "#18324b", textAlign: "left", fontSize: 13, px: 1.25, py: 1, borderBottom: "2px solid #b9c5d1" }, "& td": { px: 1.25, py: .9, borderBottom: "1px solid #e1e6eb", fontSize: 13 } }}>
        <thead><tr><th>Κωδικός</th><th>Δίκτυο</th><th>Τύπος</th><th>Υπεύθυνος</th><th>Μέλη</th><th>Συμβόλαια</th><th>Παραγωγή</th><th>Κατάσταση</th><th>Ενέργειες</th></tr></thead>
        <tbody>{networks.isLoading && <tr><td colSpan={9}><CircularProgress size={25} /></td></tr>}{!networks.isLoading && !(networks.data ?? []).length && <tr><td colSpan={9}><Typography sx={{ py: 4, textAlign: "center" }} color="text.secondary">Δεν υπάρχουν δίκτυα. Δημιουργήστε το πρώτο δίκτυο συνεργατών.</Typography></td></tr>}{(networks.data ?? []).map(row => <tr key={row.id} onDoubleClick={() => setDetailId(row.id)} style={{ cursor: "pointer" }}>
          <td><Typography fontWeight={750}>{row.code}</Typography></td><td><Typography fontWeight={700}>{row.name}</Typography><Typography variant="caption" color="text.secondary">{row.email || ""}</Typography></td><td>{row.networkType}</td><td>{row.managerName || "—"}</td><td><Chip size="small" label={`${row.activeMemberCount}/${row.memberCount}`} color={row.activeMemberCount ? "primary" : "default"} /></td><td>{row.policyCount}</td><td>{money(row.grossPremium)}</td><td><Chip size="small" label={statusLabel(row.status)} color={row.status === "Ενεργό" ? "success" : "default"} /></td><td><Stack direction="row" spacing={.25}><Tooltip title="Προβολή"><IconButton size="small" color="primary" onClick={() => setDetailId(row.id)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Επεξεργασία"><IconButton size="small" color="success" onClick={() => setEditing(row)}><EditIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Διαγραφή"><IconButton size="small" color="error" onClick={() => setDeleteTarget(row)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Stack></td>
        </tr>)}</tbody>
      </Box></Box>
    </Card>
    <NetworkEditor open={!!editing} network={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ["partner-networks"] }); }} onError={setError} />
    <NetworkDetail id={detailId} onClose={() => setDetailId(null)} onError={setError} />
    <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}><DialogTitle>Διαγραφή δικτύου;</DialogTitle><DialogContent><Typography>Θέλετε να διαγράψετε το «{deleteTarget?.name}»; Τα μέλη και τα έγγραφα παραμένουν στο ιστορικό του γραφείου.</Typography></DialogContent><DialogActions><Button onClick={() => setDeleteTarget(null)}>Ακύρωση</Button><Button color="error" variant="contained" onClick={() => { if (deleteTarget) remove.mutate(deleteTarget.id); setDeleteTarget(null); }}>Είμαι σίγουρος</Button></DialogActions></Dialog>
  </Box>;
}

function NetworkEditor({ open, network, onClose, onSaved, onError }: { open: boolean; network: Network | null; onClose: () => void; onSaved: () => void; onError: (x: string) => void }) {
  const editing = !!network?.id; const [tab, setTab] = useState(0); const [form, setForm] = useState<Partial<Network>>(emptyForm);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setTab(0); setForm(network ? { ...network } : { ...emptyForm }); } }, [open, network?.id]);
  const set = (key: keyof Network, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));
  const save = async () => { if (!form.code?.trim() || !form.name?.trim()) { onError("Συμπληρώστε κωδικό και όνομα δικτύου."); return; } setSaving(true); try { const body = { ...form, id: undefined, memberCount: undefined, activeMemberCount: undefined, policyCount: undefined, grossPremium: undefined, producerCommission: undefined, officeCommission: undefined, createdAt: undefined }; if (editing) await api.put(`/partner-networks/${network!.id}`, body); else await api.post("/partner-networks", body); onSaved(); } catch (e) { onError(extractErrorMessage(e)); } finally { setSaving(false); } };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle sx={{ borderBottom: "1px solid #dce3ea" }}>{editing ? "Επεξεργασία δικτύου συνεργατών" : "Νέο δίκτυο συνεργατών"}</DialogTitle><DialogContent sx={{ p: 0 }}><Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ px: 2, bgcolor: "#eef2f6", borderBottom: "1px solid #c8d2dc" }}><Tab label="Σύνοψη" /><Tab label="Επικοινωνία & στοιχεία" /><Tab label="Σύμβαση & προμήθειες" /><Tab label="Σημειώσεις" /></Tabs><Box sx={{ p: 2 }}>
    {tab === 0 && <Stack spacing={1.5}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Κωδικός *" value={form.code ?? ""} onChange={e => set("code", e.target.value)} fullWidth /><TextField label="Όνομα δικτύου *" value={form.name ?? ""} onChange={e => set("name", e.target.value)} fullWidth /></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField select label="Τύπος" value={form.networkType ?? "Δίκτυο συνεργατών"} onChange={e => set("networkType", e.target.value)} fullWidth><MenuItem value="Δίκτυο συνεργατών">Δίκτυο συνεργατών</MenuItem><MenuItem value="Ομάδα συνεργατών">Ομάδα συνεργατών</MenuItem><MenuItem value="Πρακτορειακό δίκτυο">Πρακτορειακό δίκτυο</MenuItem><MenuItem value="Συνεργαζόμενο γραφείο">Συνεργαζόμενο γραφείο</MenuItem></TextField><TextField select label="Κατάσταση" value={form.status ?? "Ενεργό"} onChange={e => set("status", e.target.value)} fullWidth><MenuItem value="Ενεργό">Ενεργό</MenuItem><MenuItem value="Ανενεργό">Ανενεργό</MenuItem></TextField></Stack><TextField label="Περιγραφή" multiline minRows={3} value={form.description ?? ""} onChange={e => set("description", e.target.value)} fullWidth /></Stack>}
    {tab === 1 && <Stack spacing={1.5}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Υπεύθυνος δικτύου" value={form.managerName ?? ""} onChange={e => set("managerName", e.target.value)} fullWidth /><TextField label="Email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} fullWidth /><TextField label="Τηλέφωνο" value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} fullWidth /></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="2ο email" value={form.secondaryEmail ?? ""} onChange={e => set("secondaryEmail", e.target.value)} fullWidth /><TextField label="2ο τηλέφωνο" value={form.secondaryPhone ?? ""} onChange={e => set("secondaryPhone", e.target.value)} fullWidth /><TextField label="Ιστοσελίδα" value={form.website ?? ""} onChange={e => set("website", e.target.value)} fullWidth /></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Διεύθυνση" value={form.address ?? ""} onChange={e => set("address", e.target.value)} fullWidth /><TextField label="Πόλη" value={form.city ?? ""} onChange={e => set("city", e.target.value)} fullWidth /><TextField label="Τ.Κ." value={form.postalCode ?? ""} onChange={e => set("postalCode", e.target.value)} sx={{ maxWidth: 160 }} /></Stack></Stack>}
    {tab === 2 && <Stack spacing={1.5}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Αρ. σύμβασης" value={form.contractNumber ?? ""} onChange={e => set("contractNumber", e.target.value)} fullWidth /><TextField label="Έναρξη" type="date" InputLabelProps={{ shrink: true }} value={dateValue(form.contractStartDate)} onChange={e => set("contractStartDate", e.target.value)} fullWidth /><TextField label="Λήξη" type="date" InputLabelProps={{ shrink: true }} value={dateValue(form.contractEndDate)} onChange={e => set("contractEndDate", e.target.value)} fullWidth /></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="ΑΦΜ" value={form.taxId ?? ""} onChange={e => set("taxId", e.target.value)} fullWidth /><TextField label="ΔΟΥ" value={form.taxOffice ?? ""} onChange={e => set("taxOffice", e.target.value)} fullWidth /><TextField label="Νομική μορφή / τύπος" value={form.businessType ?? ""} onChange={e => set("businessType", e.target.value)} fullWidth /></Stack><TextField label="Κανόνες προμηθειών (προαιρετικά JSON ή σημειώσεις)" multiline minRows={5} value={form.commissionPolicyJson ?? ""} onChange={e => set("commissionPolicyJson", e.target.value)} fullWidth /></Stack>}
    {tab === 3 && <TextField label="Εσωτερικές σημειώσεις" multiline minRows={8} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} fullWidth />}
  </Box></DialogContent><DialogActions><Button color="error" onClick={onClose}>Ακύρωση</Button><Button variant="contained" color="success" onClick={() => void save()} disabled={saving}>{saving ? <CircularProgress size={20} /> : "Αποθήκευση"}</Button></DialogActions></Dialog>;
}

function NetworkDetail({ id, onClose, onError }: { id: string | null; onClose: () => void; onError: (x: string) => void }) {
  const qc = useQueryClient(); const [tab, setTab] = useState(0); const [memberOpen, setMemberOpen] = useState(false); const [file, setFile] = useState<File | null>(null); const [memberDelete, setMemberDelete] = useState<Member | null>(null);
  const detail = useQuery({ queryKey: ["partner-network-detail", id], enabled: !!id, queryFn: async () => (await api.get<Detail>(`/partner-networks/${id}/detail`)).data });
  const producers = useQuery({ queryKey: ["producers-for-network"], enabled: !!id && memberOpen, queryFn: async () => (await api.get<Producer[]>("/producers")).data });
  const addMember = async (producerId: string) => { try { await api.post(`/partner-networks/${id}/members`, { producerId, role: "Συνεργάτης", isActive: true }); setMemberOpen(false); void qc.invalidateQueries({ queryKey: ["partner-network-detail", id] }); } catch (e) { onError(extractErrorMessage(e)); } };
  const removeMember = (member: Member) => setMemberDelete(member);
  const confirmRemoveMember = async () => { if (!memberDelete) return; try { await api.delete(`/partner-networks/${id}/members/${memberDelete.id}`); setMemberDelete(null); void qc.invalidateQueries({ queryKey: ["partner-network-detail", id] }); } catch (e) { onError(extractErrorMessage(e)); } };
  const upload = async () => { if (!file || !id) return; try { const data = new FormData(); data.append("file", file); data.append("category", "Έγγραφα δικτύου"); await api.post(`/partner-networks/${id}/documents`, data); setFile(null); void qc.invalidateQueries({ queryKey: ["partner-network-detail", id] }); } catch (e) { onError(extractErrorMessage(e)); } };
  const downloadDocument = async (doc: NetworkDocument) => { try { const response = await api.get(`/partner-networks/${id}/documents/${doc.id}/download`, { responseType: "blob" }); const url = URL.createObjectURL(response.data); const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = doc.fileName; anchor.click(); URL.revokeObjectURL(url); } catch (e) { onError(extractErrorMessage(e)); } };
  if (!id) return null;
  const n = detail.data?.network;
  return <Dialog open={!!id} onClose={onClose} fullWidth maxWidth="xl"><DialogTitle sx={{ borderBottom: "1px solid #dce3ea" }}><Stack direction="row" alignItems="center" gap={1}><HubIcon color="primary" />{n?.name ?? "Δίκτυο συνεργατών"}{n && <Chip size="small" label={n.status} color={n.status === "Ενεργό" ? "success" : "default"} />}</Stack></DialogTitle><DialogContent sx={{ p: 0 }}>{detail.isLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box> : n && <><Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ px: 2, bgcolor: "#eef2f6", borderBottom: "1px solid #c8d2dc" }}><Tab label="Σύνοψη" /><Tab label="Μέλη δικτύου" /><Tab label="Έγγραφα" /><Tab label="Στατιστικά" /></Tabs><Box sx={{ p: 2 }}>
    {tab === 0 && <Stack spacing={1.5}><Typography variant="h6" fontWeight={800}>{n.code} · {n.name}</Typography><Typography color="text.secondary">{n.description || "Δεν έχει καταχωρηθεί περιγραφή."}</Typography><Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1 }}><Info label="Υπεύθυνος" value={n.managerName} /><Info label="Email" value={n.email} /><Info label="Τηλέφωνο" value={n.phone} /><Info label="Έδρα" value={[n.address, n.city, n.postalCode].filter(Boolean).join(", ")} /><Info label="ΑΦΜ / ΔΟΥ" value={[n.taxId, n.taxOffice].filter(Boolean).join(" · ")} /><Info label="Σύμβαση" value={n.contractNumber} /></Box></Stack>}
    {tab === 1 && <Stack spacing={1}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={800}>Συνεργάτες ({detail.data?.members.length ?? 0})</Typography><Button startIcon={<PersonAddIcon />} variant="contained" onClick={() => setMemberOpen(v => !v)}>Προσθήκη συνεργάτη</Button></Stack>{memberOpen && <Paper variant="outlined" sx={{ p: 1, bgcolor: "#f5f9ff" }}><Typography variant="caption" color="text.secondary">Επιλέξτε συνεργάτη για να τον εντάξετε στο δίκτυο</Typography><Stack direction="row" gap={1} flexWrap="wrap" mt={1}>{(producers.data ?? []).filter(p => !(detail.data?.members ?? []).some(m => m.producerId === p.id)).map(p => <Button key={p.id} size="small" variant="outlined" onClick={() => void addMember(p.id)}>{p.name} · {p.code}</Button>)}</Stack></Paper>}{(detail.data?.members ?? []).map(m => <Paper key={m.id} variant="outlined" sx={{ p: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}><Box><Typography fontWeight={700}>{m.producerName}</Typography><Typography variant="caption" color="text.secondary">{m.producerCode} · {m.role}</Typography></Box><Stack direction="row" alignItems="center" gap={.5}><Chip size="small" label={m.isActive ? "Ενεργός" : "Ανενεργός"} color={m.isActive ? "success" : "default"} /><IconButton size="small" color="error" onClick={() => void removeMember(m)}><DeleteIcon fontSize="small" /></IconButton></Stack></Paper>)}{!(detail.data?.members ?? []).length && <Typography color="text.secondary">Δεν έχουν προστεθεί μέλη.</Typography>}</Stack>}
    {tab === 2 && <Stack spacing={1.25}><Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ sm: "center" }}><Button component="label" startIcon={<UploadFileIcon />} variant="outlined">Επιλογή αρχείου<input hidden type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></Button><Typography variant="body2" flex={1}>{file?.name || "Δεν έχει επιλεγεί αρχείο"}</Typography><Button variant="contained" disabled={!file} onClick={() => void upload()}>Ανέβασμα</Button></Stack>{(detail.data?.documents ?? []).map(d => <Paper key={d.id} variant="outlined" sx={{ p: 1, display: "flex", alignItems: "center", gap: 1 }}><Box flex={1}><Typography fontWeight={700}>{d.fileName}</Typography><Typography variant="caption" color="text.secondary">{d.category} · {(d.sizeBytes / 1024).toFixed(0)} KB</Typography></Box><IconButton color="primary" onClick={() => void downloadDocument(d)}><DownloadIcon /></IconButton></Paper>)}{!(detail.data?.documents ?? []).length && <Typography color="text.secondary">Δεν έχουν ανέβει έγγραφα.</Typography>}</Stack>}
    {tab === 3 && <><Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} mb={2}>{[["Ενεργά μέλη", n.activeMemberCount], ["Συμβόλαια", n.policyCount], ["Μικτά ασφάλιστρα", money(n.grossPremium)], ["Προμήθειες συνεργατών", money(n.producerCommission)], ["Μερίδιο έδρας", money(n.officeCommission)]].map(([label, value]) => <Card key={String(label)} variant="outlined" sx={{ flex: 1, bgcolor: "#f5f9ff" }}><CardContent sx={{ p: "12px !important" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" fontWeight={850}>{value}</Typography></CardContent></Card>)}</Stack><Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" gap={1} alignItems="center"><BarChartIcon color="primary" /><Typography fontWeight={800}>Σύγκριση οικονομικής εικόνας</Typography></Stack><Box sx={{ display: "flex", alignItems: "end", height: 180, gap: 3, mt: 2, px: 2 }}>{[["Μικτά", n.grossPremium, "#1976d2"], ["Συνεργάτες", n.producerCommission, "#ed8b00"], ["Έδρα", n.officeCommission, "#2e7d32"]].map(([label, value, color]) => <Box key={String(label)} sx={{ flex: 1, textAlign: "center" }}><Box sx={{ height: Math.max(8, Math.min(145, Number(value) / Math.max(1, n.grossPremium) * 145)), bgcolor: color, borderRadius: "8px 8px 0 0", transition: "height .25s" }} /><Typography variant="caption">{label}</Typography></Box>)}</Box></Paper></>}
  </Box></>}</DialogContent><DialogActions><Button color="error" onClick={onClose}>Κλείσιμο</Button></DialogActions><Dialog open={!!memberDelete} onClose={() => setMemberDelete(null)}><DialogTitle>Αφαίρεση μέλους;</DialogTitle><DialogContent><Typography>Να αφαιρεθεί ο/η {memberDelete?.producerName} από το δίκτυο;</Typography></DialogContent><DialogActions><Button onClick={() => setMemberDelete(null)}>Ακύρωση</Button><Button color="error" variant="contained" onClick={() => void confirmRemoveMember()}>Είμαι σίγουρος</Button></DialogActions></Dialog></Dialog>;
}

function Info({ label, value }: { label: string; value?: string | null }) { return <Paper variant="outlined" sx={{ p: 1, bgcolor: value ? "#f2fbf5" : "#fff8f8" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" color={value ? "success.dark" : "error.main"}>{value || "Δεν έχει καταχωρηθεί"}</Typography></Paper>; }
export default PartnerNetworksPage;
