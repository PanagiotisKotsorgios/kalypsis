import { useEffect, useRef, useState } from "react";
import { Box, Container, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
// Sidebar-matched outlined icons for the feature grid (bigger, single tone).
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";
import { api } from "../api/client";

const HERO_IMAGE =
  "https://media.canadianunderwriter.ca/uploads/2024/07/iStock-1479275024-modified-78c42d3a-3ec3-44d2-98a4-882c8c742d8e.jpg";
const FOR_AGENCIES_IMAGE =
  "https://img.magnific.com/premium-photo/businessman-holding-different-icons-dark-background-closeup-insurance-concept_495423-31062.jpg";
const FOR_AGENTS_IMAGE =
  "https://img.freepik.com/premium-vector/insurance-services-concept-with-magnifier-hand-magnifying-glass-virtual-screen_127544-770.jpg";

export function LandingPage() {
  return (
    <PublicShell overlayHero>
      <Hero />
      <TrustMarquee />
      <Manifesto />
      <Features />
      <ForAgencies />
      <PullQuote />
      <ForAgents />
      <FaqTeaser />
    </PublicShell>
  );
}

/* =============================================================
   01 — HERO with editorial portrait
   ============================================================= */
function Hero() {
  const { t } = useTranslation();
  return (
    <Box sx={{
      position: "relative",
      overflow: "hidden",
      borderBottom: "1px solid rgba(245,237,225,0.18)",
      // The portrait now spans the full width as the hero backdrop.
      backgroundImage:
        // Top-to-bottom ink veil so type stays legible no matter the source crop
        `linear-gradient(180deg, rgba(11,37,69,0.78) 0%, rgba(11,37,69,0.62) 45%, rgba(11,37,69,0.86) 100%),` +
        // Plus a left-side darker gradient so the editorial copy block reads cleanly
        `linear-gradient(90deg, rgba(11,37,69,0.55) 0%, rgba(11,37,69,0) 60%),` +
        `url(${HERO_IMAGE})`,
      backgroundSize: "cover, cover, cover",
      backgroundPosition: "center, center, center",
      color: "var(--paper)"
    }}>
      {/* Grain on top of the image for tactile feel */}
      <Box className="editorial-grain" sx={{ position: "absolute", inset: 0, opacity: 0.35 }} />

      <Container
        maxWidth="xl"
        sx={{
          position: "relative",
          zIndex: 1,
          pt: { xs: 7, md: 11 },
          pb: { xs: 7, md: 11 }
        }}
      >
        {/* Wide editorial headline — much wider, much less vertical */}
        <EdReveal delay={120}>
          <Box
            className="display"
            sx={{
              fontSize: { xs: 44, sm: 64, md: 84, lg: 102, xl: 116 },
              color: "var(--paper)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
              maxWidth: { xs: "100%", md: "1180px" },
              mb: { xs: 4, md: 6 }
            }}
          >
            {t("landing.editorial.headlineA")}{" "}
            <span
              className="display-italic"
              style={{ color: "var(--gold)" }}
            >
              {t("landing.editorial.headlineB")}
            </span>{" "}
            {t("landing.editorial.headlineC")}
          </Box>
        </EdReveal>

        {/* Lead + CTAs row */}
        <EdReveal delay={220}>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.5fr 1fr" },
            gap: { xs: 4, md: 8 },
            alignItems: "start",
            mb: { xs: 5, md: 7 }
          }}>
            <Box
              sx={{
                fontSize: { xs: 17, md: 19 },
                lineHeight: 1.65,
                color: "rgba(245,237,225,0.88)",
                maxWidth: 720
              }}
            >
              {t("landing.lead")}
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: { md: "flex-end" } }}>
              <RouterLink
                to="/register"
                className="ink-button"
                style={{
                  fontSize: 16,
                  padding: "18px 32px",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  borderColor: "var(--paper)"
                }}
              >
                <span>{t("landing.ctaPrimary")}</span>
                <ArrowOutwardIcon sx={{ fontSize: 20 }} />
              </RouterLink>
              <RouterLink
                to="/login"
                className="ghost-button"
                style={{
                  fontSize: 16,
                  padding: "17px 30px",
                  color: "var(--paper)",
                  borderColor: "rgba(245,237,225,0.6)"
                }}
              >
                <span>{t("landing.ctaSecondary")}</span>
              </RouterLink>
            </Stack>
          </Box>
        </EdReveal>

      </Container>
    </Box>
  );
}

/* =============================================================
   02 — TRUST MARQUEE
   ============================================================= */
interface PartnerDto { id: string; name: string; logoUrl: string | null; url: string | null; displayOrder: number; isActive: boolean }
function TrustMarquee() {
  const { t } = useTranslation();
  // Sourced from /api/public/partners — the superadmin curates the list in
  // /app/platform/partners. We hide the strip entirely when empty so the
  // page doesn't show a placeholder before the platform has any.
  const q = useQuery({
    queryKey: ["public-partners"],
    queryFn: async () => (await api.get<PartnerDto[]>("/public/partners")).data,
    staleTime: 10 * 60 * 1000
  });
  const carriers = (q.data ?? []).map(p => p.name).filter(Boolean);
  if (carriers.length === 0) return null;
  const stream = [...carriers, ...carriers];
  return (
    <Box sx={{ borderBottom: "1px solid var(--rule)", py: 4 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="center">
          <Box className="eyebrow" sx={{ whiteSpace: "nowrap" }}>{t("landing.trustedBy")}</Box>
          <Box className="trust-marquee" sx={{ flex: 1, width: "100%" }}>
            <Box className="track">
              {stream.map((name, i) => (
                <Box key={i} sx={{
                  fontFamily: "var(--display)",
                  fontStyle: "italic",
                  fontVariationSettings: "'opsz' 144, 'SOFT' 60",
                  fontSize: { xs: 22, md: 28 },
                  color: "var(--ink-muted)",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap"
                }}>
                  {name}
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

/* =============================================================
   03 — MANIFESTO with drop cap
   ============================================================= */
function Manifesto() {
  const { t } = useTranslation();
  return (
    <Box sx={{ py: { xs: 10, md: 18 }, borderBottom: "1px solid var(--rule)" }}>
      <Container maxWidth="md">
        <EdReveal delay={120}>
          <Box className="display" sx={{
            fontSize: { xs: 36, md: 56 },
            mb: 5,
            maxWidth: 720,
            color: "var(--ink)"
          }}>
            {t("landing.manifesto.title")}
          </Box>
        </EdReveal>

        <EdReveal delay={220}>
          <Box className="drop-cap" sx={{
            fontSize: 19,
            lineHeight: 1.75,
            color: "var(--ink-soft)",
            maxWidth: 720
          }}>
            {t("landing.manifesto.body")}
          </Box>
        </EdReveal>
      </Container>
    </Box>
  );
}

/* =============================================================
   04 — FEATURES
   ============================================================= */
function Features() {
  const { t } = useTranslation();
  const features = [
    { key: "policies",     glyph: "I",   icon: <DescriptionOutlinedIcon /> },
    { key: "renewals",     glyph: "II",  icon: <NotificationsNoneOutlinedIcon /> },
    { key: "portal",       glyph: "III", icon: <GroupsOutlinedIcon /> },
    { key: "commissions",  glyph: "IV",  icon: <TrendingUpOutlinedIcon /> },
    { key: "mobile",       glyph: "V",   icon: <PhoneIphoneOutlinedIcon /> },
    { key: "integrations", glyph: "VI",  icon: <ExtensionOutlinedIcon /> }
  ];
  return (
    <Box id="features" sx={{ py: { xs: 10, md: 18 }, borderBottom: "1px solid var(--rule)" }}>
      <Container maxWidth="lg">
        <EdReveal>
          <Box sx={{ mb: 6, maxWidth: 880 }}>
            <Box className="display" sx={{
              fontSize: { xs: 36, md: 56 },
              color: "var(--ink)"
            }}>
              {t("landing.features.title")}
            </Box>
            <Box sx={{ mt: 3, maxWidth: 640, color: "var(--ink-soft)", fontSize: 17, lineHeight: 1.65 }}>
              {t("landing.features.lead")}
            </Box>
          </Box>
        </EdReveal>

        <Box sx={{
          display: "grid",
          gap: 0,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
          mt: 8,
          borderTop: "1px solid var(--rule)",
          borderLeft: { sm: "1px solid var(--rule)" }
        }}>
          {features.map((f, i) => (
            <EdReveal key={f.key} delay={i * 90}>
              <Box className="paper-card" sx={{
                p: { xs: 4, md: 5 },
                height: "100%",
                border: "none",
                borderRight: "1px solid var(--rule)",
                borderBottom: "1px solid var(--rule)",
                background: "transparent"
              }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
                  {/* Bigger, consistent outlined icon matching the post-login sidebar tone */}
                  <Box sx={{
                    width: 56,
                    height: 56,
                    border: "1.5px solid var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink)",
                    bgcolor: "var(--bone)",
                    transition: "background 420ms var(--ease-editorial), color 420ms var(--ease-editorial)",
                    "& svg": { fontSize: 30 }
                  }}>
                    {f.icon}
                  </Box>
                </Stack>
                <Box className="display" sx={{
                  fontSize: { xs: 28, md: 32 },
                  color: "var(--ink)",
                  mb: 2,
                  lineHeight: 1.05
                }}>
                  {t(`landing.features.${f.key}.title`)}
                </Box>
                <Box sx={{
                  color: "var(--ink-soft)",
                  fontSize: 16,
                  lineHeight: 1.7
                }}>
                  {t(`landing.features.${f.key}.body`)}
                </Box>
              </Box>
            </EdReveal>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* =============================================================
   05 — FOR AGENCIES — asymmetric, marginalia
   ============================================================= */
function ForAgencies() {
  const { t } = useTranslation();
  const points = ["forAgencies.point1","forAgencies.point2","forAgencies.point3","forAgencies.point4","forAgencies.point5"];
  return (
    <Box id="for-agencies" sx={{
      position: "relative",
      py: { xs: 8, md: 12 },
      borderBottom: "1px solid rgba(245,237,225,0.18)",
      backgroundImage:
        `linear-gradient(180deg, rgba(6,20,38,0.96) 0%, rgba(6,20,38,0.88) 50%, rgba(6,20,38,0.96) 100%),` +
        `linear-gradient(90deg, rgba(6,20,38,0.8) 0%, rgba(6,20,38,0.2) 70%),` +
        `url(${FOR_AGENCIES_IMAGE})`,
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
          gridTemplateColumns: { xs: "1fr", md: "6fr 6fr" },
          gap: { xs: 4, md: 8 },
          alignItems: "end",
          mb: { xs: 5, md: 7 }
        }}>
          <EdReveal delay={100}>
            <Box className="display" sx={{
              fontSize: { xs: 38, md: 64 },
              lineHeight: 1.02,
              color: "var(--paper)"
            }}>
              <span>{t("landing.editorial.agencyA")}</span>{" "}
              <span className="display-italic" style={{ color: "var(--gold)" }}>
                {t("landing.editorial.agencyB")}
              </span>
            </Box>
          </EdReveal>

          <EdReveal delay={200}>
            <Box sx={{
              fontSize: { xs: 17, md: 19 },
              lineHeight: 1.6,
              color: "rgba(245,237,225,0.88)",
              maxWidth: 620
            }}>
              {t("landing.forAgencies.lead")}
            </Box>
          </EdReveal>
        </Box>

        <EdReveal delay={260}>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
            borderTop: "1px solid rgba(245,237,225,0.28)",
            borderBottom: "1px solid rgba(245,237,225,0.28)"
          }}>
            {points.map((p, i) => (
              <Box key={p} sx={{
                p: { xs: 3, md: 3.5 },
                borderRight: { md: i < points.length - 1 ? "1px solid rgba(245,237,225,0.18)" : "none" },
                borderBottom: { xs: i < points.length - 1 ? "1px solid rgba(245,237,225,0.18)" : "none", md: "none" }
              }}>
                <Box sx={{ fontSize: 15, lineHeight: 1.5, color: "rgba(245,237,225,0.92)" }}>
                  {t(`landing.${p}`)}
                </Box>
              </Box>
            ))}
          </Box>
        </EdReveal>

        <EdReveal delay={340}>
          <Box sx={{ mt: { xs: 5, md: 6 }, display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
            <RouterLink
              to="/register"
              className="ink-button"
              style={{
                fontSize: 16,
                padding: "18px 36px",
                backgroundColor: "var(--gold)",
                color: "var(--ink)",
                borderColor: "var(--gold)"
              }}
            >
              <span>{t("landing.forAgencies.cta")}</span>
              <ArrowOutwardIcon sx={{ fontSize: 20 }} />
            </RouterLink>
          </Box>
        </EdReveal>
      </Container>
    </Box>
  );
}

/* =============================================================
   07 — PULL QUOTE
   ============================================================= */
function PullQuote() {
  const { t } = useTranslation();
  return (
    <Box sx={{ py: { xs: 10, md: 18 }, borderBottom: "1px solid var(--rule)" }}>
      <Container maxWidth="md">
        <EdReveal>
          <Box className="pull-quote" sx={{ textAlign: "left", maxWidth: 760 }}>
            {t("landing.pullQuote.text")}
          </Box>
        </EdReveal>
      </Container>
    </Box>
  );
}

/* =============================================================
   08 — FOR AGENTS, mirrored asymmetric
   ============================================================= */
function ForAgents() {
  const { t } = useTranslation();
  const licenses = [
    "landing.forAgents.licenses.agent",
    "landing.forAgents.licenses.coordinator",
    "landing.forAgents.licenses.consultant",
    "landing.forAgents.licenses.broker"
  ];
  return (
    <Box id="for-agents" sx={{
      position: "relative",
      py: { xs: 8, md: 12 },
      borderBottom: "1px solid rgba(245,237,225,0.18)",
      backgroundImage:
        `linear-gradient(180deg, rgba(6,20,38,0.96) 0%, rgba(6,20,38,0.88) 50%, rgba(6,20,38,0.96) 100%),` +
        `linear-gradient(270deg, rgba(6,20,38,0.8) 0%, rgba(6,20,38,0.2) 70%),` +
        `url(${FOR_AGENTS_IMAGE})`,
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
          gridTemplateColumns: { xs: "1fr", md: "6fr 6fr" },
          gap: { xs: 4, md: 8 },
          alignItems: "end",
          mb: { xs: 5, md: 7 }
        }}>
          <EdReveal delay={100}>
            <Box className="display" sx={{
              fontSize: { xs: 36, md: 60 },
              lineHeight: 1.02,
              color: "var(--paper)"
            }}>
              {t("landing.forAgents.title")}
            </Box>
          </EdReveal>

          <EdReveal delay={200}>
            <Box sx={{
              fontSize: { xs: 17, md: 19 },
              lineHeight: 1.6,
              color: "rgba(245,237,225,0.88)",
              maxWidth: 620
            }}>
              {t("landing.forAgents.lead")}
            </Box>
          </EdReveal>
        </Box>

        <EdReveal delay={260}>
          <Box className="eyebrow" sx={{ color: "rgba(245,237,225,0.7)", mb: 2 }}>
            {t("landing.forAgents.licensesTitle")}
          </Box>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
            borderTop: "1px solid rgba(245,237,225,0.28)",
            borderBottom: "1px solid rgba(245,237,225,0.28)"
          }}>
            {licenses.map((lk, i) => (
              <Box key={lk} sx={{
                p: { xs: 3, md: 3.5 },
                borderRight: { md: i < licenses.length - 1 ? "1px solid rgba(245,237,225,0.18)" : "none" },
                borderBottom: { xs: i < licenses.length - 1 ? "1px solid rgba(245,237,225,0.18)" : "none", md: "none" },
                display: "flex",
                flexDirection: "column",
                gap: 1.25
              }}>
                <Box sx={{
                  fontFamily: "var(--display)",
                  fontStyle: "italic",
                  fontSize: { xs: 18, md: 20 },
                  lineHeight: 1.25,
                  color: "var(--paper)"
                }}>
                  {t(lk)}
                </Box>
              </Box>
            ))}
          </Box>
        </EdReveal>

        <EdReveal delay={340}>
          <Box sx={{ mt: { xs: 5, md: 6 }, display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
            <RouterLink
              to="/register"
              className="ink-button"
              style={{
                fontSize: 16,
                padding: "18px 36px",
                backgroundColor: "var(--gold)",
                color: "var(--ink)",
                borderColor: "var(--gold)"
              }}
            >
              <span>{t("landing.forAgents.cta")}</span>
              <ArrowOutwardIcon sx={{ fontSize: 20 }} />
            </RouterLink>
          </Box>
        </EdReveal>
      </Container>
    </Box>
  );
}

/* =============================================================
   09 — FAQ TEASER
   ============================================================= */
function FaqTeaser() {
  const { t } = useTranslation();
  const items = ["q1", "q2", "q3"];
  const [open, setOpen] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          let i = 0;
          const id = setInterval(() => {
            i++;
            if (i >= items.length) { clearInterval(id); return; }
            setOpen(i);
          }, 2200);
          obs.disconnect();
        }
      }, { threshold: 0.2 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [items.length]);

  const icons = [HelpOutlineRoundedIcon, QuestionAnswerRoundedIcon, LightbulbOutlinedIcon];

  return (
    <Box id="faq" sx={{ py: { xs: 10, md: 18 }, borderBottom: "1px solid var(--rule)", bgcolor: "var(--paper-deep)" }} ref={rootRef}>
      <Container maxWidth="lg">
        <EdReveal>
          <Box sx={{ mb: 7 }}>
            <Box className="display" sx={{ fontSize: { xs: 44, md: 72 }, color: "var(--ink)" }}>
              {t("landing.faq.title")}
            </Box>
          </Box>
        </EdReveal>

        <Box sx={{ borderTop: "1px solid var(--ink)", mb: 6 }}>
          {items.map((q, i) => {
            const active = open === i;
            const Icon = icons[i % icons.length];
            return (
              <EdReveal key={q} delay={i * 100}>
                <Box
                  onClick={() => setOpen(i)}
                  sx={{
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: { xs: "72px 1fr", md: "120px 1fr" },
                    gap: { xs: 3, md: 5 },
                    alignItems: "start",
                    py: { xs: 4, md: 6 },
                    borderBottom: "1px solid var(--rule)",
                    transition: "background 500ms var(--ease-editorial)",
                    bgcolor: active ? "var(--bone)" : "transparent",
                    "&:hover": { bgcolor: "var(--bone)" }
                  }}>
                  <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: active ? "var(--gold)" : "var(--ink-muted)",
                    transition: "color 600ms var(--ease-editorial), transform 600ms var(--ease-editorial)",
                    transform: active ? "scale(1.08)" : "scale(1)",
                    "& svg": {
                      fontSize: { xs: 56, md: 96 },
                      animation: active ? "faqFloat 3.4s ease-in-out infinite" : "none",
                      filter: active ? "drop-shadow(0 6px 24px rgba(214,168,80,0.35))" : "none"
                    },
                    "@keyframes faqFloat": {
                      "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
                      "50%": { transform: "translateY(-8px) rotate(-3deg)" }
                    }
                  }}>
                    <Icon />
                  </Box>
                  <Box>
                    <Box className="display" sx={{
                      fontSize: { xs: 28, md: 44 },
                      color: "var(--ink)",
                      lineHeight: 1.1,
                      mb: active ? 3 : 0,
                      transition: "margin 500ms var(--ease-editorial)"
                    }}>
                      {t(`landing.faq.${q}.q`)}
                    </Box>
                    <Box sx={{
                      maxHeight: active ? 320 : 0,
                      opacity: active ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 600ms var(--ease-editorial), opacity 600ms var(--ease-editorial)",
                      color: "var(--ink-soft)",
                      lineHeight: 1.7,
                      fontSize: { xs: 17, md: 20 },
                      maxWidth: 820
                    }}>
                      {t(`landing.faq.${q}.a`)}
                    </Box>
                  </Box>
                </Box>
              </EdReveal>
            );
          })}
        </Box>

        <EdReveal delay={250}>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <RouterLink to="/faq" className="ink-button">
              <span>{t("landing.faq.cta")}</span>
              <ArrowForwardIcon sx={{ fontSize: 18 }} />
            </RouterLink>
          </Box>
        </EdReveal>
      </Container>
    </Box>
  );
}

