import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Checkbox, Container, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { HostingNavbar } from "../components/HostingNavbar";
import { PublicFooter } from "../components/PublicFooter";
import { api, extractErrorMessage } from "../api/client";

type HostingRequest = { reference: string; email: string; plan: string; domain: string; createdAt: string };
const REQUEST_KEY = "kalypsis-hosting-request-v1";

function HostingShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <Box sx={{ minHeight: "100vh", bgcolor: "#F3F7FC", color: "#092647", display: "flex", flexDirection: "column" }}>
    <HostingNavbar />
    <Container component="main" maxWidth="md" sx={{ py: { xs: 4, md: 7 }, flex: 1 }}>
      <Button component={RouterLink} to="/hosting" startIcon={<ArrowBackIcon />} sx={{ mb: 2, color: "#14599F", textTransform: "none", fontWeight: 800 }}>Επιστροφή στο Hosting</Button>
      <Box sx={{ p: { xs: 2.5, sm: 4, md: 5 }, bgcolor: "#fff", border: "1px solid #D7E3EF", borderRadius: 3, boxShadow: "0 16px 40px rgba(11,43,84,.08)" }}>
        <Typography component="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 900, lineHeight: 1.15, mb: 1 }}>{title}</Typography>
        <Typography sx={{ color: "#506981", lineHeight: 1.7, mb: 3 }}>{subtitle}</Typography>
        {children}
      </Box>
    </Container>
    <PublicFooter />
  </Box>;
}

export function HostingRegisterPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState(params.get("plan") || "Business");
  const [domain, setDomain] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!consent) { setError("Χρειάζεται η συγκατάθεσή σας για να επικοινωνήσουμε σχετικά με το αίτημα φιλοξενίας."); return; }
    setBusy(true);
    try {
      const response = await api.post<{ reference: string }>("/public/contact", {
        inquiryType: "sales",
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() || null,
        agencyOrCity: null, subject: "Αίτημα φιλοξενίας KALYPSIS",
        message: `Αίτημα φιλοξενίας. Πακέτο: ${plan}. Domain: ${domain.trim() || "Δεν έχει οριστεί"}. Email: ${email.trim()}.`,
        consent, website: "",
      });
      const request: HostingRequest = { reference: response.data.reference, email: email.trim(), plan, domain: domain.trim(), createdAt: new Date().toISOString() };
      sessionStorage.setItem(REQUEST_KEY, JSON.stringify(request));
      setDone(true);
    } catch (submitError) {
      setError(extractErrorMessage(submitError, "Δεν στάθηκε δυνατή η αποστολή. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά."));
    } finally { setBusy(false); }
  };

  return <HostingShell title="Αίτημα φιλοξενίας" subtitle="Στείλτε τα στοιχεία σας για να επικοινωνήσει μαζί σας η ομάδα KALYPSIS. Η δημιουργία λογαριασμού, η αγορά και η σύνδεση domain δεν είναι ακόμη ενεργές.">
    {done ? <Stack spacing={2}>
      <Alert icon={<CheckCircleOutlineIcon />} severity="success">Το αίτημά σας καταχωρήθηκε. Κωδικός αναφοράς: <strong>{JSON.parse(sessionStorage.getItem(REQUEST_KEY) || "{}").reference}</strong></Alert>
      <Typography sx={{ color: "#506981" }}>Μπορείτε να παρακολουθείτε την καταχώρηση αυτού του αιτήματος από τον πίνακα αιτήματος σε αυτή τη συσκευή.</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}><Button component={RouterLink} to="/hosting/dashboard" variant="contained" sx={{ bgcolor: "#16864A", fontWeight: 850, textTransform: "none" }}>Προβολή αιτήματος</Button><Button component={RouterLink} to="/hosting" sx={{ textTransform: "none" }}>Επιστροφή στο Hosting</Button></Stack>
    </Stack> : <Box component="form" onSubmit={submit}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <TextField required label="Όνομα" value={firstName} onChange={e => setFirstName(e.target.value)} />
        <TextField required label="Επώνυμο" value={lastName} onChange={e => setLastName(e.target.value)} />
        <TextField required type="email" label="Email επικοινωνίας" value={email} onChange={e => setEmail(e.target.value)} />
        <TextField label="Τηλέφωνο" value={phone} onChange={e => setPhone(e.target.value)} />
        <TextField select label="Πακέτο ενδιαφέροντος" value={plan} onChange={e => setPlan(e.target.value)}>
          {["Start", "Business", "Professional", "Enterprise"].map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <TextField label="Domain (προαιρετικό)" placeholder="example.gr" value={domain} onChange={e => setDomain(e.target.value)} />
      </Box>
      <FormControlLabel sx={{ mt: 1.5, alignItems: "flex-start", "& .MuiFormControlLabel-label": { color: "#405B77", fontSize: 13.5, lineHeight: 1.55 } }} control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} />} label="Συμφωνώ να χρησιμοποιηθούν τα στοιχεία μου για την επικοινωνία σχετικά με αυτό το αίτημα. Δείτε την Πολιτική Απορρήτου." />
      {params.get("topic") === "domain" && <Alert severity="info" sx={{ mt: 2 }}>Ο αυτόματος έλεγχος/κατοχύρωση domain δεν είναι διαθέσιμος ακόμη. Γράψτε το domain στο πεδίο για να το ελέγξει η ομάδα μας.</Alert>}
      <Button type="submit" disabled={busy} variant="contained" sx={{ mt: 2.5, bgcolor: "#16864A", fontWeight: 850, textTransform: "none", px: 3, py: 1.2 }}>{busy ? "Αποστολή…" : "Αποστολή αιτήματος"}</Button>
    </Box>}
  </HostingShell>;
}

export function HostingLoginPage() {
  return <HostingShell title="Σύνδεση πελάτη φιλοξενίας" subtitle="Η πύλη σύνδεσης πελατών δεν έχει ενεργοποιηθεί ακόμη, επειδή δεν υπάρχει υποδομή λογαριασμών hosting συνδεδεμένη στην εφαρμογή.">
    <Alert severity="info" sx={{ mb: 2 }}>Μην χρησιμοποιήσετε εδώ τον κωδικό KALYPSIS BackOffice. Δεν υπάρχει ακόμη hosting λογαριασμός για σύνδεση.</Alert>
    <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
      <Button component={RouterLink} to="/hosting/register" variant="contained" sx={{ bgcolor: "#16864A", fontWeight: 850, textTransform: "none" }}>Υποβολή αιτήματος φιλοξενίας</Button>
      <Button component={RouterLink} to="/contact" sx={{ textTransform: "none", fontWeight: 800 }}>Επικοινωνία με την ομάδα</Button>
    </Stack>
  </HostingShell>;
}

export function HostingDashboardPage() {
  let request: HostingRequest | null = null;
  try { request = JSON.parse(sessionStorage.getItem(REQUEST_KEY) || "null") as HostingRequest | null; } catch { request = null; }
  return <HostingShell title="Πίνακας αιτήματος φιλοξενίας" subtitle="Εδώ εμφανίζονται τα στοιχεία του αιτήματος που υποβλήθηκε από αυτή τη συσκευή.">
    {request ? <Stack spacing={1.5}>
      <Alert severity="success">Το αίτημα έχει σταλεί στην ομάδα KALYPSIS.</Alert>
      <Typography><strong>Αναφορά:</strong> {request.reference}</Typography>
      <Typography><strong>Email:</strong> {request.email}</Typography>
      <Typography><strong>Πακέτο ενδιαφέροντος:</strong> {request.plan}</Typography>
      <Typography><strong>Domain:</strong> {request.domain || "Δεν έχει οριστεί"}</Typography>
      <Typography><strong>Κατάσταση υπηρεσίας:</strong> Σε προετοιμασία — δεν έχει δημιουργηθεί hosting λογαριασμός.</Typography>
    </Stack> : <Stack spacing={2}>
      <Alert severity="info">Δεν υπάρχει αποθηκευμένο αίτημα σε αυτή τη συσκευή. Η σελίδα αυτή δεν αποτελεί ακόμη πίνακα ενεργού hosting λογαριασμού.</Alert>
      <Button component={RouterLink} to="/hosting/register" variant="contained" sx={{ alignSelf: "flex-start", bgcolor: "#16864A", fontWeight: 850, textTransform: "none" }}>Δημιουργία αιτήματος</Button>
    </Stack>}
  </HostingShell>;
}
