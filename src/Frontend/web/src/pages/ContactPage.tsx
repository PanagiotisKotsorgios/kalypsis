import { useState, type FormEvent } from "react";
import { Alert, Box, Container, MenuItem, Stack, TextField } from "@mui/material";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";
import { EditorialImage } from "../components/EditorialImage";

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
    fontSize: 16,
    color: "var(--ink)",
    borderRadius: 0,
    "& fieldset": {
      border: "none",
      borderBottom: "1px solid var(--rule)"
    },
    "&:hover fieldset": { borderBottom: "1px solid var(--ink)" },
    "&.Mui-focused fieldset": {
      border: "none",
      borderBottom: "1px solid var(--ink)"
    }
  },
  "& .MuiInputLabel-root": {
    fontFamily: "var(--sans)",
    color: "var(--ink-muted)",
    fontSize: 14,
    letterSpacing: "0.02em",
    transform: "translate(0, 18px) scale(1)",
    "&.MuiInputLabel-shrink": {
      transform: "translate(0, -2px) scale(0.85)",
      color: "var(--ink-muted)"
    }
  },
  "& .MuiOutlinedInput-input": { padding: "16px 0 12px" }
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return setError(t("contact.errors.name"));
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError(t("contact.errors.email"));
    if (!form.subject.trim()) return setError(t("contact.errors.subject"));
    if (form.message.trim().length < 10) return setError(t("contact.errors.message"));
    if (!form.consent) return setError(t("contact.errors.consent"));
    setError(null);
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const ref = `KLP-CT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      setSubmitted({ ref });
    }, 700);
  };

  if (submitted) {
    return (
      <PublicShell>
        <Container maxWidth="md" sx={{ py: { xs: 12, md: 20 } }}>
          <EdReveal>
            <Box className="number-marker" sx={{ mb: 4 }}>№ 02 — {t("contact.success.refCode")}</Box>
            <Box className="display" sx={{ fontSize: { xs: 48, md: 80 }, color: "var(--ink)", mb: 4 }}>
              {t("contact.success.title")}
            </Box>
            <Box sx={{ fontSize: 19, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 580, mb: 5 }}>
              {t("contact.success.body")}
            </Box>
            <Box sx={{ py: 3, my: 4, borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
              <Box className="eyebrow">{t("contact.success.refCode")}</Box>
              <Box sx={{ fontFamily: "var(--mono)", fontSize: 22, mt: 1, color: "var(--ink)" }}>
                {submitted.ref}
              </Box>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <button onClick={() => navigate("/")} className="ink-button">
                <span>{t("contact.success.backHome")}</span>
                <ArrowOutwardIcon sx={{ fontSize: 18 }} />
              </button>
              <button onClick={() => { setSubmitted(null); setForm(initialForm); }} className="ghost-button">
                <span>{t("contact.success.newMessage")}</span>
              </button>
            </Stack>
          </EdReveal>
        </Container>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      {/* Hero */}
      <Box className="editorial-grain" sx={{ py: { xs: 10, md: 16 }, borderBottom: "1px solid var(--rule)" }}>
        <Container maxWidth="lg">
          <EdReveal>
            <Stack direction="row" alignItems="baseline" spacing={2} mb={{ xs: 4, md: 6 }}>
              <span className="number-marker">№ 01</span>
              <Box sx={{ flex: 1, height: "1px", bgcolor: "var(--rule)" }} />
              <span className="eyebrow">{t("contact.eyebrow")}</span>
            </Stack>
          </EdReveal>
          <EdReveal delay={120}>
            <Box className="display" sx={{
              fontSize: { xs: 48, md: 96 },
              color: "var(--ink)", mb: 4, maxWidth: 1000
            }}>
              {t("contact.editorial.titleA")}{" "}
              <span className="display-italic" style={{ color: "var(--terracotta)" }}>
                {t("contact.editorial.titleB")}
              </span>
            </Box>
          </EdReveal>
          <EdReveal delay={220}>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.5fr 1fr" },
              gap: { xs: 4, md: 6 },
              mt: 5,
              alignItems: "center"
            }}>
              <Box sx={{ fontSize: 19, lineHeight: 1.7, color: "var(--ink-soft)" }}>
                {t("contact.lead")}
              </Box>
              <EditorialImage src={CONTACT_HERO} aspect="5 / 4" caption="ΥΠΟΣΤΗΡΙΞΗ · 09:00–18:00" align="right" />
            </Box>
          </EdReveal>
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
                <Box className="number-marker" sx={{ mb: 3 }}>
                  № 02 — {t("contact.form.title")}
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
                    {["sales","support","agency","agent","customer","press","other"].map((v) => (
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
                      gap: 10,
                      alignItems: "flex-start",
                      cursor: "pointer",
                      color: "var(--ink-soft)",
                      fontSize: 14,
                      lineHeight: 1.55
                    }}>
                      <input
                        type="checkbox"
                        checked={form.consent}
                        onChange={(e) => set("consent", e.target.checked)}
                        style={{
                          width: 18, height: 18, marginTop: 2,
                          accentColor: "var(--ink)"
                        }}
                      />
                      <span>{t("contact.form.consent")}</span>
                    </label>
                  </Box>

                  <Box sx={{ pt: 2 }}>
                    <button type="submit" disabled={submitting} className="ink-button" style={{ minWidth: 240 }}>
                      <span>{submitting ? t("contact.form.submitting") : t("contact.form.submit")}</span>
                      <ArrowOutwardIcon sx={{ fontSize: 18 }} />
                    </button>
                  </Box>
                </Stack>
              </form>
            </EdReveal>

            {/* Sidebar */}
            <EdReveal delay={150}>
              <Box sx={{ position: { md: "sticky" }, top: 120 }}>
                <Box className="number-marker" sx={{ mb: 3 }}>№ 03 — {t("contact.info.email.title")}</Box>

                <Box sx={{ borderTop: "1px solid var(--ink)", pt: 3 }}>
                  <ContactRow icon={<LocationOnIcon fontSize="small" />}
                    title={t("contact.info.hq.title")}
                    body={["Λ. Κηφισίας 268", "152 32 Χαλάνδρι, Αθήνα"]} />
                  <ContactRow icon={<PhoneIcon fontSize="small" />}
                    title={t("contact.info.phone.title")}
                    body={["+30 210 600 0000", "+30 210 600 0001 (fax)"]} />
                  <ContactRow icon={<MailOutlineIcon fontSize="small" />}
                    title={t("contact.info.email.title")}
                    body={[
                      "sales@kalypsis.gr",
                      "support@kalypsis.gr",
                      "privacy@kalypsis.gr"
                    ]} mono />
                  <ContactRow icon={<AccessTimeIcon fontSize="small" />}
                    title={t("contact.info.hours.title")}
                    body={[t("contact.info.hours.weekdays"), t("contact.info.hours.support")]} last />
                </Box>
              </Box>
            </EdReveal>
          </Box>
        </Container>
      </Box>
    </PublicShell>
  );
}

function ContactRow({ icon, title, body, mono, last }:
  { icon: React.ReactNode; title: string; body: string[]; mono?: boolean; last?: boolean }) {
  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: "24px 1fr",
      gap: 3,
      py: 3,
      borderBottom: last ? "none" : "1px solid var(--rule)"
    }}>
      <Box sx={{ color: "var(--ink)", pt: 0.5 }}>{icon}</Box>
      <Box>
        <Box className="eyebrow" sx={{ mb: 1 }}>{title}</Box>
        {body.map((line) => (
          <Box key={line} sx={{
            fontFamily: mono ? "var(--mono)" : "var(--sans)",
            fontSize: 14,
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
