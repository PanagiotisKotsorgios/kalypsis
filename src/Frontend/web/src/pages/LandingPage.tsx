import { useEffect, useRef, useState, type FormEvent } from "react";
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
import LoginIcon from "@mui/icons-material/Login";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
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
      position: "relative"
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
          Now wrapped in a rounded glass card that hovers above the hero. */}
      <Container maxWidth="lg" sx={{
        px: { xs: 2, md: 3 },
        pt: { xs: 1.5, md: 2 },
        position: "relative", zIndex: 1
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}
          sx={{
            // Glass card wrapper for the whole top bar.
            borderRadius: { xs: 3, md: "18px" },
            px: { xs: 1.5, md: 3.5 }, py: { xs: 1, md: 1.4 },
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 14px 35px rgba(15,42,80,0.10)",
            border: "1px solid rgba(148,191,230,0.35)"
          }}>
          {/* Mobile-only left slot — language toggle sits here so the
              hamburger can own the right-hand side. */}
          <Box sx={{ display: { xs: "flex", sm: "none" }, alignItems: "center" }}>
            <LanguageToggle />
          </Box>

          <Stack direction="row" spacing={{ xs: 1.5, sm: 3 }} alignItems="center"
            sx={{ display: { xs: "none", sm: "flex" } }}>
            <Box component="a" href="tel:+302631028971"
              sx={{
                display: "inline-flex", alignItems: "center", gap: 0.75,
                color: NAVY, textDecoration: "none", fontSize: 13.5, fontWeight: 600,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              <PhoneOutlinedIcon sx={{ fontSize: 17 }} />
              2631028971
            </Box>
            <Box component="a" href="mailto:info@mykalypsis.gr"
              sx={{
                display: "inline-flex", alignItems: "center", gap: 0.75,
                color: NAVY, textDecoration: "none", fontSize: 13.5, fontWeight: 600,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              <MailOutlineIcon sx={{ fontSize: 17 }} />
              info@mykalypsis.gr
            </Box>
            <Box component={RouterLink} to="/login"
              sx={{
                color: NAVY, textDecoration: "none", fontSize: 13.5, fontWeight: 700,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              Σύνδεση
            </Box>
            <Box component={RouterLink} to="/register"
              sx={{
                color: NAVY, textDecoration: "none", fontSize: 13.5, fontWeight: 700,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              Εγγραφή
            </Box>
          </Stack>
          {/* Desktop-only right cluster — Contact button + LanguageToggle. */}
          <Stack direction="row" spacing={1.25} alignItems="center"
            sx={{ ml: "auto", display: { xs: "none", sm: "flex" } }}>
            <Button
              component={RouterLink}
              to="/contact"
              size="small"
              variant="outlined"
              startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 17, color: ACCENT }} />}
              sx={{
                borderRadius: 999,
                px: { xs: 1.5, sm: 2 },
                py: 0.6,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.01em",
                textTransform: "none",
                color: NAVY,
                bgcolor: "rgba(30,167,225,0.06)",
                borderColor: "rgba(30,167,225,0.35)",
                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } },
                "&:hover": {
                  borderColor: ACCENT,
                  bgcolor: "rgba(30,167,225,0.12)"
                }
              }}
            >
              Επικοινωνία / Αναφορά Προβλήματος
            </Button>
            <LanguageToggle />
          </Stack>

          {/* Mobile-only hamburger — opens the right-hand drawer with
              Σύνδεση / Εγγραφή / Επικοινωνία. */}
          <IconButton
            aria-label="Άνοιγμα μενού"
            onClick={() => setMenuOpen(true)}
            sx={{
              display: { xs: "inline-flex", sm: "none" },
              color: NAVY,
              bgcolor: "rgba(30,167,225,0.06)",
              border: "1px solid rgba(30,167,225,0.35)",
              borderRadius: 2,
              p: 1,
              "&:hover": { bgcolor: "rgba(30,167,225,0.14)" }
            }}
          >
            <MenuIcon />
          </IconButton>
        </Stack>
      </Container>

      {/* Right-anchored mobile drawer. Slides in over the hero so the sidebar
          sensation matches the mockup while the page underneath stays put. */}
      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: 288, sm: 320 },
            bgcolor: "#f8fbff",
            borderLeft: "1px solid rgba(148,191,230,0.35)",
            backgroundImage: `
              radial-gradient(circle at 100% 100%, rgba(31,123,179,0.14), transparent 50%),
              linear-gradient(180deg, #ffffff 0%, #eef6ff 100%)
            `
          }
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 2.5, py: 2 }}>
          <Typography sx={{
            fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase",
            color: NAVY_SOFT, fontWeight: 700
          }}>
            Μενού
          </Typography>
          <IconButton onClick={() => setMenuOpen(false)} sx={{ color: NAVY }}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider sx={{ borderColor: "rgba(148,191,230,0.35)" }} />
        <Stack spacing={1.5} sx={{ p: 2.5 }}>
          <Button
            component={RouterLink} to="/login" fullWidth
            onClick={() => setMenuOpen(false)}
            variant="contained" disableElevation
            startIcon={<LoginIcon />}
            sx={{
              justifyContent: "flex-start",
              borderRadius: 2, py: 1.4, px: 2,
              fontSize: 15, fontWeight: 700, textTransform: "none",
              color: "#fff",
              background: `linear-gradient(135deg, ${NAVY} 0%, #123a6b 55%, ${ACCENT} 100%)`,
              boxShadow: "0 10px 24px rgba(11,37,69,0.24)",
              "&:hover": {
                background: `linear-gradient(135deg, #0a213e 0%, #0f325d 55%, #1a6ea3 100%)`
              }
            }}
          >
            Σύνδεση
          </Button>
          <Button
            component={RouterLink} to="/register" fullWidth
            onClick={() => setMenuOpen(false)}
            variant="outlined"
            startIcon={<PersonAddOutlinedIcon />}
            sx={{
              justifyContent: "flex-start",
              borderRadius: 2, py: 1.4, px: 2,
              fontSize: 15, fontWeight: 700, textTransform: "none",
              color: ACCENT, bgcolor: "#fff",
              borderColor: ACCENT, borderWidth: 2,
              boxShadow: "0 8px 20px rgba(31,123,179,0.14)",
              "&:hover": {
                borderWidth: 2, borderColor: ACCENT,
                bgcolor: "rgba(31,123,179,0.06)"
              }
            }}
          >
            Εγγραφή
          </Button>
          <Button
            component={RouterLink} to="/contact" fullWidth
            onClick={() => setMenuOpen(false)}
            variant="text"
            startIcon={<ChatBubbleOutlineIcon />}
            sx={{
              justifyContent: "flex-start",
              borderRadius: 2, py: 1.3, px: 2,
              fontSize: 14.5, fontWeight: 700, textTransform: "none",
              color: NAVY,
              bgcolor: "rgba(30,167,225,0.06)",
              border: "1px solid rgba(30,167,225,0.25)",
              "&:hover": { bgcolor: "rgba(30,167,225,0.14)" }
            }}
          >
            Επικοινωνία / Αναφορά Προβλήματος
          </Button>
        </Stack>
        <Divider sx={{ borderColor: "rgba(148,191,230,0.35)", my: 1 }} />
        <Stack spacing={1.25} sx={{ px: 2.5, pb: 3 }}>
          <Box component="a" href="tel:+302631028971"
            sx={{
              display: "inline-flex", alignItems: "center", gap: 1,
              color: NAVY, textDecoration: "none", fontSize: 14, fontWeight: 600,
              "&:hover": { color: ACCENT }
            }}>
            <PhoneOutlinedIcon sx={{ fontSize: 18 }} />
            2631028971
          </Box>
          <Box component="a" href="mailto:info@mykalypsis.gr"
            sx={{
              display: "inline-flex", alignItems: "center", gap: 1,
              color: NAVY, textDecoration: "none", fontSize: 14, fontWeight: 600,
              "&:hover": { color: ACCENT }
            }}>
            <MailOutlineIcon sx={{ fontSize: 18 }} />
            info@mykalypsis.gr
          </Box>
        </Stack>
      </Drawer>

      {/* Logo + hero copy sit inside the gradient/wave hero area. */}
      <Container maxWidth="lg" sx={{
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
          gradient stays focused on the pitch above the fold. */}
      <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: { xs: 2, md: 3 }, flex: 1 }}>
        <PageEnter stagger={700}>
          <FeatureGrid />
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
        src="/kalypsis-logo.jpg"
        alt="Kalypsis"
        sx={{
          width: "100%",
          maxWidth: { xs: 320, sm: 520, md: 720 },
          height: "auto",
          // Imperceptibly trim the white edges of the jpg so it sits flush
          // against the white page.
          mixBlendMode: "multiply"
        }} />
    </Box>
  );
}

/* ============================================================================
   Hero — short, restrained. One primary CTA, one secondary.
   ============================================================================ */
function Hero() {
  const { t } = useTranslation();
  return (
    <Box sx={{
      textAlign: "center",
      maxWidth: 760, mx: "auto",
      pb: { xs: 6, md: 10 }
    }}>
      <Typography component="h1" sx={{
        fontSize: { xs: 32, sm: 40, md: 52 }, fontWeight: 700,
        lineHeight: 1.12, letterSpacing: "-0.02em",
        color: NAVY, mb: 2
      }}>
        {t("landing.v2.heroWelcome")}{" "}{t("landing.v2.heroAction")}
      </Typography>

      <Typography sx={{
        fontSize: { xs: 16, md: 18 }, lineHeight: 1.6,
        color: NAVY_SOFT, mb: 5, maxWidth: 620, mx: "auto"
      }}>
        {t("landing.v2.heroSub")}
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" alignItems="center">
        <Button component={RouterLink} to="/login"
          variant="contained" disableElevation size="large" endIcon={<ArrowForwardIcon sx={{ fontSize: 22 }} />}
          sx={{
            borderRadius: 2.5, px: 6, py: 2.2,
            fontSize: { xs: 17, md: 19 }, fontWeight: 700, letterSpacing: "0.04em",
            textTransform: "none",
            minWidth: { sm: 240 },
            color: "#fff",
            // Navy → accent blue diagonal gradient for a more premium feel;
            // shadow lifts the button off the pale background.
            background: `linear-gradient(135deg, ${NAVY} 0%, #123a6b 55%, ${ACCENT} 100%)`,
            boxShadow: "0 10px 24px rgba(11,37,69,0.28)",
            "&:hover": {
              background: `linear-gradient(135deg, #0a213e 0%, #0f325d 55%, #1a6ea3 100%)`,
              boxShadow: "0 14px 30px rgba(11,37,69,0.34)"
            }
          }}>
          {t("landing.v2.ctaLogin")}
        </Button>
        <Button component={RouterLink} to="/register"
          variant="outlined" size="large" endIcon={<ArrowForwardIcon sx={{ fontSize: 22 }} />}
          sx={{
            borderRadius: 2.5, px: 6, py: 2.2,
            fontSize: { xs: 17, md: 19 }, fontWeight: 700, letterSpacing: "0.04em",
            textTransform: "none",
            minWidth: { sm: 240 },
            color: ACCENT,
            bgcolor: "#fff",
            borderColor: ACCENT, borderWidth: 2,
            boxShadow: "0 8px 20px rgba(31,123,179,0.14)",
            "&:hover": {
              borderWidth: 2, borderColor: ACCENT,
              bgcolor: "rgba(31,123,179,0.06)",
              boxShadow: "0 10px 24px rgba(31,123,179,0.20)"
            }
          }}>
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
    <Box sx={{ pb: { xs: 4, md: 6 }, borderTop: `1px solid ${RULE}`, pt: { xs: 5, md: 7 } }}>
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
    </Box>
  );
}
