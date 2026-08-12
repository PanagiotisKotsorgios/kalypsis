import { useEffect, useMemo, useState } from "react";
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
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import IconButton from "@mui/material/IconButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { PasswordField } from "../components/PasswordField";
import { UserPermissionsDialog } from "../components/UserPermissionsDialog";
import { SearchableTextField } from "../components/SearchableTextField";

interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: "AgencyAdmin" | "AgencyUser";
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface CreateBody {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password: string;
  role: "AgencyAdmin" | "AgencyUser";
}

export function EmployeesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permsUserId, setPermsUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "AgencyAdmin" | "AgencyUser">("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<UserDto[]>("/users")).data
  });

  const filteredUsers = useMemo(() => {
    const all = usersQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    return all.filter(u => {
      if (needle) {
        const hay = `${u.firstName} ${u.lastName} ${u.email} ${u.phone ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      return true;
    });
  }, [usersQuery.data, search, roleFilter]);
  useEffect(() => { setPage(0); }, [search, roleFilter]);
  const pagedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) => (await api.post<{ user: UserDto }>("/users", body)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h4">{t("users.title")}</Typography>
          <HelpHint id="page.users" />
        </Stack>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setError(null); setOpen(true); }}>
          {t("users.create")}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filter card — search + role picker with matching red clear button. */}
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "center",
        }}>
          <TextField size="small" placeholder="Αναζήτηση: όνομα, email, τηλέφωνο…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ gridColumn: { md: "span 2" } }} />
          <SearchableTextField size="small" label={t("users.role")} fullWidth
            value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "" | "AgencyAdmin" | "AgencyUser")}>
            <MenuItem value="">Όλοι</MenuItem>
            <MenuItem value="AgencyAdmin">{t("roles.AgencyAdmin")}</MenuItem>
            <MenuItem value="AgencyUser">{t("roles.AgencyUser")}</MenuItem>
          </SearchableTextField>
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => { setSearch(""); setRoleFilter(""); }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </Card>

      {usersQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("users.fullName")}</TableCell>
                  <TableCell>{t("users.email")}</TableCell>
                  <TableCell>{t("users.phone")}</TableCell>
                  <TableCell>{t("users.role")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedUsers.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell><Typography fontWeight={600}>{u.firstName} {u.lastName}</Typography></TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone ?? "-"}</TableCell>
                    <TableCell>
                      <Chip label={t(`roles.${u.role}`)} size="small" color={u.role === "AgencyAdmin" ? "primary" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setPermsUserId(u.id)} title={t("permissions.title")}>
                        <VpnKeyIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {pagedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary" textAlign="center" py={4}>
                        {t("common.noData")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredUsers.length}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={ev => { setRowsPerPage(parseInt(ev.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100, 250]}
            labelRowsPerPage="Ανά σελίδα"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
          />
        </Card>
      )}

      <CreateDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(b) => createMutation.mutate(b)}
        submitting={createMutation.isPending}
      />

      <UserPermissionsDialog userId={permsUserId} onClose={() => setPermsUserId(null)} />
    </Box>
  );
}

function CreateDialog({
  open,
  onClose,
  onSubmit,
  submitting
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (b: CreateBody) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateBody>({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    role: "AgencyUser"
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("users.createTitle")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={t("users.firstName")}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={t("users.lastName")}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              fullWidth
              required
            />
          </Stack>
          <TextField
            label={t("users.email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label={t("users.phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            fullWidth
          />
          <SearchableTextField
            select
            label={t("users.role")}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as CreateBody["role"] })}
            fullWidth
          >
            <MenuItem value="AgencyUser">{t("roles.AgencyUser")}</MenuItem>
            <MenuItem value="AgencyAdmin">{t("roles.AgencyAdmin")}</MenuItem>
          </SearchableTextField>
          <PasswordField
            label={t("users.password")}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            fullWidth
            required
            helperText="min 8 chars"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={() => onSubmit(form)} variant="contained" disabled={submitting}>
          {submitting ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
