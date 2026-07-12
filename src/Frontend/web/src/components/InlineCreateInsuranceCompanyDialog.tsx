import { useEffect, useState } from "react";
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Typography
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

/**
 * Drop-in "Νέα ασφαλιστική" dialog for popups that reference a carrier
 * (payments, cover notes, cross-tenant lookups). Wraps POST /insurance-companies
 * with a minimal form — code + name — because that is all the create endpoint
 * needs to succeed. Everything else can be filled from the carrier detail page
 * afterwards.
 *
 * The tenant creating from here needs AgencyAdmin — the endpoint enforces this
 * server-side too, so a portal user hitting the "+" button just gets a 403 they
 * can't reach anyway (the sidebar hides Producers/Carriers admin from them).
 */
export interface InlineInsuranceCompanyCreateResult {
  id: string;
  name: string;
  code: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prefillText?: string;
  onCreated: (company: InlineInsuranceCompanyCreateResult) => void;
}

interface CreateBody {
  name: string;
  code: string;
  country?: string | null;
  website?: string | null;
  isActive: boolean;
  createBridge: boolean;
}

interface CreateResponse {
  id: string;
  name: string;
  code: string;
}

function seedFromPrefill(prefill: string): CreateBody {
  const trimmed = prefill.trim();
  return {
    name: trimmed,
    code: trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20),
    country: null,
    website: null,
    isActive: true,
    createBridge: false,
  };
}

export function InlineCreateInsuranceCompanyDialog({ open, onClose, prefillText = "", onCreated }: Props) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<CreateBody>(() => seedFromPrefill(prefillText));

  useEffect(() => {
    if (open) { setForm(seedFromPrefill(prefillText)); setErr(null); }
  }, [open, prefillText]);

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        country: form.country?.trim() || null,
        website: form.website?.trim() || null,
        isActive: form.isActive,
        createBridge: form.createBridge,
      };
      return (await api.post<CreateResponse>("/insurance-companies", body)).data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["insurance-companies"] });
      void qc.invalidateQueries({ queryKey: ["insurance-companies-lite"] });
      void qc.invalidateQueries({ queryKey: ["insurance-companies-lite-used"] });
      onCreated({ id: data.id, name: data.name, code: data.code });
      onClose();
    },
    onError: e => setErr(extractErrorMessage(e)),
  });

  const canSave = !!form.name.trim() && !!form.code.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Νέα ασφαλιστική</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Γρήγορη προσθήκη — τα υπόλοιπα στοιχεία συμπληρώνονται από την καρτέλα εταιρείας αργότερα.
        </Typography>
        <Stack spacing={2} mt={0.5}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Κωδικός"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              sx={{ width: 140 }}
              placeholder="INTERAMERICAN"
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
              label="Χώρα"
              value={form.country ?? ""}
              onChange={e => setForm({ ...form, country: e.target.value })}
              fullWidth
            />
            <TextField
              label="Website"
              value={form.website ?? ""}
              onChange={e => setForm({ ...form, website: e.target.value })}
              fullWidth
            />
          </Stack>
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
