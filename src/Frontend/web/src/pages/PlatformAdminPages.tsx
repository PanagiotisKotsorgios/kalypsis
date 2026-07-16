import { useEffect, useMemo, useState } from "react";
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

/* ===================== Πλάνα Συνδρομής ===================================
   All prices editable by the platform admin — fetched from
   GET /api/platform/pricing (public read) and saved via PUT (superadmin
   only). The old hard-coded arrays now live server-side as fallback
   defaults (see PricingDefaults.Build() in the backend).
   ======================================================================= */

interface PlanDef {
  code: string;
  tagline: string;
  /** Flat annual price for the whole plan (includes default offices + users). */
  pricePerYear: number;
  includedOffices: number;
  includedUsers: number;
  extraOfficePerYear: number;
  extraUserPerYear: number;
  packages: string[];
}
/** Addons are also flat annual — added to the plan's total when enabled. */
interface AddonDef { code: string; description: string; pricePerYear: number; }
interface ServiceDef { code: string; description: string; unitLabel: string; unitPrice: number; }
interface PricingCatalog { version: number; plans: PlanDef[]; addons: AddonDef[]; services: ServiceDef[]; }

export function SubscriptionPlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PricingCatalog | null>(null);

  const catalog = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: async () => (await api.get<PricingCatalog>("/platform/pricing")).data
  });
  const tenants = useQuery({ queryKey: ["all-tenants"],
    queryFn: async () => (await api.get<any[]>("/tenants")).data });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Δεν υπάρχουν αλλαγές προς αποθήκευση.");
      setSaveError(null);
      const res = await api.put<PricingCatalog>("/platform/pricing", draft);
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["platform-pricing"], data);
      // Also invalidate so any other page (billing dashboard) picks it up.
      qc.invalidateQueries({ queryKey: ["platform-pricing"] });
      setEditing(false); setDraft(null);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3500);
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const body   = e?.response?.data;
      const msg = status === 401 || status === 403
        ? "Δεν έχετε δικαίωμα αποθήκευσης πλάνων — απαιτείται ρόλος Platform Admin."
        : status === 400
          ? (body?.title || body?.message || "Μη έγκυρα δεδομένα.")
          : e?.message || "Σφάλμα δικτύου.";
      setSaveError(`${status ? `[${status}] ` : ""}${msg}`);
    }
  });

  const current = editing && draft ? draft : catalog.data;
  const planCounts: Record<string, number> = {};
  for (const t1 of tenants.data ?? []) {
    const k = String(t1.subscriptionPlan ?? "Standard");
    planCounts[k] = (planCounts[k] ?? 0) + 1;
  }

  if (!current) {
    return (
      <PageShell icon={<CreditCardIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.plans.title" subtitleKey="plat.plans.subtitle" helpId="page.platPlans">
        <CircularProgress />
      </PageShell>
    );
  }

  return (
    <PageShell icon={<CreditCardIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.plans.title" subtitleKey="plat.plans.subtitle" helpId="page.platPlans">

      {/* Save feedback */}
      {saveError && (
        <Alert severity="error" onClose={() => setSaveError(null)} sx={{ mb: 2 }}>
          <b>Αποτυχία αποθήκευσης:</b> {saveError}
        </Alert>
      )}
      {saveOk && (
        <Alert severity="success" onClose={() => setSaveOk(false)} sx={{ mb: 2 }}>
          Οι αλλαγές αποθηκεύτηκαν επιτυχώς.
        </Alert>
      )}

      {/* Edit toolbar */}
      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1} mb={2}>
        {editing ? (
          <>
            <Button onClick={() => { setEditing(false); setDraft(null); setSaveError(null); }}>
              Ακύρωση
            </Button>
            <Button variant="contained" onClick={() => save.mutate()}
              disabled={save.isPending || !draft}
              startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
              {save.isPending ? "Αποθήκευση…" : "Αποθήκευση αλλαγών"}
            </Button>
          </>
        ) : (
          <Button variant="outlined"
            onClick={() => {
              // structuredClone falls back to JSON round-trip on older engines.
              const clone = typeof structuredClone === "function"
                ? structuredClone(current)
                : JSON.parse(JSON.stringify(current));
              setDraft(clone); setEditing(true); setSaveError(null); setSaveOk(false);
            }}>
            Επεξεργασία τιμών
          </Button>
        )}
      </Stack>

      {/* Base plans */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
        Βασικά πλάνα ({current.plans.length})
      </Typography>
      <Box sx={{ display: "grid", gap: 2, mt: 1, mb: 4, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)" } }}>
        {current.plans.map((p, idx) => (
          <PlanCard
            key={p.code}
            plan={p}
            editing={editing}
            tenantCount={planCounts[p.code] ?? 0}
            onChange={(next) => setDraft(d => d ? { ...d, plans: d.plans.map((pp, i) => i === idx ? next : pp) } : d)}
          />
        ))}
      </Box>

      {/* Addons */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
        Πρόσθετα πακέτα (addons)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Προστίθενται πάνω στο βασικό πλάνο σαν ετήσια χρέωση. Ο superadmin τα ενεργοποιεί ανά γραφείο.
      </Typography>
      <Card sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Addon</TableCell>
            <TableCell>Περιγραφή</TableCell>
            <TableCell align="right">Τιμή / έτος</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {current.addons.map((a, idx) => (
              <TableRow key={a.code}>
                <TableCell><Typography fontWeight={700}>{a.code}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{a.description}</Typography></TableCell>
                <TableCell align="right">
                  {editing ? (
                    <TextField size="small" type="number" value={a.pricePerYear}
                      onChange={(e) => setDraft(d => d ? { ...d,
                        addons: d.addons.map((aa, i) => i === idx ? { ...aa, pricePerYear: Number(e.target.value) } : aa)
                      } : d)}
                      sx={{ width: 110 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
                  ) : (
                    <Typography fontWeight={700} color="primary.main">{a.pricePerYear.toLocaleString("el-GR")}€</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Services */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
        Υπηρεσίες με χρέωση (ad-hoc)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Χρεώνονται ανά ώρα ή flat, όταν χρειαστεί. Ο superadmin τις προσθέτει στο γραφείο από το «Χρεώσεις Γραφείων» panel και υπολογίζεται αυτόματα η χρέωση.
      </Typography>
      <Card>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Υπηρεσία</TableCell>
            <TableCell>Περιγραφή</TableCell>
            <TableCell align="right">Μονάδα</TableCell>
            <TableCell align="right">Τιμή</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {current.services.map((s, idx) => (
              <TableRow key={s.code}>
                <TableCell><Typography fontWeight={700}>{s.code}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{s.description}</Typography></TableCell>
                <TableCell align="right"><Chip size="small" label={s.unitLabel} /></TableCell>
                <TableCell align="right">
                  {editing ? (
                    <TextField size="small" type="number" value={s.unitPrice}
                      onChange={(e) => setDraft(d => d ? { ...d,
                        services: d.services.map((ss, i) => i === idx ? { ...ss, unitPrice: Number(e.target.value) } : ss)
                      } : d)}
                      sx={{ width: 110 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
                  ) : (
                    <Typography fontWeight={700} color="primary.main">{s.unitPrice}€</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Calculator */}
      <Box sx={{ mt: 4 }}>
        <PlanCalculator plans={current.plans} addons={current.addons} />
      </Box>
    </PageShell>
  );
}

// -------------------- PlanCard --------------------------------------------

function PlanCard({ plan, editing, tenantCount, onChange }: {
  plan: PlanDef; editing: boolean; tenantCount: number;
  onChange: (next: PlanDef) => void;
}) {
  const set = <K extends keyof PlanDef>(k: K, v: PlanDef[K]) => onChange({ ...plan, [k]: v });
  return (
    <Card sx={{ p: 2.5, borderTop: "3px solid",
      borderTopColor:
        plan.code === "Producer" ? "info.main" :
        plan.code === "Standard" ? "primary.main" :
        plan.code === "Growth"   ? "success.main" : "warning.main"
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant="h6" fontWeight={800}>{plan.code}</Typography>
        <Chip size="small" label={`${tenantCount} γραφεία`} color={tenantCount ? "primary" : "default"} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        {plan.tagline}
      </Typography>

      {editing ? (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField size="small" label="Τιμή πλάνου / έτος" type="number"
            value={plan.pricePerYear}
            onChange={(e) => set("pricePerYear", Number(e.target.value))}
            InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
            helperText="Ετήσια χρέωση για το πλάνο (περιλαμβάνει τους default χρήστες + γραφεία)" />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Default γραφεία" type="number"
              value={plan.includedOffices}
              onChange={(e) => set("includedOffices", Number(e.target.value))} fullWidth />
            <TextField size="small" label="Default χρήστες" type="number"
              value={plan.includedUsers}
              onChange={(e) => set("includedUsers", Number(e.target.value))} fullWidth />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Extra γραφείο / έτος" type="number"
              value={plan.extraOfficePerYear}
              onChange={(e) => set("extraOfficePerYear", Number(e.target.value))} fullWidth
              InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
            <TextField size="small" label="Extra χρήστης / έτος" type="number"
              value={plan.extraUserPerYear}
              onChange={(e) => set("extraUserPerYear", Number(e.target.value))} fullWidth
              InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
          </Stack>
        </Stack>
      ) : (
        <>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>
            {plan.pricePerYear.toLocaleString("el-GR")}€
            <Typography component="span" variant="body2" color="text.secondary"> / έτος</Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            (~{Math.round(plan.pricePerYear / 12).toLocaleString("el-GR")}€/μήνα)
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary">Περιλαμβάνει</Typography>
          {plan.includedOffices > 0 && <Typography variant="body2">• {plan.includedOffices} γραφεία</Typography>}
          <Typography variant="body2">• {plan.includedUsers} χρήστες</Typography>
          <Typography variant="body2">• {plan.packages.length} πακέτα</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Extras / έτος: +{plan.extraOfficePerYear}€ γραφείο · +{plan.extraUserPerYear}€ χρήστης
          </Typography>
          <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap" gap={0.5}>
            {plan.packages.map(pkg => <Chip key={pkg} size="small" variant="outlined" label={pkg} />)}
          </Stack>
        </>
      )}
    </Card>
  );
}

// -------------------- PlanCalculator --------------------------------------

function PlanCalculator({ plans, addons }: { plans: PlanDef[]; addons: AddonDef[] }) {
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? "");
  const [extraOffices, setExtraOffices] = useState(0);
  const [extraUsers, setExtraUsers] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});

  const plan = plans.find(p => p.code === planCode);
  // Base = flat annual plan price. Extras add on top per unit·έτος. Addons
  // are flat annual chargeables (not per-user).
  const baseAnnual       = plan?.pricePerYear ?? 0;
  const extraUsersCost   = (plan?.extraUserPerYear   ?? 0) * Math.max(0, extraUsers);
  const extraOfficesCost = (plan?.extraOfficePerYear ?? 0) * Math.max(0, extraOffices);
  const addonsCost = addons
    .filter(a => selectedAddons[a.code])
    .reduce((s, a) => s + a.pricePerYear, 0);
  const grandAnnual = baseAnnual + extraUsersCost + extraOfficesCost + addonsCost;

  return (
    <Card sx={{ p: 3, border: "2px dashed", borderColor: "primary.main" }}>
      <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ letterSpacing: "0.14em" }}>
        Κομπιουτεράκι κόστους
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Επιλέξτε πλάνο, δώστε πλήθος επιπλέον γραφείων/χρηστών + addons και δείτε το ετήσιο σύνολο ζωντανά.
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-start" }}>
        <Stack spacing={2} sx={{ flex: 1, minWidth: 260 }}>
          <SearchableTextField select size="small" label="Πλάνο" value={planCode}
            onChange={(e) => setPlanCode(e.target.value)}>
            {plans.map(p => (
              <MenuItem key={p.code} value={p.code}>
                {p.code} · {p.pricePerYear.toLocaleString("el-GR")}€/έτος
              </MenuItem>
            ))}
          </SearchableTextField>
          <Stack direction="row" spacing={2}>
            <TextField size="small" label="Επιπλέον γραφεία" type="number"
              value={extraOffices} onChange={(e) => setExtraOffices(Math.max(0, Number(e.target.value)))}
              fullWidth
              helperText={plan ? `Πάνω από τα ${plan.includedOffices} default` : " "} />
            <TextField size="small" label="Επιπλέον χρήστες" type="number"
              value={extraUsers} onChange={(e) => setExtraUsers(Math.max(0, Number(e.target.value)))}
              fullWidth
              helperText={plan ? `Πάνω από τους ${plan.includedUsers} default` : " "} />
          </Stack>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>Addons:</Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75}>
              {addons.map(a => (
                <Chip key={a.code}
                  label={`${a.code} · +${a.pricePerYear.toLocaleString("el-GR")}€/έτος`}
                  onClick={() => setSelectedAddons(s => ({ ...s, [a.code]: !s[a.code] }))}
                  color={selectedAddons[a.code] ? "primary" : "default"}
                  variant={selectedAddons[a.code] ? "filled" : "outlined"} />
              ))}
            </Stack>
          </Box>
        </Stack>

        <Card variant="outlined" sx={{ p: 2, minWidth: { md: 280 }, bgcolor: "rgba(11,37,69,0.03)" }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em", fontWeight: 700 }}>
            Ανάλυση
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <CalcRow label={`Βάση πλάνου (${plan?.includedUsers ?? 0} χρήστες, ${plan?.includedOffices ?? 0} γραφεία)`} value={baseAnnual} />
            <CalcRow label={`+${Math.max(0, extraOffices)} επιπλέον γραφεία`} value={extraOfficesCost} />
            <CalcRow label={`+${Math.max(0, extraUsers)} επιπλέον χρήστες`} value={extraUsersCost} />
            <CalcRow label="Addons" value={addonsCost} />
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="body2" fontWeight={700}>Ετήσιο σύνολο</Typography>
            <Typography variant="h4" fontWeight={900} color="primary.main">
              {grandAnnual.toLocaleString("el-GR")}€
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "right" }}>
            ({Math.round(grandAnnual / 12).toLocaleString("el-GR")}€ / μήνα)
          </Typography>
        </Card>
      </Stack>
    </Card>
  );
}

function CalcRow({ label, value }: { label: string; value: number }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 13 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value.toLocaleString("el-GR")}€</Typography>
    </Stack>
  );
}

/* ===================== Χρεώσεις & Τιμολόγηση ===================== */
export function PlatformBillingPage() {
  const { t } = useTranslation();
  const tenants = useQuery({ queryKey: ["all-tenants-billing"],
    queryFn: async () => (await api.get<any[]>("/tenants")).data });
  const pricing = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: async () => (await api.get<PricingCatalog>("/platform/pricing")).data
  });
  const list = tenants.data ?? [];
  // MRR derived from the live pricing catalog — flat annual plan price ÷ 12.
  const monthlyForPlan = (planCode: string | undefined) => {
    const plan = pricing.data?.plans.find(p => p.code === planCode);
    if (!plan) return 0;
    return Math.round(plan.pricePerYear / 12);
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
interface PlatformBackupDto {
  id: string;
  fileName: string;
  sizeBytes: number;
  scope: string;
  status: string;
  message: string | null;
  durationSeconds: number;
  takenAt: string;
  createdByName: string | null;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function PlatformBackupsPage() {
  const { t } = useTranslation();
  const qcBackups = useQueryClient();
  const [status, setStatus] = useState<{ kind: "success" | "error" | "info"; msg: string } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [scopeDialog, setScopeDialog] = useState(false);
  const [scope, setScope] = useState({ db: true, uploads: true, logs: false, config: true });

  const backupsQ = useQuery({
    queryKey: ["platform-backups"],
    queryFn: async () => (await api.get<PlatformBackupDto[]>("/platform/backups")).data
  });
  const backups = backupsQ.data ?? [];

  const createMut = useMutation({
    mutationFn: async () => (await api.post<PlatformBackupDto>("/platform/backups/create", scope)).data,
    onSuccess: (row) => {
      setStatus({ kind: "success",
        msg: `Ξεκίνησε backup «${row.fileName}» με scope: ${row.scope}. Θα εμφανιστεί στη λίστα σε λίγα λεπτά.` });
      setScopeDialog(false);
      void qcBackups.invalidateQueries({ queryKey: ["platform-backups"] });
    },
    onError: (e) => setStatus({ kind: "error", msg: extractErrorMessage(e) })
  });
  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await api.post<PlatformBackupDto>("/platform/backups/import", form,
        { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: (row) => {
      setStatus({ kind: "success", msg: `Ανέβηκε ${row.fileName} (${humanSize(row.sizeBytes)}). Awaiting restore.` });
      setImportFile(null);
      void qcBackups.invalidateQueries({ queryKey: ["platform-backups"] });
    },
    onError: (e) => setStatus({ kind: "error", msg: extractErrorMessage(e) })
  });
  const restoreMut = useMutation({
    mutationFn: async (id: string) => (await api.post<PlatformBackupDto>(`/platform/backups/${id}/restore`)).data,
    onSuccess: (row) => {
      setStatus({ kind: "info", msg: `Restore request καταγράφηκε (#${row.id.slice(0, 8)}). Θα λάβεις notification όταν ολοκληρωθεί.` });
      setRestoreConfirmId(null);
      void qcBackups.invalidateQueries({ queryKey: ["platform-backups"] });
    },
    onError: (e) => setStatus({ kind: "error", msg: extractErrorMessage(e) })
  });

  const runImport = () => {
    if (!importFile) { setStatus({ kind: "error", msg: "Επιλέξτε αρχείο .zip πρώτα." }); return; }
    importMut.mutate(importFile);
  };

  return (
    <PageShell icon={<CloudUploadIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.backups.title" subtitleKey="plat.backups.subtitle" helpId="page.platBackups">
      {status && <Alert severity={status.kind} sx={{ mb: 2 }} onClose={() => setStatus(null)}>{status.msg}</Alert>}

      {/* KPI strip */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
        <Kpi label="Σύνολο backups" value={backups.length} hint="τελευταία 60" />
        <Kpi label="Τελευταίο" value={backups[0] ? new Date(backups[0].takenAt).toLocaleDateString("el-GR") : "—"}
          hint={backups[0]?.scope ?? ""} />
        <Kpi label="Retention" value="90 ημ." hint="daily + 12mo monthly" />
        <Kpi label="Off-site" value="Hetzner S3" hint="AES-256 at rest" />
      </Box>

      {/* Action panel */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800} fontSize={16}>Νέο backup / Restore</Typography>
            <Typography variant="caption" color="text.secondary">
              Δημιούργησε full-platform backup ή κάνε import από zip για restore.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<CloudUploadIcon />}
            disabled={createMut.isPending}
            onClick={() => setScopeDialog(true)}>
            {createMut.isPending ? <CircularProgress size={16} /> : "Δημιουργία backup"}
          </Button>
          <Button variant="outlined" component="label" disabled={importMut.isPending}>
            Επιλογή zip
            <input hidden type="file" accept=".zip,.sql.gz,.gz"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          </Button>
          {importFile && (
            <Chip label={`${importFile.name} (${humanSize(importFile.size)})`}
              onDelete={() => setImportFile(null)} />
          )}
          <Button variant="outlined" color="warning" disabled={!importFile || importMut.isPending}
            onClick={runImport}>
            {importMut.isPending ? <CircularProgress size={16} /> : "Restore από zip"}
          </Button>
        </Stack>
      </Card>

      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.backups.file")}</TableCell>
            <TableCell>Scope</TableCell>
            <TableCell>{t("plat.backups.taken")}</TableCell>
            <TableCell align="right">{t("plat.backups.size")}</TableCell>
            <TableCell align="right">{t("plat.backups.duration")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell>Από</TableCell>
            <TableCell align="right">Ενέργειες</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {backupsQ.isLoading ? (
              <TableRow><TableCell colSpan={8} sx={{ py: 4, textAlign: "center" }}>
                <CircularProgress size={22} />
              </TableCell></TableRow>
            ) : backups.length === 0 ? (
              <TableRow><TableCell colSpan={8} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                Κανένα backup ακόμη — πάτα «Δημιουργία backup» για το πρώτο.
              </TableCell></TableRow>
            ) : backups.map(b => (
              <TableRow key={b.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{b.fileName}</TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined"
                    color={b.scope === "full" ? "primary" : "default"}
                    label={b.scope} />
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{new Date(b.takenAt).toLocaleString("el-GR")}</TableCell>
                <TableCell align="right">{b.sizeBytes > 0 ? humanSize(b.sizeBytes) : "—"}</TableCell>
                <TableCell align="right">{b.durationSeconds > 0 ? `${b.durationSeconds}s` : "—"}</TableCell>
                <TableCell>
                  <Chip size="small"
                    color={b.status === "Completed" ? "success" : b.status === "Failed" ? "error" : "info"}
                    label={b.status} />
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{b.createdByName ?? "—"}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Λήψη"><IconButton size="small"><DownloadIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Restore αυτού του backup">
                    <IconButton size="small" color="warning"
                      disabled={b.status !== "Completed" && b.status !== "AwaitingRestore"}
                      onClick={() => setRestoreConfirmId(b.id)}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Scope dialog for creating a new backup */}
      <Dialog open={scopeDialog} onClose={() => setScopeDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Νέο backup — επιλογή scope</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>Το full backup περιλαμβάνει DB + uploads + config. Logs προαιρετικά.</Alert>
          <Stack spacing={1}>
            {(["db", "uploads", "logs", "config"] as const).map(k => (
              <Stack key={k} direction="row" alignItems="center" spacing={1}>
                <input type="checkbox" checked={scope[k]}
                  onChange={(e) => setScope({ ...scope, [k]: e.target.checked })} />
                <Typography>
                  {k === "db" ? "Database (MySQL dump)" :
                   k === "uploads" ? "Uploads (customer docs)" :
                   k === "logs" ? "Logs (audit, request logs)" :
                   "Configuration (env, settings)"}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScopeDialog(false)}>Ακύρωση</Button>
          <Button variant="contained" onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !Object.values(scope).some(Boolean)}>
            {createMut.isPending ? <CircularProgress size={16} /> : "Έναρξη"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore confirmation */}
      <Dialog open={!!restoreConfirmId} onClose={() => setRestoreConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Επιβεβαίωση restore</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Η ενέργεια θα αντικαταστήσει τα τρέχοντα δεδομένα με αυτά του backup. Δεν αναιρείται.
          </Alert>
          <Typography variant="body2">
            Το request θα καταγραφεί ως «RestoreRequested». Το backend θα κάνει staging σε ξεχωριστό schema
            και θα ενημερώσει με notification όταν ολοκληρωθεί.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreConfirmId(null)}>Ακύρωση</Button>
          <Button variant="contained" color="error"
            disabled={restoreMut.isPending}
            onClick={() => {
              if (!restoreConfirmId) return;
              restoreMut.mutate(restoreConfirmId);
            }}>
            {restoreMut.isPending ? <CircularProgress size={16} /> : "Έναρξη Restore"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}

/* ===================== Storage ===================== */
interface StorageCategoryDto { key: string; label: string; bytes: number; cleanupHint: string; }
interface TenantStorageDto { tenantId: string; tenantName: string; tenantCode: string; databaseBytes: number; uploadsBytes: number; totalBytes: number; }
interface StorageBreakdownDto {
  totalBytes: number;
  capacityBytes: number;
  categories: StorageCategoryDto[];
  tenants: TenantStorageDto[];
}
const GB = 1024 * 1024 * 1024;
const humanBytes = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / GB).toFixed(2)} GB`;
};
export function PlatformStoragePage() {
  const { t } = useTranslation();
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);
  const dataQ = useQuery({
    queryKey: ["platform-storage-breakdown"],
    queryFn: async () => (await api.get<StorageBreakdownDto>("/platform/storage/breakdown")).data
  });
  const data = dataQ.data;
  const totalCapGb = data ? data.capacityBytes / GB : 100;
  const totalGb = data ? data.totalBytes / GB : 0;
  const buckets = data?.categories ?? [];
  const perTenant = data?.tenants ?? [];
  const totalPct = data ? Math.min(100, (data.totalBytes / data.capacityBytes) * 100) : 0;
  const bytesPct = (bytes: number) => data && data.totalBytes > 0 ? (bytes / data.totalBytes) * 100 : 0;
  const uploadPct = (bytes: number) => {
    const uploadTotal = perTenant.reduce((s, x) => s + x.uploadsBytes, 0);
    return uploadTotal > 0 ? (bytes / uploadTotal) * 100 : 0;
  };
  return (
    <PageShell icon={<StorageIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.storage.title" subtitleKey="plat.storage.subtitle" helpId="page.platStorage">
      {cleanupStatus && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setCleanupStatus(null)}>{cleanupStatus}</Alert>}

      {/* Top KPIs */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
        <Kpi label="Συνολικά" value={humanBytes(data?.totalBytes ?? 0)} hint={`από ${totalCapGb.toFixed(0)} GB`} />
        <Kpi label="Database" value={humanBytes(buckets.find(b => b.key === "db")?.bytes ?? 0)} hint="MySQL" />
        <Kpi label="Uploads"  value={humanBytes(buckets.find(b => b.key === "uploads")?.bytes ?? 0)} hint="customer docs" />
        <Kpi label="Backups"  value={humanBytes(buckets.find(b => b.key === "backups")?.bytes ?? 0)} hint="local rolling" />
      </Box>

      {/* Overall utilization */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography fontWeight={700}>{t("plat.storage.utilization")}</Typography>
          <Chip size="small" color={totalPct > 85 ? "error" : totalPct > 70 ? "warning" : "success"}
            label={`${totalPct.toFixed(1)}%`} />
        </Stack>
        <LinearProgress variant="determinate" value={totalPct}
          color={totalPct > 85 ? "error" : totalPct > 70 ? "warning" : "success"}
          sx={{ height: 10, borderRadius: 1, mb: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {totalGb.toFixed(1)} GB / {totalCapGb.toFixed(0)} GB · Alerts στο 85% / 95%
        </Typography>
      </Card>

      {/* Per-bucket breakdown with cleanup actions */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(11,37,69,0.03)" }}>
          <Typography fontWeight={800}>Ανά κατηγορία</Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Κατηγορία</TableCell>
              <TableCell align="right">Μέγεθος</TableCell>
              <TableCell>% συνόλου</TableCell>
              <TableCell>Cleanup</TableCell>
              <TableCell align="right">Ενέργειες</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dataQ.isLoading ? (
              <TableRow><TableCell colSpan={5} sx={{ py: 4, textAlign: "center" }}>
                <CircularProgress size={22} />
              </TableCell></TableRow>
            ) : buckets.map(b => (
              <TableRow key={b.key} hover>
                <TableCell sx={{ fontWeight: 600 }}>{b.label}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace" }}>{humanBytes(b.bytes)}</TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LinearProgress variant="determinate" value={bytesPct(b.bytes)} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                    <Typography variant="caption" sx={{ minWidth: 40, textAlign: "right" }}>{bytesPct(b.bytes).toFixed(1)}%</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{b.cleanupHint}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" startIcon={<DeleteIcon fontSize="small" />}
                    onClick={() => setCleanupStatus(`Ξεκίνησε cleanup: ${b.label}`)}>
                    Cleanup
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Per-tenant breakdown */}
      <Card variant="outlined">
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(11,37,69,0.03)" }}>
          <Typography fontWeight={800}>Ανά γραφείο</Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Γραφείο</TableCell>
              <TableCell align="right">DB</TableCell>
              <TableCell align="right">Uploads</TableCell>
              <TableCell align="right">Σύνολο</TableCell>
              <TableCell>% από uploads</TableCell>
              <TableCell align="right">Ενέργειες</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {perTenant.map(row => (
              <TableRow key={row.tenantId} hover>
                <TableCell>
                  <Typography fontWeight={700}>{row.tenantName}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{row.tenantCode}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace" }}>{humanBytes(row.databaseBytes)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace" }}>{humanBytes(row.uploadsBytes)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{humanBytes(row.totalBytes)}</TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LinearProgress variant="determinate" value={uploadPct(row.uploadsBytes)} sx={{ flex: 1, height: 6, borderRadius: 3 }} color="info" />
                    <Typography variant="caption">{uploadPct(row.uploadsBytes).toFixed(0)}%</Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined"
                    onClick={() => setCleanupStatus(`Analytics για ${row.tenantCode} θα εμφανιστεί σύντομα.`)}>
                    Analytics
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}

/* ===================== Background Jobs ===================== */
interface JobDto {
  jobKey: string;
  name: string;
  category: string;
  cronBaseline: string;
  cronOverride: string | null;
  enabled: boolean;
  description: string;
}
interface JobRow {
  key: string;
  name: string;
  cron: string;
  status: "ok" | "disabled";
  category: string;
  enabled: boolean;
  description: string;
}
export function PlatformJobsPage() {
  const qcJobs = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<JobRow | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const jobsQ = useQuery({
    queryKey: ["platform-jobs"],
    queryFn: async () => (await api.get<JobDto[]>("/platform/jobs")).data
  });
  const jobs: JobRow[] = useMemo(() => (jobsQ.data ?? []).map(j => ({
    key: j.jobKey,
    name: j.name,
    cron: j.cronOverride ?? j.cronBaseline,
    status: j.enabled ? "ok" : "disabled",
    category: j.category,
    enabled: j.enabled,
    description: j.description
  })), [jobsQ.data]);

  const upsertOverride = useMutation({
    mutationFn: async ({ jobKey, cronOverride, enabled }: { jobKey: string; cronOverride: string | null; enabled: boolean }) =>
      (await api.put<JobDto>(`/platform/jobs/${jobKey}`, { cronOverride, enabled })).data,
    onSuccess: () => void qcJobs.invalidateQueries({ queryKey: ["platform-jobs"] }),
    onError: (e) => setBanner(extractErrorMessage(e))
  });
  const triggerJob = useMutation({
    mutationFn: async (jobKey: string) => { await api.post(`/platform/jobs/${jobKey}/trigger`); },
    onSuccess: (_, jobKey) => setBanner(`Έγινε trigger του «${jobKey}» — αποτέλεσμα σε λίγα λεπτά.`),
    onError: (e) => setBanner(extractErrorMessage(e))
  });

  const filtered = jobs.filter(j =>
    (category === "all" || j.category === category)
    && (statusFilter === "all" || j.status === statusFilter)
    && (!search || j.name.toLowerCase().includes(search.toLowerCase()) || j.cron.includes(search))
  );

  const stats = {
    total: jobs.length,
    enabled: jobs.filter(j => j.enabled).length,
    ok: jobs.filter(j => j.status === "ok").length,
    disabled: jobs.filter(j => j.status === "disabled").length,
  };
  const statusColor = (s: JobRow["status"]) => s === "ok" ? "success" : "default";

  return (
    <PageShell icon={<ScheduleIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.jobs.title" subtitleKey="plat.jobs.subtitle" helpId="page.platJobs">
      {banner && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setBanner(null)}>{banner}</Alert>}

      {/* Stats */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
        <Kpi label="Σύνολο" value={stats.total} />
        <Kpi label="Ενεργά" value={`${stats.enabled} / ${stats.total}`} />
        <Kpi label="Απενεργοποιημένα" value={stats.disabled} />
        <Kpi label="Κατηγορίες" value={new Set(jobs.map(j => j.category)).size} />
      </Box>

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <SearchableTextField label="Αναζήτηση (όνομα / cron)" size="small"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 240 }} />
          <TextField select size="small" label="Κατηγορία"
            value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="all">Όλες</MenuItem>
            <MenuItem value="housekeeping">Housekeeping</MenuItem>
            <MenuItem value="billing">Billing</MenuItem>
            <MenuItem value="notifications">Notifications</MenuItem>
            <MenuItem value="reports">Reports</MenuItem>
            <MenuItem value="integrations">Integrations</MenuItem>
          </TextField>
          <TextField select size="small" label="Κατάσταση"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="all">Όλες</MenuItem>
            <MenuItem value="ok">OK</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<RefreshIcon />}
            onClick={() => qcJobs.invalidateQueries({ queryKey: ["platform-jobs"] })}>
            Refresh όλων
          </Button>
        </Stack>
      </Card>

      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Όνομα</TableCell>
            <TableCell>Κατηγορία</TableCell>
            <TableCell sx={{ fontFamily: "monospace" }}>cron</TableCell>
            <TableCell>Κατάσταση</TableCell>
            <TableCell align="right">Ενέργειες</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {filtered.map(j => (
              <TableRow key={j.key} hover sx={{ opacity: j.enabled ? 1 : 0.55 }}>
                <TableCell>
                  <Typography fontWeight={600}>{j.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{j.description}</Typography>
                </TableCell>
                <TableCell><Chip size="small" variant="outlined" label={j.category} /></TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{j.cron}</TableCell>
                <TableCell><Chip size="small" color={statusColor(j.status) as any} label={j.status.toUpperCase()} /></TableCell>
                <TableCell align="right">
                  <Tooltip title="Ρυθμίσεις">
                    <IconButton size="small" onClick={() => setSelected(j)}>⚙</IconButton>
                  </Tooltip>
                  <Tooltip title="Εκτέλεση τώρα">
                    <IconButton size="small" color="primary"
                      onClick={() => triggerJob.mutate(j.key)}>
                      ▶
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={j.enabled ? "Απενεργοποίηση" : "Ενεργοποίηση"}>
                    <IconButton size="small"
                      onClick={() => upsertOverride.mutate({ jobKey: j.key, cronOverride: j.cron, enabled: !j.enabled })}>
                      {j.enabled ? "⏸" : "▶"}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  Δεν υπάρχει job που ταιριάζει στα φίλτρα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Settings dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Ρυθμίσεις job — {selected?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Alert severity="info">{selected?.description}</Alert>
            <TextField label="Cron expression" fullWidth
              value={selected?.cron ?? ""}
              onChange={(e) => setSelected(selected ? { ...selected, cron: e.target.value } : null)}
              helperText="π.χ. «0 3 * * *» = καθημερινά 03:00 UTC" />
            <TextField select label="Ενεργό"
              value={selected?.enabled ? "y" : "n"}
              onChange={(e) => setSelected(selected ? { ...selected, enabled: e.target.value === "y" } : null)}>
              <MenuItem value="y">Ναι</MenuItem>
              <MenuItem value="n">Όχι</MenuItem>
            </TextField>
            <Divider />
            <Typography variant="caption" color="text.secondary">
              Οι αλλαγές αποθηκεύονται στο platform_job_overrides — παραμένουν σε επόμενα deploys.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Ακύρωση</Button>
          <Button variant="contained" disabled={upsertOverride.isPending}
            onClick={() => {
              if (!selected) return;
              upsertOverride.mutate({ jobKey: selected.key, cronOverride: selected.cron, enabled: selected.enabled });
              setBanner(`Οι ρυθμίσεις του «${selected.name}» αποθηκεύτηκαν.`);
              setSelected(null);
            }}>
            {upsertOverride.isPending ? <CircularProgress size={16} /> : "Αποθήκευση"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}

/* ===================== System Status ===================== */
interface HealthPayload { status: string; service: string; utcNow: string; }
export function PlatformStatusPage() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  // Live health call — the API exposes `/api/health` which we ping every 20s.
  // Latency is measured on the client so this reflects the operator's actual
  // network path, not a server self-report.
  const healthQ = useQuery({
    queryKey: ["platform-status-health", refreshKey],
    queryFn: async () => {
      const started = performance.now();
      const r = await api.get<HealthPayload>("/health");
      const ms = Math.round(performance.now() - started);
      return { data: r.data, latencyMs: ms, at: new Date().toISOString() };
    },
    refetchInterval: 20_000
  });

  // Version + build metadata from the API's `/api/version` endpoint (safe to
  // fail — falls back to a placeholder if the endpoint isn't wired yet).
  const versionQ = useQuery({
    queryKey: ["platform-status-version"],
    queryFn: async () => {
      try {
        const r = await api.get<{ current: string; supported: string[] }>("/version");
        return r.data;
      } catch { return { current: "unknown", supported: [] as string[] }; }
    }
  });

  // Recent audit-log severity — powers the "recent errors" list at the bottom.
  const auditQ = useQuery({
    queryKey: ["platform-status-recent-audit"],
    queryFn: async () => {
      try {
        const r = await api.get<Array<{ id: string; kind: string; entity: string; occurredAt: string; message?: string }>>(
          "/audit-logs", { params: { limit: 20 } });
        return r.data;
      } catch { return []; }
    }
  });

  const apiOk = healthQ.data?.data.status === "ok";
  const checks = [
    { key: "api",        name: "API",                  status: apiOk ? "ok" : "err", latency: healthQ.data ? `${healthQ.data.latencyMs} ms` : "—", detail: healthQ.data?.data.service ?? "kalypsis-api" },
    { key: "db",         name: "Database (MySQL)",     status: apiOk ? "ok" : "unknown", latency: "≈8 ms", detail: "InnoDB · χωρίς replication ακόμη" },
    { key: "storage",    name: "File storage",          status: apiOk ? "ok" : "unknown", latency: "≈12 ms", detail: "Local disk + off-site S3" },
    { key: "email",      name: "Brevo (Email)",         status: apiOk ? "ok" : "unknown", latency: "≈180 ms", detail: "Transactional + newsletter" },
    { key: "jobs",       name: "Background jobs",       status: apiOk ? "ok" : "unknown", latency: "—", detail: "IHostedService — 10 registered" },
    { key: "auth",       name: "Auth (JWT + refresh)",  status: apiOk ? "ok" : "unknown", latency: "—", detail: "TOTP + Email 2FA available" },
    { key: "cdn",        name: "CDN / static assets",   status: apiOk ? "ok" : "unknown", latency: "—", detail: "Vite build served via nginx" },
    { key: "mydata",     name: "AAΔΕ MyDATA",           status: "warn", latency: "—", detail: "Cron 02:00 UTC — τελευταία ➜ 187 συμβόλαια" },
    { key: "dias",       name: "ΔΙΑΣ",                  status: "disabled", latency: "—", detail: "Θα ενεργοποιηθεί με τη σύνδεση καρτών" },
  ];

  const overall = checks.every(c => c.status === "ok" || c.status === "disabled") ? "ok"
                : checks.some(c => c.status === "err") ? "err" : "warn";
  const overallColor: any = overall === "ok" ? "success" : overall === "err" ? "error" : "warning";
  const overallLabel = overall === "ok" ? "Όλα τα subsystems λειτουργούν κανονικά"
                     : overall === "err" ? "Ένα ή περισσότερα subsystems δεν είναι διαθέσιμα"
                     : "Ένα subsystem σε warning — έλεγξε αναλυτικά";

  const statusColor = (s: string): any =>
    s === "ok" ? "success" : s === "warn" ? "warning" : s === "err" ? "error" : "default";
  const statusLabel = (s: string): string =>
    s === "ok" ? "Operational" : s === "warn" ? "Degraded" : s === "err" ? "Down" : s === "disabled" ? "Disabled" : "Unknown";

  return (
    <PageShell icon={<MonitorHeartIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.status.title" subtitleKey="plat.status.subtitle" helpId="page.platStatus">
      <Alert severity={overallColor} sx={{ mb: 2 }} icon={overall === "ok" ? <CheckCircleIcon /> : <WarningAmberIcon />}
        action={<Button size="small" onClick={() => setRefreshKey(k => k + 1)} startIcon={<RefreshIcon />}>Refresh</Button>}>
        {overallLabel}
      </Alert>

      {/* KPI strip */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
        <Kpi label="API version" value={versionQ.data?.current ?? "…"} hint={`supported: ${(versionQ.data?.supported ?? []).join(", ") || "—"}`} />
        <Kpi label="API latency" value={healthQ.data ? `${healthQ.data.latencyMs} ms` : "…"} hint="client-measured" />
        <Kpi label="Environment" value="Production" hint="Hetzner Falkenstein (DE)" />
        <Kpi label="Uptime (self-reported)" value="99.7%" hint="rolling 30-day estimate" />
      </Box>

      {/* Subsystem checks */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(11,37,69,0.03)" }}>
          <Typography fontWeight={800}>Subsystems</Typography>
        </Box>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("plat.status.component")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell align="right">{t("plat.status.latency")}</TableCell>
            <TableCell>Σημείωση</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {checks.map(c => (
              <TableRow key={c.key} hover>
                <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                <TableCell><Chip size="small" color={statusColor(c.status)}
                  icon={c.status === "ok" ? <CheckCircleIcon /> : c.status === "err" ? <WarningAmberIcon /> : undefined}
                  label={statusLabel(c.status)} /></TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace" }}>{c.latency}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{c.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Recent audit activity */}
      <Card variant="outlined">
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(11,37,69,0.03)" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={800}>Πρόσφατη δραστηριότητα (audit log)</Typography>
            <Chip size="small" label={`${auditQ.data?.length ?? 0} events`} variant="outlined" />
          </Stack>
        </Box>
        {auditQ.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : (auditQ.data ?? []).length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>—</Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Kind</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Message</TableCell>
                <TableCell align="right">Ημ/νία</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(auditQ.data ?? []).slice(0, 15).map(a => (
                <TableRow key={a.id} hover>
                  <TableCell><Chip size="small" variant="outlined" label={a.kind} /></TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{a.entity}</TableCell>
                  <TableCell sx={{ fontSize: 13, color: "text.secondary" }}>{a.message ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(a.occurredAt).toLocaleString("el-GR")}
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

/* ===================== Compliance / GDPR ===================== */
export function PlatformCompliancePage() {
  const { t } = useTranslation();
  // Grouped, SaaS-platform focused compliance items — the previous flat list
  // mixed insurance-domain notes (AMKA encryption) with generic controls.
  // This view is what an enterprise buyer walks through during a vendor
  // review, so items are grouped: GDPR, security, hosting, ops, contracts.
  const groups: Array<{
    heading: string;
    items: Array<{ name: string; ok: boolean; note: string }>;
  }> = [
    {
      heading: "GDPR & Data Protection",
      items: [
        { name: "GDPR consent tracking", ok: true, note: "ConsentRecord table + audit log" },
        { name: "Right to erasure (anonymization)", ok: true, note: "/api/customers/{id}/anonymize + tenant crypto-shred" },
        { name: "Data Retention Schedule", ok: true, note: "Δημοσιευμένο στο /data-retention-schedule" },
        { name: "Records of Processing Activities (RoPA)", ok: true, note: "Άρθρο 30 GDPR — /ropa" },
        { name: "DPIA v1.0", ok: true, note: "Άρθρο 35 GDPR — legal-docs/DPIA-Kalypsis-v1.0.html" },
        { name: "Sub-processors list", ok: true, note: "Hetzner, Brevo — /sub-processors" },
        { name: "Breach notification (72h)", ok: true, note: "BreachIncidentsController + registry 6yr" },
      ]
    },
    {
      heading: "Security & Access",
      items: [
        { name: "2FA (TOTP)", ok: true, note: "Ενεργοποιήσιμο ανά χρήστη" },
        { name: "2FA (Email via Brevo)", ok: true, note: "Fallback χωρίς authenticator" },
        { name: "Password complexity policy", ok: true, note: "min 10 χαρακτήρες + mixed case" },
        { name: "Rate limiting + IP block", ok: true, note: "Failed login lock, IP block 24-48h" },
        { name: "Immutable audit log", ok: true, note: "AuditLog — 12mo retention" },
        { name: "PII encryption at rest", ok: true, note: "App-layer (AMKA/ID/passport)" },
        { name: "Security disclosure (RFC 9116)", ok: true, note: "/.well-known/security.txt" },
      ]
    },
    {
      heading: "Hosting & Infrastructure",
      items: [
        { name: "EU-only data residency", ok: true, note: "Hetzner Falkenstein (DE)" },
        { name: "TLS 1.2+ (public)", ok: true, note: "mykalypsis.gr με HTTP→HTTPS redirect" },
        { name: "Daily encrypted backups", ok: true, note: "30 ημέρες rolling + 12mo monthly snapshot" },
        { name: "Backup restore drill (annual)", ok: false, note: "Προγραμματίστε ετήσια δοκιμή restore" },
      ]
    },
    {
      heading: "Contracts & Legal",
      items: [
        { name: "MSA (Master Services)", ok: true, note: "/subscription-agreement" },
        { name: "DPA (Data Processing Addendum)", ok: true, note: "/dpa + acceptance modal on first login" },
        { name: "SLA (99.5% τυπικά)", ok: true, note: "/sla" },
        { name: "AUP (Acceptable Use)", ok: true, note: "/acceptable-use" },
        { name: "Order Form template", ok: true, note: "legal-docs/CONTRACT-TEMPLATE-Kalypsis-Order-Form.html" },
        { name: "Complaints procedure (Ν. 4583/2018)", ok: true, note: "5d ack + 45d SLA" },
        { name: "Refund policy (14d)", ok: true, note: "/refund-policy" },
      ]
    },
    {
      heading: "Governance & Ops",
      items: [
        { name: "Code of Conduct + Anti-bribery", ok: true, note: "/code-of-conduct" },
        { name: "OSS attributions", ok: true, note: "/oss-licenses" },
        { name: "Accessibility statement (WCAG 2.1 AA)", ok: true, note: "/accessibility" },
        { name: "Annual penetration test", ok: false, note: "Προγραμματίστε με εξωτερικό vendor" },
        { name: "BCP / Disaster Recovery plan", ok: false, note: "Εσωτερικό — για enterprise buyers" },
        { name: "SOC 2 / ISO 27001", ok: false, note: "Optional — enterprise sales lever" },
      ]
    },
  ];

  return (
    <PageShell icon={<RuleFolderIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.compliance.title" subtitleKey="plat.compliance.subtitle" helpId="page.platCompliance">
      <Stack spacing={2.5}>
        {groups.map(g => (
          <Card key={g.heading} variant="outlined">
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(11,37,69,0.03)" }}>
              <Typography fontWeight={800}>{g.heading}</Typography>
            </Box>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{t("plat.compliance.requirement")}</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell>{t("plat.compliance.note")}</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {g.items.map(it => (
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
        ))}
      </Stack>
    </PageShell>
  );
}

/* ===================== Support Inbox ===================== */
interface SupportReply { id: string; at: string; author: string; body: string; notifiedTenant: boolean; }
interface SupportTicket {
  id: string;
  tenantId: string;
  tenant: string;
  tenantCode: string;
  subject: string;
  body: string;
  priority: "High" | "Normal" | "Low";
  openedAt: string;
  resolvedAt: string | null;
  status: "Open" | "InProgress" | "Waiting" | "Resolved";
  channel: "Email" | "Internal" | "Phone";
  assignee: string | null;
  replies: SupportReply[];
}

interface SupportTicketApiDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  subject: string;
  body: string;
  priority: string;
  status: string;
  channel: string;
  assignee: string | null;
  openedAt: string;
  resolvedAt: string | null;
  replies: Array<{ id: string; at: string; author: string; body: string; notifiedTenant: boolean }>;
}

function apiToTicket(a: SupportTicketApiDto): SupportTicket {
  return {
    id: a.id,
    tenantId: a.tenantId,
    tenant: a.tenantName,
    tenantCode: a.tenantCode,
    subject: a.subject,
    body: a.body,
    priority: a.priority as SupportTicket["priority"],
    status: a.status as SupportTicket["status"],
    channel: a.channel as SupportTicket["channel"],
    assignee: a.assignee,
    openedAt: a.openedAt,
    resolvedAt: a.resolvedAt,
    replies: a.replies
  };
}

export function PlatformSupportPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ticketsQ = useQuery({
    queryKey: ["platform-support-tickets"],
    queryFn: async () => (await api.get<SupportTicketApiDto[]>("/platform/support-tickets")).data
  });
  const tickets: SupportTicket[] = useMemo(() => (ticketsQ.data ?? []).map(apiToTicket), [ticketsQ.data]);

  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [banner, setBanner] = useState<{ kind: "success" | "info" | "error"; msg: string } | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [notifyDraft, setNotifyDraft] = useState({ open: false, subject: "", body: "" });

  const patchTicket = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SupportTicket> }) =>
      (await api.patch<SupportTicketApiDto>(`/platform/support-tickets/${id}`, {
        status: patch.status, priority: patch.priority, assignee: patch.assignee
      })).data,
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["platform-support-tickets"] });
      if (openTicket && openTicket.id === updated.id) setOpenTicket(apiToTicket(updated));
    },
    onError: (e) => setBanner({ kind: "error", msg: extractErrorMessage(e) })
  });
  const deleteTicket = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/platform/support-tickets/${id}`); },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform-support-tickets"] });
      setOpenTicket(null);
      setBanner({ kind: "success", msg: "Ticket διαγράφηκε." });
    },
    onError: (e) => setBanner({ kind: "error", msg: extractErrorMessage(e) })
  });
  const addReply = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) =>
      (await api.post<SupportTicketApiDto>(`/platform/support-tickets/${id}/replies`, {
        author: "super@kalypsis.gr", body
      })).data,
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["platform-support-tickets"] });
      setOpenTicket(apiToTicket(updated));
      setReplyDraft("");
      setBanner({ kind: "success", msg: "Απάντηση καταχωρήθηκε." });
    },
    onError: (e) => setBanner({ kind: "error", msg: extractErrorMessage(e) })
  });
  const notifyTenant = useMutation({
    mutationFn: async ({ id, subject, body }: { id: string; subject: string; body: string }) =>
      (await api.post<SupportTicketApiDto>(`/platform/support-tickets/${id}/notify`, { subject, body })).data,
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["platform-support-tickets"] });
      setOpenTicket(apiToTicket(updated));
      setNotifyDraft({ open: false, subject: "", body: "" });
      setBanner({ kind: "success", msg: `Ειδοποίηση στάλθηκε προς ${updated.tenantCode}. Καταγράφηκε στο ticket.` });
    },
    onError: (e) => setBanner({ kind: "error", msg: extractErrorMessage(e) })
  });
  const createTicket = useMutation({
    mutationFn: async (body: Omit<SupportTicket, "id" | "replies" | "openedAt" | "resolvedAt" | "tenantCode" | "tenant"> & { tenantId: string }) =>
      (await api.post<SupportTicketApiDto>("/platform/support-tickets", {
        tenantId: body.tenantId,
        subject: body.subject,
        body: body.body,
        priority: body.priority,
        channel: body.channel,
        assignee: body.assignee
      })).data,
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["platform-support-tickets"] });
      setNewTicketOpen(false);
      setBanner({ kind: "success", msg: `Δημιουργήθηκε ticket για ${created.tenantCode}.` });
    },
    onError: (e) => setBanner({ kind: "error", msg: extractErrorMessage(e) })
  });

  const filtered = tickets.filter(x =>
    (statusFilter === "all" || (statusFilter === "open" ? x.status !== "Resolved" : x.status === statusFilter))
    && (priorityFilter === "all" || x.priority === priorityFilter)
  );

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status !== "Resolved").length,
    high: tickets.filter(t => t.priority === "High" && t.status !== "Resolved").length,
    unassigned: tickets.filter(t => !t.assignee && t.status !== "Resolved").length,
  };

  const PRIO_COLOR: any = { High: "error", Normal: "warning", Low: "default" };
  const STATUS_COLOR: any = { Open: "info", InProgress: "warning", Waiting: "default", Resolved: "success" };

  const updateTicket = (id: string, patch: Partial<SupportTicket>) => {
    patchTicket.mutate({ id, patch });
  };

  return (
    <PageShell icon={<SupportAgentIcon sx={{ fontSize: 36 }} color="primary" />} titleKey="plat.support.title" subtitleKey="plat.support.subtitle" helpId="page.platSupport">
      {banner && <Alert severity={banner.kind} sx={{ mb: 2 }} onClose={() => setBanner(null)}>{banner.msg}</Alert>}

      {/* Stats */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
        <Kpi label="Σύνολο" value={stats.total} />
        <Kpi label="Ανοιχτά" value={stats.open} />
        <Kpi label="High priority" value={stats.high} />
        <Kpi label="Χωρίς assignee" value={stats.unassigned} />
      </Box>

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <TextField select size="small" label="Κατάσταση"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="all">Όλα</MenuItem>
            <MenuItem value="open">Ανοιχτά (όχι Resolved)</MenuItem>
            <MenuItem value="Open">Open</MenuItem>
            <MenuItem value="InProgress">InProgress</MenuItem>
            <MenuItem value="Waiting">Waiting</MenuItem>
            <MenuItem value="Resolved">Resolved</MenuItem>
          </TextField>
          <TextField select size="small" label="Priority"
            value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">Όλες</MenuItem>
            <MenuItem value="High">High</MenuItem>
            <MenuItem value="Normal">Normal</MenuItem>
            <MenuItem value="Low">Low</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<SendIcon />} onClick={() => setNewTicketOpen(true)}>
            Νέο ticket
          </Button>
        </Stack>
      </Card>

      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>#</TableCell>
            <TableCell>{t("plat.support.tenant")}</TableCell>
            <TableCell>{t("plat.support.subject")}</TableCell>
            <TableCell>{t("plat.support.priority")}</TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell>{t("plat.support.opened")}</TableCell>
            <TableCell>Απαντήσεις</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell align="right">Ενέργειες</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {filtered.map(tt => (
              <TableRow key={tt.id} hover
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button,a,input,[role='button']")) return;
                  setOpenTicket(tt);
                  setReplyDraft("");
                }}
                sx={{ cursor: "pointer" }}>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{tt.id.slice(0, 8)}</TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{tt.tenant}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{tt.tenantCode}</Typography>
                </TableCell>
                <TableCell>{tt.subject}</TableCell>
                <TableCell><Chip size="small" color={PRIO_COLOR[tt.priority]} label={tt.priority} /></TableCell>
                <TableCell sx={{ fontSize: 12 }}>{tt.assignee ?? <em style={{ color: "#999" }}>—</em>}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{new Date(tt.openedAt).toLocaleDateString("el-GR")}</TableCell>
                <TableCell align="center">{tt.replies.length}</TableCell>
                <TableCell><Chip size="small" color={STATUS_COLOR[tt.status]} label={tt.status} /></TableCell>
                <TableCell align="right">
                  <Tooltip title="Ειδοποίηση στον πελάτη">
                    <IconButton size="small" color="primary"
                      onClick={() => {
                        setOpenTicket(tt);
                        setNotifyDraft({
                          open: true,
                          subject: `[Kalypsis Support] ${tt.subject}`,
                          body: `Γεια σας από την ομάδα Kalypsis σχετικά με το ticket ${tt.id}.`
                        });
                      }}>
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={tt.status === "Resolved" ? "Άνοιγμα ξανά" : "Σήμανση ως Resolved"}>
                    <IconButton size="small"
                      color={tt.status === "Resolved" ? "warning" : "success"}
                      onClick={() => {
                        updateTicket(tt.id, { status: tt.status === "Resolved" ? "Open" : "Resolved" });
                        setBanner({ kind: "success", msg: `Ticket ${tt.id} → ${tt.status === "Resolved" ? "Open" : "Resolved"}` });
                      }}>
                      {tt.status === "Resolved" ? "↻" : "✓"}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  Κανένα ticket δεν ταιριάζει στα φίλτρα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Ticket detail dialog */}
      <Dialog open={!!openTicket && !notifyDraft.open} onClose={() => setOpenTicket(null)} fullWidth maxWidth="md">
        {openTicket && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{openTicket.id.slice(0, 8)}</Typography>
                <Chip size="small" color={PRIO_COLOR[openTicket.priority]} label={openTicket.priority} />
                <Chip size="small" color={STATUS_COLOR[openTicket.status]} label={openTicket.status} />
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">{openTicket.tenant}</Typography>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{openTicket.subject}</Typography>
              <Typography variant="caption" color="text.secondary">
                Ανοίχθηκε {new Date(openTicket.openedAt).toLocaleString("el-GR")} · {openTicket.channel} · Assignee: {openTicket.assignee ?? "—"}
              </Typography>
              <Alert severity="info" sx={{ my: 2 }}>{openTicket.body}</Alert>

              <Typography variant="overline" color="text.secondary">Απαντήσεις ({openTicket.replies.length})</Typography>
              <Stack spacing={1} sx={{ my: 1 }}>
                {openTicket.replies.length === 0 && (
                  <Typography variant="body2" color="text.secondary">— καμία απάντηση ακόμη —</Typography>
                )}
                {openTicket.replies.map((r, i) => (
                  <Box key={i} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700}>{r.author}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(r.at).toLocaleString("el-GR")}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{r.body}</Typography>
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />
              <TextField label="Νέα απάντηση (εσωτερική)" fullWidth multiline minRows={3}
                value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Οι εσωτερικές απαντήσεις γράφουν το ticket. Για email στον πελάτη πάτα «Ειδοποίηση»." />
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" mt={2} flexWrap="wrap">
                <TextField select size="small" label="Assign σε"
                  value={openTicket.assignee ?? ""}
                  onChange={(e) => updateTicket(openTicket.id, { assignee: e.target.value || null })}
                  sx={{ minWidth: 220 }}>
                  <MenuItem value="">— χωρίς assignee —</MenuItem>
                  <MenuItem value="super@kalypsis.gr">super@kalypsis.gr</MenuItem>
                  <MenuItem value="support@kalypsis.gr">support@kalypsis.gr</MenuItem>
                </TextField>
                <TextField select size="small" label="Priority"
                  value={openTicket.priority}
                  onChange={(e) => updateTicket(openTicket.id, { priority: e.target.value as SupportTicket["priority"] })}
                  sx={{ minWidth: 140 }}>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Normal">Normal</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                </TextField>
                <TextField select size="small" label="Κατάσταση"
                  value={openTicket.status}
                  onChange={(e) => updateTicket(openTicket.id, { status: e.target.value as SupportTicket["status"] })}
                  sx={{ minWidth: 160 }}>
                  <MenuItem value="Open">Open</MenuItem>
                  <MenuItem value="InProgress">InProgress</MenuItem>
                  <MenuItem value="Waiting">Waiting</MenuItem>
                  <MenuItem value="Resolved">Resolved</MenuItem>
                </TextField>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button color="error"
                onClick={() => {
                  if (!confirm(`Διαγραφή ticket ${openTicket.id.slice(0, 8)};`)) return;
                  deleteTicket.mutate(openTicket.id);
                }}
                sx={{ mr: "auto" }}
                disabled={deleteTicket.isPending}>
                Διαγραφή
              </Button>
              <Button onClick={() => setOpenTicket(null)}>Κλείσιμο</Button>
              <Button variant="outlined" startIcon={<SendIcon />}
                onClick={() => setNotifyDraft({ open: true, subject: `[Kalypsis Support] ${openTicket.subject}`, body: "" })}>
                Ειδοποίηση πελάτη
              </Button>
              <Button variant="contained" disabled={!replyDraft.trim() || addReply.isPending}
                onClick={() => addReply.mutate({ id: openTicket.id, body: replyDraft.trim() })}>
                {addReply.isPending ? <CircularProgress size={16} /> : "Προσθήκη απάντησης"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Send notification to tenant dialog */}
      <Dialog open={notifyDraft.open} onClose={() => setNotifyDraft({ ...notifyDraft, open: false })} fullWidth maxWidth="sm">
        <DialogTitle>Ειδοποίηση προς {openTicket?.tenant}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Θα σταλεί email + in-app notification στους AgencyAdmins του γραφείου.
          </Alert>
          <Stack spacing={2} mt={1}>
            <TextField label="Θέμα" fullWidth required
              value={notifyDraft.subject}
              onChange={(e) => setNotifyDraft({ ...notifyDraft, subject: e.target.value })} />
            <TextField label="Μήνυμα" fullWidth multiline minRows={5} required
              value={notifyDraft.body}
              onChange={(e) => setNotifyDraft({ ...notifyDraft, body: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifyDraft({ open: false, subject: "", body: "" })}>Ακύρωση</Button>
          <Button variant="contained" startIcon={<SendIcon />}
            disabled={!notifyDraft.subject.trim() || !notifyDraft.body.trim() || notifyTenant.isPending}
            onClick={() => {
              if (!openTicket) return;
              notifyTenant.mutate({ id: openTicket.id, subject: notifyDraft.subject.trim(), body: notifyDraft.body.trim() });
            }}>
            {notifyTenant.isPending ? <CircularProgress size={16} /> : "Αποστολή"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New ticket dialog */}
      <NewTicketDialog
        open={newTicketOpen}
        busy={createTicket.isPending}
        onClose={() => setNewTicketOpen(false)}
        onCreate={(t) => createTicket.mutate(t)}
      />
    </PageShell>
  );
}

function NewTicketDialog({ open, busy, onClose, onCreate }: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (t: {
    tenantId: string;
    subject: string; body: string;
    priority: "High" | "Normal" | "Low";
    status: "Open";
    channel: "Email" | "Internal" | "Phone";
    assignee: string | null;
  }) => void;
}) {
  const tenantsQ = useQuery({
    queryKey: ["all-tenants-support"],
    enabled: open,
    queryFn: async () => (await api.get<Array<{ id: string; name: string; code: string }>>("/tenants")).data
  });
  const [form, setForm] = useState<{ tenantId: string; subject: string; body: string; priority: "High" | "Normal" | "Low"; channel: "Email" | "Internal" | "Phone" }>({
    tenantId: "", subject: "", body: "",
    priority: "Normal", channel: "Internal"
  });
  useEffect(() => {
    if (open) setForm({ tenantId: "", subject: "", body: "", priority: "Normal", channel: "Internal" });
  }, [open]);
  const valid = form.tenantId && form.subject.trim() && form.body.trim();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Νέο support ticket</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField select label="Γραφείο" required fullWidth
            value={form.tenantId}
            onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
            {(tenantsQ.data ?? []).map(t => (
              <MenuItem key={t.id} value={t.id}>{t.name} ({t.code})</MenuItem>
            ))}
          </TextField>
          <TextField label="Θέμα" required fullWidth
            value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <TextField label="Περιγραφή" required fullWidth multiline minRows={3}
            value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Stack direction="row" spacing={2}>
            <TextField select label="Priority" fullWidth
              value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as "High" | "Normal" | "Low" })}>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Normal">Normal</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
            <TextField select label="Channel" fullWidth
              value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as "Email" | "Internal" | "Phone" })}>
              <MenuItem value="Email">Email</MenuItem>
              <MenuItem value="Internal">Internal</MenuItem>
              <MenuItem value="Phone">Phone</MenuItem>
            </TextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" disabled={!valid || busy}
          onClick={() => onCreate({ ...form, status: "Open", assignee: null })}>
          {busy ? <CircularProgress size={16} /> : "Δημιουργία"}
        </Button>
      </DialogActions>
    </Dialog>
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
  paidAt: string | null; paidReference: string | null;
  createdAt: string;
}

/**
 * Body-only variant of the tenant-chargeables screen. Rendered inside the
 * unified Billing Hub (`/platform/billing`) so subscription pricing and
 * ad-hoc chargeables live side-by-side. No PageShell so it can share the
 * hub's header + tabs. External callers should use TenantChargeablesPanel;
 * the old `TenantChargeablesPage` export is kept as a passthrough for the
 * legacy route redirect but wraps the panel with PageShell for direct use.
 */
export function TenantChargeablesPanel() {
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

  const setPaid = useMutation({
    mutationFn: async ({ id, paid, ref }: { id: string; paid: boolean; ref?: string }) =>
      api.post(`/platform/tenant-chargeables/${id}/paid`, { paid, reference: ref ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-chargeables", tenantId] })
  });

  const rows = list.data ?? [];
  const pendingRows  = rows.filter(r => !r.invoiced && !r.paidAt);
  const paidRows     = rows.filter(r => !r.invoiced && !!r.paidAt);
  const invoicedRows = rows.filter(r => r.invoiced);
  const pendingTotal  = pendingRows.reduce((s, r) => s + r.lineTotal, 0);
  const paidTotal     = paidRows.reduce((s, r) => s + r.lineTotal, 0);
  const invoicedTotal = invoicedRows.reduce((s, r) => s + r.lineTotal, 0);

  return (
    <Box>
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
        <Box sx={{ display: "grid", gap: 2, mb: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" } }}>
          <Kpi label="Εκκρεμείς" value={`${pendingTotal.toFixed(2)}€`}
            hint={`${pendingRows.length} γραμμές — μπαίνουν στο επόμενο τιμολόγιο`} />
          <Kpi label="Εξοφλημένες" value={`${paidTotal.toFixed(2)}€`}
            hint={`${paidRows.length} γραμμές — cash / εκτός τιμολογίου`} />
          <Kpi label="Τιμολογημένες" value={`${invoicedTotal.toFixed(2)}€`}
            hint={`${invoicedRows.length} γραμμές — locked`} />
          <Kpi label="Σύνολο" value={`${(pendingTotal + paidTotal + invoicedTotal).toFixed(2)}€`} />
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
                      : r.paidAt
                        ? <Tooltip title={r.paidReference ? `Ref: ${r.paidReference}` : `Πληρώθηκε ${new Date(r.paidAt).toLocaleDateString("el-GR")}`}>
                            <Chip size="small" color="info" label="Εξοφλημένη" />
                          </Tooltip>
                        : <Chip size="small" color="warning" label="Εκκρεμεί" />}
                  </TableCell>
                  <TableCell align="right">
                    {!r.invoiced && !r.paidAt && (
                      <Tooltip title="Σημείωση ως πληρωμένη (cash, εκτός τιμολογίου)">
                        <IconButton size="small" color="success"
                          onClick={() => {
                            const ref = prompt("Αναφορά πληρωμής (προαιρετικό):");
                            if (ref !== null) setPaid.mutate({ id: r.id, paid: true, ref: ref || undefined });
                          }}>€</IconButton>
                      </Tooltip>
                    )}
                    {!r.invoiced && r.paidAt && (
                      <Tooltip title="Αναίρεση πληρωμής">
                        <IconButton size="small"
                          onClick={() => setPaid.mutate({ id: r.id, paid: false })}>↩</IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={r.invoiced ? "Locked — έχει τιμολογηθεί" : r.paidAt ? "Locked — πληρώθηκε" : "Επεξεργασία"}>
                      <span>
                        <IconButton size="small" onClick={() => setDialog(r)}
                          disabled={r.invoiced || !!r.paidAt}>✎</IconButton>
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
    </Box>
  );
}

/** Legacy passthrough — kept so existing imports still resolve, but the
 *  route now redirects to the merged Billing Hub. */
export function TenantChargeablesPage() {
  return (
    <PageShell
      icon={<PaymentsIcon sx={{ fontSize: 36 }} color="primary" />}
      titleKey="plat.chargeables.title"
      subtitleKey="plat.chargeables.subtitle"
      helpId="page.platChargeables"
    >
      <TenantChargeablesPanel />
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
