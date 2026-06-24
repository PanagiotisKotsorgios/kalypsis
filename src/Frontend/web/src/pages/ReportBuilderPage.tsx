import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type ReportEntity = "Customers" | "Policies" | "Claims" | "Commissions" | "Requests" | "Documents" | "Communications";

const ENTITY_LABELS: Record<ReportEntity, string> = {
  Customers: "Πελάτες",
  Policies: "Συμβόλαια",
  Claims: "Ζημιές",
  Commissions: "Προμήθειες",
  Requests: "Αιτήματα",
  Documents: "Έγγραφα",
  Communications: "Επικοινωνίες"
};

// Suggested fields per entity (the runner reflects, so any property name works)
const SUGGESTED_FIELDS: Record<ReportEntity, { path: string; label: string }[]> = {
  Customers: [
    { path: "FirstName", label: "Όνομα" }, { path: "LastName", label: "Επώνυμο" },
    { path: "CompanyName", label: "Εταιρεία" }, { path: "Email", label: "Email" },
    { path: "Mobile", label: "Κινητό" }, { path: "City", label: "Πόλη" },
    { path: "CreatedAt", label: "Δημιουργήθηκε" }
  ],
  Policies: [
    { path: "PolicyNumber", label: "Αριθμός" }, { path: "PolicyType", label: "Τύπος" },
    { path: "Premium", label: "Ασφάλιστρο" }, { path: "Currency", label: "Νόμισμα" },
    { path: "StartDate", label: "Έναρξη" }, { path: "EndDate", label: "Λήξη" },
    { path: "Status", label: "Κατάσταση" }
  ],
  Claims: [
    { path: "ClaimNumber", label: "Αριθμός" }, { path: "ReportedAt", label: "Αναγγέλθηκε" },
    { path: "Status", label: "Κατάσταση" }, { path: "EstimatedAmount", label: "Εκτιμώμενο ποσό" }
  ],
  Commissions: [
    { path: "Amount", label: "Ποσό" }, { path: "Currency", label: "Νόμισμα" },
    { path: "Status", label: "Κατάσταση" }, { path: "SettledDate", label: "Διακανονίστηκε" }
  ],
  Requests: [
    { path: "Subject", label: "Θέμα" }, { path: "Status", label: "Κατάσταση" },
    { path: "Priority", label: "Προτεραιότητα" }, { path: "CreatedAt", label: "Δημιουργήθηκε" }
  ],
  Documents: [
    { path: "FileName", label: "Όνομα αρχείου" }, { path: "Category", label: "Κατηγορία" },
    { path: "SizeBytes", label: "Μέγεθος" }, { path: "UploadedAt", label: "Ανεβλήθη" }
  ],
  Communications: [
    { path: "Channel", label: "Κανάλι" }, { path: "Subject", label: "Θέμα" },
    { path: "SentAt", label: "Στάλθηκε" }, { path: "Status", label: "Κατάσταση" }
  ]
};

interface ReportDef {
  id: string;
  name: string;
  entity: ReportEntity;
  fieldsJson: string | null;
  filtersJson: string | null;
  groupByJson: string | null;
  aggregationsJson: string | null;
  sortJson: string | null;
  visibility: string;
  isScheduled: boolean;
}

interface RunResult {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  total: number;
}

export function ReportBuilderPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [openBuilder, setOpenBuilder] = useState(false);
  const [previewRun, setPreviewRun] = useState<{ name: string; data: RunResult } | null>(null);

  const list = useQuery({
    queryKey: ["report-defs"],
    queryFn: async () => (await api.get<ReportDef[]>("/custom-reports")).data
  });

  const run = useMutation({
    mutationFn: async (r: ReportDef) => {
      const data = (await api.post<RunResult>(`/custom-reports/${r.id}/run`)).data;
      return { name: r.name, data };
    },
    onSuccess: (out) => setPreviewRun(out),
    onError: (e) => setError(extractErrorMessage(e))
  });

  function exportCsv(r: ReportDef) {
    window.location.href = `/api/custom-reports/${r.id}/export.csv`;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AssessmentIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Δημιουργός αναφορών</Typography>
            <Typography color="text.secondary">
              Φτιάξτε τις δικές σας αναφορές: επιλέξτε οντότητα, πεδία, και τρέξτε ή εξάγετε σε CSV.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setOpenBuilder(true)}>
          Νέα αναφορά
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {list.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Όνομα</TableCell>
                <TableCell>Οντότητα</TableCell>
                <TableCell>Ορατότητα</TableCell>
                <TableCell>Πεδία</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(list.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν αναφορές. Φτιάξτε την πρώτη σας.
                </TableCell></TableRow>
              )}
              {(list.data ?? []).map((r) => {
                let fieldCount = 0;
                try { fieldCount = JSON.parse(r.fieldsJson ?? "[]").length ?? 0; } catch { /* ignore */ }
                return (
                  <TableRow key={r.id} hover>
                    <TableCell><Typography fontWeight={600}>{r.name}</Typography></TableCell>
                    <TableCell><Chip size="small" label={ENTITY_LABELS[r.entity]} /></TableCell>
                    <TableCell>{r.visibility}</TableCell>
                    <TableCell>{fieldCount} πεδία</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<PlayArrowIcon />} onClick={() => run.mutate(r)}>
                        Εκτέλεση
                      </Button>
                      <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportCsv(r)}>
                        CSV
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {previewRun && (
        <Card variant="outlined" sx={{ mt: 3, overflowX: "auto" }}>
          <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Προεπισκόπηση — {previewRun.name} ({previewRun.data.total} γραμμές)
            </Typography>
            <Button size="small" onClick={() => setPreviewRun(null)}>Κλείσιμο</Button>
          </Box>
          <Divider />
          <Table size="small">
            <TableHead>
              <TableRow>
                {previewRun.data.columns.map((c, i) => (
                  <TableCell key={i} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{c}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {previewRun.data.rows.slice(0, 50).map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} sx={{ whiteSpace: "nowrap", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cell == null ? "—" : String(cell)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {previewRun.data.rows.length > 50 && (
            <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: "block" }}>
              Εμφάνιση πρώτων 50 από {previewRun.data.rows.length}. Κατεβάστε CSV για όλες.
            </Typography>
          )}
        </Card>
      )}

      <ReportDialog open={openBuilder} onClose={() => setOpenBuilder(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["report-defs"] }); setOpenBuilder(false); }} />
    </Box>
  );
}

function ReportDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [entity, setEntity] = useState<ReportEntity>("Customers");
  const [pickedFields, setPickedFields] = useState<{ path: string; label: string }[]>([]);
  const [visibility, setVisibility] = useState("Private");
  const [err, setErr] = useState<string | null>(null);

  const available = useMemo(() => SUGGESTED_FIELDS[entity], [entity]);

  function togglePick(f: { path: string; label: string }) {
    const exists = pickedFields.some((p) => p.path === f.path);
    if (exists) setPickedFields(pickedFields.filter((p) => p.path !== f.path));
    else setPickedFields([...pickedFields, f]);
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        entity,
        fieldsJson: JSON.stringify(pickedFields),
        filtersJson: null,
        groupByJson: null,
        aggregationsJson: null,
        sortJson: null,
        visibility,
        isScheduled: false,
        scheduleCron: null,
        deliveryEmails: null
      };
      return (await api.post("/custom-reports", body)).data;
    },
    onSuccess: () => {
      setName(""); setPickedFields([]); setEntity("Customers"); setVisibility("Private");
      onSaved();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Νέα αναφορά</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField label="Όνομα αναφοράς" required fullWidth value={name}
            onChange={(e) => setName(e.target.value)} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select fullWidth label="Οντότητα" value={entity}
              onChange={(e) => { setEntity(e.target.value as ReportEntity); setPickedFields([]); }}>
              {(Object.keys(ENTITY_LABELS) as ReportEntity[]).map((k) =>
                <MenuItem key={k} value={k}>{ENTITY_LABELS[k]}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label="Ορατότητα" value={visibility}
              onChange={(e) => setVisibility(e.target.value)}>
              <MenuItem value="Private">Ιδιωτική</MenuItem>
              <MenuItem value="Agency">Ολόκληρο το γραφείο</MenuItem>
            </TextField>
          </Stack>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Πεδία</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {available.map((f) => {
                const active = pickedFields.some((p) => p.path === f.path);
                return (
                  <Chip
                    key={f.path}
                    label={f.label}
                    onClick={() => togglePick(f)}
                    color={active ? "primary" : "default"}
                    variant={active ? "filled" : "outlined"}
                    sx={{ cursor: "pointer" }}
                  />
                );
              })}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Πατήστε σε ένα πεδίο για να το προσθέσετε ή να το αφαιρέσετε από την αναφορά.
            </Typography>
          </Box>

          {pickedFields.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Σειρά στηλών ({pickedFields.length})
              </Typography>
              <Stack spacing={0.5}>
                {pickedFields.map((p, i) => (
                  <Stack key={p.path} direction="row" alignItems="center" spacing={1}
                    sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 24 }}>{i + 1}.</Typography>
                    <Typography sx={{ flex: 1 }}>{p.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{p.path}</Typography>
                    <IconButton size="small" onClick={() => togglePick(p)}>×</IconButton>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !name.trim() || pickedFields.length === 0}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
