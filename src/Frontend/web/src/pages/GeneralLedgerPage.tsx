import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, num } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

interface AccountDto { id: string; code: string; name: string; type: string; category: string | null; isActive: boolean; displayOrder: number; }
interface EntryDto {
  id: string; entryNumber: string; entryDate: string;
  accountId: string; accountCode: string; accountName: string;
  description: string; debit: number; credit: number; currency: string;
  relatedDocumentRef: string | null;
}
interface SummaryDto {
  totalDebit: number; totalCredit: number; balance: number;
  byAccount: { accountCode: string; accountName: string; type: string; debit: number; credit: number; balance: number; }[];
}

const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"];

export function GeneralLedgerPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <AccountBalanceIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("gl.title")}</Typography>
            <HelpHint id="page.gl" />
          </Stack>
          <Typography color="text.secondary">{t("gl.subtitle")}</Typography>
        </Box>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t("gl.tabEntries")} />
        <Tab label={t("gl.tabAccounts")} />
        <Tab label={t("gl.tabSummary")} />
      </Tabs>
      {tab === 0 && <EntriesPanel />}
      {tab === 1 && <AccountsPanel />}
      {tab === 2 && <SummaryPanel />}
    </Box>
  );
}

function EntriesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({ queryKey: ["gl-entries"], queryFn: async () => (await api.get<EntryDto[]>("/gl/entries")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/gl/entries/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gl-entries"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)} sx={{ mb: 2 }}>{t("gl.createEntry")}</Button>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("gl.entryNumber")}</TableCell>
              <TableCell>{t("gl.entryDate")}</TableCell>
              <TableCell>{t("gl.account")}</TableCell>
              <TableCell>{t("common.description")}</TableCell>
              <TableCell align="right">{t("gl.debit")}</TableCell>
              <TableCell align="right">{t("gl.credit")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("gl.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(e => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{e.entryNumber}</TableCell>
                  <TableCell>{e.entryDate}</TableCell>
                  <TableCell><Typography fontWeight={600}>{e.accountCode}</Typography>
                    <Typography variant="caption" color="text.secondary">{e.accountName}</Typography></TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell align="right" sx={{ color: "success.main" }}>{e.debit > 0 ? num(e.debit) : "—"}</TableCell>
                  <TableCell align="right" sx={{ color: "error.main" }}>{e.credit > 0 ? num(e.credit) : "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(e.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <EntryDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["gl-entries"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function EntryDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    entryNumber: "", entryDate: today, accountId: "", description: "",
    debit: 0, credit: 0, currency: "EUR", relatedDocumentRef: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const accounts = useQuery({ queryKey: ["gl-accounts-lite"], enabled: open,
    queryFn: async () => (await api.get<AccountDto[]>("/gl/accounts")).data });

  useEffect(() => { if (open) setForm({ entryNumber: "", entryDate: today, accountId: "", description: "", debit: 0, credit: 0, currency: "EUR", relatedDocumentRef: "" }); /* eslint-disable-next-line */ }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/gl/entries", {
      entryNumber: form.entryNumber.trim(), entryDate: form.entryDate,
      accountId: form.accountId, description: form.description.trim(),
      debit: Number(form.debit), credit: Number(form.credit),
      currency: form.currency, relatedDocumentRef: form.relatedDocumentRef || null,
      customerId: null, producerId: null, policyId: null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("gl.createEntryTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("gl.entryNumber")} value={form.entryNumber}
              onChange={e => setForm({ ...form, entryNumber: e.target.value })} fullWidth placeholder="auto" />
            <TextField type="date" label={t("gl.entryDate")} InputLabelProps={{ shrink: true }}
              value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} fullWidth />
          </Stack>
          <SearchableSelect
            label={t("gl.account")}
            required
            value={form.accountId}
            onChange={(v) => setForm({ ...form, accountId: v })}
            options={(accounts.data ?? []).map(a => ({
              value: a.id, label: a.name, hint: a.code,
            }))}
          />
          <TextField required label={t("common.description")} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("gl.debit")} value={form.debit}
              onChange={e => setForm({ ...form, debit: Number(e.target.value), credit: 0 })} fullWidth />
            <TextField type="number" label={t("gl.credit")} value={form.credit}
              onChange={e => setForm({ ...form, credit: Number(e.target.value), debit: 0 })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <TextField label={t("gl.relatedRef")} value={form.relatedDocumentRef}
            onChange={e => setForm({ ...form, relatedDocumentRef: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.accountId || !form.description.trim() || (form.debit <= 0 && form.credit <= 0)}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AccountsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccountDto | null>(null);

  const q = useQuery({ queryKey: ["gl-accounts"], queryFn: async () => (await api.get<AccountDto[]>("/gl/accounts")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/gl/accounts/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gl-accounts"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)} sx={{ mb: 2 }}>{t("gl.createAccount")}</Button>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("gl.accountCode")}</TableCell>
              <TableCell>{t("gl.accountName")}</TableCell>
              <TableCell>{t("gl.accountType")}</TableCell>
              <TableCell>{t("gl.category")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("gl.noAccounts")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(a => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.type}</TableCell>
                  <TableCell>{a.category ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setEditing(a)}>{t("common.edit")}</Button>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(a.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <AccountDialog open={open} onClose={() => setOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["gl-accounts"] }); setOpen(false); }} />
      <AccountDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["gl-accounts"] }); setEditing(null); }} />
    </Box>
  );
}

function AccountDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: AccountDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({ code: "", name: "", type: "Expense", category: "", isActive: true, displayOrder: 0 });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item) setForm({ code: item.code, name: item.name, type: item.type, category: item.category ?? "", isActive: item.isActive, displayOrder: item.displayOrder });
    else if (open) setForm({ code: "", name: "", type: "Expense", category: "", isActive: true, displayOrder: 0 });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { code: form.code.trim(), name: form.name.trim(), type: form.type, category: form.category || null, isActive: form.isActive, displayOrder: Number(form.displayOrder) };
      if (editing) return (await api.put(`/gl/accounts/${item!.id}`, body)).data;
      return (await api.post("/gl/accounts", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editing ? t("gl.editAccount") : t("gl.createAccount")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("gl.accountCode")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField type="number" label={t("gl.displayOrder")} value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })} sx={{ width: 120 }} />
          </Stack>
          <TextField required label={t("gl.accountName")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <SearchableTextField label={t("gl.accountType")} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} fullWidth>
            {ACCOUNT_TYPES.map(tp => <MenuItem key={tp} value={tp}>{tp}</MenuItem>)}
          </SearchableTextField>
          <TextField label={t("gl.category")} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth />
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

function SummaryPanel() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["gl-summary"], queryFn: async () => (await api.get<SummaryDto>("/gl/entries/summary")).data });

  if (q.isLoading) return <CircularProgress />;
  const s = q.data;
  if (!s) return null;

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={3}>
        <Card sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">{t("gl.totalDebit")}</Typography>
          <Typography variant="h5" fontWeight={800} color="success.main">{money(s.totalDebit)}</Typography>
        </Card>
        <Card sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">{t("gl.totalCredit")}</Typography>
          <Typography variant="h5" fontWeight={800} color="error.main">{money(s.totalCredit)}</Typography>
        </Card>
        <Card sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">{t("gl.balance")}</Typography>
          <Typography variant="h5" fontWeight={800}>{money(s.balance)}</Typography>
        </Card>
      </Stack>
      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("gl.accountCode")}</TableCell>
            <TableCell>{t("gl.accountName")}</TableCell>
            <TableCell>{t("gl.accountType")}</TableCell>
            <TableCell align="right">{t("gl.debit")}</TableCell>
            <TableCell align="right">{t("gl.credit")}</TableCell>
            <TableCell align="right">{t("gl.balance")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {s.byAccount.map(r => (
              <TableRow key={r.accountCode}>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.accountCode}</TableCell>
                <TableCell>{r.accountName}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell align="right" sx={{ color: "success.main" }}>{num(r.debit)}</TableCell>
                <TableCell align="right" sx={{ color: "error.main" }}>{num(r.credit)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{num(r.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  );
}
