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

// All routable pages in the platform, categorized for discovery.
// Each entry mirrors a NavItem from App.tsx — keep in sync when adding pages.
const TOOLS: Tool[] = [
  // Operations & lifecycle
  { to: "/insurance-companies", labelKey: "nav.insuranceCompanies", descKey: "tools.insuranceCompanies", category: "operations", pkg: "BackOffice" },
  { to: "/tariffs", labelKey: "nav.tariffs", descKey: "tools.tariffs", category: "operations", pkg: "BackOffice" },
  { to: "/endorsements", labelKey: "nav.endorsements", descKey: "tools.endorsements", category: "operations", pkg: "BackOffice" },
  { to: "/cancellations", labelKey: "nav.cancellations", descKey: "tools.cancellations", category: "operations", pkg: "BackOffice" },
  { to: "/credit-notes", labelKey: "nav.creditNotes", descKey: "tools.creditNotes", category: "operations", pkg: "BackOffice" },
  { to: "/policies?view=group", labelKey: "nav.groupPolicies", descKey: "tools.groupPolicies", category: "operations", pkg: "BackOffice" },
  { to: "/policies?view=delivery", labelKey: "nav.policyDelivery", descKey: "tools.policyDelivery", category: "operations", pkg: "BackOffice" },
  { to: "/lookups", labelKey: "nav.lookups", descKey: "tools.lookups", category: "operations", pkg: "BackOffice" },
  { to: "/parametric-files", labelKey: "nav.parametricFiles", descKey: "tools.parametricFiles", category: "operations", pkg: "BackOffice" },
  { to: "/vehicle-models", labelKey: "nav.vehicleModels", descKey: "tools.vehicleModels", category: "operations", pkg: "BackOffice" },
  { to: "/document-designer", labelKey: "nav.docDesigner", descKey: "tools.docDesigner", category: "operations", pkg: "BackOffice" },
  { to: "/cover-notes", labelKey: "nav.coverNotes", descKey: "tools.coverNotes", category: "operations", pkg: "FrontOffice" },

  // Claims & settlements
  { to: "/garages", labelKey: "nav.garages", descKey: "tools.garages", category: "claimsOps", pkg: "BackOffice" },
  { to: "/claim-provisions", labelKey: "nav.provisions", descKey: "tools.provisions", category: "claimsOps", pkg: "BackOffice" },
  { to: "/indemnities", labelKey: "nav.indemnities", descKey: "tools.indemnities", category: "claimsOps", pkg: "BackOffice" },
  { to: "/friendly-settlements", labelKey: "nav.friendly", descKey: "tools.friendly", category: "claimsOps", pkg: "BackOffice" },
  { to: "/usae", labelKey: "nav.usae", descKey: "tools.usae", category: "claimsOps", pkg: "Integrations" },

  // Commissions
  { to: "/commission-runs", labelKey: "nav.commissionRuns", descKey: "tools.commissionRuns", category: "commissions", pkg: "BackOffice" },
  { to: "/bulk-commissions", labelKey: "nav.bulkCommissions", descKey: "tools.bulkCommissions", category: "commissions", pkg: "BackOffice" },
  { to: "/over-commissions", labelKey: "nav.overCommissions", descKey: "tools.overCommissions", category: "commissions", pkg: "BackOffice" },

  // Cash & receivables
  { to: "/receipts", labelKey: "nav.receipts", descKey: "tools.receipts", category: "financials", pkg: "BackOffice" },
  { to: "/payments", labelKey: "nav.payments", descKey: "tools.payments", category: "financials", pkg: "BackOffice" },
  { to: "/financial-movements", labelKey: "nav.financials", descKey: "tools.financials", category: "financials", pkg: "BackOffice" },
  { to: "/securities", labelKey: "nav.securities", descKey: "tools.securities", category: "financials", pkg: "BackOffice" },
  { to: "/advance-payments", labelKey: "nav.advance", descKey: "tools.advance", category: "financials", pkg: "BackOffice" },
  { to: "/reconciliation", labelKey: "nav.reconciliation", descKey: "tools.reconciliation", category: "financials", pkg: "BackOffice" },
  { to: "/cash", labelKey: "nav.cash", descKey: "tools.cash", category: "financials", pkg: "BackOffice" },
  { to: "/tachypayments", labelKey: "nav.tachy", descKey: "tools.tachy", category: "financials", pkg: "BackOffice" },

  // Accounting
  { to: "/gl", labelKey: "nav.gl", descKey: "tools.gl", category: "accounting", pkg: "BackOffice" },
  { to: "/accounting", labelKey: "nav.accounting", descKey: "tools.accounting", category: "accounting", pkg: "BackOffice" },
  { to: "/kepyo", labelKey: "nav.kepyo", descKey: "tools.kepyo", category: "accounting", pkg: "BackOffice" },
  { to: "/magnetic-import", labelKey: "nav.magneticImport", descKey: "tools.magneticImport", category: "accounting", pkg: "BackOffice" },
  { to: "/config-hub", labelKey: "nav.configHub", descKey: "tools.configHub", category: "accounting", pkg: "BackOffice" },

  // CRM
  { to: "/appointments", labelKey: "nav.appointments", descKey: "tools.appointments", category: "crm", pkg: "Crm" },
  { to: "/document-manager", labelKey: "nav.documentManager", descKey: "tools.documentManager", category: "crm", pkg: "Crm" },
  { to: "/marketing", labelKey: "nav.marketing", descKey: "tools.marketing", category: "crm", pkg: "Crm" },
  { to: "/name-days", labelKey: "nav.nameDays", descKey: "tools.nameDays", category: "crm", pkg: "Crm" },
  { to: "/caller-id", labelKey: "nav.callerId", descKey: "tools.callerId", category: "crm", pkg: "Crm" },
  { to: "/delivery-tracking", labelKey: "nav.deliveryTracking", descKey: "tools.deliveryTracking", category: "crm", pkg: "Crm" },
  { to: "/customer-merge", labelKey: "nav.merge", descKey: "tools.merge", category: "crm", pkg: "BackOffice" },

  // Front-office / quoting
  { to: "/quote-builder", labelKey: "nav.quoteBuilder", descKey: "tools.quoteBuilder", category: "quotes", pkg: "FrontOffice" },
  { to: "/risk-profiles", labelKey: "nav.riskProfiles", descKey: "tools.riskProfiles", category: "quotes", pkg: "FrontOffice" },
  { to: "/print-pay", labelKey: "nav.printPay", descKey: "tools.printPay", category: "quotes", pkg: "FrontOffice" },
  { to: "/plafond", labelKey: "nav.plafond", descKey: "tools.plafond", category: "quotes", pkg: "FrontOffice" },

  // Intelligence
  { to: "/workflows", labelKey: "nav.workflows", descKey: "tools.workflows", category: "intelligence", pkg: "Intelligence" },
  { to: "/churn", labelKey: "nav.churn", descKey: "tools.churn", category: "intelligence", pkg: "Intelligence" },
  { to: "/report-builder", labelKey: "nav.reportBuilder", descKey: "tools.reportBuilder", category: "intelligence", pkg: "Intelligence" },
  { to: "/named-reports", labelKey: "nav.namedReports", descKey: "tools.namedReports", category: "intelligence", pkg: "Intelligence" },
  { to: "/persistency", labelKey: "nav.persistency", descKey: "tools.persistency", category: "intelligence", pkg: "Intelligence" },
  { to: "/production-stats", labelKey: "nav.productionStats", descKey: "tools.productionStats", category: "intelligence", pkg: "Intelligence" },
  { to: "/goals", labelKey: "nav.goals", descKey: "tools.goals", category: "intelligence", pkg: "Intelligence" },

  // Integrations
  { to: "/dias", labelKey: "nav.dias", descKey: "tools.dias", category: "integrations", pkg: "Integrations" },
  { to: "/bank-connections", labelKey: "nav.bankConnections", descKey: "tools.bankConnections", category: "integrations", pkg: "Integrations" },
  { to: "/company-bridges", labelKey: "nav.companyBridges", descKey: "tools.companyBridges", category: "integrations", pkg: "Integrations" },
  { to: "/api-keys", labelKey: "nav.thirdParty", descKey: "tools.thirdParty", category: "integrations", pkg: "Integrations" },
  { to: "/partner-portals", labelKey: "nav.b2bPortal", descKey: "tools.b2bPortal", category: "integrations", pkg: "Integrations" },
  { to: "/integration-settings", labelKey: "nav.integrationSettings", descKey: "tools.integrationSettings", category: "integrations", pkg: "Integrations" },
  { to: "/mydata", labelKey: "nav.mydata", descKey: "tools.mydata", category: "integrations", pkg: "Integrations" },
  { to: "/info-center", labelKey: "nav.infoCenter", descKey: "tools.infoCenter", category: "integrations", pkg: "Integrations" },
  { to: "/branches", labelKey: "nav.branchDesigner", descKey: "tools.branchDesigner", category: "integrations", pkg: "Integrations" },
  { to: "/agency-offices", labelKey: "nav.agencyOffices", descKey: "tools.agencyOffices", category: "integrations", pkg: "Integrations" },
];

const CATEGORY_ORDER = [
  "operations", "claimsOps", "commissions", "financials", "accounting",
  "crm", "quotes", "intelligence", "integrations"
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
