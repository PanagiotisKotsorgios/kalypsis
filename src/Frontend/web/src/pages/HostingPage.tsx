import { Alert, Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import LanguageIcon from "@mui/icons-material/Language";
import BoltIcon from "@mui/icons-material/Bolt";
import SecurityIcon from "@mui/icons-material/Security";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import HeadsetMicIcon from "@mui/icons-material/HeadsetMic";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";
import { HostingNavbar } from "../components/HostingNavbar";
import { PublicFooter } from "../components/PublicFooter";

const plans = [
  { name: "Start", note: "Ιδανικό για προσωπικές ιστοσελίδες και μικρά projects.", price: "4,90", features: ["2 GB SSD αποθήκευση", "Απεριόριστη κίνηση", "1 ιστοσελίδα", "Δωρεάν SSL", "Καθημερινά backups"] },
  { name: "Business", note: "Ιδανικό για επαγγελματικές ιστοσελίδες επιχειρήσεων.", price: "9,90", popular: true, features: ["5 GB SSD αποθήκευση", "Απεριόριστη κίνηση", "Πολλαπλές ιστοσελίδες", "Δωρεάν SSL", "Καθημερινά backups", "Email accounts"] },
  { name: "Professional", note: "Ιδανικό για e-shop και αυξημένες απαιτήσεις.", price: "17,90", features: ["10 GB SSD αποθήκευση", "Απεριόριστη κίνηση", "Πολλαπλές ιστοσελίδες", "Δωρεάν SSL", "Καθημερινά backups", "Προτεραιότητα υποστήριξης"] },
  { name: "Enterprise", note: "Για μεγάλες επιχειρήσεις και custom λύσεις.", price: "29,90", from: true, features: ["50+ GB SSD αποθήκευση", "Απεριόριστη κίνηση", "Πολλαπλές ιστοσελίδες", "Δωρεάν SSL", "Καθημερινά backups", "Προτεραιότητα υποστήριξης", "Δυνατότητα custom server"] },
];

export function HostingPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F4F8FC", color: "#071F43" }}>
      <HostingNavbar />
      <Box component="main">
        <Container maxWidth="xl" sx={{ pt: 2, px: { xs: 2.5, md: 5 } }}>
          <Alert severity="info" sx={{ border: "1px solid #B7D5F2", bgcolor: "#EAF4FF", color: "#143B64", fontWeight: 700 }}>
            Η υπηρεσία KALYPSIS Hosting βρίσκεται ακόμη σε προετοιμασία. Τα πακέτα και οι λειτουργίες της σελίδας είναι ενημερωτικά· δεν πραγματοποιούνται ακόμη αγορές, κατοχυρώσεις domain ή ενεργοποίηση λογαριασμών.
          </Alert>
        </Container>
        <Box sx={{ position: "relative", overflow: "hidden", background: "linear-gradient(90deg, #F5FAFF 0%, rgba(238,247,255,.94) 43%, rgba(5,29,64,.08) 62%)" }}>
          <Box sx={{ position: "absolute", inset: 0, left: { xs: "38%", md: "43%" }, backgroundImage: 'linear-gradient(90deg, #F5FAFF 0%, rgba(245,250,255,.45) 19%, transparent 50%), url("/images/hosting/kalypsis-cloud-datacenter.png")', backgroundSize: "cover", backgroundPosition: "center", display: { xs: "none", sm: "block" } }} />
          <Container maxWidth="xl" sx={{ position: "relative", py: { xs: 6, md: 8 }, px: { xs: 2.5, md: 5 } }}>
            <Box sx={{ maxWidth: { xs: "100%", sm: "53%", lg: 560 } }}>
              <Box component="img" src="/images/hosting/kalypsis-hosting-logo.png" alt="KALYPSIS Hosting" sx={{ display: "block", width: { xs: 220, md: 300 }, maxWidth: "90%", height: 102, objectFit: "contain", objectPosition: "left center", mb: 1.5 }} />
              <Typography component="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 900, lineHeight: 1.2, mb: 1.5 }}>Αξιόπιστη φιλοξενία για την επιχείρησή σας</Typography>
              <Typography sx={{ color: "#294664", fontSize: 16, lineHeight: 1.65, mb: 2.5 }}>Γρήγορο, ασφαλές και σταθερό web hosting με την τεχνογνωσία της KALYPSIS. Ιδανικό για επαγγελματικές ιστοσελίδες, e-shop και επιχειρηματικές εφαρμογές.</Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>{["Υψηλή ταχύτητα & 99.9% διαθεσιμότητα", "Δωρεάν SSL για όλα τα domain", "Καθημερινά αντίγραφα ασφαλείας", "Ελληνική τεχνική υποστήριξη"].map(item => <Stack key={item} direction="row" gap={1.25} alignItems="center"><CheckCircleIcon sx={{ color: "#16864A", fontSize: 20 }} /><Typography sx={{ fontWeight: 700 }}>{item}</Typography></Stack>)}</Stack>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}><Button href="#hosting-plans" variant="contained" startIcon={<DnsOutlinedIcon />} endIcon={<ArrowForwardIcon />} sx={{ bgcolor: "#16864A", fontWeight: 850, textTransform: "none", py: 1.35, px: 3, borderRadius: 1.75, "&:hover": { bgcolor: "#0F713D" } }}>Δείτε τα πακέτα</Button><Button id="hosting-domain" component={RouterLink} to="/hosting/register?topic=domain" variant="contained" startIcon={<LanguageIcon />} endIcon={<ArrowForwardIcon />} sx={{ bgcolor: "#fff", color: "#0B305C", fontWeight: 850, textTransform: "none", py: 1.35, px: 3, borderRadius: 1.75, "&:hover": { bgcolor: "#EAF3FC" } }}>Αίτημα ελέγχου Domain</Button></Stack>
            </Box>
          </Container>
        </Box>

        <Container id="hosting-plans" maxWidth="xl" sx={{ py: { xs: 5, md: 7 }, px: { xs: 2.5, md: 5 } }}>
          <Typography component="h2" sx={{ textAlign: "center", fontSize: { xs: 29, md: 36 }, fontWeight: 950, mb: 1 }}>Πακέτα Φιλοξενίας</Typography>
          <Typography sx={{ textAlign: "center", color: "#4B627B", mb: 4 }}>Όλα τα πακέτα περιλαμβάνουν SSL, καθημερινά backups και ελληνική υποστήριξη.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
            {plans.map(plan => <Box key={plan.name} sx={{ position: "relative", p: 3, bgcolor: "#fff", border: plan.popular ? "2px solid #16864A" : "1px solid #D7E3EF", borderRadius: 3, boxShadow: plan.popular ? "0 18px 40px rgba(22,134,74,.12)" : "0 10px 28px rgba(11,43,84,.06)", display: "flex", flexDirection: "column" }}>{plan.popular && <Chip label="Δημοφιλέστερο" size="small" sx={{ position: "absolute", right: 16, top: -13, bgcolor: "#16864A", color: "#fff", fontWeight: 850 }} />}<Stack direction="row" gap={1.25} alignItems="center" sx={{ mb: 1.5 }}><Box sx={{ width: 46, height: 46, borderRadius: "50%", bgcolor: "#EAF2FF", color: "#1766D4", display: "grid", placeItems: "center" }}><DnsOutlinedIcon /></Box><Typography sx={{ fontSize: 20, fontWeight: 900 }}>{plan.name}</Typography></Stack><Typography sx={{ color: "#526A83", fontSize: 14, lineHeight: 1.55, minHeight: 66 }}>{plan.note}</Typography><Typography sx={{ fontSize: 15, mt: 2, mb: 2 }}>{plan.from && "Από "}<Box component="span" sx={{ fontSize: 38, fontWeight: 950 }}>€{plan.price}</Box> /μήνα</Typography><Stack spacing={1.05} sx={{ mb: 3 }}>{plan.features.map(feature => <Stack key={feature} direction="row" gap={1} alignItems="center"><CheckCircleIcon sx={{ color: "#0EBB58", fontSize: 18 }} /><Typography sx={{ fontSize: 14.5 }}>{feature}</Typography></Stack>)}</Stack><Button component={RouterLink} to={`/hosting/register?plan=${encodeURIComponent(plan.name)}`} variant={plan.popular ? "contained" : "outlined"} sx={{ mt: "auto", py: 1.2, borderWidth: 2, bgcolor: plan.popular ? "#16864A" : undefined, borderColor: plan.popular ? undefined : "#1766D4", color: plan.popular ? "#fff" : "#1766D4", fontWeight: 850, textTransform: "none", "&:hover": { borderWidth: 2, bgcolor: plan.popular ? "#0F713D" : "#EEF5FF" } }}>Αίτημα για το πακέτο</Button></Box>)}
          </Box>
          <Box id="hosting-features" sx={{ mt: 3, p: { xs: 2.5, md: 3 }, bgcolor: "#fff", border: "1px solid #D7E3EF", borderRadius: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 2 }}>{[[BoltIcon,"Υψηλή Ταχύτητα","SSD αποθήκευση και βελτιστοποιημένο περιβάλλον."],[SecurityIcon,"Ασφάλεια","SSL, firewall και συνεχής παρακολούθηση."],[AutorenewIcon,"Καθημερινά Backups","Τα δεδομένα σας παραμένουν προστατευμένα."],[HeadsetMicIcon,"Ελληνική Υποστήριξη","Άμεση και φιλική εξυπηρέτηση από την ομάδα μας."]].map(([Icon,title,body]) => { const FeatureIcon = Icon as typeof BoltIcon; return <Stack key={String(title)} direction="row" gap={1.5}><Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "#EAF2FF", color: "#1766D4", display: "grid", placeItems: "center", flexShrink: 0 }}><FeatureIcon /></Box><Box><Typography sx={{ fontWeight: 900 }}>{String(title)}</Typography><Typography sx={{ color: "#526A83", fontSize: 13.5 }}>{String(body)}</Typography></Box></Stack>; })}</Box>
        </Container>
      </Box>
      <PublicFooter />
    </Box>
  );
}
