import { useEffect, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "./SearchableTextField";

/**
 * A drop-in "Νέος πελάτης" dialog usable from any popup that needs to
 * create a customer without leaving the current context — e.g. the New
 * Policy dialog when the user searches for a customer that isn't on file
 * yet. Prefill is heuristically split from the search input the user was
 * typing (single word → lastName; two+ words → firstName + lastName).
 */
export interface InlineCustomerCreateResult {
  id: string;
  displayName: string;
  vatNumber?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** What the user was typing in the parent dropdown — split into name fields. */
  prefillText?: string;
  onCreated: (customer: InlineCustomerCreateResult) => void;
}

type CustomerType = "Individual" | "Company";

interface CreateBody {
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  createPortalAccount: boolean;
}

interface CreateResponse {
  customer: {
    id: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    vatNumber?: string;
    type: CustomerType;
  };
}

const digitOnly = (s: string) => /^\d+$/.test(s.trim());

/** Heuristic — pick a sensible initial customer type + name split from the
 *  user's search text. Numeric-looking string → Company + VAT prefill;
 *  otherwise Individual, one word → lastName, two+ words → first + last. */
function seedFromPrefill(prefill: string): CreateBody {
  const trimmed = prefill.trim();
  if (!trimmed) return { type: "Individual", createPortalAccount: false };
  if (digitOnly(trimmed) && trimmed.length >= 8)
    return { type: "Company", vatNumber: trimmed, createPortalAccount: false };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1)
    return { type: "Individual", lastName: parts[0], createPortalAccount: false };
  return {
    type: "Individual",
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
    createPortalAccount: false,
  };
}

export function InlineCreateCustomerDialog({ open, onClose, prefillText = "", onCreated }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<CreateBody>(() => seedFromPrefill(prefillText));

  useEffect(() => {
    if (open) { setForm(seedFromPrefill(prefillText)); setErr(null); }
  }, [open, prefillText]);

  const create = useMutation({
    mutationFn: async () => {
      const body: CreateBody = {
        ...form,
        firstName: form.type === "Individual" ? form.firstName?.trim() || undefined : undefined,
        lastName:  form.type === "Individual" ? form.lastName?.trim()  || undefined : undefined,
        companyName: form.type === "Company"  ? form.companyName?.trim() || undefined : undefined,
        vatNumber:   form.vatNumber?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
      };
      return (await api.post<CreateResponse>("/customers", body)).data;
    },
    onSuccess: (data) => {
      // Refresh every customer-list query on the page — the caller's
      // dropdown re-reads and picks up the new option immediately.
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customers-lite"] });
      void qc.invalidateQueries({ queryKey: ["customers-lookup"] });
      const c = data.customer;
      const displayName = c.type === "Individual"
        ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
        : (c.companyName ?? "");
      onCreated({ id: c.id, displayName, vatNumber: c.vatNumber });
      onClose();
    },
    onError: e => setErr(extractErrorMessage(e)),
  });

  const canSave = form.type === "Individual"
    ? !!(form.firstName?.trim() || form.lastName?.trim())
    : !!form.companyName?.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("customers.createTitle", "Νέος πελάτης")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          {t("customers.inlineCreateHelp", "Γρήγορη προσθήκη — τα υπόλοιπα στοιχεία συμπληρώνονται από την καρτέλα πελάτη αργότερα.")}
        </Typography>
        <Stack spacing={2} mt={0.5}>
          <SearchableTextField
            select
            label={t("customers.type", "Τύπος")}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CustomerType })}
            fullWidth
          >
            <MenuItem value="Individual">{t("customers.individual", "Ιδιώτης")}</MenuItem>
            <MenuItem value="Company">{t("customers.company", "Εταιρεία")}</MenuItem>
          </SearchableTextField>
          {form.type === "Individual" ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Όνομα"
                value={form.firstName ?? ""}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
                fullWidth
                autoFocus
              />
              <TextField
                label="Επώνυμο"
                value={form.lastName ?? ""}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
                fullWidth
              />
            </Stack>
          ) : (
            <TextField
              label="Επωνυμία εταιρείας"
              value={form.companyName ?? ""}
              onChange={e => setForm({ ...form, companyName: e.target.value })}
              fullWidth
              autoFocus
            />
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="ΑΦΜ"
              value={form.vatNumber ?? ""}
              onChange={e => setForm({ ...form, vatNumber: e.target.value })}
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
            label="Email"
            type="email"
            value={form.email ?? ""}
            onChange={e => setForm({ ...form, email: e.target.value })}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", "Άκυρο")}</Button>
        <Button
          variant="contained"
          disabled={!canSave || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <CircularProgress size={18} /> : t("common.save", "Αποθήκευση")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Suppress unused-imports warnings.
void Box;
