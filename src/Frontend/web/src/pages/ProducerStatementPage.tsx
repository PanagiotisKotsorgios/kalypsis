import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  TextField, Typography
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { SearchableSelect } from "../components/SearchableSelect";

interface StatementLine {
  policyId: string;
  policyNumber: string;
  customerName: string;
  carrierName: string;
  startDate: string;
  premium: number;
  level: string;
  percent: number;
  gross: number;
  taxWithholding: number;
  net: number;
}
interface ProducerStatementDto {
  producerId: string;
  producerName: string;
  from: string;
  to: string;
  lines: StatementLine[];
  grossTotal: number;
  taxWithholdingTotal: number;
  netTotal: number;
  amountPaid: number;
  amountOutstanding: number;
}
interface ProducerLite { id: string; name: string; }

const eur = (n: number) => `€${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Εκκαθαριστικό Συνεργάτη — pick a producer + period, get the per-policy
 * detail of what they earned plus how much has actually been paid out.
 * Print-friendly layout; a CSV download hands the accountant a spreadsheet.
 */
export function ProducerStatementPage() {
  const y = new Date().getFullYear();
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(`${y}-12-31`);
  const [producerId, setProducerId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const producers = useQuery({
    queryKey: ["producers", "lite"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data,
  });

  const params = useMemo(() => ({ from, to }), [from, to]);

  const report = useQuery({
    enabled: !!producerId,
    queryKey: ["reports-producer-statement", producerId, params],
    queryFn: async () =>
      (await api.get<ProducerStatementDto>(`/reports/producer-statement/${producerId}`, { params })).data,
  });

  const downloadCsv = async () => {
    const res = await api.get<Blob>(`/reports/producer-statement/${producerId}/export.csv`,
      { params, responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(res.data);
    a.download = `ekkatharistiko-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const data = report.data;
  const filteredLines = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return data.lines;
    return data.lines.filter(l => {
      const hay = `${l.policyNumber} ${l.customerName} ${l.carrierName} ${l.level}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [data, search]);
  useEffect(() => { setPage(0); }, [search, producerId, from, to]);
  const pagedLines = filteredLines.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <ReceiptLongIcon />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Εκκαθαριστικό Συνεργάτη</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Λεπτομερής κατάσταση για κάθε συνεργάτη — συμβόλαια, δεδουλευμένα, παρακρατήσεις,
        πληρωμές και υπόλοιπο.
      </Typography>

      {/* Filter card — search across policy lines is client-side because
          the statement fits comfortably in memory. Layout matches the
          rest of the app so operators see the same controls in the same
          spots. */}
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "start",
        }}>
          <SearchableSelect label="Συνεργάτης" value={producerId} onChange={setProducerId}
            emptyLabel="— Επιλέξτε —" sx={{ width: "100%" }}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))} />
          <TextField label="Από" type="date" size="small" fullWidth
            value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Έως" type="date" size="small" fullWidth
            value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" placeholder="Αναζήτηση: συμβόλαιο, πελάτης, εταιρεία…" fullWidth
            value={search} onChange={e => setSearch(e.target.value)} />
        </Box>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={() => {
            setFrom(`${y}-01-01`); setTo(`${y}-12-31`); setProducerId(""); setSearch("");
          }} color="error" variant="contained">Καθαρισμός φίλτρων</Button>
          <Button size="small" variant="contained" startIcon={<DownloadIcon />}
            disabled={!producerId || !data?.lines.length} onClick={downloadCsv}>Εξαγωγή CSV</Button>
        </Stack>
      </Card>

      {!producerId ? (
        <Alert severity="info">Επιλέξτε συνεργάτη για να δείτε την κατάσταση.</Alert>
      ) : report.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : !data ? (
        <Alert severity="error">Δεν φορτώθηκε η κατάσταση.</Alert>
      ) : data.lines.length === 0 ? (
        <Alert severity="info">
          Δεν βρέθηκαν εγγραφές προμηθειών για τον συνεργάτη στο επιλεγμένο διάστημα.
        </Alert>
      ) : (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{data.producerName}</Typography>
              <Typography variant="body2" color="text.secondary">
                Διάστημα: {data.from} — {data.to}
              </Typography>
            </CardContent>
          </Card>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, mb: 2 }}>
            <Kpi label="Μικτή" value={eur(data.grossTotal)} />
            <Kpi label="Παρακράτηση φόρου" value={eur(data.taxWithholdingTotal)} accent="warning" />
            <Kpi label="Καθαρή" value={eur(data.netTotal)} accent="success" />
            <Kpi label="Πληρωθέν" value={eur(data.amountPaid)} />
            <Kpi label="Υπόλοιπο" value={eur(data.amountOutstanding)}
              accent={data.amountOutstanding > 0 ? "danger" : "success"} />
          </Box>

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Συμβόλαιο</TableCell>
                  <TableCell>Πελάτης</TableCell>
                  <TableCell>Εταιρεία</TableCell>
                  <TableCell>Έναρξη</TableCell>
                  <TableCell align="right">Ασφάλιστρο</TableCell>
                  <TableCell>Επίπεδο</TableCell>
                  <TableCell align="right">%</TableCell>
                  <TableCell align="right">Μικτή</TableCell>
                  <TableCell align="right">Παρακράτηση</TableCell>
                  <TableCell align="right">Καθαρή</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedLines.map((l, i) => (
                  <TableRow key={`${l.policyId}-${l.level}-${i}`} hover>
                    <TableCell sx={{ fontFamily: "monospace" }}>{l.policyNumber}</TableCell>
                    <TableCell>{l.customerName}</TableCell>
                    <TableCell>{l.carrierName}</TableCell>
                    <TableCell>{l.startDate}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(l.premium)}</TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={l.level} sx={{ height: 20, fontSize: 11 }} /></TableCell>
                    <TableCell align="right">{l.percent.toFixed(2)}%</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(l.gross)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "warning.main" }}>{eur(l.taxWithholding)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main", fontWeight: 700 }}>{eur(l.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredLines.length}
              page={page}
              onPageChange={(_e, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={ev => { setRowsPerPage(parseInt(ev.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100, 250]}
              labelRowsPerPage="Ανά σελίδα"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
            />
            <Divider />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
              <Typography variant="body2">Μικτή προμήθεια: <b>{eur(data.grossTotal)}</b></Typography>
              <Typography variant="body2">Παρακράτηση: <b>{eur(data.taxWithholdingTotal)}</b></Typography>
              <Typography variant="body2">Καθαρή: <b>{eur(data.netTotal)}</b></Typography>
              <Typography variant="body2">Πληρωθέν: <b>{eur(data.amountPaid)}</b></Typography>
              <Typography variant="h6" sx={{ mt: 1, color: data.amountOutstanding > 0 ? "error.main" : "success.main" }}>
                Υπόλοιπο: {eur(data.amountOutstanding)}
              </Typography>
            </Box>
          </Card>
        </>
      )}
    </Box>
  );
}

function Kpi({ label, value, accent }: {
  label: string; value: string; accent?: "success" | "danger" | "warning";
}) {
  const color = accent === "success" ? "success.main"
    : accent === "danger" ? "error.main"
    : accent === "warning" ? "warning.main"
    : undefined;
  return (
    <Card sx={{ borderLeft: accent ? "4px solid" : undefined, borderLeftColor: color }}>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>{label}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
