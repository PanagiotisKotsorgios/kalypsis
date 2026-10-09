import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BuildIcon from "@mui/icons-material/Build";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import PrintIcon from "@mui/icons-material/Print";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { exportRowsCsv } from "../utils/exportCsv";

interface GarageDto {
  id: string; code: string; name: string; afm: string | null;
  address: string | null; city: string | null; postalCode: string | null;
  phone: string | null; email: string | null; specialty: string | null;
  isApproved: boolean; iban: string | null; isActive: boolean; notes: string | null;
}

export function GaragesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GarageDto | null>(null);
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const q = useQuery({ queryKey: ["garages"], queryFn: async () => (await api.get<GarageDto[]>("/garages")).data });
  const rows = q.data ?? [];
  const cities = useMemo(() => [...new Set(rows.map(row => row.city?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "el")), [rows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return rows.filter(row => {
      const haystack = [row.code, row.name, row.afm, row.address, row.city, row.postalCode, row.phone, row.email, row.specialty, row.notes].filter(Boolean).join(" ").toLocaleLowerCase("el-GR");
      if (term && !haystack.includes(term)) return false;
      if (approvalFilter === "approved" && !row.isApproved) return false;
      if (approvalFilter === "unapproved" && row.isApproved) return false;
      if (activeFilter === "active" && !row.isActive) return false;
      if (activeFilter === "inactive" && row.isActive) return false;
      if (cityFilter !== "all" && row.city !== cityFilter) return false;
      return true;
    });
  }, [rows, search, approvalFilter, activeFilter, cityFilter]);
  useEffect(() => { setPage(0); }, [search, approvalFilter, activeFilter, cityFilter, rowsPerPage]);
  const pageRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const clearFilters = () => { setSearch(""); setApprovalFilter("all"); setActiveFilter("all"); setCityFilter("all"); };
  const exportColumns = [
    { key: "code", label: "Κωδικός" }, { key: "name", label: "Επωνυμία" }, { key: "afm", label: "ΑΦΜ" },
    { key: "address", label: "Διεύθυνση" }, { key: "city", label: "Πόλη" }, { key: "postalCode", label: "Τ.Κ." },
    { key: "phone", label: "Τηλέφωνο" }, { key: "email", label: "Email" }, { key: "specialty", label: "Ειδικότητα" },
    { key: "isApproved", label: "Έγκριση", map: (row: GarageDto) => row.isApproved ? "Εγκεκριμένο" : "Μη εγκεκριμένο" },
    { key: "isActive", label: "Κατάσταση", map: (row: GarageDto) => row.isActive ? "Ενεργό" : "Ανενεργό" },
    { key: "iban", label: "IBAN" }, { key: "notes", label: "Σημειώσεις" }
  ];
  const exportCsv = () => void exportRowsCsv({ fileName: "συνεργεία", columns: exportColumns, rows: filteredRows });
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const values = filteredRows.map(row => exportColumns.map(column => column.map ? column.map(row) : row[column.key as keyof GarageDto] ?? ""));
    const sheet = XLSX.utils.aoa_to_sheet([exportColumns.map(column => column.label), ...values]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Συνεργεία");
    XLSX.writeFile(book, "συνεργεία.xlsx");
  };
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/garages/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["garages"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BuildIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("garages.title")}</Typography>
              <HelpHint id="page.garages" />
            </Stack>
            <Typography color="text.secondary">{t("garages.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("garages.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Card variant="outlined" sx={{ p: 1.25, mb: 1.5, bgcolor: "#f4f7fb" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField size="small" fullWidth placeholder="Αναζήτηση κωδικού, επωνυμίας, πόλης, τηλεφώνου ή email" value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.75, color: "text.secondary" }} /> }} sx={{ flex: 1, minWidth: { md: 300 } }} />
          <TextField select size="small" label="Έγκριση" value={approvalFilter} onChange={e => setApprovalFilter(e.target.value)} sx={{ minWidth: 140 }}><MenuItem value="all">Όλα</MenuItem><MenuItem value="approved">Εγκεκριμένα</MenuItem><MenuItem value="unapproved">Μη εγκεκριμένα</MenuItem></TextField>
          <TextField select size="small" label="Κατάσταση" value={activeFilter} onChange={e => setActiveFilter(e.target.value)} sx={{ minWidth: 135 }}><MenuItem value="all">Όλες</MenuItem><MenuItem value="active">Ενεργά</MenuItem><MenuItem value="inactive">Ανενεργά</MenuItem></TextField>
          <TextField select size="small" label="Πόλη" value={cityFilter} onChange={e => setCityFilter(e.target.value)} sx={{ minWidth: 145 }}><MenuItem value="all">Όλες</MenuItem>{cities.map(city => <MenuItem key={city} value={city}>{city}</MenuItem>)}</TextField>
          <Button size="small" color="error" variant="contained" startIcon={<FilterAltOffIcon />} onClick={clearFilters}>Καθαρισμός</Button>
        </Stack>
      </Card>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">Εμφανίζονται {filteredRows.length} από {rows.length} συνεργεία</Typography>
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
              <TableCell>{t("garages.code")}</TableCell>
              <TableCell>{t("garages.name")}</TableCell>
              <TableCell>{t("garages.city")}</TableCell>
              <TableCell>{t("garages.phone")}</TableCell>
              <TableCell>{t("garages.specialty")}</TableCell>
              <TableCell>{t("garages.approved")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("garages.empty")}</TableCell></TableRow>
              )}
              {pageRows.map(g => (
                <TableRow key={g.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{g.code}</TableCell>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>{g.city ?? "—"}</TableCell>
                  <TableCell>{g.phone ?? "—"}</TableCell>
                  <TableCell>{g.specialty ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={g.isApproved ? "success" : "default"} label={g.isApproved ? "✓" : "—"} /></TableCell>
                  <TableCell><Chip size="small" color={g.isActive ? "success" : "default"} label={g.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(g)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(g.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, next) => setPage(next)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["garages"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["garages"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: GarageDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({
    code: "", name: "", afm: "", address: "", city: "", postalCode: "",
    phone: "", email: "", specialty: "", isApproved: true, iban: "", isActive: true, notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item) setForm({
      code: item.code, name: item.name, afm: item.afm ?? "", address: item.address ?? "",
      city: item.city ?? "", postalCode: item.postalCode ?? "", phone: item.phone ?? "",
      email: item.email ?? "", specialty: item.specialty ?? "", isApproved: item.isApproved,
      iban: item.iban ?? "", isActive: item.isActive, notes: item.notes ?? ""
    });
    else if (open) setForm({
      code: "", name: "", afm: "", address: "", city: "", postalCode: "",
      phone: "", email: "", specialty: "", isApproved: true, iban: "", isActive: true, notes: ""
    });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(), name: form.name.trim(), afm: form.afm || null,
        address: form.address || null, city: form.city || null, postalCode: form.postalCode || null,
        phone: form.phone || null, email: form.email || null, specialty: form.specialty || null,
        isApproved: form.isApproved, iban: form.iban || null, isActive: form.isActive, notes: form.notes || null
      };
      if (editing) return (await api.put(`/garages/${item!.id}`, body)).data;
      return (await api.post("/garages", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("garages.editTitle") : t("garages.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("garages.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField required label={t("garages.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("garages.afm")} value={form.afm} onChange={e => setForm({ ...form, afm: e.target.value })} fullWidth />
            <TextField label={t("garages.specialty")} value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} fullWidth placeholder="αυτοκίνητα / μοτοσικλέτες / κρύσταλλα" />
          </Stack>
          <TextField label={t("garages.address")} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("garages.city")} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} fullWidth />
            <TextField label={t("garages.postalCode")} value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} sx={{ width: 140 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("garages.phone")} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label={t("garages.email")} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("garages.iban")} value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
          <Stack direction="row" spacing={4}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isApproved} onChange={e => setForm({ ...form, isApproved: e.target.checked })} />
              <Typography>{t("garages.approved")}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
