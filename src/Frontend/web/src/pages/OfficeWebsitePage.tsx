import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControlLabel,
  IconButton, Paper, Stack, Switch, Tab, Tabs, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LanguageIcon from "@mui/icons-material/Language";
import InboxIcon from "@mui/icons-material/Inbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type Post = { id: string; title: string; body: string; imageUrl?: string; isPublished: boolean };
type Offer = { id: string; title: string; body: string; ctaLabel?: string; ctaUrl?: string; isActive: boolean };
type Banner = { id: string; text: string; kind?: string; linkUrl?: string; isActive: boolean };
type Website = {
  id: string; slug: string; customDomain: string | null; siteName: string; tagline: string;
  heroTitle: string; heroBody: string; logoUrl: string | null; brandColorHex: string;
  postsJson: string; offersJson: string; bannersJson: string; formConfigJson: string; isPublished: boolean;
};
type RequestRow = { id: string; fullName: string; email: string; phone: string | null; product: string | null; message: string; preferredContact: string | null; consentGiven: boolean; status: string; source: string | null; createdAt: string; contactedAt: string | null; internalNotes: string | null };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const parseList = <T,>(value: string, fallback: T[]): T[] => { try { const x = JSON.parse(value); return Array.isArray(x) ? x : fallback; } catch { return fallback; } };

export function OfficeWebsitePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState<Website | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const website = useQuery({ queryKey: ["office-website"], queryFn: async () => (await api.get<Website>("/office-website")).data });
  const requests = useQuery({ queryKey: ["office-website-requests"], queryFn: async () => (await api.get<RequestRow[]>("/office-website/requests")).data });
  useEffect(() => { if (website.data) setDraft(website.data); }, [website.data]);
  const save = useMutation({
    mutationFn: async (body: Website) => (await api.put<Website>("/office-website", body)).data,
    onSuccess: (data) => { setDraft(data); setSaved("Αποθηκεύτηκε"); void qc.invalidateQueries({ queryKey: ["office-website"] }); setTimeout(() => setSaved(null), 2600); }
  });
  const updateRequest = useMutation({
    mutationFn: async ({ id, status, internalNotes }: { id: string; status: string; internalNotes: string }) => api.patch(`/office-website/requests/${id}`, { status, internalNotes }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["office-website-requests"] })
  });
  const posts = useMemo(() => parseList<Post>(draft?.postsJson ?? "[]", []), [draft?.postsJson]);
  const offers = useMemo(() => parseList<Offer>(draft?.offersJson ?? "[]", []), [draft?.offersJson]);
  const banners = useMemo(() => parseList<Banner>(draft?.bannersJson ?? "[]", []), [draft?.bannersJson]);
  const setList = (key: "postsJson" | "offersJson" | "bannersJson", values: unknown[]) => setDraft(x => x ? { ...x, [key]: JSON.stringify(values) } : x);
  if (website.isLoading || !draft) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  if (website.isError) return <Alert severity="error">{extractErrorMessage(website.error)}</Alert>;
  const saveDraft = () => { if (draft) save.mutate(draft); };
  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={2} mb={3}>
        <Stack direction="row" spacing={1.5} alignItems="center"><LanguageIcon color="primary" sx={{ fontSize: 38 }} /><Box><Typography variant="h4" sx={{ fontWeight: 800 }}>Ιστοσελίδα γραφείου</Typography><Typography color="text.secondary">Η δημόσια σελίδα, οι προσφορές και οι αιτήσεις σας — χωρίς έκδοση ή πολυτιμολόγηση.</Typography></Box></Stack>
        <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => window.open(`/site/${draft.slug}`, "_blank", "noopener,noreferrer")}>Προεπισκόπηση</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={saveDraft} disabled={save.isPending}>{save.isPending ? "Αποθήκευση…" : "Αποθήκευση"}</Button></Stack>
      </Stack>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>{saved}</Alert>}
      {save.isError && <Alert severity="error" sx={{ mb: 2 }}>{extractErrorMessage(save.error)}</Alert>}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable"><Tab label="Ρυθμίσεις σελίδας" /><Tab label={`Άρθρα (${posts.length})`} /><Tab label={`Προσφορές (${offers.length})`} /><Tab label={`Popup banners (${banners.length})`} /><Tab icon={<InboxIcon />} iconPosition="start" label={`Αιτήσεις (${requests.data?.length ?? 0})`} /></Tabs>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 0 && <GeneralTab draft={draft} setDraft={setDraft} />}
          {tab === 1 && <PostsTab rows={posts} setRows={x => setList("postsJson", x)} />}
          {tab === 2 && <OffersTab rows={offers} setRows={x => setList("offersJson", x)} />}
          {tab === 3 && <BannersTab rows={banners} setRows={x => setList("bannersJson", x)} />}
          {tab === 4 && <RequestsTab rows={requests.data ?? []} onUpdate={(id, status, notes) => updateRequest.mutate({ id, status, internalNotes: notes })} />}
        </Box>
      </Paper>
    </Box>
  );
}

function GeneralTab({ draft, setDraft }: { draft: Website; setDraft: React.Dispatch<React.SetStateAction<Website | null>> }) {
  const field = (key: keyof Website, label: string, multiline = false) => <TextField fullWidth label={label} value={draft[key] ?? ""} multiline={multiline} minRows={multiline ? 3 : undefined} onChange={e => setDraft(x => x ? { ...x, [key]: e.target.value } : x)} />;
  return <Stack spacing={2}>
    <Alert severity="info">Το slug είναι η διεύθυνση τύπου <strong>/site/to-grafeio-mas</strong>. Για κανονικό domain χρειάζεται DNS/Coolify να δείχνει στο Kalypsis· το domain αποθηκεύεται εδώ για την αντιστοίχιση.</Alert>
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>{field("siteName", "Όνομα γραφείου")}{field("slug", "Slug δημόσιας σελίδας")}</Stack>
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>{field("customDomain", "Δικό σας domain (προαιρετικό)")}{field("logoUrl", "URL λογοτύπου (προαιρετικό)")}</Stack>
    {field("tagline", "Σύντομη περιγραφή")}{field("heroTitle", "Κεντρικός τίτλος")}{field("heroBody", "Κείμενο καλωσορίσματος", true)}
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center"><TextField label="Χρώμα brand" type="color" value={draft.brandColorHex} onChange={e => setDraft(x => x ? { ...x, brandColorHex: e.target.value } : x)} sx={{ width: 180 }} /><FormControlLabel control={<Switch checked={draft.isPublished} onChange={e => setDraft(x => x ? { ...x, isPublished: e.target.checked } : x)} />} label="Δημοσιευμένη σελίδα" /></Stack>
  </Stack>;
}

function PostsTab({ rows, setRows }: { rows: Post[]; setRows: (x: Post[]) => void }) {
  return <Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Άρθρα / νέα</Typography><Button startIcon={<AddIcon />} onClick={() => setRows([...rows, { id: newId(), title: "Νέο άρθρο", body: "", isPublished: false }])}>Νέο άρθρο</Button></Stack>{rows.length === 0 && <Alert severity="info">Προσθέστε άρθρα ή νέα για να εμφανίζονται στη δημόσια σελίδα.</Alert>}{rows.map((r, i) => <Card variant="outlined" key={r.id}><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Άρθρο {i + 1}</Typography><IconButton color="error" onClick={() => setRows(rows.filter(x => x.id !== r.id))}><DeleteOutlineIcon /></IconButton></Stack><TextField label="Τίτλος" value={r.title} onChange={e => { const x = [...rows]; x[i] = { ...r, title: e.target.value }; setRows(x); }} /><TextField label="Κείμενο" multiline minRows={3} value={r.body} onChange={e => { const x = [...rows]; x[i] = { ...r, body: e.target.value }; setRows(x); }} /><Stack direction={{ xs: "column", md: "row" }} spacing={2}><TextField fullWidth label="URL εικόνας (προαιρετικό)" value={r.imageUrl ?? ""} onChange={e => { const x = [...rows]; x[i] = { ...r, imageUrl: e.target.value }; setRows(x); }} /><FormControlLabel control={<Switch checked={r.isPublished} onChange={e => { const x = [...rows]; x[i] = { ...r, isPublished: e.target.checked }; setRows(x); }} />} label="Δημοσίευση" /></Stack></Stack></CardContent></Card>)}</Stack>;
}

function OffersTab({ rows, setRows }: { rows: Offer[]; setRows: (x: Offer[]) => void }) {
  return <Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Προσφορές</Typography><Button startIcon={<AddIcon />} onClick={() => setRows([...rows, { id: newId(), title: "Νέα προσφορά", body: "", isActive: false }])}>Νέα προσφορά</Button></Stack>{rows.map((r, i) => <Card variant="outlined" key={r.id}><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Προσφορά {i + 1}</Typography><IconButton color="error" onClick={() => setRows(rows.filter(x => x.id !== r.id))}><DeleteOutlineIcon /></IconButton></Stack><TextField label="Τίτλος" value={r.title} onChange={e => { const x = [...rows]; x[i] = { ...r, title: e.target.value }; setRows(x); }} /><TextField label="Περιγραφή" multiline minRows={2} value={r.body} onChange={e => { const x = [...rows]; x[i] = { ...r, body: e.target.value }; setRows(x); }} /><Stack direction={{ xs: "column", md: "row" }} spacing={2}><TextField fullWidth label="Κείμενο κουμπιού" value={r.ctaLabel ?? ""} onChange={e => { const x = [...rows]; x[i] = { ...r, ctaLabel: e.target.value }; setRows(x); }} /><TextField fullWidth label="Σύνδεσμος κουμπιού" value={r.ctaUrl ?? ""} onChange={e => { const x = [...rows]; x[i] = { ...r, ctaUrl: e.target.value }; setRows(x); }} /><FormControlLabel control={<Switch checked={r.isActive} onChange={e => { const x = [...rows]; x[i] = { ...r, isActive: e.target.checked }; setRows(x); }} />} label="Ενεργή" /></Stack></Stack></CardContent></Card>)}</Stack>;
}

function BannersTab({ rows, setRows }: { rows: Banner[]; setRows: (x: Banner[]) => void }) {
  return <Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Popup banners</Typography><Button startIcon={<AddIcon />} onClick={() => setRows([...rows, { id: newId(), text: "Νέα ανακοίνωση", kind: "info", isActive: false }])}>Νέο banner</Button></Stack>{rows.map((r, i) => <Card variant="outlined" key={r.id}><CardContent><Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center"><TextField fullWidth label="Κείμενο popup" value={r.text} onChange={e => { const x = [...rows]; x[i] = { ...r, text: e.target.value }; setRows(x); }} /><TextField label="Τύπος" value={r.kind ?? "info"} onChange={e => { const x = [...rows]; x[i] = { ...r, kind: e.target.value }; setRows(x); }} sx={{ minWidth: 130 }} /><TextField label="Σύνδεσμος" value={r.linkUrl ?? ""} onChange={e => { const x = [...rows]; x[i] = { ...r, linkUrl: e.target.value }; setRows(x); }} /><FormControlLabel control={<Switch checked={r.isActive} onChange={e => { const x = [...rows]; x[i] = { ...r, isActive: e.target.checked }; setRows(x); }} />} label="Ενεργό" /><IconButton color="error" onClick={() => setRows(rows.filter(x => x.id !== r.id))}><DeleteOutlineIcon /></IconButton></Stack></CardContent></Card>)}</Stack>;
}

function RequestsTab({ rows, onUpdate }: { rows: RequestRow[]; onUpdate: (id: string, status: string, notes: string) => void }) {
  const [filter, setFilter] = useState("all");
  const visible = filter === "all" ? rows : rows.filter(x => x.status === filter);
  return <Stack spacing={2}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}><Box><Typography variant="h6">Αιτήσεις ενδιαφέροντος</Typography><Typography color="text.secondary">Οι αιτήσεις της δημόσιας σελίδας. Απαντήστε από το email του γραφείου και παρακολουθήστε την κατάσταση εδώ.</Typography></Box><TextField select SelectProps={{ native: true }} label="Κατάσταση" value={filter} onChange={e => setFilter(e.target.value)} sx={{ minWidth: 170 }}><option value="all">Όλες</option><option value="New">Νέα</option><option value="InProgress">Σε εξέλιξη</option><option value="Contacted">Επικοινωνήθηκε</option><option value="Converted">Μετατράπηκε</option><option value="Closed">Κλειστή</option></TextField></Stack>{visible.length === 0 && <Alert severity="info">Δεν υπάρχουν αιτήσεις.</Alert>}{visible.map(r => <RequestCard key={r.id} row={r} onUpdate={onUpdate} />)}</Stack>;
}

function RequestCard({ row, onUpdate }: { row: RequestRow; onUpdate: (id: string, status: string, notes: string) => void }) {
  const [status, setStatus] = useState(row.status); const [notes, setNotes] = useState(row.internalNotes ?? "");
  return <Card variant="outlined"><CardContent><Stack spacing={1.25}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={800}>{row.fullName}</Typography><Typography variant="body2" color="text.secondary">{row.email}{row.phone ? ` · ${row.phone}` : ""} · {new Date(row.createdAt).toLocaleString("el-GR")}</Typography></Box><Chip label={status} color={status === "New" ? "warning" : status === "Converted" ? "success" : "default"} /></Stack><Divider /><Typography><strong>Κλάδος:</strong> {row.product || "—"}</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{row.message}</Typography><Stack direction={{ xs: "column", md: "row" }} spacing={1.5}><TextField select SelectProps={{ native: true }} label="Κατάσταση" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 180 }}><option value="New">Νέα</option><option value="InProgress">Σε εξέλιξη</option><option value="Contacted">Επικοινωνήθηκε</option><option value="Converted">Μετατράπηκε</option><option value="Closed">Κλειστή</option></TextField><TextField fullWidth label="Εσωτερική σημείωση" value={notes} onChange={e => setNotes(e.target.value)} /><Button variant="outlined" onClick={() => onUpdate(row.id, status, notes)}>Ενημέρωση</Button></Stack></Stack></CardContent></Card>;
}
