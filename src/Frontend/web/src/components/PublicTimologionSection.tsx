import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const capabilities = [
  "Τιμολόγια, αποδείξεις και παραστατικά",
  "Αυτόματη διαβίβαση στο myDATA",
  "Αναζήτηση ΑΦΜ και πελατολόγιο",
  "PDF, email και αναλυτικές αναφορές",
];

export function PublicTimologionSection() {
  return (
    <Box component="section" aria-labelledby="timologion-partnership-title" sx={{ py: { xs: 5, md: 8 }, bgcolor: "#fff" }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, .9fr) minmax(480px, 1.1fr)" }, border: "1px solid #CFE0EF", borderRadius: 4, overflow: "hidden", boxShadow: "0 22px 55px rgba(11,43,84,.1)" }}>
          <Box sx={{ p: { xs: 3, sm: 4, md: 5 }, bgcolor: "#F4F9FE", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#0B2B54", color: "#fff" }}><ReceiptLongOutlinedIcon /></Box>
              <Box>
                <Typography sx={{ color: "#16844B", fontWeight: 900, fontSize: 12, letterSpacing: ".13em" }}>ΣΥΝΕΡΓΑΣΙΑ KALYPSIS × TIMOLOGION</Typography>
                <Typography sx={{ color: "#506981", fontSize: 13 }}>Ηλεκτρονική τιμολόγηση για ελληνικές επιχειρήσεις</Typography>
              </Box>
            </Stack>
            <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" gap={1.25} sx={{ mb: 2.5 }}>
              <Box
                component="a"
                href="https://timologion.gr/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="timologion.gr"
                sx={{ width: { xs: 152, sm: 176 }, height: 66, px: 1.5, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#fff", border: "1px solid #CFE0EF", transition: "transform .2s ease, box-shadow .2s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(11,43,84,.12)" } }}
              >
                <Box component="img" src="/images/partners/timologion-logo.png" alt="timologion" sx={{ display: "block", width: "100%", height: 48, objectFit: "contain" }} />
              </Box>
              <Typography aria-hidden sx={{ color: "#6B8095", fontSize: 21, fontWeight: 900 }}>×</Typography>
              <Box
                component="a"
                href="https://wrapp.ai/el"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WRAPP Α.Ε."
                sx={{ width: { xs: 142, sm: 166 }, height: 66, px: 2, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#fff", border: "1px solid #CFE0EF", transition: "transform .2s ease, box-shadow .2s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(11,43,84,.12)" } }}
              >
                <Box component="img" src="/images/partners/wrapp-logo.png" alt="WRAPP Α.Ε." sx={{ display: "block", width: "100%", height: 42, objectFit: "contain" }} />
              </Box>
              <Chip size="small" icon={<VerifiedOutlinedIcon />} label="Πιστοποιημένος πάροχος ΥΠΑΗΕΣ" sx={{ bgcolor: "#E8F6EE", color: "#17623C", border: "1px solid #C2E4D0", fontWeight: 800, "& .MuiChip-icon": { color: "#16844B" } }} />
            </Stack>
            <Typography component="h2" id="timologion-partnership-title" sx={{ color: "#0B2545", fontSize: { xs: 27, sm: 34, md: 40 }, fontWeight: 900, lineHeight: 1.15, letterSpacing: "-.03em", mb: 2 }}>
              Έκδοση παραστατικών με πιστοποιημένο πάροχο.
            </Typography>
            <Typography sx={{ color: "#405B77", fontSize: { xs: 15, md: 16 }, lineHeight: 1.8, mb: 2.5 }}>
              Μέσα από τη συνεργασία με το timologion.gr, οι επιχειρήσεις οργανώνουν πελάτες, είδη και παραστατικά σε ένα καθαρό περιβάλλον. Η φοροσήμανση και η διαβίβαση στο myDATA πραγματοποιούνται μέσω της WRAPP Α.Ε., πιστοποιημένου παρόχου ηλεκτρονικής τιμολόγησης (ΥΠΑΗΕΣ).
            </Typography>
            <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
              {capabilities.map(item => <Chip key={item} icon={<VerifiedOutlinedIcon />} label={item} sx={{ height: "auto", bgcolor: "#E8F6EE", color: "#17623C", border: "1px solid #C2E4D0", fontWeight: 750, "& .MuiChip-label": { py: .7, whiteSpace: "normal" }, "& .MuiChip-icon": { color: "#16844B" } }} />)}
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
              <Button component="a" href="https://timologion.gr/" target="_blank" rel="noopener noreferrer" variant="contained" endIcon={<OpenInNewIcon />} sx={{ bgcolor: "#16844B", color: "#fff", textTransform: "none", fontWeight: 850, px: 3, py: 1.35, borderRadius: 1.75, boxShadow: "none", "&:hover": { bgcolor: "#116B3C", boxShadow: "none" } }}>Δείτε το timologion.gr</Button>
              <Button component="a" href="https://timologion.gr/pricing" target="_blank" rel="noopener noreferrer" variant="outlined" sx={{ borderColor: "#174C8C", borderWidth: 2, color: "#0B3D78", textTransform: "none", fontWeight: 800, px: 3, borderRadius: 1.75, "&:hover": { borderWidth: 2, borderColor: "#0B305C", bgcolor: "#EEF5FC" } }}>Πακέτα και δυνατότητες</Button>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 2.5, sm: 4, md: 5 }, bgcolor: "#0B2B54", color: "#fff", position: "relative", overflow: "hidden" }}>
            <Box sx={{ position: "absolute", width: 330, height: 330, borderRadius: "50%", right: -130, top: -170, bgcolor: "rgba(30,167,225,.16)" }} />
            <Stack direction="row" alignItems="center" gap={1} sx={{ position: "relative", mb: 2.5 }}><CloudDoneOutlinedIcon sx={{ color: "#65D69A" }} /><Typography sx={{ fontWeight: 850 }}>Ζωντανή εικόνα παραστατικού</Typography><Chip size="small" label="myDATA ready" sx={{ ml: "auto", bgcolor: "#16844B", color: "#fff", fontWeight: 800 }} /></Stack>
            <Box sx={{ position: "relative", bgcolor: "#fff", color: "#0B2545", borderRadius: 2.5, p: { xs: 2, sm: 3 }, boxShadow: "0 24px 55px rgba(0,0,0,.28)" }}>
              <Stack direction="row" justifyContent="space-between" gap={2} sx={{ pb: 2, mb: 2, borderBottom: "1px solid #DDE6EF" }}><Box><Typography sx={{ fontSize: 11, color: "#668099", letterSpacing: ".12em" }}>ΠΑΡΑΣΤΑΤΙΚΟ</Typography><Typography sx={{ fontSize: 22, fontWeight: 900 }}>Τιμολόγιο παροχής</Typography></Box><Box sx={{ textAlign: "right" }}><Typography sx={{ fontWeight: 900, color: "#16844B" }}>timologion</Typography><Typography sx={{ fontSize: 12, color: "#668099" }}>μέσω WRAPP</Typography></Box></Stack>
              {["Στοιχεία πελάτη και αναζήτηση ΑΦΜ", "Είδη / υπηρεσίες και αυτόματος υπολογισμός", "MARK · UID · QR · διαβίβαση myDATA"].map((row, index) => <Stack key={row} direction="row" alignItems="center" gap={1.25} sx={{ py: 1.25, borderBottom: index < 2 ? "1px solid #EDF1F5" : 0 }}><Box sx={{ width: 28, height: 28, borderRadius: 1, display: "grid", placeItems: "center", bgcolor: index === 2 ? "#E8F6EE" : "#EAF2FB", color: index === 2 ? "#16844B" : "#1766B5", fontWeight: 900 }}>{index + 1}</Box><Typography sx={{ fontSize: 14, fontWeight: 700 }}>{row}</Typography></Stack>)}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2.5, p: 1.5, borderRadius: 1.5, bgcolor: "#F0F7FD" }}><Typography sx={{ fontWeight: 800 }}>Έτοιμο για έκδοση</Typography><Typography sx={{ color: "#16844B", fontWeight: 900 }}>Επιβεβαιωμένο ✓</Typography></Stack>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
