import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

// Unified configuration hub — Movement Types, Bonus-Malus, Renewal Rules,
// Register Templates, Custom Fields, SAP Bridge, Period Locks.

export function ConfigHubPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <TuneIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("configHub.title")}</Typography>
            <HelpHint id="page.configHub" />
          </Stack>
          <Typography color="text.secondary">{t("configHub.subtitle")}</Typography>
        </Box>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 3 }}>
        <Tab label={t("configHub.movementTypes")} />
        <Tab label={t("configHub.bonusMalus")} />
        <Tab label={t("configHub.renewalRules")} />
        <Tab label={t("configHub.registerTemplates")} />
        <Tab label={t("configHub.customFields")} />
        <Tab label={t("configHub.sapBridge")} />
        <Tab label={t("configHub.periodLocks")} />
      </Tabs>
      {tab === 0 && <MovementTypesPanel />}
      {tab === 1 && <BonusMalusPanel />}
      {tab === 2 && <RenewalRulesPanel />}
      {tab === 3 && <RegisterTemplatesPanel />}
      {tab === 4 && <CustomFieldsPanel />}
      {tab === 5 && <SapBridgePanel />}
      {tab === 6 && <PeriodLocksPanel />}
    </Box>
  );
}

/* ---------- Movement Types ---------- */
function MovementTypesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<any | null>(null);
  const q = useQuery({ queryKey: ["movement-types"], queryFn: async () => (await api.get("/movement-types")).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/movement-types/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["movement-types"] }) });
  return (
    <Box>
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen({})} sx={{ mb: 2 }}>{t("configHub.newMovementType")}</Button>
      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("configHub.code")}</TableCell>
            <TableCell>{t("configHub.name")}</TableCell>
            <TableCell>{t("configHub.category")}</TableCell>
            <TableCell>{t("configHub.party")}</TableCell>
            <TableCell>{t("configHub.autoChargeCustomer")}</TableCell>
            <TableCell>{t("configHub.autoOffset")}</TableCell>
            <TableCell>{t("configHub.cashType")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {(q.data ?? []).map((m: any) => (
              <TableRow key={m.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{m.code}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.category}</TableCell>
                <TableCell>{m.party}</TableCell>
                <TableCell>{m.autoChargeCustomer && <Chip size="small" color="success" label="✓" />}</TableCell>
                <TableCell>{m.autoOffsetCarrier && <Chip size="small" color="success" label="✓" />}</TableCell>
                <TableCell>{m.isCashType && <Chip size="small" color="info" label="cash" />}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setOpen(m)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(m.id); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <MovementTypeDialog item={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["movement-types"] }); setOpen(null); }} />
    </Box>
  );
}

function MovementTypeDialog({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ code: "", name: "", category: "Charge", party: "Customer",
    autoChargeCustomer: false, autoOffsetCarrier: false, glAccountId: "",
    receiptNumberPrefix: "", receiptPadding: 6, isCashType: false, isActive: true, displayOrder: 0 });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item && item.id) setForm({ ...item, glAccountId: item.glAccountId ?? "" });
    else setForm({ code: "", name: "", category: "Charge", party: "Customer",
      autoChargeCustomer: false, autoOffsetCarrier: false, glAccountId: "",
      receiptNumberPrefix: "", receiptPadding: 6, isCashType: false, isActive: true, displayOrder: 0 });
  }, [item]);
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, glAccountId: form.glAccountId || null };
      if (item?.id) return (await api.put(`/movement-types/${item.id}`, body)).data;
      return (await api.post("/movement-types", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  if (!item) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{item.id ? t("common.edit") : t("configHub.newMovementType")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("configHub.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField required label={t("configHub.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <SearchableTextField label={t("configHub.category")} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth>
              {["Charge", "Receipt", "Payment", "Commission", "Prepayment", "Reversal"].map(c => <MenuItem key={c} value={c}>{String(t(`financialMovement.${c}`, c))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("configHub.party")} value={form.party} onChange={e => setForm({ ...form, party: e.target.value })} fullWidth>
              {["Customer", "Producer", "Carrier", "Vendor"].map(p => <MenuItem key={p} value={p}>{String(t(`partyKind.${p}`, p))}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label={t("configHub.receiptPrefix")} value={form.receiptNumberPrefix} onChange={e => setForm({ ...form, receiptNumberPrefix: e.target.value })} fullWidth />
            <TextField type="number" label={t("configHub.padding")} value={form.receiptPadding} onChange={e => setForm({ ...form, receiptPadding: Number(e.target.value) })} sx={{ width: 120 }} />
            <TextField type="number" label={t("configHub.displayOrder")} value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })} sx={{ width: 120 }} />
          </Stack>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.autoChargeCustomer} onChange={e => setForm({ ...form, autoChargeCustomer: e.target.checked })} />
              <Typography>{t("configHub.autoChargeCustomer")}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.autoOffsetCarrier} onChange={e => setForm({ ...form, autoOffsetCarrier: e.target.checked })} />
              <Typography>{t("configHub.autoOffset")}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isCashType} onChange={e => setForm({ ...form, isCashType: e.target.checked })} />
              <Typography>{t("configHub.cashType")}</Typography>
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

/* ---------- Bonus-Malus ---------- */
function BonusMalusPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<any | null>(null);
  const q = useQuery({ queryKey: ["bonus-malus"], queryFn: async () => (await api.get("/bonus-malus")).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/bonus-malus/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus-malus"] }) });
  return (
    <Box>
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen({})} sx={{ mb: 2 }}>{t("configHub.newBonusMalus")}</Button>
      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("configHub.name")}</TableCell>
            <TableCell>{t("configHub.policyType")}</TableCell>
            <TableCell align="right">{t("configHub.claimsFrom")}</TableCell>
            <TableCell align="right">{t("configHub.claimsTo")}</TableCell>
            <TableCell align="right">{t("configHub.adjustment")}</TableCell>
            <TableCell>{t("configHub.direction")}</TableCell>
            <TableCell>{t("configHub.effectiveFrom")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {(q.data ?? []).map((r: any) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                <TableCell>{r.policyTypeFilter}</TableCell>
                <TableCell align="right">{r.claimsCountFrom}</TableCell>
                <TableCell align="right">{r.claimsCountTo}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: r.adjustmentPercent > 0 ? "error.main" : "success.main" }}>{r.adjustmentPercent > 0 ? "+" : ""}{r.adjustmentPercent}%</TableCell>
                <TableCell>{r.adjustmentDirection}</TableCell>
                <TableCell>{r.effectiveFrom}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setOpen(r)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <BonusMalusDialog item={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["bonus-malus"] }); setOpen(null); }} />
    </Box>
  );
}

function BonusMalusDialog({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: "", insuranceCompanyId: "", policyTypeFilter: "Auto",
    claimsCountFrom: 0, claimsCountTo: 0, adjustmentPercent: 0, adjustmentDirection: "Premium",
    effectiveFrom: today, effectiveTo: "", isActive: true });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item && item.id) setForm({ ...item, insuranceCompanyId: item.insuranceCompanyId ?? "", effectiveTo: item.effectiveTo ?? "" });
    else setForm({ name: "", insuranceCompanyId: "", policyTypeFilter: "Auto",
      claimsCountFrom: 0, claimsCountTo: 0, adjustmentPercent: 0, adjustmentDirection: "Premium",
      effectiveFrom: today, effectiveTo: "", isActive: true });
  }, [item]);
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, insuranceCompanyId: form.insuranceCompanyId || null, effectiveTo: form.effectiveTo || null };
      if (item?.id) return (await api.put(`/bonus-malus/${item.id}`, body)).data;
      return (await api.post("/bonus-malus", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  if (!item) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{item.id ? t("common.edit") : t("configHub.newBonusMalus")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField required label={t("configHub.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth placeholder="π.χ. 0 ζημίες = 15% έκπτωση" />
          <Stack direction="row" spacing={2}>
            <SearchableTextField label={t("configHub.policyType")} value={form.policyTypeFilter} onChange={e => setForm({ ...form, policyTypeFilter: e.target.value })} fullWidth>
              {["Auto", "Home", "Health", "Life", "Business", "Travel"].map(p => <MenuItem key={p} value={p}>{String(t(`policyType.${p}`, p))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("configHub.direction")} value={form.adjustmentDirection} onChange={e => setForm({ ...form, adjustmentDirection: e.target.value })} fullWidth>
              {["Premium", "Commission", "Both"].map(d => <MenuItem key={d} value={d}>{String(t(`premiumScope.${d}`, d))}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField type="number" label={t("configHub.claimsFrom")} value={form.claimsCountFrom} onChange={e => setForm({ ...form, claimsCountFrom: Number(e.target.value) })} fullWidth />
            <TextField type="number" label={t("configHub.claimsTo")} value={form.claimsCountTo} onChange={e => setForm({ ...form, claimsCountTo: Number(e.target.value) })} fullWidth />
            <TextField type="number" label={t("configHub.adjustment")} value={form.adjustmentPercent} onChange={e => setForm({ ...form, adjustmentPercent: Number(e.target.value) })} fullWidth helperText="% (negative = discount)" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField type="date" label={t("configHub.effectiveFrom")} InputLabelProps={{ shrink: true }} value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} fullWidth />
            <TextField type="date" label={t("configHub.effectiveTo")} InputLabelProps={{ shrink: true }} value={form.effectiveTo} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} fullWidth />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Renewal Rules ---------- */
function RenewalRulesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<any | null>(null);
  const q = useQuery({ queryKey: ["renewal-rules"], queryFn: async () => (await api.get("/renewal-rules")).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/renewal-rules/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["renewal-rules"] }) });
  return (
    <Box>
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen({})} sx={{ mb: 2 }}>{t("configHub.newRenewalRule")}</Button>
      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("configHub.name")}</TableCell>
            <TableCell>{t("configHub.policyType")}</TableCell>
            <TableCell>{t("configHub.condition")}</TableCell>
            <TableCell>{t("configHub.action")}</TableCell>
            <TableCell>{t("common.status")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {(q.data ?? []).map((r: any) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                <TableCell>{r.policyTypeFilter}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{r.conditionJson}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{r.actionJson}</TableCell>
                <TableCell><Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "active" : "inactive"} /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setOpen(r)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <RenewalRuleDialog item={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["renewal-rules"] }); setOpen(null); }} />
    </Box>
  );
}

function RenewalRuleDialog({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", policyTypeFilter: "*", insuranceCompanyId: "",
    conditionJson: '{"claims_lt":1}', actionJson: '{"discount_percent":15}', displayOrder: 0, isActive: true });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item && item.id) setForm({ ...item, insuranceCompanyId: item.insuranceCompanyId ?? "" });
    else setForm({ name: "", policyTypeFilter: "*", insuranceCompanyId: "",
      conditionJson: '{"claims_lt":1}', actionJson: '{"discount_percent":15}', displayOrder: 0, isActive: true });
  }, [item]);
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, insuranceCompanyId: form.insuranceCompanyId || null };
      if (item?.id) return (await api.put(`/renewal-rules/${item.id}`, body)).data;
      return (await api.post("/renewal-rules", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  if (!item) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{item.id ? t("common.edit") : t("configHub.newRenewalRule")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField required label={t("configHub.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <Stack direction="row" spacing={2}>
            <SearchableTextField label={t("configHub.policyType")} value={form.policyTypeFilter} onChange={e => setForm({ ...form, policyTypeFilter: e.target.value })} sx={{ width: 200 }}>
              {["*", "Auto", "Home", "Health", "Life", "Business", "Travel"].map(p => <MenuItem key={p} value={p}>{p === "*" ? "All" : p}</MenuItem>)}
            </SearchableTextField>
            <TextField type="number" label={t("configHub.displayOrder")} value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })} sx={{ width: 120 }} />
          </Stack>
          <TextField label={t("configHub.conditionJson")} value={form.conditionJson} onChange={e => setForm({ ...form, conditionJson: e.target.value })} fullWidth multiline rows={3} sx={{ fontFamily: "monospace" }} helperText='e.g. {"claims_lt":1, "customer_age_lt":30}' />
          <TextField label={t("configHub.actionJson")} value={form.actionJson} onChange={e => setForm({ ...form, actionJson: e.target.value })} fullWidth multiline rows={3} sx={{ fontFamily: "monospace" }} helperText='e.g. {"discount_percent":15, "set_flag":"young-driver"}' />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Register Templates ---------- */
function RegisterTemplatesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<any | null>(null);
  const q = useQuery({ queryKey: ["register-templates"], queryFn: async () => (await api.get("/register-templates")).data });
  return (
    <Box>
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen({})} sx={{ mb: 2 }}>{t("configHub.newRegisterTemplate")}</Button>
      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("configHub.code")}</TableCell>
            <TableCell>{t("configHub.name")}</TableCell>
            <TableCell>{t("configHub.policyType")}</TableCell>
            <TableCell>{t("configHub.default")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {(q.data ?? []).map((r: any) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.policyTypeFilter}</TableCell>
                <TableCell>{r.isDefault && <Chip size="small" color="primary" label="default" />}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => setOpen(r)}><EditIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <RegisterTemplateDialog item={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["register-templates"] }); setOpen(null); }} />
    </Box>
  );
}

function RegisterTemplateDialog({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ code: "", name: "", policyTypeFilter: "*",
    columnsJson: '[{"field":"PolicyNumber","label":"Αρ.","width":120},{"field":"Customer","label":"Πελάτης","width":240},{"field":"Premium","label":"Ασφάλιστρο","width":120,"align":"right"}]',
    showSubtotals: false, groupByField: "", isDefault: false, isActive: true });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item && item.id) setForm({ ...item, groupByField: item.groupByField ?? "" });
    else setForm({ code: "", name: "", policyTypeFilter: "*",
      columnsJson: '[{"field":"PolicyNumber","label":"Αρ.","width":120},{"field":"Customer","label":"Πελάτης","width":240},{"field":"Premium","label":"Ασφάλιστρο","width":120,"align":"right"}]',
      showSubtotals: false, groupByField: "", isDefault: false, isActive: true });
  }, [item]);
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, groupByField: form.groupByField || null };
      if (item?.id) return (await api.put(`/register-templates/${item.id}`, body)).data;
      return (await api.post("/register-templates", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  if (!item) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{item.id ? t("common.edit") : t("configHub.newRegisterTemplate")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("configHub.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField required label={t("configHub.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <TextField label={t("configHub.columnsJson")} value={form.columnsJson} onChange={e => setForm({ ...form, columnsJson: e.target.value })} fullWidth multiline rows={6} sx={{ fontFamily: "monospace" }} />
          <Stack direction="row" alignItems="center" spacing={2}>
            <TextField label={t("configHub.groupBy")} value={form.groupByField} onChange={e => setForm({ ...form, groupByField: e.target.value })} sx={{ flex: 1 }} placeholder="PolicyType / Carrier" />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.showSubtotals} onChange={e => setForm({ ...form, showSubtotals: e.target.checked })} />
              <Typography>{t("configHub.subtotals")}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} />
              <Typography>{t("configHub.default")}</Typography>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.name.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Custom Fields ---------- */
function CustomFieldsPanel() {
  const { t } = useTranslation();
  const [entityType, setEntityType] = useState("Customer");
  const qc = useQueryClient();
  const [open, setOpen] = useState<any | null>(null);
  const q = useQuery({ queryKey: ["custom-fields", entityType],
    queryFn: async () => (await api.get(`/custom-fields/definitions`, { params: { entityType } })).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/custom-fields/definitions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-fields", entityType] }) });
  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <SearchableTextField label={t("configHub.entityType")} value={entityType} onChange={e => setEntityType(e.target.value)} sx={{ width: 200 }}>
          {["Customer", "Producer", "Policy", "Claim", "Vehicle"].map(e => <MenuItem key={e} value={e}>{String(t(`documentEntity.${e}`, e))}</MenuItem>)}
        </SearchableTextField>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen({ entityType })}>{t("configHub.newCustomField")}</Button>
      </Stack>
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("configHub.fieldCode")}</TableCell>
            <TableCell>{t("configHub.fieldLabel")}</TableCell>
            <TableCell>{t("configHub.fieldKind")}</TableCell>
            <TableCell>{t("configHub.fieldRequired")}</TableCell>
            <TableCell align="right">{t("configHub.displayOrder")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {(q.data ?? []).map((f: any) => (
              <TableRow key={f.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{f.code}</TableCell>
                <TableCell>{f.label}</TableCell>
                <TableCell>{f.kind}</TableCell>
                <TableCell>{f.isRequired && <Chip size="small" color="warning" label="required" />}</TableCell>
                <TableCell align="right">{f.displayOrder}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setOpen(f)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(f.id); }}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <CustomFieldDialog item={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["custom-fields", entityType] }); setOpen(null); }} />
    </Box>
  );
}

function CustomFieldDialog({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ entityType: "Customer", code: "", label: "", kind: "Text",
    options: "", lookupEntity: "", isRequired: false, displayOrder: 0, isActive: true, helpText: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item && item.id) setForm({ ...item, options: item.options ?? "", lookupEntity: item.lookupEntity ?? "", helpText: item.helpText ?? "" });
    else if (item) setForm({ entityType: item.entityType || "Customer", code: "", label: "", kind: "Text",
      options: "", lookupEntity: "", isRequired: false, displayOrder: 0, isActive: true, helpText: "" });
  }, [item]);
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, options: form.options || null, lookupEntity: form.lookupEntity || null, helpText: form.helpText || null };
      if (item?.id) return (await api.put(`/custom-fields/definitions/${item.id}`, body)).data;
      return (await api.post("/custom-fields/definitions", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  if (!item) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{item.id ? t("common.edit") : t("configHub.newCustomField")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("configHub.fieldCode")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField required label={t("configHub.fieldLabel")} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <SearchableTextField label={t("configHub.fieldKind")} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} fullWidth>
              {["Text", "Number", "Date", "Boolean", "Select", "Lookup"].map(k => <MenuItem key={k} value={k}>{String(t(`fieldKind.${k}`, k))}</MenuItem>)}
            </SearchableTextField>
            <TextField type="number" label={t("configHub.displayOrder")} value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })} sx={{ width: 140 }} />
          </Stack>
          {form.kind === "Select" && (
            <TextField label={t("configHub.fieldOptions")} value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} fullWidth helperText="Pipe-separated, e.g. Yes|No|Maybe" />
          )}
          {form.kind === "Lookup" && (
            <TextField label={t("configHub.fieldLookup")} value={form.lookupEntity} onChange={e => setForm({ ...form, lookupEntity: e.target.value })} fullWidth placeholder="VehicleModel" />
          )}
          <TextField label={t("configHub.fieldHelp")} value={form.helpText} onChange={e => setForm({ ...form, helpText: e.target.value })} fullWidth multiline rows={2} />
          <Stack direction="row" spacing={3}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isRequired} onChange={e => setForm({ ...form, isRequired: e.target.checked })} />
              <Typography>{t("configHub.fieldRequired")}</Typography>
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
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.label.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- SAP Bridge ---------- */
function SapBridgePanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<any | null>(null);
  const q = useQuery({ queryKey: ["sap-bridge"], queryFn: async () => (await api.get("/sap-bridge")).data });
  return (
    <Box>
      <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen({})} sx={{ mb: 2 }}>{t("configHub.newSapMapping")}</Button>
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("configHub.movementType")}</TableCell>
            <TableCell>{t("configHub.sapAccount")}</TableCell>
            <TableCell>{t("configHub.costCenter")}</TableCell>
            <TableCell>{t("configHub.profitCenter")}</TableCell>
            <TableCell>{t("configHub.exportEnabled")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {(q.data ?? []).map((m: any) => (
              <TableRow key={m.id} hover>
                <TableCell>{m.movementTypeName}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{m.sapAccount}</TableCell>
                <TableCell>{m.costCenter ?? "—"}</TableCell>
                <TableCell>{m.profitCenter ?? "—"}</TableCell>
                <TableCell>{m.exportEnabled && <Chip size="small" color="success" label="✓" />}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => setOpen(m)}><EditIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <SapMappingDialog item={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["sap-bridge"] }); setOpen(null); }} />
    </Box>
  );
}

function SapMappingDialog({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ movementTypeId: "", sapAccount: "", costCenter: "", profitCenter: "", exportEnabled: true });
  const [err, setErr] = useState<string | null>(null);
  const mts = useQuery({ queryKey: ["movement-types-for-sap"], enabled: !!item,
    queryFn: async () => (await api.get("/movement-types")).data });
  useEffect(() => {
    if (item && item.id) setForm({ ...item, costCenter: item.costCenter ?? "", profitCenter: item.profitCenter ?? "" });
    else if (item) setForm({ movementTypeId: "", sapAccount: "", costCenter: "", profitCenter: "", exportEnabled: true });
  }, [item]);
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, costCenter: form.costCenter || null, profitCenter: form.profitCenter || null };
      if (item?.id) return (await api.put(`/sap-bridge/${item.id}`, body)).data;
      return (await api.post("/sap-bridge", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  if (!item) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{item.id ? t("common.edit") : t("configHub.newSapMapping")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <SearchableSelect
            label={t("configHub.movementType")}
            required
            value={form.movementTypeId}
            onChange={(v) => setForm({ ...form, movementTypeId: v })}
            options={(mts.data ?? []).map((m: any) => ({ value: m.id, label: m.name }))}
          />
          <TextField required label={t("configHub.sapAccount")} value={form.sapAccount} onChange={e => setForm({ ...form, sapAccount: e.target.value })} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField label={t("configHub.costCenter")} value={form.costCenter} onChange={e => setForm({ ...form, costCenter: e.target.value })} fullWidth />
            <TextField label={t("configHub.profitCenter")} value={form.profitCenter} onChange={e => setForm({ ...form, profitCenter: e.target.value })} fullWidth />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.exportEnabled} onChange={e => setForm({ ...form, exportEnabled: e.target.checked })} />
            <Typography>{t("configHub.exportEnabled")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.movementTypeId || !form.sapAccount.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Period Locks ---------- */
function PeriodLocksPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [scope, setScope] = useState("All");
  const [lockDate, setLockDate] = useState(new Date().toISOString().slice(0, 10));
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["period-locks"], queryFn: async () => (await api.get("/period-locks")).data });
  const save = useMutation({
    mutationFn: async () => (await api.post("/period-locks", { scope, lockedBefore: lockDate, autoAdvanceDaily: autoAdvance, reason: reason || null })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["period-locks"] })
  });
  return (
    <Box>
      <Card sx={{ p: 2, mb: 3 }}>
        <Typography fontWeight={700} mb={2}>{t("configHub.newPeriodLock")}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <SearchableTextField label={t("configHub.scope")} value={scope} onChange={e => setScope(e.target.value)} sx={{ width: 180 }}>
            {["All", "Policies", "Receipts", "Claims"].map(s => <MenuItem key={s} value={s}>{String(t(`workflowScope.${s}`, s))}</MenuItem>)}
          </SearchableTextField>
          <TextField type="date" label={t("configHub.lockedBefore")} InputLabelProps={{ shrink: true }} value={lockDate} onChange={e => setLockDate(e.target.value)} />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} />
            <Typography>{t("configHub.autoAdvance")}</Typography>
          </Stack>
          <TextField label={t("configHub.reason")} value={reason} onChange={e => setReason(e.target.value)} sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
        </Stack>
      </Card>
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("configHub.scope")}</TableCell>
            <TableCell>{t("configHub.lockedBefore")}</TableCell>
            <TableCell>{t("configHub.autoAdvance")}</TableCell>
            <TableCell>{t("configHub.reason")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {(q.data ?? []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell sx={{ fontWeight: 600 }}>{p.scope}</TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{p.lockedBefore}</TableCell>
                <TableCell>{p.autoAdvanceDaily && <Chip size="small" color="info" label="daily" />}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{p.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  );
}
