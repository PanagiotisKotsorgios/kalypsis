import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Stack,
  Typography,
  useTheme
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
// Sidebar-themed flat icons (one tone) — match the post-login app shell.
import DescriptionIcon from "@mui/icons-material/Description";
import PeopleIcon from "@mui/icons-material/People";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ExtensionIcon from "@mui/icons-material/Extension";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { PublicShell } from "../components/PublicShell";
import { BrandImage } from "../components/BrandImage";
import { RevealOnScroll } from "../components/RevealOnScroll";
import { api } from "../api/client";

const HERO_IMAGE =
  "https://media.canadianunderwriter.ca/uploads/2024/07/iStock-1479275024-modified-78c42d3a-3ec3-44d2-98a4-882c8c742d8e.jpg";
const FOR_AGENCIES_IMAGE =
  "https://img.magnific.com/premium-photo/businessman-holding-different-icons-dark-background-closeup-insurance-concept_495423-31062.jpg";
const FOR_AGENTS_IMAGE =
  "https://img.freepik.com/premium-vector/insurance-services-concept-with-magnifier-hand-magnifying-glass-virtual-screen_127544-770.jpg";

interface PublicStats { agencies: number; producers: number; activePolicies: number; uptime: string }

export function LandingPage() {
  return (
    <PublicShell overlayHero>
      <Hero />
      <PartnersStrip />
      <Features />
      <ForAgencies />
      <ForAgents />
      <Stats />
      <FaqTeaser />
      <FinalCta />
    </PublicShell>
  );
}

/* ----------------------- HERO ----------------------- */
function Hero() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: "80vh", md: "78vh" },
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        pt: { xs: 8, md: 10 },
        pb: { xs: 10, md: 12 }
      }}
    >
      <BrandImage seed="kalypsis-hero" imageUrl={HERO_IMAGE} overlay="navy-strong" />
      <Box
        sx={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: 720,
          height: 720,
          background: `radial-gradient(circle, ${theme.palette.secondary.main}33 0%, transparent 60%)`,
          filter: "blur(20px)",
          pointerEvents: "none"
        }}
      />
      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, color: "common.white", textAlign: "center" }}>
        <Stack spacing={4} alignItems="center">
          <RevealOnScroll direction="up" duration={900}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: 38, sm: 52, md: 68 },
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 900
            }}
          >
            {t("landing.headline")}
          </Typography>
          </RevealOnScroll>
          <RevealOnScroll direction="up" delay={150}>
          <Typography
            sx={{
              fontSize: { xs: 17, md: 20 },
              lineHeight: 1.65,
              opacity: 0.92,
              maxWidth: 720
            }}
          >
            {t("landing.lead")}
          </Typography>
          </RevealOnScroll>

          <RevealOnScroll direction="up" delay={300}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 2 }}>
            <Button
              component={RouterLink}
              to="/register"
              size="large"
              variant="contained"
              color="secondary"
              endIcon={<ArrowForwardIcon />}
              sx={{ px: 4.5, py: 1.6, fontSize: 16, fontWeight: 700 }}
            >
              {t("landing.ctaPrimary")}
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              size="large"
              variant="outlined"
              sx={{
                px: 4.5,
                py: 1.6,
                color: "common.white",
                borderColor: "rgba(255,255,255,0.5)",
                "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" }
              }}
            >
              {t("landing.ctaSecondary")}
            </Button>
          </Stack>
          </RevealOnScroll>
        </Stack>
      </Container>
    </Box>
  );
}

/* ----------------------- PARTNERS / TRUST STRIP ----------------------- */
function PartnersStrip() {
  const { t } = useTranslation();
  return (
    <Box sx={{ bgcolor: "background.paper", py: 5, borderBottom: "1px solid", borderColor: "divider" }}>
      <Container maxWidth="lg">
        <RevealOnScroll direction="up">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={4}
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
            {t("landing.trustedBy")}
          </Typography>
          <Stack
            direction="row"
            spacing={{ xs: 3, md: 5 }}
            flexWrap="wrap"
            justifyContent="center"
            sx={{ opacity: 0.7 }}
          >
            {["INTERAMERICAN", "ETHNIKI", "EUROLIFE FFH", "ERGO", "ALLIANZ", "NN HELLAS"].map((name) => (
              <Typography
                key={name}
                sx={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  color: "text.secondary",
                  fontSize: { xs: 14, md: 16 }
                }}
              >
                {name}
              </Typography>
            ))}
          </Stack>
        </Stack>
        </RevealOnScroll>
      </Container>
    </Box>
  );
}

/* ----------------------- FEATURES ----------------------- */
function Features() {
  const { t } = useTranslation();
  const features = [
    { icon: <DescriptionIcon />, key: "policies" },
    { icon: <NotificationsIcon />, key: "renewals" },
    { icon: <PeopleIcon />, key: "portal" },
    { icon: <TrendingUpIcon />, key: "commissions" },
    { icon: <PhoneIphoneIcon />, key: "mobile" },
    { icon: <ExtensionIcon />, key: "integrations" }
  ];
  return (
    <Box id="features" sx={{ py: { xs: 8, md: 14 } }}>
      <Container maxWidth="lg">
        <RevealOnScroll direction="up">
        <Stack spacing={1.5} alignItems="center" textAlign="center" mb={6}>
          <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
            {t("landing.features.eyebrow")}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, maxWidth: 800 }}>
            {t("landing.features.title")}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 640 }}>
            {t("landing.features.lead")}
          </Typography>
        </Stack>
        </RevealOnScroll>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)"
            }
          }}
        >
          {features.map((f, idx) => (
            <RevealOnScroll key={f.key} delay={idx * 80} direction="up">
              <Card
                sx={{
                  p: 3.5,
                  height: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "transform 200ms, box-shadow 200ms, border-color 200ms",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    borderColor: "primary.light",
                    boxShadow: "0 18px 40px rgba(11, 37, 69, 0.12)"
                  }
                }}
              >
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(11,37,69,0.06)",
                    color: "primary.main",
                    mb: 2.5,
                    "& svg": { fontSize: 28 }
                  }}
                >
                  {f.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t(`landing.features.${f.key}.title`)}
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {t(`landing.features.${f.key}.body`)}
                </Typography>
              </Card>
            </RevealOnScroll>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- FOR AGENCIES ----------------------- */
function ForAgencies() {
  const { t } = useTranslation();
  const points = [
    "forAgencies.point1",
    "forAgencies.point2",
    "forAgencies.point3",
    "forAgencies.point4",
    "forAgencies.point5"
  ];

  return (
    <Box id="for-agencies" sx={{ py: { xs: 8, md: 14 }, bgcolor: "background.paper" }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gap: { xs: 5, md: 8 },
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "center"
          }}
        >
          <RevealOnScroll direction="left">
            <Box sx={{ position: "relative", aspectRatio: "5/4", borderRadius: 4, overflow: "hidden" }}>
              <BrandImage seed="for-agencies" imageUrl={FOR_AGENCIES_IMAGE} overlay="tint" />
              <Box
                sx={{
                  position: "absolute",
                  left: 20,
                  bottom: 20,
                  px: 2.5,
                  py: 1.5,
                  bgcolor: "rgba(11,37,69,0.92)",
                  color: "common.white",
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  zIndex: 1
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircleIcon sx={{ color: "primary.contrastText", fontSize: 18 }} />
                  <span>{t("landing.forAgencies.badge")}</span>
                </Stack>
              </Box>
            </Box>
          </RevealOnScroll>

          <RevealOnScroll direction="right" delay={100}>
            <Stack spacing={3}>
              <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
                {t("landing.forAgencies.eyebrow")}
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800 }}>
                {t("landing.forAgencies.title")}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.7 }}>
                {t("landing.forAgencies.lead")}
              </Typography>

              <Stack spacing={1.5} sx={{ pt: 1 }}>
                {points.map((p) => (
                  <Stack key={p} direction="row" spacing={1.5} alignItems="flex-start">
                    <CheckCircleIcon sx={{ color: "primary.main", mt: 0.4 }} />
                    <Typography>{t(`landing.${p}`)}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Box sx={{ pt: 2 }}>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardIcon />}
                >
                  {t("landing.forAgencies.cta")}
                </Button>
              </Box>
            </Stack>
          </RevealOnScroll>
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- FOR AGENTS ----------------------- */
function ForAgents() {
  const { t } = useTranslation();
  const licenses = [
    "landing.forAgents.licenses.agent",
    "landing.forAgents.licenses.coordinator",
    "landing.forAgents.licenses.consultant",
    "landing.forAgents.licenses.broker"
  ];

  return (
    <Box id="for-agents" sx={{ py: { xs: 8, md: 14 } }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gap: { xs: 5, md: 8 },
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "center"
          }}
        >
          <RevealOnScroll direction="right" sx={{ order: { xs: 1, md: 0 } }}>
            <Stack spacing={3}>
              <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
                {t("landing.forAgents.eyebrow")}
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800 }}>
                {t("landing.forAgents.title")}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.7 }}>
                {t("landing.forAgents.lead")}
              </Typography>

              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5 }}>
                  {t("landing.forAgents.licensesTitle")}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1, gap: 1 }}>
                  {licenses.map((lk) => (
                    <Chip
                      key={lk}
                      label={t(lk)}
                      variant="outlined"
                      sx={{ borderColor: "primary.light", color: "primary.dark", fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </Box>

              <Box sx={{ pt: 2 }}>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  color="primary"
                  endIcon={<ArrowForwardIcon />}
                >
                  {t("landing.forAgents.cta")}
                </Button>
              </Box>
            </Stack>
          </RevealOnScroll>

          <RevealOnScroll
            direction="left"
            delay={100}
            sx={{ order: { xs: 0, md: 1 } }}
          >
            <Box
              sx={{
                position: "relative",
                aspectRatio: "5/4",
                borderRadius: 4,
                overflow: "hidden",
                bgcolor: "background.paper"
              }}
            >
              <BrandImage seed="for-agents" imageUrl={FOR_AGENTS_IMAGE} overlay="none" />
            </Box>
          </RevealOnScroll>
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- STATS (real data from /api/public/stats) ----------------------- */
function Stats() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => (await api.get<PublicStats>("/public/stats")).data,
    staleTime: 5 * 60 * 1000
  });

  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("el-GR");

  const stats = [
    { value: q.data ? `${fmt(q.data.agencies)}+` : "—", labelKey: "landing.stats.agencies" },
    { value: q.data ? fmt(q.data.producers) : "—", labelKey: "landing.stats.agents" },
    { value: q.data ? fmt(q.data.activePolicies) : "—", labelKey: "landing.stats.policies" },
    { value: q.data?.uptime ?? "99,98%", labelKey: "landing.stats.uptime" }
  ];

  return (
    <Box
      sx={{
        position: "relative",
        py: { xs: 8, md: 12 },
        overflow: "hidden",
        color: "common.white"
      }}
    >
      <BrandImage seed="kalypsis-stats" width={1800} height={900} overlay="navy-strong" blur={1} />
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 2 },
            gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
            textAlign: "center"
          }}
        >
          {stats.map((s, idx) => (
            <RevealOnScroll key={s.labelKey} delay={idx * 100} direction="up">
              <Stack spacing={0.5}>
                <Typography
                  sx={{
                    fontSize: { xs: 36, md: 56 },
                    fontWeight: 900,
                    letterSpacing: -1,
                    background: "linear-gradient(135deg, #ffffff 0%, #9ecaff 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}
                >
                  {s.value}
                </Typography>
                <Typography sx={{ opacity: 0.85, fontSize: { xs: 13, md: 15 }, letterSpacing: 0.5 }}>
                  {t(s.labelKey)}
                </Typography>
              </Stack>
            </RevealOnScroll>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- FAQ teaser (real page lives at /faq) ----------------------- */
function FaqTeaser() {
  const { t } = useTranslation();
  const items = ["q1", "q2", "q3"];
  const [expanded, setExpanded] = useState<string | false>("q1");
  const [visibleCount, setVisibleCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          items.forEach((_, idx) =>
            setTimeout(() => setVisibleCount((v) => Math.max(v, idx + 1)), idx * 100)
          );
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [items]);

  return (
    <Box id="faq" sx={{ py: { xs: 8, md: 12 }, bgcolor: "background.paper" }}>
      <Container maxWidth="md" ref={rootRef}>
        <RevealOnScroll direction="up">
          <Stack spacing={1.5} alignItems="center" textAlign="center" mb={5}>
            <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
              {t("landing.faq.eyebrow")}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              {t("landing.faq.title")}
            </Typography>
          </Stack>
        </RevealOnScroll>

        <Stack spacing={1.5}>
          {items.map((q, idx) => {
            const isOpen = expanded === q;
            const isVisible = idx < visibleCount;
            return (
              <Accordion
                key={q}
                expanded={isOpen}
                onChange={(_, isExpanded) => setExpanded(isExpanded ? q : false)}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: "background.default",
                  border: "1px solid",
                  borderColor: isOpen ? "primary.main" : "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  transition:
                    "transform 250ms ease, opacity 350ms ease, box-shadow 250ms ease, border-color 250ms ease",
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                  opacity: isVisible ? 1 : 0,
                  "&:before": { display: "none" },
                  "&:hover": {
                    borderColor: "primary.light",
                    boxShadow: "0 8px 24px rgba(11,37,69,0.08)"
                  },
                  "&.Mui-expanded": {
                    boxShadow: "0 14px 40px rgba(11,37,69,0.12)",
                    bgcolor: "common.white"
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: isOpen ? "primary.main" : "background.paper",
                        color: isOpen ? "common.white" : "primary.main",
                        transition: "background 200ms"
                      }}
                    >
                      <ExpandMoreIcon />
                    </Box>
                  }
                  sx={{
                    py: 1,
                    px: 3,
                    "& .MuiAccordionSummary-content": { my: 1.5 }
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 17, color: isOpen ? "primary.main" : "text.primary" }}>
                    {t(`landing.faq.${q}.q`)}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.75, fontSize: 15.5 }}>
                    {t(`landing.faq.${q}.a`)}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>

        {/* Big animated CTA → /faq */}
        <RevealOnScroll direction="up" delay={150}>
          <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
            <Button
              component={RouterLink}
              to="/faq"
              size="large"
              variant="contained"
              startIcon={<HelpOutlineIcon sx={{ fontSize: "28px !important" }} />}
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: { xs: 4, md: 6 },
                py: { xs: 2, md: 2.5 },
                fontSize: { xs: 17, md: 20 },
                fontWeight: 800,
                borderRadius: 3,
                letterSpacing: 0.3,
                background: "linear-gradient(135deg, #0b2545 0%, #1d4e89 100%)",
                boxShadow: "0 14px 38px -10px rgba(11,37,69,0.55)",
                transition: "transform 240ms ease, box-shadow 240ms ease, background 240ms ease",
                "&:hover": {
                  transform: "translateY(-4px) scale(1.02)",
                  boxShadow: "0 28px 60px -16px rgba(11,37,69,0.7)",
                  background: "linear-gradient(135deg, #0b2545 0%, #1ea7e1 100%)"
                }
              }}
            >
              {t("landing.faq.cta")}
            </Button>
          </Box>
        </RevealOnScroll>
      </Container>
    </Box>
  );
}

/* ----------------------- FINAL CTA ----------------------- */
function FinalCta() {
  const { t } = useTranslation();
  return (
    <Box sx={{ position: "relative", py: { xs: 8, md: 14 }, overflow: "hidden", color: "common.white" }}>
      <BrandImage seed="kalypsis-final-cta-meditteranean" width={1800} height={900} overlay="navy-strong" />
      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <RevealOnScroll direction="up">
          <Stack spacing={3} alignItems="center">
            <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1 }}>
              {t("landing.finalCta.title")}
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: 18, maxWidth: 600, lineHeight: 1.6 }}>
              {t("landing.finalCta.lead")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 2 }}>
              <Button
                component={RouterLink}
                to="/register"
                size="large"
                variant="contained"
                color="secondary"
                endIcon={<ArrowForwardIcon />}
                sx={{ px: 4, py: 1.5, fontWeight: 700 }}
              >
                {t("landing.finalCta.ctaPrimary")}
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                size="large"
                variant="outlined"
                sx={{
                  px: 4,
                  py: 1.5,
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.5)",
                  "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" }
                }}
              >
                {t("landing.finalCta.ctaSecondary")}
              </Button>
            </Stack>
          </Stack>
        </RevealOnScroll>
      </Container>
    </Box>
  );
}
