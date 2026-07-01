import { useEffect, useRef, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  InputAdornment, Popover, Stack, TextField, Typography
} from "@mui/material";
import ColorLensIcon from "@mui/icons-material/ColorLens";
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
  // Local FileReader preview so the operator sees the new logo the moment
  // they pick the file — before the POST resolves. Cleared on upload
  // success (the fresh server URL takes over) or dialog cancel.
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const hasLogo = !!q.data?.logoUrl;
  const logoPreviewUrl = localPreview ?? (hasLogo ? `/api/agency-profile/logo?v=${logoVersion}` : null);

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
      setLocalPreview(null);
      void qc.invalidateQueries({ queryKey: ["agency-profile"] });
      void qc.invalidateQueries({ queryKey: ["tenant-logo"] });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const deleteLogo = useMutation({
    mutationFn: async () => (await api.delete<AgencyProfile>("/agency-profile/logo")).data,
    onSuccess: () => {
      setLogoVersion((v) => v + 1);
      setLocalPreview(null);
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
    // Live preview — read the picked file into a data URL and drop it into
    // `localPreview` so the Avatar re-renders immediately, even before the
    // POST returns.
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLocalPreview(reader.result);
    };
    reader.readAsDataURL(f);
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

              <ColorPickerField
                label={t("agencySettings.brandColor")}
                value={form.brandColorHex}
                onChange={(v) => setForm({ ...form, brandColorHex: v })}
              />
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
            {/* Default policy duration lived here but has been moved: it's now
                a per-carrier/per-line-of-business setting on the platform
                παραμετρικά page, so keeping it here caused two sources of
                truth. */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label={t("agencySettings.currency")} value={form.defaultCurrency}
                onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                fullWidth helperText={t("agencySettings.currencyHelp")} />
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

/**
 * ColorPickerField — a text-field-shaped control that opens a popover with
 * a native color input + a compact swatch palette when clicked. Emits hex
 * strings ("#0b2545") on change; accepts either "#0b2545" or "0b2545".
 *
 * Rationale over the previous plain TextField: users copy hex codes wrong
 * more often than they get the color they wanted. The popover surfaces both
 * the native color-wheel + a curated Kalypsis-brand palette so most picks
 * are one click.
 */
function ColorPickerField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const hex = normaliseHex(value);
  // Curated palette — brand-safe navy/blue/accent tones + a set of common
  // enterprise colors that read well on dark navy dashboards.
  const PALETTE = [
    "#0b2545", "#13315c", "#1ea7e1", "#1f7bb3", "#2f6bd6",
    "#0f4c81", "#005f73", "#2a9d8f", "#5b8b3e", "#c88820",
    "#a85c40", "#c62828", "#6a1b9a", "#1a1a1a", "#4a5568",
  ];

  return (
    <>
      <TextField
        label={label}
        value={hex}
        onChange={(e) => onChange(normaliseHex(e.target.value))}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Box
                onClick={(e) => setAnchor(e.currentTarget as HTMLElement)}
                sx={{
                  width: 28, height: 28, borderRadius: 1,
                  border: "1px solid", borderColor: "divider",
                  bgcolor: hex, cursor: "pointer",
                  transition: "transform 120ms ease",
                  "&:hover": { transform: "scale(1.08)" }
                }}
              />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Button size="small" startIcon={<ColorLensIcon />}
                onClick={(e) => setAnchor(e.currentTarget as HTMLElement)}>
                Επιλογή
              </Button>
            </InputAdornment>
          )
        }}
      />
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 2, minWidth: 260 } } }}
      >
        <Stack spacing={1.5}>
          <Typography variant="caption" color="text.secondary">Ελεύθερη επιλογή</Typography>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <Box
              component="input"
              type="color"
              value={hex}
              onChange={(e) => onChange((e.target as HTMLInputElement).value)}
              sx={{
                width: 44, height: 44, border: "1px solid",
                borderColor: "divider", borderRadius: 1, p: 0, cursor: "pointer",
                bgcolor: "transparent"
              }}
            />
            <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{hex}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Παλέτα Kalypsis</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0.75 }}>
            {PALETTE.map(c => (
              <Box
                key={c}
                onClick={() => { onChange(c); setAnchor(null); }}
                sx={{
                  aspectRatio: "1 / 1", borderRadius: 1, cursor: "pointer",
                  bgcolor: c,
                  outline: c.toLowerCase() === hex.toLowerCase() ? "2px solid" : "1px solid",
                  outlineColor: c.toLowerCase() === hex.toLowerCase() ? "primary.main" : "divider",
                  transition: "transform 120ms ease",
                  "&:hover": { transform: "scale(1.12)" }
                }}
              />
            ))}
          </Box>
        </Stack>
      </Popover>
    </>
  );
}

function normaliseHex(v: string): string {
  const s = (v ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3,8}$/.test(s)) return "#0b2545";
  const canon = s.length === 3
    ? s.split("").map(c => c + c).join("")
    : s.slice(0, 6);
  return "#" + canon.toLowerCase();
}
