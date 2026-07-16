import { Box, Button, Container, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
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

// Law-firm portal palette — near-black body, warm brand rule.
// Matches LegalHubPage so the whole legal experience feels like one bound
// dossier rather than a mix of marketing + form pages.
const NAVY = "#0b0f14";              // near-black — body copy + headings
const NAVY_SOFT = "#3a4551";         // muted grey — secondary text
const ACCENT = "#b08a3e";            // brand gold — accents + rules
const RULE = "#e2ded4";              // warm hairline
const SURFACE = "#faf9f5";           // paper — meta card + code

/**
 * Restrained legal-portal shell used by every individual policy page.
 * Reads as a professional legal dossier: near-black text, warm hairline
 * rules, single gold accent, no marketing decoration. Prints cleanly for
 * auditors who need a paper copy.
 */
export function LegalShell({ eyebrow, title, lastUpdated, sections, intro }: LegalShellProps) {
  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#f6f6f4",       // warm off-white — reads as document paper
      color: NAVY,
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex", flexDirection: "column"
    }}>
      <Container maxWidth="lg" sx={{ flex: 1, px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
        <PageEnter stagger={500}>
        {/* Header — wordmark on the left, back/print/language on the right.
            The print button drops out on mobile — the top-nav there is packed. */}
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          mb={{ xs: 4, md: 6 }} data-print="hide">
          <Box component={RouterLink} to="/"
            sx={{
              display: "flex", alignItems: "center", gap: 1.25,
              textDecoration: "none", color: NAVY
            }}>
            <Box component="img" src="/kalypsis-logo.jpg" alt="Kalypsis"
              sx={{ height: 36, mixBlendMode: "multiply" }} />
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              size="small" variant="text"
              onClick={() => window.print()}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                color: NAVY_SOFT, textTransform: "none", fontWeight: 600,
                "&:hover": { color: NAVY, bgcolor: "rgba(11,37,69,0.04)" }
              }}
            >
              Εκτύπωση
            </Button>
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

        {/* Page header — document identifier + title + metadata card that
            reads as a legal certificate rather than a marketing hero. */}
        <Box sx={{ pb: { xs: 4, md: 5 }, borderBottom: `1px solid ${RULE}`, mb: { xs: 4, md: 6 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" mb={1.5}>
            <ShieldOutlinedIcon sx={{ fontSize: 16, color: ACCENT }} />
            <Typography sx={{
              fontSize: { xs: 12, md: 13 }, letterSpacing: "0.22em",
              textTransform: "uppercase", color: ACCENT, fontWeight: 600
            }}>
              {eyebrow}
            </Typography>
          </Stack>
          <Typography component="h1" sx={{
            fontSize: { xs: 34, md: 48 }, fontWeight: 700,
            lineHeight: 1.1, letterSpacing: "-0.02em", color: NAVY, mb: 3,
            fontFamily: 'var(--display, "Playfair Display", "Times New Roman", serif)'
          }}>
            {title}
          </Typography>
          <Box sx={{
            display: "flex", flexWrap: "wrap", gap: { xs: 1.5, md: 4 },
            py: 1.75, px: 2.5,
            border: `1px solid ${RULE}`, borderRadius: 1.5,
            bgcolor: SURFACE
          }}>
            <MetaItem label="Τελευταία ενημέρωση" value={lastUpdated} />
            <MetaItem label="Έκδοση" value={"1.0"} />
          </Box>
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
                      color: NAVY, letterSpacing: "-0.01em",
                      fontFamily: 'var(--display, "Playfair Display", "Times New Roman", serif)'
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

      {/* Print CSS — strips chrome, forces black on white, drops nav + widgets
          so printing/PDF-exporting a legal page produces a clean document a
          lawyer would recognise. */}
      <style>{`
        @media print {
          body { background: #ffffff !important; }
          [data-print="hide"], footer, header, aside,
          [role="button"][aria-label*="προσβασιμότητας"] { display: none !important; }
          .MuiContainer-root { max-width: 100% !important; padding: 0 !important; }
          h1, h2 { color: #000 !important; }
          p, li, td, th { color: #111 !important; }
          a { color: #000 !important; text-decoration: underline !important; }
          [style*="sticky"], [style*="position: sticky"] { position: static !important; }
        }
      `}</style>
    </Box>
  );
}

/** Small metadata cell used inside the legal doc header card. Renders a
 *  compact «Label / value» pair with tight monospace values. */
function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 140 }}>
      <Typography sx={{
        fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
        color: "#3d4f6b", fontWeight: 700, mb: 0.35
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: 13, color: "#0b2545", fontWeight: 600,
        fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
        letterSpacing: "0.02em"
      }}>
        {value}
      </Typography>
    </Box>
  );
}
