import { useEffect, useState } from "react";
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
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import { useNavigate } from "react-router-dom";
import LoginIcon from "@mui/icons-material/Login";
import { useImpersonation } from "../impersonation/ImpersonationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

type Role = "PlatformAdmin" | "PlatformEmployee" | "AgencyAdmin" | "AgencyUser" | "Producer" | "Customer";

interface PlatformUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  tenantId: string | null;
  tenantName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface TenantLite {
  id: string;
  name: string;
  code: string;
}

const ROLE_COLOR: Record<Role, "primary" | "secondary" | "default" | "info" | "warning"> = {
  PlatformAdmin: "primary",
  PlatformEmployee: "primary",
  AgencyAdmin: "secondary",
  AgencyUser: "info",
  Producer: "warning",
  Customer: "default"
};

export function AllUsersPage() {
  const { t } = useTranslation();
  const { user: me, startUserImpersonation } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { enter } = useImpersonation();

  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [editing, setEditing] = useState<PlatformUserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const bulkMutation = useMutation({
    mutationFn: async (action: "Activate" | "Deactivate" | "Delete") =>
      (await api.post<number>("/platform/users/bulk", { userIds: Array.from(selected), action })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["platform-users"] }); setSelected(new Set()); },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const usersQuery = useQuery({
    queryKey: ["platform-users", search, tenantFilter, roleFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (tenantFilter) params.tenantId = tenantFilter;
      if (roleFilter) params.role = roleFilter;
      return (await api.get<PlatformUserDto[]>("/platform/users", { params })).data;
    }
  });

  const tenantsQuery = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => (await api.get<TenantLite[]>("/tenants")).data
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/users/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-users"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const rows = usersQuery.data ?? [];

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("allUsers.title")}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t("allUsers.subtitle")}</Typography>

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
          <TextField
            size="small" placeholder={t("allUsers.searchPlaceholder")}
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: <FilterHelp title="Αναζήτηση σε email, όνομα, επώνυμο ή γραφείο." />
            }}
          />
          <FilterFieldWrap tip="Φιλτράρετε τους χρήστες ανά γραφείο (tenant).">
            <SearchableTextField
              select size="small" label={t("allUsers.tenant")}
              value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}
              sx={{ minWidth: 180, width: "100%" }}
            >
              <MenuItem value="">{t("allUsers.allTenants")}</MenuItem>
              {(tenantsQuery.data ?? []).map((tn) =>
                <MenuItem key={tn.id} value={tn.id}>{tn.name}</MenuItem>
              )}
            </SearchableTextField>
          </FilterFieldWrap>
          <FilterFieldWrap tip="Φιλτράρετε ανά ρόλο (PlatformAdmin, AgencyAdmin, Παραγωγός, Πελάτης κ.λπ.).">
            <SearchableTextField
              select size="small" label={t("allUsers.role")}
              value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")}
              sx={{ minWidth: 170, width: "100%" }}
            >
              <MenuItem value="">{t("allUsers.allRoles")}</MenuItem>
              {(["PlatformAdmin","PlatformEmployee","AgencyAdmin","AgencyUser","Producer","Customer"] as const).map(r =>
                <MenuItem key={r} value={r}>{t(`roles.${r}`)}</MenuItem>
              )}
            </SearchableTextField>
          </FilterFieldWrap>
        </Stack>
      </Card>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {selected.size > 0 && (
        <Card sx={{ mb: 2, bgcolor: "primary.main", color: "primary.contrastText" }}>
          <Toolbar variant="dense" sx={{ gap: 1 }}>
            <Typography sx={{ flex: 1, fontWeight: 700 }}>
              {t("allUsers.selected", { count: selected.size })}
            </Typography>
            <Button startIcon={<CheckCircleIcon />} color="inherit" size="small" variant="outlined"
              onClick={() => bulkMutation.mutate("Activate")} disabled={bulkMutation.isPending}>
              {t("allUsers.bulk.activate")}
            </Button>
            <Button startIcon={<BlockIcon />} color="inherit" size="small" variant="outlined"
              onClick={() => bulkMutation.mutate("Deactivate")} disabled={bulkMutation.isPending}>
              {t("allUsers.bulk.deactivate")}
            </Button>
            <Button startIcon={<DeleteIcon />} color="inherit" size="small" variant="outlined"
              onClick={() => { if (confirm(t("allUsers.bulk.deleteConfirm", { count: selected.size }))) bulkMutation.mutate("Delete"); }}
              disabled={bulkMutation.isPending}>
              {t("allUsers.bulk.delete")}
            </Button>
          </Toolbar>
        </Card>
      )}

      {usersQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < rows.length}
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())}
                    />
                  </TableCell>
                  <TableCell>{t("allUsers.col.name")}</TableCell>
                  <TableCell>{t("allUsers.col.email")}</TableCell>
                  <TableCell>{t("allUsers.col.tenant")}</TableCell>
                  <TableCell>{t("allUsers.col.role")}</TableCell>
                  <TableCell>{t("allUsers.col.status")}</TableCell>
                  <TableCell>{t("allUsers.col.lastLogin")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id} hover selected={selected.has(u.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                    </TableCell>
                    <TableCell><Typography fontWeight={600}>{u.firstName} {u.lastName}</Typography></TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{u.email}</TableCell>
                    <TableCell>{u.tenantName ?? "—"}</TableCell>
                    <TableCell><Chip size="small" color={ROLE_COLOR[u.role]} label={t(`roles.${u.role}`)} /></TableCell>
                    <TableCell>
                      <Chip size="small" color={u.isActive ? "success" : "default"}
                        label={u.isActive ? t("tenants.active") : t("tenants.inactive")} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("el-GR") : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {u.tenantId && u.tenantName && (
                          <IconButton size="small" color="primary" title={t("tenants.enterAs")}
                            onClick={() => { enter(u.tenantId!, u.tenantName!); navigate("/app"); }}>
                            <LoginIcon fontSize="small" />
                          </IconButton>
                        )}
                        {u.id !== me?.userId && (
                          <IconButton size="small" color="warning"
                            title={t("userImpersonation.tooltip")}
                            disabled={!u.isActive}
                            onClick={async () => {
                              if (!confirm(t("userImpersonation.loginAsConfirm", {
                                name: `${u.firstName} ${u.lastName}`, email: u.email
                              }))) return;
                              try {
                                await startUserImpersonation(u.id);
                                navigate("/app", { replace: true });
                                window.location.reload();
                              } catch (e) {
                                alert("Σφάλμα κατά τη σύνδεση ως χρήστης.");
                              }
                            }}>
                            <PersonOffIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => setEditing(u)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"
                          disabled={u.id === me?.userId}
                          onClick={() => { if (confirm(t("allUsers.confirmDelete", { name: `${u.firstName} ${u.lastName}` }))) deleteMutation.mutate(u.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography textAlign="center" color="text.secondary" py={4}>{t("common.noData")}</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <EditUserDialog user={editing} onClose={() => setEditing(null)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["platform-users"] }); setEditing(null); }} />
    </Box>
  );
}

function EditUserDialog({ user, onClose, onSaved }: {
  user: PlatformUserDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", role: "Customer" as Role, isActive: true
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName, lastName: user.lastName,
        phone: user.phone ?? "", role: user.role, isActive: user.isActive
      });
    }
  }, [user?.id]);

  const save = useMutation({
    mutationFn: async () => (await api.put<PlatformUserDto>(`/platform/users/${user!.id}`, form)).data,
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={!!user} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("allUsers.edit.title")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>{user?.email}</Typography>
          <Stack direction="row" spacing={2}>
            <TextField label={t("users.firstName")} value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })} fullWidth required />
            <TextField label={t("users.lastName")} value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })} fullWidth required />
          </Stack>
          <TextField label={t("users.phone")} value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
          <SearchableTextField label={t("users.role")} value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })} fullWidth>
            {(["PlatformAdmin","PlatformEmployee","AgencyAdmin","AgencyUser","Producer","Customer"] as const).map(r =>
              <MenuItem key={r} value={r}>{t(`roles.${r}`)}</MenuItem>
            )}
          </SearchableTextField>
          <FormControlLabel
            control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
            label={t("allUsers.edit.active")}
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
