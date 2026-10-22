import { InputAdornment, Stack, TextField } from "@mui/material";

export interface RenewalPremiumDraft { gross: string; net: string }

export function renewalPremiumDefaults(policy: { premium: number; netPremium?: number | null } | null): RenewalPremiumDraft {
  return { gross: policy ? String(policy.premium) : "", net: policy?.netPremium == null ? "" : String(policy.netPremium) };
}

export function renewalPremiumPayload(draft: RenewalPremiumDraft) {
  const gross = draft.gross.trim();
  const net = draft.net.trim();
  if (!gross || !Number.isFinite(Number(gross)) || Number(gross) < 0) throw new Error("Συμπληρώστε έγκυρα μη αρνητικά μικτά ασφάλιστρα.");
  if (net && (!Number.isFinite(Number(net)) || Number(net) < 0)) throw new Error("Συμπληρώστε έγκυρα μη αρνητικά καθαρά ασφάλιστρα.");
  return { premium: Number(gross), netPremium: net ? Number(net) : null };
}

export function PolicyRenewalPremiumFields({ value, onChange, currency = "EUR" }: {
  value: RenewalPremiumDraft; onChange: (next: RenewalPremiumDraft) => void; currency?: string;
}) {
  return <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
    <TextField type="number" label="Μικτά ασφάλιστρα" value={value.gross}
      onChange={event => onChange({ ...value, gross: event.target.value })} fullWidth required
      inputProps={{ min: 0, step: "0.01" }}
      InputProps={{ endAdornment: <InputAdornment position="end">{currency}</InputAdornment> }} />
    <TextField type="number" label="Καθαρά ασφάλιστρα" value={value.net}
      onChange={event => onChange({ ...value, net: event.target.value })} fullWidth
      inputProps={{ min: 0, step: "0.01" }}
      helperText="Κενό: διατήρηση προηγούμενων καθαρών ασφαλίστρων."
      InputProps={{ endAdornment: <InputAdornment position="end">{currency}</InputAdornment> }} />
  </Stack>;
}
