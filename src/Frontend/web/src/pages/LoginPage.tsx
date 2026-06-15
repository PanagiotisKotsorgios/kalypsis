import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  useTheme
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { extractErrorMessage } from "../api/client";

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
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
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }
      }}
    >
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 70%, ${theme.palette.secondary.main} 130%)`,
          color: "common.white",
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "center",
          p: 6
        }}
      >
        <Stack spacing={3} maxWidth={420}>
          <KalypsisLogo size={56} color="light" />
          <Typography variant="h3" fontWeight={800}>
            {t("landing.headline")}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, opacity: 0.92 }}>
            {t("landing.lead")}
          </Typography>
          <Box sx={{ mt: 4, opacity: 0.85, fontSize: 14 }}>{t("app.tagline")}</Box>
        </Stack>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", p: { xs: 3, md: 6 } }}>
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
          <Card sx={{ width: 420, maxWidth: "100%", boxShadow: { xs: "none", md: undefined } }} elevation={0}>
            <CardContent sx={{ p: { xs: 0, md: 3 } }}>
              <Stack spacing={1} mb={4}>
                <Box sx={{ display: { xs: "block", md: "none" }, mb: 2 }}>
                  <KalypsisLogo size={48} />
                </Box>
                <Typography variant="h4" fontWeight={800}>
                  {t("auth.loginTitle")}
                </Typography>
                <Typography color="text.secondary">{t("auth.loginSubtitle")}</Typography>
              </Stack>

              {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <Stack spacing={2}>
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
                  <TextField
                    label={t("auth.password")}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                    autoComplete="current-password"
                    disabled={submitting}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                  >
                    {submitting ? t("auth.signingIn") : t("auth.signIn")}
                  </Button>
                  <Typography variant="caption" color="text.secondary" align="center">
                    {t("auth.noAccount")}
                  </Typography>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
