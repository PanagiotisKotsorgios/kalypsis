import { Box, Button, Container, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { Link as RouterLink } from "react-router-dom";
import { PublicFooter } from "../components/PublicFooter";
import { AccessibilityWidget } from "../components/AccessibilityWidget";
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
  /** Kept for API compatibility — the minimal shell has no hero. */
  heroImage?: string;
}

/**
 * Minimal legal-document shell — plain black text on white, single column,
 * scroll-through layout. Deliberately un-designed: no TOC sidebar, no serif
 * display font, no gold accents. Reads like a printed statute or a plain
 * PDF, which is what the office actually wants for something they'll
 * archive or send to their DPO.
 */
export function LegalShell({ eyebrow, title, lastUpdated, sections, intro }: LegalShellProps) {
  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#ffffff",
      color: "#000000",
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex", flexDirection: "column"
    }}>
      <Container maxWidth="sm" sx={{ flex: 1, px: { xs: 2.5, md: 3 }, py: { xs: 3, md: 5 } }}>
        {/* Header bar — back link, print, language toggle. Hidden when printing. */}
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          mb={4} data-print="hide">
          <Box component={RouterLink} to="/"
            sx={{ fontSize: 13, color: "#000", textDecoration: "none",
              "&:hover": { textDecoration: "underline" } }}>
            ← Επιστροφή
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button size="small" variant="text"
              onClick={() => window.print()}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: "#000", textTransform: "none", fontWeight: 500, fontSize: 13,
                display: { xs: "none", sm: "inline-flex" } }}>
              Εκτύπωση
            </Button>
            <LanguageToggle />
          </Stack>
        </Stack>

        {/* Title block — single line for the tag/eyebrow, then the title, then
            a small meta line. No card, no boxes, just typography. */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: 11, letterSpacing: "0.15em",
            textTransform: "uppercase", color: "#000", fontWeight: 600, mb: 1 }}>
            {eyebrow}
          </Typography>
          <Typography component="h1" sx={{
            fontSize: { xs: 22, md: 26 }, fontWeight: 700,
            lineHeight: 1.25, color: "#000", mb: 1
          }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#000" }}>
            {lastUpdated} · Έκδοση 1.0
          </Typography>
        </Box>

        {intro && (
          <Box sx={{
            fontSize: 14, lineHeight: 1.65, color: "#000",
            pb: 3, mb: 3,
            borderBottom: "1px solid #000",
            "& p": { m: 0 },
            "& strong": { fontWeight: 700 }
          }}>
            {intro}
          </Box>
        )}

        <Stack spacing={3}>
          {sections.map((s) => (
            <Box id={s.id} key={s.id} sx={{ scrollMarginTop: 16 }}>
              <Typography component="h2" sx={{
                fontSize: 15, fontWeight: 700, lineHeight: 1.35,
                color: "#000", mb: 1
              }}>
                {s.heading}
              </Typography>
              <Box sx={{
                color: "#000", lineHeight: 1.6, fontSize: 13.5,
                "& p": { mb: 1.25 },
                "& p:last-child": { mb: 0 },
                "& ul, & ol": { pl: 2.5, mb: 1.25, mt: 0 },
                "& li": { mb: 0.5 },
                "& a": { color: "#000", textDecoration: "underline",
                  "&:hover": { textDecoration: "none" } },
                "& strong": { color: "#000", fontWeight: 700 },
                "& code": {
                  bgcolor: "#f4f4f4", border: "1px solid #ddd",
                  px: 0.5, py: 0, borderRadius: 0.5,
                  fontSize: "0.9em", fontFamily: 'ui-monospace, monospace'
                }
              }}>
                {s.body}
              </Box>
            </Box>
          ))}
        </Stack>
      </Container>

      <PublicFooter />
      <AccessibilityWidget />

      {/* Print CSS — strips widgets so printing produces a clean document. */}
      <style>{`
        @media print {
          body { background: #ffffff !important; }
          [data-print="hide"], footer, header, aside,
          [role="button"][aria-label*="προσβασιμότητας"] { display: none !important; }
          .MuiContainer-root { max-width: 100% !important; padding: 0 !important; }
          h1, h2, p, li, td, th, a { color: #000 !important; }
          a { text-decoration: underline !important; }
        }
      `}</style>
    </Box>
  );
}
