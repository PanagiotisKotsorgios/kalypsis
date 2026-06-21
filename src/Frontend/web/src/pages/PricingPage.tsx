import { Box, Container } from "@mui/material";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";

const PRICING_HERO =
  "https://image.slidesdocs.com/responsive-images/background/insurance-gold-coin-financial-management-yellow-light-effect-business-powerpoint-background_a339a63e08__960_540.jpg";

export function PricingPage() {
  const { t } = useTranslation();

  const tiers = [
    {
      key: "starter",
      price: "39",
      featured: false,
      features: ["pricing.starter.f1", "pricing.starter.f2", "pricing.starter.f3", "pricing.starter.f4"]
    },
    {
      key: "pro",
      price: "89",
      featured: true,
      features: [
        "pricing.pro.f1", "pricing.pro.f2", "pricing.pro.f3",
        "pricing.pro.f4", "pricing.pro.f5", "pricing.pro.f6"
      ]
    },
    {
      key: "enterprise",
      price: null,
      featured: false,
      features: ["pricing.enterprise.f1", "pricing.enterprise.f2", "pricing.enterprise.f3", "pricing.enterprise.f4"]
    }
  ];

  return (
    <PublicShell>
      <Box sx={{
        position: "relative",
        py: { xs: 8, md: 12 },
        borderBottom: "1px solid rgba(245,237,225,0.18)",
        backgroundImage:
          `linear-gradient(180deg, rgba(6,20,38,0.96) 0%, rgba(6,20,38,0.88) 50%, rgba(6,20,38,0.96) 100%),` +
          `linear-gradient(90deg, rgba(6,20,38,0.8) 0%, rgba(6,20,38,0.2) 70%),` +
          `url(${PRICING_HERO})`,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center",
        backgroundAttachment: { xs: "scroll", md: "fixed" },
        color: "var(--paper)",
        overflow: "hidden"
      }}>
        <Box className="editorial-grain" sx={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none" }} />

        <Container maxWidth="xl" sx={{ position: "relative" }}>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "7fr 5fr" },
            gap: { xs: 4, md: 8 },
            alignItems: "end"
          }}>
            <EdReveal delay={100}>
              <Box className="display" sx={{
                fontSize: { xs: 44, md: 84 },
                lineHeight: 1.02,
                color: "var(--paper)"
              }}>
                {t("pricing.editorial.titleA")}{" "}
                <span className="display-italic" style={{ color: "var(--gold)" }}>
                  {t("pricing.editorial.titleB")}
                </span>.
              </Box>
            </EdReveal>

            <EdReveal delay={200}>
              <Box sx={{
                fontSize: { xs: 17, md: 19 },
                lineHeight: 1.6,
                color: "rgba(245,237,225,0.88)",
                maxWidth: 560
              }}>
                {t("landing.pricing.lead")}
              </Box>
            </EdReveal>
          </Box>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 10, md: 14 }, borderBottom: "1px solid var(--rule)" }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            border: "1px solid var(--rule)"
          }}>
            {tiers.map((tier, idx) => (
              <EdReveal key={tier.key} delay={idx * 140}>
                <Box sx={{
                  p: { xs: 4, md: 6 },
                  height: "100%",
                  bgcolor: tier.featured ? "var(--bone)" : "transparent",
                  position: "relative",
                  borderRight: { md: idx < 2 ? "1px solid var(--rule)" : "none" },
                  borderBottom: { xs: idx < 2 ? "1px solid var(--rule)" : "none", md: "none" }
                }}>
                  {tier.featured && (
                    <Box sx={{
                      position: "absolute", top: 16, right: 16,
                      fontFamily: "var(--display)", fontStyle: "italic",
                      fontSize: 12, color: "var(--gold)", letterSpacing: "0.08em"
                    }}>
                      ✦ {t("landing.pricing.popular")}
                    </Box>
                  )}
                  <Box className="eyebrow" sx={{ mb: 4 }}>
                    {t("pricing.editorial.tier")}
                  </Box>
                  <Box className="display" sx={{
                    fontSize: { xs: 36, md: 44 },
                    color: "var(--ink)", mb: 1, lineHeight: 1
                  }}>
                    {t(`landing.pricing.${tier.key}.name`)}
                  </Box>
                  <Box sx={{ minHeight: 76, mt: 4, mb: 3 }}>
                    {tier.price ? (
                      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
                        <Box sx={{
                          fontFamily: "var(--display)",
                          fontSize: { xs: 64, md: 88 },
                          color: "var(--ink)", lineHeight: 0.9,
                          fontVariationSettings: "'opsz' 144, 'SOFT' 30"
                        }}>
                          €{tier.price}
                        </Box>
                        <Box sx={{
                          fontFamily: "var(--display)", fontStyle: "italic",
                          fontSize: 18, color: "var(--ink-muted)", pb: 2
                        }}>
                          / {t("landing.pricing.month")}
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{
                        fontFamily: "var(--display)", fontStyle: "italic",
                        fontSize: { xs: 36, md: 48 },
                        color: "var(--ink-soft)", lineHeight: 1
                      }}>
                        {t("pricing.editorial.custom")}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{
                    color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.6,
                    mb: 5, minHeight: 56
                  }}>
                    {t(`landing.pricing.${tier.key}.tagline`)}
                  </Box>
                  <Box sx={{ borderTop: "1px solid var(--rule)", pt: 3, mb: 5 }}>
                    {tier.features.map((f) => (
                      <Box key={f} sx={{
                        display: "grid", gridTemplateColumns: "20px 1fr", gap: 2,
                        py: 1.5, borderBottom: "1px solid var(--rule-soft)", alignItems: "baseline"
                      }}>
                        <Box sx={{
                          color: "var(--gold)", fontFamily: "var(--display)",
                          fontStyle: "italic", fontSize: 16
                        }}>✓</Box>
                        <Box sx={{ fontSize: 15, lineHeight: 1.5, color: "var(--ink)" }}>
                          {t(`landing.${f}`)}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  <RouterLink
                    to="/register"
                    className={tier.featured ? "ink-button" : "ghost-button"}
                    style={{ width: "100%", boxSizing: "border-box" }}
                  >
                    <span>{t(`landing.pricing.${tier.key}.cta`)}</span>
                    <ArrowOutwardIcon sx={{ fontSize: 16 }} />
                  </RouterLink>
                </Box>
              </EdReveal>
            ))}
          </Box>

          <EdReveal delay={150}>
            <Box sx={{
              textAlign: "center", mt: 8, pt: 6,
              borderTop: "1px solid var(--rule)"
            }}>
              <Box className="marginalia" sx={{ mb: 2 }}>{t("pricing.footnote")}</Box>
              <RouterLink to="/contact" className="editorial-link" style={{
                fontFamily: "var(--display)", fontStyle: "italic",
                fontSize: 22, color: "var(--ink)"
              }}>
                {t("pricing.contactSales")} →
              </RouterLink>
            </Box>
          </EdReveal>
        </Container>
      </Box>
    </PublicShell>
  );
}
