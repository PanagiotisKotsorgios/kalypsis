import { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface HistoryEntry { id: string; policyId: string; kind: string; date: string; number: string; policyNumber: string; company?: string | null; from?: string | null; to?: string | null; status: string; amount: number; currency: string; description?: string | null }
interface PolicyHistory { entries: HistoryEntry[]; incomplete: boolean }
const kinds: Record<string, string> = { Initial: "Αρχικό ασφαλιστήριο", Renewal: "Ανανέωση", Endorsement: "Πρόσθετη πράξη", Cancellation: "Ακύρωση" };
const statuses: Record<string, string> = { Active: "Ενεργό", Draft: "Πρόχειρο", Cancelled: "Ακυρωμένο", Expired: "Ληγμένο", Renewed: "Ανανεώθηκε", Undelivered: "Απαράδοτο", AwaitingIssue: "Προς έκδοση", PendingRenewal: "Προς ανανέωση", Prospect: "Πιθανό", Issued: "Εκδόθηκε", Requested: "Ζητήθηκε", Submitted: "Υποβλήθηκε", Effective: "Σε ισχύ", Approved: "Εγκρίθηκε", Rejected: "Απορρίφθηκε", Completed: "Ολοκληρώθηκε" };

export function PolicyHistoryTable({ rows, currentPolicyId }: { rows: HistoryEntry[]; currentPolicyId: string }) {
  return <Box sx={{ overflowX: "auto" }}><Table size="small">
    <TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Γεγονός</TableCell><TableCell>Αριθμός</TableCell><TableCell>Συμβόλαιο / εταιρεία</TableCell><TableCell>Ισχύς</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Ασφάλιστρο / μεταβολή</TableCell><TableCell>Περιγραφή</TableCell></TableRow></TableHead>
    <TableBody>{rows.map(row => <TableRow key={row.id} sx={row.policyId === currentPolicyId ? { bgcolor: "rgba(8,124,235,.06)" } : undefined}>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date}</TableCell><TableCell><Chip size="small" label={kinds[row.kind] ?? row.kind} color={row.kind === "Cancellation" ? "error" : row.kind === "Initial" ? "success" : "primary"} variant="outlined" /></TableCell>
      <TableCell>{row.number}</TableCell><TableCell>{row.policyNumber}<Typography variant="caption" display="block" color="text.secondary">{row.company}</Typography></TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{row.from || "—"}<Typography variant="caption" display="block">{row.to || "—"}</Typography></TableCell><TableCell>{statuses[row.status] ?? row.status}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{row.amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {row.currency}</TableCell><TableCell sx={{ minWidth: 160 }}>{row.description || "—"}</TableCell>
    </TableRow>)}</TableBody>
  </Table></Box>;
}

export function PolicyLifecyclePanel({ policyId }: { policyId: string }) {
  const [search, setSearch] = useState(""), [kind, setKind] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["policy-lifecycle", policyId], queryFn: async () => (await api.get<PolicyHistory>(`/policies/${policyId}/history`)).data });
  const filtered = useMemo(() => (q.data?.entries ?? []).filter(row => (!kind || row.kind === kind)
    && [row.number, row.policyNumber, row.company, row.description].some(value => (value ?? "").toLocaleLowerCase("el-GR").includes(search.trim().toLocaleLowerCase("el-GR")))), [q.data, search, kind]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 15) - 1));
  if (q.isLoading) return <Box sx={{ textAlign: "center", p: 2 }}><CircularProgress size={24} /></Box>;
  if (q.isError) return <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>;
  return <Stack gap={1}>
    <Typography fontWeight={800}>Ιστορικό συμβολαίου</Typography>
    <Typography variant="caption" color="text.secondary">Αρχικό ασφαλιστήριο, συνδεδεμένες ανανεώσεις, πρόσθετες πράξεις και ακυρώσεις όλης της αλυσίδας. Οι ακυρώσεις εμφανίζονται με αρνητικό ποσό επιστροφής.</Typography>
    {q.data?.incomplete && <Alert severity="warning">Μέρος της αλυσίδας δεν είναι διαθέσιμο ή χρειάζεται έλεγχο συσχέτισης. Εμφανίζονται μόνο οι προσβάσιμες καταχωρήσεις.</Alert>}
    <Stack direction="row" flexWrap="wrap" gap={1} sx={{ pt: .5 }}>
      <TextField size="small" label="Αναζήτηση στο ιστορικό" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} sx={{ flex: "1 1 240px" }} />
      <TextField select size="small" label="Γεγονός" value={kind} onChange={event => { setKind(event.target.value); setPage(0); }} sx={{ minWidth: 180 }}><MenuItem value="">Όλα</MenuItem>{Object.entries(kinds).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
    </Stack>
    <PolicyHistoryTable rows={filtered.slice(currentPage * 15, currentPage * 15 + 15)} currentPolicyId={policyId} />
    {!filtered.length && <Typography color="text.secondary">Δεν βρέθηκαν γεγονότα με αυτά τα φίλτρα.</Typography>}
    <TablePagination component="div" count={filtered.length} page={currentPage} onPageChange={(_, next) => setPage(next)} rowsPerPage={15} rowsPerPageOptions={[15]} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
  </Stack>;
}
