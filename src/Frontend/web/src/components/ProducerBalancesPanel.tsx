import { useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { ProfileEditableField, profileFieldGridSx } from "./profile/ProfileFieldEditor";

interface Balance { currency: string; earned: number; paid: number; toProducer: number; fromProducer: number }
interface Entry { id: string; date: string; kind: string; reference: string; policyNumber?: string | null; earned: number; paid: number; currency: string }
interface ProducerBalances { producerId: string; currencies: Balance[]; entries: Entry[] }
const amount = (value: number, currency: string) => value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;

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
      <ProfileEditableField label="Προμήθειες" value={amount(balance.earned, balance.currency)} mono />
      <ProfileEditableField label="Καταβλήθηκαν" value={amount(balance.paid, balance.currency)} mono />
    </Stack><Stack spacing={.5} sx={{ minWidth: 0 }}>
      <ProducerDebtField value={balance.toProducer} currency={balance.currency} />
      <ProfileEditableField label="Από συνεργάτη / πιστωτικό" value={amount(balance.fromProducer, balance.currency)} mono />
    </Stack>
  </Box>)}</Stack>;
}

export function ProducerBalancesPanel({ producerId }: { producerId: string }) {
  const [currency, setCurrency] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["producer-balances", producerId], queryFn: async () => (await api.get<ProducerBalances>(`/producers/${producerId}/balances`)).data });
  const rows = (q.data?.entries ?? []).filter(row => !currency || row.currency === currency);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  if (q.isLoading) return <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>;
  if (q.isError) return <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>;
  return <Stack gap={1}>
    <Typography fontWeight={800}>Οφειλές & υπόλοιπα συνεργάτη</Typography>
    <ProducerBalanceSummary currencies={q.data?.currencies ?? []} />
    <Typography variant="caption" color="text.secondary">Οφειλές καταχωρημένων προμηθειών μετά τις πληρωμές. Το πιστωτικό από υπερπληρωμή είναι διαθέσιμο για συμψηφισμό. Ανεξάρτητες προκαταβολές και λοιποί διακανονισμοί δεν συμψηφίζονται αυτόματα εδώ.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ pt: .5 }}>
      <Typography fontWeight={800}>Αναλυτικές οικονομικές κινήσεις</Typography><Box sx={{ flex: 1 }} />
      {(q.data?.currencies.length ?? 0) > 1 && <TextField select size="small" label="Νόμισμα κινήσεων" value={currency} onChange={event => { setCurrency(event.target.value); setPage(0); }} sx={{ minWidth: 170 }}>
        <MenuItem value="">Όλα</MenuItem>{q.data?.currencies.map(row => <MenuItem key={row.currency} value={row.currency}>{row.currency}</MenuItem>)}
      </TextField>}
    </Stack>
    <Box sx={{ overflowX: "auto" }}><Table size="small" sx={{ "& th": { bgcolor: "#e9eef4", color: "#102c55", fontWeight: 800 } }}>
      <TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Κίνηση</TableCell><TableCell>Αριθμός</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell align="right">Προμήθεια</TableCell><TableCell align="right">Πληρωμή</TableCell></TableRow></TableHead>
      <TableBody>{rows.slice(visiblePage * 10, visiblePage * 10 + 10).map((row, index) => <TableRow key={row.id} sx={{ bgcolor: index % 2 ? "#f0f2f5" : "#f8fafc" }}>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date}</TableCell><TableCell>{row.kind === "Commission" ? "Προμήθεια" : "Πληρωμή"}</TableCell><TableCell>{row.reference}</TableCell><TableCell>{row.policyNumber || "—"}</TableCell>
        <TableCell align="right">{row.kind === "Commission" ? amount(row.earned, row.currency) : "—"}</TableCell><TableCell align="right">{row.kind === "Payment" ? amount(row.paid, row.currency) : "—"}</TableCell>
      </TableRow>)}</TableBody>
    </Table></Box>
    {!rows.length && <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες κινήσεις για αυτή την επιλογή.</Typography>}
    <TablePagination component="div" count={rows.length} page={visiblePage} onPageChange={(_, next) => setPage(next)} rowsPerPage={10} rowsPerPageOptions={[10]} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
  </Stack>;
}
