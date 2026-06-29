import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface StatusDto { enabled: boolean; enabledAt: string | null }
interface EnrollDto { secret: string; otpAuthUri: string }
interface ConfirmResult { success: boolean; recoveryCodes: string[] | null }

/**
 * Profile-page section to enable / disable TOTP-based 2FA.
 *  - On enable: shows the secret + otpauth:// URI (rendered as QR via Google
 *    Charts API for portability — no extra deps), waits for a 6-digit code,
 *    confirms, then displays one-time recovery codes the user must store.
 *  - On disable: confirmation dialog, then clears the secret + recovery codes.
 */
export function TwoFactorSection() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["2fa-status"],
    queryFn: async () => (await api.get<StatusDto>("/me/2fa")).data
  });

  const [enroll, setEnroll] = useState<EnrollDto | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = useMutation({
    mutationFn: async () => (await api.post<EnrollDto>("/me/2fa/begin")).data,
    onSuccess: (d) => { setEnroll(d); setError(null); },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const confirm = useMutation({
    mutationFn: async () => (await api.post<ConfirmResult>("/me/2fa/confirm", { code: code.trim() })).data,
    onSuccess: (d) => {
      setEnroll(null);
      setCode("");
      setRecoveryCodes(d.recoveryCodes ?? []);
      void qc.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const disable = useMutation({
    mutationFn: async () => api.post("/me/2fa/disable"),
    onSuccess: () => {
      setConfirmingDisable(false);
      void qc.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const enabled = !!status.data?.enabled;

  const qrUrl = enroll
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(enroll.otpAuthUri)}`
    : null;

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            display: "grid", placeItems: "center",
            bgcolor: enabled ? "rgba(46,164,79,0.10)" : "rgba(11,37,69,0.06)",
            color: enabled ? "#1e7a32" : "primary.main"
          }}>
            <VerifiedUserIcon />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                Επαλήθευση δύο παραγόντων (2FA)
              </Typography>
              {enabled
                ? <Chip size="small" color="success" label="Ενεργή" sx={{ fontWeight: 800 }} />
                : <Chip size="small" label="Ανενεργή" sx={{ fontWeight: 800 }} />}
            </Stack>
            <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
              Προσθέτει ένα 6-ψήφιο κωδικό από εφαρμογή authenticator (Google /
              Microsoft / Authy) στη σύνδεση. Χωρίς αυτόν, ο κωδικός σας δεν αρκεί.
            </Typography>
          </Box>
          {status.isLoading ? <CircularProgress size={20} /> : enabled ? (
            <Button color="error" variant="outlined" onClick={() => setConfirmingDisable(true)} startIcon={<LockResetIcon />}>
              Απενεργοποίηση
            </Button>
          ) : (
            <Button variant="contained" onClick={() => begin.mutate()} disabled={begin.isPending}>
              {begin.isPending ? <CircularProgress size={18} color="inherit" /> : "Ενεργοποίηση"}
            </Button>
          )}
        </Stack>

        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>{error}</Alert>}
      </CardContent>

      {/* Enrollment dialog */}
      <Dialog open={!!enroll} onClose={() => setEnroll(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Ενεργοποίηση 2FA</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary" textAlign="center">
              1) Σαρώστε τον QR με την εφαρμογή authenticator του κινητού σας.<br/>
              2) Πληκτρολογήστε εδώ τον 6-ψήφιο κωδικό που εμφανίζεται.
            </Typography>
            {qrUrl && <Box component="img" src={qrUrl} alt="QR code" sx={{ width: 220, height: 220 }} />}
            {enroll && (
              <Box sx={{ width: "100%", p: 1.5, bgcolor: "rgba(0,0,0,0.03)", borderRadius: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Μυστικό (manual entry)</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontFamily: "monospace", fontSize: 13, flex: 1, overflowWrap: "anywhere" }}>
                    {enroll.secret}
                  </Typography>
                  <Button size="small" startIcon={<ContentCopyIcon fontSize="small" />}
                    onClick={() => navigator.clipboard.writeText(enroll.secret)}>Copy</Button>
                </Stack>
              </Box>
            )}
            <TextField
              fullWidth autoFocus
              label="Κωδικός 6 ψηφίων"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputProps={{ inputMode: "numeric", maxLength: 8 }}
              disabled={confirm.isPending}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEnroll(null); setCode(""); }} disabled={confirm.isPending}>Άκυρο</Button>
          <Button variant="contained" disabled={confirm.isPending || code.trim().length < 6} onClick={() => confirm.mutate()}>
            {confirm.isPending ? <CircularProgress size={18} color="inherit" /> : "Επιβεβαίωση"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recovery codes dialog */}
      <Dialog open={!!recoveryCodes} onClose={() => setRecoveryCodes(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Κωδικοί ανάκτησης</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Αποθηκεύστε αυτούς τους κωδικούς τώρα — εμφανίζονται μόνο μία φορά.
            Κάθε κωδικός χρησιμοποιείται μία φορά αν χάσετε το κινητό σας.
          </Alert>
          <Box sx={{ p: 2, bgcolor: "rgba(0,0,0,0.03)", borderRadius: 1.5, fontFamily: "monospace", fontSize: 14 }}>
            {(recoveryCodes ?? []).map(c => <Box key={c}>{c}</Box>)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={() => navigator.clipboard.writeText((recoveryCodes ?? []).join("\n"))}>
            Copy
          </Button>
          <Button variant="contained" onClick={() => setRecoveryCodes(null)}>Έγινε</Button>
        </DialogActions>
      </Dialog>

      {/* Disable confirmation */}
      <Dialog open={confirmingDisable} onClose={() => setConfirmingDisable(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Απενεργοποίηση 2FA;</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Ο λογαριασμός σας θα συνδέεται μόνο με κωδικό μετά την απενεργοποίηση.
            Συνιστούμε να την κρατήσετε ενεργή.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingDisable(false)}>Άκυρο</Button>
          <Button color="error" variant="contained" disabled={disable.isPending} onClick={() => disable.mutate()}>
            {disable.isPending ? <CircularProgress size={18} color="inherit" /> : "Απενεργοποίηση"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
