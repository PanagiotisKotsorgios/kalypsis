import { useMemo, useState } from "react";
import {
  Box, Button, Card, CardActionArea, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, Stack, TextField, Typography
} from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";
import SearchIcon from "@mui/icons-material/Search";
import AppsIcon from "@mui/icons-material/Apps";
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
//
// The «Προμήθειες / Οικονομικά / Λογιστική / Εργασίες Συμβολαίων» categories
// were removed on 2026-07-02: their pages either duplicated sidebar entries
// (Commission runs) or exposed half-finished back-office flows to agencies
// that didn't need them. Everything below is still work-in-progress, so the
// cards open a «Coming soon» dialog instead of navigating.
const TOOLS: Tool[] = [
  // Claims & settlements (sub-flows, not main Claims page)
  { to: "/garages",              labelKey: "nav.garages",      descKey: "tools.garages",      category: "claimsOps",   pkg: "BackOffice" },
  { to: "/claim-provisions",     labelKey: "nav.provisions",   descKey: "tools.provisions",   category: "claimsOps",   pkg: "BackOffice" },
  { to: "/indemnities",          labelKey: "nav.indemnities",  descKey: "tools.indemnities",  category: "claimsOps",   pkg: "BackOffice" },
  { to: "/friendly-settlements", labelKey: "nav.friendly",     descKey: "tools.friendly",     category: "claimsOps",   pkg: "BackOffice" },

  // Quoting / front-office sub-tools.
  { to: "/risk-profiles", labelKey: "nav.riskProfiles", descKey: "tools.riskProfiles", category: "quotes", pkg: "FrontOffice" },
  { to: "/print-pay",     labelKey: "nav.printPay",     descKey: "tools.printPay",     category: "quotes", pkg: "FrontOffice" },
  { to: "/plafond",       labelKey: "nav.plafond",      descKey: "tools.plafond",      category: "quotes", pkg: "FrontOffice" },

  // Intelligence power-user tools (sidebar shows the main Reports page only).
  { to: "/workflows",      labelKey: "nav.workflows",      descKey: "tools.workflows",      category: "intelligence", pkg: "Intelligence" },
  { to: "/churn",          labelKey: "nav.churn",          descKey: "tools.churn",          category: "intelligence", pkg: "Intelligence" },
  { to: "/report-builder", labelKey: "nav.reportBuilder", descKey: "tools.reportBuilder", category: "intelligence", pkg: "Intelligence" },
  { to: "/goals",          labelKey: "nav.goals",          descKey: "tools.goals",          category: "intelligence", pkg: "Intelligence" },
];

const CATEGORY_ORDER = ["claimsOps", "quotes", "intelligence"];

export function AllToolsPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  // The whole catalogue is still WIP — clicking any tool opens a shared
  // «Coming soon» dialog instead of navigating. `pending` holds the tool
  // the user clicked so the dialog can name it.
  const [pending, setPending] = useState<Tool | null>(null);

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
                <CardActionArea onClick={() => setPending(tool)} sx={{ p: 2, height: "100%" }}>
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
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
                    <Chip size="small" label={tool.pkg} sx={{ fontWeight: 600, fontSize: 10, height: 18 }} />
                    <Chip size="small" color="warning" variant="outlined"
                      icon={<ConstructionIcon sx={{ fontSize: 12 }} />}
                      label="Υπό ανάπτυξη"
                      sx={{ fontWeight: 600, fontSize: 10, height: 18 }} />
                  </Stack>
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

      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800 }}>
          <ConstructionIcon color="warning" />
          Έρχεται σύντομα
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            {pending ? <b>{t(pending.labelKey)}</b> : null} — αυτή η λειτουργία είναι ακόμη υπό
            ανάπτυξη. Δουλεύουμε πάνω της και θα ανακοινώσουμε τη διαθεσιμότητά της σύντομα.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Έχετε συγκεκριμένη ανάγκη ή σχόλιο για αυτό το εργαλείο; Πείτε μας στο{" "}
            <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} variant="contained">Εντάξει</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
