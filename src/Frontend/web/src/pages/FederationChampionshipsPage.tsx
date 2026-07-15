import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

type ChampionshipStatus =
  | "Draft" | "Published" | "RegistrationOpen" | "RegistrationClosed"
  | "InProgress" | "Completed" | "Cancelled";

interface ChampionshipDto {
  id: string;
  name: string;
  sport: string;
  location: string | null;
  startDate: string;
  endDate: string;
  status: ChampionshipStatus | number;
  description: string | null;
  registrationDeadline: string | null;
  clubEntryFee: number;
  feePerAthlete: number;
  currency: string;
  announcementFileName: string | null;
  registrationCount: number;
  athleteCount: number;
  totalCollected: number;
  totalOutstanding: number;
}

const STATUS_LABEL: Record<string, string> = {
  Draft: "Πρόχειρο",
  Published: "Δημοσιευμένο",
  RegistrationOpen: "Δηλώσεις Ανοιχτές",
  RegistrationClosed: "Δηλώσεις Κλειστές",
  InProgress: "Σε εξέλιξη",
  Completed: "Ολοκληρώθηκε",
  Cancelled: "Ακυρωμένο",
};
const STATUS_COLOR: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
  Draft: "default", Published: "info", RegistrationOpen: "success",
  RegistrationClosed: "warning", InProgress: "info",
  Completed: "success", Cancelled: "error",
};

// Backend returns enum as string OR number depending on the serialiser config —
// normalise so the chip lookup always works.
const STATUS_KEYS = ["Draft","Published","RegistrationOpen","RegistrationClosed","InProgress","Completed","Cancelled"] as const;
const statusKey = (s: ChampionshipStatus | number): string =>
  typeof s === "number" ? STATUS_KEYS[s] ?? "Draft" : s;

const eur = (n: number) => `€${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Πρωταθλήματα — the Federation Admin's home page. Lists every championship
 * the federation is running with headline counters (clubs / athletes /
 * collected / outstanding) so the admin sees payment health at a glance.
 * Full CRUD with the fee model (base club fee + per-athlete surcharge)
 * driven from the create/edit dialog.
 */
export function FederationChampionshipsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChampionshipDto | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["federation-championships"],
    queryFn: async () =>
      (await api.get<ChampionshipDto[]>("/federation/championships")).data,
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/federation/championships/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["federation-championships"] }),
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const downloadCsv = async () => {
    const res = await api.get<Blob>("/federation/championships/export.csv",
      { responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(res.data);
    a.download = "championships.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rows = q.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <EmojiEventsIcon />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Πρωταθλήματα</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Δημιουργήστε και παραμετροποιήστε πρωταθλήματα — άθλημα, ημερομηνίες,
        παράβολα ανά σύλλογο και ανά αθλητή, προκήρυξη και κατηγορίες.
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />}
          disabled={!rows.length} onClick={downloadCsv}>Εξαγωγή Excel</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          Νέο πρωτάθλημα
        </Button>
      </Stack>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Alert severity="info">
          Δεν υπάρχουν πρωταθλήματα ακόμα. Πατήστε «Νέο πρωτάθλημα» για να ξεκινήσετε.
        </Alert>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Όνομα</TableCell>
                <TableCell>Άθλημα</TableCell>
                <TableCell>Ημερομηνίες</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right">Σύλλογοι</TableCell>
                <TableCell align="right">Αθλητές</TableCell>
                <TableCell align="right">Είσπραξε</TableCell>
                <TableCell align="right">Οφείλει</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => {
                const sk = statusKey(r.status);
                return (
                  <TableRow key={r.id} hover>
                    <TableCell><b>{r.name}</b>{r.location && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{r.location}</Typography>}</TableCell>
                    <TableCell>{r.sport}</TableCell>
                    <TableCell>{r.startDate} → {r.endDate}</TableCell>
                    <TableCell><Chip size="small" color={STATUS_COLOR[sk]} label={STATUS_LABEL[sk] ?? sk} /></TableCell>
                    <TableCell align="right">{r.registrationCount}</TableCell>
                    <TableCell align="right">{r.athleteCount}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main" }}>{eur(r.totalCollected)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: r.totalOutstanding > 0 ? "error.main" : "text.secondary" }}>{eur(r.totalOutstanding)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => {
                        if (confirm(`Διαγραφή του πρωταθλήματος «${r.name}»;`)) del.mutate(r.id);
                      }}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {(creating || editing) && (
        <ChampionshipDialog
          open value={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false); setEditing(null);
            qc.invalidateQueries({ queryKey: ["federation-championships"] });
          }} />
      )}
    </Box>
  );
}

function ChampionshipDialog({ open, value, onClose, onSaved }: {
  open: boolean; value?: ChampionshipDto;
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!value;
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: value?.name ?? "",
    sport: value?.sport ?? "",
    location: value?.location ?? "",
    startDate: value?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: value?.endDate ?? new Date().toISOString().slice(0, 10),
    status: (statusKey(value?.status ?? "Draft")) as ChampionshipStatus,
    description: value?.description ?? "",
    registrationDeadline: value?.registrationDeadline ?? "",
    clubEntryFee: value?.clubEntryFee ?? 0,
    feePerAthlete: value?.feePerAthlete ?? 0,
    currency: value?.currency ?? "EUR",
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name, sport: form.sport, location: form.location || null,
        startDate: form.startDate, endDate: form.endDate,
        status: form.status, description: form.description || null,
        registrationDeadline: form.registrationDeadline || null,
        clubEntryFee: Number(form.clubEntryFee) || 0,
        feePerAthlete: Number(form.feePerAthlete) || 0,
        currency: form.currency || "EUR",
      };
      if (isEdit) await api.put(`/federation/championships/${value!.id}`, body);
      else await api.post("/federation/championships", body);
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractErrorMessage(e)),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEdit ? "Επεξεργασία πρωταθλήματος" : "Νέο πρωτάθλημα"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Όνομα *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              fullWidth required sx={{ flex: 2 }} />
            <TextField label="Άθλημα *" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })}
              fullWidth required sx={{ flex: 1 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Τοποθεσία" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              fullWidth sx={{ flex: 2 }} />
            <SearchableTextField label="Κατάσταση" value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as ChampionshipStatus })}
              fullWidth sx={{ flex: 1 }}>
              {STATUS_KEYS.map(s => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Έναρξη *" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }} fullWidth required />
            <TextField label="Λήξη *" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }} fullWidth required />
            <TextField label="Προθεσμία δηλώσεων" type="date" value={form.registrationDeadline}
              onChange={e => setForm({ ...form, registrationDeadline: e.target.value })}
              InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          {/* Fee model — the operator's key lever. Explained inline so a
              federation admin new to the platform doesn't have to guess. */}
          <Alert severity="info" variant="outlined">
            <b>Παράβολο συμμετοχής:</b> ο σύλλογος χρεώνεται
            <b> €{Number(form.clubEntryFee) || 0}</b> βασικό +
            <b> €{Number(form.feePerAthlete) || 0}</b> ανά αθλητή που δηλώνει.
            Το ποσό «κλειδώνει» στη στιγμή υποβολής της δήλωσης.
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Πάγιο ανά σύλλογο" type="number" value={form.clubEntryFee}
              onChange={e => setForm({ ...form, clubEntryFee: Number(e.target.value) })}
              InputProps={{ inputProps: { step: "0.01", min: 0 } }} fullWidth />
            <TextField label="Παράβολο ανά αθλητή" type="number" value={form.feePerAthlete}
              onChange={e => setForm({ ...form, feePerAthlete: Number(e.target.value) })}
              InputProps={{ inputProps: { step: "0.01", min: 0 } }} fullWidth />
            <TextField label="Νόμισμα" value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value })}
              fullWidth sx={{ maxWidth: 100 }} />
          </Stack>
          <TextField label="Περιγραφή / κανονισμοί" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            multiline minRows={3} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.name || !form.sport}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
