import { useId, useMemo, useState, type ReactNode } from "react";
import { Alert, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip as MuiTooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Area, Bar, Brush, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { labelledPoints, monthlyAnalytics, type AgencyAnalyticsReport, type AnalyticsPoint } from "./agencyAnalyticsModel";
import { presetTrendRange, trendRangeError, type TrendRange } from "./productionTrendPeriod";

const euros = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const integers = new Intl.NumberFormat("el-GR");
const palette = ["#087CEB", "#149B8B", "#7064BD", "#456B91", "#D58A24", "#CA4C60"];
const stateColors: Record<string,string> = { "Ενεργό": "#159B59", "Ακυρωμένο": "#D93547", "Έληξε": "#8292A6", "Προς ανανέωση": "#D58A24", "Πιθανό": "#D58A24", "Κλειστή": "#159B59", "Απορρίφθηκε": "#D93547" };
const compactMoney = (value: number) => `${new Intl.NumberFormat("el-GR", { notation: "compact", maximumFractionDigits: 1 }).format(value)} €`;

export function AgencyAnalyticsPanel({ collapsible = false }: { collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(!collapsible);
  const [live, setLive] = useState(true);
  const queryClient = useQueryClient();
  const query = useQuery<AgencyAnalyticsReport>({
    queryKey: ["report", "agency"], enabled: expanded,
    queryFn: async () => (await api.get("/reports/agency")).data,
    staleTime: 30_000, refetchInterval: live && expanded ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  if (!expanded) return <Button fullWidth variant="outlined" startIcon={<InsightsOutlinedIcon />} endIcon={<ExpandMoreIcon />} aria-expanded={false} aria-controls="agency-analytics-content" onClick={() => setExpanded(true)}
    sx={{ mb: 3, py: 1.5, px: 2, justifyContent: "flex-start", bgcolor: "background.paper", border: "2px solid", borderColor: "#7890AC", fontWeight: 800, textAlign: "left", "& .MuiButton-endIcon": { ml: "auto", pl: 1 }, "&:hover": { border: "2px solid #456B91", bgcolor: "action.hover" } }}>Στατιστικά & γραφήματα · Προβολή αναλύσεων</Button>;
  return <Box id="agency-analytics-content" sx={{ mb: 3, minWidth: 0 }} data-agency-analytics>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1.25} alignItems="center" sx={{ mb: 1.5 }}>
      <InsightsOutlinedIcon color="primary" /><Typography fontWeight={800}>Στατιστικά & γραφήματα</Typography>
      <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={live} onChange={event => setLive(event.target.checked)} />} label={<Typography variant="caption">Ανανέωση ανά 60″</Typography>} />
      <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">{query.isFetching ? "Ενημέρωση…" : query.dataUpdatedAt ? `Ενημερώθηκε ${new Date(query.dataUpdatedAt).toLocaleTimeString("el-GR")}` : ""}</Typography>
      <Button size="small" variant="outlined" startIcon={<RefreshIcon />} disabled={query.isFetching} onClick={() => { void query.refetch(); void queryClient.invalidateQueries({ queryKey: ["report", "agency", "trend"] }); }}>Ανανέωση</Button>
      {collapsible && <Button size="small" variant="contained" color="error" endIcon={<ExpandMoreIcon sx={{ transform: "rotate(180deg)" }} />} aria-expanded={true} aria-controls="agency-analytics-content" sx={{ color: "#fff" }} onClick={() => setExpanded(false)}>Απόκρυψη</Button>}
    </Stack>
    {query.isError && <Alert severity="error" sx={{ mb: 1 }}>{query.data ? "Η ανανέωση απέτυχε. Προβάλλονται τα τελευταία διαθέσιμα δεδομένα. " : ""}{extractErrorMessage(query.error)}</Alert>}
    {query.isLoading && <Typography role="status" sx={{ py: 4 }}>Φόρτωση αναλύσεων…</Typography>}
    {query.data && <AgencyAnalyticsView report={query.data} live={live} />}
  </Box>;
}

export function AgencyAnalyticsView({ report, live = false }: { report: AgencyAnalyticsReport; live?: boolean }) {
  const [period, setPeriod] = useState("6");
  const [range, setRange] = useState<TrendRange>(() => presetTrendRange(6));
  const [draft, setDraft] = useState<TrendRange>(() => presetTrendRange(12));
  const [applied, setApplied] = useState(false);
  const custom = period === "custom";
  const rangeError = trendRangeError(draft);
  const remote = !["3", "6"].includes(period) && (!custom || applied);
  const trend = useQuery<AnalyticsPoint[]>({
    queryKey: ["report", "agency", "trend", range.from, range.to],
    enabled: remote,
    queryFn: async () => (await api.get("/reports/agency/trend", { params: range })).data,
    staleTime: 30_000, refetchInterval: live && remote ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const [mode, setMode] = useState("area");
  const [average, setAverage] = useState(true);
  const source = remote ? trend.data ?? [] : custom ? [] : report.monthlyPremium ?? [];
  const analysis = useMemo(() => monthlyAnalytics(source, remote ? 120 : Number(period) || 120), [source, period, remote]);
  const trendRows = analysis.series.map(point => [point.month, euros.format(point.value), point.movingAverage === null ? "—" : euros.format(point.movingAverage), euros.format(point.cumulative)]);
  const trendToolbar = <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: 1.5, pt: .75 }}>
    <TextField select size="small" label="Περίοδος τάσης" value={period} onChange={event => {
      const value = event.target.value; setPeriod(value);
      if (value !== "custom") { setRange(presetTrendRange(Number(value))); setApplied(false); }
    }} sx={{ minWidth: 185 }}>
      <MenuItem value="3">Τελευταίοι 3 μήνες</MenuItem><MenuItem value="6">Τελευταίοι 6 μήνες</MenuItem>
      <MenuItem value="12">Τελευταίοι 12 μήνες</MenuItem><MenuItem value="24">Τελευταία 2 έτη</MenuItem>
      <MenuItem value="60">Τελευταία 5 έτη</MenuItem><MenuItem value="120">Τελευταία 10 έτη</MenuItem>
      <MenuItem value="custom">Χειροκίνητη περίοδος</MenuItem>
    </TextField>
    {custom && <>
      <TextField size="small" type="date" label="Από" value={draft.from} onChange={event => setDraft(value => ({ ...value, from: event.target.value }))} InputLabelProps={{ shrink: true }} sx={{ width: 165 }} />
      <TextField size="small" type="date" label="Έως" value={draft.to} onChange={event => setDraft(value => ({ ...value, to: event.target.value }))} InputLabelProps={{ shrink: true }} sx={{ width: 165 }} />
      <Button variant="contained" disabled={Boolean(rangeError)} onClick={() => { setRange({ ...draft }); setApplied(true); }}>Εφαρμογή περιόδου</Button>
      {rangeError && <Typography color="error" variant="caption" role="status" sx={{ flexBasis: "100%" }}>{rangeError}</Typography>}
    </>}
    <TextField select size="small" label="Απεικόνιση" value={mode} onChange={event => setMode(event.target.value)} sx={{ minWidth: 140 }}><MenuItem value="area">Καμπύλη</MenuItem><MenuItem value="bar">Στήλες</MenuItem></TextField>
    <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={average} onChange={event => setAverage(event.target.checked)} />} label={<Typography variant="caption">Κινητός μέσος 3 μηνών</Typography>} />
    {custom && !applied && <Typography variant="caption" sx={{ flexBasis: "100%" }}>Επιλέξτε ημερομηνίες και πατήστε «Εφαρμογή περιόδου».</Typography>}
    {remote && trend.isFetching && <Typography variant="caption" role="status" sx={{ flexBasis: "100%" }}>Φόρτωση επιλεγμένης περιόδου…</Typography>}
    {remote && trend.isError && <Alert severity="error" sx={{ width: "100%" }}>{extractErrorMessage(trend.error)} <Button onClick={() => void trend.refetch()}>Επανάληψη</Button></Alert>}
    {remote && <Typography variant="caption" color="text.secondary" sx={{ flexBasis: "100%" }}>Επιλεγμένη περίοδος: {range.from.split("-").reverse().join("/")} – {range.to.split("-").reverse().join("/")}</Typography>}
  </Stack>;
  const snapshot = (title: string, points: AnalyticsPoint[], type: "donut" | "bar", index: number) => {
    const values = labelledPoints(points);
    return <AnalyticsCard key={title} title={title} index={index} subtitle="Τρέχουσα εικόνα χαρτοφυλακίου · πλήθος εγγραφών"
      headers={["Κατηγορία", "Πλήθος", "Ποσοστό"]} rows={values.map(point => [point.label, integers.format(point.value), `${(values.reduce((sum,item)=>sum+item.value,0) ? point.value / values.reduce((sum,item)=>sum+item.value,0) * 100 : 0).toFixed(1)}%`])}
      chart={() => <DistributionChart points={values} kind={type} />} />;
  };
  return <Box sx={{ minWidth: 0 }}>
    <AnalyticsCard title="Πορεία παραγωγής" subtitle="Ασφάλιστρα ανά μήνα έναρξης · σύρετε την κάτω μπάρα για επιλογή εύρους" index={0}
      toolbar={trendToolbar} headers={["Μήνας", "Ασφάλιστρα", "Κινητός μέσος 3 μηνών", "Συσσωρευμένα"]} rows={trendRows}
      chart={() => <TrendChart data={analysis.series} mode={mode} average={average} mean={analysis.mean} />}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Μέσος μήνας: {analysis.mean === null ? "—" : euros.format(analysis.mean)} · Τυπική απόκλιση μηνών: {analysis.deviation === null ? "—" : euros.format(analysis.deviation)} · Μεταβολή πρώτου–τελευταίου μήνα: {analysis.change === null ? "—" : `${analysis.change.toFixed(1)}%`}
      </Typography>
    </AnalyticsCard>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "repeat(2,minmax(0,1fr))" }, gap: 1.5, mt: 1.5 }}>
      {snapshot("Συμβόλαια ανά κατάσταση", report.policiesByStatus ?? [], "donut", 1)}
      {snapshot("Κλάδοι ασφάλισης", report.policiesByType ?? [], "bar", 2)}
      <AnalyticsCard title="Κορυφαίες ασφαλιστικές" subtitle="Ενεργά συμβόλαια · οι έως 6 εταιρείες που επιστρέφει η αναφορά" index={3}
        headers={["Ασφαλιστική", "Ασφάλιστρα", "Συμβόλαια"]} rows={(report.topCarriers ?? []).map(row => [row.carrier, euros.format(row.premium), integers.format(row.policies)])}
        chart={() => <CarrierChart data={report.topCarriers ?? []} />} />
      {snapshot("Ζημιές ανά κατάσταση", report.claimsByStatus ?? [], "donut", 4)}
      {report.requestsByStatus && snapshot("Αιτήματα ανά κατάσταση", report.requestsByStatus, "bar", 5)}
    </Box>
  </Box>;
}

function AnalyticsCard({ title, subtitle, toolbar, chart, headers, rows, index, children }: {
  title: string; subtitle: string; toolbar?: ReactNode; chart: () => ReactNode; headers: string[]; rows: string[][]; index: number; children?: ReactNode;
}) {
  const [full, setFull] = useState(false);
  const [table, setTable] = useState(false);
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const content = (large = false) => <>
    {toolbar}
    {table ? <Box role="region" tabIndex={0} aria-label={`${title} — δεδομένα`} sx={{ overflow: "auto", maxHeight: large ? "65dvh" : 320 }}>
      <Table size="small" stickyHeader sx={{ minWidth: 380, "& td, & th": { fontSize: 13, py: .75 }, "& tbody tr:nth-of-type(even)": { bgcolor: dark ? "#1B3046" : "#F0F2F5" } }}>
        <TableHead><TableRow>{headers.map(header => <TableCell key={header}>{header}</TableCell>)}</TableRow></TableHead>
        <TableBody>{rows.map((row,i) => <TableRow key={i}>{row.map((cell,j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </Box> : <Box sx={{ height: large ? "min(65dvh,650px)" : 300, minHeight: 240, minWidth: 0 }}>
      {rows.length ? chart() : <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}><Typography color="text.secondary">Δεν υπάρχουν καταχωρημένα δεδομένα.</Typography></Box>}
    </Box>}
    {children}
  </>;
  const toggle = <Button size="small" sx={{ bgcolor: dark ? "#34465B" : "#E2E6EB", color: dark ? "#fff" : "#102D55", "&:hover": { bgcolor: dark ? "#435A73" : "#CFD6DF" } }} startIcon={table ? <ShowChartIcon /> : <TableChartOutlinedIcon />} onClick={() => setTable(value => !value)}>{table ? "Γράφημα" : "Δεδομένα"}</Button>;
  return <Card variant="outlined" data-analytics-chart={title} sx={{ p: { xs: 1.25, sm: 2 }, minWidth: 0, borderRadius: 2.5, bgcolor: dark ? "#15263A" : "#F8FAFC", borderColor: dark ? "#344E6B" : "#D5E0EC", boxShadow: "0 5px 22px rgba(16,44,85,.05)",
    animation: "analyticsIn 450ms ease both", animationDelay: `${index*45}ms`, "@keyframes analyticsIn": { from: { opacity: 0, transform: "translateY(7px)" }, to: { opacity: 1, transform: "none" } }, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
      <Box sx={{ flex: "1 1 180px", minWidth: 0 }}><Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{title}</Typography><Typography variant="caption" color="text.secondary">{subtitle}</Typography></Box>
      {toggle}<MuiTooltip title="Μεγέθυνση γραφήματος"><IconButton aria-label={`Μεγέθυνση ${title}`} onClick={() => setFull(true)} size="small"><OpenInFullIcon fontSize="small" /></IconButton></MuiTooltip>
    </Stack>
    {content()}
    <Dialog open={full} onClose={() => setFull(false)} fullWidth maxWidth="xl" PaperProps={{ sx: { m: 1, width: "calc(100% - 16px)", maxHeight: "calc(100dvh - 16px)" } }}>
      <DialogTitle>{title}</DialogTitle><DialogContent dividers>{content(true)}</DialogContent>
      <DialogActions>{toggle}<Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setFull(false)}>Κλείσιμο</Button></DialogActions>
    </Dialog>
  </Card>;
}

function useChartStyle() {
  const theme = useTheme();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  return { animation: !reduced, grid: theme.palette.divider, text: theme.palette.text.secondary,
    tooltip: { background: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(16,44,85,.15)", fontSize: 13 } };
}

function TrendChart({ data, mode, average, mean }: { data: ReturnType<typeof monthlyAnalytics>["series"]; mode: string; average: boolean; mean: number | null }) {
  const id = useId().replace(/:/g, "");
  const style = useChartStyle();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  return <ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <ComposedChart data={data} margin={{ top: 14, right: 4, left: 0, bottom: 0 }} accessibilityLayer>
      <defs><linearGradient id={`trend-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#087CEB" stopOpacity={.35} /><stop offset="100%" stopColor="#087CEB" stopOpacity={.02} /></linearGradient></defs>
      <CartesianGrid stroke={style.grid} strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="month" stroke={style.text} tickLine={false} axisLine={false} fontSize={11} minTickGap={20} />
      <YAxis yAxisId="premium" width={64} stroke={style.text} tickLine={false} axisLine={false} fontSize={11} tickFormatter={compactMoney} />
      <YAxis yAxisId="total" orientation="right" width={64} tickFormatter={compactMoney} stroke="#7064BD" fontSize={11} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={style.tooltip} formatter={(value, name) => [euros.format(Number(value)), name]} labelStyle={{ fontWeight: 800 }} />
      <Legend wrapperStyle={{ fontSize: 12, cursor: "pointer" }} onClick={entry => { const key = String(entry.dataKey); setHidden(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }} />
      {mean !== null && <ReferenceLine yAxisId="premium" y={mean} stroke="#8292A6" strokeDasharray="4 4" />}
      {mode === "area" ? <Area yAxisId="premium" type="monotone" dataKey="value" name="Ασφάλιστρα" stroke="#087CEB" fill={`url(#trend-${id})`} strokeWidth={2.5} activeDot={{ r: 6 }} hide={hidden.has("value")} isAnimationActive={style.animation} animationDuration={650} />
        : <Bar yAxisId="premium" dataKey="value" name="Ασφάλιστρα" fill="#087CEB" radius={[5,5,0,0]} hide={hidden.has("value")} isAnimationActive={style.animation} animationDuration={650} />}
      {average && <Line yAxisId="premium" type="monotone" dataKey="movingAverage" name="Κινητός μέσος 3 μηνών" stroke="#149B8B" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 3" hide={hidden.has("movingAverage")} isAnimationActive={style.animation} animationDuration={650} />}
      <Line yAxisId="total" type="monotone" dataKey="cumulative" name="Συσσωρευμένα (δεξιά κλίμακα)" stroke="#7064BD" strokeWidth={2} dot={false} hide={hidden.has("cumulative")} isAnimationActive={style.animation} animationDuration={650} />
      {data.length > 1 && <Brush dataKey="month" height={22} travellerWidth={9} stroke="#456B91" fill="#EDF2F7" />}
    </ComposedChart>
  </ResponsiveContainer>;
}

function DistributionChart({ points, kind }: { points: AnalyticsPoint[]; kind: "donut" | "bar" }) {
  const style = useChartStyle();
  const [selected, setSelected] = useState("");
  const total = points.reduce((sum,point)=>sum+point.value,0);
  if (total === 0) return <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}><Typography color="text.secondary">Δεν υπάρχουν εγγραφές στην αναφορά.</Typography></Box>;
  const tooltip = <Tooltip contentStyle={style.tooltip} formatter={value => integers.format(Number(value))} />;
  return <ResponsiveContainer width="100%" height="100%" minWidth={0}>
    {kind === "donut" ? <PieChart accessibilityLayer>
      {tooltip}<Legend wrapperStyle={{ fontSize: 12, cursor: "pointer" }} onClick={entry => setSelected(value => value === String(entry.value) ? "" : String(entry.value))} />
      <Pie data={points} dataKey="value" nameKey="label" cx="50%" cy="44%" innerRadius="49%" outerRadius="72%" paddingAngle={2} cornerRadius={4}
        onClick={(_,index)=>setSelected(value=>value===points[index]?.label ? "" : points[index]?.label??"")} isAnimationActive={style.animation} animationDuration={700}>
        {points.map((point,index)=><Cell key={point.label} fill={stateColors[point.label]??palette[index%palette.length]} opacity={selected&&selected!==point.label ? .25 : 1} />)}
      </Pie>
      <text x="50%" y="40%" textAnchor="middle" fill={style.text} fontSize={22} fontWeight={800}>{integers.format(total)}</text>
      <text x="50%" y="49%" textAnchor="middle" fill={style.text} fontSize={11}>εγγραφές</text>
    </PieChart> : <ComposedChart data={points} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 8 }} accessibilityLayer>
      <CartesianGrid stroke={style.grid} strokeDasharray="3 5" horizontal={false} />{tooltip}
      <XAxis type="number" allowDecimals={false} fontSize={11} stroke={style.text} /><YAxis type="category" dataKey="label" width={108} fontSize={11} stroke={style.text} tickLine={false} axisLine={false} />
      <Bar dataKey="value" name="Εγγραφές" radius={[0,5,5,0]} maxBarSize={28} isAnimationActive={style.animation} animationDuration={700}>{points.map((point,index)=><Cell key={point.label} fill={stateColors[point.label]??palette[index%palette.length]} />)}</Bar>
    </ComposedChart>}
  </ResponsiveContainer>;
}

function CarrierChart({ data }: { data: AgencyAnalyticsReport["topCarriers"] }) {
  const style = useChartStyle();
  return <ResponsiveContainer width="100%" height="100%" minWidth={0}><ComposedChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 10 }} accessibilityLayer>
    <CartesianGrid stroke={style.grid} strokeDasharray="3 5" vertical={false} />
    <XAxis dataKey="carrier" fontSize={10} interval={0} height={48} tickFormatter={value=>String(value).length>13?`${String(value).slice(0,12)}…`:String(value)} stroke={style.text} />
    <YAxis yAxisId="money" width={62} tickFormatter={compactMoney} stroke={style.text} fontSize={11} />
    <YAxis yAxisId="count" orientation="right" allowDecimals={false} width={35} stroke="#7064BD" fontSize={11} />
    <Tooltip contentStyle={style.tooltip} formatter={(value,name)=>[name==="Συμβόλαια"?integers.format(Number(value)):euros.format(Number(value)),name]} />
    <Legend wrapperStyle={{ fontSize: 12 }} />
    <Bar yAxisId="money" dataKey="premium" name="Ασφάλιστρα" fill="#087CEB" radius={[5,5,0,0]} maxBarSize={36} isAnimationActive={style.animation} animationDuration={700} />
    <Line yAxisId="count" type="monotone" dataKey="policies" name="Συμβόλαια" stroke="#7064BD" strokeWidth={2} activeDot={{ r: 6 }} isAnimationActive={style.animation} animationDuration={700} />
  </ComposedChart></ResponsiveContainer>;
}
