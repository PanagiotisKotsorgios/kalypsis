import { Box, Container, Stack } from "@mui/material";
import type { ReactNode } from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface LegalShellProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  intro?: ReactNode;
  heroImage?: string;
}

const DEFAULT_LEGAL_HERO =
  "https://img.freepik.com/premium-photo/business-people-shaking-hands-signing-agreement_46870-13714.jpg";

export function LegalShell({ title, lastUpdated, sections, intro, heroImage }: LegalShellProps) {
  const img = heroImage ?? DEFAULT_LEGAL_HERO;
  return (
    <PublicShell>
      {/* Hero — same dark full-bleed treatment as the rest of the pre-login pages */}
      <Box sx={{
        position: "relative",
        py: { xs: 8, md: 12 },
        borderBottom: "1px solid rgba(245,237,225,0.18)",
        backgroundImage:
          `linear-gradient(180deg, rgba(6,20,38,0.96) 0%, rgba(6,20,38,0.88) 50%, rgba(6,20,38,0.96) 100%),` +
          `linear-gradient(90deg, rgba(6,20,38,0.8) 0%, rgba(6,20,38,0.2) 70%),` +
          `url(${img})`,
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
                {title}
              </Box>
            </EdReveal>

            <EdReveal delay={200}>
              <Box sx={{
                fontFamily: "var(--mono)",
                fontSize: { xs: 14, md: 15 },
                letterSpacing: "0.08em",
                color: "rgba(245,237,225,0.7)"
              }}>
                {lastUpdated}
              </Box>
            </EdReveal>
          </Box>
        </Container>
      </Box>

      {/* Body */}
      <Container maxWidth="xl" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{
          display: "grid",
          gap: { xs: 6, md: 10 },
          gridTemplateColumns: { xs: "1fr", md: "340px 1fr" }
        }}>
          {/* TOC — no numbers, just icons */}
          <Box>
            <Box sx={{ position: { md: "sticky" }, top: 100 }}>
              <Box sx={{
                fontFamily: "var(--display)",
                fontSize: { xs: 24, md: 28 },
                fontWeight: 600,
                color: "var(--ink)",
                mb: 3,
                letterSpacing: "-0.01em"
              }}>
                Περιεχόμενα
              </Box>
              <Stack spacing={0} sx={{ borderTop: "1.5px solid var(--ink)" }}>
                {sections.map((s) => (
                  <Box
                    key={s.id}
                    component="a"
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr 18px",
                      gap: 2,
                      alignItems: "center",
                      py: 2.5,
                      borderBottom: "1px solid var(--rule)",
                      textDecoration: "none",
                      color: "var(--ink)",
                      cursor: "pointer",
                      transition: "background 220ms ease, color 220ms ease",
                      "&:hover": {
                        bgcolor: "var(--bone)",
                        color: "var(--gold)",
                        "& .toc-arrow": { transform: "translateX(4px)", color: "var(--gold)" },
                        "& .toc-check": { color: "var(--gold)" }
                      }
                    }}
                  >
                    <CheckCircleOutlineIcon
                      className="toc-check"
                      sx={{ fontSize: 28, color: "var(--ink-soft)", transition: "color 220ms ease" }}
                    />
                    <Box sx={{
                      fontFamily: "var(--display)",
                      fontStyle: "italic",
                      fontSize: { xs: 17, md: 18 },
                      lineHeight: 1.3
                    }}>
                      {s.heading}
                    </Box>
                    <ArrowForwardIosIcon
                      className="toc-arrow"
                      sx={{
                        fontSize: 14,
                        color: "var(--ink-muted)",
                        transition: "transform 220ms ease, color 220ms ease"
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>

          {/* Content */}
          <Box>
            {intro && (
              <EdReveal>
                <Box sx={{
                  fontSize: { xs: 19, md: 22 },
                  lineHeight: 1.65,
                  color: "var(--ink)",
                  fontFamily: "var(--display)",
                  fontStyle: "italic",
                  mb: { xs: 6, md: 8 },
                  pb: { xs: 6, md: 8 },
                  borderBottom: "1.5px solid var(--ink)",
                  maxWidth: 880
                }}>
                  {intro}
                </Box>
              </EdReveal>
            )}

            <Stack spacing={{ xs: 7, md: 10 }}>
              {sections.map((s) => (
                <EdReveal key={s.id}>
                  <Box id={s.id} sx={{ scrollMarginTop: 100 }}>
                    <Stack direction="row" spacing={3} alignItems="center" mb={3.5}>
                      <Box sx={{
                        flexShrink: 0,
                        width: { xs: 52, md: 64 },
                        height: { xs: 52, md: 64 },
                        border: "1.5px solid var(--gold)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "var(--bone)"
                      }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: { xs: 32, md: 40 }, color: "var(--gold)" }} />
                      </Box>
                      <Box className="display" sx={{
                        fontSize: { xs: 28, md: 44 },
                        color: "var(--ink)",
                        lineHeight: 1.1
                      }}>
                        {s.heading}
                      </Box>
                    </Stack>
                    <Box sx={{
                      color: "var(--ink-soft)",
                      lineHeight: 1.85,
                      fontSize: { xs: 17, md: 19 },
                      maxWidth: 880,
                      "& p": { mb: 2.5 },
                      "& p:last-child": { mb: 0 },
                      "& ul": { pl: 3, mb: 2.5 },
                      "& li": { mb: 1.2 },
                      "& a": {
                        color: "var(--ink)",
                        textDecoration: "underline",
                        textDecorationColor: "var(--gold)",
                        textDecorationThickness: "1.5px",
                        textUnderlineOffset: "3px",
                        "&:hover": { color: "var(--gold)" }
                      },
                      "& strong": { color: "var(--ink)", fontWeight: 700 }
                    }}>
                      {s.body}
                    </Box>
                  </Box>
                </EdReveal>
              ))}
            </Stack>
          </Box>
        </Box>
      </Container>
    </PublicShell>
  );
}
