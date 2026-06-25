import { useState, type FormEvent } from "react";
import {
  Alert, Box, Button, CircularProgress, Container, Link, Stack, TextField, Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { PageEnter } from "../components/PageEnter";
import { authFieldSx, authButtonSx, authLabelSx } from "./authShared";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ ok: boolean; message: string }>(
        "/auth/forgot-password", { email: email.trim() });
      setSentMessage(res.data.message);
    } catch (err) {
      setError(extractErrorMessage(err, t("auth.errors.generic")));
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
      {/* Left: pure white panel, just the big logo (matches /login & /register). */}
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

      {/* Right: slightly off-white form panel. */}
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
            to="/login"
            startIcon={<ArrowBackIcon />}
            color="inherit"
            size="small"
          >
            {t("forgot.backToLogin")}
          </Button>
          <LanguageToggle />
        </Stack>

        <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Container maxWidth="sm" disableGutters>
            {/* Mobile-only mini logo */}
            <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: 3 }}>
              <KalypsisLogo size={80} />
            </Box>

            {sentMessage ? (
              <Stack spacing={3} alignItems="center" textAlign="center">
                <CheckCircleIcon sx={{ fontSize: 72, color: "success.main" }} />
                <Typography sx={{
                  fontSize: { xs: 30, md: 38 }, fontWeight: 800,
                  letterSpacing: "-0.02em", lineHeight: 1.1, color: "#0b2545"
                }}>
                  {t("forgot.success.title")}
                </Typography>
                <Typography sx={{ fontSize: 17, lineHeight: 1.7, color: "rgba(11,37,69,0.7)" }}>
                  {sentMessage}
                </Typography>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="contained"
                  size="large"
                  disableElevation
                  startIcon={<ArrowBackIcon />}
                  fullWidth
                  sx={{ ...authButtonSx, mt: 2 }}
                >
                  {t("forgot.backToLogin")}
                </Button>
              </Stack>
            ) : (
              <>
                <Stack spacing={1.25} mb={4.5}>
                  <Typography sx={{
                    fontSize: { xs: 30, md: 38 }, fontWeight: 800,
                    letterSpacing: "-0.02em", lineHeight: 1.1, color: "#0b2545"
                  }}>
                    {t("forgot.title")}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 16, md: 17 }, color: "rgba(11,37,69,0.7)" }}>
                    {t("forgot.subtitle")}
                  </Typography>
                </Stack>

                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontSize: 15 }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <Stack spacing={3}>
                    <TextField
                      label={t("auth.email")}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus required fullWidth
                      autoComplete="email"
                      disabled={submitting}
                      helperText={t("forgot.emailHelp")}
                      InputLabelProps={{ sx: authLabelSx }}
                      FormHelperTextProps={{ sx: { fontSize: 13.5 } }}
                      sx={authFieldSx}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disableElevation
                      disabled={submitting}
                      startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                      sx={authButtonSx}
                    >
                      {submitting ? t("forgot.sending") : t("forgot.submit")}
                    </Button>
                  </Stack>
                </form>

                <Box sx={{ mt: 4.5, textAlign: "center" }}>
                  <Typography sx={{ fontSize: 15, color: "rgba(11,37,69,0.7)" }}>
                    {t("login.noAccountQ")}{" "}
                    <Link component={RouterLink} to="/register"
                      sx={{ fontWeight: 800, fontSize: 15, color: "#0b2545",
                        textDecoration: "underline", textDecorationColor: "rgba(11,37,69,0.35)",
                        textUnderlineOffset: "3px",
                        "&:hover": { textDecorationColor: "#0b2545" }
                      }}>
                      {t("login.registerHere")}
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
