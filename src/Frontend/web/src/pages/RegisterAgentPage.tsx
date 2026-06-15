import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";

type AgentApplication = {
  firstName: string;
  lastName: string;
  fatherName: string;
  vatNumber: string;
  amka: string;
  licenseType: string;
  licenseNumber: string;
  licenseYear: string;
  workingMode: string;
  affiliatedAgencyName: string;
  city: string;
  email: string;
  phone: string;
  notes: string;
  agreedTerms: boolean;
};

const initial: AgentApplication = {
  firstName: "",
  lastName: "",
  fatherName: "",
  vatNumber: "",
  amka: "",
  licenseType: "agent",
  licenseNumber: "",
  licenseYear: "",
  workingMode: "independent",
  affiliatedAgencyName: "",
  city: "",
  email: "",
  phone: "",
  notes: "",
  agreedTerms: false
};

export function RegisterAgentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState<AgentApplication>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");

  const set = <K extends keyof AgentApplication>(k: K, v: AgentApplication[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(t("register.errors.contactName"));
      return;
    }
    if (!/^\d{9}$/.test(form.vatNumber)) {
      setError(t("register.errors.vat"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError(t("register.errors.email"));
      return;
    }
    if (!form.licenseNumber.trim()) {
      setError(t("register.errors.license"));
      return;
    }
    if (!form.agreedTerms) {
      setError(t("register.errors.terms"));
      return;
    }
    setError(null);
    const ref = `KLP-IM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setReferenceCode(ref);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
                {referenceCode}
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
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        <Button
          component={RouterLink}
          to="/register"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 3 }}
        >
          {t("register.backToChoice")}
        </Button>

        <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
          {t("register.agent.eyebrow")}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          {t("register.agent.title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
          {t("register.agent.lead")}
        </Typography>

        <Card sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("register.agent.personalTitle")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("register.agent.firstName")}
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agent.lastName")}
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  fullWidth
                  required
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("register.agent.fatherName")}
                  value={form.fatherName}
                  onChange={(e) => set("fatherName", e.target.value)}
                  fullWidth
                />
                <TextField
                  label={t("register.agent.vat")}
                  helperText={t("register.agent.vatHelp")}
                  value={form.vatNumber}
                  onChange={(e) => set("vatNumber", e.target.value.replace(/\D/g, "").slice(0, 9))}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agent.amka")}
                  helperText={t("register.agent.amkaHelp")}
                  value={form.amka}
                  onChange={(e) => set("amka", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  fullWidth
                />
              </Stack>

              <Divider />

              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("register.agent.licenseTitle")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label={t("register.agent.licenseType")}
                  value={form.licenseType}
                  onChange={(e) => set("licenseType", e.target.value)}
                  fullWidth
                  required
                >
                  <MenuItem value="agent">{t("register.agent.licenseTypes.agent")}</MenuItem>
                  <MenuItem value="coordinator">
                    {t("register.agent.licenseTypes.coordinator")}
                  </MenuItem>
                  <MenuItem value="consultant">
                    {t("register.agent.licenseTypes.consultant")}
                  </MenuItem>
                  <MenuItem value="broker">{t("register.agent.licenseTypes.broker")}</MenuItem>
                </TextField>
                <TextField
                  label={t("register.agent.licenseNumber")}
                  helperText={t("register.agent.licenseNumberHelp")}
                  value={form.licenseNumber}
                  onChange={(e) => set("licenseNumber", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agent.licenseYear")}
                  value={form.licenseYear}
                  onChange={(e) => set("licenseYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  sx={{ maxWidth: { sm: 140 } }}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label={t("register.agent.workingMode")}
                  value={form.workingMode}
                  onChange={(e) => set("workingMode", e.target.value)}
                  fullWidth
                >
                  <MenuItem value="independent">{t("register.agent.modes.independent")}</MenuItem>
                  <MenuItem value="affiliated">{t("register.agent.modes.affiliated")}</MenuItem>
                  <MenuItem value="employee">{t("register.agent.modes.employee")}</MenuItem>
                </TextField>
                {form.workingMode !== "independent" && (
                  <TextField
                    label={t("register.agent.affiliatedAgency")}
                    value={form.affiliatedAgencyName}
                    onChange={(e) => set("affiliatedAgencyName", e.target.value)}
                    fullWidth
                  />
                )}
              </Stack>

              <Divider />

              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("register.agent.contactTitle")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("register.agent.email")}
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agent.phone")}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agent.city")}
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  fullWidth
                />
              </Stack>

              <TextField
                label={t("register.agent.notes")}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                fullWidth
                multiline
                rows={3}
              />

              <Stack direction="row" spacing={1.5} alignItems="flex-start">
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
                sx={{ alignSelf: "flex-start", fontWeight: 700, px: 4 }}
              >
                {t("register.submit")}
              </Button>
            </Stack>
          </form>
        </Card>
      </Container>
    </PublicShell>
  );
}
