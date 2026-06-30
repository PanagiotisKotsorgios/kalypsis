import { useRef, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface CarrierRow {
  id: string;
  name: string;
  code: string;
  country: string | null;
  website: string | null;
  isActive: boolean;
  isBroker: boolean;
  parentCompanyId: string | null;
  notes: string | null;
  parameterItemCount: number;
}

interface FormBody {
  id?: string;
  name: string;
  code: string;
  country: string;
  website: string;
  isActive: boolean;
  isBroker: boolean;
  parentCompanyId: string;
  notes: string;
  excludedBranchCodes: string; // comma-separated for the form
}

const EMPTY_FORM: FormBody = {
  name: "", code: "", country: "GR", website: "",
  isActive: true, isBroker: false, parentCompanyId: "", notes: "",
  excludedBranchCodes: ""
};

export function PlatformCarriersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<CarrierRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const carriers = useQuery({
    queryKey: ["platform-carriers"],
    queryFn: async () => (await api.get<CarrierRow[]>("/platform/insurance-companies")).data,
  });

  const save = useMutation({
    mutationFn: async (body: FormBody) => {
      const payload = {
        name: body.name.trim(),
        code: body.code.trim().toUpperCase(),
        country: body.country.trim() || null,
        website: body.website.trim() || null,
        isActive: body.isActive,
        isBroker: body.isBroker,
        parentCompanyId: body.parentCompanyId || null,
        notes: body.notes.trim() || null,
        excludedBranchCodes: body.excludedBranchCodes
          ? body.excludedBranchCodes.split(",").map(s => s.trim()).filter(Boolean)
          : null,
      };
      if (body.id) {
        return (await api.put(`/platform/insurance-companies/${body.id}`, payload)).data;
      }
      return (await api.post("/platform/insurance-companies", payload)).data;
    },
    onSuccess: () => {
      setSuccess(editing?.id ? "Ενημερώθηκε." : "Δημιουργήθηκε.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["platform-carriers"] });
    },
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/insurance-companies/${id}`),
    onSuccess: () => {
      setSuccess("Διαγράφηκε.");
      void qc.invalidateQueries({ queryKey: ["platform-carriers"] });
    },
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const runCleanup = useMutation({
    mutationFn: async () =>
      (await api.post("/platform/company-parameters/run-cleanup")).data,
    onSuccess: () => {
      setSuccess("Ο καθαρισμός ολοκληρώθηκε. Οι duplicates αφαιρέθηκαν.");
      void qc.invalidateQueries({ queryKey: ["platform-carriers"] });
    },
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const importParams = useMutation({
    mutationFn: async ({ carrierId, file }: { carrierId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return (await api.post<{ inserted: number; skipped: number; warnings: string[] }>(
        `/platform/company-parameters/import/${carrierId}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )).data;
    },
    onSuccess: (res) => {
      setSuccess(`Εισαγωγή ολοκληρώθηκε: ${res.inserted} νέες εγγραφές, ${res.skipped} παραλείφθηκαν.`);
      setImportTarget(null);
      void qc.invalidateQueries({ queryKey: ["platform-carriers"] });
    },
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const rows = carriers.data ?? [];
  const brokers = rows.filter(r => r.isBroker);
  // Group: brokers first with their subs, then standalone, then other globals.
  const grouped: CarrierRow[] = [];
  for (const broker of brokers.filter(b => !b.parentCompanyId)) {
    grouped.push(broker);
    const subs = rows.filter(r => r.parentCompanyId === broker.id);
    for (const s of subs) grouped.push(s);
  }
  for (const r of rows) {
    if (!grouped.includes(r)) grouped.push(r);
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BusinessCenterIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Ασφαλιστικές Εταιρίες (Καθολικές)</Typography>
              <HelpHint title="Πώς δουλεύει"
                body="Κάθε εταιρία που δημιουργείτε εδώ γίνεται διαθέσιμη σε όλους τους χρήστες της πλατφόρμας. Για κάθε εταιρία πρέπει να εισάγετε τα παραμετρικά (κλάδοι, χρήσεις, καλύψεις, πακέτα) ώστε να εμφανίζονται σωστά τα dropdown σε όλες τις σελίδες." />
            </Stack>
            <Typography color="text.secondary">
              Καθολικές εταιρίες που εμφανίζονται σε όλα τα γραφεία. Δημιουργήστε μία, ανεβάστε τα παραμετρικά της και είναι έτοιμη.
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" size="large"
            onClick={() => { setError(null); runCleanup.mutate(); }}
            disabled={runCleanup.isPending}>
            {runCleanup.isPending ? <CircularProgress size={18} /> : "Καθαρισμός duplicates"}
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" size="large"
            onClick={() => { setError(null); setEditing({ ...EMPTY_FORM }); }}>
            Νέα ασφαλιστική
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }}>
        Οι αλλαγές εδώ ισχύουν για όλα τα γραφεία αμέσως. Το «Καθαρισμός duplicates» τρέχει ξανά την πολιτική «μόνο Grand Cover» και αφαιρεί τυχόν διπλές καταχωρήσεις.
      </Alert>

      {carriers.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Όνομα</TableCell>
              <TableCell>Κωδικός</TableCell>
              <TableCell>Χώρα</TableCell>
              <TableCell align="center">Πρακτορείο</TableCell>
              <TableCell align="right">Παραμετρικά</TableCell>
              <TableCell align="center">Ενεργή</TableCell>
              <TableCell align="right" width={170}>Ενέργειες</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {grouped.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Δεν υπάρχουν καθολικές ασφαλιστικές. Δημιουργήστε την πρώτη με το «Νέα ασφαλιστική».
                </TableCell></TableRow>
              )}
              {grouped.map(r => {
                const isSub = !!r.parentCompanyId;
                const parent = isSub ? rows.find(x => x.id === r.parentCompanyId) : null;
                return (
                  <TableRow key={r.id} hover sx={isSub ? { bgcolor: "rgba(11,37,69,0.02)" } : undefined}>
                    <TableCell sx={isSub ? { pl: 4, fontSize: 13, color: "text.secondary" } : { fontWeight: 600 }}>
                      {isSub && "↳ "}{r.name}
                      {isSub && parent && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                          (υπό {parent.name})
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{r.code}</TableCell>
                    <TableCell>{r.country ?? "—"}</TableCell>
                    <TableCell align="center">
                      {r.isBroker ? <Chip size="small" color="primary" label="Πρακτορείο" /> : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={r.parameterItemCount} variant="outlined"
                        color={r.parameterItemCount === 0 ? "warning" : "default"} />
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={r.isActive ? "Ενεργή" : "Ανενεργή"}
                        color={r.isActive ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" title="Εισαγωγή παραμετρικών"
                        onClick={() => setImportTarget(r)}>
                        <UploadFileIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" title="Επεξεργασία"
                        onClick={() => {
                          let exc = "";
                          try {
                            const arr = (r as any).excludedBranchCodesJson
                              ? JSON.parse((r as any).excludedBranchCodesJson) : null;
                            if (Array.isArray(arr)) exc = arr.join(", ");
                          } catch { /* ignore malformed json */ }
                          setEditing({
                            id: r.id, name: r.name, code: r.code,
                            country: r.country ?? "", website: r.website ?? "",
                            isActive: r.isActive, isBroker: r.isBroker,
                            parentCompanyId: r.parentCompanyId ?? "",
                            notes: r.notes ?? "",
                            excludedBranchCodes: exc
                          });
                        }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" title="Διαγραφή"
                        onClick={() => {
                          if (confirm(`Διαγραφή της «${r.name}»; Η ενέργεια αφαιρεί την εταιρία από όλα τα γραφεία.`))
                            del.mutate(r.id);
                        }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editing?.id ? "Επεξεργασία ασφαλιστικής" : "Νέα ασφαλιστική"}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={2.5} mt={1}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Όνομα" value={editing.name} required fullWidth
                  onChange={e => setEditing({ ...editing, name: e.target.value })} />
                <TextField label="Κωδικός" value={editing.code} required sx={{ minWidth: 160 }}
                  onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  helperText="π.χ. ALLIANZ, ERGO" />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Χώρα" value={editing.country} sx={{ minWidth: 100 }}
                  onChange={e => setEditing({ ...editing, country: e.target.value })} />
                <TextField label="Website" value={editing.website} fullWidth
                  onChange={e => setEditing({ ...editing, website: e.target.value })} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                <FormControlLabel
                  control={<Checkbox checked={editing.isActive}
                    onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />}
                  label="Ενεργή" />
                <FormControlLabel
                  control={<Checkbox checked={editing.isBroker}
                    onChange={e => setEditing({ ...editing, isBroker: e.target.checked, parentCompanyId: "" })} />}
                  label="Πρακτορείο (broker)" />
              </Stack>
              <TextField select label="Γονικό πρακτορείο (αν υποασφαλιστική)"
                value={editing.parentCompanyId}
                disabled={editing.isBroker}
                onChange={e => setEditing({ ...editing, parentCompanyId: e.target.value })}>
                <MenuItem value="">— Καμία —</MenuItem>
                {(carriers.data ?? []).filter(c => c.isBroker && c.id !== editing.id).map(b =>
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
              </TextField>
              <TextField label="Εξαιρούμενοι κλάδοι"
                value={editing.excludedBranchCodes}
                onChange={e => setEditing({ ...editing, excludedBranchCodes: e.target.value })}
                disabled={editing.isBroker || !editing.parentCompanyId}
                placeholder="π.χ. IW15, IW07, IW04"
                helperText="Κωδικοί κλάδων του πρακτορείου που αυτή η υποασφαλιστική ΔΕΝ πουλάει — διαχωρισμός με κόμμα. Άδειο = πουλάει όλους τους κλάδους."
                fullWidth />
              <TextField label="Σημειώσεις" value={editing.notes} multiline rows={2} fullWidth
                onChange={e => setEditing({ ...editing, notes: e.target.value })} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Άκυρο</Button>
          <Button variant="contained" onClick={() => editing && save.mutate(editing)}
            disabled={save.isPending || !editing?.name.trim() || !editing?.code.trim()}>
            {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import parametrics dialog */}
      <Dialog open={!!importTarget} onClose={() => setImportTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Εισαγωγή παραμετρικών — {importTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={1}>
            <Alert severity="info">
              Δεκτό format: <strong>xlsx</strong> με sheets «Κλάδοι / Χρήσεις / Καλύψεις / Πακέτα» (IW shape),
              ή <strong>CSV</strong> με στήλες <code>Kind,Code,Name,PolicyType,ParentCode,BridgeSystem,BridgeCode</code>.
              Η εισαγωγή είναι idempotent — διπλά (Kind+Code+ParentCode) παραλείπονται.
            </Alert>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Τρέχοντα παραμετρικά: {importTarget?.parameterItemCount} εγγραφές
              </Typography>
              <input
                ref={fileInputRef} type="file" accept=".xlsx,.csv" hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && importTarget) {
                    importParams.mutate({ carrierId: importTarget.id, file });
                    e.target.value = "";
                  }
                }}
              />
              <Button variant="contained" startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={importParams.isPending}>
                {importParams.isPending ? <CircularProgress size={18} /> : "Επιλογή αρχείου"}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportTarget(null)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
