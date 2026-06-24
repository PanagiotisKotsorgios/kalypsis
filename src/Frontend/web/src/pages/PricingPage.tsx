import { Box, Container } from "@mui/material";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";

const PRICING_HERO =
  "https://image.slidesdocs.com/responsive-images/background/insurance-gold-coin-financial-management-yellow-light-effect-business-powerpoint-background_a339a63e08__960_540.jpg";

const PACKAGES: { key: string; numeral: string }[] = [
  { key: "backoffice",  numeral: "I" },
  { key: "frontoffice", numeral: "II" },
  { key: "crm",         numeral: "III" },
  { key: "intelligence", numeral: "IV" },
  { key: "integrations", numeral: "V" }
];

const COMBINATIONS: string[] = ["onlyBackoffice", "backFront", "backFrontCrm", "all", "custom"];

export function PricingPage() {
  const { t } = useTranslation();

  return (
    <PublicShell>
      {/* HERO */}
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
                {t("pricing.hero.titleA")}{" "}
                <span className="display-italic" style={{ color: "var(--gold)" }}>
                  {t("pricing.hero.titleB")}
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
                {t("pricing.hero.lead")}
              </Box>
            </EdReveal>
          </Box>
        </Container>
      </Box>

      {/* INTRO BLOCK — explains the model */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: "1px solid var(--rule)" }}>
        <Container maxWidth="md">
          <EdReveal>
            <Box className="number-marker" sx={{ color: "var(--gold)", mb: 2 }}>
              — {t("pricing.intro.eyebrow")}
            </Box>
            <Box className="display" sx={{
              fontSize: { xs: 32, md: 48 },
              color: "var(--ink)",
              lineHeight: 1.1,
              mb: 3
            }}>
              {t("pricing.intro.title")}
            </Box>
            <Box sx={{ color: "var(--ink-soft)", fontSize: { xs: 17, md: 19 }, lineHeight: 1.65 }}>
              {t("pricing.intro.body1")}
            </Box>
            <Box sx={{ color: "var(--ink-soft)", fontSize: { xs: 17, md: 19 }, lineHeight: 1.65, mt: 2.5 }}>
              {t("pricing.intro.body2")}
            </Box>
          </EdReveal>
        </Container>
      </Box>

      {/* FIVE PACKAGES */}
      <Box sx={{ py: { xs: 8, md: 14 }, borderBottom: "1px solid var(--rule)", bgcolor: "var(--bone)" }}>
        <Container maxWidth="lg">
          <EdReveal>
            <Box sx={{ textAlign: "center", mb: { xs: 6, md: 9 } }}>
              <Box className="number-marker" sx={{ color: "var(--gold)", mb: 1.5 }}>
                — {t("pricing.packages.eyebrow")}
              </Box>
              <Box className="display" sx={{ fontSize: { xs: 32, md: 48 }, color: "var(--ink)" }}>
                {t("pricing.packages.title")}
              </Box>
            </Box>
          </EdReveal>

          <Box sx={{ display: "grid", gap: { xs: 4, md: 5 } }}>
            {PACKAGES.map((p, i) => (
              <EdReveal key={p.key} delay={i * 90}>
                <Box sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 4fr 5fr" },
                  gap: { xs: 2, md: 5 },
                  alignItems: "start",
                  py: { xs: 4, md: 5 },
                  borderTop: "1px solid var(--rule)"
                }}>
                  {/* Roman numeral + label */}
                  <Box>
                    <Box sx={{
                      fontFamily: "var(--display)",
                      fontStyle: "italic",
                      fontSize: { xs: 48, md: 72 },
                      color: "var(--gold)",
                      lineHeight: 0.85,
                      mb: 1
                    }}>
                      {p.numeral}
                    </Box>
                    <Box className="number-marker" sx={{ color: "var(--ink-muted)" }}>
                      {t("pricing.packages.label")}
                    </Box>
                  </Box>

                  {/* Name + tagline */}
                  <Box>
                    <Box className="display" sx={{
                      fontSize: { xs: 28, md: 36 },
                      color: "var(--ink)",
                      lineHeight: 1.05,
                      mb: 1.5
                    }}>
                      {t(`pricing.packages.items.${p.key}.name`)}
                    </Box>
                    <Box sx={{
                      fontFamily: "var(--display)",
                      fontStyle: "italic",
                      fontSize: { xs: 18, md: 20 },
                      color: "var(--gold)"
                    }}>
                      {t(`pricing.packages.items.${p.key}.tagline`)}
                    </Box>
                  </Box>

                  {/* Description + example */}
                  <Box>
                    <Box sx={{
                      color: "var(--ink-soft)",
                      fontSize: { xs: 16, md: 17 },
                      lineHeight: 1.65,
                      mb: 2.5
                    }}>
                      {t(`pricing.packages.items.${p.key}.body`)}
                    </Box>
                    <Box sx={{
                      borderLeft: "3px solid var(--gold)",
                      pl: 2.5,
                      py: 1,
                      color: "var(--ink-muted)",
                      fontSize: 15,
                      lineHeight: 1.55,
                      fontStyle: "italic"
                    }}>
                      <strong style={{ color: "var(--ink)", fontStyle: "normal" }}>
                        {t("pricing.packages.exampleLabel")}:
                      </strong>{" "}
                      {t(`pricing.packages.items.${p.key}.example`)}
                    </Box>
                  </Box>
                </Box>
              </EdReveal>
            ))}
          </Box>
        </Container>
      </Box>

      {/* COMBINATION EXAMPLES */}
      <Box sx={{ py: { xs: 8, md: 14 }, borderBottom: "1px solid var(--rule)" }}>
        <Container maxWidth="lg">
          <EdReveal>
            <Box sx={{ maxWidth: 760, mb: { xs: 6, md: 8 } }}>
              <Box className="number-marker" sx={{ color: "var(--gold)", mb: 1.5 }}>
                — {t("pricing.combos.eyebrow")}
              </Box>
              <Box className="display" sx={{ fontSize: { xs: 32, md: 48 }, color: "var(--ink)", lineHeight: 1.1, mb: 2 }}>
                {t("pricing.combos.title")}
              </Box>
              <Box sx={{ color: "var(--ink-soft)", fontSize: { xs: 17, md: 19 }, lineHeight: 1.6 }}>
                {t("pricing.combos.lead")}
              </Box>
            </Box>
          </EdReveal>

          <Box sx={{
            display: "grid",
            gap: 0,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
            border: "1px solid var(--rule)"
          }}>
            {COMBINATIONS.map((c, i) => (
              <EdReveal key={c} delay={i * 90}>
                <Box sx={{
                  p: { xs: 3.5, md: 5 },
                  height: "100%",
                  borderRight: { md: i % 2 === 0 ? "1px solid var(--rule)" : "none" },
                  borderBottom: "1px solid var(--rule)"
                }}>
                  <Box sx={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--gold)",
                    letterSpacing: "0.08em",
                    mb: 1.5
                  }}>
                    {t(`pricing.combos.items.${c}.packages`)}
                  </Box>
                  <Box className="display" sx={{
                    fontSize: { xs: 22, md: 26 },
                    color: "var(--ink)",
                    mb: 2,
                    lineHeight: 1.15
                  }}>
                    {t(`pricing.combos.items.${c}.title`)}
                  </Box>
                  <Box sx={{
                    color: "var(--ink-soft)",
                    fontSize: 15.5,
                    lineHeight: 1.65
                  }}>
                    {t(`pricing.combos.items.${c}.body`)}
                  </Box>
                </Box>
              </EdReveal>
            ))}
          </Box>
        </Container>
      </Box>

      {/* CONTACT CTA */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <EdReveal>
            <Box sx={{ textAlign: "center" }}>
              <Box className="display" sx={{
                fontSize: { xs: 28, md: 40 },
                color: "var(--ink)",
                lineHeight: 1.15,
                mb: 2
              }}>
                {t("pricing.contact.title")}
              </Box>
              <Box sx={{ color: "var(--ink-soft)", fontSize: { xs: 16, md: 18 }, lineHeight: 1.6, mb: 4 }}>
                {t("pricing.contact.lead")}
              </Box>
              <RouterLink to="/contact" className="ink-button"
                style={{ display: "inline-flex", padding: "16px 32px", fontSize: 16 }}>
                <span>{t("pricing.contact.cta")}</span>
                <ArrowOutwardIcon sx={{ fontSize: 18 }} />
              </RouterLink>
            </Box>
          </EdReveal>
        </Container>
      </Box>
    </PublicShell>
  );
}
