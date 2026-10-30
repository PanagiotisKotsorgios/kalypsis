import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  IconButton,
  Link,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import { AccessibilityWidget } from "../components/AccessibilityWidget";
import { LanguageToggle } from "../components/LanguageToggle";
import { CompanyComingSoonBadge } from "../components/CompanyComingSoonBadge";
import { PageEnter } from "../components/PageEnter";
import { PublicFooter } from "../components/PublicFooter";
import { api, extractErrorMessage } from "../api/client";

const NAVY = "#0b2545";
const BLUE = "#17417f";
const ACCENT = "#1f7bb3";
const PALE = "#edf5fc";

type FormState = {
  inquiryType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  agencyOrCity: string;
  subject: string;
  message: string;
  consent: boolean;
  website: string;
};

const EMPTY: FormState = {
  inquiryType: "sales", firstName: "", lastName: "", email: "", phone: "",
  agencyOrCity: "", subject: "", message: "", consent: false, website: "",
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 54,
    borderRadius: "12px",
    bgcolor: "#fff",
    color: NAVY,
    "& fieldset": { borderColor: "#bac9d9", borderWidth: "1.5px" },
    "&:hover fieldset": { borderColor: BLUE },
    "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 2 },
  },
  "& .MuiInputLabel-root": { color: "#475a70", fontWeight: 650 },
  "& .MuiInputLabel-root.Mui-focused": { color: BLUE },
  "& .MuiInputBase-input": { fontWeight: 550 },
} as const;

/** Independent company-facing contact page. It deliberately submits to the
 * same public Brevo endpoint as /contact, preserving server validation,
 * honeypot handling, consent capture and IP rate limiting. */
export function CompanyContactPage() {
  const { t, i18n } = useTranslation();
  const english = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith("en");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"phone" | "email" | null>(null);
  const [copyNotice, setCopyNotice] = useState(false);
  const txt = (el: string, en: string) => english ? en : el;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const copy = async (kind: "phone" | "email", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setCopyNotice(true);
      window.setTimeout(() => setCopied(current => current === kind ? null : current), 1500);
    } catch {
      setError(txt("Δεν ήταν δυνατή η αντιγραφή. Δοκιμάστε ξανά.", "Copy failed. Please try again."));
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(txt("Συμπληρώστε όνομα και επώνυμο.", "Enter your first and last name.")); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError(txt("Το email δεν είναι έγκυρο.", "Enter a valid email address.")); return;
    }
    if (!form.subject.trim() || form.message.trim().length < 10) {
      setError(txt("Συμπληρώστε θέμα και μήνυμα τουλάχιστον 10 χαρακτήρων.", "Add a subject and a message of at least 10 characters.")); return;
    }
    if (!form.consent) {
      setError(txt("Αποδεχτείτε την πολιτική απορρήτου για να συνεχίσετε.", "Accept the privacy notice to continue.")); return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<{ reference: string; delivered: boolean }>("/public/contact", {
        inquiryType: form.inquiryType,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        agencyOrCity: form.agencyOrCity.trim() || null,
        subject: form.subject.trim(),
        message: form.message.trim(),
        consent: form.consent,
        website: form.website,
      });
      setReference(result.data.reference);
      setForm(EMPTY);
    } catch (ex) {
      setError(extractErrorMessage(ex, txt("Δεν ήταν δυνατή η αποστολή. Δοκιμάστε ξανά.", "The message could not be sent. Please try again.")));
    } finally {
      setBusy(false);
    }
  };

  const options = [
    ["sales", txt("Ενημέρωση & πωλήσεις", "Product information & sales")],
    ["support", txt("Τεχνική υποστήριξη", "Technical support")],
    ["agency", txt("Ασφαλιστικό γραφείο", "Insurance agency")],
    ["agent", txt("Ασφαλιστικός διαμεσολαβητής", "Insurance intermediary")],
    ["other", txt("Άλλο αίτημα", "Other request")],
  ];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", color: NAVY, bgcolor: "#f4f8fc", overflow: "hidden" }}>
      <Box sx={{ height: 5, background: "linear-gradient(90deg, #0b2545, #1f7bb3 52%, #58b6dc)" }} />
      <Box component="header" sx={{ position: "relative", zIndex: 2, bgcolor: "rgba(255,255,255,.94)", borderBottom: "1px solid #d9e4ef", boxShadow: "0 8px 24px rgba(11,37,69,.06)" }}>
        <Container maxWidth="xl" sx={{ py: { xs: 1.25, md: 1.7 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Stack component={RouterLink} to="/" direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, textDecoration: "none", color: NAVY }}>
              <Box component="img" src="/kalypsis-logo.png?v=2026-07-01" alt="KALYPSIS" sx={{ width: { xs: 42, md: 50 }, height: { xs: 42, md: 50 }, objectFit: "contain" }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: 13, md: 16 }, fontWeight: 900, letterSpacing: ".08em", lineHeight: 1.2 }}>KALYPSIS</Typography>
                <Typography sx={{ fontSize: { xs: 9, md: 10 }, fontWeight: 750, letterSpacing: ".17em", color: "#64758a" }}>SOFTWARE SOLUTIONS</Typography>
              </Box>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }}>
              <Button component="a" href="tel:+302631028971" startIcon={<PhoneRoundedIcon />} sx={{ display: { xs: "none", sm: "inline-flex" }, color: NAVY, textTransform: "none", fontWeight: 750, borderRadius: 2 }}>
                2631 028971
              </Button>
              <LanguageToggle />
              <Button component={RouterLink} to="/" endIcon={<ArrowForwardRoundedIcon sx={{ transform: "rotate(180deg)" }} />} sx={{ border: "1px solid #c7d8e8", borderRadius: 2.5, px: { xs: 1.25, md: 2 }, color: NAVY, fontWeight: 800, textTransform: "none", bgcolor: "#fff", "&:hover": { bgcolor: PALE, borderColor: ACCENT } }}>
                {txt("Αρχική", "Home")}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <CompanyComingSoonBadge english={english} />
      <PageEnter>
        <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5.5 }, flex: 1 }}>
          <Box sx={{ mb: { xs: 3, md: 4.5 }, maxWidth: 950 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ color: ACCENT, mb: 1.25 }}>
              <HubRoundedIcon sx={{ fontSize: 19 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase" }}>
                {txt("KALYPSIS SOFTWARE SOLUTIONS", "KALYPSIS SOFTWARE SOLUTIONS")}
              </Typography>
            </Stack>
            <Typography component="h1" sx={{ fontSize: { xs: 34, sm: 44, lg: 56 }, lineHeight: 1.05, letterSpacing: "-.035em", fontWeight: 900, color: NAVY, maxWidth: 900 }}>
              {txt("Ας συζητήσουμε για τις ανάγκες της επιχείρησής σας.", "Let’s talk about what your business needs.")}
            </Typography>
            <Typography sx={{ mt: 1.75, maxWidth: 790, fontSize: { xs: 16, md: 18 }, lineHeight: 1.75, color: "#51647b" }}>
              {txt("Πείτε μας τι θέλετε να οργανώσετε ή να βελτιώσετε. Η ομάδα της KALYPSIS θα επικοινωνήσει μαζί σας για το αίτημά σας.", "Tell us what you would like to organize or improve. The KALYPSIS team will get back to you about your request.")}
            </Typography>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, .88fr) minmax(0, 1.12fr)" }, gap: { xs: 2.5, md: 3.5 }, alignItems: "stretch" }}>
            <Box sx={{ borderRadius: { xs: 3, md: 4 }, bgcolor: "#fff", overflow: "hidden", border: "1px solid #d6e2ed", boxShadow: "0 22px 54px rgba(11,37,69,.10)", display: "flex", flexDirection: "column" }}>
              <Box sx={{ px: { xs: 2.5, md: 3.5 }, py: { xs: 2.3, md: 2.8 }, color: "#fff", background: "linear-gradient(120deg, #0b2545, #17417f 75%, #1f7bb3)" }}>
                <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 900 }}>{txt("Επικοινωνήστε μαζί μας", "Get in touch")}</Typography>
                <Typography sx={{ mt: .7, fontSize: 14.5, color: "rgba(255,255,255,.78)", lineHeight: 1.6 }}>{txt("Επιλέξτε τον τρόπο που σας εξυπηρετεί.", "Choose the way that works best for you.")}</Typography>
              </Box>
              <Box sx={{ p: { xs: 2, md: 3 }, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.6, flex: 1 }}>
                <ContactChannel
                  icon={<PhoneRoundedIcon />}
                  label={txt("Τηλέφωνο", "Phone")}
                  value="2631 028971"
                  href="tel:+302631028971"
                  copied={copied === "phone"}
                  copyLabel={txt("Αντιγραφή τηλεφώνου", "Copy phone number")}
                  onCopy={() => void copy("phone", "+302631028971")}
                />
                <ContactChannel
                  icon={<EmailRoundedIcon />}
                  label={txt("Email", "Email")}
                  value="info@mykalypsis.gr"
                  href="mailto:info@mykalypsis.gr"
                  copied={copied === "email"}
                  copyLabel={txt("Αντιγραφή email", "Copy email")}
                  onCopy={() => void copy("email", "info@mykalypsis.gr")}
                />
                <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" }, mt: .6, p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: PALE, border: "1px solid #d9e8f4", display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: "14px", display: "grid", placeItems: "center", color: BLUE, bgcolor: "#fff", border: "1px solid #d7e5f1", flex: "0 0 auto" }}><ShieldRoundedIcon /></Box>
                  <Box>
                    <Typography sx={{ fontWeight: 850, color: NAVY }}>{txt("Το αίτημά σας φτάνει στην ομάδα μας", "Your request reaches our team")}</Typography>
                    <Typography sx={{ mt: .45, fontSize: 13.5, color: "#566b82", lineHeight: 1.65 }}>{txt("Τα στοιχεία χρησιμοποιούνται για την απάντηση στο συγκεκριμένο μήνυμά σας και προστατεύονται σύμφωνα με την πολιτική απορρήτου.", "Your details are used to respond to this message and handled according to our privacy policy.")}</Typography>
                  </Box>
                </Box>
                <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" }, p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: "#fbfdff", border: "1px solid #e0e9f1" }}>
                  <Typography sx={{ mb: 1.2, fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "#64788e" }}>{txt("Μπορούμε να σας βοηθήσουμε με", "We can help with")}</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {["KALYPSIS Web", "KALYPSIS Desktop", txt("Ενσωματώσεις", "Integrations"), txt("Συνεργασίες", "Partnerships")].map(item => (
                      <Box key={item} sx={{ borderRadius: 999, border: "1px solid #ceddea", bgcolor: "#fff", px: 1.3, py: .65, color: BLUE, fontWeight: 750, fontSize: 12 }}>{item}</Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Box>

            <Box sx={{ borderRadius: { xs: 3, md: 4 }, overflow: "hidden", bgcolor: "#fff", border: "1px solid #d6e2ed", boxShadow: "0 22px 54px rgba(11,37,69,.12)" }}>
              <Box sx={{ px: { xs: 2.5, md: 3.5 }, py: { xs: 2.3, md: 2.8 }, color: "#fff", bgcolor: NAVY, borderBottom: `4px solid ${ACCENT}`, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "14px", bgcolor: "rgba(255,255,255,.11)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><ChatBubbleOutlineRoundedIcon /></Box>
                <Box>
                  <Typography sx={{ fontSize: 11, letterSpacing: ".16em", fontWeight: 800, color: "rgba(255,255,255,.7)" }}>KALYPSIS SOFTWARE SOLUTIONS</Typography>
                  <Typography sx={{ fontSize: { xs: 19, md: 23 }, fontWeight: 900, mt: .2 }}>{txt("Στείλτε μας μήνυμα", "Send us a message")}</Typography>
                </Box>
              </Box>

              <Box sx={{ p: { xs: 2, sm: 3, md: 3.5 } }}>
                {reference ? (
                  <Stack alignItems="center" textAlign="center" justifyContent="center" sx={{ minHeight: 430, px: 2 }}>
                    <CheckCircleRoundedIcon sx={{ color: "#16834b", fontSize: 66, mb: 1.5 }} />
                    <Typography sx={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{txt("Λάβαμε το μήνυμά σας", "Message received")}</Typography>
                    <Typography sx={{ mt: 1, maxWidth: 480, color: "#566b82", lineHeight: 1.7 }}>{txt("Ευχαριστούμε για την επικοινωνία. Η ομάδα μας θα εξετάσει το αίτημά σας.", "Thank you for contacting us. Our team will review your request.")}</Typography>
                    <Box sx={{ mt: 2.5, px: 2.5, py: 1.2, borderRadius: 2.5, color: BLUE, bgcolor: PALE, fontWeight: 850, letterSpacing: ".08em" }}>{txt("ΚΩΔΙΚΟΣ ΑΙΤΗΜΑΤΟΣ", "REQUEST REFERENCE")} · {reference}</Box>
                    <Button onClick={() => setReference(null)} sx={{ mt: 2.5, color: BLUE, fontWeight: 850, textTransform: "none" }}>{txt("Νέο μήνυμα", "Send another message")}</Button>
                  </Stack>
                ) : (
                  <>
                    {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.2, borderRadius: 2 }}>{error}</Alert>}
                    <form onSubmit={submit} noValidate>
                      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={event => set("website", event.target.value)} aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
                      <Stack spacing={1.65}>
                        <TextField select fullWidth label={txt("Θέμα επικοινωνίας", "Reason for contacting us")} value={form.inquiryType} onChange={event => set("inquiryType", event.target.value)} sx={fieldSx}>
                          {options.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                        </TextField>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.65}>
                          <TextField required fullWidth label={t("contact.form.firstName", txt("Όνομα", "First name"))} value={form.firstName} onChange={event => set("firstName", event.target.value)} sx={fieldSx} />
                          <TextField required fullWidth label={t("contact.form.lastName", txt("Επώνυμο", "Last name"))} value={form.lastName} onChange={event => set("lastName", event.target.value)} sx={fieldSx} />
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.65}>
                          <TextField required type="email" fullWidth label={t("contact.form.email", "Email")} value={form.email} onChange={event => set("email", event.target.value)} sx={fieldSx} />
                          <TextField fullWidth label={t("contact.form.phone", txt("Τηλέφωνο (προαιρετικό)", "Phone (optional)"))} value={form.phone} onChange={event => set("phone", event.target.value)} sx={fieldSx} />
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.65}>
                          <TextField fullWidth label={t("contact.form.agencyOrCity", txt("Γραφείο / πόλη (προαιρετικό)", "Company / city (optional)"))} value={form.agencyOrCity} onChange={event => set("agencyOrCity", event.target.value)} sx={fieldSx} />
                          <TextField required fullWidth label={t("contact.form.subject", txt("Θέμα", "Subject"))} value={form.subject} onChange={event => set("subject", event.target.value)} sx={fieldSx} />
                        </Stack>
                        <TextField required fullWidth multiline minRows={4} label={t("contact.form.message", txt("Το μήνυμά σας", "Your message"))} placeholder={t("contact.form.messagePlaceholder", txt("Περιγράψτε σύντομα το αίτημά σας…", "Briefly describe your request…"))} value={form.message} onChange={event => set("message", event.target.value)} sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { ...fieldSx["& .MuiOutlinedInput-root"], alignItems: "flex-start", py: 1 } }} />
                        <FormControlLabel
                          sx={{ alignItems: "flex-start", ml: 0, mr: 0 }}
                          control={<Checkbox checked={form.consent} onChange={event => set("consent", event.target.checked)} sx={{ color: "#73869b", pt: .4, "&.Mui-checked": { color: ACCENT } }} />}
                          label={<Typography sx={{ pt: .5, fontSize: 13, lineHeight: 1.65, color: "#455a70" }}>{t("contact.form.consent", txt("Συναινώ να επικοινωνήσει μαζί μου η ομάδα KALYPSIS για το συγκεκριμένο αίτημα και αποδέχομαι την Πολιτική Απορρήτου.", "I agree that KALYPSIS may contact me about this request and accept the Privacy Policy."))}{" "}<Link component={RouterLink} to="/privacy" sx={{ color: BLUE, fontWeight: 800 }}>{txt("Πολιτική Απορρήτου", "Privacy Policy")}</Link></Typography>}
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1.5} sx={{ pt: .3 }}>
                          <Stack direction="row" alignItems="center" spacing={.8} sx={{ color: "#687b8e", fontSize: 12.5 }}><ShieldRoundedIcon sx={{ fontSize: 17, color: ACCENT }} /><span>{txt("Ασφαλής αποστολή · Τα στοιχεία σας χρησιμοποιούνται για την απάντηση.", "Secure submission · Your details are used to respond.")}</span></Stack>
                          <Button type="submit" disabled={busy} variant="contained" endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRoundedIcon />} sx={{ flexShrink: 0, minHeight: 54, px: 3.4, borderRadius: 2.5, bgcolor: NAVY, color: "#fff", fontSize: 15, fontWeight: 850, textTransform: "none", boxShadow: "0 10px 22px rgba(11,37,69,.2)", "&:hover": { bgcolor: BLUE, transform: "translateY(-1px)", boxShadow: "0 14px 26px rgba(11,37,69,.24)" }, "&:disabled": { color: "#fff", bgcolor: "#8fa3b9" }, transition: "all .2s ease" }}>
                            {busy ? txt("Αποστολή…", "Sending…") : txt("Αποστολή αιτήματος", "Send inquiry")}
                          </Button>
                        </Stack>
                      </Stack>
                    </form>
                  </>
                )}
              </Box>
            </Box>
          </Box>
          <Typography sx={{ mt: 2.2, textAlign: "center", fontSize: 12.5, color: "#65798e" }}>
            {txt("Η φόρμα προστατεύεται από αυτοματοποιημένες υποβολές και περιορισμό αιτημάτων.", "The form is protected against automated submissions and request abuse.")}
          </Typography>
        </Container>
      </PageEnter>
      <PublicFooter />
      <AccessibilityWidget />
      <Snackbar open={copyNotice} autoHideDuration={1700} onClose={() => setCopyNotice(false)} message={txt("Αντιγράφηκε στο πρόχειρο", "Copied to clipboard")} />
    </Box>
  );
}

function ContactChannel({ icon, label, value, href, copied, copyLabel, onCopy }: {
  icon: React.ReactNode; label: string; value: string; href: string; copied: boolean; copyLabel: string; onCopy: () => void;
}) {
  return (
    <Box sx={{ position: "relative", minWidth: 0, minHeight: 166, p: { xs: 2, md: 2.35 }, borderRadius: 3, border: "1px solid #d7e3ee", bgcolor: "#fff", transition: "transform .22s ease, border-color .22s ease, box-shadow .22s ease", "&:hover": { transform: "translateY(-3px)", borderColor: "#8bb8d5", boxShadow: "0 12px 26px rgba(11,37,69,.09)" } }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "13px", display: "grid", placeItems: "center", color: "#fff", bgcolor: BLUE, boxShadow: "0 6px 14px rgba(23,65,127,.22)" }}>{icon}</Box>
      <Typography sx={{ mt: 1.6, fontWeight: 850, fontSize: 14, color: "#61758a" }}>{label}</Typography>
      <Stack direction="row" alignItems="center" gap={.3} sx={{ mt: .35, minWidth: 0 }}>
        <Box component="a" href={href} sx={{ minWidth: 0, overflowWrap: "anywhere", color: NAVY, textDecoration: "none", fontSize: { xs: 15, md: 16 }, fontWeight: 850, "&:hover": { color: ACCENT } }}>{value}</Box>
        <IconButton size="small" aria-label={copyLabel} title={copied ? "Copied" : copyLabel} onClick={onCopy} sx={{ ml: "auto", color: copied ? "#16834b" : "#7b8ea2", flex: "0 0 auto", transition: "all .18s ease", "&:hover": { color: ACCENT, bgcolor: PALE, transform: "scale(1.08)" } }}>
          {copied ? <CheckCircleRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
        </IconButton>
      </Stack>
    </Box>
  );
}
