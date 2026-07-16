import { useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tab, Tabs,
  TextField, Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginIcon from "@mui/icons-material/Login";
import GroupIcon from "@mui/icons-material/Group";
import PeopleIcon from "@mui/icons-material/People";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import ReportIcon from "@mui/icons-material/Report";
import HandshakeIcon from "@mui/icons-material/Handshake";
import EuroIcon from "@mui/icons-material/Euro";
import EventIcon from "@mui/icons-material/Event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { money, date } from "../utils/format";
import { useImpersonation } from "../impersonation/ImpersonationContext";

interface TenantOverview {
  tenantId: string; name: string; code: string; isActive: boolean;
  subscriptionPlan: string; createdAt: string;
  userCount: number; customerCount: number; policyCount: number;
  activePolicyCount: number; documentCount: number; claimCount: number;
  producerCount: number; totalPremium: number;
  lastUserLoginAt: string | null;
  recentUsers: {
    id: string; email: string; firstName: string; lastName: string;
    role: string; isActive: boolean; createdAt: string; lastLoginAt: string | null;
  }[];
}

export function TenantDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enter } = useImpersonation();
  const [tab, setTab] = useState<"overview" | "packages" | "premium" | "billing" | "contracts" | "activity" | "users" | "customers" | "policies">("overview");
  const [err, setErr] = useState<string | null>(null);

  const overviewQ = useQuery({
    queryKey: ["tenant-overview", id],
    enabled: !!id,
    queryFn: async () => (await api.get<TenantOverview>(`/tenants/${id}/overview`)).data
  });

  // Cross-tenant users list (filter by this tenant on the platform users endpoint).
  const usersQ = useQuery({
    queryKey: ["tenant-users", id],
    enabled: !!id && tab === "users",
    queryFn: async () => (await api.get(`/platform/users`, { params: { tenantId: id } })).data as TenantOverview["recentUsers"]
  });

  const setActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.post(`/platform/users/bulk`, { userIds: [userId], action: isActive ? "Activate" : "Deactivate" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tenant-users", id] }); void qc.invalidateQueries({ queryKey: ["tenant-overview", id] }); }
  });

  const delUser = useMutation({
    mutationFn: async (userId: string) => api.delete(`/platform/users/${userId}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tenant-users", id] }); void qc.invalidateQueries({ queryKey: ["tenant-overview", id] }); },
    onError: e => setErr(extractErrorMessage(e))
  });

  if (overviewQ.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  if (overviewQ.error || !overviewQ.data) return <Alert severity="error">{t("tenants.loadError")}</Alert>;
  const o = overviewQ.data;

  const stats = [
    { icon: <GroupIcon />, label: t("tenants.stat.users"), value: o.userCount },
    { icon: <PeopleIcon />, label: t("tenants.stat.customers"), value: o.customerCount },
    { icon: <DescriptionIcon />, label: t("tenants.stat.policies"), value: o.policyCount, sub: `${o.activePolicyCount} ${t("tenants.stat.active")}` },
    { icon: <FolderIcon />, label: t("tenants.stat.documents"), value: o.documentCount },
    { icon: <ReportIcon />, label: t("tenants.stat.claims"), value: o.claimCount },
    { icon: <HandshakeIcon />, label: t("tenants.stat.producers"), value: o.producerCount },
    { icon: <EuroIcon />, label: t("tenants.stat.premium"), value: `${o.totalPremium.toFixed(0)} €` }
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={() => navigate("/app/tenants")} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h4" sx={{ fontWeight: 800, flex: 1 }}>{o.name}</Typography>
        <Chip label={o.code} variant="outlined" />
        <Chip label={o.subscriptionPlan} color="primary" />
        <Chip label={o.isActive ? t("common.active") : t("common.inactive")} color={o.isActive ? "success" : "default"} />
        <Button startIcon={<LoginIcon />} variant="contained" onClick={() => { enter(o.tenantId, o.name); navigate("/app"); }}>
          {t("tenants.enterAs")}
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(7, 1fr)" }, gap: 1.5, mb: 3 }}>
        {stats.map((s, i) => (
          <Card key={i}><CardContent sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: "rgba(11,37,69,0.06)", color: "primary.main" }}>{s.icon}</Avatar>
              <Box>
                <Typography variant="overline" color="text.secondary">{s.label}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{s.value}</Typography>
                {s.sub && <Typography variant="caption" color="text.secondary">{s.sub}</Typography>}
              </Box>
            </Stack>
          </CardContent></Card>
        ))}
      </Box>

      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label={t("tenants.tab.overview")} value="overview" />
          <Tab label={t("tenants.tab.packages")} value="packages" />
          <Tab label="Premium" value="premium" />
          <Tab label={t("tenants.tab.billing")} value="billing" />
          <Tab label={t("tenants.tab.contracts")} value="contracts" />
          <Tab label={t("tenants.tab.activity")} value="activity" />
          <Tab label={t("tenants.tab.users")} value="users" />
          <Tab label={t("tenants.tab.customers")} value="customers" />
          <Tab label={t("tenants.tab.policies")} value="policies" />
        </Tabs>
      </Card>

      {tab === "overview" && (
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon fontSize="small" color="action" />
                <Typography>{t("tenants.createdAt")}: {new Date(o.createdAt).toLocaleString("el-GR")}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon fontSize="small" color="action" />
                <Typography>{t("tenants.lastLogin")}: {o.lastUserLoginAt ? new Date(o.lastUserLoginAt).toLocaleString("el-GR") : "—"}</Typography>
              </Stack>
              <Typography variant="overline" color="text.secondary" sx={{ mt: 2 }}>{t("tenants.recentUsers")}</Typography>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Email</TableCell><TableCell>{t("tenants.userName")}</TableCell>
                  <TableCell>{t("tenants.userRole")}</TableCell>
                  <TableCell>{t("tenants.userLastLogin")}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {o.recentUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.firstName} {u.lastName}</TableCell>
                      <TableCell><Chip size="small" label={t(`roles.${u.role}`)} variant="outlined" /></TableCell>
                      <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("el-GR") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === "packages" && id && (
        <PackagesTab tenantId={id} onError={setErr} />
      )}

      {tab === "premium" && id && (
        <PremiumTab tenantId={id} onError={setErr} />
      )}

      {tab === "billing" && id && (
        <BillingTab tenantId={id} onError={setErr} />
      )}

      {tab === "contracts" && id && (
        <ContractsTab tenantId={id} onError={setErr} />
      )}

      {tab === "activity" && id && (
        <ActivityTab tenantId={id} />
      )}

      {tab === "users" && id && (
        <UsersTab
          users={usersQ.data ?? []}
          loading={usersQ.isLoading}
          onToggle={(userId, isActive) => setActive.mutate({ userId, isActive })}
          onDelete={(userId) => { if (confirm(t("common.confirmDelete"))) delUser.mutate(userId); }}
        />
      )}

      {(tab === "customers" || tab === "policies") && (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary" gutterBottom>
            {t("tenants.enterToBrowse")}
          </Typography>
          <Button startIcon={<LoginIcon />} variant="contained" onClick={() => { enter(o.tenantId, o.name); navigate(tab === "customers" ? "/app/customers" : "/app/policies"); }}>
            {t("tenants.enterAs")}
          </Button>
        </Card>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------------- */
/* Phase 5 — Packages tab: 5 toggle switches per package. PlatformAdmin only. */
/* ------------------------------------------------------------------------- */

import { Switch, FormControlLabel, Divider } from "@mui/material";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import type { PackageCode } from "../auth/PackagesContext";

interface TenantPackagesResponse {
  tenantId: string;
  tenantName: string;
  packages: PackageCode[];
}

const PACKAGE_ORDER: PackageCode[] = ["BackOffice", "FrontOffice", "Crm", "Intelligence", "Integrations"];

const PACKAGE_META: Record<PackageCode, { nameKey: string; tagKey: string; bodyKey: string }> = {
  BackOffice:   { nameKey: "tenants.packagesTab.items.BackOffice.name",   tagKey: "tenants.packagesTab.items.BackOffice.tag",   bodyKey: "tenants.packagesTab.items.BackOffice.body" },
  FrontOffice:  { nameKey: "tenants.packagesTab.items.FrontOffice.name",  tagKey: "tenants.packagesTab.items.FrontOffice.tag",  bodyKey: "tenants.packagesTab.items.FrontOffice.body" },
  Crm:          { nameKey: "tenants.packagesTab.items.Crm.name",          tagKey: "tenants.packagesTab.items.Crm.tag",          bodyKey: "tenants.packagesTab.items.Crm.body" },
  Intelligence: { nameKey: "tenants.packagesTab.items.Intelligence.name", tagKey: "tenants.packagesTab.items.Intelligence.tag", bodyKey: "tenants.packagesTab.items.Intelligence.body" },
  Integrations: { nameKey: "tenants.packagesTab.items.Integrations.name", tagKey: "tenants.packagesTab.items.Integrations.tag", bodyKey: "tenants.packagesTab.items.Integrations.body" }
};

function PackagesTab({ tenantId, onError }: { tenantId: string; onError: (m: string | null) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Set<PackageCode> | null>(null);

  const q = useQuery({
    queryKey: ["tenant-packages", tenantId],
    queryFn: async () => (await api.get<TenantPackagesResponse>(`/platform/tenants/${tenantId}/packages`)).data
  });

  const save = useMutation({
    mutationFn: async (next: PackageCode[]) =>
      (await api.put<TenantPackagesResponse>(`/platform/tenants/${tenantId}/packages`, { packages: next })).data,
    onSuccess: (r) => {
      qc.setQueryData(["tenant-packages", tenantId], r);
      setDraft(null);
      onError(null);
    },
    onError: (e) => onError(extractErrorMessage(e))
  });

  if (q.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  const current = draft ?? new Set(q.data?.packages ?? []);
  const isDirty = draft !== null;

  function toggle(pkg: PackageCode) {
    const next = new Set(current);
    if (next.has(pkg)) next.delete(pkg);
    else next.add(pkg);
    setDraft(next);
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t("tenants.packagesTab.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("tenants.packagesTab.subtitle")}
            </Typography>
          </Box>
          {isDirty && (
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
              <Button variant="contained" disabled={save.isPending}
                onClick={() => save.mutate(Array.from(current))}>
                {save.isPending ? <CircularProgress size={16} color="inherit" /> : t("common.save")}
              </Button>
            </Stack>
          )}
        </Stack>

        <Stack divider={<Divider flexItem />} spacing={0}>
          {PACKAGE_ORDER.map((pkg) => {
            const meta = PACKAGE_META[pkg];
            const enabled = current.has(pkg);
            return (
              <Stack key={pkg} direction={{ xs: "column", sm: "row" }} spacing={2}
                alignItems={{ sm: "center" }}
                sx={{ py: 2.5 }}>
                <Box sx={{ width: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {enabled
                    ? <LockOpenIcon sx={{ fontSize: 28, color: "success.main" }} />
                    : <LockOutlinedIcon sx={{ fontSize: 28, color: "text.disabled" }} />}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="baseline">
                    <Typography sx={{ fontWeight: 700, fontSize: 17 }}>
                      {t(meta.nameKey)}
                    </Typography>
                    <Chip size="small" label={t(meta.tagKey)}
                      color={enabled ? "success" : "default"}
                      variant={enabled ? "filled" : "outlined"} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
                    {t(meta.bodyKey)}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={<Switch checked={enabled} onChange={() => toggle(pkg)} />}
                  label={enabled ? t("common.enabled") : t("common.disabled")}
                  labelPlacement="start"
                />
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/* Phase 6 — Billing tab: office-surcharge breakdown + editable surcharge    */
/* ------------------------------------------------------------------------- */

import HomeWorkIcon from "@mui/icons-material/HomeWork";
import StarIcon from "@mui/icons-material/Star";

interface BillingBreakdown {
  tenantId: string;
  tenantName: string;
  plan: string | null;
  officeIncludedCount: number;
  officeSurchargeAmount: number;
  officeSurchargeCurrency: string;
  activeOfficeCount: number;
  billableOfficeCount: number;
  monthlyOfficeSurchargeTotal: number;
  offices: {
    id: string; code: string; name: string; city: string | null;
    isHeadquarters: boolean; isActive: boolean;
  }[];
}

function BillingTab({ tenantId, onError }: { tenantId: string; onError: (m: string | null) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{ included: number; amount: number; currency: string } | null>(null);

  const q = useQuery({
    queryKey: ["tenant-billing", tenantId],
    queryFn: async () => (await api.get<BillingBreakdown>(`/platform/tenants/${tenantId}/billing`)).data
  });

  const save = useMutation({
    mutationFn: async (next: { included: number; amount: number; currency: string }) =>
      (await api.put<BillingBreakdown>(`/platform/tenants/${tenantId}/billing/office-surcharge`, {
        officeIncludedCount: next.included,
        officeSurchargeAmount: next.amount,
        officeSurchargeCurrency: next.currency
      })).data,
    onSuccess: (r) => { qc.setQueryData(["tenant-billing", tenantId], r); setDraft(null); onError(null); },
    onError: (e) => onError(extractErrorMessage(e))
  });

  if (q.isLoading || !q.data) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  const b = q.data;
  const editing = draft ?? { included: b.officeIncludedCount, amount: b.officeSurchargeAmount, currency: b.officeSurchargeCurrency };
  const isDirty = draft !== null;

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("tenants.billingTab.summary")}</Typography>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
            gap: 3
          }}>
            <Stat label={t("tenants.billingTab.activeOffices")} value={b.activeOfficeCount} icon={<HomeWorkIcon />} />
            <Stat label={t("tenants.billingTab.included")} value={b.officeIncludedCount} icon={<StarIcon color="warning" />} />
            <Stat label={t("tenants.billingTab.billable")}  value={b.billableOfficeCount} />
            <Stat
              label={t("tenants.billingTab.monthlyTotal")}
              value={money(b.monthlyOfficeSurchargeTotal, b.officeSurchargeCurrency)}
              big
              highlight={b.monthlyOfficeSurchargeTotal > 0} />
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} mb={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("tenants.billingTab.surchargeRule")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("tenants.billingTab.surchargeRuleHelp")}
              </Typography>
            </Box>
            {isDirty && (
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
                <Button variant="contained" disabled={save.isPending}
                  onClick={() => save.mutate(editing)}>
                  {save.isPending ? <CircularProgress size={16} color="inherit" /> : t("common.save")}
                </Button>
              </Stack>
            )}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("tenants.billingTab.includedField")} value={editing.included}
              onChange={(e) => setDraft({ ...editing, included: Math.max(0, Number(e.target.value)) })}
              sx={{ width: 180 }} inputProps={{ min: 0 }} />
            <TextField type="number" label={t("tenants.billingTab.amountField")} value={editing.amount}
              onChange={(e) => setDraft({ ...editing, amount: Math.max(0, Number(e.target.value)) })}
              sx={{ width: 200 }} inputProps={{ min: 0, step: "0.01" }}
              InputProps={{ endAdornment: editing.currency }} />
            <TextField label={t("tenants.billingTab.currencyField")} value={editing.currency}
              onChange={(e) => setDraft({ ...editing, currency: e.target.value.toUpperCase().slice(0, 3) })}
              sx={{ width: 100 }} />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("tenants.billingTab.officesList")}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("tenants.billingTab.col.code")}</TableCell>
                <TableCell>{t("tenants.billingTab.col.name")}</TableCell>
                <TableCell>{t("tenants.billingTab.col.city")}</TableCell>
                <TableCell>{t("tenants.billingTab.col.role")}</TableCell>
                <TableCell>{t("tenants.billingTab.col.status")}</TableCell>
                <TableCell align="right">{t("tenants.billingTab.col.lineCharge")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {b.offices.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 3 }}>
                  {t("tenants.billingTab.noOffices")}
                </TableCell></TableRow>
              )}
              {b.offices.map((o, idx) => {
                const willCharge = o.isActive && !o.isHeadquarters && idx >= b.officeIncludedCount;
                // Simpler chargeable test: not HQ, active, and the count exceeds included.
                // (Backend computes the total — here we just display per-row hints.)
                const chargeable = o.isActive && !o.isHeadquarters;
                return (
                  <TableRow key={o.id}>
                    <TableCell sx={{ fontFamily: "monospace" }}>{o.code}</TableCell>
                    <TableCell><Typography fontWeight={600}>{o.name}</Typography></TableCell>
                    <TableCell>{o.city ?? "—"}</TableCell>
                    <TableCell>
                      {o.isHeadquarters
                        ? <Chip size="small" icon={<StarIcon />} label={t("tenants.billingTab.headquarters")} color="warning" />
                        : <Chip size="small" label={t("tenants.billingTab.branch")} />}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={o.isActive ? "success" : "default"}
                        label={o.isActive ? t("common.enabled") : t("common.disabled")} />
                    </TableCell>
                    <TableCell align="right">
                      {chargeable ? (
                        <Typography sx={{ fontWeight: 700, color: willCharge ? "primary.main" : "text.secondary" }}>
                          {money(b.officeSurchargeAmount, b.officeSurchargeCurrency)}
                        </Typography>
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}

function Stat({ label, value, icon, big, highlight }: {
  label: string; value: string | number; icon?: React.ReactNode; big?: boolean; highlight?: boolean;
}) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "text.secondary", fontSize: 12.5, letterSpacing: "0.04em", fontWeight: 600, mb: 0.5 }}>
        {icon}
        <span>{label.toUpperCase()}</span>
      </Stack>
      <Typography sx={{
        fontFamily: "var(--display, serif)",
        fontWeight: 700,
        fontSize: big ? { xs: 28, md: 34 } : { xs: 22, md: 26 },
        color: highlight ? "primary.main" : "text.primary",
        lineHeight: 1
      }}>
        {value}
      </Typography>
    </Box>
  );
}

/* ------------------------------------------------------------------------- */
/* Phase 7 — Contracts tab                                                   */
/* ------------------------------------------------------------------------- */

import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";

interface ContractDto {
  id: string; contractNumber: string;
  signedAt: string; effectiveFrom: string; effectiveTo: string | null;
  plan: string; monthlyBaseAmount: number; officeSurchargePerExtra: number;
  officeIncludedCount: number; currency: string;
  autoRenew: boolean; renewalTermMonths: number;
  signedByName: string | null; signedByEmail: string | null; signedByRole: string | null;
  contractFileKey: string | null; contractFileName: string | null; contractFileSizeBytes: number | null;
  isActive: boolean; terminatedAt: string | null; terminationReason: string | null;
  notes: string | null; createdAt: string;
}

function ContractsTab({ tenantId, onError }: { tenantId: string; onError: (m: string | null) => void }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContractDto | null>(null);

  const q = useQuery({
    queryKey: ["tenant-contracts", tenantId],
    queryFn: async () => (await api.get<ContractDto[]>(`/platform/tenants/${tenantId}/contracts`)).data
  });

  const terminate = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) =>
      api.post(`/platform/tenants/${tenantId}/contracts/${vars.id}/terminate`, { reason: vars.reason }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenant-contracts", tenantId] }),
    onError: (e) => onError(extractErrorMessage(e))
  });

  if (q.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <GavelIcon color="primary" />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Συμβόλαια γραφείου</Typography>
                <Typography variant="body2" color="text.secondary">
                  Εμπορικές συμφωνίες Kalypsis ↔ γραφείο. Ένα ενεργό συμβόλαιο τη φορά.
                </Typography>
              </Box>
            </Stack>
            <Button variant="contained" onClick={() => setCreateOpen(true)}>Νέο συμβόλαιο</Button>
          </Stack>

          {q.data?.length === 0 ? (
            <Typography textAlign="center" color="text.secondary" sx={{ py: 4 }}>
              Δεν υπάρχει καταχωρημένο συμβόλαιο. Φτιάξτε το πρώτο.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {(q.data ?? []).map(c => (
                <Card key={c.id} variant="outlined" sx={{ bgcolor: c.isActive ? "rgba(91,139,62,0.06)" : "rgba(0,0,0,0.02)" }}>
                  <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={2} alignItems="baseline">
                          <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16 }}>{c.contractNumber}</Typography>
                          <Chip size="small" label={c.plan} />
                          {c.isActive ? (
                            <Chip size="small" color="success" label="Ενεργό" />
                          ) : (
                            <Chip size="small" color="default" label={c.terminatedAt ? "Τερματισμένο" : "Ανενεργό"} />
                          )}
                        </Stack>
                        <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, fontSize: 13 }}>
                          <Stat label="Υπογραφή" value={date(c.signedAt)} />
                          <Stat label="Έναρξη ισχύος" value={date(c.effectiveFrom)} />
                          <Stat label="Λήξη" value={c.effectiveTo ? date(c.effectiveTo) : "Ανοιχτό"} />
                          <Stat label="Μηνιαία βάση" value={money(c.monthlyBaseAmount, c.currency)} highlight />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                          {c.officeIncludedCount} υποκαταστήματα στη βάση, +{money(c.officeSurchargePerExtra, c.currency)} ανά επιπλέον ·{" "}
                          {c.autoRenew ? `Αυτόματη ανανέωση κάθε ${c.renewalTermMonths} μήνες` : "Χωρίς αυτόματη ανανέωση"}
                        </Typography>
                        {c.signedByName && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Υπογραφή από: <strong>{c.signedByName}</strong>{c.signedByRole && ` · ${c.signedByRole}`}{c.signedByEmail && ` · ${c.signedByEmail}`}
                          </Typography>
                        )}
                        {c.terminationReason && (
                          <Alert severity="warning" sx={{ mt: 1.5 }}>Αιτία τερματισμού: {c.terminationReason}</Alert>
                        )}
                      </Box>
                      <Stack spacing={1} sx={{ minWidth: 200 }}>
                        {c.contractFileKey ? (
                          <Button variant="outlined" startIcon={<DownloadIcon />}
                            component="a" href={`/api/platform/tenants/${tenantId}/contracts/${c.id}/download`} target="_blank">
                            Λήψη PDF
                          </Button>
                        ) : (
                          <UploadButton contractId={c.id} tenantId={tenantId}
                            onUploaded={() => void qc.invalidateQueries({ queryKey: ["tenant-contracts", tenantId] })} />
                        )}
                        <Button variant="text" onClick={() => setEditing(c)}>Επεξεργασία</Button>
                        {c.isActive && (
                          <Button variant="text" color="error" onClick={() => {
                            const reason = prompt("Αιτία τερματισμού;");
                            if (reason) terminate.mutate({ id: c.id, reason });
                          }}>
                            Τερματισμός
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <ContractDialog
        open={createOpen || !!editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        tenantId={tenantId}
        item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tenant-contracts", tenantId] }); setCreateOpen(false); setEditing(null); }} />
    </Stack>
  );
}

function UploadButton({ tenantId, contractId, onUploaded }: { tenantId: string; contractId: string; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  return (
    <Button variant="outlined" startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />} component="label" disabled={uploading}>
      Ανέβασμα PDF
      <input type="file" accept="application/pdf" hidden onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
          const form = new FormData();
          form.append("file", file);
          await api.post(`/platform/tenants/${tenantId}/contracts/${contractId}/upload`, form, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          onUploaded();
        } finally {
          setUploading(false);
          e.target.value = "";
        }
      }} />
    </Button>
  );
}

function ContractDialog({ open, onClose, tenantId, item, onSaved }: {
  open: boolean; onClose: () => void; tenantId: string; item: ContractDto | null; onSaved: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    contractNumber: "", signedAt: todayStr, effectiveFrom: todayStr, effectiveTo: "",
    plan: "Custom", monthlyBaseAmount: 0, officeSurchargePerExtra: 0, officeIncludedCount: 1,
    currency: "EUR", autoRenew: true, renewalTermMonths: 12,
    signedByName: "", signedByEmail: "", signedByRole: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        contractNumber: item.contractNumber,
        signedAt: item.signedAt, effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo ?? "",
        plan: item.plan, monthlyBaseAmount: item.monthlyBaseAmount,
        officeSurchargePerExtra: item.officeSurchargePerExtra,
        officeIncludedCount: item.officeIncludedCount,
        currency: item.currency, autoRenew: item.autoRenew, renewalTermMonths: item.renewalTermMonths,
        signedByName: item.signedByName ?? "", signedByEmail: item.signedByEmail ?? "",
        signedByRole: item.signedByRole ?? "", notes: item.notes ?? ""
      });
    } else if (open) {
      setForm({
        contractNumber: `KAL-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
        signedAt: todayStr, effectiveFrom: todayStr, effectiveTo: "",
        plan: "Custom", monthlyBaseAmount: 0, officeSurchargePerExtra: 0, officeIncludedCount: 1,
        currency: "EUR", autoRenew: true, renewalTermMonths: 12,
        signedByName: "", signedByEmail: "", signedByRole: "", notes: ""
      });
    }
  }, [item, open, todayStr]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, effectiveTo: form.effectiveTo || null };
      if (item) return (await api.put(`/platform/tenants/${tenantId}/contracts/${item.id}`, body)).data;
      return (await api.post(`/platform/tenants/${tenantId}/contracts`, body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{item ? `Επεξεργασία — ${item.contractNumber}` : "Νέο συμβόλαιο"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Αριθμός συμβολαίου" required value={form.contractNumber}
              onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="Πλάνο" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} sx={{ width: 200 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label="Ημ. υπογραφής" InputLabelProps={{ shrink: true }} value={form.signedAt}
              onChange={(e) => setForm({ ...form, signedAt: e.target.value })} sx={{ flex: 1 }} />
            <TextField type="date" label="Ισχύς από" InputLabelProps={{ shrink: true }} value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} sx={{ flex: 1 }} />
            <TextField type="date" label="Ισχύς έως" InputLabelProps={{ shrink: true }} value={form.effectiveTo}
              onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} sx={{ flex: 1 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label="Μηνιαία βάση" value={form.monthlyBaseAmount}
              onChange={(e) => setForm({ ...form, monthlyBaseAmount: Number(e.target.value) })} sx={{ flex: 1 }} inputProps={{ step: "0.01" }} />
            <TextField type="number" label="Χρέωση ανά extra υποκ." value={form.officeSurchargePerExtra}
              onChange={(e) => setForm({ ...form, officeSurchargePerExtra: Number(e.target.value) })} sx={{ flex: 1 }} inputProps={{ step: "0.01" }} />
            <TextField type="number" label="Υποκ. στη βάση" value={form.officeIncludedCount}
              onChange={(e) => setForm({ ...form, officeIncludedCount: Number(e.target.value) })} sx={{ width: 140 }} />
            <TextField label="Νόμισμα" value={form.currency} sx={{ width: 100 }}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControlLabel control={<Switch checked={form.autoRenew}
              onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })} />} label="Αυτόματη ανανέωση" />
            <TextField type="number" label="Όροι ανανέωσης (μήνες)" value={form.renewalTermMonths}
              onChange={(e) => setForm({ ...form, renewalTermMonths: Number(e.target.value) })} sx={{ width: 200 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Υπογράφων" value={form.signedByName}
              onChange={(e) => setForm({ ...form, signedByName: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="Ρόλος" value={form.signedByRole}
              onChange={(e) => setForm({ ...form, signedByRole: e.target.value })} sx={{ flex: 1 }} />
            <TextField label="Email υπογράφοντος" value={form.signedByEmail}
              onChange={(e) => setForm({ ...form, signedByEmail: e.target.value })} sx={{ flex: 1 }} />
          </Stack>
          <TextField label="Σημειώσεις" multiline minRows={3} value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !form.contractNumber.trim()}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* Phase 7 — Activity timeline tab                                            */
/* ------------------------------------------------------------------------- */

import HistoryIcon from "@mui/icons-material/History";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BoltIcon from "@mui/icons-material/Bolt";
import { useEffect } from "react";

interface TimelineEntry {
  at: string; kind: string; title: string; detail: string | null;
  actorUserId: string | null; actorEmail: string | null;
}
interface TimelinePage {
  items: TimelineEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  availableKinds: string[];
}

const KIND_LABEL: Record<string, string> = {
  audit: "Audit",
  user_created: "Νέος χρήστης",
  user_login: "Σύνδεση",
  package_change: "Πακέτα",
  office_added: "Νέο υποκ/μα",
  office_removed: "Διαγραφή υποκ/μα",
  contract_signed: "Νέο συμβόλαιο",
  contract_terminated: "Λήξη συμβολαίου"
};

const KIND_ICON: Record<string, React.ReactNode> = {
  audit: <HistoryIcon />,
  user_created: <PersonAddIcon />,
  user_login: <LoginIcon />,
  package_change: <BoltIcon />,
  office_added: <HomeWorkIcon />,
  office_removed: <HomeWorkIcon />,
  contract_signed: <GavelIcon />,
  contract_terminated: <GavelIcon />
};

const KIND_COLOR: Record<string, string> = {
  audit: "text.secondary",
  user_created: "success.main",
  user_login: "info.main",
  package_change: "warning.main",
  office_added: "success.main",
  office_removed: "error.main",
  contract_signed: "primary.main",
  contract_terminated: "error.main"
};

/**
 * Users tab with client-side search + pagination. Backend already returns
 * every user of the tenant in one shot (they're capped by the platform
 * roster anyway) so filtering + paginating client-side is cheap and lets
 * the SuperAdmin land on a specific user without scrolling through 200
 * rows for busy tenants.
 */
interface UserRow {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLoginAt: string | null;
}
function UsersTab({ users, loading, onToggle, onDelete }: {
  users: readonly UserRow[];
  loading: boolean;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = users.filter(u => {
    if (statusFilter === "active" && !u.isActive) return false;
    if (statusFilter === "inactive" && u.isActive) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return u.email.toLowerCase().includes(s)
      || `${u.firstName} ${u.lastName}`.toLowerCase().includes(s)
      || u.role.toLowerCase().includes(s);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const clampedPage = Math.min(page, pageCount);
  if (clampedPage !== page && paged.length === 0 && filtered.length > 0) {
    // Guard: filters shrunk the list past the current page — snap back to 1.
    setPage(1);
  }

  return (
    <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ p: 2, alignItems: { md: "center" } }}>
        <TextField size="small" label="Αναζήτηση (email / όνομα / ρόλος)"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          sx={{ minWidth: 280 }} />
        <TextField select size="small" label="Κατάσταση" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          sx={{ minWidth: 160 }}>
          <MenuItem value="all">Όλοι</MenuItem>
          <MenuItem value="active">Ενεργοί</MenuItem>
          <MenuItem value="inactive">Ανενεργοί</MenuItem>
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={`${filtered.length} χρήστες`} />
        <TextField select size="small" label="Ανά σελίδα" value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          sx={{ minWidth: 100 }}>
          {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
      </Stack>
      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Email</TableCell>
              <TableCell>{t("tenants.userName")}</TableCell>
              <TableCell>{t("tenants.userRole")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell>{t("tenants.userLastLogin")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={6} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  Κανένας χρήστης δεν ταιριάζει στα φίλτρα.
                </TableCell></TableRow>
              )}
              {paged.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.firstName} {u.lastName}</TableCell>
                  <TableCell><Chip size="small" label={t(`roles.${u.role}`)} variant="outlined" /></TableCell>
                  <TableCell><Chip size="small" color={u.isActive ? "success" : "default"} label={u.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("el-GR") : "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => onToggle(u.id, !u.isActive)}>
                      {u.isActive ? t("tenants.userDeactivate") : t("tenants.userActivate")}
                    </Button>
                    <Button size="small" color="error" onClick={() => onDelete(u.id)}>
                      {t("common.delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ p: 2 }}>
            <Button size="small" variant="outlined"
              disabled={page <= 1} onClick={() => setPage(1)}>«</Button>
            <Button size="small" variant="outlined"
              disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</Button>
            <Typography variant="body2" sx={{ minWidth: 140, textAlign: "center" }}>
              Σελίδα <strong>{clampedPage}</strong> από <strong>{pageCount}</strong>
            </Typography>
            <Button size="small" variant="outlined"
              disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>›</Button>
            <Button size="small" variant="outlined"
              disabled={page >= pageCount} onClick={() => setPage(pageCount)}>»</Button>
          </Stack>
        </>
      )}
    </Card>
  );
}

function ActivityTab({ tenantId }: { tenantId: string }) {
  // Server-side pagination + filters. The old page dumped a flat 200 rows
  // which was unreadable on busy tenants; now every knob lives in the URL
  // params so a filtered view is bookmark-friendly.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [kindFilter, setKindFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const q = useQuery({
    queryKey: ["tenant-activity", tenantId, page, pageSize, kindFilter, actorFilter, search, fromDate, toDate],
    queryFn: async () => (await api.get<TimelinePage>(
      `/platform/tenants/${tenantId}/activity`,
      { params: {
          page, pageSize,
          kind: kindFilter || undefined,
          actor: actorFilter || undefined,
          search: search || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }
      }
    )).data
  });

  // Reset to first page whenever any filter changes so the operator doesn't
  // land on an empty page 4 after tightening the filters.
  useEffect(() => { setPage(1); }, [kindFilter, actorFilter, search, fromDate, toDate, pageSize]);

  const data = q.data;
  const entries = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  const resetFilters = () => {
    setKindFilter(""); setActorFilter(""); setSearch("");
    setFromDate(""); setToDate("");
  };
  const hasActiveFilter = !!(kindFilter || actorFilter || search || fromDate || toDate);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <HistoryIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Ιστορικό δραστηριότητας</Typography>
            <Typography variant="body2" color="text.secondary">
              Audit, χρήστες, πακέτα, υποκαταστήματα, συμβόλαια — με φίλτρα και σελιδοποίηση.
            </Typography>
          </Box>
          <Chip size="small" label={`${totalCount} συνολικά`} color={hasActiveFilter ? "primary" : "default"} />
        </Stack>

        {/* Filters row */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2.5, alignItems: { md: "center" } }}>
          <TextField select size="small" label="Τύπος" value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            sx={{ minWidth: 180 }}>
            <MenuItem value="">Όλα</MenuItem>
            {(data?.availableKinds ?? []).map(k => (
              <MenuItem key={k} value={k}>{KIND_LABEL[k] ?? k}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Χρήστης (email)" value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="π.χ. info@lanca"
            sx={{ minWidth: 200 }} />
          <TextField size="small" label="Αναζήτηση" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="τίτλος ή περιγραφή"
            sx={{ minWidth: 200 }} />
          <TextField size="small" label="Από" type="date" value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          <TextField size="small" label="Έως" type="date" value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          {hasActiveFilter && (
            <Button size="small" onClick={resetFilters}>Καθαρισμός</Button>
          )}
          <Box sx={{ flex: 1 }} />
          <TextField select size="small" label="Ανά σελίδα" value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            sx={{ minWidth: 100 }}>
            {[25, 50, 100, 200].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        </Stack>

        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : entries.length === 0 ? (
          <Typography textAlign="center" color="text.secondary" sx={{ py: 4 }}>
            {hasActiveFilter ? "Καμία πράξη με αυτά τα φίλτρα." : "Καμία πράξη στο διάστημα."}
          </Typography>
        ) : (
          <>
            <Stack spacing={0}>
              {entries.map((e, i) => (
                <Stack key={i} direction="row" spacing={2} sx={{ position: "relative", pl: 1, py: 1.5, borderLeft: "2px solid", borderColor: KIND_COLOR[e.kind] ?? "divider" }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", color: KIND_COLOR[e.kind] ?? "text.disabled", pt: 0.5 }}>
                    {KIND_ICON[e.kind] ?? <HistoryIcon />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Typography sx={{ fontWeight: 600 }}>{e.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        {new Date(e.at).toLocaleString("el-GR")}
                      </Typography>
                    </Stack>
                    {e.detail && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: 12.5, whiteSpace: "pre-wrap" }}>
                        {e.detail.length > 240 ? e.detail.slice(0, 240) + "…" : e.detail}
                      </Typography>
                    )}
                    {e.actorEmail && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {e.actorEmail}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              ))}
            </Stack>

            {/* Pagination bar */}
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" mt={3}>
              <Button size="small" variant="outlined"
                disabled={page <= 1} onClick={() => setPage(1)}>«</Button>
              <Button size="small" variant="outlined"
                disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</Button>
              <Typography variant="body2" sx={{ minWidth: 120, textAlign: "center" }}>
                Σελίδα <strong>{page}</strong> από <strong>{pageCount}</strong>
              </Typography>
              <Button size="small" variant="outlined"
                disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>›</Button>
              <Button size="small" variant="outlined"
                disabled={page >= pageCount} onClick={() => setPage(pageCount)}>»</Button>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/* Premium tab — toggle premium feature codes within the tenant's packages   */
/* ------------------------------------------------------------------------- */

import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { PREMIUM_FEATURE_CATALOGUE, type PremiumFeatureCode } from "../auth/PremiumContext";

interface PremiumResponse { codes: string[] }

const PREMIUM_PRESETS: { key: string; label: string; description: string; codes: PremiumFeatureCode[] }[] = [
  { key: "none",  label: "Καθαρό", description: "Καμία premium δυνατότητα.", codes: [] },
  { key: "small", label: "Small Office", description: "Πακέτο μικρού γραφείου · κάδος + branded εξαγωγές.",
    codes: ["recycle-bin", "advanced-exports"] },
  { key: "pro",   label: "Pro Office", description: "Pro · προσθήκη μαζικών προμηθειών & premium reports.",
    codes: ["recycle-bin", "advanced-exports", "bulk-commissions", "premium-reports"] },
  { key: "ent",   label: "Enterprise", description: "Όλες οι premium δυνατότητες ξεκλείδωτες.",
    codes: ["recycle-bin", "advanced-exports", "bulk-commissions", "multi-branch", "premium-reports"] }
];

function PremiumTab({ tenantId, onError }: { tenantId: string; onError: (m: string | null) => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Set<PremiumFeatureCode> | null>(null);

  const q = useQuery({
    queryKey: ["tenant-premium", tenantId],
    queryFn: async () => (await api.get<PremiumResponse>(`/me/premium-features`, {
      headers: { "X-Impersonate-Tenant": tenantId }
    })).data
  });

  const save = useMutation({
    mutationFn: async (next: PremiumFeatureCode[]) =>
      (await api.put<PremiumResponse>(`/platform/tenants/${tenantId}/premium-features`, { codes: next })).data,
    onSuccess: (r) => {
      qc.setQueryData(["tenant-premium", tenantId], r);
      setDraft(null);
      onError(null);
    },
    onError: (e) => onError(extractErrorMessage(e))
  });

  if (q.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  const current = draft ?? new Set(q.data?.codes as PremiumFeatureCode[] ?? []);
  const isDirty = draft !== null;
  const allCodes = Object.keys(PREMIUM_FEATURE_CATALOGUE) as PremiumFeatureCode[];

  function toggle(code: PremiumFeatureCode) {
    const next = new Set(current);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setDraft(next);
  }

  function applyPreset(codes: PremiumFeatureCode[]) {
    setDraft(new Set(codes));
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <WorkspacePremiumIcon sx={{ color: "#b08a3e" }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Premium δυνατότητες</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Ξεκλειδώστε premium features πάνω από τα baseline packages του tenant.
            </Typography>
          </Box>
          {isDirty && (
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setDraft(null)}>Άκυρο</Button>
              <Button variant="contained" disabled={save.isPending}
                onClick={() => save.mutate(Array.from(current))}>
                {save.isPending ? <CircularProgress size={16} color="inherit" /> : "Αποθήκευση"}
              </Button>
            </Stack>
          )}
        </Stack>

        <Box sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Γρήγορα πακέτα
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {PREMIUM_PRESETS.map(p => {
              const isCurrent = p.codes.length === current.size &&
                p.codes.every(c => current.has(c));
              return (
                <Button
                  key={p.key}
                  variant={isCurrent ? "contained" : "outlined"}
                  size="small"
                  onClick={() => applyPreset(p.codes)}
                  sx={{ fontWeight: 700 }}
                  title={p.description}
                >
                  {p.label} ({p.codes.length})
                </Button>
              );
            })}
          </Stack>
        </Box>

        <Stack divider={<Divider flexItem />} spacing={0}>
          {allCodes.map((code) => {
            const meta = PREMIUM_FEATURE_CATALOGUE[code];
            const enabled = current.has(code);
            return (
              <Stack key={code} direction={{ xs: "column", sm: "row" }} spacing={2}
                alignItems={{ sm: "center" }}
                sx={{ py: 2.5 }}>
                <Box sx={{ width: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Box sx={{
                    width: 44, height: 44, borderRadius: 2,
                    display: "grid", placeItems: "center",
                    background: enabled ? "linear-gradient(135deg, #f5d27c 0%, #b08a3e 100%)" : "rgba(0,0,0,0.04)",
                    color: enabled ? "#3a2a05" : "text.disabled"
                  }}>
                    <WorkspacePremiumIcon />
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="baseline">
                    <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{meta.label}</Typography>
                    <Chip size="small" label={`${meta.monthlyPriceEUR}€/μήνα`}
                      sx={{ fontWeight: 700, bgcolor: "rgba(176,138,62,0.1)", color: "#7a5b1c" }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{code}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 620 }}>
                    {meta.description}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={<Switch checked={enabled} onChange={() => toggle(code)} />}
                  label={enabled ? "Ενεργό" : "Ανενεργό"}
                  labelPlacement="start"
                />
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
