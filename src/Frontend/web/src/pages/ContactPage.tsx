import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import ShieldIcon from "@mui/icons-material/Shield";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { BrandImage } from "../components/BrandImage";

type ContactForm = {
  inquiryType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  agencyOrCity: string;
  subject: string;
  message: string;
  consent: boolean;
};

const initialForm: ContactForm = {
  inquiryType: "sales",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  agencyOrCity: "",
  subject: "",
  message: "",
  consent: false
};

export function ContactPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ ref: string } | null>(null);

  const set = <K extends keyof ContactForm>(k: K, v: ContactForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(t("contact.errors.name"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError(t("contact.errors.email"));
      return;
    }
    if (!form.subject.trim()) {
      setError(t("contact.errors.subject"));
      return;
    }
    if (form.message.trim().length < 10) {
      setError(t("contact.errors.message"));
      return;
    }
    if (!form.consent) {
      setError(t("contact.errors.consent"));
      return;
    }
    setError(null);
    setSubmitting(true);
    // simulate submit delay; persists nothing real today
    setTimeout(() => {
      setSubmitting(false);
      const ref = `KLP-CT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      setSubmitted({ ref });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 700);
  };

  if (submitted) {
    return (
      <PublicShell>
        <Container maxWidth="sm" sx={{ py: { xs: 10, md: 16 } }}>
          <Card sx={{ p: { xs: 4, md: 6 }, textAlign: "center", borderRadius: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: "success.main", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
              {t("contact.success.title")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {t("contact.success.body")}
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
                {t("contact.success.refCode")}
              </Typography>
              <Typography sx={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700 }}>
                {submitted.ref}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" onClick={() => navigate("/")}>
                {t("contact.success.backHome")}
              </Button>
              <Button variant="contained" onClick={() => setSubmitted(null)}>
                {t("contact.success.newMessage")}
              </Button>
            </Stack>
          </Card>
        </Container>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      {/* Hero */}
      <Box sx={{ position: "relative", py: { xs: 10, md: 14 }, color: "common.white", overflow: "hidden" }}>
        <BrandImage seed="kalypsis-contact-headquarters" width={1800} height={900} overlay="navy-strong" />
        <Container maxWidth="md" sx={{ position: "relative", textAlign: "center" }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="overline" sx={{ letterSpacing: 2.5, opacity: 0.8 }}>
              {t("contact.eyebrow")}
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1 }}>
              {t("contact.title")}
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: 18, maxWidth: 640 }}>
              {t("contact.lead")}
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Body */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 }, mt: { xs: -6, md: -8 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 5 },
            gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr" }
          }}
        >
          {/* Form */}
          <Card sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
              {t("contact.form.title")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {t("contact.form.subtitle")}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  select
                  label={t("contact.form.inquiryType")}
                  value={form.inquiryType}
                  onChange={(e) => set("inquiryType", e.target.value)}
                  fullWidth
                  required
                >
                  <MenuItem value="sales">{t("contact.form.inquiryTypes.sales")}</MenuItem>
                  <MenuItem value="support">{t("contact.form.inquiryTypes.support")}</MenuItem>
                  <MenuItem value="agency">{t("contact.form.inquiryTypes.agency")}</MenuItem>
                  <MenuItem value="agent">{t("contact.form.inquiryTypes.agent")}</MenuItem>
                  <MenuItem value="customer">{t("contact.form.inquiryTypes.customer")}</MenuItem>
                  <MenuItem value="press">{t("contact.form.inquiryTypes.press")}</MenuItem>
                  <MenuItem value="other">{t("contact.form.inquiryTypes.other")}</MenuItem>
                </TextField>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label={t("contact.form.firstName")}
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    fullWidth
                    required
                  />
                  <TextField
                    label={t("contact.form.lastName")}
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    fullWidth
                    required
                  />
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label={t("contact.form.email")}
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    fullWidth
                    required
                  />
                  <TextField
                    label={t("contact.form.phone")}
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    fullWidth
                  />
                </Stack>

                <TextField
                  label={t("contact.form.agencyOrCity")}
                  value={form.agencyOrCity}
                  onChange={(e) => set("agencyOrCity", e.target.value)}
                  fullWidth
                />

                <TextField
                  label={t("contact.form.subject")}
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  fullWidth
                  required
                />

                <TextField
                  label={t("contact.form.message")}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  fullWidth
                  required
                  multiline
                  rows={5}
                />

                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => set("consent", e.target.checked)}
                    style={{ marginTop: 5 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {t("contact.form.consent")}
                  </Typography>
                </Stack>

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  sx={{ alignSelf: "flex-start", fontWeight: 700, px: 4, py: 1.4 }}
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                >
                  {submitting ? t("contact.form.submitting") : t("contact.form.submit")}
                </Button>
              </Stack>
            </form>
          </Card>

          {/* Sidebar */}
          <Stack spacing={3}>
            <ContactBlock
              icon={<LocationOnIcon />}
              titleKey="contact.info.hq.title"
              lines={["Λ. Κηφισίας 268", "152 32 Χαλάνδρι, Αθήνα", "Ελλάδα"]}
            />
            <ContactBlock
              icon={<PhoneIcon />}
              titleKey="contact.info.phone.title"
              lines={["+30 210 600 0000", "+30 210 600 0001 (fax)"]}
            />
            <Card sx={{ p: 3, borderRadius: 3 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <MailOutlineIcon color="primary" />
                  <Typography sx={{ fontWeight: 700 }}>{t("contact.info.email.title")}</Typography>
                </Stack>
                <Divider />
                <EmailRow
                  icon={<BusinessCenterIcon fontSize="small" />}
                  labelKey="contact.info.email.sales"
                  value="sales@kalypsis.gr"
                />
                <EmailRow
                  icon={<SupportAgentIcon fontSize="small" />}
                  labelKey="contact.info.email.support"
                  value="support@kalypsis.gr"
                />
                <EmailRow
                  icon={<ShieldIcon fontSize="small" />}
                  labelKey="contact.info.email.privacy"
                  value="privacy@kalypsis.gr"
                />
                <EmailRow
                  icon={<MailOutlineIcon fontSize="small" />}
                  labelKey="contact.info.email.general"
                  value="hello@kalypsis.gr"
                />
              </Stack>
            </Card>

            <ContactBlock
              icon={<AccessTimeIcon />}
              titleKey="contact.info.hours.title"
              lines={[t("contact.info.hours.weekdays"), t("contact.info.hours.support")]}
            />
          </Stack>
        </Box>
      </Container>
    </PublicShell>
  );
}

function ContactBlock({
  icon,
  titleKey,
  lines
}: {
  icon: React.ReactNode;
  titleKey: string;
  lines: string[];
}) {
  const { t } = useTranslation();
  return (
    <Card sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            bgcolor: "primary.main",
            color: "common.white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t(titleKey)}</Typography>
          {lines.map((line) => (
            <Typography key={line} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {line}
            </Typography>
          ))}
        </Box>
      </Stack>
    </Card>
  );
}

function EmailRow({
  icon,
  labelKey,
  value
}: {
  icon: React.ReactNode;
  labelKey: string;
  value: string;
}) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {t(labelKey)}
        </Typography>
        <Typography
          component="a"
          href={`mailto:${value}`}
          sx={{
            fontWeight: 600,
            color: "primary.main",
            textDecoration: "none",
            fontFamily: "monospace",
            fontSize: 14,
            "&:hover": { textDecoration: "underline" }
          }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
