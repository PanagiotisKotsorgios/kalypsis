import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Container, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
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
// White page background — no gradient washes, no neon glows.
const NAVY = "#0b2545";        // primary text / logotype
const NAVY_SOFT = "#3d4f6b";   // secondary text
const ACCENT = "#1f7bb3";      // single accent — links + primary CTA
const RULE = "#e5e9ef";        // hairline borders
const SURFACE = "#fafbfc";     // ultra-light card surface

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
  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#ffffff",
      color: NAVY,
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex", flexDirection: "column"
    }}>
      {/* Tiny top bar — contact info on the left, language picker on the right. */}
      <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, pt: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
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
            <Box component="a" href="mailto:info@kalypsis.gr"
              sx={{
                display: "inline-flex", alignItems: "center", gap: 0.75,
                color: NAVY, textDecoration: "none", fontSize: 13.5, fontWeight: 600,
                letterSpacing: "0.01em",
                "&:hover": { color: ACCENT }
              }}>
              <MailOutlineIcon sx={{ fontSize: 17 }} />
              info@kalypsis.gr
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ ml: "auto" }}>
            <Button
              component={RouterLink}
              to="/contact"
              size="small"
              variant="outlined"
              startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 17 }} />}
              sx={{
                borderRadius: 999,
                px: { xs: 1.5, sm: 2 },
                py: 0.6,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.01em",
                textTransform: "none",
                color: NAVY,
                borderColor: "rgba(11,37,69,0.22)",
                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } },
                "&:hover": { borderColor: NAVY, bgcolor: "rgba(11,37,69,0.04)" }
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Επικοινωνία / Αναφορά Προβλήματος
              </Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                Επικοινωνία
              </Box>
            </Button>
            <LanguageToggle />
          </Stack>
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: { xs: 2, md: 3 }, flex: 1 }}>
        <PageEnter stagger={700}>
          <BigLogo />
          <Hero />
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
            bgcolor: NAVY, color: "#fff",
            "&:hover": { bgcolor: NAVY_SOFT }
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
            color: NAVY,
            borderColor: NAVY, borderWidth: 2,
            "&:hover": {
              borderWidth: 2, borderColor: NAVY,
              bgcolor: "rgba(11,37,69,0.04)"
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
