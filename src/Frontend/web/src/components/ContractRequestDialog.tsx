import { useId, useState, type FormEvent } from "react";
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
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
  const formId = `${id}-form`;
  const field = (key: "firstName" | "lastName" | "email" | "phone" | "companyName" | "region" | "message", label: string, placeholder: string, Icon: typeof PersonOutlinedIcon, wide = false) => {
    const optional = key === "message" || key === "region";
    return <Box sx={{ gridColumn: wide ? "1 / -1" : "auto", minWidth: 0 }}>
      <Typography component="label" htmlFor={`${id}-${key}`} sx={{ display: "block", color: "#102D55", fontSize: 14, fontWeight: 750, mb: .75 }}>
        {label}{!optional && <Box component="span" sx={{ color: "#C52D40", ml: .5 }}>*</Box>}
      </Typography>
      <TextField id={`${id}-${key}`} fullWidth required={!optional} disabled={submitting}
        autoFocus={key === "firstName"} size="medium"
        type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
        value={form[key]} onChange={event => set(key, key === "phone" ? event.target.value.replace(/[^0-9+ ()-]/g, "") : event.target.value)}
        placeholder={placeholder} multiline={key === "message"} minRows={key === "message" ? 2 : undefined} maxRows={key === "message" ? 4 : undefined}
        autoComplete={{ firstName: "given-name", lastName: "family-name", email: "email", phone: "tel", companyName: "organization", region: "address-level2", message: "off" }[key]}
        inputProps={{ maxLength: { firstName: 120, lastName: 120, email: 160, phone: 40, companyName: 200, region: 120, message: 2000 }[key] }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Icon sx={{ color: "#557398", fontSize: 21 }} /></InputAdornment> }} />
    </Box>;
  };
  return <Dialog open={open} onClose={close} fullWidth maxWidth="md" aria-labelledby={`${id}-title`} aria-describedby={result ? undefined : `${id}-description`}
    PaperProps={{ sx: { width: "calc(100% - 32px)", maxWidth: 920, maxHeight: "calc(100dvh - 32px)", height: "auto", minHeight: 0, m: 2, borderRadius: 3, overflow: "hidden", border: "1px solid #C4D8EB", bgcolor: "#F8FBFE" } }}>
    <DialogTitle id={`${id}-title`} sx={{ p: { xs: 2, sm: 2.5 }, flexShrink: 0, color: "#fff", background: "linear-gradient(110deg,#0B305C,#155784)" }}>
      <Stack direction="row" gap={1.5} alignItems="center">
        <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: "#ffffff18", border: "1px solid #ffffff35", display: { xs: "none", sm: "grid" }, placeItems: "center", flexShrink: 0 }}><HandshakeOutlinedIcon /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" sx={{ display: "block", fontWeight: 850, fontSize: { xs: 20, sm: 25 }, lineHeight: 1.25 }}>Ζητήστε σύμβαση συνεργασίας</Typography>
          <Typography component="span" sx={{ display: "block", color: "#D4E6F5", fontSize: 13, mt: .5 }}>Στοιχεία επικοινωνίας · Χωρίς δέσμευση</Typography>
        </Box>
        <IconButton onClick={close} disabled={submitting} aria-label="Κλείσιμο αίτησης σύμβασης" sx={{ width: 36, height: 36, flexShrink: 0, color: "#fff", borderRadius: 1, bgcolor: "#ffffff14", "&:hover": { bgcolor: "#ffffff28" } }}><CloseIcon /></IconButton>
      </Stack>
    </DialogTitle>
    <DialogContent sx={{ p: { xs: 2, sm: 2.5 }, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", "&.MuiDialogContent-root": { pt: { xs: 2, sm: 2.5 } } }}>
      {result ? <Stack alignItems="center" textAlign="center" gap={2} role="status" sx={{ py: 3, px: { sm: 4 } }}>
        <CheckCircleIcon sx={{ fontSize: 58, color: "#159B59" }} />
        <Typography sx={{ color: "#102D55", fontWeight: 850, fontSize: 21 }}>Το αίτημα σύμβασης καταχωρήθηκε επιτυχώς.</Typography>
        <Typography color="text.secondary">{result.delivered ? "Το αίτημά σας στάλθηκε στην ομάδα KALYPSIS. Θα επικοινωνήσουμε μαζί σας για τη σύμβαση συνεργασίας." : "Το αίτημά σας είναι διαθέσιμο στην ομάδα KALYPSIS. Η ειδοποίηση email δεν επιβεβαιώθηκε· δεν χρειάζεται να το υποβάλετε ξανά."}</Typography>
        <Typography variant="caption">Κωδικός αναφοράς: {result.reference}</Typography>
      </Stack> : <Box component="form" id={formId} onSubmit={submit} sx={{ position: "relative", minWidth: 0,
        "& .MuiOutlinedInput-root": { bgcolor: "#fff", color: "#102D55", borderRadius: 1.5, fontSize: 16,
          "&:not(.MuiInputBase-multiline)": { minHeight: 52 },
          "& fieldset": { borderColor: "#AABFD6" }, "&:hover fieldset": { borderColor: "#5D83AC" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px #087CEB16" }, "&.Mui-focused fieldset": { borderColor: "#087CEB" },
        }, "& .MuiInputBase-input::placeholder": { color: "#667B98", opacity: 1 },
      }}>
        <Typography id={`${id}-description`} sx={{ color: "#536B89", fontSize: 14, lineHeight: 1.6, mb: 2 }}>Συμπληρώστε τα στοιχεία σας. Η ομάδα KALYPSIS θα επικοινωνήσει μαζί σας για τη σύμβαση συνεργασίας.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} role="alert">{error}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, columnGap: 2.5, rowGap: 1.75 }}>
          {field("firstName", "Όνομα", "Το όνομά σας", PersonOutlinedIcon)}
          {field("lastName", "Επώνυμο", "Το επώνυμό σας", PersonOutlinedIcon)}
          {field("email", "Email", "name@example.gr", MailOutlineIcon)}
          {field("phone", "Τηλέφωνο", "Π.χ. 210 123 4567", PhoneOutlinedIcon)}
          {field("companyName", "Επωνυμία γραφείου / εταιρείας", "Η επωνυμία του γραφείου σας", BusinessOutlinedIcon)}
          {field("region", "Πόλη / Περιοχή (προαιρετικό)", "Γράψτε την πόλη ή την περιοχή σας", PlaceOutlinedIcon)}
          {field("message", "Σύντομο μήνυμα (προαιρετικό)", "Τι θα θέλατε να γνωρίζουμε για το γραφείο ή το αίτημά σας;", MailOutlineIcon, true)}
        </Box>
        <Box sx={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", pointerEvents: "none" }} aria-hidden>
          <input name="website" value={form.website} onChange={event => set("website",event.target.value)} tabIndex={-1} autoComplete="off" />
        </Box>
        <FormControlLabel sx={{ mt: 1.5, ml: -1, mr: 0, alignItems: "flex-start", "& .MuiFormControlLabel-label": { fontSize: 13, color: "#536B89", lineHeight: 1.65, pt: .85 }, "& a": { color: "#076CC9", textUnderlineOffset: 3 } }}
          control={<Checkbox checked={form.consent} disabled={submitting} onChange={event => set("consent",event.target.checked)} inputProps={{ "aria-label": "Συγκατάθεση επικοινωνίας για το αίτημα σύμβασης" }} />}
          label={<span>Συμφωνώ να επικοινωνήσει το KALYPSIS για το αίτημά μου και έχω διαβάσει την <a href="/privacy" target="_blank" rel="noopener noreferrer">πολιτική απορρήτου</a>.</span>} />
      </Box>}
    </DialogContent>
    <DialogActions sx={{ p: { xs: 2, sm: 2.5 }, pt: { xs: 1.5, sm: 1.75 }, flexShrink: 0, bgcolor: "#EEF4FA", borderTop: "1px solid #D6E3F0", gap: 1.25, flexWrap: "wrap", "& > :not(style) ~ :not(style)": { ml: 0 } }}>
      <Button onClick={close} disabled={submitting} variant="contained" color="error" startIcon={<CloseIcon />} sx={{ minHeight: 48, px: 2.5, textTransform: "none", fontWeight: 750, boxShadow: "none", flex: { xs: "1 1 100%", sm: "0 0 auto" }, order: { xs: 2, sm: 0 } }}>{result ? "Κλείσιμο" : "Ακύρωση"}</Button>
      {!result && <Button type="submit" form={formId} disabled={submitting} variant="contained" startIcon={submitting ? <CircularProgress size={19} color="inherit" /> : <DescriptionOutlinedIcon />} endIcon={<ArrowForwardIcon />}
        sx={{ minHeight: 48, px: { xs: 1.5, sm: 3 }, flex: { xs: "1 1 100%", sm: "0 1 auto" }, bgcolor: "#076CC9", color: "#fff", fontSize: { xs: 14, sm: 15 }, textTransform: "none", fontWeight: 850, boxShadow: "none", "&:hover": { bgcolor: "#0456A4" } }}>{submitting ? "Αποστολή…" : "Αποστολή αιτήματος σύμβασης"}</Button>}
    </DialogActions>
  </Dialog>;
}
