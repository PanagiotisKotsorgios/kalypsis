import { useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface InstallmentDto {
  id: string;
  policyId: string;
  sequenceNumber: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
}

interface NoticeDto {
  id: string;
  kind: "D" | "F" | "R" | "W";
  code: string;
  status: string;
  amount: number;
  currency: string;
  producerId: string | null;
  issuedAt: string;
  dueAt: string | null;
}

interface ProducerLite { id: string; code: string; name: string; }

export function PrintPayBasketPage() {
  const qc = useQueryClient();
  const [producerId, setProducerId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const producers = useQuery({
    queryKey: ["producers-lite"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data
  });

  const installments = useQuery({
    queryKey: ["installments-due"],
    queryFn: async () => (await api.get<InstallmentDto[]>("/billing/installments")).data
  });

  const notices = useQuery({
    queryKey: ["notices-f"],
    queryFn: async () => (await api.get<NoticeDto[]>("/payment-notices?kind=2")).data
  });

  const due = (installments.data ?? []).filter((i) => i.status !== "Paid");
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const total = due.filter((i) => selected[i.id]).reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);

  const createBasket = useMutation({
    mutationFn: async () => {
      const body = { producerId, installmentIds: selectedIds };
      return (await api.post<NoticeDto>("/payment-notices/basket/print-pay", body)).data;
    },
    onSuccess: () => {
      setSelected({});
      void qc.invalidateQueries({ queryKey: ["notices-f"] });
      void qc.invalidateQueries({ queryKey: ["installments-due"] });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <PrintIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Τυπώνω-Πληρώνω</Typography>
          <Typography color="text.secondary">
            Επιλέξτε δόσεις και δημιουργήστε ένα ενοποιημένο F-code προς πληρωμή στην τράπεζα.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Card variant="outlined" sx={{ p: 3, width: { xs: "100%", lg: 360 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Καλάθι αγορών</Typography>
          <TextField select fullWidth label="Συνεργάτης (πλαφόν)" value={producerId}
            onChange={(e) => setProducerId(e.target.value)} sx={{ mb: 2 }}>
            <MenuItem value="">—</MenuItem>
            {(producers.data ?? []).map((p) =>
              <MenuItem key={p.id} value={p.id}>{p.code} · {p.name}</MenuItem>)}
          </TextField>

          <Stack spacing={1}>
            <Box>
              <Typography variant="body2" color="text.secondary">Δόσεις στο καλάθι</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 800 }}>{selectedIds.length}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Σύνολο</Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: "primary.main" }}>
                {total.toFixed(2)} €
              </Typography>
            </Box>
          </Stack>

          <Button
            size="large"
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            onClick={() => createBasket.mutate()}
            disabled={createBasket.isPending || selectedIds.length === 0 || !producerId}
            startIcon={createBasket.isPending ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
          >
            Δημιουργία F-code
          </Button>
        </Card>

        <Box sx={{ flex: 1 }}>
          <Card variant="outlined" sx={{ mb: 3, overflowX: "auto" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Δόσεις προς πληρωμή</Typography>
            </Box>
            {installments.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Συμβόλαιο</TableCell>
                    <TableCell align="right">Δόση #</TableCell>
                    <TableCell>Λήξη</TableCell>
                    <TableCell align="right">Υπόλοιπο</TableCell>
                    <TableCell>Κατάσταση</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {due.length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>
                      Δεν υπάρχουν δόσεις προς πληρωμή.
                    </TableCell></TableRow>
                  )}
                  {due.map((i) => (
                    <TableRow key={i.id} hover sx={{ cursor: "pointer" }}
                      onClick={() => setSelected({ ...selected, [i.id]: !selected[i.id] })}>
                      <TableCell padding="checkbox">
                        <Checkbox checked={!!selected[i.id]} onChange={(e) => {
                          setSelected({ ...selected, [i.id]: e.target.checked });
                        }} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{i.policyId.slice(0, 8)}…</TableCell>
                      <TableCell align="right">{i.sequenceNumber}</TableCell>
                      <TableCell>{new Date(i.dueDate).toLocaleDateString("el-GR")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {(i.amount - i.paidAmount).toFixed(2)} €
                      </TableCell>
                      <TableCell>
                        <Chip size="small"
                          color={i.status === "Overdue" ? "error" : i.status === "Due" ? "warning" : "default"}
                          label={i.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Πρόσφατα F-codes</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Κωδικός</TableCell>
                  <TableCell align="right">Ποσό</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                  <TableCell>Εκδόθηκε</TableCell>
                  <TableCell>Λήξη</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(notices.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    Καμία ενεργή F-code.
                  </TableCell></TableRow>
                )}
                {(notices.data ?? []).slice(0, 20).map((n) => (
                  <TableRow key={n.id}>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{n.code}</TableCell>
                    <TableCell align="right">{n.amount.toFixed(2)} {n.currency}</TableCell>
                    <TableCell>
                      <Chip size="small" color={n.status === "Paid" ? "success" : "warning"} label={n.status} />
                    </TableCell>
                    <TableCell>{new Date(n.issuedAt).toLocaleDateString("el-GR")}</TableCell>
                    <TableCell>{n.dueAt ? new Date(n.dueAt).toLocaleDateString("el-GR") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Box>
      </Stack>
    </Box>
  );
}
