import { useEffect, useState } from "react";
import { Alert, AlertTitle, Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";

/**
 * Phase 10.1 — Descriptive error envelope.
 * The backend now returns a richer error shape than just `{code,message}`:
 *
 *   {
 *     code: "missing_configuration",
 *     message: "Λείπει η παραμετροποίηση: Προμήθεια για INTERAMERICAN / Auto",
 *     title: "Λείπει παραμετροποίηση",
 *     why:   "Δεν έχετε ορίσει τιμή για: …",
 *     fix:   "Μεταβείτε στο «Παραμετροποίηση Προμηθειών» και συμπληρώστε …",
 *     fixLink: "/app/commission-runs",
 *     severity: "warning"
 *   }
 *
 * `useDescriptiveError` exposes a state pair the page wires into <ErrorPopup>.
 * Helpers <ErrorPopup error={...} /> renders a full-context modal.
 */

export interface DescriptiveError {
  code?: string;
  message: string;
  title?: string;
  why?: string;
  fix?: string;
  fixLink?: string;
  severity?: "error" | "warning" | "info";
}

/** Parse an axios error / any thrown error into the descriptive shape. */
export function parseDescriptiveError(e: unknown, fallback = "Παρουσιάστηκε σφάλμα."): DescriptiveError {
  // axios error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyE = e as any;
  const data = anyE?.response?.data;
  if (data && typeof data === "object") {
    return {
      code: data.code,
      message: data.message ?? fallback,
      title: data.title,
      why: data.why,
      fix: data.fix,
      fixLink: data.fixLink,
      severity: (data.severity ?? "error") as DescriptiveError["severity"]
    };
  }
  if (e instanceof Error) return { message: e.message, severity: "error" };
  return { message: fallback, severity: "error" };
}

/** Stateful hook for managing error popups inside a page. */
export function useDescriptiveError() {
  const [error, setError] = useState<DescriptiveError | null>(null);
  return {
    error,
    setError,
    clear: () => setError(null),
    /** Pass to mutation `onError`: `useMutation({ onError: handleError })`. */
    handleError: (e: unknown) => setError(parseDescriptiveError(e))
  };
}

/**
 * Full-screen modal that explains the error in detail. Use this when an action
 * fails and the user needs guidance.
 */
export function ErrorPopup({ error, onClose }: { error: DescriptiveError | null; onClose: () => void }) {
  const navigate = useNavigate();
  if (!error) return null;
  const sev = error.severity ?? "error";

  return (
    <Dialog open={!!error} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: 0 }}>
        <Alert severity={sev} sx={{ borderRadius: 0, alignItems: "flex-start", py: 3, px: 3 }}>
          <AlertTitle sx={{ fontWeight: 800, fontSize: 18 }}>
            {error.title ?? (sev === "warning" ? "Προειδοποίηση" : sev === "info" ? "Πληροφορία" : "Σφάλμα")}
          </AlertTitle>
          <Typography sx={{ fontSize: 14.5, lineHeight: 1.55, mt: 0.5 }}>
            {error.message}
          </Typography>

          {error.why && (
            <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary", textTransform: "uppercase" }}>
                Γιατί συνέβη
              </Typography>
              <Typography sx={{ fontSize: 13.5, lineHeight: 1.55, mt: 0.5 }}>
                {error.why}
              </Typography>
            </Box>
          )}

          {error.fix && (
            <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary", textTransform: "uppercase" }}>
                Πώς διορθώνεται
              </Typography>
              <Typography sx={{ fontSize: 13.5, lineHeight: 1.55, mt: 0.5 }}>
                {error.fix}
              </Typography>
            </Box>
          )}

          {error.code && (
            <Typography variant="caption" sx={{ mt: 2, display: "block", fontFamily: "monospace", color: "text.disabled" }}>
              code: {error.code}
            </Typography>
          )}
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Κλείσιμο</Button>
        {error.fixLink && (
          <Button
            variant="contained"
            startIcon={<OpenInNewIcon />}
            onClick={() => {
              const href = error.fixLink!;
              if (href.startsWith("/")) navigate(href);
              else window.open(href, "_blank");
              onClose();
            }}
          >
            Πήγαινε εκεί
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

/**
 * Lightweight inline banner (use within forms when you don't want a modal).
 * Auto-dismisses after 8 seconds for non-error severities.
 */
export function ErrorBanner({ error, onClose }: { error: DescriptiveError | null; onClose: () => void }) {
  useEffect(() => {
    if (error && error.severity !== "error") {
      const id = setTimeout(onClose, 8000);
      return () => clearTimeout(id);
    }
  }, [error, onClose]);
  if (!error) return null;
  return (
    <Alert severity={error.severity ?? "error"} onClose={onClose} sx={{ mb: 2 }}>
      <AlertTitle sx={{ fontWeight: 700 }}>{error.title ?? error.message}</AlertTitle>
      {error.title && <Typography variant="body2">{error.message}</Typography>}
      {error.why && <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}><strong>Γιατί:</strong> {error.why}</Typography>}
      {error.fix && <Typography variant="caption" sx={{ display: "block" }}><strong>Διόρθωση:</strong> {error.fix}</Typography>}
      {error.fixLink && (
        <Stack direction="row" sx={{ mt: 1 }}>
          <Button size="small" component="a" href={error.fixLink} startIcon={<OpenInNewIcon />}>
            Πήγαινε εκεί
          </Button>
        </Stack>
      )}
    </Alert>
  );
}
