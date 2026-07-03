import { useMemo, useState } from "react";
import {
  Alert, Box, Card, Chip, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { money } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

interface MonthlyRow {
  year: number; month: number;
  policyPremiumBilled: number;
  receiptsCollected: number;
  commissionsPaidToProducers: number;
  outstanding: number;
  policyCount: number;
  receiptCount: number;
}

interface DashboardDto {
  year: number;
  yearPremiumBilled: number;
  yearReceiptsCollected: number;
  yearCommissionsPaid: number;
  yearOutstanding: number;
  months: MonthlyRow[];
}

const MONTH_LABEL = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"
];

/**
 * Monthly reconciliation dashboard for the AgencyAdmin. Shows the office's
 * premium billed vs receipts collected vs commissions paid for each month
 * of the selected year, with a red chip on months whose collections lag
 * behind billing by more than 5%.
 */
export function ReconciliationDashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const q = useQuery({
    queryKey: ["reconciliation-dashboard", year],
    queryFn: async () => (await api.get<DashboardDto>("/producer-reconciliation/dashboard", { params: { year } })).data
  });

  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 4; y--) out.push(y);
    return out;
  }, [now]);

  const data = q.data;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AssessmentIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Ταυτοποίηση Οικονομικών</Typography>
            <Typography color="text.secondary">
              Μηνιαία σύνοψη ασφαλίστρων, εισπράξεων και προμηθειών. Δείχνει πού
              υπάρχει καθυστέρηση εισπράξεων ή αποκλίσεις σε εκκαθαρίσεις.
            </Typography>
          </Box>
        </Stack>
        <SearchableTextField size="small" label="Έτος" value={String(year)}
          onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {yearOptions.map(y => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
        </SearchableTextField>
      </Stack>

      {q.isLoading || !data ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* Year-level grand totals */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
            <Kpi label="Ασφάλιστρα έτους" value={money(data.yearPremiumBilled)} />
            <Kpi label="Εισπράξεις έτους" value={money(data.yearReceiptsCollected)} accent="success" />
            <Kpi label="Προμήθειες συνεργατών" value={money(data.yearCommissionsPaid)} />
            <Kpi label="Εκκρεμείς εισπράξεις"
              value={money(data.yearOutstanding)}
              accent={data.yearOutstanding > 0 ? "warning" : "success"} />
          </Box>

          {data.yearPremiumBilled === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Δεν βρέθηκαν συμβόλαια για το επιλεγμένο έτος. Επιλέξτε άλλο έτος από πάνω.
            </Alert>
          )}

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Μήνας</TableCell>
                  <TableCell align="right">Συμβόλαια</TableCell>
                  <TableCell align="right">Ασφάλιστρα</TableCell>
                  <TableCell align="right">Εισπράξεις</TableCell>
                  <TableCell align="right">Εκκρεμείς</TableCell>
                  <TableCell align="right">Προμήθειες</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.months.map(m => {
                  const isCurrent = m.year === now.getFullYear() && m.month === now.getMonth() + 1;
                  const gap = m.policyPremiumBilled > 0
                    ? m.outstanding / m.policyPremiumBilled
                    : 0;
                  // Only flag months that are BEFORE the current month —
                  // the current month is likely partial and doesn't reflect
                  // an actual collection problem.
                  const isMonthClosed = m.year < now.getFullYear()
                    || (m.year === now.getFullYear() && m.month < now.getMonth() + 1);
                  const flagged = isMonthClosed && gap > 0.05 && m.policyPremiumBilled > 0;
                  return (
                    <TableRow key={m.month} hover
                      sx={{ bgcolor: isCurrent ? "rgba(30,167,225,0.06)" : undefined }}>
                      <TableCell>
                        <b>{MONTH_LABEL[m.month - 1]}</b>
                        {isCurrent && <Typography variant="caption" color="text.secondary"> · τρέχων</Typography>}
                      </TableCell>
                      <TableCell align="right">{m.policyCount}</TableCell>
                      <TableCell align="right">{money(m.policyPremiumBilled)}</TableCell>
                      <TableCell align="right" sx={{ color: "success.main", fontWeight: 600 }}>
                        {money(m.receiptsCollected)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: m.outstanding > 0 ? "warning.main" : "text.secondary" }}>
                        {money(m.outstanding)}
                      </TableCell>
                      <TableCell align="right">{money(m.commissionsPaidToProducers)}</TableCell>
                      <TableCell>
                        {m.policyPremiumBilled === 0 ? (
                          <Chip size="small" variant="outlined" label="—" />
                        ) : flagged ? (
                          <Chip size="small" color="warning"
                            label={`Καθυστέρηση ${(gap * 100).toFixed(0)}%`} sx={{ fontWeight: 700 }} />
                        ) : gap < 0.02 ? (
                          <Chip size="small" color="success" label="ΟΚ" sx={{ fontWeight: 700 }} />
                        ) : (
                          <Chip size="small" variant="outlined" label={`${(gap * 100).toFixed(0)}%`} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow sx={{ bgcolor: "background.default" }}>
                  <TableCell sx={{ fontWeight: 800 }}>Σύνολο έτους</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    {data.months.reduce((s, m) => s + m.policyCount, 0)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{money(data.yearPremiumBilled)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: "success.main" }}>
                    {money(data.yearReceiptsCollected)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: data.yearOutstanding > 0 ? "warning.main" : "text.secondary" }}>
                    {money(data.yearOutstanding)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{money(data.yearCommissionsPaid)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </Box>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "success" | "warning" }) {
  const color = accent === "success" ? "success.main" : accent === "warning" ? "warning.main" : "text.primary";
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
    </Card>
  );
}
