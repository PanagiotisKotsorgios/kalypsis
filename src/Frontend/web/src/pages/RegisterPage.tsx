import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { BrandImage } from "../components/BrandImage";

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  vatNumber: string;
  licenseNumber: string;
  city: string;
  message: string;
  agreedTerms: boolean;
};

const initial: RegisterForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  organizationName: "",
  vatNumber: "",
  licenseNumber: "",
  city: "",
  message: "",
  agreedTerms: false
};

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ ref: string } | null>(null);

  const set = <K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(t("register.errors.name"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError(t("register.errors.email"));
      return;
    }
    if (!form.phone.trim()) {
      setError(t("register.errors.phone"));
      return;
    }
    if (!form.agreedTerms) {
      setError(t("register.errors.terms"));
      return;
    }
    setError(null);
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const ref = `KLP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      setSubmitted({ ref });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 700);
  };

  if (submitted) {
    return (
      <PublicShell>
        <Container maxWidth="sm" sx={{ py: { xs: 10, md: 16 } }}>
          <Card sx={{ p: { xs: 4, md: 6 }, textAlign: "center", borderRadius: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: "success.main", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
              {t("register.success.title")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {t("register.success.body")}
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: "background.default",
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 2,
                mb: 4
              }}
            >
              <Typography variant="overline" color="text.secondary">
                {t("register.success.refCode")}
              </Typography>
              <Typography sx={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700 }}>
                {submitted.ref}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" onClick={() => navigate("/")}>
                {t("register.success.backHome")}
              </Button>
              <Button variant="contained" onClick={() => navigate("/login")}>
                {t("auth.signIn")}
              </Button>
            </Stack>
          </Card>
        </Container>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      {/* Hero */}
      <Box sx={{ position: "relative", py: { xs: 10, md: 14 }, color: "common.white", overflow: "hidden" }}>
        <BrandImage seed="kalypsis-register-greek-mosaic" width={1800} height={900} overlay="navy-strong" />
        <Container maxWidth="md" sx={{ position: "relative", textAlign: "center" }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="overline" sx={{ letterSpacing: 2.5, opacity: 0.8 }}>
              {t("register.eyebrow")}
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1 }}>
              {t("register.headline")}
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: 18, maxWidth: 640 }}>
              {t("register.lead")}
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Body */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 }, mt: { xs: -6, md: -8 }, position: "relative", zIndex: 2 }}>
        <Card sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
          <Button
            component={RouterLink}
            to="/"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{ mb: 2 }}
          >
            {t("nav.back")}
          </Button>

          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            {t("register.formTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
            {t("register.formLead")}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5 }}>
                {t("register.sections.personal")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("register.firstName")}
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.lastName")}
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  fullWidth
                  required
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("register.email")}
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.phone")}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  fullWidth
                  required
                />
              </Stack>
              <TextField
                label={t("register.city")}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                fullWidth
              />

              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5, mt: 1 }}>
                {t("register.sections.professional")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5 }}>
                {t("register.professionalHelp")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("register.organizationName")}
                  helperText={t("register.organizationHelp")}
                  value={form.organizationName}
                  onChange={(e) => set("organizationName", e.target.value)}
                  fullWidth
                />
                <TextField
                  label={t("register.vat")}
                  helperText={t("register.vatHelp")}
                  value={form.vatNumber}
                  onChange={(e) => set("vatNumber", e.target.value.replace(/\D/g, "").slice(0, 9))}
                  fullWidth
                />
              </Stack>
              <TextField
                label={t("register.licenseNumber")}
                helperText={t("register.licenseNumberHelp")}
                value={form.licenseNumber}
                onChange={(e) => set("licenseNumber", e.target.value)}
                fullWidth
              />

              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5, mt: 1 }}>
                {t("register.sections.message")}
              </Typography>
              <TextField
                label={t("register.message")}
                helperText={t("register.messageHelp")}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                fullWidth
                multiline
                rows={4}
              />

              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mt: 1 }}>
                <input
                  type="checkbox"
                  checked={form.agreedTerms}
                  onChange={(e) => set("agreedTerms", e.target.checked)}
                  style={{ marginTop: 5 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {t("register.terms")}
                </Typography>
              </Stack>

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                sx={{ alignSelf: "flex-start", fontWeight: 700, px: 4, py: 1.4 }}
              >
                {submitting ? t("register.submitting") : t("register.submit")}
              </Button>
            </Stack>
          </form>
        </Card>

        <Box sx={{ textAlign: "center", mt: 5 }}>
          <Typography color="text.secondary">
            {t("register.alreadyHave")}{" "}
            <Button component={RouterLink} to="/login" variant="text" sx={{ fontWeight: 700 }}>
              {t("auth.signIn")}
            </Button>
          </Typography>
        </Box>
      </Container>
    </PublicShell>
  );
}
