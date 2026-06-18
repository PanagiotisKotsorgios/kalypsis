import { useState } from "react";
import { Box, Container, InputAdornment, Stack, TextField } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SearchIcon from "@mui/icons-material/Search";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";

const CATEGORIES = ["platform", "pricing", "data", "security", "billing", "integrations", "support"] as const;
type Category = typeof CATEGORIES[number];
interface FaqItem { id: string; category: Category; q: string; a: string }

export function FaqPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const [expanded, setExpanded] = useState<string | false>(false);

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
      {/* Editorial hero */}
      <Box className="editorial-grain" sx={{
        py: { xs: 10, md: 16 },
        borderBottom: "1px solid var(--rule)"
      }}>
        <Container maxWidth="lg">
          <EdReveal>
            <Stack direction="row" alignItems="baseline" spacing={2} mb={{ xs: 4, md: 6 }}>
              <span className="number-marker">№ 01</span>
              <Box sx={{ flex: 1, height: "1px", bgcolor: "var(--rule)" }} />
              <span className="eyebrow">{t("faq.eyebrow")}</span>
            </Stack>
          </EdReveal>

          <EdReveal delay={120}>
            <Box className="display" sx={{
              fontSize: { xs: 48, md: 110 },
              maxWidth: 1100, color: "var(--ink)", mb: 5
            }}>
              {t("faq.editorial.titleA")}{" "}
              <span className="display-italic" style={{ color: "var(--terracotta)" }}>
                {t("faq.editorial.titleB")}
              </span>.
            </Box>
          </EdReveal>

          <EdReveal delay={200}>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1.4fr" },
              gap: { xs: 4, md: 8 }
            }}>
              <Box className="marginalia" sx={{ borderTop: "1px solid var(--ink)", pt: 2 }}>
                <span className="eyebrow" style={{ color: "var(--ink)" }}>
                  {t("faq.editorial.lede")}
                </span>
                <Box sx={{ mt: 2 }}>{t("faq.lead")}</Box>
              </Box>

              <TextField
                fullWidth
                placeholder={t("faq.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "var(--bone)",
                    fontFamily: "var(--sans)",
                    fontSize: 17,
                    borderRadius: 0,
                    "& fieldset": { border: "1px solid var(--ink)" },
                    "&:hover fieldset": { border: "1px solid var(--ink)" },
                    "&.Mui-focused fieldset": { border: "1px solid var(--ink)" }
                  },
                  "& .MuiOutlinedInput-input": { padding: "20px 16px" }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ pl: 1 }}>
                      <SearchIcon sx={{ color: "var(--ink)" }} />
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          </EdReveal>
        </Container>
      </Box>

      {/* Categories + list */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: "1px solid var(--rule)" }}>
        <Container maxWidth="lg">
          <EdReveal>
            <Box className="number-marker" sx={{ mb: 2 }}>
              № 02 — {filtered.length} / {items.length}
            </Box>
            <Stack direction="row" spacing={0} flexWrap="wrap" gap={0} sx={{
              borderTop: "1px solid var(--ink)",
              borderBottom: "1px solid var(--ink)",
              mb: 6
            }}>
              <CategoryPill
                label={t("faq.all")}
                count={items.length}
                active={activeCat === "all"}
                onClick={() => setActiveCat("all")}
              />
              {CATEGORIES.map((c) => (
                <CategoryPill
                  key={c}
                  label={t(`faq.cat.${c}`)}
                  count={items.filter((i) => i.category === c).length}
                  active={activeCat === c}
                  onClick={() => setActiveCat(c)}
                />
              ))}
            </Stack>
          </EdReveal>

          {filtered.length === 0 ? (
            <EdReveal>
              <Box sx={{
                py: 8, textAlign: "center",
                color: "var(--ink-muted)",
                fontFamily: "var(--display)",
                fontStyle: "italic",
                fontSize: 22
              }}>
                {t("faq.noResults")}
              </Box>
            </EdReveal>
          ) : (
            <Box sx={{ borderTop: "1px solid var(--ink)" }}>
              {filtered.map((it, idx) => {
                const open = expanded === it.id;
                return (
                  <EdReveal key={it.id} delay={Math.min(idx, 8) * 60}>
                    <Box
                      onClick={() => setExpanded(open ? false : it.id)}
                      sx={{
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: { xs: "44px 1fr 28px", md: "60px 1fr 200px 40px" },
                        gap: { xs: 2, md: 4 },
                        py: { xs: 3, md: 4 },
                        borderBottom: "1px solid var(--rule)",
                        transition: "background 480ms var(--ease-editorial)",
                        bgcolor: open ? "var(--bone)" : "transparent",
                        "&:hover": { bgcolor: "var(--bone)" },
                        alignItems: "baseline"
                      }}>
                      <Box className="number-marker">
                        {String(idx + 1).padStart(2, "0")}
                      </Box>
                      <Box>
                        <Box className="display" sx={{
                          fontSize: { xs: 22, md: 30 },
                          color: "var(--ink)",
                          lineHeight: 1.15,
                          mb: open ? 2 : 0,
                          transition: "margin 480ms var(--ease-editorial)"
                        }}>
                          {it.q}
                        </Box>
                        <Box sx={{
                          maxHeight: open ? 600 : 0,
                          opacity: open ? 1 : 0,
                          overflow: "hidden",
                          transition: "max-height 700ms var(--ease-editorial), opacity 500ms var(--ease-editorial)",
                          fontSize: 16, lineHeight: 1.75, color: "var(--ink-soft)",
                          maxWidth: 760, whiteSpace: "pre-wrap"
                        }}>
                          {it.a}
                        </Box>
                      </Box>
                      <Box className="eyebrow" sx={{
                        display: { xs: "none", md: "block" },
                        color: open ? "var(--gold)" : "var(--ink-muted)",
                        transition: "color 480ms var(--ease-editorial)"
                      }}>
                        {t(`faq.cat.${it.category}`)}
                      </Box>
                      <Box sx={{
                        fontFamily: "var(--display)",
                        fontStyle: "italic",
                        fontSize: { xs: 22, md: 28 },
                        color: open ? "var(--gold)" : "var(--ink-muted)",
                        textAlign: "right",
                        transition: "color 480ms var(--ease-editorial), transform 480ms var(--ease-editorial)",
                        transform: open ? "rotate(45deg)" : "rotate(0)"
                      }}>
                        +
                      </Box>
                    </Box>
                  </EdReveal>
                );
              })}
            </Box>
          )}
        </Container>
      </Box>

      {/* Bottom CTA */}
      <Box className="editorial-grain" sx={{ py: { xs: 10, md: 16 }, bgcolor: "var(--ink)", color: "var(--paper)" }}>
        <Container maxWidth="md">
          <EdReveal>
            <Box className="number-marker" sx={{ color: "var(--gold)", mb: 3 }}>
              № 03 — {t("faq.notFound.title")}
            </Box>
            <Box className="display" sx={{
              fontSize: { xs: 36, md: 56 },
              color: "var(--paper)", mb: 3, maxWidth: 620
            }}>
              {t("faq.notFound.title")}
            </Box>
            <Box sx={{ fontSize: 18, lineHeight: 1.7, opacity: 0.86, maxWidth: 520, mb: 5 }}>
              {t("faq.notFound.body")}
            </Box>
            <RouterLink to="/contact" className="ghost-button" style={{
              color: "var(--paper)",
              borderColor: "var(--paper)"
            }}>
              <span>{t("faq.notFound.cta")}</span>
              <ArrowOutwardIcon sx={{ fontSize: 18 }} />
            </RouterLink>
          </EdReveal>
        </Container>
      </Box>
    </PublicShell>
  );
}

function CategoryPill({ label, count, active, onClick }:
  { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <Box onClick={onClick} sx={{
      cursor: "pointer",
      px: { xs: 2, md: 3 },
      py: { xs: 2, md: 2.5 },
      borderRight: "1px solid var(--rule)",
      "&:last-of-type": { borderRight: "none" },
      fontFamily: "var(--display)",
      fontStyle: active ? "italic" : "normal",
      fontSize: 15,
      color: active ? "var(--ink)" : "var(--ink-muted)",
      transition: "color 380ms var(--ease-editorial)",
      "&:hover": { color: "var(--ink)" }
    }}>
      {label}{" "}
      <span style={{
        fontSize: 11,
        verticalAlign: "super",
        marginLeft: 4,
        color: active ? "var(--gold)" : "var(--ink-muted)"
      }}>
        ({count})
      </span>
    </Box>
  );
}
