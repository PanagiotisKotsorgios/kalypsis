import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import type { DeletionResult, DeletionTarget } from "../utils/bulkDeletion";

export function BulkDeleteDialog({ targets, pending, completed, result, onConfirm, onClose, entity = "customers" }: {
  targets: DeletionTarget[] | null; pending: boolean; completed: number; entity?: "customers" | "vehicles";
  result: DeletionResult | null; onConfirm: () => void; onClose: () => void;
}) {
  const count = targets?.length ?? 0;
  const vehicle = entity === "vehicles";
  const plural = vehicle ? "οχήματα" : "πελάτες";
  const genitive = vehicle ? "οχημάτων" : "πελατών";
  const titleId = `${entity}-bulk-delete-title`;
  return <Dialog open={targets !== null} onClose={() => { if (!pending) onClose(); }} disableEscapeKeyDown={pending} fullWidth maxWidth="md" aria-labelledby={titleId}>
    <DialogTitle id={titleId}>{result ? `Αποτέλεσμα διαγραφής ${genitive}` : `Διαγραφή ${count} επιλεγμένων ${genitive}`}</DialogTitle>
    <DialogContent dividers sx={{ bgcolor: "#edf3f9" }}>
      <Stack spacing={1.5}>
        <Alert severity={result?.failures.length ? "warning" : "info"}>
          {result
            ? `Διαγράφηκαν ${result.deletedIds.length} από ${count} ${plural}. Δεν διαγράφηκαν ${result.failures.length}. ${vehicle ? "Τα παρακάτω οχήματα παραμένουν στη λίστα και επιλεγμένα." : "Οι παρακάτω πελάτες παραμένουν στη λίστα και επιλεγμένοι."}`
            : vehicle ? "Τα οχήματα της λίστας συνδέονται με συμβόλαια. Η διαγραφή μπλοκάρεται όταν υπάρχουν συσχετίσεις ή ιστορικό. Δεν θα αφαιρεθούν οι συνδέσεις ούτε θα διαγραφούν συμβόλαια ή ζημιές. Θα εμφανιστεί αναλυτική αιτία για κάθε εγγραφή."
            : "Θα διαγραφούν μόνο οι επιλεγμένοι πελάτες χωρίς συσχετίσεις ή συνδεδεμένο ιστορικό. Πελάτες με συμβόλαια, εισπράξεις, επικοινωνίες ή άλλα συνδεδεμένα δεδομένα δεν θα διαγραφούν. Για αυτούς θα εμφανιστεί αναλυτική αιτία."}
        </Alert>
        {pending && <Stack spacing={.75} role="status" aria-live="polite"><Typography variant="body2">Έλεγχος και διαγραφή: {completed} / {count}</Typography><LinearProgress variant="determinate" value={count ? completed / count * 100 : 0} /></Stack>}
        <TableContainer sx={{ maxHeight: 320, overflow: "auto", border: "1px solid #c8d5e4", borderRadius: 1, bgcolor: "#f8fafc" }}>
          <Table size="small" stickyHeader aria-label={result ? (vehicle ? "Οχήματα που δεν διαγράφηκαν" : "Πελάτες που δεν διαγράφηκαν") : (vehicle ? "Επιλεγμένα οχήματα για διαγραφή" : "Επιλεγμένοι πελάτες για διαγραφή")}>
            <TableHead><TableRow><TableCell sx={{ bgcolor: "#e9eef4", fontWeight: 800 }}>{vehicle ? "Όχημα / συμβόλαιο" : "Πελάτης"}</TableCell>{result && <TableCell sx={{ bgcolor: "#e9eef4", fontWeight: 800 }}>Αιτία μη διαγραφής</TableCell>}</TableRow></TableHead>
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
        {pending ? "Γίνεται έλεγχος…" : `Διαγραφή ${count} ${genitive}`}
      </Button>}
    </DialogActions>
  </Dialog>;
}
