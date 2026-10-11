import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, CircularProgress, Container, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import CalculateRoundedIcon from "@mui/icons-material/CalculateRounded";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface Branding {
  agencyOfficeId: string; slug: string; isEnabled: boolean; displayName: string;
  welcomeMessage?: string | null; primaryColor: string; secondaryColor: string;
  supportEmail?: string | null; supportPhone?: string | null; logoUrl?: string | null;
  allowedBranches: string[];
}

export function InsureOneLoginPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signInInsureOne, completeTwoFactor, completeEmailCode } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ kind: "totp" | "email"; token: string } | null>(null);
  const [code, setCode] = useState("");
  const branding = useQuery({
    queryKey: ["insureone-public-branding", slug],
    enabled: Boolean(slug),
    queryFn: async () => (await api.get<Branding>(`/insureone/public/${encodeURIComponent(slug)}`)).data,
    retry: false
  });
  const b = branding.data;
  const initials = useMemo(() => (b?.displayName ?? "InsureOne").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase(), [b?.displayName]);

  useEffect(() => {
    if (b) document.title = `${b.displayName} · InsureOne`;
    return () => { document.title = "KALYPSIS"; };
  }, [b]);

  async function submit() {
    setError(null);
    try {
      if (challenge) {
        if (challenge.kind === "totp") await completeTwoFactor(challenge.token, code, remember);
        else await completeEmailCode(challenge.token, code, remember);
        navigate(`/insureone/${encodeURIComponent(slug)}`, { replace: true });
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

  if (branding.isLoading) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#eef6fc" }}><CircularProgress /></Box>;
  if (branding.isError || !b) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#eef6fc", p: 3 }}><Alert severity="error">Το γραφείο InsureOne δεν βρέθηκε ή δεν είναι διαθέσιμο.</Alert></Box>;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#eef6fc", background: `linear-gradient(135deg, ${b.primaryColor}12 0%, #eef6fc 50%, ${b.secondaryColor}10 100%)`, display: "flex", alignItems: "center", py: 4 }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ overflow: "hidden", borderRadius: 4, border: "1px solid #d6e5f2", boxShadow: "0 24px 70px rgba(11,37,69,.13)" }}>
          <Box sx={{ bgcolor: b.secondaryColor, color: "white", px: { xs: 3, sm: 5 }, py: 3, display: "flex", alignItems: "center", gap: 2 }}>
            {b.logoUrl ? <Box component="img" src={b.logoUrl} alt={`Λογότυπο ${b.displayName}`} sx={{ width: 84, height: 52, objectFit: "contain", bgcolor: "white", borderRadius: 2, p: 1 }} /> : <Box sx={{ width: 52, height: 52, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: b.primaryColor, fontWeight: 900, fontSize: 20 }}>{initials}</Box>}
            <Box><Typography variant="overline" sx={{ opacity: .78, letterSpacing: ".13em" }}>InsureOne</Typography><Typography variant="h5" fontWeight={850}>{b.displayName}</Typography></Box>
          </Box>
          <Stack spacing={2.25} sx={{ p: { xs: 3, sm: 5 } }}>
            <Box><Stack direction="row" alignItems="center" spacing={1} mb={.5}><CalculateRoundedIcon sx={{ color: b.primaryColor }} /><Typography variant="h5" fontWeight={850} color={b.secondaryColor}>Σύνδεση συνεργάτη</Typography></Stack><Typography color="text.secondary">{challenge ? "Εισαγάγετε τον κωδικό ασφαλείας για να ολοκληρωθεί η σύνδεση." : (b.welcomeMessage ?? "Συνδεθείτε στο InsureOne του γραφείου σας για να ξεκινήσετε τιμολόγηση.")}</Typography></Box>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {challenge ? <TextField autoFocus label={challenge.kind === "email" ? "Κωδικός email" : "Κωδικός επαλήθευσης"} value={code} onChange={e => setCode(e.target.value)} inputProps={{ inputMode: "numeric", maxLength: 8 }} /> : <>
              <TextField autoFocus label="Email ή κωδικός συνεργάτη" value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" />
              <TextField label="Κωδικός πρόσβασης" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={e => { if (e.key === "Enter") void submit(); }} />
              <FormControlLabel control={<Checkbox checked={remember} onChange={e => setRemember(e.target.checked)} />} label="Να παραμείνω συνδεδεμένος" />
            </>}
            <Button variant="contained" size="large" startIcon={challenge ? <LockRoundedIcon /> : <CalculateRoundedIcon />} onClick={() => void submit()} disabled={challenge ? code.length < 4 : !identifier || !password} sx={{ bgcolor: b.primaryColor, py: 1.35, fontWeight: 850, '&:hover': { bgcolor: b.secondaryColor } }}>{challenge ? "Επιβεβαίωση" : "Σύνδεση στο InsureOne"}</Button>
            <Typography variant="caption" color="text.secondary" textAlign="center">Η πρόσβαση διαχειρίζεται από το γραφείο σας. Για βοήθεια επικοινωνήστε με τον υπεύθυνο.</Typography>
            {(b.supportEmail || b.supportPhone) && <Typography variant="body2" textAlign="center" color="text.secondary">{b.supportEmail}{b.supportEmail && b.supportPhone ? " · " : ""}{b.supportPhone}</Typography>}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
