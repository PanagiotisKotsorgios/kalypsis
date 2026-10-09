import { useEffect, useMemo, useRef, useState } from "react";
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
import BoltIcon from "@mui/icons-material/Bolt";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CakeIcon from "@mui/icons-material/Cake";
import CelebrationIcon from "@mui/icons-material/Celebration";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import WavingHandIcon from "@mui/icons-material/WavingHand";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import StarIcon from "@mui/icons-material/Star";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import DescriptionIcon from "@mui/icons-material/Description";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import LinkIcon from "@mui/icons-material/Link";
import VisibilityIcon from "@mui/icons-material/Visibility";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { dateTime } from "../utils/format";
import { HelpHint } from "../components/HelpHint";
import { SearchableTextField } from "../components/SearchableTextField";
import { DataExportButton } from "../components/DataExportButton";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

/* =============================================================================
   Marketing & Καμπάνιες — full-scale engine.

   Seven-tab shell:
     0) Πίνακας   — KPIs + upcoming schedule + quick actions
     1) Καμπάνιες — real backend campaigns (/marketing-campaigns)
     2) Πρότυπα   — reusable Email/SMS templates with live preview
     3) Κανόνες   — automation triggers (birthdays, expiring policies, welcome…)
     4) Ακροατήρια — reusable customer segments with saved filters
     5) Ιστορικό  — sent-log audit trail per recipient
     6) Ρυθμίσεις — email/SMS providers with quota bars + calculator

   Campaigns, delivery history, office templates and automation rules are
   backend-backed and tenant-scoped. Audience segments remain a lightweight
   browser-side editor for compatibility; durable smart audiences are stored as
   CRM groups and previewed through the server API. Legacy provider display
   metadata is also kept tenant-keyed so offices never share browser state.
   ========================================================================= */

// -----------------------------------------------------------------------------
// Backend types (for /marketing-campaigns).
// -----------------------------------------------------------------------------
const STATUSES = ["Draft", "Scheduled", "Sent"] as const;
type Status = typeof STATUSES[number];
const SEGMENTS = ["all", "expiring", "with_email"] as const;
type Segment = string;
const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"] as const;
const CHANNELS = ["Email", "Sms"] as const;
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
interface CrmOverview {
  customers: number; activeCustomers: number; producers: number; activePolicies: number;
  policiesExpiring30Days: number; openClaims: number; openTasks: number; tasksDueToday: number;
  openOpportunities: number; pipelineValue: number; campaignsLast30Days: number;
  deliveriesLast30Days: number; failedDeliveriesLast30Days: number; emailOptOuts: number;
  smsOptOuts: number; generatedAt: string;
}

const EMPTY_CAMPAIGN: CampaignForm = {
  name: "", subject: "", bodyHtml: "", smsBody: "", viberBody: "", channels: ["Email"],
  segmentKey: "all", occupationFilter: "", needKindFilter: "", onlyUninsuredNeeds: false,
  status: "Draft", scheduledFor: ""
};

// -----------------------------------------------------------------------------
// Locally-persisted shapes.
// -----------------------------------------------------------------------------
type TemplateKind = "Email" | "SMS";
interface MarketingTemplate {
  id: string; name: string; kind: TemplateKind;
  subject: string; body: string;
  tags: string[]; createdAt: string;
}

interface OfficeTemplateDto {
  id: string; code: string; name: string; subject: string; bodyHtml: string;
  bodyPlain?: string | null; language: string; isSystem: boolean; isActive: boolean;
  policyTrigger?: string | null; smsBody?: string | null;
}

interface WorkflowRuleDto {
  id: string; name: string; triggerEvent: string | number; isActive: boolean; priority: number;
  conditionsJson?: string | null; actions: Array<{ id: string; action: string | number; order: number; payloadJson: string }>;
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
    hasEmail: boolean; hasPhone: boolean;
    occupation: string; needKind: string; onlyUninsuredNeeds: boolean;
    expiringWithinDays: number | null;
    unpaidBalance: boolean;
    consentRequired: boolean;
  };
  estimatedCount: number;
  memberIds?: string[];
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

type ProviderKind = "Email" | "SMS";
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

function marketingScope(user: { tenantId: string | null; userId: string } | null | undefined): string {
  return user?.tenantId ?? user?.userId ?? "anon";
}

// -----------------------------------------------------------------------------
// Root page — tabbed shell.
// -----------------------------------------------------------------------------
export function MarketingCampaignsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("kalypsis:marketing:tab") ?? "0");
      return Number.isFinite(v) && v >= 0 && v <= 7 ? v : 0;
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
        <Tab icon={<TrendingUpIcon fontSize="small" />} iconPosition="start" label="Ευκαιρίες / Pipeline" />
      </Tabs>

      {tab === 0 && <DashboardTab />}
      {tab === 1 && <CampaignsTab />}
      {tab === 2 && <TemplatesTab />}
      {tab === 3 && <RulesTab />}
      {tab === 4 && <SegmentsTab />}
      {tab === 5 && <HistoryTabBackend />}
      {tab === 6 && <ProvidersTab />}
      {tab === 7 && <OpportunitiesTab />}
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
  }
}

function fillPlaceholders(text: string, sample: Record<string, string>): string {
  return text.replace(/\{\{?(\w+)\}?\}/g, (_, k) => sample[k] ?? `{{${k}}}`);
}

/** Small dependency-free rich editor used by campaigns and email templates.
 * It stores the same HTML that is rendered in the preview, so operators never
 * have to edit markup such as <p> or <strong> by hand. */
function RichTextEditor({ label, value, onChange, helperText }: {
  label: string; value: string; onChange: (value: string) => void; helperText?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);
  const command = (name: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, argument);
    onChange(editorRef.current?.innerHTML ?? "");
  };
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 700 }}>{label}</Typography>
      <Stack direction="row" spacing={0.25} sx={{ p: 0.5, border: 1, borderColor: "divider", borderBottom: 0, borderRadius: "4px 4px 0 0", bgcolor: "action.hover" }}>
        <IconButton size="small" title="Έντονα" onMouseDown={keepFocus} onClick={() => command("bold")}><FormatBoldIcon fontSize="small" /></IconButton>
        <IconButton size="small" title="Πλάγια" onMouseDown={keepFocus} onClick={() => command("italic")}><FormatItalicIcon fontSize="small" /></IconButton>
        <IconButton size="small" title="Υπογράμμιση" onMouseDown={keepFocus} onClick={() => command("underline")}><FormatUnderlinedIcon fontSize="small" /></IconButton>
        <IconButton size="small" title="Λίστα" onMouseDown={keepFocus} onClick={() => command("insertUnorderedList")}><FormatListBulletedIcon fontSize="small" /></IconButton>
        <IconButton size="small" title="Σύνδεσμος" onMouseDown={keepFocus} onClick={() => {
          const url = window.prompt("URL συνδέσμου");
          if (url) command("createLink", url);
        }}><LinkIcon fontSize="small" /></IconButton>
      </Stack>
      <Box
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange(e.currentTarget.innerHTML)}
        sx={{ minHeight: 220, p: 1.5, border: 1, borderColor: "divider", borderRadius: "0 0 4px 4px", outline: "none", overflow: "auto", bgcolor: "background.paper", "&:focus": { borderColor: "primary.main" }, "& p": { my: 0.75 }, "& strong": { fontWeight: 800 } }}
      />
      {helperText && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{helperText}</Typography>}
    </Box>
  );
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
  const deliveryQ = useQuery({
    queryKey: ["crm-dashboard-deliveries"],
    queryFn: async () => (await api.get<DeliveryLogDto[]>("/marketing-campaigns/deliveries", { params: { from: new Date(Date.now() - 30 * 24 * 3600e3).toISOString() } })).data,
    staleTime: 60_000,
  });
  const overviewQ = useQuery({
    queryKey: ["crm-overview"],
    queryFn: async () => (await api.get<CrmOverview>("/crm/overview")).data,
    staleTime: 60_000,
  });
  const { user } = useAuth();
  const scope = marketingScope(user);
  const [rules] = useLocalStore<AutomationRule>(`kalypsis:marketing:rules:${scope}`, []);
  const [legacyLog] = useLocalStore<SendLogEntry>(`kalypsis:marketing:log:${scope}`, []);
  const [statsOpen, setStatsOpen] = useState(false);

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
  const deliveryRows = deliveryQ.data ?? [];
  const openCount = deliveryRows.filter(l => l.openedAt || l.clickedAt || l.status === "Opened" || l.status === "Clicked").length;
  const clickCount = deliveryRows.filter(l => l.clickedAt || l.status === "Clicked").length;
  const openPct = deliveryRows.length > 0 ? Math.round((openCount / deliveryRows.length) * 100) : 0;
  const clickPct = deliveryRows.length > 0 ? Math.round((clickCount / deliveryRows.length) * 100) : 0;

  const activeCampaigns = campaigns.filter(c => c.status !== "Sent").length;
  const scheduled = campaigns
    .filter(c => c.status === "Scheduled" && c.scheduledFor)
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
  const activeRules = rules.filter(r => r.active).length;

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <Button variant="outlined" startIcon={<BarChartIcon />} onClick={() => setStatsOpen(true)} sx={{ borderColor: "#0b5cad", color: "#0b5cad", fontWeight: 800 }}>
          Στατιστικά & εικόνα γραφείου
        </Button>
      </Stack>

      {overviewQ.data && <>
        <Alert severity={overviewQ.data.failedDeliveriesLast30Days > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
          Αποστολές τελευταίων 30 ημερών: {overviewQ.data.deliveriesLast30Days} · αποτυχημένες/παραλειφθείσες: {overviewQ.data.failedDeliveriesLast30Days} · λήξεις προς ενέργεια: {overviewQ.data.policiesExpiring30Days}.
        </Alert>
      </>}

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
            {deliveryRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center", fontStyle: "italic" }}>
                {deliveryQ.isLoading ? "Φόρτωση πραγματικού ιστορικού…" : (legacyLog.length > 0 ? "Οι παλαιές τοπικές εγγραφές δεν χρησιμοποιούνται πλέον· οι νέες αποστολές θα εμφανιστούν εδώ." : t("marketing.activityEmpty", "Δεν έχουν καταγραφεί αποστολές."))}
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {deliveryRows.slice(0, 8).map(l => (
                  <Stack key={l.id} direction="row" alignItems="center" spacing={1}>
                    <ChannelIcon channel={l.channel as Channel} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.recipientName || l.customerName || l.recipient}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{dateTime(l.sentAt)}</Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={l.status === "Failed" || l.status === "Bounced" ? "error" : ["Sent", "Delivered", "Opened", "Clicked"].includes(l.status) ? "success" : "default"}
                      label={l.status}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>

      <MarketingStatsDialog
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        sentThisMonth={sentThisMonth}
        deliveryPct={deliveryPct}
        openPct={openPct}
        clickPct={clickPct}
        activeCampaigns={activeCampaigns}
        activeRules={activeRules}
        overview={overviewQ.data}
      />
    </Box>
  );
}

function MarketingStatsDialog({
  open, onClose, sentThisMonth, deliveryPct, openPct, clickPct, activeCampaigns, activeRules, overview
}: {
  open: boolean; onClose: () => void; sentThisMonth: number; deliveryPct: number; openPct: number; clickPct: number;
  activeCampaigns: number; activeRules: number; overview?: CrmOverview;
}) {
  const campaignStats = [
    { name: "Στάλθηκαν", value: sentThisMonth, color: "#1976d2" },
    { name: "Παραδόθηκαν", value: deliveryPct, color: "#2e7d32" },
    { name: "Άνοιγμα", value: openPct, color: "#ed6c02" },
    { name: "Κλικ", value: clickPct, color: "#9c27b0" },
    { name: "Καμπάνιες", value: activeCampaigns, color: "#546e7a" },
    { name: "Αυτοματισμοί", value: activeRules, color: "#673ab7" },
  ];
  const officeStats = overview ? [
    { name: "Πελάτες", value: overview.activeCustomers, color: "#0b5cad" },
    { name: "Συμβόλαια", value: overview.activePolicies, color: "#1976d2" },
    { name: "Λήξεις 30ημ.", value: overview.policiesExpiring30Days, color: "#ed6c02" },
    { name: "Εργασίες", value: overview.openTasks, color: "#9c27b0" },
    { name: "Ζημιές", value: overview.openClaims, color: "#d32f2f" },
    { name: "Ευκαιρίες", value: overview.openOpportunities, color: "#2e7d32" },
  ] : [];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Stack direction="row" alignItems="center" spacing={1}><BarChartIcon color="primary" /><span>Στατιστικά CRM</span></Stack>
          <Typography variant="body2" color="text.secondary">Περάστε τον δείκτη πάνω από τα γραφήματα για αναλυτικές τιμές.</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Αποστολές και απόδοση τελευταίων 30 ημερών</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" }, gap: 1.2, mb: 2.5 }}>
          <Kpi label="Στάλθηκαν 30d" value={sentThisMonth.toLocaleString("el-GR")} color="#1976d2" icon={<SendIcon />} />
          <Kpi label="Παραδόθηκαν" value={`${deliveryPct}%`} color="#2e7d32" icon={<CheckCircleIcon />} />
          <Kpi label="Άνοιγμα" value={`${openPct}%`} color="#ed6c02" icon={<EmailIcon />} />
          <Kpi label="Κλικ" value={`${clickPct}%`} color="#9c27b0" icon={<BoltIcon />} />
          <Kpi label="Ενεργές καμπάνιες" value={activeCampaigns} icon={<CampaignIcon />} />
          <Kpi label="Ενεργοί αυτοματισμοί" value={activeRules} color="#673ab7" icon={<AutoAwesomeMotionIcon />} />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
          <MarketingChartPanel title="Απόδοση επικοινωνιών" subtitle="Ποσοστά και πλήθος ανά δείκτη">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={campaignStats}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><ChartTooltip /><Bar dataKey="value" name="Τιμή" radius={[5, 5, 0, 0]}>{campaignStats.map(item => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer>
          </MarketingChartPanel>
          <MarketingChartPanel title="Εικόνα γραφείου" subtitle="Κύριοι δείκτες λειτουργίας">
            {officeStats.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν διαθέσιμα δεδομένα γραφείου.</Typography> : <ResponsiveContainer width="100%" height="100%"><BarChart data={officeStats}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><ChartTooltip /><Bar dataKey="value" name="Πλήθος" radius={[5, 5, 0, 0]}>{officeStats.map(item => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer>}
          </MarketingChartPanel>
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onClose} color="error" variant="contained">Κλείσιμο</Button></DialogActions>
    </Dialog>
  );
}

function MarketingChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2, minWidth: 0 }}><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography><Typography variant="caption" color="text.secondary">{subtitle}</Typography><Box sx={{ height: 260, mt: 1 }}>{children}</Box></Card>;
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
  const editing = !!item;
  const [form, setForm] = useState<CampaignForm>({ ...EMPTY_CAMPAIGN });
  const [err, setErr] = useState<string | null>(null);

  const officeTemplates = useQuery({ queryKey: ["crm-office-templates"], queryFn: async () => (await api.get<OfficeTemplateDto[]>("/email-templates")).data, enabled: open });
  const persistedTemplates: MarketingTemplate[] = (officeTemplates.data ?? []).map(tpl => {
    const sms = tpl.code.toLowerCase().startsWith("sms:");
    return { id: tpl.id, name: tpl.name, kind: sms ? "SMS" : "Email", subject: tpl.subject,
      body: sms ? (tpl.smsBody || tpl.bodyHtml) : tpl.bodyHtml, tags: tpl.policyTrigger ? [tpl.policyTrigger] : [], createdAt: "" };
  });
  const templates = persistedTemplates.length > 0 ? persistedTemplates : DEFAULT_TEMPLATES;
  const groupsQ = useQuery({
    queryKey: ["crm-groups", "Customer"],
    queryFn: async () => (await api.get<Array<{ id: string; name: string; entityType: string; memberCount: number }>>("/crm/groups", { params: { entityType: "Customer" } })).data,
    enabled: open,
  });

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
              {(groupsQ.data ?? []).map(group => <MenuItem key={`group:${group.id}`} value={`group:${group.id}`}>Ομάδα: {group.name} ({group.memberCount})</MenuItem>)}
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
          <RichTextEditor
            label={t("marketing.bodyHtml", "Κείμενο email")}
            value={form.bodyHtml}
            onChange={bodyHtml => setForm({ ...form, bodyHtml })}
            helperText="Μορφοποιήστε το κείμενο με τα κουμπιά. Η προεπισκόπηση εμφανίζει ακριβώς το τελικό email."
          />
          <TextField label="Κείμενο SMS (προαιρετικό)" multiline rows={3} value={form.smsBody ?? ""}
            onChange={e => setForm({ ...form, smsBody: e.target.value })} fullWidth
            helperText={`${(form.smsBody ?? "").length} χαρακτήρες`} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained">{t("common.cancel", "Άκυρο")}</Button>
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
  const qc = useQueryClient();
  const templatesQuery = useQuery({ queryKey: ["crm-office-templates"], queryFn: async () => (await api.get<OfficeTemplateDto[]>("/email-templates")).data });
  const persistedTemplates: MarketingTemplate[] = (templatesQuery.data ?? []).map(tpl => {
    const sms = tpl.code.toLowerCase().startsWith("sms:");
    return { id: tpl.id, name: tpl.name, kind: sms ? "SMS" : "Email",
      subject: tpl.subject, body: sms ? (tpl.smsBody || tpl.bodyHtml) : tpl.bodyHtml,
      tags: tpl.policyTrigger ? [tpl.policyTrigger] : [], createdAt: new Date().toISOString() };
  });
  const templates = persistedTemplates.length > 0 ? persistedTemplates : DEFAULT_TEMPLATES;
  // Remove the retired Viber option from templates created in older builds.
  const [editing, setEditing] = useState<MarketingTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = async (tpl: MarketingTemplate) => {
    const existing = templatesQuery.data?.find(x => x.id === tpl.id);
    const body = { code: existing?.code ?? `${tpl.kind === "SMS" ? "sms" : "email"}:${Date.now()}`,
      name: tpl.name, subject: tpl.subject || tpl.name, bodyHtml: tpl.body,
      bodyPlain: tpl.body.replace(/<[^>]+>/g, ""), language: "el", isActive: true,
      policyTrigger: tpl.tags[0] || null, smsBody: tpl.kind === "SMS" ? tpl.body : null };
    if (existing) await api.put(`/email-templates/${tpl.id}`, body);
    else await api.post("/email-templates", body);
    await qc.invalidateQueries({ queryKey: ["crm-office-templates"] });
  };
  const remove = async (id: string) => { await api.delete(`/email-templates/${id}`); await qc.invalidateQueries({ queryKey: ["crm-office-templates"] }); };
  const duplicate = async (tpl: MarketingTemplate) => upsert({ ...tpl, id: `tpl-${Date.now()}`, name: `${tpl.name} (αντίγραφο)` });
  /* legacy local implementation intentionally removed */
  /*
    { ...tpl, id: `tpl-${Date.now()}`, name: `${tpl.name} (αντίγραφο)`, createdAt: new Date().toISOString() },
    ...prev
  ]);
  */

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("marketing.templates.title", "Πρότυπα μηνυμάτων")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("marketing.templates.subtitle", "Επαναχρησιμοποιήσιμα πρότυπα για email και SMS με placeholder tokens.")}
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
        onSave={async (tpl) => { await upsert(tpl); setCreating(false); setEditing(null); }}
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
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover", whiteSpace: tpl.kind === "Email" ? "normal" : "pre-wrap", fontSize: 13, maxHeight: 160, overflow: "auto" }}>
          {tpl.kind === "Email" ? <Box dangerouslySetInnerHTML={{ __html: tpl.body }} /> : tpl.body}
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
              </SearchableTextField>
            </Stack>
            {form.kind === "Email" && (
              <TextField label="Subject / Θέμα" value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />
            )}
            {form.kind === "Email" ? (
              <RichTextEditor
                label={t("marketing.templates.body", "Κείμενο email")}
                value={form.body}
                onChange={body => setForm({ ...form, body })}
                helperText="Η προεπισκόπηση δεξιά δείχνει το email όπως θα το δει ο παραλήπτης."
              />
            ) : (
              <TextField label={t("marketing.templates.body", "Κείμενο")} value={form.body} multiline rows={12}
                onChange={e => setForm({ ...form, body: e.target.value })} fullWidth />
            )}
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
        <Button onClick={onClose} color="error" variant="contained">{t("common.cancel", "Άκυρο")}</Button>
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

const WORKFLOW_EVENTS: Record<RuleTrigger, string> = {
  birthday: "CustomerBirthday", nameDay: "CustomerNameDay", policyExpiring: "PolicyAboutToExpire",
  installmentDue: "InstallmentDue", welcome: "CustomerCreated", cooperationAnniversary: "CooperationAnniversary",
  inactiveCustomer: "CustomerInactive", policyIssued: "PolicyIssued",
};

function workflowToMarketingRule(row: WorkflowRuleDto): AutomationRule {
  let conditions: Record<string, unknown> = {};
  try { conditions = row.conditionsJson ? JSON.parse(row.conditionsJson) as Record<string, unknown> : {}; } catch { /* legacy malformed condition */ }
  const firstAction = row.actions?.slice().sort((a, b) => a.order - b.order)[0];
  let payload: Record<string, unknown> = {};
  try { payload = firstAction?.payloadJson ? JSON.parse(firstAction.payloadJson) as Record<string, unknown> : {}; } catch { /* ignore */ }
  const eventName = String(row.triggerEvent);
  const numericEvents: Record<string, RuleTrigger> = { "2": "policyIssued", "3": "policyExpiring", "6": "installmentDue", "13": "birthday", "14": "nameDay", "15": "inactiveCustomer", "16": "cooperationAnniversary" };
  const trigger = (Object.entries(WORKFLOW_EVENTS).find(([, value]) => value === eventName)?.[0]
    ?? numericEvents[eventName] ?? "welcome") as RuleTrigger;
  const channels = (row.actions ?? []).map(a => String(a.action).toLowerCase().includes("sms") ? "Sms" as Channel : "Email" as Channel);
  return { id: row.id, name: row.name, description: String(conditions.description ?? ""), trigger,
    daysOffset: Number(conditions.daysOffset ?? 0), templateId: String(payload.templateId ?? "") || null,
    channels: channels.length ? Array.from(new Set(channels)) : ["Email"], audienceSegmentId: String(conditions.audienceSegmentId ?? "") || null,
    active: row.isActive, createdAt: new Date().toISOString(), lastRunAt: null, runsCount: 0 };
}

function marketingRuleBody(rule: AutomationRule) {
  return { name: rule.name, triggerEvent: WORKFLOW_EVENTS[rule.trigger], isActive: rule.active, priority: 100,
    conditionsJson: JSON.stringify({ description: rule.description, daysOffset: rule.daysOffset, audienceSegmentId: rule.audienceSegmentId }),
    actions: rule.channels.map((channel, index) => ({ action: channel === "Sms" ? "SendSms" : "SendEmail", order: index,
      payloadJson: JSON.stringify({ templateId: rule.templateId, audienceSegmentId: rule.audienceSegmentId }) })) };
}

function RulesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [legacyRules, setLegacyRules] = useLocalStore<AutomationRule>(`kalypsis:marketing:rules:${marketingScope(user)}`, []);
  const workflowQ = useQuery({ queryKey: ["crm-workflow-rules"], queryFn: async () => (await api.get<WorkflowRuleDto[]>("/workflows")).data });
  const templatesQ = useQuery({ queryKey: ["crm-office-templates"], queryFn: async () => (await api.get<OfficeTemplateDto[]>("/email-templates")).data });
  const persistedTemplates: MarketingTemplate[] = (templatesQ.data ?? []).map(tpl => ({ id: tpl.id, name: tpl.name,
    kind: tpl.code.toLowerCase().startsWith("sms:") ? "SMS" : "Email", subject: tpl.subject,
    body: tpl.code.toLowerCase().startsWith("sms:") ? (tpl.smsBody || tpl.bodyHtml) : tpl.bodyHtml,
    tags: tpl.policyTrigger ? [tpl.policyTrigger] : [], createdAt: "" }));
  const templates = persistedTemplates.length > 0 ? persistedTemplates : DEFAULT_TEMPLATES;
  const rules = workflowQ.data?.map(workflowToMarketingRule) ?? legacyRules;
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [creating, setCreating] = useState(false);

  const upsert = async (r: AutomationRule) => {
    const body = marketingRuleBody(r);
    if (workflowQ.data?.some(x => x.id === r.id)) await api.put(`/workflows/${r.id}`, body);
    else await api.post("/workflows", body);
    await qc.invalidateQueries({ queryKey: ["crm-workflow-rules"] });
    setLegacyRules(prev => prev.filter(x => x.id !== r.id));
  };
  const remove = async (id: string) => {
    if (workflowQ.data?.some(x => x.id === id)) await api.delete(`/workflows/${id}`);
    setLegacyRules(prev => prev.filter(x => x.id !== id));
    await qc.invalidateQueries({ queryKey: ["crm-workflow-rules"] });
  };
  const toggle = (r: AutomationRule) => { void upsert({ ...r, active: !r.active }); };

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
        onSave={async (r) => { await upsert(r); setCreating(false); setEditing(null); }}
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
        <Button onClick={onClose} color="error" variant="contained">Άκυρο</Button>
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
  const [segments, setSegments] = useLocalStore<AudienceSegment>(`kalypsis:marketing:segments:${marketingScope(user)}`, DEFAULT_SEGMENTS);
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
    criteria: { hasEmail: true, hasPhone: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: null, unpaidBalance: false, consentRequired: true },
    estimatedCount: 0, createdAt: new Date().toISOString()
  },
  {
    id: "seg-expiring-30", name: "Λήγουν σε 30 μέρες", description: "Πελάτες με συμβόλαιο που λήγει το επόμενο μήνα.",
    criteria: { hasEmail: false, hasPhone: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: 30, unpaidBalance: false, consentRequired: true },
    estimatedCount: 0, createdAt: new Date().toISOString()
  },
];

function SegmentEditor({
  open, segment, onClose, onSave
}: { open: boolean; segment: AudienceSegment | null; onClose: () => void; onSave: (s: AudienceSegment) => void }) {
  const customersQ = useQuery({
    queryKey: ["marketing-segment-customers"],
    enabled: open,
    queryFn: async () => (await api.get<Array<{ id: string; customerNumber?: string; firstName?: string; lastName?: string; companyName?: string; email?: string; phone?: string; occupation?: string }>>("/customers")).data,
  });
  const [form, setForm] = useState<AudienceSegment>(() => segment ?? {
    id: `seg-${Date.now()}`, name: "", description: "",
    criteria: { hasEmail: false, hasPhone: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: null, unpaidBalance: false, consentRequired: true },
    estimatedCount: 0, createdAt: new Date().toISOString(),
  });
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(segment?.memberIds ?? []);
  useEffect(() => {
    if (segment) { setForm(segment); setSelectedMemberIds(segment.memberIds ?? []); }
    else if (open) setForm({
      id: `seg-${Date.now()}`, name: "", description: "",
      criteria: { hasEmail: false, hasPhone: false, occupation: "", needKind: "", onlyUninsuredNeeds: false, expiringWithinDays: null, unpaidBalance: false, consentRequired: true },
      estimatedCount: 0, createdAt: new Date().toISOString(),
    });
  }, [segment, open]);

  const setC = (patch: Partial<AudienceSegment["criteria"]>) =>
    setForm(f => ({ ...f, criteria: { ...f.criteria, ...patch } }));
  const matchingCustomers = useMemo(() => {
    const c = form.criteria;
    return (customersQ.data ?? []).filter(customer => {
      if (c.hasEmail && !customer.email) return false;
      if (c.hasPhone && !customer.phone) return false;
      if (c.occupation && !(customer.occupation ?? "").toLocaleLowerCase().includes(c.occupation.toLocaleLowerCase())) return false;
      return true;
    });
  }, [customersQ.data, form.criteria]);
  const matchingIds = matchingCustomers.map(c => c.id);
  const allMatchingSelected = matchingIds.length > 0 && matchingIds.every(id => selectedMemberIds.includes(id));
  const toggleAllMatching = () => setSelectedMemberIds(prev => allMatchingSelected
    ? prev.filter(id => !matchingIds.includes(id))
    : Array.from(new Set([...prev, ...matchingIds])));
  const toggleMember = (id: string) => setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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
          <Card variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Checkbox size="small" checked={allMatchingSelected} indeterminate={!allMatchingSelected && matchingIds.some(id => selectedMemberIds.includes(id))} onChange={toggleAllMatching} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Επιλογή πελατών από τα φίλτρα</Typography>
                <Typography variant="caption" color="text.secondary">{matchingCustomers.length} ταιριάζουν · {selectedMemberIds.length} επιλεγμένοι</Typography>
              </Box>
              <Button size="small" onClick={() => setSelectedMemberIds([])} color="error">Καθαρισμός</Button>
            </Stack>
            <Stack sx={{ maxHeight: 180, overflow: "auto", mt: 0.5 }}>
              {matchingCustomers.slice(0, 100).map(customer => {
                const name = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || customer.companyName || customer.customerNumber || customer.id;
                return <FormControlLabel key={customer.id} sx={{ ml: 0 }} label={name} control={<Checkbox size="small" checked={selectedMemberIds.includes(customer.id)} onChange={() => toggleMember(customer.id)} />} />;
              })}
              {matchingCustomers.length > 100 && <Typography variant="caption" color="text.secondary">Εμφανίζονται οι πρώτοι 100· η μαζική επιλογή εφαρμόζει όλα τα αποτελέσματα.</Typography>}
            </Stack>
          </Card>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained">Άκυρο</Button>
        <Button variant="contained" onClick={() => onSave({ ...form, memberIds: selectedMemberIds, estimatedCount: matchingCustomers.length || form.estimatedCount })} disabled={!form.name.trim()}>Αποθήκευση</Button>
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
  const [log] = useLocalStore<SendLogEntry>(`kalypsis:marketing:log:${marketingScope(user)}`, []);
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
interface OpportunityDto {
  id: string; title: string; stage: string; product: string | null; carrier: string | null; estimatedValue: number | null;
  nextActionAt: string | null; lostReason: string | null; notes: string | null; customerId: string | null; customerName: string | null;
  producerId: string | null; producerName: string | null; assignedToUserId: string | null; assignedToUserName: string | null;
  createdAt: string; updatedAt: string | null;
}

// Kept only as a compatibility fallback for old localStorage entries. The
// visible history tab uses the backend-backed HistoryTabBackend below.
void HistoryTab;

interface DeliveryLogDto {
  id: string; campaignId: string; campaignName: string; customerId: string | null; customerName: string | null;
  channel: string; provider: string; status: string; recipientName: string | null; recipient: string;
  subject: string | null; bodyHtml: string | null; bodyText: string | null; providerMessageId: string | null;
  errorMessage: string | null; sentAt: string; deliveredAt: string | null; openedAt: string | null;
  clickedAt: string | null; unsubscribedAt: string | null;
}

function HistoryTabBackend() {
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<DeliveryLogDto | null>(null);
  const query = useQuery({
    queryKey: ["marketing-deliveries", search, filterChannel, filterProvider, filterStatus, from, to],
    queryFn: async () => (await api.get<DeliveryLogDto[]>("/marketing-campaigns/deliveries", { params: {
      search: search || undefined, channel: filterChannel || undefined, provider: filterProvider || undefined,
      status: filterStatus || undefined, from: from || undefined, to: to || undefined
    } })).data,
  });
  const rows = query.data ?? [];
  const delivered = rows.filter(x => ["Sent", "Delivered", "Opened", "Clicked"].includes(x.status)).length;
  const failed = rows.filter(x => ["Failed", "SkippedConsent", "SkippedNoRecipient"].includes(x.status)).length;
  const clear = () => { setSearch(""); setFilterChannel(""); setFilterProvider(""); setFilterStatus(""); setFrom(""); setTo(""); };
  return <Box>
    <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
      <Kpi label="Απόπειρες αποστολής" value={rows.length} icon={<SendIcon />} />
      <Kpi label="Εστάλησαν" value={delivered} color="#2e7d32" icon={<CheckCircleIcon />} />
      <Kpi label="Αποτυχίες / παραλείψεις" value={failed} color="#d32f2f" icon={<ErrorIcon />} />
      <Box sx={{ ml: "auto" }}><DataExportButton entity="crm-delivery-history" endpoint="/data-exports/crm-delivery-history" search={search} additionalParams={{ channel: filterChannel, provider: filterProvider, status: filterStatus, from, to }} label="Εξαγωγή ιστορικού" /></Box>
    </Stack>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} mb={2} flexWrap="wrap" useFlexGap>
      <TextField size="small" label="Αναζήτηση καμπάνιας / παραλήπτη" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 260 }} />
      <TextField select size="small" label="Κανάλι" value={filterChannel} onChange={e => setFilterChannel(e.target.value)} sx={{ minWidth: 140 }}><MenuItem value="">Όλα</MenuItem><MenuItem value="Email">Email</MenuItem><MenuItem value="Sms">SMS</MenuItem></TextField>
      <TextField select size="small" label="Πάροχος" value={filterProvider} onChange={e => setFilterProvider(e.target.value)} sx={{ minWidth: 140 }}><MenuItem value="">Όλοι</MenuItem><MenuItem value="Brevo">Brevo</MenuItem><MenuItem value="Bulker">Bulker</MenuItem></TextField>
      <TextField select size="small" label="Κατάσταση" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value="">Όλες</MenuItem>{["Sent", "Failed", "SkippedConsent", "SkippedNoRecipient"].map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
      <TextField type="date" size="small" label="Από" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
      <TextField type="date" size="small" label="Έως" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
      <Button color="error" variant="contained" onClick={clear}>Καθαρισμός φίλτρων</Button>
    </Stack>
    {query.isLoading ? <CircularProgress /> : <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small"><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Καμπάνια</TableCell><TableCell>Παραλήπτης</TableCell><TableCell>Κανάλι</TableCell><TableCell>Πάροχος</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Προεπισκόπηση</TableCell></TableRow></TableHead><TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>Δεν υπάρχουν καταγεγραμμένες αποστολές.</TableCell></TableRow>}
        {rows.map(row => <TableRow key={row.id} hover><TableCell>{dateTime(row.sentAt)}</TableCell><TableCell>{row.campaignName}</TableCell><TableCell><Typography variant="body2" fontWeight={700}>{row.recipientName || row.customerName || "—"}</Typography><Typography variant="caption" color="text.secondary">{row.recipient || "—"}</Typography></TableCell><TableCell><ChannelIcon channel={row.channel as Channel} /></TableCell><TableCell>{row.provider}</TableCell><TableCell><Chip size="small" color={row.status === "Sent" ? "success" : row.status === "Failed" ? "error" : "warning"} label={row.status} /></TableCell><TableCell align="right"><IconButton size="small" onClick={() => setPreview(row)}><VisibilityIcon fontSize="small" /></IconButton></TableCell></TableRow>)}
      </TableBody></Table>
    </Card>}
    <Dialog open={!!preview} onClose={() => setPreview(null)} fullWidth maxWidth="md"><DialogTitle>Ακριβές περιεχόμενο αποστολής</DialogTitle><DialogContent dividers>{preview && <Stack spacing={1.5}><Typography><b>Καμπάνια:</b> {preview.campaignName}</Typography><Typography><b>Παραλήπτης:</b> {preview.recipientName || preview.customerName || "—"} · {preview.recipient || "—"}</Typography><Typography><b>Κανάλι / πάροχος:</b> {preview.channel} · {preview.provider} · {preview.status}</Typography>{preview.subject && <Typography><b>Θέμα:</b> {preview.subject}</Typography>}{preview.bodyHtml ? <Box component="iframe" title="Προεπισκόπηση email" srcDoc={preview.bodyHtml} sandbox="" sx={{ width: "100%", minHeight: 300, border: 1, borderColor: "divider", borderRadius: 1 }} /> : <Paper variant="outlined" sx={{ p: 2, whiteSpace: "pre-wrap" }}>{preview.bodyText || "—"}</Paper>}{preview.errorMessage && <Alert severity="error">{preview.errorMessage}</Alert>}</Stack>}</DialogContent><DialogActions><Button onClick={() => setPreview(null)}>Κλείσιμο</Button></DialogActions></Dialog>
  </Box>;
}

const OPPORTUNITY_STAGES = ["New", "Contacted", "Quoted", "FollowUp", "Won", "Lost"] as const;
type OpportunityForm = { title: string; stage: string; product: string; carrier: string; estimatedValue: string; nextActionAt: string; lostReason: string; notes: string; customerId: string; producerId: string };
const EMPTY_OPPORTUNITY: OpportunityForm = { title: "", stage: "New", product: "", carrier: "", estimatedValue: "", nextActionAt: "", lostReason: "", notes: "", customerId: "", producerId: "" };

function OpportunitiesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [editing, setEditing] = useState<OpportunityDto | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OpportunityForm>(EMPTY_OPPORTUNITY);
  const opportunities = useQuery({ queryKey: ["crm-opportunities", search, stage], queryFn: async () => (await api.get<OpportunityDto[]>("/crm/opportunities", { params: { search: search || undefined, stage: stage || undefined } })).data });
  const customers = useQuery({ queryKey: ["crm-opportunity-customers"], queryFn: async () => (await api.get<Array<{ id: string; firstName?: string; lastName?: string; companyName?: string }>>("/customers", { params: { limit: 5000 } })).data });
  const producers = useQuery({ queryKey: ["crm-opportunity-producers"], queryFn: async () => (await api.get<Array<{ id: string; name: string }>>("/producers", { params: { pageSize: 1000 } })).data });
  const save = useMutation({ mutationFn: async () => { const body = { ...form, estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null, nextActionAt: form.nextActionAt || null, customerId: form.customerId || null, producerId: form.producerId || null, assignedToUserId: null }; return editing ? api.put(`/crm/opportunities/${editing.id}`, body) : api.post("/crm/opportunities", body); }, onSuccess: () => { setOpen(false); setEditing(null); setForm(EMPTY_OPPORTUNITY); void qc.invalidateQueries({ queryKey: ["crm-opportunities"] }); } });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/crm/opportunities/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ["crm-opportunities"] }) });
  const startNew = () => { setEditing(null); setForm(EMPTY_OPPORTUNITY); setOpen(true); };
  const startEdit = (row: OpportunityDto) => { setEditing(row); setForm({ title: row.title, stage: row.stage, product: row.product ?? "", carrier: row.carrier ?? "", estimatedValue: row.estimatedValue?.toString() ?? "", nextActionAt: row.nextActionAt?.slice(0, 16) ?? "", lostReason: row.lostReason ?? "", notes: row.notes ?? "", customerId: row.customerId ?? "", producerId: row.producerId ?? "" }); setOpen(true); };
  const customerLabel = (x: { firstName?: string; lastName?: string; companyName?: string; id: string }) => x.companyName || `${x.firstName ?? ""} ${x.lastName ?? ""}`.trim() || x.id;
  return <Box>
    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2} mb={2}><Box sx={{ flex: 1 }}><Typography variant="h6" fontWeight={800}>Ευκαιρίες πώλησης / Pipeline</Typography><Typography color="text.secondary">Παρακολουθήστε leads, προσφορές, follow-ups και κερδισμένες εργασίες χωρίς να αλλάζετε τα συμβόλαια.</Typography></Box><Button variant="contained" startIcon={<AddIcon />} onClick={startNew}>Νέα ευκαιρία</Button></Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mb={2}><TextField size="small" label="Αναζήτηση" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 240 }} /><TextField select size="small" label="Στάδιο" value={stage} onChange={e => setStage(e.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Όλα</MenuItem>{OPPORTUNITY_STAGES.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><Button color="error" variant="contained" onClick={() => { setSearch(""); setStage(""); }}>Καθαρισμός φίλτρων</Button></Stack>
    <Card variant="outlined" sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Τίτλος</TableCell><TableCell>Στάδιο</TableCell><TableCell>Προϊόν</TableCell><TableCell>Πελάτης</TableCell><TableCell>Επόμενη ενέργεια</TableCell><TableCell align="right">Εκτίμηση</TableCell><TableCell align="right" /></TableRow></TableHead><TableBody>{opportunities.isLoading && <TableRow><TableCell colSpan={7}><CircularProgress size={20} /></TableCell></TableRow>}{(opportunities.data ?? []).map(row => <TableRow key={row.id} hover><TableCell><Typography fontWeight={700}>{row.title}</Typography><Typography variant="caption" color="text.secondary">{row.producerName || ""}</Typography></TableCell><TableCell><Chip size="small" color={row.stage === "Won" ? "success" : row.stage === "Lost" ? "error" : "default"} label={row.stage} /></TableCell><TableCell>{row.product || "—"}</TableCell><TableCell>{row.customerName || "—"}</TableCell><TableCell>{row.nextActionAt ? dateTime(row.nextActionAt) : "—"}</TableCell><TableCell align="right">{row.estimatedValue == null ? "—" : row.estimatedValue.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}</TableCell><TableCell align="right"><IconButton size="small" onClick={() => startEdit(row)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => { if (confirm("Διαγραφή ευκαιρίας;")) remove.mutate(row.id); }}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>)}{!opportunities.isLoading && (opportunities.data ?? []).length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>Δεν υπάρχουν ευκαιρίες.</TableCell></TableRow>}</TableBody></Table></Card>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Επεξεργασία ευκαιρίας" : "Νέα ευκαιρία"}</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField required label="Τίτλος" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><TextField select label="Στάδιο" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>{OPPORTUNITY_STAGES.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField label="Προϊόν / ανάγκη" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} /><TextField label="Ασφαλιστική" value={form.carrier} onChange={e => setForm({ ...form, carrier: e.target.value })} /><TextField select label="Πελάτης" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}><MenuItem value="">Χωρίς σύνδεση</MenuItem>{(customers.data ?? []).map(x => <MenuItem key={x.id} value={x.id}>{customerLabel(x)}</MenuItem>)}</TextField><TextField select label="Συνεργάτης" value={form.producerId} onChange={e => setForm({ ...form, producerId: e.target.value })}><MenuItem value="">Χωρίς σύνδεση</MenuItem>{(producers.data ?? []).map(x => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}</TextField><TextField type="number" label="Εκτιμώμενη αξία (€)" value={form.estimatedValue} onChange={e => setForm({ ...form, estimatedValue: e.target.value })} /><TextField type="datetime-local" label="Επόμενη ενέργεια" value={form.nextActionAt} onChange={e => setForm({ ...form, nextActionAt: e.target.value })} InputLabelProps={{ shrink: true }} /><TextField label="Σημειώσεις" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline minRows={3} /></Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Ακύρωση</Button><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
  </Box>;
}

const DEFAULT_MARKETING_PROVIDERS: MarketingProvider[] = [
  { id: "mprov-brevo",  name: "Brevo (Email)",   kind: "Email", monthlyQuota: 3000, usedThisMonth: 1240, unitCostExtra: 0.001, senderId: "no-reply@kalypsis.gr", apiKey: "", active: true },
  { id: "mprov-bulker", name: "Bulker (SMS)",    kind: "SMS",   monthlyQuota: 2000, usedThisMonth: 1750, unitCostExtra: 0.045, senderId: "KALYPSIS",             apiKey: "", active: true },
];

function ProvidersTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [providers, setProviders] = useLocalStore<MarketingProvider>(
    `kalypsis:marketing:providers:${marketingScope(user)}`,
    DEFAULT_MARKETING_PROVIDERS
  );
  // Migrate the old local provider label and hide retired legacy providers.
  useEffect(() => {
    setProviders(prev => prev
      .map(p => p.name.toLowerCase().includes("twilio") ? { ...p, id: "mprov-bulker", name: "Bulker (SMS)" } : p));
  }, []);
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
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("marketing.providers.title", "Πάροχοι αποστολής")}</Typography>
            <Chip size="small" color="info" variant="outlined" label="backoffice" title="Οι ρυθμίσεις παρόχων και τα όρια απαιτούν έγκριση από το backoffice της Kalypsis." />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t("marketing.providers.subtitle", "Ρύθμιση παρόχων email / SMS, όρια χρήσης και υπολογιστής επιπλέον χρέωσης.")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <BuyMoreButton />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            {t("marketing.providers.new", "Νέος πάροχος")}
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Backoffice-only:</strong> τα όρια αποστολής και οι πάροχοι ρυθμίζονται εξατομικευμένα από την Kalypsis.
        Για αύξηση ορίου ή αλλαγή παρόχου, πατήστε <em>«Αγορά πακέτου»</em> ή επικοινωνήστε στο <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>.
      </Alert>

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
          <BuyMoreButton size="small" color="warning" />
        </Stack>
      )}
    </Card>
  );
}

// Buy-more UI — Brevo email packages + Bulker SMS top-up options operators
// can request from the backoffice. The tenant can't self-provision more
// capacity (Brevo API keys / Bulker credit belong to the platform), so
// the button opens a request dialog and generates a pre-filled mailto:
// link to info@mykalypsis.gr. Backoffice replies with an activation
// confirmation and updates the quota.
const COMMS_PACKAGES: { code: string; title: string; qty: number; kind: "Email" | "SMS"; price: string; brevoTemplate?: string; note?: string }[] = [
  { code: "EM-05K", title: "Brevo — 5.000 emails / μήνα",  qty: 5000,  kind: "Email", price: "€20 / μήνα",  brevoTemplate: "Kalypsis · Marketing · Ενημερώσεις", note: "Ιδανικό για μικρή/μεσαία επικοινωνία πελατολογίου." },
  { code: "EM-20K", title: "Brevo — 20.000 emails / μήνα", qty: 20000, kind: "Email", price: "€45 / μήνα",  brevoTemplate: "Kalypsis · Marketing · Ενημερώσεις", note: "Καλύπτει καμπάνιες σε όλη τη βάση + ανανεώσεις." },
  { code: "EM-60K", title: "Brevo — 60.000 emails / μήνα", qty: 60000, kind: "Email", price: "€99 / μήνα",  brevoTemplate: "Kalypsis · Marketing · Ενημερώσεις", note: "Για γραφεία με έντονη επικοινωνία & bulk νομικές ενημερώσεις." },
  { code: "SM-01K", title: "SMS — 1.000 μηνύματα",         qty: 1000,  kind: "SMS",   price: "€45 (μία χρέωση)", note: "Πληρωμή προ-αγοράς. Ισχύει 12 μήνες." },
  { code: "SM-05K", title: "SMS — 5.000 μηνύματα",         qty: 5000,  kind: "SMS",   price: "€199 (μία χρέωση)", note: "Πληρωμή προ-αγοράς. Ισχύει 12 μήνες." },
];

function BuyMoreButton({ size = "medium", color = "primary" as "primary" | "warning" }: { size?: "small" | "medium"; color?: "primary" | "warning" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" size={size} color={color} startIcon={<AddIcon />} onClick={() => setOpen(true)}>
        Αγορά πακέτου
      </Button>
      <BuyMoreDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function BuyMoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { if (open) setSelected(null); }, [open]);
  const active = COMMS_PACKAGES.find(p => p.code === selected);

  const requestMailto = () => {
    if (!active) return;
    const subject = `[Kalypsis] Αίτημα αγοράς πακέτου επικοινωνιών: ${active.code}`;
    const body = [
      `Καλησπέρα,`,
      ``,
      `Παρακαλώ ενεργοποιήστε το ακόλουθο πακέτο για το γραφείο μου:`,
      ``,
      `Κωδικός πακέτου: ${active.code}`,
      `Περιγραφή: ${active.title}`,
      `Ποσότητα: ${active.qty.toLocaleString("el-GR")} ${active.kind === "Email" ? "emails" : "μηνύματα"}`,
      `Τιμή: ${active.price}`,
      active.brevoTemplate ? `Πρότυπο Brevo προς χρήση: ${active.brevoTemplate}` : "",
      ``,
      `Ευχαριστώ πολύ.`,
    ].filter(Boolean).join("\n");
    window.location.href = `mailto:info@mykalypsis.gr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Αγορά επιπλέον πακέτου επικοινωνιών</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Τα πακέτα ενεργοποιούνται από το backoffice της Kalypsis. Επιλέξτε τι χρειάζεστε
          και θα σας σταλεί επιβεβαίωση εντός 1 εργάσιμης. Οι Brevo καμπάνιες αποστέλλονται
          με πιστοποιημένα πρότυπα του γραφείου σας (θα σας ζητηθούν αν δεν υπάρχουν ήδη).
        </Alert>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" } }}>
          {COMMS_PACKAGES.map(p => {
            const isActive = selected === p.code;
            return (
              <Card key={p.code} variant="outlined"
                onClick={() => setSelected(p.code)}
                sx={{
                  p: 2, cursor: "pointer",
                  borderColor: isActive ? "primary.main" : undefined,
                  borderWidth: isActive ? 2 : 1,
                  bgcolor: isActive ? "action.selected" : undefined,
                }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Chip size="small" variant="outlined" label={p.kind} />
                  <Chip size="small" color="primary" variant="outlined" label={p.code} sx={{ fontFamily: "monospace" }} />
                </Stack>
                <Typography fontWeight={800}>{p.title}</Typography>
                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 900, my: 0.5 }}>{p.price}</Typography>
                {p.brevoTemplate && <Typography variant="caption" color="text.secondary" display="block">Brevo: {p.brevoTemplate}</Typography>}
                {p.note && <Typography variant="caption" color="text.secondary" display="block" mt={1}>{p.note}</Typography>}
              </Card>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Κλείσιμο</Button>
        <Button variant="contained" disabled={!active} onClick={requestMailto}>
          Αποστολή αιτήματος
        </Button>
      </DialogActions>
    </Dialog>
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
        <Button onClick={onClose} color="error" variant="contained">Άκυρο</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim()}>Αποθήκευση</Button>
      </DialogActions>
    </Dialog>
  );
}
