import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { FinancialFilters } from "../components/FinancialFilters";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { TextField } from "@mui/material";
import { NumberedPager, RecordCountChip, TableToolbar } from "../components/TableToolbar";
import { CarrierCommissionReceiptsDialog, commissionAmount, type CarrierCommissionBalance } from "../components/CarrierCommissionReceiptsDialog";
import { PolicyDetailDrawer } from "../components/PolicyDetailDrawer";
import { date } from "../utils/format";

export function filterCarrierCommissions(rows: CarrierCommissionBalance[], filters: { search: string; company: string; status: string; from: string; to: string }) {
  const search = filters.search.trim().toLocaleLowerCase("el-GR");
  return rows.filter(row => (!filters.company || row.insuranceCompanyId === filters.company)
    && (!filters.from || row.startDate >= filters.from) && (!filters.to || row.startDate <= filters.to)
    && (!search || `${row.policyNumber} ${row.customerName} ${row.insuranceCompanyName}`.toLocaleLowerCase("el-GR").includes(search))
    && (!filters.status || (filters.status === "pending" ? row.outstanding > .005 : filters.status === "credit" ? row.credit > .005 : row.outstanding <= .005 && row.credit <= .005)));
}

export function carrierCommissionTotals(rows: CarrierCommissionBalance[]) {
  const totals = new Map<string, { currency: string; expected: number; received: number; outstanding: number; credit: number }>();
  for (const row of rows) {
    const current = totals.get(row.currency) ?? { currency: row.currency, expected: 0, received: 0, outstanding: 0, credit: 0 };
    current.expected += row.expected; current.received += row.received; current.outstanding += row.outstanding; current.credit += row.credit;
    totals.set(row.currency, current);
  }
  return [...totals.values()];
}

export function CarrierCommissionsPage() {
  const query = useQuery({ queryKey: ["carrier-commissions"], queryFn: async () => (await api.get<CarrierCommissionBalance[]>("/carrier-commissions")).data });
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const rows = useMemo(() => filterCarrierCommissions(query.data ?? [], { search, company, status, from, to }), [query.data, search, company, status, from, to]);
  const totals = useMemo(() => carrierCommissionTotals(rows), [rows]);
  const companies = useMemo(() => [...new Map((query.data ?? []).map(row => [row.insuranceCompanyId, row.insuranceCompanyName])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "el")), [query.data]);
  useEffect(() => setPage(1), [search, company, status, from, to, pageSize]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const columns = [
    { key: "policyNumber", label: "Συμβόλαιο" }, { key: "insuranceCompanyName", label: "Ασφαλιστική" },
    { key: "customerName", label: "Πελάτης" }, { key: "startDate", label: "Έναρξη", map: (row: CarrierCommissionBalance) => date(row.startDate) },
    { key: "currency", label: "Νόμισμα" }, { key: "expected", label: "Προμήθεια γραφείου" },
    { key: "received", label: "Καταβλήθηκαν" }, { key: "outstanding", label: "Μας οφείλει η ασφαλιστική" }, { key: "credit", label: "Υπερκαταβολή" },
  ];
  return <Box sx={{ minWidth: 0 }}>
    <Stack direction="row" gap={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 1.25 }}>
      <Typography variant="h6" fontWeight={800}>Προμήθειες ασφαλιστικών</Typography><RecordCountChip count={rows.length} />
    </Stack>
    {query.isError && <Alert severity="error" sx={{ mb: 1 }}>{extractErrorMessage(query.error)}</Alert>}
    <FinancialFilters title="Φίλτρα προμηθειών ασφαλιστικών" activeCount={[company, status, from, to].filter(Boolean).length}>
      <Stack direction="row" spacing={1}>
        <SearchableSelect label="Ασφαλιστική" value={company} onChange={setCompany} options={companies} emptyLabel="Όλες οι ασφαλιστικές" />
        <SearchableTextField label="Υπόλοιπο" value={status} onChange={e => setStatus(e.target.value)}>
          <MenuItem value="">Όλα</MenuItem><MenuItem value="pending">Μας οφείλει προμήθεια</MenuItem><MenuItem value="settled">Χωρίς υπόλοιπο</MenuItem><MenuItem value="credit">Υπερκαταβολή</MenuItem>
        </SearchableTextField>
        <TextField size="small" type="date" label="Έναρξη συμβολαίου από" value={from} InputLabelProps={{ shrink: true }} onChange={e => setFrom(e.target.value)} />
        <TextField size="small" type="date" label="Έναρξη συμβολαίου έως" value={to} InputLabelProps={{ shrink: true }} onChange={e => setTo(e.target.value)} />
        <Button variant="contained" color="error" onClick={() => { setCompany(""); setStatus(""); setFrom(""); setTo(""); setSearch(""); }}>Καθαρισμός</Button>
      </Stack>
    </FinancialFilters>
    <Stack direction="row" gap={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
      {totals.map(total => <Box key={total.currency} sx={{ p: 1, bgcolor: "#eaf0f5", border: "1px solid #9baec3", borderRadius: 1 }}>
        <Typography fontWeight={800}>{total.currency}</Typography>
        <Stack direction="row" gap={2} useFlexGap flexWrap="wrap" sx={{ fontSize: 13 }}>
          <span>Προμήθεια: <strong>{commissionAmount(total.expected, total.currency)}</strong></span>
          <span>Καταβλήθηκαν: <strong>{commissionAmount(total.received, total.currency)}</strong></span>
          <Box component="span" sx={{ bgcolor: total.outstanding > .005 ? "#c62828" : "#18754a", color: "#fff", borderRadius: .5, px: .75 }}>
            Μας οφείλουν: <strong>{commissionAmount(total.outstanding, total.currency)}</strong>
          </Box>
          {total.credit > .005 && <span>Υπερκαταβολές: <strong>{commissionAmount(total.credit, total.currency)}</strong></span>}
        </Stack>
      </Box>)}
    </Stack>
    <Card variant="outlined" sx={{ minWidth: 0, borderColor: "#a9b9ca" }}>
      <TableToolbar query={search} onQuery={setSearch} count={query.data?.length ?? 0} filteredCount={rows.length}
        pageSize={pageSize} onPageSize={setPageSize} exportRows={rows} exportColumns={columns}
        exportFileName="promitheies-asfalistikon" printTitle="Προμήθειες ασφαλιστικών" snapshotExport hideCount hidePageSize />
      {query.isLoading ? <Box sx={{ p: 3 }}><CircularProgress size={26} /></Box> : <TableContainer sx={{ maxHeight: "min(58dvh, 580px)", overflow: "auto" }}>
        <Table stickyHeader size="small" sx={{ minWidth: 1160, "& thead th": { bgcolor: "#e4eaf0", fontWeight: 800, color: "#102d55", whiteSpace: "nowrap" },
          "& tbody tr:nth-of-type(odd)": { bgcolor: "#f8fafc" }, "& tbody tr:nth-of-type(even)": { bgcolor: "#edf0f4" } }}>
          <TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Πελάτης</TableCell><TableCell>Έναρξη</TableCell>
            <TableCell align="right">Προμήθεια γραφείου</TableCell><TableCell align="right">Καταβλήθηκαν</TableCell><TableCell align="right">Μας οφείλει</TableCell><TableCell align="right">Υπερκαταβολή</TableCell><TableCell>Ενέργειες</TableCell>
          </TableRow></TableHead>
          <TableBody>{rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(row => <TableRow key={row.policyId} hover>
            <TableCell><Button size="small" sx={{ fontWeight: 800, textTransform: "none" }} onClick={() => setPolicyId(row.policyId)}>{row.policyNumber}</Button></TableCell>
            <TableCell>{row.insuranceCompanyName}</TableCell><TableCell>{row.customerName}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{date(row.startDate)}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{commissionAmount(row.expected, row.currency)}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap", color: "#18754a", fontWeight: 700 }}>{commissionAmount(row.received, row.currency)}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}><Box component="span" sx={{ px: .75, py: .4, borderRadius: .5, fontWeight: 800,
              ...(row.outstanding > .005 ? { bgcolor: "#c62828", color: "#fff" } : { color: "#18754a" }) }}>{commissionAmount(row.outstanding, row.currency)}</Box></TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{commissionAmount(row.credit, row.currency)}</TableCell>
            <TableCell><Button size="small" color="success" variant="contained" sx={{ whiteSpace: "nowrap" }} startIcon={<ReceiptLongIcon />} onClick={() => setSelectedId(row.policyId)}>Καταβολές</Button></TableCell>
          </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={9} sx={{ p: 3, textAlign: "center" }}>Δεν βρέθηκαν συμβόλαια για τα φίλτρα σας.</TableCell></TableRow>}</TableBody>
        </Table>
      </TableContainer>}
      <Box sx={{ p: 1, bgcolor: "#edf2f7", borderTop: "1px solid #ccd7e3" }}><NumberedPager page={currentPage} totalPages={pages} onPage={setPage} totalRows={rows.length} pageSize={pageSize} onPageSize={setPageSize} /></Box>
    </Card>
    <CarrierCommissionReceiptsDialog policy={(query.data ?? []).find(row => row.policyId === selectedId) ?? null} onClose={() => setSelectedId(null)} />
    <PolicyDetailDrawer policyId={policyId} open={!!policyId} onClose={() => setPolicyId(null)} presentation="modal" />
  </Box>;
}
