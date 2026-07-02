import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, InputAdornment, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage, API_BASE_URL } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

type InvoiceStatus = "Draft" | "Issued" | "Sent" | "Paid" | "Overdue" | "Cancelled";

interface InvoiceSummary {
  id: string; invoiceNumber: string;
  tenantId: string; tenantName: string; tenantCode: string;
  periodYear: number; periodMonth: number;
  issuedAt: string; dueAt: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number; vatAmount: number; total: number;
  hasPdf: boolean; sentAt: string | null; paidAt: string | null;
}
interface InvoiceLine {
  id: string; package: string; description: string;
  monthlyPrice: number; quantity: number; lineTotal: number;
}
interface InvoiceDetail extends InvoiceSummary {
  vatRate: number; notes: string | null; lines: InvoiceLine[];
}
interface GenerateResult {
  created: number; skippedExisting: number; skippedUnpriced: number;
  invoices: InvoiceSummary[];
}

const STATUSES: InvoiceStatus[] = ["Draft", "Issued", "Sent", "Paid", "Overdue", "Cancelled"];

function statusColor(s: InvoiceStatus): "default" | "info" | "warning" | "success" | "error" {
  switch (s) {
    case "Draft":     return "default";
    case "Issued":    return "info";
    case "Sent":      return "info";
    case "Paid":      return "success";
    case "Overdue":   return "error";
    case "Cancelled": return "default";
  }
}

export function PlatformInvoicesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "">("");
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["invoices", year, month, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (year) params.set("year", String(year));
      if (month) params.set("month", String(month));
      if (status) params.set("status", status);
      const url = params.toString() ? `/platform/billing/invoices?${params}` : "/platform/billing/invoices";
      return (await api.get<InvoiceSummary[]>(url)).data;
    }
  });

  const fmt = useMemo(
    () => new Intl.NumberFormat(i18n.language || "el-GR", { style: "currency", currency: "EUR" }),
    [i18n.language]
  );
  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(i18n.language || "el-GR", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }),
    [i18n.language]
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
        <ReceiptLongIcon sx={{ fontSize: 36 }} color="primary" />
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("invoices.title")}</Typography>
          <Typography color="text.secondary">{t("invoices.subtitle")}</Typography>
        </Box>
        <Button component={RouterLink} to="/app/platform/billing" variant="outlined">
          {t("invoices.openBilling")}
        </Button>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setGenerateOpen(true)}>
          {t("invoices.generate")}
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <SearchableTextField size="small" label={t("invoices.filter.year")}
            value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
            {[0,1,2,3].map(off => {
              const y = now.getFullYear() - off;
              return <MenuItem key={y} value={y}>{y}</MenuItem>;
            })}
          </SearchableTextField>
          <SearchableTextField size="small" label={t("invoices.filter.month")}
            value={month} onChange={(e) => setMonth(e.target.value === "" ? "" : Number(e.target.value))}
            sx={{ minWidth: 140 }}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <MenuItem key={m} value={m}>{String(m).padStart(2,"0")}</MenuItem>
            ))}
          </SearchableTextField>
          <SearchableTextField size="small" label={t("common.status")}
            value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`invoices.status.${s}`)}</MenuItem>)}
          </SearchableTextField>
        </Stack>
      </Card>

      {list.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("invoices.col.number")}</TableCell>
                <TableCell>{t("invoices.col.tenant")}</TableCell>
                <TableCell>{t("invoices.col.period")}</TableCell>
                <TableCell>{t("invoices.col.due")}</TableCell>
                <TableCell align="right">{t("invoices.col.total")}</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(list.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  {t("invoices.empty")}
                </TableCell></TableRow>
              )}
              {(list.data ?? []).map(inv => (
                <TableRow key={inv.id} hover sx={{ cursor: "pointer" }} onClick={() => setDetailId(inv.id)}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{inv.invoiceNumber}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{inv.tenantName}</Typography>
                    <Typography fontSize={12} color="text.secondary" sx={{ fontFamily: "monospace" }}>{inv.tenantCode}</Typography>
                  </TableCell>
                  <TableCell>{String(inv.periodMonth).padStart(2,"0")}/{inv.periodYear}</TableCell>
                  <TableCell>{fmtDate.format(new Date(inv.dueAt))}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt.format(inv.total)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColor(inv.status)} label={t(`invoices.status.${inv.status}`)} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t("invoices.actions.view")}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDetailId(inv.id); }}>
                        <VisibilityOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("invoices.actions.downloadPdf")}>
                      <IconButton size="small" component="a"
                        href={`${API_BASE_URL}/platform/billing/invoices/${inv.id}/pdf`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <GenerateDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        defaultYear={now.getFullYear()}
        defaultMonth={now.getMonth() + 1}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ["invoices"] });
          setGenerateOpen(false);
        }}
      />

      <DetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void qc.invalidateQueries({ queryKey: ["invoices"] })}
      />
    </Box>
  );
}

function GenerateDialog({ open, onClose, defaultYear, defaultMonth, onDone }: {
  open: boolean; onClose: () => void;
  defaultYear: number; defaultMonth: number;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [vatRate, setVatRate] = useState(0.24);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: async () => (await api.post<GenerateResult>(
      "/platform/billing/invoices/generate",
      { year, month, vatRate }
    )).data,
    onSuccess: (data) => { setResult(data); onDone(); },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("invoices.generateDialog.title")}</DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {result ? (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            <Typography fontWeight={700} mb={0.5}>{t("invoices.generateDialog.done")}</Typography>
            <Typography fontSize={13.5}>{t("invoices.generateDialog.created", { count: result.created })}</Typography>
            <Typography fontSize={13.5}>{t("invoices.generateDialog.skippedExisting", { count: result.skippedExisting })}</Typography>
            <Typography fontSize={13.5}>{t("invoices.generateDialog.skippedUnpriced", { count: result.skippedUnpriced })}</Typography>
          </Alert>
        ) : (
          <Stack spacing={2} mt={1}>
            <Typography color="text.secondary" fontSize={14}>
              {t("invoices.generateDialog.lead")}
            </Typography>
            <Stack direction="row" spacing={2}>
              <SearchableTextField label={t("invoices.filter.year")} value={year} onChange={(e) => setYear(Number(e.target.value))} fullWidth>
                {[0,1,2,3].map(off => {
                  const y = new Date().getFullYear() - off;
                  return <MenuItem key={y} value={y}>{y}</MenuItem>;
                })}
              </SearchableTextField>
              <SearchableTextField label={t("invoices.filter.month")} value={month} onChange={(e) => setMonth(Number(e.target.value))} fullWidth>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <MenuItem key={m} value={m}>{String(m).padStart(2,"0")}</MenuItem>
                ))}
              </SearchableTextField>
            </Stack>
            <TextField
              label={t("invoices.generateDialog.vatRate")}
              value={Math.round(vatRate * 100)}
              onChange={(e) => setVatRate(Number(e.target.value) / 100)}
              type="number" InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              helperText={t("invoices.generateDialog.vatRateHelp")}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{result ? t("common.close") : t("common.cancel")}</Button>
        {!result && (
          <Button variant="contained" onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? <CircularProgress size={18} /> : t("invoices.generate")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function DetailDialog({ id, onClose, onChanged }: {
  id: string | null; onClose: () => void; onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const open = !!id;
  const [overrideEmail, setOverrideEmail] = useState("");
  const [emailResult, setEmailResult] = useState<{ success: boolean; sentTo: string; error: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["invoices", "detail", id],
    queryFn: async () => (await api.get<InvoiceDetail>(`/platform/billing/invoices/${id}`)).data,
    enabled: open
  });

  const send = useMutation({
    mutationFn: async () => (await api.post(`/platform/billing/invoices/${id}/email`,
      { overrideEmail: overrideEmail.trim() || null })).data as { success: boolean; sentTo: string; errorMessage: string | null },
    onSuccess: (d) => {
      setEmailResult({ success: d.success, sentTo: d.sentTo, error: d.errorMessage });
      onChanged();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const setStatus = useMutation({
    mutationFn: async (next: InvoiceStatus) => (await api.patch(`/platform/billing/invoices/${id}/status`,
      { status: next })).data,
    onSuccess: () => onChanged(),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const fmt = useMemo(
    () => new Intl.NumberFormat(i18n.language || "el-GR", { style: "currency", currency: "EUR" }),
    [i18n.language]
  );

  return (
    <Dialog open={open} onClose={() => { setEmailResult(null); onClose(); }} fullWidth maxWidth="md">
      <DialogTitle>
        {detail.data ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Box>
              <Typography fontSize={20} fontWeight={800} sx={{ fontFamily: "monospace" }}>{detail.data.invoiceNumber}</Typography>
              <Typography fontSize={13} color="text.secondary">
                {detail.data.tenantName} · {String(detail.data.periodMonth).padStart(2,"0")}/{detail.data.periodYear}
              </Typography>
            </Box>
            <Chip size="small" color={statusColor(detail.data.status)} label={t(`invoices.status.${detail.data.status}`)} />
          </Stack>
        ) : t("invoices.detail.title")}
      </DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {detail.isLoading || !detail.data ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={3}>
            <Card variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("invoices.lineCol.description")}</TableCell>
                    <TableCell align="right">{t("invoices.lineCol.qty")}</TableCell>
                    <TableCell align="right">{t("invoices.lineCol.unit")}</TableCell>
                    <TableCell align="right">{t("invoices.lineCol.total")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.data.lines.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.description}</TableCell>
                      <TableCell align="right">{l.quantity}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace" }}>{fmt.format(l.monthlyPrice)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace" }}>{fmt.format(l.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Stack direction="row" justifyContent="flex-end" spacing={4} sx={{ fontFamily: "monospace" }}>
              <Stack spacing={0.5}>
                <Typography color="text.secondary">{t("invoices.detail.subtotal")}</Typography>
                <Typography color="text.secondary">{t("invoices.detail.vat", { rate: Math.round(detail.data.vatRate * 100) })}</Typography>
                <Typography fontWeight={800}>{t("invoices.detail.total")}</Typography>
              </Stack>
              <Stack spacing={0.5} sx={{ minWidth: 120, textAlign: "right" }}>
                <Typography>{fmt.format(detail.data.subtotal)}</Typography>
                <Typography>{fmt.format(detail.data.vatAmount)}</Typography>
                <Typography fontWeight={800}>{fmt.format(detail.data.total)}</Typography>
              </Stack>
            </Stack>

            <Divider />

            <Box>
              <Typography fontSize={14} fontWeight={700} mb={1.5}>{t("invoices.detail.send")}</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <TextField
                  size="small" fullWidth
                  label={t("invoices.detail.overrideEmail")}
                  value={overrideEmail}
                  onChange={(e) => setOverrideEmail(e.target.value)}
                  placeholder={t("invoices.detail.overrideEmailPlaceholder")}
                />
                <Button startIcon={<SendIcon />} variant="contained" disabled={send.isPending}
                  onClick={() => { setEmailResult(null); send.mutate(); }}>
                  {send.isPending ? <CircularProgress size={18} /> : t("invoices.detail.sendEmail")}
                </Button>
              </Stack>
              {emailResult && (
                <Alert severity={emailResult.success ? "success" : "warning"} sx={{ mt: 2 }}>
                  {emailResult.success
                    ? t("invoices.detail.emailSent", { to: emailResult.sentTo })
                    : t("invoices.detail.emailFailed", { error: emailResult.error ?? "" })}
                </Alert>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography fontSize={14} fontWeight={700} mb={1.5}>{t("invoices.detail.statusActions")}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {STATUSES.map(s => (
                  <Button key={s} size="small"
                    variant={detail.data!.status === s ? "contained" : "outlined"}
                    color={statusColor(s) === "default" ? "inherit" : (statusColor(s) as any)}
                    onClick={() => setStatus.mutate(s)}
                    disabled={setStatus.isPending}>
                    {t(`invoices.status.${s}`)}
                  </Button>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {detail.data && (
          <Button color="error" startIcon={<DeleteOutlineIcon />}
            onClick={async () => {
              if (!confirm(t("invoices.detail.confirmDelete"))) return;
              try {
                await api.delete(`/platform/billing/invoices/${id}`);
                onChanged(); onClose();
              } catch (e) { setErr(extractErrorMessage(e)); }
            }}>
            {t("common.delete")}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {detail.data && (
          <Button startIcon={<DownloadIcon />} component="a"
            href={`${API_BASE_URL}/platform/billing/invoices/${detail.data.id}/pdf`}
            target="_blank" rel="noopener noreferrer">
            {t("invoices.actions.downloadPdf")}
          </Button>
        )}
        <Button onClick={() => { setEmailResult(null); onClose(); }}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
