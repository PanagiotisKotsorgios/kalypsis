import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import HeadsetMicRoundedIcon from "@mui/icons-material/HeadsetMicRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";

interface Branding {
  agencyOfficeId: string;
  slug: string;
  isEnabled: boolean;
  displayName: string;
  welcomeMessage?: string | null;
  primaryColor: string;
  secondaryColor: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  logoUrl?: string | null;
  loginTitle?: string | null;
  loginSubtitle?: string | null;
  loginBackgroundUrl?: string | null;
  loginSecurityText?: string | null;
  loginSupportLabel?: string | null;
  allowedBranches: string[];
}

const fallbackBackground = "/assets/insureone-partner-portal-bg.png";

export function InsureOneLoginPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signInInsureOne, completeTwoFactor, completeEmailCode } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ kind: "totp" | "email"; token: string } | null>(null);
  const [code, setCode] = useState("");

  const branding = useQuery({
    queryKey: ["insureone-public-branding", slug],
    enabled: Boolean(slug),
    queryFn: async () => (await api.get<Branding>(`/insureone/public/${encodeURIComponent(slug)}`)).data,
    retry: false,
  });
  const b = branding.data;
  const initials = useMemo(() => (b?.displayName ?? "InsureOne").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase(), [b?.displayName]);

  useEffect(() => {
    if (b) document.title = `${b.displayName} · Πύλη συνεργατών`;
    return () => { document.title = "KALYPSIS"; };
  }, [b]);

  async function submit() {
    setError(null);
    try {
      if (challenge) {
        if (!code.trim()) {
          setError("Συμπληρώστε τον κωδικό επιβεβαίωσης.");
          return;
        }
        if (challenge.kind === "totp") await completeTwoFactor(challenge.token, code, remember);
        else await completeEmailCode(challenge.token, code, remember);
        navigate(`/insureone/${encodeURIComponent(slug)}`, { replace: true });
        return;
      }
      if (!identifier.trim() && !password.trim()) {
        setError("Συμπληρώστε το email ή το όνομα χρήστη και τον κωδικό πρόσβασης.");
        return;
      }
      if (!identifier.trim()) {
        setError("Συμπληρώστε το email ή το όνομα χρήστη.");
        return;
      }
      if (!password.trim()) {
        setError("Συμπληρώστε τον κωδικό πρόσβασης.");
        return;
      }
      await signInInsureOne(slug, identifier, password, remember);
      navigate(`/insureone/${encodeURIComponent(slug)}`, { replace: true });
    } catch (e) {
      if (e instanceof Error && e.name === "TwoFactorRequiredError") {
        setChallenge({ kind: "totp", token: (e as Error & { challengeToken: string }).challengeToken });
        return;
      }
      if (e instanceof Error && e.name === "EmailCodeRequiredError") {
        setChallenge({ kind: "email", token: (e as Error & { challengeToken: string }).challengeToken });
        return;
      }
      setError(extractErrorMessage(e, "Δεν ήταν δυνατή η σύνδεση. Ελέγξτε τα στοιχεία σας."));
    }
  }

  if (branding.isLoading) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#eef6fc" }}><CircularProgress sx={{ color: "#0877E8" }} /></Box>;
  if (branding.isError || !b) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#eef6fc", p: 3 }}><Alert severity="error">Η branded πύλη συνεργατών δεν βρέθηκε ή δεν είναι διαθέσιμη.</Alert></Box>;

  const primary = b.primaryColor || "#0877E8";
  const secondary = b.secondaryColor || "#082B5C";
  const background = (b.loginBackgroundUrl || fallbackBackground).replace(/["'()\r\n]/g, "");
  const title = (b.loginTitle || "Πύλη Συνεργατών").trim();
  const titleWords = title.split(/\s+/);
  const titleLead = titleWords.shift() || title;
  const titleRest = titleWords.join(" ");
  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      minHeight: { xs: 58, sm: 62 },
      borderRadius: 1.9,
      bgcolor: "#fff",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "#8ea9c9",
        borderWidth: 1.8,
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: secondary,
        borderWidth: 2,
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: primary,
        borderWidth: 2.2,
        boxShadow: `0 0 0 3px ${primary}18`,
      },
    },
    "& .MuiInputLabel-root": { color: "#506b91" },
    "& .MuiInputLabel-root.Mui-focused": { color: secondary, fontWeight: 800 },
    "& input::placeholder": { color: "#7188a8", opacity: 1 },
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "#eaf5fd", backgroundImage: `url("${background}")`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <Box component="main" sx={{ flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", py: { xs: 2, sm: 4 }, px: { xs: 1.25, sm: 2 }, overflow: "hidden" }}>
        <Container maxWidth={false} sx={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 645, px: 0 }}>
        <Paper elevation={0} sx={{ overflow: "hidden", borderRadius: { xs: 2.5, sm: 2.8 }, border: "1px solid rgba(218,231,244,.95)", boxShadow: "0 18px 48px rgba(16,67,128,.16)", bgcolor: "rgba(255,255,255,.975)" }}>
          <Box sx={{ px: { xs: 3, sm: 6.5 }, pt: { xs: 3, sm: 3.5 }, pb: { xs: 2.5, sm: 2.9 } }}>
            <Box sx={{ minHeight: { xs: 64, sm: 86 }, display: "flex", justifyContent: "center", alignItems: "center", mb: { xs: 2, sm: 2.8 } }}>
              {b.logoUrl ? <Box component="img" src={b.logoUrl} alt={`Λογότυπο ${b.displayName}`} sx={{ width: { xs: 250, sm: 335 }, maxWidth: "100%", maxHeight: 96, height: "auto", objectFit: "contain" }} /> : <Stack direction="row" alignItems="center" spacing={1.25}><Box sx={{ width: 58, height: 58, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: primary, color: "#fff", fontWeight: 950, fontSize: 20 }}>{initials}</Box><Typography sx={{ fontSize: 28, fontWeight: 950, color: secondary }}>{b.displayName}</Typography></Stack>}
            </Box>
            <Box sx={{ textAlign: "left" }}>
              <Typography component="h1" sx={{ color: secondary, fontWeight: 950, letterSpacing: "-.055em", lineHeight: 1.02, fontSize: { xs: 35, sm: 47 } }}><Box component="span" sx={{ color: secondary }}>{titleLead}</Box>{titleRest && <> <Box component="span" sx={{ color: secondary }}>{titleRest}</Box></>}</Typography>
              <Box sx={{ width: 65, height: 5, borderRadius: 5, bgcolor: "#ef3340", mt: 1.15, mb: 1.8 }} />
              <Typography sx={{ color: "#556c8f", fontSize: { xs: 15, sm: 17 }, lineHeight: 1.42, maxWidth: 510 }}>{b.loginSubtitle || b.welcomeMessage || "Ασφαλής πρόσβαση για συνεργάτες, πρακτορεία και δίκτυο πωλήσεων."}</Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: "#e7edf6" }} />
          <Stack component="form" onSubmit={e => { e.preventDefault(); void submit(); }} spacing={{ xs: 1.55, sm: 1.8 }} sx={{ px: { xs: 3, sm: 6.5 }, pt: { xs: 2.6, sm: 3.1 }, pb: { xs: 2.5, sm: 3.1 } }}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {challenge ? <TextField autoFocus fullWidth label={challenge.kind === "totp" ? "Κωδικός εφαρμογής" : "Κωδικός email"} placeholder="Πληκτρολογήστε τον κωδικό" value={code} onChange={e => setCode(e.target.value)} inputProps={{ inputMode: "numeric", maxLength: 8 }} sx={fieldSx} /> : <>
              <TextField autoFocus fullWidth label="Email ή Όνομα Χρήστη" placeholder="π.χ. συνεργάτης@lanca.gr" value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon sx={{ color: "#4f6b93", fontSize: 27 }} /></InputAdornment> }} sx={fieldSx} />
              <TextField fullWidth label="Κωδικός πρόσβασης" placeholder="Πληκτρολογήστε τον κωδικό σας" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon sx={{ color: "#4f6b93", fontSize: 27 }} /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"} aria-pressed={showPassword} title={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"} onClick={() => setShowPassword(v => !v)} edge="end" sx={{ color: "#4f6b93" }}>{showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton></InputAdornment> }} sx={fieldSx} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: .05 }}><FormControlLabel control={<Checkbox checked={remember} onChange={e => setRemember(e.target.checked)} sx={{ color: primary, p: .45, "&.Mui-checked": { color: primary } }} />} label={<Typography sx={{ fontSize: { xs: 14, sm: 15 }, color: "#374f73" }}>Να με θυμάμαι</Typography>} />{b.supportEmail && <Link href={`mailto:${b.supportEmail}`} underline="always" sx={{ fontSize: { xs: 14, sm: 15 }, color: primary, fontWeight: 700 }}>Ξέχασα τον κωδικό μου;</Link>}</Stack>
            </>}
            <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 28 }} />} sx={{ minHeight: { xs: 58, sm: 62 }, borderRadius: 1.9, textTransform: "none", fontSize: { xs: 16, sm: 18 }, fontWeight: 900, background: `linear-gradient(100deg, #1739b8 0%, ${primary} 58%, #1475ee 100%)`, boxShadow: "0 8px 18px rgba(16,79,214,.23)", "&:hover": { background: `linear-gradient(100deg, ${secondary} 0%, ${primary} 100%)` } }}>{challenge ? "Επιβεβαίωση σύνδεσης" : "Σύνδεση στην πύλη"}</Button>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ my: .25 }}><Divider sx={{ flex: 1, borderColor: "#d3deed" }} /><Typography sx={{ color: "#65799a", fontWeight: 800 }}>ή</Typography><Divider sx={{ flex: 1, borderColor: "#d3deed" }} /></Stack>
            <Button variant="outlined" startIcon={<HeadsetMicRoundedIcon sx={{ fontSize: 27 }} />} href={b.supportEmail ? `mailto:${b.supportEmail}` : undefined} sx={{ minHeight: { xs: 54, sm: 58 }, borderRadius: 1.9, textTransform: "none", color: primary, border: `2px solid ${primary}`, fontSize: { xs: 15, sm: 17 }, fontWeight: 900, "&:hover": { border: `2px solid ${secondary}`, bgcolor: `${primary}08` } }}>Επικοινωνία με υποστήριξη</Button>
          </Stack>
        </Paper>
        </Container>
      </Box>
      <Box component="footer" sx={{ width: "100%", borderTop: "1px solid #b9c6d1", bgcolor: "#dfe5ea" }}>
        <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 1.7, sm: 2.1 }, display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: "center", gap: { xs: 1.25, sm: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box component="img" src="/assets/insureone-plugin-logo.png" alt="InsureOne" sx={{ width: { xs: 86, sm: 104 }, height: { xs: 42, sm: 50 }, objectFit: "contain", bgcolor: "#fff", borderRadius: 1.25, px: .7 }} />
            <Typography sx={{ color: "#526578", fontWeight: 750, fontSize: { xs: 12.5, sm: 14 } }}>Πύλη συνεργατών InsureOne</Typography>
          </Stack>
          <Stack alignItems={{ xs: "center", sm: "flex-end" }} spacing={.35}>
            <Typography sx={{ color: "#526578", fontWeight: 900, fontSize: { xs: 16, sm: 18 }, letterSpacing: ".02em" }}>Powered by KALYPSIS</Typography>
            <KalypsisLogo size={88} crop />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
