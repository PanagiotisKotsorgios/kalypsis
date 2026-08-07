import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type DesktopPayment = {
  id: string;
  amount: number;
  currency: string;
  paidAtUtc: string;
  accessStartsAtUtc: string;
  accessExpiresAtUtc: string;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
};

type DesktopLicense = {
  id: string;
  registrationCode: string;
  status: "PendingPayment" | "Active" | "Expiring" | "Expired" | "Blocked";
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  afmVat?: string | null;
  machineName?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  lastSeenAtUtc?: string | null;
  annualPrice: number;
  currency: string;
  accessStartsAtUtc?: string | null;
  accessExpiresAtUtc?: string | null;
  daysRemaining?: number | null;
  isBlocked: boolean;
  blockReason?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  payments: DesktopPayment[];
};

const statusMeta: Record<DesktopLicense["status"], { label: string; color: "default" | "success" | "warning" | "error" }> = {
  PendingPayment: { label: "Αναμονή πληρωμής", color: "warning" },
  Active: { label: "Ενεργή", color: "success" },
  Expiring: { label: "Λήγει σύντομα", color: "warning" },
  Expired: { label: "Ληγμένη", color: "error" },
  Blocked: { label: "Αποκλεισμένη", color: "error" }
};

export function PlatformDesktopLicensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [paymentFor, setPaymentFor] = useState<DesktopLicense | null>(null);
  const [detailsFor, setDetailsFor] = useState<DesktopLicense | null>(null);
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const licensesQuery = useQuery({
    queryKey: ["platform-desktop-licenses"],
    queryFn: async () => (await api.get<DesktopLicense[]>("/platform/desktop-licenses")).data
  });

  const toggleBlocked = useMutation({
    mutationFn: async (license: DesktopLicense) => (await api.patch<DesktopLicense>(`/platform/desktop-licenses/${license.id}`, {
      isBlocked: !license.isBlocked,
      blockReason: license.isBlocked ? null : "Χειροκίνητος αποκλεισμός από Platform Admin"
    })).data,
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["platform-desktop-licenses"] });
      setNotice({ severity: "success", text: updated.isBlocked ? "Η εγκατάσταση αποκλείστηκε άμεσα." : "Ο αποκλεισμός αφαιρέθηκε." });
    },
    onError: (error) => setNotice({ severity: "error", text: extractErrorMessage(error, "Η αλλαγή κατάστασης απέτυχε.") })
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return (licensesQuery.data ?? []).filter((license) =>
      (status === "All" || license.status === status)
      && (!term || [license.companyName, license.contactName, license.email, license.registrationCode]
        .some((value) => value.toLocaleLowerCase("el-GR").includes(term))));
  }, [licensesQuery.data, search, status]);

  const metrics = useMemo(() => {
    const rows = licensesQuery.data ?? [];
    return {
      total: rows.length,
      active: rows.filter((x) => x.status === "Active").length,
      pending: rows.filter((x) => x.status === "PendingPayment").length,
      attention: rows.filter((x) => ["Expiring", "Expired", "Blocked"].includes(x.status)).length
    };
  }, [licensesQuery.data]);

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2} mb={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <ComputerIcon color="primary" sx={{ fontSize: 38 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Άδειες Kalypsis Desktop</Typography>
            <Typography color="text.secondary">Ετήσιες ενεργοποιήσεις, πληρωμές και άμεσος έλεγχος πρόσβασης των εγκαταστάσεων.</Typography>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void licensesQuery.refetch()} sx={{ textTransform: "none" }}>
          Ανανέωση
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2.5 }}>
        Κάθε πληρωμή ενεργοποιεί την εγκατάσταση για 365 ημέρες από την ημερομηνία έναρξης. Το Desktop προειδοποιεί 20 ημέρες πριν τη λήξη και μετά τη λήξη δεν επιτρέπει είσοδο.
      </Alert>
      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 2.5 }}>{notice.text}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2.5}>
        <MetricCard label="Σύνολο εγκαταστάσεων" value={metrics.total} />
        <MetricCard label="Ενεργές" value={metrics.active} tone="success.main" />
        <MetricCard label="Αναμονή πληρωμής" value={metrics.pending} tone="warning.main" />
        <MetricCard label="Χρειάζονται ενέργεια" value={metrics.attention} tone="error.main" />
      </Stack>

      <Card variant="outlined">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField
            size="small"
            label="Αναζήτηση"
            placeholder="Εταιρεία, email ή κωδικός"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: { md: 330 } }}
          />
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel>Κατάσταση</InputLabel>
            <Select label="Κατάσταση" value={status} onChange={(event) => setStatus(event.target.value)}>
              <MenuItem value="All">Όλες</MenuItem>
              {Object.entries(statusMeta).map(([value, meta]) => <MenuItem key={value} value={value}>{meta.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>

        {licensesQuery.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
        ) : licensesQuery.isError ? (
          <Alert severity="error" sx={{ m: 2 }}>{extractErrorMessage(licensesQuery.error, "Δεν φορτώθηκαν οι άδειες Desktop.")}</Alert>
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 4, textAlign: "center" }}>Δεν βρέθηκαν εγκαταστάσεις.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 1180 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Εγκατάσταση</TableCell>
                  <TableCell>Πελάτης</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                  <TableCell>Πρόσβαση έως</TableCell>
                  <TableCell>Ετήσια χρέωση</TableCell>
                  <TableCell>Τελευταίος έλεγχος</TableCell>
                  <TableCell align="right">Ενέργειες</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((license) => {
                  const meta = statusMeta[license.status];
                  return (
                    <TableRow key={license.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 800, fontFamily: "monospace", fontSize: 13 }}>{license.registrationCode}</Typography>
                        <Typography variant="caption" color="text.secondary">{license.machineName ?? "Χωρίς όνομα συσκευής"} · v{license.appVersion ?? "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 750 }}>{license.companyName}</Typography>
                        <Typography variant="caption" color="text.secondary">{license.contactName} · {license.email}</Typography>
                      </TableCell>
                      <TableCell><Chip size="small" color={meta.color} label={meta.label} /></TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(license.accessExpiresAtUtc)}</Typography>
                        {license.daysRemaining != null && <Typography variant="caption" color="text.secondary">{license.daysRemaining} ημέρες</Typography>}
                      </TableCell>
                      <TableCell>{money(license.annualPrice, license.currency)}</TableCell>
                      <TableCell>{formatDateTime(license.lastSeenAtUtc)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => setDetailsFor(license)} sx={{ textTransform: "none" }}>Στοιχεία</Button>
                        <Button size="small" variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={() => setPaymentFor(license)} sx={{ ml: 1, textTransform: "none" }}>
                          Πληρωμή
                        </Button>
                        <Button
                          size="small"
                          color={license.isBlocked ? "success" : "error"}
                          startIcon={license.isBlocked ? <LockOpenOutlinedIcon /> : <LockOutlinedIcon />}
                          disabled={toggleBlocked.isPending}
                          onClick={() => toggleBlocked.mutate(license)}
                          sx={{ ml: 1, textTransform: "none" }}
                        >
                          {license.isBlocked ? "Άρση" : "Φραγή"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>

      <PaymentDialog
        license={paymentFor}
        onClose={() => setPaymentFor(null)}
        onSaved={async () => {
          setPaymentFor(null);
          await queryClient.invalidateQueries({ queryKey: ["platform-desktop-licenses"] });
          setNotice({ severity: "success", text: "Η πληρωμή καταχωρήθηκε και η πρόσβαση ενεργοποιήθηκε για 365 ημέρες." });
        }}
      />
      <DetailsDialog license={detailsFor} onClose={() => setDetailsFor(null)} />
    </Box>
  );
}

function MetricCard({ label, value, tone = "text.primary" }: { label: string; value: number; tone?: string }) {
  return (
    <Card variant="outlined" sx={{ p: 2, minWidth: 190, flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>{label}</Typography>
      <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 850, color: tone }}>{value.toLocaleString("el-GR")}</Typography>
    </Card>
  );
}

function PaymentDialog({ license, onClose, onSaved }: { license: DesktopLicense | null; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amount: "", currency: "EUR", paidAt: today, startsAt: today, paymentMethod: "Τραπεζική κατάθεση", reference: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const payment = useMutation({
    mutationFn: async () => api.post(`/platform/desktop-licenses/${license!.id}/payments`, {
      amount: Number(form.amount),
      currency: form.currency,
      paidAtUtc: `${form.paidAt}T12:00:00Z`,
      accessStartsAtUtc: `${form.startsAt}T00:00:00Z`,
      paymentMethod: form.paymentMethod || null,
      reference: form.reference || null,
      notes: form.notes || null
    }),
    onSuccess: onSaved,
    onError: (requestError) => setError(extractErrorMessage(requestError, "Η καταχώρηση πληρωμής απέτυχε."))
  });

  const opened = Boolean(license);
  const expiry = form.startsAt ? new Date(`${form.startsAt}T00:00:00Z`) : null;
  if (expiry) expiry.setUTCDate(expiry.getUTCDate() + 365);

  return (
    <Dialog open={opened} onClose={payment.isPending ? undefined : onClose} fullWidth maxWidth="sm" TransitionProps={{ onEnter: () => {
      setForm({ amount: license?.annualPrice ? String(license.annualPrice) : "", currency: license?.currency ?? "EUR", paidAt: today, startsAt: today, paymentMethod: "Τραπεζική κατάθεση", reference: "", notes: "" });
      setError(null);
    } }}>
      <DialogTitle sx={{ fontWeight: 850 }}>Καταχώρηση ετήσιας πληρωμής</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="info"><strong>{license?.companyName}</strong> · {license?.registrationCode}<br />Η πρόσβαση θα λήξει στις {expiry ? expiry.toLocaleDateString("el-GR") : "—"}.</Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Ποσό" type="number" value={form.amount} onChange={(event) => setForm((x) => ({ ...x, amount: event.target.value }))} fullWidth inputProps={{ min: 0.01, step: 0.01 }} />
            <TextField label="Νόμισμα" value={form.currency} onChange={(event) => setForm((x) => ({ ...x, currency: event.target.value.toUpperCase() }))} sx={{ width: { xs: "100%", sm: 140 } }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Ημερομηνία πληρωμής" type="date" value={form.paidAt} onChange={(event) => setForm((x) => ({ ...x, paidAt: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Έναρξη πρόσβασης" type="date" value={form.startsAt} onChange={(event) => setForm((x) => ({ ...x, startsAt: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          <TextField label="Τρόπος πληρωμής" value={form.paymentMethod} onChange={(event) => setForm((x) => ({ ...x, paymentMethod: event.target.value }))} />
          <TextField label="Αναφορά / παραστατικό" value={form.reference} onChange={(event) => setForm((x) => ({ ...x, reference: event.target.value }))} />
          <TextField label="Σημειώσεις" multiline minRows={2} value={form.notes} onChange={(event) => setForm((x) => ({ ...x, notes: event.target.value }))} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={payment.isPending}>Άκυρο</Button>
        <Button variant="contained" disabled={payment.isPending || Number(form.amount) <= 0 || !form.paidAt || !form.startsAt} onClick={() => payment.mutate()}>
          {payment.isPending ? <CircularProgress size={20} /> : "Καταχώρηση & ενεργοποίηση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailsDialog({ license, onClose }: { license: DesktopLicense | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(license)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 850 }}>Στοιχεία εγκατάστασης</DialogTitle>
      <DialogContent>
        {license && <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <Detail label="Κωδικός" value={license.registrationCode} />
            <Detail label="Εταιρεία" value={license.companyName} />
            <Detail label="Επικοινωνία" value={`${license.contactName} · ${license.email}`} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <Detail label="Συσκευή" value={license.machineName ?? "—"} />
            <Detail label="Έκδοση εφαρμογής" value={license.appVersion ?? "—"} />
            <Detail label="Τελευταίος έλεγχος" value={formatDateTime(license.lastSeenAtUtc)} />
          </Stack>
          <Divider />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Ιστορικό πληρωμών</Typography>
          {license.payments.length === 0 ? <Typography color="text.secondary">Δεν έχει καταχωρηθεί πληρωμή.</Typography> : (
            <Table size="small">
              <TableHead><TableRow><TableCell>Πληρωμή</TableCell><TableCell>Ποσό</TableCell><TableCell>Πρόσβαση</TableCell><TableCell>Αναφορά</TableCell></TableRow></TableHead>
              <TableBody>{license.payments.map((entry) => <TableRow key={entry.id}>
                <TableCell>{formatDate(entry.paidAtUtc)}<br /><Typography variant="caption" color="text.secondary">{entry.paymentMethod ?? "—"}</Typography></TableCell>
                <TableCell>{money(entry.amount, entry.currency)}</TableCell>
                <TableCell>{formatDate(entry.accessStartsAtUtc)} — {formatDate(entry.accessExpiresAtUtc)}</TableCell>
                <TableCell>{entry.reference ?? "—"}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          )}
        </Stack>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>{label}</Typography><Typography sx={{ mt: 0.25, fontWeight: 650 }}>{value}</Typography></Box>;
}

function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("el-GR") : "—"; }
function formatDateTime(value?: string | null) { return value ? new Date(value).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : "—"; }
function money(value: number, currency: string) { return new Intl.NumberFormat("el-GR", { style: "currency", currency: currency || "EUR" }).format(value); }

export default PlatformDesktopLicensesPage;
