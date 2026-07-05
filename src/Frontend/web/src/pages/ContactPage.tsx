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
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { LanguageToggle } from "../components/LanguageToggle";
import { PublicFooter } from "../components/PublicFooter";
import { AccessibilityWidget } from "../components/AccessibilityWidget";
import { PageEnter } from "../components/PageEnter";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

// Palette exactly matches LandingPage so the page reads as a continuation.
const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";
const RULE = "#e5e9ef";
// Same wave PNG that ships as the landing hero background — reused here so
// the contact page reads as a continuation of the marketing surface.
const HERO_BG = "/images/kalypsis-hero-bg.png";

/**
 * Shared TextField styling for the contact form. Darker borders + stronger
 * placeholder / label / value contrast so every field is easy to see on the
 * gradient/wave background. Also stops the default MUI ambient-alpha look
 * from washing out on light surfaces.
 */
const FORM_INPUT_SX = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#ffffff",
    "& fieldset":         { borderColor: "#c1cad6", borderWidth: "1.5px" },
    "&:hover fieldset":   { borderColor: "#0b2545" },
    "&.Mui-focused fieldset": { borderColor: "#17417f", borderWidth: 2 },
    "&.Mui-error fieldset":   { borderColor: "#c62828" }
  },
  "& .MuiOutlinedInput-input":    { color: "#0b2545", fontWeight: 500 },
  "& .MuiInputBase-input::placeholder": { color: "#5a6a80", opacity: 1 },
  "& .MuiInputLabel-root":        { color: "#0b2545", fontWeight: 600 },
  "& .MuiInputLabel-root.Mui-focused": { color: "#17417f" },
  "& .MuiFormHelperText-root":    { color: "#3d4f6b" }
} as const;

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
      // Same base color + wave PNG as the landing hero, so the contact page
      // reads as a continuation of the marketing surface. Cover + center-
      // bottom mirrors the hero exactly. `attachment: fixed` is
      // intentionally avoided (mobile scroll perf).
      bgcolor: "#f8fbff",
      backgroundImage: `url("${HERO_BG}")`,
      backgroundSize: "cover",
      backgroundPosition: "center bottom",
      backgroundRepeat: "no-repeat",
      color: NAVY,
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex", flexDirection: "column",
      position: "relative"
    }}>
      {/* Same glass-card nav shelf as LandingPage — logo + contact strip on
          the left, «Στην αρχική» + language toggle on the right. Keeps the
          brand experience continuous when a visitor bounces between /
          and /contact. */}
      <Container maxWidth={false} sx={{
        maxWidth: { xs: "100%", md: "96%", lg: "88%", xl: "1600px" },
        px: { xs: 2, md: 3 },
        pt: { xs: 1.5, md: 2 },
        position: "relative", zIndex: 1
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}
          sx={{
            flexWrap: "nowrap", minWidth: 0, "& > *": { minWidth: 0 },
            borderRadius: { xs: 3, md: "22px" },
            px: { xs: 1.5, md: 4.5 }, py: { xs: 1, md: 2 },
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 18px 44px rgba(15,42,80,0.12)",
            border: "1px solid rgba(148,191,230,0.35)",
            animation: "kalypsisNavIn 850ms cubic-bezier(0.16,1,0.3,1) 60ms both",
            transformOrigin: "top center",
            "@keyframes kalypsisNavIn": {
              "0%":   { opacity: 0, transform: "translateY(-24px) scaleX(0.94)" },
              "60%":  { opacity: 1 },
              "100%": { opacity: 1, transform: "translateY(0) scaleX(1)" }
            }
          }}>
          {/* Mobile-only language toggle */}
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center" }}>
            <LanguageToggle />
          </Box>

          {/* Contact strip + auth links — desktop only */}
          <Stack direction="row" spacing={{ xs: 1.5, md: 2, lg: 3.5 }} alignItems="center"
            sx={{ display: { xs: "none", md: "flex" }, flexShrink: 0, whiteSpace: "nowrap" }}>
            <Box component="a" href="tel:+302631028971"
              sx={{
                display: { md: "none", lg: "inline-flex" }, alignItems: "center", gap: 1,
                color: NAVY, textDecoration: "none",
                fontSize: 15.5, fontWeight: 600, letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              <PhoneOutlinedIcon sx={{ fontSize: 20 }} />
              2631028971
            </Box>
            <Box component="a" href="mailto:info@mykalypsis.gr"
              sx={{
                display: { md: "none", lg: "inline-flex" }, alignItems: "center", gap: 1,
                color: NAVY, textDecoration: "none",
                fontSize: 15.5, fontWeight: 600, letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              <MailOutlineIcon sx={{ fontSize: 20 }} />
              info@mykalypsis.gr
            </Box>
            <Box aria-hidden sx={{
              display: { md: "none", lg: "block" },
              width: "1px", height: 22,
              bgcolor: "rgba(11,37,69,0.18)"
            }} />
            <Box component={RouterLink} to="/login"
              sx={{
                color: NAVY, textDecoration: "none",
                fontSize: { md: 14.5, lg: 15.5 }, fontWeight: 700,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              Σύνδεση
            </Box>
            <Box component={RouterLink} to="/register"
              sx={{
                color: NAVY, textDecoration: "none",
                fontSize: { md: 14.5, lg: 15.5 }, fontWeight: 700,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              Εγγραφή
            </Box>
          </Stack>

          {/* Right cluster — «Στην αρχική» pill + LanguageToggle */}
          <Stack direction="row" spacing={{ md: 1.25, lg: 1.75 }} alignItems="center"
            sx={{ ml: "auto", display: { xs: "none", md: "flex" }, flexShrink: 0, whiteSpace: "nowrap" }}>
            <Button
              component={RouterLink}
              to="/"
              variant="outlined"
              sx={{
                borderRadius: 999,
                px: { md: 2, lg: 2.75 }, py: { md: 0.85, lg: 1 },
                fontSize: { md: 13.5, lg: 14.5 },
                fontWeight: 700, letterSpacing: "0.01em",
                textTransform: "none", whiteSpace: "nowrap",
                color: NAVY,
                bgcolor: "rgba(30,167,225,0.06)",
                borderColor: "rgba(30,167,225,0.35)",
                "&:hover": { borderColor: ACCENT, bgcolor: "rgba(30,167,225,0.12)" }
              }}
            >
              {t("nav.back", "Στην αρχική")}
            </Button>
            <LanguageToggle />
          </Stack>
        </Stack>
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
              lineHeight: 1.6, color: NAVY, fontWeight: 500,
              maxWidth: 560, mx: "auto"
            }}>
              {t("contact.form.subtitle", "Συμπληρώστε τη φόρμα και θα σας απαντήσουμε στο email που θα ορίσετε. Για bugs ή παράπονα, επιλέξτε τον σχετικό τύπο.")}
            </Typography>
          </Box>

          {/* Form card — solid white surface, sharp enterprise chrome:
              formal header bar with a small icon + form label, structured
              body, no decorative stripes. */}
          <Box sx={{
            maxWidth: 760, mx: "auto",
            bgcolor: "#ffffff",
            border: `1px solid ${RULE}`,
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(11,37,69,0.10), 0 2px 6px rgba(11,37,69,0.04)"
          }}>
            {/* Header bar — flat navy strip with form label, mimics an
                enterprise support portal. */}
            <Box sx={{
              px: { xs: 3, md: 5 }, py: { xs: 2, md: 2.5 },
              bgcolor: NAVY, color: "#fff",
              display: "flex", alignItems: "center", gap: 1.5,
              borderBottom: `3px solid ${ACCENT}`
            }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 22, opacity: 0.85 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{
                  fontSize: 11, letterSpacing: "0.22em",
                  textTransform: "uppercase", fontWeight: 600,
                  color: "rgba(255,255,255,0.72)"
                }}>
                  Support · Sales · Bug reports
                </Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 700, mt: 0.25 }}>
                  {t("contact.form.header", "Φόρμα επικοινωνίας")}
                </Typography>
              </Box>
              <Box sx={{
                display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 0.75,
                fontSize: 12, color: "rgba(255,255,255,0.72)",
                letterSpacing: "0.02em"
              }}>
                <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />
                <span>Απάντηση εντός 24h</span>
              </Box>
            </Box>

            {/* Form body */}
            <Box sx={{ p: { xs: 3, md: 5 } }}>
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
                <SearchableTextField
                  select fullWidth
                  label={t("contact.form.inquiryType", "Είδος ερώτησης")}
                  value={form.inquiryType}
                  onChange={(e) => set("inquiryType", e.target.value)}
                  size="medium"
                  sx={FORM_INPUT_SX}
                >
                  {INQUIRY_TYPES.map((v) => (
                    <MenuItem key={v} value={v}>{t(`contact.form.inquiryTypes.${v}`)}</MenuItem>
                  ))}
                </SearchableTextField>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth required sx={FORM_INPUT_SX}
                    label={t("contact.form.firstName", "Όνομα")}
                    value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  <TextField fullWidth required sx={FORM_INPUT_SX}
                    label={t("contact.form.lastName", "Επώνυμο")}
                    value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField fullWidth required type="email" sx={FORM_INPUT_SX}
                    label={t("contact.form.email", "Email")}
                    value={form.email} onChange={(e) => set("email", e.target.value)} />
                  <TextField fullWidth sx={FORM_INPUT_SX}
                    label={t("contact.form.phone", "Τηλέφωνο")}
                    value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Stack>

                <TextField fullWidth sx={FORM_INPUT_SX}
                  label={t("contact.form.agencyOrCity", "Γραφείο / Πόλη")}
                  value={form.agencyOrCity}
                  onChange={(e) => set("agencyOrCity", e.target.value)} />

                <TextField fullWidth required sx={FORM_INPUT_SX}
                  label={t("contact.form.subject", "Θέμα")}
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)} />

                <TextField fullWidth required multiline rows={6} sx={FORM_INPUT_SX}
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
                    <Typography sx={{ fontSize: 14, color: NAVY, lineHeight: 1.55, fontWeight: 500 }}>
                      {t("contact.form.consent", "Συναινώ στην επεξεργασία των στοιχείων μου αποκλειστικά για την απάντηση στο μήνυμά μου.")}{" "}
                      <Link component={RouterLink} to="/privacy" sx={{ color: "#17417f", fontWeight: 700, textDecoration: "underline", "&:hover": { color: "#0b2545" } }}>
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

            {/* Footer strip inside the card — GDPR reassurance + Brevo
                delivery note. Reads as a compliance line, not decoration. */}
            <Box sx={{
              px: { xs: 3, md: 5 }, py: 2,
              bgcolor: "#f6f9fc",
              borderTop: `1px solid ${RULE}`,
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5,
              fontSize: 12, color: NAVY_SOFT
            }}>
              <ShieldOutlinedIcon sx={{ fontSize: 16, color: ACCENT, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 220, lineHeight: 1.55 }}>
                Τα δεδομένα σας κρυπτογραφούνται σε TLS 1.3 και αποθηκεύονται
                μόνο για την απάντηση στο μήνυμά σας. Πλήρεις λεπτομέρειες στην{" "}
                <Link component={RouterLink} to="/privacy" sx={{ color: NAVY, fontWeight: 700, textDecoration: "underline" }}>
                  Πολιτική Απορρήτου
                </Link>.
              </Box>
            </Box>
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

const inlineLinkSx = {
  display: "inline-flex", alignItems: "center", gap: 0.75,
  color: NAVY_SOFT, textDecoration: "none", fontWeight: 600,
  "&:hover": { color: NAVY }
} as const;
