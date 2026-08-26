import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LoginIcon from "@mui/icons-material/Login";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { FormControl, InputLabel, Menu, Select } from "@mui/material";
import { FormControlLabel, Switch } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { useImpersonation } from "../impersonation/ImpersonationContext";
import { PasswordField } from "../components/PasswordField";
import { AdminOtpConfirmDialog } from "../components/AdminOtpConfirmDialog";
import { SearchableTextField } from "../components/SearchableTextField";

interface Tenant {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  subscriptionPlan: string;
  createdAt: string;
  userCount: number;
  customerCount: number;
  packageCount: number;
}

interface CreateTenantBody {
  name: string;
  code: string;
  subscriptionPlan: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone?: string;
  adminPassword: string;
}

interface CreateTenantResponse {
  tenant: Tenant;
  adminUserId: string;
  adminEmail: string;
}

const PLANS = ["Trial", "Basic", "Pro", "Enterprise"];

export function TenantsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { enter: enterImpersonation } = useImpersonation();
  const [open, setOpen] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumMenu, setPremiumMenu] = useState<{ anchor: HTMLElement; tenantId: string } | null>(null);
  const [standaloneProducerOpen, setStandaloneProducerOpen] = useState(false);
  // Search + status filter for the tenants table. Runs client-side over
  // the /tenants response — the list is small enough (≤ 100s of rows in
  // realistic ops) that in-memory filtering feels instant. If the list
  // ever balloons this becomes a server-side query.
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Premium-grant presets that mirror the TenantDetailPage Premium tab.
  // One-click PUT lets the platform admin upgrade a tenant without drilling in.
  const PREMIUM_PRESETS: { key: string; label: string; codes: string[] }[] = [
    { key: "none",  label: "Καμία premium",  codes: [] },
    { key: "small", label: "Small Office",   codes: ["recycle-bin", "advanced-exports"] },
    { key: "pro",   label: "Pro Office",     codes: ["recycle-bin", "advanced-exports", "bulk-commissions", "premium-reports"] },
    { key: "ent",   label: "Enterprise (όλα)", codes: ["recycle-bin", "advanced-exports", "bulk-commissions", "multi-branch", "premium-reports"] }
  ];

  const applyPremiumPreset = useMutation({
    mutationFn: async ({ tenantId, codes }: { tenantId: string; codes: string[] }) =>
      api.put(`/platform/tenants/${tenantId}/premium-features`, { codes }),
    onSuccess: () => { setPremiumMenu(null); setError(null); },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tenants/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenants"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const tenantsQuery = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => (await api.get<Tenant[]>("/tenants")).data
  });

  // Filtered view — search matches name/code/plan (case-insensitive),
  // planFilter matches subscriptionPlan exactly, statusFilter matches
  // isActive. Kept in useMemo so we don't recompute on unrelated renders.
  const filteredTenants = useMemo(() => {
    const rows = tenantsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter(row => {
      if (planFilter !== "all" && (row.subscriptionPlan ?? "") !== planFilter) return false;
      if (statusFilter === "active" && !row.isActive) return false;
      if (statusFilter === "inactive" && row.isActive) return false;
      if (!q) return true;
      const hay = `${row.name} ${row.code} ${row.subscriptionPlan ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tenantsQuery.data, search, planFilter, statusFilter]);
  const availablePlans = useMemo(() => {
    const set = new Set<string>();
    for (const t of tenantsQuery.data ?? []) if (t.subscriptionPlan) set.add(t.subscriptionPlan);
    return Array.from(set).sort();
  }, [tenantsQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (body: CreateTenantBody) =>
      (await api.post<CreateTenantResponse>("/tenants", body)).data,
    onSuccess: (data, variables) => {
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      setOpen(false);
      setCreatedInfo({ email: data.adminEmail, password: variables.adminPassword });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  // Discovery: is wipe-and-reseed even allowed in this environment?
  // Production has KALYPSIS_ALLOW_DEMO_WIPE unset → `allowed: false`
  // → the destructive button stays disabled with a tooltip explanation
  // and NEVER opens the confirmation dialog.
  const wipeStatus = useQuery({
    queryKey: ["wipe-reseed-status"],
    queryFn: async () => (await api.get<{ allowed: boolean; requiredPhrase: string }>(
      "/platform/demo/wipe-and-reseed/status")).data,
    staleTime: 5 * 60_000,
  });
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);
  const [wipeOtpOpen, setWipeOtpOpen] = useState(false);
  const [wipeTyped, setWipeTyped] = useState("");

  const wipeReseed = useMutation({
    mutationFn: async (args: { otpToken: string }) => (await api.post<{
      usersDeleted: number; tenantsDeleted: number;
      tenantsCreated: number; usersCreated: number;
      customersCreated: number; producersCreated: number;
      policiesCreated: number; bridgeRunsCreated: number;
      endorsementsCreated: number; cancellationsCreated: number;
      claimsCreated: number; receiptsCreated: number; paymentsCreated: number;
      tasksCreated: number; appointmentsCreated: number;
      notificationsCreated: number; communicationsCreated: number;
      commissionRulesCreated: number; commissionRunsCreated: number;
    }>("/platform/demo/wipe-and-reseed",
      { confirmationPhrase: wipeTyped },
      // OTP header — the AdminOtpConfirmDialog obtained + verified the
      // token. Backend's [RequiresAdminOtp] filter rejects requests
      // without it.
      { headers: { "X-Admin-OTP-Token": args.otpToken } })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      setWipeConfirmOpen(false);
      setWipeTyped("");
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h4">{t("tenants.title")}</Typography>
          <HelpHint id="page.tenants" />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined"
            onClick={async () => {
              try {
                const res = await api.get("/platform/demo/bridge-samples.zip", { responseType: "blob" });
                const url = URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
                const a = document.createElement("a");
                a.href = url; a.download = "bridge-samples.zip";
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) { setError(extractErrorMessage(e)); }
            }}>
            Κατέβασμα Bridge Samples
          </Button>
          {/* Wipe & Reseed — HIDDEN entirely when the environment doesn't
              allow it (production sets KALYPSIS_ALLOW_DEMO_WIPE to
              nothing → the /status endpoint returns allowed:false).
              Even when visible, it opens a modal that requires the
              operator to TYPE the confirmation phrase — a click alone
              can't fire the destructive request any more. */}
          {wipeStatus.data?.allowed && (
            <Button variant="outlined" color="error"
              onClick={() => { setWipeTyped(""); setWipeConfirmOpen(true); }}
              disabled={wipeReseed.isPending}>
              {wipeReseed.isPending ? <CircularProgress size={16} /> : "Wipe & Reseed Demo"}
            </Button>
          )}
          <Button variant="outlined"
            onClick={() => setStandaloneProducerOpen(true)}
            startIcon={<PersonAddIcon />}>
            Νέος Συνεργάτης
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setError(null); setOpen(true); }}>
            {t("tenants.create")}
          </Button>
        </Stack>
      </Stack>
      {wipeReseed.data && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <div><b>Ολοκληρώθηκε το wipe & reseed!</b></div>
          <div>Διαγράφηκαν: {wipeReseed.data.tenantsDeleted} γραφεία · {wipeReseed.data.usersDeleted} χρήστες</div>
          <div>Δημιουργήθηκαν: {wipeReseed.data.tenantsCreated} γραφεία · {wipeReseed.data.usersCreated} users ·
            {" "}{wipeReseed.data.producersCreated} συνεργάτες ·
            {" "}{wipeReseed.data.customersCreated} πελάτες ·
            {" "}{wipeReseed.data.policiesCreated} συμβόλαια</div>
          <div>Στοιχεία ενεργειών: {wipeReseed.data.endorsementsCreated} πρόσθετες πράξεις ·
            {" "}{wipeReseed.data.cancellationsCreated} ακυρώσεις ·
            {" "}{wipeReseed.data.claimsCreated} ζημιές</div>
          <div>Οικονομικά: {wipeReseed.data.receiptsCreated} εισπράξεις ·
            {" "}{wipeReseed.data.paymentsCreated} πληρωμές ·
            {" "}{wipeReseed.data.commissionRulesCreated} κανόνες προμηθειών ·
            {" "}{wipeReseed.data.commissionRunsCreated} εκκαθαρίσεις</div>
          <div>Καθημερινά: {wipeReseed.data.tasksCreated} εργασίες ·
            {" "}{wipeReseed.data.appointmentsCreated} ραντεβού ·
            {" "}{wipeReseed.data.communicationsCreated} επικοινωνίες ·
            {" "}{wipeReseed.data.notificationsCreated} ειδοποιήσεις</div>
          <div>Γέφυρες: {wipeReseed.data.bridgeRunsCreated} bridge runs (μερικά επίτηδες με σφάλματα για troubleshooting)</div>
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {tenantsQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          {/* Search + filter bar. Renders above the table so operators
              can whittle down a long list without scrolling. Active
              filters get a summary chip they can click to clear. */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }} alignItems={{ md: "center" }}>
            <TextField size="small" placeholder="Αναζήτηση (όνομα / κωδικός / email)"
              value={search} onChange={e => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 220 }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Πλάνο</InputLabel>
              <Select label="Πλάνο" value={planFilter} onChange={e => setPlanFilter(String(e.target.value))}>
                <MenuItem value="all">Όλα τα πλάνα</MenuItem>
                {availablePlans.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Κατάσταση</InputLabel>
              <Select label="Κατάσταση" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
                <MenuItem value="all">Όλα</MenuItem>
                <MenuItem value="active">Ενεργά</MenuItem>
                <MenuItem value="inactive">Ανενεργά</MenuItem>
              </Select>
            </FormControl>
            <Chip label={`${filteredTenants.length} / ${tenantsQuery.data?.length ?? 0}`}
              variant="outlined" size="small" />
            {(search || planFilter !== "all" || statusFilter !== "all") && (
              <Button size="small" onClick={() => { setSearch(""); setPlanFilter("all"); setStatusFilter("all"); }}>
                Καθαρισμός φίλτρων
              </Button>
            )}
          </Stack>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("tenants.name")}</TableCell>
                  <TableCell>{t("tenants.code")}</TableCell>
                  <TableCell>{t("tenants.subscriptionPlan")}</TableCell>
                  <TableCell align="right">{t("tenants.users")}</TableCell>
                  <TableCell align="right">{t("tenants.customersCol")}</TableCell>
                  <TableCell align="right">Πακέτα</TableCell>
                  <TableCell>{t("tenants.status")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTenants.map((row) => {
                  const isPlatform = row.code === "PLATFORM";
                  return (
                  <TableRow key={row.id} hover
                    onClick={(e) => {
                      // Row-level click opens the tenant detail page. Skip
                      // when the click originated on an action button so
                      // impersonate/edit/delete keep their own behavior.
                      const t = e.target as HTMLElement;
                      if (t.closest("button,a,input,[role='button']")) return;
                      if (isPlatform) return;
                      navigate(`/app/tenants/${row.id}`);
                    }}
                    sx={{ cursor: isPlatform ? "default" : "pointer" }}>
                    <TableCell>
                      <Typography fontWeight={600} sx={{ color: isPlatform ? "text.primary" : "primary.main" }}>
                        {row.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={row.code} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{row.subscriptionPlan}</TableCell>
                    <TableCell align="right">{row.userCount}</TableCell>
                    <TableCell align="right">{row.customerCount}</TableCell>
                    <TableCell align="right">
                      {row.packageCount === 0 && !isPlatform ? (
                        <Chip size="small" clickable
                          label="0 ⚠️"
                          color="warning"
                          title="Χωρίς ενεργά πακέτα — το γραφείο βλέπει άδειο sidebar. Πάτησε για να ενεργοποιήσεις."
                          onClick={(e) => { e.stopPropagation(); navigate(`/app/tenants/${row.id}?tab=packages`); }} />
                      ) : (
                        <Typography variant="body2" fontFamily="monospace">{row.packageCount}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.isActive ? t("tenants.active") : t("tenants.inactive")}
                        color={row.isActive ? "success" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" title={t("tenants.openDetail")}
                          onClick={() => navigate(`/app/tenants/${row.id}`)} disabled={isPlatform}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="primary" title={t("tenants.enterAs")}
                          onClick={() => { enterImpersonation(row.id, row.name); navigate("/app", { replace: false }); }}
                          disabled={isPlatform}>
                          <LoginIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={isPlatform}
                          title="Premium δυνατότητες"
                          onClick={(e) => setPremiumMenu({ anchor: e.currentTarget, tenantId: row.id })}>
                          <WorkspacePremiumIcon fontSize="small" sx={{ color: "#b08a3e" }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => setEditing(row)} disabled={isPlatform}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" disabled={isPlatform}
                          onClick={() => { if (confirm(t("tenants.confirmDelete", { name: row.name }))) deleteMutation.mutate(row.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <CreateTenantDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(b) => createMutation.mutate(b)}
        submitting={createMutation.isPending}
      />

      {/* Wipe & Reseed — typed-confirmation dialog.
          Replaces the old browser confirm(). Enter button stays
          disabled until the operator types the exact server-required
          phrase (returned by /wipe-and-reseed/status). Backend
          double-checks. Even with muscle-memory clicks, nothing
          destructive happens without keystrokes. */}
      <Dialog open={wipeConfirmOpen} onClose={() => setWipeConfirmOpen(false)}
        fullWidth maxWidth="sm">
        <DialogTitle sx={{ color: "error.main", fontWeight: 800 }}>
          Wipe & Reseed — καταστροφική ενέργεια
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Θα <b>διαγραφούν HARD</b> όλα τα γραφεία και όλοι οι χρήστες εκτός
            από τον καλούντα superadmin και το Kalypsis Platform tenant.
            Στη συνέχεια θα δημιουργηθούν 5 demo γραφεία με ψεύτικα δεδομένα.
            Η ενέργεια <b>δεν αναιρείται</b> — δεν υπάρχει «undo».
          </Alert>
          <Typography variant="body2" mb={1}>
            Για να συνεχίσετε, γράψτε την ακόλουθη φράση ΑΚΡΙΒΩΣ:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 800, mb: 2, p: 1, bgcolor: "rgba(255,0,0,0.06)" }}>
            {wipeStatus.data?.requiredPhrase ?? "…"}
          </Typography>
          <TextField autoFocus fullWidth value={wipeTyped}
            onChange={e => setWipeTyped(e.target.value)}
            placeholder="Πληκτρολογήστε τη φράση εδώ" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWipeConfirmOpen(false)}>Άκυρο</Button>
          <Button variant="contained" color="error"
            disabled={
              wipeReseed.isPending ||
              !wipeStatus.data?.requiredPhrase ||
              wipeTyped !== wipeStatus.data.requiredPhrase
            }
            onClick={() => {
              // Phrase accepted → close this dialog, open OTP gate.
              // The wipeReseed mutation now fires only after OTP verification.
              setWipeConfirmOpen(false);
              setWipeOtpOpen(true);
            }}>
            {wipeReseed.isPending ? <CircularProgress size={16} /> : "Συνέχεια → 6ψήφιος κωδικός"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* OTP gate on wipe-and-reseed — 4th safeguard on top of:
          env-var, typed phrase, and the initial confirmation dialog above.
          A hacker who steals PlatformAdmin creds can't destroy data
          without ALSO having access to info@mykalypsis.gr. */}
      {wipeOtpOpen && (
        <AdminOtpConfirmDialog
          open={wipeOtpOpen}
          onClose={() => setWipeOtpOpen(false)}
          action="wipe-and-reseed"
          actionLabel="Wipe & Reseed Demo — κατεδάφιση όλων των γραφείων + χρηστών"
          destructiveWarning="ΘΑ ΔΙΑΓΡΑΦΟΥΝ οριστικά όλα τα γραφεία και όλοι οι χρήστες. Καμία αναίρεση από το app — μόνο restore από backup."
          onConfirm={async (token) => {
            await wipeReseed.mutateAsync({ otpToken: token });
            setWipeOtpOpen(false);
            setWipeTyped("");
          }}
        />
      )}

      <EditTenantDialog
        tenant={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tenants"] }); setEditing(null); }}
      />

      <StandaloneProducerDialog
        open={standaloneProducerOpen}
        onClose={() => setStandaloneProducerOpen(false)}
        onCredentials={(info) => setCreatedInfo(info)}
      />

      <CredentialsDialog
        open={!!createdInfo}
        email={createdInfo?.email ?? ""}
        password={createdInfo?.password ?? ""}
        onClose={() => setCreatedInfo(null)}
        title={t("tenants.created")}
        introKey="tenants.created"
      />

      <Menu
        anchorEl={premiumMenu?.anchor}
        open={!!premiumMenu}
        onClose={() => setPremiumMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {PREMIUM_PRESETS.map(p => (
          <MenuItem
            key={p.key}
            disabled={applyPremiumPreset.isPending}
            onClick={() => {
              if (!premiumMenu) return;
              applyPremiumPreset.mutate({ tenantId: premiumMenu.tenantId, codes: p.codes });
            }}
          >
            {p.label}
            <Box sx={{ ml: "auto", fontSize: 11, color: "text.secondary" }}>{p.codes.length}</Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: CreateTenantBody) => void;
  submitting: boolean;
}

function CreateTenantDialog({ open, onClose, onSubmit, submitting }: CreateDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateTenantBody>({
    name: "",
    code: "",
    subscriptionPlan: "Pro",
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
    adminPhone: "",
    adminPassword: ""
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("tenants.createTitle")}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" mb={2}>
          {t("tenants.createSubtitle")}
        </Typography>
        <Stack spacing={2} mt={1}>
          <TextField
            label={t("tenants.name")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            fullWidth
            required
            InputProps={{ endAdornment: <FilterHelp title="Επίσημη επωνυμία γραφείου όπως εμφανίζεται στα έγγραφα και τα emails." /> }}
          />
          <TextField
            label={t("tenants.code")}
            helperText={t("tenants.codeHelp")}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            fullWidth
            required
            InputProps={{ endAdornment: <FilterHelp title="Σύντομος κωδικός γραφείου (κεφαλαία). Χρησιμοποιείται σε bridges και exports." /> }}
          />
          <FilterFieldWrap tip="Το πακέτο συνδρομής καθορίζει ποιες λειτουργίες θα είναι διαθέσιμες στο γραφείο.">
            <SearchableTextField
              select
              label={t("tenants.subscriptionPlan")}
              value={form.subscriptionPlan}
              onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}
              fullWidth
            >
              {PLANS.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </SearchableTextField>
          </FilterFieldWrap>
          <Typography variant="overline" color="text.secondary" sx={{ mt: 2 }}>
            {t("tenants.adminSection")}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={t("tenants.adminFirstName")}
              value={form.adminFirstName}
              onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
              fullWidth
              required
              InputProps={{ endAdornment: <FilterHelp title="Όνομα του κύριου διαχειριστή του γραφείου (πρώτος admin user)." /> }}
            />
            <TextField
              label={t("tenants.adminLastName")}
              value={form.adminLastName}
              onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
              fullWidth
              required
              InputProps={{ endAdornment: <FilterHelp title="Επώνυμο του κύριου διαχειριστή του γραφείου." /> }}
            />
          </Stack>
          <TextField
            label={t("tenants.adminEmail")}
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            fullWidth
            required
            InputProps={{ endAdornment: <FilterHelp title="Email εισόδου του διαχειριστή. Πρέπει να είναι μοναδικό σε ολόκληρη την πλατφόρμα." /> }}
          />
          <TextField
            label={t("tenants.adminPhone")}
            value={form.adminPhone}
            onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
            fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Τηλέφωνο επικοινωνίας του διαχειριστή (προαιρετικό)." /> }}
          />
          <PasswordField
            label={t("tenants.adminPassword")}
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            fullWidth
            required
            helperText="Ελάχιστο 8 χαρακτήρες. Ο διαχειριστής μπορεί να τον αλλάξει αργότερα από το προφίλ του."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          onClick={() => onSubmit(form)}
          variant="contained"
          disabled={submitting}
        >
          {submitting ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface CredentialsDialogProps {
  open: boolean;
  email: string;
  password: string;
  onClose: () => void;
  title: string;
  introKey: string;
}

function EditTenantDialog({ tenant, onClose, onSaved }: {
  tenant: Tenant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", subscriptionPlan: "Pro", isActive: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) setForm({ name: tenant.name, subscriptionPlan: tenant.subscriptionPlan, isActive: tenant.isActive });
  }, [tenant?.id]);

  const save = useMutation({
    mutationFn: async () => (await api.put<Tenant>(`/tenants/${tenant!.id}`, form)).data,
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={!!tenant} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("tenants.edit.title")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField label={t("tenants.name")} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
          <SearchableTextField label={t("tenants.subscriptionPlan")} value={form.subscriptionPlan}
            onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })} fullWidth>
            {["Trial","Basic","Pro","Enterprise"].map(p => <MenuItem key={p} value={p}>{String(t(`subscriptionPlan.${p}`, p))}</MenuItem>)}
          </SearchableTextField>
          <FormControlLabel
            control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
            label={t("tenants.active")}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CredentialsDialog({ open, email, password, onClose, title }: CredentialsDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (txt: string, which: string) => {
    void navigator.clipboard.writeText(txt);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Email
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontFamily="monospace" fontSize={15}>
                {email}
              </Typography>
              <IconButton size="small" onClick={() => copy(email, "email")}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Stack>
            {copied === "email" && (
              <Typography variant="caption" color="success.main">
                {t("common.copied")}
              </Typography>
            )}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("customers.tempPassword")}
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontFamily="monospace" fontSize={15}>
                {password}
              </Typography>
              <IconButton size="small" onClick={() => copy(password, "pwd")}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Stack>
            {copied === "pwd" && (
              <Typography variant="caption" color="success.main">
                {t("common.copied")}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Superadmin quick-create for a standalone Producer + linked User in any
// tenant, no impersonation. Wraps POST /platform/demo/standalone-producer-user
// which returns a generated temp password we surface via CredentialsDialog.
function StandaloneProducerDialog({ open, onClose, onCredentials }: {
  open: boolean;
  onClose: () => void;
  onCredentials: (info: { email: string; password: string }) => void;
}) {
  const [form, setForm] = useState({
    tenantId: "",
    code: "",
    name: "",
    email: "",
    phone: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ tenantId: "", code: "", name: "", email: "", phone: "" });
      setError(null);
    }
  }, [open]);

  const tenantsQ = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => (await api.get<Tenant[]>("/tenants")).data,
    enabled: open
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ producerId: string; userId: string; email: string; temporaryPassword: string }>(
        "/platform/demo/standalone-producer-user", form);
      return res.data;
    },
    onSuccess: (data) => {
      onClose();
      onCredentials({ email: data.email, password: data.temporaryPassword });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const canSubmit = !!form.tenantId && !!form.code.trim() && !!form.name.trim() && !!form.email.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Νέος Συνεργάτης (standalone)</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Δημιουργεί παραγωγό + χρήστη portal σε ένα βήμα, σε οποιοδήποτε γραφείο, <b>χωρίς impersonation</b>.
          Θα εμφανιστεί προσωρινός κωδικός που πρέπει να δώσετε στον συνεργάτη.
        </Alert>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} mt={1}>
          <FilterFieldWrap tip="Το ασφαλιστικό γραφείο στο οποίο θα ανήκει ο συνεργάτης.">
            <SearchableTextField
              select label="Γραφείο" value={form.tenantId}
              onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
              required fullWidth
            >
              <MenuItem value="">— Επιλέξτε γραφείο —</MenuItem>
              {(tenantsQ.data ?? []).map(x => (
                <MenuItem key={x.id} value={x.id}>{x.name} ({x.code})</MenuItem>
              ))}
            </SearchableTextField>
          </FilterFieldWrap>
          <TextField label="Κωδικός παραγωγού" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="π.χ. PR9901" required
            InputProps={{ endAdornment: <FilterHelp title="Μοναδικός κωδικός συνεργάτη μέσα στο γραφείο. Χρησιμοποιείται σε bridges και reports." /> }} />
          <TextField label="Ονοματεπώνυμο" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required
            InputProps={{ endAdornment: <FilterHelp title="Πλήρες όνομα του συνεργάτη όπως εμφανίζεται σε λίστες και έγγραφα." /> }} />
          <TextField label="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required
            InputProps={{ endAdornment: <FilterHelp title="Email εισόδου του συνεργάτη στο portal του Kalypsis. Πρέπει να είναι μοναδικό στο γραφείο." /> }} />
          <TextField label="Τηλέφωνο (προαιρετικό)" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            InputProps={{ endAdornment: <FilterHelp title="Τηλέφωνο επικοινωνίας του συνεργάτη (προαιρετικό)." /> }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained">Ακύρωση</Button>
        <Button variant="contained" onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
          {create.isPending ? <CircularProgress size={18} /> : "Δημιουργία"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
