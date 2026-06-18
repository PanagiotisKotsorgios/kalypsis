import { useEffect, useRef, useState } from "react";
import { Box, Container, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";
import { api } from "../api/client";

interface PublicStats { agencies: number; producers: number; activePolicies: number; uptime: string }

export function LandingPage() {
  return (
    <PublicShell overlayHero>
      <Hero />
      <TrustMarquee />
      <Manifesto />
      <Features />
      <ForAgencies />
      <Stats />
      <PullQuote />
      <ForAgents />
      <FaqTeaser />
      <FinalCta />
    </PublicShell>
  );
}

/* =============================================================
   01 — HERO
   ============================================================= */
function Hero() {
  const { t } = useTranslation();
  return (
    <Box className="editorial-grain" sx={{
      position: "relative",
      pt: { xs: 10, md: 16 },
      pb: { xs: 10, md: 16 },
      borderBottom: "1px solid var(--rule)"
    }}>
      <Container maxWidth="lg">
        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 56px" },
          gap: { md: 4 },
          alignItems: "start"
        }}>
          <Box>
            <EdReveal>
              <Stack direction="row" alignItems="baseline" spacing={2} mb={{ xs: 4, md: 6 }}>
                <span className="number-marker">№ 01</span>
                <Box sx={{ flex: 1, height: "1px", bgcolor: "var(--rule)" }} />
                <span className="eyebrow">{t("landing.eyebrow")}</span>
              </Stack>
            </EdReveal>

            <EdReveal delay={120}>
              <Box className="display" sx={{
                fontSize: { xs: 56, sm: 80, md: 116, lg: 132 },
                color: "var(--ink)",
                mb: 4,
                maxWidth: 1100
              }}>
                {t("landing.editorial.headlineA")}{" "}
                <span className="display-italic" style={{ color: "var(--terracotta)" }}>
                  {t("landing.editorial.headlineB")}
                </span>{" "}
                {t("landing.editorial.headlineC")}
                <span className="caret" />
              </Box>
            </EdReveal>

            <EdReveal delay={240}>
              <Box sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1.4fr" },
                gap: { xs: 3, md: 6 },
                mt: { xs: 4, md: 8 }
              }}>
                <Box className="marginalia">
                  <Box sx={{ borderTop: "1px solid var(--ink)", pt: 2, mb: 2, color: "var(--ink)" }}>
                    <span className="eyebrow">{t("landing.editorial.byline")}</span>
                  </Box>
                  {t("landing.editorial.byBody")}
                </Box>
                <Box>
                  <p style={{
                    fontSize: 19,
                    lineHeight: 1.65,
                    color: "var(--ink-soft)",
                    marginTop: 0,
                    maxWidth: 560
                  }}>
                    {t("landing.lead")}
                  </p>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 4 }}>
                    <RouterLink to="/register" className="ink-button">
                      <span>{t("landing.ctaPrimary")}</span>
                      <ArrowOutwardIcon sx={{ fontSize: 18 }} />
                    </RouterLink>
                    <RouterLink to="/login" className="ghost-button">
                      <span>{t("landing.ctaSecondary")}</span>
                    </RouterLink>
                  </Stack>
                </Box>
              </Box>
            </EdReveal>
          </Box>

          <Box sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "space-between",
            height: "100%",
            color: "var(--ink-muted)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.16em",
            lineHeight: 2,
            pt: 1
          }}>
            <Box sx={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              ΑΘΗΝΑ &nbsp;·&nbsp; {new Date().getFullYear()} &nbsp;·&nbsp; ΤΕΥΧΟΣ N°01
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* =============================================================
   02 — TRUST MARQUEE
   ============================================================= */
function TrustMarquee() {
  const { t } = useTranslation();
  const carriers = ["INTERAMERICAN", "ΕΘΝΙΚΗ", "EUROLIFE FFH", "ERGO", "ALLIANZ", "NN HELLAS", "GENERALI", "INTERLIFE"];
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
        <EdReveal>
          <Box className="section-band" sx={{ mb: 6 }}>
            <Box><span className="number-marker">№ 02</span></Box>
            <Box>
              <span className="eyebrow">{t("landing.manifesto.eyebrow")}</span>
            </Box>
          </Box>
        </EdReveal>

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
    { key: "policies",     glyph: "I" },
    { key: "renewals",     glyph: "II" },
    { key: "portal",       glyph: "III" },
    { key: "commissions",  glyph: "IV" },
    { key: "mobile",       glyph: "V" },
    { key: "integrations", glyph: "VI" }
  ];
  return (
    <Box id="features" sx={{ py: { xs: 10, md: 18 }, borderBottom: "1px solid var(--rule)" }}>
      <Container maxWidth="lg">
        <EdReveal>
          <Box className="section-band" sx={{ mb: 6 }}>
            <Box><span className="number-marker">№ 03</span></Box>
            <Box>
              <span className="eyebrow">{t("landing.features.eyebrow")}</span>
              <Box className="display" sx={{
                fontSize: { xs: 36, md: 56 },
                mt: 2,
                color: "var(--ink)",
                maxWidth: 880
              }}>
                {t("landing.features.title")}
              </Box>
              <Box sx={{ mt: 3, maxWidth: 640, color: "var(--ink-soft)", fontSize: 17, lineHeight: 1.65 }}>
                {t("landing.features.lead")}
              </Box>
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
                <Box sx={{
                  fontFamily: "var(--display)",
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "var(--gold)",
                  letterSpacing: "0.04em",
                  mb: 4
                }}>
                  {f.glyph}.
                </Box>
                <Box className="display" sx={{
                  fontSize: { xs: 26, md: 30 },
                  color: "var(--ink)",
                  mb: 2,
                  lineHeight: 1.05
                }}>
                  {t(`landing.features.${f.key}.title`)}
                </Box>
                <Box sx={{
                  color: "var(--ink-soft)",
                  fontSize: 15,
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
      py: { xs: 10, md: 18 },
      borderBottom: "1px solid var(--rule)",
      bgcolor: "var(--paper-deep)"
    }}>
      <Container maxWidth="lg">
        <EdReveal>
          <Box className="section-band" sx={{ mb: 6 }}>
            <Box><span className="number-marker">№ 04</span></Box>
            <Box>
              <span className="eyebrow">{t("landing.forAgencies.eyebrow")}</span>
            </Box>
          </Box>
        </EdReveal>

        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" },
          gap: { xs: 4, md: 8 },
          alignItems: "start"
        }}>
          <EdReveal delay={100}>
            <Box className="display" sx={{
              fontSize: { xs: 38, md: 56 },
              color: "var(--ink)",
              position: { md: "sticky" },
              top: 120
            }}>
              <span>{t("landing.editorial.agencyA")}</span>{" "}
              <span className="display-italic" style={{ color: "var(--terracotta)" }}>
                {t("landing.editorial.agencyB")}
              </span>
            </Box>
          </EdReveal>

          <EdReveal delay={200}>
            <Box>
              <Box sx={{ fontSize: 18, lineHeight: 1.75, color: "var(--ink-soft)", mb: 5 }}>
                {t("landing.forAgencies.lead")}
              </Box>

              <Box sx={{ borderTop: "1px solid var(--ink)" }}>
                {points.map((p, i) => (
                  <Box key={p} sx={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr",
                    gap: 3,
                    py: 3,
                    borderBottom: "1px solid var(--rule)",
                    alignItems: "baseline"
                  }}>
                    <Box className="number-marker">{String(i + 1).padStart(2, "0")}</Box>
                    <Box sx={{ fontSize: 17, lineHeight: 1.55, color: "var(--ink)" }}>
                      {t(`landing.${p}`)}
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box sx={{ mt: 5 }}>
                <RouterLink to="/register" className="ink-button">
                  <span>{t("landing.forAgencies.cta")}</span>
                  <ArrowOutwardIcon sx={{ fontSize: 18 }} />
                </RouterLink>
              </Box>
            </Box>
          </EdReveal>
        </Box>
      </Container>
    </Box>
  );
}

/* =============================================================
   06 — STATS, on ink
   ============================================================= */
function Stats() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => (await api.get<PublicStats>("/public/stats")).data,
    staleTime: 5 * 60 * 1000
  });
  const fmt = (n: number | undefined) => n === undefined ? "—" : n.toLocaleString("el-GR");
  const stats = [
    { value: q.data ? `${fmt(q.data.agencies)}+` : "—", labelKey: "landing.stats.agencies" },
    { value: q.data ? fmt(q.data.producers)        : "—", labelKey: "landing.stats.agents" },
    { value: q.data ? fmt(q.data.activePolicies)   : "—", labelKey: "landing.stats.policies" },
    { value: q.data?.uptime ?? "99,98%",                  labelKey: "landing.stats.uptime" }
  ];
  return (
    <Box sx={{
      bgcolor: "var(--ink)",
      color: "var(--paper)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      py: { xs: 8, md: 14 }
    }} className="editorial-grain">
      <Container maxWidth="lg">
        <EdReveal>
          <Box className="section-band" sx={{ mb: 6 }}>
            <Box><span className="number-marker">№ 05</span></Box>
            <Box>
              <span className="eyebrow" style={{ color: "rgba(245,237,225,0.7)" }}>
                {t("landing.stats.eyebrow")}
              </span>
            </Box>
          </Box>
        </EdReveal>

        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          borderTop: "1px solid rgba(245,237,225,0.18)"
        }}>
          {stats.map((s, i) => (
            <EdReveal key={s.labelKey} delay={i * 120}>
              <Box sx={{
                p: { xs: 4, md: 6 },
                borderBottom: "1px solid rgba(245,237,225,0.18)",
                borderRight: { md: i < 3 ? "1px solid rgba(245,237,225,0.18)" : "none" }
              }}>
                <Box className="display" sx={{
                  fontSize: { xs: 56, md: 96 },
                  color: "var(--paper)",
                  lineHeight: 0.95,
                  mb: 2
                }}>
                  {s.value}
                </Box>
                <Box className="eyebrow" sx={{ color: "rgba(245,237,225,0.7)" }}>
                  {t(s.labelKey)}
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
        <EdReveal delay={150}>
          <Box sx={{
            mt: 4, pt: 3, borderTop: "1px solid var(--rule)",
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            color: "var(--ink-soft)"
          }}>
            <Box className="eyebrow">{t("landing.pullQuote.author")}</Box>
            <Box className="marginalia">{t("landing.pullQuote.role")}</Box>
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
      py: { xs: 10, md: 18 },
      borderBottom: "1px solid var(--rule)"
    }}>
      <Container maxWidth="lg">
        <EdReveal>
          <Box className="section-band" sx={{ mb: 6 }}>
            <Box><span className="number-marker">№ 06</span></Box>
            <Box>
              <span className="eyebrow">{t("landing.forAgents.eyebrow")}</span>
            </Box>
          </Box>
        </EdReveal>

        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "7fr 5fr" },
          gap: { xs: 4, md: 8 },
          alignItems: "start"
        }}>
          <EdReveal delay={100}>
            <Box>
              <Box className="display" sx={{ fontSize: { xs: 36, md: 56 }, color: "var(--ink)", mb: 4 }}>
                {t("landing.forAgents.title")}
              </Box>
              <Box sx={{ fontSize: 18, lineHeight: 1.75, color: "var(--ink-soft)", maxWidth: 580, mb: 6 }}>
                {t("landing.forAgents.lead")}
              </Box>

              <Box className="eyebrow" sx={{ mb: 2 }}>
                {t("landing.forAgents.licensesTitle")}
              </Box>
              <Box>
                {licenses.map((lk, i) => (
                  <Box key={lk} sx={{
                    py: 2,
                    pr: 4,
                    borderTop: i === 0 ? "1px solid var(--ink)" : "none",
                    borderBottom: "1px solid var(--ink)",
                    fontFamily: "var(--display)",
                    fontStyle: "italic",
                    fontSize: 20,
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 2
                  }}>
                    <span className="number-marker">{String(i + 1).padStart(2, "0")}</span>
                    {t(lk)}
                  </Box>
                ))}
              </Box>

              <Box sx={{ mt: 6 }}>
                <RouterLink to="/register" className="ink-button">
                  <span>{t("landing.forAgents.cta")}</span>
                  <ArrowOutwardIcon sx={{ fontSize: 18 }} />
                </RouterLink>
              </Box>
            </Box>
          </EdReveal>

          <EdReveal delay={200}>
            <Box className="marginalia" sx={{
              borderLeft: "1px solid var(--rule)",
              pl: 4,
              maxWidth: 380
            }}>
              <Box sx={{ fontSize: 13, color: "var(--ink-muted)", mb: 2, fontFamily: "var(--mono)", letterSpacing: "0.12em" }}>
                — {t("landing.editorial.sideNote")}
              </Box>
              {t("landing.editorial.agentMarginalia")}
            </Box>
          </EdReveal>
        </Box>
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

  return (
    <Box id="faq" sx={{ py: { xs: 10, md: 18 }, borderBottom: "1px solid var(--rule)", bgcolor: "var(--paper-deep)" }} ref={rootRef}>
      <Container maxWidth="lg">
        <EdReveal>
          <Box className="section-band" sx={{ mb: 6 }}>
            <Box><span className="number-marker">№ 07</span></Box>
            <Box>
              <span className="eyebrow">{t("landing.faq.eyebrow")}</span>
              <Box className="display" sx={{ fontSize: { xs: 36, md: 56 }, mt: 2, color: "var(--ink)" }}>
                {t("landing.faq.title")}
              </Box>
            </Box>
          </Box>
        </EdReveal>

        <Box sx={{ borderTop: "1px solid var(--ink)", mb: 5 }}>
          {items.map((q, i) => {
            const active = open === i;
            return (
              <EdReveal key={q} delay={i * 100}>
                <Box
                  onClick={() => setOpen(i)}
                  sx={{
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto",
                    gap: 3,
                    py: { xs: 3, md: 5 },
                    borderBottom: "1px solid var(--rule)",
                    transition: "background 500ms var(--ease-editorial)",
                    bgcolor: active ? "var(--bone)" : "transparent",
                    "&:hover": { bgcolor: "var(--bone)" }
                  }}>
                  <Box className="number-marker">{String(i + 1).padStart(2, "0")}</Box>
                  <Box>
                    <Box className="display" sx={{
                      fontSize: { xs: 24, md: 32 },
                      color: "var(--ink)",
                      lineHeight: 1.1,
                      mb: active ? 2 : 0,
                      transition: "margin 500ms var(--ease-editorial)"
                    }}>
                      {t(`landing.faq.${q}.q`)}
                    </Box>
                    <Box sx={{
                      maxHeight: active ? 220 : 0,
                      opacity: active ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 600ms var(--ease-editorial), opacity 600ms var(--ease-editorial)",
                      color: "var(--ink-soft)",
                      lineHeight: 1.7,
                      fontSize: 16,
                      maxWidth: 720
                    }}>
                      {t(`landing.faq.${q}.a`)}
                    </Box>
                  </Box>
                  <Box sx={{
                    fontFamily: "var(--display)",
                    fontStyle: "italic",
                    fontSize: 18,
                    color: active ? "var(--gold)" : "var(--ink-muted)",
                    transition: "color 500ms var(--ease-editorial)"
                  }}>
                    {active ? "—" : "+"}
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

/* =============================================================
   10 — FINAL CTA — colophon style
   ============================================================= */
function FinalCta() {
  const { t } = useTranslation();
  return (
    <Box sx={{ py: { xs: 12, md: 20 }, position: "relative" }} className="editorial-grain">
      <Container maxWidth="md">
        <EdReveal>
          <Box className="eyebrow" sx={{ mb: 4 }}>
            № 08 — {t("landing.finalCta.eyebrow")}
          </Box>
        </EdReveal>
        <EdReveal delay={100}>
          <Box className="display" sx={{
            fontSize: { xs: 48, md: 88 },
            color: "var(--ink)",
            mb: 4,
            maxWidth: 880
          }}>
            {t("landing.editorial.finalA")}{" "}
            <span className="display-italic" style={{ color: "var(--terracotta)" }}>
              {t("landing.editorial.finalB")}
            </span>
            ?
          </Box>
        </EdReveal>
        <EdReveal delay={200}>
          <Box sx={{ fontSize: 19, lineHeight: 1.7, color: "var(--ink-soft)", maxWidth: 600, mb: 5 }}>
            {t("landing.finalCta.lead")}
          </Box>
        </EdReveal>
        <EdReveal delay={300}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <RouterLink to="/register" className="ink-button">
              <span>{t("landing.finalCta.ctaPrimary")}</span>
              <ArrowOutwardIcon sx={{ fontSize: 18 }} />
            </RouterLink>
            <RouterLink to="/contact" className="ghost-button">
              <span>{t("landing.finalCta.ctaSecondary")}</span>
            </RouterLink>
          </Stack>
        </EdReveal>
      </Container>
    </Box>
  );
}
