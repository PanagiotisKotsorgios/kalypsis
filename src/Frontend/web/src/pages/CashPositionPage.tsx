import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LocalAtmIcon from "@mui/icons-material/LocalAtm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface CashAccountDto { id: string; code: string; name: string; currency: string; currentBalance: number; isActive: boolean; notes: string | null; }
interface MovementDto {
  id: string; cashAccountId: string; cashAccountName: string;
  movementDate: string; direction: string; amount: number; currency: string;
  reason: string; reference: string | null;
}

export function CashPositionPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newMovementOpen, setNewMovementOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const accounts = useQuery({ queryKey: ["cash-accounts"], queryFn: async () => (await api.get<CashAccountDto[]>("/cash/accounts")).data });
  const movements = useQuery({
    queryKey: ["cash-movements", filter],
    queryFn: async () => (await api.get<MovementDto[]>("/cash/movements", { params: filter ? { cashAccountId: filter } : {} })).data
  });

  const totalCash = (accounts.data ?? []).reduce((s, a) => s + a.currentBalance, 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <LocalAtmIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("cash.title")}</Typography>
              <HelpHint id="page.cash" />
            </Stack>
            <Typography color="text.secondary">{t("cash.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("cash.totalLabel")}</Typography>
            <Typography variant="h5" fontWeight={800} color="success.main">{totalCash.toFixed(2)} €</Typography>
          </Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewAccountOpen(true)}>{t("cash.createAccount")}</Button>
          <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setNewMovementOpen(true)}>{t("cash.createMovement")}</Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        {(accounts.data ?? []).map(a => (
          <Card key={a.id} variant="outlined" sx={{ p: 2, flex: 1, cursor: "pointer", borderColor: filter === a.id ? "primary.main" : undefined, borderWidth: filter === a.id ? 2 : 1 }} onClick={() => setFilter(filter === a.id ? "" : a.id)}>
            <Typography variant="caption" color="text.secondary">{a.code}</Typography>
            <Typography fontWeight={700}>{a.name}</Typography>
            <Typography variant="h5" fontWeight={800} color={a.currentBalance >= 0 ? "success.main" : "error.main"}>
              {a.currentBalance.toFixed(2)} {a.currency}
            </Typography>
          </Card>
        ))}
      </Stack>

      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("cash.movementDate")}</TableCell>
            <TableCell>{t("cash.account")}</TableCell>
            <TableCell>{t("cash.direction")}</TableCell>
            <TableCell>{t("cash.reason")}</TableCell>
            <TableCell>{t("cash.reference")}</TableCell>
            <TableCell align="right">{t("cash.amount")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {movements.isLoading && <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={20} /></TableCell></TableRow>}
            {!movements.isLoading && (movements.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("cash.noMovements")}</TableCell></TableRow>
            )}
            {(movements.data ?? []).map(m => (
              <TableRow key={m.id} hover>
                <TableCell>{m.movementDate}</TableCell>
                <TableCell>{m.cashAccountName}</TableCell>
                <TableCell><Typography sx={{ fontWeight: 700, color: m.direction === "In" ? "success.main" : "error.main" }}>{m.direction === "In" ? "▲ In" : "▼ Out"}</Typography></TableCell>
                <TableCell>{m.reason}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{m.reference ?? "—"}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: m.direction === "In" ? "success.main" : "error.main" }}>
                  {(m.direction === "In" ? "+" : "−")}{m.amount.toFixed(2)} {m.currency}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AccountDialog open={newAccountOpen} onClose={() => setNewAccountOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["cash-accounts"] }); setNewAccountOpen(false); }} />
      <MovementDialog open={newMovementOpen} onClose={() => setNewMovementOpen(false)} accounts={accounts.data ?? []}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["cash-accounts"] }); void qc.invalidateQueries({ queryKey: ["cash-movements"] }); setNewMovementOpen(false); }} />
    </Box>
  );
}

function AccountDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ code: "", name: "", currency: "EUR", isActive: true, notes: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) setForm({ code: "", name: "", currency: "EUR", isActive: true, notes: "" }); }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/cash/accounts", {
      code: form.code.trim(), name: form.name.trim(),
      currency: form.currency.toUpperCase(), isActive: form.isActive,
      notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("cash.createAccountTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("cash.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <TextField required label={t("cash.accountName")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
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

function MovementDialog({ open, onClose, accounts, onSaved }: { open: boolean; onClose: () => void; accounts: CashAccountDto[]; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ cashAccountId: "", movementDate: today, direction: "In", amount: 0, currency: "EUR", reason: "", reference: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) setForm({ cashAccountId: accounts[0]?.id ?? "", movementDate: today, direction: "In", amount: 0, currency: "EUR", reason: "", reference: "" }); /* eslint-disable-next-line */ }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/cash/movements", {
      cashAccountId: form.cashAccountId, movementDate: form.movementDate,
      direction: form.direction, amount: Number(form.amount), currency: form.currency.toUpperCase(),
      reason: form.reason.trim(), reference: form.reference || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("cash.createMovementTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField select required label={t("cash.account")} value={form.cashAccountId}
            onChange={e => setForm({ ...form, cashAccountId: e.target.value })} fullWidth>
            {accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name} ({a.currentBalance.toFixed(2)} {a.currency})</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("cash.movementDate")} InputLabelProps={{ shrink: true }}
              value={form.movementDate} onChange={e => setForm({ ...form, movementDate: e.target.value })} fullWidth />
            <TextField select label={t("cash.direction")} value={form.direction}
              onChange={e => setForm({ ...form, direction: e.target.value })} fullWidth>
              <MenuItem value="In">In (+)</MenuItem>
              <MenuItem value="Out">Out (−)</MenuItem>
            </TextField>
            <TextField required type="number" label={t("cash.amount")} value={form.amount}
              onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
          </Stack>
          <TextField required label={t("cash.reason")} value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })} fullWidth placeholder="π.χ. Είσπραξη ασφαλίστρου / Πληρωμή προμηθευτή" />
          <TextField label={t("cash.reference")} value={form.reference}
            onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.cashAccountId || form.amount <= 0 || !form.reason.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
