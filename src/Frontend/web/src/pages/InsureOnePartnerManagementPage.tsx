import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton, LinearProgress,
  List, ListItemButton, ListItemIcon, ListItemText, Stack, Switch, TextField, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AnalyticsRoundedIcon from "@mui/icons-material/AnalyticsRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface Branding {
  agencyOfficeId: string; slug: string; isEnabled: boolean; displayName: string;
  welcomeMessage?: string | null; primaryColor: string; secondaryColor: string;
  supportEmail?: string | null; supportPhone?: string | null; logoUrl?: string | null;
  allowedBranches: string[];
}
interface Partner {
  id: string; userId?: string | null; producerId: string; producerName: string; email: string;
  firstName: string; lastName: string; phone?: string | null; loginCode: string;
  isActive: boolean; canIssuePolicies: boolean; canViewCommissions: boolean;
  canViewCustomers: boolean; lastLoginAt?: string | null; notes?: string | null; permissions: string[];
}
interface PartnerAnalytics {
  accessId: string; partnerName: string; email: string; isActive: boolean;
  lastLoginAt?: string | null; totalQuotes: number; quotesThisMonth: number;
  selectedQuotes: number; canIssuePolicies: boolean; permissions: string[];
}
interface Analytics {
  agencyOfficeId: string; officeName: string; totalPartners: number; activePartners: number;
  partnersWithIssuance: number; totalQuotes: number; quotesThisMonth: number;
  selectedQuotes: number; expiringQuotes: number; partners: PartnerAnalytics[];
}

const branches = ["Οχημάτων", "Σύγκριση Οχημάτων", "Περιουσίας", "Υγείας", "Σκαφών", "Προσωπικού Ατυχήματος", "Νομικής Προστασίας", "Πράσινης Κάρτας", "Ποδηλάτων"];
const permissionOptions = [
  ["quoting.read", "Προβολή τιμολόγησης"], ["quoting.create", "Δημιουργία προσφορών"],
  ["quotes.save", "Αποθήκευση / επιλογή προσφοράς"], ["quotes.history", "Ιστορικό προσφορών"],
  ["quotes.export", "Εξαγωγή ιστορικού"], ["customers.read", "Αναζήτηση πελατών"],
] as const;
type PermissionKey = typeof permissionOptions[number][0];
const defaultPartnerPermissions: PermissionKey[] = permissionOptions.map(([key]) => key);
type Section = "overview" | "partners" | "permissions" | "analytics" | "branding" | "preview";

const menuItems: { key: Section; label: string; icon: JSX.Element }[] = [
  { key: "overview", label: "Επισκόπηση", icon: <InsightsRoundedIcon /> },
  { key: "partners", label: "Συνεργάτες & χρήστες", icon: <GroupRoundedIcon /> },
  { key: "permissions", label: "Δικαιώματα & πρόσβαση", icon: <SecurityRoundedIcon /> },
  { key: "analytics", label: "Στατιστικά & αναλύσεις", icon: <AnalyticsRoundedIcon /> },
  { key: "branding", label: "Branding & ρυθμίσεις", icon: <SettingsRoundedIcon /> },
  { key: "preview", label: "Προεπισκόπηση συνεργάτη", icon: <PreviewRoundedIcon /> },
];

export function InsureOnePartnerManagementPage() {
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partner | null>(null);
  const settings = useQuery({ queryKey: ["insureone-settings"], queryFn: async () => (await api.get<Branding>("/insureone/settings")).data });
  const partners = useQuery({ queryKey: ["insureone-partners"], queryFn: async () => (await api.get<Partner[]>("/insureone/partners")).data });
  const analytics = useQuery({ queryKey: ["insureone-admin-analytics"], queryFn: async () => (await api.get<Analytics>("/insureone/admin/analytics")).data, staleTime: 30_000 });
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/insureone/partners/${id}`), onSuccess: () => { setRevokeId(null); void qc.invalidateQueries({ queryKey: ["insureone-partners"] }); void qc.invalidateQueries({ queryKey: ["insureone-admin-analytics"] }); }, onError: e => setError(extractErrorMessage(e)) });
  const selectedRevoke = useMemo(() => (partners.data ?? []).find(p => p.id === revokeId), [partners.data, revokeId]);
  const openNew = () => { setEditing(null); setFormOpen(true); };

  return <Box sx={{ minHeight: "calc(100vh - 96px)", bgcolor: "#f5f9fc", p: { xs: 1.5, md: 3 } }}>
    <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ lg: "center" }} gap={2} mb={2.5}>
      <Box><Typography variant="h4" fontWeight={900} color="#123a64">InsureOne · Διαχείριση συνεργατών</Typography><Typography color="text.secondary">Κεντρικός έλεγχος πρόσβασης, branding, δικαιωμάτων και χρήσης του quotation desk ανά συνεργάτη.</Typography></Box>
      <Stack direction="row" gap={1} flexWrap="wrap"><Button variant="outlined" startIcon={<PaletteRoundedIcon />} onClick={() => { setSection("branding"); setSettingsOpen(true); }}>Ρυθμίσεις branding</Button><Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openNew}>Νέος συνεργάτης</Button></Stack>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
      <Card variant="outlined" sx={{ width: { xs: "100%", md: 244 }, flexShrink: 0, borderRadius: 3, alignSelf: "flex-start", position: { md: "sticky" }, top: { md: 16 }, overflow: "hidden" }}>
        <Box sx={{ p: 2, bgcolor: "#123a64", color: "#fff" }}><Typography fontWeight={900}>InsureOne</Typography><Typography variant="caption" sx={{ opacity: .8 }}>Κέντρο διαχείρισης</Typography></Box>
        <List sx={{ p: 1 }}>{menuItems.map(item => <ListItemButton key={item.key} selected={section === item.key} onClick={() => setSection(item.key)} sx={{ borderRadius: 1.5, mb: .5, "&.Mui-selected": { bgcolor: "#e2f1f6", color: "#0b6fb8", fontWeight: 800 }, "&:hover": { bgcolor: "#f0f7fb" } }}><ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon><ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: section === item.key ? 800 : 650, fontSize: 14 }} /></ListItemButton>)}</List>
      </Card>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {section === "overview" && <OverviewSection settings={settings.data} analytics={analytics.data} partners={partners.data ?? []} onNew={openNew} onBranding={() => setSettingsOpen(true)} />}
        {section === "partners" && <PartnersSection loading={partners.isLoading} partners={partners.data ?? []} onNew={openNew} onEdit={p => { setEditing(p); setFormOpen(true); }} onDelete={setRevokeId} />}
        {section === "permissions" && <PermissionsSection partners={partners.data ?? []} />}
        {section === "analytics" && <AnalyticsSection data={analytics.data} loading={analytics.isLoading} />}
        {section === "branding" && <BrandingSection settings={settings.data} onEdit={() => setSettingsOpen(true)} onError={setError} onSaved={() => void qc.invalidateQueries({ queryKey: ["insureone-settings"] })} />}
        {section === "preview" && <PreviewSection settings={settings.data} />}
      </Box>
    </Stack>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings.data} onSaved={() => { setSettingsOpen(false); void qc.invalidateQueries({ queryKey: ["insureone-settings"] }); }} onError={setError} />
    <PartnerDialog open={formOpen} onClose={() => setFormOpen(false)} item={editing} onSaved={() => { setFormOpen(false); void qc.invalidateQueries({ queryKey: ["insureone-partners"] }); void qc.invalidateQueries({ queryKey: ["insureone-admin-analytics"] }); }} onError={setError} />
    <Dialog open={!!revokeId} onClose={() => setRevokeId(null)} maxWidth="xs" fullWidth><DialogTitle>Ανάκληση πρόσβασης;</DialogTitle><DialogContent><Typography>Θέλετε να απενεργοποιήσετε την πρόσβαση του/της <strong>{selectedRevoke ? `${selectedRevoke.firstName} ${selectedRevoke.lastName}` : "συνεργάτη"}</strong>; Το ιστορικό του διατηρείται.</Typography></DialogContent><DialogActions><Button onClick={() => setRevokeId(null)} startIcon={<CloseRoundedIcon />}>Ακύρωση</Button><Button color="error" variant="contained" startIcon={<DeleteRoundedIcon />} disabled={revoke.isPending} onClick={() => revokeId && revoke.mutate(revokeId)}>Ανάκληση</Button></DialogActions></Dialog>
  </Box>;
}

function OverviewSection({ settings, analytics, partners, onNew, onBranding }: { settings?: Branding; analytics?: Analytics; partners: Partner[]; onNew: () => void; onBranding: () => void }) {
  const metrics: { label: string; value: number; icon: JSX.Element; bg: string }[] = [
    { label: "Συνεργάτες", value: analytics?.totalPartners ?? partners.length, icon: <GroupRoundedIcon />, bg: "#e7f2fb" },
    { label: "Ενεργοί", value: analytics?.activePartners ?? partners.filter(p => p.isActive).length, icon: <CheckCircleRoundedIcon />, bg: "#e7f7ef" },
    { label: "Προσφορές συνολικά", value: analytics?.totalQuotes ?? 0, icon: <LinkRoundedIcon />, bg: "#eef0ff" },
    { label: "Προσφορές μήνα", value: analytics?.quotesThisMonth ?? 0, icon: <AnalyticsRoundedIcon />, bg: "#fff5e5" },
  ];
  return <Stack spacing={2}><SectionHeading title="Επισκόπηση InsureOne" subtitle="Μια καθαρή εικόνα της branded πύλης και των χρηστών του γραφείου." />
    <Grid container spacing={1.5}>{metrics.map(metric => <Grid item xs={6} md={3} key={metric.label}><Card variant="outlined" sx={{ p: 2, borderRadius: 2.5, height: "100%" }}><Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: metric.bg, display: "grid", placeItems: "center", mb: 1, color: "#123a64" }}>{metric.icon}</Box><Typography variant="h4" fontWeight={900} color="#123a64">{metric.value}</Typography><Typography variant="body2" color="text.secondary">{metric.label}</Typography></Card></Grid>)}</Grid>
    <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "linear-gradient(120deg,#eef8fc,#fff)" }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}><Box sx={{ width: 64, height: 64, borderRadius: 2, bgcolor: settings?.primaryColor ?? "#0b6fb8", display: "grid", placeItems: "center", color: "white", fontWeight: 900, fontSize: 20 }}>IO</Box><Box flex={1}><Typography fontWeight={900} color="#123a64">{settings?.displayName ?? "InsureOne"}</Typography><Typography variant="body2" color="text.secondary">Σύνδεση συνεργατών: <strong>/insureone/{settings?.slug ?? "office-slug"}/login</strong></Typography><Typography variant="caption" color="text.secondary">Τα δικαιώματα και οι κλάδοι ορίζονται ξεχωριστά για κάθε χρήστη.</Typography></Box><Stack direction="row" gap={1} alignItems="center"><Chip color={settings?.isEnabled ? "success" : "default"} label={settings?.isEnabled ? "Ενεργό" : "Ανενεργό"} /><Button size="small" variant="outlined" onClick={onBranding}>Ρυθμίσεις</Button></Stack></Stack></Card>
    <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}><Box><Typography fontWeight={850}>Γρήγορη διαχείριση</Typography><Typography variant="body2" color="text.secondary">Προσθέστε συνεργάτη ή δείτε αναλυτικά τα δικαιώματα.</Typography></Box><Button variant="contained" size="small" startIcon={<AddRoundedIcon />} onClick={onNew}>Προσθήκη</Button></Stack><Divider /><Stack direction="row" gap={1} flexWrap="wrap" mt={1.5}>{["Προσωποποιημένο URL", "Προεπισκόπηση login", "Έλεγχος ανά χρήστη", "Αναλυτικά στατιστικά"].map(item => <Chip key={item} label={item} variant="outlined" />)}</Stack></Card>
  </Stack>;
}

function PartnersSection({ loading, partners, onNew, onEdit, onDelete }: { loading: boolean; partners: Partner[]; onNew: () => void; onEdit: (p: Partner) => void; onDelete: (id: string) => void }) {
  return <Stack spacing={2}><SectionHeading title="Συνεργάτες & χρήστες" subtitle="Δημιουργία υποκωδικών, πρόσβαση στο InsureOne και έλεγχος ανά συνεργάτη." action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onNew}>Νέος συνεργάτης</Button>} />{loading ? <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress /></Box> : <Grid container spacing={2}>{partners.map(p => <Grid item xs={12} md={6} lg={4} key={p.id}><Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}><Stack sx={{ p: 2.5 }} spacing={1.25}><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography fontWeight={850}>{p.firstName} {p.lastName}</Typography><Typography variant="body2" color="text.secondary">{p.email}</Typography></Box><Chip size="small" color={p.isActive ? "success" : "default"} label={p.isActive ? "Ενεργός" : "Ανενεργός"} /></Stack><Typography variant="body2"><strong>Κωδικός:</strong> {p.loginCode}</Typography><Typography variant="body2" color="text.secondary">Συνεργάτης: {p.producerName}</Typography><Stack direction="row" gap={.5} flexWrap="wrap"><Chip size="small" label="Τιμολόγηση" color="primary" variant="outlined" />{p.canViewCustomers && <Chip size="small" label="Πελάτες" variant="outlined" />}{p.canViewCommissions && <Chip size="small" label="Προμήθειες" variant="outlined" />}{p.canIssuePolicies && <Chip size="small" label="Έκδοση" variant="outlined" />}</Stack><Divider sx={{ my: .5 }} /><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="caption" color="text.secondary">{p.lastLoginAt ? `Τελευταία είσοδος: ${new Date(p.lastLoginAt).toLocaleString("el-GR")}` : "Δεν έχει συνδεθεί ακόμη"}</Typography><Stack direction="row"><IconButton size="small" onClick={() => onEdit(p)} aria-label="Επεξεργασία"><EditRoundedIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => onDelete(p.id)} aria-label="Ανάκληση πρόσβασης"><DeleteRoundedIcon fontSize="small" /></IconButton></Stack></Stack></Stack></Card></Grid>)}</Grid>}{!loading && !partners.length && <Card variant="outlined" sx={{ p: 5, textAlign: "center" }}><Typography color="text.secondary">Δεν έχουν δημιουργηθεί ακόμη συνεργάτες InsureOne.</Typography></Card>}</Stack>;
}

function PermissionsSection({ partners }: { partners: Partner[] }) {
  return <Stack spacing={2}><SectionHeading title="Δικαιώματα & πρόσβαση" subtitle="Συγκεντρωτική προβολή των δυνατοτήτων κάθε συνεργάτη." /><Card variant="outlined" sx={{ borderRadius: 3, overflow: "auto" }}><Box sx={{ minWidth: 720 }}><Stack direction="row" sx={{ p: 1.5, bgcolor: "#eef5f9", borderBottom: "1px solid #d6e4ed" }}><Typography sx={{ width: 230, fontWeight: 850 }}>Συνεργάτης</Typography>{permissionOptions.map(([, label]) => <Typography key={label} sx={{ flex: 1, px: .75, fontSize: 12, fontWeight: 800, color: "#31516b" }}>{label}</Typography>)}</Stack>{partners.map(partner => <Stack direction="row" key={partner.id} sx={{ p: 1.5, alignItems: "center", borderBottom: "1px solid #edf2f6" }}><Typography sx={{ width: 230, fontWeight: 750 }}>{partner.firstName} {partner.lastName}</Typography>{permissionOptions.map(([key]) => <Box key={key} sx={{ flex: 1, px: .75 }}>{partner.permissions.includes(key) ? <CheckCircleRoundedIcon fontSize="small" sx={{ color: "#1b7f55" }} /> : <Typography color="text.disabled">—</Typography>}</Box>)}</Stack>)}</Box></Card></Stack>;
}

function AnalyticsSection({ data, loading }: { data?: Analytics; loading: boolean }) {
  const max = Math.max(1, ...(data?.partners ?? []).map(p => p.totalQuotes));
  return <Stack spacing={2}><SectionHeading title="Στατιστικά & αναλύσεις" subtitle="Χρήση InsureOne ανά συνεργάτη, ενεργοποιήσεις και απόδοση προσφορών." />{loading ? <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress /></Box> : <><Grid container spacing={1.5}>{[["Ενεργοί συνεργάτες", data?.activePartners ?? 0], ["Συνεργάτες με έκδοση", data?.partnersWithIssuance ?? 0], ["Επιλεγμένες προσφορές", data?.selectedQuotes ?? 0], ["Λήγουν σύντομα", data?.expiringQuotes ?? 0]].map(([label, value]) => <Grid item xs={6} md={3} key={String(label)}><Card variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}><Typography variant="h4" fontWeight={900} color="#123a64">{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Card></Grid>)}</Grid><Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography fontWeight={850} mb={2}>Προσφορές ανά συνεργάτη</Typography><Stack spacing={1.5}>{(data?.partners ?? []).map(p => <Box key={p.accessId}><Stack direction="row" justifyContent="space-between" mb={.45}><Typography fontWeight={700}>{p.partnerName}</Typography><Typography variant="body2" color="text.secondary">{p.totalQuotes} συνολικά · {p.quotesThisMonth} αυτόν τον μήνα</Typography></Stack><LinearProgress variant="determinate" value={Math.round(p.totalQuotes / max * 100)} sx={{ height: 9, borderRadius: 6, bgcolor: "#e9f1f6", "& .MuiLinearProgress-bar": { borderRadius: 6, bgcolor: "#167ca8" } }} /></Box>)}{!data?.partners.length && <Typography color="text.secondary">Δεν υπάρχουν ακόμη δεδομένα χρήσης.</Typography>}</Stack></Card></>}</Stack>;
}

function BrandingSection({ settings, onEdit, onError, onSaved }: { settings?: Branding; onEdit: () => void; onError: (message: string) => void; onSaved: () => void }) {
  const upload = useMutation({ mutationFn: async (file: File) => { const payload = new FormData(); payload.append("file", file); await api.post("/insureone/settings/logo", payload, { headers: { "Content-Type": "multipart/form-data" } }); }, onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)) });
  return <Stack spacing={2}><SectionHeading title="Branding & ρυθμίσεις" subtitle="Προσωποποιήστε την login σελίδα και το περιβάλλον των συνεργατών σας." action={<Button variant="contained" startIcon={<SettingsRoundedIcon />} onClick={onEdit}>Επεξεργασία</Button>} /><Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "linear-gradient(120deg,#eef8fc,#fff)" }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}><Box sx={{ width: 96, height: 72, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#fff", border: "1px solid #d4e3ed", overflow: "hidden" }}>{settings?.logoUrl ? <Box component="img" src={`/api/insureone/public/${settings.slug}/logo`} alt="Λογότυπο InsureOne" sx={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Typography fontWeight={900} color={settings?.primaryColor ?? "#0b6fb8"}>IO</Typography>}</Box><Box flex={1}><Typography fontWeight={900} color="#123a64">{settings?.displayName ?? "InsureOne"}</Typography><Typography variant="body2" color="text.secondary">{settings?.welcomeMessage || "Καλωσορίσατε στην πύλη συνεργατών."}</Typography><Typography variant="caption" color="text.secondary">{settings?.slug ? `https://mykalypsis.gr/insureone/${settings.slug}/login` : "Δεν έχει οριστεί σύνδεσμος"}</Typography></Box><Button component="label" variant="outlined" startIcon={<PaletteRoundedIcon />} disabled={upload.isPending}>Ανέβασμα λογοτύπου<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.currentTarget.value = ""; }} /></Button></Stack></Card></Stack>;
}

function PreviewSection({ settings }: { settings?: Branding }) {
  const url = settings?.slug ? `/insureone/${settings.slug}/login` : "/insureone/demo/login";
  return <Stack spacing={2}><SectionHeading title="Προεπισκόπηση συνεργάτη" subtitle="Ελέγξτε το branded περιβάλλον πριν μοιραστείτε τον σύνδεσμο." /><Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: "#123a64", color: "#fff" }}><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}><Box><Typography variant="h5" fontWeight={900}>{settings?.displayName ?? "InsureOne"}</Typography><Typography sx={{ opacity: .8 }}>Σελίδα σύνδεσης συνεργατών</Typography><Typography sx={{ mt: 1, fontFamily: "monospace", fontSize: 13, color: "#a9e5ef" }}>{url}</Typography></Box><Button component="a" href={url} target="_blank" rel="noreferrer" variant="contained" sx={{ bgcolor: "#53c6d3", color: "#123a64", fontWeight: 900 }} startIcon={<PreviewRoundedIcon />}>Άνοιγμα προεπισκόπησης</Button></Stack></Card></Stack>;
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: JSX.Element }) { return <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1}><Box><Typography variant="h5" fontWeight={900} color="#123a64">{title}</Typography><Typography variant="body2" color="text.secondary">{subtitle}</Typography></Box>{action}</Stack>; }

function SettingsDialog({ open, onClose, settings, onSaved, onError }: { open: boolean; onClose: () => void; settings?: Branding; onSaved: () => void; onError: (s: string) => void }) {
  const [form, setForm] = useState({ slug: "", displayName: "", welcomeMessage: "", primaryColor: "#0B6FB8", secondaryColor: "#0B2545", supportEmail: "", supportPhone: "", isEnabled: true, allowedBranches: [] as string[] });
  useEffect(() => { if (settings) setForm({ slug: settings.slug, displayName: settings.displayName, welcomeMessage: settings.welcomeMessage ?? "", primaryColor: settings.primaryColor, secondaryColor: settings.secondaryColor, supportEmail: settings.supportEmail ?? "", supportPhone: settings.supportPhone ?? "", isEnabled: settings.isEnabled, allowedBranches: settings.allowedBranches ?? [] }); }, [settings, open]);
  const save = useMutation({ mutationFn: () => api.put("/insureone/settings", form), onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)) });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>Branding και ρυθμίσεις InsureOne</DialogTitle><DialogContent><Grid container spacing={2} sx={{ mt: .2 }}><Grid item xs={12} sm={6}><TextField fullWidth label="Slug URL" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} helperText="π.χ. neo-poseidonas" /></Grid><Grid item xs={12} sm={6}><TextField fullWidth label="Όνομα εμφάνισης" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></Grid><Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Μήνυμα καλωσορίσματος" value={form.welcomeMessage} onChange={e => setForm({ ...form, welcomeMessage: e.target.value })} /></Grid><Grid item xs={6}><TextField fullWidth label="Κύριο χρώμα" value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} /></Grid><Grid item xs={6}><TextField fullWidth label="Δευτερεύον χρώμα" value={form.secondaryColor} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} /></Grid><Grid item xs={12} sm={6}><TextField fullWidth label="Email υποστήριξης" value={form.supportEmail} onChange={e => setForm({ ...form, supportEmail: e.target.value })} /></Grid><Grid item xs={12} sm={6}><TextField fullWidth label="Τηλέφωνο υποστήριξης" value={form.supportPhone} onChange={e => setForm({ ...form, supportPhone: e.target.value })} /></Grid><Grid item xs={12}><FormControlLabel control={<Switch checked={form.isEnabled} onChange={e => setForm({ ...form, isEnabled: e.target.checked })} />} label="Ενεργή branded σύνδεση" /></Grid><Grid item xs={12}><Typography fontWeight={750} mb={1}>Επιτρεπόμενοι κλάδοι</Typography><Stack direction="row" gap={.4} flexWrap="wrap">{branches.map(branch => <FormControlLabel key={branch} control={<Checkbox size="small" checked={form.allowedBranches.includes(branch)} onChange={e => setForm({ ...form, allowedBranches: e.target.checked ? [...form.allowedBranches, branch] : form.allowedBranches.filter(x => x !== branch) })} />} label={branch} />)}</Stack></Grid></Grid></DialogContent><DialogActions><Button onClick={onClose}>Ακύρωση</Button><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button></DialogActions></Dialog>;
}

function PartnerDialog({ open, onClose, item, onSaved, onError }: { open: boolean; onClose: () => void; item: Partner | null; onSaved: () => void; onError: (s: string) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", loginCode: "", phone: "", isActive: true, canIssuePolicies: false, canViewCommissions: true, canViewCustomers: true, permissions: [...defaultPartnerPermissions], notes: "" });
  useEffect(() => { if (item) setForm({ firstName: item.firstName, lastName: item.lastName, email: item.email, password: "", loginCode: item.loginCode, phone: item.phone ?? "", isActive: item.isActive, canIssuePolicies: item.canIssuePolicies, canViewCommissions: item.canViewCommissions, canViewCustomers: item.canViewCustomers, permissions: (item.permissions?.length ? item.permissions : [...defaultPartnerPermissions]) as PermissionKey[], notes: item.notes ?? "" }); else if (open) setForm({ firstName: "", lastName: "", email: "", password: "", loginCode: "", phone: "", isActive: true, canIssuePolicies: false, canViewCommissions: true, canViewCustomers: true, permissions: [...defaultPartnerPermissions], notes: "" }); }, [item, open]);
  const save = useMutation({ mutationFn: () => item ? api.put(`/insureone/partners/${item.id}`, { isActive: form.isActive, canIssuePolicies: form.canIssuePolicies, canViewCommissions: form.canViewCommissions, canViewCustomers: form.canViewCustomers, permissions: form.permissions, loginCode: form.loginCode, newPassword: form.password || null, notes: form.notes || null, phone: form.phone || null }) : api.post("/insureone/partners", { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, loginCode: form.loginCode || null, phone: form.phone || null, canIssuePolicies: form.canIssuePolicies, canViewCommissions: form.canViewCommissions, canViewCustomers: form.canViewCustomers, permissions: form.permissions, notes: form.notes || null }), onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)) });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{item ? "Επεξεργασία συνεργάτη InsureOne" : "Νέος συνεργάτης InsureOne"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{!item && <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth required label="Όνομα" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /><TextField fullWidth required label="Επώνυμο" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></Stack>}<TextField fullWidth required={!item} label="Email" type="email" disabled={!!item} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><TextField fullWidth label="Κωδικός σύνδεσης" value={form.loginCode} onChange={e => setForm({ ...form, loginCode: e.target.value })} helperText="Ο συνεργάτης μπορεί να συνδεθεί με αυτόν αντί για email." />{!item && <TextField fullWidth required label="Προσωρινός κωδικός" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} helperText="Τουλάχιστον 8 χαρακτήρες." />}{item && <TextField fullWidth label="Νέος κωδικός (προαιρετικά)" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}<TextField fullWidth label="Τηλέφωνο" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><Stack>{[{ key: "isActive", label: "Ενεργή πρόσβαση" }, { key: "canViewCustomers", label: "Προβολή πελατών" }, { key: "canViewCommissions", label: "Προβολή προμηθειών" }, { key: "canIssuePolicies", label: "Υποβολή προς έκδοση" }].map(x => <FormControlLabel key={x.key} control={<Switch checked={(form as Record<string, unknown>)[x.key] as boolean} onChange={e => setForm({ ...form, [x.key]: e.target.checked })} />} label={x.label} />)}</Stack><Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5f9fd", border: "1px solid #dce9f2" }}><Typography fontWeight={750} mb={.5}>Δικαιώματα InsureOne</Typography><Typography variant="caption" color="text.secondary" display="block" mb={1}>Επιλέξτε με ακρίβεια τις λειτουργίες που θα είναι διαθέσιμες στον συνεργάτη.</Typography><Stack>{permissionOptions.map(([key, label]) => <FormControlLabel key={key} control={<Checkbox size="small" checked={form.permissions.includes(key)} onChange={e => setForm({ ...form, permissions: e.target.checked ? [...form.permissions, key] : form.permissions.filter(x => x !== key) })} />} label={label} />)}</Stack></Box><TextField fullWidth multiline minRows={2} label="Σημειώσεις" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Ακύρωση</Button><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || (!item && (!form.firstName || !form.lastName || !form.email || form.password.length < 8))}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button></DialogActions></Dialog>;
}
