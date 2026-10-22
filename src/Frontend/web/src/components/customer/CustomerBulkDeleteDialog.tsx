import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import type { CustomerDeletionResult, CustomerDeletionTarget } from "./customerBulkDelete";

export function CustomerBulkDeleteDialog({ targets, pending, completed, result, onConfirm, onClose }: {
  targets: CustomerDeletionTarget[] | null; pending: boolean; completed: number;
  result: CustomerDeletionResult | null; onConfirm: () => void; onClose: () => void;
}) {
  const count = targets?.length ?? 0;
  return <Dialog open={targets !== null} onClose={() => { if (!pending) onClose(); }} disableEscapeKeyDown={pending} fullWidth maxWidth="md" aria-labelledby="customer-bulk-delete-title">
    <DialogTitle id="customer-bulk-delete-title">{result ? "Αποτέλεσμα διαγραφής πελατών" : `Διαγραφή ${count} επιλεγμένων πελατών`}</DialogTitle>
    <DialogContent dividers sx={{ bgcolor: "#edf3f9" }}>
      <Stack spacing={1.5}>
        <Alert severity={result?.failures.length ? "warning" : "info"}>
          {result
            ? `Διαγράφηκαν ${result.deletedIds.length} από ${count} πελάτες. Δεν διαγράφηκαν ${result.failures.length}. Οι παρακάτω πελάτες παραμένουν στη λίστα και επιλεγμένοι.`
            : "Θα διαγραφούν μόνο οι επιλεγμένοι πελάτες χωρίς συσχετίσεις ή συνδεδεμένο ιστορικό. Πελάτες με συμβόλαια, εισπράξεις, επικοινωνίες ή άλλα συνδεδεμένα δεδομένα δεν θα διαγραφούν. Για αυτούς θα εμφανιστεί αναλυτική αιτία."}
        </Alert>
        {pending && <Stack spacing={.75} role="status" aria-live="polite"><Typography variant="body2">Έλεγχος και διαγραφή: {completed} / {count}</Typography><LinearProgress variant="determinate" value={count ? completed / count * 100 : 0} /></Stack>}
        <TableContainer sx={{ maxHeight: 320, overflow: "auto", border: "1px solid #c8d5e4", borderRadius: 1, bgcolor: "#f8fafc" }}>
          <Table size="small" stickyHeader aria-label={result ? "Πελάτες που δεν διαγράφηκαν" : "Επιλεγμένοι πελάτες για διαγραφή"}>
            <TableHead><TableRow><TableCell sx={{ bgcolor: "#e9eef4", fontWeight: 800 }}>Πελάτης</TableCell>{result && <TableCell sx={{ bgcolor: "#e9eef4", fontWeight: 800 }}>Αιτία μη διαγραφής</TableCell>}</TableRow></TableHead>
            <TableBody>{(result ? result.failures : targets ?? []).map(customer => <TableRow key={customer.id} sx={{ "&:nth-of-type(even)": { bgcolor: "#f0f2f5" } }}>
              <TableCell sx={{ verticalAlign: "top", overflowWrap: "anywhere" }}>{customer.label}</TableCell>
              {result && <TableCell sx={{ overflowWrap: "anywhere" }}>{"reason" in customer ? String(customer.reason) : ""}</TableCell>}
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ flexWrap: "wrap", gap: .75 }}>
      <Button variant="outlined" color="error" startIcon={<CloseIcon />} disabled={pending} onClick={onClose}>{result ? "Κλείσιμο" : "Άκυρο"}</Button>
      {!result && <Button variant="contained" color="error" startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />} disabled={pending || count === 0} onClick={onConfirm}>
        {pending ? "Γίνεται έλεγχος…" : `Διαγραφή ${count} πελατών`}
      </Button>}
    </DialogActions>
  </Dialog>;
}
