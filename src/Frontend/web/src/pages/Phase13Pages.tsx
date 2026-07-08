import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import LinkIcon from "@mui/icons-material/Link";
import SavingsIcon from "@mui/icons-material/Savings";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import LocalPostOfficeIcon from "@mui/icons-material/LocalPostOffice";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, num } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

/* ============================================================================
   ADVANCE PAYMENTS (Προκαταβολές)
   ========================================================================= */
export function AdvancePaymentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const q = useQuery({ queryKey: ["advance-payments", filter], queryFn: async () =>
    (await api.get("/advance-payments", { params: filter ? { status: filter } : {} })).data });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SavingsIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("advance.title")}</Typography>
              <HelpHint id="page.advance" />
            </Stack>
            <Typography color="text.secondary">{t("advance.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <SearchableTextField size="small" label={t("common.status")} value={filter} onChange={e => setFilter(e.target.value)} sx={{ width: 200 }}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {["Open", "PartiallyAllocated", "FullyAllocated", "Refunded"].map(s => <MenuItem key={s} value={s}>{t(`batchStatus.${s}`, s)}</MenuItem>)}
          </SearchableTextField>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>{t("advance.create")}</Button>
        </Stack>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("advance.number")}</TableCell>
              <TableCell>{t("advance.receivedOn")}</TableCell>
              <TableCell>{t("advance.party")}</TableCell>
              <TableCell>{t("advance.partyName")}</TableCell>
              <TableCell align="right">{t("advance.amount")}</TableCell>
              <TableCell align="right">{t("advance.allocated")}</TableCell>
              <TableCell align="right">{t("advance.available")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>{t("advance.empty")}</TableCell></TableRow>}
              {(q.data ?? []).map((a: any) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{a.number}</TableCell>
                  <TableCell>{a.receivedOn}</TableCell>
                  <TableCell>{String(t(`payeeType.${a.partyType}`, a.partyType))}</TableCell>
                  <TableCell>{a.customerName ?? a.producerName ?? a.insuranceCompanyName ?? "—"}</TableCell>
                  <TableCell align="right">{money(a.amount, a.currency)}</TableCell>
                  <TableCell align="right">{num(a.allocatedAmount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>{num(a.amount - a.allocatedAmount)}</TableCell>
                  <TableCell><Chip size="small" color={a.status === "FullyAllocated" ? "success" : a.status === "Open" ? "warning" : "info"} label={String(t(`batchStatus.${a.status}`, a.status))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateAdvanceDialog open={open} onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["advance-payments"] }); setOpen(false); }} />
    </Box>
  );
}

function CreateAdvanceDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ number: "", receivedOn: today, partyType: "Customer",
    customerId: "", producerId: "", insuranceCompanyId: "",
    amount: 0, currency: "EUR", paymentMethod: "BankTransfer", reference: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["customers-for-advance"], enabled: open && form.partyType === "Customer",
    queryFn: async () => (await api.get("/customers")).data });
  const producers = useQuery({ queryKey: ["producers-for-advance"], enabled: open && form.partyType === "Producer",
    queryFn: async () => (await api.get("/producers")).data });
  const carriers = useQuery({ queryKey: ["carriers-for-advance"], enabled: open && form.partyType === "Carrier",
    queryFn: async () => (await api.get("/insurance-companies")).data });
  useEffect(() => { if (open) setForm(f => ({ ...f, number: `AD-${Date.now().toString().slice(-6)}`, receivedOn: today, amount: 0 })); /* eslint-disable-next-line */ }, [open]);
  const save = useMutation({
    mutationFn: async () => (await api.post("/advance-payments", {
      number: form.number.trim(), receivedOn: form.receivedOn, partyType: form.partyType,
      customerId: form.partyType === "Customer" ? (form.customerId || null) : null,
      producerId: form.partyType === "Producer" ? (form.producerId || null) : null,
      insuranceCompanyId: form.partyType === "Carrier" ? (form.insuranceCompanyId || null) : null,
      amount: Number(form.amount), currency: form.currency.toUpperCase(),
      paymentMethod: form.paymentMethod, reference: form.reference || null, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("advance.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("advance.number")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth />
            <TextField type="date" label={t("advance.receivedOn")} InputLabelProps={{ shrink: true }} value={form.receivedOn} onChange={e => setForm({ ...form, receivedOn: e.target.value })} fullWidth />
          </Stack>
          <SearchableTextField label={t("advance.party")} value={form.partyType} onChange={e => setForm({ ...form, partyType: e.target.value })} fullWidth>
            {["Customer", "Producer", "Carrier"].map(p => <MenuItem key={p} value={p}>{t(`payeeType.${p}`, p)}</MenuItem>)}
          </SearchableTextField>
          {form.partyType === "Customer" && (
            <SearchableSelect
              label={t("advance.customer")}
              value={form.customerId}
              onChange={(v) => setForm({ ...form, customerId: v })}
              options={(customers.data ?? []).map((c: any) => ({
                value: c.id,
                label: c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
              }))}
            />
          )}
          {form.partyType === "Producer" && (
            <SearchableSelect
              label={t("advance.producer")}
              value={form.producerId}
              onChange={(v) => setForm({ ...form, producerId: v })}
              options={(producers.data ?? []).map((p: any) => ({ value: p.id, label: p.name }))}
            />
          )}
          {form.partyType === "Carrier" && (
            <SearchableSelect
              label={t("advance.carrier")}
              value={form.insuranceCompanyId}
              onChange={(v) => setForm({ ...form, insuranceCompanyId: v })}
              options={(carriers.data ?? []).map((c: any) => ({ value: c.id, label: c.name }))}
            />
          )}
          <Stack direction="row" spacing={2}>
            <TextField type="number" required label={t("advance.amount")} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} sx={{ width: 100 }} />
            <SearchableTextField label={t("advance.method")} value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} sx={{ width: 200 }}>
              {["Cash", "BankTransfer", "Cheque", "Card", "Other"].map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`, m)}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <TextField label={t("advance.reference")} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || form.amount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ============================================================================
   RECONCILIATION (Συσχέτιση Κινήσεων / Αναντιστοίχιστα)
   ========================================================================= */
export function ReconciliationPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["unmatched"], queryFn: async () => (await api.get("/reconciliation/unmatched")).data });
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <CompareArrowsIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("reconciliation.title")}</Typography>
            <HelpHint id="page.reconciliation" />
          </Stack>
          <Typography color="text.secondary">{t("reconciliation.subtitle")}</Typography>
        </Box>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Stack spacing={3}>
          <Section title={t("reconciliation.unmatchedReceipts")} rows={q.data?.receipts ?? []} />
          <Section title={t("reconciliation.unmatchedPayments")} rows={q.data?.payments ?? []} />
          <Section title={t("reconciliation.openAdvances")} rows={q.data?.advances ?? []} />
        </Stack>
      )}
    </Box>
  );
}

function Section({ title, rows }: { title: string; rows: any[] }) {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <Typography sx={{ p: 2, fontWeight: 700 }}>{title} ({rows.length})</Typography>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>{t("reconciliation.reference")}</TableCell>
          <TableCell>{t("reconciliation.date")}</TableCell>
          <TableCell>{t("reconciliation.party")}</TableCell>
          <TableCell align="right">{t("reconciliation.amount")}</TableCell>
          <TableCell align="right" />
        </TableRow></TableHead>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>{t("reconciliation.allMatched")}</TableCell></TableRow>}
          {rows.map((r, i) => (
            <TableRow key={r.id || i}>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.reference}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.partyName}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>{money(r.amount, r.currency)}</TableCell>
              <TableCell align="right"><IconButton size="small" color="primary"><LinkIcon fontSize="small" /></IconButton></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ============================================================================
   TACHYPAYMENTS (Ταχυπληρωμές ΕΛ.ΤΑ.)
   ========================================================================= */
export function TachyPaymentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["tachy"], queryFn: async () => (await api.get("/tachypayments")).data });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <LocalPostOfficeIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("tachy.title")}</Typography>
              <HelpHint id="page.tachy" />
            </Stack>
            <Typography color="text.secondary">{t("tachy.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>{t("tachy.create")}</Button>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined">
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("tachy.batchNumber")}</TableCell>
              <TableCell>{t("tachy.createdAt")}</TableCell>
              <TableCell>{t("tachy.dueDate")}</TableCell>
              <TableCell align="right">{t("tachy.policyCount")}</TableCell>
              <TableCell align="right">{t("tachy.totalAmount")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((b: any) => (
                <TableRow key={b.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{b.batchNumber}</TableCell>
                  <TableCell>{new Date(b.createdAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell>{b.dueDate}</TableCell>
                  <TableCell align="right">{b.policyCount}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(b.totalAmount, b.currency)}</TableCell>
                  <TableCell><Chip size="small" color={b.status === "Settled" ? "success" : b.status === "Exported" ? "info" : "default"} label={String(t(`batchStatus.${b.status}`, b.status))} /></TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<DownloadIcon />} href={`/api/tachypayments/${b.id}/export`} target="_blank">{t("tachy.exportCsv")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateTachyDialog open={open} onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["tachy"] }); setOpen(false); }} />
    </Box>
  );
}

function CreateTachyDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(today);
  const [surcharge, setSurcharge] = useState(2);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const policies = useQuery({ queryKey: ["unpaid-for-tachy"], enabled: open,
    queryFn: async () => (await api.get("/reports/507")).data });
  const save = useMutation({
    mutationFn: async () => (await api.post("/tachypayments", {
      dueDate, surchargePerSlip: Number(surcharge), policyIds: Array.from(selected)
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("tachy.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack direction="row" spacing={2} mb={2}>
          <TextField type="date" label={t("tachy.dueDate")} InputLabelProps={{ shrink: true }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <TextField type="number" label={t("tachy.surcharge")} value={surcharge} onChange={e => setSurcharge(Number(e.target.value))} />
          <Typography sx={{ ml: 2, alignSelf: "center" }}>{t("tachy.selected", { count: selected.size })}</Typography>
        </Stack>
        <Card variant="outlined" sx={{ maxHeight: 400, overflow: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell />
              <TableCell>{t("tachy.policyNumber")}</TableCell>
              <TableCell>{t("tachy.customer")}</TableCell>
              <TableCell align="right">{t("tachy.outstanding")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(policies.data ?? []).map((p: any) => (
                <TableRow key={p.id} hover selected={selected.has(p.id)} onClick={() => toggle(p.id)} sx={{ cursor: "pointer" }}>
                  <TableCell><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{p.policyNumber}</TableCell>
                  <TableCell>{p.customerName}</TableCell>
                  <TableCell align="right">{money(p.outstanding, p.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || selected.size === 0}>{t("tachy.createBatch")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ============================================================================
   INFO CENTER (Ελληνικό Κέντρο Πληροφοριών)
   ========================================================================= */
export function InfoCenterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [kind, setKind] = useState("Vehicles");
  const q = useQuery({ queryKey: ["info-center"], queryFn: async () => (await api.get("/info-center")).data });
  const create = useMutation({ mutationFn: async () => (await api.post("/info-center", { kind })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["info-center"] }) });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <CloudUploadIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("infoCenter.title")}</Typography>
              <HelpHint id="page.infoCenter" />
            </Stack>
            <Typography color="text.secondary">{t("infoCenter.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <SearchableTextField label={t("infoCenter.kind")} value={kind} onChange={e => setKind(e.target.value)} sx={{ width: 200 }}>
            {["Vehicles", "Customers", "Policies"].map(k => <MenuItem key={k} value={k}>{t(`infoCenterKind.${k}`, k)}</MenuItem>)}
          </SearchableTextField>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => create.mutate()} disabled={create.isPending}>{t("infoCenter.createBatch")}</Button>
        </Stack>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>{t("infoCenter.note")}</Alert>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined">
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("infoCenter.batchNumber")}</TableCell>
              <TableCell>{t("infoCenter.createdAt")}</TableCell>
              <TableCell>{t("infoCenter.kind")}</TableCell>
              <TableCell align="right">{t("infoCenter.recordCount")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell>{t("infoCenter.response")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{e.batchNumber}</TableCell>
                  <TableCell>{new Date(e.createdAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell>{String(t(`infoCenterKind.${e.kind}`, e.kind))}</TableCell>
                  <TableCell align="right">{e.recordCount}</TableCell>
                  <TableCell><Chip size="small" color={e.status === "Accepted" ? "success" : e.status === "Rejected" ? "error" : "default"} label={String(t(`batchStatus.${e.status}`, e.status))} /></TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{e.responseCode ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}

/* ============================================================================
   VEHICLE MODELS (lookup catalog)
   ========================================================================= */
export function VehicleModelsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["vehicle-models"], queryFn: async () => (await api.get("/vehicle-models")).data });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <DirectionsCarIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("vehicles.title")}</Typography>
              <HelpHint id="page.vehicles" />
            </Stack>
            <Typography color="text.secondary">{t("vehicles.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>{t("vehicles.create")}</Button>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("vehicles.manufacturer")}</TableCell>
              <TableCell>{t("vehicles.model")}</TableCell>
              <TableCell>{t("vehicles.trim")}</TableCell>
              <TableCell align="right">{t("vehicles.engineCc")}</TableCell>
              <TableCell align="right">{t("vehicles.hp")}</TableCell>
              <TableCell>{t("vehicles.fuel")}</TableCell>
              <TableCell>{t("vehicles.category")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{v.manufacturer}</TableCell>
                  <TableCell>{v.model}</TableCell>
                  <TableCell>{v.trim ?? "—"}</TableCell>
                  <TableCell align="right">{v.engineCc ?? "—"}</TableCell>
                  <TableCell align="right">{v.horsePower ?? "—"}</TableCell>
                  <TableCell>{v.fuelType ?? "—"}</TableCell>
                  <TableCell>{v.category ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateVehicleDialog open={open} onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["vehicle-models"] }); setOpen(false); }} />
    </Box>
  );
}

function CreateVehicleDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ manufacturer: "", model: "", trim: "", engineCc: "", horsePower: "", fuelType: "Petrol", category: "passenger", isActive: true });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post("/vehicle-models", {
      manufacturer: form.manufacturer.trim(), model: form.model.trim(),
      trim: form.trim || null, engineCc: form.engineCc ? Number(form.engineCc) : null,
      horsePower: form.horsePower ? Number(form.horsePower) : null,
      fuelType: form.fuelType, category: form.category, isActive: form.isActive
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("vehicles.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("vehicles.manufacturer")} value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} fullWidth />
            <TextField required label={t("vehicles.model")} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("vehicles.trim")} value={form.trim} onChange={e => setForm({ ...form, trim: e.target.value })} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField type="number" label={t("vehicles.engineCc")} value={form.engineCc} onChange={e => setForm({ ...form, engineCc: e.target.value })} fullWidth />
            <TextField type="number" label={t("vehicles.hp")} value={form.horsePower} onChange={e => setForm({ ...form, horsePower: e.target.value })} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <SearchableTextField label={t("vehicles.fuel")} value={form.fuelType} onChange={e => setForm({ ...form, fuelType: e.target.value })} fullWidth>
              {["Petrol", "Diesel", "Hybrid", "Electric", "LPG", "CNG"].map(f => <MenuItem key={f} value={f}>{String(t(`fuel.${f}`, f))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("vehicles.category")} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth>
              {["passenger", "van", "truck", "motorcycle", "bus", "tractor"].map(c => <MenuItem key={c} value={c}>{String(t(`vehicleClass.${c}`, c))}</MenuItem>)}
            </SearchableTextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.manufacturer.trim() || !form.model.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}
