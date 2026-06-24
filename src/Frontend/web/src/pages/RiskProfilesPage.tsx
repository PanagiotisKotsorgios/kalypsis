import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, IconButton, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import DriveEtaIcon from "@mui/icons-material/DriveEta";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

const PRODUCT_TYPES = ["Auto", "Home", "Health", "Life", "Business", "Travel"] as const;
type ProductType = typeof PRODUCT_TYPES[number];

interface ProfileDto {
  id: string;
  productType: string;
  key: string;
  label: string;
  inputsJson: string;
  customerId: string | null;
  lastUsedAt: string | null;
  timesUsed: number;
}

interface PlateLookupResult {
  found: boolean;
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  ccEngine: number | null;
  kw: number | null;
  vehicleType: string | null;
  fuelType: string | null;
  firstRegistration: string | null;
  errorMessage: string | null;
}

export function RiskProfilesPage() {
  const qc = useQueryClient();
  const [productType, setProductType] = useState<ProductType>("Auto");
  const [search, setSearch] = useState("");
  const [plate, setPlate] = useState("");
  const [lookup, setLookup] = useState<PlateLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["risk-profiles", productType, search],
    queryFn: async () => {
      const params: Record<string, string> = { productType };
      if (search) params.search = search;
      return (await api.get<ProfileDto[]>("/risk-profiles", { params })).data;
    }
  });

  const doLookup = useMutation({
    mutationFn: async () => (await api.get<PlateLookupResult>(`/risk-profiles/plate-lookup`, { params: { plate } })).data,
    onSuccess: (r) => setLookup(r),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!lookup) throw new Error("Lookup first");
      const body = {
        productType,
        key: lookup.plate ?? plate,
        label: `${lookup.make ?? ""} ${lookup.model ?? ""} ${lookup.year ?? ""}`.trim() || (lookup.plate ?? plate),
        inputsJson: JSON.stringify({
          make: lookup.make, model: lookup.model, year: lookup.year, cc: lookup.ccEngine,
          kw: lookup.kw, fuel: lookup.fuelType, firstRegistration: lookup.firstRegistration
        }),
        customerId: null
      };
      return (await api.post<ProfileDto>("/risk-profiles", body)).data;
    },
    onSuccess: () => {
      setLookup(null); setPlate("");
      void qc.invalidateQueries({ queryKey: ["risk-profiles"] });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/risk-profiles/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["risk-profiles"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <DriveEtaIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Υπερτιμολόγηση — Αποθηκευμένα προφίλ</Typography>
          <Typography color="text.secondary">
            Αποθηκεύστε τα στοιχεία κινδύνου μία φορά και χρησιμοποιήστε τα σε κάθε επόμενη τιμολόγηση.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Card variant="outlined" sx={{ p: 3, width: { xs: "100%", lg: 400 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Αναζήτηση οχήματος με πινακίδα</Typography>
          <Stack direction="row" spacing={1}>
            <TextField fullWidth size="small" label="Πινακίδα" value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1234" />
            <Button variant="contained" disabled={!plate || doLookup.isPending}
              onClick={() => doLookup.mutate()}
              startIcon={doLookup.isPending ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}>
              Αναζήτηση
            </Button>
          </Stack>

          {lookup && lookup.found && (
            <Box mt={3}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Βρέθηκε</Typography>
              <Stack spacing={0.5}>
                <Row label="Μάρκα">{lookup.make}</Row>
                <Row label="Μοντέλο">{lookup.model}</Row>
                <Row label="Έτος">{lookup.year}</Row>
                <Row label="Κυβικά">{lookup.ccEngine}</Row>
                <Row label="ίπποι (kW)">{lookup.kw}</Row>
                <Row label="Καύσιμο">{lookup.fuelType}</Row>
                <Row label="1η ταξιν.">{lookup.firstRegistration && new Date(lookup.firstRegistration).toLocaleDateString("el-GR")}</Row>
              </Stack>
              <Button fullWidth variant="contained" sx={{ mt: 2 }}
                disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση προφίλ"}
              </Button>
            </Box>
          )}
          {lookup && !lookup.found && (
            <Alert severity="warning" sx={{ mt: 2 }}>Δεν βρέθηκαν στοιχεία για την πινακίδα.</Alert>
          )}
        </Card>

        <Box sx={{ flex: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
            <TextField select label="Τύπος προϊόντος" value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)} sx={{ minWidth: 200 }}>
              {PRODUCT_TYPES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            <TextField fullWidth size="small" label="Αναζήτηση" value={search}
              onChange={(e) => setSearch(e.target.value)} placeholder="πινακίδα ή ετικέτα" />
          </Stack>

          {list.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : (
            <Card variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Κλειδί</TableCell>
                    <TableCell>Ετικέτα</TableCell>
                    <TableCell align="right">Χρήσεις</TableCell>
                    <TableCell>Τελευταία χρήση</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(list.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>
                      Δεν υπάρχουν αποθηκευμένα προφίλ.
                    </TableCell></TableRow>
                  )}
                  {(list.data ?? []).map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell><Chip size="small" label={r.key} sx={{ fontFamily: "monospace" }} /></TableCell>
                      <TableCell><Typography fontWeight={600}>{r.label}</Typography></TableCell>
                      <TableCell align="right">{r.timesUsed}</TableCell>
                      <TableCell>{r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString("el-GR") : "—"}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => {
                          if (confirm("Διαγραφή προφίλ;")) del.mutate(r.id);
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
        </Box>
      </Stack>
    </Box>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{children ?? "—"}</Typography>
    </Stack>
  );
}
