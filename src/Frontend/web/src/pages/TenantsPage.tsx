import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
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
import { Menu } from "@mui/material";
import { FormControlLabel, Switch } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { useImpersonation } from "../impersonation/ImpersonationContext";
import { PasswordField } from "../components/PasswordField";

interface Tenant {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  subscriptionPlan: string;
  createdAt: string;
  userCount: number;
  customerCount: number;
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

  // Premium-grant presets that mirror the TenantDetailPage Premium tab.
  // One-click PUT lets the platform admin upgrade a tenant without drilling in.
  const PREMIUM_PRESETS: { key: string; label: string; codes: string[] }[] = [
    { key: "none",  label: "Καμία premium",  codes: [] },
    { key: "small", label: "Small Office",   codes: ["recycle-bin", "advanced-exports"] },
    { key: "pro",   label: "Pro Office",     codes: ["recycle-bin", "advanced-exports", "bulk-commissions", "premium-reports"] },
    { key: "ent",   label: "Enterprise (όλα)", codes: ["recycle-bin", "advanced-exports", "producer-reconciliation", "bulk-commissions", "multi-branch", "premium-reports"] }
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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h4">{t("tenants.title")}</Typography>
          <HelpHint id="page.tenants" />
        </Stack>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setError(null); setOpen(true); }}>
          {t("tenants.create")}
        </Button>
      </Stack>

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
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("tenants.name")}</TableCell>
                  <TableCell>{t("tenants.code")}</TableCell>
                  <TableCell>{t("tenants.subscriptionPlan")}</TableCell>
                  <TableCell align="right">{t("tenants.users")}</TableCell>
                  <TableCell align="right">{t("tenants.customersCol")}</TableCell>
                  <TableCell>{t("tenants.status")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {tenantsQuery.data?.map((row) => {
                  const isPlatform = row.code === "PLATFORM";
                  return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{row.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={row.code} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{row.subscriptionPlan}</TableCell>
                    <TableCell align="right">{row.userCount}</TableCell>
                    <TableCell align="right">{row.customerCount}</TableCell>
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

      <EditTenantDialog
        tenant={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tenants"] }); setEditing(null); }}
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
          />
          <TextField
            label={t("tenants.code")}
            helperText={t("tenants.codeHelp")}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            fullWidth
            required
          />
          <TextField
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
          </TextField>
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
            />
            <TextField
              label={t("tenants.adminLastName")}
              value={form.adminLastName}
              onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
              fullWidth
              required
            />
          </Stack>
          <TextField
            label={t("tenants.adminEmail")}
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label={t("tenants.adminPhone")}
            value={form.adminPhone}
            onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
            fullWidth
          />
          <PasswordField
            label={t("tenants.adminPassword")}
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            fullWidth
            required
            helperText="min 8 chars"
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
          <TextField select label={t("tenants.subscriptionPlan")} value={form.subscriptionPlan}
            onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })} fullWidth>
            {["Trial","Basic","Pro","Enterprise"].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
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
