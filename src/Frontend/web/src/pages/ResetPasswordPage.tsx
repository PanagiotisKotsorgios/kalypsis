import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Stack,
  Typography
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate, useSearchParams, Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { PublicShell } from "../components/PublicShell";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { PasswordField } from "../components/PasswordField";

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
    if (newPassword.length < 8) {
      setError(t("reset.errors.short"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("reset.errors.mismatch"));
      return;
    }
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
    <PublicShell>
      <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <KalypsisLogo size={80} />
        </Box>

        <Card sx={{ p: { xs: 4, md: 5 }, borderRadius: 4, bgcolor: "#fbfcfd" }}>
          {success ? (
            <Stack spacing={3} alignItems="center" textAlign="center">
              <CheckCircleIcon sx={{ fontSize: 64, color: "success.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {t("reset.success.title")}
              </Typography>
              <Typography color="text.secondary">{t("reset.success.body")}</Typography>
              <Button component={RouterLink} to="/login" variant="contained">
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
                  <LockResetIcon />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {t("reset.title")}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                    {t("reset.subtitle")}
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
                  <PasswordField
                    label={t("reset.newPassword")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    helperText={t("reset.passwordHelp")}
                    required
                    fullWidth
                    autoFocus
                    disabled={submitting || !token}
                  />
                  <PasswordField
                    label={t("reset.confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    fullWidth
                    disabled={submitting || !token}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={submitting || !token}
                    startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                    sx={{ py: 1.4, fontWeight: 700 }}
                  >
                    {submitting ? t("reset.saving") : t("reset.submit")}
                  </Button>
                </Stack>
              </form>
            </>
          )}
        </Card>
      </Container>
    </PublicShell>
  );
}
