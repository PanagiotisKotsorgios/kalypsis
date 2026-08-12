import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem,
  Stack, Switch, Table, TableBody, TableCell, TableFooter, TableHead, TableRow,
  TextField, Typography, FormControlLabel
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { FilterFieldWrap } from "../components/FilterHelp";
import {
  AnimatedKpiCard, ChartCard, ModernBarChart, ModernDonutChart,
} from "../components/ModernDashboard";
import PolicyIcon from "@mui/icons-material/Policy";
import EuroIcon from "@mui/icons-material/Euro";
import PaymentsIcon from "@mui/icons-material/Payments";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { useTheme } from "@mui/material/styles";

interface ProductionRow {
  groupKey: string;
  groupLabel: string;
  policyCount: number;
  newCount: number;
  renewalCount: number;
  grossPremium: number;
  netPremium: number;
  agencyCommission: number;
  producerCommission: number;
}
interface ProductionReportDto {
  rows: ProductionRow[];
  totals: ProductionRow;
  groupBy: string;
  from: string | null;
  to: string | null;
}

interface CarrierLite { id: string; name: string; }
interface ProducerLite { id: string; name: string; }

const POLICY_TYPES = ["Auto", "Home", "Health", "Life", "Business", "Travel", "Marine", "Other"] as const;
const POLICY_TYPE_LABEL: Record<string, string> = {
  Auto: "Οχήματα", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Marine: "Μεταφορές", Other: "Άλλο"
};

const GROUP_LABEL: Record<string, string> = {
  month:    "Ανά μήνα",
  carrier:  "Ανά εταιρεία",
  producer: "Ανά συνεργάτη",
  branch:   "Ανά κλάδο",
};

const eur = (n: number) => `€${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Λίστες Παραγωγής — the annual production report. Filter by period, carrier,
 * producer, branch; group by month / carrier / producer / branch; download CSV.
 * This is the single most-requested view for an insurance office running its
 * τέλος έτους review with the λογιστή.
 */
export function ProductionReportPage() {
  // Default window: current calendar year — offices default to ετήσια in
  // conversation, so make that the zero-config landing state.
  const y = new Date().getFullYear();
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(`${y}-12-31`);
  const [carrierId, setCarrierId] = useState("");
  const [producerId, setProducerId] = useState("");
  const [policyType, setPolicyType] = useState("");
  const [groupBy, setGroupBy] = useState<"month" | "carrier" | "producer" | "branch">("month");
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const carriers = useQuery({
    queryKey: ["insurance-companies", "used"],
    queryFn: async () => (await api.get<CarrierLite[]>("/insurance-companies?onlyUsed=true")).data,
  });
  const producers = useQuery({
    queryKey: ["producers", "lite"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data,
  });

  const params = useMemo(() => {
    const p: Record<string, string> = { groupBy };
    if (from) p.from = from;
    if (to) p.to = to;
    if (carrierId) p.carrierId = carrierId;
    if (producerId) p.producerId = producerId;
    if (policyType) p.policyType = policyType;
    if (includeCancelled) p.includeCancelled = "true";
    return p;
  }, [from, to, carrierId, producerId, policyType, groupBy, includeCancelled]);

  const report = useQuery({
    queryKey: ["reports-production", params],
    queryFn: async () =>
      (await api.get<ProductionReportDto>("/reports/production", { params })).data,
  });

  const downloadCsv = async () => {
    // Route through the axios client so the auth-header +
    // tenant-impersonation interceptors are applied — a raw fetch would
    // hit the endpoint unauthenticated and land on the login redirect.
    const res = await api.get<Blob>("/reports/production/export.csv", {
      params, responseType: "blob",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(res.data);
    a.download = `paragogi-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rows = report.data?.rows ?? [];
  const totals = report.data?.totals;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <FactCheckIcon />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Ετήσια Παραγωγή</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Ετήσια/περιοδική παραγωγή του γραφείου — φιλτράρετε ανά χρονικό διάστημα,
        εταιρεία, συνεργάτη ή κλάδο και εξάγετε σε CSV για τον λογιστή.
      </Typography>

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        {/* Responsive filter grid: 1 col on phones, 2 on tablets, 3 on desktop. */}
        <Box sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
          alignItems: "start",
        }}>
          <FilterFieldWrap tip="Ημερομηνία έναρξης του παραθύρου παραγωγής (start date του συμβολαίου).">
            <TextField label="Από" type="date" size="small" fullWidth
              value={from} onChange={e => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }} />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Ημερομηνία λήξης του παραθύρου παραγωγής.">
            <TextField label="Έως" type="date" size="small" fullWidth
              value={to} onChange={e => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }} />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Πώς θα αθροιστούν τα συμβόλαια — ανά μήνα, εταιρεία, συνεργάτη ή κλάδο.">
            <SearchableTextField size="small" label="Ομαδοποίηση" value={groupBy}
              onChange={e => setGroupBy(e.target.value as typeof groupBy)} fullWidth>
              {Object.entries(GROUP_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <SearchableSelect
            label="Ασφαλιστική εταιρεία" value={carrierId}
            onChange={setCarrierId}
            emptyLabel="Όλες"
            sx={{ width: "100%" }}
            options={(carriers.data ?? []).map(c => ({ value: c.id, label: c.name }))}
          />
          <SearchableSelect
            label="Συνεργάτης" value={producerId}
            onChange={setProducerId}
            emptyLabel="Όλοι"
            sx={{ width: "100%" }}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />
          <SearchableTextField size="small" label="Κλάδος" value={policyType}
            onChange={e => setPolicyType(e.target.value)} fullWidth>
            <MenuItem value="">Όλοι</MenuItem>
            {POLICY_TYPES.map(t => <MenuItem key={t} value={t}>{POLICY_TYPE_LABEL[t]}</MenuItem>)}
          </SearchableTextField>
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <FormControlLabel
            control={<Switch checked={includeCancelled}
              onChange={e => setIncludeCancelled(e.target.checked)} size="small" />}
            label="Να συμπεριληφθούν ακυρωμένα"
          />
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => {
              setFrom(`${y}-01-01`); setTo(`${y}-12-31`);
              setCarrierId(""); setProducerId(""); setPolicyType("");
              setGroupBy("month"); setIncludeCancelled(false);
            }} color="error" variant="contained">Καθαρισμός</Button>
            <Button size="small" variant="contained" startIcon={<DownloadIcon />}
              disabled={!rows.length} onClick={downloadCsv}>Εξαγωγή CSV</Button>
          </Stack>
        </Stack>
      </Card>

      {report.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Alert severity="info">Δεν βρέθηκαν συμβόλαια για τα φίλτρα που επιλέξατε.</Alert>
      ) : (
        <>
          <ChartPanel totals={totals ?? null} rows={rows} groupBy={groupBy} />

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{GROUP_LABEL[groupBy]}</TableCell>
                  <TableCell align="right">Συμβόλαια</TableCell>
                  <TableCell align="right">Νέα</TableCell>
                  <TableCell align="right">Ανανεώσεις</TableCell>
                  <TableCell align="right">Μικτό</TableCell>
                  <TableCell align="right">Καθαρό</TableCell>
                  <TableCell align="right">Προμήθεια γραφείου</TableCell>
                  <TableCell align="right">Προμήθεια συνεργατών</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.groupKey} hover>
                    <TableCell><b>{r.groupLabel}</b></TableCell>
                    <TableCell align="right">{r.policyCount}</TableCell>
                    <TableCell align="right"><Chip size="small" label={r.newCount} sx={{ height: 18, fontSize: 11 }} /></TableCell>
                    <TableCell align="right"><Chip size="small" variant="outlined" label={r.renewalCount} sx={{ height: 18, fontSize: 11 }} /></TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(r.grossPremium)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(r.netPremium)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main", fontWeight: 700 }}>{eur(r.agencyCommission)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(r.producerCommission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {totals && (
                <TableFooter>
                  <TableRow sx={{ "& td": { fontWeight: 800, borderTop: "2px solid", borderTopColor: "divider", color: "text.primary", fontSize: 14 } }}>
                    <TableCell>Σύνολο</TableCell>
                    <TableCell align="right">{totals.policyCount}</TableCell>
                    <TableCell align="right">{totals.newCount}</TableCell>
                    <TableCell align="right">{totals.renewalCount}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.grossPremium)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.netPremium)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main" }}>{eur(totals.agencyCommission)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(totals.producerCommission)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </Card>
        </>
      )}
    </Box>
  );
}

// Legacy Kpi kept for callers that still use it (this file no longer does —
// ChartPanel below owns the KPI + chart layout above the table).
function Kpi({ label, value, hint, accent }: {
  label: string; value: string; hint?: string; accent?: "success";
}) {
  return (
    <Card sx={{ borderLeft: accent ? "4px solid" : undefined, borderLeftColor: accent === "success" ? "success.main" : undefined }}>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>{label}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{value}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </CardContent>
    </Card>
  );
}
void Kpi;

/**
 * Chart-first summary strip for the production report. Row 1: 4 animated KPI
 * cards with count-up + trend delta feel. Row 2: two charts — gross-premium
 * bar per group + New vs Renewal donut. Uses the ModernDashboard components
 * so the look matches the main dashboards + hub minicharts.
 */
function ChartPanel({ totals, rows, groupBy }: {
  totals: ProductionRow | null;
  rows: ProductionRow[];
  groupBy: string;
}) {
  const theme = useTheme();
  const t = totals ?? { policyCount: 0, newCount: 0, renewalCount: 0,
    grossPremium: 0, netPremium: 0, agencyCommission: 0, producerCommission: 0 } as ProductionRow;

  // Bar chart: gross premium per group (month / carrier / producer / branch).
  // For long series (many months, many carriers) we cap to top 12 by gross
  // so the bars stay readable in the narrow strip above the table.
  const barSeries = [...rows]
    .sort((a, b) => b.grossPremium - a.grossPremium)
    .slice(0, 12)
    .map(r => ({ label: r.groupLabel, value: Number(r.grossPremium) }))
    // Restore ascending order by groupLabel when the axis is time-based, so
    // a 12-month chart reads left-to-right chronologically instead of
    // biggest-first.
    .sort((a, b) => groupBy === "month" ? a.label.localeCompare(b.label) : 0);

  const donutData = [
    { label: "Νέα",       value: t.newCount },
    { label: "Ανανεώσεις", value: t.renewalCount },
  ].filter(d => d.value > 0);

  return (
    <>
      <Box sx={{
        display: "grid", gap: 2, mb: 2,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <AnimatedKpiCard index={0} label="Συμβόλαια" value={t.policyCount}
          accent={theme.palette.primary.main} icon={<PolicyIcon />} />
        <AnimatedKpiCard index={1} label="Μικτό ασφάλιστρο" value={t.grossPremium} currency
          accent={theme.palette.secondary.main} icon={<EuroIcon />} />
        <AnimatedKpiCard index={2} label="Προμήθεια γραφείου" value={t.agencyCommission} currency
          accent="#16a34a" icon={<PaymentsIcon />} />
        <AnimatedKpiCard index={3} label="Προμήθεια συνεργατών" value={t.producerCommission} currency
          accent="#d97706" icon={<HandshakeIcon />} />
      </Box>
      <Box sx={{
        display: "grid", gap: 2, mb: 2,
        gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }
      }}>
        <ChartCard title={`Μικτό ασφάλιστρο ${GROUP_LABEL[groupBy] ?? ""}`.trim()}
          subtitle={rows.length > 12 ? "Top 12 ομάδες" : "Όλες οι ομάδες"}
          height={260}>
          <ModernBarChart
            data={barSeries}
            color={theme.palette.primary.main}
            format={(v) => `€${Math.round(v).toLocaleString("el-GR")}`}
          />
        </ChartCard>
        <ChartCard title="Νέα vs Ανανεώσεις" subtitle="Κατανομή συμβολαίων" height={260}>
          <ModernDonutChart
            data={donutData}
            colors={[theme.palette.primary.main, theme.palette.info.main]}
            format={(v) => v.toLocaleString("el-GR")}
          />
        </ChartCard>
      </Box>
    </>
  );
}
