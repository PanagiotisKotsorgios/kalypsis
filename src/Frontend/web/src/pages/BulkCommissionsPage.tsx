import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface PolicyTypeOpt { value: number; label: string; key: string; }
const POLICY_TYPE_TO_NUM: Record<string, number> = {
  Auto: 1, Home: 2, Health: 3, Life: 4, Business: 5, Travel: 6, Other: 99,
};
interface CompanyParameterItem {
  id: string;
  kind: "Branch" | "Coverage" | "Use" | "Package" | "BridgeCode" | "Field" | "Other";
  code: string;
  name: string;
  policyType: string | null;
  parentCode: string | null;
}

interface CompanyLite { id: string; name: string; code: string; isBroker?: boolean; parentCompanyId?: string | null; }
interface ProducerLite { id: string; code: string; name: string; }

interface PreviewRow {
  policyId: string; policyNumber: string;
  premium: number; currency: string;
  currentCommission: number; newCommission: number; delta: number;
}
interface PreviewResponse {
  affectedCount: number; totalDelta: number; sample: PreviewRow[];
}

export function BulkCommissionsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [filter, setFilter] = useState({
    insuranceCompanyId: "", producerId: "", policyType: "",
    startDateFrom: "", startDateTo: ""
  });
  const [operation, setOperation] = useState("SetPercentage");
  const [value, setValue] = useState<string>("15");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [applied, setApplied] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const companies = useQuery({
    queryKey: ["insurance-companies-lite"],
    queryFn: async () => (await api.get<CompanyLite[]>("/insurance-companies")).data
  });
  const producers = useQuery({
    queryKey: ["producers-lite-bulk"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data
  });

  // When a carrier is selected, fetch its catalogue so we can show the real
  // branch names (e.g. ΧΕΡΣΑΙΩΝ ΟΧΗΜΑΤΩΝ) instead of the generic enum.
  const carrierParams = useQuery({
    queryKey: ["company-parameters-bulk", filter.insuranceCompanyId],
    queryFn: async () => (await api.get<CompanyParameterItem[]>("/company-parameters", {
      params: { insuranceCompanyId: filter.insuranceCompanyId }
    })).data,
    enabled: !!filter.insuranceCompanyId
  });

  // Strict: only show real παραμετρικά. No enum fallback.
  const policyTypeOptions = useMemo<PolicyTypeOpt[]>(() => {
    if (!filter.insuranceCompanyId) return [];
    return (carrierParams.data ?? [])
      .filter(p => p.kind === "Branch" && p.policyType && POLICY_TYPE_TO_NUM[p.policyType])
      .map(p => ({
        key: `param:${p.id}`,
        value: POLICY_TYPE_TO_NUM[p.policyType!],
        label: p.name,
      }));
  }, [carrierParams.data, filter.insuranceCompanyId]);

  const buildFilter = () => ({
    insuranceCompanyId: filter.insuranceCompanyId || null,
    producerId: filter.producerId || null,
    policyType: filter.policyType ? Number(filter.policyType) : null,
    startDateFrom: filter.startDateFrom || null,
    startDateTo: filter.startDateTo || null
  });

  const previewMut = useMutation({
    mutationFn: async () => (await api.post<PreviewResponse>("/bulk-commissions/preview", {
      filter: buildFilter(),
      operation,
      value: Number(value)
    })).data,
    onSuccess: (r) => { setPreview(r); setError(null); },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const applyMut = useMutation({
    mutationFn: async () => (await api.post<PreviewResponse>("/bulk-commissions/apply", {
      filter: buildFilter(),
      operation,
      value: Number(value)
    })).data,
    onSuccess: (r) => {
      setApplied(r);
      setPreview(null);
      setSuccess(`Επεξεργάστηκαν ${r.affectedCount} συμβόλαια. Συνολική μεταβολή προμηθειών: ${r.totalDelta.toFixed(2)} €.`);
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      {!embedded && (
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <TuneIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Μαζική επεξεργασία προμηθειών</Typography>
            <HelpHint title="Πώς δουλεύει"
              body="Φιλτράρετε συμβόλαια κατά εταιρεία/συνεργάτη/τύπο/περίοδο και εφαρμόστε ένα κανόνα προμήθειας σε όλα μαζί. Πρώτα κάντε προεπισκόπηση — δείτε ποια θα επηρεαστούν και τη συνολική διαφορά — και μετά εφαρμόστε." />
          </Stack>
          <Typography color="text.secondary">
            Παραμετρική ανανέωση προμηθειών σε πολλά συμβόλαια ταυτόχρονα. Επεξεργασία προμηθειών με βάση παραμετροποίηση.
          </Typography>
        </Box>
      </Stack>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>1. Φίλτρα επιλογής συμβολαίων</Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
            <TextField select label="Ασφαλιστική εταιρεία" value={filter.insuranceCompanyId}
              onChange={(e) => setFilter({ ...filter, insuranceCompanyId: e.target.value, policyType: "" })}>
              <MenuItem value="">Όλες</MenuItem>
              {(companies.data ?? []).filter(c => !c.parentCompanyId).map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}{c.isBroker ? " · πρακτορείο" : ""}
                </MenuItem>
              ))}
            </TextField>
            {(() => {
              const carrierData = companies.data ?? [];
              const selected = carrierData.find(c => c.id === filter.insuranceCompanyId);
              const broker = selected?.isBroker
                ? selected
                : selected?.parentCompanyId
                  ? carrierData.find(c => c.id === selected.parentCompanyId)
                  : null;
              if (!broker?.isBroker) return null;
              const subs = carrierData.filter(c => c.parentCompanyId === broker.id);
              const subValue = selected?.id !== broker.id ? selected?.id ?? "" : "";
              return (
                <TextField select label="Υποασφαλιστική" value={subValue}
                  onChange={e => setFilter({ ...filter, insuranceCompanyId: e.target.value || broker.id, policyType: "" })}>
                  <MenuItem value="">— όλες οι υποασφαλιστικές —</MenuItem>
                  {subs.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              );
            })()}
            <TextField select label="Συνεργάτης" value={filter.producerId}
              onChange={(e) => setFilter({ ...filter, producerId: e.target.value })}>
              <MenuItem value="">Όλοι</MenuItem>
              {(producers.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.code} · {p.name}</MenuItem>)}
            </TextField>
            <TextField select label="Κλάδος" value={filter.policyType}
              onChange={(e) => setFilter({ ...filter, policyType: e.target.value })}
              disabled={!filter.insuranceCompanyId}
              helperText={!filter.insuranceCompanyId
                ? "Επιλέξτε εταιρία πρώτα"
                : policyTypeOptions.length === 0 ? "Δεν υπάρχουν παραμετρικά" : "Από τα παραμετρικά"}>
              <MenuItem value="">Όλα</MenuItem>
              {policyTypeOptions.map(t => <MenuItem key={t.key} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField type="date" label="Έναρξη από" InputLabelProps={{ shrink: true }}
              value={filter.startDateFrom} onChange={(e) => setFilter({ ...filter, startDateFrom: e.target.value })} />
            <TextField type="date" label="Έναρξη έως" InputLabelProps={{ shrink: true }}
              value={filter.startDateTo} onChange={(e) => setFilter({ ...filter, startDateTo: e.target.value })} />
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={0.5} mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>2. Κανόνας επεξεργασίας</Typography>
            <HelpHint id="commission.bulkOperation" />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <TextField select label="Λειτουργία" value={operation}
              onChange={(e) => setOperation(e.target.value)} sx={{ minWidth: 240 }}>
              <MenuItem value="SetPercentage">Ορισμός ποσοστού (% επί ασφαλίστρου)</MenuItem>
              <MenuItem value="SetFixed">Ορισμός σταθερού ποσού (€)</MenuItem>
              <MenuItem value="MultiplyBy">Πολλαπλασιασμός υφιστάμενης (×)</MenuItem>
              <MenuItem value="AddFixed">Προσθήκη σταθερού ποσού (€)</MenuItem>
            </TextField>
            <TextField type="number" label="Τιμή" value={value}
              onChange={(e) => setValue(e.target.value)} inputProps={{ step: "0.01" }} sx={{ width: 160 }}
              helperText={
                operation === "SetPercentage" ? "π.χ. 15 → 15%" :
                operation === "SetFixed" ? "Σταθερό ποσό σε €" :
                operation === "MultiplyBy" ? "π.χ. 1.10 → +10%" :
                "Προστιθέμενο ποσό σε €"
              } />
            <Button variant="outlined" size="large" startIcon={<VisibilityIcon />}
              onClick={() => { setApplied(null); previewMut.mutate(); }} disabled={previewMut.isPending}>
              {previewMut.isPending ? <CircularProgress size={18} /> : "Προεπισκόπηση"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {(preview || applied) && (
        <Card variant="outlined">
          <CardContent>
            {(() => {
              const data = applied ?? preview!;
              return (
                <>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {applied ? "3. Αποτέλεσμα εφαρμογής" : "3. Προεπισκόπηση"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {data.affectedCount} συμβόλαια θα επηρεαστούν · Συνολική διαφορά:{" "}
                        <strong style={{ color: data.totalDelta >= 0 ? "#5b8b3e" : "#a85c40" }}>
                          {data.totalDelta >= 0 ? "+" : ""}{data.totalDelta.toFixed(2)} €
                        </strong>
                      </Typography>
                    </Box>
                    {!applied && preview && (
                      <Button variant="contained" color="primary" size="large" startIcon={<PlayArrowIcon />}
                        onClick={() => {
                          if (confirm(`Εφαρμογή κανόνα σε ${preview.affectedCount} συμβόλαια; Η ενέργεια είναι μη αναστρέψιμη.`)) {
                            applyMut.mutate();
                          }
                        }} disabled={applyMut.isPending}>
                        {applyMut.isPending ? <CircularProgress size={18} color="inherit" /> : "Εφαρμογή"}
                      </Button>
                    )}
                  </Stack>

                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Αρ. συμβολαίου</TableCell>
                          <TableCell align="right">Ασφάλιστρο</TableCell>
                          <TableCell align="right">Τρέχουσα προμήθεια</TableCell>
                          <TableCell align="right">Νέα προμήθεια</TableCell>
                          <TableCell align="right">Διαφορά</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.sample.length === 0 && (
                          <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 3 }}>
                            Κανένα συμβόλαιο δεν ταιριάζει στα φίλτρα.
                          </TableCell></TableRow>
                        )}
                        {data.sample.map(r => (
                          <TableRow key={r.policyId} hover>
                            <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{r.policyNumber}</TableCell>
                            <TableCell align="right">{r.premium.toFixed(2)} {r.currency}</TableCell>
                            <TableCell align="right" sx={{ color: "text.secondary" }}>
                              {r.currentCommission.toFixed(2)} {r.currency}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {r.newCommission.toFixed(2)} {r.currency}
                            </TableCell>
                            <TableCell align="right" sx={{
                              fontWeight: 700,
                              color: r.delta >= 0 ? "success.main" : "error.main"
                            }}>
                              {r.delta >= 0 ? "+" : ""}{r.delta.toFixed(2)} {r.currency}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                  {data.affectedCount > data.sample.length && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                      Εμφάνιση δείγματος {data.sample.length} από {data.affectedCount} συνολικά.
                    </Typography>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
