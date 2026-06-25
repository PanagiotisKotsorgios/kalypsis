import { Box, Container, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { Link as RouterLink } from "react-router-dom";
import { PublicFooter } from "../components/PublicFooter";
import { AccessibilityWidget } from "../components/AccessibilityWidget";
import { PageEnter } from "../components/PageEnter";
import { LanguageToggle } from "../components/LanguageToggle";

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
  /** Kept for API compatibility — ignored by the restrained shell. */
  heroImage?: string;
}

// Mirrors LandingPage palette so the legal pages are visually continuous.
const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";
const RULE = "#e5e9ef";
const SURFACE = "#fafbfc";

/**
 * Quiet, white shell for Terms / Privacy / Cookies. Restrained enterprise
 * SaaS look — navy body text, hairline rules, one accent colour, no editorial
 * grain or display serifs. Matches the redesigned landing page.
 */
export function LegalShell({ eyebrow, title, lastUpdated, sections, intro }: LegalShellProps) {
  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#ffffff",
      color: NAVY,
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex", flexDirection: "column"
    }}>
      <Container maxWidth="lg" sx={{ flex: 1, px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
        <PageEnter stagger={500}>
        {/* Header — wordmark on the left, "Back" link on the right */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={{ xs: 4, md: 6 }}>
          <Box component={RouterLink} to="/"
            sx={{
              display: "flex", alignItems: "center", gap: 1.25,
              textDecoration: "none", color: NAVY
            }}>
            <Box component="img" src="/kalypsis-logo.jpg" alt="Kalypsis"
              sx={{ height: 36, mixBlendMode: "multiply" }} />
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box component={RouterLink} to="/"
              sx={{
                fontSize: 14, color: NAVY_SOFT, textDecoration: "none",
                "&:hover": { color: ACCENT, textDecoration: "underline" }
              }}>
              ← Επιστροφή στην αρχική
            </Box>
            <LanguageToggle />
          </Stack>
        </Stack>

        {/* Page header */}
        <Box sx={{ pb: { xs: 4, md: 5 }, borderBottom: `1px solid ${RULE}`, mb: { xs: 4, md: 6 } }}>
          <Typography sx={{
            fontSize: { xs: 12, md: 13 }, letterSpacing: "0.22em",
            textTransform: "uppercase", color: ACCENT, fontWeight: 600, mb: 1.5
          }}>
            {eyebrow}
          </Typography>
          <Typography component="h1" sx={{
            fontSize: { xs: 34, md: 48 }, fontWeight: 700,
            lineHeight: 1.1, letterSpacing: "-0.02em", color: NAVY, mb: 2
          }}>
            {title}
          </Typography>
          <Typography sx={{
            fontSize: 13, color: NAVY_SOFT,
            fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
            letterSpacing: "0.04em"
          }}>
            {lastUpdated}
          </Typography>
        </Box>

        {/* Body grid — sticky TOC + content */}
        <Box sx={{
          display: "grid",
          gap: { xs: 4, md: 6 },
          gridTemplateColumns: { xs: "1fr", md: "260px 1fr" }
        }}>
          {/* Table of contents */}
          <Box>
            <Box sx={{ position: { md: "sticky" }, top: 24 }}>
              <Typography sx={{
                fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
                color: NAVY_SOFT, fontWeight: 600, mb: 1.5
              }}>
                Περιεχόμενα
              </Typography>
              <Stack spacing={0}
                sx={{ borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
                {sections.map((s) => (
                  <Box key={s.id}
                    component="a" href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    sx={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      py: 1.5,
                      borderBottom: `1px solid ${RULE}`, "&:last-of-type": { borderBottom: 0 },
                      textDecoration: "none", color: NAVY, cursor: "pointer",
                      transition: "color 180ms ease",
                      "&:hover": { color: ACCENT,
                        "& .toc-arrow": { transform: "translateX(3px)", color: ACCENT }
                      }
                    }}>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.35 }}>{s.heading}</Typography>
                    <ArrowForwardIosIcon className="toc-arrow"
                      sx={{ fontSize: 11, color: NAVY_SOFT, transition: "transform 180ms ease, color 180ms ease" }} />
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>

          {/* Content */}
          <Box>
            {intro && (
              <Box sx={{
                fontSize: { xs: 16, md: 18 }, lineHeight: 1.7, color: NAVY_SOFT,
                pb: { xs: 4, md: 5 }, mb: { xs: 4, md: 5 },
                borderBottom: `1px solid ${RULE}`,
                maxWidth: 760
              }}>
                {intro}
              </Box>
            )}

            <Stack spacing={{ xs: 5, md: 7 }}>
              {sections.map((s, idx) => (
                <Box id={s.id} key={s.id} sx={{ scrollMarginTop: 24 }}>
                  <Stack direction="row" spacing={1.5} alignItems="baseline" mb={2}>
                    <Typography sx={{
                      fontSize: 13, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                      color: ACCENT, fontWeight: 600
                    }}>
                      {String(idx + 1).padStart(2, "0")}
                    </Typography>
                    <Typography component="h2" sx={{
                      fontSize: { xs: 22, md: 26 }, fontWeight: 700, lineHeight: 1.25,
                      color: NAVY, letterSpacing: "-0.01em"
                    }}>
                      {s.heading}
                    </Typography>
                  </Stack>
                  <Box sx={{
                    color: NAVY_SOFT, lineHeight: 1.75, fontSize: { xs: 15, md: 16 },
                    maxWidth: 760,
                    "& p": { mb: 2 },
                    "& p:last-child": { mb: 0 },
                    "& ul, & ol": { pl: 3, mb: 2 },
                    "& li": { mb: 0.75 },
                    "& a": {
                      color: ACCENT, textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      "&:hover": { color: NAVY }
                    },
                    "& strong": { color: NAVY, fontWeight: 700 },
                    "& code": {
                      bgcolor: SURFACE, border: `1px solid ${RULE}`,
                      px: 0.75, py: 0.15, borderRadius: 0.75,
                      fontSize: "0.9em",
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace'
                    }
                  }}>
                    {s.body}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
        </PageEnter>
      </Container>

      <PublicFooter />
      <AccessibilityWidget />
    </Box>
  );
}
