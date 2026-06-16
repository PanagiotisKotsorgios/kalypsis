import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  InputAdornment, Stack, TextField, Typography
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface AgencyProfile {
  tenantId: string;
  name: string;
  code: string;
  subscriptionPlan: string;
  logoUrl: string | null;
  brandColorHex: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  vatNumber: string | null;
  defaultCurrency: string;
  defaultPolicyDurationMonths: number;
}

export function AgencySettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["agency-profile"],
    queryFn: async () => (await api.get<AgencyProfile>("/agency-profile")).data
  });

  const [form, setForm] = useState({
    name: "", logoUrl: "", brandColorHex: "#0b2545",
    contactEmail: "", contactPhone: "", addressLine: "", vatNumber: "",
    defaultCurrency: "EUR", defaultPolicyDurationMonths: 12
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) {
      setForm({
        name: q.data.name,
        logoUrl: q.data.logoUrl ?? "",
        brandColorHex: q.data.brandColorHex ?? "#0b2545",
        contactEmail: q.data.contactEmail ?? "",
        contactPhone: q.data.contactPhone ?? "",
        addressLine: q.data.addressLine ?? "",
        vatNumber: q.data.vatNumber ?? "",
        defaultCurrency: q.data.defaultCurrency,
        defaultPolicyDurationMonths: q.data.defaultPolicyDurationMonths
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => (await api.put<AgencyProfile>("/agency-profile", form)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agency-profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  if (q.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("agencySettings.title")}</Typography>
        {q.data && <Chip label={q.data.code} variant="outlined" />}
        {q.data && <Chip label={q.data.subscriptionPlan} color="primary" />}
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t("agencySettings.subtitle")}</Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>{t("agencySettings.saved")}</Alert>}

      <Stack spacing={3}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("agencySettings.section.identity")}</Typography>
            <Stack spacing={2.5}>
              <TextField label={t("agencySettings.name")} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
              <TextField label={t("agencySettings.logoUrl")} value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} fullWidth
                helperText={t("agencySettings.logoHelp")} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <TextField label={t("agencySettings.brandColor")} value={form.brandColorHex}
                  onChange={(e) => setForm({ ...form, brandColorHex: e.target.value })} fullWidth
                  helperText="#0b2545"
                  InputProps={{ startAdornment: <InputAdornment position="start">#</InputAdornment> }} />
                <Box sx={{ width: 56, height: 56, borderRadius: 1.5, border: "1px solid", borderColor: "divider", bgcolor: form.brandColorHex }} />
              </Stack>
              <TextField label={t("agencySettings.vat")} value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} fullWidth />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("agencySettings.section.contact")}</Typography>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label={t("agencySettings.contactEmail")} type="email" value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} fullWidth />
                <TextField label={t("agencySettings.contactPhone")} value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} fullWidth />
              </Stack>
              <TextField label={t("agencySettings.addressLine")} value={form.addressLine}
                onChange={(e) => setForm({ ...form, addressLine: e.target.value })} fullWidth />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("agencySettings.section.defaults")}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label={t("agencySettings.currency")} value={form.defaultCurrency}
                onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                fullWidth helperText={t("agencySettings.currencyHelp")} />
              <TextField type="number" label={t("agencySettings.duration")} value={form.defaultPolicyDurationMonths}
                onChange={(e) => setForm({ ...form, defaultPolicyDurationMonths: Number(e.target.value) })}
                fullWidth helperText={t("agencySettings.durationHelp")}
                InputProps={{ endAdornment: <InputAdornment position="end">{t("agencySettings.months")}</InputAdornment> }} />
            </Stack>
          </CardContent>
        </Card>

        <Button variant="contained" size="large" startIcon={<SaveIcon />}
          onClick={() => save.mutate()} disabled={save.isPending}
          sx={{ alignSelf: "flex-start", fontWeight: 700, px: 4, py: 1.4 }}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </Stack>
    </Box>
  );
}
