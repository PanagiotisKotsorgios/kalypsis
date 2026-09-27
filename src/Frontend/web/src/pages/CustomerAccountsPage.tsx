import { useState } from "react";
import { Alert, Box, Card, Chip, CircularProgress, FormControlLabel, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface AccountRow {
  customerId: string; customerName: string; charges: number; credits: number;
  balance: number; overdueAmount: number; overdueCount: number;
  paidInstallments: number; latePayments: number; onTimeRatePercent: number;
}

/** Office-wide customer receivables view used for monthly follow-up calls. */
export function CustomerAccountsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyDebtors, setOnlyDebtors] = useState(true);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const q = useQuery({
    queryKey: ["customer-accounts", from, to, onlyDebtors, onlyOverdue],
    queryFn: async () => (await api.get<AccountRow[]>("/customers/accounts", { params: {
      from: from || undefined, to: to || undefined,
      onlyDebtors, onlyOverdue, onlyCreditors: false
    } })).data
  });
  const fmt = (n: number) => n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField size="small" type="date" label="Από μήνα/ημερομηνία" InputLabelProps={{ shrink: true }} value={from} onChange={e => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="Έως μήνα/ημερομηνία" InputLabelProps={{ shrink: true }} value={to} onChange={e => setTo(e.target.value)} />
          <FormControlLabel control={<Switch checked={onlyDebtors} onChange={e => setOnlyDebtors(e.target.checked)} />} label="Μόνο χρεωστικά υπόλοιπα" />
          <FormControlLabel control={<Switch checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} />} label="Μόνο ληξιπρόθεσμα" />
        </Stack>
      </Card>
      {q.isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>}
      {q.isError && <Alert severity="error">{extractErrorMessage(q.error)}</Alert>}
      {!q.isLoading && !q.isError && (q.data ?? []).length === 0 && <Alert severity="info">Δεν υπάρχουν οφειλές με τα επιλεγμένα φίλτρα.</Alert>}
      {(q.data ?? []).length > 0 && <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Πελάτης</TableCell><TableCell align="right">Χρεώσεις</TableCell><TableCell align="right">Εισπράξεις</TableCell><TableCell align="right">Υπόλοιπο</TableCell><TableCell align="right">Ληξιπρόθεσμα</TableCell><TableCell>Συνέπεια</TableCell></TableRow></TableHead>
          <TableBody>{(q.data ?? []).map(r => <TableRow key={r.customerId} hover sx={{ cursor: "pointer" }} onClick={() => { window.location.href = `/app/customers/${r.customerId}`; }}>
            <TableCell><Typography fontWeight={700}>{r.customerName}</Typography></TableCell>
            <TableCell align="right">{fmt(r.charges)} €</TableCell><TableCell align="right">{fmt(r.credits)} €</TableCell>
            <TableCell align="right" sx={{ color: r.balance > 0 ? "error.main" : "success.main", fontWeight: 800 }}>{fmt(r.balance)} €</TableCell>
            <TableCell align="right">{r.overdueAmount > 0 ? <Chip size="small" color="error" label={`${fmt(r.overdueAmount)} € · ${r.overdueCount}`} /> : "—"}</TableCell>
            <TableCell>{r.paidInstallments ? `${fmt(r.onTimeRatePercent)}%` : "—"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Card>}
    </Stack>
  );
}
