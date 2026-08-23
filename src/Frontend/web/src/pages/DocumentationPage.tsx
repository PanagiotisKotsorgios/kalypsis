import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Container, Drawer,
  IconButton, InputAdornment, Link as MuiLink, List, ListItemButton,
  ListItemIcon, ListItemText, Stack, TextField, Typography, useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SearchIcon from "@mui/icons-material/Search";
import PrintIcon from "@mui/icons-material/Print";
import MenuIcon from "@mui/icons-material/Menu";
import LoginIcon from "@mui/icons-material/Login";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import ArticleIcon from "@mui/icons-material/Article";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// ──────────────────────────────────────────────────────────────────────────
// «Οδηγίες Χρήσης» — the public/user-facing documentation reader.
//
// Sections are fetched from /api/documentation/sections and rendered as
// server-authored HTML the PlatformAdmin edits from
// /app/platform/documentation. No hardcoded content ships with the bundle
// any more — everything is CMS-managed. Rich professional sidebar with
// collapsible parents, active-section highlight, live search, and
// print/PDF from the toolbar.
// ──────────────────────────────────────────────────────────────────────────

interface SectionDto {
  id: string;
  slug: string;
  parentSlug: string | null;
  title: string;
  bodyHtml: string;
  keywords: string | null;
  displayOrder: number;
  isPublished: boolean;
}

const SEO_TITLE = "Οδηγίες Χρήσης Kalypsis — Ασφαλιστικό Λογισμικό";
const SEO_DESCRIPTION = "Πλήρης οδηγός χρήσης της πλατφόρμας Kalypsis για ασφαλιστικά γραφεία: πελάτες, συμβόλαια, γέφυρες εταιρειών, λίστες παραγωγής, εκκαθαρίσεις προμηθειών, ζημιές, ραντεβού και ΕΡΜΗΣ κρυπτογραφημένη επικοινωνία.";
const SEO_KEYWORDS = "kalypsis, οδηγίες χρήσης, ασφαλιστικό λογισμικό, λογισμικό ασφαλιστών, ERGO γέφυρα, ATLANTIC, GRAND COVER, πινάκιο παραγωγής, εκκαθάριση προμηθειών, ασφαλιστικό γραφείο, cloud CRM ασφαλιστών";

function matches(s: SectionDto, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.toLowerCase().trim();
  return (
    s.title.toLowerCase().includes(needle)
    || (s.keywords ?? "").toLowerCase().includes(needle)
    || s.bodyHtml.toLowerCase().includes(needle)
  );
}

export function DocumentationPage() {
  const location = useLocation();
  const { user } = useAuth();
  const isPublic = !location.pathname.startsWith("/app");
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const [tocOpen, setTocOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["documentation-sections", "public"],
    queryFn: async () => (await api.get<SectionDto[]>("/documentation/sections")).data,
    staleTime: 5 * 60_000,
  });

  const sections = q.data ?? [];
  const topLevel = useMemo(() =>
    sections.filter(s => !s.parentSlug).sort((a, b) => a.displayOrder - b.displayOrder),
    [sections]);
  const childrenBySlug = useMemo(() => {
    const m = new Map<string, SectionDto[]>();
    for (const s of sections) {
      if (!s.parentSlug) continue;
      const arr = m.get(s.parentSlug) ?? [];
      arr.push(s);
      m.set(s.parentSlug, arr);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.displayOrder - b.displayOrder);
    return m;
  }, [sections]);

  const sectionMatches = (s: SectionDto): boolean => {
    if (matches(s, query)) return true;
    const kids = childrenBySlug.get(s.slug) ?? [];
    return kids.some(k => matches(k, query));
  };
  const visibleTop = useMemo(() => topLevel.filter(sectionMatches), [topLevel, query, childrenBySlug]);

  // SEO meta + document title
  useEffect(() => {
    const prev = document.title;
    document.title = SEO_TITLE;
    const upsert = (attr: string, key: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attr, key); document.head.appendChild(tag); }
      tag.content = content;
    };
    upsert("name", "description", SEO_DESCRIPTION);
    upsert("name", "keywords", SEO_KEYWORDS);
    upsert("property", "og:title", SEO_TITLE);
    upsert("property", "og:description", SEO_DESCRIPTION);
    upsert("property", "og:type", "website");
    upsert("property", "og:locale", "el_GR");
    return () => { document.title = prev; };
  }, []);

  // Auto-expand the parent of any matched search result
  useEffect(() => {
    if (!query.trim()) return;
    const next = new Set(expanded);
    for (const s of topLevel) {
      const kids = childrenBySlug.get(s.slug) ?? [];
      if (kids.some(k => matches(k, query))) next.add(s.slug);
    }
    setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Scrollspy — highlight the currently-in-view section. Reads scroll
  // position from BOTH the content pane (docs-app layout, where the
  // right column scrolls independently) AND the window (public route
  // + print). Whichever fires first wins.
  useEffect(() => {
    const all = sections.map(s => s.slug);
    const compute = (offset = 140) => {
      let current = all[0] ?? "";
      for (const slug of all) {
        const el = document.getElementById(`doc-${slug}`);
        if (!el) continue;
        // For the content-pane scroller we compare against its scrollTop
        // instead of viewport top so headings inside the pane track properly.
        const pane = document.getElementById("kal-doc-content-scroll");
        const top = pane
          ? el.offsetTop - pane.offsetTop - offset
          : el.getBoundingClientRect().top - offset;
        if (top < 0) current = slug; else break;
      }
      setActiveSlug(current);
    };
    const onWindowScroll = () => compute();
    const pane = document.getElementById("kal-doc-content-scroll");
    const onPaneScroll = () => compute();
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    pane?.addEventListener("scroll", onPaneScroll, { passive: true });
    onWindowScroll();
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
      pane?.removeEventListener("scroll", onPaneScroll);
    };
  }, [sections]);

  const scrollTo = (slug: string) => {
    setTocOpen(false);
    const el = document.getElementById(`doc-${slug}`);
    if (!el) return;
    // Prefer the content pane when it exists (docs-app layout with its
    // own independent scroll). Falls back to window scroll for the
    // public hero-fronted route.
    const pane = document.getElementById("kal-doc-content-scroll");
    if (pane) {
      const top = el.offsetTop - pane.offsetTop - 24;
      pane.scrollTo({ top, behavior: "smooth" });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const toggleExpand = (slug: string) => {
    const next = new Set(expanded);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    setExpanded(next);
  };

  const tocList = (
    <List dense sx={{ py: 0 }}>
      {visibleTop.map(s => {
        const kids = (childrenBySlug.get(s.slug) ?? []).filter(k => matches(k, query));
        const hasKids = kids.length > 0;
        const isExpanded = expanded.has(s.slug) || !!query.trim();
        const isActive = activeSlug === s.slug || kids.some(k => k.slug === activeSlug);
        return (
          <Box key={s.id}>
            <ListItemButton
              onClick={() => { scrollTo(s.slug); if (hasKids) toggleExpand(s.slug); }}
              selected={isActive}
              sx={{
                borderRadius: 1.5, mb: 0.25, px: 1.25,
                "&.Mui-selected": {
                  bgcolor: (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.18)" : "#eaf3fc",
                  "&:hover": { bgcolor: (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.24)" : "#e1edf9" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: isActive ? "primary.main" : "text.secondary" }}>
                <ArticleIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText
                primary={s.title}
                primaryTypographyProps={{
                  fontSize: 13.5, fontWeight: isActive ? 700 : 600,
                  color: isActive ? "primary.main" : "text.primary",
                }}
              />
              {hasKids && (isExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />)}
            </ListItemButton>
            <Collapse in={isExpanded} unmountOnExit>
              <Box sx={{ pl: 3, borderLeft: "1.5px solid", borderColor: "divider", ml: 1.5 }}>
                {kids.map(c => (
                  <ListItemButton
                    key={c.id}
                    onClick={() => scrollTo(c.slug)}
                    selected={activeSlug === c.slug}
                    sx={{
                      borderRadius: 1, py: 0.4, px: 1,
                      "&.Mui-selected": {
                        bgcolor: "transparent",
                        "& .MuiListItemText-primary": { color: "primary.main", fontWeight: 700 },
                      },
                    }}
                  >
                    <ListItemText
                      primary={c.title}
                      primaryTypographyProps={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.5 }}
                    />
                  </ListItemButton>
                ))}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </List>
  );

  const canEdit = user?.role === "PlatformAdmin" || user?.role === "PlatformEmployee";

  return (
    <Box sx={{
      "@media print": {
        "& .kal-doc-sidebar, & .kal-doc-toolbar, & .kal-doc-hero": { display: "none !important" },
        "& .kal-doc-content": { p: 0, maxWidth: "none" },
        bgcolor: "#fff", color: "#000",
      },
    }}>
      {isPublic && (
        <Box className="kal-doc-hero" sx={{
          background: "linear-gradient(135deg, #0b2545 0%, #13315c 50%, #1f7bb3 100%)",
          color: "#fff", py: { xs: 6, md: 9 }, px: 3, mb: 3,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <Container maxWidth="lg">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }} justifyContent="space-between">
              <Box>
                <Chip icon={<MenuBookIcon />} label="ΟΔΗΓΟΣ ΧΡΗΣΗΣ" size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.14)", color: "inherit", fontWeight: 700, letterSpacing: "0.08em", mb: 2 }} />
                <Typography component="h1" sx={{ fontSize: { xs: 32, md: 48 }, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  Οδηγίες Χρήσης Kalypsis
                </Typography>
                <Typography sx={{ mt: 2, fontSize: { xs: 15, md: 17.5 }, opacity: 0.92, maxWidth: 780, lineHeight: 1.55 }}>
                  Πλήρες εγχειρίδιο για ασφαλιστικά γραφεία — πελάτες, συμβόλαια, γέφυρες εταιρειών, λίστες παραγωγής, εκκαθαρίσεις προμηθειών και πολλά ακόμα.
                </Typography>
              </Box>
              <Stack direction={{ xs: "row", sm: "column" }} spacing={1} sx={{ flexShrink: 0 }}>
                <Button component={RouterLink} to="/login" variant="contained"
                  startIcon={<LoginIcon />} size="large"
                  sx={{ bgcolor: "#fff", color: "primary.main", fontWeight: 700,
                    boxShadow: "0 12px 28px -12px rgba(0,0,0,0.4)",
                    "&:hover": { bgcolor: "#f0f4fa" } }}>
                  Σύνδεση
                </Button>
                <Button onClick={() => window.print()} variant="outlined" startIcon={<DownloadIcon />} size="large"
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)",
                    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" } }}>
                  Λήψη PDF
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Box>
      )}

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Box className="kal-doc-toolbar" sx={{
          position: "sticky", top: 8, zIndex: 5, mb: 3,
          bgcolor: "background.paper",
          border: "1px solid", borderColor: "divider",
          borderRadius: 2,
          boxShadow: "0 8px 24px -18px rgba(11,37,69,0.28)",
          p: 1.5,
        }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            {isNarrow && (
              <IconButton onClick={() => setTocOpen(true)} size="small">
                <MenuIcon />
              </IconButton>
            )}
            <TextField
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση στον οδηγό…" size="small" fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            {canEdit && !isPublic && (
              <Button component={RouterLink} to="/app/platform/documentation"
                variant="outlined" size="small" startIcon={<EditIcon />}
                sx={{ whiteSpace: "nowrap" }}>
                Επεξεργασία
              </Button>
            )}
            <Button variant="outlined" startIcon={<PrintIcon />} size="small"
              onClick={() => window.print()} sx={{ whiteSpace: "nowrap" }}>
              Εκτύπωση / PDF
            </Button>
          </Stack>
        </Box>

        {q.isLoading && (
          <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress /></Box>
        )}
        {q.isError && (
          <Alert severity="error" sx={{ my: 4 }}>
            Δεν φορτώθηκαν οι οδηγίες. Δοκιμάστε ξανά σε λίγο ή επικοινωνήστε στο info@mykalypsis.gr.
          </Alert>
        )}

        {!q.isLoading && !q.isError && (
          <Box sx={{
            display: "grid",
            gap: { xs: 0, md: 3 },
            gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
            // Fix the whole layout to the viewport height so BOTH columns
            // manage their own scroll — the sidebar TOC never scrolls with
            // the content, only its own overflow when it's taller than the
            // pane. Public route accounts for the hero + toolbar; in-app
            // accounts only for the toolbar since AppLayout owns its header.
            height: {
              xs: "auto",
              md: isPublic ? "calc(100vh - 96px)" : "calc(100vh - 200px)",
            },
            minHeight: 480,
          }}>
            <Box className="kal-doc-sidebar" sx={{
              display: { xs: "none", md: "block" },
              overflowY: "auto",
              pr: 1, pt: 0.5,
              borderRight: { md: "1px solid" }, borderColor: { md: "divider" },
              // subtle scrollbar
              "&::-webkit-scrollbar": { width: 6 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 3 },
              "&::-webkit-scrollbar-thumb:hover": { bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.24)" : "rgba(11,37,69,0.4)" },
            }}>
              <Typography variant="overline" sx={{
                display: "block", mb: 1.25, px: 1.25, pt: 0.5,
                color: "text.secondary", fontWeight: 800, letterSpacing: "0.1em",
              }}>
                Περιεχόμενα
              </Typography>
              {tocList}
            </Box>

            <Drawer open={tocOpen} onClose={() => setTocOpen(false)}>
              <Box sx={{ width: 320, p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 800 }}>Περιεχόμενα</Typography>
                {tocList}
              </Box>
            </Drawer>

            <Box className="kal-doc-content" id="kal-doc-content-scroll" component="article" sx={{
              minWidth: 0,
              overflowY: { xs: "visible", md: "auto" },
              pr: { md: 3 }, pl: { md: 0.5 },
              // subtle scrollbar
              "&::-webkit-scrollbar": { width: 8 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 4 },
              "&::-webkit-scrollbar-thumb:hover": { bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.24)" : "rgba(11,37,69,0.4)" },
              "& h2, & h3": { scrollMarginTop: 24 },
              "& img": { maxWidth: "100%", borderRadius: 2, my: 2,
                boxShadow: "0 10px 28px -14px rgba(11,37,69,0.25)" },
              "& blockquote": {
                borderLeft: "4px solid", borderColor: "success.main",
                bgcolor: (t) => t.palette.mode === "dark" ? "rgba(52,168,83,0.14)" : "#eef8f0",
                p: 2, my: 2, borderRadius: 1.5,
              },
              "& table": { borderCollapse: "collapse", width: "100%", my: 2,
                "& th, & td": {
                  textAlign: "left", p: 1.25,
                  borderBottom: "1px solid", borderColor: "divider",
                  fontSize: 14, verticalAlign: "top",
                },
                "& th": {
                  fontWeight: 700, width: 220,
                  bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#f6f8fb",
                },
              },
              "& ol, & ul": { pl: 3, my: 1.5, "& li": { mb: 0.75, lineHeight: 1.7 } },
              "& p": { lineHeight: 1.75, fontSize: 15.5, my: 1.5 },
              "& a": { color: "primary.main", textDecoration: "underline", textUnderlineOffset: 2 },
            }}>
              {visibleTop.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
                  {query.trim()
                    ? `Καμία ενότητα δεν αντιστοιχεί στην αναζήτηση «${query}».`
                    : "Δεν υπάρχουν διαθέσιμες ενότητες."}
                </Typography>
              ) : visibleTop.map(s => (
                <Section key={s.id} section={s}
                  children={childrenBySlug.get(s.slug) ?? []} query={query} />
              ))}

              {isPublic && !q.isLoading && (
                <Box sx={{
                  mt: 6, pt: 4, borderTop: "1px solid", borderColor: "divider",
                  textAlign: "center", "@media print": { display: "none" },
                }}>
                  <Typography sx={{ mb: 2, color: "text.secondary" }}>
                    Έτοιμοι να ξεκινήσετε; Συνδεθείτε στο Kalypsis και ξεκινήστε τη δουλειά σας.
                  </Typography>
                  <Button component={RouterLink} to="/login" variant="contained" size="large" startIcon={<LoginIcon />}>
                    Σύνδεση στο Kalypsis
                  </Button>
                  <Typography sx={{ mt: 3, fontSize: 13, color: "text.secondary" }}>
                    Δεν έχετε λογαριασμό;{" "}
                    <MuiLink component={RouterLink} to="/register" underline="hover" sx={{ fontWeight: 700 }}>
                      Εγγραφή γραφείου
                    </MuiLink>
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}

function Section({ section, children, query }: { section: SectionDto; children: SectionDto[]; query: string }) {
  const visibleChildren = children.filter(c => matches(c, query));
  return (
    <Box id={`doc-${section.slug}`} sx={{ mb: 5 }}>
      <Typography component="h2" sx={{
        fontSize: { xs: 26, md: 32 }, fontWeight: 800, mb: 2, mt: 4,
        letterSpacing: "-0.02em",
        borderBottom: "2px solid", borderColor: "primary.main", pb: 1.25,
      }}>
        {section.title}
      </Typography>
      <Box dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
      {visibleChildren.map(c => (
        <Box key={c.id} id={`doc-${c.slug}`} sx={{ mt: 4 }}>
          <Typography component="h3" sx={{
            fontSize: { xs: 19, md: 22 }, fontWeight: 700, mb: 1.5, mt: 2,
          }}>
            {c.title}
          </Typography>
          <Box dangerouslySetInnerHTML={{ __html: c.bodyHtml }} />
        </Box>
      ))}
    </Box>
  );
}

export default DocumentationPage;
