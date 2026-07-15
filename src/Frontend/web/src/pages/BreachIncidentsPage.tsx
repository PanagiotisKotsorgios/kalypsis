import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReportIcon from "@mui/icons-material/Report";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

// GDPR Άρθρο 33 — μητρώο περιστατικών παραβίασης δεδομένων. PlatformAdmin
// σελίδα. Το 72h clock μετριέται από το DiscoveredAt — αν περάσουν 72 ώρες
// χωρίς AuthorityNotifiedAt, το row μαρκάρεται κόκκινο («ΑΠΔΠΧ overdue»).
//
// Απλή UI — δεν θέλουμε rich management, θέλουμε το audit trail.

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
const SCOPES = ["AllTenants", "Specific"] as const;
const STATUSES = ["InProgress", "Contained", "Resolved"] as const;

interface Breach {
  id: string;
  incidentCode: string;
  discoveredAt: string;
  occurredAt: string | null;
  severity: string;
  containmentStatus: string;
  tenantsScope: string;
  affectedTenantIds: string[];
  nature: string;
  affectedDataCategories: string | null;
  estimatedAffectedSubjects: number | null;
  mitigations: string | null;
  tenantsNotifiedAt: string | null;
  authorityNotifiedAt: string | null;
  authorityReference: string | null;
  closedAt: string | null;
  closureNotes: string | null;
  hoursSinceDiscovery: number;
  past72h: boolean;
}

export function BreachIncidentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Breach | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["breach-incidents"],
    queryFn: async () => (await api.get<Breach[]>("/platform/breach-incidents")).data
  });

  const notify = useMutation({
    mutationFn: async (id: string) => (await api.post<Breach>(`/platform/breach-incidents/${id}/notify-tenants`)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["breach-incidents"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const close = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) =>
      (await api.post<Breach>(`/platform/breach-incidents/${id}/close`, { closureNotes: notes || null })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["breach-incidents"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ReportIcon sx={{ fontSize: 32 }} color="error" />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("breach.title", "Παραβιάσεις Δεδομένων")}</Typography>
          </Stack>
          <Typography color="text.secondary">
            {t("breach.subtitle", "GDPR Άρθρο 33 — μητρώο περιστατικών + ειδοποιήσεις προς γραφεία & ΑΠΔΠΧ.")}
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
          {t("breach.create", "Νέο περιστατικό")}
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("breach.code", "Κωδικός")}</TableCell>
                <TableCell>{t("breach.discovered", "Γνώση")}</TableCell>
                <TableCell>{t("breach.severity", "Σοβαρότητα")}</TableCell>
                <TableCell>{t("breach.scope", "Εμβέλεια")}</TableCell>
                <TableCell>{t("breach.nature", "Φύση")}</TableCell>
                <TableCell>{t("breach.tenantsNotified", "Ειδοποίηση γραφείων")}</TableCell>
                <TableCell>{t("breach.authorityNotified", "Ειδοποίηση ΑΠΔΠΧ")}</TableCell>
                <TableCell>{t("common.status", "Κατάσταση")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    {t("breach.empty", "Κανένα περιστατικό στο μητρώο.")}
                  </TableCell>
                </TableRow>
              )}
              {(q.data ?? []).map(b => (
                <TableRow key={b.id} hover
                  sx={{ bgcolor: b.past72h ? "rgba(211,47,47,0.06)" : undefined }}>
                  <TableCell>
                    <Typography fontWeight={700} fontFamily="monospace">{b.incidentCode}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(b.discoveredAt).toLocaleString("el-GR")}</Typography>
                    <Typography variant="caption" color={b.past72h ? "error" : "text.secondary"}>
                      {Math.round(b.hoursSinceDiscovery)}h πριν
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={b.severity}
                      color={b.severity === "Critical" ? "error"
                        : b.severity === "High" ? "warning"
                        : b.severity === "Medium" ? "info" : "default"} />
                  </TableCell>
                  <TableCell>
                    {b.tenantsScope === "AllTenants"
                      ? <Chip size="small" label="Όλα τα γραφεία" variant="outlined" />
                      : <Chip size="small" label={`${b.affectedTenantIds.length} γραφεία`} variant="outlined" />}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.nature}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {b.tenantsNotifiedAt
                      ? <Chip size="small" color="success" icon={<CheckCircleIcon />}
                          label={new Date(b.tenantsNotifiedAt).toLocaleDateString("el-GR")} />
                      : <Chip size="small" color="warning" label="Εκκρεμεί" />}
                  </TableCell>
                  <TableCell>
                    {b.authorityNotifiedAt
                      ? <Chip size="small" color="success" icon={<CheckCircleIcon />}
                          label={new Date(b.authorityNotifiedAt).toLocaleDateString("el-GR")} />
                      : b.past72h
                        ? <Chip size="small" color="error" label="Overdue >72h" />
                        : <Chip size="small" color="warning" label="Εκκρεμεί" />}
                  </TableCell>
                  <TableCell>
                    <Chip size="small"
                      color={b.closedAt ? "default" : b.containmentStatus === "InProgress" ? "warning" : "success"}
                      label={b.closedAt ? "Κλεισμένο" : b.containmentStatus} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" title="Ειδοποίηση γραφείων"
                      disabled={!!b.tenantsNotifiedAt || notify.isPending}
                      onClick={() => notify.mutate(b.id)}>
                      <SendIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Επεξεργασία" onClick={() => setEditing(b)}
                      disabled={!!b.closedAt}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {!b.closedAt && (
                      <IconButton size="small" color="success" title="Κλείσιμο"
                        onClick={() => {
                          const notes = prompt("Σημειώσεις κλεισίματος (προαιρετικά)");
                          close.mutate({ id: b.id, notes: notes ?? "" });
                        }}>
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <BreachFormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["breach-incidents"] }); setCreateOpen(false); }} />
      <BreachFormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["breach-incidents"] }); setEditing(null); }} />
    </Box>
  );
}

function BreachFormDialog({ open, onClose, item, onSaved }: {
  open: boolean; onClose: () => void; item: Breach | null; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({
    discoveredAt: new Date().toISOString().slice(0, 16),
    occurredAt: "",
    severity: "Medium" as string,
    containmentStatus: "InProgress" as string,
    tenantsScope: "AllTenants" as string,
    nature: "",
    affectedDataCategories: "",
    estimatedAffectedSubjects: "",
    mitigations: "",
    authorityNotifiedAt: "",
    authorityReference: "",
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        discoveredAt: item.discoveredAt.slice(0, 16),
        occurredAt: item.occurredAt?.slice(0, 16) ?? "",
        severity: item.severity,
        containmentStatus: item.containmentStatus,
        tenantsScope: item.tenantsScope,
        nature: item.nature,
        affectedDataCategories: item.affectedDataCategories ?? "",
        estimatedAffectedSubjects: item.estimatedAffectedSubjects?.toString() ?? "",
        mitigations: item.mitigations ?? "",
        authorityNotifiedAt: item.authorityNotifiedAt?.slice(0, 16) ?? "",
        authorityReference: item.authorityReference ?? "",
      });
    } else if (open) {
      setForm({
        discoveredAt: new Date().toISOString().slice(0, 16),
        occurredAt: "", severity: "Medium", containmentStatus: "InProgress",
        tenantsScope: "AllTenants", nature: "", affectedDataCategories: "",
        estimatedAffectedSubjects: "", mitigations: "", authorityNotifiedAt: "",
        authorityReference: "",
      });
    }
    setErr(null);
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        discoveredAt: new Date(form.discoveredAt).toISOString(),
        occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : null,
        severity: form.severity,
        containmentStatus: form.containmentStatus,
        tenantsScope: form.tenantsScope,
        affectedTenantIds: [] as string[],
        nature: form.nature.trim(),
        affectedDataCategories: form.affectedDataCategories.trim() || null,
        estimatedAffectedSubjects: form.estimatedAffectedSubjects ? Number(form.estimatedAffectedSubjects) : null,
        mitigations: form.mitigations.trim() || null,
        authorityNotifiedAt: form.authorityNotifiedAt ? new Date(form.authorityNotifiedAt).toISOString() : null,
        authorityReference: form.authorityReference.trim() || null,
      };
      if (editing) return (await api.put(`/platform/breach-incidents/${item!.id}`, body)).data;
      return (await api.post("/platform/breach-incidents", body)).data;
    },
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? "Επεξεργασία περιστατικού" : "Νέο περιστατικό παραβίασης"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="datetime-local" required label="Χρόνος γνώσης (72h clock)"
              InputLabelProps={{ shrink: true }} fullWidth
              value={form.discoveredAt} onChange={e => setForm({ ...form, discoveredAt: e.target.value })} />
            <TextField type="datetime-local" label="Χρόνος πραγματικής παραβίασης (αν διαφέρει)"
              InputLabelProps={{ shrink: true }} fullWidth
              value={form.occurredAt} onChange={e => setForm({ ...form, occurredAt: e.target.value })} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Σοβαρότητα" value={form.severity}
              onChange={e => setForm({ ...form, severity: e.target.value })} fullWidth>
              {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label="Εμβέλεια" value={form.tenantsScope}
              onChange={e => setForm({ ...form, tenantsScope: e.target.value })} fullWidth>
              {SCOPES.map(s => <MenuItem key={s} value={s}>{s === "AllTenants" ? "Όλα τα γραφεία" : "Συγκεκριμένα"}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label="Κατάσταση περιορισμού" value={form.containmentStatus}
              onChange={e => setForm({ ...form, containmentStatus: e.target.value })} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <TextField required label="Φύση παραβίασης (τι έγινε)"
            multiline minRows={3} value={form.nature}
            onChange={e => setForm({ ...form, nature: e.target.value })} fullWidth
            placeholder="π.χ. Μη εξουσιοδοτημένη πρόσβαση σε mysqldump από λανθασμένο IP allow-list" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κατηγορίες δεδομένων" fullWidth
              value={form.affectedDataCategories}
              onChange={e => setForm({ ...form, affectedDataCategories: e.target.value })}
              placeholder="email, ΑΦΜ, IBAN…" />
            <TextField type="number" label="Κατά προσέγγιση υποκείμενα" fullWidth
              value={form.estimatedAffectedSubjects}
              onChange={e => setForm({ ...form, estimatedAffectedSubjects: e.target.value })}
              inputProps={{ min: 0 }} />
          </Stack>
          <TextField label="Μέτρα περιορισμού / αντιμετώπισης"
            multiline minRows={2} value={form.mitigations}
            onChange={e => setForm({ ...form, mitigations: e.target.value })} fullWidth />
          {editing && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField type="datetime-local" label="Ειδοποίηση ΑΠΔΠΧ (72h)"
                InputLabelProps={{ shrink: true }} fullWidth
                value={form.authorityNotifiedAt}
                onChange={e => setForm({ ...form, authorityNotifiedAt: e.target.value })} />
              <TextField label="Αρ. αναφοράς ΑΠΔΠΧ" fullWidth
                value={form.authorityReference}
                onChange={e => setForm({ ...form, authorityReference: e.target.value })} />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", "Ακύρωση")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.nature.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save", "Αποθήκευση")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
