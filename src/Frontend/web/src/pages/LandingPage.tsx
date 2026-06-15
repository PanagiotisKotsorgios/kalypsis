import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
  useTheme
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import PolicyIcon from "@mui/icons-material/Policy";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import SecurityIcon from "@mui/icons-material/Security";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StarIcon from "@mui/icons-material/Star";
import { PublicShell } from "../components/PublicShell";
import { BrandImage } from "../components/BrandImage";
import { KalypsisLogo } from "../components/KalypsisLogo";

export function LandingPage() {
  return (
    <PublicShell overlayHero>
      <Hero />
      <PartnersStrip />
      <Features />
      <ForAgencies />
      <ForAgents />
      <Stats />
      <Pricing />
      <Compliance />
      <Faq />
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
        minHeight: { xs: "100vh", md: "92vh" },
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        pt: { xs: 14, md: 16 },
        pb: { xs: 10, md: 12 }
      }}
    >
      <BrandImage seed="kalypsis-hero-athens-city" width={2000} height={1200} overlay="navy-strong" />
      {/* radial accent */}
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
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, color: "common.white" }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 6, md: 8 },
            gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
            alignItems: "center"
          }}
        >
          <Stack spacing={4}>
            <Chip
              label={t("landing.eyebrow")}
              sx={{
                alignSelf: "flex-start",
                bgcolor: "rgba(255,255,255,0.12)",
                color: "common.white",
                fontWeight: 600,
                letterSpacing: 0.5,
                border: "1px solid rgba(255,255,255,0.2)"
              }}
            />
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: 36, sm: 48, md: 60 },
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: -1
              }}
            >
              {t("landing.headline")}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 17, md: 19 },
                lineHeight: 1.6,
                opacity: 0.92,
                maxWidth: 560
              }}
            >
              {t("landing.lead")}
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
              <Button
                component={RouterLink}
                to="/register"
                size="large"
                variant="contained"
                color="secondary"
                endIcon={<ArrowForwardIcon />}
                sx={{ px: 4, py: 1.6, fontSize: 16, fontWeight: 700 }}
              >
                {t("landing.ctaPrimary")}
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                size="large"
                variant="outlined"
                sx={{
                  px: 4,
                  py: 1.6,
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.5)",
                  "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" }
                }}
              >
                {t("landing.ctaSecondary")}
              </Button>
            </Stack>

            <Stack direction="row" spacing={3} sx={{ pt: 3, opacity: 0.85, flexWrap: "wrap" }}>
              <HeroTag icon={<VerifiedUserIcon fontSize="small" />} label={t("landing.heroTag.idd")} />
              <HeroTag icon={<SecurityIcon fontSize="small" />} label={t("landing.heroTag.gdpr")} />
              <HeroTag icon={<AccountBalanceIcon fontSize="small" />} label={t("landing.heroTag.boe")} />
            </Stack>
          </Stack>

          {/* Right column: showcase card */}
          <Box sx={{ position: "relative", display: { xs: "none", md: "block" } }}>
            <Card
              sx={{
                bgcolor: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "common.white",
                borderRadius: 4,
                overflow: "hidden"
              }}
            >
              <Box sx={{ position: "relative", height: 220 }}>
                <BrandImage seed="kalypsis-office-team" width={900} height={500} overlay="tint" />
                <Box sx={{ position: "absolute", left: 20, bottom: 16, zIndex: 1 }}>
                  <KalypsisLogo size={42} color="light" />
                </Box>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon key={i} sx={{ fontSize: 18, color: "#f6c452" }} />
                    ))}
                    <Typography variant="caption" sx={{ opacity: 0.85, ml: 1 }}>
                      4.9 · ELITE INSURANCE BROKERS Α.Ε.
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 16, lineHeight: 1.6, fontStyle: "italic", opacity: 0.95 }}>
                    «Από τότε που μεταβήκαμε στο Kalypsis, οι ανανεώσεις δεν χάνονται και οι πελάτες
                    βλέπουν μόνοι τους τα συμβόλαιά τους. Ο χρόνος που εξοικονομούμε μετράει.»
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        bgcolor: "rgba(255,255,255,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700
                      }}
                    >
                      ΣΚ
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>Σταύρος Καραγιάννης</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Διευθυντής Λειτουργιών, Χαλάνδρι
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function HeroTag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ fontSize: 13 }}>
      {icon}
      <span>{label}</span>
    </Stack>
  );
}

/* ----------------------- PARTNERS / TRUST STRIP ----------------------- */
function PartnersStrip() {
  const { t } = useTranslation();
  return (
    <Box sx={{ bgcolor: "background.paper", py: 5, borderBottom: "1px solid", borderColor: "divider" }}>
      <Container maxWidth="lg">
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
      </Container>
    </Box>
  );
}

/* ----------------------- FEATURES ----------------------- */
function Features() {
  const { t } = useTranslation();
  const features = [
    { icon: <PolicyIcon />, key: "policies", color: "primary.main" },
    { icon: <NotificationsActiveIcon />, key: "renewals", color: "secondary.main" },
    { icon: <GroupsIcon />, key: "portal", color: "primary.light" },
    { icon: <TrendingUpIcon />, key: "commissions", color: "#f6a623" },
    { icon: <PhoneIphoneIcon />, key: "mobile", color: "secondary.main" },
    { icon: <IntegrationInstructionsIcon />, key: "integrations", color: "primary.main" }
  ];
  return (
    <Box id="features" sx={{ py: { xs: 8, md: 14 } }}>
      <Container maxWidth="lg">
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
          {features.map((f) => (
            <Card
              key={f.key}
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
                  background: `linear-gradient(135deg, ${f.color}22, ${f.color}11)`,
                  color: f.color,
                  mb: 2.5
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
          <Box sx={{ position: "relative", aspectRatio: "5/4", borderRadius: 4, overflow: "hidden" }}>
            <BrandImage seed="kalypsis-agency-office-meeting" width={1200} height={1000} overlay="tint" />
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
                <CheckCircleIcon sx={{ color: "#7be295", fontSize: 18 }} />
                <span>{t("landing.forAgencies.badge")}</span>
              </Stack>
            </Box>
          </Box>

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
                  <CheckCircleIcon sx={{ color: "secondary.main", mt: 0.4 }} />
                  <Typography>{t(`landing.${p}`)}</Typography>
                </Stack>
              ))}
            </Stack>

            <Box sx={{ pt: 2 }}>
              <Button
                component={RouterLink}
                to="/register/agency"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
              >
                {t("landing.forAgencies.cta")}
              </Button>
            </Box>
          </Stack>
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
          <Stack spacing={3} sx={{ order: { xs: 1, md: 0 } }}>
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
                to="/register/agent"
                variant="contained"
                size="large"
                color="primary"
                endIcon={<ArrowForwardIcon />}
              >
                {t("landing.forAgents.cta")}
              </Button>
            </Box>
          </Stack>

          <Box
            sx={{
              position: "relative",
              aspectRatio: "5/4",
              borderRadius: 4,
              overflow: "hidden",
              order: { xs: 0, md: 1 }
            }}
          >
            <BrandImage seed="kalypsis-greek-broker-portrait" width={1200} height={1000} overlay="tint" />
            <Card
              sx={{
                position: "absolute",
                right: 20,
                bottom: 20,
                p: 2,
                bgcolor: "common.white",
                borderRadius: 2,
                width: 220,
                boxShadow: "0 12px 30px rgba(0,0,0,0.2)"
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1 }}>
                ΜΗΝΙΑΙΕΣ ΠΡΟΜΗΘΕΙΕΣ
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                €14.820
              </Typography>
              <Typography variant="caption" color="success.main" fontWeight={700}>
                ↑ 18% vs. προηγ. μήνα
              </Typography>
            </Card>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- STATS ----------------------- */
function Stats() {
  const { t } = useTranslation();
  const stats = [
    { value: "412+", labelKey: "landing.stats.agencies" },
    { value: "1.380", labelKey: "landing.stats.agents" },
    { value: "76.000", labelKey: "landing.stats.policies" },
    { value: "99,98%", labelKey: "landing.stats.uptime" }
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
      <BrandImage seed="kalypsis-stats-greek-architecture" width={1800} height={900} overlay="navy-strong" blur={1} />
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 2 },
            gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
            textAlign: "center"
          }}
        >
          {stats.map((s) => (
            <Stack key={s.labelKey} spacing={0.5}>
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
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- PRICING ----------------------- */
function Pricing() {
  const { t } = useTranslation();
  const tiers = [
    {
      key: "starter",
      price: "€39",
      featured: false,
      features: [
        "pricing.starter.f1",
        "pricing.starter.f2",
        "pricing.starter.f3",
        "pricing.starter.f4"
      ]
    },
    {
      key: "pro",
      price: "€89",
      featured: true,
      features: [
        "pricing.pro.f1",
        "pricing.pro.f2",
        "pricing.pro.f3",
        "pricing.pro.f4",
        "pricing.pro.f5",
        "pricing.pro.f6"
      ]
    },
    {
      key: "enterprise",
      price: "—",
      featured: false,
      features: [
        "pricing.enterprise.f1",
        "pricing.enterprise.f2",
        "pricing.enterprise.f3",
        "pricing.enterprise.f4"
      ]
    }
  ];

  return (
    <Box id="pricing" sx={{ py: { xs: 8, md: 14 }, bgcolor: "background.paper" }}>
      <Container maxWidth="lg">
        <Stack spacing={1.5} alignItems="center" textAlign="center" mb={6}>
          <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
            {t("landing.pricing.eyebrow")}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>
            {t("landing.pricing.title")}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600 }}>
            {t("landing.pricing.lead")}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }
          }}
        >
          {tiers.map((tier) => (
            <Card
              key={tier.key}
              sx={{
                p: 4,
                border: "1px solid",
                borderColor: tier.featured ? "primary.main" : "divider",
                position: "relative",
                ...(tier.featured && {
                  boxShadow: "0 24px 60px rgba(11,37,69,0.18)",
                  transform: { md: "translateY(-12px)" }
                })
              }}
            >
              {tier.featured && (
                <Chip
                  label={t("landing.pricing.popular")}
                  color="secondary"
                  sx={{ position: "absolute", top: 16, right: 16, fontWeight: 700 }}
                />
              )}
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5 }}>
                {t(`landing.pricing.${tier.key}.name`)}
              </Typography>
              <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ mt: 1 }}>
                <Typography variant="h2" sx={{ fontWeight: 900, lineHeight: 1 }}>
                  {tier.price}
                </Typography>
                {tier.price !== "—" && (
                  <Typography color="text.secondary" sx={{ pb: 1 }}>
                    /{t("landing.pricing.month")}
                  </Typography>
                )}
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                {t(`landing.pricing.${tier.key}.tagline`)}
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                {tier.features.map((f) => (
                  <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleIcon sx={{ color: "primary.main", fontSize: 20, mt: 0.2 }} />
                    <Typography>{t(`landing.${f}`)}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Button
                component={RouterLink}
                to="/register"
                fullWidth
                size="large"
                variant={tier.featured ? "contained" : "outlined"}
              >
                {t(`landing.pricing.${tier.key}.cta`)}
              </Button>
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- COMPLIANCE / SECURITY ----------------------- */
function Compliance() {
  const { t } = useTranslation();
  const items = [
    { icon: <AccountBalanceIcon />, key: "boe" },
    { icon: <VerifiedUserIcon />, key: "idd" },
    { icon: <SecurityIcon />, key: "gdpr" },
    { icon: <PolicyIcon />, key: "iso" }
  ];
  return (
    <Box sx={{ py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 8 },
            gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" },
            alignItems: "center"
          }}
        >
          <Stack spacing={2}>
            <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
              {t("landing.compliance.eyebrow")}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {t("landing.compliance.title")}
            </Typography>
            <Typography color="text.secondary">
              {t("landing.compliance.lead")}
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }
            }}
          >
            {items.map((it) => (
              <Card key={it.key} sx={{ p: 3, display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    bgcolor: "primary.main",
                    color: "common.white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {it.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{t(`landing.compliance.${it.key}.title`)}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
                    {t(`landing.compliance.${it.key}.body`)}
                  </Typography>
                </Box>
              </Card>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ----------------------- FAQ ----------------------- */
function Faq() {
  const { t } = useTranslation();
  const items = ["q1", "q2", "q3", "q4", "q5"];
  return (
    <Box id="faq" sx={{ py: { xs: 8, md: 12 }, bgcolor: "background.paper" }}>
      <Container maxWidth="md">
        <Stack spacing={1.5} alignItems="center" textAlign="center" mb={5}>
          <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
            {t("landing.faq.eyebrow")}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>
            {t("landing.faq.title")}
          </Typography>
        </Stack>

        <Stack spacing={2}>
          {items.map((q) => (
            <Card key={q} sx={{ p: 3 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>{t(`landing.faq.${q}.q`)}</Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {t(`landing.faq.${q}.a`)}
              </Typography>
            </Card>
          ))}
        </Stack>
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
        <Stack spacing={3} alignItems="center">
          <KalypsisLogo size={88} color="light" />
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
      </Container>
    </Box>
  );
}
