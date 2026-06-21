import { useState } from "react";
import { Box, Container, InputAdornment, Stack, TextField } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SearchIcon from "@mui/icons-material/Search";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { PublicShell } from "../components/PublicShell";
import { EdReveal } from "../components/EdReveal";

const FAQ_HERO =
  "https://img.freepik.com/premium-photo/young-business-woman-working-laptop-office_466689-77321.jpg";

const CATEGORIES = ["platform", "pricing", "data", "security", "billing", "integrations", "support"] as const;
type Category = typeof CATEGORIES[number];
interface FaqItem { id: string; category: Category; q: string; a: string }

const FAQ_ICONS = [HelpOutlineRoundedIcon, QuestionAnswerRoundedIcon, LightbulbOutlinedIcon];

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
      {/* Hero — dark full-bleed bg, matches the other pre-login pages */}
      <Box sx={{
        position: "relative",
        py: { xs: 8, md: 12 },
        borderBottom: "1px solid rgba(245,237,225,0.18)",
        backgroundImage:
          `linear-gradient(180deg, rgba(6,20,38,0.96) 0%, rgba(6,20,38,0.88) 50%, rgba(6,20,38,0.96) 100%),` +
          `linear-gradient(90deg, rgba(6,20,38,0.8) 0%, rgba(6,20,38,0.2) 70%),` +
          `url(${FAQ_HERO})`,
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
            alignItems: "end",
            mb: { xs: 5, md: 6 }
          }}>
            <EdReveal delay={100}>
              <Box className="display" sx={{
                fontSize: { xs: 44, md: 84 },
                lineHeight: 1.02,
                color: "var(--paper)"
              }}>
                {t("faq.editorial.titleA")}{" "}
                <span className="display-italic" style={{ color: "var(--gold)" }}>
                  {t("faq.editorial.titleB")}
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
                {t("faq.lead")}
              </Box>
            </EdReveal>
          </Box>

          <EdReveal delay={300}>
            <TextField
              fullWidth
              placeholder={t("faq.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(255,255,255,0.06)",
                  fontFamily: "var(--sans)",
                  fontSize: 19,
                  color: "var(--paper)",
                  borderRadius: 0,
                  "& fieldset": { border: "1.5px solid rgba(245,237,225,0.4)" },
                  "&:hover fieldset": { border: "1.5px solid var(--gold)" },
                  "&.Mui-focused fieldset": { border: "1.5px solid var(--gold)" }
                },
                "& .MuiOutlinedInput-input": { padding: "22px 16px" },
                "& .MuiOutlinedInput-input::placeholder": { color: "rgba(245,237,225,0.6)", opacity: 1 }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ pl: 1 }}>
                    <SearchIcon sx={{ color: "var(--gold)", fontSize: 32 }} />
                  </InputAdornment>
                )
              }}
            />
          </EdReveal>
        </Container>
      </Box>

      {/* Categories + list */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: "1px solid var(--rule)" }}>
        <Container maxWidth="lg">
          <EdReveal>
            <Box sx={{
              fontFamily: "var(--mono)",
              fontSize: 14,
              letterSpacing: "0.1em",
              color: "var(--ink-muted)",
              mb: 3
            }}>
              {filtered.length} / {items.length}
            </Box>
            <Stack direction="row" spacing={0} flexWrap="wrap" gap={0} sx={{
              borderTop: "1px solid var(--ink)",
              borderBottom: "1px solid var(--ink)",
              mb: 7
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
                py: 10, textAlign: "center",
                color: "var(--ink-muted)",
                fontFamily: "var(--display)",
                fontStyle: "italic",
                fontSize: 26
              }}>
                {t("faq.noResults")}
              </Box>
            </EdReveal>
          ) : (
            <Box sx={{ borderTop: "1.5px solid var(--ink)" }}>
              {filtered.map((it, idx) => {
                const open = expanded === it.id;
                const Icon = FAQ_ICONS[idx % FAQ_ICONS.length];
                return (
                  <EdReveal key={it.id} delay={Math.min(idx, 8) * 60}>
                    <Box
                      onClick={() => setExpanded(open ? false : it.id)}
                      sx={{
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: { xs: "72px 1fr", md: "120px 1fr 220px" },
                        gap: { xs: 3, md: 5 },
                        alignItems: "start",
                        py: { xs: 4, md: 6 },
                        borderBottom: "1px solid var(--rule)",
                        transition: "background 500ms var(--ease-editorial)",
                        bgcolor: open ? "var(--bone)" : "transparent",
                        "&:hover": { bgcolor: "var(--bone)" }
                      }}>
                      <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: open ? "var(--gold)" : "var(--ink-muted)",
                        transition: "color 600ms var(--ease-editorial), transform 600ms var(--ease-editorial)",
                        transform: open ? "scale(1.08)" : "scale(1)",
                        "& svg": {
                          fontSize: { xs: 56, md: 96 },
                          animation: open ? "faqIconFloat 3.4s ease-in-out infinite" : "none",
                          filter: open ? "drop-shadow(0 6px 24px rgba(214,168,80,0.35))" : "none"
                        },
                        "@keyframes faqIconFloat": {
                          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
                          "50%": { transform: "translateY(-8px) rotate(-3deg)" }
                        }
                      }}>
                        <Icon />
                      </Box>
                      <Box>
                        <Box className="display" sx={{
                          fontSize: { xs: 26, md: 38 },
                          color: "var(--ink)",
                          lineHeight: 1.15,
                          mb: open ? 3 : 0,
                          transition: "margin 500ms var(--ease-editorial)"
                        }}>
                          {it.q}
                        </Box>
                        <Box sx={{
                          maxHeight: open ? 800 : 0,
                          opacity: open ? 1 : 0,
                          overflow: "hidden",
                          transition: "max-height 700ms var(--ease-editorial), opacity 500ms var(--ease-editorial)",
                          fontSize: { xs: 17, md: 19 },
                          lineHeight: 1.75,
                          color: "var(--ink-soft)",
                          maxWidth: 820,
                          whiteSpace: "pre-wrap"
                        }}>
                          {it.a}
                        </Box>
                      </Box>
                      <Box sx={{
                        display: { xs: "none", md: "block" },
                        fontFamily: "var(--display)",
                        fontStyle: "italic",
                        fontSize: 18,
                        color: open ? "var(--gold)" : "var(--ink-muted)",
                        transition: "color 480ms var(--ease-editorial)",
                        textAlign: "right",
                        pt: 1
                      }}>
                        {t(`faq.cat.${it.category}`)}
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
            <Box className="display" sx={{
              fontSize: { xs: 36, md: 64 },
              color: "var(--paper)", mb: 4, maxWidth: 720
            }}>
              {t("faq.notFound.title")}
            </Box>
            <Box sx={{ fontSize: { xs: 17, md: 19 }, lineHeight: 1.7, opacity: 0.86, maxWidth: 620, mb: 5 }}>
              {t("faq.notFound.body")}
            </Box>
            <RouterLink to="/contact" className="ink-button" style={{
              fontSize: 18,
              padding: "20px 36px",
              backgroundColor: "var(--gold)",
              color: "var(--ink)",
              borderColor: "var(--gold)"
            }}>
              <span>{t("faq.notFound.cta")}</span>
              <ArrowOutwardIcon sx={{ fontSize: 22 }} />
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
      px: { xs: 2.5, md: 3.5 },
      py: { xs: 2, md: 2.5 },
      borderRight: "1px solid var(--rule)",
      "&:last-of-type": { borderRight: "none" },
      fontFamily: "var(--display)",
      fontStyle: active ? "italic" : "normal",
      fontSize: { xs: 16, md: 18 },
      color: active ? "var(--ink)" : "var(--ink-muted)",
      transition: "color 380ms var(--ease-editorial)",
      "&:hover": { color: "var(--ink)" }
    }}>
      {label}{" "}
      <span style={{
        fontSize: 12,
        verticalAlign: "super",
        marginLeft: 4,
        color: active ? "var(--gold)" : "var(--ink-muted)"
      }}>
        ({count})
      </span>
    </Box>
  );
}
