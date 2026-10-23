import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { dateTime } from "../utils/format";
import { AuditFieldChanges } from "./audit/AuditFieldChanges";
import type { AuditFieldChange } from "./audit/auditValues";
import { ClaimListFilters, ClaimListTableFrame } from "./ClaimListLayout";

interface AuditRow { id: string; action: string; createdAt: string; userDisplayName?: string | null; userEmail?: string | null; category?: string | null; changes?: AuditFieldChange[] }
const actions: Record<string, string> = { Create: "Δημιουργία", Update: "Ενημέρωση", Delete: "Διαγραφή", Renewed: "Ανανέωση", Cancelled: "Ακύρωση" };

export function EntityAuditTable({ entityName, entityId }: { entityName: string; entityId: string }) {
  const [search, setSearch] = useState(""), [action, setAction] = useState(""), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const q = useQuery({ queryKey: ["entity-audit-table", entityName, entityId, page, search, action], enabled: !!entityId,
    queryFn: async () => (await api.get<{ items: AuditRow[]; totalCount: number }>(`/audit-logs/entity/${encodeURIComponent(entityName)}/${encodeURIComponent(entityId)}`, { params: { page: page + 1, pageSize: 15, search: search || undefined, action: action || undefined } })).data });
  return <Stack gap={1}>
    <ClaimListFilters title="Φίλτρα ιστορικού" desktopColumns={2} savedFilters={null}>
      <TextField size="small" label="Αναζήτηση στο ιστορικό" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <TextField select size="small" label="Ενέργεια" value={action} onChange={e => { setAction(e.target.value); setPage(0); }}><MenuItem value="">Όλες</MenuItem>{Object.entries(actions).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
    </ClaimListFilters>
    {q.isError ? <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>Δεν ήταν δυνατή η φόρτωση του ιστορικού.</Alert> :
      q.isLoading ? <Box sx={{ textAlign: "center", p: 2 }}><CircularProgress size={24} /></Box> :
      <ClaimListTableFrame label="Ιστορικό μεταβολών" minWidth={570} pagination={<TablePagination component="div" page={page} count={q.data?.totalCount ?? 0} rowsPerPage={15} rowsPerPageOptions={[15]} onPageChange={(_, next) => setPage(next)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />}>
        <Table size="small" stickyHeader><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Ενέργεια</TableCell><TableCell>Χρήστης</TableCell><TableCell>Πεδία</TableCell><TableCell align="right">Λεπτομέρειες</TableCell></TableRow></TableHead>
          <TableBody>{(q.data?.items ?? []).map(row => <TableRow key={row.id}><TableCell sx={{ whiteSpace: "nowrap" }}>{dateTime(row.createdAt)}</TableCell><TableCell>{actions[row.action] ?? row.action}</TableCell><TableCell>{row.userDisplayName || row.userEmail || "Σύστημα"}</TableCell><TableCell>{row.changes?.length ?? "—"}</TableCell><TableCell align="right"><Button size="small" variant="contained" color="success" sx={{ color: "#fff", whiteSpace: "nowrap" }} startIcon={<VisibilityOutlinedIcon />} onClick={() => setSelected(row)}>Λεπτομέρειες</Button></TableCell></TableRow>)}
          {!q.data?.items.length && <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Δεν βρέθηκαν καταχωρήσεις.</Typography></TableCell></TableRow>}</TableBody></Table>
      </ClaimListTableFrame>}
    <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="md" sx={{ zIndex: 1900 }}><DialogTitle>Λεπτομέρειες μεταβολής</DialogTitle><DialogContent dividers>{selected && <><Typography>{actions[selected.action] ?? selected.action} · {dateTime(selected.createdAt)}</Typography><AuditFieldChanges changes={selected.changes} /></>}</DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setSelected(null)}>Κλείσιμο</Button></DialogActions></Dialog>
  </Stack>;
}
