import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem,
  Stack, Table, TableBody, TableCell, TableFooter, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

interface DistributionRow {
  key: string;
  producerName: string;
  level: string;
  policyCount: number;
  gross: number;
  taxWithholding: number;
  net: number;
}
interface DistributionDto {
  rows: DistributionRow[];
  totals: DistributionRow;
  from: string;
  to: string;
}

interface CarrierLite { id: string; name: string; }
interface ProducerLite { id: string; name: string; }

const eur = (n: number) => `€${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Καταμερισμός Προμηθειών — who took what off each policy, one row per
 * (producer × hierarchy level). Uses the same PolicyCommissionSplit ledger
 * that powers the F9 matrix on individual policies, but rolled up over a
 * time window so the operator can answer «πόσα βγήκαν στον Χ φέτος».
 */
export function CommissionDistributionPage() {
  const y = new Date().getFullYear();
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(`${y}-12-31`);
  const [producerId, setProducerId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [level, setLevel] = useState("");
  // What to include in the ledger: "policies" (commission splits from συμβόλαια —
  // the default, matches historic behaviour), "overcommissions" (only the
  // monthly πινάκιο rows), or "all" (both, merged per producer × level).
  const [scope, setScope] = useState<"policies" | "overcommissions" | "all">("policies");

  const carriers = useQuery({
    queryKey: ["insurance-companies", "used"],
    queryFn: async () => (await api.get<CarrierLite[]>("/insurance-companies?onlyUsed=true")).data,
  });
  const producers = useQuery({
    queryKey: ["producers", "lite"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data,
  });

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (from) p.from = from;
    if (to) p.to = to;
    if (producerId) p.producerId = producerId;
    if (carrierId) p.carrierId = carrierId;
    if (level) p.level = level;
    if (scope && scope !== "policies") p.scope = scope;
    return p;
  }, [from, to, producerId, carrierId, level, scope]);

  const report = useQuery({
    queryKey: ["reports-distribution", params],
    queryFn: async () =>
      (await api.get<DistributionDto>("/reports/commission-distribution", { params })).data,
  });

  const downloadCsv = async () => {
    const res = await api.get<Blob>("/reports/commission-distribution/export.csv",
      { params, responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(res.data);
    a.download = `katamerismos-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rows = report.data?.rows ?? [];
  const totals = report.data?.totals;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <AccountTreeIcon />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Καταμερισμός Προμηθειών</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Ποιος πήρε τι, ανά επίπεδο ιεραρχίας (Παραγωγός → Προϊστάμενος → Γραφείο). Επιλέξτε
        πηγή δεδομένων για να δείτε καταμερισμό από <strong>συμβόλαια</strong>,
        <strong> μηνιαία πινάκια υπερπρομηθειών</strong>, ή και τα δύο μαζί ως συγκεντρωτικά.
      </Typography>

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        {/* Scope selector — first row, on its own, so the operator explicitly
            picks what the numbers below cover: policy splits, over-commission
            πινάκιο rows, or both merged. Default is Policies to match the
            historic behaviour when older reports were bookmarked. */}
        <Box sx={{ mb: 1 }}>
          <SearchableTextField size="small" label="Πηγή δεδομένων" value={scope}
            onChange={e => setScope((e.target.value as typeof scope) || "policies")} fullWidth>
            <MenuItem value="policies">Μόνο από συμβόλαια (καταμερισμοί)</MenuItem>
            <MenuItem value="overcommissions">Μόνο υπερπρομήθειες (πινάκια)</MenuItem>
            <MenuItem value="all">Όλα (συμβόλαια + υπερπρομήθειες)</MenuItem>
          </SearchableTextField>
        </Box>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
          alignItems: "start",
        }}>
          <TextField label="Από" type="date" size="small" fullWidth
            value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Έως" type="date" size="small" fullWidth
            value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <SearchableTextField size="small" label="Επίπεδο" value={level}
            onChange={e => setLevel(e.target.value)} fullWidth>
            <MenuItem value="">Όλα</MenuItem>
            <MenuItem value="Producer">Παραγωγός</MenuItem>
            <MenuItem value="Manager">Προϊστάμενος ομάδας</MenuItem>
            <MenuItem value="Unit">Υπεύθυνος μονάδας</MenuItem>
            <MenuItem value="Assistant">Βοηθός διοίκησης</MenuItem>
            <MenuItem value="Agency">Γραφείο</MenuItem>
          </SearchableTextField>
          <SearchableSelect label="Συνεργάτης" value={producerId} onChange={setProducerId}
            emptyLabel="Όλοι" sx={{ width: "100%" }}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))} />
          <SearchableSelect label="Ασφαλιστική εταιρεία" value={carrierId} onChange={setCarrierId}
            emptyLabel="Όλες" sx={{ width: "100%" }}
            options={(carriers.data ?? []).map(c => ({ value: c.id, label: c.name }))} />
        </Box>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={() => {
            setFrom(`${y}-01-01`); setTo(`${y}-12-31`);
            setProducerId(""); setCarrierId(""); setLevel(""); setScope("policies");
          }}>Καθαρισμός</Button>
          <Button size="small" variant="contained" startIcon={<DownloadIcon />}
            disabled={!rows.length} onClick={downloadCsv}>Εξαγωγή CSV</Button>
        </Stack>
      </Card>

      {report.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Alert severity="info">
          Δεν βρέθηκαν εγγραφές στο επιλεγμένο διάστημα και πηγή δεδομένων. {scope !== "overcommissions" &&
            "Για συμβόλαια, ελέγξτε ότι έχουν οριστεί κανόνες στην «Παραμετροποίηση προμηθειών»."} {scope !== "policies" &&
            "Για υπερπρομήθειες, ελέγξτε τα καταχωρημένα πινάκια στην ενότητα «Υπερπρομήθειες»."}
        </Alert>
      ) : (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 2 }}>
            <Kpi label="Συμβόλαια" value={totals?.policyCount.toLocaleString("el-GR") ?? "0"} />
            <Kpi label="Μικτή προμήθεια" value={eur(totals?.gross ?? 0)} />
            <Kpi label="Παρακράτηση φόρου" value={eur(totals?.taxWithholding ?? 0)} accent="warning" />
            <Kpi label="Καθαρή προμήθεια" value={eur(totals?.net ?? 0)} accent="success" />
          </Box>

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Συνεργάτης</TableCell>
                  <TableCell>Επίπεδο</TableCell>
                  <TableCell align="right">Συμβόλαια</TableCell>
                  <TableCell align="right">Μικτή</TableCell>
                  <TableCell align="right">Παρακράτηση</TableCell>
                  <TableCell align="right">Καθαρή</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.key} hover>
                    <TableCell><b>{r.producerName}</b></TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={r.level} sx={{ height: 20, fontSize: 11 }} /></TableCell>
                    <TableCell align="right">{r.policyCount}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(r.gross)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "warning.main" }}>{eur(r.taxWithholding)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main", fontWeight: 700 }}>{eur(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {totals && (
                <TableFooter>
                  <TableRow sx={{ "& td": { fontWeight: 800, borderTop: "2px solid", borderTopColor: "divider", color: "text.primary", fontSize: 14 } }}>
                    <TableCell colSpan={2}>Σύνολο</TableCell>
                    <TableCell align="right">{totals.policyCount}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.gross)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "warning.main" }}>{eur(totals.taxWithholding)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main" }}>{eur(totals.net)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </Card>
        </>
      )}
    </Box>
  );
}

function Kpi({ label, value, accent }: {
  label: string; value: string; accent?: "success" | "warning";
}) {
  const color = accent === "success" ? "success.main" : accent === "warning" ? "warning.main" : undefined;
  return (
    <Card sx={{ borderLeft: accent ? "4px solid" : undefined, borderLeftColor: color }}>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>{label}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
