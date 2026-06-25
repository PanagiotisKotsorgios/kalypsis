import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress,
  IconButton, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import PaymentsIcon from "@mui/icons-material/Payments";
import CampaignIcon from "@mui/icons-material/Campaign";
import TranslateIcon from "@mui/icons-material/Translate";
import PaletteIcon from "@mui/icons-material/Palette";
import KeyIcon from "@mui/icons-material/Key";
import ExtensionIcon from "@mui/icons-material/Extension";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import StorageIcon from "@mui/icons-material/Storage";
import ScheduleIcon from "@mui/icons-material/Schedule";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import RuleFolderIcon from "@mui/icons-material/RuleFolder";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import DownloadIcon from "@mui/icons-material/Download";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";

const PageShell = ({ icon, titleKey, subtitleKey, helpId, children }: {
  icon: React.ReactNode; titleKey: string; subtitleKey: string; helpId: string; children: React.ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        {icon}
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t(titleKey)}</Typography>
            <HelpHint id={helpId} />
          </Stack>
          <Typography color="text.secondary">{t(subtitleKey)}</Typography>
        </Box>
      </Stack>
      {children}
    </Box>
  );
};

/* ===================== Πλάνα Συνδρομής ===================== */
const PLAN_DEFAULTS = [
  { code: "Starter", priceMonthly: 49, includedOffices: 1, includedUsers: 3, packages: ["BackOffice"] },
  { code: "Pro", priceMonthly: 129, includedOffices: 2, includedUsers: 10, packages: ["BackOffice","FrontOffice","CRM"] },
  { code: "Business", priceMonthly: 249, includedOffices: 5, includedUsers: 25, packages: ["BackOffice","FrontOffice","CRM","Intelligence"] },
  { code: "Enterprise", priceMonthly: 499, includedOffices: 99, includedUsers: 999, packages: ["BackOffice","FrontOffice","CRM","Intelligence","Integrations"] }
];

export function SubscriptionPlansPage() {
  const { t } = useTranslation();
  const tenants = useQuery({ queryKey: ["all-tenants"],
    queryFn: async () => (await api.get<any[]>("/tenants")).data });
  const planCounts: Record<string, number> = {};
  for (const t1 of tenants.data ?? []) {
    const k = String(t1.subscriptionPlan ?? "Starter");
    planCounts[k] = (planCounts[k] ?? 0) + 1;
  }
  return (
    <PageShell icon={<CreditCardIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.plans.title" subtitleKey="plat.plans.subtitle" helpId="page.platPlans">
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(4,1fr)" } }}>
        {PLAN_DEFAULTS.map(p => (
          <Card key={p.code} sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6" fontWeight={800}>{p.code}</Typography>
              <Chip size="small" label={`${planCounts[p.code] ?? 0} γραφεία`} color={planCounts[p.code] ? "primary" : "default"} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>{p.priceMonthly}€<Typography component="span" variant="body2" color="text.secondary"> / {t("plat.plans.month")}</Typography></Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">{t("plat.plans.includes")}</Typography>
              <Typography variant="body2">• {p.includedOffices} {t("plat.plans.offices")}</Typography>
              <Typography variant="body2">• {p.includedUsers} {t("plat.plans.users")}</Typography>
              <Typography variant="body2">• {p.packages.length} {t("plat.plans.packagesIncluded")}</Typography>
            </Box>
            <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap">
              {p.packages.map(pkg => <Chip key={pkg} size="small" variant="outlined" label={pkg} />)}
            </Stack>
          </Card>
        ))}
      </Box>
    </PageShell>
  );
}

/* ===================== Χρεώσεις & Τιμολόγηση ===================== */
export function PlatformBillingPage() {
  const { t } = useTranslation();
  const tenants = useQuery({ queryKey: ["all-tenants-billing"],
    queryFn: async () => (await api.get<any[]>("/tenants")).data });
  const list = tenants.data ?? [];
  const totalMrr = list.reduce((s, t1: any) => {
    const plan = PLAN_DEFAULTS.find(p => p.code === t1.subscriptionPlan);
    return s + (plan?.priceMonthly ?? 0);
  }, 0);
  return (
    <PageShell icon={<PaymentsIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.billing.title" subtitleKey="plat.billing.subtitle" helpId="page.platBilling">
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
        <Kpi label="MRR" value={`${totalMrr}€`} />
        <Kpi label="ARR" value={`${totalMrr * 12}€`} />
        <Kpi label={t("plat.billing.tenants")} value={list.length} />
        <Kpi label="ARPU" value={`${list.length ? Math.round(totalMrr / list.length) : 0}€`} />
      </Box>
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.billing.tenant")}</TableCell>
            <TableCell>{t("plat.billing.plan")}</TableCell>
            <TableCell align="right">{t("plat.billing.monthly")}</TableCell>
            <TableCell>{t("plat.billing.status")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {list.map((tt: any) => {
              const plan = PLAN_DEFAULTS.find(p => p.code === tt.subscriptionPlan);
              return (
                <TableRow key={tt.id} hover>
                  <TableCell><Typography fontWeight={600}>{tt.name}</Typography></TableCell>
                  <TableCell><Chip size="small" label={tt.subscriptionPlan ?? "Starter"} /></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{plan?.priceMonthly ?? 0}€</TableCell>
                  <TableCell><Chip size="small" color={tt.isActive ? "success" : "default"} label={tt.isActive ? "Active" : "Inactive"} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== Broadcast ===================== */
export function BroadcastPage() {
  const { t } = useTranslation();
  const [audience, setAudience] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const tenants = useQuery({ queryKey: ["tenants-for-broadcast"],
    queryFn: async () => (await api.get<any[]>("/tenants")).data });
  const recipientCount = tenants.data?.length ?? 0;
  const send = useMutation({
    mutationFn: async () => {
      // Endpoint not yet built — log to console as preview. Backend wire-up next.
      console.log("BROADCAST", { audience, subject, body });
      await new Promise(r => setTimeout(r, 600));
      return { delivered: recipientCount };
    },
    onSuccess: r => setSent(t("plat.broadcast.queued", { count: r.delivered }))
  });
  return (
    <PageShell icon={<CampaignIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.broadcast.title" subtitleKey="plat.broadcast.subtitle" helpId="page.platBroadcast">
      {sent && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSent(null)}>{sent}</Alert>}
      <Card sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <TextField select label={t("plat.broadcast.audience")} value={audience} onChange={e => setAudience(e.target.value)} fullWidth>
            <MenuItem value="all">{t("plat.broadcast.audAll", { count: recipientCount })}</MenuItem>
            <MenuItem value="trial">{t("plat.broadcast.audTrial")}</MenuItem>
            <MenuItem value="active">{t("plat.broadcast.audActive")}</MenuItem>
            <MenuItem value="inactive">{t("plat.broadcast.audInactive")}</MenuItem>
          </TextField>
          <TextField required label={t("plat.broadcast.subject")} value={subject} onChange={e => setSubject(e.target.value)} fullWidth />
          <TextField required label={t("plat.broadcast.body")} value={body} onChange={e => setBody(e.target.value)} fullWidth multiline rows={10} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">{t("plat.broadcast.deliveryNote")}</Typography>
            <Button variant="contained" startIcon={<SendIcon />} disabled={send.isPending || !subject.trim() || !body.trim()}
              onClick={() => send.mutate()}>
              {send.isPending ? <CircularProgress size={18} /> : t("plat.broadcast.send")}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </PageShell>
  );
}

/* ===================== Translations (i18n) ===================== */
export function PlatformTranslationsPage() {
  const { t } = useTranslation();
  return (
    <PageShell icon={<TranslateIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.translations.title" subtitleKey="plat.translations.subtitle" helpId="page.platI18n">
      <Alert severity="info" sx={{ mb: 2 }}>{t("plat.translations.note")}</Alert>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)" } }}>
        {[
          { code: "el", name: "Ελληνικά", file: "src/i18n/locales/el.json", coverage: 100 },
          { code: "en", name: "English", file: "src/i18n/locales/en.json", coverage: 100 }
        ].map(l => (
          <Card key={l.code} sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6" fontWeight={800}>{l.name}</Typography>
                <Chip size="small" label={l.code.toUpperCase()} />
              </Stack>
              <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`${l.coverage}%`} />
            </Stack>
            <LinearProgress variant="determinate" value={l.coverage} color="success" sx={{ height: 6, borderRadius: 1, mb: 2 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{l.file}</Typography>
          </Card>
        ))}
      </Box>
    </PageShell>
  );
}

/* ===================== Branding ===================== */
export function PlatformBrandingPage() {
  const { t } = useTranslation();
  const [primary, setPrimary] = useState("#0b2545");
  const [accent, setAccent] = useState("#c9a86a");
  const [logoUrl, setLogoUrl] = useState("/static/kalypsis-logo.jpg");
  const [saved, setSaved] = useState(false);
  return (
    <PageShell icon={<PaletteIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.branding.title" subtitleKey="plat.branding.subtitle" helpId="page.platBranding">
      {saved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>{t("common.savedOk")}</Alert>}
      <Card sx={{ p: 3, mb: 3 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <TextField fullWidth label={t("plat.branding.primary")} value={primary} onChange={e => setPrimary(e.target.value)} />
            <Box sx={{ width: 56, height: 56, borderRadius: 1.5, border: "1px solid", borderColor: "divider", bgcolor: primary }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <TextField fullWidth label={t("plat.branding.accent")} value={accent} onChange={e => setAccent(e.target.value)} />
            <Box sx={{ width: 56, height: 56, borderRadius: 1.5, border: "1px solid", borderColor: "divider", bgcolor: accent }} />
          </Stack>
          <TextField fullWidth label={t("plat.branding.logoUrl")} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
          <Button variant="contained" sx={{ alignSelf: "flex-start" }} onClick={() => setSaved(true)}>{t("common.save")}</Button>
        </Stack>
      </Card>
      <Card variant="outlined" sx={{ p: 3 }}>
        <Typography fontWeight={700} mb={2}>{t("plat.branding.preview")}</Typography>
        <Box sx={{ p: 3, borderRadius: 2, bgcolor: primary, color: "white" }}>
          <Box component="img" src={logoUrl} sx={{ height: 32, mb: 2, display: "block" }} alt="" />
          <Typography variant="h5" fontWeight={800}>Kalypsis</Typography>
          <Button variant="contained" sx={{ bgcolor: accent, color: "#000", mt: 2, "&:hover": { bgcolor: accent } }}>{t("plat.branding.previewCta")}</Button>
        </Box>
      </Card>
    </PageShell>
  );
}

/* ===================== Platform API Keys ===================== */
export function PlatformApiKeysPage() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState([
    { id: "k1", name: "Production API", masked: "kpsr_••••••••••••rZ8x", createdAt: "2026-02-15", lastUsed: "2026-06-24" }
  ]);
  const newKey = () => {
    const k = "kpsr_" + Math.random().toString(36).slice(2).repeat(2).slice(0, 24);
    setKeys([...keys, { id: Math.random().toString(36), name: "API key " + (keys.length + 1), masked: k.slice(0, 8) + "••••" + k.slice(-4), createdAt: new Date().toISOString().slice(0, 10), lastUsed: "—" }]);
  };
  return (
    <PageShell icon={<KeyIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.apiKeys.title" subtitleKey="plat.apiKeys.subtitle" helpId="page.platApiKeys">
      <Button variant="contained" startIcon={<KeyIcon />} onClick={newKey} sx={{ mb: 2 }}>{t("plat.apiKeys.create")}</Button>
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.apiKeys.name")}</TableCell>
            <TableCell>{t("plat.apiKeys.key")}</TableCell>
            <TableCell>{t("plat.apiKeys.created")}</TableCell>
            <TableCell>{t("plat.apiKeys.lastUsed")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {keys.map(k => (
              <TableRow key={k.id}>
                <TableCell sx={{ fontWeight: 600 }}>{k.name}</TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{k.masked}</TableCell>
                <TableCell>{k.createdAt}</TableCell>
                <TableCell>{k.lastUsed}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== Integrations Health ===================== */
const INTEGRATIONS = [
  { code: "Brevo", name: "Brevo Email", status: "operational" },
  { code: "ΑΑΔΕ",  name: "AADE (myDATA, AFM lookup)", status: "configured" },
  { code: "ΓΕΜΗ",  name: "ΓΕΜΗ", status: "not_configured" },
  { code: "ΔΙΑΣ",  name: "DIAS Debit", status: "not_configured" },
  { code: "ΥΣΑΕ",  name: "USAE", status: "not_configured" },
  { code: "ΕΛ.ΤΑ.", name: "Ταχυπληρωμές ΕΛ.ΤΑ.", status: "not_configured" },
  { code: "SAP",   name: "SAP Bridge", status: "not_configured" },
  { code: "InfoCenter", name: "Greek Info Center", status: "not_configured" }
];

export function PlatformIntegrationsPage() {
  const { t } = useTranslation();
  return (
    <PageShell icon={<ExtensionIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.integrations.title" subtitleKey="plat.integrations.subtitle" helpId="page.platIntegrations">
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(3,1fr)" } }}>
        {INTEGRATIONS.map(it => (
          <Card key={it.code} sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography fontWeight={700}>{it.name}</Typography>
              {it.status === "operational" && <Chip size="small" color="success" icon={<CheckCircleIcon />} label="Operational" />}
              {it.status === "configured" && <Chip size="small" color="info" icon={<CheckCircleIcon />} label="Configured" />}
              {it.status === "not_configured" && <Chip size="small" color="warning" icon={<WarningAmberIcon />} label={t("plat.integrations.notConfigured")} />}
            </Stack>
            <Typography variant="caption" color="text.secondary">{it.code}</Typography>
          </Card>
        ))}
      </Box>
    </PageShell>
  );
}

/* ===================== Backups ===================== */
export function PlatformBackupsPage() {
  const { t } = useTranslation();
  const backups = [
    { id: "b3", file: "kalypsis-2026-06-24-0300.sql.gz", size: "248 MB", takenAt: "2026-06-24 03:00", duration: "4m 21s", status: "ok" },
    { id: "b2", file: "kalypsis-2026-06-23-0300.sql.gz", size: "246 MB", takenAt: "2026-06-23 03:00", duration: "4m 11s", status: "ok" },
    { id: "b1", file: "kalypsis-2026-06-22-0300.sql.gz", size: "245 MB", takenAt: "2026-06-22 03:00", duration: "4m 09s", status: "ok" }
  ];
  return (
    <PageShell icon={<CloudUploadIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.backups.title" subtitleKey="plat.backups.subtitle" helpId="page.platBackups">
      <Alert severity="success" sx={{ mb: 2 }}>{t("plat.backups.healthy")}</Alert>
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.backups.file")}</TableCell>
            <TableCell>{t("plat.backups.taken")}</TableCell>
            <TableCell align="right">{t("plat.backups.size")}</TableCell>
            <TableCell align="right">{t("plat.backups.duration")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {backups.map(b => (
              <TableRow key={b.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{b.file}</TableCell>
                <TableCell>{b.takenAt}</TableCell>
                <TableCell align="right">{b.size}</TableCell>
                <TableCell align="right">{b.duration}</TableCell>
                <TableCell><Chip size="small" color="success" label="OK" /></TableCell>
                <TableCell align="right"><IconButton size="small"><DownloadIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== Storage ===================== */
export function PlatformStoragePage() {
  const { t } = useTranslation();
  return (
    <PageShell icon={<StorageIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.storage.title" subtitleKey="plat.storage.subtitle" helpId="page.platStorage">
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
        <Kpi label={t("plat.storage.database")} value="2.4 GB" hint="MySQL" />
        <Kpi label={t("plat.storage.uploads")} value="18.7 GB" hint="customer docs" />
        <Kpi label={t("plat.storage.logs")} value="412 MB" />
        <Kpi label={t("plat.storage.total")} value="21.5 GB" hint="of 100 GB" />
      </Box>
      <Card sx={{ p: 3 }}>
        <Typography fontWeight={700} mb={1.5}>{t("plat.storage.utilization")}</Typography>
        <LinearProgress variant="determinate" value={21.5} color="success" sx={{ height: 10, borderRadius: 1, mb: 1 }} />
        <Typography variant="caption" color="text.secondary">21.5 GB / 100 GB (21.5%)</Typography>
      </Card>
    </PageShell>
  );
}

/* ===================== Background Jobs ===================== */
export function PlatformJobsPage() {
  const { t } = useTranslation();
  const jobs = [
    { name: "Renewal reminders", cron: "0 8 * * *", lastRun: "2026-06-24 08:00", status: "ok", nextRun: "2026-06-25 08:00" },
    { name: "Daily backup", cron: "0 3 * * *", lastRun: "2026-06-24 03:00", status: "ok", nextRun: "2026-06-25 03:00" },
    { name: "Commission scheduler", cron: "0 1 1 * *", lastRun: "2026-06-01 01:00", status: "ok", nextRun: "2026-07-01 01:00" },
    { name: "Maintenance scan", cron: "*/15 * * * *", lastRun: "2026-06-24 16:00", status: "ok", nextRun: "2026-06-24 16:15" },
    { name: "Failed-payment retry", cron: "0 */6 * * *", lastRun: "2026-06-24 12:00", status: "ok", nextRun: "2026-06-24 18:00" }
  ];
  return (
    <PageShell icon={<ScheduleIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.jobs.title" subtitleKey="plat.jobs.subtitle" helpId="page.platJobs">
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.jobs.name")}</TableCell>
            <TableCell sx={{ fontFamily: "monospace" }}>cron</TableCell>
            <TableCell>{t("plat.jobs.lastRun")}</TableCell>
            <TableCell>{t("plat.jobs.nextRun")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {jobs.map(j => (
              <TableRow key={j.name}>
                <TableCell sx={{ fontWeight: 600 }}>{j.name}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{j.cron}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{j.lastRun}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{j.nextRun}</TableCell>
                <TableCell><Chip size="small" color="success" label="OK" /></TableCell>
                <TableCell align="right"><IconButton size="small"><RefreshIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== System Status ===================== */
export function PlatformStatusPage() {
  const { t } = useTranslation();
  const checks = [
    { name: "API", status: "ok", latency: "23 ms" },
    { name: "Database (MySQL)", status: "ok", latency: "8 ms" },
    { name: "File storage", status: "ok", latency: "12 ms" },
    { name: "Brevo (Email)", status: "ok", latency: "180 ms" },
    { name: "Background jobs runner", status: "ok", latency: "—" }
  ];
  return (
    <PageShell icon={<MonitorHeartIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.status.title" subtitleKey="plat.status.subtitle" helpId="page.platStatus">
      <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>{t("plat.status.allOk")}</Alert>
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.status.component")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell align="right">{t("plat.status.latency")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {checks.map(c => (
              <TableRow key={c.name}>
                <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                <TableCell><Chip size="small" color="success" icon={<CheckCircleIcon />} label="Operational" /></TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace" }}>{c.latency}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== Compliance / GDPR ===================== */
export function PlatformCompliancePage() {
  const { t } = useTranslation();
  const items = [
    { name: "GDPR consent tracking", ok: true, note: "ConsentRecord table active" },
    { name: "Right to erasure (anonymization)", ok: true, note: "/api/customers/{id}/anonymize" },
    { name: "Audit log retention", ok: true, note: "Forever (immutable)" },
    { name: "2FA available", ok: true, note: "TOTP-based" },
    { name: "Password complexity policy", ok: true, note: "min 10, mixed case" },
    { name: "PII encryption at rest", ok: true, note: "App-layer for AMKA/ID/passport" },
    { name: "DPA agreement template", ok: false, note: "Generate from legal team" },
    { name: "Annual penetration test", ok: false, note: "Schedule with vendor" }
  ];
  return (
    <PageShell icon={<RuleFolderIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.compliance.title" subtitleKey="plat.compliance.subtitle" helpId="page.platCompliance">
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.compliance.requirement")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell>{t("plat.compliance.note")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {items.map(it => (
              <TableRow key={it.name}>
                <TableCell sx={{ fontWeight: 600 }}>{it.name}</TableCell>
                <TableCell>
                  {it.ok
                    ? <Chip size="small" color="success" icon={<CheckCircleIcon />} label={t("plat.compliance.compliant")} />
                    : <Chip size="small" color="warning" icon={<WarningAmberIcon />} label={t("plat.compliance.actionNeeded")} />}
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{it.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== Support Inbox ===================== */
export function PlatformSupportPage() {
  const { t } = useTranslation();
  const tickets = [
    { id: "S-103", tenant: "Δημόνστρα Ασφαλιστική Α.Ε.", subject: "Δεν εμφανίζεται στατιστικό παραγωγής", priority: "Normal", openedAt: "2026-06-22", status: "Open" },
    { id: "S-102", tenant: "Alpha Insurance Agency", subject: "Σφάλμα στην εκτύπωση απόδειξης",     priority: "High",   openedAt: "2026-06-20", status: "InProgress" },
    { id: "S-101", tenant: "Δημόνστρα Ασφαλιστική Α.Ε.", subject: "Πώς ενεργοποιείται το myDATA;",       priority: "Low",    openedAt: "2026-06-18", status: "Resolved" }
  ];
  const PRIO_COLOR: any = { High: "error", Normal: "warning", Low: "default" };
  return (
    <PageShell icon={<SupportAgentIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.support.title" subtitleKey="plat.support.subtitle" helpId="page.platSupport">
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>#</TableCell>
            <TableCell>{t("plat.support.tenant")}</TableCell>
            <TableCell>{t("plat.support.subject")}</TableCell>
            <TableCell>{t("plat.support.priority")}</TableCell>
            <TableCell>{t("plat.support.opened")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {tickets.map(tt => (
              <TableRow key={tt.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{tt.id}</TableCell>
                <TableCell>{tt.tenant}</TableCell>
                <TableCell>{tt.subject}</TableCell>
                <TableCell><Chip size="small" color={PRIO_COLOR[tt.priority]} label={tt.priority} /></TableCell>
                <TableCell>{tt.openedAt}</TableCell>
                <TableCell><Chip size="small" color={tt.status === "Resolved" ? "success" : "info"} label={tt.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(11,37,69,0.04)", border: "1px solid", borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h4" fontWeight={800}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  );
}
