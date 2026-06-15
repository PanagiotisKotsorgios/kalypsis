import { Box, Container, List, ListItemButton, ListItemText, Stack, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import { PublicShell } from "../components/PublicShell";

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
}

export function LegalShell({ eyebrow, title, lastUpdated, sections, intro }: LegalShellProps) {
  const theme = useTheme();
  return (
    <PublicShell>
      {/* Hero strip */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          color: "common.white",
          py: { xs: 10, md: 14 },
          pt: { xs: 16, md: 18 }
        }}
      >
        <Container maxWidth="md">
          <Stack spacing={2}>
            <Typography variant="overline" sx={{ letterSpacing: 2.5, opacity: 0.8 }}>
              {eyebrow}
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1 }}>
              {title}
            </Typography>
            <Typography sx={{ opacity: 0.78, fontSize: 14 }}>{lastUpdated}</Typography>
          </Stack>
        </Container>
      </Box>

      {/* Body */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr" }
          }}
        >
          {/* TOC */}
          <Box>
            <Box
              sx={{
                position: { md: "sticky" },
                top: 100,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 1
              }}
            >
              <List dense>
                {sections.map((s, idx) => (
                  <ListItemButton
                    key={s.id}
                    component="a"
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    sx={{ borderRadius: 1.5 }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              bgcolor: "primary.main",
                              color: "common.white",
                              fontSize: 11,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700
                            }}
                          >
                            {idx + 1}
                          </Box>
                          <Box sx={{ fontSize: 14, fontWeight: 500 }}>{s.heading}</Box>
                        </Stack>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          </Box>

          {/* Content */}
          <Stack spacing={5}>
            {intro && (
              <Box sx={{ fontSize: 17, lineHeight: 1.8, color: "text.primary" }}>{intro}</Box>
            )}
            {sections.map((s, idx) => (
              <Box key={s.id} id={s.id} sx={{ scrollMarginTop: 100 }}>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      color: "common.white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                  >
                    {idx + 1}
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {s.heading}
                  </Typography>
                </Stack>
                <Box sx={{ pl: { md: 7 }, color: "text.secondary", lineHeight: 1.8, fontSize: 16 }}>
                  {s.body}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Container>
    </PublicShell>
  );
}
