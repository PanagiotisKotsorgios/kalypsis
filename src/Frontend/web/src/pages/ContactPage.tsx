import { useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { api, extractErrorMessage } from "../api/client";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";

const CONTACT_HERO =
  "https://img.magnific.com/free-photo/busy-woman-doing-many-things-same-time_1098-3232.jpg";

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

// MUI sx overrides so the form inputs read editorial.
const fieldSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "transparent",
    fontFamily: "var(--sans)",
    fontSize: 19,
    color: "var(--ink)",
    borderRadius: 0,
    "& fieldset": {
      border: "none",
      borderBottom: "1.5px solid var(--rule)"
    },
    "&:hover fieldset": { borderBottom: "1.5px solid var(--ink)" },
    "&.Mui-focused fieldset": {
      border: "none",
      borderBottom: "1.5px solid var(--gold)"
    }
  },
  "& .MuiInputLabel-root": {
    fontFamily: "var(--sans)",
    color: "var(--ink-muted)",
    fontSize: 17,
    letterSpacing: "0.01em",
    transform: "translate(0, 22px) scale(1)",
    "&.MuiInputLabel-shrink": {
      transform: "translate(0, -2px) scale(0.78)",
      color: "var(--ink-muted)"
    }
  },
  "& .MuiOutlinedInput-input": { padding: "20px 0 14px" }
} as const;

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
        consent: form.consent
      });
      setSubmitted({ ref: res.data.reference });
    } catch (err) {
      setError(extractErrorMessage(err, t("contact.errors.network", "Σφάλμα δικτύου — δοκιμάστε ξανά.")));
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-redirect to home a few seconds after the success popup appears so the
  // user gets a clear confirmation but isn't stranded on this page.
  useEffect(() => {
    if (!submitted) return;
    const id = window.setTimeout(() => navigate("/"), 4000);
    return () => window.clearTimeout(id);
  }, [submitted, navigate]);

  return (
    <PublicShell>
      {/* Hero */}
      <Box sx={{
        position: "relative",
        py: { xs: 8, md: 12 },
        borderBottom: "1px solid rgba(245,237,225,0.18)",
        backgroundImage:
          `linear-gradient(180deg, rgba(6,20,38,0.96) 0%, rgba(6,20,38,0.88) 50%, rgba(6,20,38,0.96) 100%),` +
          `linear-gradient(90deg, rgba(6,20,38,0.8) 0%, rgba(6,20,38,0.2) 70%),` +
          `url(${CONTACT_HERO})`,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center",
        backgroundAttachment: { xs: "scroll", md: "fixed" },
        color: "var(--paper)",
        overflow: "hidden"
      }}>
        <Box className="editorial-grain" sx={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none" }} />

        <Container maxWidth="xl" sx={{ position: "relative" }}>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "7fr 5fr" },
            gap: { xs: 4, md: 8 },
            alignItems: "end"
          }}>
            <EdReveal delay={100}>
              <Box className="display" sx={{
                fontSize: { xs: 44, md: 84 },
                lineHeight: 1.02,
                color: "var(--paper)"
              }}>
                {t("contact.editorial.titleA")}{" "}
                <span className="display-italic" style={{ color: "var(--gold)" }}>
                  {t("contact.editorial.titleB")}
                </span>
              </Box>
            </EdReveal>

            <EdReveal delay={200}>
              <Box sx={{
                fontSize: { xs: 17, md: 19 },
                lineHeight: 1.6,
                color: "rgba(245,237,225,0.88)",
                maxWidth: 560
              }}>
                {t("contact.lead")}
              </Box>
            </EdReveal>
          </Box>
        </Container>
      </Box>

      {/* Body */}
      <Box sx={{ py: { xs: 8, md: 14 }, borderBottom: "1px solid var(--rule)" }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
            gap: { xs: 6, md: 10 },
            alignItems: "start"
          }}>
            {/* Form column */}
            <EdReveal>
              <form onSubmit={handleSubmit}>
                <Box className="display" sx={{ fontSize: { xs: 36, md: 56 }, color: "var(--ink)", mb: 5 }}>
                  {t("contact.form.title")}
                </Box>

                {error && (
                  <Alert severity="error" sx={{
                    mb: 3, bgcolor: "var(--bone)",
                    border: "1px solid var(--terracotta)",
                    color: "var(--ink)"
                  }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <Stack spacing={4}>
                  <TextField
                    select fullWidth variant="outlined"
                    label={t("contact.form.inquiryType")}
                    value={form.inquiryType}
                    onChange={(e) => set("inquiryType", e.target.value)}
                    sx={fieldSx}
                  >
                    {["sales","support","bug","complaint","agency","agent","customer","press","other"].map((v) => (
                      <MenuItem key={v} value={v}>{t(`contact.form.inquiryTypes.${v}`)}</MenuItem>
                    ))}
                  </TextField>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                    <TextField fullWidth label={t("contact.form.firstName")} required
                      value={form.firstName} onChange={(e) => set("firstName", e.target.value)} sx={fieldSx} />
                    <TextField fullWidth label={t("contact.form.lastName")} required
                      value={form.lastName} onChange={(e) => set("lastName", e.target.value)} sx={fieldSx} />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                    <TextField fullWidth type="email" label={t("contact.form.email")} required
                      value={form.email} onChange={(e) => set("email", e.target.value)} sx={fieldSx} />
                    <TextField fullWidth label={t("contact.form.phone")}
                      value={form.phone} onChange={(e) => set("phone", e.target.value)} sx={fieldSx} />
                  </Stack>
                  <TextField fullWidth label={t("contact.form.agencyOrCity")}
                    value={form.agencyOrCity} onChange={(e) => set("agencyOrCity", e.target.value)} sx={fieldSx} />
                  <TextField fullWidth label={t("contact.form.subject")} required
                    value={form.subject} onChange={(e) => set("subject", e.target.value)} sx={fieldSx} />
                  <TextField fullWidth label={t("contact.form.message")} required
                    multiline rows={5}
                    value={form.message} onChange={(e) => set("message", e.target.value)}
                    sx={{ ...fieldSx, "& .MuiOutlinedInput-input": { padding: "16px 0 12px" } }} />

                  <Box>
                    <label style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      cursor: "pointer",
                      color: "var(--ink-soft)",
                      fontSize: 17,
                      lineHeight: 1.6
                    }}>
                      <input
                        type="checkbox"
                        checked={form.consent}
                        onChange={(e) => set("consent", e.target.checked)}
                        style={{
                          width: 22, height: 22, marginTop: 3,
                          accentColor: "var(--gold)"
                        }}
                      />
                      <span>{t("contact.form.consent")}</span>
                    </label>
                  </Box>

                  <Box sx={{ pt: 2 }}>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="ink-button"
                      style={{
                        minWidth: 280,
                        fontSize: 18,
                        padding: "20px 36px",
                        backgroundColor: "var(--gold)",
                        color: "var(--ink)",
                        borderColor: "var(--gold)"
                      }}
                    >
                      <span>{submitting ? t("contact.form.submitting") : t("contact.form.submit")}</span>
                      <ArrowOutwardIcon sx={{ fontSize: 22 }} />
                    </button>
                  </Box>
                </Stack>
              </form>
            </EdReveal>

            {/* Sidebar */}
            <EdReveal delay={150}>
              <Box sx={{ position: { md: "sticky" }, top: 120 }}>
                <Box className="display" sx={{ fontSize: { xs: 32, md: 44 }, color: "var(--ink)", mb: 4 }}>
                  {t("contact.info.email.title")}
                </Box>

                <Box sx={{ borderTop: "1.5px solid var(--ink)", pt: 4 }}>
                  <ContactRow icon={<LocationOnIcon sx={{ fontSize: 44 }} />}
                    title={t("contact.info.hq.title")}
                    body={[t("footer.address1"), t("footer.address2")]} />
                  <ContactRow icon={<PhoneIcon sx={{ fontSize: 44 }} />}
                    title={t("contact.info.phone.title")}
                    body={["+30 210 600 0000", "+30 210 600 0001 (fax)"]} />
                  <ContactRow icon={<MailOutlineIcon sx={{ fontSize: 44 }} />}
                    title={t("contact.info.email.title")}
                    body={[
                      "sales@kalypsis.gr",
                      "support@kalypsis.gr",
                      "privacy@kalypsis.gr"
                    ]} mono />
                  <ContactRow icon={<AccessTimeIcon sx={{ fontSize: 44 }} />}
                    title={t("contact.info.hours.title")}
                    body={[t("contact.info.hours.weekdays"), t("contact.info.hours.support")]} last />
                </Box>
              </Box>
            </EdReveal>
          </Box>
        </Container>
      </Box>

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
          <Typography variant="h5" sx={{ fontWeight: 850, mb: 1 }}>
            {t("contact.success.title")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>
            {t("contact.success.body")}
          </Typography>
          {submitted && (
            <Box sx={{ py: 1.5, mb: 2, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="overline" color="text.secondary">{t("contact.success.refCode")}</Typography>
              <Typography sx={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, mt: 0.5 }}>
                {submitted.ref}
              </Typography>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <CircularProgress size={12} thickness={5} /> Μετάβαση στην αρχική…
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button onClick={() => navigate("/")} variant="contained" sx={{ fontWeight: 700 }}>
            {t("contact.success.backHome")}
          </Button>
        </DialogActions>
      </Dialog>
    </PublicShell>
  );
}

function ContactRow({ icon, title, body, mono, last }:
  { icon: React.ReactNode; title: string; body: string[]; mono?: boolean; last?: boolean }) {
  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: "56px 1fr",
      gap: 3,
      py: 4,
      borderBottom: last ? "none" : "1px solid var(--rule)",
      alignItems: "start"
    }}>
      <Box sx={{ color: "var(--gold)", pt: 0.5 }}>{icon}</Box>
      <Box>
        <Box sx={{
          fontFamily: "var(--display)",
          fontSize: { xs: 20, md: 22 },
          fontWeight: 600,
          color: "var(--ink)",
          mb: 1.5,
          letterSpacing: "-0.01em"
        }}>
          {title}
        </Box>
        {body.map((line) => (
          <Box key={line} sx={{
            fontFamily: mono ? "var(--mono)" : "var(--sans)",
            fontSize: { xs: 16, md: 17 },
            lineHeight: 1.7,
            color: "var(--ink-soft)"
          }}>
            {line}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
