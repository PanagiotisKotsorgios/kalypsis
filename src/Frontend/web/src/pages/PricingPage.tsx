import { Box, Container, Stack } from "@mui/material";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";

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
      <Box className="editorial-grain" sx={{
        py: { xs: 10, md: 16 },
        borderBottom: "1px solid var(--rule)"
      }}>
        <Container maxWidth="lg">
          <EdReveal>
            <Stack direction="row" alignItems="baseline" spacing={2} mb={{ xs: 4, md: 6 }}>
              <span className="number-marker">№ 01</span>
              <Box sx={{ flex: 1, height: "1px", bgcolor: "var(--rule)" }} />
              <span className="eyebrow">{t("landing.pricing.eyebrow")}</span>
            </Stack>
          </EdReveal>

          <EdReveal delay={120}>
            <Box className="display" sx={{
              fontSize: { xs: 48, md: 96 },
              maxWidth: 900,
              color: "var(--ink)",
              mb: 5
            }}>
              {t("pricing.editorial.titleA")}{" "}
              <span className="display-italic" style={{ color: "var(--terracotta)" }}>
                {t("pricing.editorial.titleB")}
              </span>.
            </Box>
          </EdReveal>

          <EdReveal delay={220}>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1.5fr" },
              gap: { xs: 3, md: 8 },
              mt: 4
            }}>
              <Box className="marginalia" sx={{ borderTop: "1px solid var(--ink)", pt: 2 }}>
                <span className="eyebrow" style={{ color: "var(--ink)" }}>
                  {t("pricing.editorial.lede")}
                </span>
                <Box sx={{ mt: 2 }}>{t("pricing.editorial.marginalia")}</Box>
              </Box>
              <Box sx={{ fontSize: 19, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 640 }}>
                {t("landing.pricing.lead")}
              </Box>
            </Box>
          </EdReveal>
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
                  <Box sx={{ mb: 4 }}>
                    <span className="number-marker">
                      {String(idx + 1).padStart(2, "0")} · {t("pricing.editorial.tier")}
                    </span>
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
