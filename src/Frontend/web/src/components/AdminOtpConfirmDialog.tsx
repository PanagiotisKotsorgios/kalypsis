import { useState, useEffect } from "react";
import {
  Alert, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Stack, TextField, Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { api, extractErrorMessage } from "../api/client";

/**
 * Reusable OTP challenge dialog for destructive PlatformAdmin actions.
 * Opens → auto-requests a 6-digit code via
 *   POST /platform/admin-otp/request { action, target }
 * server emails it to info@mykalypsis.gr → operator types code →
 * we POST /verify → on success invoke `onConfirm(token)` passing the
 * OTP token the caller should add as `X-Admin-OTP-Token` header on
 * the destructive request.
 *
 * Threat model: an attacker who steals a PlatformAdmin JWT cannot
 * complete a destructive action because they can't read the platform
 * inbox. All destructive controller endpoints carry
 * [RequiresAdminOtp] and reject calls missing the header. The token
 * is used-once, target-bound, and expires 15 min after verification.
 */
export function AdminOtpConfirmDialog(props: {
  open: boolean;
  onClose: () => void;
  action: string;
  target?: string | null;
  actionLabel: string;         // human-readable description of what's about to happen
  destructiveWarning?: string; // shown in the red alert
  onConfirm: (token: string) => void | Promise<void>;
}) {
  const { open, onClose, action, target, actionLabel, destructiveWarning, onConfirm } = props;

  const [token, setToken] = useState<string | null>(null);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"requesting" | "waiting" | "verifying" | "verified" | "confirming" | "error">("requesting");
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  useEffect(() => {
    if (!open) return;
    // Reset state on every open
    setToken(null); setEmailedTo(null); setExpiresAt(null);
    setCode(""); setError(null); setAttemptsRemaining(5);
    setPhase("requesting");
    // Fire the challenge request
    (async () => {
      try {
        const res = await api.post<{ token: string; expiresAt: string; emailedTo: string }>(
          "/platform/admin-otp/request", { action, target: target ?? null });
        setToken(res.data.token);
        setEmailedTo(res.data.emailedTo);
        setExpiresAt(res.data.expiresAt);
        setPhase("waiting");
      } catch (e) {
        setError(extractErrorMessage(e));
        setPhase("error");
      }
    })();
  }, [open, action, target]);

  const verify = async () => {
    if (!token) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Ο κωδικός πρέπει να είναι 6 ψηφία.");
      return;
    }
    setPhase("verifying");
    setError(null);
    try {
      const res = await api.post<{
        verified: boolean; reason?: string; attemptsRemaining: number;
      }>("/platform/admin-otp/verify", { token, code });
      setAttemptsRemaining(res.data.attemptsRemaining);
      if (!res.data.verified) {
        setError(explainReason(res.data.reason));
        setPhase("waiting");
        return;
      }
      setPhase("confirming");
      // Handoff — the parent runs the actual destructive call with the token.
      await Promise.resolve(onConfirm(token));
      // Parent typically closes us. If it didn't, do so ourselves.
      onClose();
    } catch (e) {
      setError(extractErrorMessage(e));
      setPhase("waiting");
    }
  };

  return (
    <Dialog open={open} onClose={phase === "confirming" ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800, color: "error.main" }}>
        <LockIcon color="error" />
        Επιβεβαίωση καταστροφικής ενέργειας
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <b>Ενέργεια:</b> {actionLabel}
        </Alert>
        {destructiveWarning && (
          <Alert severity="error" sx={{ mb: 2 }}>{destructiveWarning}</Alert>
        )}
        {phase === "requesting" && (
          <Stack alignItems="center" spacing={1} py={2}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              Αποστολή 6ψήφιου κωδικού…
            </Typography>
          </Stack>
        )}
        {(phase === "waiting" || phase === "verifying" || phase === "confirming") && (
          <Stack spacing={2}>
            <Typography variant="body2">
              Στάλθηκε ένας 6-ψήφιος κωδικός στο <b>{emailedTo}</b>.
              {expiresAt && ` Ισχύει έως ${new Date(expiresAt).toLocaleTimeString("el-GR")}.`}
            </Typography>
            <TextField autoFocus fullWidth label="6-ψήφιος κωδικός"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6,
                style: { fontFamily: "monospace", fontSize: 24, letterSpacing: 8, textAlign: "center" } }}
              disabled={phase !== "waiting"} />
            {attemptsRemaining < 5 && (
              <Typography variant="caption" color="warning.main">
                Υπολειπόμενες προσπάθειες: {attemptsRemaining}
              </Typography>
            )}
            {phase === "confirming" && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Εκτέλεση ενέργειας…
                </Typography>
              </Stack>
            )}
          </Stack>
        )}
        {phase === "error" && (
          <Alert severity="error">{error || "Σφάλμα."}</Alert>
        )}
        {phase !== "error" && error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={phase === "confirming"}>Άκυρο</Button>
        <Button variant="contained" color="error"
          disabled={phase !== "waiting" || code.length !== 6}
          onClick={verify}>
          Επιβεβαίωση & εκτέλεση
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function explainReason(reason?: string): string {
  switch (reason) {
    case "wrong_code":    return "Λάθος κωδικός. Δοκιμάστε ξανά.";
    case "expired":       return "Ο κωδικός έληξε. Κλείστε τον διάλογο και προσπαθήστε ξανά.";
    case "rate_limited":  return "Πολλές αποτυχημένες προσπάθειες. Ζητήστε νέο κωδικό.";
    case "user_mismatch": return "Ο κωδικός ζητήθηκε από άλλον χρήστη.";
    case "unknown_token": return "Άγνωστος token — το session έχει λήξει;";
    default:              return reason ?? "Αποτυχία επιβεβαίωσης.";
  }
}
