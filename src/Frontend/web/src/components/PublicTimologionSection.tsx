import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const capabilities = [
  "Ηλεκτρονική τιμολόγηση και παραστατικά",
  "Αυτόματη διαβίβαση στο myDATA",
  "Αναζήτηση ΑΦΜ και πελατολογίου",
  "PDF, email και αναφορές",
];

export function PublicTimologionSection() {
  return (
    <Box component="section" aria-labelledby="timologion-partnership-title" sx={{ py: { xs: 5, md: 8 }, bgcolor: "#07172D" }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
          {[
            { name: "timologion", logo: "/images/partners/timologion-logo.png", href: "https://timologion.gr/", label: "timologion.gr", logoHeight: { xs: 120, md: 168 }, logoWidth: { xs: "96%", md: "94%" }, description: "Η πλατφόρμα ηλεκτρονικής τιμολόγησης για την έκδοση και οργάνωση παραστατικών." },
            { name: "WRAPP Α.Ε.", logo: "/images/partners/wrapp-logo.png", href: "https://wrapp.ai/el", label: "Πιστοποιημένος πάροχος ηλεκτρονικής τιμολόγησης", logoHeight: { xs: 84, md: 110 }, logoWidth: { xs: "90%", md: "82%" }, description: "Η τεχνολογία παρόχου που υποστηρίζει την ηλεκτρονική τιμολόγηση και τη διαβίβαση στο myDATA." },
          ].map((partner) => (
            <Box component="article" key={partner.name} sx={{ minWidth: 0, overflow: "hidden", border: "1px solid rgba(118,169,224,.25)", borderRadius: 3, bgcolor: "#0B2545", boxShadow: "0 18px 48px rgba(0,0,0,.24)", transition: "transform .2s ease, border-color .2s ease", "&:hover": { transform: "translateY(-3px)", borderColor: "rgba(76,179,255,.7)" } }}>
              <Box component="a" href={partner.href} target="_blank" rel="noopener noreferrer" aria-label={`${partner.label} — άνοιγμα επίσημου ιστότοπου`} sx={{ minHeight: { xs: 190, md: 230 }, p: { xs: 2.5, md: 3 }, display: "grid", placeItems: "center", textDecoration: "none", background: "radial-gradient(ellipse at center, rgba(34,114,190,.22), transparent 70%), linear-gradient(145deg,#102F55,#07172D)" }}>
                <Box sx={{ width: "100%", minHeight: { xs: 142, md: 184 }, display: "grid", placeItems: "center", px: { xs: 1.5, md: 2.5 }, bgcolor: "#fff", borderRadius: 2.5, boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
                  <Box component="img" src={partner.logo} alt={partner.name} loading="lazy" sx={{ display: "block", maxWidth: partner.logoWidth, width: "100%", height: partner.logoHeight, objectFit: "contain" }} />
                </Box>
              </Box>
              <Box sx={{ p: { xs: 2.5, md: 3.5 }, borderTop: "1px solid rgba(118,169,224,.2)" }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 1 }}>
                  <Typography component="h3" sx={{ color: "#fff", fontWeight: 900, fontSize: { xs: 20, md: 24 } }}>{partner.name}</Typography>
                  <OpenInNewIcon sx={{ color: "#7CC7FF", fontSize: 20 }} />
                </Stack>
                <Typography sx={{ color: "#B9CBE0", lineHeight: 1.7, fontSize: 14.5 }}>{partner.description}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ mt: 3, p: { xs: 2.5, md: 4 }, border: "1px solid rgba(118,169,224,.22)", borderRadius: 3, bgcolor: "#091E39" }}>
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 1.5 }}>
            <Chip icon={<VerifiedOutlinedIcon />} label="Συνεργασία KALYPSIS × TIMOLOGION" sx={{ bgcolor: "rgba(24,134,82,.18)", color: "#A8F0C8", border: "1px solid rgba(83,206,139,.35)", fontWeight: 850, "& .MuiChip-icon": { color: "#70D99E" } }} />
          </Stack>
          <Typography component="h2" id="timologion-partnership-title" sx={{ color: "#fff", fontSize: { xs: 26, sm: 32, md: 38 }, fontWeight: 900, lineHeight: 1.15, mb: 1.5 }}>
            Η τιμολόγηση συνδέεται με την καθημερινή λειτουργία του γραφείου.
          </Typography>
          <Typography sx={{ maxWidth: 920, color: "#C3D2E3", fontSize: { xs: 15, md: 16 }, lineHeight: 1.8, mb: 2.5 }}>
            Μέσα από τη συνεργασία με το timologion.gr, οι επιχειρήσεις οργανώνουν πελάτες, είδη και παραστατικά σε ένα καθαρό περιβάλλον. Η ηλεκτρονική τιμολόγηση και η διαβίβαση στο myDATA υποστηρίζονται από τη WRAPP Α.Ε., πιστοποιημένο πάροχο ηλεκτρονικής τιμολόγησης.
          </Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: 2.5 }}>
            {capabilities.map(item => <Chip key={item} icon={<VerifiedOutlinedIcon />} label={item} sx={{ height: "auto", bgcolor: "rgba(31,113,183,.19)", color: "#D6E9FA", border: "1px solid rgba(113,173,224,.25)", fontWeight: 700, "& .MuiChip-label": { py: .7, whiteSpace: "normal" }, "& .MuiChip-icon": { color: "#77D9A1" } }} />)}
          </Stack>
          <Button component="a" href="https://timologion.gr/" target="_blank" rel="noopener noreferrer" variant="contained" endIcon={<OpenInNewIcon />} sx={{ bgcolor: "#188552", color: "#fff", textTransform: "none", fontWeight: 850, px: 3, py: 1.25, borderRadius: 1.75, boxShadow: "none", "&:hover": { bgcolor: "#116B41", boxShadow: "none" } }}>Δείτε το timologion.gr</Button>
        </Box>
      </Container>
    </Box>
  );
}
