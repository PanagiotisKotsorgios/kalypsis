import { useState } from "react";
import {
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MenuIcon from "@mui/icons-material/Menu";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "./LanguageToggle";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";

/**
 * The public masthead used by the homepage. Keep this shared so pre-login
 * pages (including pricing) never drift into a second navbar design.
 */
export function LandingNavbar() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Box sx={{ height: 3, background: "linear-gradient(90deg, #0b2545 0%, #1ea7e1 50%, #0b2545 100%)" }} />
      <Box sx={{ position: "relative", zIndex: 10, bgcolor: "#f8fbff" }}>
        <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "96%", lg: "88%", xl: "1600px" }, px: { xs: 2, md: 3 }, pt: { xs: 1.5, md: 2 } }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
            sx={{
              flexWrap: "nowrap", minWidth: 0, "& > *": { minWidth: 0 },
              borderRadius: { xs: 3, md: "22px" }, px: { xs: 1.5, md: 4.5 }, py: { xs: 1, md: 2 },
              background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 18px 44px rgba(15,42,80,0.12)", border: "1px solid rgba(148,191,230,0.35)",
            }}
          >
            <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center" }}><LanguageToggle /></Box>
            <Stack direction="row" spacing={{ xs: 1.5, md: 2, lg: 3.5 }} alignItems="center" sx={{ display: { xs: "none", md: "flex" }, flexShrink: 0, whiteSpace: "nowrap" }}>
              <Box component="a" href="tel:+302631028971" sx={{ display: { md: "none", lg: "inline-flex" }, alignItems: "center", gap: 1, color: NAVY, textDecoration: "none", fontSize: 15.5, fontWeight: 600, letterSpacing: "0.01em", "&:hover": { color: ACCENT } }}>
                <PhoneOutlinedIcon sx={{ fontSize: 20 }} />2631028971
              </Box>
              <Box component="a" href="mailto:info@mykalypsis.gr" sx={{ display: { md: "none", lg: "inline-flex" }, alignItems: "center", gap: 1, color: NAVY, textDecoration: "none", fontSize: 15.5, fontWeight: 600, letterSpacing: "0.01em", "&:hover": { color: ACCENT } }}>
                <MailOutlineIcon sx={{ fontSize: 20 }} />info@mykalypsis.gr
              </Box>
              <Box aria-hidden sx={{ display: { md: "none", lg: "block" }, width: 1, height: 22, bgcolor: "rgba(11,37,69,0.18)" }} />
              <Box component={RouterLink} to="/login" sx={{ color: NAVY, textDecoration: "none", fontSize: { md: 14.5, lg: 15.5 }, fontWeight: 700, letterSpacing: "0.01em", "&:hover": { color: ACCENT } }}>Σύνδεση</Box>
              <Box component={RouterLink} to="/register" sx={{ color: NAVY, textDecoration: "none", fontSize: { md: 14.5, lg: 15.5 }, fontWeight: 700, letterSpacing: "0.01em", "&:hover": { color: ACCENT } }}>Εγγραφή</Box>
            </Stack>
            <Stack direction="row" spacing={{ md: 1.25, lg: 1.75 }} alignItems="center" sx={{ ml: "auto", display: { xs: "none", md: "flex" }, flexShrink: 0, whiteSpace: "nowrap" }}>
              <Button component={RouterLink} to="/contact" variant="outlined" startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 20, color: ACCENT }} />} sx={{ borderRadius: 999, px: { md: 2, lg: 2.75 }, py: { md: .85, lg: 1 }, fontSize: { md: 13.5, lg: 14.5 }, fontWeight: 700, letterSpacing: "0.01em", textTransform: "none", whiteSpace: "nowrap", color: NAVY, bgcolor: "rgba(30,167,225,0.06)", borderColor: "rgba(30,167,225,0.35)", "& .MuiButton-startIcon": { mr: 1 }, "&:hover": { borderColor: ACCENT, bgcolor: "rgba(30,167,225,0.12)" } }}>
                <Box sx={{ display: { md: "inline", lg: "none" } }}>{t("landing.nav.contact", "Επικοινωνία")}</Box>
                <Box sx={{ display: { md: "none", lg: "inline" } }}>{t("landing.nav.contactLong", "Επικοινωνία / Αναφορά Προβλήματος")}</Box>
              </Button>
              <LanguageToggle />
            </Stack>
            <IconButton aria-label="Άνοιγμα μενού" onClick={() => setMenuOpen(true)} sx={{ display: { xs: "inline-flex", md: "none" }, color: NAVY, bgcolor: "rgba(30,167,225,0.06)", border: "1px solid rgba(30,167,225,0.35)", borderRadius: 2, p: 1.15, "&:hover": { bgcolor: "rgba(30,167,225,0.14)" } }}>
              <MenuIcon sx={{ fontSize: 26 }} />
            </IconButton>
          </Stack>
        </Container>
      </Box>

      <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)} transitionDuration={{ enter: 280, exit: 220 }} PaperProps={{ sx: { width: { xs: 300, sm: 340 }, bgcolor: "#f7fafd", borderLeft: "1px solid rgba(148,191,230,0.35)", display: "flex", flexDirection: "column", backgroundImage: "radial-gradient(circle at 100% 0%, rgba(47,107,214,0.10), transparent 55%), radial-gradient(circle at 0% 100%, rgba(30,167,225,0.08), transparent 55%), linear-gradient(180deg, #ffffff 0%, #eaf3ff 100%)", boxShadow: "-24px 0 60px rgba(11,37,69,0.18)" } }}>
        <Box sx={{ background: "linear-gradient(180deg, #2f6bd6 0%, #17417f 55%, #0b2545 100%)", color: "#fff", px: 2.5, py: 2, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between"><Stack><Typography sx={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>Kalypsis</Typography><Typography sx={{ fontSize: 17, fontWeight: 800, mt: .25 }}>Μενού</Typography></Stack><IconButton onClick={() => setMenuOpen(false)} sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 1.5, "&:hover": { bgcolor: "rgba(255,255,255,0.16)" } }}><CloseIcon /></IconButton></Stack>
        </Box>
        <Stack spacing={1.5} sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: NAVY_SOFT, fontWeight: 700 }}>Λογαριασμός</Typography>
          <Button component={RouterLink} to="/login" fullWidth onClick={() => setMenuOpen(false)} variant="contained" disableElevation endIcon={<ArrowForwardIcon sx={{ fontSize: 20 }} />} sx={{ height: 52, borderRadius: "14px", justifyContent: "space-between", px: 2.25, fontSize: 15, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase", color: "#fff", background: "linear-gradient(180deg, #2f6bd6 0%, #17417f 55%, #0b2545 100%)", boxShadow: "0 10px 22px rgba(11,37,69,0.28)", "&:hover": { background: "linear-gradient(180deg, #3d7be0 0%, #1c4f95 55%, #0e2b52 100%)" } }}>Σύνδεση</Button>
          <Button component={RouterLink} to="/register" fullWidth onClick={() => setMenuOpen(false)} variant="outlined" endIcon={<ArrowForwardIcon sx={{ fontSize: 20 }} />} sx={{ height: 52, borderRadius: "14px", justifyContent: "space-between", px: 2.25, fontSize: 15, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase", color: "#17417f", bgcolor: "#fff", borderColor: "#2f6bd6", borderWidth: "1.8px", "&:hover": { borderWidth: "1.8px", borderColor: "#17417f", bgcolor: "#eef4ff" } }}>Εγγραφή</Button>
        </Stack>
        <Divider sx={{ borderColor: "rgba(148,191,230,0.35)", mx: 2.5 }} />
        <Stack spacing={1.5} sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: NAVY_SOFT, fontWeight: 700 }}>Υποστήριξη</Typography>
          <Button component={RouterLink} to="/contact" fullWidth onClick={() => setMenuOpen(false)} variant="text" startIcon={<ChatBubbleOutlineIcon />} sx={{ justifyContent: "flex-start", borderRadius: 2, py: 1.35, px: 2, fontSize: 14.5, fontWeight: 700, textTransform: "none", color: NAVY, bgcolor: "rgba(30,167,225,0.06)", border: "1px solid rgba(30,167,225,0.28)", "&:hover": { bgcolor: "rgba(30,167,225,0.14)", borderColor: "rgba(30,167,225,0.55)" } }}>Επικοινωνία / Αναφορά Προβλήματος</Button>
        </Stack>
        <Divider sx={{ borderColor: "rgba(148,191,230,0.35)", mx: 2.5 }} />
        <Box sx={{ mt: "auto" }}><Stack spacing={1.5} sx={{ px: 2.5, py: 2.5 }}><Typography sx={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: NAVY_SOFT, fontWeight: 700 }}>Επικοινωνία</Typography><Box component="a" href="tel:+302631028971" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, color: NAVY, textDecoration: "none", fontSize: 14.5, fontWeight: 700, py: .5, "&:hover": { color: ACCENT } }}><Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "rgba(47,107,214,0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#17417f" }}><PhoneOutlinedIcon sx={{ fontSize: 18 }} /></Box>2631028971</Box><Box component="a" href="mailto:info@mykalypsis.gr" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, color: NAVY, textDecoration: "none", fontSize: 14.5, fontWeight: 700, py: .5, "&:hover": { color: ACCENT } }}><Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "rgba(47,107,214,0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#17417f" }}><MailOutlineIcon sx={{ fontSize: 18 }} /></Box>info@mykalypsis.gr</Box><Typography variant="caption" sx={{ color: NAVY_SOFT, mt: 1 }}>© {new Date().getFullYear()} Kalypsis — Η κάλυψη που εμπιστεύεστε</Typography></Stack></Box>
      </Drawer>
    </>
  );
}
