import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface RelatedPolicy {
  id: string;
  policyNumber: string;
  insuranceCompanyName: string;
  startDate: string;
  endDate: string;
  status: string;
  isRenewalOfCurrent: boolean;
  isRenewedFromCurrent: boolean;
}

/**
 * A field the operator just changed on the current policy. If it's null
 * on the changes object we don't offer it as a propagation option — only
 * fields that actually moved are shown.
 */
export interface PropagatableChanges {
  producerId?: string | null;
  producerName?: string | null;
  paymentCollectionMethod?: string | null;
  paymentFrequency?: string | null;
  specialCommissionPercent?: number | null;
  renewalTransferToProducerId?: string | null;
  renewalTransferToCarrierId?: string | null;
}

const FIELD_LABELS: Record<keyof PropagatableChanges, string> = {
  producerId: "Συνεργάτης",
  producerName: "Συνεργάτης",
  paymentCollectionMethod: "Τρόπος είσπραξης",
  paymentFrequency: "Συχνότητα πληρωμής",
  specialCommissionPercent: "Ειδική προμήθεια %",
  renewalTransferToProducerId: "Μεταφορά ανανέωσης · συνεργάτης",
  renewalTransferToCarrierId: "Μεταφορά ανανέωσης · ασφαλιστική",
};

/**
 * Post-save prompt that asks «Do you also want to apply this change to
 * their older contracts?». Fetches the current policy's related-siblings
 * list, lets the operator tick which ones + which fields to propagate,
 * and calls POST /policies/propagate-changes. Auto-dismisses if the
 * customer has no other policies (nothing to propagate to).
 *
 * Meant to be mounted transiently — the parent controls open state and
 * closes on either «Άκυρο» or successful propagate.
 */
export function PropagateChangesDialog({
  open, onClose, sourcePolicyId, changes
}: {
  open: boolean;
  onClose: (result?: { updatedCount: number; skippedCount: number }) => void;
  sourcePolicyId: string | null;
  changes: PropagatableChanges;
}) {
  const relatedQ = useQuery<RelatedPolicy[]>({
    queryKey: ["policy-related", sourcePolicyId],
    queryFn: async () => (await api.get<RelatedPolicy[]>(`/policies/${sourcePolicyId}/related`)).data,
    enabled: open && !!sourcePolicyId,
    staleTime: 30_000,
  });

  // Only propose fields that ACTUALLY changed on the source save so the
  // dialog can't accidentally «reset» unrelated fields on the siblings.
  const proposedFields = useMemo(() => {
    const out: (keyof PropagatableChanges)[] = [];
    for (const k of Object.keys(changes) as (keyof PropagatableChanges)[]) {
      if (k === "producerName") continue; // display-only for the summary strip
      const v = changes[k];
      if (v !== null && v !== undefined && v !== "") out.push(k);
    }
    return out;
  }, [changes]);

  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<keyof PropagatableChanges>>(
    () => new Set(proposedFields));
  const [err, setErr] = useState<string | null>(null);

  const propagate = useMutation({
    mutationFn: async () => {
      const body: any = { targetPolicyIds: Array.from(selectedTargets) };
      for (const f of selectedFields) body[f] = changes[f];
      return (await api.post<{ updatedCount: number; skippedCount: number }>(
        "/policies/propagate-changes", body)).data;
    },
    onSuccess: (r) => onClose(r),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const related = relatedQ.data ?? [];
  const toggleTarget = (id: string) => {
    const next = new Set(selectedTargets);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTargets(next);
  };
  const toggleField = (f: keyof PropagatableChanges) => {
    const next = new Set(selectedFields);
    if (next.has(f)) next.delete(f); else next.add(f);
    setSelectedFields(next);
  };
  const toggleAllTargets = () => {
    if (selectedTargets.size === related.length) setSelectedTargets(new Set());
    else setSelectedTargets(new Set(related.map(r => r.id)));
  };

  // Nothing to propagate → auto-dismiss silently on the next tick.
  if (open && !relatedQ.isLoading && related.length === 0) {
    queueMicrotask(() => onClose());
    return null;
  }
  if (open && proposedFields.length === 0) {
    queueMicrotask(() => onClose());
    return null;
  }

  return (
    <Dialog open={open} onClose={() => onClose()} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>
        Εφαρμογή αλλαγών και στα υπόλοιπα συμβόλαια του πελάτη
      </DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Οι παρακάτω τιμές άλλαξαν στο τρέχον συμβόλαιο. Επιλέξτε ποια από αυτά και σε
          ποια άλλα συμβόλαια του ίδιου πελάτη θέλετε να διαδοθούν.
        </Alert>

        <Typography variant="overline" color="text.secondary" fontWeight={700}>
          Πεδία προς διάδοση
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5, mb: 2 }}>
          {proposedFields.map(f => (
            <Chip key={f}
              label={FIELD_LABELS[f] + (
                f === "producerId" && changes.producerName ? ` → ${changes.producerName}` : ""
              )}
              color={selectedFields.has(f) ? "primary" : "default"}
              variant={selectedFields.has(f) ? "filled" : "outlined"}
              onClick={() => toggleField(f)}
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2, mb: 0.5 }}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>
            Άλλα συμβόλαια του πελάτη
          </Typography>
          <Box sx={{ flex: 1 }} />
          {related.length > 0 && (
            <Button size="small" onClick={toggleAllTargets}>
              {selectedTargets.size === related.length ? "Κανένα" : "Όλα"}
            </Button>
          )}
        </Stack>
        {relatedQ.isLoading ? (
          <CircularProgress size={20} />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Αρ.Συμβ.</TableCell>
                <TableCell>Εταιρία</TableCell>
                <TableCell>Έναρξη → Λήξη</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {related.map(p => (
                <TableRow key={p.id} hover selected={selectedTargets.has(p.id)}
                  sx={{ cursor: "pointer" }}
                  onClick={() => toggleTarget(p.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={selectedTargets.has(p.id)}
                      onChange={() => toggleTarget(p.id)}
                      onClick={(e) => e.stopPropagation()} />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{p.policyNumber}</TableCell>
                  <TableCell>{p.insuranceCompanyName}</TableCell>
                  <TableCell>{p.startDate} → {p.endDate}</TableCell>
                  <TableCell><Chip size="small" label={p.status} /></TableCell>
                  <TableCell>
                    {p.isRenewalOfCurrent && (
                      <Chip size="small" color="info" variant="outlined" label="ανανέωση" />
                    )}
                    {p.isRenewedFromCurrent && (
                      <Chip size="small" color="info" variant="outlined" label="προηγούμενο" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <FormControlLabel
          sx={{ mt: 1.5 }}
          control={<Checkbox size="small" checked={false} disabled />}
          label={
            <Typography variant="caption" color="text.secondary">
              Οι αλλαγές γράφονται μόνο στα συμβόλαια που τσεκάρετε παραπάνω. Το τρέχον
              συμβόλαιο έχει ήδη αποθηκευτεί.
            </Typography>
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Παράλειψη</Button>
        <Button variant="contained"
          disabled={selectedTargets.size === 0 || selectedFields.size === 0 || propagate.isPending}
          onClick={() => { setErr(null); propagate.mutate(); }}>
          {propagate.isPending
            ? <CircularProgress size={18} />
            : `Εφαρμογή σε ${selectedTargets.size}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
