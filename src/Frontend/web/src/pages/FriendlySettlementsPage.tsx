import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HandshakeIcon from "@mui/icons-material/Handshake";
import PeopleIcon from "@mui/icons-material/People";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import PrintIcon from "@mui/icons-material/Print";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, num } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { exportRowsCsv } from "../utils/exportCsv";

interface SettlementDto {
  id: string; claimId: string; claimNumber: string;
  settlementFileNumber: string; declarationDate: string;
  settlementAuthority: string | null; settlementDate: string | null;
  agreedAmount: number | null; vatAmount: number | null;
  feeAmount: number | null; interestAmount: number | null;
  currency: string; status: string;
  otherPartyInsurer: string | null; otherPartyPolicy: string | null;
  appraisorName: string | null; appraisalDate: string | null;
  notes: string | null; victimCount: number;
}
interface VictimDto {
  id: string; claimId: string; friendlySettlementId: string | null;
  fullName: string; afm: string | null; phone: string | null; address: string | null;
  victimType: string; vehiclePlate: string | null; description: string | null;
  reserveAmount: number | null; paidAmount: number | null;
  currency: string; status: string;
}
interface ClaimLite { id: string; claimNumber: string; }

const STATUSES = ["Open", "InProgress", "Closed", "Disputed"];
const VICTIM_TYPES = ["Person", "Vehicle", "Property"];
const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  Open: "info", InProgress: "warning", Closed: "success", Disputed: "error"
};
const settlementStatusLabel = (status: string) => ({
  Open: "Ανοιχτή", InProgress: "Σε εξέλιξη", Closed: "Κλειστή", Disputed: "Αμφισβητούμενη"
} as Record<string, string>)[status] ?? status;

export function FriendlySettlementsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [victimsOf, setVictimsOf] = useState<SettlementDto | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [insurerFilter, setInsurerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const q = useQuery({ queryKey: ["friendly-settlements"], queryFn: async () =>
    (await api.get<SettlementDto[]>("/friendly-settlements")).data });
  const rows = q.data ?? [];
  const insurers = useMemo(() => [...new Set(rows.map(r => r.otherPartyInsurer?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "el")), [rows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return rows.filter(s => {
      const haystack = [s.settlementFileNumber, s.claimNumber, s.settlementAuthority, s.otherPartyInsurer, s.otherPartyPolicy, s.appraisorName, s.notes]
        .filter(Boolean).join(" ").toLocaleLowerCase("el-GR");
      if (term && !haystack.includes(term)) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (insurerFilter !== "all" && s.otherPartyInsurer !== insurerFilter) return false;
      if (dateFrom && s.declarationDate < dateFrom) return false;
      if (dateTo && s.declarationDate > dateTo) return false;
      return true;
    });
  }, [rows, search, statusFilter, insurerFilter, dateFrom, dateTo]);
  useEffect(() => { setPage(0); }, [search, statusFilter, insurerFilter, dateFrom, dateTo, rowsPerPage]);
  const pageRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setInsurerFilter("all"); setDateFrom(""); setDateTo(""); };
  const exportColumns = [
    { key: "settlementFileNumber", label: "Αριθμός φακέλου" }, { key: "claimNumber", label: "Αριθμός ζημιάς" },
    { key: "declarationDate", label: "Ημερομηνία δήλωσης" }, { key: "settlementDate", label: "Ημερομηνία διακανονισμού" },
    { key: "otherPartyInsurer", label: "Ασφαλιστική άλλου μέρους" }, { key: "otherPartyPolicy", label: "Αριθμός συμβολαίου" },
    { key: "agreedAmount", label: "Συμφωνηθέν ποσό", map: (s: SettlementDto) => s.agreedAmount == null ? "—" : money(s.agreedAmount, s.currency) },
    { key: "victimCount", label: "Θύματα" }, { key: "status", label: "Κατάσταση", map: (s: SettlementDto) => settlementStatusLabel(s.status) },
    { key: "notes", label: "Σημειώσεις" }
  ];
  const exportCsv = () => void exportRowsCsv({ fileName: "φιλικοί_διακανονισμοί", columns: exportColumns, rows: filteredRows });
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const values = filteredRows.map(row => exportColumns.map(column => column.map ? column.map(row) : row[column.key as keyof SettlementDto] ?? ""));
    const sheet = XLSX.utils.aoa_to_sheet([exportColumns.map(column => column.label), ...values]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Φιλικοί διακανονισμοί");
    XLSX.writeFile(book, "φιλικοί_διακανονισμοί.xlsx");
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <HandshakeIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("friendly.title")}</Typography>
              <HelpHint id="page.friendly" />
            </Stack>
            <Typography color="text.secondary">{t("friendly.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
          {t("friendly.create")}
        </Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Card variant="outlined" sx={{ p: 1.25, mb: 1.5, bgcolor: "#f4f7fb" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField size="small" fullWidth placeholder="Αναζήτηση φακέλου, ζημιάς, ασφαλιστικής ή συμβολαίου" value={search}
            onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.75, color: "text.secondary" }} /> }} sx={{ flex: 1, minWidth: { md: 300 } }} />
          <TextField select size="small" label="Κατάσταση" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="all">Όλες</MenuItem>{STATUSES.map(v => <MenuItem key={v} value={v}>{settlementStatusLabel(v)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Ασφαλιστική" value={insurerFilter} onChange={e => setInsurerFilter(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="all">Όλες</MenuItem>{insurers.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </TextField>
          <TextField type="date" size="small" label="Από" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <TextField type="date" size="small" label="Έως" InputLabelProps={{ shrink: true }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <Button size="small" color="error" variant="contained" startIcon={<FilterAltOffIcon />} onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
        </Stack>
      </Card>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">Εμφανίζονται {filteredRows.length} από {rows.length} φιλικούς διακανονισμούς</Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!filteredRows.length}>Εξαγωγή CSV</Button>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => void exportXlsx()} disabled={!filteredRows.length}>Εξαγωγή XLSX</Button>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!filteredRows.length}>Εκτύπωση</Button>
        </Stack>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("friendly.fileNumber")}</TableCell>
              <TableCell>{t("friendly.claim")}</TableCell>
              <TableCell>{t("friendly.declarationDate")}</TableCell>
              <TableCell>{t("friendly.otherInsurer")}</TableCell>
              <TableCell align="right">{t("friendly.agreedAmount")}</TableCell>
              <TableCell align="center">{t("friendly.victims")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("friendly.empty")}</TableCell></TableRow>
              )}
              {pageRows.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{s.settlementFileNumber}</TableCell>
                  <TableCell>{s.claimNumber}</TableCell>
                  <TableCell>{s.declarationDate}</TableCell>
                  <TableCell>{s.otherPartyInsurer ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{s.agreedAmount != null ? money(s.agreedAmount, s.currency) : "—"}</TableCell>
                  <TableCell align="center">{s.victimCount}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[s.status] ?? "default"} label={settlementStatusLabel(s.status)} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => setVictimsOf(s)}><PeopleIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, next) => setPage(next)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
        </Card>
      )}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["friendly-settlements"] }); setCreateOpen(false); }} />
      <VictimsDialog settlement={victimsOf} onClose={() => setVictimsOf(null)} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    claimId: "", settlementFileNumber: "", declarationDate: today,
    settlementAuthority: "", settlementDate: "",
    agreedAmount: "", vatAmount: "", feeAmount: "", interestAmount: "",
    currency: "EUR", status: "Open",
    otherPartyInsurer: "", otherPartyPolicy: "",
    appraisorName: "", appraisalDate: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const claims = useQuery({ queryKey: ["claims-lite-fs"], enabled: open,
    queryFn: async () => (await api.get<ClaimLite[]>("/claims")).data });

  useEffect(() => {
    if (open) setForm({
      claimId: "",
      settlementFileNumber: `ΦΔ-${Date.now().toString().slice(-6)}`,
      declarationDate: today, settlementAuthority: "", settlementDate: "",
      agreedAmount: "", vatAmount: "", feeAmount: "", interestAmount: "",
      currency: "EUR", status: "Open",
      otherPartyInsurer: "", otherPartyPolicy: "",
      appraisorName: "", appraisalDate: "", notes: ""
    });
    // eslint-disable-next-line
  }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/friendly-settlements", {
      claimId: form.claimId, settlementFileNumber: form.settlementFileNumber.trim(),
      declarationDate: form.declarationDate,
      settlementAuthority: form.settlementAuthority || null,
      settlementDate: form.settlementDate || null,
      agreedAmount: form.agreedAmount ? Number(form.agreedAmount) : null,
      vatAmount: form.vatAmount ? Number(form.vatAmount) : null,
      feeAmount: form.feeAmount ? Number(form.feeAmount) : null,
      interestAmount: form.interestAmount ? Number(form.interestAmount) : null,
      currency: form.currency.toUpperCase(), status: form.status,
      otherPartyInsurer: form.otherPartyInsurer || null,
      otherPartyPolicy: form.otherPartyPolicy || null,
      appraisorName: form.appraisorName || null,
      appraisalDate: form.appraisalDate || null,
      notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("friendly.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label={t("friendly.claim")}
              required
              value={form.claimId}
              onChange={(v) => setForm({ ...form, claimId: v })}
              options={(claims.data ?? []).map(c => ({ value: c.id, label: c.claimNumber }))}
            />
            <TextField required label={t("friendly.fileNumber")} value={form.settlementFileNumber}
              onChange={e => setForm({ ...form, settlementFileNumber: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("friendly.declarationDate")} InputLabelProps={{ shrink: true }}
              value={form.declarationDate} onChange={e => setForm({ ...form, declarationDate: e.target.value })} fullWidth />
            <TextField type="date" label={t("friendly.settlementDate")} InputLabelProps={{ shrink: true }}
              value={form.settlementDate} onChange={e => setForm({ ...form, settlementDate: e.target.value })} fullWidth />
            <SearchableTextField label={t("common.status")} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })} sx={{ width: 160 }}>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{String(t(`friendlyStatus.${s}`, s))}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <TextField label={t("friendly.authority")} value={form.settlementAuthority}
            onChange={e => setForm({ ...form, settlementAuthority: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("friendly.otherInsurer")} value={form.otherPartyInsurer}
              onChange={e => setForm({ ...form, otherPartyInsurer: e.target.value })} fullWidth />
            <TextField label={t("friendly.otherPolicy")} value={form.otherPartyPolicy}
              onChange={e => setForm({ ...form, otherPartyPolicy: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("friendly.agreedAmount")} value={form.agreedAmount}
              onChange={e => setForm({ ...form, agreedAmount: e.target.value })} fullWidth />
            <TextField type="number" label="ΦΠΑ" value={form.vatAmount}
              onChange={e => setForm({ ...form, vatAmount: e.target.value })} fullWidth />
            <TextField type="number" label={t("friendly.fees")} value={form.feeAmount}
              onChange={e => setForm({ ...form, feeAmount: e.target.value })} fullWidth />
            <TextField type="number" label={t("friendly.interest")} value={form.interestAmount}
              onChange={e => setForm({ ...form, interestAmount: e.target.value })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 90 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("friendly.appraisor")} value={form.appraisorName}
              onChange={e => setForm({ ...form, appraisorName: e.target.value })} fullWidth />
            <TextField type="date" label={t("friendly.appraisalDate")} InputLabelProps={{ shrink: true }}
              value={form.appraisalDate} onChange={e => setForm({ ...form, appraisalDate: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.claimId || !form.settlementFileNumber.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function VictimsDialog({ settlement, onClose }: { settlement: SettlementDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    fullName: "", afm: "", phone: "", address: "",
    victimType: "Person", vehiclePlate: "", description: "",
    reserveAmount: "", currency: "EUR", status: "Open"
  });
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["victims", settlement?.id], enabled: !!settlement,
    queryFn: async () => (await api.get<VictimDto[]>("/claim-victims", { params: { settlementId: settlement!.id } })).data
  });
  const add = useMutation({
    mutationFn: async () => (await api.post("/claim-victims", {
      claimId: settlement!.claimId, friendlySettlementId: settlement!.id,
      fullName: form.fullName.trim(), afm: form.afm || null,
      phone: form.phone || null, address: form.address || null,
      victimType: form.victimType, vehiclePlate: form.vehiclePlate || null,
      description: form.description || null,
      reserveAmount: form.reserveAmount ? Number(form.reserveAmount) : null,
      currency: form.currency, status: form.status
    })).data,
    onSuccess: () => { setAdding(false); void qc.invalidateQueries({ queryKey: ["victims", settlement?.id] }); void qc.invalidateQueries({ queryKey: ["friendly-settlements"] }); },
    onError: e => setErr(extractErrorMessage(e))
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/claim-victims/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["victims", settlement?.id] })
  });

  return (
    <Dialog open={!!settlement} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("friendly.victimsOf")} {settlement?.settlementFileNumber}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={t("friendly.victimsTab")} />
        </Tabs>
        {!adding ? (
          <Box>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setAdding(true)} sx={{ mb: 2 }}>
              {t("friendly.addVictim")}
            </Button>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{t("friendly.victimName")}</TableCell>
                <TableCell>{t("friendly.victimType")}</TableCell>
                <TableCell>{t("friendly.afm")}</TableCell>
                <TableCell>{t("friendly.phone")}</TableCell>
                <TableCell align="right">{t("friendly.reserveAmount")}</TableCell>
                <TableCell align="right">{t("friendly.paidAmount")}</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell align="right" />
              </TableRow></TableHead>
              <TableBody>
                {(q.data ?? []).map(v => (
                  <TableRow key={v.id}>
                    <TableCell>{v.fullName}</TableCell>
                    <TableCell>{v.victimType}</TableCell>
                    <TableCell>{v.afm ?? "—"}</TableCell>
                    <TableCell>{v.phone ?? "—"}</TableCell>
                    <TableCell align="right">{v.reserveAmount != null ? num(v.reserveAmount) : "—"}</TableCell>
                    <TableCell align="right">{v.paidAmount != null ? num(v.paidAmount) : "—"}</TableCell>
                    <TableCell>{v.status}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(v.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Stack spacing={2} mt={1}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField required label={t("friendly.victimName")} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} fullWidth />
              <SearchableTextField label={t("friendly.victimType")} value={form.victimType} onChange={e => setForm({ ...form, victimType: e.target.value })} sx={{ width: 160 }}>
                {VICTIM_TYPES.map(v => <MenuItem key={v} value={v}>{String(t(`friendlyVictimType.${v}`, v))}</MenuItem>)}
              </SearchableTextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label={t("friendly.afm")} value={form.afm} onChange={e => setForm({ ...form, afm: e.target.value })} fullWidth />
              <TextField label={t("friendly.phone")} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth />
              {form.victimType === "Vehicle" && (
                <TextField label={t("friendly.plate")} value={form.vehiclePlate} onChange={e => setForm({ ...form, vehiclePlate: e.target.value.toUpperCase() })} fullWidth />
              )}
            </Stack>
            <TextField label={t("friendly.address")} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} fullWidth />
            <TextField label={t("friendly.description")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
            <Stack direction="row" spacing={2}>
              <TextField type="number" label={t("friendly.reserveAmount")} value={form.reserveAmount} onChange={e => setForm({ ...form, reserveAmount: e.target.value })} fullWidth />
              <TextField label={t("common.currency")} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} sx={{ width: 100 }} />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {adding ? (
          <>
            <Button onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
            <Button variant="contained" onClick={() => add.mutate()} disabled={add.isPending || !form.fullName.trim()}>
              {add.isPending ? <CircularProgress size={18} /> : t("common.save")}
            </Button>
          </>
        ) : <Button onClick={onClose}>{t("common.close")}</Button>}
      </DialogActions>
    </Dialog>
  );
}
