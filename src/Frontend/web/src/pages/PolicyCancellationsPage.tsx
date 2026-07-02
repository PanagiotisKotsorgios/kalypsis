import { useEffect, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { money, date } from "../utils/format";

type Status = "Draft" | "Submitted" | "Approved" | "Rejected" | "Effective";

interface CancellationDto {
  id: string; policyId: string; policyNumber: string;
  cancellationNumber: string; status: Status;
  reasonId: string | null; reasonName: string | null; reasonText: string | null;
  requestedAt: string; effectiveFrom: string;
  refundMethod: string; refundAmount: number;
  penaltyAmount: number | null; commissionClawback: number | null;
  currency: string; creditNoteId: string | null;
  carrierReference: string | null; notes: string | null; createdAt: string;
}

interface PolicyLite { id: string; policyNumber: string; premium: number; startDate: string; endDate: string; currency: string; }
interface ReasonDto { id: string; code: string; name: string; }

export function PolicyCancellationsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({
    queryKey: ["policy-cancellations"],
    queryFn: async () => (await api.get<CancellationDto[]>("/policy-cancellations")).data
  });

  const approve = useMutation({
    mutationFn: async (id: string) => api.post(`/policy-cancellations/${id}/approve`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-cancellations"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <CancelPresentationIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Ακυρώσεις συμβολαίων</Typography>
              <HelpHint title="Ακυρώσεις"
                body="Καταχώρηση πλήρους/μερικής ακύρωσης. Υπολογίζει αυτόματα επιστροφή pro-rata, short-rate ή πλήρη και δημιουργεί πιστωτικό σημείωμα όταν εγκριθεί." />
            </Stack>
            <Typography color="text.secondary">
              Πλήρης ή μερική λήξη ισχύος με αυτόματο υπολογισμό επιστροφής και έκδοση πιστωτικού.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέα ακύρωση
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Αρ. ακύρωσης</TableCell>
                <TableCell>Συμβόλαιο</TableCell>
                <TableCell>Αιτία</TableCell>
                <TableCell>Ισχύς από</TableCell>
                <TableCell>Μέθοδος</TableCell>
                <TableCell align="right">Επιστροφή</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν ακυρώσεις.
                </TableCell></TableRow>
              )}
              {(q.data ?? []).map(c => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.cancellationNumber}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{c.policyNumber}</TableCell>
                  <TableCell>
                    {c.reasonName ?? "—"}
                    {c.reasonText && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{c.reasonText}</Typography>}
                  </TableCell>
                  <TableCell>{date(c.effectiveFrom)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.refundMethod} variant="outlined" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>
                    {money(c.refundAmount, c.currency)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small"
                      color={c.status === "Effective" ? "success" : c.status === "Rejected" ? "error" : "warning"}
                      label={c.status} />
                  </TableCell>
                  <TableCell align="right">
                    {c.status !== "Effective" && c.status !== "Rejected" && (
                      <IconButton size="small" color="success" onClick={() => {
                        if (confirm(`Έγκριση ακύρωσης ${c.cancellationNumber}; Θα δημιουργηθεί αυτόματα πιστωτικό για ${money(c.refundAmount, c.currency)}.`)) {
                          approve.mutate(c.id);
                        }
                      }} title="Έγκριση & εφαρμογή">
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CancellationDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["policy-cancellations"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function CancellationDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [policy, setPolicy] = useState<PolicyLite | null>(null);
  const [reasonId, setReasonId] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [refundMethod, setRefundMethod] = useState("ProRata");
  const [customRefund, setCustomRefund] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const policies = useQuery({
    queryKey: ["policies-for-cancellation"],
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data,
    enabled: open
  });
  const reasons = useQuery({
    queryKey: ["cancellation-reasons"],
    queryFn: async () => (await api.get<ReasonDto[]>("/cancellation-reasons")).data,
    enabled: open
  });

  useEffect(() => {
    if (open) {
      setPolicy(null); setReasonId(""); setReasonText("");
      setEffectiveFrom(today); setRefundMethod("ProRata"); setCustomRefund(""); setErr(null);
    }
  }, [open, today]);

  // Live preview of refund computation (client-side mirror of backend formula)
  const previewRefund = (() => {
    if (!policy) return null;
    if (refundMethod === "Custom") return customRefund ? Number(customRefund) : 0;
    if (refundMethod === "Full") return policy.premium;
    const start = new Date(policy.startDate).getTime();
    const end = new Date(policy.endDate).getTime();
    const eff = new Date(effectiveFrom).getTime();
    const totalDays = Math.max(1, Math.round((end - start) / 86_400_000));
    const remDays = Math.max(0, Math.round((end - eff) / 86_400_000));
    const proRata = policy.premium * remDays / totalDays;
    return refundMethod === "ShortRate" ? Math.round(proRata * 0.80 * 100) / 100 : Math.round(proRata * 100) / 100;
  })();

  const save = useMutation({
    mutationFn: async () => {
      if (!policy) throw new Error("Επιλέξτε συμβόλαιο.");
      const body = {
        policyId: policy.id,
        reasonId: reasonId || null,
        reasonText: reasonText || null,
        effectiveFrom,
        refundMethod,
        customRefund: refundMethod === "Custom" && customRefund ? Number(customRefund) : null
      };
      return (await api.post("/policy-cancellations", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Νέα ακύρωση συμβολαίου</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Autocomplete
            options={policies.data ?? []}
            getOptionLabel={(p) => `${p.policyNumber} · ${money(p.premium, p.currency)}`}
            value={policy}
            onChange={(_, v) => setPolicy(v)}
            renderInput={(p) => <TextField {...p} label="Συμβόλαιο προς ακύρωση *" />}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label="Αιτία ακύρωσης"
              value={reasonId}
              onChange={(v) => setReasonId(v)}
              emptyLabel="— Χωρίς προκαθορισμένη αιτία —"
              sx={{ flex: 1 }}
              options={(reasons.data ?? []).map(r => ({ value: r.id, label: r.name }))}
            />
            <TextField type="date" label="Ισχύς ακύρωσης" InputLabelProps={{ shrink: true }}
              value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} sx={{ width: 180 }} />
            <HelpHint id="cancellation.effectiveFrom" />
          </Stack>

          <TextField label="Λεπτομέρειες αιτίας" multiline minRows={2} fullWidth
            value={reasonText} onChange={(e) => setReasonText(e.target.value)} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Μέθοδος επιστροφής" value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)} sx={{ flex: 1 }}>
              <MenuItem value="ProRata">Pro Rata — αναλογικά</MenuItem>
              <MenuItem value="ShortRate">Short Rate — με ποινή 20%</MenuItem>
              <MenuItem value="Full">Πλήρης επιστροφή</MenuItem>
              <MenuItem value="Custom">Custom — χειροκίνητο</MenuItem>
            </SearchableTextField>
            <HelpHint id="cancellation.refundMethod" />
            {refundMethod === "Custom" && (
              <TextField type="number" label="Ποσό επιστροφής (€)" value={customRefund}
                onChange={(e) => setCustomRefund(e.target.value)} inputProps={{ step: "0.01" }} sx={{ width: 200 }} />
            )}
          </Stack>

          {previewRefund !== null && (
            <Alert severity="info" sx={{ fontSize: 14 }}>
              <strong>Υπολογισμός επιστροφής:</strong> {money(previewRefund, policy?.currency ?? "EUR")} (προεπισκόπηση)
              {refundMethod === "ProRata" && " — αναλογικά για τις υπόλοιπες ημέρες"}
              {refundMethod === "ShortRate" && " — pro rata με 20% ποινή πρόωρης λήξης"}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !policy}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Καταχώρηση ακύρωσης"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
