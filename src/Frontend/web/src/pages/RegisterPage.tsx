import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { PageEnter } from "../components/PageEnter";
import { authFieldSx, authButtonSx, authLabelSx } from "./authShared";
import { api, extractErrorMessage } from "../api/client";

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

  const handleSubmit = async (e: FormEvent) => {
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
    try {
      const { data } = await api.post<{ referenceCode: string }>("/public/register", {
        firstName:        form.firstName.trim(),
        lastName:         form.lastName.trim(),
        email:            form.email.trim(),
        phone:            form.phone.trim(),
        organizationName: form.organizationName.trim() || null,
        vatNumber:        form.vatNumber.trim() || null,
        licenseNumber:    form.licenseNumber.trim() || null,
        city:             form.city.trim() || null,
        message:          form.message.trim() || null
      });
      setSubmitted({ ref: data.referenceCode });
    } catch (err) {
      setError(extractErrorMessage(err, t("register.errors.submit")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageEnter stagger={400}>
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" }
      }}
    >
      {/* Left: pure white panel, just the big logo */}
      <Box
        sx={{
          position: "relative",
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#ffffff",
          borderRight: "1px solid",
          borderColor: "rgba(11,37,69,0.06)",
          p: 6
        }}
      >
        <Box
          component={RouterLink}
          to="/"
          sx={{ display: "inline-flex", textDecoration: "none", maxWidth: "82%" }}
        >
          <KalypsisLogo size={420} />
        </Box>
      </Box>

      {/* Right: slightly off-white form panel */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          p: { xs: 3, md: 5 },
          bgcolor: "#dfe6f0"
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
          <Button
            component={RouterLink}
            to="/"
            startIcon={<ArrowBackIcon />}
            color="inherit"
            size="small"
          >
            {t("nav.back")}
          </Button>
          <LanguageToggle />
        </Stack>

        <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", py: 4 }}>
          <Container maxWidth="sm" disableGutters>
            {/* Mobile-only mini logo */}
            <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: 3 }}>
              <KalypsisLogo size={80} />
            </Box>

            {submitted ? (
              <Box sx={{ textAlign: "center" }}>
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
                    bgcolor: "rgba(255,255,255,0.7)",
                    border: "1px dashed",
                    borderColor: "rgba(11,37,69,0.2)",
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
              </Box>
            ) : (
              <>
                <Stack spacing={1.25} mb={4.5}>
                  <Typography sx={{
                    fontSize: { xs: 30, md: 38 }, fontWeight: 800,
                    letterSpacing: "-0.02em", lineHeight: 1.1, color: "#0b2545"
                  }}>
                    {t("register.formTitle")}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 16, md: 17 }, color: "rgba(11,37,69,0.7)" }}>
                    {t("register.formLead")}
                  </Typography>
                </Stack>

                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontSize: 15 }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <Stack spacing={3}>
                    <Typography sx={{
                      fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase",
                      color: "rgba(11,37,69,0.7)", fontWeight: 700
                    }}>
                      {t("register.sections.personal")}
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
                      <TextField
                        label={t("register.firstName")}
                        value={form.firstName}
                        onChange={(e) => set("firstName", e.target.value)}
                        fullWidth required disabled={submitting}
                        InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                      />
                      <TextField
                        label={t("register.lastName")}
                        value={form.lastName}
                        onChange={(e) => set("lastName", e.target.value)}
                        fullWidth required disabled={submitting}
                        InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                      />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
                      <TextField
                        label={t("register.email")}
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        fullWidth required autoComplete="email" disabled={submitting}
                        InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                      />
                      <TextField
                        label={t("register.phone")}
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        fullWidth required autoComplete="tel" disabled={submitting}
                        InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                      />
                    </Stack>
                    <TextField
                      label={t("register.city")}
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                      fullWidth disabled={submitting}
                      InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                    />

                    <Typography sx={{
                      fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase",
                      color: "rgba(11,37,69,0.7)", fontWeight: 700, mt: 1
                    }}>
                      {t("register.sections.professional")}
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
                      <TextField
                        label={t("register.organizationName")}
                        value={form.organizationName}
                        onChange={(e) => set("organizationName", e.target.value)}
                        fullWidth disabled={submitting}
                        InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                      />
                      <TextField
                        label={t("register.vat")}
                        value={form.vatNumber}
                        onChange={(e) => set("vatNumber", e.target.value.replace(/\D/g, "").slice(0, 9))}
                        fullWidth disabled={submitting}
                        InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                      />
                    </Stack>
                    <TextField
                      label={t("register.licenseNumber")}
                      helperText={t("register.licenseNumberHelp")}
                      value={form.licenseNumber}
                      onChange={(e) => set("licenseNumber", e.target.value)}
                      fullWidth disabled={submitting}
                      InputLabelProps={{ sx: authLabelSx }}
                      FormHelperTextProps={{ sx: { fontSize: 13.5 } }}
                      sx={authFieldSx}
                    />

                    <Typography sx={{
                      fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase",
                      color: "rgba(11,37,69,0.7)", fontWeight: 700, mt: 1
                    }}>
                      {t("register.sections.message")}
                    </Typography>
                    <TextField
                      label={t("register.message")}
                      value={form.message}
                      onChange={(e) => set("message", e.target.value)}
                      fullWidth multiline rows={3} disabled={submitting}
                      InputLabelProps={{ sx: authLabelSx }} sx={authFieldSx}
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.agreedTerms}
                          onChange={(e) => set("agreedTerms", e.target.checked)}
                          disabled={submitting}
                          sx={{ alignSelf: "flex-start", mt: -0.5, color: "rgba(11,37,69,0.55)" }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: 15, color: "rgba(11,37,69,0.78)", lineHeight: 1.55 }}>
                          {t("register.terms")}
                        </Typography>
                      }
                      sx={{ alignItems: "flex-start", ml: -0.5 }}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disableElevation
                      disabled={submitting}
                      startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                      sx={{ ...authButtonSx, mt: 0.5 }}
                    >
                      {submitting ? t("register.submitting") : t("register.submit")}
                    </Button>
                  </Stack>
                </form>

                <Box sx={{ mt: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("register.alreadyHave")}{" "}
                    <Link component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
                      {t("auth.signIn")}
                    </Link>
                  </Typography>
                </Box>
              </>
            )}
          </Container>
        </Box>
      </Box>
    </Box>
    </PageEnter>
  );
}
