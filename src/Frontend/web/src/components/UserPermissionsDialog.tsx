import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface UserPermissionsDto {
  userId: string; email: string; name: string; role: string;
  effective: string[]; custom: string[] | null;
}
interface UserDto {
  id: string; email: string; firstName: string; lastName: string; phone: string | null;
  role: "AgencyAdmin" | "AgencyUser" | "Producer" | "Customer" | "PlatformAdmin";
  isActive: boolean; createdAt: string; lastLoginAt: string | null;
}

const GROUPS: { key: string; codes: string[] }[] = [
  { key: "customers", codes: ["customers.read","customers.write","customers.delete"] },
  { key: "policies", codes: ["policies.read","policies.write","policies.delete"] },
  { key: "documents", codes: ["documents.read","documents.write"] },
  { key: "claims", codes: ["claims.read","claims.write"] },
  { key: "appointments", codes: ["appointments.read","appointments.write"] },
  { key: "tariffs", codes: ["tariffs.read","tariffs.write"] },
  { key: "covernotes", codes: ["covernotes.read","covernotes.write"] },
  { key: "financials", codes: ["financials.read","receipts.read","receipts.write","payments.read","payments.write","securities.read","securities.write"] },
  { key: "commissions", codes: ["commissions.read","commissions.run","overcommissions.read","overcommissions.write"] },
  { key: "marketing", codes: ["marketing.read","marketing.send","delivery.read","delivery.write"] },
  { key: "production", codes: ["production.read","goals.read","goals.write"] },
  { key: "bridges", codes: ["bridges.read","bridges.sync","exports.run"] }
];

export function UserPermissionsDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  // Permissions
  const q = useQuery({
    queryKey: ["user-permissions", userId], enabled: !!userId,
    queryFn: async () => (await api.get<UserPermissionsDto>(`/permissions/user/${userId}`)).data
  });
  // Full user object — needed for the "Στοιχεία" tab.
  const userQ = useQuery({
    queryKey: ["users-list-for-edit"], enabled: !!userId,
    queryFn: async () => (await api.get<UserDto[]>("/users")).data
  });
  const user = userQ.data?.find(u => u.id === userId) ?? null;

  // Local edit-form state for the details tab.
  const [details, setDetails] = useState({
    firstName: "", lastName: "", phone: "",
    role: "AgencyUser" as "AgencyAdmin" | "AgencyUser",
    isActive: true
  });
  useEffect(() => {
    if (user) setDetails({
      firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "",
      role: (user.role === "AgencyAdmin" ? "AgencyAdmin" : "AgencyUser") as "AgencyAdmin" | "AgencyUser",
      isActive: user.isActive
    });
  }, [user]);

  useEffect(() => {
    if (q.data) setSelected(new Set(q.data.custom ?? q.data.effective));
  }, [q.data]);

  useEffect(() => { setTab(0); setErr(null); }, [userId]);

  const save = useMutation({
    mutationFn: async (permissions: string[] | null) =>
      (await api.put<UserPermissionsDto>(`/permissions/user/${userId}`, { permissions })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["user-permissions"] }); onClose(); },
    onError: e => setErr(extractErrorMessage(e))
  });

  const saveDetails = useMutation({
    mutationFn: async () => (await api.put<UserDto>(`/users/${userId}`, details)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["users-list-for-edit"] });
    },
    onError: e => setErr(extractErrorMessage(e))
  });

  const deleteUser = useMutation({
    mutationFn: async () => api.delete(`/users/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["users-list-for-edit"] });
      onClose();
    },
    onError: e => setErr(extractErrorMessage(e))
  });

  const toggle = (code: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };
  const toggleGroup = (codes: string[]) => {
    const allOn = codes.every(c => selected.has(c));
    setSelected(prev => {
      const next = new Set(prev);
      if (allOn) codes.forEach(c => next.delete(c));
      else codes.forEach(c => next.add(c));
      return next;
    });
  };

  // Live preview = effective access, blended (custom override or role defaults).
  const previewSet = q.data?.custom ? new Set(selected) : new Set(q.data?.effective ?? []);

  return (
    <Dialog open={!!userId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={800}>{t("permissions.title")}</Typography>
            {q.data && (
              <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {q.data.name} · {q.data.email}
                </Typography>
                <Chip size="small" label={t(`roles.${q.data.role}`)} />
                {q.data.custom === null && (
                  <Chip size="small" label={t("permissions.usingDefaults")} color="info" />
                )}
                {user && !user.isActive && <Chip size="small" label="Ανενεργός" color="warning" />}
              </Stack>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            {tab === 0 && (
              <Button startIcon={<RestoreIcon />} size="small"
                onClick={() => save.mutate(null)} disabled={save.isPending}>
                {t("permissions.resetDefaults")}
              </Button>
            )}
            <Button startIcon={<DeleteIcon />} size="small" color="error"
              onClick={() => {
                if (confirm(`Διαγραφή του χρήστη ${user ? `${user.firstName} ${user.lastName}` : ""};\nΗ ενέργεια είναι μη αναστρέψιμη από αυτό το παράθυρο.`))
                  deleteUser.mutate();
              }}
              disabled={deleteUser.isPending}>
              {deleteUser.isPending ? <CircularProgress size={16} /> : "Διαγραφή χρήστη"}
            </Button>
          </Stack>
        </Stack>
      </DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Δικαιώματα" />
        <Tab label="Στοιχεία χρήστη" />
        <Tab label="Προεπισκόπηση πρόσβασης" />
      </Tabs>

      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

        {/* === Tab 0 — Permissions === */}
        {tab === 0 && (
          q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
            <Stack spacing={2.5}>
              {GROUPS.map(g => {
                const allOn = g.codes.every(c => selected.has(c));
                const someOn = !allOn && g.codes.some(c => selected.has(c));
                return (
                  <Box key={g.key}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between"
                      sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 1 }}>
                      <Typography variant="overline" fontWeight={700}>{t(`permissions.group.${g.key}`)}</Typography>
                      <FormControlLabel control={
                        <Checkbox size="small" checked={allOn} indeterminate={someOn}
                          onChange={() => toggleGroup(g.codes)} />
                      } label={t("permissions.toggleAll")} />
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 0.5 }}>
                      {g.codes.map(c => (
                        <FormControlLabel key={c} control={
                          <Checkbox size="small" checked={selected.has(c)} onChange={() => toggle(c)} />
                        } label={<Typography variant="body2" sx={{ fontFamily: "monospace" }}>{c}</Typography>} />
                      ))}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )
        )}

        {/* === Tab 1 — User details === */}
        {tab === 1 && (
          user ? (
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Όνομα" fullWidth value={details.firstName}
                  onChange={e => setDetails({ ...details, firstName: e.target.value })} />
                <TextField label="Επώνυμο" fullWidth value={details.lastName}
                  onChange={e => setDetails({ ...details, lastName: e.target.value })} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Email" fullWidth value={user.email} disabled
                  helperText="Το email δεν αλλάζει από αυτό το παράθυρο." />
                <TextField label="Τηλέφωνο" fullWidth value={details.phone}
                  onChange={e => setDetails({ ...details, phone: e.target.value })} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <TextField select label="Ρόλος" value={details.role} sx={{ minWidth: 220 }}
                  onChange={e => setDetails({ ...details, role: e.target.value as "AgencyAdmin" | "AgencyUser" })}>
                  <MenuItem value="AgencyUser">Υπάλληλος Γραφείου</MenuItem>
                  <MenuItem value="AgencyAdmin">Διαχειριστής Γραφείου</MenuItem>
                </TextField>
                <FormControlLabel control={
                  <Switch checked={details.isActive}
                    onChange={(_, v) => setDetails({ ...details, isActive: v })} />
                } label={details.isActive ? "Ενεργός" : "Ανενεργός"} />
              </Stack>
              <Box sx={{ pt: 1 }}>
                <Button variant="contained" onClick={() => saveDetails.mutate()}
                  disabled={saveDetails.isPending || !details.firstName.trim() || !details.lastName.trim()}>
                  {saveDetails.isPending ? <CircularProgress size={18} /> : "Αποθήκευση στοιχείων"}
                </Button>
                {saveDetails.isSuccess && (
                  <Typography component="span" color="success.main" sx={{ ml: 2, fontSize: 13 }}>✓ Αποθηκεύτηκε</Typography>
                )}
              </Box>
            </Stack>
          ) : <CircularProgress />
        )}

        {/* === Tab 2 — Preview === */}
        {tab === 2 && (
          q.data ? (
            <Stack spacing={2}>
              <Alert severity="info">
                Συνολικά <strong>{previewSet.size}</strong> ενεργά δικαιώματα — αυτά είναι τα κουμπιά/σελίδες
                που θα βλέπει ο χρήστης μόλις αποθηκεύσετε. Τα γκρι είναι αποκλεισμένα.
              </Alert>
              <Stack spacing={2}>
                {GROUPS.map(g => {
                  const enabled = g.codes.filter(c => previewSet.has(c));
                  const blocked = g.codes.filter(c => !previewSet.has(c));
                  return (
                    <Box key={g.key}>
                      <Typography variant="overline" fontWeight={700}>
                        {t(`permissions.group.${g.key}`)} · {enabled.length}/{g.codes.length}
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75} mt={0.5}>
                        {enabled.map(c =>
                          <Chip key={c} size="small" color="success" label={c}
                            sx={{ fontFamily: "monospace" }} />)}
                        {blocked.map(c =>
                          <Chip key={c} size="small" variant="outlined" label={c}
                            sx={{ fontFamily: "monospace", color: "text.disabled" }} />)}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Stack>
          ) : <CircularProgress />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        {tab === 0 && (
          <Button variant="contained"
            onClick={() => save.mutate(Array.from(selected))}
            disabled={save.isPending}>
            {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
