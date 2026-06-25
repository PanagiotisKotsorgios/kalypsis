import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import { NumberedPager } from "../components/TableToolbar";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

const TYPES = ["Auto","Home","Health","Life","Business","Travel","Other"] as const;
const STATUS_COLOR: Record<string, "default"|"success"|"error"> = { Draft: "default", Finalised: "success", Cancelled: "error" };

interface RunDto {
  id: string; year: number; month: number; title: string; status: "Draft"|"Finalised"|"Cancelled";
  generatedAt: string; finalisedAt: string | null; generatedByUserName: string | null;
  filterInsuranceCompanyId: string | null; filterInsuranceCompanyName: string | null;
  filterProducerId: string | null; filterProducerName: string | null;
  filterPolicyType: string | null; filterPackageCode: string | null;
  lineCount: number; totalCommission: number; totalPremium: number; currency: string;
  notes: string | null;
}

interface LineDto {
  id: string; policyId: string; policyNumber: string;
  producerId: string | null; producerName: string | null;
  insuranceCompanyId: string; insuranceCompanyName: string;
  policyType: string; packageCode: string | null;
  premium: number; ratePercent: number; commissionAmount: number;
  isOverridden: boolean; originalCommissionAmount: number | null; overrideReason: string | null;
}

interface CompanyLite { id: string; name: string; }
interface ProducerLite { id: string; name: string; }

export function CommissionRunsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // -------- Filter state --------
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter]   = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [carrierFilter, setCarrierFilter]   = useState<string>("");
  const [producerFilter, setProducerFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const q = useQuery({ queryKey: ["commission-runs"], queryFn: async () => (await api.get<RunDto[]>("/commission-runs")).data });
  const carriersQ = useQuery({ queryKey: ["insurance-companies-lite-runs"],
    queryFn: async () => (await api.get<CompanyLite[]>("/insurance-companies")).data });
  const producersQ = useQuery({ queryKey: ["producers-lite-runs"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/commission-runs/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["commission-runs"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const rawRuns = q.data ?? [];
  const filtered = useMemo(() => rawRuns.filter(r => {
    if (yearFilter   && String(r.year)  !== yearFilter)  return false;
    if (monthFilter  && String(r.month) !== monthFilter) return false;
    if (statusFilter && r.status        !== statusFilter) return false;
    if (carrierFilter  && r.filterInsuranceCompanyId !== carrierFilter)  return false;
    if (producerFilter && r.filterProducerId          !== producerFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${r.title ?? ""} ${r.filterInsuranceCompanyName ?? ""} ${r.filterProducerName ?? ""} ${r.filterPolicyType ?? ""} ${r.filterPackageCode ?? ""} ${r.notes ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [rawRuns, yearFilter, monthFilter, statusFilter, carrierFilter, producerFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalCommission = filtered.reduce((s, r) => s + r.totalCommission, 0);
  const totalPremium    = filtered.reduce((s, r) => s + r.totalPremium, 0);
  const totalLines      = filtered.reduce((s, r) => s + r.lineCount, 0);
  const years = useMemo(() => [...new Set(rawRuns.map(r => r.year))].sort((a, b) => b - a), [rawRuns]);

  // Auth-aware CSV download (anchor `href` would strip the JWT).
  async function downloadCsv(runId: string) {
    try {
      const res = await api.get(`/commission-runs/${runId}/export.csv`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `commission-run-${runId}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErr(extractErrorMessage(e)); }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("commissionRuns.title")}</Typography>
          <Typography color="text.secondary">{t("commissionRuns.subtitle")}</Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
          {t("commissionRuns.create")}
        </Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {/* Filter bar */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" placeholder="Τίτλος, εταιρία, συνεργάτης, σημείωση…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
          <TextField select size="small" label="Έτος" value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)} sx={{ minWidth: 120 }}>
            <MenuItem value="">Όλα</MenuItem>
            {years.map(y => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Μήνας" value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)} sx={{ minWidth: 120 }}>
            <MenuItem value="">Όλοι</MenuItem>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
              <MenuItem key={m} value={String(m)}>{m.toString().padStart(2, "0")}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Κατάσταση" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Όλες</MenuItem>
            <MenuItem value="Draft">Πρόχειρη</MenuItem>
            <MenuItem value="Finalised">Οριστική</MenuItem>
            <MenuItem value="Cancelled">Ακυρωμένη</MenuItem>
          </TextField>
          <TextField select size="small" label="Εταιρία" value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">Όλες</MenuItem>
            {(carriersQ.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Συνεργάτης" value={producerFilter}
            onChange={(e) => setProducerFilter(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">Όλοι</MenuItem>
            {(producersQ.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <Button size="small" onClick={() => {
            setSearch(""); setYearFilter(""); setMonthFilter(""); setStatusFilter("");
            setCarrierFilter(""); setProducerFilter("");
          }}>Καθαρισμός</Button>
        </Stack>
      </Card>

      {/* KPI strip (filter-aware) */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2}>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Εκκαθαρίσεις</Typography>
          <Typography variant="h5" fontWeight={800}>{filtered.length}</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Γραμμές</Typography>
          <Typography variant="h5" fontWeight={800}>{totalLines}</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Συνολικό μεικτό</Typography>
          <Typography variant="h5" fontWeight={800}>{totalPremium.toFixed(2)} €</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Συνολικές προμήθειες</Typography>
          <Typography variant="h5" fontWeight={800} color="primary.main">{totalCommission.toFixed(2)} €</Typography>
        </Card>
      </Stack>

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("commissionRuns.period")}</TableCell>
              <TableCell>{t("commissionRuns.titleCol")}</TableCell>
              <TableCell>{t("commissionRuns.filters")}</TableCell>
              <TableCell align="right">{t("commissionRuns.lines")}</TableCell>
              <TableCell align="right">{t("commissionRuns.totalPremium")}</TableCell>
              <TableCell align="right">{t("commissionRuns.totalCommission")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("commissionRuns.empty")}</TableCell></TableRow>
              )}
              {paged.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography fontWeight={700}>{r.year}-{r.month.toString().padStart(2, "0")}</Typography></TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                      {r.filterInsuranceCompanyName && <Chip size="small" label={r.filterInsuranceCompanyName} variant="outlined" />}
                      {r.filterProducerName && <Chip size="small" label={r.filterProducerName} variant="outlined" />}
                      {r.filterPolicyType && <Chip size="small" label={t(`policyType.${r.filterPolicyType}`)} variant="outlined" />}
                      {r.filterPackageCode && <Chip size="small" label={r.filterPackageCode} variant="outlined" />}
                      {!r.filterInsuranceCompanyName && !r.filterProducerName && !r.filterPolicyType && !r.filterPackageCode && (
                        <Typography variant="caption" color="text.secondary">{t("common.all")}</Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{r.lineCount}</TableCell>
                  <TableCell align="right">{r.totalPremium.toFixed(2)} €</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>{r.totalCommission.toFixed(2)} €</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[r.status]} label={t(`commissionRuns.status.${r.status}`)} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setDetailId(r.id)} title={t("commissionRuns.viewDetail")}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => downloadCsv(r.id)} title={t("commissionRuns.export")}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" disabled={r.status === "Finalised"}
                      onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
            <NumberedPager page={page} totalPages={totalPages} onPage={setPage} />
          </Box>
        </Card>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(id) => { void qc.invalidateQueries({ queryKey: ["commission-runs"] }); setCreateOpen(false); setDetailId(id); }} />
      <DetailDialog runId={detailId} onClose={() => setDetailId(null)}
        onChanged={() => void qc.invalidateQueries({ queryKey: ["commission-runs"] })} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const companies = useQuery({ queryKey: ["insurance-companies-lite"], enabled: open,
    queryFn: async () => (await api.get<CompanyLite[]>("/insurance-companies")).data });
  const producers = useQuery({ queryKey: ["producers-lite"], enabled: open,
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data });

  const now = new Date();
  const [form, setForm] = useState({
    year: now.getFullYear(), month: now.getMonth() + 1, title: "",
    insuranceCompanyId: "", producerId: "", policyType: "", packageCode: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) setForm({ year: now.getFullYear(), month: now.getMonth() + 1, title: "", insuranceCompanyId: "", producerId: "", policyType: "", packageCode: "", notes: "" }); /* eslint-disable-next-line */ }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post<{ id: string }>("/commission-runs", {
      year: Number(form.year), month: Number(form.month), title: form.title || null,
      insuranceCompanyId: form.insuranceCompanyId || null,
      producerId: form.producerId || null,
      policyType: form.policyType || null,
      packageCode: form.packageCode || null,
      notes: form.notes || null
    })).data,
    onSuccess: (data) => onCreated(data.id),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("commissionRuns.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("financials.year")} value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} fullWidth>
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
            <TextField select label={t("goals.month")} value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })} fullWidth>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <MenuItem key={m} value={m}>{m.toString().padStart(2, "0")}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label={t("commissionRuns.titleField")} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth helperText={t("commissionRuns.titleHelp")} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("commissionRuns.filterCompany")} value={form.insuranceCompanyId} onChange={e => setForm({ ...form, insuranceCompanyId: e.target.value })} fullWidth>
              <MenuItem value="">{t("common.all")}</MenuItem>
              {(companies.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label={t("commissionRuns.filterProducer")} value={form.producerId} onChange={e => setForm({ ...form, producerId: e.target.value })} fullWidth>
              <MenuItem value="">{t("common.all")}</MenuItem>
              {(producers.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("commissionRuns.filterBranch")} value={form.policyType} onChange={e => setForm({ ...form, policyType: e.target.value })} fullWidth>
              <MenuItem value="">{t("common.all")}</MenuItem>
              {TYPES.map(p => <MenuItem key={p} value={p}>{t(`policyType.${p}`)}</MenuItem>)}
            </TextField>
            <TextField label={t("commissionRuns.filterPackage")} value={form.packageCode} onChange={e => setForm({ ...form, packageCode: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("commissionRuns.generate")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailDialog({ runId, onClose, onChanged }: { runId: string | null; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<LineDto | null>(null);

  const detail = useQuery({
    queryKey: ["commission-run-detail", runId],
    enabled: !!runId,
    queryFn: async () => (await api.get<{ run: RunDto; lines: LineDto[] }>(`/commission-runs/${runId}`)).data
  });

  const finalise = useMutation({
    mutationFn: async () => api.post(`/commission-runs/${runId}/finalise`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["commission-run-detail", runId] }); onChanged(); },
    onError: e => setErr(extractErrorMessage(e))
  });

  if (!runId) return null;
  const r = detail.data?.run;
  const lines = detail.data?.lines ?? [];

  const byProducer = lines.reduce((acc, l) => {
    const key = l.producerName ?? t("commissionRuns.noProducer");
    acc[key] = (acc[key] ?? 0) + l.commissionAmount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={!!runId} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={800}>{r ? `${r.title} · ${r.year}-${r.month.toString().padStart(2, "0")}` : t("common.loading")}</Typography>
          {r && (
            <Stack direction="row" spacing={1}>
              <Button startIcon={<DownloadIcon />} size="small"
                onClick={async () => {
                  try {
                    const res = await api.get(`/commission-runs/${runId}/export.csv`, { responseType: "blob" });
                    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `commission-run-${runId}.csv`;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch (e) { setErr(extractErrorMessage(e)); }
                }}>
                {t("commissionRuns.export")}
              </Button>
              {r.status !== "Finalised" && (
                <Button startIcon={<CheckIcon />} variant="contained" color="success" size="small" onClick={() => { if (confirm(t("commissionRuns.finaliseConfirm"))) finalise.mutate(); }}>
                  {t("commissionRuns.finalise")}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {detail.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : r && (
          <>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
              <Card variant="outlined" sx={{ flex: 1, p: 2 }}>
                <Typography variant="overline" color="text.secondary">{t("commissionRuns.lines")}</Typography>
                <Typography variant="h5" fontWeight={800}>{r.lineCount}</Typography>
              </Card>
              <Card variant="outlined" sx={{ flex: 1, p: 2 }}>
                <Typography variant="overline" color="text.secondary">{t("commissionRuns.totalPremium")}</Typography>
                <Typography variant="h5" fontWeight={800}>{r.totalPremium.toFixed(2)} €</Typography>
              </Card>
              <Card variant="outlined" sx={{ flex: 1, p: 2 }}>
                <Typography variant="overline" color="text.secondary">{t("commissionRuns.totalCommission")}</Typography>
                <Typography variant="h5" fontWeight={800} color="primary.main">{r.totalCommission.toFixed(2)} €</Typography>
              </Card>
            </Stack>

            <Typography variant="overline" color="text.secondary">{t("commissionRuns.byProducer")}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mb={2} mt={0.5}>
              {Object.entries(byProducer).map(([name, amount]) =>
                <Chip key={name} label={`${name}: ${amount.toFixed(2)} €`} color="primary" variant="outlined" />
              )}
            </Stack>

            <Card variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>{t("commissionRuns.policy")}</TableCell>
                  <TableCell>{t("commissionRuns.producer")}</TableCell>
                  <TableCell>{t("commissionRuns.company")}</TableCell>
                  <TableCell>{t("commissionRuns.branch")}</TableCell>
                  <TableCell align="right">{t("commissionRuns.premium")}</TableCell>
                  <TableCell align="right">{t("commissionRuns.rate")}</TableCell>
                  <TableCell align="right">{t("commissionRuns.commission")}</TableCell>
                  <TableCell align="right" />
                </TableRow></TableHead>
                <TableBody>
                  {lines.map(l => (
                    <TableRow key={l.id} hover sx={l.isOverridden ? { bgcolor: "rgba(246,166,35,0.08)" } : undefined}>
                      <TableCell sx={{ fontFamily: "monospace" }}>{l.policyNumber}</TableCell>
                      <TableCell>{l.producerName ?? "—"}</TableCell>
                      <TableCell>{l.insuranceCompanyName}</TableCell>
                      <TableCell>{t(`policyType.${l.policyType}`)}</TableCell>
                      <TableCell align="right">{l.premium.toFixed(2)} €</TableCell>
                      <TableCell align="right">{l.ratePercent.toFixed(2)}%</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {l.commissionAmount.toFixed(2)} €
                        {l.isOverridden && <Chip label="OVR" size="small" color="warning" sx={{ ml: 0.5, height: 16, fontSize: 10 }} />}
                      </TableCell>
                      <TableCell align="right">
                        {r.status !== "Finalised" && (
                          <IconButton size="small" onClick={() => setEditing(l)} title={t("commissionRuns.override")}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>

      <OverrideDialog line={editing} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ["commission-run-detail", runId] }); onChanged(); }} />
    </Dialog>
  );
}

function OverrideDialog({ line, onClose, onSaved }: { line: LineDto | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (line) { setAmount(line.commissionAmount); setReason(line.overrideReason ?? ""); }
  }, [line]);

  const save = useMutation({
    mutationFn: async () => api.post(`/commission-runs/lines/${line!.id}/override`, { amount: Number(amount), reason: reason || null }),
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={!!line} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("commissionRuns.overrideTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {line && (
          <Stack spacing={2} mt={1}>
            <Typography variant="caption" color="text.secondary">
              {t("commissionRuns.policy")}: {line.policyNumber} · {line.producerName ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("commissionRuns.calculated")}: {line.commissionAmount.toFixed(2)} € ({line.ratePercent.toFixed(2)}%)
            </Typography>
            <TextField type="number" autoFocus required label={t("commissionRuns.newAmount")}
              value={amount} onChange={e => setAmount(Number(e.target.value))} fullWidth />
            <TextField label={t("commissionRuns.overrideReason")} value={reason} onChange={e => setReason(e.target.value)} fullWidth multiline rows={2} />
          </Stack>
        )}
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
