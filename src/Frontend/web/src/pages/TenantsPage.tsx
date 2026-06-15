import { useState } from "react";
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

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
  const [open, setOpen] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <Typography variant="h4">{t("tenants.title")}</Typography>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {tenantsQuery.data?.map((row) => (
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
                  </TableRow>
                ))}
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

      <CredentialsDialog
        open={!!createdInfo}
        email={createdInfo?.email ?? ""}
        password={createdInfo?.password ?? ""}
        onClose={() => setCreatedInfo(null)}
        title={t("tenants.created")}
        introKey="tenants.created"
      />
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
          <TextField
            label={t("tenants.adminPassword")}
            type="text"
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
