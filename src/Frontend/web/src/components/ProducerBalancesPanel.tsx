import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { ProfileEditableField, profileFieldGridSx } from "./profile/ProfileFieldEditor";

interface Balance { currency: string; earned: number; paid: number; toProducer: number; fromProducer: number }
interface Entry { id: string; date: string; kind: string; reference: string; policyNumber?: string | null; earned: number; paid: number; currency: string }
interface BalanceMonth { month: string; currency: string; openingBalance: number; earned: number; paid: number; closingBalance: number; entryCount: number }
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

function BalanceValue({ value, currency, highlight = false }: { value: number; currency: string; highlight?: boolean }) {
  return <Box sx={{ display: "inline-block", whiteSpace: "nowrap", borderRadius: 1, px: .75, py: .5,
    bgcolor: highlight && value > 0 ? "#D00000" : undefined, color: highlight && value > 0 ? "#fff" : "#102c55" }}>
    <Typography variant="body2" fontWeight={700}>{amount(Math.abs(value), currency)}</Typography>
    <Typography variant="caption" color="inherit">{value > 0 ? "Προς συνεργάτη" : value < 0 ? "Πιστωτικό" : "Μηδενικό υπόλοιπο"}</Typography>
  </Box>;
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

export function ProducerBalancesPanel({ producerId }: { producerId: string }) {
  const [currency, setCurrency] = useState("");
  const [page, setPage] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<BalanceMonth | null>(null);
  const q = useQuery({ queryKey: ["producer-balances", producerId], queryFn: async () => (await api.get<ProducerBalances>(`/producers/${producerId}/balances`)).data });
  const rows = (q.data?.monthly ?? []).filter(row => !currency || row.currency === currency);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  if (q.isLoading) return <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>;
  if (q.isError) return <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>;
  return <Stack gap={1} sx={{ minWidth: 0 }}>
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
      <Typography fontWeight={800}>Οφειλές & υπόλοιπα συνεργάτη ανά μήνα</Typography><Box sx={{ flex: 1 }} />
      {(q.data?.currencies.length ?? 0) > 1 && <TextField select size="small" label="Νόμισμα" value={currency} onChange={event => { setCurrency(event.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
        <MenuItem value="">Όλα</MenuItem>{q.data?.currencies.map(row => <MenuItem key={row.currency} value={row.currency}>{row.currency}</MenuItem>)}
      </TextField>}
    </Stack>
    <Typography variant="caption" color="text.secondary">Προμήθειες: μήνας έναρξης συμβολαίου. Καταβολές: μήνας πληρωμής. Το υπόλοιπο μεταφέρεται στους επόμενους μήνες, ξεχωριστά ανά νόμισμα.</Typography>
    <Box sx={{ overflowX: "auto", border: "1px solid #d5e0ec", borderRadius: 1.5 }}>
      <Table size="small" aria-label="Μηνιαία υπόλοιπα συνεργάτη" sx={{ ...tableSx, minWidth: 780 }}>
        <TableHead><TableRow><TableCell>Μήνας</TableCell><TableCell align="right">Εκ μεταφοράς</TableCell><TableCell align="right">Προμήθειες μήνα</TableCell><TableCell align="right">Καταβλήθηκαν μήνα</TableCell><TableCell align="right">Υπόλοιπο τέλους μήνα</TableCell><TableCell>Ανάλυση</TableCell></TableRow></TableHead>
        <TableBody>{rows.slice(visiblePage * 10, visiblePage * 10 + 10).map((row, index) => <TableRow key={row.month + row.currency} sx={{ bgcolor: index % 2 ? "#f0f2f5" : "#f8fafc" }}>
          <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>{monthLabel(row.month)}</TableCell>
          <TableCell align="right"><BalanceValue value={row.openingBalance} currency={row.currency} /></TableCell>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{amount(row.earned, row.currency)}</TableCell>
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{amount(row.paid, row.currency)}</TableCell>
          <TableCell align="right"><BalanceValue value={row.closingBalance} currency={row.currency} highlight /></TableCell>
          <TableCell><Button size="small" startIcon={<ReceiptLongIcon />} onClick={() => setSelectedMonth(row)} aria-label={`Κινήσεις ${monthLabel(row.month)} ${row.currency}`} sx={{ whiteSpace: "nowrap" }}>{row.entryCount} κινήσεις</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </Box>
    {!rows.length && <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες κινήσεις για αυτή την επιλογή.</Typography>}
    <TablePagination component="div" count={rows.length} page={visiblePage} onPageChange={(_, next) => setPage(next)} rowsPerPage={10} rowsPerPageOptions={[10]} getItemAriaLabel={type => type === "next" ? "Επόμενη σελίδα μηνών" : "Προηγούμενη σελίδα μηνών"} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count} μήνες / νομίσματα`} />
    <Typography fontWeight={800}>Σύνολα όλου του καταχωρημένου ιστορικού</Typography>
    <ProducerBalanceSummary currencies={(q.data?.currencies ?? []).filter(row => !currency || row.currency === currency)} />
    <Typography variant="caption" color="text.secondary">Οφειλές καταχωρημένων προμηθειών μετά τις πληρωμές. Το πιστωτικό από υπερπληρωμή είναι διαθέσιμο για συμψηφισμό. Ανεξάρτητες προκαταβολές και λοιποί διακανονισμοί δεν συμψηφίζονται αυτόματα εδώ.</Typography>
    <Dialog open={!!selectedMonth} onClose={() => setSelectedMonth(null)} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>Αναλυτικές οικονομικές κινήσεις · {selectedMonth && `${monthLabel(selectedMonth.month)} · ${selectedMonth.currency}`}</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: "#edf3f9", minWidth: 0 }}>
        {selectedMonth && <ProducerBalanceEntriesTable key={selectedMonth.month + selectedMonth.currency} entries={producerMonthEntries(q.data?.entries ?? [], selectedMonth)} />}
      </DialogContent>
      <DialogActions><Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={() => setSelectedMonth(null)}>Κλείσιμο</Button></DialogActions>
    </Dialog>
  </Stack>;
}
