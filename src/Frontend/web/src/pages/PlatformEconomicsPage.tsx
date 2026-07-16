import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import GroupIcon from "@mui/icons-material/Group";
import BusinessIcon from "@mui/icons-material/Business";
import EuroIcon from "@mui/icons-material/Euro";
import PaidIcon from "@mui/icons-material/Paid";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money, date } from "../utils/format";

/**
 * Οικονομικά Πλατφόρμας — τι κερδίζει η Kalypsis.
 *
 * Focused on SaaS revenue metrics (MRR/ARR/ARPA), Kalypsis-earnings per
 * tenant, and a payment-status tracker so the operator can mark each
 * office «paid until DD/MM/YYYY» and see who's overdue at a glance.
 *
 * The payment tracker is persisted in localStorage as a first-pass — a
 * proper backend model (TenantPayment entity + endpoints) lands in a
 * follow-up. This lets the SuperAdmin start using it today without a
 * migration.
 */

interface Overview {
  totalTenants: number; activeTenants: number; trialTenants: number;
  pastDueTenants: number; cancelledTenants: number;
  newTenants30d: number; newTenants90d: number; cancelledTenants30d: number;
  mrr: number; arr: number; currency: string;
  averageRevenuePerTenant: number;
  totalUsers: number; activeUsers30d: number;
  totalCustomers: number; totalPolicies: number;
}

interface TenantRevenue {
  tenantId: string; tenantName: string; tenantCode: string;
  plan: string | null; subscriptionState: string;
  officeCount: number; billableOfficeCount: number;
  monthlyTotal: number; currency: string;
  hasContract: boolean; contractNumber: string | null;
  contractEffectiveFrom: string | null;
}

interface SeriesPoint { month: string; mrr: number; activeTenants: number; newTenants: number; }

interface TenantPayment { paidUntil: string | null; lastPaidOn: string | null; note: string | null; }
interface TenantPaymentApiDto { tenantId: string; paidUntil: string | null; lastPaidOn: string | null; note: string | null; }
type PaymentsMap = Record<string, TenantPayment>;

export function PlatformEconomicsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["platform-economics-overview"],
    queryFn: async () => (await api.get<Overview>("/platform/economics/overview")).data
  });
  const revenue = useQuery({
    queryKey: ["platform-economics-revenue"],
    queryFn: async () => (await api.get<TenantRevenue[]>("/platform/economics/revenue-by-tenant")).data
  });
  const series = useQuery({
    queryKey: ["platform-economics-series", 12],
    queryFn: async () => (await api.get<SeriesPoint[]>("/platform/economics/series?months=12")).data
  });
  const paymentsQ = useQuery({
    queryKey: ["platform-tenant-payments"],
    queryFn: async () => (await api.get<TenantPaymentApiDto[]>("/platform/tenant-payments")).data
  });

  const payments: PaymentsMap = useMemo(() => {
    const map: PaymentsMap = {};
    for (const p of paymentsQ.data ?? []) {
      map[p.tenantId] = { paidUntil: p.paidUntil, lastPaidOn: p.lastPaidOn, note: p.note };
    }
    return map;
  }, [paymentsQ.data]);

  const savePayment = useMutation({
    mutationFn: async ({ tenantId, next }: { tenantId: string; next: TenantPayment }) =>
      (await api.put<TenantPaymentApiDto>(`/platform/tenant-payments/${tenantId}`, next)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-tenant-payments"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });
  const clearPayment = useMutation({
    mutationFn: async (tenantId: string) => { await api.delete(`/platform/tenant-payments/${tenantId}`); },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-tenant-payments"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const [dialog, setDialog] = useState<{ tenantId: string; tenantName: string } | null>(null);

  if (overview.isLoading || !overview.data) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  const o = overview.data;
  const seriesData = series.data ?? [];
  const maxMrr = Math.max(1, ...seriesData.map(p => p.mrr));

  // Aggregate payment status across tenants for the top-strip KPIs.
  const paymentStats = useMemo(() => {
    const rows = revenue.data ?? [];
    const today = new Date();
    let paid = 0, overdue = 0, notMarked = 0, upcomingTotal = 0;
    for (const r of rows) {
      const p = payments[r.tenantId];
      if (!p || !p.paidUntil) { notMarked++; continue; }
      const until = new Date(p.paidUntil);
      if (until >= today) {
        paid++;
        upcomingTotal += r.monthlyTotal;
      } else {
        overdue++;
      }
    }
    return { paid, overdue, notMarked, upcomingTotal };
  }, [revenue.data, payments]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <TrendingUpIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("economics.title", "Οικονομικά Πλατφόρμας")}</Typography>
          <Typography color="text.secondary">
            Τι κερδίζει η Kalypsis — έσοδα ανά γραφείο, MRR/ARR και παρακολούθηση πληρωμών συνδρομής.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Top KPI row — Kalypsis earnings */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <KpiCard label="MRR (Kalypsis)"  value={money(o.mrr, o.currency)} icon={<EuroIcon />} highlight />
        <KpiCard label="ARR (Kalypsis)"  value={money(o.arr, o.currency)} icon={<EuroIcon />} />
        <KpiCard label="ARPU"            value={money(o.averageRevenuePerTenant, o.currency)} />
        <KpiCard label="Γραφεία"         value={o.totalTenants} icon={<BusinessIcon />} />
      </Box>

      {/* Payment tracker KPIs */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <KpiCard label="✅ Πληρωμένα"     value={paymentStats.paid}      small color="success.main" />
        <KpiCard label="⚠️ Ληξιπρόθεσμα" value={paymentStats.overdue}   small color="error.main" />
        <KpiCard label="Χωρίς σήμανση"    value={paymentStats.notMarked} small color="text.secondary" />
        <KpiCard label="Έσοδα από πληρωμένα" value={money(paymentStats.upcomingTotal, o.currency)} small color="success.main" />
      </Box>

      {/* Sub KPI row — SaaS lifecycle */}
      <Box sx={{
        display: "grid", gap: 2, mb: 4,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <KpiCard label="Ενεργά γραφεία" value={o.activeTenants}     small color="success.main" />
        <KpiCard label="Σε δοκιμή"       value={o.trialTenants}      small color="info.main" />
        <KpiCard label="Σε καθυστέρηση"  value={o.pastDueTenants}    small color="warning.main" />
        <KpiCard label="Έκλεισαν"        value={o.cancelledTenants}  small color="error.main" />
      </Box>

      {/* MRR chart */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>MRR ανά μήνα</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Συγκεντρωτική εικόνα μηνιαίων εσόδων της Kalypsis από όλα τα γραφεία.
          </Typography>

          {series.isLoading ? <CircularProgress size={24} /> : (
            <Box sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${seriesData.length}, 1fr)`,
              gap: 1,
              alignItems: "end",
              height: 200,
              borderBottom: "1px solid",
              borderColor: "divider",
              pb: 1
            }}>
              {seriesData.map(p => {
                const h = (p.mrr / maxMrr) * 100;
                return (
                  <Box key={p.month} sx={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                    <Box sx={{
                      width: "70%",
                      height: `${Math.max(4, h)}%`,
                      bgcolor: "primary.main",
                      borderTopLeftRadius: 4, borderTopRightRadius: 4,
                      opacity: p.mrr > 0 ? 1 : 0.2,
                      transition: "height 380ms ease"
                    }} title={money(p.mrr, o.currency)} />
                    <Typography variant="caption" sx={{ mt: 0.5, color: "text.secondary", fontSize: 11 }}>
                      {p.month.slice(5)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          <Stack direction="row" spacing={4} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            <LegendDot color="primary.main" label={`Έσοδα: max ${maxMrr.toFixed(0)} ${o.currency}`} />
            <Typography variant="caption" color="text.secondary">
              Τώρα ενεργά: {o.activeTenants + o.trialTenants} · Νέα τελευταίες 30 ημ.: {o.newTenants30d}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Per-tenant revenue + payment status */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap" gap={1}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Έσοδα & πληρωμές ανά γραφείο</Typography>
            <Chip size="small" label={`${revenue.data?.length ?? 0} γραμμές`} />
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Οι πληρωμές αποθηκεύονται στη βάση — πραγματική παρακολούθηση συνδρομών.
            </Typography>
          </Stack>
          {revenue.isLoading ? <CircularProgress size={24} /> : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Γραφείο</TableCell>
                    <TableCell>Πλάνο</TableCell>
                    <TableCell>Κατάσταση</TableCell>
                    <TableCell align="right">Υποκαταστήματα</TableCell>
                    <TableCell align="right">Χρεώσιμα</TableCell>
                    <TableCell>Συμβόλαιο</TableCell>
                    <TableCell align="right">Μηνιαία χρέωση</TableCell>
                    <TableCell>Πληρωμή</TableCell>
                    <TableCell align="right">Ενέργειες</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(revenue.data ?? []).map(r => {
                    const p = payments[r.tenantId];
                    return (
                      <TableRow key={r.tenantId} hover>
                        <TableCell>
                          <Box component={RouterLink} to={`/app/tenants/${r.tenantId}`}
                            sx={{ color: "text.primary", textDecoration: "none", fontWeight: 600,
                                  "&:hover": { color: "primary.main", textDecoration: "underline" } }}>
                            {r.tenantName}
                          </Box>
                          <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontFamily: "monospace" }}>
                            {r.tenantCode}
                          </Typography>
                        </TableCell>
                        <TableCell>{r.plan ?? "—"}</TableCell>
                        <TableCell><Chip size="small" label={r.subscriptionState} /></TableCell>
                        <TableCell align="right">{r.officeCount}</TableCell>
                        <TableCell align="right">{r.billableOfficeCount}</TableCell>
                        <TableCell>
                          {r.hasContract ? (
                            <Stack direction="column" spacing={0}>
                              <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.contractNumber}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {r.contractEffectiveFrom ? date(r.contractEffectiveFrom) : ""}
                              </Typography>
                            </Stack>
                          ) : <Chip size="small" label="Χωρίς συμβόλαιο" color="warning" variant="outlined" />}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: r.monthlyTotal > 0 ? "primary.main" : "text.disabled" }}>
                          {money(r.monthlyTotal, r.currency)}
                        </TableCell>
                        <TableCell><PaymentBadge payment={p} /></TableCell>
                        <TableCell align="right">
                          <Tooltip title="Επεξεργασία πληρωμής">
                            <Button size="small" variant="outlined" startIcon={<EditIcon fontSize="small" />}
                              onClick={() => setDialog({ tenantId: r.tenantId, tenantName: r.tenantName })}>
                              Πληρωμή
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Bottom stats — SaaS user metrics only */}
      <Box sx={{
        display: "grid", gap: 2, mt: 3,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(2, 1fr)" }
      }}>
        <KpiCard label="Σύνολο χρηστών" value={o.totalUsers} icon={<GroupIcon />} small />
        <KpiCard label="Ενεργοί χρήστες (30 ημ.)" value={o.activeUsers30d} small />
      </Box>

      <PaymentDialog
        open={!!dialog}
        tenantName={dialog?.tenantName ?? ""}
        current={dialog ? payments[dialog.tenantId] : undefined}
        busy={savePayment.isPending || clearPayment.isPending}
        onClose={() => setDialog(null)}
        onSave={(next) => {
          if (!dialog) return;
          savePayment.mutate({ tenantId: dialog.tenantId, next });
          setDialog(null);
        }}
        onClear={() => {
          if (!dialog) return;
          clearPayment.mutate(dialog.tenantId);
          setDialog(null);
        }}
      />
    </Box>
  );
}

function PaymentBadge({ payment }: { payment?: TenantPayment }) {
  if (!payment || !payment.paidUntil) {
    return <Chip size="small" variant="outlined" label="Χωρίς σήμανση" />;
  }
  const until = new Date(payment.paidUntil);
  const today = new Date();
  const overdue = until < today;
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <PaidIcon fontSize="small" color={overdue ? "error" : "success"} />
      <Chip size="small"
        color={overdue ? "error" : "success"}
        variant={overdue ? "filled" : "outlined"}
        label={overdue
          ? `Ληξιπρόθεσμο (${until.toLocaleDateString("el-GR")})`
          : `Έως ${until.toLocaleDateString("el-GR")}`} />
    </Stack>
  );
}

function PaymentDialog({ open, tenantName, current, busy, onClose, onSave, onClear }: {
  open: boolean;
  tenantName: string;
  current?: TenantPayment;
  busy?: boolean;
  onClose: () => void;
  onSave: (next: TenantPayment) => void;
  onClear: () => void;
}) {
  const [paidUntil, setPaidUntil] = useState("");
  const [lastPaidOn, setLastPaidOn] = useState("");
  const [note, setNote] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!open) return;
    setPaidUntil(current?.paidUntil ?? "");
    setLastPaidOn(current?.lastPaidOn ?? today);
    setNote(current?.note ?? "");
  }, [open, current, today]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Πληρωμή γραφείου — {tenantName}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Καταχώρησε μέχρι πότε είναι πληρωμένη η συνδρομή. Ληξιπρόθεσμα εμφανίζονται με κόκκινο.
        </Alert>
        <Stack spacing={2} mt={1}>
          <TextField label="Πληρωμένο έως" type="date" fullWidth
            InputLabelProps={{ shrink: true }}
            value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />
          <TextField label="Ημερομηνία τελευταίας πληρωμής" type="date" fullWidth
            InputLabelProps={{ shrink: true }}
            value={lastPaidOn} onChange={(e) => setLastPaidOn(e.target.value)} />
          <TextField label="Σημείωση (προαιρετικό)" fullWidth multiline minRows={2}
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="π.χ. Πληρωμή με τραπεζική κατάθεση 12/07" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClear} color="error" sx={{ mr: "auto" }} disabled={busy}>Αφαίρεση σήμανσης</Button>
        <Button onClick={onClose} disabled={busy}>Ακύρωση</Button>
        <Button variant="contained" disabled={busy} onClick={() => onSave({
          paidUntil: paidUntil || null,
          lastPaidOn: lastPaidOn || null,
          note: note.trim() || null
        })}>{busy ? <CircularProgress size={16} /> : "Αποθήκευση"}</Button>
      </DialogActions>
    </Dialog>
  );
}

function KpiCard({ label, value, icon, small, highlight, color }: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  small?: boolean;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <Card variant="outlined" sx={{ bgcolor: highlight ? "rgba(176,138,62,0.08)" : undefined }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "text.secondary", fontSize: 11, mb: 0.5, letterSpacing: "0.06em", fontWeight: 600 }}>
          {icon}
          <span>{label.toUpperCase()}</span>
        </Stack>
        <Typography sx={{
          fontFamily: "var(--display, serif)",
          fontWeight: 700,
          fontSize: small ? { xs: 22, md: 26 } : { xs: 26, md: 34 },
          color: color ?? (highlight ? "primary.main" : "text.primary"),
          lineHeight: 1
        }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}
