import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography
} from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

interface DeliveryRow {
  policyId: string; policyNumber: string; customerName: string;
  startDate: string; premium: number; currency: string;
  deliveredAt: string | null; deliveredTo: string | null; deliveryMethod: string | null;
}

const METHODS = ["Hand", "Post", "Email", "Courier"];

interface PolicyDeliveryPageProps {
  embedded?: boolean;
}

export function PolicyDeliveryPage({ embedded = false }: PolicyDeliveryPageProps = {}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markOpen, setMarkOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Filter + pagination — undelivered lists can grow into the hundreds
  // on a busy office, so slicing client-side keeps the table responsive.
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const q = useQuery({ queryKey: ["delivery-pending"], queryFn: async () =>
    (await api.get<DeliveryRow[]>("/policy-delivery/pending")).data });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data ?? []).filter(r => {
      if (needle) {
        const hay = `${r.policyNumber} ${r.customerName}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (fromDate && r.startDate < fromDate) return false;
      if (toDate && r.startDate > toDate) return false;
      return true;
    });
  }, [q.data, search, fromDate, toDate]);
  useEffect(() => { setPage(0); }, [search, fromDate, toDate]);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const toggle = (id: string) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSelected(ns);
  };
  const toggleAll = () => {
    // «Select all» targets the current page slice so the operator's
    // action matches what they actually see on-screen.
    const pageIds = paged.map(r => r.policyId);
    const allOnPage = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const ns = new Set(prev);
      if (allOnPage) pageIds.forEach(id => ns.delete(id));
      else pageIds.forEach(id => ns.add(id));
      return ns;
    });
  };
  const pageSelectedCount = paged.filter(r => selected.has(r.policyId)).length;

  const markButton = (
    <Button variant="contained" size="large" disabled={selected.size === 0} onClick={() => setMarkOpen(true)}>
      {t("delivery.markSelected", { count: selected.size })}
    </Button>
  );

  return (
    <Box>
      {embedded ? (
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} mb={2} gap={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("delivery.title")}</Typography>
              <HelpHint id="page.delivery" />
            </Stack>
            <Typography variant="body2" color="text.secondary">{t("delivery.subtitle")}</Typography>
          </Box>
          {markButton}
        </Stack>
      ) : (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <LocalShippingIcon sx={{ fontSize: 36 }} color="primary" />
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("delivery.title")}</Typography>
                <HelpHint id="page.delivery" />
              </Stack>
              <Typography color="text.secondary">{t("delivery.subtitle")}</Typography>
            </Box>
          </Stack>
          {markButton}
        </Stack>
      )}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {/* Filter bar — dense 4-col grid, mirrors the pattern used across
          the other list pages so the operator gets the same controls in
          the same place. */}
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "center",
        }}>
          <TextField size="small" placeholder="Αναζήτηση: αρ. συμβολαίου ή πελάτης…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ gridColumn: { md: "span 2" } }} />
          <TextField size="small" type="date" label="Έναρξη από" InputLabelProps={{ shrink: true }} fullWidth
            value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField size="small" type="date" label="Έναρξη έως" InputLabelProps={{ shrink: true }} fullWidth
            value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }}
            sx={{ gridColumn: { md: "1 / -1" } }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </Card>

      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell padding="checkbox">
                <Checkbox indeterminate={pageSelectedCount > 0 && pageSelectedCount < paged.length}
                  checked={paged.length > 0 && pageSelectedCount === paged.length}
                  onChange={toggleAll} />
              </TableCell>
              <TableCell>{t("delivery.policyNumber")}</TableCell>
              <TableCell>{t("delivery.customer")}</TableCell>
              <TableCell>{t("delivery.startDate")}</TableCell>
              <TableCell align="right">{t("delivery.premium")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("delivery.pendingEmpty")}</TableCell></TableRow>
              )}
              {paged.map(r => (
                <TableRow key={r.policyId} hover selected={selected.has(r.policyId)} onClick={() => toggle(r.policyId)} sx={{ cursor: "pointer" }}>
                  <TableCell padding="checkbox"><Checkbox checked={selected.has(r.policyId)} /></TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell>{r.startDate}</TableCell>
                  <TableCell align="right">{money(r.premium, r.currency)}</TableCell>
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
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100, 250]}
            labelRowsPerPage="Ανά σελίδα"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
          />
        </Card>
      )}
      <MarkDialog open={markOpen} onClose={() => setMarkOpen(false)} policyIds={Array.from(selected)}
        onMarked={() => { void qc.invalidateQueries({ queryKey: ["delivery-pending"] }); setSelected(new Set()); setMarkOpen(false); }} />
    </Box>
  );
}

function MarkDialog({ open, onClose, policyIds, onMarked }: { open: boolean; onClose: () => void; policyIds: string[]; onMarked: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ deliveredAt: today, deliveredTo: "", deliveryMethod: "Hand", paymentCollectionMethod: "" });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post<number>("/policy-delivery/mark-delivered", {
      policyIds, deliveredAt: form.deliveredAt,
      deliveredTo: form.deliveredTo || null, deliveryMethod: form.deliveryMethod,
      paymentCollectionMethod: form.paymentCollectionMethod || null
    })).data,
    onSuccess: onMarked, onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("delivery.markDialog", { count: policyIds.length })}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField type="date" label={t("delivery.deliveredAt")} InputLabelProps={{ shrink: true }}
            value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} fullWidth />
          <TextField label={t("delivery.deliveredTo")} value={form.deliveredTo}
            onChange={e => setForm({ ...form, deliveredTo: e.target.value })} fullWidth
            placeholder={t("delivery.deliveredToPlaceholder")} />
          <SearchableTextField label={t("delivery.method")} value={form.deliveryMethod}
            onChange={e => setForm({ ...form, deliveryMethod: e.target.value })} fullWidth>
            {METHODS.map(m => <MenuItem key={m} value={m}>{t(`deliveryMethod.${m}`, m)}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField label="Τρόπος πληρωμής" value={form.paymentCollectionMethod}
            onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })} fullWidth
            helperText="Πώς θα εισπραχθεί το ασφάλιστρο.">
            <MenuItem value="">—</MenuItem>
            <MenuItem value="Cash">Μετρητά</MenuItem>
            <MenuItem value="BankDeposit">Κατάθεση τραπέζης</MenuItem>
            <MenuItem value="Card">Κάρτα</MenuItem>
            <MenuItem value="DebitOrder">Πάγια εντολή</MenuItem>
            <MenuItem value="Cheque">Επιταγή</MenuItem>
            <MenuItem value="Other">Άλλο</MenuItem>
          </SearchableTextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
