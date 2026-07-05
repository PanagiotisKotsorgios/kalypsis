import { useEffect, useState } from "react";
import { SearchableTextField } from "../components/SearchableTextField";
import { extractErrorMessage } from "../api/client";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Divider,
  Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, LinearProgress, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography
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
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/* ===================== Πλάνα Συνδρομής =====================
   Redesigned to per-user annual pricing (August 2026):
     • Producer  90€/έτος  — solo συνεργάτης, μόνο portal + own book
     • Standard  550€/user/έτος — 1 γραφείο, default 4 users, όλα τα
       κλασικά package: BackOffice + Client Portal + CRM + όλα τα bridges
     • Premium   1200€/user/έτος — προσθέτει FrontOffice, Intelligence,
       custom integrations, priority support
   Ad-hoc services (εκπαίδευση, migration, custom dev) χρεώνονται ξεχωριστά
   ανά ώρα μέσω του TenantChargeable panel.                              */
const PLAN_DEFAULTS = [
  {
    code: "Producer", pricePerUserYear: 90, includedOffices: 0, includedUsers: 1,
    packages: ["ProducerPortal"],
    tagline: "Solo συνεργάτης · portal μόνο"
  },
  {
    code: "Standard", pricePerUserYear: 550, includedOffices: 1, includedUsers: 4,
    packages: ["BackOffice", "ClientPortal", "CRM", "AllBridges"],
    tagline: "1 γραφείο · κλασικές λειτουργίες"
  },
  {
    code: "Premium", pricePerUserYear: 1200, includedOffices: 3, includedUsers: 10,
    packages: ["BackOffice", "ClientPortal", "CRM", "AllBridges", "FrontOffice", "Intelligence", "CustomIntegrations", "PrioritySupport"],
    tagline: "Πλήρες σουίτα · priority support"
  }
];

// Optional addons — added per γραφείο βάσει ανάγκης. Ανά χρήστη·έτος.
const ADDON_DEFAULTS = [
  { code: "FrontOffice",        pricePerUserYear: 200, description: "Front office + καμπάνια εργαλεία" },
  { code: "Intelligence",       pricePerUserYear: 150, description: "Analytics + reports + benchmarks" },
  { code: "AdvancedBridges",    pricePerUserYear: 100, description: "Bridges premium — απεριόριστες γέφυρες + AI matching" },
  { code: "PrioritySupport",    pricePerUserYear: 300, description: "SLA 4h · phone hotline" },
  { code: "CustomIntegrations", pricePerUserYear: 500, description: "Ενσωμάτωση με ERPs (SAP, Oracle) + custom APIs" },
];

// Ad-hoc services (χρεώνονται ανά ώρα ή flat). Superadmin τα προσθέτει
// σε συγκεκριμένα γραφεία από το «Χρεώσεις Γραφείου» panel.
const SERVICE_DEFAULTS = [
  { code: "RemoteTraining",     unitLabel: "ώρα",  unitPrice: 15,  description: "Εξ αποστάσεως εκπαίδευση (Zoom / Teams)" },
  { code: "OnsiteTraining",     unitLabel: "ώρα",  unitPrice: 45,  description: "Εκπαίδευση στην έδρα του γραφείου" },
  { code: "DataMigration",      unitLabel: "flat", unitPrice: 500, description: "Migration από παλαιό σύστημα" },
  { code: "CustomDevelopment",  unitLabel: "ώρα",  unitPrice: 200, description: "Custom feature development" },
];

export function SubscriptionPlansPage() {
  const tenants = useQuery({ queryKey: ["all-tenants"],
    queryFn: async () => (await api.get<any[]>("/tenants")).data });
  const planCounts: Record<string, number> = {};
  for (const t1 of tenants.data ?? []) {
    const k = String(t1.subscriptionPlan ?? "Standard");
    planCounts[k] = (planCounts[k] ?? 0) + 1;
  }
  return (
    <PageShell icon={<CreditCardIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.plans.title" subtitleKey="plat.plans.subtitle" helpId="page.platPlans">
      {/* Base plans — 3 cards, per-user annual pricing */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
        Βασικά πλάνα
      </Typography>
      <Box sx={{ display: "grid", gap: 2, mt: 1, mb: 4, gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" } }}>
        {PLAN_DEFAULTS.map(p => {
          const baseAnnual = p.pricePerUserYear * p.includedUsers;
          return (
            <Card key={p.code} sx={{ p: 2.5, borderTop: "3px solid",
              borderTopColor: p.code === "Producer" ? "info.main" : p.code === "Standard" ? "primary.main" : "warning.main" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="h6" fontWeight={800}>{p.code}</Typography>
                <Chip size="small" label={`${planCounts[p.code] ?? 0} γραφεία`} color={planCounts[p.code] ? "primary" : "default"} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {p.tagline}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>
                {p.pricePerUserYear}€
                <Typography component="span" variant="body2" color="text.secondary"> / χρήστη · έτος</Typography>
              </Typography>
              {p.includedUsers > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Βάση: <b>{baseAnnual}€/έτος</b> για {p.includedUsers} χρήστες · scale per user
                </Typography>
              )}
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary">Περιλαμβάνει</Typography>
              {p.includedOffices > 0 && <Typography variant="body2">• {p.includedOffices} γραφεία</Typography>}
              <Typography variant="body2">• {p.includedUsers} χρήστες (default)</Typography>
              <Typography variant="body2">• {p.packages.length} πακέτα</Typography>
              <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap" gap={0.5}>
                {p.packages.map(pkg => <Chip key={pkg} size="small" variant="outlined" label={pkg} />)}
              </Stack>
            </Card>
          );
        })}
      </Box>

      {/* Addons */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
        Πρόσθετα πακέτα (addons)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Προστίθενται πάνω στο βασικό πλάνο ανά χρήστη·έτος. Ο superadmin τα ενεργοποιεί ανά γραφείο.
      </Typography>
      <Card sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Addon</TableCell>
              <TableCell>Περιγραφή</TableCell>
              <TableCell align="right">Τιμή / χρήστη · έτος</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ADDON_DEFAULTS.map(a => (
              <TableRow key={a.code}>
                <TableCell><Typography fontWeight={700}>{a.code}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{a.description}</Typography></TableCell>
                <TableCell align="right"><Typography fontWeight={700} color="primary.main">{a.pricePerUserYear}€</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Ad-hoc services */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
        Υπηρεσίες με χρέωση (ad-hoc)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Χρεώνονται ανά ώρα ή flat, όταν χρειαστεί. Ο superadmin τις προσθέτει στο γραφείο από το «Χρεώσεις Γραφείου» panel και υπολογίζεται αυτόματα η χρέωση.
      </Typography>
      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Υπηρεσία</TableCell>
              <TableCell>Περιγραφή</TableCell>
              <TableCell align="right">Μονάδα</TableCell>
              <TableCell align="right">Τιμή</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {SERVICE_DEFAULTS.map(s => (
              <TableRow key={s.code}>
                <TableCell><Typography fontWeight={700}>{s.code}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{s.description}</Typography></TableCell>
                <TableCell align="right"><Chip size="small" label={s.unitLabel} /></TableCell>
                <TableCell align="right"><Typography fontWeight={700} color="primary.main">{s.unitPrice}€</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== Χρεώσεις & Τιμολόγηση ===================== */
export function PlatformBillingPage() {
  const { t } = useTranslation();
  const tenants = useQuery({ queryKey: ["all-tenants-billing"],
    queryFn: async () => (await api.get<any[]>("/tenants")).data });
  const list = tenants.data ?? [];
  // MRR derived from the annual per-user pricing → default users → /12.
  // Rough approximation for the dashboard KPIs; the actual monthly invoice
  // is generated from the tenant's real user count + addons + chargeables.
  const monthlyForPlan = (planCode: string | undefined) => {
    const plan = PLAN_DEFAULTS.find(p => p.code === planCode);
    if (!plan) return 0;
    return Math.round((plan.pricePerUserYear * plan.includedUsers) / 12);
  };
  const totalMrr = list.reduce((s, t1: any) => s + monthlyForPlan(t1.subscriptionPlan), 0);
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
              const monthly = monthlyForPlan(tt.subscriptionPlan);
              return (
                <TableRow key={tt.id} hover>
                  <TableCell><Typography fontWeight={600}>{tt.name}</Typography></TableCell>
                  <TableCell><Chip size="small" label={tt.subscriptionPlan ?? "Standard"} /></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{monthly}€</TableCell>
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

/* ===================== Broadcast / Newsletter ===================== */
interface Subscriber { id: string; email: string; source: string | null; createdAt: string; unsubscribedAt: string | null; }
interface Campaign { id: string; subject: string; status: string; recipients: number; sent: number; failed: number; sentAt: string | null; createdAt: string; }

export function BroadcastPage() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const subs = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: async () => (await api.get<Subscriber[]>("/platform/newsletter/subscribers")).data
  });
  const campaigns = useQuery({
    queryKey: ["newsletter-campaigns"],
    queryFn: async () => (await api.get<Campaign[]>("/platform/newsletter/campaigns")).data
  });

  const active   = (subs.data ?? []).filter(s => !s.unsubscribedAt);
  const unsubbed = (subs.data ?? []).filter(s =>  s.unsubscribedAt);

  const deleteSub = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/newsletter/subscribers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["newsletter-subscribers"] }),
    onError: (e: any) => setErr(e?.response?.data?.detail ?? "Σφάλμα διαγραφής")
  });

  const send = useMutation({
    mutationFn: async () => (await api.post<Campaign>("/platform/newsletter/campaigns/send", {
      subject: subject.trim(), htmlBody: body, textBody: null
    })).data,
    onSuccess: (c) => {
      setSent(`Η αποστολή ολοκληρώθηκε: ${c.sent}/${c.recipients} επιτυχείς, ${c.failed} αποτυχίες.`);
      setSubject(""); setBody("");
      void qc.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
    },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? "Αποτυχία αποστολής")
  });

  return (
    <PageShell icon={<CampaignIcon sx={{ fontSize: 36 }} color="primary" />}
      titleKey="plat.broadcast.title" subtitleKey="plat.broadcast.subtitle" helpId="page.platBroadcast">
      {sent && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSent(null)}>{sent}</Alert>}
      {err  && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {/* KPI strip */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Ενεργοί συνδρομητές</Typography>
          <Typography variant="h5" fontWeight={800} color="primary.main">{active.length}</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Έχουν αποχωρήσει</Typography>
          <Typography variant="h5" fontWeight={800}>{unsubbed.length}</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Καμπάνιες</Typography>
          <Typography variant="h5" fontWeight={800}>{campaigns.data?.length ?? 0}</Typography>
        </Card>
      </Stack>

      {/* Compose */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="overline" color="text.secondary">Νέα καμπάνια</Typography>
        <Stack spacing={2} mt={1}>
          <TextField required label="Θέμα" value={subject}
            onChange={e => setSubject(e.target.value)} fullWidth />
          <TextField required label="Περιεχόμενο (HTML επιτρέπεται)" value={body}
            onChange={e => setBody(e.target.value)} fullWidth multiline rows={10}
            helperText={`Θα σταλεί σε ${active.length} ενεργούς συνδρομητές.`} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Στέλνεται μέσω του server email provider (Brevo). Οι αποχωρήσαντες παραλείπονται αυτόματα.
            </Typography>
            <Button variant="contained" startIcon={<SendIcon />}
              disabled={send.isPending || !subject.trim() || !body.trim() || active.length === 0}
              onClick={() => {
                if (confirm(`Αποστολή σε ${active.length} συνδρομητές;`)) send.mutate();
              }}>
              {send.isPending ? <CircularProgress size={18} /> : "Αποστολή σε όλους"}
            </Button>
          </Stack>
        </Stack>
      </Card>

      {/* Subscribers */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography fontWeight={700}>Συνδρομητές</Typography>
        </Box>
        {subs.isLoading ? (
          <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Προέλευση</TableCell>
              <TableCell>Εγγραφή</TableCell>
              <TableCell>Κατάσταση</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(subs.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Δεν υπάρχουν συνδρομητές ακόμη.
                </TableCell></TableRow>
              )}
              {(subs.data ?? []).map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{s.email}</TableCell>
                  <TableCell>{s.source ?? "—"}</TableCell>
                  <TableCell>{new Date(s.createdAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell>
                    {s.unsubscribedAt
                      ? <Chip size="small" label="Έχει αποχωρήσει" />
                      : <Chip size="small" color="success" label="Ενεργός" />}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error"
                      onClick={() => { if (confirm(`Διαγραφή ${s.email};`)) deleteSub.mutate(s.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Campaign history */}
      <Card>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography fontWeight={700}>Ιστορικό καμπανιών</Typography>
        </Box>
        {campaigns.isLoading ? (
          <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Θέμα</TableCell>
              <TableCell>Παραλήπτες</TableCell>
              <TableCell>Επιτυχείς</TableCell>
              <TableCell>Αποτυχίες</TableCell>
              <TableCell>Κατάσταση</TableCell>
              <TableCell>Στάλθηκε</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(campaigns.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Δεν έχει σταλεί ακόμη καμπάνια.
                </TableCell></TableRow>
              )}
              {(campaigns.data ?? []).map(c => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.subject}</TableCell>
                  <TableCell align="right">{c.recipients}</TableCell>
                  <TableCell align="right" sx={{ color: "success.main" }}>{c.sent}</TableCell>
                  <TableCell align="right" sx={{ color: c.failed > 0 ? "error.main" : undefined }}>{c.failed}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.status}
                      color={c.status === "Sent" ? "success" : c.status === "Failed" ? "error" : "warning"} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {c.sentAt ? new Date(c.sentAt).toLocaleString("el-GR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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

/* ============================================================================
   Χρεώσεις Γραφείου — superadmin CRUD for ad-hoc chargeable items per tenant
   (training hours × 15€, migration flat 500€, custom dev × 200€ etc.).
   All entries roll into the next generated monthly invoice automatically;
   already-invoiced rows lock their price so history stays honest.
   ========================================================================== */

interface Tenant { id: string; name: string; code: string; }

interface Chargeable {
  id: string; tenantId: string;
  serviceCode: string; description: string; unitLabel: string;
  unitPrice: number; quantity: number; lineTotal: number;
  performedOn: string; notes: string | null;
  invoiced: boolean; invoiceLineId: string | null;
  createdAt: string;
}

export function TenantChargeablesPage() {
  const [tenantId, setTenantId] = useState("");
  const [dialog, setDialog] = useState<Chargeable | null | "new">(null);

  const tenants = useQuery({
    queryKey: ["all-tenants"],
    queryFn: async () => (await api.get<Tenant[]>("/tenants")).data
  });

  const list = useQuery({
    queryKey: ["tenant-chargeables", tenantId],
    queryFn: async () => (await api.get<Chargeable[]>("/platform/tenant-chargeables",
      { params: { tenantId } })).data,
    enabled: !!tenantId
  });

  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/tenant-chargeables/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-chargeables", tenantId] })
  });

  const rows = list.data ?? [];
  const pendingTotal = rows.filter(r => !r.invoiced).reduce((s, r) => s + r.lineTotal, 0);
  const invoicedTotal = rows.filter(r => r.invoiced).reduce((s, r) => s + r.lineTotal, 0);

  return (
    <PageShell
      icon={<PaymentsIcon sx={{ fontSize: 36 }} color="primary" />}
      titleKey="plat.chargeables.title"
      subtitleKey="plat.chargeables.subtitle"
      helpId="page.platChargeables"
    >
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <SearchableTextField select size="small" label="Γραφείο"
            value={tenantId} onChange={(e) => setTenantId(e.target.value)}
            sx={{ minWidth: 280 }}>
            <MenuItem value="">— Επιλέξτε γραφείο —</MenuItem>
            {(tenants.data ?? []).map(t => (
              <MenuItem key={t.id} value={t.id}>{t.name} ({t.code})</MenuItem>
            ))}
          </SearchableTextField>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setDialog("new")} disabled={!tenantId}>
            Νέα χρέωση
          </Button>
        </Stack>
      </Card>

      {tenantId && (
        <Box sx={{ display: "grid", gap: 2, mb: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
          <Kpi label="Εκκρεμείς χρεώσεις" value={`${pendingTotal.toFixed(2)}€`}
            hint={`${rows.filter(r => !r.invoiced).length} γραμμές — μπαίνουν στο επόμενο τιμολόγιο`} />
          <Kpi label="Ήδη τιμολογημένες" value={`${invoicedTotal.toFixed(2)}€`}
            hint={`${rows.filter(r => r.invoiced).length} γραμμές — locked`} />
          <Kpi label="Σύνολο" value={`${(pendingTotal + invoicedTotal).toFixed(2)}€`} />
        </Box>
      )}

      {tenantId && rows.length === 0 && !list.isLoading && (
        <Card variant="outlined"><Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
          <Typography>Δεν υπάρχουν χρεώσεις. Πατήστε «Νέα χρέωση» για να προσθέσετε.</Typography>
        </Box></Card>
      )}

      {tenantId && rows.length > 0 && (
        <Card variant="outlined">
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Ημ/νία</TableCell>
              <TableCell>Υπηρεσία</TableCell>
              <TableCell>Περιγραφή</TableCell>
              <TableCell align="right">Μονάδα</TableCell>
              <TableCell align="right">Τιμή</TableCell>
              <TableCell align="right">Ποσότητα</TableCell>
              <TableCell align="right">Σύνολο</TableCell>
              <TableCell>Κατάσταση</TableCell>
              <TableCell align="right">Ενέργειες</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
                    {new Date(r.performedOn).toLocaleDateString("el-GR")}
                  </TableCell>
                  <TableCell><Chip size="small" label={r.serviceCode} /></TableCell>
                  <TableCell><Typography variant="body2">{r.description}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="caption">{r.unitLabel}</Typography></TableCell>
                  <TableCell align="right">{r.unitPrice.toFixed(2)}€</TableCell>
                  <TableCell align="right">{r.quantity}</TableCell>
                  <TableCell align="right"><Typography fontWeight={800}>{r.lineTotal.toFixed(2)}€</Typography></TableCell>
                  <TableCell>
                    {r.invoiced
                      ? <Chip size="small" color="success" label="Τιμολογήθηκε" />
                      : <Chip size="small" color="warning" label="Εκκρεμεί" />}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={r.invoiced ? "Locked — έχει τιμολογηθεί" : "Επεξεργασία"}>
                      <span>
                        <IconButton size="small" onClick={() => setDialog(r)} disabled={r.invoiced}>
                          ✎
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={r.invoiced ? "Locked" : "Διαγραφή"}>
                      <span>
                        <IconButton size="small" color="error" onClick={() => del.mutate(r.id)}
                          disabled={r.invoiced}>×</IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ChargeableDialog
        open={!!dialog}
        row={dialog === "new" ? null : dialog}
        tenantId={tenantId}
        onClose={() => setDialog(null)}
        onSaved={() => { setDialog(null); qc.invalidateQueries({ queryKey: ["tenant-chargeables", tenantId] }); }}
      />
    </PageShell>
  );
}

function ChargeableDialog({ open, row, tenantId, onClose, onSaved }: {
  open: boolean;
  row: Chargeable | null;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    serviceCode: "RemoteTraining",
    description: "",
    unitLabel: "ώρα",
    unitPrice: 15,
    quantity: 1,
    performedOn: new Date().toISOString().slice(0, 10),
    notes: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setForm({
        serviceCode: row.serviceCode,
        description: row.description,
        unitLabel: row.unitLabel,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
        performedOn: row.performedOn.slice(0, 10),
        notes: row.notes ?? ""
      });
    } else if (open) {
      setForm({
        serviceCode: "RemoteTraining",
        description: "Εξ αποστάσεως εκπαίδευση",
        unitLabel: "ώρα",
        unitPrice: 15, quantity: 1,
        performedOn: new Date().toISOString().slice(0, 10),
        notes: ""
      });
    }
    setError(null);
  }, [row, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        id: row?.id ?? null,
        tenantId,
        serviceCode: form.serviceCode.trim(),
        description: form.description.trim(),
        unitLabel: form.unitLabel.trim(),
        unitPrice: Number(form.unitPrice),
        quantity: Number(form.quantity),
        performedOn: form.performedOn,
        notes: form.notes.trim() || null
      };
      return (await api.post("/platform/tenant-chargeables", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractErrorMessage(e))
  });

  // Preset options — mirror the defaults on the plans page + let the operator
  // pick any of them or roll their own via free-text.
  const presets = [
    { code: "RemoteTraining",    label: "Εξ αποστάσεως εκπαίδευση", unit: "ώρα",  price: 15 },
    { code: "OnsiteTraining",    label: "Εκπαίδευση στην έδρα",     unit: "ώρα",  price: 45 },
    { code: "DataMigration",     label: "Migration από παλιό σύστημα", unit: "flat", price: 500 },
    { code: "CustomDevelopment", label: "Custom feature development", unit: "ώρα",  price: 200 },
    { code: "Other",             label: "Άλλο (custom)",             unit: "flat", price: 0 },
  ];

  const total = (Number(form.unitPrice) || 0) * (Number(form.quantity) || 0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{row ? "Επεξεργασία χρέωσης" : "Νέα χρέωση γραφείου"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <SearchableTextField
            select label="Είδος υπηρεσίας" value={form.serviceCode}
            onChange={(e) => {
              const preset = presets.find(p => p.code === e.target.value);
              setForm(f => ({
                ...f,
                serviceCode: e.target.value,
                ...(preset ? { unitLabel: preset.unit, unitPrice: preset.price, description: preset.label } : {})
              }));
            }}
            fullWidth
          >
            {presets.map(p => (
              <MenuItem key={p.code} value={p.code}>
                {p.code} — {p.label} · {p.unit} × {p.price}€
              </MenuItem>
            ))}
          </SearchableTextField>
          <TextField label="Περιγραφή" fullWidth required
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            helperText="Θα εμφανιστεί στη γραμμή τιμολογίου." />
          <Stack direction="row" spacing={2}>
            <TextField label="Μονάδα" fullWidth
              value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })}
              helperText="π.χ. ώρα, flat, user" />
            <TextField label="Τιμή/μονάδα" type="number" fullWidth required
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
              InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
            <TextField label="Ποσότητα" type="number" fullWidth required
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </Stack>
          <TextField label="Ημ/νία εκτέλεσης" type="date" fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.performedOn}
            onChange={(e) => setForm({ ...form, performedOn: e.target.value })} />
          <TextField label="Σημείωση (προαιρετική)" fullWidth multiline minRows={2}
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="π.χ. ζητήθηκε από τον Παπαδόπουλο, ολοκληρώθηκε 12/07" />

          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">Σύνολο γραμμής</Typography>
            <Typography variant="h5" fontWeight={900} color="primary.main">
              {total.toFixed(2)}€
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.description.trim() || Number(form.quantity) <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
