import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupsIcon from "@mui/icons-material/Groups";
import LinkIcon from "@mui/icons-material/Link";
import PercentIcon from "@mui/icons-material/Percent";
import ShareIcon from "@mui/icons-material/Share";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { useAuth } from "../auth/AuthContext";

const BENEFIT_BLUE = "#0b4f8a";
const BENEFIT_LIGHT = "#edf6ff";

export function AffiliateProgramPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const referralCode = useMemo(() => {
    const source = user?.tenantId ?? user?.email ?? "office";
    const suffix = source.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase().padStart(6, "0");
    return `KALY-${suffix}`;
  }, [user?.tenantId, user?.email]);
  const origin = typeof window === "undefined" ? "https://mykalypsis.gr" : window.location.origin;
  const referralLink = `${origin}/register?ref=${encodeURIComponent(referralCode)}`;

  const copyValue = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2200);
    } catch {
      setCopied(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1160, mx: "auto", p: { xs: 1, sm: 2, md: 3 } }}>
      <Card sx={{ mb: 2, overflow: "hidden", color: "white", background: "linear-gradient(120deg, #08345f 0%, #0b4f8a 55%, #1976b7 100%)" }}>
        <CardContent sx={{ p: { xs: 2, sm: 3.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <Box sx={{ width: 58, height: 58, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 2, bgcolor: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.35)" }}>
              <CardGiftcardIcon sx={{ fontSize: 34 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="overline" sx={{ letterSpacing: ".12em", opacity: .85 }}>KALYPSIS · OFFICE PROGRAMME</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1, fontSize: { xs: "1.75rem", sm: "2.25rem" } }}>Πρόγραμμα συνεργατών</Typography>
              <Typography sx={{ mt: 1, maxWidth: 780, opacity: .92 }}>
                Συστήστε το Kalypsis σε άλλα ασφαλιστικά γραφεία και κερδίστε μόνιμα προνόμια για το δικό σας γραφείο.
              </Typography>
            </Box>
            <Chip icon={<WorkspacePremiumIcon />} label="15% lifetime όφελος" sx={{ alignSelf: { xs: "flex-start", sm: "center" }, bgcolor: "#dff3ff", color: "#073b6c", fontWeight: 800 }} />
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <LinkIcon color="primary" />
                <Typography variant="h6" fontWeight={850}>Ο δικός σας κωδικός σύστασης</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Χρησιμοποιήστε τον κωδικό ή τον σύνδεσμο όταν προτείνετε το Kalypsis σε άλλο γραφείο. Η σύσταση συνδέεται με το γραφείο σας.
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.25, bgcolor: BENEFIT_LIGHT, borderColor: "#a9ccec" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                  <Typography sx={{ flex: 1, fontWeight: 900, letterSpacing: ".12em", color: BENEFIT_BLUE, fontSize: { xs: "1.1rem", sm: "1.35rem" } }}>{referralCode}</Typography>
                  <Button variant="contained" size="small" startIcon={<ContentCopyIcon />} onClick={() => void copyValue(referralCode, "code")}>
                    {copied === "code" ? "Αντιγράφηκε" : "Αντιγραφή"}
                  </Button>
                </Stack>
              </Paper>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, overflowWrap: "anywhere", alignSelf: "center" }}>{referralLink}</Typography>
                <Button variant="outlined" size="small" startIcon={<ShareIcon />} onClick={() => void copyValue(referralLink, "link")}>
                  {copied === "link" ? "Αντιγράφηκε" : "Αντιγραφή συνδέσμου"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%", border: "1px solid #a9ccec", bgcolor: "#f7fbff" }}>
            <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" fontWeight={850}>Πρόοδος προγράμματος</Typography>
                <GroupsIcon color="primary" />
              </Stack>
              <Typography variant="h3" fontWeight={900} color={BENEFIT_BLUE}>0 <Typography component="span" variant="h6" color="text.secondary">/ 5 γραφεία</Typography></Typography>
              <LinearProgress variant="determinate" value={0} sx={{ height: 9, borderRadius: 5, my: 1.25, bgcolor: "#d9eafa", "& .MuiLinearProgress-bar": { bgcolor: BENEFIT_BLUE } }} />
              <Typography variant="body2" color="text.secondary">Η πρόοδος ενημερώνεται όταν το νέο γραφείο ολοκληρώσει την εγγραφή του και παραμείνει ενεργό σύμφωνα με τους όρους του προγράμματος.</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h5" fontWeight={900} sx={{ mb: 1.25 }}>Τι κερδίζετε</Typography>
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6}>
          <BenefitCard icon={<WorkspacePremiumIcon />} title="Δωρεάν χρήση εφ’ όρου ζωής" text="Με πέντε γραφεία που εγγράφονται μέσω της σύστασής σας και παραμένουν ενεργά, ενεργοποιείται το lifetime προνόμιο του προγράμματος." />
        </Grid>
        <Grid item xs={12} sm={6}>
          <BenefitCard icon={<PercentIcon />} title="15% έκπτωση εφ’ όρου ζωής" text="Το προνόμιο εφαρμόζεται στις λειτουργίες και στα πακέτα Kalypsis του γραφείου σας, όσο παραμένετε ενεργός συνεργάτης του προγράμματος." />
        </Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
          <Typography variant="h5" fontWeight={900} sx={{ mb: 1.5 }}>Πώς λειτουργεί</Typography>
          <Grid container spacing={1.5}>
            {["Μοιραστείτε τον κωδικό ή τον σύνδεσμο με ένα ασφαλιστικό γραφείο.", "Το νέο γραφείο ολοκληρώνει την εγγραφή και ενεργοποιεί τη συνδρομή του.", "Η πλατφόρμα επιβεβαιώνει ότι το γραφείο παραμένει ενεργό.", "Στις πέντε επιβεβαιωμένες συστάσεις ενεργοποιούνται τα μόνιμα προνόμια."].map((text, index) => (
              <Grid item xs={12} sm={6} key={text}>
                <Stack direction="row" spacing={1.1} alignItems="flex-start">
                  <Box sx={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: BENEFIT_LIGHT, color: BENEFIT_BLUE, fontWeight: 900 }}>{index + 1}</Box>
                  <Typography sx={{ pt: .35 }}>{text}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography variant="h5" fontWeight={900} sx={{ mb: 1 }}>Οδηγίες και συχνές ερωτήσεις</Typography>
          <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" }, borderBottom: "1px solid #e3eaf2" }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={750}>Πότε μετράει μια σύσταση;</Typography></AccordionSummary>
            <AccordionDetails><Typography color="text.secondary">Μετράει όταν το νέο γραφείο χρησιμοποιήσει τον προσωπικό σας κωδικό ή σύνδεσμο κατά την εγγραφή και η συνδρομή του παραμείνει ενεργή σύμφωνα με τους όρους του προγράμματος.</Typography></AccordionDetails>
          </Accordion>
          <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" }, borderBottom: "1px solid #e3eaf2" }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={750}>Τι πρέπει να κάνει το νέο γραφείο;</Typography></AccordionSummary>
            <AccordionDetails><Typography color="text.secondary">Να χρησιμοποιήσει τον κωδικό σας στην εγγραφή, να ολοκληρώσει τα στοιχεία του γραφείου και να ενεργοποιήσει το πακέτο που χρειάζεται.</Typography></AccordionDetails>
          </Accordion>
          <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={750}>Πού μπορώ να ζητήσω βοήθεια;</Typography></AccordionSummary>
            <AccordionDetails><Typography color="text.secondary">Για απορίες σχετικά με σύσταση, επιβεβαίωση ή εφαρμογή των προνομίων, στείλτε αίτημα υποστήριξης από το Kalypsis.</Typography></AccordionDetails>
          </Accordion>
          <Divider sx={{ mt: 1.5, mb: 1 }} />
          <Alert severity="info" icon={<CheckCircleIcon />}>Οι τελικοί έλεγχοι επιλεξιμότητας και η ενεργοποίηση των προνομίων γίνονται από την ομάδα Kalypsis.</Alert>
        </CardContent>
      </Card>
    </Box>
  );
}

function BenefitCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <Card variant="outlined" sx={{ height: "100%", borderColor: "#a9ccec", bgcolor: "#f7fbff" }}><CardContent sx={{ p: { xs: 1.75, sm: 2.25 } }}><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .8 }}><Box sx={{ color: BENEFIT_BLUE, display: "flex" }}>{icon}</Box><Typography fontWeight={850}>{title}</Typography></Stack><Typography variant="body2" color="text.secondary">{text}</Typography></CardContent></Card>;
}

export default AffiliateProgramPage;
