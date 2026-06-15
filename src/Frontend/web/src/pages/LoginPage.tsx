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
import ShieldIcon from "@mui/icons-material/Shield";
import { useTranslation } from "react-i18next";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { BrandImage } from "../components/BrandImage";
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
      {/* Left visual panel */}
      <Box
        sx={{
          position: "relative",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          color: "common.white",
          overflow: "hidden",
          p: 6
        }}
      >
        <BrandImage seed="kalypsis-login-greek-coast" width={1400} height={1600} overlay="navy-strong" />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: "relative", zIndex: 1 }}>
          <Box component={RouterLink} to="/" sx={{ display: "inline-flex", textDecoration: "none" }}>
            <KalypsisLogo size={80} color="light" />
          </Box>
        </Stack>

        <Stack spacing={4} sx={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.85 }}>
            <ShieldIcon />
            <Typography variant="overline" sx={{ letterSpacing: 2 }}>
              {t("login.brandStrip")}
            </Typography>
          </Stack>
          <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.1, letterSpacing: -0.5 }}>
            {t("login.heroTitle")}
          </Typography>
          <Typography sx={{ fontSize: 17, lineHeight: 1.7, opacity: 0.92 }}>
            {t("login.heroBody")}
          </Typography>

          <Stack spacing={1.5} sx={{ pt: 2 }}>
            {["login.point1", "login.point2", "login.point3"].map((k) => (
              <Stack key={k} direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "secondary.main" }} />
                <Typography sx={{ opacity: 0.92 }}>{t(k)}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>

        <Typography variant="caption" sx={{ position: "relative", zIndex: 1, opacity: 0.7 }}>
          {t("login.footnote")}
        </Typography>
      </Box>

      {/* Right form panel */}
      <Box sx={{ display: "flex", flexDirection: "column", p: { xs: 3, md: 5 }, bgcolor: "background.default" }}>
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
            <Box sx={{ display: { xs: "block", md: "none" }, mb: 3 }}>
              <KalypsisLogo size={56} />
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
              {t("auth.loginTitle")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              {t("auth.loginSubtitle")}
            </Typography>

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
                  sx={{ py: 1.4, fontWeight: 700 }}
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

            <Box sx={{ mt: 4, p: 2, bgcolor: "background.paper", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, fontWeight: 600 }}>
                {t("login.demoLabel")}
              </Typography>
              <Typography variant="caption" component="div" sx={{ fontFamily: "monospace", lineHeight: 1.8 }}>
                superadmin@kalypsis.gr · Kalypsis@2026!
              </Typography>
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
