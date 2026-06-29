import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface ProducerLite {
  id: string; code: string; name: string;
  status: "Active" | "Suspended" | "Terminated";
}

interface PreviewDto {
  fromProducerId: string; fromProducerName: string;
  toProducerId: string;   toProducerName: string;
  policyCount: number;
  distinctCustomerCount: number;
  pendingCommissionTransactionCount: number;
  pendingCommissionTotal: number;
  pendingCommissionRunLineCount: number;
  currency: string;
}

interface ResultDto {
  policiesMoved: number;
  pendingCommissionsMoved: number;
  pendingRunLinesMoved: number;
}

export function ReassignProducerDialog({
  open,
  onClose,
  fromProducer
}: {
  open: boolean;
  onClose: (success?: boolean) => void;
  fromProducer: ProducerLite | null;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<ProducerLite | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultDto | null>(null);

  const producersQ = useQuery({
    queryKey: ["producers-lite-reassign"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data,
    enabled: open
  });

  const targets = useMemo(() => {
    const all = producersQ.data ?? [];
    return all.filter(p => p.id !== fromProducer?.id && p.status === "Active");
  }, [producersQ.data, fromProducer?.id]);

  const preview = useQuery({
    enabled: open && !!fromProducer && !!target,
    queryKey: ["producer-reassign-preview", fromProducer?.id, target?.id],
    queryFn: async () => (await api.get<PreviewDto>(`/producers/${fromProducer!.id}/reassign-preview`, {
      params: { toId: target!.id }
    })).data
  });

  const execute = useMutation({
    mutationFn: async () => (await api.post<ResultDto>(`/producers/${fromProducer!.id}/reassign`, {
      toProducerId: target!.id,
      reason: reason.trim() || null
    })).data,
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["producers"] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const close = () => {
    if (execute.isPending) return;
    setTarget(null);
    setReason("");
    setError(null);
    const success = !!result;
    setResult(null);
    onClose(success);
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            display: "grid", placeItems: "center",
            bgcolor: "rgba(30,167,225,0.10)", color: "secondary.main"
          }}>
            <SwapHorizIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 19 }}>Μετακίνηση συνεργάτη</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Από: <strong>{fromProducer?.name ?? "—"}</strong>
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

        {result ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: "50%",
              display: "grid", placeItems: "center",
              bgcolor: "rgba(46,164,79,0.12)", color: "#1e7a32"
            }}>
              <SwapHorizIcon sx={{ fontSize: 36 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }} textAlign="center">
              Η μετακίνηση ολοκληρώθηκε.
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <Chip color="primary" variant="outlined" label={`${result.policiesMoved} συμβόλαια`} sx={{ fontWeight: 700 }} />
              <Chip color="primary" variant="outlined" label={`${result.pendingCommissionsMoved} προμήθειες`} sx={{ fontWeight: 700 }} />
              <Chip color="primary" variant="outlined" label={`${result.pendingRunLinesMoved} γραμμές run`} sx={{ fontWeight: 700 }} />
            </Stack>
            <Typography color="text.secondary" sx={{ fontSize: 13, textAlign: "center" }}>
              Οι ήδη πληρωμένες προμήθειες έμειναν στον αρχικό συνεργάτη — δεν αλλοιώνουμε το ιστορικό.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Autocomplete
              options={targets}
              loading={producersQ.isLoading}
              getOptionLabel={(p) => `${p.name} (${p.code})`}
              value={target}
              onChange={(_, v) => setTarget(v)}
              renderInput={(params) => (
                <TextField {...params} label="Νέος συνεργάτης" placeholder="Πληκτρολογήστε όνομα ή κωδικό" />
              )}
              isOptionEqualToValue={(a, b) => a.id === b.id}
            />

            <TextField
              label="Σημείωση (προαιρετικό)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline minRows={2}
              placeholder="π.χ. Αποχώρηση συνεργάτη, αναδιοργάνωση γραφείου…"
            />

            {target && (
              <Box sx={{
                p: 2, borderRadius: 2,
                bgcolor: "rgba(30,167,225,0.05)",
                border: "1px solid rgba(30,167,225,0.20)"
              }}>
                {preview.isLoading ? (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Υπολογισμός μετακίνησης…</Typography>
                  </Stack>
                ) : preview.isError ? (
                  <Alert severity="error" variant="outlined">{extractErrorMessage(preview.error)}</Alert>
                ) : preview.data ? (
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">Πρόκειται να μετακινηθούν</Typography>
                    <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                      <Chip color="primary" label={`${preview.data.policyCount} συμβόλαια`} sx={{ fontWeight: 700 }} />
                      <Chip variant="outlined" label={`${preview.data.distinctCustomerCount} πελάτες`} sx={{ fontWeight: 700 }} />
                      <Chip variant="outlined" label={`${preview.data.pendingCommissionTransactionCount} εκκρεμείς προμήθειες`} sx={{ fontWeight: 700 }} />
                      {preview.data.pendingCommissionTotal > 0 && (
                        <Chip variant="outlined"
                          label={`${preview.data.pendingCommissionTotal.toFixed(2)} ${preview.data.currency}`}
                          sx={{ fontWeight: 700 }} />
                      )}
                      {preview.data.pendingCommissionRunLineCount > 0 && (
                        <Chip variant="outlined"
                          label={`${preview.data.pendingCommissionRunLineCount} γραμμές draft εκκαθάρισης`}
                          sx={{ fontWeight: 700 }} />
                      )}
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, color: "warning.dark" }}>
                      <WarningAmberIcon fontSize="small" />
                      <Typography variant="body2">
                        Οριστικοποιημένες / πληρωμένες προμήθειες <strong>δεν</strong> μετακινούνται — μένουν ως ιστορικό στον αρχικό συνεργάτη.
                      </Typography>
                    </Stack>
                  </Stack>
                ) : null}
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {result ? (
          <Button variant="contained" onClick={close}>Έγινε</Button>
        ) : (
          <>
            <Button onClick={close} disabled={execute.isPending}>Άκυρο</Button>
            <Button
              variant="contained"
              startIcon={execute.isPending ? <CircularProgress size={16} color="inherit" /> : <SwapHorizIcon />}
              disabled={!target || execute.isPending || preview.isLoading}
              onClick={() => execute.mutate()}
            >
              {execute.isPending ? "Μετακίνηση…" : "Επιβεβαίωση μετακίνησης"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
