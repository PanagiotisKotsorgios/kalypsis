import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Tooltip as MuiTooltip, Typography
} from "@mui/material";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import CalculateIcon from "@mui/icons-material/Calculate";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { api } from "../api/client";
import { ExportButton } from "../components/ExportButton";
import { money, date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

const KINDS = ["CustomerCharge","CustomerCredit","PartnerCharge","PartnerCredit","CompanyCharge","CompanyCredit","CommissionEarned","OverCommissionEarned","Adjustment"] as const;
type Kind = typeof KINDS[number];

const FINANCIAL_TOOLS = [
  // Trimmed per request: Ταμείο, Γενική λογιστική, ΚΕΠΥΟ and Μαγνητικά
  // αρχεία are removed from the hub grid. Their /app routes stay live for
  // deep-links, but the hub only surfaces the tools tenants actually reach
  // through this screen day-to-day.
  { to: "/app/advance-payments", label: "Προκαταβολές", detail: "Προκαταβολές πελατών και συμψηφισμοί", icon: <SavingsOutlinedIcon /> },
  { to: "/app/reconciliation", label: "Συμφωνία κινήσεων", detail: "Έλεγχος εισπράξεων και εκκρεμοτήτων", icon: <CompareArrowsIcon /> },
  { to: "/app/accounting", label: "Εξαγωγές λογιστικής", detail: "Αρχεία και παραδόσεις προς λογιστήριο", icon: <CalculateIcon /> }
];

interface MovementDto {
  id: string; movementDate: string; kind: Kind; amount: number; currency: string;
  description: string | null;
  policyId: string | null; policyNumber: string | null;
  customerId: string | null; customerName: string | null;
  producerId: string | null; producerName: string | null;
  insuranceCompanyId: string | null; insuranceCompanyName: string | null;
  receiptId: string | null; paymentId: string | null;
}

interface SummaryDto {
  year: number; totalReceipts: number; totalPayments: number; commissionsEarned: number;
  partnerCharges: number; companyCharges: number; monthly: { month: number; receipts: number; payments: number; }[];
}

// Bridge writes descriptions like:
//   "[bridge:BRG-XXXX:CommissionEarned] Bridge agency commission for policy 02078092291"
// which reads as machine output. Humanize into a short Greek label and
// keep the raw text on a tooltip so the operator can still see the tag.
function humanizeMovementDesc(desc: string | null): { label: string; raw: string } {
  const raw = desc ?? "";
  const m = /^\[bridge:[^:]+:([^\]]+)\]\s*(.*)$/i.exec(raw);
  if (!m) return { label: raw || "—", raw };
  const [, kindRaw, rest] = m;
  const policy = /for policy\s+([^\s]+)/i.exec(rest)?.[1]
    ?? /cancellation\s+([^\s]+)/i.exec(rest)?.[1]
    ?? "";
  const isReversal = /reversal|cancellation/i.test(rest);
  const kindLabel =
    /commission/i.test(kindRaw) ? (isReversal ? "Αναστροφή προμήθειας" : "Προμήθεια γραφείου")
    : /customercharge|charge/i.test(kindRaw) ? "Χρέωση πελάτη"
    : /adjust|cancel/i.test(kindRaw) ? "Ακύρωση συμβολαίου"
    : rest || raw;
  return { label: policy ? `${kindLabel} · συμβ. ${policy}` : kindLabel, raw };
}

export function FinancialMovementsPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(new Date().getFullYear());
  const [kind, setKind] = useState<Kind | "">("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const q = useQuery({
    queryKey: ["financial-movements", year, kind],
    queryFn: async () => (await api.get<MovementDto[]>("/financial-movements", {
      params: { from: `${year}-01-01`, to: `${year}-12-31`, kind: kind || undefined }
    })).data
  });

  const summary = useQuery({
    queryKey: ["financial-summary", year],
    queryFn: async () => (await api.get<SummaryDto>("/financial-movements/summary", { params: { year } })).data
  });

  const chart = useMemo(() => (summary.data?.monthly ?? []).map(m =>
    ({ name: ["Ι","Φ","Μ","Α","Μ","Ι","Ι","Α","Σ","Ο","Ν","Δ"][m.month - 1], receipts: m.receipts, payments: m.payments })),
    [summary.data]);

  // Enrich + client-side filter — humanized description text feeds both
  // the search hay and the on-screen label.
  const enriched = useMemo(() =>
    (q.data ?? []).map(m => ({ ...m, friendly: humanizeMovementDesc(m.description) })),
  [q.data]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return enriched.filter(m => {
      if (needle) {
        const hay = `${m.friendly.label} ${m.description ?? ""} ${m.customerName ?? ""} ${m.producerName ?? ""} ${m.insuranceCompanyName ?? ""} ${m.policyNumber ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (fromDate && m.movementDate < fromDate) return false;
      if (toDate && m.movementDate > toDate) return false;
      return true;
    });
  }, [enriched, search, fromDate, toDate]);
  useEffect(() => { setPage(0); }, [search, fromDate, toDate, kind, year]);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("financials.title")}</Typography>
          <Typography color="text.secondary">{t("financials.subtitle")}</Typography></Box>
        <ExportButton href={`/api/exports/financial-movements.csv?year=${year}`} />
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Οι γέφυρες εταιρειών ενημερώνουν αυτόματα τις χρεώσεις και τις προμήθειες. Όταν η πηγή δηλώνει ρητά ότι ένα συμβόλαιο εξοφλήθηκε, δημιουργείται και είσπραξη σε πραγματικό χρόνο.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography fontWeight={800} mb={0.5}>Κέντρο οικονομικών και λογιστικής</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Οι δευτερεύουσες οικονομικές και λογιστικές εργασίες συγκεντρώθηκαν εδώ. Οι σελίδες και τα δεδομένα τους παραμένουν ακριβώς τα ίδια.
          </Typography>
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
            {FINANCIAL_TOOLS.map(tool => (
              <Button key={tool.to} component={RouterLink} to={tool.to} variant="outlined" color="inherit"
                startIcon={tool.icon} sx={{ justifyContent: "flex-start", alignItems: "flex-start", minHeight: 74, px: 1.5, textAlign: "left" }}>
                <Box>
                  <Typography component="span" display="block" fontWeight={800}>{tool.label}</Typography>
                  <Typography component="span" display="block" variant="caption" color="text.secondary" sx={{ whiteSpace: "normal" }}>{tool.detail}</Typography>
                </Box>
              </Button>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        <Card sx={{ flex: 1 }}><CardContent>
          <Typography variant="overline" color="text.secondary">{t("financials.kpis.receipts")}</Typography>
          <Typography variant="h4" fontWeight={800} color="success.main">{money(summary.data?.totalReceipts ?? 0)}</Typography>
        </CardContent></Card>
        <Card sx={{ flex: 1 }}><CardContent>
          <Typography variant="overline" color="text.secondary">{t("financials.kpis.payments")}</Typography>
          <Typography variant="h4" fontWeight={800} color="error.main">{money(summary.data?.totalPayments ?? 0)}</Typography>
        </CardContent></Card>
        <Card sx={{ flex: 1 }}><CardContent>
          <Typography variant="overline" color="text.secondary">{t("financials.kpis.commissions")}</Typography>
          <Typography variant="h4" fontWeight={800} color="primary.main">{money(summary.data?.commissionsEarned ?? 0)}</Typography>
        </CardContent></Card>
      </Stack>

      <Card sx={{ mb: 3 }}><CardContent>
        <Typography variant="overline" color="text.secondary">{t("financials.monthlyChart")}</Typography>
        <Box sx={{ width: "100%", height: 280, mt: 1 }}>
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="receipts" fill="#2e7d32" name={t("financials.kpis.receipts")} />
              <Bar dataKey="payments" fill="#c62828" name={t("financials.kpis.payments")} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent></Card>

      {/* Filter card — mirrors the pattern used on the other list pages.
          The year + kind selectors moved from the header into the grid so
          they wrap alongside search + date-window controls. */}
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "center",
        }}>
          <TextField size="small" placeholder="Αναζήτηση: πελάτης, συνεργάτης, συμβόλαιο, περιγραφή…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ gridColumn: { md: "span 2" } }} />
          <SearchableTextField size="small" label={t("financials.year")} fullWidth value={year}
            onChange={e => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y =>
              <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" label={t("financials.kind")} fullWidth value={kind}
            onChange={e => setKind(e.target.value as Kind | "")}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {KINDS.map(k => <MenuItem key={k} value={k}>{t(`financials.kindLabel.${k}`)}</MenuItem>)}
          </SearchableTextField>
          <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} fullWidth
            value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} fullWidth
            value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => { setSearch(""); setKind(""); setFromDate(""); setToDate(""); }}
            sx={{ gridColumn: { md: "span 2" } }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </Card>

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("financials.date")}</TableCell>
              <TableCell>{t("financials.kind")}</TableCell>
              <TableCell>{t("financials.refs")}</TableCell>
              <TableCell>{t("common.description")}</TableCell>
              <TableCell align="right">{t("financials.amount")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("financials.empty")}</TableCell></TableRow>
              )}
              {paged.map(m => (
                <TableRow key={m.id} hover>
                  <TableCell>{date(m.movementDate)}</TableCell>
                  <TableCell><Chip label={t(`financials.kindLabel.${m.kind}`)} size="small" /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                      {m.customerName && <Chip label={m.customerName} size="small" variant="outlined" />}
                      {m.producerName && <Chip label={m.producerName} size="small" variant="outlined" />}
                      {m.insuranceCompanyName && <Chip label={m.insuranceCompanyName} size="small" variant="outlined" />}
                      {m.policyNumber && <Chip label={m.policyNumber} size="small" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <MuiTooltip title={m.friendly.raw || ""} placement="top-start">
                      <Typography variant="body2" sx={{ cursor: m.friendly.raw ? "help" : "default" }}>
                        {m.friendly.label}
                      </Typography>
                    </MuiTooltip>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(m.amount, m.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={ev => { setRowsPerPage(parseInt(ev.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100, 250]}
            labelRowsPerPage="Ανά σελίδα"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
          />
        </Card>
      )}
    </Box>
  );
}
