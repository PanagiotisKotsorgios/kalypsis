import { useId, useState, type FormEvent } from "react";
import { Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, FormControlLabel, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { api, extractErrorMessage } from "../api/client";
import { contractRequestError, contractRequestPayload, emptyContractRequest, type ContractRequestFields } from "./contractRequestModel";

export function ContractIllustration({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  return <Box aria-hidden sx={{ position: "relative", width: compact ? 150 : 185, height: compact ? 155 : 190, flexShrink: 0, mx: "auto" }}>
    <svg viewBox="0 0 190 190" width="100%" height="100%" focusable="false">
      <defs><linearGradient id={`paper-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F7FCFF" /><stop offset="1" stopColor="#9DBFDB" /></linearGradient></defs>
      <path d="M44 12H121L163 53V163Q163 177 149 177H44Q29 177 29 162V27Q29 12 44 12Z" fill={`url(#paper-${id})`} stroke="#D7E8F8" strokeWidth="2" />
      <path d="M121 12V44Q121 54 132 54H163" fill="#ECF6FE" stroke="#C4DAEC" strokeWidth="2" />
      <path d="M57 63H104M57 83H135M57 103H128" stroke="#28658F" strokeWidth="4" strokeLinecap="round" />
      <path d="M112 143Q126 111 118 146Q142 124 133 146L148 141" stroke="#174C77" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
    <Box sx={{ position: "absolute", left: 2, bottom: 4, width: compact ? 64 : 76, height: compact ? 64 : 76, display: "grid", placeItems: "center", borderRadius: "50%", background: "linear-gradient(135deg,#0E6098,#0A2D50)", border: "2px solid #1BA7EB", color: "#fff", boxShadow: "0 8px 20px #001B3555" }}><HandshakeOutlinedIcon sx={{ fontSize: compact ? 35 : 42 }} /></Box>
  </Box>;
}

export function ContractRequestSection() {
  const [open, setOpen] = useState(false);
  return <>
    <Box component="section" aria-labelledby="contract-request-heading" sx={{ mt: 3, p: { xs: 2.5, md: 4 }, display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "center", gap: { xs: 2, md: 3.5 }, color: "#fff", background: "radial-gradient(ellipse at top right, #155784, transparent 65%), linear-gradient(120deg,#153E62,#0C2B4C)", border: "1px solid #367DA7", borderRadius: 3, boxShadow: "0 18px 40px rgba(11,37,69,.14)" }}>
      <Box sx={{ display: { xs: "none", sm: "block" }, p: 1.5, borderRadius: 3, bgcolor: "rgba(42,147,207,.10)" }}><ContractIllustration compact /></Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography id="contract-request-heading" component="h2" sx={{ fontSize: { xs: 25, md: 32 }, fontWeight: 900, lineHeight: 1.25 }}>Ζητήστε σύμβαση συνεργασίας</Typography>
        <Typography sx={{ mt: 1.5, color: "#B7D0E5", fontSize: { xs: 15, md: 18 }, lineHeight: 1.65 }}>Λάβετε τη σύμβαση συνεργασίας του KALYPSIS και ξεκινήστε άμεσα τη διαδικασία ενεργοποίησης.</Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={2} sx={{ mt: 2.25 }}>{["Άμεση αποστολή αιτήματος", "Πλήρες έγγραφο", "Χωρίς δέσμευση"].map(text => <Stack direction="row" key={text} gap={.75} alignItems="center"><CheckCircleIcon sx={{ color: "#74A8D0", fontSize: 23 }} /><Typography sx={{ color: "#C6DCEF", fontSize: 13 }}>{text}</Typography></Stack>)}</Stack>
      </Box>
      <Box sx={{ width: { xs: "100%", md: "auto" }, pl: { md: 3 }, borderLeft: { md: "1px solid #5881A0" } }}><Button variant="contained" size="large" startIcon={<DescriptionOutlinedIcon />} endIcon={<ArrowForwardIcon />} onClick={() => setOpen(true)} aria-haspopup="dialog" sx={{ width: { xs: "100%", md: "auto" }, py: 2, px: 2.5, bgcolor: "#0B8DE0", color: "#fff", border: "1px solid #4BB9F3", borderRadius: 2, fontSize: 17, fontWeight: 850, whiteSpace: "nowrap", textTransform: "none", "&:hover": { bgcolor: "#0775C6" } }}>Ζητήστε σύμβαση</Button></Box>
    </Box>
    <ContractRequestDialog open={open} onClose={() => setOpen(false)} />
  </>;
}

export function ContractRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(emptyContractRequest);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string; delivered: boolean } | null>(null);
  const id = useId();
  const set = (key: keyof ContractRequestFields, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));
  const close = () => { if (!submitting) { onClose(); setForm(emptyContractRequest()); setResult(null); setError(""); } };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (submitting) return;
    const invalid = contractRequestError(form); if (invalid) { setError(invalid); return; }
    setSubmitting(true); setError("");
    try { const response = await api.post<{ reference: string; delivered: boolean }>("/public/contact", contractRequestPayload(form)); setResult(response.data); }
    catch (failure) { setError(extractErrorMessage(failure, "Δεν ήταν δυνατή η αποστολή του αιτήματος. Δοκιμάστε ξανά.")); }
    finally { setSubmitting(false); }
  };
  const field = (key: "firstName" | "lastName" | "email" | "phone" | "companyName" | "message", label: string, placeholder: string, Icon: typeof PersonOutlinedIcon, wide = false) => <Box sx={{ gridColumn: wide ? "1 / -1" : "auto", minWidth: 0 }}>
    <Typography component="label" htmlFor={`${id}-${key}`} sx={{ display: "block", color: "#102D55", fontSize: 13, fontWeight: 750, mb: .75 }}>{label}{key !== "message" && <Box component="span" sx={{ color: "#D93547", ml: .5 }}>*</Box>}</Typography>
    <TextField id={`${id}-${key}`} fullWidth size="small" required={key !== "message"} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} value={form[key]} onChange={event => set(key, key === "phone" ? event.target.value.replace(/[^0-9+ ()-]/g, "") : event.target.value)} placeholder={placeholder} multiline={key === "message"} minRows={key === "message" ? 2 : undefined} autoComplete={{ firstName: "given-name", lastName: "family-name", email: "email", phone: "tel", companyName: "organization", message: "off" }[key]} inputProps={{ maxLength: { firstName: 120, lastName: 120, email: 160, phone: 40, companyName: 200, message: 2000 }[key] }} InputProps={{ startAdornment: <InputAdornment position="start"><Icon sx={{ color: "#557398", fontSize: 20 }} /></InputAdornment> }} />
  </Box>;
  return <Dialog open={open} onClose={close} fullWidth maxWidth="lg" aria-labelledby={`${id}-title`} PaperProps={{ sx: { width: "calc(100% - 24px)", maxWidth: 1080, maxHeight: "calc(100dvh - 24px)", m: 1.5, borderRadius: 3, overflow: "hidden", border: "1px solid #C4D8EB", bgcolor: "#F8FBFE" } }}>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "31% minmax(0,1fr)" }, minHeight: 0, overflowY: "auto" }}>
      <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", p: 3.25, color: "#fff", background: "radial-gradient(ellipse at top right, #133E67, transparent 65%), #0B233D" }}>
        <Box component="img" src="/kalypsis-logo.png" alt="KALYPSIS" sx={{ width: 145, height: 85, objectFit: "contain", filter: "brightness(0) invert(1)", alignSelf: "flex-start", mb: 1 }} />
        <Typography sx={{ fontSize: 30, fontWeight: 900, lineHeight: 1.3 }}>Ζητήστε σύμβαση συνεργασίας</Typography>
        <Typography sx={{ color: "#BCD3E8", fontSize: 15, lineHeight: 1.7, mt: 1.75 }}>Ζητήστε τη σύμβαση συνεργασίας του KALYPSIS στο email σας και ξεκινήστε τη διαδικασία ενεργοποίησης.</Typography>
        <Box sx={{ my: 2 }}><ContractIllustration /></Box>
        <Stack gap={1.5} sx={{ mt: "auto" }}>{["Άμεση αποστολή αιτήματος", "Πλήρες & επίσημο έγγραφο", "Χωρίς δέσμευση"].map(text => <Stack direction="row" gap={1.25} alignItems="center" key={text}><CheckCircleIcon sx={{ color: "#74ABD4" }} /><Typography sx={{ color: "#C6DBED", fontSize: 13 }}>{text}</Typography></Stack>)}</Stack>
      </Box>
      <Box component="form" onSubmit={submit} sx={{ minWidth: 0, p: { xs: 2.25, sm: 3.5 }, position: "relative", "& .MuiOutlinedInput-root": { bgcolor: "#F7FAFE", borderRadius: 1.5, "& fieldset": { borderColor: "#BCCFE4" }, "&:hover fieldset": { borderColor: "#6C97C3" }, "&.Mui-focused fieldset": { borderColor: "#087CEB" } } }}>
        <IconButton onClick={close} disabled={submitting} aria-label="Κλείσιμο αίτησης σύμβασης" sx={{ position: "absolute", top: 10, right: 10, color: "#557398" }}><CloseIcon /></IconButton>
        <Typography id={`${id}-title`} component="h2" sx={{ color: "#102D55", fontWeight: 900, fontSize: { xs: 23, sm: 27 }, pr: 3 }}>Στοιχεία επικοινωνίας</Typography>
        {result ? <Stack alignItems="center" textAlign="center" gap={2} role="status" sx={{ py: 5 }}><CheckCircleIcon sx={{ fontSize: 58, color: "#159B59" }} /><Typography sx={{ color: "#102D55", fontWeight: 850 }}>Το αίτημα σύμβασης καταχωρήθηκε επιτυχώς.</Typography><Typography color="text.secondary">{result.delivered ? "Το αίτημά σας στάλθηκε στην ομάδα KALYPSIS. Θα επικοινωνήσουμε μαζί σας για τη σύμβαση συνεργασίας." : "Το αίτημά σας είναι διαθέσιμο στην ομάδα KALYPSIS. Η ειδοποίηση email δεν επιβεβαιώθηκε· δεν χρειάζεται να το υποβάλετε ξανά."}</Typography><Typography variant="caption">Κωδικός αναφοράς: {result.reference}</Typography><Button variant="contained" onClick={close}>Κλείσιμο</Button></Stack> : <>
          <Typography sx={{ color: "#667F9F", lineHeight: 1.6, fontSize: 14, mt: .75, mb: 2.5 }}>Συμπληρώστε τα στοιχεία σας για να λάβετε τη σύμβαση συνεργασίας του KALYPSIS.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 1.75 }}>
            {field("firstName", "Όνομα", "Το όνομά σας", PersonOutlinedIcon)}{field("lastName", "Επώνυμο", "Το επώνυμό σας", PersonOutlinedIcon)}
            {field("email", "Email", "Το email σας", MailOutlineIcon, true)}
            {field("phone", "Τηλέφωνο", "Το τηλέφωνό σας", PhoneOutlinedIcon)}{field("companyName", "Επωνυμία γραφείου / εταιρείας", "Η επωνυμία σας", BusinessOutlinedIcon)}
            <Box sx={{ gridColumn: "1 / -1" }}><Typography component="label" htmlFor={`${id}-region`} sx={{ display: "block", color: "#102D55", fontSize: 13, fontWeight: 750, mb: .75 }}>Περιοχή</Typography><Autocomplete id={`${id}-region`} freeSolo forcePopupIcon autoHighlight openText="Επιλογή περιοχής" closeText="Κλείσιμο λίστας" clearText="Καθαρισμός" size="small" inputValue={form.region} onInputChange={(_,value) => set("region", value)} options={["Αθήνα", "Θεσσαλονίκη", "Πάτρα", "Ηράκλειο", "Λάρισα", "Βόλος", "Ιωάννινα", "Χανιά", "Αγρίνιο"]} renderInput={params => <TextField {...params} placeholder="Π.χ. Αθήνα" inputProps={{ ...params.inputProps, maxLength: 120 }} InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><PlaceOutlinedIcon sx={{ color: "#557398", fontSize: 20 }} /></InputAdornment> }} />} /></Box>
            {field("message", "Σύντομο μήνυμα (προαιρετικό)", "Π.χ. οποιαδήποτε επιπλέον πληροφορία…", MailOutlineIcon, true)}
          </Box>
          <Box sx={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }} aria-hidden><input name="website" value={form.website} onChange={event => set("website",event.target.value)} tabIndex={-1} autoComplete="off" /></Box>
          <FormControlLabel sx={{ mt: 1.25, alignItems: "flex-start", "& .MuiFormControlLabel-label": { fontSize: 12, color: "#536B89", pt: 1 } }} control={<Checkbox size="small" checked={form.consent} onChange={event => set("consent",event.target.checked)} inputProps={{ "aria-label": "Συγκατάθεση επικοινωνίας για το αίτημα σύμβασης" }} />} label={<span>Συμφωνώ να επικοινωνήσει το KALYPSIS για το αίτημά μου και έχω διαβάσει την <a href="/privacy" target="_blank" rel="noopener noreferrer">πολιτική απορρήτου</a>.</span>} />
          <Alert severity="info" sx={{ mt: 1, bgcolor: "#E6F2FC", color: "#185181", borderRadius: 1.5, fontSize: 13 }}>Το αίτημα θα σταλεί στην ομάδα KALYPSIS για να λάβετε τη σύμβαση στο email σας. Δεν υπάρχει καμία δέσμευση.</Alert>
          {error && <Alert severity="error" sx={{ mt: 1 }} role="alert">{error}</Alert>}
          <Stack direction={{ xs: "column-reverse", sm: "row" }} gap={1.5} sx={{ mt: 2.25 }}><Button onClick={close} disabled={submitting} variant="outlined" sx={{ flex: 1, py: 1.15, borderColor: "#BED0E3", color: "#102D55" }}>Ακύρωση</Button><Button type="submit" disabled={submitting} variant="contained" startIcon={submitting ? <CircularProgress size={19} color="inherit" /> : <DescriptionOutlinedIcon />} endIcon={<ArrowForwardIcon />} sx={{ flex: 2, py: 1.15, bgcolor: "#076CC9", color: "#fff", fontWeight: 850, "&:hover": { bgcolor: "#0456A4" } }}>{submitting ? "Αποστολή…" : "Αποστολή αιτήματος σύμβασης"}</Button></Stack>
        </>}
      </Box>
    </Box>
  </Dialog>;
}
