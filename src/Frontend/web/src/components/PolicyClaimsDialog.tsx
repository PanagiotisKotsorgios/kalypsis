import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { api, extractErrorMessage } from "../api/client";

export interface PolicyClaimSummary {
  id: string; claimNumber: string; incidentDate: string; reportedDate: string; status: string;
  claimedAmount: number | null; approvedAmount: number | null; currency: string;
  amounts: { currency: string; paid: number | null; reserve: number | null }[];
}
const statuses: Record<string, string> = { Reported: "Δηλωμένη", UnderReview: "Σε εξέταση", Approved: "Εγκεκριμένη", Rejected: "Απορρίφθηκε", Paid: "Αποζημιώθηκε", Closed: "Κλειστή" };
const money = (amount: number | null, currency: string) => amount == null ? "—" : amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value;
export function filterPolicyClaims(rows: PolicyClaimSummary[], search: string, status: string) {
  const needle = search.trim().toLocaleLowerCase("el-GR");
  return rows.filter(row => (!status || row.status === status) && (!needle || [row.claimNumber, statuses[row.status] ?? row.status, row.incidentDate, row.reportedDate, date(row.incidentDate), date(row.reportedDate)]
    .some(value => value.toLocaleLowerCase("el-GR").includes(needle))));
}
export function PolicyClaimsDialog({ policyId, open, onClose }: { policyId: string; open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState(""), [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["policy-claims-summary", policyId], enabled: open,
    queryFn: async () => (await api.get<PolicyClaimSummary[]>(`/policies/${policyId}/risk-profile/claims`)).data });
  const rows = filterPolicyClaims(q.data ?? [], search, status);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle>Ζημιές & αποζημιώσεις συμβολαίου</DialogTitle>
    <DialogContent dividers sx={{ bgcolor: "#edf3f9" }}><Stack spacing={1.25}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ pt: .75 }}>
        <TextField size="small" fullWidth label="Αναζήτηση φακέλου ή ημερομηνίας" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <TextField select size="small" label="Κατάσταση ζημιάς" value={status} sx={{ minWidth: 200 }} onChange={e => { setStatus(e.target.value); setPage(0); }}>
          <MenuItem value="">Όλες</MenuItem>{Object.entries(statuses).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
      </Stack>
      {q.isLoading && <CircularProgress size={24} />}
      {q.isError && <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>}
      <Box sx={{ overflowX: "auto" }}><Table size="small" sx={{ minWidth: 860, "& th": { bgcolor: "#e9eef4", fontWeight: 800 } }}><TableHead><TableRow>
        {["Φάκελος", "Συμβάν", "Δήλωση", "Κατάσταση", "Αιτούμενο", "Εγκεκριμένο", "Καταβληθείσες αποζημιώσεις", "Τελευταίο αποθεματικό"].map(label => <TableCell key={label}>{label}</TableCell>)}
      </TableRow></TableHead><TableBody>{rows.slice(visiblePage * 10, visiblePage * 10 + 10).map((row, index) => <TableRow key={row.id} sx={{ bgcolor: index % 2 ? "#f0f2f5" : "#f8fafc" }}>
        <TableCell sx={{ fontWeight: 750 }}>{row.claimNumber}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{date(row.incidentDate)}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{date(row.reportedDate)}</TableCell><TableCell>{statuses[row.status] ?? row.status}</TableCell>
        <TableCell>{money(row.claimedAmount, row.currency)}</TableCell><TableCell>{money(row.approvedAmount, row.currency)}</TableCell>
        <TableCell>{row.amounts.length ? row.amounts.map(amount => <Box key={amount.currency}>{money(amount.paid, amount.currency)}</Box>) : "—"}</TableCell>
        <TableCell>{row.amounts.length ? row.amounts.map(amount => <Box key={amount.currency}>{money(amount.reserve, amount.currency)}</Box>) : "—"}</TableCell>
      </TableRow>)}{!rows.length && !q.isLoading && !q.isError && <TableRow><TableCell colSpan={8}>Δεν υπάρχουν ζημιές για αυτή την επιλογή.</TableCell></TableRow>}</TableBody></Table></Box>
      <TablePagination component="div" count={rows.length} page={visiblePage} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, next) => setPage(next)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
    </Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={onClose}>Κλείσιμο</Button></DialogActions>
  </Dialog>;
}
