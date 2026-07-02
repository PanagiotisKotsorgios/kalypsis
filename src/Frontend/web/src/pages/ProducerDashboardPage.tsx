import {
  Box, Card, CardContent, Chip, CircularProgress, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography
} from "@mui/material";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { ProducerDeclarationForm } from "../components/ProducerDeclarationForm";
import { money, num } from "../utils/format";

interface SeriesPoint { label: string; value: number }
interface CarrierShare { carrier: string; policies: number; premium: number }

interface RecentPolicy {
  id: string; policyNumber: string; customerDisplay: string; carrierName: string;
  type: string; premium: number; endDate: string;
}

interface ProducerReportDto {
  producerName: string;
  producerCode: string;
  kpis: {
    customers: number;
    activePolicies: number;
    expiringSoon: number;
    monthlyPremium: number;
    renewalsThisYear: number;
  };
  policiesByType: SeriesPoint[];
  policiesByStatus: SeriesPoint[];
  monthlyPremium: SeriesPoint[];
  carrierBreakdown: CarrierShare[];
  expiringSoon: RecentPolicy[];
}

interface SelfSummaryDto {
  producerId: string;
  name: string;
  status: string;
  activePolicies: number;
  policiesMtd: number; policiesYtd: number;
  premiumMtd: number; premiumYtd: number;
  commissionMtd: number; commissionYtd: number;
  overCommissionYtd: number;
  customersServed: number;
}

interface MyRunLineDto {
  runId: string; runTitle: string; year: number; month: number; runStatus: string;
  lineId: string; policyNumber: string; insuranceCompanyName: string;
  policyType: string; premium: number; ratePercent: number; commissionAmount: number;
  isOverCommission: boolean; overCommissionLevel: number; onBehalfOfProducerName: string | null;
}

const COLORS = ["#0b2545", "#1d4e89", "#1ea7e1", "#f6a623", "#7be295", "#c0392b", "#7f8c8d"];

export function ProducerDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["producer-report"],
    queryFn: async () => (await api.get<ProducerReportDto>("/reports/producer")).data
  });
  const self = useQuery({
    queryKey: ["producer-self-summary"],
    queryFn: async () => (await api.get<SelfSummaryDto>("/producer/me/summary")).data
  });
  const myLines = useQuery({
    queryKey: ["producer-self-commissions"],
    queryFn: async () => (await api.get<MyRunLineDto[]>("/producer/me/commissions")).data
  });

  if (q.isLoading || !q.data) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  const r = q.data;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("producerDashboard.welcome", { name: user?.firstName })}
          </Typography>
          <Typography color="text.secondary">
            {r.producerName} · {r.producerCode}
          </Typography>
        </Box>
      </Stack>

      {/* KPI tiles */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, mb: 3 }}>
        <Kpi label={t("producerDashboard.kpi.customers")} value={num(r.kpis.customers)} />
        <Kpi label={t("producerDashboard.kpi.activePolicies")} value={num(r.kpis.activePolicies)} />
        <Kpi label={t("producerDashboard.kpi.expiringSoon")} value={num(r.kpis.expiringSoon)}
          accent={r.kpis.expiringSoon > 0 ? "warning" : undefined} />
        <Kpi label={t("producerDashboard.kpi.monthlyPremium")}
          value={money(r.kpis.monthlyPremium)} />
        <Kpi label={t("producerDashboard.kpi.renewalsYear")} value={num(r.kpis.renewalsThisYear)} />
      </Box>

      {/* My commission section (from /api/producer/me) */}
      {self.data && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>{t("producerDashboard.myCommissions")}</Typography>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 2 }}>
              <Kpi label={t("producerDashboard.kpi.commissionMtd")} value={money(self.data.commissionMtd)} />
              <Kpi label={t("producerDashboard.kpi.commissionYtd")} value={money(self.data.commissionYtd)} />
              <Kpi label={t("producerDashboard.kpi.overCommissionYtd")} value={money(self.data.overCommissionYtd)} />
              <Kpi label={t("producerDashboard.kpi.premiumYtd")} value={money(self.data.premiumYtd)} />
            </Box>

            {(myLines.data ?? []).length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={3}>{t("producerDashboard.noCommissionLines")}</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>{t("producerDashboard.runPeriod")}</TableCell>
                    <TableCell>{t("policies.col.number")}</TableCell>
                    <TableCell>{t("policies.col.carrier")}</TableCell>
                    <TableCell>{t("policies.col.type")}</TableCell>
                    <TableCell align="right">{t("producerDashboard.premium")}</TableCell>
                    <TableCell align="right">{t("producerDashboard.rate")}</TableCell>
                    <TableCell align="right">{t("producerDashboard.commission")}</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {(myLines.data ?? []).slice(0, 20).map(l => (
                      <TableRow key={l.lineId} hover sx={l.isOverCommission ? { bgcolor: "rgba(246,166,35,0.08)" } : undefined}>
                        <TableCell>{l.year}-{l.month.toString().padStart(2, "0")} <Typography variant="caption" color="text.secondary">· {l.runTitle}</Typography></TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{l.policyNumber}</TableCell>
                        <TableCell>{l.insuranceCompanyName}</TableCell>
                        <TableCell>
                          {t(`policyType.${l.policyType}`)}
                          {l.isOverCommission && <Chip label={`OVR L${l.overCommissionLevel}`} size="small" color="warning" sx={{ ml: 0.5, height: 18 }} />}
                          {l.onBehalfOfProducerName && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{l.onBehalfOfProducerName}</Typography>}
                        </TableCell>
                        <TableCell align="right">{money(l.premium)}</TableCell>
                        <TableCell align="right">{l.ratePercent.toFixed(2)}%</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>{money(l.commissionAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly production line */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("producerDashboard.chart.production")}</Typography>
          <Box sx={{ height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={r.monthlyPremium}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                <XAxis dataKey="label" stroke="#456079" fontSize={12} />
                <YAxis stroke="#456079" fontSize={12} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Line type="monotone" dataKey="value" stroke="#0b2545" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, mb: 3 }}>
        <ChartCard title={t("producerDashboard.chart.byType")} data={r.policiesByType} kind="pie" labelMap="policies.types" />
        <ChartCard title={t("producerDashboard.chart.byStatus")} data={r.policiesByStatus} kind="bar" labelMap="policies.statuses" />
      </Box>

      {/* Carrier breakdown */}
      {r.carrierBreakdown.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("producerDashboard.chart.carriers")}</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={r.carrierBreakdown} layout="vertical" margin={{ left: 20, right: 20 }}>
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
      )}

      {/* Expiring soon table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("producerDashboard.expiringList")}</Typography>
          {r.expiringSoon.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>{t("producerDashboard.noExpiring")}</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("policies.col.number")}</TableCell>
                    <TableCell>{t("policies.col.customer")}</TableCell>
                    <TableCell>{t("policies.col.type")}</TableCell>
                    <TableCell>{t("policies.col.carrier")}</TableCell>
                    <TableCell align="right">{t("policies.col.premium")}</TableCell>
                    <TableCell>{t("producerDashboard.endsOn")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.expiringSoon.map((p) => {
                    const days = Math.ceil((new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <TableRow key={p.id} hover>
                        <TableCell><Chip label={p.policyNumber} size="small" variant="outlined" /></TableCell>
                        <TableCell><Typography fontWeight={600}>{p.customerDisplay}</Typography></TableCell>
                        <TableCell>{t(`policies.types.${p.type}`)}</TableCell>
                        <TableCell>{p.carrierName}</TableCell>
                        <TableCell align="right">
                          {money(p.premium)}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography>{p.endDate}</Typography>
                            <Chip
                              size="small"
                              label={t("policies.expiresIn", { days })}
                              color={days <= 7 ? "error" : "warning"}
                            />
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <ProducerDeclarationFormSection />
    </Box>
  );
}

function ProducerDeclarationFormSection() {
  return <ProducerDeclarationForm />;
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
