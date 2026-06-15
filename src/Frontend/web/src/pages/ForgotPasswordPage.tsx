import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Link,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { PublicShell } from "../components/PublicShell";
import { KalypsisLogo } from "../components/KalypsisLogo";

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
      const res = await api.post<{ ok: boolean; message: string }>("/auth/forgot-password", { email: email.trim() });
      setSentMessage(res.data.message);
    } catch (err) {
      setError(extractErrorMessage(err, t("auth.errors.generic")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicShell>
      <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <KalypsisLogo size={80} />
        </Box>

        <Card sx={{ p: { xs: 4, md: 5 }, borderRadius: 4, bgcolor: "#fbfcfd" }}>
          {sentMessage ? (
            <Stack spacing={3} alignItems="center" textAlign="center">
              <CheckCircleIcon sx={{ fontSize: 64, color: "success.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {t("forgot.success.title")}
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {sentMessage}
              </Typography>
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                size="large"
                startIcon={<ArrowBackIcon />}
                sx={{ fontWeight: 700, mt: 2 }}
              >
                {t("forgot.backToLogin")}
              </Button>
            </Stack>
          ) : (
            <>
              <Stack direction="row" spacing={2} alignItems="center" mb={3}>
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    bgcolor: "primary.main",
                    color: "common.white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <MailOutlineIcon />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {t("forgot.title")}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                    {t("forgot.subtitle")}
                  </Typography>
                </Box>
              </Stack>

              {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <TextField
                    label={t("auth.email")}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                    autoFocus
                    disabled={submitting}
                    helperText={t("forgot.emailHelp")}
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
                    {submitting ? t("forgot.sending") : t("forgot.submit")}
                  </Button>
                </Stack>
              </form>

              <Box sx={{ mt: 4, textAlign: "center" }}>
                <Link component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
                  {t("forgot.backToLogin")}
                </Link>
              </Box>
            </>
          )}
        </Card>
      </Container>
    </PublicShell>
  );
}
