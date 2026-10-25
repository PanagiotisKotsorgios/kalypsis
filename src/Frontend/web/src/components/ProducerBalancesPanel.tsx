import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableFooter, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useQuery } from "@tanstack/react-query";
import { PartyLedgerDialog } from "./PartyLedgerDialog";
import { api, extractErrorMessage } from "../api/client";
import { ProfileEditableField, profileFieldGridSx } from "./profile/ProfileFieldEditor";

interface Balance { currency: string; earned: number; paid: number; toProducer: number; fromProducer: number }
interface Entry { id: string; date: string; kind: string; reference: string; policyNumber?: string | null; earned: number; paid: number; currency: string }
interface BalanceMonth { month: string; currency: string; earned: number; paid: number; entryCount: number; balance?: number }
interface ProducerBalances { producerId: string; currencies: Balance[]; entries: Entry[]; monthly: BalanceMonth[] }
const amount = (value: number, currency: string) => value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
const monthLabel = (value: string) => new Date(value.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("el-GR", { month: "long", year: "numeric", timeZone: "UTC" });
const dateLabel = (value: string) => new Date(value.slice(0, 10) + "T00:00:00Z").toLocaleDateString("el-GR", { timeZone: "UTC" });
const tableSx = { "& th": { bgcolor: "#e9eef4", color: "#102c55", fontWeight: 800 }, "& td, & th": { borderColor: "#dfe5ed" } };

export function ProducerDebtField({ value, currency }: { value: number; currency: string }) {
  return <Box data-producer-debt={value > 0 ? "outstanding" : "settled"} sx={value > 0 ? {
    "& [role=button]": { bgcolor: "#D00000 !important", borderColor: "#AD0000 !important", "&:hover": { bgcolor: "#AD0000 !important" } },
    "& [role=button] .MuiTypography-root": { color: "#fff !important" },
    "& [role=button] .MuiIconButton-root": { color: "#fff !important", bgcolor: "#AD0000 !important", borderColor: "#870000 !important", "&:hover": { bgcolor: "#870000 !important" } },
  } : undefined}><ProfileEditableField label="Οφειλή προς συνεργάτη" value={amount(value, currency)} mono /></Box>;
}

export function ProducerBalanceSummary({ currencies }: { currencies: Balance[] }) {
  return <Stack gap={.75}>{currencies.map(balance => <Box key={balance.currency} sx={{ ...profileFieldGridSx,
    gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
    <Stack spacing={.5} sx={{ minWidth: 0 }}>
      <ProfileEditableField label="Συνολικές προμήθειες" value={amount(balance.earned, balance.currency)} mono />
      <ProfileEditableField label="Συνολικά καταβλήθηκαν" value={amount(balance.paid, balance.currency)} mono />
    </Stack><Stack spacing={.5} sx={{ minWidth: 0 }}>
      <ProducerDebtField value={balance.toProducer} currency={balance.currency} />
      <ProfileEditableField label="Πιστωτικό προς συμψηφισμό" value={amount(balance.fromProducer, balance.currency)} mono />
    </Stack>
  </Box>)}</Stack>;
}

export function ProducerBalanceEntriesTable({ entries }: { entries: Entry[] }) {
  const [page, setPage] = useState(0);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(entries.length / 10) - 1));
  return <Stack gap={1}>
    <Box sx={{ overflowX: "auto" }}><Table size="small" aria-label="Αναλυτικές οικονομικές κινήσεις μήνα" sx={tableSx}>
      <TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Κίνηση</TableCell><TableCell>Αριθμός</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell align="right">Προμήθεια</TableCell><TableCell align="right">Πληρωμή</TableCell></TableRow></TableHead>
      <TableBody>{entries.slice(visiblePage * 10, visiblePage * 10 + 10).map((row, index) => <TableRow key={row.id} sx={{ bgcolor: index % 2 ? "#f0f2f5" : "#f8fafc" }}>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{dateLabel(row.date)}</TableCell><TableCell>{row.kind === "Commission" ? "Προμήθεια" : "Πληρωμή"}</TableCell><TableCell>{row.reference}</TableCell><TableCell>{row.policyNumber || "—"}</TableCell>
        <TableCell align="right">{row.kind === "Commission" ? amount(row.earned, row.currency) : "—"}</TableCell><TableCell align="right">{row.kind === "Payment" ? amount(row.paid, row.currency) : "—"}</TableCell>
      </TableRow>)}</TableBody>
    </Table></Box>
    {!entries.length && <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες κινήσεις για αυτή την επιλογή.</Typography>}
    <TablePagination component="div" count={entries.length} page={visiblePage} onPageChange={(_, next) => setPage(next)} rowsPerPage={10} rowsPerPageOptions={[10]} getItemAriaLabel={type => type === "next" ? "Επόμενη σελίδα" : "Προηγούμενη σελίδα"} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
  </Stack>;
}

export function producerMonthEntries(entries: Entry[], month: BalanceMonth) {
  return entries.filter(row => row.currency === month.currency && row.date.slice(0, 7) === month.month.slice(0, 7));
}

export function producerMonthMovementBalance(month: Pick<BalanceMonth, "earned" | "paid" | "balance">) {
  // Prefer server decimal arithmetic; tolerate cached responses from before this field existed.
  const value = month.balance ?? Number((month.earned - month.paid).toFixed(2));
  return value === 0 ? 0 : value;
}

export function ProducerMonthBalance({ value, currency }: { value: number; currency: string }) {
  return <Box component="span" data-month-balance={value > 0 ? "positive" : value < 0 ? "negative" : "zero"}
    sx={{ display: "inline-flex", alignItems: "center", minHeight: 24, px: .75, py: .15, borderRadius: .75, whiteSpace: "nowrap", fontWeight: 800,
      bgcolor: value > 0 ? "#D00000" : value < 0 ? "#E5EFFB" : "#E4F2E8", color: value > 0 ? "#fff" : value < 0 ? "#0B5CAD" : "#246B40" }}>
    {amount(value, currency)}
  </Box>;
}

export function ProducerBalancesPanel({ producerId }: { producerId: string }) {
  const [currency, setCurrency] = useState("");
  const [page, setPage] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<BalanceMonth | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const q = useQuery({ queryKey: ["producer-balances", producerId], queryFn: async () => (await api.get<ProducerBalances>(`/producers/${producerId}/balances`)).data,
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 30_000 });
  const rows = (q.data?.monthly ?? []).filter(row => !currency || row.currency === currency);
  const totals = (q.data?.currencies ?? []).filter(row => !currency || row.currency === currency);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  if (q.isLoading) return <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>;
  if (q.isError) return <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>;
  return <Stack gap={1} sx={{ minWidth: 0 }}>
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
      <Typography fontWeight={800}>Προμήθειες συνεργάτη ανά μήνα</Typography><Box sx={{ flex: 1 }} />
      <Button size="small" variant="outlined" onClick={() => setLedgerOpen(true)}>Καθολικό συνεργάτη</Button>
      {(q.data?.currencies.length ?? 0) > 1 && <TextField select size="small" label="Νόμισμα" value={currency} onChange={event => { setCurrency(event.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
        <MenuItem value="">Όλα</MenuItem>{q.data?.currencies.map(row => <MenuItem key={row.currency} value={row.currency}>{row.currency}</MenuItem>)}
      </TextField>}
    </Stack>
    <Box sx={{ overflowX: "auto", border: "1px solid #d5e0ec", borderRadius: 1.5 }}>
      <Table size="small" aria-label="Μηνιαίες προμήθειες συνεργάτη" sx={{ ...tableSx, minWidth: 740, "& td": { py: .45, px: 1, lineHeight: 1.3 }, "& th": { ...tableSx["& th"], py: .7, px: 1, lineHeight: 1.3 } }}>
        <TableHead><TableRow><TableCell>Μήνας</TableCell><TableCell align="right">Προμήθειες συμβολαίων μήνα</TableCell><TableCell align="right">Καταβολές μέσα στον μήνα</TableCell><TableCell align="right">Υπόλοιπο κινήσεων μήνα</TableCell><TableCell>Ανάλυση</TableCell></TableRow></TableHead>
        <TableBody>{rows.slice(visiblePage * 10, visiblePage * 10 + 10).map((row, index) => <TableRow key={row.month + row.currency} sx={{ bgcolor: index % 2 ? "#f0f2f5" : "#f8fafc" }}>
          <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>{monthLabel(row.month)}</TableCell>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{amount(row.earned, row.currency)}</TableCell>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{amount(row.paid, row.currency)}</TableCell>
          <TableCell align="right"><ProducerMonthBalance value={producerMonthMovementBalance(row)} currency={row.currency} /></TableCell>
          <TableCell><Button size="small" variant="contained" startIcon={<ReceiptLongIcon />} onClick={() => setSelectedMonth(row)} aria-label={`Κινήσεις ${monthLabel(row.month)} ${row.currency}`}
            sx={{ whiteSpace: "nowrap", minHeight: 28, py: .25, bgcolor: "#159B59", color: "#fff", "&:hover": { bgcolor: "#107B46", color: "#fff" } }}>{row.entryCount} {row.entryCount === 1 ? "κίνηση" : "κινήσεις"}</Button></TableCell>
        </TableRow>)}</TableBody>
        <TableFooter>{totals.map(total => <TableRow key={total.currency} sx={{ bgcolor: "#e8f5e9", "& td": { fontWeight: 800, color: "#102c55", borderTop: "2px solid #b4d7bf", fontSize: 13 } }}>
          <TableCell>Σύνολα {total.currency} · όλοι οι μήνες</TableCell>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{amount(total.earned, total.currency)}</TableCell>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{amount(total.paid, total.currency)}</TableCell>
          <TableCell align="right"><ProducerMonthBalance value={total.toProducer - total.fromProducer} currency={total.currency} /></TableCell><TableCell />
        </TableRow>)}</TableFooter>
      </Table>
    </Box>
    {!rows.length && <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες κινήσεις για αυτή την επιλογή.</Typography>}
    <TablePagination component="div" count={rows.length} page={visiblePage} onPageChange={(_, next) => setPage(next)} rowsPerPage={10} rowsPerPageOptions={[10]} getItemAriaLabel={type => type === "next" ? "Επόμενη σελίδα μηνών" : "Προηγούμενη σελίδα μηνών"} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count} μήνες / νομίσματα`} />
    <Typography fontWeight={800}>Σύνολα όλου του καταχωρημένου ιστορικού</Typography>
    <ProducerBalanceSummary currencies={totals} />
    <Dialog open={!!selectedMonth} onClose={() => setSelectedMonth(null)} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>Αναλυτικές οικονομικές κινήσεις · {selectedMonth && `${monthLabel(selectedMonth.month)} · ${selectedMonth.currency}`}</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "#edf3f9", minWidth: 0 }}>
        {selectedMonth && <ProducerBalanceEntriesTable key={selectedMonth.month + selectedMonth.currency} entries={producerMonthEntries(q.data?.entries ?? [], selectedMonth)} />}
      </DialogContent>
      <DialogActions><Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={() => setSelectedMonth(null)}>Κλείσιμο</Button></DialogActions>
    </Dialog>
    <PartyLedgerDialog open={ledgerOpen} onClose={() => setLedgerOpen(false)} partyKind="Producer"
      partyId={producerId} partyName="Συνεργάτης" />
  </Stack>;
}
