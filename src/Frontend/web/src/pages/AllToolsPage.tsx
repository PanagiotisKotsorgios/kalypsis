import { useMemo, useState } from "react";
import {
  Box, Card, CardActionArea, Chip, InputAdornment, Stack, TextField, Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AppsIcon from "@mui/icons-material/Apps";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HelpHint } from "../components/HelpHint";

interface Tool {
  to: string;
  labelKey: string;
  descKey: string;
  category: string;
  pkg: "BackOffice" | "FrontOffice" | "Crm" | "Intelligence" | "Integrations";
}

// "All Tools" only lists pages that are NOT already in the role sidebar —
// power-user shortcuts, accounting back-room utilities, claims sub-flows,
// and quoting tools that live behind the main pages. Anything reachable
// from the sidebar is intentionally not duplicated here; that would just
// make the catalogue noisier without making any page easier to find.
const TOOLS: Tool[] = [
  // Claims & settlements (sub-flows, not main Claims page)
  { to: "/garages",              labelKey: "nav.garages",      descKey: "tools.garages",      category: "claimsOps",   pkg: "BackOffice" },
  { to: "/claim-provisions",     labelKey: "nav.provisions",   descKey: "tools.provisions",   category: "claimsOps",   pkg: "BackOffice" },
  { to: "/indemnities",          labelKey: "nav.indemnities",  descKey: "tools.indemnities",  category: "claimsOps",   pkg: "BackOffice" },
  { to: "/friendly-settlements", labelKey: "nav.friendly",     descKey: "tools.friendly",     category: "claimsOps",   pkg: "BackOffice" },

  // Commission runs — paired with the Commission Rules page in the sidebar.
  { to: "/commission-runs", labelKey: "nav.commissionRuns", descKey: "tools.commissionRuns", category: "commissions", pkg: "BackOffice" },

  // Cash / tachy back-room — not surfaced in the agency sidebar by default.
  { to: "/cash",          labelKey: "nav.cash",  descKey: "tools.cash",  category: "financials", pkg: "BackOffice" },
  { to: "/tachypayments", labelKey: "nav.tachy", descKey: "tools.tachy", category: "financials", pkg: "BackOffice" },

  // Accounting — separate workflow, hidden from the main sidebar to keep it tidy.
  { to: "/gl",               labelKey: "nav.gl",              descKey: "tools.gl",              category: "accounting", pkg: "BackOffice" },
  { to: "/accounting",       labelKey: "nav.accounting",      descKey: "tools.accounting",      category: "accounting", pkg: "BackOffice" },
  { to: "/kepyo",            labelKey: "nav.kepyo",           descKey: "tools.kepyo",           category: "accounting", pkg: "BackOffice" },
  { to: "/magnetic-import",  labelKey: "nav.magneticImport",  descKey: "tools.magneticImport",  category: "accounting", pkg: "BackOffice" },

  // Quoting / front-office sub-tools.
  { to: "/risk-profiles", labelKey: "nav.riskProfiles", descKey: "tools.riskProfiles", category: "quotes", pkg: "FrontOffice" },
  { to: "/print-pay",     labelKey: "nav.printPay",     descKey: "tools.printPay",     category: "quotes", pkg: "FrontOffice" },
  { to: "/plafond",       labelKey: "nav.plafond",      descKey: "tools.plafond",      category: "quotes", pkg: "FrontOffice" },

  // Intelligence power-user tools (sidebar shows the main Reports page only).
  { to: "/workflows",      labelKey: "nav.workflows",      descKey: "tools.workflows",      category: "intelligence", pkg: "Intelligence" },
  { to: "/churn",          labelKey: "nav.churn",          descKey: "tools.churn",          category: "intelligence", pkg: "Intelligence" },
  { to: "/report-builder", labelKey: "nav.reportBuilder", descKey: "tools.reportBuilder", category: "intelligence", pkg: "Intelligence" },
  { to: "/goals",          labelKey: "nav.goals",          descKey: "tools.goals",          category: "intelligence", pkg: "Intelligence" },

  // Operations odds and ends.
  { to: "/lookups", labelKey: "nav.lookups", descKey: "tools.lookups", category: "operations", pkg: "BackOffice" },
];

const CATEGORY_ORDER = [
  "claimsOps", "commissions", "financials", "accounting",
  "quotes", "intelligence", "operations"
];

export function AllToolsPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const filter = q.trim().toLowerCase();
    const match = (tool: Tool) => {
      if (!filter) return true;
      const label = t(tool.labelKey).toLowerCase();
      const desc = t(tool.descKey, "").toLowerCase();
      return label.includes(filter) || desc.includes(filter) || tool.to.includes(filter);
    };
    const m: Record<string, Tool[]> = {};
    for (const tool of TOOLS) {
      if (!match(tool)) continue;
      (m[tool.category] ??= []).push(tool);
    }
    return m;
  }, [q, t]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <AppsIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("allTools.title")}</Typography>
            <HelpHint id="page.allTools" />
          </Stack>
          <Typography color="text.secondary">{t("allTools.subtitle")}</Typography>
        </Box>
      </Stack>

      <TextField
        data-tour="all-tools-search"
        autoFocus fullWidth size="small" placeholder={t("allTools.searchPlaceholder")}
        value={q} onChange={(e) => setQ(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        sx={{ mb: 4, maxWidth: 520 }}
      />

      {CATEGORY_ORDER.filter(c => grouped[c]?.length).map((cat, idx) => (
        <Box key={cat} sx={{ mb: 5 }} {...(idx === 0 ? { "data-tour": "all-tools-categories" } : {})}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.main" }}>
              {t(`nav.group.${cat}`, cat)}
            </Typography>
            <Chip size="small" label={grouped[cat].length} />
          </Stack>
          <Box sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(4, 1fr)"
            }
          }}>
            {grouped[cat].map(tool => (
              <Card key={tool.to} variant="outlined" sx={{ borderRadius: 2,
                transition: "transform 120ms, box-shadow 120ms",
                "&:hover": { transform: "translateY(-2px)", boxShadow: 3, borderColor: "primary.light" }
              }}>
                <CardActionArea component={RouterLink} to={`/app${tool.to}`} sx={{ p: 2, height: "100%" }}>
                  <Typography fontWeight={700} sx={{ mb: 0.5 }} noWrap>{t(tool.labelKey)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: 1.4,
                    minHeight: 36
                  }}>
                    {t(tool.descKey, "")}
                  </Typography>
                  <Chip size="small" label={tool.pkg} sx={{ mt: 1, fontWeight: 600, fontSize: 10, height: 18 }} />
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
      ))}

      {Object.keys(grouped).length === 0 && (
        <Typography color="text.secondary" sx={{ py: 8, textAlign: "center" }}>
          {t("allTools.noResults", { query: q })}
        </Typography>
      )}
    </Box>
  );
}
