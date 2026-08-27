import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MailLockIcon from "@mui/icons-material/MailLock";
import ScienceIcon from "@mui/icons-material/Science";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface Announcement {
  id: string; title: string; body: string; severity: string;
  version: string | null; linkUrl: string | null; linkLabel: string | null;
  isEnabled: boolean; dismissedByCount: number;
  createdAt: string; updatedAt: string | null;
}

const emptyForm = {
  title: "", body: "", severity: "info",
  version: "", linkUrl: "", linkLabel: "",
  isEnabled: true,
};

/**
 * Platform-admin CRUD for the announcements banner. Post-redeploy the
 * admin creates a row here (release notes / planned maintenance / etc.);
 * every logged-in user then sees a matching Alert bar at the top of
 * their app shell until they × it. History table shows every row (both
 * enabled and disabled) with a reach counter (how many users have
 * dismissed each announcement so far) so the admin can tell what
 * landed vs what's still fresh.
 */
export function PlatformAnnouncementsPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const q = useQuery({
    queryKey: ["platform-announcements"],
    queryFn: async () => (await api.get<Announcement[]>("/platform/announcements")).data,
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const body = { ...form, version: form.version || null,
        linkUrl: form.linkUrl || null, linkLabel: form.linkLabel || null };
      if (editing) return (await api.put(`/platform/announcements/${editing.id}`, body)).data;
      return (await api.post("/platform/announcements", body)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform-announcements"] });
      // Also invalidate the user-side banner query so a re-publish shows
      // up on the admin's own shell within seconds.
      void qc.invalidateQueries({ queryKey: ["announcements", "active"] });
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const toggle = useMutation({
    mutationFn: async (id: string) => api.post(`/platform/announcements/${id}/toggle`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform-announcements"] });
      void qc.invalidateQueries({ queryKey: ["announcements", "active"] });
    },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/announcements/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform-announcements"] });
      void qc.invalidateQueries({ queryKey: ["announcements", "active"] });
    },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title, body: a.body, severity: a.severity,
      version: a.version ?? "", linkUrl: a.linkUrl ?? "", linkLabel: a.linkLabel ?? "",
      isEnabled: a.isEnabled,
    });
    setOpen(true);
  };

  const severityColor: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
    info: "info", success: "success", warning: "warning", error: "error"
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <CampaignIcon color="primary" sx={{ fontSize: 34 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={800}>Ανακοινώσεις πλατφόρμας</Typography>
          <Typography variant="body2" color="text.secondary">
            Πινακίδα που εμφανίζεται σε κάθε χρήστη μετά το login. Ο κάθε χρήστης μπορεί να
            πατήσει × για να μην την ξαναδεί. Απενεργοποιήστε αντί να διαγράφετε για
            να διατηρήσετε το ιστορικό.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Νέα ανακοίνωση
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <AdminToolsPane onError={setErr} />

      <Card variant="outlined">
        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Τίτλος</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Έκδοση</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Τύπος</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Δημιουργήθηκε</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Χρήστες που την έκλεισαν</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Ενεργή</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Ενέργειες</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).map(a => (
                <TableRow key={a.id} hover
                  sx={{ opacity: a.isEnabled ? 1 : 0.6 }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{a.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      overflow: "hidden", maxWidth: 480,
                    }}>{a.body}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{a.version ?? "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.severity}
                      color={severityColor[a.severity] ?? "default"} variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {new Date(a.createdAt).toLocaleString("el-GR")}
                  </TableCell>
                  <TableCell align="center">{a.dismissedByCount}</TableCell>
                  <TableCell align="center">
                    <Switch size="small" checked={a.isEnabled}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate(a.id)} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(a)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error"
                      disabled={del.isPending}
                      onClick={() => {
                        if (window.confirm(`Διαγραφή της ανακοίνωσης «${a.title}»;`))
                          del.mutate(a.id);
                      }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(q.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                    Καμία ανακοίνωση ακόμη. Πατήστε «Νέα ανακοίνωση» για να δημοσιεύσετε την πρώτη.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Επεξεργασία ανακοίνωσης" : "Νέα ανακοίνωση"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Τίτλος" fullWidth required autoFocus
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              helperText="Σύντομος τίτλος (~60 χαρακτ.) — εμφανίζεται bold στην πινακίδα." />
            <TextField label="Κείμενο" fullWidth required multiline minRows={4} maxRows={10}
              value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
              helperText="Απλό κείμενο. Οι αλλαγές γραμμής διατηρούνται." />
            <Stack direction="row" spacing={2}>
              <TextField select label="Τύπος" sx={{ minWidth: 160 }}
                value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                <MenuItem value="info">Πληροφορία (μπλε)</MenuItem>
                <MenuItem value="success">Επιτυχία (πράσινο)</MenuItem>
                <MenuItem value="warning">Προειδοποίηση (πορτοκαλί)</MenuItem>
                <MenuItem value="error">Σφάλμα (κόκκινο)</MenuItem>
              </TextField>
              <TextField label="Έκδοση (προαιρ.)" sx={{ flex: 1 }}
                placeholder="π.χ. 2.11.0"
                value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Σύνδεσμος URL (προαιρ.)" sx={{ flex: 2 }}
                placeholder="https://…"
                value={form.linkUrl} onChange={e => setForm({ ...form, linkUrl: e.target.value })} />
              <TextField label="Ετικέτα συνδέσμου" sx={{ flex: 1 }}
                placeholder="Μάθε περισσότερα"
                value={form.linkLabel} onChange={e => setForm({ ...form, linkLabel: e.target.value })} />
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isEnabled}
                onChange={e => setForm({ ...form, isEnabled: e.target.checked })} />
              <Typography variant="body2">
                {form.isEnabled ? "Ενεργή — εμφανίζεται σε όλους" : "Απενεργοποιημένη — δεν εμφανίζεται πουθενά"}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Ακύρωση</Button>
          <Button variant="contained" onClick={() => upsert.mutate()}
            disabled={upsert.isPending || !form.title.trim() || !form.body.trim()}>
            {upsert.isPending ? <CircularProgress size={18} /> : (editing ? "Αποθήκευση" : "Δημοσίευση")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * Two utilities that live alongside the announcements list because
 * they're the same "I'm about to do something broad, hold the world
 * still" cohort of controls:
 *   1. Toggle the global outbound-email kill switch — the API server
 *      short-circuits every send call while this is on.
 *   2. Trigger the tenant test-data seed — pastes a tenant id, hits
 *      the endpoint, shows the count summary. The endpoint itself
 *      refuses to run if the kill switch is off, so there's no way to
 *      accidentally spam real recipients even if the operator forgets
 *      to flip it first.
 */
function AdminToolsPane({ onError }: { onError: (msg: string) => void }) {
  const qc = useQueryClient();
  const [tenantId, setTenantId] = useState("");
  const [result, setResult] = useState<any | null>(null);

  const emailStatus = useQuery({
    queryKey: ["platform-outbound-emails"],
    queryFn: async () => (await api.get<{ disabled: boolean; lastChangedAt: string | null }>(
      "/platform/admin-tools/outbound-emails")).data,
  });

  const setEmails = useMutation({
    mutationFn: async (disabled: boolean) =>
      (await api.post("/platform/admin-tools/outbound-emails", { disabled })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-outbound-emails"] }),
    onError: (e) => onError(extractErrorMessage(e)),
  });

  const seed = useMutation({
    mutationFn: async () =>
      (await api.post(`/platform/admin-tools/tenants/${tenantId.trim()}/seed-test-data`, {})).data,
    onSuccess: (data) => setResult(data),
    onError: (e) => onError(extractErrorMessage(e)),
  });

  return (
    <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        {/* Outbound-email kill switch */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
          <MailLockIcon color={emailStatus.data?.disabled ? "error" : "action"} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={700}>
              Εξερχόμενα emails
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {emailStatus.data?.disabled
                ? "ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΑ — καμία αποστολή. Απαιτείται πριν κάθε test-data seed."
                : "Ενεργά — κάθε ειδοποίηση αποστέλλεται κανονικά."}
            </Typography>
          </Box>
          <Switch checked={!!emailStatus.data?.disabled}
            disabled={setEmails.isPending}
            onChange={e => setEmails.mutate(e.target.checked)} />
        </Stack>

        <Box sx={{ borderLeft: { md: 1 }, borderColor: "divider", height: { md: 44 } }} />

        {/* Tenant test-data seed */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 2 }}>
          <ScienceIcon color="action" />
          <TextField size="small" label="Tenant ID" placeholder="π.χ. 8f3c…"
            value={tenantId} onChange={e => setTenantId(e.target.value)}
            sx={{ flex: 1 }}
            helperText="Fills customers / producers / policies / receipts / endorsements / cancellations / credit notes / claims / movements / appointments." />
          <Button variant="contained" color="warning"
            disabled={!tenantId.trim() || seed.isPending || !emailStatus.data?.disabled}
            onClick={() => { setResult(null); seed.mutate(); }}>
            {seed.isPending ? <CircularProgress size={18} /> : "Seed test data"}
          </Button>
        </Stack>
      </Stack>
      {result && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setResult(null)}>
          <b>Seed complete.</b>{" "}
          Customers: {result.customersCreated}, Producers: {result.producersCreated},
          Policies: {result.policiesCreated}, Receipts: {result.receiptsCreated},
          Endorsements: {result.endorsementsCreated}, Cancellations: {result.cancellationsCreated},
          Credit notes: {result.creditNotesCreated}, Claims: {result.claimsCreated},
          Movements: {result.movementsCreated}, Appointments: {result.appointmentsCreated}.
          {result.notes && <Box component="div" sx={{ mt: 0.5, fontStyle: "italic", fontSize: 12 }}>{result.notes}</Box>}
        </Alert>
      )}
    </Card>
  );
}
