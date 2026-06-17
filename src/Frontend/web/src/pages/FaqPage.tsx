import { useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, Chip, Container,
  InputAdornment, Stack, TextField, Typography
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ContactSupportIcon from "@mui/icons-material/ContactSupport";
import { PublicShell } from "../components/PublicShell";

const CATEGORIES = [
  "platform", "pricing", "data", "security", "billing", "integrations", "support"
] as const;

type Category = typeof CATEGORIES[number];

interface FaqItem { id: string; category: Category; q: string; a: string }

export function FaqPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const [expanded, setExpanded] = useState<string | false>(false);

  // 26 questions across the platform — pulled from i18n
  const items: FaqItem[] = [
    { id: "f1", category: "platform", q: t("faq.q.f1.q"), a: t("faq.q.f1.a") },
    { id: "f2", category: "platform", q: t("faq.q.f2.q"), a: t("faq.q.f2.a") },
    { id: "f3", category: "platform", q: t("faq.q.f3.q"), a: t("faq.q.f3.a") },
    { id: "f4", category: "platform", q: t("faq.q.f4.q"), a: t("faq.q.f4.a") },

    { id: "p1", category: "pricing", q: t("faq.q.p1.q"), a: t("faq.q.p1.a") },
    { id: "p2", category: "pricing", q: t("faq.q.p2.q"), a: t("faq.q.p2.a") },
    { id: "p3", category: "pricing", q: t("faq.q.p3.q"), a: t("faq.q.p3.a") },
    { id: "p4", category: "pricing", q: t("faq.q.p4.q"), a: t("faq.q.p4.a") },

    { id: "d1", category: "data", q: t("faq.q.d1.q"), a: t("faq.q.d1.a") },
    { id: "d2", category: "data", q: t("faq.q.d2.q"), a: t("faq.q.d2.a") },
    { id: "d3", category: "data", q: t("faq.q.d3.q"), a: t("faq.q.d3.a") },

    { id: "s1", category: "security", q: t("faq.q.s1.q"), a: t("faq.q.s1.a") },
    { id: "s2", category: "security", q: t("faq.q.s2.q"), a: t("faq.q.s2.a") },
    { id: "s3", category: "security", q: t("faq.q.s3.q"), a: t("faq.q.s3.a") },
    { id: "s4", category: "security", q: t("faq.q.s4.q"), a: t("faq.q.s4.a") },

    { id: "b1", category: "billing", q: t("faq.q.b1.q"), a: t("faq.q.b1.a") },
    { id: "b2", category: "billing", q: t("faq.q.b2.q"), a: t("faq.q.b2.a") },
    { id: "b3", category: "billing", q: t("faq.q.b3.q"), a: t("faq.q.b3.a") },

    { id: "i1", category: "integrations", q: t("faq.q.i1.q"), a: t("faq.q.i1.a") },
    { id: "i2", category: "integrations", q: t("faq.q.i2.q"), a: t("faq.q.i2.a") },
    { id: "i3", category: "integrations", q: t("faq.q.i3.q"), a: t("faq.q.i3.a") },
    { id: "i4", category: "integrations", q: t("faq.q.i4.q"), a: t("faq.q.i4.a") },

    { id: "u1", category: "support", q: t("faq.q.u1.q"), a: t("faq.q.u1.a") },
    { id: "u2", category: "support", q: t("faq.q.u2.q"), a: t("faq.q.u2.a") },
    { id: "u3", category: "support", q: t("faq.q.u3.q"), a: t("faq.q.u3.a") },
    { id: "u4", category: "support", q: t("faq.q.u4.q"), a: t("faq.q.u4.a") }
  ];

  const matches = (it: FaqItem) => {
    if (activeCat !== "all" && it.category !== activeCat) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return it.q.toLowerCase().includes(s) || it.a.toLowerCase().includes(s);
  };
  const filtered = items.filter(matches);

  return (
    <PublicShell>
      <Box sx={{ position: "relative", py: { xs: 8, md: 12 }, color: "common.white", overflow: "hidden",
        background: "linear-gradient(135deg, #0b2545 0%, #13315c 50%, #1d4e89 100%)" }}>
        <Container maxWidth="md" sx={{ textAlign: "center", position: "relative" }}>
          <Stack spacing={2.5} alignItems="center">
            <Box sx={{ width: 80, height: 80, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", mb: 1 }}>
              <HelpOutlineIcon sx={{ fontSize: 44, color: "common.white" }} />
            </Box>
            <Typography variant="overline" sx={{ letterSpacing: 2.5, opacity: 0.8 }}>{t("faq.eyebrow")}</Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1, fontSize: { xs: 38, md: 58 } }}>
              {t("faq.title")}
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: 18, maxWidth: 640 }}>{t("faq.lead")}</Typography>
            <TextField
              fullWidth
              placeholder={t("faq.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                mt: 3, maxWidth: 500,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(255,255,255,0.94)", borderRadius: 3,
                  "& fieldset": { border: "none" }
                }
              }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        {/* Category filters */}
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mb={4} justifyContent="center">
          <Chip
            label={`${t("faq.all")} (${items.length})`}
            onClick={() => setActiveCat("all")}
            color={activeCat === "all" ? "primary" : "default"}
            variant={activeCat === "all" ? "filled" : "outlined"}
            sx={{ fontWeight: 600 }}
          />
          {CATEGORIES.map((c) => {
            const count = items.filter((i) => i.category === c).length;
            return (
              <Chip
                key={c}
                label={`${t(`faq.cat.${c}`)} (${count})`}
                onClick={() => setActiveCat(c)}
                color={activeCat === c ? "primary" : "default"}
                variant={activeCat === c ? "filled" : "outlined"}
                sx={{ fontWeight: 600 }}
              />
            );
          })}
        </Stack>

        {filtered.length === 0 ? (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            {t("faq.noResults")}
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {filtered.map((it) => {
              const open = expanded === it.id;
              return (
                <Accordion key={it.id} disableGutters elevation={0}
                  expanded={open}
                  onChange={(_, e) => setExpanded(e ? it.id : false)}
                  sx={{
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: open ? "primary.main" : "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                    "&:before": { display: "none" },
                    transition: "border-color 200ms, box-shadow 200ms",
                    "&:hover": { borderColor: "primary.light", boxShadow: "0 8px 24px rgba(11,37,69,0.08)" },
                    "&.Mui-expanded": { boxShadow: "0 14px 40px rgba(11,37,69,0.12)" }
                  }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <Chip label={t(`faq.cat.${it.category}`)} size="small" variant="outlined" />
                      <Typography sx={{ fontWeight: 700, fontSize: 17, color: open ? "primary.main" : "text.primary" }}>
                        {it.q}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 3, pb: 3 }}>
                    <Typography color="text.secondary" sx={{ lineHeight: 1.75, fontSize: 15.5, whiteSpace: "pre-wrap" }}>
                      {it.a}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        )}

        {/* Bottom CTA */}
        <Card sx={{ mt: 6, p: { xs: 3, md: 5 }, textAlign: "center",
          background: "linear-gradient(135deg, #0b2545 0%, #13315c 100%)", color: "common.white" }}>
          <ContactSupportIcon sx={{ fontSize: 48, mb: 1.5, color: "secondary.main" }} />
          <Typography variant="h5" fontWeight={800} mb={1}>{t("faq.notFound.title")}</Typography>
          <Typography sx={{ opacity: 0.88, mb: 3, maxWidth: 500, mx: "auto" }}>{t("faq.notFound.body")}</Typography>
          <Button
            component={RouterLink}
            to="/contact"
            variant="contained"
            color="secondary"
            size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{ px: 4, py: 1.5, fontWeight: 700 }}
          >
            {t("faq.notFound.cta")}
          </Button>
        </Card>
      </Container>
    </PublicShell>
  );
}
