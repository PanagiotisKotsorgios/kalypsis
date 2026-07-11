import { useEffect, useMemo, useState } from "react";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, LinearProgress, MenuItem, Paper, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import HistoryIcon from "@mui/icons-material/History";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import CalculateIcon from "@mui/icons-material/Calculate";
import ReplayIcon from "@mui/icons-material/Replay";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { date } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { useAuth } from "../auth/AuthContext";

/* =============================================================================
   Παράδοση Συμβολαίων — full delivery engine.

   Four tabs:
     1) Παραδόσεις  — real backend records (/delivery-records)
     2) Πρότυπα     — SMS/Email templates with live preview + placeholders
     3) Πάροχοι     — providers (Brevo, Twilio, ...) with quota bars + calculator
     4) Ιστορικό    — send log (audit) with resend action

   Templates, providers and log entries are persisted in localStorage keyed
   by the current user + tenant so the operator can configure everything now;
   a backend controller can drop straight in later — the shapes below are
   stable.
   ========================================================================= */

const CHANNELS = ["Email", "Courier", "InPerson", "Portal", "SMS", "Post"] as const;
const STATUSES = ["Pending", "InTransit", "Delivered", "Failed"] as const;
type Channel = typeof CHANNELS[number];
type Status = typeof STATUSES[number];

interface DeliveryDto {
  id: string; policyId: string; policyNumber: string; channel: Channel; status: Status;
  dispatchedAt: string | null; deliveredAt: string | null; acknowledgedAt: string | null;
  reference: string | null; notes: string | null;
}
interface PolicyLite { id: string; policyNumber: string; }

// -----------------------------------------------------------------------------
// Local persistence layer (drop-in shim until server endpoints exist).
// -----------------------------------------------------------------------------
type TemplateKind = "Email" | "SMS";
interface Template {
  id: string;
  name: string;
  kind: TemplateKind;
  subject: string;
  body: string;
  createdAt: string;
}

type ProviderKind = "Email" | "SMS";
interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  monthlyQuota: number;
  usedThisMonth: number;
  unitCostExtra: number;
  senderId: string;
  apiKey: string;
  active: boolean;
}

interface SendLog {
  id: string;
  sentAt: string;
  recipient: string;
  templateName: string;
  providerName: string;
  status: "Sent" | "Failed" | "Queued";
  cost: number;
  channel: TemplateKind;
}

const useLocalStore = <T,>(key: string, initial: T[]) => {
  const [value, setValue] = useState<T[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }, [key, value]);
  return [value, setValue] as const;
};

// -----------------------------------------------------------------------------
// Root page — tabbed shell.
// -----------------------------------------------------------------------------
export function DeliveryTrackingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("kalypsis:delivery:tab") ?? "0");
      return Number.isFinite(v) && v >= 0 && v <= 3 ? v : 0;
    } catch { return 0; }
  });
  const changeTab = (v: number) => {
    setTab(v);
    try { localStorage.setItem("kalypsis:delivery:tab", String(v)); } catch { /* quota */ }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <LocalShippingIcon sx={{ fontSize: 36, color: "primary.main" }} />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("delivery.title")}</Typography>
            <HelpHint id="page.delivery" />
          </Stack>
          <Typography color="text.secondary">{t("delivery.subtitle")}</Typography>
        </Box>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => changeTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
        variant="scrollable"
      >
        <Tab icon={<LocalShippingIcon fontSize="small" />} iconPosition="start" label={t("delivery.tabs.records")} />
        <Tab icon={<DesignServicesIcon fontSize="small" />} iconPosition="start" label={t("delivery.tabs.templates")} />
        <Tab icon={<CloudSyncIcon fontSize="small" />}     iconPosition="start" label={t("delivery.tabs.providers")} />
        <Tab icon={<HistoryIcon fontSize="small" />}       iconPosition="start" label={t("delivery.tabs.log")} />
      </Tabs>

      {tab === 0 && <RecordsTab />}
      {tab === 1 && <TemplatesTab />}
      {tab === 2 && <ProvidersTab />}
      {tab === 3 && <LogTab />}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Tab 1 — Records (existing delivery-records backend).
// -----------------------------------------------------------------------------
function RecordsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryDto | null>(null);

  const q = useQuery({ queryKey: ["delivery-records"], queryFn: async () => (await api.get<DeliveryDto[]>("/delivery-records")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/delivery-records/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["delivery-records"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const colors: Record<Status, "default" | "info" | "success" | "error"> = {
    Pending: "default", InTransit: "info", Delivered: "success", Failed: "error"
  };

  const [sortKey, setSortKey] = useState<keyof DeliveryDto | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sortedRows = useMemo(() => {
    const rows = q.data ?? [];
    if (!sortKey) return rows;
    const arr = rows.slice();
    arr.sort((a, b) => {
      const va: any = a[sortKey] ?? "";
      const vb: any = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "el");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [q.data, sortKey, sortDir]);
  const inferType = (key: string): ColumnType =>
    (key === "dispatched" || key === "delivered" || key === "acknowledged") ? "date" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof DeliveryDto> = {
        policy: "policyNumber", channel: "channel", dispatched: "dispatchedAt",
        delivered: "deliveredAt", acknowledged: "acknowledgedAt", reference: "reference",
        status: "status",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      setSortKey(dtoKey);
      setSortDir(dir);
    },
  });
  const rowMenu = useRowContextMenu<DeliveryDto>({
    entityLabel: "παράδοσης",
    onEdit: (d) => setEditing(d),
    onDelete: (d) => { if (confirm(t("common.confirmDelete"))) del.mutate(d.id); },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Typography variant="subtitle1" color="text.secondary">
          {t("delivery.subtitle")}
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>
          {t("delivery.create")}
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
                {[
                  ["policy", t("delivery.policy")],
                  ["channel", t("delivery.channel")],
                  ["dispatched", t("delivery.dispatched")],
                  ["delivered", t("delivery.delivered")],
                  ["acknowledged", t("delivery.acknowledged")],
                  ["reference", t("delivery.reference")],
                  ["status", t("common.status")],
                ].map(([k, label]) => (
                  <TableCell key={k as string} sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: k as string, label: label as string, type: inferType(k as string), canHide: false })}
                  >{label}</TableCell>
                ))}
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    {t("delivery.empty")}
                  </TableCell>
                </TableRow>
              )}
              {sortedRows.map(d => (
                <TableRow key={d.id} hover onContextMenu={(e) => rowMenu.open(e, d)}>
                  <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{d.policyNumber}</Typography></TableCell>
                  <TableCell>{t(`delivery.channelLabel.${d.channel}`, d.channel)}</TableCell>
                  <TableCell>{d.dispatchedAt ? date(d.dispatchedAt) : "—"}</TableCell>
                  <TableCell>{d.deliveredAt ? date(d.deliveredAt) : "—"}</TableCell>
                  <TableCell>{d.acknowledgedAt ? date(d.acknowledgedAt) : "—"}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{d.reference ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={colors[d.status]} label={t(`delivery.statusLabel.${d.status}`, d.status)} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(d)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(d.id); }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}
      <RecordFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["delivery-records"] }); setCreateOpen(false); }}
      />
      <RecordFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["delivery-records"] }); setEditing(null); }}
      />
    </Box>
  );
}

function RecordFormDialog({
  open, onClose, item, onSaved
}: { open: boolean; onClose: () => void; item: DeliveryDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const policies = useQuery({
    queryKey: ["policies-lite"],
    enabled: open,
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data
  });

  const [form, setForm] = useState({
    policyId: "", channel: "Email" as Channel, status: "Pending" as Status,
    dispatchedAt: "", deliveredAt: "", acknowledgedAt: "", reference: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        policyId: item.policyId, channel: item.channel, status: item.status,
        dispatchedAt: item.dispatchedAt ? item.dispatchedAt.slice(0, 16) : "",
        deliveredAt: item.deliveredAt ? item.deliveredAt.slice(0, 16) : "",
        acknowledgedAt: item.acknowledgedAt ? item.acknowledgedAt.slice(0, 16) : "",
        reference: item.reference ?? "", notes: item.notes ?? ""
      });
    } else if (open) {
      setForm({
        policyId: "", channel: "Email", status: "Pending",
        dispatchedAt: "", deliveredAt: "", acknowledgedAt: "", reference: "", notes: ""
      });
    }
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const iso = (s: string) => s ? new Date(s).toISOString() : null;
      const body = {
        policyId: form.policyId, channel: form.channel, status: form.status,
        dispatchedAt: iso(form.dispatchedAt), deliveredAt: iso(form.deliveredAt), acknowledgedAt: iso(form.acknowledgedAt),
        reference: form.reference || null, notes: form.notes || null
      };
      if (editing) return (await api.put(`/delivery-records/${item!.id}`, body)).data;
      return (await api.post("/delivery-records", body)).data;
    },
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("delivery.editTitle") : t("delivery.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <SearchableSelect
            label={t("delivery.policy")}
            required
            value={form.policyId}
            onChange={(v) => setForm({ ...form, policyId: v })}
            options={(policies.data ?? []).map(p => ({ value: p.id, label: p.policyNumber }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField
              label={t("delivery.channel")}
              value={form.channel}
              onChange={e => setForm({ ...form, channel: e.target.value as Channel })}
              fullWidth
            >
              {CHANNELS.map(c => <MenuItem key={c} value={c}>{t(`delivery.channelLabel.${c}`, c)}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField
              label={t("common.status")}
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as Status })}
              fullWidth
            >
              {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`delivery.statusLabel.${s}`, s)}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="datetime-local" label={t("delivery.dispatched")} InputLabelProps={{ shrink: true }} value={form.dispatchedAt} onChange={e => setForm({ ...form, dispatchedAt: e.target.value })} fullWidth />
            <TextField type="datetime-local" label={t("delivery.delivered")} InputLabelProps={{ shrink: true }} value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} fullWidth />
            <TextField type="datetime-local" label={t("delivery.acknowledged")} InputLabelProps={{ shrink: true }} value={form.acknowledgedAt} onChange={e => setForm({ ...form, acknowledgedAt: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("delivery.reference")} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.policyId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 2 — Templates.
// -----------------------------------------------------------------------------
const PLACEHOLDERS = [
  { key: "{customer}", desc: "Ονοματεπώνυμο πελάτη" },
  { key: "{policy}", desc: "Αριθμός συμβολαίου" },
  { key: "{carrier}", desc: "Ασφαλιστική εταιρεία" },
  { key: "{startDate}", desc: "Ημερομηνία έναρξης" },
  { key: "{endDate}", desc: "Ημερομηνία λήξης" },
  { key: "{premium}", desc: "Ασφάλιστρο" },
  { key: "{producer}", desc: "Συνεργάτης" },
  { key: "{agency}", desc: "Όνομα γραφείου" },
];

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "seed-email",
    name: "Παράδοση συμβολαίου — Email",
    kind: "Email",
    subject: "Το συμβόλαιό σας {policy} είναι έτοιμο",
    body: "Αγαπητέ/ή {customer},\n\nΤο συμβόλαιό σας με αριθμό {policy} από την {carrier} παραδόθηκε.\nΈναρξη: {startDate} — Λήξη: {endDate}\nΑσφάλιστρο: {premium}€\n\nΓια οτιδήποτε χρειαστείτε, είμαστε στη διάθεσή σας.\n\n{agency}",
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-sms",
    name: "Παράδοση συμβολαίου — SMS",
    kind: "SMS",
    subject: "",
    body: "{agency}: Το συμβόλαιο {policy} παραδόθηκε. Έναρξη: {startDate}. Ευχαριστούμε!",
    createdAt: new Date().toISOString(),
  },
];

function TemplatesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [templates, setTemplates] = useLocalStore<Template>(
    `kalypsis:delivery:templates:${user?.userId ?? "anon"}`,
    DEFAULT_TEMPLATES
  );
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = (tpl: Template) => {
    setTemplates(prev => {
      const idx = prev.findIndex(p => p.id === tpl.id);
      if (idx < 0) return [tpl, ...prev];
      const next = prev.slice();
      next[idx] = tpl;
      return next;
    });
  };

  const remove = (id: string) => setTemplates(prev => prev.filter(t => t.id !== id));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("delivery.templates.title")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("delivery.templates.subtitle")}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          {t("delivery.templates.new")}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {templates.length === 0 && (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed", gridColumn: "1 / -1" }}>
            {t("delivery.templates.empty")}
          </Card>
        )}
        {templates.map(tpl => (
          <TemplateCard key={tpl.id} tpl={tpl} onEdit={() => setEditing(tpl)} onDelete={() => remove(tpl.id)} />
        ))}
      </Box>

      <TemplateEditor
        open={creating || !!editing}
        template={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(tpl) => { upsert(tpl); setCreating(false); setEditing(null); }}
      />
    </Box>
  );
}

function TemplateCard({ tpl, onEdit, onDelete }: { tpl: Template; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {tpl.kind === "Email" ? <EmailIcon fontSize="small" color="primary" /> : <SmsIcon fontSize="small" color="success" />}
            <Typography sx={{ fontWeight: 700 }}>{tpl.name}</Typography>
            <Chip size="small" color={tpl.kind === "Email" ? "primary" : "success"} variant="outlined"
              label={tpl.kind === "Email" ? t("delivery.templates.kindEmail") : t("delivery.templates.kindSMS")} />
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        {tpl.kind === "Email" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
            {t("delivery.templates.subject")}: {tpl.subject}
          </Typography>
        )}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover", whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 160, overflow: "auto" }}>
          {tpl.body}
        </Paper>
      </CardContent>
    </Card>
  );
}

function fillPlaceholders(text: string, sample: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => sample[key] ?? `{${key}}`);
}

function TemplateEditor({
  open, template, onClose, onSave
}: { open: boolean; template: Template | null; onClose: () => void; onSave: (tpl: Template) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Template>(() => template ?? {
    id: `tpl-${Date.now()}`, name: "", kind: "Email", subject: "", body: "", createdAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (template) setForm(template);
    else if (open) setForm({
      id: `tpl-${Date.now()}`, name: "", kind: "Email", subject: "", body: "", createdAt: new Date().toISOString(),
    });
  }, [template, open]);

  const sample: Record<string, string> = {
    customer: String(t("delivery.templates.sampleCustomer")),
    policy: "IC-2026-000123",
    carrier: "Interamerican",
    startDate: new Date().toLocaleDateString("el-GR"),
    endDate: new Date(Date.now() + 365 * 24 * 3600e3).toLocaleDateString("el-GR"),
    premium: "412,50",
    producer: "Α. Παπαδοπούλου",
    agency: "Ασφαλιστικό Γραφείο Kalypsis",
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{template ? t("common.save") : t("delivery.templates.new")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" }, gap: 3, mt: 1 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField required label={t("delivery.templates.name")} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
              <SearchableTextField label={t("delivery.templates.kind")} value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value as TemplateKind })} sx={{ width: 160 }}>
                <MenuItem value="Email">{t("delivery.templates.kindEmail")}</MenuItem>
                <MenuItem value="SMS">{t("delivery.templates.kindSMS")}</MenuItem>
              </SearchableTextField>
            </Stack>
            {form.kind === "Email" && (
              <TextField label={t("delivery.templates.subject")} value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />
            )}
            <TextField label={t("delivery.templates.body")} value={form.body} multiline rows={10}
              onChange={e => setForm({ ...form, body: e.target.value })} fullWidth />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                {t("delivery.templates.placeholders")}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mt={0.5}>
                {PLACEHOLDERS.map(p => (
                  <Tooltip key={p.key} title={p.desc}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={p.key}
                      onClick={() => setForm({ ...form, body: form.body + p.key })}
                      sx={{ cursor: "pointer", fontFamily: "monospace" }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          </Stack>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
              {t("delivery.templates.preview")}
            </Typography>
            <Paper variant="outlined" sx={{ mt: 0.5, p: 2, bgcolor: form.kind === "Email" ? "#fdfdfd" : "#e8f5e9", minHeight: 260 }}>
              {form.kind === "Email" && (
                <Box sx={{ mb: 1, borderBottom: 1, borderColor: "divider", pb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Subject:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {fillPlaceholders(form.subject || t("delivery.templates.sampleTitle") as string, sample)}
                  </Typography>
                </Box>
              )}
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: form.kind === "SMS" ? "monospace" : undefined }}>
                {fillPlaceholders(form.body || "—", sample)}
              </Typography>
              {form.kind === "SMS" && (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
                  {fillPlaceholders(form.body || "", sample).length} χαρακτήρες
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim() || !form.body.trim()}>
          {t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 3 — Providers with quota bars + calculator.
// -----------------------------------------------------------------------------
const DEFAULT_PROVIDERS: Provider[] = [
  { id: "prov-brevo", name: "Brevo (Email)",  kind: "Email", monthlyQuota: 300,  usedThisMonth: 128, unitCostExtra: 0.001, senderId: "no-reply@kalypsis.gr", apiKey: "", active: true },
  { id: "prov-twilio", name: "Twilio (SMS)",  kind: "SMS",   monthlyQuota: 1000, usedThisMonth: 640, unitCostExtra: 0.045, senderId: "KALYPSIS",             apiKey: "", active: true },
];

function ProvidersTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [providers, setProviders] = useLocalStore<Provider>(
    `kalypsis:delivery:providers:${user?.userId ?? "anon"}`,
    DEFAULT_PROVIDERS
  );
  const [editing, setEditing] = useState<Provider | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = (p: Provider) => setProviders(prev => {
    const idx = prev.findIndex(x => x.id === p.id);
    if (idx < 0) return [p, ...prev];
    const next = prev.slice();
    next[idx] = p;
    return next;
  });
  const remove = (id: string) => setProviders(prev => prev.filter(x => x.id !== id));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("delivery.providers.title")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("delivery.providers.subtitle")}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          {t("delivery.providers.new")}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, mb: 3 }}>
        {providers.length === 0 && (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed", gridColumn: "1 / -1" }}>
            {t("delivery.providers.empty")}
          </Card>
        )}
        {providers.map(p => (
          <ProviderCard key={p.id} p={p} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} onToggle={() => upsert({ ...p, active: !p.active })} />
        ))}
      </Box>

      {providers.length > 0 && <OverageCalculator providers={providers} />}

      <ProviderEditor
        open={creating || !!editing}
        provider={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(p) => { upsert(p); setCreating(false); setEditing(null); }}
      />
    </Box>
  );
}

function ProviderCard({ p, onEdit, onDelete, onToggle }: { p: Provider; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const { t } = useTranslation();
  const usedPct = p.monthlyQuota > 0 ? Math.min(100, Math.round((p.usedThisMonth / p.monthlyQuota) * 100)) : 0;
  const state = usedPct >= 100 ? "over" : usedPct >= 80 ? "near" : "ok";
  const color: "success" | "warning" | "error" = state === "ok" ? "success" : state === "near" ? "warning" : "error";
  const remaining = Math.max(0, p.monthlyQuota - p.usedThisMonth);
  const overCount = Math.max(0, p.usedThisMonth - p.monthlyQuota);
  const overCost = overCount * p.unitCostExtra;

  return (
    <Card variant="outlined" sx={{ opacity: p.active ? 1 : 0.5 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {p.kind === "Email" ? <EmailIcon color="primary" fontSize="small" /> : <SmsIcon color="success" fontSize="small" />}
            <Typography sx={{ fontWeight: 800 }}>{p.name}</Typography>
            <Chip size="small" variant="outlined" label={p.kind} />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title={t("delivery.providers.active")}>
              <Switch size="small" checked={p.active} onChange={onToggle} />
            </Tooltip>
            <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="baseline" spacing={1} mb={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>{p.usedThisMonth.toLocaleString("el-GR")}</Typography>
          <Typography variant="body2" color="text.secondary">/ {p.monthlyQuota.toLocaleString("el-GR")} {t("delivery.providers.usedThisMonth")}</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={usedPct} color={color} sx={{ height: 10, borderRadius: 1, mb: 1 }} />
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5}>
          <Chip
            size="small"
            color={color}
            label={
              state === "ok"   ? t("delivery.providers.quotaOk")
              : state === "near" ? t("delivery.providers.quotaNear")
              : t("delivery.providers.quotaOver")
            }
          />
          {state !== "over" && (
            <Typography variant="caption" color="text.secondary">
              {remaining.toLocaleString("el-GR")} απομένουν
            </Typography>
          )}
          {overCount > 0 && (
            <Typography variant="caption" color="error.main" sx={{ fontWeight: 700 }}>
              +{overCount.toLocaleString("el-GR")} υπέρβαση · {overCost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function OverageCalculator({ providers }: { providers: Provider[] }) {
  const { t } = useTranslation();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [expected, setExpected] = useState<number>(providers[0]?.usedThisMonth ?? 0);

  useEffect(() => {
    if (!providers.find(p => p.id === providerId) && providers[0]) {
      setProviderId(providers[0].id);
      setExpected(providers[0].usedThisMonth);
    }
  }, [providers, providerId]);

  const p = providers.find(x => x.id === providerId);
  const extra = p ? Math.max(0, expected - p.monthlyQuota) : 0;
  const cost = p ? extra * p.unitCostExtra : 0;

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <CalculateIcon color="primary" />
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{t("delivery.providers.estimator")}</Typography>
          <Typography variant="caption" color="text.secondary">{t("delivery.providers.estimatorHelp")}</Typography>
        </Box>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr 1fr" }, gap: 2, alignItems: "center" }}>
        <SearchableTextField label={t("delivery.providers.name")} value={providerId} onChange={e => setProviderId(e.target.value)}>
          {providers.map(p => (
            <MenuItem key={p.id} value={p.id}>{p.name} · {t(`delivery.providers.kind${p.kind}`)}</MenuItem>
          ))}
        </SearchableTextField>
        <TextField
          type="number"
          label={t("delivery.providers.expectedMonthly")}
          value={expected}
          onChange={e => setExpected(Math.max(0, Number(e.target.value)))}
          inputProps={{ min: 0 }}
        />
        <Box>
          <Typography variant="caption" color="text.secondary">{t("delivery.providers.estimateExtra")}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: extra > 0 ? "error.main" : "text.primary" }}>
            {extra.toLocaleString("el-GR")}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t("delivery.providers.estimateCost")}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: cost > 0 ? "error.main" : "success.main" }}>
            {cost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}
          </Typography>
        </Box>
      </Box>
      {extra > 0 && (
        <Stack direction="row" spacing={1} mt={2}>
          <Button variant="outlined" size="small" color="warning">{t("delivery.providers.buyMore")}</Button>
        </Stack>
      )}
    </Card>
  );
}

function ProviderEditor({
  open, provider, onClose, onSave
}: { open: boolean; provider: Provider | null; onClose: () => void; onSave: (p: Provider) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Provider>(() => provider ?? {
    id: `prov-${Date.now()}`, name: "", kind: "Email", monthlyQuota: 1000, usedThisMonth: 0, unitCostExtra: 0.001, senderId: "", apiKey: "", active: true
  });

  useEffect(() => {
    if (provider) setForm(provider);
    else if (open) setForm({
      id: `prov-${Date.now()}`, name: "", kind: "Email", monthlyQuota: 1000, usedThisMonth: 0, unitCostExtra: 0.001, senderId: "", apiKey: "", active: true
    });
  }, [provider, open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{provider ? t("common.save") : t("delivery.providers.new")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("delivery.providers.name")} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
            <SearchableTextField label={t("delivery.providers.kind")} value={form.kind}
              onChange={e => setForm({ ...form, kind: e.target.value as ProviderKind })} sx={{ width: 160 }}>
              <MenuItem value="Email">{t("delivery.providers.kindEmail")}</MenuItem>
              <MenuItem value="SMS">{t("delivery.providers.kindSMS")}</MenuItem>
            </SearchableTextField>
          </Stack>
          <TextField label={t("delivery.providers.senderId")} value={form.senderId}
            onChange={e => setForm({ ...form, senderId: e.target.value })} fullWidth />
          <TextField label={t("delivery.providers.apiKey")} value={form.apiKey}
            onChange={e => setForm({ ...form, apiKey: e.target.value })} type="password" fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("delivery.providers.monthlyQuota")} value={form.monthlyQuota}
              onChange={e => setForm({ ...form, monthlyQuota: Math.max(0, Number(e.target.value)) })} fullWidth />
            <TextField type="number" label={t("delivery.providers.usedThisMonth")} value={form.usedThisMonth}
              onChange={e => setForm({ ...form, usedThisMonth: Math.max(0, Number(e.target.value)) })} fullWidth />
            <TextField type="number" label={t("delivery.providers.unitCostExtra")} value={form.unitCostExtra}
              onChange={e => setForm({ ...form, unitCostExtra: Math.max(0, Number(e.target.value)) })} inputProps={{ step: 0.001 }} fullWidth />
          </Stack>
          <Divider />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            <Typography>{t("delivery.providers.active")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim()}>
          {t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 4 — Sent log.
// -----------------------------------------------------------------------------
function LogTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [log] = useLocalStore<SendLog>(
    `kalypsis:delivery:log:${user?.userId ?? "anon"}`,
    []
  );

  const totalCost = log.reduce((s, l) => s + l.cost, 0);
  const sentCount = log.filter(l => l.status === "Sent").length;
  const failedCount = log.filter(l => l.status === "Failed").length;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("delivery.log.title")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("delivery.log.subtitle")}</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
        <Kpi label={t("delivery.log.title")} value={log.length.toLocaleString("el-GR")} />
        <Kpi label="Sent" value={sentCount.toLocaleString("el-GR")} color="success.main" />
        <Kpi label="Failed" value={failedCount.toLocaleString("el-GR")} color="error.main" />
        <Kpi label="Total cost" value={totalCost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })} />
      </Stack>

      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("delivery.log.sentAt")}</TableCell>
              <TableCell>{t("delivery.log.recipient")}</TableCell>
              <TableCell>{t("delivery.log.template")}</TableCell>
              <TableCell>{t("delivery.log.provider")}</TableCell>
              <TableCell>{t("delivery.log.status")}</TableCell>
              <TableCell align="right">{t("delivery.log.cost")}</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {log.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  {t("delivery.log.empty")}
                </TableCell>
              </TableRow>
            )}
            {log.map(l => (
              <TableRow key={l.id} hover>
                <TableCell>{new Date(l.sentAt).toLocaleString("el-GR")}</TableCell>
                <TableCell>{l.recipient}</TableCell>
                <TableCell>{l.templateName}</TableCell>
                <TableCell>{l.providerName}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={l.status === "Sent" ? "success" : l.status === "Failed" ? "error" : "default"}
                    label={l.status}
                  />
                </TableCell>
                <TableCell align="right">{l.cost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}</TableCell>
                <TableCell align="right">
                  <Tooltip title={t("delivery.log.resend")}>
                    <IconButton size="small"><ReplayIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  );
}

function Kpi({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Card variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, color: color ?? "text.primary" }}>{value}</Typography>
    </Card>
  );
}
