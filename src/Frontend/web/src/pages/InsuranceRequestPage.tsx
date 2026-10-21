import { useMemo, useState, type FormEvent } from "react";
import {
  Alert, Box, Button, Checkbox, CircularProgress, Container, FormControlLabel,
  InputAdornment, Link, MenuItem, Paper, Stack, TextField, Typography
} from "@mui/material";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import { useMutation } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { KalypsisLogo } from "../components/KalypsisLogo";

const TYPES = [
  "Αυτοκίνητο", "Μοτοσικλέτα", "Κατοικία", "Υγεία", "Ζωή",
  "Επαγγελματική ασφάλιση", "Ταξιδιωτική ασφάλιση", "Άλλο"
] as const;

type FormState = {
  fullName: string;
  insuranceType: string;
  insuranceSubject: string;
  email: string;
  phone: string;
  preferredContact: "phone" | "email";
  message: string;
  consentGiven: boolean;
};

const EMPTY_FORM: FormState = {
  fullName: "", insuranceType: "", insuranceSubject: "", email: "", phone: "",
  preferredContact: "phone", message: "", consentGiven: false
};

function subjectMeta(type: string) {
  if (type === "Αυτοκίνητο" || type === "Μοτοσικλέτα") return { label: "Αριθμός κυκλοφορίας", placeholder: "π.χ. ΙΒΧ 1234", icon: <DirectionsCarOutlinedIcon /> };
  if (type === "Κατοικία" || type === "Επαγγελματική ασφάλιση") return { label: "Πόλη ή διεύθυνση ακινήτου", placeholder: "π.χ. Αθήνα, Χαλάνδρι", icon: <HomeWorkOutlinedIcon /> };
  if (type === "Υγεία" || type === "Ζωή") return { label: "Ηλικία ενδιαφερόμενου", placeholder: "π.χ. 38", icon: <PersonOutlineIcon /> };
  if (type === "Ταξιδιωτική ασφάλιση") return { label: "Προορισμός", placeholder: "π.χ. Ιταλία", icon: <CategoryOutlinedIcon /> };
  return { label: "Τι θέλετε να ασφαλίσετε;", placeholder: "Σύντομη περιγραφή", icon: <ShieldOutlinedIcon /> };
}

export function InsuranceRequestPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<{ message: string; reference: string } | null>(null);
  const meta = useMemo(() => subjectMeta(form.insuranceType), [form.insuranceType]);

  const submit = useMutation({
    mutationFn: async () => (await api.post<{ message: string; reference: string }>("/public/office-sites/kalypsis/insurance-request", form)).data,
    onSuccess: data => { setResult(data); setFieldErrors({}); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setFieldErrors(previous => ({ ...previous, [key]: undefined }));
  };

  const validate = () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (form.fullName.trim().length < 2) errors.fullName = "Συμπληρώστε το ονοματεπώνυμό σας.";
    if (!TYPES.includes(form.insuranceType as typeof TYPES[number])) errors.insuranceType = "Επιλέξτε κλάδο ασφάλισης.";
    if (form.insuranceSubject.trim().length < 2) errors.insuranceSubject = `Συμπληρώστε: ${meta.label.toLowerCase()}.`;
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Συμπληρώστε έγκυρο email.";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = "Συμπληρώστε έγκυρο τηλέφωνο.";
    if (!form.consentGiven) errors.consentGiven = "Η συγκατάθεση είναι απαραίτητη για να επικοινωνήσουμε μαζί σας.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (validate()) submit.mutate();
  };

  return <Box sx={{ minHeight: "100vh", bgcolor: "#eaf1f8", color: "#102c55", position: "relative", overflow: "hidden" }}>
    <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 8% 12%, rgba(8,124,235,.17), transparent 30%), radial-gradient(circle at 94% 88%, rgba(30,167,225,.16), transparent 28%), linear-gradient(135deg,#f7fbff 0%,#e7f0f9 100%)" }} />
    <Box aria-hidden sx={{ position: "absolute", width: 360, height: 360, border: "70px solid rgba(8,124,235,.055)", borderRadius: "50%", right: -170, top: -170 }} />

    <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, py: { xs: 2, md: 4 } }}>
      <Stack component="header" direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: { xs: 2, md: 3 } }}>
        <KalypsisLogo size={58} crop />
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "#47627f" }}>
          <LockOutlinedIcon sx={{ fontSize: 17, color: "#087ceb" }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 750, display: { xs: "none", sm: "block" } }}>Ασφαλής αποστολή στοιχείων</Typography>
        </Stack>
      </Stack>

      {result ? <Paper elevation={0} sx={{ maxWidth: 650, mx: "auto", p: { xs: 3, sm: 5 }, borderRadius: 4, textAlign: "center", border: "1px solid #cfe0ef", boxShadow: "0 24px 70px rgba(11,48,92,.13)" }}>
        <CheckCircleRoundedIcon sx={{ fontSize: 68, color: "#159b59", mb: 1.5 }} />
        <Typography variant="h4" sx={{ fontWeight: 900, color: "#0b305c", mb: 1 }}>Το αίτημα στάλθηκε</Typography>
        <Typography sx={{ color: "#5b708b", mb: 2 }}>{result.message}</Typography>
        <Box sx={{ display: "inline-flex", px: 2, py: 1, borderRadius: 2, bgcolor: "#e8f2fc", color: "#0b5cad", fontWeight: 850 }}>Κωδικός: {result.reference}</Box>
        <Typography variant="body2" sx={{ color: "#6b7e96", mt: 2.5 }}>Κρατήστε τον κωδικό για οποιαδήποτε επικοινωνία σχετικά με το αίτημά σας.</Typography>
        <Button variant="outlined" sx={{ mt: 3, fontWeight: 800 }} onClick={() => { setResult(null); setForm(EMPTY_FORM); }}>Νέο αίτημα</Button>
      </Paper> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(300px,.8fr) minmax(520px,1.2fr)" }, gap: { xs: 2, md: 3 }, alignItems: "stretch" }}>
        <Box sx={{ p: { xs: 1, md: 3 }, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, alignSelf: "flex-start", px: 1.25, py: 0.65, borderRadius: 5, bgcolor: "#dcecff", color: "#075fae", fontWeight: 850, fontSize: 12.5, mb: 2 }}>
            <ShieldOutlinedIcon sx={{ fontSize: 18 }} /> ΑΙΤΗΜΑ ΑΣΦΑΛΙΣΗΣ
          </Box>
          <Typography component="h1" sx={{ fontSize: { xs: 32, sm: 42, md: 48 }, lineHeight: 1.06, letterSpacing: -1.3, fontWeight: 950, color: "#0b305c", maxWidth: 560 }}>
            Πείτε μας τι θέλετε να ασφαλίσετε.
          </Typography>
          <Typography sx={{ mt: 2, fontSize: { xs: 16, md: 18 }, lineHeight: 1.65, color: "#536b89", maxWidth: 560 }}>
            Συμπληρώστε τα βασικά στοιχεία και ένας συνεργάτης μας θα επικοινωνήσει μαζί σας για να κατανοήσει τις ανάγκες σας.
          </Typography>
          <Stack spacing={1.25} sx={{ mt: 3 }}>
            {[{ icon: <SupportAgentOutlinedIcon />, text: "Προσωπική επικοινωνία χωρίς περίπλοκα βήματα" }, { icon: <ShieldOutlinedIcon />, text: "Καθοδήγηση για τις καλύψεις που σας ενδιαφέρουν" }, { icon: <LockOutlinedIcon />, text: "Τα στοιχεία σας χρησιμοποιούνται μόνο για το αίτημα" }].map(item =>
              <Stack key={item.text} direction="row" spacing={1.1} alignItems="center"><Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#e1effd", color: "#087ceb", "& svg": { fontSize: 19 } }}>{item.icon}</Box><Typography sx={{ color: "#38536f", fontWeight: 700, fontSize: 14 }}>{item.text}</Typography></Stack>)}
          </Stack>
        </Box>

        <Paper component="form" onSubmit={handleSubmit} noValidate elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: { xs: 3, md: 4 }, border: "1px solid #cbdbea", bgcolor: "rgba(255,255,255,.96)", boxShadow: "0 26px 70px rgba(11,48,92,.14)" }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0b305c" }}>Στοιχεία αιτήματος</Typography>
          <Typography variant="body2" sx={{ color: "#667b98", mt: 0.5, mb: 2.5 }}>Τα πεδία με αστερίσκο είναι απαραίτητα.</Typography>
          {submit.isError && <Alert severity="error" sx={{ mb: 2 }}>{extractErrorMessage(submit.error, "Δεν ήταν δυνατή η αποστολή. Δοκιμάστε ξανά.")}</Alert>}

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField required label="Ονοματεπώνυμο" value={form.fullName} onChange={e => update("fullName", e.target.value)} error={!!fieldErrors.fullName} helperText={fieldErrors.fullName}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlineIcon /></InputAdornment> }} sx={{ gridColumn: { sm: "1 / -1" } }} />
            <TextField required select label="Κλάδος ασφάλισης" value={form.insuranceType} onChange={e => { update("insuranceType", e.target.value); update("insuranceSubject", ""); }} error={!!fieldErrors.insuranceType} helperText={fieldErrors.insuranceType}
              InputProps={{ startAdornment: <InputAdornment position="start"><CategoryOutlinedIcon /></InputAdornment> }} sx={{ gridColumn: { sm: "1 / -1" } }}>
              {TYPES.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </TextField>
            <TextField required label={meta.label} placeholder={meta.placeholder} value={form.insuranceSubject}
              onChange={e => update("insuranceSubject", (form.insuranceType === "Αυτοκίνητο" || form.insuranceType === "Μοτοσικλέτα") ? e.target.value.toUpperCase() : e.target.value)}
              error={!!fieldErrors.insuranceSubject} helperText={fieldErrors.insuranceSubject}
              InputProps={{ startAdornment: <InputAdornment position="start">{meta.icon}</InputAdornment> }} sx={{ gridColumn: { sm: "1 / -1" } }} />
            <TextField required type="email" label="Email" value={form.email} onChange={e => update("email", e.target.value)} error={!!fieldErrors.email} helperText={fieldErrors.email}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlinedIcon /></InputAdornment> }} />
            <TextField required type="tel" label="Τηλέφωνο" value={form.phone} onChange={e => update("phone", e.target.value)} error={!!fieldErrors.phone} helperText={fieldErrors.phone}
              InputProps={{ startAdornment: <InputAdornment position="start"><PhoneOutlinedIcon /></InputAdornment> }} />
            <TextField select label="Προτιμώμενη επικοινωνία" value={form.preferredContact} onChange={e => update("preferredContact", e.target.value as FormState["preferredContact"])} sx={{ gridColumn: { sm: "1 / -1" } }}>
              <MenuItem value="phone">Τηλεφωνικά</MenuItem><MenuItem value="email">Με email</MenuItem>
            </TextField>
            <TextField multiline minRows={2} maxRows={4} label="Σημειώσεις (προαιρετικά)" placeholder="Οτιδήποτε θα μας βοηθήσει να καταλάβουμε καλύτερα το αίτημά σας"
              value={form.message} onChange={e => update("message", e.target.value.slice(0, 3000))}
              InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}><NotesOutlinedIcon /></InputAdornment> }} sx={{ gridColumn: { sm: "1 / -1" } }} />
          </Box>

          <FormControlLabel sx={{ alignItems: "flex-start", mt: 1.5, mx: 0 }} control={<Checkbox checked={form.consentGiven} onChange={e => update("consentGiven", e.target.checked)} sx={{ mt: -0.5, ml: -1 }} />}
            label={<Typography sx={{ fontSize: 12.5, color: fieldErrors.consentGiven ? "#d32f2f" : "#536b89", lineHeight: 1.5 }}>Συναινώ να χρησιμοποιηθούν τα στοιχεία μου για την επικοινωνία σχετικά με αυτό το αίτημα, σύμφωνα με την <Link href="/privacy" target="_blank" fontWeight={750}>Πολιτική Απορρήτου</Link>. *</Typography>} />
          {fieldErrors.consentGiven && <Typography sx={{ color: "#d32f2f", fontSize: 11.5, ml: 4, mt: -0.5 }}>{fieldErrors.consentGiven}</Typography>}

          <Button type="submit" fullWidth size="large" variant="contained" disabled={submit.isPending} endIcon={submit.isPending ? <CircularProgress size={18} color="inherit" /> : <SendRoundedIcon />}
            sx={{ mt: 2, minHeight: 50, borderRadius: 2, fontWeight: 900, textTransform: "none", fontSize: 16, background: "linear-gradient(100deg,#0b5cad,#087ceb)", boxShadow: "0 10px 24px rgba(8,124,235,.25)", "&:hover": { background: "linear-gradient(100deg,#094e92,#066dcc)" } }}>
            {submit.isPending ? "Αποστολή…" : "Αποστολή αιτήματος ασφάλισης"}
          </Button>
          <Typography sx={{ textAlign: "center", mt: 1.25, color: "#7a8da5", fontSize: 11.5 }}>Η υποβολή αποτελεί αίτημα επικοινωνίας και όχι σύναψη ασφαλιστηρίου συμβολαίου.</Typography>
        </Paper>
      </Box>}

      <Typography component="footer" sx={{ textAlign: "center", color: "#70849d", fontSize: 11.5, mt: 3 }}>© {new Date().getFullYear()} KALYPSIS · Ασφαλής διαχείριση αιτημάτων</Typography>
    </Container>
  </Box>;
}
