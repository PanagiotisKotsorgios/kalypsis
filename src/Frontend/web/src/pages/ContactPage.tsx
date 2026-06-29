import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { LanguageToggle } from "../components/LanguageToggle";
import { PublicFooter } from "../components/PublicFooter";
import { AccessibilityWidget } from "../components/AccessibilityWidget";
import { PageEnter } from "../components/PageEnter";
import { api, extractErrorMessage } from "../api/client";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1ea7e1";
const RULE = "#e5e9ef";

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
  // Honeypot — hidden from real users, only bots fill it in.
  website: string;
};

const initialForm: ContactForm = {
  inquiryType: "support",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  agencyOrCity: "",
  subject: "",
  message: "",
  consent: false,
  website: ""
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return setError(t("contact.errors.name"));
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError(t("contact.errors.email"));
    if (!form.subject.trim()) return setError(t("contact.errors.subject"));
    if (form.message.trim().length < 10) return setError(t("contact.errors.message"));
    if (!form.consent) return setError(t("contact.errors.consent"));
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ reference: string; delivered: boolean }>("/public/contact", {
        inquiryType: form.inquiryType,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        agencyOrCity: form.agencyOrCity.trim() || null,
        subject: form.subject.trim(),
        message: form.message.trim(),
        consent: form.consent,
        website: form.website
      });
      setSubmitted({ ref: res.data.reference });
    } catch (err) {
      setError(extractErrorMessage(err, t("contact.errors.network", "Σφάλμα δικτύου — δοκιμάστε ξανά.")));
    } finally {
      setSubmitting(false);
    }
  };

  // After a successful send, fade to home after 4 seconds — long enough to read
  // the reference code, short enough not to feel stuck.
  useEffect(() => {
    if (!submitted) return;
    const id = window.setTimeout(() => navigate("/"), 4000);
    return () => window.clearTimeout(id);
  }, [submitted, navigate]);

  const INQUIRY_TYPES = ["support", "bug", "complaint", "sales", "agency", "agent", "customer", "press", "other"] as const;

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#ffffff",
      color: NAVY,
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex", flexDirection: "column"
    }}>
      {/* Masthead accent — slim gradient stripe along the very top edge. */}
      <Box sx={{
        height: 3,
        background: "linear-gradient(90deg, #0b2545 0%, #1ea7e1 50%, #0b2545 100%)"
      }} />

      {/* Same top bar as LandingPage */}
      <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, pt: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" spacing={{ xs: 1.5, sm: 3 }} alignItems="center"
            sx={{ display: { xs: "none", sm: "flex" } }}>
            <Box component="a" href="tel:+302631028971" sx={topLinkSx}>
              <PhoneOutlinedIcon sx={{ fontSize: 17 }} />
              2631028971
            </Box>
            <Box component="a" href="mailto:info@mykalypsis.gr" sx={topLinkSx}>
              <MailOutlineIcon sx={{ fontSize: 17 }} />
              info@mykalypsis.gr
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ ml: "auto" }}>
            <Button
              component={RouterLink}
              to="/"
              size="small"
              variant="text"
              startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />}
              sx={{
                color: NAVY,
                textTransform: "none",
                fontWeight: 600,
                fontSize: 13,
                "&:hover": { bgcolor: "rgba(11,37,69,0.04)" }
              }}
            >
              {t("nav.back")}
            </Button>
            <LanguageToggle />
          </Stack>
        </Stack>
        {/* Hairline accent under the top bar */}
        <Box sx={{
          mt: { xs: 1.5, md: 2 },
          height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(30,167,225,0.35) 50%, transparent 100%)"
        }} />
      </Container>

      <Container maxWidth="md" sx={{ px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 }, flex: 1 }}>
        <PageEnter stagger={500}>
          {/* Hero — same restraint as the landing page */}
          <Box sx={{ textAlign: "center", maxWidth: 640, mx: "auto", mb: { xs: 4, md: 6 } }}>
            <Typography component="h1" sx={{
              fontSize: { xs: 30, sm: 36, md: 44 },
              fontWeight: 700, lineHeight: 1.15,
              letterSpacing: "-0.02em", color: NAVY, mb: 1.5
            }}>
              {t("contact.form.title", "Στείλτε μας μήνυμα")}
            </Typography>
            <Typography sx={{
              fontSize: { xs: 15, md: 17 },
              lineHeight: 1.6, color: NAVY_SOFT,
              maxWidth: 560, mx: "auto"
            }}>
              {t("contact.form.subtitle", "Συμπληρώστε τη φόρμα και θα σας απαντήσουμε στο email που θα ορίσετε. Για bugs ή παράπονα, επιλέξτε τον σχετικό τύπο.")}
            </Typography>
          </Box>

          {/* Form card — a thin accent stripe along the left edge gives it
              identity without breaking the restrained palette. */}
          <Box sx={{
            maxWidth: 720, mx: "auto",
            bgcolor: "#ffffff",
            border: `1px solid ${RULE}`,
            borderRadius: 3,
            p: { xs: 3, md: 5 },
            boxShadow: "0 4px 24px rgba(11,37,69,0.04)",
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: 3,
              background: `linear-gradient(180deg, ${ACCENT} 0%, ${NAVY} 100%)`
            }
          }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Honeypot: hidden from sight + tab order, off the screen. Only bots fill it. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                aria-hidden="true"
                style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
              />
              <Stack spacing={2.5}>
                <TextField
                  select fullWidth
                  label={t("contact.form.inquiryType", "Είδος ερώτησης")}
                  value={form.inquiryType}
                  onChange={(e) => set("inquiryType", e.target.value)}
                  size="medium"
                >
                  {INQUIRY_TYPES.map((v) => (
                    <MenuItem key={v} value={v}>{t(`contact.form.inquiryTypes.${v}`)}</MenuItem>
                  ))}
                </TextField>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth required
                    label={t("contact.form.firstName", "Όνομα")}
                    value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  <TextField fullWidth required
                    label={t("contact.form.lastName", "Επώνυμο")}
                    value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth required type="email"
                    label={t("contact.form.email", "Email")}
                    value={form.email} onChange={(e) => set("email", e.target.value)} />
                  <TextField fullWidth
                    label={t("contact.form.phone", "Τηλέφωνο")}
                    value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Stack>

                <TextField fullWidth
                  label={t("contact.form.agencyOrCity", "Γραφείο / Πόλη")}
                  value={form.agencyOrCity}
                  onChange={(e) => set("agencyOrCity", e.target.value)} />

                <TextField fullWidth required
                  label={t("contact.form.subject", "Θέμα")}
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)} />

                <TextField fullWidth required multiline rows={6}
                  label={t("contact.form.message", "Μήνυμα")}
                  placeholder="Περιγράψτε αναλυτικά το θέμα σας. Αν αφορά bug, αναφέρετε τα βήματα αναπαραγωγής."
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)} />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.consent}
                      onChange={(e) => set("consent", e.target.checked)}
                      sx={{ color: NAVY_SOFT, "&.Mui-checked": { color: ACCENT } }}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 14, color: NAVY_SOFT, lineHeight: 1.55 }}>
                      {t("contact.form.consent", "Συναινώ στην επεξεργασία των στοιχείων μου αποκλειστικά για την απάντηση στο μήνυμά μου.")}{" "}
                      <Link component={RouterLink} to="/privacy" sx={{ color: ACCENT, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                        Πολιτική Απορρήτου
                      </Link>
                    </Typography>
                  }
                  sx={{ alignItems: "flex-start", ml: 0, mt: 0.5 }}
                />

                <Box sx={{ pt: 1 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting}
                    endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
                    sx={{
                      bgcolor: NAVY,
                      color: "#fff",
                      borderRadius: 2.5,
                      px: 5, py: 1.75,
                      fontSize: 16, fontWeight: 700,
                      textTransform: "none",
                      letterSpacing: "0.02em",
                      boxShadow: "none",
                      "&:hover": { bgcolor: NAVY_SOFT, boxShadow: "none" }
                    }}
                  >
                    {submitting ? t("contact.form.submitting", "Αποστολή…") : t("contact.form.submit", "Αποστολή μηνύματος")}
                  </Button>
                </Box>
              </Stack>
            </form>
          </Box>

          {/* Small reassurance row beneath the form */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="center"
            alignItems="center"
            sx={{ mt: 5, color: NAVY_SOFT, fontSize: 14 }}
          >
            <Box component="a" href="tel:+302631028971" sx={inlineLinkSx}>
              <PhoneOutlinedIcon sx={{ fontSize: 17 }} /> 2631028971
            </Box>
            <Box component="a" href="mailto:info@mykalypsis.gr" sx={inlineLinkSx}>
              <MailOutlineIcon sx={{ fontSize: 17 }} /> info@mykalypsis.gr
            </Box>
          </Stack>
        </PageEnter>
      </Container>

      <PublicFooter />
      <AccessibilityWidget />

      {/* Success popup → auto-redirect to home */}
      <Dialog
        open={!!submitted}
        onClose={() => navigate("/")}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
      >
        <DialogContent sx={{ textAlign: "center", py: 4 }}>
          <Box sx={{
            width: 72, height: 72, mx: "auto", mb: 2.5,
            borderRadius: "50%",
            display: "grid", placeItems: "center",
            bgcolor: "rgba(46,164,79,0.10)", color: "#1e7a32"
          }}>
            <CheckCircleIcon sx={{ fontSize: 44 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: NAVY }}>
            {t("contact.success.title", "Το μήνυμά σας στάλθηκε")}
          </Typography>
          <Typography sx={{ color: NAVY_SOFT, mb: 2.5 }}>
            {t("contact.success.body", "Θα σας απαντήσουμε στο email που μας δώσατε το συντομότερο.")}
          </Typography>
          {submitted && (
            <Box sx={{ py: 1.5, mb: 2, borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
              <Typography variant="overline" sx={{ color: NAVY_SOFT }}>
                {t("contact.success.refCode", "Αναφορά")}
              </Typography>
              <Typography sx={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, mt: 0.5, color: NAVY }}>
                {submitted.ref}
              </Typography>
            </Box>
          )}
          <Typography variant="caption" sx={{ color: NAVY_SOFT, display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <CircularProgress size={12} thickness={5} /> Μετάβαση στην αρχική…
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button
            onClick={() => navigate("/")}
            variant="contained"
            sx={{
              bgcolor: NAVY, color: "#fff",
              textTransform: "none", fontWeight: 700,
              borderRadius: 2, px: 3,
              boxShadow: "none",
              "&:hover": { bgcolor: NAVY_SOFT, boxShadow: "none" }
            }}
          >
            {t("contact.success.backHome", "Στην αρχική")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const topLinkSx = {
  display: "inline-flex", alignItems: "center", gap: 0.75,
  color: NAVY, textDecoration: "none", fontSize: 13.5, fontWeight: 600,
  letterSpacing: "0.01em",
  "&:hover": { color: ACCENT }
} as const;

const inlineLinkSx = {
  display: "inline-flex", alignItems: "center", gap: 0.75,
  color: NAVY_SOFT, textDecoration: "none", fontWeight: 600,
  "&:hover": { color: NAVY }
} as const;
