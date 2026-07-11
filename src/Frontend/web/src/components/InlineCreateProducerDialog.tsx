import { useEffect, useState } from "react";
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

/**
 * Drop-in "Νέος συνεργάτης" dialog for popups that reference a producer
 * (payments, commission runs, cross-tenant lookups). Wraps POST /producers with
 * a minimal form — code + name — because that is all the create endpoint needs.
 */
export interface InlineProducerCreateResult {
  id: string;
  name: string;
  code: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefillText?: string;
  onCreated: (producer: InlineProducerCreateResult) => void;
}

type ProducerStatus = "Active" | "Inactive" | "Suspended";

interface CreateBody {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  status: ProducerStatus;
}

interface CreateResponse {
  id: string;
  code: string;
  name: string;
}

function seedFromPrefill(prefill: string): CreateBody {
  const trimmed = prefill.trim();
  return {
    name: trimmed,
    code: trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20) || `P-${Date.now().toString().slice(-6)}`,
    email: "",
    phone: "",
    status: "Active",
  };
}

export function InlineCreateProducerDialog({ open, onClose, prefillText = "", onCreated }: Props) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<CreateBody>(() => seedFromPrefill(prefillText));

  useEffect(() => {
    if (open) { setForm(seedFromPrefill(prefillText)); setErr(null); }
  }, [open, prefillText]);

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        status: form.status,
      };
      return (await api.post<CreateResponse>("/producers", body)).data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["producers"] });
      void qc.invalidateQueries({ queryKey: ["producers-lite"] });
      onCreated({ id: data.id, name: data.name, code: data.code });
      onClose();
    },
    onError: e => setErr(extractErrorMessage(e)),
  });

  const canSave = !!form.code.trim() && !!form.name.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Νέος συνεργάτης</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Γρήγορη προσθήκη — τα υπόλοιπα στοιχεία (ιεραρχία, portal account) συμπληρώνονται αργότερα από την καρτέλα συνεργάτη.
        </Typography>
        <Stack spacing={2} mt={0.5}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Κωδικός"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              sx={{ width: 140 }}
              required
            />
            <TextField
              label="Όνομα"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
              autoFocus
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={form.email ?? ""}
              onChange={e => setForm({ ...form, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Τηλέφωνο"
              value={form.phone ?? ""}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            select label="Κατάσταση" value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value as ProducerStatus })}
            fullWidth
          >
            <MenuItem value="Active">Ενεργός</MenuItem>
            <MenuItem value="Inactive">Ανενεργός</MenuItem>
            <MenuItem value="Suspended">Σε αναστολή</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
