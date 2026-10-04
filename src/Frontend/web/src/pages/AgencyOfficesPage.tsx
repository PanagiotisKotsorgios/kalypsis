import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Checkbox, FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, List, ListItem, ListItemText
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import StarIcon from "@mui/icons-material/Star";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SaveIcon from "@mui/icons-material/Save";
import LoginIcon from "@mui/icons-material/Login";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InsightsIcon from "@mui/icons-material/Insights";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import BusinessIcon from "@mui/icons-material/Business";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

export interface OfficeDto {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  isHeadquarters: boolean;
  isActive: boolean;
  userCount: number;
  notes: string | null;
  profileJson?: string | null;
}

interface UpsertBody {
  code: string; name: string;
  city: string | null; address: string | null; postalCode: string | null;
  phone: string | null; email: string | null;
  isHeadquarters: boolean; isActive: boolean;
  notes: string | null;
}

interface OfficeUserDto {
  userId: string; email: string; firstName: string; lastName: string;
  role: "AgencyAdmin" | "AgencyOfficeAdmin" | "AgencyUser"; isAssigned: boolean; isPrimary: boolean;
}

interface OfficeOverviewDto {
  officeId: string; officeName: string; userCount: number; customerCount: number;
  producerCount: number; policyCount: number; activePolicyCount: number;
  claimCount: number; commissionRuleCount: number; parametricCount: number;
  grossPremium: number; netPremium: number;
}

interface CopyParametricsResult {
  sourceOfficeId: string; targetOfficeId: string; branchesCopied: number;
  commissionRulesCopied: number; defaultRulesCopied: number; renewalRulesCopied: number;
  bonusMalusRulesCopied: number; registerTemplatesCopied: number;
}

export function AgencyOfficesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeDto | null>(null);
  const [assigning, setAssigning] = useState<OfficeDto | null>(null);
  const [profileFor, setProfileFor] = useState<OfficeDto | null>(null);
  const [overviewOffice, setOverviewOffice] = useState<OfficeDto | null>(null);
  const [copyTarget, setCopyTarget] = useState<OfficeDto | null>(null);

  const q = useQuery({
    queryKey: ["agency-offices"],
    queryFn: async () => (await api.get<OfficeDto[]>("/agency-offices")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/agency-offices/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agency-offices"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const offices = q.data ?? [];
  const headquarters = useMemo(() => offices.find(o => o.isHeadquarters) ?? offices[0], [offices]);
  const overview = useQuery({
    queryKey: ["agency-office-overview", overviewOffice?.id],
    enabled: !!overviewOffice,
    queryFn: async () => (await api.get<OfficeOverviewDto>(`/agency-offices/${overviewOffice!.id}/overview`)).data
  });
  const copy = useMutation({
    mutationFn: async (target: OfficeDto) => (await api.post<CopyParametricsResult>(`/agency-offices/${target.id}/copy-parametrics`, {
      sourceOfficeId: headquarters?.id ?? null
    })).data,
    onSuccess: result => {
      setCopyTarget(null);
      setError(`Τα παραμετρικά αντιγράφηκαν: ${result.branchesCopied} κλάδοι, ${result.commissionRulesCopied} κανόνες προμηθειών, ${result.defaultRulesCopied + result.renewalRulesCopied} αυτοματισμοί.`);
    },
    onError: e => setError(extractErrorMessage(e))
  });

  const enterOffice = (office: OfficeDto) => {
    localStorage.setItem("kalypsis.activeOfficeId", office.id);
    window.location.reload();
  };
  const showAllOffices = () => {
    localStorage.removeItem("kalypsis.activeOfficeId");
    window.location.reload();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <HomeWorkIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Διαχείριση Γραφείων</Typography>
            <Typography color="text.secondary">
              Κεντρική εποπτεία, δημιουργία γραφείων, ανάθεση υπαλλήλων, παραμετρικά και στατιστικά ανά γραφείο.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέο γραφείο
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.25, mb: 2 }}>
        <ManagementCard icon={<BusinessIcon />} label="Σύνολο γραφείων" value={offices.length} />
        <ManagementCard icon={<HomeWorkIcon />} label="Ενεργά γραφεία" value={offices.filter(o => o.isActive).length} tone="success" />
        <ManagementCard icon={<PeopleAltIcon />} label="Σύνολο υπαλλήλων" value={offices.reduce((sum, office) => sum + office.userCount, 0)} />
        <ManagementCard icon={<StarIcon />} label="Κεντρικό γραφείο" value={headquarters?.name ?? "Δεν έχει οριστεί"} compact />
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
        <Button variant="outlined" startIcon={<LoginIcon />} onClick={showAllOffices}>
          Εποπτεία όλων των γραφείων
        </Button>
        <Button variant="outlined" startIcon={<PeopleAltIcon />} onClick={() => navigate("/users")}>
          Διαχείριση υπαλλήλων & ρόλων
        </Button>
        <Button variant="outlined" startIcon={<BusinessIcon />} onClick={() => navigate("/production-companies-agencies")}>
          Εταιρείες & παραμετρικά
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Κωδικός</TableCell>
                <TableCell>Όνομα</TableCell>
                <TableCell>Πόλη</TableCell>
                <TableCell>Επικοινωνία</TableCell>
                <TableCell align="right">Χρήστες</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν καταχωρημένα υποκαταστήματα. Δημιουργήστε πρώτο το κεντρικό.
                </TableCell></TableRow>
              )}
              {(q.data ?? []).map((o) => (
                <TableRow key={o.id} hover onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (!target.closest("button,a,input,[role='button']")) setProfileFor(o);
                }} sx={{ cursor: "pointer" }}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={o.code} sx={{ fontFamily: "monospace" }} />
                      {o.isHeadquarters && (
                        <Chip size="small" icon={<StarIcon />} label="Κεντρικό" color="warning" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell><Typography fontWeight={600}>{o.name}</Typography></TableCell>
                  <TableCell>
                    {o.city ?? "—"}
                    {o.postalCode && <Typography variant="caption" color="text.secondary" display="block">{o.postalCode}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>
                    {o.phone && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <PhoneIcon fontSize="inherit" sx={{ color: "text.secondary" }} />
                        <span>{o.phone}</span>
                      </Box>
                    )}
                    {o.email && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "var(--ink-soft, #777)" }}>
                        <EmailIcon fontSize="inherit" />
                        <span>{o.email}</span>
                      </Box>
                    )}
                    {!o.phone && !o.email && "—"}
                  </TableCell>
                  <TableCell align="right">{o.userCount}</TableCell>
                  <TableCell>
                    <Chip size="small" color={o.isActive ? "success" : "default"}
                      label={o.isActive ? "Ενεργό" : "Ανενεργό"} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="success" title="Είσοδος στο γραφείο"
                      onClick={() => enterOffice(o)}>
                      <LoginIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="info" title="Στατιστικά γραφείου"
                      onClick={() => setOverviewOffice(o)}>
                      <InsightsIcon fontSize="small" />
                    </IconButton>
                    {!o.isHeadquarters && headquarters && (
                      <IconButton size="small" color="secondary" title="Αντιγραφή παραμετρικών από το κεντρικό"
                        onClick={() => setCopyTarget(o)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => setEditing(o)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="primary" title="Ανάθεση χρηστών"
                      onClick={() => setAssigning(o)}>
                      <ManageAccountsIcon fontSize="small" />
                    </IconButton>
                    {!o.isHeadquarters && (
                      <IconButton size="small" color="error" onClick={() => {
                        if (confirm(`Διαγραφή υποκαταστήματος "${o.name}";`)) del.mutate(o.id);
                      }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <OfficeDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setCreateOpen(false); }} />
      <OfficeDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setEditing(null); }} />
      <OfficeUsersDialog open={!!assigning} office={assigning}
        onClose={() => setAssigning(null)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setAssigning(null); }} />
      <OfficeProfileDialog open={!!profileFor} office={profileFor} onClose={() => setProfileFor(null)} />
      <OfficeOverviewDialog open={!!overviewOffice} office={overviewOffice} overview={overview.data}
        loading={overview.isLoading} onClose={() => setOverviewOffice(null)} />
      <CopyParametricsDialog open={!!copyTarget} source={headquarters} target={copyTarget}
        pending={copy.isPending} onClose={() => setCopyTarget(null)} onConfirm={() => copyTarget && copy.mutate(copyTarget)} />
    </Box>
  );
}

function ManagementCard({ icon, label, value, tone, compact }: {
  icon: ReactNode; label: string; value: ReactNode; tone?: "success"; compact?: boolean;
}) {
  return <Card variant="outlined" sx={{ p: 1.35, minWidth: 0, bgcolor: tone === "success" ? "rgba(46,125,50,.045)" : "rgba(11,37,69,.025)" }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 1.5,
        bgcolor: tone === "success" ? "success.main" : "primary.main", color: "common.white" }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
        <Typography variant={compact ? "body2" : "h6"} fontWeight={800} noWrap>{value}</Typography>
      </Box>
    </Stack>
  </Card>;
}

function OfficeOverviewDialog({ open, office, overview, loading, onClose }: {
  open: boolean; office: OfficeDto | null; overview?: OfficeOverviewDto; loading: boolean; onClose: () => void;
}) {
  const money = (value: number) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value ?? 0);
  const items = overview ? [
    ["Πελάτες", overview.customerCount], ["Συνεργάτες", overview.producerCount],
    ["Συμβόλαια", overview.policyCount], ["Ενεργά συμβόλαια", overview.activePolicyCount],
    ["Ζημιές", overview.claimCount], ["Κανόνες προμηθειών", overview.commissionRuleCount],
    ["Παραμετρικά", overview.parametricCount], ["Μικτά ασφάλιστρα", money(overview.grossPremium)],
    ["Καθαρά ασφάλιστρα", money(overview.netPremium)]
  ] : [];
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle sx={{ fontWeight: 800 }}><Stack direction="row" spacing={1} alignItems="center"><InsightsIcon color="primary" />Στατιστικά γραφείου · {office?.name ?? ""}</Stack></DialogTitle>
    <DialogContent dividers>
      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress /></Box> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1 }}>
          {items.map(([label, value]) => <Card key={String(label)} variant="outlined" sx={{ p: 1.25, bgcolor: "rgba(11,37,69,.025)" }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="h6" fontWeight={800}>{value}</Typography>
          </Card>)}
        </Box>
      )}
    </DialogContent>
    <DialogActions><Button onClick={onClose} variant="contained">Κλείσιμο</Button></DialogActions>
  </Dialog>;
}

function CopyParametricsDialog({ open, source, target, pending, onClose, onConfirm }: {
  open: boolean; source?: OfficeDto; target: OfficeDto | null; pending: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle sx={{ fontWeight: 800 }}><Stack direction="row" spacing={1} alignItems="center"><ContentCopyIcon color="secondary" />Αντιγραφή παραμετρικών</Stack></DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2">
        Θα αντιγραφούν στο <strong>{target?.name}</strong> οι κλάδοι, οι κανόνες προμηθειών,
        οι προεπιλογές συμβολαίων, οι κανόνες ανανέωσης, οι κανόνες bonus–malus και τα πρότυπα μητρώων από το <strong>{source?.name ?? "κεντρικό γραφείο"}</strong>.
      </Typography>
      <Alert severity="info" sx={{ mt: 1.5 }}>Οι υπάρχουσες εγγραφές δεν διπλασιάζονται και οι ασφαλιστικές εταιρείες παραμένουν κοινές για το γραφείο.</Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="error" variant="contained">Ακύρωση</Button>
      <Button onClick={onConfirm} color="success" variant="contained" startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <ContentCopyIcon />} disabled={pending || !target || !source}>
        Αντιγραφή
      </Button>
    </DialogActions>
  </Dialog>;
}

function OfficeProfileDialog({ open, office, onClose }: { open: boolean; office: OfficeDto | null; onClose: () => void }) {
  const users = useQuery({
    queryKey: ["agency-office-profile-users", office?.id],
    enabled: open && !!office,
    queryFn: async () => (await api.get<OfficeUserDto[]>(`/agency-offices/${office!.id}/users`)).data
  });

  const assigned = (users.data ?? []).filter(user => user.isAssigned);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap">
          <HomeWorkIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800}>{office?.name ?? "…"}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{office?.code}</Typography>
          </Box>
          {office?.isHeadquarters && <Chip size="small" icon={<StarIcon />} color="warning" label="Κεντρικό" />}
          <Chip size="small" color={office?.isActive ? "success" : "default"} label={office?.isActive ? "Ενεργό" : "Ανενεργό"} />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
          <Card variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75 }}>Στοιχεία πρακτορείου</Typography>
            <OfficeProfileField label="Πόλη / ΤΚ" value={[office?.city, office?.postalCode].filter(Boolean).join(" · ")} />
            <OfficeProfileField label="Διεύθυνση" value={office?.address} />
            <OfficeProfileField label="Τηλέφωνο" value={office?.phone} link={office?.phone ? `tel:${office.phone}` : undefined} />
            <OfficeProfileField label="Email" value={office?.email} link={office?.email ? `mailto:${office.email}` : undefined} />
          </Card>
          <Card variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75 }}>Πρόσωπα &amp; ρόλοι</Typography>
            {users.isLoading ? <CircularProgress size={20} /> : assigned.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Δεν έχουν ανατεθεί χρήστες.</Typography>
            ) : assigned.map(user => (
              <Box key={user.userId} sx={{ py: 0.45, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="body2" fontWeight={700}>{`${user.firstName} ${user.lastName}`.trim() || user.email}</Typography>
                <Typography variant="caption" color="text.secondary">{user.role} · {user.email}{user.isPrimary ? " · κύριο γραφείο" : ""}</Typography>
              </Box>
            ))}
          </Card>
          <Card variant="outlined" sx={{ p: 1.25, gridColumn: { sm: "1 / -1" } }}>
            <Typography variant="subtitle2" fontWeight={800}>Σημειώσεις / ιστορικό γραφείου</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
              {office?.notes?.trim() || "Δεν έχουν καταχωρηθεί σημειώσεις για το πρακτορείο."}
            </Typography>
          </Card>
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions>
    </Dialog>
  );
}

function OfficeProfileField({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  const shown = value?.trim() || "—";
  return <Box sx={{ mb: 0.65 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600}>{link && value ? <a href={link} style={{ color: "inherit" }}>{shown}</a> : shown}</Typography>
  </Box>;
}

function OfficeUsersDialog({ open, office, onClose, onSaved }: {
  open: boolean; office: OfficeDto | null; onClose: () => void; onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const users = useQuery({
    queryKey: ["agency-office-users", office?.id],
    enabled: open && !!office,
    queryFn: async () => (await api.get<OfficeUserDto[]>(`/agency-offices/${office!.id}/users`)).data
  });
  useEffect(() => {
    if (users.data) setSelected(users.data.filter(u => u.isAssigned).map(u => u.userId));
  }, [users.data]);
  const save = useMutation({
    mutationFn: async () => api.put(`/agency-offices/${office!.id}/users`, { userIds: selected }),
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Χρήστες · {office?.name ?? ""}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr(null)}>{err}</Alert>}
        {users.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box> : (
          <List dense>
            {(users.data ?? []).map(u => (
              <ListItem key={u.userId} disablePadding>
                <Checkbox checked={selected.includes(u.userId)} onChange={() => toggle(u.userId)} />
                <ListItemText primary={`${u.firstName} ${u.lastName}`.trim() || u.email}
                  secondary={`${u.email} · ${u.role}${u.isPrimary ? " · Κύριο" : ""}`} />
              </ListItem>
            ))}
            {!users.isLoading && (users.data ?? []).length === 0 &&
              <Typography color="text.secondary">Δεν υπάρχουν χρήστες γραφείου.</Typography>}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained">Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || users.isLoading} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function OfficeDialog({ open, onClose, item, onSaved }: {
  open: boolean; onClose: () => void; item: OfficeDto | null; onSaved: (saved?: OfficeDto) => void;
}) {
  const editing = !!item;
  const [form, setForm] = useState<UpsertBody>({
    code: "", name: "", city: null, address: null, postalCode: null,
    phone: null, email: null, isHeadquarters: false, isActive: true, notes: null
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        code: item.code, name: item.name,
        city: item.city, address: item.address, postalCode: item.postalCode,
        phone: item.phone, email: item.email,
        isHeadquarters: item.isHeadquarters, isActive: item.isActive,
        notes: item.notes
      });
    } else if (open) {
      setForm({
        code: "", name: "", city: null, address: null, postalCode: null,
        phone: null, email: null, isHeadquarters: false, isActive: true, notes: null
      });
    }
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form,
        code: form.code.trim(), name: form.name.trim(),
        city: form.city?.trim() || null,
        address: form.address?.trim() || null,
        postalCode: form.postalCode?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        notes: form.notes?.trim() || null
      };
      if (editing && item) return (await api.put(`/agency-offices/${item.id}`, body)).data;
      return (await api.post("/agency-offices", body)).data;
    },
    onSuccess: saved => {
      setForm({ code: "", name: "", city: null, address: null, postalCode: null,
        phone: null, email: null, isHeadquarters: false, isActive: true, notes: null });
      onSaved(saved as OfficeDto);
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {editing ? `Επεξεργασία — ${item?.name}` : "Νέο υποκατάστημα"}
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: "72vh", overflowY: "auto" }}>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κωδικός" required value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 12) })}
              sx={{ width: 160 }} placeholder="HQ / THES / PAT" />
            <TextField label="Όνομα" required fullWidth value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Υποκατάστημα Θεσσαλονίκης" />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Πόλη" fullWidth value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextField label="ΤΚ" value={form.postalCode ?? ""}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              sx={{ width: 140 }} />
          </Stack>

          <TextField label="Διεύθυνση" fullWidth value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Τηλέφωνο" fullWidth value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="Email" fullWidth value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Stack>

          <TextField label="Σημειώσεις" multiline minRows={2} fullWidth value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <Stack direction="row" spacing={3}>
            <FormControlLabel
              control={<Switch checked={form.isHeadquarters}
                onChange={(e) => setForm({ ...form, isHeadquarters: e.target.checked })} />}
              label="Κεντρικό υποκατάστημα" />
            <FormControlLabel
              control={<Switch checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label={form.isActive ? "Ενεργό" : "Ανενεργό"} />
          </Stack>

          {!form.isHeadquarters && form.isActive && (
            <Alert severity="info" icon={false}>
              <strong>Σημείωση χρέωσης:</strong> Κάθε υποκατάστημα πέρα από το κεντρικό χρεώνεται
              ξεχωριστά στη μηνιαία συνδρομή. Η ακριβής τιμή φαίνεται στο τιμολόγιό σας.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained">Άκυρο</Button>
        <Button variant="contained" color="success" startIcon={<SaveIcon />} disabled={save.isPending || !form.code.trim() || !form.name.trim()}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} color="inherit" /> : editing ? "Αποθήκευση αλλαγών" : "Δημιουργία & αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
