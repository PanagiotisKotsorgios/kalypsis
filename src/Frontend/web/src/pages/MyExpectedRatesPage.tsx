import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TuneIcon from "@mui/icons-material/Tune";
import PercentIcon from "@mui/icons-material/Percent";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

interface ExpectedRateDto {
  id: string;
  insuranceCompanyId: string | null;
  insuranceCompanyName: string | null;
  policyType: string | null;
  vehicleUseCategory: string | null;
  expectedPercent: number;
  notes: string | null;
}

interface CarrierDto { id: string; name: string; policyCount?: number; hasAgencyRule?: boolean; }

const POLICY_TYPES = ["Auto", "Home", "Health", "Life", "Business", "Travel", "Marine", "Other"] as const;
const POLICY_TYPE_LABEL: Record<string, string> = {
  Auto: "Οχήματα", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Marine: "Μεταφορές", Other: "Άλλο"
};

const USE_CATS = ["Private", "Public", "Taxi", "RentACar", "Commercial", "Motorcycle"] as const;

/** Producer-facing form for their own commission expectations. Each row is
 * one «I expect X% from Carrier Y for Package Z» rule — mirroring the agency's
 * CommissionRule shape so the comparison view can line them up 1:1. */
export function MyExpectedRatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ExpectedRateDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const ratesQ = useQuery({
    queryKey: ["my-expected-rates"],
    queryFn: async () => (await api.get<ExpectedRateDto[]>("/producer-portal/expected-rates")).data
  });
  // Only the carriers where the producer has active policies OR the office has
  // a commission rule for them — same shortlist both sides «think in».
  const carriersQ = useQuery({
    queryKey: ["my-relevant-carriers"],
    queryFn: async () => (await api.get<CarrierDto[]>("/producer-portal/relevant-carriers")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/producer-portal/expected-rates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-expected-rates"] })
  });

  const rows = ratesQ.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5, display: "grid", placeItems: "center",
            bgcolor: "rgba(30,167,225,0.10)", color: "secondary.main",
            border: "1px solid rgba(30,167,225,0.22)"
          }}>
            <TuneIcon />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Παραμετροποίηση Προμηθειών μου</Typography>
            <Typography color="text.secondary">
              Καταχωρήστε τα ποσοστά προμήθειας που θεωρείτε ότι δικαιούστε ανά εταιρεία και πακέτο. Οι διαθέσιμες
              εταιρείες περιορίζονται σε αυτές που ήδη έχετε συμβόλαια ή κανόνες γραφείου — ίδια λίστα με του
              γραφείου σας, για ακριβή 1-προς-1 σύγκριση.
            </Typography>
          </Box>
        </Stack>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          Νέα εγγραφή
        </Button>
      </Stack>

      {ratesQ.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <TuneIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1 }} />
            <Typography>Δεν έχετε καταχωρήσει ακόμα κανόνες.</Typography>
            <Typography variant="body2" mt={1}>
              Πατήστε «Νέα εγγραφή» για να ορίσετε π.χ. «Interamerican · Οχήματα → 10%».
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Εταιρεία</TableCell>
                <TableCell>Πακέτο</TableCell>
                <TableCell>Χρήση</TableCell>
                <TableCell align="right">Ποσοστό</TableCell>
                <TableCell>Σημείωση</TableCell>
                <TableCell align="right">Ενέργειες</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography fontWeight={700}>{r.insuranceCompanyName ?? "Όλες οι εταιρείες"}</Typography></TableCell>
                  <TableCell>{r.policyType ? (POLICY_TYPE_LABEL[r.policyType] ?? r.policyType) : "Όλα"}</TableCell>
                  <TableCell>{r.vehicleUseCategory ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={800} color="secondary.main">{r.expectedPercent}%</Typography>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.notes ?? "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Επεξεργασία">
                      <IconButton size="small" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Διαγραφή">
                      <IconButton size="small" onClick={() => del.mutate(r.id)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ExpectedRateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        row={editing}
        carriers={carriersQ.data ?? []}
        onSaved={() => { setDialogOpen(false); qc.invalidateQueries({ queryKey: ["my-expected-rates"] }); }}
      />
    </Box>
  );
}

function ExpectedRateDialog({ open, onClose, row, carriers, onSaved }: {
  open: boolean; onClose: () => void; row: ExpectedRateDto | null;
  carriers: CarrierDto[]; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    insuranceCompanyId: "" as string,
    policyType: "" as string,
    vehicleUseCategory: "" as string,
    expectedPercent: "10",
    notes: "" as string
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setForm({
        insuranceCompanyId: row.insuranceCompanyId ?? "",
        policyType: row.policyType ?? "",
        vehicleUseCategory: row.vehicleUseCategory ?? "",
        expectedPercent: String(row.expectedPercent),
        notes: row.notes ?? ""
      });
    } else if (open) {
      setForm({ insuranceCompanyId: "", policyType: "", vehicleUseCategory: "", expectedPercent: "10", notes: "" });
    }
    setError(null);
  }, [row, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        id: row?.id ?? null,
        insuranceCompanyId: form.insuranceCompanyId || null,
        policyType: form.policyType || null,
        vehicleUseCategory: form.vehicleUseCategory || null,
        expectedPercent: Number(form.expectedPercent),
        notes: form.notes.trim() || null
      };
      return (await api.post("/producer-portal/expected-rates", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{row ? "Επεξεργασία κανόνα" : "Νέος κανόνας προμήθειας"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <SearchableTextField
            select label="Εταιρεία" value={form.insuranceCompanyId}
            onChange={(e) => setForm({ ...form, insuranceCompanyId: e.target.value })}
            helperText={carriers.length === 0
              ? "Δεν έχετε ενεργά συμβόλαια ή κανόνες γραφείου με καμία εταιρεία ακόμα."
              : "Εμφανίζονται μόνο οι εταιρείες στις οποίες έχετε συμβόλαια ή κανόνες γραφείου."}
          >
            <MenuItem value="">— Όλες οι εταιρείες —</MenuItem>
            {carriers.map(c => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
                {typeof c.policyCount === "number" && c.policyCount > 0 && ` · ${c.policyCount} συμβ.`}
                {c.hasAgencyRule && " · έχει κανόνα γραφείου"}
              </MenuItem>
            ))}
          </SearchableTextField>
          <SearchableTextField
            select label="Πακέτο" value={form.policyType}
            onChange={(e) => setForm({ ...form, policyType: e.target.value })}
            helperText="Αφήστε κενό για «Όλα τα πακέτα»"
          >
            <MenuItem value="">— Όλα τα πακέτα —</MenuItem>
            {POLICY_TYPES.map(t => <MenuItem key={t} value={t}>{POLICY_TYPE_LABEL[t]}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField
            select label="Χρήση οχήματος (αν αφορά)" value={form.vehicleUseCategory}
            onChange={(e) => setForm({ ...form, vehicleUseCategory: e.target.value })}
          >
            <MenuItem value="">— Οποιαδήποτε —</MenuItem>
            {USE_CATS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
          </SearchableTextField>
          <TextField
            label="Ποσοστό" type="number"
            value={form.expectedPercent}
            onChange={(e) => setForm({ ...form, expectedPercent: e.target.value })}
            InputProps={{ endAdornment: <InputAdornment position="end"><PercentIcon fontSize="small" /></InputAdornment> }}
            required
          />
          <TextField
            label="Σημείωση" value={form.notes} multiline minRows={2}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="π.χ. «βάσει σύμβασης από 01/2026»"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button
          variant="contained"
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.expectedPercent}
        >
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
