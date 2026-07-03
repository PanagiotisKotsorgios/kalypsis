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
import { useTranslation } from "react-i18next";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth, TwoFactorRequiredError, EmailCodeRequiredError } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { readPrefsFor } from "../theme/KalypsisThemeProvider";
import type { AuthUser } from "../auth/AuthContext";

/**
 * Resolves the post-login landing path from the freshly-authenticated
 * user's own saved preferences (per-user localStorage bucket). Falls
 * back to «/app» (dashboard) when nothing is stored yet — first-time
 * users always land on the platform default.
 */
function landingPath(user: AuthUser): string {
  try {
    const prefs = readPrefsFor(user.userId);
    switch (prefs.landingPage) {
      case "policies":   return "/app/policies";
      case "customers":  return "/app/customers";
      case "renewals":   return "/app/renewals";
      case "financials": return "/app/financials";
      case "tasks":      return "/app/tasks";
      case "dashboard":
      default:           return "/app";
    }
  } catch { return "/app"; }
}
import { PasswordField } from "../components/PasswordField";
import { PageEnter } from "../components/PageEnter";
import { extractErrorMessage } from "../api/client";
import { authFieldSx, authButtonSx, authLabelSx } from "./authShared";

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn, completeTwoFactor, completeEmailCode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When the backend reports 2FA is required, switch into code-entry mode.
  const [twoFactor, setTwoFactor] = useState<{ challengeToken: string } | null>(null);
  // Email-code step — a 6-digit code sent to the user's inbox after
  // password verification when the platform gate is enabled.
  const [emailCode, setEmailCode] = useState<{ challengeToken: string } | null>(null);
  const [code, setCode] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const authed = await signIn(email.trim(), password, rememberMe);
      navigate(landingPath(authed), { replace: true });
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setTwoFactor({ challengeToken: err.challengeToken });
      } else if (err instanceof EmailCodeRequiredError) {
        setEmailCode({ challengeToken: err.challengeToken });
      } else {
        setError(extractErrorMessage(err, t("auth.errors.generic")));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTwoFactorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFactor) return;
    setError(null);
    setSubmitting(true);
    try {
      const authed = await completeTwoFactor(twoFactor.challengeToken, code.trim(), rememberMe);
      navigate(landingPath(authed), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, "Λανθασμένος κωδικός 2FA."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailCode) return;
    setError(null);
    setSubmitting(true);
    try {
      const authed = await completeEmailCode(emailCode.challengeToken, code.trim(), rememberMe);
      navigate(landingPath(authed), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, "Λανθασμένος κωδικός."));
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

        <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Container maxWidth="sm" disableGutters>
            {/* Mobile-only mini logo */}
            <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: 3 }}>
              <KalypsisLogo size={80} />
            </Box>

            {/* Bigger, deeper-toned form. Inputs sit on white with a navy
                hairline border that thickens on hover/focus so the form
                feels grounded against the off-white panel background.    */}
            <Stack spacing={1.25} mb={4.5}>
              <Typography sx={{
                fontSize: { xs: 30, md: 38 }, fontWeight: 800,
                letterSpacing: "-0.02em", lineHeight: 1.1, color: "#0b2545"
              }}>
                {t("auth.loginTitle")}
              </Typography>
              <Typography sx={{ fontSize: { xs: 16, md: 17 }, color: "rgba(11,37,69,0.7)" }}>
                {t("auth.loginSubtitle")}
              </Typography>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontSize: 15 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {emailCode ? (
              <form onSubmit={handleEmailCodeSubmit} noValidate>
                <Stack spacing={3}>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Στείλαμε 6-ψήφιο κωδικό στο <strong>{email}</strong>. Ισχύει
                    για 10 λεπτά.
                  </Alert>
                  <TextField
                    label="Κωδικός email"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus required fullWidth
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    disabled={submitting}
                    InputLabelProps={{ sx: authLabelSx }}
                    sx={authFieldSx}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disableElevation
                    disabled={submitting || code.trim().length < 6}
                    startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                    sx={{ ...authButtonSx, mt: 0.5 }}
                  >
                    {submitting ? "Έλεγχος…" : "Επαλήθευση"}
                  </Button>
                  <Button
                    onClick={() => { setEmailCode(null); setCode(""); setError(null); }}
                    disabled={submitting}
                    sx={{ textTransform: "none", color: "rgba(11,37,69,0.7)" }}
                  >
                    Πίσω στη σύνδεση
                  </Button>
                </Stack>
              </form>
            ) : twoFactor ? (
              <form onSubmit={handleTwoFactorSubmit} noValidate>
                <Stack spacing={3}>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Πληκτρολογήστε τον 6-ψήφιο κωδικό από τον αυθεντικοποιητή σας
                    (ή έναν κωδικό ανάκτησης).
                  </Alert>
                  <TextField
                    label="Κωδικός 2FA"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus required fullWidth
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    disabled={submitting}
                    InputLabelProps={{ sx: authLabelSx }}
                    sx={authFieldSx}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disableElevation
                    disabled={submitting || code.trim().length < 6}
                    startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
                    sx={{ ...authButtonSx, mt: 0.5 }}
                  >
                    {submitting ? "Έλεγχος…" : "Επαλήθευση"}
                  </Button>
                  <Button
                    onClick={() => { setTwoFactor(null); setCode(""); setError(null); }}
                    disabled={submitting}
                    sx={{ textTransform: "none", color: "rgba(11,37,69,0.7)" }}
                  >
                    Πίσω στη σύνδεση
                  </Button>
                </Stack>
              </form>
            ) : (
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
                  InputLabelProps={{ sx: authLabelSx }}
                  sx={authFieldSx}
                />
                <PasswordField
                  label={t("auth.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required fullWidth
                  autoComplete="current-password"
                  disabled={submitting}
                  InputLabelProps={{ sx: authLabelSx }}
                  sx={authFieldSx}
                />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: -0.5 }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={submitting}
                        sx={{ color: "rgba(11,37,69,0.55)" }}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: 15, fontWeight: 600, color: "#0b2545" }}>
                        {t("auth.rememberMe")}
                      </Typography>
                    }
                    sx={{ ml: -0.5 }}
                  />
                  <Link
                    component={RouterLink}
                    to="/forgot-password"
                    sx={{ fontSize: 15, fontWeight: 700, color: "#1f7bb3",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" }
                    }}
                  >
                    {t("login.forgot")}
                  </Link>
                </Stack>

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
                  {submitting ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </Stack>
            </form>
            )}

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
          </Container>
        </Box>
      </Box>
    </Box>
    </PageEnter>
  );
}
