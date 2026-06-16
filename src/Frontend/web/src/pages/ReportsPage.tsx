import { Box, Card, CardContent, CircularProgress, Typography } from "@mui/material";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface SeriesPoint { label: string; value: number }
interface CarrierShare { carrier: string; policies: number; premium: number }

interface AgencyReportDto {
  kpis: {
    customers: number;
    activePolicies: number;
    expiringSoon: number;
    monthlyPremium: number;
    openClaims: number;
    openRequests: number;
  };
  policiesByType: SeriesPoint[];
  policiesByStatus: SeriesPoint[];
  claimsByStatus: SeriesPoint[];
  requestsByStatus: SeriesPoint[];
  monthlyPremium: SeriesPoint[];
  topCarriers: CarrierShare[];
}

const COLORS = ["#0b2545", "#1d4e89", "#1ea7e1", "#f6a623", "#7be295", "#c0392b", "#7f8c8d"];

export function ReportsPage() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["reports-agency"],
    queryFn: async () => (await api.get<AgencyReportDto>("/reports/agency")).data
  });

  if (q.isLoading || !q.data) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  const r = q.data;

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("reports.title")}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t("reports.subtitle")}</Typography>

      {/* KPI cards */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(6, 1fr)" }, mb: 3 }}>
        <Kpi label={t("reports.kpi.customers")} value={r.kpis.customers.toLocaleString("el-GR")} />
        <Kpi label={t("reports.kpi.activePolicies")} value={r.kpis.activePolicies.toLocaleString("el-GR")} />
        <Kpi label={t("reports.kpi.expiringSoon")} value={r.kpis.expiringSoon.toLocaleString("el-GR")} accent={r.kpis.expiringSoon > 0 ? "warning" : undefined} />
        <Kpi label={t("reports.kpi.monthlyPremium")} value={`€${r.kpis.monthlyPremium.toLocaleString("el-GR", { minimumFractionDigits: 0 })}`} />
        <Kpi label={t("reports.kpi.openClaims")} value={r.kpis.openClaims.toLocaleString("el-GR")} />
        <Kpi label={t("reports.kpi.openRequests")} value={r.kpis.openRequests.toLocaleString("el-GR")} />
      </Box>

      {/* Charts row 1 — Monthly premium */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("reports.chart.monthlyPremium")}</Typography>
          <Box sx={{ height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={r.monthlyPremium}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                <XAxis dataKey="label" stroke="#456079" fontSize={12} />
                <YAxis stroke="#456079" fontSize={12} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(v) => `€${Number(v).toLocaleString("el-GR", { minimumFractionDigits: 0 })}`} />
                <Line type="monotone" dataKey="value" stroke="#0b2545" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Charts row 2 — pies */}
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, mb: 3 }}>
        <ChartCard title={t("reports.chart.policiesByType")} data={r.policiesByType} kind="pie" labelMap="policies.types" />
        <ChartCard title={t("reports.chart.policiesByStatus")} data={r.policiesByStatus} kind="pie" labelMap="policies.statuses" />
      </Box>

      {/* Charts row 3 — bars */}
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, mb: 3 }}>
        <ChartCard title={t("reports.chart.claimsByStatus")} data={r.claimsByStatus} kind="bar" labelMap="claims.statuses" />
        <ChartCard title={t("reports.chart.requestsByStatus")} data={r.requestsByStatus} kind="bar" labelMap="requests.statuses" />
      </Box>

      {/* Top carriers */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("reports.chart.topCarriers")}</Typography>
          <Box sx={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={r.topCarriers} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                <XAxis type="number" stroke="#456079" fontSize={12} />
                <YAxis type="category" dataKey="carrier" stroke="#456079" fontSize={12} width={150} />
                <Tooltip />
                <Legend />
                <Bar dataKey="policies" name={t("reports.chart.policiesLabel")} fill="#1d4e89" />
                <Bar dataKey="premium" name={t("reports.chart.premiumLabel")} fill="#1ea7e1" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "warning" }) {
  return (
    <Card sx={{ borderLeft: accent === "warning" ? "4px solid" : undefined, borderLeftColor: "warning.main" }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, data, kind, labelMap }:
  { title: string; data: SeriesPoint[]; kind: "pie" | "bar"; labelMap: string }) {
  const { t } = useTranslation();
  const labeled = data.map((p) => ({ ...p, label: t(`${labelMap}.${p.label}`, { defaultValue: p.label }) }));
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
        {labeled.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>{t("reports.empty")}</Typography>
        ) : (
          <Box sx={{ height: 260 }}>
            <ResponsiveContainer>
              {kind === "pie" ? (
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie data={labeled} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90}
                    label={(p) => {
                      const e = p as unknown as { label: string; value: number };
                      return `${e.label}: ${e.value}`;
                    }}>
                    {labeled.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              ) : (
                <BarChart data={labeled}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                  <XAxis dataKey="label" stroke="#456079" fontSize={12} />
                  <YAxis stroke="#456079" fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0b2545">
                    {labeled.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
