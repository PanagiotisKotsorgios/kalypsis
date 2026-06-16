import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { BrandImage } from "../components/BrandImage";

export function PricingPage() {
  const { t } = useTranslation();

  const tiers = [
    {
      key: "starter",
      price: "€39",
      featured: false,
      features: ["pricing.starter.f1", "pricing.starter.f2", "pricing.starter.f3", "pricing.starter.f4"]
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
    <PublicShell>
      {/* Hero band */}
      <Box
        sx={{
          position: "relative",
          py: { xs: 10, md: 14 },
          color: "common.white",
          overflow: "hidden"
        }}
      >
        <BrandImage seed="kalypsis-pricing-hero" width={1800} height={900} overlay="navy-strong" />
        <Container maxWidth="md" sx={{ position: "relative", textAlign: "center" }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="overline" sx={{ letterSpacing: 2.5, opacity: 0.8 }}>
              {t("landing.pricing.eyebrow")}
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1 }}>
              {t("landing.pricing.title")}
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: 18, maxWidth: 640 }}>
              {t("landing.pricing.lead")}
            </Typography>
            <Chip
              label={t("landing.pricing.unified")}
              sx={{
                mt: 2,
                bgcolor: "rgba(255,255,255,0.12)",
                color: "common.white",
                fontWeight: 600,
                border: "1px dashed rgba(255,255,255,0.4)"
              }}
            />
          </Stack>
        </Container>
      </Box>

      {/* Tiers (overlapping the hero a touch) */}
      <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 }, mt: { xs: -6, md: -10 }, position: "relative", zIndex: 2 }}>
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
                bgcolor: "common.white",
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
                endIcon={<ArrowForwardIcon />}
              >
                {t(`landing.pricing.${tier.key}.cta`)}
              </Button>
            </Card>
          ))}
        </Box>

        <Box sx={{ textAlign: "center", mt: 8 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t("pricing.footnote")}
          </Typography>
          <Button component={RouterLink} to="/contact" variant="text" sx={{ fontWeight: 700 }}>
            {t("pricing.contactSales")} →
          </Button>
        </Box>
      </Container>
    </PublicShell>
  );
}
