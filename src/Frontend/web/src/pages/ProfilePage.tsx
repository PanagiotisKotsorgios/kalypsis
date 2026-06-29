import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
  MenuItem, Stack, TextField, Typography
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import LockResetIcon from "@mui/icons-material/LockReset";
import SchoolIcon from "@mui/icons-material/School";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { PasswordField } from "../components/PasswordField";
import { resetTourForRole } from "../components/KalypsisOnboarding";
import { TwoFactorSection } from "../components/TwoFactorSection";

interface Profile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  preferredLanguage: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => (await api.get<Profile>("/me")).data
  });

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", preferredLanguage: "el" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profileQuery.data) {
      setForm({
        firstName: profileQuery.data.firstName,
        lastName: profileQuery.data.lastName,
        phone: profileQuery.data.phone ?? "",
        preferredLanguage: profileQuery.data.preferredLanguage
      });
    }
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: async () => (await api.put<Profile>("/me", form)).data,
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["me-profile"] });
      void i18n.changeLanguage(d.preferredLanguage);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const changePw = useMutation({
    mutationFn: async () => api.post("/me/password", { currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: () => {
      setPw({ current: "", next: "", confirm: "" });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    },
    onError: (err) => setPwError(extractErrorMessage(err))
  });

  if (profileQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("profile.title")}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t("profile.subtitle")}</Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("profile.section.basic")}</Typography>
            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
            {saved && <Alert severity="success" sx={{ mb: 2 }}>{t("profile.saved")}</Alert>}
            <Stack spacing={2.5}>
              <TextField value={profileQuery.data?.email ?? ""} label={t("profile.email")} disabled fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label={t("profile.firstName")} value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })} fullWidth required />
                <TextField label={t("profile.lastName")} value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })} fullWidth required />
              </Stack>
              <TextField label={t("profile.phone")} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
              <TextField select label={t("profile.language")} value={form.preferredLanguage}
                onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })} fullWidth sx={{ maxWidth: 280 }}>
                <MenuItem value="el">Ελληνικά</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </TextField>
              <Button variant="contained" startIcon={<SaveIcon />}
                onClick={() => save.mutate()} disabled={save.isPending}
                sx={{ alignSelf: "flex-start", fontWeight: 700, px: 3 }}>
                {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("profile.section.password")}</Typography>
            {pwError && <Alert severity="error" onClose={() => setPwError(null)} sx={{ mb: 2 }}>{pwError}</Alert>}
            {pwSaved && <Alert severity="success" sx={{ mb: 2 }}>{t("profile.passwordChanged")}</Alert>}
            <Stack spacing={2.5}>
              <PasswordField label={t("profile.currentPassword")} value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })} fullWidth />
              <Divider />
              <PasswordField label={t("profile.newPassword")} value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })} fullWidth
                helperText={t("reset.passwordHelp")} />
              <PasswordField label={t("profile.confirmPassword")} value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} fullWidth />
              <Button variant="outlined" startIcon={<LockResetIcon />}
                onClick={() => {
                  setPwError(null);
                  if (pw.next.length < 8) { setPwError(t("reset.errors.short")); return; }
                  if (pw.next !== pw.confirm) { setPwError(t("reset.errors.mismatch")); return; }
                  changePw.mutate();
                }}
                disabled={changePw.isPending}
                sx={{ alignSelf: "flex-start", fontWeight: 700, px: 3 }}>
                {changePw.isPending ? <CircularProgress size={18} /> : t("profile.changePassword")}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <SchoolIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>{t("profile.tutorial.title")}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("profile.tutorial.body")}
            </Typography>
            <Button variant="outlined" startIcon={<SchoolIcon />}
              onClick={() => {
                if (profileQuery.data?.role) {
                  resetTourForRole(profileQuery.data.role);
                  window.location.reload();
                }
              }}
              disabled={!profileQuery.data?.role}
            >
              {t("profile.tutorial.restart")}
            </Button>
          </CardContent>
        </Card>

        <TwoFactorSection />
      </Stack>
    </Box>
  );
}
