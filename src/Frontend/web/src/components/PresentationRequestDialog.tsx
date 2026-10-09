import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api, extractErrorMessage } from "../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#fff",
    "& fieldset": { borderColor: "#bfd0df" },
    "&:hover fieldset": { borderColor: "#1265d8" },
    "&.Mui-focused fieldset": { borderColor: "#1265d8", borderWidth: 2 },
  },
};

/** Short public lead form used by every pre-login presentation CTA. */
export function PresentationRequestDialog({ open, onClose }: Props) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", region: "", details: "", consent: false });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const reset = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "", region: "", details: "", consent: false });
    setError(null);
    setReference(null);
  };

  const close = () => { if (!submitting) { reset(); onClose(); } };
  const set = (key: keyof typeof form, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return setError("Συμπληρώστε όνομα και επώνυμο.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Συμπληρώστε έγκυρο email.");
    if (!form.details.trim() || form.details.trim().length < 10) return setError("Περιγράψτε σύντομα τι θα θέλατε να δείτε στην παρουσίαση.");
    if (!form.consent) return setError("Απαιτείται συγκατάθεση επικοινωνίας.");
    setError(null);
    setSubmitting(true);
    try {
      const response = await api.post<{ reference: string }>("/public/contact", {
        inquiryType: "sales",
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        agencyOrCity: form.region.trim() || null,
        subject: "Αίτημα δωρεάν πλήρους παρουσίασης KALYPSIS",
        message: `Λεπτομέρειες: ${form.details.trim()}`,
        consent: form.consent,
        website: "",
      });
      setReference(response.data.reference);
    } catch (err) {
      setError(extractErrorMessage(err, "Δεν ήταν δυνατή η αποστολή. Δοκιμάστε ξανά."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
      <DialogTitle sx={{ bgcolor: "#eef7ff", color: "#0a2b67", fontWeight: 950, pr: 7 }}>
        {reference ? "Το αίτημά σας στάλθηκε" : "Κλείστε δωρεάν παρουσίαση"}
        <Button onClick={close} color="error" aria-label="Κλείσιμο" sx={{ position: "absolute", right: 12, top: 12, minWidth: 0, px: 1, fontWeight: 900 }}><CloseIcon /></Button>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        {reference ? (
          <Stack alignItems="center" textAlign="center" spacing={1.5} sx={{ py: 3 }}>
            <CheckCircleIcon sx={{ color: "#16803c", fontSize: 56 }} />
            <Typography fontWeight={900} color="#0a2b67">Ευχαριστούμε για το ενδιαφέρον σας.</Typography>
            <Typography color="text.secondary">Θα επικοινωνήσουμε μαζί σας για να προγραμματίσουμε την παρουσίαση.</Typography>
            <Typography variant="caption" color="text.secondary">Κωδικός αναφοράς: {reference}</Typography>
          </Stack>
        ) : (
          <Box component="form" id="presentation-request-form" onSubmit={submit}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>Συμπληρώστε τα βασικά στοιχεία και θα επικοινωνήσουμε μαζί σας.</Typography>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField required label="Όνομα" value={form.firstName} onChange={e => set("firstName", e.target.value)} fullWidth sx={fieldSx} />
                <TextField required label="Επώνυμο" value={form.lastName} onChange={e => set("lastName", e.target.value)} fullWidth sx={fieldSx} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField required type="email" label="Email" value={form.email} onChange={e => set("email", e.target.value)} fullWidth sx={fieldSx} />
                <TextField label="Τηλέφωνο" value={form.phone} onChange={e => set("phone", e.target.value)} fullWidth sx={fieldSx} />
              </Stack>
              <TextField label="Περιοχή" value={form.region} onChange={e => set("region", e.target.value)} fullWidth sx={fieldSx} />
              <TextField required multiline minRows={3} label="Λεπτομέρειες" placeholder="Τι θα θέλατε να δούμε στην παρουσίαση;" value={form.details} onChange={e => set("details", e.target.value)} fullWidth sx={fieldSx} />
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <input aria-label="Συγκατάθεση επικοινωνίας" type="checkbox" checked={form.consent} onChange={e => set("consent", e.target.checked)} style={{ marginTop: 4, accentColor: "#1265d8" }} />
                <Typography variant="caption" color="text.secondary">Συναινώ να επικοινωνήσει μαζί μου η KALYPSIS για το αίτημα παρουσίασης.</Typography>
              </Stack>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {reference ? <Button onClick={close} variant="contained" sx={{ bgcolor: "#0a2b67", fontWeight: 900 }}>Κλείσιμο</Button> : <><Button onClick={close} color="error" sx={{ fontWeight: 800 }}>Ακύρωση</Button><Button type="submit" form="presentation-request-form" variant="contained" disabled={submitting} endIcon={submitting ? <CircularProgress size={17} color="inherit" /> : <ArrowForwardIcon />} sx={{ bgcolor: "#1265d8", fontWeight: 900 }}>{submitting ? "Αποστολή…" : "Αίτημα παρουσίασης"}</Button></>}
      </DialogActions>
    </Dialog>
  );
}
