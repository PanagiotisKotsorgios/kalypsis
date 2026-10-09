import { useEffect, useMemo, useState } from "react";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentsIcon from "@mui/icons-material/Payments";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import PrintIcon from "@mui/icons-material/Print";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { exportRowsCsv } from "../utils/exportCsv";

interface IndemnityDto {
  id: string; claimId: string; claimNumber: string;
  paymentNumber: string; paidOn: string; amount: number; currency: string;
  payeeType: string; payeeName: string | null; garageId: string | null; garageName: string | null;
  paymentMethod: string; reference: string | null; notes: string | null;
}
interface ClaimLite { id: string; claimNumber: string; }
interface GarageLite { id: string; name: string; }

const PAYEE_TYPES = ["Customer", "Garage", "Hospital", "Other"];
const METHODS = ["Cash", "BankTransfer", "Cheque", "Card", "Other"];

export function ClaimIndemnitiesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [payeeTypeFilter, setPayeeTypeFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const q = useQuery({ queryKey: ["indemnities"], queryFn: async () => (await api.get<IndemnityDto[]>("/indemnities")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/indemnities/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["indemnities"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const rows = q.data ?? [];
  const total = rows.reduce((s, i) => s + i.amount, 0);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return rows.filter(i => {
      const haystack = [i.paymentNumber, i.claimNumber, i.payeeName, i.garageName, i.paymentMethod, i.reference, i.notes]
        .filter(Boolean).join(" ").toLocaleLowerCase("el-GR");
      if (term && !haystack.includes(term)) return false;
      if (payeeTypeFilter !== "all" && i.payeeType !== payeeTypeFilter) return false;
      if (methodFilter !== "all" && i.paymentMethod !== methodFilter) return false;
      if (dateFrom && i.paidOn < dateFrom) return false;
      if (dateTo && i.paidOn > dateTo) return false;
      return true;
    });
  }, [rows, search, payeeTypeFilter, methodFilter, dateFrom, dateTo]);
  useEffect(() => { setPage(0); }, [search, payeeTypeFilter, methodFilter, dateFrom, dateTo, rowsPerPage]);

  const [sortKey, setSortKey] = useState<keyof IndemnityDto | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const arr = filteredRows.slice();
    arr.sort((a, b) => {
      const va: any = a[sortKey] ?? "";
      const vb: any = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "el");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);
  const pageRows = sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const clearFilters = () => { setSearch(""); setPayeeTypeFilter("all"); setMethodFilter("all"); setDateFrom(""); setDateTo(""); };
  const exportColumns = [
    { key: "paymentNumber", label: "Αριθμός πληρωμής" },
    { key: "claimNumber", label: "Αριθμός ζημιάς" },
    { key: "paidOn", label: "Ημερομηνία" },
    { key: "payeeName", label: "Δικαιούχος", map: (i: IndemnityDto) => i.payeeType === "Garage" ? (i.garageName ?? "—") : (i.payeeName ?? "—") },
    { key: "payeeType", label: "Τύπος δικαιούχου", map: (i: IndemnityDto) => t(`payeeType.${i.payeeType}`, i.payeeType) },
    { key: "paymentMethod", label: "Μέθοδος", map: (i: IndemnityDto) => t(`paymentMethod.${i.paymentMethod}`, i.paymentMethod) },
    { key: "amount", label: "Ποσό", map: (i: IndemnityDto) => money(i.amount, i.currency) },
    { key: "reference", label: "Αναφορά" }, { key: "notes", label: "Σημειώσεις" }
  ];
  const exportCsv = () => void exportRowsCsv({ fileName: "αποζημιώσεις", columns: exportColumns, rows: filteredRows });
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const values = filteredRows.map(row => exportColumns.map(column => column.map ? column.map(row) : row[column.key as keyof IndemnityDto] ?? ""));
    const sheet = XLSX.utils.aoa_to_sheet([exportColumns.map(column => column.label), ...values]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Αποζημιώσεις");
    XLSX.writeFile(book, "αποζημιώσεις.xlsx");
  };
  const inferType = (key: string): ColumnType =>
    key === "paidOn" ? "date" : key === "amount" ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof IndemnityDto> = {
        number: "paymentNumber", claim: "claimNumber", paidOn: "paidOn",
        payee: "payeeName", method: "paymentMethod", amount: "amount",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      setSortKey(dtoKey);
      setSortDir(dir);
    },
  });
  const rowMenu = useRowContextMenu<IndemnityDto>({
    entityLabel: "αποζημίωσης",
    onDelete: (i) => { if (confirm(t("common.confirmDelete"))) del.mutate(i.id); },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PaymentsIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("indemnities.title")}</Typography>
              <HelpHint id="page.indemnities" />
            </Stack>
            <Typography color="text.secondary">{t("indemnities.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("indemnities.totalsLabel")}</Typography>
            <Typography variant="body1" fontWeight={800}>{money(total)}</Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("indemnities.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Card variant="outlined" sx={{ p: 1.25, mb: 1.5, bgcolor: "#f4f7fb" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField size="small" fullWidth placeholder="Αναζήτηση αριθμού, ζημιάς, δικαιούχου ή αναφοράς" value={search}
            onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.75, color: "text.secondary" }} /> }} sx={{ flex: 1, minWidth: { md: 280 } }} />
          <TextField select size="small" label="Τύπος δικαιούχου" value={payeeTypeFilter} onChange={e => setPayeeTypeFilter(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="all">Όλοι</MenuItem>{PAYEE_TYPES.map(v => <MenuItem key={v} value={v}>{t(`payeeType.${v}`, v)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Μέθοδος" value={methodFilter} onChange={e => setMethodFilter(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="all">Όλες</MenuItem>{METHODS.map(v => <MenuItem key={v} value={v}>{t(`paymentMethod.${v}`, v)}</MenuItem>)}
          </TextField>
          <TextField type="date" size="small" label="Από" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <TextField type="date" size="small" label="Έως" InputLabelProps={{ shrink: true }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <Button size="small" color="error" variant="contained" startIcon={<FilterAltOffIcon />} onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
        </Stack>
      </Card>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">Εμφανίζονται {filteredRows.length} από {rows.length} αποζημιώσεις</Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!filteredRows.length}>Εξαγωγή CSV</Button>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => void exportXlsx()} disabled={!filteredRows.length}>Εξαγωγή XLSX</Button>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!filteredRows.length}>Εκτύπωση</Button>
        </Stack>
      </Stack>
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              {[
                ["number", t("indemnities.number"), "left"],
                ["claim", t("indemnities.claim"), "left"],
                ["paidOn", t("indemnities.paidOn"), "left"],
                ["payee", t("indemnities.payee"), "left"],
                ["method", t("indemnities.method"), "left"],
                ["amount", t("indemnities.amount"), "right"],
              ].map(([k, label, align]) => (
                <TableCell key={k as string} align={align as "left" | "right"} sx={{ userSelect: "none" }}
                  onContextMenu={(e) => headerMenu.open(e, { key: k as string, label: label as string, type: inferType(k as string), canHide: false })}
                >{label}</TableCell>
              ))}
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("indemnities.empty")}</TableCell></TableRow>
              )}
              {pageRows.map(i => (
                <TableRow key={i.id} hover onContextMenu={(e) => rowMenu.open(e, i)}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{i.paymentNumber}</TableCell>
                  <TableCell>{i.claimNumber}</TableCell>
                  <TableCell>{i.paidOn}</TableCell>
                  <TableCell>
                    {i.payeeType === "Garage" ? (i.garageName ?? "—") : (i.payeeName ?? "—")}
                    <Typography variant="caption" color="text.secondary"> · {t(`payeeType.${i.payeeType}`, i.payeeType)}</Typography>
                  </TableCell>
                  <TableCell>{t(`paymentMethod.${i.paymentMethod}`, i.paymentMethod)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>{money(i.amount, i.currency)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(i.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination component="div" count={sortedRows.length} page={page} onPageChange={(_, next) => setPage(next)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["indemnities"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    claimId: "", paymentNumber: "", paidOn: today, amount: 0, currency: "EUR",
    payeeType: "Customer", payeeName: "", garageId: "", paymentMethod: "BankTransfer", reference: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const claims = useQuery({ queryKey: ["claims-lite"], enabled: open,
    queryFn: async () => (await api.get<ClaimLite[]>("/claims")).data });
  const garages = useQuery({ queryKey: ["garages-lite"], enabled: open,
    queryFn: async () => (await api.get<GarageLite[]>("/garages")).data });

  useEffect(() => {
    if (open) setForm({
      claimId: "", paymentNumber: `IND-${Date.now().toString().slice(-6)}`, paidOn: today, amount: 0, currency: "EUR",
      payeeType: "Customer", payeeName: "", garageId: "", paymentMethod: "BankTransfer", reference: "", notes: ""
    });
    // eslint-disable-next-line
  }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/indemnities", {
      claimId: form.claimId, paymentNumber: form.paymentNumber.trim(),
      paidOn: form.paidOn, amount: Number(form.amount), currency: form.currency.toUpperCase(),
      payeeType: form.payeeType,
      payeeName: form.payeeType === "Garage" ? null : (form.payeeName || null),
      garageId: form.payeeType === "Garage" ? (form.garageId || null) : null,
      paymentMethod: form.paymentMethod,
      reference: form.reference || null, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("indemnities.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <SearchableSelect
            label={t("indemnities.claim")}
            required
            value={form.claimId}
            onChange={(v) => setForm({ ...form, claimId: v })}
            options={(claims.data ?? []).map(c => ({ value: c.id, label: c.claimNumber }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("indemnities.number")} value={form.paymentNumber}
              onChange={e => setForm({ ...form, paymentNumber: e.target.value })} fullWidth />
            <TextField type="date" label={t("indemnities.paidOn")} InputLabelProps={{ shrink: true }}
              value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label={t("indemnities.payeeType")} value={form.payeeType}
              onChange={e => setForm({ ...form, payeeType: e.target.value })} fullWidth>
              {PAYEE_TYPES.map(p => <MenuItem key={p} value={p}>{t(`payeeType.${p}`, p)}</MenuItem>)}
            </SearchableTextField>
            {form.payeeType === "Garage" ? (
              <SearchableSelect
                label={t("garages.title")}
                value={form.garageId}
                onChange={(v) => setForm({ ...form, garageId: v })}
                options={(garages.data ?? []).map(g => ({ value: g.id, label: g.name }))}
              />
            ) : (
              <TextField label={t("indemnities.payeeName")} value={form.payeeName}
                onChange={e => setForm({ ...form, payeeName: e.target.value })} fullWidth />
            )}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label={t("indemnities.method")} value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value })} fullWidth>
              {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`, m)}</MenuItem>)}
            </SearchableTextField>
            <TextField required type="number" label={t("indemnities.amount")} value={form.amount}
              onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <TextField label={t("indemnities.reference")} value={form.reference}
            onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth helperText={t("indemnities.referenceHelp")} />
          <TextField label={t("common.notes")} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.claimId || !form.paymentNumber.trim() || form.amount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
