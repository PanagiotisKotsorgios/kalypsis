import { useEffect, useState, type FormEvent } from "react";
import {
  Alert, Box, Button, CircularProgress, Container, Link, Stack, Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate, useSearchParams, Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { PageEnter } from "../components/PageEnter";
import { PasswordField } from "../components/PasswordField";
import { authFieldSx, authButtonSx, authLabelSx } from "./authShared";

/**
 * Reset-password screen. Uses the same split-panel layout as /login,
 * /register and /forgot-password — pure white logo panel on the left,
 * tinted form panel on the right. The marketing PublicShell used to
 * wrap this page but its nav didn't belong in a mid-flow auth screen.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tk = params.get("token");
    if (!tk) setError(t("reset.errors.noToken"));
    else setToken(tk);
  }, [params, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError(t("reset.errors.short")); return; }
    if (newPassword !== confirmPassword) { setError(t("reset.errors.mismatch")); return; }
    if (!token) return;
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 3500);
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
      {/* Left panel — pure white, big logo. Mirror of /forgot-password. */}
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

      {/* Right panel — tinted form. */}
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

            {success ? (
              <Stack spacing={3} alignItems="center" textAlign="center">
                <CheckCircleIcon sx={{ fontSize: 72, color: "success.main" }} />
                <Typography sx={{
                  fontSize: { xs: 30, md: 38 }, fontWeight: 800,
                  letterSpacing: "-0.02em", lineHeight: 1.1, color: "#0b2545"
                }}>
                  {t("reset.success.title")}
                </Typography>
                <Typography sx={{ fontSize: 17, lineHeight: 1.7, color: "rgba(11,37,69,0.7)" }}>
                  {t("reset.success.body")}
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
                    {t("reset.title")}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 16, md: 17 }, color: "rgba(11,37,69,0.7)" }}>
                    {t("reset.subtitle")}
                  </Typography>
                </Stack>

                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontSize: 15 }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <Stack spacing={3}>
                    <PasswordField
                      label={t("reset.newPassword")}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      helperText={t("reset.passwordHelp")}
                      required fullWidth autoFocus
                      disabled={submitting || !token}
                      InputLabelProps={{ sx: authLabelSx }}
                      FormHelperTextProps={{ sx: { fontSize: 13.5 } }}
                      sx={authFieldSx}
                    />
                    <PasswordField
                      label={t("reset.confirmPassword")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required fullWidth
                      disabled={submitting || !token}
                      InputLabelProps={{ sx: authLabelSx }}
                      sx={authFieldSx}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disableElevation
                      disabled={submitting || !token}
                      startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                      sx={authButtonSx}
                    >
                      {submitting ? t("reset.saving") : t("reset.submit")}
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
