import { useEffect, useRef, useState } from "react";
import { Box, Container, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { EdReveal } from "./EdReveal";
import { api } from "../api/client";

// DashboardShowcase — interactive tabs that swap between SVG renderings of the
// Kalypsis dashboards. Designed so a real PNG screenshot can later replace each
// Mockup component without touching the surrounding layout/animation.
//
// If you want to drop in real screenshots later:
//   1. Save them as /public/images/dashboards/<key>.png at ~2400×1500.
//   2. Replace the Mockup components inside DashboardMockup with
//      <Box component="img" src={`/images/dashboards/${variant}.png`} sx={{ width: "100%", display: "block" }} />
//   3. The tab metadata + animation continues to work unchanged.
type TabKey = "customers" | "policies" | "commissions" | "reports" | "quotes";

const TABS: { key: TabKey; labelKey: string; descKey: string }[] = [
  { key: "customers",   labelKey: "landing.showcase.tabs.customers",   descKey: "landing.showcase.descs.customers" },
  { key: "policies",    labelKey: "landing.showcase.tabs.policies",    descKey: "landing.showcase.descs.policies" },
  { key: "quotes",      labelKey: "landing.showcase.tabs.quotes",      descKey: "landing.showcase.descs.quotes" },
  { key: "commissions", labelKey: "landing.showcase.tabs.commissions", descKey: "landing.showcase.descs.commissions" },
  { key: "reports",     labelKey: "landing.showcase.tabs.reports",     descKey: "landing.showcase.descs.reports" }
];

interface ShowcaseImage { key: string; url: string; updatedAt: string; }

export function DashboardShowcase() {
  const { t } = useTranslation();
  const [active, setActive] = useState<TabKey>("customers");
  const [autoPlay, setAutoPlay] = useState(true);
  const [uploaded, setUploaded] = useState<Record<string, ShowcaseImage>>({});
  const hoverRef = useRef(false);

  // Pull any uploaded showcase images so they can override the SVG mockups.
  useEffect(() => {
    let cancelled = false;
    api.get<ShowcaseImage[]>("/public/showcase-images")
      .then((r) => {
        if (cancelled) return;
        const map: Record<string, ShowcaseImage> = {};
        for (const img of r.data) map[img.key] = img;
        setUploaded(map);
      })
      .catch(() => { /* No backend / no images uploaded — fall back to SVGs silently. */ });
    return () => { cancelled = true; };
  }, []);

  // Auto-advance every 6 seconds unless the user is hovering or has clicked
  useEffect(() => {
    if (!autoPlay) return;
    const id = window.setInterval(() => {
      if (hoverRef.current) return;
      setActive((prev) => {
        const idx = TABS.findIndex((t) => t.key === prev);
        return TABS[(idx + 1) % TABS.length].key;
      });
    }, 6000);
    return () => window.clearInterval(id);
  }, [autoPlay]);

  return (
    <Box sx={{ py: { xs: 10, md: 16 }, borderBottom: "1px solid var(--rule)", bgcolor: "var(--paper)" }}>
      <Container maxWidth="xl">
        <EdReveal>
          <Box sx={{ maxWidth: 760, mb: { xs: 5, md: 7 } }}>
            <Box className="number-marker" sx={{ color: "var(--gold)", mb: 1.5 }}>
              — {t("landing.showcase.eyebrow")}
            </Box>
            <Box className="display" sx={{
              fontSize: { xs: 36, md: 56 },
              lineHeight: 1.05,
              color: "var(--ink)",
              letterSpacing: "-0.01em"
            }}>
              {t("landing.showcase.title")}
            </Box>
            <Box sx={{ mt: 2, color: "var(--ink-soft)", fontSize: { xs: 16, md: 18 }, lineHeight: 1.6, maxWidth: 620 }}>
              {t("landing.showcase.lead")}
            </Box>
          </Box>
        </EdReveal>

        {/* Tab bar */}
        <Box
          onMouseEnter={() => { hoverRef.current = true; }}
          onMouseLeave={() => { hoverRef.current = false; }}
          sx={{
            borderTop: "1px solid var(--ink)",
            borderBottom: "1px solid var(--ink)",
            display: "flex",
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" }
          }}
        >
          {TABS.map((tab) => (
            <Box
              key={tab.key}
              onClick={() => { setActive(tab.key); setAutoPlay(false); }}
              sx={{
                flex: 1,
                minWidth: { xs: 140, md: 0 },
                px: { xs: 2, md: 3 },
                py: { xs: 2, md: 2.5 },
                cursor: "pointer",
                position: "relative",
                fontFamily: "var(--sans)",
                fontSize: { xs: 13, md: 14.5 },
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: active === tab.key ? "var(--ink)" : "var(--ink-muted)",
                textAlign: "center",
                whiteSpace: "nowrap",
                borderLeft: "1px solid var(--rule)",
                "&:first-of-type": { borderLeft: "none" },
                transition: "color 280ms var(--ease-editorial)",
                "&:hover": { color: "var(--ink)" },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "var(--gold)",
                  transform: active === tab.key ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: active === tab.key ? "left" : "right",
                  transition: "transform 420ms var(--ease-editorial)"
                }
              }}
            >
              {t(tab.labelKey)}
            </Box>
          ))}
        </Box>

        {/* Mockup viewport */}
        <Box
          onMouseEnter={() => { hoverRef.current = true; }}
          onMouseLeave={() => { hoverRef.current = false; }}
          sx={{
            mt: 5,
            position: "relative",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" },
            gap: { xs: 4, md: 6 },
            alignItems: "start"
          }}
        >
          {/* Left: animated description */}
          <Box sx={{ minHeight: { md: 360 } }}>
            {TABS.map((tab) => (
              <Box
                key={tab.key}
                sx={{
                  display: active === tab.key ? "block" : "none",
                  animation: active === tab.key ? "showcaseFade 600ms var(--ease-editorial) both" : "none",
                  "@keyframes showcaseFade": {
                    "0%":   { opacity: 0, transform: "translateY(12px)" },
                    "100%": { opacity: 1, transform: "translateY(0)" }
                  }
                }}
              >
                <Box className="display" sx={{
                  fontSize: { xs: 28, md: 38 },
                  color: "var(--ink)",
                  lineHeight: 1.1,
                  mb: 2
                }}>
                  {t(tab.labelKey)}
                </Box>
                <Box sx={{
                  color: "var(--ink-soft)",
                  fontSize: { xs: 15, md: 17 },
                  lineHeight: 1.65
                }}>
                  {t(tab.descKey)}
                </Box>

                {/* progress markers — show position in tab cycle */}
                <Stack direction="row" spacing={1} sx={{ mt: 4 }}>
                  {TABS.map((dot) => (
                    <Box
                      key={dot.key}
                      sx={{
                        width: dot.key === active ? 40 : 16,
                        height: 3,
                        bgcolor: dot.key === active ? "var(--gold)" : "var(--rule)",
                        transition: "width 420ms var(--ease-editorial), background 420ms var(--ease-editorial)"
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          {/* Right: animated dashboard frame */}
          <Box sx={{
            position: "relative",
            border: "1px solid var(--ink)",
            boxShadow: "12px 14px 0 var(--rule-soft)",
            bgcolor: "#fbfaf6",
            overflow: "hidden",
            aspectRatio: "16 / 10"
          }}>
            {/* Browser chrome */}
            <Box sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1.2,
              bgcolor: "var(--bone)",
              borderBottom: "1px solid var(--rule)"
            }}>
              {[0,1,2].map((i) => (
                <Box key={i} sx={{
                  width: 9, height: 9, borderRadius: "50%",
                  bgcolor: i === 0 ? "#e07560" : i === 1 ? "#d4a44a" : "#7ea16f",
                  opacity: 0.85
                }} />
              ))}
              <Box sx={{
                ml: 2, fontFamily: "var(--mono)", fontSize: 11.5,
                color: "var(--ink-muted)", letterSpacing: "0.04em"
              }}>
                kalypsis.gr/app/{active === "quotes" ? "quote-builder" : active}
              </Box>
            </Box>

            {/* The mockup itself */}
            <Box sx={{ position: "relative", height: "calc(100% - 38px)" }}>
              {TABS.map((tab) => (
                <Box
                  key={tab.key}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: active === tab.key ? 1 : 0,
                    transform: active === tab.key ? "scale(1)" : "scale(0.98)",
                    transition: "opacity 520ms var(--ease-editorial), transform 520ms var(--ease-editorial)",
                    pointerEvents: active === tab.key ? "auto" : "none"
                  }}
                >
                  {uploaded[tab.key] ? (
                    <Box
                      component="img"
                      src={uploaded[tab.key].url + "?v=" + encodeURIComponent(uploaded[tab.key].updatedAt)}
                      alt={t(tab.labelKey)}
                      sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
                    />
                  ) : (
                    <DashboardMockup variant={tab.key} />
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* =========================================================================
   Brand-styled SVG dashboard mockups. Each variant is a hand-crafted
   composition that matches the actual app's information density and aesthetic.
   ========================================================================= */
function DashboardMockup({ variant }: { variant: TabKey }) {
  switch (variant) {
    case "customers":   return <MockupCustomers />;
    case "policies":    return <MockupPolicies />;
    case "quotes":      return <MockupQuotes />;
    case "commissions": return <MockupCommissions />;
    case "reports":     return <MockupReports />;
  }
}

/* ─── shared atoms ─── */
const INK = "#0b2545";
const INK_SOFT = "#3a5170";
const PAPER = "#f5ede1";
const BONE = "#efe7d8";
const RULE = "#d6c6ab";
const GOLD = "#b08a3e";
const TERRACOTTA = "#a85c40";
const SUCCESS = "#5b8b3e";

function Sidebar({ active }: { active: number }) {
  const items = ["Dashboard", "Customers", "Policies", "Quotes", "Commissions", "Reports"];
  return (
    <g>
      <rect x="0" y="0" width="160" height="600" fill={INK} />
      <text x="22" y="36" fontFamily="serif" fontSize="20" fill={PAPER} fontWeight="600">Kalypsis</text>
      <line x1="22" y1="58" x2="138" y2="58" stroke={GOLD} strokeWidth="1.5" />
      {items.map((label, i) => (
        <g key={label} transform={`translate(0,${100 + i * 44})`}>
          {i === active && <rect x="0" y="-14" width="160" height="36" fill="rgba(176,138,62,0.18)" />}
          {i === active && <rect x="0" y="-14" width="3" height="36" fill={GOLD} />}
          <circle cx="34" cy="4" r="4" fill={i === active ? GOLD : "rgba(245,237,225,0.4)"} />
          <text x="52" y="9" fontFamily="sans-serif" fontSize="13" fill={i === active ? PAPER : "rgba(245,237,225,0.62)"} fontWeight={i === active ? 600 : 400}>{label}</text>
        </g>
      ))}
    </g>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <g>
      <text x="200" y="50" fontFamily="serif" fontSize="28" fill={INK} fontWeight="700">{title}</text>
      <text x="200" y="74" fontFamily="sans-serif" fontSize="13" fill={INK_SOFT}>{sub}</text>
      <line x1="200" y1="98" x2="940" y2="98" stroke={RULE} strokeWidth="1" />
    </g>
  );
}

/* ─── 1. Customers ─── */
function MockupCustomers() {
  const rows = [
    ["Παπαδάκης Ν.", "ΑΦΜ 800123456", "8 συμβ.", "€ 2.840"],
    ["Γεωργίου Α.",  "ΑΦΜ 077845321", "3 συμβ.", "€ 980"],
    ["Σταυρίδου Ε.", "ΑΦΜ 045612789", "5 συμβ.", "€ 1.620"],
    ["Μιχαηλίδης Κ.", "ΑΦΜ 099234001", "12 συμβ.", "€ 4.110"],
    ["Παππά Μ.",     "ΑΦΜ 011544982", "2 συμβ.", "€ 580"],
    ["Ζαφειρίου Δ.", "ΑΦΜ 088340127", "7 συμβ.", "€ 2.205"]
  ];
  return (
    <svg viewBox="0 0 960 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <rect width="960" height="600" fill="#fbfaf6" />
      <Sidebar active={1} />
      <Header title="Πελάτες" sub="248 ενεργοί · 14 νέοι τις τελευταίες 30 ημέρες" />

      {/* search bar */}
      <rect x="200" y="120" width="380" height="38" fill={BONE} stroke={RULE} />
      <text x="216" y="144" fontFamily="sans-serif" fontSize="13" fill={INK_SOFT}>🔍 Αναζήτηση…</text>
      <rect x="600" y="120" width="100" height="38" fill={INK} />
      <text x="650" y="144" fontFamily="sans-serif" fontSize="12" fill={PAPER} textAnchor="middle" fontWeight="600">+ ΝΕΟΣ</text>

      {/* table header */}
      <rect x="200" y="180" width="740" height="34" fill={BONE} />
      <text x="216" y="201" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΟΝΟΜΑ</text>
      <text x="416" y="201" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΑΦΜ</text>
      <text x="616" y="201" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΣΥΜΒΟΛΑΙΑ</text>
      <text x="816" y="201" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΠΑΡΑΓΩΓΗ</text>

      {/* table body */}
      {rows.map((r, i) => (
        <g key={i} transform={`translate(0,${214 + i * 50})`}>
          <rect x="200" y="0" width="740" height="50" fill={i % 2 ? "#f7f1e6" : "transparent"} />
          <line x1="200" y1="50" x2="940" y2="50" stroke={RULE} />
          <circle cx="218" cy="25" r="14" fill={GOLD} opacity="0.18" />
          <text x="218" y="30" fontFamily="sans-serif" fontSize="11" fill={INK} textAnchor="middle" fontWeight="700">{r[0]!.charAt(0)}</text>
          <text x="244" y="22" fontFamily="sans-serif" fontSize="13.5" fill={INK} fontWeight="600">{r[0]}</text>
          <text x="244" y="38" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT}>kalypsis · ενεργός</text>
          <text x="416" y="30" fontFamily="sans-serif" fontSize="12.5" fill={INK_SOFT}>{r[1]}</text>
          <text x="616" y="30" fontFamily="sans-serif" fontSize="12.5" fill={INK}>{r[2]}</text>
          <text x="816" y="30" fontFamily="sans-serif" fontSize="12.5" fill={INK} fontWeight="600">{r[3]}</text>
        </g>
      ))}
    </svg>
  );
}

/* ─── 2. Policies ─── */
function MockupPolicies() {
  const policies = [
    { num: "AUTO-2026-00824", customer: "Παπαδάκης Ν.", carrier: "INTERAMERICAN", premium: "€ 420", status: "Ενεργό", color: SUCCESS },
    { num: "HOME-2026-00417", customer: "Γεωργίου Α.",  carrier: "ETHNIKI",       premium: "€ 280", status: "Σε ανανέωση", color: GOLD },
    { num: "LIFE-2026-00109", customer: "Σταυρίδου Ε.", carrier: "EUROLIFE",      premium: "€ 540", status: "Ενεργό", color: SUCCESS },
    { num: "AUTO-2026-00823", customer: "Μιχαηλίδης Κ.", carrier: "ALLIANZ",      premium: "€ 690", status: "Λήγει σε 12 ημ.", color: TERRACOTTA },
    { num: "HEAL-2026-00302", customer: "Παππά Μ.",     carrier: "NN",            premium: "€ 380", status: "Ενεργό", color: SUCCESS }
  ];
  return (
    <svg viewBox="0 0 960 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <rect width="960" height="600" fill="#fbfaf6" />
      <Sidebar active={2} />
      <Header title="Συμβόλαια" sub="1.482 ενεργά · €482.180 σε ετήσια ασφάλιστρα" />

      {/* KPIs */}
      {[
        { label: "Ενεργά", value: "1.482", trend: "+34" },
        { label: "Σε ανανέωση 30η", value: "87", trend: "−" },
        { label: "Ληγμένα", value: "12", trend: "−4" },
        { label: "Παραγωγή μήνα", value: "€42.180", trend: "+8.4%" }
      ].map((k, i) => (
        <g key={k.label} transform={`translate(${200 + i * 188},120)`}>
          <rect width="170" height="80" fill={BONE} stroke={RULE} />
          <text x="14" y="22" fontFamily="sans-serif" fontSize="10.5" fill={INK_SOFT} letterSpacing="0.06em" fontWeight="600">{k.label.toUpperCase()}</text>
          <text x="14" y="54" fontFamily="serif" fontSize="26" fill={INK} fontWeight="700">{k.value}</text>
          <text x="14" y="72" fontFamily="sans-serif" fontSize="10.5" fill={GOLD} fontStyle="italic">{k.trend}</text>
        </g>
      ))}

      {/* policy list */}
      <rect x="200" y="220" width="740" height="32" fill={BONE} />
      <text x="216" y="240" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΑΡ. ΣΥΜΒΟΛΑΙΟΥ</text>
      <text x="396" y="240" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΠΕΛΑΤΗΣ</text>
      <text x="566" y="240" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΕΤΑΙΡΕΙΑ</text>
      <text x="716" y="240" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΑΣΦΑΛΙΣΤΡΟ</text>
      <text x="836" y="240" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.05em">ΚΑΤΑΣΤΑΣΗ</text>

      {policies.map((p, i) => (
        <g key={p.num} transform={`translate(0,${252 + i * 56})`}>
          <rect x="200" y="0" width="740" height="56" fill={i % 2 ? "#f7f1e6" : "transparent"} />
          <line x1="200" y1="56" x2="940" y2="56" stroke={RULE} />
          <text x="216" y="26" fontFamily="monospace" fontSize="11.5" fill={INK} fontWeight="600">{p.num}</text>
          <text x="216" y="42" fontFamily="sans-serif" fontSize="10" fill={INK_SOFT}>1 έτος · 12/2026</text>
          <text x="396" y="32" fontFamily="sans-serif" fontSize="12.5" fill={INK}>{p.customer}</text>
          <text x="566" y="32" fontFamily="sans-serif" fontSize="11.5" fill={INK_SOFT} fontWeight="600">{p.carrier}</text>
          <text x="716" y="32" fontFamily="sans-serif" fontSize="13" fill={INK} fontWeight="600">{p.premium}</text>
          <rect x="816" y="16" width="108" height="24" fill={p.color} opacity="0.15" />
          <rect x="816" y="16" width="3" height="24" fill={p.color} />
          <text x="826" y="32" fontFamily="sans-serif" fontSize="11" fill={p.color} fontWeight="600">{p.status}</text>
        </g>
      ))}
    </svg>
  );
}

/* ─── 3. Quotes (multi-carrier comparison) ─── */
function MockupQuotes() {
  const offers = [
    { c: "ETHNIKI",       p: "€ 340", base: 340, hl: true,  tag: "BEST" },
    { c: "INTERAMERICAN", p: "€ 351", base: 351, hl: false, tag: "" },
    { c: "GENERALI",      p: "€ 365", base: 365, hl: false, tag: "" },
    { c: "INTERLIFE",     p: "€ 372", base: 372, hl: false, tag: "" },
    { c: "EUROLIFE",      p: "€ 375", base: 375, hl: false, tag: "" },
    { c: "ERGO",          p: "€ 410", base: 410, hl: false, tag: "" },
    { c: "ALLIANZ",       p: "€ 436", base: 436, hl: false, tag: "" },
    { c: "NN",            p: "€ 470", base: 470, hl: false, tag: "" }
  ];
  const max = 500;
  return (
    <svg viewBox="0 0 960 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <rect width="960" height="600" fill="#fbfaf6" />
      <Sidebar active={3} />
      <Header title="Πολυτιμολόγηση" sub="Αυτοκίνητο · Πινακίδα ΑΒC-1234 · 8 ασφαλιστές" />

      {/* form summary */}
      <rect x="200" y="120" width="220" height="220" fill={BONE} stroke={RULE} />
      <text x="216" y="142" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.06em">ΣΤΟΙΧΕΙΑ ΚΙΝΔΥΝΟΥ</text>
      {[
        ["Πινακίδα", "ABC 1234"],
        ["Έτος", "2019"],
        ["Κυβικά", "1.600cc"],
        ["Bonus-Malus", "5"],
        ["Οδηγός", "38 ετών"],
        ["Πόλη", "Αθήνα"]
      ].map(([k, v], i) => (
        <g key={k} transform={`translate(216,${164 + i * 26})`}>
          <text fontFamily="sans-serif" fontSize="11" fill={INK_SOFT}>{k}</text>
          <text x="180" textAnchor="end" fontFamily="sans-serif" fontSize="12" fill={INK} fontWeight="600">{v}</text>
        </g>
      ))}
      <rect x="216" y="320" width="188" height="32" fill={INK} />
      <text x="310" y="340" fontFamily="sans-serif" fontSize="12" fill={PAPER} textAnchor="middle" fontWeight="700" letterSpacing="0.06em">ΛΗΨΗ ΠΡΟΣΦΟΡΩΝ</text>

      {/* carrier ladder */}
      <text x="450" y="142" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.06em">ΠΡΟΣΦΟΡΕΣ (ΤΑΞΙΝΟΜΗΣΗ ΑΝΑ ΑΣΦΑΛΙΣΤΡΟ)</text>
      {offers.map((o, i) => {
        const y = 160 + i * 50;
        const w = (o.base / max) * 380;
        return (
          <g key={o.c} transform={`translate(450,${y})`}>
            <rect x="0" y="0" width="490" height="42" fill={o.hl ? "rgba(91,139,62,0.08)" : "transparent"} />
            <line x1="0" y1="42" x2="490" y2="42" stroke={RULE} />
            <text x="0" y="18" fontFamily="sans-serif" fontSize="12" fill={INK} fontWeight={o.hl ? 700 : 600}>{o.c}</text>
            {o.hl && (
              <g transform="translate(72,5)">
                <rect width="44" height="16" fill={SUCCESS} />
                <text x="22" y="12" fontFamily="sans-serif" fontSize="10" fill={PAPER} textAnchor="middle" fontWeight="700">BEST</text>
              </g>
            )}
            <rect x="0" y="24" width={w} height="6" fill={o.hl ? SUCCESS : GOLD} opacity={o.hl ? 0.9 : 0.5} />
            <text x="490" y="22" textAnchor="end" fontFamily="serif" fontSize="16" fill={INK} fontWeight="700">{o.p}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── 4. Commissions ─── */
function MockupCommissions() {
  // Monthly production curve points
  const pts = [40, 62, 55, 78, 85, 72, 90, 110, 95, 120, 138, 142];
  const maxY = Math.max(...pts);
  const minY = Math.min(...pts);
  const xScale = (i: number) => 220 + (i / (pts.length - 1)) * 680;
  const yScale = (v: number) => 460 - ((v - minY) / (maxY - minY)) * 200;

  let path = "";
  pts.forEach((v, i) => { path += (i === 0 ? "M" : "L") + xScale(i).toFixed(1) + "," + yScale(v).toFixed(1) + " "; });
  let area = path + `L${xScale(pts.length-1)},460 L${xScale(0)},460 Z`;

  return (
    <svg viewBox="0 0 960 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <rect width="960" height="600" fill="#fbfaf6" />
      <Sidebar active={4} />
      <Header title="Προμήθειες" sub="€84.620 πληρωτέες · 4 επίπεδα ιεραρχίας ενεργά" />

      {/* KPI tiles */}
      {[
        { l: "ΠΡΟΣ ΕΙΣΠΡΑΞΗ", v: "€ 48.310", a: "8 ασφαλιστές" },
        { l: "ΠΛΗΡΩΘΕΝΤΑ ΜΗΝΑ", v: "€ 36.310", a: "↑ 12% MoM" },
        { l: "ΥΠΕΡΠΡΟΜΗΘΕΙΕΣ", v: "€ 8.840", a: "3 παραγωγοί" }
      ].map((k, i) => (
        <g key={k.l} transform={`translate(${200 + i * 250},120)`}>
          <rect width="230" height="78" fill={BONE} stroke={RULE} />
          <text x="14" y="22" fontFamily="sans-serif" fontSize="10.5" fill={INK_SOFT} fontWeight="600" letterSpacing="0.06em">{k.l}</text>
          <text x="14" y="54" fontFamily="serif" fontSize="24" fill={INK} fontWeight="700">{k.v}</text>
          <text x="14" y="70" fontFamily="sans-serif" fontSize="10.5" fill={GOLD} fontStyle="italic">{k.a}</text>
        </g>
      ))}

      {/* chart */}
      <line x1="220" y1="260" x2="220" y2="460" stroke={RULE} />
      <line x1="220" y1="460" x2="900" y2="460" stroke={RULE} />
      {[0, 1, 2, 3, 4].map((g) => (
        <line key={g} x1="220" y1={460 - g * 50} x2="900" y2={460 - g * 50} stroke={RULE} opacity="0.4" strokeDasharray="2 4" />
      ))}
      <path d={area} fill={GOLD} opacity="0.15" />
      <path d={path} fill="none" stroke={INK} strokeWidth="2" />
      {pts.map((v, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(v)} r="3.5" fill={i === pts.length - 1 ? GOLD : INK} />
      ))}
      {["Ι","Φ","Μ","Α","Μ","Ι","Ι","Α","Σ","Ο","Ν","Δ"].map((m, i) => (
        <text key={i} x={xScale(i)} y="478" fontFamily="sans-serif" fontSize="10.5" fill={INK_SOFT} textAnchor="middle">{m}</text>
      ))}

      <text x="450" y="248" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.06em">ΠΑΡΑΓΩΓΗ ΑΝΑ ΜΗΝΑ (k€)</text>
    </svg>
  );
}

/* ─── 5. Reports / report builder ─── */
function MockupReports() {
  return (
    <svg viewBox="0 0 960 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <rect width="960" height="600" fill="#fbfaf6" />
      <Sidebar active={5} />
      <Header title="Δημιουργός Αναφορών" sub="Επιλέξτε οντότητα · σύρετε πεδία · εκτελέστε" />

      {/* left panel: entity + fields */}
      <rect x="200" y="120" width="240" height="430" fill={BONE} stroke={RULE} />
      <text x="216" y="142" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.06em">ΟΝΤΟΤΗΤΑ</text>
      <rect x="216" y="152" width="208" height="32" fill="#fff" stroke={RULE} />
      <text x="226" y="172" fontFamily="sans-serif" fontSize="12" fill={INK} fontWeight="600">Συμβόλαια ▾</text>

      <text x="216" y="206" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.06em">ΠΕΔΙΑ</text>
      {[
        { l: "Αριθμός", picked: true },
        { l: "Πελάτης", picked: true },
        { l: "Ασφαλιστική", picked: true },
        { l: "Ασφάλιστρο", picked: true },
        { l: "Έναρξη", picked: false },
        { l: "Λήξη", picked: true },
        { l: "Κατάσταση", picked: false }
      ].map((f, i) => (
        <g key={f.l} transform={`translate(216,${220 + i * 28})`}>
          <rect width="208" height="22" fill={f.picked ? GOLD : "transparent"} opacity={f.picked ? 0.18 : 1} />
          <rect width="208" height="22" fill="none" stroke={RULE} />
          <text x="10" y="15" fontFamily="sans-serif" fontSize="11.5" fill={INK} fontWeight={f.picked ? 600 : 400}>{f.picked ? "✓ " : ""}{f.l}</text>
        </g>
      ))}

      {/* right panel: live table preview */}
      <text x="464" y="142" fontFamily="sans-serif" fontSize="11" fill={INK_SOFT} fontWeight="600" letterSpacing="0.06em">ΠΡΟΕΠΙΣΚΟΠΗΣΗ · 124 ΓΡΑΜΜΕΣ</text>
      <rect x="464" y="152" width="476" height="32" fill={BONE} stroke={RULE} />
      <text x="476" y="172" fontFamily="sans-serif" fontSize="10.5" fill={INK_SOFT} fontWeight="600" letterSpacing="0.04em">ΑΡΙΘΜΟΣ</text>
      <text x="600" y="172" fontFamily="sans-serif" fontSize="10.5" fill={INK_SOFT} fontWeight="600" letterSpacing="0.04em">ΠΕΛΑΤΗΣ</text>
      <text x="740" y="172" fontFamily="sans-serif" fontSize="10.5" fill={INK_SOFT} fontWeight="600" letterSpacing="0.04em">ΑΣΦ/ΡΟ</text>
      <text x="840" y="172" fontFamily="sans-serif" fontSize="10.5" fill={INK_SOFT} fontWeight="600" letterSpacing="0.04em">ΛΗΞΗ</text>

      {[
        ["AUTO-2026-00824", "Παπαδάκης Ν.", "€ 420", "12/26"],
        ["HOME-2026-00417", "Γεωργίου Α.",  "€ 280", "03/27"],
        ["LIFE-2026-00109", "Σταυρίδου Ε.", "€ 540", "06/26"],
        ["AUTO-2026-00823", "Μιχαηλίδης Κ.", "€ 690", "08/26"],
        ["HEAL-2026-00302", "Παππά Μ.",     "€ 380", "11/26"],
        ["AUTO-2026-00811", "Ζαφειρίου Δ.", "€ 510", "02/27"],
        ["HOME-2026-00405", "Νικολάου Π.",  "€ 320", "09/26"]
      ].map((r, i) => (
        <g key={i} transform={`translate(0,${184 + i * 44})`}>
          <rect x="464" y="0" width="476" height="44" fill={i % 2 ? "#f7f1e6" : "transparent"} />
          <line x1="464" y1="44" x2="940" y2="44" stroke={RULE} />
          <text x="476" y="26" fontFamily="monospace" fontSize="11" fill={INK}>{r[0]}</text>
          <text x="600" y="26" fontFamily="sans-serif" fontSize="12" fill={INK}>{r[1]}</text>
          <text x="740" y="26" fontFamily="sans-serif" fontSize="12" fill={INK} fontWeight="600">{r[2]}</text>
          <text x="840" y="26" fontFamily="sans-serif" fontSize="12" fill={INK_SOFT}>{r[3]}</text>
        </g>
      ))}
    </svg>
  );
}
