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
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import IconButton from "@mui/material/IconButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { PasswordField } from "../components/PasswordField";
import { UserPermissionsDialog } from "../components/UserPermissionsDialog";

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

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<UserDto[]>("/users")).data
  });

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
        <Typography variant="h4">{t("users.title")}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setError(null); setOpen(true); }}>
          {t("users.create")}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
                {(usersQuery.data ?? []).map((u) => (
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
                {(usersQuery.data ?? []).length === 0 && (
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
          <TextField
            select
            label={t("users.role")}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as CreateBody["role"] })}
            fullWidth
          >
            <MenuItem value="AgencyUser">{t("roles.AgencyUser")}</MenuItem>
            <MenuItem value="AgencyAdmin">{t("roles.AgencyAdmin")}</MenuItem>
          </TextField>
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
