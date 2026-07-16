import { useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
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

  // Flat, alphabetical list — the broker/sub-broker tree was dropped from
  // this screen. Central παραμετρικά are no longer maintained per carrier;
  // each γραφείο links what comes from its own bridge to whichever carrier
  // row it uses. This page is now a system-wide carrier registry only.
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const allRows = carriers.data ?? [];
  const rows = allRows
    .filter(r => showInactive || r.isActive)
    .filter(r => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "el"));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BusinessCenterIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Ασφαλιστικές Εταιρίες</Typography>
              <HelpHint title="Πώς δουλεύει"
                body="Καθολικός κατάλογος ασφαλιστικών εταιριών. Κάθε γραφείο συνδέει τα αρχεία που έρχονται από τις γέφυρες με μια από αυτές τις εταιρίες. Τα παραμετρικά δεν καθορίζονται πια εδώ — κάθε γραφείο διαμορφώνει δικά του παραμετρικά ανά εταιρία στη σελίδα «Παραμετρικά Ασφαλιστικών»." />
            </Stack>
            <Typography color="text.secondary">
              Καθολικός κατάλογος. Κάθε γραφείο συνδέει τα αρχεία της γέφυράς του σε μια από αυτές και ορίζει τα δικά του παραμετρικά.
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button startIcon={<AddIcon />} variant="contained" size="large"
            onClick={() => { setError(null); setEditing({ ...EMPTY_FORM }); }}>
            Νέα ασφαλιστική
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }}>
        Αυτή η σελίδα είναι μόνο ο καθολικός κατάλογος (όνομα · κωδικός · κατάσταση). Τα παραμετρικά (κλάδοι / πακέτα / καλύψεις / γέφυρες)
        ορίζονται πλέον <strong>ανά γραφείο</strong> στη σελίδα «Ασφαλιστικές Εταιρείες» → «Ρυθμίσεις Γέφυρας» → import αρχείων.
      </Alert>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <TextField size="small" label="Αναζήτηση (όνομα ή κωδικός)"
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280 }} />
          <FormControlLabel
            control={<Checkbox checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />}
            label="Εμφάνιση ανενεργών" />
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {rows.length} από {allRows.length} εταιρίες
          </Typography>
        </Stack>
      </Card>

      {carriers.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Όνομα</TableCell>
              <TableCell>Κωδικός</TableCell>
              <TableCell>Χώρα</TableCell>
              <TableCell>Website</TableCell>
              <TableCell align="center">Κατάσταση</TableCell>
              <TableCell align="right" width={120}>Ενέργειες</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {allRows.length === 0
                    ? "Δεν υπάρχουν εταιρίες. Δημιουργήστε την πρώτη με το «Νέα ασφαλιστική»."
                    : "Καμία εταιρία δεν ταιριάζει στα φίλτρα."}
                </TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{r.code}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{r.country ?? "—"}</TableCell>
                  <TableCell sx={{ fontSize: 13, color: "text.secondary", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.website ?? "—"}
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={r.isActive ? "Ενεργή" : "Ανενεργή"}
                      color={r.isActive ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" title="Επεξεργασία"
                      onClick={() => setEditing({
                        id: r.id, name: r.name, code: r.code,
                        country: r.country ?? "", website: r.website ?? "",
                        isActive: r.isActive, isBroker: false,
                        parentCompanyId: "", notes: r.notes ?? "",
                        excludedBranchCodes: ""
                      })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" title="Διαγραφή"
                      onClick={() => {
                        if (confirm(`Διαγραφή της «${r.name}»; Η ενέργεια αφαιρεί την εταιρία από τον καθολικό κατάλογο.`))
                          del.mutate(r.id);
                      }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
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
              <FormControlLabel
                control={<Checkbox checked={editing.isActive}
                  onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />}
                label="Ενεργή" />
              <TextField label="Σημειώσεις" value={editing.notes} multiline rows={2} fullWidth
                onChange={e => setEditing({ ...editing, notes: e.target.value })} />
              <Alert severity="info" sx={{ fontSize: 12 }}>
                Τα παραμετρικά (κλάδοι / πακέτα / καλύψεις / γέφυρες) ορίζονται πλέον <strong>ανά γραφείο</strong>.
                Αυτή η σελίδα διαχειρίζεται μόνο τον καθολικό κατάλογο εταιριών.
              </Alert>
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

    </Box>
  );
}
