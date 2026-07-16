import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Alert, Box, Button, CircularProgress, Container, Divider, Drawer, IconButton,
  Stack, TextField, Typography
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DesktopMacIcon from "@mui/icons-material/DesktopMac";
import { PublicFooter } from "../components/PublicFooter";
import { AccessibilityWidget } from "../components/AccessibilityWidget";
import { PageEnter } from "../components/PageEnter";
import { LanguageToggle } from "../components/LanguageToggle";
import { api } from "../api/client";

// Restrained brand palette — navy for type, single accent blue, soft borders.
// The hero now sits on a soft white→light-blue gradient with wave accents; the
// rest of the page stays clean.
const NAVY = "#0b2545";        // primary text / logotype
const NAVY_SOFT = "#3d4f6b";   // secondary text
const ACCENT = "#1f7bb3";      // single accent — links + primary CTA
const RULE = "#e5e9ef";        // hairline borders
const SURFACE = "#fafbfc";     // ultra-light card surface

// Hero background — the finished wave artwork ships as a PNG and is loaded
// as a `cover` background so it fills the entire hero exactly as designed.
const HERO_BG = "/images/kalypsis-hero-bg.png";

/**
 * Reveal — cheap, GPU-only scroll-in animation.
 *
 * Wraps its children in a Box that starts a few px down + faded, then rises
 * into place the first time it intersects the viewport. Everything after
 * that is untouched by React (no re-renders, no observers hanging around),
 * so a page full of Reveals costs practically nothing.
 *
 * Pass `delay` (ms) to stagger neighbouring reveals.
 */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <Box ref={ref} sx={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(18px)",
      transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      willChange: "opacity, transform"
    }}>
      {children}
    </Box>
  );
}

// Feature list keys — labels resolved at render-time via t() so they respect
// the current language.
const FEATURE_KEYS: { icon: typeof HubOutlinedIcon; t: string; b: string }[] = [
  { icon: HubOutlinedIcon,         t: "landing.v2.feat.bridgesT", b: "landing.v2.feat.bridgesB" },
  { icon: LeaderboardOutlinedIcon, t: "landing.v2.feat.prodT",    b: "landing.v2.feat.prodB" },
  { icon: GroupsOutlinedIcon,      t: "landing.v2.feat.networkT", b: "landing.v2.feat.networkB" },
  { icon: CloudSyncOutlinedIcon,   t: "landing.v2.feat.cashT",    b: "landing.v2.feat.cashB" },
  { icon: LockOutlinedIcon,        t: "landing.v2.feat.accessT",  b: "landing.v2.feat.accessB" },
  { icon: SmartphoneOutlinedIcon,  t: "landing.v2.feat.portalT",  b: "landing.v2.feat.portalB" }
];

export function LandingPage() {
  // Mobile drawer for the login/register/contact actions — desktop keeps them
  // inline on the top bar, mobile collapses everything behind a hamburger on
  // the right side of the glass card.
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#ffffff",
      color: NAVY,
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex", flexDirection: "column",
      position: "relative",
      // The feature-grid section uses a `100vw` breakout for its background
      // — clip any horizontal overflow that produces so a scrollbar doesn't
      // appear on wide screens.
      overflowX: "hidden"
    }}>
      {/* Masthead accent — slim gradient stripe along the very top edge. */}
      <Box sx={{
        height: 3,
        background: "linear-gradient(90deg, #0b2545 0%, #1ea7e1 50%, #0b2545 100%)"
      }} />

      {/* ═══ Hero section ═══
          The finished wave artwork is a single PNG background. `cover` fills
          the hero while `center bottom` keeps the wave crests anchored at the
          floor of the section. All foreground elements sit above with z=1. */}
      <Box sx={{
        position: "relative",
        overflow: "hidden",
        backgroundImage: `url("${HERO_BG}")`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        // Fallback color while the PNG is loading so the white flash matches.
        bgcolor: "#f8fbff"
      }}>

      {/* Tiny top bar — contact info on the left, language picker on the right.
          Now wrapped in a rounded glass card that hovers above the hero.
          Wider container so the nav bar breathes: ~80% of viewport up to
          1600px on very wide screens. */}
      <Container maxWidth={false} sx={{
        // On mid-desktops the previous 82% cap left the nav shelf too
        // narrow, so contact + auth + CTA + language toggle collided. Give
        // the shelf 96% width from md up to lg, then relax to 82% only at
        // the truly wide viewports.
        maxWidth: { xs: "100%", md: "96%", lg: "88%", xl: "1600px" },
        px: { xs: 2, md: 3 },
        pt: { xs: 1.5, md: 2 },
        position: "relative", zIndex: 1
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}
          sx={{
            flexWrap: "nowrap",
            minWidth: 0,
            "& > *": { minWidth: 0 },
            // Glass card wrapper for the whole top bar. Larger on desktop
            // — beefier padding + radius so it reads as a proper navigation
            // shelf rather than a chip.
            borderRadius: { xs: 3, md: "22px" },
            px: { xs: 1.5, md: 4.5 }, py: { xs: 1, md: 2 },
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 18px 44px rgba(15,42,80,0.12)",
            border: "1px solid rgba(148,191,230,0.35)",
            // Entrance — the whole nav shelf glides down from above with a
            // subtle horizontal expansion for the "settle in" feel.
            animation: "kalypsisNavIn 850ms cubic-bezier(0.16,1,0.3,1) 60ms both",
            transformOrigin: "top center",
            "@keyframes kalypsisNavIn": {
              "0%":   { opacity: 0, transform: "translateY(-24px) scaleX(0.94)" },
              "60%":  { opacity: 1 },
              "100%": { opacity: 1, transform: "translateY(0) scaleX(1)" }
            },
            // Stagger the contact-info group and the right cluster so they
            // arrive from opposite sides after the shelf lands.
            "& [data-nav-slot='left']": {
              animation: "kalypsisNavLeftIn 700ms cubic-bezier(0.16,1,0.3,1) 380ms both"
            },
            "& [data-nav-slot='right']": {
              animation: "kalypsisNavRightIn 700ms cubic-bezier(0.16,1,0.3,1) 380ms both"
            },
            "@keyframes kalypsisNavLeftIn": {
              "0%":   { opacity: 0, transform: "translateX(-18px)" },
              "100%": { opacity: 1, transform: "translateX(0)" }
            },
            "@keyframes kalypsisNavRightIn": {
              "0%":   { opacity: 0, transform: "translateX(18px)" },
              "100%": { opacity: 1, transform: "translateX(0)" }
            }
          }}>
          {/* Mobile-only left slot — language toggle sits here so the
              hamburger can own the right-hand side. */}
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center" }}>
            <LanguageToggle />
          </Box>

          <Stack direction="row" spacing={{ xs: 1.5, md: 2, lg: 3.5 }} alignItems="center"
            data-nav-slot="left"
            sx={{ display: { xs: "none", md: "flex" }, flexShrink: 0, whiteSpace: "nowrap" }}>
            {/* Phone + email + divider disappear between md and lg so the
                shelf never has to compress the auth links or the CTA
                button. Users still get contact through the "Επικοινωνία"
                button on the right + a full contact section in the footer. */}
            <Box component="a" href="tel:+302631028971"
              sx={{
                display: { md: "none", lg: "inline-flex" }, alignItems: "center", gap: 1,
                color: NAVY, textDecoration: "none",
                fontSize: 15.5, fontWeight: 600,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              <PhoneOutlinedIcon sx={{ fontSize: 20 }} />
              2631028971
            </Box>
            <Box component="a" href="mailto:info@mykalypsis.gr"
              sx={{
                display: { md: "none", lg: "inline-flex" }, alignItems: "center", gap: 1,
                color: NAVY, textDecoration: "none",
                fontSize: 15.5, fontWeight: 600,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              <MailOutlineIcon sx={{ fontSize: 20 }} />
              info@mykalypsis.gr
            </Box>
            {/* Vertical divider between the contact info and the auth links. */}
            <Box aria-hidden sx={{
              display: { md: "none", lg: "block" },
              width: "1px", height: 22,
              bgcolor: "rgba(11,37,69,0.18)"
            }} />
            <Box component={RouterLink} to="/login"
              sx={{
                color: NAVY, textDecoration: "none",
                fontSize: { md: 14.5, lg: 15.5 }, fontWeight: 700,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              Σύνδεση
            </Box>
            <Box component={RouterLink} to="/register"
              sx={{
                color: NAVY, textDecoration: "none",
                fontSize: { md: 14.5, lg: 15.5 }, fontWeight: 700,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              Εγγραφή
            </Box>
          </Stack>
          {/* Desktop-only right cluster — Contact button + LanguageToggle. */}
          <Stack direction="row" spacing={{ md: 1.25, lg: 1.75 }} alignItems="center"
            data-nav-slot="right"
            sx={{ ml: "auto", display: { xs: "none", md: "flex" }, flexShrink: 0, whiteSpace: "nowrap" }}>
            <Button
              component={RouterLink}
              to="/contact"
              variant="outlined"
              startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 20, color: ACCENT }} />}
              sx={{
                borderRadius: 999,
                px: { md: 2, lg: 2.75 },
                py: { md: 0.85, lg: 1 },
                fontSize: { md: 13.5, lg: 14.5 },
                fontWeight: 700,
                letterSpacing: "0.01em",
                textTransform: "none",
                whiteSpace: "nowrap",
                color: NAVY,
                bgcolor: "rgba(30,167,225,0.06)",
                borderColor: "rgba(30,167,225,0.35)",
                "& .MuiButton-startIcon": { mr: 1 },
                "&:hover": {
                  borderColor: ACCENT,
                  bgcolor: "rgba(30,167,225,0.12)"
                }
              }}
            >
              {/* Between md-lg the shelf can't afford the full long label
                  next to the auth links + language toggle, so trim to
                  just «Επικοινωνία». The full label reappears at lg+. */}
              <Box sx={{ display: { md: "inline", lg: "none" } }}>Επικοινωνία</Box>
              <Box sx={{ display: { md: "none", lg: "inline" } }}>Επικοινωνία / Αναφορά Προβλήματος</Box>
            </Button>
            <LanguageToggle />
          </Stack>

          {/* Mobile-only hamburger — opens the right-hand drawer with
              Σύνδεση / Εγγραφή / Επικοινωνία. */}
          <IconButton
            aria-label="Άνοιγμα μενού"
            onClick={() => setMenuOpen(true)}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              color: NAVY,
              bgcolor: "rgba(30,167,225,0.06)",
              border: "1px solid rgba(30,167,225,0.35)",
              borderRadius: 2,
              p: 1.15,
              "&:hover": { bgcolor: "rgba(30,167,225,0.14)" }
            }}
          >
            <MenuIcon sx={{ fontSize: 26 }} />
          </IconButton>
        </Stack>
      </Container>

      {/* Right-anchored mobile / laptop drawer. Slides in from the right
          when the viewport is below the `md` breakpoint (900px). Redesigned
          to feel serious + premium: dark navy masthead with the Kalypsis
          logo, then CTA buttons that mirror the hero exactly (same vertical
          royal-blue→navy gradient, same white-with-royal-blue-border
          outline, same 14px radius and shadow). */}
      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        transitionDuration={{ enter: 280, exit: 220 }}
        PaperProps={{
          sx: {
            width: { xs: 300, sm: 340 },
            bgcolor: "#f7fafd",
            borderLeft: "1px solid rgba(148,191,230,0.35)",
            display: "flex", flexDirection: "column",
            // Very subtle inner tint so the drawer never reads as a plain
            // white slab. Two radial washes replicate the hero's palette.
            backgroundImage: `
              radial-gradient(circle at 100% 0%, rgba(47,107,214,0.10), transparent 55%),
              radial-gradient(circle at 0% 100%, rgba(30,167,225,0.08), transparent 55%),
              linear-gradient(180deg, #ffffff 0%, #eaf3ff 100%)
            `,
            // Soft shadow flush with the border, so the drawer floats.
            boxShadow: "-24px 0 60px rgba(11,37,69,0.18)"
          }
        }}
      >
        {/* ═══ Navy masthead ═══
            Deep gradient bar echoing the hero CTA so the drawer opens with a
            branded surface — not a stark white sheet. */}
        <Box sx={{
          background: "linear-gradient(180deg, #2f6bd6 0%, #17417f 55%, #0b2545 100%)",
          color: "#fff",
          px: 2.5, py: 2,
          borderBottom: "1px solid rgba(255,255,255,0.10)"
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack>
              <Typography sx={{
                fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.72)", fontWeight: 700
              }}>
                Kalypsis
              </Typography>
              <Typography sx={{
                fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", mt: 0.25
              }}>
                Μενού
              </Typography>
            </Stack>
            <IconButton onClick={() => setMenuOpen(false)}
              sx={{
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 1.5,
                "&:hover": { bgcolor: "rgba(255,255,255,0.16)" }
              }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* ═══ Auth CTAs — same visual language as the hero ═══ */}
        <Stack spacing={1.5} sx={{ p: 2.5 }}>
          <Typography sx={{
            fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase",
            color: NAVY_SOFT, fontWeight: 700, mb: 0.5
          }}>
            Λογαριασμός
          </Typography>

          {/* Primary — Σύνδεση. Identical spec to the hero CTA. */}
          <Button
            component={RouterLink} to="/login" fullWidth
            onClick={() => setMenuOpen(false)}
            variant="contained" disableElevation
            endIcon={<ArrowForwardIcon sx={{ fontSize: 20 }} />}
            sx={{
              height: 52,
              borderRadius: "14px",
              justifyContent: "space-between",
              px: 2.25,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: "#fff",
              background: "linear-gradient(180deg, #2f6bd6 0%, #17417f 55%, #0b2545 100%)",
              boxShadow:
                "0 10px 22px rgba(11,37,69,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
              transition: "transform 180ms ease, box-shadow 180ms ease, background 180ms ease",
              "&:hover": {
                background: "linear-gradient(180deg, #3d7be0 0%, #1c4f95 55%, #0e2b52 100%)",
                boxShadow: "0 14px 28px rgba(11,37,69,0.34), inset 0 1px 0 rgba(255,255,255,0.22)",
                transform: "translateY(-1px)"
              },
              "&:active": { transform: "translateY(0)" }
            }}
          >
            Σύνδεση
          </Button>

          {/* Secondary — Εγγραφή. Identical spec to the hero CTA. */}
          <Button
            component={RouterLink} to="/register" fullWidth
            onClick={() => setMenuOpen(false)}
            variant="outlined"
            endIcon={<ArrowForwardIcon sx={{ fontSize: 20 }} />}
            sx={{
              height: 52,
              borderRadius: "14px",
              justifyContent: "space-between",
              px: 2.25,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: "#17417f",
              bgcolor: "#ffffff",
              borderColor: "#2f6bd6",
              borderWidth: "1.8px",
              boxShadow: "0 8px 20px rgba(47,107,214,0.14)",
              transition: "transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease",
              "&:hover": {
                borderWidth: "1.8px",
                borderColor: "#17417f",
                bgcolor: "#eef4ff",
                boxShadow: "0 12px 26px rgba(47,107,214,0.22)",
                transform: "translateY(-1px)"
              },
              "&:active": { transform: "translateY(0)" }
            }}
          >
            Εγγραφή
          </Button>
        </Stack>

        <Divider sx={{ borderColor: "rgba(148,191,230,0.35)", mx: 2.5 }} />

        {/* ═══ Support / contact link ═══ */}
        <Stack spacing={1.5} sx={{ p: 2.5 }}>
          <Typography sx={{
            fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase",
            color: NAVY_SOFT, fontWeight: 700, mb: 0.5
          }}>
            Υποστήριξη
          </Typography>
          <Button
            component={RouterLink} to="/contact" fullWidth
            onClick={() => setMenuOpen(false)}
            variant="text"
            startIcon={<ChatBubbleOutlineIcon />}
            sx={{
              justifyContent: "flex-start",
              borderRadius: 2, py: 1.35, px: 2,
              fontSize: 14.5, fontWeight: 700, textTransform: "none",
              color: NAVY,
              bgcolor: "rgba(30,167,225,0.06)",
              border: "1px solid rgba(30,167,225,0.28)",
              "&:hover": {
                bgcolor: "rgba(30,167,225,0.14)",
                borderColor: "rgba(30,167,225,0.55)"
              }
            }}
          >
            Επικοινωνία / Αναφορά Προβλήματος
          </Button>
        </Stack>

        <Divider sx={{ borderColor: "rgba(148,191,230,0.35)", mx: 2.5 }} />

        {/* ═══ Direct contact block ═══ Pushed to the bottom of the drawer. */}
        <Box sx={{ mt: "auto" }}>
          <Stack spacing={1.5} sx={{ px: 2.5, py: 2.5 }}>
            <Typography sx={{
              fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase",
              color: NAVY_SOFT, fontWeight: 700
            }}>
              Επικοινωνία
            </Typography>
            <Box component="a" href="tel:+302631028971"
              sx={{
                display: "inline-flex", alignItems: "center", gap: 1.25,
                color: NAVY, textDecoration: "none", fontSize: 14.5, fontWeight: 700,
                py: 0.5,
                "&:hover": { color: ACCENT }
              }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: "50%",
                bgcolor: "rgba(47,107,214,0.10)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#17417f"
              }}>
                <PhoneOutlinedIcon sx={{ fontSize: 18 }} />
              </Box>
              2631028971
            </Box>
            <Box component="a" href="mailto:info@mykalypsis.gr"
              sx={{
                display: "inline-flex", alignItems: "center", gap: 1.25,
                color: NAVY, textDecoration: "none", fontSize: 14.5, fontWeight: 700,
                py: 0.5,
                "&:hover": { color: ACCENT }
              }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: "50%",
                bgcolor: "rgba(47,107,214,0.10)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#17417f"
              }}>
                <MailOutlineIcon sx={{ fontSize: 18 }} />
              </Box>
              info@mykalypsis.gr
            </Box>
            <Typography variant="caption" sx={{ color: NAVY_SOFT, mt: 1 }}>
              © {new Date().getFullYear()} Kalypsis — Η κάλυψη που εμπιστεύεστε
            </Typography>
          </Stack>
        </Box>
      </Drawer>

      {/* Logo + hero copy sit inside the gradient/wave hero area. */}
      <Container maxWidth={false} sx={{
        maxWidth: { xs: "100%", md: "82%", xl: "1600px" },
        px: { xs: 3, md: 6 }, py: { xs: 2, md: 3 },
        position: "relative", zIndex: 1
      }}>
        <PageEnter stagger={700}>
          <BigLogo />
          <Hero />
        </PageEnter>
      </Container>

      </Box> {/* ═══ /Hero section ═══ */}

      {/* Feature grid + newsletter live on the plain-white lower half so the
          gradient stays focused on the pitch above the fold. Top padding
          is zeroed here so the reversed wave background on FeatureGrid can
          butt directly against the hero — no white gap between them. */}
      <Container maxWidth={false} sx={{
        maxWidth: { xs: "100%", md: "82%", xl: "1600px" },
        px: { xs: 3, md: 6 }, pt: 0, pb: { xs: 2, md: 3 }, flex: 1
      }}>
        <PageEnter stagger={700}>
          <FeatureGrid />
        </PageEnter>
      </Container>

      {/* Full-width dark section — Kalypsis Desktop presentation. Sits outside
          the max-width Container so the black bleeds edge-to-edge. */}
      <DesktopAppSection />

      <Container maxWidth={false} sx={{
        maxWidth: { xs: "100%", md: "82%", xl: "1600px" },
        px: { xs: 3, md: 6 }, py: { xs: 2, md: 3 }
      }}>
        <PageEnter stagger={700}>
          <NewsletterCard />
        </PageEnter>
      </Container>
      <PublicFooter />
      <AccessibilityWidget />
    </Box>
  );
}

/* ============================================================================
   Big centered logo — the visual anchor of the page. No effects, no halo.
   ============================================================================ */
function BigLogo() {
  return (
    <Box sx={{
      display: "flex", justifyContent: "center",
      pt: { xs: 2, md: 4 }, pb: { xs: 2, md: 3 }
    }}>
      <Box component="img"
        // ?v=… busts the CDN/browser cache when the underlying PNG changes.
        // Bump this whenever the logo file is replaced.
        src="/kalypsis-logo.png?v=2026-07-01"
        alt="Kalypsis"
        sx={{
          width: "100%",
          maxWidth: { xs: 320, sm: 520, md: 720 },
          height: "auto",
          // Gentle "float in" — one clean transform, GPU-accelerated,
          // avoids the layout-jank you get from animating margin/height.
          animation: "kalypsisLogoIn 900ms cubic-bezier(0.16,1,0.3,1) both",
          "@keyframes kalypsisLogoIn": {
            "0%":   { opacity: 0, transform: "translateY(20px) scale(0.985)" },
            "100%": { opacity: 1, transform: "translateY(0) scale(1)" }
          }
        }} />
    </Box>
  );
}

/* ============================================================================
   Hero — short, restrained. One primary CTA, one secondary.
   ============================================================================ */
function Hero() {
  const { t } = useTranslation();
  // Shared keyframe: quick, GPU-only fade + rise. Reused on the headline,
  // sub, and CTA row with different delays for a natural cascade.
  const fadeUp = {
    "@keyframes kalypsisFadeUp": {
      "0%":   { opacity: 0, transform: "translateY(16px)" },
      "100%": { opacity: 1, transform: "translateY(0)" }
    }
  } as const;
  return (
    <Box sx={{
      textAlign: "center",
      // Wider cap so the Εγγραφή button label doesn't wrap to two lines.
      maxWidth: 920, mx: "auto",
      pb: { xs: 6, md: 10 },
      ...fadeUp
    }}>
      <Typography component="h1" sx={{
        fontSize: { xs: 32, sm: 40, md: 52 }, fontWeight: 700,
        lineHeight: 1.12, letterSpacing: "-0.02em",
        color: NAVY, mb: 2,
        animation: "kalypsisFadeUp 800ms cubic-bezier(0.16,1,0.3,1) 220ms both"
      }}>
        {t("landing.v2.heroWelcome")}{" "}{t("landing.v2.heroAction")}
      </Typography>

      <Typography sx={{
        fontSize: { xs: 16, md: 18 }, lineHeight: 1.6,
        color: NAVY_SOFT, mb: 5, maxWidth: 720, mx: "auto",
        animation: "kalypsisFadeUp 800ms cubic-bezier(0.16,1,0.3,1) 360ms both"
      }}>
        {t("landing.v2.heroSub")}
      </Typography>

      {/* CTA row. Matched pair — same height, same radius, uppercase bold
          type with 0.02em tracking, right-pointing arrow after the label.
          On mobile the stack goes vertical and each button fills the
          container so the touch target stays generous. */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 2, sm: 3 }}
        justifyContent="center"
        alignItems="stretch"
        sx={{
          width: "100%",
          // Wider cap so both CTAs (including the long Εγγραφή label) stay
          // on a single line at md+ without pinching.
          maxWidth: { xs: "100%", sm: 760, md: 820 }, mx: "auto",
          animation: "kalypsisFadeUp 800ms cubic-bezier(0.16,1,0.3,1) 520ms both"
        }}
      >
        {/* Primary — Σύνδεση. Deep navy → royal-blue vertical gradient with
            a subtle top highlight; drops a soft blue shadow; hovers brighter
            and rises 2px. */}
        <Button
          component={RouterLink}
          to="/login"
          variant="contained"
          disableElevation
          endIcon={<ArrowForwardIcon sx={{ fontSize: 24 }} />}
          sx={{
            flex: { xs: "1 1 auto", sm: "1 1 0" },
            height: { xs: 58, md: 62 },
            borderRadius: "14px",
            px: { xs: 3, sm: 5, md: 6 },
            fontSize: { xs: 15, sm: 16, md: 17 },
            fontWeight: 800,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "#fff",
            // Vertical gradient: royal-blue at top, deep navy at the base —
            // matches the polished look in the mockup.
            background: "linear-gradient(180deg, #2f6bd6 0%, #17417f 55%, #0b2545 100%)",
            boxShadow:
              "0 10px 22px rgba(11,37,69,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
            transition:
              "transform 180ms ease, box-shadow 180ms ease, background 180ms ease",
            "&:hover": {
              background:
                "linear-gradient(180deg, #3d7be0 0%, #1c4f95 55%, #0e2b52 100%)",
              boxShadow:
                "0 16px 30px rgba(11,37,69,0.34), inset 0 1px 0 rgba(255,255,255,0.22)",
              transform: "translateY(-2px)"
            },
            "&:active": { transform: "translateY(0)" }
          }}
        >
          {t("landing.v2.ctaLogin")}
        </Button>

        {/* Secondary — Εγγραφή. White pill, ~1.8px royal-blue border, blue
            bold uppercase text; lighter blue shadow. Hover brightens the
            border and floods the fill with a very light blue tint. */}
        <Button
          component={RouterLink}
          to="/register"
          variant="outlined"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 24 }} />}
          sx={{
            flex: { xs: "1 1 auto", sm: "1 1 0" },
            height: { xs: 58, md: 62 },
            borderRadius: "14px",
            px: { xs: 3, sm: 5, md: 6 },
            fontSize: { xs: 15, sm: 16, md: 17 },
            fontWeight: 800,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "#17417f",
            bgcolor: "#ffffff",
            borderColor: "#2f6bd6",
            borderWidth: "1.8px",
            boxShadow: "0 8px 20px rgba(47,107,214,0.14)",
            transition:
              "transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease",
            "&:hover": {
              borderWidth: "1.8px",
              borderColor: "#17417f",
              bgcolor: "#eef4ff",
              boxShadow: "0 12px 26px rgba(47,107,214,0.22)",
              transform: "translateY(-2px)"
            },
            "&:active": { transform: "translateY(0)" }
          }}
        >
          {t("landing.v2.ctaRegister")}
        </Button>
      </Stack>
    </Box>
  );
}

/* ============================================================================
   Feature grid — quiet cards, single accent icon, thin border, no shadows.
   Cards still fade up on scroll for a touch of life.
   ============================================================================ */
function FeatureGrid() {
  const { t } = useTranslation();
  return (
    <Box sx={{
      position: "relative",
      pb: { xs: 4, md: 6 },
      pt: { xs: 5, md: 7 },
      // Same finished wave PNG as the hero, but rotated 180° so the crests
      // flow INTO the section from the TOP — reading as a continuation of
      // the hero. Viewport breakout so the artwork spans the entire screen
      // regardless of the parent Container's 82%/1600px cap.
      "&::before": {
        content: '""',
        position: "absolute",
        // Extend upward slightly so the wave TOUCHES the hero background
        // with no white sliver between the two sections.
        top: { xs: -40, md: -80 },
        bottom: 0,
        left: "50%",
        width: "100vw",
        marginLeft: "-50vw",
        backgroundImage: `url("${HERO_BG}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center top",
        backgroundSize: "cover",
        transform: "rotate(180deg)",
        transformOrigin: "center",
        pointerEvents: "none",
        zIndex: 0,
        // Softer, longer fade at the tail (last ~25%) so the wave crests
        // dissolve into the white newsletter surface underneath instead of
        // ending in a hard band. Cubic easing (three-stop gradient) gives
        // a smoother visual than a straight linear ramp.
        maskImage: "linear-gradient(180deg, #000 0%, #000 70%, rgba(0,0,0,0.55) 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 70%, rgba(0,0,0,0.55) 88%, transparent 100%)"
      },
      // Sit every child above the ::before pseudo-element.
      "& > *": { position: "relative", zIndex: 1 }
    }}>
      <Reveal>
        <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
          <Typography sx={{
            fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase",
            color: NAVY_SOFT, fontWeight: 600, mb: 1.5
          }}>
            {t("landing.v2.featuresEyebrow")}
          </Typography>
          <Typography sx={{
            fontSize: { xs: 22, md: 28 }, fontWeight: 700,
            color: NAVY, letterSpacing: "-0.01em", mb: 1.5
          }}>
            {t("landing.v2.featuresHeadline")}
          </Typography>
          <Typography sx={{
            fontSize: { xs: 14.5, md: 15.5 }, lineHeight: 1.6,
            color: NAVY_SOFT, maxWidth: 720, mx: "auto"
          }}>
            {t("landing.v2.featuresSub")}
          </Typography>
        </Box>
      </Reveal>

      {/* Bento-style asymmetric grid — one large hero tile, two smaller
          stacked next to it, and three regular tiles below. On mobile it
          falls back to a single-column stack. */}
      <Box sx={{
        display: "grid",
        gap: { xs: 1.5, md: 2 },
        // 6-col grid only kicks in from md up; before that we stack 1 or 2 across.
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(6, 1fr)"
        },
        gridTemplateAreas: {
          xs: `"a" "b" "c" "d" "e" "f"`,
          sm: `"a a" "b c" "d e" "f f"`,
          md: `
            "a a a a b b"
            "a a a a c c"
            "d d e e f f"
          `
        }
      }}>
        {FEATURE_KEYS.map((f, i) => (
          <FeatureCell key={f.t} index={i}
            icon={f.icon}
            title={t(f.t)} body={t(f.b)}
            area={String.fromCharCode(97 + i)}      // a, b, c, d, e, f
            featured={i === 0}                       // first tile = large hero
          />
        ))}
      </Box>
    </Box>
  );
}

function FeatureCell({ icon: Icon, title, body, index, area, featured }: {
  icon: typeof HubOutlinedIcon; title: string; body: string; index: number;
  area: string; featured?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true),
      { threshold: 0.15 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <Box ref={ref} sx={{
      gridArea: area,
      p: { xs: 3, md: featured ? 4.5 : 3.5 },
      borderRadius: 2.5,
      // Two distinct surfaces — the hero tile gets the surface tint, the others
      // stay pure white. Hairline border + a hover lift give the bento its
      // "card stack" feel without the noise of inner dividers.
      bgcolor: featured ? SURFACE : "#fff",
      border: `1px solid ${RULE}`,
      display: "flex", flexDirection: "column", justifyContent: "flex-start",
      transition: `transform 600ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms, opacity 600ms ease ${index * 80}ms, box-shadow 220ms ease, border-color 220ms ease`,
      transform: visible ? "translateY(0)" : "translateY(14px)",
      opacity: visible ? 1 : 0,
      "&:hover": {
        borderColor: NAVY,
        boxShadow: "0 14px 30px -16px rgba(11,37,69,0.18)"
      }
    }}>
      <Box sx={{
        color: ACCENT, mb: featured ? 3 : 2,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: featured ? 56 : 44, height: featured ? 56 : 44,
        borderRadius: 1.5,
        bgcolor: "rgba(31,123,179,0.08)"
      }}>
        <Icon sx={{ fontSize: featured ? 30 : 24 }} />
      </Box>
      <Typography sx={{
        fontSize: featured ? { xs: 22, md: 28 } : { xs: 18, md: 20 },
        fontWeight: 800, color: NAVY,
        mb: featured ? 1.25 : 1,
        letterSpacing: "-0.015em",
        lineHeight: 1.2
      }}>
        {title}
      </Typography>
      <Typography sx={{
        fontSize: featured ? { xs: 15.5, md: 17 } : { xs: 14.5, md: 15.5 },
        lineHeight: 1.65,
        color: NAVY_SOFT
      }}>
        {body}
      </Typography>
    </Box>
  );
}

/* ============================================================================
   Desktop App section — full-width dark presentation of the native
   Kalypsis Desktop client. Auto-rotating slider with 4 screenshots +
   captions. Pauses on hover / keyboard focus for accessibility, and
   respects prefers-reduced-motion (no auto-advance for those users).
   ============================================================================ */
const DESKTOP_SLIDES = [
  { img: "/images/kalypsis-desktop-1.png", tKey: "landing.v2.desktop.slides.s1T", bKey: "landing.v2.desktop.slides.s1B" },
  { img: "/images/kalypsis-desktop-2.png", tKey: "landing.v2.desktop.slides.s2T", bKey: "landing.v2.desktop.slides.s2B" },
  { img: "/images/kalypsis-desktop-3.png", tKey: "landing.v2.desktop.slides.s3T", bKey: "landing.v2.desktop.slides.s3B" },
  { img: "/images/kalypsis-desktop-4.png", tKey: "landing.v2.desktop.slides.s4T", bKey: "landing.v2.desktop.slides.s4B" }
];
const DESKTOP_INTERVAL_MS = 6000;

function DesktopAppSection() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = window.setInterval(() => {
      setActive(v => (v + 1) % DESKTOP_SLIDES.length);
    }, DESKTOP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion]);

  const goto = (i: number) => setActive(((i % DESKTOP_SLIDES.length) + DESKTOP_SLIDES.length) % DESKTOP_SLIDES.length);

  return (
    <Box
      component="section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      sx={{
        position: "relative",
        // Deep navy → near-black gradient. Matches the platform's dark chrome
        // (AppShell topbar) so the section reads as "same product, different
        // surface" rather than a foreign inset.
        bgcolor: "#050a15",
        backgroundImage:
          `radial-gradient(1200px 600px at 15% -10%, rgba(31,123,179,0.22) 0%, transparent 60%),
           radial-gradient(900px 500px at 90% 110%, rgba(176,138,62,0.14) 0%, transparent 60%),
           linear-gradient(180deg, #050a15 0%, #0a1428 100%)`,
        color: "#f6f7fb",
        overflow: "hidden",
        py: { xs: 7, md: 12 },
        my: { xs: 4, md: 6 }
      }}
    >
      {/* Ambient grid pattern — SVG data URL for zero HTTP cost. Just enough
          texture to keep the flat background from feeling dead. */}
      <Box aria-hidden sx={{
        position: "absolute", inset: 0, opacity: 0.05,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 0h40v40H0z' fill='none' stroke='%23ffffff' stroke-width='0.5'/></svg>")`,
        pointerEvents: "none"
      }} />

      <Container maxWidth="lg" sx={{ position: "relative", px: { xs: 3, md: 5 } }}>
        <Reveal>
          <Stack direction="row" alignItems="center" spacing={1.25} mb={2}>
            <DesktopMacIcon sx={{ color: "#b08a3e", fontSize: 20 }} />
            <Typography sx={{
              fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase",
              color: "#b08a3e", fontWeight: 700
            }}>
              {t("landing.v2.desktop.eyebrow")}
            </Typography>
          </Stack>
          <Typography component="h2" sx={{
            fontSize: { xs: 28, md: 44 }, fontWeight: 800, letterSpacing: "-0.02em",
            lineHeight: 1.1, mb: 2, maxWidth: 820,
            // Subtle white → warm-gold text gradient. Reads white at normal
            // sizes and picks up gold on the descenders. Aligned with the
            // legal-hub masthead so both dark surfaces feel siblings.
            background: "linear-gradient(180deg, #ffffff 0%, #f2e6c8 130%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            {t("landing.v2.desktop.title")}
          </Typography>
          <Typography sx={{
            fontSize: { xs: 15, md: 17 }, lineHeight: 1.6,
            color: "rgba(246,247,251,0.72)", maxWidth: 720, mb: { xs: 5, md: 6 }
          }}>
            {t("landing.v2.desktop.sub")}
          </Typography>
        </Reveal>

        {/* Slider — screenshot on the left, caption + controls on the right. */}
        <Box sx={{
          display: "grid",
          gap: { xs: 4, md: 6 },
          gridTemplateColumns: { xs: "1fr", md: "1.35fr 1fr" },
          alignItems: "center"
        }}>
          {/* Screenshot stage — every slide is stacked absolute, crossfading
              via opacity. The tilted glow behind the active slide gives it
              a "framed on a desk" feel without needing 3D transforms. */}
          <Box sx={{
            position: "relative",
            aspectRatio: "16 / 10",
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 80px -30px rgba(0,0,0,0.75), 0 20px 40px -20px rgba(31,123,179,0.35)",
            bgcolor: "#0a1428"
          }}>
            {/* Glow that trails the active slide */}
            <Box aria-hidden sx={{
              position: "absolute", inset: -40, zIndex: 0,
              background: "radial-gradient(circle at 30% 20%, rgba(31,123,179,0.35), transparent 55%)",
              opacity: 0.9,
              filter: "blur(20px)",
              transition: "transform 900ms ease",
              transform: `translateX(${active * 4}%)`
            }} />
            {DESKTOP_SLIDES.map((s, i) => (
              <Box key={s.img}
                component="img"
                src={s.img}
                alt={t(s.tKey) as string}
                loading={i === 0 ? "eager" : "lazy"}
                sx={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", objectPosition: "top",
                  zIndex: 1,
                  opacity: i === active ? 1 : 0,
                  transform: i === active ? "scale(1)" : "scale(1.03)",
                  transition: "opacity 900ms cubic-bezier(0.22,1,0.36,1), transform 1500ms cubic-bezier(0.22,1,0.36,1)"
                }}
              />
            ))}
            {/* Bottom fade so text-overlay controls sit clean on any screenshot */}
            <Box aria-hidden sx={{
              position: "absolute", inset: "auto 0 0 0", height: 120, zIndex: 2,
              background: "linear-gradient(180deg, transparent, rgba(5,10,21,0.6))",
              pointerEvents: "none"
            }} />
          </Box>

          {/* Caption + controls — animates in per-slide */}
          <Box sx={{ minHeight: { md: 320 }, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {DESKTOP_SLIDES.map((s, i) => (
              <Box key={s.img} sx={{
                display: i === active ? "block" : "none"
              }}>
                <Typography sx={{
                  fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase",
                  color: "rgba(176,138,62,0.9)", fontWeight: 700, mb: 1
                }}>
                  {String(i + 1).padStart(2, "0")} / {String(DESKTOP_SLIDES.length).padStart(2, "0")}
                </Typography>
                <Typography component="h3"
                  key={`title-${active}`}
                  sx={{
                    fontSize: { xs: 22, md: 28 }, fontWeight: 800, letterSpacing: "-0.015em",
                    color: "#ffffff", mb: 1.5,
                    animation: "kdSlideIn 700ms cubic-bezier(0.22,1,0.36,1) both"
                  }}>
                  {t(s.tKey)}
                </Typography>
                <Typography
                  key={`body-${active}`}
                  sx={{
                    fontSize: { xs: 14.5, md: 16 }, lineHeight: 1.65,
                    color: "rgba(246,247,251,0.75)",
                    animation: "kdSlideIn 700ms 80ms cubic-bezier(0.22,1,0.36,1) both"
                  }}>
                  {t(s.bKey)}
                </Typography>
              </Box>
            ))}

            {/* Dots + arrows */}
            <Stack direction="row" spacing={1.5} alignItems="center" mt={4}>
              <IconButton
                aria-label={t("landing.v2.desktop.aria.prev") as string}
                onClick={() => goto(active - 1)}
                sx={{
                  color: "#f6f7fb", border: "1px solid rgba(255,255,255,0.15)",
                  width: 40, height: 40,
                  "&:hover": { borderColor: "#b08a3e", color: "#b08a3e", bgcolor: "rgba(176,138,62,0.08)" }
                }}
              >
                <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                aria-label={t("landing.v2.desktop.aria.next") as string}
                onClick={() => goto(active + 1)}
                sx={{
                  color: "#f6f7fb", border: "1px solid rgba(255,255,255,0.15)",
                  width: 40, height: 40,
                  "&:hover": { borderColor: "#b08a3e", color: "#b08a3e", bgcolor: "rgba(176,138,62,0.08)" }
                }}
              >
                <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <Box sx={{ flex: 1 }} />
              <Stack direction="row" spacing={0.75} alignItems="center">
                {DESKTOP_SLIDES.map((_, i) => (
                  <Box key={i}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t("landing.v2.desktop.aria.dot")} ${i + 1}`}
                    onClick={() => goto(i)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goto(i); } }}
                    sx={{
                      width: i === active ? 28 : 8, height: 8,
                      borderRadius: 4,
                      bgcolor: i === active ? "#b08a3e" : "rgba(255,255,255,0.25)",
                      cursor: "pointer",
                      transition: "width 400ms ease, background-color 400ms ease",
                      "&:hover": { bgcolor: i === active ? "#b08a3e" : "rgba(255,255,255,0.5)" }
                    }}
                  />
                ))}
              </Stack>
            </Stack>

            {/* CTA */}
            <Button
              component={RouterLink}
              to="/register"
              endIcon={<ArrowForwardIcon />}
              sx={{
                mt: 4, alignSelf: "flex-start",
                bgcolor: "#b08a3e", color: "#0a0f1a",
                fontWeight: 700, letterSpacing: "0.02em",
                textTransform: "none", px: 3, py: 1.25,
                borderRadius: 1.5,
                "&:hover": { bgcolor: "#c69f52" }
              }}
            >
              {t("landing.v2.desktop.cta")}
            </Button>
          </Box>
        </Box>
      </Container>

      {/* Keyframes for per-slide caption entrance */}
      <style>{`
        @keyframes kdSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Box>
  );
}

/* ============================================================================
   Newsletter card — restrained, lives above the footer. POSTs to
   /api/public/newsletter so the platform admin can broadcast later.
   ============================================================================ */
function NewsletterCard() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setStatus("err");
      setErrMsg(t("landing.v2.newsInvalid"));
      return;
    }
    setStatus("loading"); setErrMsg(null);
    try {
      await api.post("/public/newsletter", { email: email.trim() });
      setStatus("ok"); setEmail("");
    } catch (err: any) {
      setStatus("err");
      setErrMsg(err?.response?.data?.detail ?? t("landing.v2.newsError"));
    }
  };

  return (
    <Box sx={{ pt: { xs: 5, md: 7 }, pb: { xs: 4, md: 6 } }}>
      <Reveal>
      <Box sx={{
        borderRadius: 3,
        p: { xs: 3.5, md: 5 },
        display: "grid",
        gap: { xs: 3, md: 4 },
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        alignItems: "center",
        // Dark navy block — stands out against the white page without using a
        // gradient. Soft outer shadow for depth.
        bgcolor: NAVY,
        color: "#ffffff",
        boxShadow: "0 18px 50px rgba(11,37,69,0.18)"
      }}>
        <Box>
          <Typography sx={{
            fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
            color: "#6fd2ff", fontWeight: 600, mb: 1
          }}>
            {t("landing.v2.newsEyebrow")}
          </Typography>
          <Typography sx={{
            fontSize: { xs: 22, md: 26 }, fontWeight: 700, lineHeight: 1.25,
            color: "#ffffff", letterSpacing: "-0.01em", mb: 1
          }}>
            {t("landing.v2.newsTitle")}
          </Typography>
          <Typography sx={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
            {t("landing.v2.newsBody")}
          </Typography>
        </Box>

        <Box component="form" onSubmit={submit}
          sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              fullWidth size="medium" type="email" placeholder={t("landing.v2.newsPlaceholder")}
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
              disabled={status === "loading"}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.06)",
                  color: "#ffffff",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.22)" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.45)" },
                  "&.Mui-focused fieldset": { borderColor: "#6fd2ff", borderWidth: 2 }
                },
                "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,0.5)", opacity: 1 }
              }}
            />
            <Button type="submit" disableElevation variant="contained" size="large"
              disabled={status === "loading"}
              sx={{
                borderRadius: 2, px: 3, py: 1.6,
                fontWeight: 700, fontSize: 15, textTransform: "none",
                bgcolor: "#ffffff", color: NAVY, whiteSpace: "nowrap",
                "&:hover": { bgcolor: "rgba(255,255,255,0.92)" }
              }}>
              {status === "loading" ? <CircularProgress size={20} color="inherit" /> : t("landing.v2.newsSubmit")}
            </Button>
          </Stack>
          {status === "ok" && (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />}
              sx={{
                borderRadius: 2,
                bgcolor: "rgba(76,175,80,0.18)", color: "#caf3cb",
                "& .MuiAlert-icon": { color: "#9ce29f" }
              }}>
              {t("landing.v2.newsSuccess")}
            </Alert>
          )}
          {status === "err" && errMsg && (
            <Alert severity="error" onClose={() => setStatus("idle")}
              sx={{
                borderRadius: 2,
                bgcolor: "rgba(244,67,54,0.18)", color: "#ffd0cd",
                "& .MuiAlert-icon": { color: "#f7a5a0" }
              }}>
              {errMsg}
            </Alert>
          )}
        </Box>
      </Box>
      </Reveal>
    </Box>
  );
}
