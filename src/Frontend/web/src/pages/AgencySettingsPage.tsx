import { useEffect, useRef, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  InputAdornment, Stack, TextField, Typography
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import UploadIcon from "@mui/icons-material/Upload";
import DeleteIcon from "@mui/icons-material/Delete";
import BusinessIcon from "@mui/icons-material/Business";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoVersion, setLogoVersion] = useState(0); // cache-bust preview after upload

  const hasLogo = !!q.data?.logoUrl;
  const logoPreviewUrl = hasLogo ? `/api/agency-profile/logo?v=${logoVersion}` : null;

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

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<AgencyProfile>("/agency-profile/logo", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return res.data;
    },
    onSuccess: () => {
      setLogoVersion((v) => v + 1);
      void qc.invalidateQueries({ queryKey: ["agency-profile"] });
      void qc.invalidateQueries({ queryKey: ["tenant-logo"] });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const deleteLogo = useMutation({
    mutationFn: async () => (await api.delete<AgencyProfile>("/agency-profile/logo")).data,
    onSuccess: () => {
      setLogoVersion((v) => v + 1);
      void qc.invalidateQueries({ queryKey: ["agency-profile"] });
      void qc.invalidateQueries({ queryKey: ["tenant-logo"] });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (f.size > 4_000_000) {
      setError(t("agencySettings.logoTooBig"));
      return;
    }
    uploadLogo.mutate(f);
    e.target.value = "";
  };

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

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t("agencySettings.logoLabel")}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                  <Avatar
                    src={logoPreviewUrl ?? undefined}
                    variant="rounded"
                    sx={{
                      width: 96, height: 96, bgcolor: "rgba(11,37,69,0.06)",
                      border: "1px solid", borderColor: "divider",
                      "& img": { objectFit: "contain", p: 1 }
                    }}
                  >
                    <BusinessIcon sx={{ color: "text.disabled", fontSize: 36 }} />
                  </Avatar>
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      hidden
                      onChange={handleFile}
                    />
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        onClick={() => fileRef.current?.click()}
                        disabled={uploadLogo.isPending}
                      >
                        {uploadLogo.isPending ? <CircularProgress size={18} /> : t("agencySettings.logoUploadBtn")}
                      </Button>
                      {hasLogo && (
                        <Button
                          variant="text"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => deleteLogo.mutate()}
                          disabled={deleteLogo.isPending}
                        >
                          {t("agencySettings.logoRemove")}
                        </Button>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t("agencySettings.logoHelp")}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

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
