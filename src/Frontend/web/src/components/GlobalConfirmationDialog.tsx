import { useEffect, useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar } from "@mui/material";

type PendingConfirmation = {
  message: string;
  target: HTMLElement | null;
};

/**
 * Keeps legacy `confirm()` call-sites safe while giving the application one
 * consistent confirmation UI. The original handlers are replayed only after
 * the user presses the dialog's confirmation button, so existing mutations do
 * not run before confirmation.
 */
export function GlobalConfirmationDialog() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lastTarget = useRef<HTMLElement | null>(null);
  const bypassNextConfirm = useRef(false);
  const originalConfirm = useRef<typeof window.confirm | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rememberTarget = (event: Event) => {
      const raw = event.target;
      if (!(raw instanceof Element)) return;
      const actionable = raw.closest<HTMLElement>("button,[role='button'],a,input[type='submit'],input[type='button']");
      if (actionable) lastTarget.current = actionable;
    };

    const previous = window.confirm.bind(window);
    originalConfirm.current = previous;
    window.addEventListener("pointerdown", rememberTarget, true);
    window.addEventListener("keydown", rememberTarget, true);
    window.addEventListener("click", rememberTarget, true);

    window.confirm = (message?: string) => {
      if (bypassNextConfirm.current) {
        bypassNextConfirm.current = false;
        lastTarget.current = null;
        return true;
      }

      const target = lastTarget.current;
      // Browser APIs can also be called outside an interaction. Preserve the
      // old synchronous behaviour for those exceptional calls; all BackOffice
      // button/menu actions have an interaction target and use the custom UI.
      if (!target || !target.isConnected) return previous(message);
      setPending({ message: message ?? "Επιβεβαίωση ενέργειας", target });
      return false;
    };

    return () => {
      window.removeEventListener("pointerdown", rememberTarget, true);
      window.removeEventListener("keydown", rememberTarget, true);
      window.removeEventListener("click", rememberTarget, true);
      window.confirm = previous;
      originalConfirm.current = null;
    };
  }, []);

  const close = () => {
    setPending(null);
    lastTarget.current = null;
  };
  const confirm = () => {
    const target = pending?.target;
    const message = pending?.message ?? "";
    setPending(null);
    lastTarget.current = null;
    if (target?.isConnected) {
      // Replay the original click. The patched confirm returns true exactly
      // once, so the existing mutation executes after the custom dialog.
      bypassNextConfirm.current = true;
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      const isDelete = /διαγραφ|αφαίρε|ακύρω|revoke|delete|remove/i.test(message);
      setSuccess(isDelete ? "Η διαγραφή ολοκληρώθηκε επιτυχώς." : "Η ενέργεια ολοκληρώθηκε επιτυχώς.");
    }
  };

  return (
    <>
      <Dialog open={!!pending} onClose={close} fullWidth maxWidth="xs" aria-labelledby="global-confirm-title">
        <DialogTitle id="global-confirm-title" sx={{ fontWeight: 800, color: "error.main" }}>
          Επιβεβαίωση ενέργειας
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Ελέγξτε προσεκτικά την ενέργεια πριν συνεχίσετε.
          </Alert>
          <div style={{ whiteSpace: "pre-line" }}>{pending?.message}</div>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={close} color="error" variant="outlined">Ακύρωση</Button>
          <Button onClick={confirm} color="error" variant="contained" autoFocus>Είμαι σίγουρος</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!success}
        autoHideDuration={3500}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSuccess(null)} sx={{ fontWeight: 700 }}>
          {success}
        </Alert>
      </Snackbar>
    </>
  );
}
