import { useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { customerFieldError } from "./customer/customerValidation";

export interface CreatedProducer {
  producer: { id: string; code: string; name: string };
  portalEmail: string | null;
  temporaryPassword: string | null;
}

export function ProducerCreateDialog({ open, initialStatus = "Active", onClose, onSaved }: {
  open: boolean; initialStatus?: "Active" | "Suspended" | "Terminated" | "Prospect";
  onClose: () => void; onSaved: (result: CreatedProducer) => void;
}) {
  const [form, setForm] = useState({ code: "", name: "", email: "", phone: "", prospect: false });
  const [error, setError] = useState<string | null>(null);
  const [lookupEmail, setLookupEmail] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setLookupEmail(form.email.trim().toLowerCase()), 400);
    return () => clearTimeout(timer);
  }, [form.email]);
  const lookup = useQuery({ queryKey: ["producer-user-lookup", lookupEmail],
    enabled: open && !form.prospect && !!lookupEmail && lookupEmail === form.email.trim().toLowerCase() && !customerFieldError("email", lookupEmail),
    queryFn: async () => (await api.get<{ fullName: string; linkedProducerId: string | null; linkedProducerName: string | null } | null>("/producers/user-lookup", { params: { email: lookupEmail } })).data,
  });
  useEffect(() => {
    if (open) {
      setForm({ code: `P-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, name: "", email: "", phone: "", prospect: initialStatus === "Prospect" });
      setError(null);
    }
  }, [open, initialStatus]);
  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Συμπληρώστε το ονοματεπώνυμο ή την επωνυμία.");
      for (const [kind, value] of [["email", form.email], ["phone", form.phone]]) {
        const validation = customerFieldError(kind, value);
        if (validation) throw new Error(validation);
      }
      return (await api.post<CreatedProducer>("/producers", {
        code: form.code, name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null,
        status: form.prospect ? "Prospect" : "Active", tier: "None", hierarchyLevel: "Producer", categoryId: null,
      })).data;
    },
    onSuccess: onSaved,
    onError: err => setError(err instanceof Error && !('response' in err) ? err.message : extractErrorMessage(err)),
  });
  return <Dialog open={open} onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle sx={{ fontWeight: 800 }}>Νέος συνεργάτης</DialogTitle>
    <DialogContent>
      <Stack component="form" id="new-producer-form" onSubmit={event => { event.preventDefault(); if (!save.isPending) save.mutate(); }} spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary">Συμπληρώστε τα βασικά στοιχεία. Μετά την αποθήκευση ανοίγει η καρτέλα για τις υπόλοιπες λεπτομέρειες.</Typography>
        <TextField autoFocus fullWidth required label="Ονοματεπώνυμο / επωνυμία" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} inputProps={{ maxLength: 200 }} disabled={save.isPending} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth type="email" label="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} inputProps={{ maxLength: 256 }} disabled={save.isPending} />
          <TextField fullWidth type="tel" label="Τηλέφωνο" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} inputProps={{ maxLength: 40 }} disabled={save.isPending} />
        </Stack>
        <FormControlLabel control={<Switch checked={form.prospect} onChange={event => setForm({ ...form, prospect: event.target.checked })} disabled={save.isPending} />} label="Πιθανός συνεργάτης" />
        {!form.prospect && lookupEmail === form.email.trim().toLowerCase() && lookup.data && <Alert severity={lookup.data.linkedProducerId ? "warning" : "info"}>
          Το email ανήκει στον χρήστη {lookup.data.fullName}.
          {lookup.data.linkedProducerId ? ` Είναι ήδη συνδεδεμένος με τον συνεργάτη «${lookup.data.linkedProducerName}». Η αποθήκευση θα αλλάξει τη σύνδεσή του.` : " Θα συνδεθεί με τον νέο συνεργάτη."}
        </Alert>}
        <Typography variant="caption" color="text.secondary">Ο κωδικός δημιουργείται αυτόματα. Το email δημιουργεί ή συνδέει πρόσβαση συνεργάτη, εφόσον δεν είναι πιθανός.</Typography>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button variant="contained" color="error" startIcon={<CloseIcon />} disabled={save.isPending} onClick={onClose}>Άκυρο</Button>
      <Button type="submit" form="new-producer-form" variant="contained" color="success" startIcon={save.isPending ? <CircularProgress size={17} color="inherit" /> : <SaveOutlinedIcon />} disabled={save.isPending || !form.name.trim()}>Αποθήκευση & καρτέλα</Button>
    </DialogActions>
  </Dialog>;
}
