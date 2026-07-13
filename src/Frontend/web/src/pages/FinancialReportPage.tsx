import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Table, TableBody,
  TableCell, TableFooter, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface FinancialMonthRow {
  month: string;
  receiptsIn: number;
  paymentsToCarriers: number;
  paymentsToProducers: number;
  commissionsEarned: number;
  netCash: number;
}
interface FinancialReportDto {
  months: FinancialMonthRow[];
  totals: FinancialMonthRow;
  openCustomerReceivables: number;
  openCarrierPayables: number;
  from: string;
  to: string;
}

const eur = (n: number) => `€${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Οικονομικά — cash-in vs cash-out per month, plus the running open balances.
 * Powers "πώς πήγε το ταμείο φέτος" without the operator digging through
 * individual receipts and payments.
 */
export function FinancialReportPage() {
  const y = new Date().getFullYear();
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(`${y}-12-31`);

  const params = useMemo(() => ({ from, to }), [from, to]);

  const report = useQuery({
    queryKey: ["reports-financials", params],
    queryFn: async () => (await api.get<FinancialReportDto>("/reports/financials", { params })).data,
  });

  const downloadCsv = async () => {
    const res = await api.get<Blob>("/reports/financials/export.csv",
      { params, responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(res.data);
    a.download = `oikonomika-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const months = report.data?.months ?? [];
  const totals = report.data?.totals;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <AccountBalanceIcon />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Οικονομικά Γραφείου</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Εισπράξεις, πληρωμές σε εταιρείες/συνεργάτες και αναγνωρισμένη προμήθεια ανά μήνα.
        Κάτω-κάτω βλέπετε τι απομένει ανοιχτό σε πελάτες και εταιρείες.
      </Typography>

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
          alignItems: "start",
        }}>
          <TextField label="Από" type="date" size="small" fullWidth
            value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Έως" type="date" size="small" fullWidth
            value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Box>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={() => { setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }}>
            Καθαρισμός
          </Button>
          <Button size="small" variant="contained" startIcon={<DownloadIcon />}
            disabled={!months.length} onClick={downloadCsv}>Εξαγωγή CSV</Button>
        </Stack>
      </Card>

      {report.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : !report.data ? (
        <Alert severity="error">Δεν φορτώθηκε το report — δοκιμάστε ξανά.</Alert>
      ) : (
        <>
          {/* KPI strip — the four numbers a broker actually cares about. */}
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 2 }}>
            <Kpi label="Εισπράξεις (πελάτες)" value={eur(totals?.receiptsIn ?? 0)} accent="success" />
            <Kpi label="Πληρωμές σε εταιρείες" value={eur(totals?.paymentsToCarriers ?? 0)} accent="danger" />
            <Kpi label="Πληρωμές σε συνεργάτες" value={eur(totals?.paymentsToProducers ?? 0)} accent="danger" />
            <Kpi label="Καθαρή ταμειακή ροή" value={eur(totals?.netCash ?? 0)}
              accent={(totals?.netCash ?? 0) >= 0 ? "success" : "danger"} />
          </Box>

          {/* Bar chart: three stacked series per month lets the operator eye
              cash-in vs cash-out on a single canvas without a spreadsheet. */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Μηνιαία κίνηση</Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={months}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                    <XAxis dataKey="month" stroke="#456079" fontSize={12} />
                    <YAxis stroke="#456079" fontSize={12} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(v) => eur(Number(v))} />
                    <Legend />
                    <Bar dataKey="receiptsIn" name="Εισπράξεις" fill="#2e7d32" />
                    <Bar dataKey="paymentsToCarriers" name="Πληρωμές εταιρειών" fill="#c62828" />
                    <Bar dataKey="paymentsToProducers" name="Πληρωμές συνεργατών" fill="#ef6c00" />
                    <Bar dataKey="commissionsEarned" name="Προμήθειες γραφείου" fill="#1565c0" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Open balances live in their own card so the eye lands on them
              — these are the numbers the accountant asks for first. */}
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, mb: 3 }}>
            <BalanceCard title="Ανοικτές απαιτήσεις πελατών"
              value={report.data.openCustomerReceivables}
              hint="Χρεώσεις σε πελάτες μείον τα πιστωτικά, στο διάστημα του report."
              positive="warning" />
            <BalanceCard title="Ανοικτές υποχρεώσεις προς εταιρείες"
              value={report.data.openCarrierPayables}
              hint="Χρεώσεις εταιρειών μείον τα πιστωτικά, στο διάστημα του report."
              positive="danger" />
          </Box>

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Μήνας</TableCell>
                  <TableCell align="right">Εισπράξεις</TableCell>
                  <TableCell align="right">Πληρωμές εταιρειών</TableCell>
                  <TableCell align="right">Πληρωμές συνεργατών</TableCell>
                  <TableCell align="right">Προμήθειες γραφείου</TableCell>
                  <TableCell align="right">Καθαρό ταμείο</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {months.map(m => (
                  <TableRow key={m.month} hover>
                    <TableCell><b>{m.month}</b></TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main" }}>{eur(m.receiptsIn)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "error.main" }}>{eur(m.paymentsToCarriers)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "error.main" }}>{eur(m.paymentsToProducers)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(m.commissionsEarned)}</TableCell>
                    <TableCell align="right" sx={{
                      fontFamily: "monospace", fontWeight: 700,
                      color: m.netCash >= 0 ? "success.main" : "error.main"
                    }}>{eur(m.netCash)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {totals && (
                <TableFooter>
                  <TableRow sx={{ "& td": { fontWeight: 800, borderTop: "2px solid", borderTopColor: "divider", color: "text.primary", fontSize: 14 } }}>
                    <TableCell>Σύνολο</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.receiptsIn)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.paymentsToCarriers)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.paymentsToProducers)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.commissionsEarned)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.netCash)}</TableCell>
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
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function BalanceCard({ title, value, hint, positive }: {
  title: string; value: number; hint: string; positive: "warning" | "danger";
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>{title}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color: value > 0 ? (positive === "warning" ? "warning.main" : "error.main") : "text.primary" }}>
          {eur(value)}
        </Typography>
        <Typography variant="caption" color="text.secondary">{hint}</Typography>
      </CardContent>
    </Card>
  );
}
