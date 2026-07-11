import { useEffect, useMemo, useState } from "react";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, LinearProgress, MenuItem, Paper, Stack,
  Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DashboardIcon from "@mui/icons-material/Dashboard";
import CampaignIcon from "@mui/icons-material/Campaign";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import AutoAwesomeMotionIcon from "@mui/icons-material/AutoAwesomeMotion";
import GroupsIcon from "@mui/icons-material/Groups";
import HistoryIcon from "@mui/icons-material/History";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import CalculateIcon from "@mui/icons-material/Calculate";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import ChatIcon from "@mui/icons-material/Chat";
import BoltIcon from "@mui/icons-material/Bolt";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CakeIcon from "@mui/icons-material/Cake";
import CelebrationIcon from "@mui/icons-material/Celebration";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import WavingHandIcon from "@mui/icons-material/WavingHand";
import StarIcon from "@mui/icons-material/Star";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import DescriptionIcon from "@mui/icons-material/Description";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { dateTime } from "../utils/format";
import { HelpHint } from "../components/HelpHint";
import { SearchableTextField } from "../components/SearchableTextField";

/* =============================================================================
   Marketing & Καμπάνιες — full-scale engine.

   Seven-tab shell:
     0) Πίνακας   — KPIs + upcoming schedule + quick actions
     1) Καμπάνιες — real backend campaigns (/marketing-campaigns)
     2) Πρότυπα   — reusable Email/SMS/Viber templates with live preview
     3) Κανόνες   — automation triggers (birthdays, expiring policies, welcome…)
     4) Ακροατήρια — reusable customer segments with saved filters
     5) Ιστορικό  — sent-log audit trail per recipient
     6) Ρυθμίσεις — email/SMS/Viber providers with quota bars + calculator

   Templates, rules, segments, provider config and log entries are persisted
   in localStorage keyed by the current user until backend endpoints ship;
   the DTO shapes are stable so a drop-in is straightforward.
   ========================================================================= */

// -----------------------------------------------------------------------------
// Backend types (for /marketing-campaigns).
// -----------------------------------------------------------------------------
const STATUSES = ["Draft", "Scheduled", "Sent"] as const;
type Status = typeof STATUSES[number];
const SEGMENTS = ["all", "expiring", "with_email"] as const;
type Segment = typeof SEGMENTS[number];
const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"] as const;
const CHANNELS = ["Email", "Sms", "Viber"] as const;
type Channel = typeof CHANNELS[number];

interface CampaignDto {
  id: string; name: string; subject: string; bodyHtml: string; smsBody: string | null; viberBody: string | null;
  channels: Channel[]; segmentKey: string | null; occupationFilter: string | null; needKindFilter: string | null;
  onlyUninsuredNeeds: boolean; status: Status;
  recipients: number; sent: number; failed: number; sentAt: string | null; scheduledFor: string | null; createdAt: string;
}

interface CampaignForm {
  name: string; subject: string; bodyHtml: string; smsBody: string; viberBody: string;
  channels: Channel[]; segmentKey: Segment; occupationFilter: string; needKindFilter: string;
  onlyUninsuredNeeds: boolean; status: Status; scheduledFor: string;
}
const EMPTY_CAMPAIGN: CampaignForm = {
  name: "", subject: "", bodyHtml: "", smsBody: "", viberBody: "", channels: ["Email"],
  segmentKey: "all", occupationFilter: "", needKindFilter: "", onlyUninsuredNeeds: false,
  status: "Draft", scheduledFor: ""
};

// -----------------------------------------------------------------------------
// Locally-persisted shapes.
// -----------------------------------------------------------------------------
type TemplateKind = "Email" | "SMS" | "Viber";
interface MarketingTemplate {
  id: string; name: string; kind: TemplateKind;
  subject: string; body: string;
  tags: string[]; createdAt: string;
}

type RuleTrigger =
  | "birthday" | "nameDay"
  | "policyExpiring" | "installmentDue"
  | "welcome" | "cooperationAnniversary"
  | "inactiveCustomer" | "policyIssued";

interface AutomationRule {
  id: string; name: string; description: string;
  trigger: RuleTrigger; daysOffset: number;
  templateId: string | null;
  channels: Channel[];
  audienceSegmentId: string | null;
  active: boolean;
  createdAt: string;
  lastRunAt: string | null;
  runsCount: number;
}

interface AudienceSegment {
  id: string; name: string; description: string;
  criteria: {
    hasEmail: boolean; hasPhone: boolean; hasViber: boolean;
    occupation: string; needKind: string; onlyUninsuredNeeds: boolean;
    expiringWithinDays: number | null;
    unpaidBalance: boolean;
    consentRequired: boolean;
  };
  estimatedCount: number;
  createdAt: string;
}

interface SendLogEntry {
  id: string; sentAt: string;
  campaignName: string;
  recipientName: string; recipientContact: string;
  channel: Channel; templateName: string;
  status: "Delivered" | "Opened" | "Clicked" | "Bounced" | "Failed" | "Unsubscribed";
  cost: number;
}

type ProviderKind = "Email" | "SMS" | "Viber";
interface MarketingProvider {
  id: string; name: string; kind: ProviderKind;
  senderId: string; apiKey: string;
  monthlyQuota: number; usedThisMonth: number;
  unitCostExtra: number; active: boolean;
}

// -----------------------------------------------------------------------------
// LocalStorage shim — same pattern as delivery/name-days pages.
// -----------------------------------------------------------------------------
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
export function MarketingCampaignsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("kalypsis:marketing:tab") ?? "0");
      return Number.isFinite(v) && v >= 0 && v <= 6 ? v : 0;
    } catch { return 0; }
  });
  const changeTab = (v: number) => {
    setTab(v);
    try { localStorage.setItem("kalypsis:marketing:tab", String(v)); } catch { /* quota */ }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap" gap={2}>
        <CampaignIcon sx={{ fontSize: 42, color: "primary.main" }} />
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {t("marketing.title", "Marketing & Καμπάνιες")}
            </Typography>
            <HelpHint id="page.marketing" />
          </Stack>
          <Typography color="text.secondary">
            {t("marketing.subtitleEngine", "Δημιουργήστε καμπάνιες, πρότυπα και αυτοματισμούς — παρακολουθήστε αποδοτικότητα και παραδώσεις.")}
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => changeTab(v)}
        variant="scrollable"
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<DashboardIcon fontSize="small" />}          iconPosition="start" label={t("marketing.tabs.dashboard", "Πίνακας")} />
        <Tab icon={<CampaignIcon fontSize="small" />}           iconPosition="start" label={t("marketing.tabs.campaigns", "Καμπάνιες")} />
        <Tab icon={<DesignServicesIcon fontSize="small" />}     iconPosition="start" label={t("marketing.tabs.templates", "Πρότυπα")} />
        <Tab icon={<AutoAwesomeMotionIcon fontSize="small" />}  iconPosition="start" label={t("marketing.tabs.rules", "Κανόνες")} />
        <Tab icon={<GroupsIcon fontSize="small" />}             iconPosition="start" label={t("marketing.tabs.segments", "Ακροατήρια")} />
        <Tab icon={<HistoryIcon fontSize="small" />}            iconPosition="start" label={t("marketing.tabs.history", "Ιστορικό")} />
        <Tab icon={<CloudSyncIcon fontSize="small" />}          iconPosition="start" label={t("marketing.tabs.providers", "Πάροχοι")} />
      </Tabs>

      {tab === 0 && <DashboardTab />}
      {tab === 1 && <CampaignsTab />}
      {tab === 2 && <TemplatesTab />}
      {tab === 3 && <RulesTab />}
      {tab === 4 && <SegmentsTab />}
      {tab === 5 && <HistoryTab />}
      {tab === 6 && <ProvidersTab />}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Small shared pieces.
// -----------------------------------------------------------------------------
function Kpi({ label, value, color, icon }: { label: string; value: React.ReactNode; color?: string; icon?: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 180, flex: "1 1 180px" }}>
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon && <Avatar sx={{ bgcolor: color ?? "primary.main", width: 32, height: 32 }}>{icon}</Avatar>}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: color ?? "text.primary", lineHeight: 1.1 }}>{value}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ChannelIcon({ channel, size = "small" }: { channel: Channel | TemplateKind; size?: "small" | "medium" }) {
  const props = { fontSize: size };
  switch (channel) {
    case "Email": return <EmailIcon {...props} color="primary" />;
    case "Sms":
    case "SMS":   return <SmsIcon {...props} color="success" />;
    case "Viber": return <ChatIcon {...props} sx={{ color: "#665CAC" }} />;
  }
}

function fillPlaceholders(text: string, sample: Record<string, string>): string {
  return text.replace(/\{\{?(\w+)\}?\}/g, (_, k) => sample[k] ?? `{{${k}}}`);
}

// -----------------------------------------------------------------------------
// Tab 0 — Dashboard.
// -----------------------------------------------------------------------------
function DashboardTab() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["marketing-campaigns"],
    queryFn: async () => (await api.get<CampaignDto[]>("/marketing-campaigns")).data,
  });
  const { user } = useAuth();
  const [rules] = useLocalStore<AutomationRule>(`kalypsis:marketing:rules:${user?.userId ?? "anon"}`, []);
  const [log] = useLocalStore<SendLogEntry>(`kalypsis:marketing:log:${user?.userId ?? "anon"}`, []);

  const campaigns = q.data ?? [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600e3;
  const sentThisMonth = campaigns
    .filter(c => c.sentAt && new Date(c.sentAt).getTime() >= thirtyDaysAgo)
    .reduce((s, c) => s + c.sent, 0);
  const failedThisMonth = campaigns
    .filter(c => c.sentAt && new Date(c.sentAt).getTime() >= thirtyDaysAgo)
    .reduce((s, c) => s + c.failed, 0);
  const totalDelivered = sentThisMonth - failedThisMonth;
  const deliveryPct = sentThisMonth > 0 ? Math.round((totalDelivered / sentThisMonth) * 100) : 100;
  const openCount = log.filter(l => l.status === "Opened" || l.status === "Clicked").length;
  const clickCount = log.filter(l => l.status === "Clicked").length;
  const openPct = log.length > 0 ? Math.round((openCount / log.length) * 100) : 0;
  const clickPct = log.length > 0 ? Math.round((clickCount / log.length) * 100) : 0;

  const activeCampaigns = campaigns.filter(c => c.status !== "Sent").length;
  const scheduled = campaigns
    .filter(c => c.status === "Scheduled" && c.scheduledFor)
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
  const activeRules = rules.filter(r => r.active).length;

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
        <Kpi label={t("marketing.kpi.sentMonth", "Στάλθηκαν 30d")} value={sentThisMonth.toLocaleString("el-GR")} color="#1976d2" icon={<SendIcon />} />
        <Kpi label={t("marketing.kpi.delivered", "Παραδόθηκαν")}   value={`${deliveryPct}%`} color="#2e7d32" icon={<CheckCircleIcon />} />
        <Kpi label={t("marketing.kpi.opens", "Άνοιγμα")}          value={`${openPct}%`}     color="#ed6c02" icon={<EmailIcon />} />
        <Kpi label={t("marketing.kpi.clicks", "Κλικ")}            value={`${clickPct}%`}    color="#9c27b0" icon={<BoltIcon />} />
        <Kpi label={t("marketing.kpi.activeCampaigns", "Ενεργές καμπάνιες")} value={activeCampaigns} icon={<CampaignIcon />} />
        <Kpi label={t("marketing.kpi.activeRules", "Ενεργοί αυτοματισμοί")}  value={activeRules}     color="#673ab7" icon={<AutoAwesomeMotionIcon />} />
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              {t("marketing.upcoming", "Προγραμματισμένες αποστολές")}
            </Typography>
            {scheduled.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center", fontStyle: "italic" }}>
                {t("marketing.upcomingEmpty", "Δεν υπάρχουν προγραμματισμένες αποστολές.")}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {scheduled.slice(0, 6).map(c => (
                  <Paper key={c.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <SendIcon fontSize="small" color="info" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.subject} · {dateTime(c.scheduledFor!)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        {c.channels.map(ch => <ChannelIcon key={ch} channel={ch} />)}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              {t("marketing.recentActivity", "Πρόσφατη δραστηριότητα")}
            </Typography>
            {log.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center", fontStyle: "italic" }}>
                {t("marketing.activityEmpty", "Δεν έχουν καταγραφεί αποστολές.")}
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {log.slice(0, 8).map(l => (
                  <Stack key={l.id} direction="row" alignItems="center" spacing={1}>
                    <ChannelIcon channel={l.channel} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.recipientName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{dateTime(l.sentAt)}</Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={l.status === "Failed" || l.status === "Bounced" ? "error" : l.status === "Delivered" ? "success" : "default"}
                      label={l.status}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Tab 1 — Campaigns (backend).
// -----------------------------------------------------------------------------
function CampaignsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignDto | null>(null);

  const q = useQuery({
    queryKey: ["marketing-campaigns"],
    queryFn: async () => (await api.get<CampaignDto[]>("/marketing-campaigns")).data
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/marketing-campaigns/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
    onError: e => setErr(extractErrorMessage(e))
  });
  const send = useMutation({
    mutationFn: async (id: string) => api.post(`/marketing-campaigns/${id}/send`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
    onError: e => setErr(extractErrorMessage(e))
  });
  const duplicate = useMutation({
    mutationFn: async (c: CampaignDto) => (await api.post("/marketing-campaigns", {
      name: `${c.name} (αντίγραφο)`, subject: c.subject, bodyHtml: c.bodyHtml,
      smsBody: c.smsBody, viberBody: c.viberBody, channels: c.channels,
      segmentKey: c.segmentKey, occupationFilter: c.occupationFilter,
      needKindFilter: c.needKindFilter, onlyUninsuredNeeds: c.onlyUninsuredNeeds,
      status: "Draft", scheduledFor: null,
    })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const colors: Record<Status, "default" | "info" | "success"> = { Draft: "default", Scheduled: "info", Sent: "success" };
  const canWrite = user?.role === "AgencyAdmin" || user?.permissions.includes("marketing.write");
  const canSend = user?.role === "AgencyAdmin" || user?.permissions.includes("marketing.send");

  const campaignsRaw = q.data ?? [];
  const drafts = campaignsRaw.filter(c => c.status === "Draft").length;
  const scheduled = campaignsRaw.filter(c => c.status === "Scheduled").length;
  const sent = campaignsRaw.filter(c => c.status === "Sent").length;

  const [sortKey, setSortKey] = useState<keyof CampaignDto | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const campaigns = useMemo(() => {
    if (!sortKey) return campaignsRaw;
    const arr = campaignsRaw.slice();
    arr.sort((a, b) => {
      const va: any = a[sortKey] ?? "";
      const vb: any = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "el");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [campaignsRaw, sortKey, sortDir]);
  const inferType = (key: string): ColumnType =>
    key === "sentAt" ? "date" : key === "recipients" ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof CampaignDto> = {
        name: "name", subject: "subject", segment: "segmentKey",
        recipients: "recipients", sentAt: "sentAt", status: "status",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      setSortKey(dtoKey);
      setSortDir(dir);
    },
  });
  const rowMenu = useRowContextMenu<CampaignDto>({
    entityLabel: "καμπάνιας",
    onEdit: canWrite ? (c) => setEditing(c) : undefined,
    onDuplicate: canWrite ? (c) => duplicate.mutate(c) : undefined,
    onDelete: canWrite ? (c) => { if (confirm(t("common.confirmDelete", "Επιβεβαίωση διαγραφής;"))) del.mutate(c.id); } : undefined,
  });

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
        <Kpi label={t("marketing.statusLabel.Draft", "Πρόχειρα")}     value={drafts}   icon={<EditIcon />} />
        <Kpi label={t("marketing.statusLabel.Scheduled", "Προγραμματισμένες")} value={scheduled} color="#1976d2" icon={<SendIcon />} />
        <Kpi label={t("marketing.statusLabel.Sent", "Στάλθηκαν")}     value={sent}     color="#2e7d32" icon={<CheckCircleIcon />} />
        <Box sx={{ flex: 1 }} />
        {canWrite && (
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
            {t("marketing.create", "Νέα καμπάνια")}
          </Button>
        )}
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
                  ["name", t("marketing.name", "Όνομα"), "left"],
                  ["subject", t("marketing.subject", "Θέμα"), "left"],
                  ["segment", t("marketing.segment", "Κοινό"), "left"],
                ].map(([k, label, align]) => (
                  <TableCell key={k as string} align={align as "left" | "right"} sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: k as string, label: label as string, type: inferType(k as string), canHide: false })}
                  >{label}</TableCell>
                ))}
                <TableCell>{t("marketing.channels", "Κανάλια")}</TableCell>
                <TableCell align="right" sx={{ userSelect: "none" }}
                  onContextMenu={(e) => headerMenu.open(e, { key: "recipients", label: t("marketing.recipients", "Παραλήπτες"), type: "number", canHide: false })}
                >{t("marketing.recipients", "Παραλήπτες")}</TableCell>
                <TableCell sx={{ userSelect: "none" }}
                  onContextMenu={(e) => headerMenu.open(e, { key: "sentAt", label: t("marketing.sentAt", "Στάλθηκε"), type: "date", canHide: false })}
                >{t("marketing.sentAt", "Στάλθηκε")}</TableCell>
                <TableCell sx={{ userSelect: "none" }}
                  onContextMenu={(e) => headerMenu.open(e, { key: "status", label: t("common.status", "Κατάσταση"), type: "string", canHide: false })}
                >{t("common.status", "Κατάσταση")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    {t("marketing.empty", "Δεν υπάρχουν καμπάνιες.")}
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map(c => (
                <TableRow key={c.id} hover onContextMenu={(e) => rowMenu.open(e, c)}>
                  <TableCell><Typography fontWeight={700}>{c.name}</Typography></TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{c.subject}</TableCell>
                  <TableCell>{c.segmentKey ? t(`marketing.segmentLabel.${c.segmentKey}`, c.segmentKey) : "—"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>{c.channels.map(ch => <ChannelIcon key={ch} channel={ch} />)}</Stack>
                  </TableCell>
                  <TableCell align="right">
                    {c.recipients} / {c.sent}
                    {c.failed > 0 && <Typography variant="caption" color="error.main"> ({c.failed} απέτυχαν)</Typography>}
                  </TableCell>
                  <TableCell>{c.sentAt ? dateTime(c.sentAt) : "—"}</TableCell>
                  <TableCell><Chip size="small" color={colors[c.status]} label={t(`marketing.statusLabel.${c.status}`, c.status)} /></TableCell>
                  <TableCell align="right">
                    {canSend && c.status !== "Sent" && (
                      <Tooltip title={t("marketing.send", "Αποστολή")}>
                        <IconButton size="small" color="primary" onClick={() => { if (confirm(t("marketing.sendConfirm", "Σίγουρα θέλετε αποστολή;"))) send.mutate(c.id); }}>
                          <SendIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canWrite && (
                      <>
                        <Tooltip title={t("marketing.duplicate", "Αντιγραφή")}>
                          <IconButton size="small" onClick={() => duplicate.mutate(c)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => setEditing(c)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete", "Επιβεβαίωση διαγραφής;"))) del.mutate(c.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}
      <CampaignFormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); setCreateOpen(false); }} />
      <CampaignFormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); setEditing(null); }} />
    </Box>
  );
}

function CampaignFormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: CampaignDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const editing = !!item;
  const [form, setForm] = useState<CampaignForm>({ ...EMPTY_CAMPAIGN });
  const [err, setErr] = useState<string | null>(null);

  const [templates] = useLocalStore<MarketingTemplate>(`kalypsis:marketing:templates:${user?.userId ?? "anon"}`, DEFAULT_TEMPLATES);

  useEffect(() => {
    if (item) setForm({
      name: item.name, subject: item.subject, bodyHtml: item.bodyHtml,
      smsBody: item.smsBody ?? "", viberBody: item.viberBody ?? "", channels: item.channels,
      occupationFilter: item.occupationFilter ?? "", needKindFilter: item.needKindFilter ?? "",
      onlyUninsuredNeeds: item.onlyUninsuredNeeds,
      segmentKey: (item.segmentKey as Segment) || "all", status: item.status,
      scheduledFor: item.scheduledFor ? item.scheduledFor.slice(0, 16) : ""
    });
    else if (open) setForm({ ...EMPTY_CAMPAIGN, bodyHtml: "<p>Καλησπέρα από το γραφείο μας...</p>" });
  }, [item, open]);

  const loadTemplate = (tpl: MarketingTemplate) => {
    setForm(prev => ({
      ...prev,
      subject: tpl.kind === "Email" ? tpl.subject : prev.subject,
      bodyHtml: tpl.kind === "Email" ? tpl.body : prev.bodyHtml,
      smsBody:  tpl.kind === "SMS"   ? tpl.body : prev.smsBody,
      viberBody: tpl.kind === "Viber" ? tpl.body : prev.viberBody,
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(), subject: form.subject.trim(), bodyHtml: form.bodyHtml,
        smsBody: form.smsBody?.trim() || null,
        viberBody: form.viberBody?.trim() || null,
        channels: form.channels?.length ? form.channels : ["Email"],
        segmentKey: form.segmentKey, occupationFilter: form.occupationFilter?.trim() || null,
        needKindFilter: form.needKindFilter || null, onlyUninsuredNeeds: !!form.onlyUninsuredNeeds, status: form.status,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null
      };
      if (editing) return (await api.put(`/marketing-campaigns/${item!.id}`, body)).data;
      return (await api.post("/marketing-campaigns", body)).data;
    },
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? t("marketing.editTitle", "Επεξεργασία καμπάνιας") : t("marketing.createTitle", "Νέα καμπάνια")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("marketing.name", "Όνομα")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField required label={t("marketing.subject", "Θέμα")} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />

          {templates.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                {t("marketing.loadFromTemplate", "Φόρτωση από πρότυπο")}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mt={0.5}>
                {templates.map(tpl => (
                  <Chip
                    key={tpl.id}
                    size="small"
                    variant="outlined"
                    icon={<ChannelIcon channel={tpl.kind} />}
                    label={tpl.name}
                    onClick={() => loadTemplate(tpl)}
                    sx={{ cursor: "pointer" }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label={t("marketing.segment", "Κοινό")} value={form.segmentKey}
              onChange={e => setForm({ ...form, segmentKey: e.target.value as Segment })} fullWidth>
              {SEGMENTS.map(s => <MenuItem key={s} value={s}>{t(`marketing.segmentLabel.${s}`, s)}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("common.status", "Κατάσταση")} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {STATUSES.filter(s => s !== "Sent").map(s => <MenuItem key={s} value={s}>{t(`marketing.statusLabel.${s}`, s)}</MenuItem>)}
            </SearchableTextField>
            <TextField type="datetime-local" label={t("marketing.scheduleFor", "Προγραμματισμός")} InputLabelProps={{ shrink: true }}
              value={form.scheduledFor} onChange={e => setForm({ ...form, scheduledFor: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Επάγγελμα / κλάδος" value={form.occupationFilter ?? ""}
              onChange={e => setForm({ ...form, occupationFilter: e.target.value })} fullWidth placeholder="π.χ. εστίαση" />
            <SearchableTextField label="Ανάγκη / περιουσία" value={form.needKindFilter ?? ""}
              onChange={e => setForm({ ...form, needKindFilter: e.target.value })} fullWidth>
              <MenuItem value="">Όλες</MenuItem>
              {NEED_KINDS.map(kind => <MenuItem key={kind} value={kind}>{kind}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
            {CHANNELS.map(channel => (
              <FormControlLabel key={channel} label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <ChannelIcon channel={channel} />
                  <span>{channel}</span>
                </Stack>
              } control={<Checkbox checked={(form.channels ?? ["Email"]).includes(channel)} onChange={e => {
                const current = form.channels ?? ["Email"];
                setForm({ ...form, channels: e.target.checked ? [...current, channel] : current.filter((c: Channel) => c !== channel) });
              }} />} />
            ))}
            <FormControlLabel label="Μόνο χωρίς ενεργή κάλυψη"
              control={<Switch checked={!!form.onlyUninsuredNeeds} disabled={!form.needKindFilter}
                onChange={e => setForm({ ...form, onlyUninsuredNeeds: e.target.checked })} />} />
          </Stack>
          <Alert severity="info">
            {t("marketing.placeholderInfo", "Placeholders: {{firstName}}, {{companyName}}, {{customerName}}, {{policyNumber}}. Αποστολή μόνο σε πελάτες με ενεργή συγκατάθεση.")}
          </Alert>
          <TextField label={t("marketing.bodyHtml", "Σώμα (HTML)")} multiline rows={10} value={form.bodyHtml}
            onChange={e => setForm({ ...form, bodyHtml: e.target.value })} fullWidth
            helperText={t("marketing.bodyHelp", "Υποστηρίζεται HTML.")} />
          <TextField label="Κείμενο SMS (προαιρετικό)" multiline rows={3} value={form.smsBody ?? ""}
            onChange={e => setForm({ ...form, smsBody: e.target.value })} fullWidth
            helperText={`${(form.smsBody ?? "").length} χαρακτήρες`} />
          <TextField label="Κείμενο Viber (προαιρετικό)" multiline rows={3} value={form.viberBody ?? ""}
            onChange={e => setForm({ ...form, viberBody: e.target.value })} fullWidth
            helperText="Αν μείνει κενό, χρησιμοποιείται το SMS/email κείμενο." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", "Άκυρο")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || !form.subject.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save", "Αποθήκευση")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 2 — Templates.
// -----------------------------------------------------------------------------
const MARKETING_PLACEHOLDERS = [
  { key: "{{firstName}}",    desc: "Όνομα πελάτη" },
  { key: "{{lastName}}",     desc: "Επώνυμο πελάτη" },
  { key: "{{customerName}}", desc: "Ολόκληρο όνομα" },
  { key: "{{companyName}}",  desc: "Επωνυμία (αν είναι εταιρεία)" },
  { key: "{{policyNumber}}", desc: "Αρ. συμβολαίου" },
  { key: "{{carrier}}",      desc: "Ασφαλιστική εταιρεία" },
  { key: "{{endDate}}",      desc: "Ημ. λήξης συμβολαίου" },
  { key: "{{producer}}",     desc: "Ο ασφαλιστής σας" },
  { key: "{{agency}}",       desc: "Όνομα γραφείου" },
];

const DEFAULT_TEMPLATES: MarketingTemplate[] = [
  {
    id: "tpl-welcome",
    name: "Καλωσόρισμα νέου πελάτη",
    kind: "Email",
    subject: "Καλωσορίσατε στο {{agency}}!",
    body: "<p>Αγαπητέ/ή {{firstName}},</p><p>Ευχαριστούμε για την εμπιστοσύνη σας. Είμαστε στη διάθεσή σας για οποιοδήποτε ασφαλιστικό θέμα.</p><p>Με εκτίμηση,<br>{{producer}}<br>{{agency}}</p>",
    tags: ["welcome", "onboarding"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-renewal",
    name: "Υπενθύμιση ανανέωσης",
    kind: "Email",
    subject: "Το συμβόλαιό σας {{policyNumber}} λήγει σύντομα",
    body: "<p>Αγαπητέ/ή {{firstName}},</p><p>Σας ενημερώνουμε ότι το συμβόλαιό σας {{policyNumber}} από την {{carrier}} λήγει στις {{endDate}}. Επικοινωνήστε μαζί μας για ανανέωση.</p><p>{{agency}}</p>",
    tags: ["renewal", "expiring"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-birthday",
    name: "Ευχές γενεθλίων — SMS",
    kind: "SMS",
    subject: "",
    body: "{{agency}}: Χρόνια Πολλά για τα γενέθλιά σας {{firstName}}!",
    tags: ["birthday"],
    createdAt: new Date().toISOString(),
  },
];

function TemplatesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [templates, setTemplates] = useLocalStore<MarketingTemplate>(
    `kalypsis:marketing:templates:${user?.userId ?? "anon"}`,
    DEFAULT_TEMPLATES
  );
  const [editing, setEditing] = useState<MarketingTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = (tpl: MarketingTemplate) => setTemplates(prev => {
    const idx = prev.findIndex(p => p.id === tpl.id);
    if (idx < 0) return [tpl, ...prev];
    const next = prev.slice(); next[idx] = tpl; return next;
  });
  const remove = (id: string) => setTemplates(prev => prev.filter(x => x.id !== id));
  const duplicate = (tpl: MarketingTemplate) => setTemplates(prev => [
    { ...tpl, id: `tpl-${Date.now()}`, name: `${tpl.name} (αντίγραφο)`, createdAt: new Date().toISOString() },
    ...prev
  ]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("marketing.templates.title", "Πρότυπα μηνυμάτων")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("marketing.templates.subtitle", "Επαναχρησιμοποιήσιμα πρότυπα για email, SMS και Viber με placeholder tokens.")}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          {t("marketing.templates.new", "Νέο πρότυπο")}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {templates.length === 0 && (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed", gridColumn: "1 / -1" }}>
            {t("marketing.templates.empty", "Δεν έχετε δημιουργήσει πρότυπα.")}
          </Card>
        )}
        {templates.map(tpl => (
          <TemplateCard
            key={tpl.id}
            tpl={tpl}
            onEdit={() => setEditing(tpl)}
            onDelete={() => remove(tpl.id)}
            onDuplicate={() => duplicate(tpl)}
          />
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

function TemplateCard({ tpl, onEdit, onDelete, onDuplicate }: { tpl: MarketingTemplate; onEdit: () => void; onDelete: () => void; onDuplicate: () => void }) {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ChannelIcon channel={tpl.kind} />
            <Typography sx={{ fontWeight: 700 }}>{tpl.name}</Typography>
            <Chip size="small" variant="outlined" label={tpl.kind} />
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t("marketing.duplicate", "Αντιγραφή")}>
              <IconButton size="small" onClick={onDuplicate}><ContentCopyIcon fontSize="small" /></IconButton>
            </Tooltip>
            <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete", "Διαγραφή;"))) onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        {tpl.kind === "Email" && tpl.subject && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
            Subject: {tpl.subject}
          </Typography>
        )}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover", whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 160, overflow: "auto" }}>
          {tpl.body}
        </Paper>
        {tpl.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" gap={0.5}>
            {tpl.tags.map(tag => <Chip key={tag} size="small" label={`#${tag}`} sx={{ fontSize: 10 }} />)}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  open, template, onClose, onSave
}: { open: boolean; template: MarketingTemplate | null; onClose: () => void; onSave: (tpl: MarketingTemplate) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<MarketingTemplate>(() => template ?? {
    id: `tpl-${Date.now()}`, name: "", kind: "Email", subject: "", body: "", tags: [], createdAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (template) setForm(template);
    else if (open) setForm({ id: `tpl-${Date.now()}`, name: "", kind: "Email", subject: "", body: "", tags: [], createdAt: new Date().toISOString() });
  }, [template, open]);

  const sample: Record<string, string> = {
    firstName: "Γιώργος", lastName: "Παπαδόπουλος", customerName: "Γιώργος Παπαδόπουλος",
    companyName: "Παπαδόπουλος ΑΕ", policyNumber: "IC-2026-000123", carrier: "Interlife",
    endDate: new Date(Date.now() + 30 * 24 * 3600e3).toLocaleDateString("el-GR"),
    producer: "Α. Παπαδοπούλου", agency: "Ασφαλιστικό Γραφείο Kalypsis",
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{template ? t("common.save", "Αποθήκευση") : t("marketing.templates.new", "Νέο πρότυπο")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" }, gap: 3, mt: 1 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField required label={t("marketing.templates.name", "Όνομα")} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
              <SearchableTextField label={t("marketing.templates.kind", "Τύπος")} value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value as TemplateKind })} sx={{ width: 160 }}>
                <MenuItem value="Email">Email</MenuItem>
                <MenuItem value="SMS">SMS</MenuItem>
                <MenuItem value="Viber">Viber</MenuItem>
              </SearchableTextField>
            </Stack>
            {form.kind === "Email" && (
              <TextField label="Subject / Θέμα" value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />
            )}
            <TextField label={t("marketing.templates.body", "Κείμενο")} value={form.body} multiline rows={12}
              onChange={e => setForm({ ...form, body: e.target.value })} fullWidth />
            <TextField label="Tags (comma-separated)" value={form.tags.join(", ")}
              onChange={e => setForm({ ...form, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} fullWidth />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                {t("marketing.templates.placeholders", "Διαθέσιμα placeholders")}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mt={0.5}>
                {MARKETING_PLACEHOLDERS.map(p => (
                  <Tooltip key={p.key} title={p.desc}>
                    <Chip
                      size="small" variant="outlined" label={p.key}
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
              {t("marketing.templates.preview", "Προεπισκόπηση")}
            </Typography>
            <Paper variant="outlined" sx={{
              mt: 0.5, p: 2, minHeight: 340,
              bgcolor: form.kind === "Email" ? "#fdfdfd" : form.kind === "SMS" ? "#e8f5e9" : "#ede7f6"
            }}>
              {form.kind === "Email" && (
                <Box sx={{ mb: 1, borderBottom: 1, borderColor: "divider", pb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Subject:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {fillPlaceholders(form.subject || "—", sample)}
                  </Typography>
                </Box>
              )}
              {form.kind === "Email" ? (
                <Box sx={{ fontSize: 14 }}
                  dangerouslySetInnerHTML={{ __html: fillPlaceholders(form.body || "—", sample) }} />
              ) : (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                  {fillPlaceholders(form.body || "—", sample)}
                </Typography>
              )}
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
        <Button onClick={onClose}>{t("common.cancel", "Άκυρο")}</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim() || !form.body.trim()}>
          {t("common.save", "Αποθήκευση")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 3 — Automation rules.
// -----------------------------------------------------------------------------
const TRIGGER_LABELS: Record<RuleTrigger, { label: string; help: string; Icon: React.ComponentType<{ fontSize?: "small" | "medium" | "large" }>; color: string }> = {
  birthday:               { label: "Γενέθλια πελάτη",               help: "Στέλνει ευχές την ημέρα των γενεθλίων.",              Icon: CakeIcon,             color: "#d6336c" },
  nameDay:                { label: "Ονομαστική εορτή",              help: "Στέλνει ευχές στην ονομαστική εορτή του πελάτη.",     Icon: CelebrationIcon,      color: "#ec407a" },
  policyExpiring:         { label: "Λήξη συμβολαίου σε N ημέρες",  help: "Ενημέρωση για επικείμενη λήξη.",                     Icon: HourglassBottomIcon,  color: "#ed6c02" },
  installmentDue:         { label: "Δόση συμβολαίου σε N ημέρες",  help: "Υπενθύμιση για επόμενη δόση.",                       Icon: CreditCardIcon,       color: "#1976d2" },
  welcome:                { label: "Καλωσόρισμα νέου πελάτη",       help: "Ενεργοποιείται με τη δημιουργία νέου πελάτη.",        Icon: WavingHandIcon,       color: "#2e7d32" },
  cooperationAnniversary: { label: "Επέτειος συνεργασίας",           help: "Στέλνεται στην ετήσια επέτειο έναρξης συνεργασίας.", Icon: StarIcon,             color: "#fbc02d" },
  inactiveCustomer:       { label: "Ανενεργός πελάτης για N μήνες", help: "Επανενεργοποίηση πελατών που δεν έχουν συναλλαγή.",  Icon: BedtimeIcon,          color: "#5d4037" },
  policyIssued:           { label: "Νέο συμβόλαιο εκδόθηκε",         help: "Ευχαριστήριο μετά την έκδοση συμβολαίου.",           Icon: DescriptionIcon,      color: "#0288d1" },
};

function RulesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rules, setRules] = useLocalStore<AutomationRule>(`kalypsis:marketing:rules:${user?.userId ?? "anon"}`, []);
  const [templates] = useLocalStore<MarketingTemplate>(`kalypsis:marketing:templates:${user?.userId ?? "anon"}`, DEFAULT_TEMPLATES);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = (r: AutomationRule) => setRules(prev => {
    const idx = prev.findIndex(x => x.id === r.id);
    if (idx < 0) return [r, ...prev];
    const next = prev.slice(); next[idx] = r; return next;
  });
  const remove = (id: string) => setRules(prev => prev.filter(x => x.id !== id));
  const toggle = (r: AutomationRule) => upsert({ ...r, active: !r.active });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("marketing.rules.title", "Αυτοματισμοί & Trigger")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("marketing.rules.subtitle", "Αυτόματες αποστολές με βάση γεγονότα — γενέθλια, λήξεις, δόσεις, καλωσόρισμα.")}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          {t("marketing.rules.new", "Νέος κανόνας")}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {rules.length === 0 && (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed", gridColumn: "1 / -1" }}>
            {t("marketing.rules.empty", "Δεν έχετε δημιουργήσει κανόνες αυτοματισμού.")}
          </Card>
        )}
        {rules.map(r => {
          const meta = TRIGGER_LABELS[r.trigger];
          const tpl = templates.find(t => t.id === r.templateId);
          return (
            <Card key={r.id} variant="outlined" sx={{ opacity: r.active ? 1 : 0.55 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar sx={{ bgcolor: meta.color, width: 32, height: 32 }}>
                      <meta.Icon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{meta.label}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title={r.active ? "Ενεργός" : "Ανενεργός"}>
                      <Switch size="small" checked={r.active} onChange={() => toggle(r)} />
                    </Tooltip>
                    <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete", "Διαγραφή;"))) remove(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
                {r.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{r.description}</Typography>}
                <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                  {r.daysOffset !== 0 && (
                    <Chip size="small" variant="outlined" label={r.daysOffset > 0 ? `+${r.daysOffset} ημέρες` : `${r.daysOffset} ημέρες`} />
                  )}
                  {tpl && <Chip size="small" color="primary" variant="outlined" icon={<ChannelIcon channel={tpl.kind} />} label={tpl.name} />}
                  {r.channels.map(ch => (
                    <Chip key={ch} size="small" variant="outlined" icon={<ChannelIcon channel={ch} />} label={ch} />
                  ))}
                  <Chip size="small" color="default" label={`${r.runsCount} εκτελέσεις`} />
                </Stack>
                {r.lastRunAt && (
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
                    Τελευταία εκτέλεση: {dateTime(r.lastRunAt)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <RuleEditor
        open={creating || !!editing}
        rule={editing}
        templates={templates}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(r) => { upsert(r); setCreating(false); setEditing(null); }}
      />
    </Box>
  );
}

function RuleEditor({
  open, rule, templates, onClose, onSave
}: { open: boolean; rule: AutomationRule | null; templates: MarketingTemplate[]; onClose: () => void; onSave: (r: AutomationRule) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AutomationRule>(() => rule ?? {
    id: `rule-${Date.now()}`, name: "", description: "",
    trigger: "birthday", daysOffset: 0, templateId: templates[0]?.id ?? null,
    channels: ["Email"], audienceSegmentId: null, active: true,
    createdAt: new Date().toISOString(), lastRunAt: null, runsCount: 0,
  });
  useEffect(() => {
    if (rule) setForm(rule);
    else if (open) setForm({
      id: `rule-${Date.now()}`, name: "", description: "",
      trigger: "birthday", daysOffset: 0, templateId: templates[0]?.id ?? null,
      channels: ["Email"], audienceSegmentId: null, active: true,
      createdAt: new Date().toISOString(), lastRunAt: null, runsCount: 0,
    });
  }, [rule, open, templates]);

  const meta = TRIGGER_LABELS[form.trigger];
  const needsOffset = form.trigger === "policyExpiring" || form.trigger === "installmentDue" || form.trigger === "inactiveCustomer";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{rule ? "Επεξεργασία κανόνα" : t("marketing.rules.new", "Νέος κανόνας")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} mt={1}>
          <TextField required label="Όνομα κανόνα" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Περιγραφή" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
          <SearchableTextField label="Trigger" value={form.trigger}
            onChange={e => setForm({ ...form, trigger: e.target.value as RuleTrigger })} fullWidth
            helperText={meta.help}>
            {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                <v.Icon fontSize="small" />
                <Box component="span" sx={{ ml: 1 }}>{v.label}</Box>
              </MenuItem>
            ))}
          </SearchableTextField>
          {needsOffset && (
            <TextField
              type="number"
              label={
                form.trigger === "inactiveCustomer" ? "Μήνες αδράνειας"
                : "Ημέρες πριν το γεγονός (θετικός = μετά)"
              }
              value={form.daysOffset}
              onChange={e => setForm({ ...form, daysOffset: Number(e.target.value) })}
              helperText={
                form.trigger === "policyExpiring" ? "Αρνητικό (π.χ. -30) στέλνει 30 μέρες πριν τη λήξη."
                : form.trigger === "installmentDue" ? "Αρνητικό (π.χ. -7) στέλνει 7 μέρες πριν τη δόση."
                : "Στέλνει μετά από N μήνες αδράνειας."
              }
            />
          )}
          <SearchableTextField label="Πρότυπο μηνύματος" value={form.templateId ?? ""}
            onChange={e => setForm({ ...form, templateId: e.target.value || null })} fullWidth>
            {templates.map(tpl => (
              <MenuItem key={tpl.id} value={tpl.id}>
                {tpl.name} · {tpl.kind}
              </MenuItem>
            ))}
          </SearchableTextField>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>Κανάλια</Typography>
            <Stack direction="row" spacing={1} mt={0.5}>
              {CHANNELS.map(ch => (
                <FormControlLabel key={ch} label={<Stack direction="row" alignItems="center" spacing={0.5}><ChannelIcon channel={ch} /><span>{ch}</span></Stack>}
                  control={<Checkbox checked={form.channels.includes(ch)} onChange={e => {
                    setForm({ ...form, channels: e.target.checked ? [...form.channels, ch] : form.channels.filter(c => c !== ch) });
                  }} />} />
              ))}
            </Stack>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            <Typography>Ενεργός</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim() || !form.templateId}>
          Αποθήκευση
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 4 — Segments.
// -----------------------------------------------------------------------------
function SegmentsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [segments, setSegments] = useLocalStore<AudienceSegment>(`kalypsis:marketing:segments:${user?.userId ?? "anon"}`, DEFAULT_SEGMENTS);
  const [editing, setEditing] = useState<AudienceSegment | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = (s: AudienceSegment) => setSegments(prev => {
    const idx = prev.findIndex(x => x.id === s.id);
    if (idx < 0) return [s, ...prev];
    const next = prev.slice(); next[idx] = s; return next;
  });
  const remove = (id: string) => setSegments(prev => prev.filter(x => x.id !== id));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("marketing.segments.title", "Ακροατήρια")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("marketing.segments.subtitle", "Αποθηκευμένα φίλτρα πελατών — χρησιμοποιήστε σε καμπάνιες και κανόνες.")}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          {t("marketing.segments.new", "Νέο ακροατήριο")}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {segments.map(s => (
          <Card key={s.id} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <GroupsIcon color="primary" fontSize="small" />
                  <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" onClick={() => setEditing(s)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete", "Διαγραφή;"))) remove(s.id); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
              {s.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{s.description}</Typography>}
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {s.criteria.hasEmail  && <Chip size="small" variant="outlined" icon={<EmailIcon />} label="Με email" />}
                {s.criteria.hasPhone  && <Chip size="small" variant="outlined" icon={<SmsIcon />} label="Με τηλέφωνο" />}
                {s.criteria.hasViber  && <Chip size="small" variant="outlined" icon={<ChatIcon />} label="Στο Viber" />}
                {s.criteria.occupation && <Chip size="small" variant="outlined" label={`Επάγγελμα: ${s.criteria.occupation}`} />}
                {s.criteria.needKind   && <Chip size="small" variant="outlined" label={`Ανάγκη: ${s.criteria.needKind}`} />}
                {s.criteria.onlyUninsuredNeeds && <Chip size="small" color="warning" variant="outlined" label="Χωρίς κάλυψη" />}
                {s.criteria.expiringWithinDays != null && (
                  <Chip size="small" color="warning" variant="outlined" label={`Λήγουν σε ${s.criteria.expiringWithinDays}d`} />
                )}
                {s.criteria.unpaidBalance && <Chip size="small" color="error" variant="outlined" label="Με οφειλή" />}
                {s.criteria.consentRequired && <Chip size="small" color="success" variant="outlined" label="Με συγκατάθεση" />}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="text.secondary">Εκτιμώμενοι παραλήπτες</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
                  ~{s.estimatedCount.toLocaleString("el-GR")}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      <SegmentEditor
        open={creating || !!editing}
        segment={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(s) => { upsert(s); setCreating(false); setEditing(null); }}
      />
    </Box>
  );
}

const DEFAULT_SEGMENTS: AudienceSegment[] = [
  {
    id: "seg-all-email", name: "Όλοι με email", description: "Πελάτες με ενεργή διεύθυνση email και συγκατάθεση.",
    criteria: { hasEmail: true, hasPhone: false, hasViber: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: null, unpaidBalance: false, consentRequired: true },
    estimatedCount: 0, createdAt: new Date().toISOString()
  },
  {
    id: "seg-expiring-30", name: "Λήγουν σε 30 μέρες", description: "Πελάτες με συμβόλαιο που λήγει το επόμενο μήνα.",
    criteria: { hasEmail: false, hasPhone: false, hasViber: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: 30, unpaidBalance: false, consentRequired: true },
    estimatedCount: 0, createdAt: new Date().toISOString()
  },
];

function SegmentEditor({
  open, segment, onClose, onSave
}: { open: boolean; segment: AudienceSegment | null; onClose: () => void; onSave: (s: AudienceSegment) => void }) {
  const [form, setForm] = useState<AudienceSegment>(() => segment ?? {
    id: `seg-${Date.now()}`, name: "", description: "",
    criteria: { hasEmail: false, hasPhone: false, hasViber: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: null, unpaidBalance: false, consentRequired: true },
    estimatedCount: 0, createdAt: new Date().toISOString(),
  });
  useEffect(() => {
    if (segment) setForm(segment);
    else if (open) setForm({
      id: `seg-${Date.now()}`, name: "", description: "",
      criteria: { hasEmail: false, hasPhone: false, hasViber: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: null, unpaidBalance: false, consentRequired: true },
      estimatedCount: 0, createdAt: new Date().toISOString(),
    });
  }, [segment, open]);

  const setC = (patch: Partial<AudienceSegment["criteria"]>) =>
    setForm(f => ({ ...f, criteria: { ...f.criteria, ...patch } }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{segment ? "Επεξεργασία ακροατηρίου" : "Νέο ακροατήριο"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField required label="Όνομα" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Περιγραφή" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
          <Divider>Επικοινωνία</Divider>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <FormControlLabel label="Έχει email" control={<Checkbox checked={form.criteria.hasEmail} onChange={e => setC({ hasEmail: e.target.checked })} />} />
            <FormControlLabel label="Έχει τηλέφωνο" control={<Checkbox checked={form.criteria.hasPhone} onChange={e => setC({ hasPhone: e.target.checked })} />} />
            <FormControlLabel label="Στο Viber" control={<Checkbox checked={form.criteria.hasViber} onChange={e => setC({ hasViber: e.target.checked })} />} />
            <FormControlLabel label="Με συγκατάθεση marketing" control={<Checkbox checked={form.criteria.consentRequired} onChange={e => setC({ consentRequired: e.target.checked })} />} />
          </Stack>
          <Divider>Χαρακτηριστικά</Divider>
          <TextField label="Επάγγελμα / κλάδος" value={form.criteria.occupation}
            onChange={e => setC({ occupation: e.target.value })} fullWidth />
          <SearchableTextField label="Ανάγκη / περιουσία" value={form.criteria.needKind}
            onChange={e => setC({ needKind: e.target.value })} fullWidth>
            <MenuItem value="">Όλες</MenuItem>
            {NEED_KINDS.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </SearchableTextField>
          <FormControlLabel label="Μόνο πελάτες χωρίς ενεργή κάλυψη σε αυτή την ανάγκη"
            control={<Switch checked={form.criteria.onlyUninsuredNeeds} disabled={!form.criteria.needKind} onChange={e => setC({ onlyUninsuredNeeds: e.target.checked })} />} />
          <Divider>Χρονικά</Divider>
          <TextField type="number" label="Συμβόλαιο λήγει σε (ημέρες)" value={form.criteria.expiringWithinDays ?? ""}
            onChange={e => setC({ expiringWithinDays: e.target.value ? Number(e.target.value) : null })} fullWidth
            helperText="Κενό = ανεξάρτητα από λήξη." />
          <FormControlLabel label="Έχει οφειλή" control={<Checkbox checked={form.criteria.unpaidBalance} onChange={e => setC({ unpaidBalance: e.target.checked })} />} />
          <TextField type="number" label="Εκτιμώμενοι παραλήπτες" value={form.estimatedCount}
            onChange={e => setForm({ ...form, estimatedCount: Math.max(0, Number(e.target.value)) })} fullWidth
            helperText="Θα ενημερώνεται αυτόματα όταν συνδεθεί με το backend." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim()}>Αποθήκευση</Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 5 — Sent history.
// -----------------------------------------------------------------------------
function HistoryTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [log] = useLocalStore<SendLogEntry>(`kalypsis:marketing:log:${user?.userId ?? "anon"}`, []);
  const [filterChannel, setFilterChannel] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const filtered = useMemo(() =>
    log.filter(l =>
      (!filterChannel || l.channel === filterChannel) &&
      (!filterStatus  || l.status === filterStatus)),
    [log, filterChannel, filterStatus]);

  const total = log.length;
  const delivered = log.filter(l => l.status === "Delivered" || l.status === "Opened" || l.status === "Clicked").length;
  const opened = log.filter(l => l.status === "Opened" || l.status === "Clicked").length;
  const clicked = log.filter(l => l.status === "Clicked").length;
  const bounced = log.filter(l => l.status === "Bounced" || l.status === "Failed").length;
  const totalCost = log.reduce((s, l) => s + l.cost, 0);

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
        <Kpi label="Συνολικά" value={total} icon={<SendIcon />} />
        <Kpi label="Παραδόθηκαν" value={delivered} color="#2e7d32" icon={<CheckCircleIcon />} />
        <Kpi label="Opens" value={opened} color="#ed6c02" icon={<EmailIcon />} />
        <Kpi label="Clicks" value={clicked} color="#9c27b0" icon={<BoltIcon />} />
        <Kpi label="Bounce/Failed" value={bounced} color="#d32f2f" icon={<ErrorIcon />} />
        <Kpi label="Συνολικό κόστος" value={totalCost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })} />
      </Stack>

      <Stack direction="row" spacing={1} mb={2}>
        <SearchableTextField label="Κανάλι" value={filterChannel} onChange={e => setFilterChannel(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="">Όλα</MenuItem>
          {CHANNELS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </SearchableTextField>
        <SearchableTextField label="Κατάσταση" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={{ width: 200 }}>
          <MenuItem value="">Όλες</MenuItem>
          {["Delivered", "Opened", "Clicked", "Bounced", "Failed", "Unsubscribed"].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </SearchableTextField>
      </Stack>

      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ώρα</TableCell>
              <TableCell>Καμπάνια</TableCell>
              <TableCell>Παραλήπτης</TableCell>
              <TableCell>Κανάλι</TableCell>
              <TableCell>Πρότυπο</TableCell>
              <TableCell>{t("common.status", "Κατάσταση")}</TableCell>
              <TableCell align="right">Κόστος</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  {log.length === 0 ? "Δεν έχουν καταγραφεί αποστολές." : "Δεν υπάρχουν αποτελέσματα με τα επιλεγμένα φίλτρα."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map(l => (
              <TableRow key={l.id} hover>
                <TableCell>{dateTime(l.sentAt)}</TableCell>
                <TableCell>{l.campaignName}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{l.recipientName}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{l.recipientContact}</Typography>
                </TableCell>
                <TableCell><ChannelIcon channel={l.channel} /></TableCell>
                <TableCell>{l.templateName}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={l.status === "Failed" || l.status === "Bounced" ? "error"
                          : l.status === "Delivered" || l.status === "Opened" || l.status === "Clicked" ? "success"
                          : "default"}
                    label={l.status}
                  />
                </TableCell>
                <TableCell align="right">{l.cost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Επαναποστολή">
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

// -----------------------------------------------------------------------------
// Tab 6 — Providers with quota + overage calculator.
// -----------------------------------------------------------------------------
const DEFAULT_MARKETING_PROVIDERS: MarketingProvider[] = [
  { id: "mprov-brevo",  name: "Brevo (Email)",   kind: "Email", monthlyQuota: 3000, usedThisMonth: 1240, unitCostExtra: 0.001, senderId: "no-reply@kalypsis.gr", apiKey: "", active: true },
  { id: "mprov-twilio", name: "Twilio (SMS)",    kind: "SMS",   monthlyQuota: 2000, usedThisMonth: 1750, unitCostExtra: 0.045, senderId: "KALYPSIS",             apiKey: "", active: true },
  { id: "mprov-viber",  name: "Viber Business",  kind: "Viber", monthlyQuota: 1000, usedThisMonth: 480,  unitCostExtra: 0.015, senderId: "Kalypsis",             apiKey: "", active: false },
];

function ProvidersTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [providers, setProviders] = useLocalStore<MarketingProvider>(
    `kalypsis:marketing:providers:${user?.userId ?? "anon"}`,
    DEFAULT_MARKETING_PROVIDERS
  );
  const [editing, setEditing] = useState<MarketingProvider | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = (p: MarketingProvider) => setProviders(prev => {
    const idx = prev.findIndex(x => x.id === p.id);
    if (idx < 0) return [p, ...prev];
    const next = prev.slice(); next[idx] = p; return next;
  });
  const remove = (id: string) => setProviders(prev => prev.filter(x => x.id !== id));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("marketing.providers.title", "Πάροχοι αποστολής")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("marketing.providers.subtitle", "Ρύθμιση παρόχων email / SMS / Viber, όρια χρήσης και υπολογιστής επιπλέον χρέωσης.")}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          {t("marketing.providers.new", "Νέος πάροχος")}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, mb: 3 }}>
        {providers.map(p => <ProviderCard key={p.id} p={p} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} onToggle={() => upsert({ ...p, active: !p.active })} />)}
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

function ProviderCard({ p, onEdit, onDelete, onToggle }: { p: MarketingProvider; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
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
            <ChannelIcon channel={p.kind} />
            <Typography sx={{ fontWeight: 800 }}>{p.name}</Typography>
            <Chip size="small" variant="outlined" label={p.kind} />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Switch size="small" checked={p.active} onChange={onToggle} />
            <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete", "Διαγραφή;"))) onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="baseline" spacing={1} mb={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>{p.usedThisMonth.toLocaleString("el-GR")}</Typography>
          <Typography variant="body2" color="text.secondary">/ {p.monthlyQuota.toLocaleString("el-GR")} μηνιαία</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={usedPct} color={color} sx={{ height: 10, borderRadius: 1, mb: 1 }} />
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5}>
          <Chip size="small" color={color}
            label={state === "ok" ? "Εντός ορίου" : state === "near" ? "Πλησιάζει" : "Υπέρβαση"} />
          {state !== "over" && <Typography variant="caption" color="text.secondary">{remaining.toLocaleString("el-GR")} απομένουν</Typography>}
          {overCount > 0 && (
            <Typography variant="caption" color="error.main" sx={{ fontWeight: 700 }}>
              +{overCount.toLocaleString("el-GR")} · {overCost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function OverageCalculator({ providers }: { providers: MarketingProvider[] }) {
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
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <CalculateIcon color="primary" />
        <Box>
          <Typography sx={{ fontWeight: 800 }}>Υπολογιστής επιπλέον χρέωσης</Typography>
          <Typography variant="caption" color="text.secondary">Εκτίμηση κόστους αν χρειαστείτε περισσότερα μηνύματα από το όριο.</Typography>
        </Box>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr 1fr" }, gap: 2, alignItems: "center" }}>
        <SearchableTextField label="Πάροχος" value={providerId} onChange={e => setProviderId(e.target.value)}>
          {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name} · {p.kind}</MenuItem>)}
        </SearchableTextField>
        <TextField type="number" label="Αναμενόμενες αποστολές μήνα" value={expected}
          onChange={e => setExpected(Math.max(0, Number(e.target.value)))} inputProps={{ min: 0 }} />
        <Box>
          <Typography variant="caption" color="text.secondary">Επιπλέον από το όριο</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: extra > 0 ? "error.main" : "text.primary" }}>
            {extra.toLocaleString("el-GR")}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Επιπλέον χρέωση</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: cost > 0 ? "error.main" : "success.main" }}>
            {cost.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}
          </Typography>
        </Box>
      </Box>
      {extra > 0 && (
        <Stack direction="row" spacing={1} mt={2}>
          <Button variant="outlined" size="small" color="warning">Αγορά επιπλέον πακέτου</Button>
        </Stack>
      )}
    </Card>
  );
}

function ProviderEditor({
  open, provider, onClose, onSave
}: { open: boolean; provider: MarketingProvider | null; onClose: () => void; onSave: (p: MarketingProvider) => void }) {
  const [form, setForm] = useState<MarketingProvider>(() => provider ?? {
    id: `mprov-${Date.now()}`, name: "", kind: "Email", monthlyQuota: 1000, usedThisMonth: 0, unitCostExtra: 0.001, senderId: "", apiKey: "", active: true
  });
  useEffect(() => {
    if (provider) setForm(provider);
    else if (open) setForm({
      id: `mprov-${Date.now()}`, name: "", kind: "Email", monthlyQuota: 1000, usedThisMonth: 0, unitCostExtra: 0.001, senderId: "", apiKey: "", active: true
    });
  }, [provider, open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{provider ? "Επεξεργασία παρόχου" : "Νέος πάροχος"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label="Όνομα" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
            <SearchableTextField label="Τύπος" value={form.kind}
              onChange={e => setForm({ ...form, kind: e.target.value as ProviderKind })} sx={{ width: 160 }}>
              <MenuItem value="Email">Email</MenuItem>
              <MenuItem value="SMS">SMS</MenuItem>
              <MenuItem value="Viber">Viber</MenuItem>
            </SearchableTextField>
          </Stack>
          <TextField label="Sender ID / From address" value={form.senderId}
            onChange={e => setForm({ ...form, senderId: e.target.value })} fullWidth />
          <TextField label="API Key" value={form.apiKey}
            onChange={e => setForm({ ...form, apiKey: e.target.value })} type="password" fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label="Μηνιαίο όριο" value={form.monthlyQuota}
              onChange={e => setForm({ ...form, monthlyQuota: Math.max(0, Number(e.target.value)) })} fullWidth />
            <TextField type="number" label="Χρήση μήνα" value={form.usedThisMonth}
              onChange={e => setForm({ ...form, usedThisMonth: Math.max(0, Number(e.target.value)) })} fullWidth />
            <TextField type="number" label="€ ανά επιπλέον" value={form.unitCostExtra}
              onChange={e => setForm({ ...form, unitCostExtra: Math.max(0, Number(e.target.value)) })} inputProps={{ step: 0.001 }} fullWidth />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            <Typography>Ενεργός</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim()}>Αποθήκευση</Button>
      </DialogActions>
    </Dialog>
  );
}
