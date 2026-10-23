import { Box, Button, Container, Stack, Typography } from "@mui/material";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const steps = [
  { icon: GroupsOutlinedIcon, color: "#087CEB", tint: "#E7F1FD", el: ["Ξεκινάτε από εκεί που χρειάζεστε", "Ενεργοποιείτε μόνο το περιβάλλον που ταιριάζει σήμερα στο γραφείο σας."], en: ["Start where you need to", "Activate only the workspace that suits your agency today."] },
  { icon: DescriptionOutlinedIcon, color: "#087CEB", tint: "#E7F1FD", el: ["Δουλεύετε από μία καρτέλα", "Πελάτες, συμβόλαια, οχήματα, ζημιές και έγγραφα παραμένουν συνδεδεμένα."], en: ["Work from one record", "Customers, policies, vehicles, claims and documents stay connected."] },
  { icon: SettingsOutlinedIcon, color: "#087CEB", tint: "#E7F1FD", el: ["Αυτοματοποιείτε τα επαναλαμβανόμενα", "Υπενθυμίσεις, εισαγωγές, καμπάνιες και αναφορές αντλούν τα δεδομένα τους απευθείας από το σύστημα."], en: ["Automate recurring work", "Reminders, imports, campaigns and reports use data directly from the system."] },
  { icon: LeaderboardOutlinedIcon, color: "#087CEB", tint: "#E7F1FD", el: ["Μεγαλώνετε χωρίς αλλαγή συστήματος", "Προσθέτετε χρήστες, γραφεία και πακέτα, με το ίδιο περιβάλλον και την ίδια ροή εργασίας."], en: ["Grow without switching systems", "Add users, offices and packages with the same workspace and workflow."] },
];

/** Real, accessible page content; no screenshot text or decorative dashboard mockups. */
export function PublicWorkflowSection() {
  const { i18n } = useTranslation();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  return <Box component="section" aria-labelledby="public-workflow-title" sx={{ py: { xs: 5, md: 8 }, bgcolor: "#F5F8FC", borderBlock: "1px solid #DFE7F0" }}>
    <Container maxWidth="lg">
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 1.5 }}>
        <Typography sx={{ color: "#1766B5", fontSize: 11.5, letterSpacing: ".2em", fontWeight: 800 }}>{english ? "ONE CONNECTED WORKFLOW" : "ΕΝΙΑΙΑ ΡΟΗ ΕΡΓΑΣΙΑΣ"}</Typography>
        <Box aria-hidden sx={{ width: 52, height: 2, bgcolor: "#1766B5" }} />
      </Stack>
      <Typography id="public-workflow-title" component="h2" sx={{ color: "#0B2545", fontSize: { xs: 26, sm: 32, md: 38 }, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.2, textWrap: "balance", mb: 1.5 }}>
        {english ? "One workspace, without complicated processes" : "Όλα σε ένα περιβάλλον, χωρίς πολύπλοκες διαδικασίες"}
      </Typography>
      <Typography sx={{ color: "#536780", fontSize: { xs: 15, md: 17 }, lineHeight: 1.75, maxWidth: 1060, mb: { xs: 3, md: 4 } }}>
        {english ? "KALYPSIS brings your agency’s daily work into one modern workspace, from customers and policies to renewals, communications and exports." : "Το KALYPSIS συγκεντρώνει την καθημερινή λειτουργία του γραφείου σας σε ένα ενιαίο και σύγχρονο περιβάλλον, από τον πελάτη και το συμβόλαιο, έως τις ανανεώσεις, τις επικοινωνίες και τις εξαγωγές."}
      </Typography>
      <Box component="ol" aria-label={english ? "Four connected workflow steps" : "Τα τέσσερα βήματα της ενιαίας ροής"} sx={{ listStyle: "none", p: 0, m: 0, display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 2, lg: 3.5 } }}>
        {steps.map(({ icon: Icon, color, tint, el, en }, index) => <Box component="li" key={index} sx={{ position: "relative", minWidth: 0 }}>
          <Box sx={{ height: "100%", boxSizing: "border-box", p: { xs: 2.5, md: 3 }, bgcolor: "#FCFDFE", border: "1px solid #DCE5EF", borderLeft: `4px solid ${color}`, borderRadius: 2.5, transition: "border-color 180ms ease", "&:hover": { borderColor: color }, "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
              <Box aria-hidden sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: tint, color, display: "grid", placeItems: "center" }}><Icon sx={{ fontSize: 27 }} /></Box>
              <Typography aria-hidden sx={{ color, fontSize: 18, fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>{String(index + 1).padStart(2, "0")}</Typography>
            </Stack>
            <Typography component="h3" sx={{ color: "#102D55", fontSize: { xs: 18, md: 19 }, fontWeight: 800, lineHeight: 1.4, textWrap: "balance", mb: 1.25 }}>{(english ? en : el)[0]}</Typography>
            <Typography sx={{ color: "#536780", fontSize: 15, lineHeight: 1.7, overflowWrap: "anywhere" }}>{(english ? en : el)[1]}</Typography>
          </Box>
          {index < steps.length - 1 && <ChevronRightIcon aria-hidden sx={{ display: { xs: "none", lg: "block" }, position: "absolute", right: -26, top: "50%", transform: "translateY(-50%)", fontSize: 22, color: "#72869F", pointerEvents: "none" }} />}
        </Box>)}
      </Box>
      <Stack direction="row" alignItems="center" gap={2.5} sx={{ mt: { xs: 3, md: 4 } }}>
        <Box aria-hidden sx={{ display: { xs: "none", sm: "block" }, height: "1px", bgcolor: "#D6E1ED", flex: 1 }} />
        <Button component={RouterLink} to="/contact" variant="outlined" endIcon={<ArrowForwardIcon />} sx={{ width: { xs: "100%", sm: "auto" }, borderRadius: 999, borderColor: "#2C74BF", color: "#14599F", textTransform: "none", fontWeight: 750, px: 3, py: 1.25, "&:hover": { bgcolor: "#E8F1FB", borderColor: "#14599F" } }}>{english ? "Talk to KALYPSIS" : "Μιλήστε με την KALYPSIS"}</Button>
      </Stack>
    </Container>
  </Box>;
}
