import { Box, Card, CardContent, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import GroupIcon from "@mui/icons-material/Group";
import BusinessIcon from "@mui/icons-material/Business";
import DescriptionIcon from "@mui/icons-material/Description";
import EuroIcon from "@mui/icons-material/Euro";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { money, date } from "../utils/format";

interface Overview {
  totalTenants: number; activeTenants: number; trialTenants: number;
  pastDueTenants: number; cancelledTenants: number;
  newTenants30d: number; newTenants90d: number; cancelledTenants30d: number;
  mrr: number; arr: number; currency: string;
  averageRevenuePerTenant: number;
  totalUsers: number; activeUsers30d: number;
  totalCustomers: number; totalPolicies: number;
}

interface TenantRevenue {
  tenantId: string; tenantName: string; tenantCode: string;
  plan: string | null; subscriptionState: string;
  officeCount: number; billableOfficeCount: number;
  monthlyTotal: number; currency: string;
  hasContract: boolean; contractNumber: string | null;
  contractEffectiveFrom: string | null;
}

interface SeriesPoint { month: string; mrr: number; activeTenants: number; newTenants: number; }

export function PlatformEconomicsPage() {
  const { t } = useTranslation();
  const overview = useQuery({
    queryKey: ["platform-economics-overview"],
    queryFn: async () => (await api.get<Overview>("/platform/economics/overview")).data
  });
  const revenue = useQuery({
    queryKey: ["platform-economics-revenue"],
    queryFn: async () => (await api.get<TenantRevenue[]>("/platform/economics/revenue-by-tenant")).data
  });
  const series = useQuery({
    queryKey: ["platform-economics-series", 12],
    queryFn: async () => (await api.get<SeriesPoint[]>("/platform/economics/series?months=12")).data
  });

  if (overview.isLoading || !overview.data) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  const o = overview.data;
  const seriesData = series.data ?? [];
  const maxMrr = Math.max(1, ...seriesData.map(p => p.mrr));

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <TrendingUpIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("economics.title")}</Typography>
          <Typography color="text.secondary">{t("economics.subtitle")}</Typography>
        </Box>
      </Stack>

      {/* Top KPI row */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <KpiCard label={t("economics.kpi.mrr")}  value={money(o.mrr, o.currency)} icon={<EuroIcon />} highlight />
        <KpiCard label={t("economics.kpi.arr")}  value={money(o.arr, o.currency)} icon={<EuroIcon />} />
        <KpiCard label={t("economics.kpi.arpa")} value={money(o.averageRevenuePerTenant, o.currency)} />
        <KpiCard label={t("economics.kpi.tenants")} value={o.totalTenants} icon={<BusinessIcon />} />
      </Box>

      {/* Sub KPI row */}
      <Box sx={{
        display: "grid", gap: 2, mb: 4,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <KpiCard label={t("economics.kpi.active")}  value={o.activeTenants} small  color="success.main" />
        <KpiCard label={t("economics.kpi.trial")}   value={o.trialTenants}  small  color="info.main" />
        <KpiCard label={t("economics.kpi.pastDue")} value={o.pastDueTenants} small color="warning.main" />
        <KpiCard label={t("economics.kpi.churned")} value={o.cancelledTenants} small color="error.main" />
      </Box>

      {/* MRR chart */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{t("economics.chart.title")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t("economics.chart.subtitle")}</Typography>

          {series.isLoading ? <CircularProgress size={24} /> : (
            <Box sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${seriesData.length}, 1fr)`,
              gap: 1,
              alignItems: "end",
              height: 200,
              borderBottom: "1px solid",
              borderColor: "divider",
              pb: 1
            }}>
              {seriesData.map(p => {
                const h = (p.mrr / maxMrr) * 100;
                return (
                  <Box key={p.month} sx={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                    <Box sx={{
                      width: "70%",
                      height: `${Math.max(4, h)}%`,
                      bgcolor: "primary.main",
                      borderTopLeftRadius: 4, borderTopRightRadius: 4,
                      opacity: p.mrr > 0 ? 1 : 0.2,
                      transition: "height 380ms ease"
                    }} title={money(p.mrr, o.currency)} />
                    <Typography variant="caption" sx={{ mt: 0.5, color: "text.secondary", fontSize: 11 }}>
                      {p.month.slice(5)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          <Stack direction="row" spacing={4} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            <LegendDot color="primary.main" label={`${t("economics.chart.mrrLine")}: max ${maxMrr.toFixed(0)} ${o.currency}`} />
            <Typography variant="caption" color="text.secondary">
              {t("economics.chart.activeNow", { n: o.activeTenants + o.trialTenants })} ·
              {" "}
              {t("economics.chart.newLast30", { n: o.newTenants30d })}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Per-tenant revenue */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("economics.table.title")}</Typography>
            <Chip size="small" label={`${revenue.data?.length ?? 0} ${t("economics.table.rows")}`} />
          </Stack>
          {revenue.isLoading ? <CircularProgress size={24} /> : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("economics.table.tenant")}</TableCell>
                    <TableCell>{t("economics.table.plan")}</TableCell>
                    <TableCell>{t("economics.table.state")}</TableCell>
                    <TableCell align="right">{t("economics.table.offices")}</TableCell>
                    <TableCell align="right">{t("economics.table.billable")}</TableCell>
                    <TableCell>{t("economics.table.contract")}</TableCell>
                    <TableCell align="right">{t("economics.table.monthly")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(revenue.data ?? []).map(r => (
                    <TableRow key={r.tenantId} hover>
                      <TableCell>
                        <Box component={RouterLink} to={`/app/tenants/${r.tenantId}`}
                          sx={{ color: "text.primary", textDecoration: "none", fontWeight: 600,
                                "&:hover": { color: "primary.main", textDecoration: "underline" } }}>
                          {r.tenantName}
                        </Box>
                        <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontFamily: "monospace" }}>
                          {r.tenantCode}
                        </Typography>
                      </TableCell>
                      <TableCell>{r.plan ?? "—"}</TableCell>
                      <TableCell><Chip size="small" label={r.subscriptionState} /></TableCell>
                      <TableCell align="right">{r.officeCount}</TableCell>
                      <TableCell align="right">{r.billableOfficeCount}</TableCell>
                      <TableCell>
                        {r.hasContract ? (
                          <Stack direction="column" spacing={0}>
                            <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.contractNumber}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {r.contractEffectiveFrom ? date(r.contractEffectiveFrom) : ""}
                            </Typography>
                          </Stack>
                        ) : <Chip size="small" label={t("economics.table.noContract")} color="warning" variant="outlined" />}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: r.monthlyTotal > 0 ? "primary.main" : "text.disabled" }}>
                        {money(r.monthlyTotal, r.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Bottom stats */}
      <Box sx={{
        display: "grid", gap: 2, mt: 3,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <KpiCard label={t("economics.kpi.totalUsers")} value={o.totalUsers} icon={<GroupIcon />} small />
        <KpiCard label={t("economics.kpi.activeUsers30")} value={o.activeUsers30d} small />
        <KpiCard label={t("economics.kpi.totalCustomers")} value={o.totalCustomers} icon={<GroupIcon />} small />
        <KpiCard label={t("economics.kpi.totalPolicies")} value={o.totalPolicies} icon={<DescriptionIcon />} small />
      </Box>
    </Box>
  );
}

function KpiCard({ label, value, icon, small, highlight, color }: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  small?: boolean;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <Card variant="outlined" sx={{ bgcolor: highlight ? "rgba(176,138,62,0.08)" : undefined }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "text.secondary", fontSize: 11, mb: 0.5, letterSpacing: "0.06em", fontWeight: 600 }}>
          {icon}
          <span>{label.toUpperCase()}</span>
        </Stack>
        <Typography sx={{
          fontFamily: "var(--display, serif)",
          fontWeight: 700,
          fontSize: small ? { xs: 22, md: 26 } : { xs: 26, md: 34 },
          color: color ?? (highlight ? "primary.main" : "text.primary"),
          lineHeight: 1
        }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}
