import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { PasswordField } from "../components/PasswordField";
import { extractErrorMessage } from "../api/client";

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, t("auth.errors.generic")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          bgcolor: "background.default"
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
          <Container maxWidth="xs" disableGutters>
            {/* Mobile-only mini logo */}
            <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: 3 }}>
              <KalypsisLogo size={80} />
            </Box>

            <Stack spacing={1} mb={3.5}>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                {t("auth.loginTitle")}
              </Typography>
              <Typography color="text.secondary">
                {t("auth.loginSubtitle")}
              </Typography>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <Stack spacing={2.5}>
                <TextField
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  fullWidth
                  autoComplete="email"
                  disabled={submitting}
                />
                <PasswordField
                  label={t("auth.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  autoComplete="current-password"
                  disabled={submitting}
                />

                <Box sx={{ textAlign: "right", mt: -1 }}>
                  <Link
                    component={RouterLink}
                    to="/forgot-password"
                    sx={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {t("login.forgot")}
                  </Link>
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                  sx={{ py: 1.5, fontWeight: 700, fontSize: 16 }}
                >
                  {submitting ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("login.noAccountQ")}{" "}
                <Link component={RouterLink} to="/register" sx={{ fontWeight: 600 }}>
                  {t("login.registerHere")}
                </Link>
              </Typography>
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
