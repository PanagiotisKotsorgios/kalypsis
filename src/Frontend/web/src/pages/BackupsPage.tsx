import { useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, LinearProgress, MenuItem, Stack,
  Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography
} from "@mui/material";
import BackupIcon from "@mui/icons-material/Backup";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SecurityIcon from "@mui/icons-material/Security";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import ScheduleIcon from "@mui/icons-material/Schedule";
import GavelIcon from "@mui/icons-material/Gavel";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, API_BASE_URL, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { dateTime } from "../utils/format";
import { HelpHint } from "../components/HelpHint";
import { SearchableTextField } from "../components/SearchableTextField";

interface BackupDto {
  id: string; fileName: string; sizeBytes: number; kind: string;
  createdAt: string; createdByName: string | null;
  summary: Record<string, number> | null;
}
interface BackupPolicyDto {
  enabled: boolean; frequencyDays: number; retentionCount: number; lastAutoBackupAt: string | null;
}
interface GdprRequestDto {
  id: string;
  requesterName: string; requesterEmail: string; requesterPhone: string | null;
  customerId: string | null; customerDisplay: string | null;
  reason: string; status: string; notes: string | null;
  createdAt: string; handledAt: string | null; handledByName: string | null;
}

const GDPR_STATUSES = ["Pending", "InReview", "Approved", "Rejected", "Completed"] as const;
const GDPR_STATUS_LABEL: Record<string, string> = {
  Pending: "Εκκρεμεί", InReview: "Υπό εξέταση", Approved: "Εγκρίθηκε",
  Rejected: "Απορρίφθηκε", Completed: "Ολοκληρώθηκε",
};
const GDPR_STATUS_COLOR: Record<string, "default" | "info" | "success" | "error" | "warning"> = {
  Pending: "warning", InReview: "info", Approved: "success",
  Rejected: "error", Completed: "success",
};

export function BackupsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "AgencyAdmin";
  const [tab, setTab] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("kalypsis:backups:tab") ?? "0");
      return Number.isFinite(v) && v >= 0 && v <= 2 ? v : 0;
    } catch { return 0; }
  });
  const changeTab = (v: number) => {
    setTab(v);
    try { localStorage.setItem("kalypsis:backups:tab", String(v)); } catch { /* quota */ }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap" gap={2}>
        <BackupIcon sx={{ fontSize: 42, color: "primary.main" }} />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {t("backups.title", "Αντίγραφα & GDPR")}
            </Typography>
            <HelpHint id="page.backups" />
          </Stack>
          <Typography color="text.secondary">
            {t("backups.subtitle", "Τοπικά αντίγραφα ασφαλείας δεδομένων γραφείου, αυτόματα προγράμματα και αιτήματα GDPR.")}
          </Typography>
        </Box>
      </Stack>

      {!isAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("backups.readOnlyNote", "Μόνο ο διαχειριστής του γραφείου μπορεί να δημιουργήσει αντίγραφα ή να αλλάξει τις ρυθμίσεις. Οι αναφορές GDPR είναι διαθέσιμες σε όλο το προσωπικό.")}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => changeTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }} variant="scrollable">
        <Tab icon={<HistoryIcon fontSize="small" />}  iconPosition="start" label={t("backups.tabs.backups", "Αντίγραφα")} />
        <Tab icon={<ScheduleIcon fontSize="small" />} iconPosition="start" label={t("backups.tabs.auto", "Αυτόματα αντίγραφα")} />
        <Tab icon={<GavelIcon fontSize="small" />}    iconPosition="start" label={t("backups.tabs.gdpr", "Αιτήματα GDPR")} />
      </Tabs>

      {tab === 0 && <BackupsTab isAdmin={isAdmin} />}
      {tab === 1 && <AutoBackupTab isAdmin={isAdmin} />}
      {tab === 2 && <GdprTab isAdmin={isAdmin} />}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Tab 1 — Backups.
// -----------------------------------------------------------------------------
function BackupsTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["tenant-backups"],
    queryFn: async () => (await api.get<BackupDto[]>("/backups")).data,
  });
  const create = useMutation({
    mutationFn: async () => (await api.post<BackupDto>("/backups")).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenant-backups"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/backups/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenant-backups"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });

  const items = q.data ?? [];
  const totalSize = items.reduce((s, b) => s + b.sizeBytes, 0);
  const latestManual = items.find(b => b.kind === "Manual");
  const latestAuto = items.find(b => b.kind === "Auto");

  const downloadUrl = (id: string) => `${API_BASE_URL}/backups/${id}/download`;

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
        <Kpi label="Σύνολο αντιγράφων" value={items.length} icon={<CloudDoneIcon />} color="#1976d2" />
        <Kpi label="Συνολικός όγκος" value={formatBytes(totalSize)} icon={<BackupIcon />} color="#2e7d32" />
        <Kpi label="Τελευταίο manual" value={latestManual ? dateTime(latestManual.createdAt) : "—"} icon={<HistoryIcon />} />
        <Kpi label="Τελευταίο auto" value={latestAuto ? dateTime(latestAuto.createdAt) : "—"} icon={<ScheduleIcon />} />
        <Box sx={{ flex: 1 }} />
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={create.isPending ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            disabled={create.isPending}
            onClick={() => create.mutate()}
            size="large"
          >
            {t("backups.createNow", "Νέο αντίγραφο τώρα")}
          </Button>
        )}
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {create.isPending && <LinearProgress sx={{ mb: 2 }} />}
      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ημερομηνία</TableCell>
                <TableCell>Τύπος</TableCell>
                <TableCell>Αρχείο</TableCell>
                <TableCell>Μέγεθος</TableCell>
                <TableCell>Περιεχόμενο</TableCell>
                <TableCell>Δημιουργήθηκε από</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    Δεν υπάρχουν αντίγραφα ακόμη. Πατήστε «Νέο αντίγραφο τώρα» για να δημιουργήσετε το πρώτο.
                  </TableCell>
                </TableRow>
              )}
              {items.map(b => (
                <TableRow key={b.id} hover>
                  <TableCell>{dateTime(b.createdAt)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={b.kind === "Auto" ? "info" : "primary"}
                      variant="outlined"
                      label={b.kind === "Auto" ? "Αυτόματο" : "Χειροκίνητο"}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{b.fileName}</TableCell>
                  <TableCell>{formatBytes(b.sizeBytes)}</TableCell>
                  <TableCell>
                    {b.summary && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                        {Object.entries(b.summary).filter(([, v]) => v > 0).slice(0, 4).map(([k, v]) => (
                          <Chip key={k} size="small" variant="outlined" label={`${SUMMARY_LABELS[k] ?? k}: ${v}`} />
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>{b.createdByName ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Λήψη">
                      <IconButton size="small" component="a" href={downloadUrl(b.id)}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip title="Διαγραφή">
                        <IconButton size="small" color="error" onClick={() => {
                          if (confirm("Διαγραφή αντιγράφου;")) del.mutate(b.id);
                        }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}

const SUMMARY_LABELS: Record<string, string> = {
  customers: "Πελάτες", policies: "Συμβόλαια", claims: "Ζημιές",
  receipts: "Αποδείξεις", payments: "Πληρωμές", tasks: "Εργασίες",
  appointments: "Ραντεβού", producers: "Παραγωγοί", carriers: "Ασφαλιστικές",
  instructions: "Οδηγίες",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Kpi({ label, value, color, icon }: { label: string; value: React.ReactNode; color?: string; icon?: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 180, flex: "1 1 180px" }}>
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon && <Avatar sx={{ bgcolor: color ?? "primary.main", width: 30, height: 30 }}>{icon}</Avatar>}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, color: color ?? "text.primary", lineHeight: 1.1 }}>{value}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Tab 2 — Auto-backup policy.
// -----------------------------------------------------------------------------
function AutoBackupTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["backup-policy"],
    queryFn: async () => (await api.get<BackupPolicyDto>("/backups/policy")).data,
  });
  const [form, setForm] = useState<BackupPolicyDto | null>(null);
  const p = form ?? q.data ?? null;

  const save = useMutation({
    mutationFn: async () => (await api.put<BackupPolicyDto>("/backups/policy", {
      enabled: p!.enabled, frequencyDays: p!.frequencyDays, retentionCount: p!.retentionCount,
    })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["backup-policy"] }); setForm(null); setErr(null); },
    onError: e => setErr(extractErrorMessage(e)),
  });

  if (q.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 600 }}>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <ScheduleIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Πρόγραμμα αυτόματων αντιγράφων</Typography>
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={p?.enabled ?? false}
                disabled={!isAdmin}
                onChange={e => setForm({ ...(p ?? { frequencyDays: 7, retentionCount: 8, lastAutoBackupAt: null } as BackupPolicyDto), enabled: e.target.checked })}
              />
            }
            label={<Typography sx={{ fontWeight: 700 }}>Ενεργό</Typography>}
          />
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2.5}>
            <SearchableTextField
              label="Συχνότητα"
              value={p?.frequencyDays ?? 7}
              disabled={!isAdmin || !(p?.enabled)}
              onChange={e => setForm({ ...(p ?? { enabled: true, retentionCount: 8, lastAutoBackupAt: null } as BackupPolicyDto), frequencyDays: Number(e.target.value) })}
              fullWidth
            >
              <MenuItem value={1}>Καθημερινά</MenuItem>
              <MenuItem value={2}>Κάθε 2 μέρες</MenuItem>
              <MenuItem value={7}>Εβδομαδιαία</MenuItem>
              <MenuItem value={14}>Κάθε δύο εβδομάδες</MenuItem>
              <MenuItem value={30}>Μηνιαία (30 μέρες)</MenuItem>
            </SearchableTextField>
            <TextField
              type="number"
              label="Διατήρηση (πόσα να κρατάει)"
              value={p?.retentionCount ?? 8}
              disabled={!isAdmin || !(p?.enabled)}
              inputProps={{ min: 1, max: 100 }}
              onChange={e => setForm({ ...(p ?? { enabled: true, frequencyDays: 7, lastAutoBackupAt: null } as BackupPolicyDto), retentionCount: Math.max(1, Math.min(100, Number(e.target.value))) })}
              helperText="Παλαιότερα αυτόματα αντίγραφα διαγράφονται όταν ξεπεραστεί το όριο."
              fullWidth
            />
            {p?.lastAutoBackupAt && (
              <Alert severity="info" icon={<CloudDoneIcon />}>
                Τελευταίο αυτόματο αντίγραφο: <b>{dateTime(p.lastAutoBackupAt)}</b>
              </Alert>
            )}
            {isAdmin && (
              <Stack direction="row" justifyContent="flex-end">
                <Button
                  variant="contained"
                  disabled={!form || save.isPending}
                  onClick={() => save.mutate()}
                  startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : <SettingsIcon />}
                >
                  {t("common.save", "Αποθήκευση")}
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Tab 3 — GDPR erasure requests.
// -----------------------------------------------------------------------------
function GdprTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GdprRequestDto | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const q = useQuery({
    queryKey: ["gdpr-requests", statusFilter],
    queryFn: async () => (await api.get<GdprRequestDto[]>("/gdpr/erasure-requests", {
      params: statusFilter ? { status: statusFilter } : {},
    })).data,
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/gdpr/erasure-requests/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gdpr-requests"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });

  const items = q.data ?? [];
  const pending = items.filter(x => x.status === "Pending").length;
  const inReview = items.filter(x => x.status === "InReview").length;
  const done = items.filter(x => x.status === "Completed").length;

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
        <Kpi label="Εκκρεμούν" value={pending} icon={<HourglassEmptyIcon />} color="#ed6c02" />
        <Kpi label="Υπό εξέταση" value={inReview} icon={<SecurityIcon />} color="#1976d2" />
        <Kpi label="Ολοκληρώθηκαν" value={done} icon={<CheckCircleIcon />} color="#2e7d32" />
        <Box sx={{ flex: 1 }} />
        <SearchableTextField label="Κατάσταση" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ width: 180 }}>
          <MenuItem value="">Όλες</MenuItem>
          {GDPR_STATUSES.map(s => <MenuItem key={s} value={s}>{GDPR_STATUS_LABEL[s]}</MenuItem>)}
        </SearchableTextField>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέο αίτημα
        </Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Υποβλήθηκε</TableCell>
                <TableCell>Αιτών</TableCell>
                <TableCell>Πελάτης</TableCell>
                <TableCell>Λόγος</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell>Χειρίστηκε</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    Δεν υπάρχουν αιτήματα διαγραφής.
                  </TableCell>
                </TableRow>
              )}
              {items.map(r => (
                <TableRow key={r.id} hover sx={{ cursor: isAdmin ? "pointer" : "default" }}
                  onClick={() => { if (isAdmin) setEditing(r); }}
                >
                  <TableCell>{dateTime(r.createdAt)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.requesterName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{r.requesterEmail}</Typography>
                  </TableCell>
                  <TableCell>
                    {r.customerId && r.customerDisplay ? (
                      <a href={`/app/customers/${r.customerId}`} style={{ color: "inherit" }} onClick={e => e.stopPropagation()}>
                        {r.customerDisplay}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>
                    <Typography variant="body2" noWrap>{r.reason}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={GDPR_STATUS_COLOR[r.status] ?? "default"} label={GDPR_STATUS_LABEL[r.status] ?? r.status} />
                  </TableCell>
                  <TableCell>
                    {r.handledByName ? (
                      <>
                        <Typography variant="body2">{r.handledByName}</Typography>
                        {r.handledAt && <Typography variant="caption" color="text.secondary">{dateTime(r.handledAt)}</Typography>}
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {isAdmin && (
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); if (confirm("Διαγραφή;")) del.mutate(r.id); }}>
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
      <GdprCreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["gdpr-requests"] }); setCreateOpen(false); }} />
      {isAdmin && (
        <GdprHandleDialog req={editing} onClose={() => setEditing(null)}
          onSaved={() => { void qc.invalidateQueries({ queryKey: ["gdpr-requests"] }); setEditing(null); }} />
      )}
    </Box>
  );
}

function GdprCreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ requesterName: "", requesterEmail: "", requesterPhone: "", reason: "" });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post("/gdpr/erasure-requests", {
      ...form,
      requesterPhone: form.requesterPhone || null,
      customerId: null,
    })).data,
    onSuccess: () => { setForm({ requesterName: "", requesterEmail: "", requesterPhone: "", reason: "" }); onSaved(); },
    onError: e => setErr(extractErrorMessage(e)),
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Νέο αίτημα διαγραφής (GDPR Art. 17)</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label="Ονοματεπώνυμο αιτούντος" value={form.requesterName}
            onChange={e => setForm({ ...form, requesterName: e.target.value })} fullWidth />
          <TextField required type="email" label="Email αιτούντος" value={form.requesterEmail}
            onChange={e => setForm({ ...form, requesterEmail: e.target.value })} fullWidth />
          <TextField label="Τηλέφωνο" value={form.requesterPhone}
            onChange={e => setForm({ ...form, requesterPhone: e.target.value })} fullWidth />
          <TextField required multiline rows={4} label="Αιτιολογία / πεδίο εφαρμογής" value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })} fullWidth
            helperText="Περιγράψτε ποια δεδομένα ζητά διαγραφή και για ποιο λόγο." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.requesterName.trim() || !form.requesterEmail.trim() || !form.reason.trim()}
        >
          {save.isPending ? <CircularProgress size={16} /> : "Υποβολή"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function GdprHandleDialog({ req, onClose, onSaved }: { req: GdprRequestDto | null; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(req?.status ?? "Pending");
  const [notes, setNotes] = useState(req?.notes ?? "");
  const [err, setErr] = useState<string | null>(null);
  useState(() => { if (req) { setStatus(req.status); setNotes(req.notes ?? ""); } });
  const save = useMutation({
    mutationFn: async () => (await api.put(`/gdpr/erasure-requests/${req!.id}`, { status, notes })).data,
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e)),
  });
  if (!req) return null;
  return (
    <Dialog open={!!req} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Επεξεργασία αιτήματος GDPR</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Alert severity="info">
            <b>{req.requesterName}</b> — {req.requesterEmail}
            {req.customerDisplay && (<><br />Πελάτης: {req.customerDisplay}</>)}
            <br /><span style={{ whiteSpace: "pre-wrap" }}>{req.reason}</span>
          </Alert>
          <SearchableTextField label="Κατάσταση" value={status} onChange={e => setStatus(e.target.value)} fullWidth>
            {GDPR_STATUSES.map(s => <MenuItem key={s} value={s}>{GDPR_STATUS_LABEL[s]}</MenuItem>)}
          </SearchableTextField>
          <TextField label="Σημειώσεις χειρισμού" multiline rows={4} value={notes}
            onChange={e => setNotes(e.target.value)} fullWidth
            helperText="Καταγράψτε τι έγινε — π.χ. διεγράφησαν αρχεία X, ενημερώθηκε ο πελάτης στις …" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={16} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
