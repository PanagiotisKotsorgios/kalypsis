import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import DeleteIcon from "@mui/icons-material/Delete";
import InventoryIcon from "@mui/icons-material/Inventory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { ErrorPopup, useDescriptiveError } from "../components/ErrorPopup";
import { date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

const KIND_OPTIONS = [
  "Tariff",       // Τιμολόγια
  "Coverage",     // Καλύψεις
  "Commission",   // Προμήθειες
  "Package",      // Πακέτα
  "Other"
];

interface BroadcastFileDto {
  id: string;
  insuranceCompanyCode: string;
  insuranceCompanyName: string;
  kind: string;
  version: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  fileContentType: string | null;
  isActive: boolean;
  changelogNotes: string | null;
  createdAt: string;
}

export function PlatformParametricFilesPage() {
  const qc = useQueryClient();
  const { error, clear, handleError } = useDescriptiveError();
  const [uploadOpen, setUploadOpen] = useState(false);

  const q = useQuery({
    queryKey: ["platform-parametric-files"],
    queryFn: async () => (await api.get<BroadcastFileDto[]>("/platform/parametric-files")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/parametric-files/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-parametric-files"] }),
    onError: handleError
  });

  // Group by carrier
  const byCarrier = (q.data ?? []).reduce<Record<string, BroadcastFileDto[]>>((acc, f) => {
    (acc[f.insuranceCompanyName] ??= []).push(f);
    return acc;
  }, {});

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <InventoryIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Παραμετρικά Αρχεία Ασφαλιστικών (Broadcast)</Typography>
              <HelpHint title="Broadcast parametric files"
                body="Ανεβάστε εδώ τα τελευταία παραμετρικά αρχεία που σας στέλνουν οι ασφαλιστικές εταιρείες. Κάθε γραφείο της πλατφόρμας μπορεί στη συνέχεια να εγκαταστήσει την έκδοση που το αφορά." />
            </Stack>
            <Typography color="text.secondary">
              Ανεβάστε τις τελευταίες παραμέτρους που έλαβα από τις ασφαλιστικές. Διαθέσιμες σε όλα τα γραφεία της πλατφόρμας.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setUploadOpen(true)}>
          Νέο παραμετρικό αρχείο
        </Button>
      </Stack>

      <ErrorPopup error={error} onClose={clear} />

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : Object.keys(byCarrier).length === 0 ? (
        <Alert severity="info">Δεν έχουν ανέβει παραμετρικά αρχεία. Πατήστε «Νέο παραμετρικό αρχείο» επάνω δεξιά.</Alert>
      ) : (
        <Stack spacing={3}>
          {Object.entries(byCarrier).map(([name, files]) => (
            <Card key={name} variant="outlined">
              <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between" }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{name}</Typography>
                <Chip size="small" label={files[0].insuranceCompanyCode} sx={{ fontFamily: "monospace" }} />
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Τύπος</TableCell>
                    <TableCell>Έκδοση</TableCell>
                    <TableCell>Ισχύς</TableCell>
                    <TableCell>Αρχείο</TableCell>
                    <TableCell>Σχόλια</TableCell>
                    <TableCell>Κατάσταση</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map(f => (
                    <TableRow key={f.id} hover>
                      <TableCell>{f.kind}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{f.version}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {f.effectiveFrom ? date(f.effectiveFrom) : "—"}
                        {f.effectiveTo ? ` → ${date(f.effectiveTo)}` : ""}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {f.originalFileName ?? "—"}
                        {f.fileSizeBytes && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {(f.fileSizeBytes / 1024).toFixed(0)} KB
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12.5 }}>{f.changelogNotes ?? "—"}</TableCell>
                      <TableCell>
                        <Chip size="small" color={f.isActive ? "success" : "default"}
                          label={f.isActive ? "Ενεργό" : "Αντικαταστάθηκε"} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" component="a"
                          href={`/api/platform/parametric-files/${f.id}/download`} target="_blank"
                          title="Λήψη">
                          <CloudDownloadIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error"
                          onClick={() => { if (confirm("Διαγραφή αρχείου;")) del.mutate(f.id); }}
                          title="Διαγραφή">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </Stack>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["platform-parametric-files"] }); setUploadOpen(false); }} />
    </Box>
  );
}

function UploadDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { error, clear, handleError } = useDescriptiveError();
  const [form, setForm] = useState({
    insuranceCompanyCode: "", insuranceCompanyName: "",
    kind: "Tariff", version: "", effectiveFrom: "", effectiveTo: "", changelogNotes: ""
  });
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Επιλέξτε αρχείο.");
      const data = new FormData();
      data.append("file", file);
      data.append("InsuranceCompanyCode", form.insuranceCompanyCode.trim().toUpperCase());
      data.append("InsuranceCompanyName", form.insuranceCompanyName.trim());
      data.append("Kind", form.kind);
      data.append("Version", form.version.trim());
      if (form.effectiveFrom) data.append("EffectiveFrom", form.effectiveFrom);
      if (form.effectiveTo) data.append("EffectiveTo", form.effectiveTo);
      if (form.changelogNotes) data.append("ChangelogNotes", form.changelogNotes);
      return (await api.post("/platform/parametric-files/upload", data,
        { headers: { "Content-Type": "multipart/form-data" }})).data;
    },
    onSuccess: () => { setFile(null); onSaved(); },
    onError: handleError
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Νέο παραμετρικό αρχείο</DialogTitle>
      <DialogContent>
        <ErrorPopup error={error} onClose={clear} />
        <Stack spacing={2} mt={1}>
          <Alert severity="info" sx={{ fontSize: 13 }}>
            Όταν ανεβάσετε νέα έκδοση για μια εταιρεία και τύπο, η προηγούμενη απενεργοποιείται αυτόματα και τα γραφεία βλέπουν προτροπή ενημέρωσης.
          </Alert>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κωδικός εταιρείας *" required value={form.insuranceCompanyCode}
              onChange={(e) => setForm({ ...form, insuranceCompanyCode: e.target.value.toUpperCase() })}
              placeholder="INTERAMERICAN" sx={{ width: 200 }} />
            <TextField label="Όνομα εταιρείας *" required fullWidth value={form.insuranceCompanyName}
              onChange={(e) => setForm({ ...form, insuranceCompanyName: e.target.value })} />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField SelectProps={{ native: true }} label="Τύπος *" value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })} sx={{ flex: 1 }}>
              {KIND_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </SearchableTextField>
            <TextField label="Έκδοση *" required value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              placeholder="2026.06" sx={{ flex: 1 }} />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label="Ισχύς από" InputLabelProps={{ shrink: true }}
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} sx={{ flex: 1 }} />
            <TextField type="date" label="Ισχύς έως" InputLabelProps={{ shrink: true }}
              value={form.effectiveTo}
              onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} sx={{ flex: 1 }} />
          </Stack>

          <TextField label="Σχόλια έκδοσης (changelog)" multiline minRows={2} value={form.changelogNotes}
            onChange={(e) => setForm({ ...form, changelogNotes: e.target.value })} fullWidth />

          <Box sx={{
            border: "2px dashed", borderColor: file ? "primary.main" : "divider",
            p: 3, textAlign: "center", borderRadius: 1
          }}>
            <input type="file" id="param-file-input" hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <label htmlFor="param-file-input">
              <Button component="span" variant="outlined" startIcon={<CloudUploadIcon />}>
                {file ? `Επιλέχθηκε: ${file.name} (${(file.size / 1024).toFixed(0)} KB)` : "Επιλέξτε αρχείο"}
              </Button>
            </label>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Δεκτά: Excel, CSV, XML, PDF, JSON · Έως 50 MB
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !file || !form.insuranceCompanyCode || !form.insuranceCompanyName || !form.version}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Ανέβασμα"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
