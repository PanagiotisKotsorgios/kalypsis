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
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";

interface CustomerDto {
  id: string;
  customerNumber: string;
  type: string;
  status: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
}

interface ConsentRow {
  id: string;
  type: string;
  granted: boolean;
  grantedAt: string;
  revokedAt?: string | null;
  method: string;
  version?: string;
}

interface CommunicationRow {
  id: string;
  kind: string;
  direction: string;
  outcome: string;
  occurredAt: string;
  durationSeconds?: number | null;
  subject: string;
  body?: string | null;
  relatedPolicyNumber?: string | null;
}

interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

const CONSENT_TYPES = [
  "EmailMarketing",
  "SmsMarketing",
  "PhoneMarketing",
  "AutomatedDecisionMaking",
  "DataSharingPartners"
];

const COMMUNICATION_KINDS = ["Note", "Phone", "Email", "Meeting", "Sms", "WalkIn"];

export function CustomerDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [tab, setTab] = useState(0);

  const customerQ = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await api.get<CustomerDto>(`/customers/${id}`)).data,
    enabled: !!id
  });

  if (customerQ.isLoading) {
    return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  }
  if (customerQ.isError) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{extractErrorMessage(customerQ.error)}</Alert>
        <Button component={RouterLink} to="/app/customers" sx={{ mt: 2 }}>Πίσω στη λίστα</Button>
      </Box>
    );
  }
  const customer = customerQ.data!;

  const displayName = customer.type === "Company"
    ? customer.companyName ?? "—"
    : [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—";

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="overline" color="text.secondary">{customer.customerNumber}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{displayName}</Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Chip label={customer.status} size="small" color={statusColor(customer.status)} />
            <Chip label={customer.type === "Company" ? "Νομικό πρόσωπο" : "Φυσικό πρόσωπο"} size="small" />
            {customer.email && <Chip label={customer.email} size="small" variant="outlined" />}
            {customer.phone && <Chip label={customer.phone} size="small" variant="outlined" />}
          </Stack>
        </Box>
      </Stack>

      <CustomerSummaryCard customerId={id} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Επισκόπηση" />
        <Tab label="Συμβόλαια" />
        <Tab label="Ζημίες" />
        <Tab label="Επικοινωνία" />
        <Tab label="Ειδοποιήσεις" />
        <Tab label="Συγκαταθέσεις (GDPR)" />
        <Tab label="Επαφές" />
        <Tab label="GDPR ενέργειες" />
      </Tabs>

      {tab === 0 && <OverviewTab customer={customer} />}
      {tab === 1 && <CustomerPoliciesTab customerId={id} />}
      {tab === 2 && <CustomerClaimsTab customerId={id} />}
      {tab === 3 && <CommunicationsTab customerId={id} />}
      {tab === 4 && <CustomerNotificationsTab customerId={id} />}
      {tab === 5 && <ConsentsTab customerId={id} />}
      {tab === 6 && <ContactsTab customerId={id} customerType={customer.type} />}
      {tab === 7 && <GdprActionsTab customerId={id} />}
    </Box>
  );
}

function statusColor(s: string): "default" | "primary" | "warning" | "error" | "success" {
  switch (s) {
    case "Active": return "success";
    case "Prospect": return "primary";
    case "Inactive": return "default";
    case "Churned": return "warning";
    case "Blocked": return "error";
    default: return "default";
  }
}

/* ---------- Summary card ---------- */

interface CustomerSummary {
  activePolicyCount: number; totalPolicyCount: number;
  lifetimeGrossPremium: number; currentYearGrossPremium: number;
  lifetimeAgencyCommission: number;
  openClaimCount: number; totalClaimCount: number;
  notificationCount: number; communicationCount: number;
  tier: "Premium" | "Gold" | "Standard" | "Basic";
  tierReason: string;
}

const TIER_COLOR: Record<string, "default" | "primary" | "success" | "warning"> = {
  Premium: "warning", Gold: "primary", Standard: "success", Basic: "default"
};

function CustomerSummaryCard({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-summary", customerId],
    queryFn: async () => (await api.get<CustomerSummary>(`/customers/${customerId}/summary`)).data,
    enabled: !!customerId
  });
  const fmt = (n: number) => n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      {q.isLoading ? <CircularProgress size={22} /> : q.data ? (
        <Stack direction="row" spacing={3} flexWrap="wrap" alignItems="center">
          <Chip label={`Κατηγορία: ${q.data.tier}`}
            color={TIER_COLOR[q.data.tier] ?? "default"} sx={{ fontWeight: 800 }}
            title={q.data.tierReason} />
          <Box>
            <Typography variant="caption" color="text.secondary">Συμβόλαια</Typography>
            <Typography fontWeight={800}>{q.data.activePolicyCount} ενεργά / {q.data.totalPolicyCount} σύνολο</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Μεικτό φέτος</Typography>
            <Typography fontWeight={800}>{fmt(q.data.currentYearGrossPremium)} €</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Σύνολο μεικτό</Typography>
            <Typography fontWeight={800}>{fmt(q.data.lifetimeGrossPremium)} €</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Έσοδα γραφείου</Typography>
            <Typography fontWeight={800} color="primary.main">{fmt(q.data.lifetimeAgencyCommission)} €</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Ζημίες</Typography>
            <Typography fontWeight={800}>{q.data.openClaimCount} ανοιχτές / {q.data.totalClaimCount}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Ειδοποιήσεις · Επικοινωνίες</Typography>
            <Typography fontWeight={800}>{q.data.notificationCount} · {q.data.communicationCount}</Typography>
          </Box>
        </Stack>
      ) : <Typography color="text.secondary">—</Typography>}
    </Card>
  );
}

/* ---------- Policies tab ---------- */

function CustomerPoliciesTab({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-policies", customerId],
    queryFn: async () => (await api.get<{
      id: string; policyNumber: string; insuranceCompanyName: string; policyType: string;
      status: string; startDate: string; endDate: string; premium: number; currency: string;
    }[]>("/policies", { params: { customerId } })).data
  });
  if (q.isLoading) return <CircularProgress />;
  const rows = q.data ?? [];
  if (rows.length === 0) return <Alert severity="info">Δεν υπάρχουν συμβόλαια.</Alert>;
  return (
    <Card variant="outlined">
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Αρ.Συμβ.</TableCell>
          <TableCell>Εταιρία</TableCell>
          <TableCell>Κλάδος</TableCell>
          <TableCell>Έναρξη → Λήξη</TableCell>
          <TableCell align="right">Ασφάλιστρο</TableCell>
          <TableCell>Κατάσταση</TableCell>
          <TableCell />
        </TableRow></TableHead>
        <TableBody>
          {rows.map(p => (
            <TableRow key={p.id} hover>
              <TableCell sx={{ fontFamily: "monospace" }}>{p.policyNumber}</TableCell>
              <TableCell>{p.insuranceCompanyName}</TableCell>
              <TableCell>{p.policyType}</TableCell>
              <TableCell>{p.startDate} → {p.endDate}</TableCell>
              <TableCell align="right">{p.premium.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {p.currency}</TableCell>
              <TableCell><Chip size="small" label={p.status} /></TableCell>
              <TableCell>
                <Button size="small" component={RouterLink} to={`/app/policies?focus=${p.id}`}>Προβολή</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------- Claims tab ---------- */

function CustomerClaimsTab({ customerId: _customerId }: { customerId: string }) {
  // Claims are filtered by policy on the backend; fetch all and filter client-side
  // for the user's policies.
  const policiesQ = useQuery({
    queryKey: ["customer-policies-for-claims", _customerId],
    queryFn: async () => (await api.get<{ id: string }[]>("/policies", { params: { customerId: _customerId } })).data
  });
  const claimsQ = useQuery({
    queryKey: ["customer-claims", _customerId],
    queryFn: async () => (await api.get<any[]>("/claims")).data
  });
  if (policiesQ.isLoading || claimsQ.isLoading) return <CircularProgress />;
  const policyIds = new Set((policiesQ.data ?? []).map(p => p.id));
  const claims = (claimsQ.data ?? []).filter((c: any) => policyIds.has(c.policyId));
  if (claims.length === 0) return <Alert severity="success">Δεν υπάρχουν ζημίες.</Alert>;
  return (
    <Card variant="outlined">
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Αρ. Ζημίας</TableCell>
          <TableCell>Συμβόλαιο</TableCell>
          <TableCell>Συμβάν</TableCell>
          <TableCell>Κατάσταση</TableCell>
          <TableCell align="right">Διεκδικ.</TableCell>
          <TableCell align="right">Εγκρ.</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {claims.map((c: any) => (
            <TableRow key={c.id} hover>
              <TableCell>{c.claimNumber}</TableCell>
              <TableCell sx={{ fontFamily: "monospace" }}>{c.policyNumber}</TableCell>
              <TableCell>{c.incidentDate}</TableCell>
              <TableCell><Chip size="small" label={c.status} /></TableCell>
              <TableCell align="right">{c.claimedAmount?.toFixed?.(2) ?? "—"}</TableCell>
              <TableCell align="right">{c.approvedAmount?.toFixed?.(2) ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------- Notifications tab ---------- */

function CustomerNotificationsTab({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-notifications", customerId],
    queryFn: async () => {
      try { return (await api.get<any[]>(`/customers/${customerId}/notifications`)).data; }
      catch { return [] as any[]; }
    }
  });
  if (q.isLoading) return <CircularProgress />;
  const rows = q.data ?? [];
  if (!Array.isArray(rows) || rows.length === 0)
    return <Alert severity="info">Δεν έχουν αποσταλεί ειδοποιήσεις προς αυτόν τον πελάτη.</Alert>;
  return (
    <Card variant="outlined">
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Ημ/νία</TableCell>
          <TableCell>Τύπος</TableCell>
          <TableCell>Θέμα</TableCell>
          <TableCell>Κατάσταση</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((n: any) => (
            <TableRow key={n.id}>
              <TableCell>{n.createdAt}</TableCell>
              <TableCell>{n.kind ?? n.type ?? "—"}</TableCell>
              <TableCell>{n.title ?? n.subject ?? "—"}</TableCell>
              <TableCell>{n.isRead ? "Αναγνώστηκε" : "Μη αναγνωσμένη"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------- Overview ---------- */

function OverviewTab({ customer }: { customer: CustomerDto }) {
  return (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Στοιχεία πελάτη</Typography>
      <Stack spacing={1.5}>
        <Row label="Τύπος">{customer.type === "Company" ? "Νομικό πρόσωπο" : "Φυσικό πρόσωπο"}</Row>
        <Row label="Κατάσταση">{customer.status}</Row>
        <Row label="Email">{customer.email ?? "—"}</Row>
        <Row label="Τηλέφωνο">{customer.phone ?? "—"}</Row>
      </Stack>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2}>
      <Typography sx={{ width: 160, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{children}</Typography>
    </Stack>
  );
}

/* ---------- Communications ---------- */

function CommunicationsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["customer-communications", customerId],
    queryFn: async () => (await api.get<CommunicationRow[]>(`/customers/${customerId}/communications`)).data
  });

  const [form, setForm] = useState({
    kind: "Note",
    direction: "Internal",
    outcome: "None",
    subject: "",
    body: "",
    durationSeconds: ""
  });

  const create = useMutation({
    mutationFn: async () => api.post(`/customers/${customerId}/communications`, {
      kind: form.kind,
      direction: form.direction,
      outcome: form.outcome,
      subject: form.subject.trim(),
      body: form.body.trim(),
      occurredAt: new Date().toISOString(),
      durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : null
    }),
    onSuccess: () => {
      setOpen(false);
      setForm({ kind: "Note", direction: "Internal", outcome: "None", subject: "", body: "", durationSeconds: "" });
      void qc.invalidateQueries({ queryKey: ["customer-communications", customerId] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Ιστορικό επικοινωνίας</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>+ Νέα καταχώρηση</Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {q.isLoading ? <CircularProgress /> : q.data?.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
          Δεν υπάρχει καμία καταχωρημένη αλληλεπίδραση ακόμη.
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {q.data?.map((c) => (
            <Card key={c.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={c.kind} color="primary" variant="outlined" />
                  <Chip size="small" label={c.direction} variant="outlined" />
                  {c.outcome !== "None" && <Chip size="small" label={c.outcome} variant="outlined" />}
                </Stack>
                <Typography variant="caption" color="text.secondary">{formatDate(c.occurredAt)}</Typography>
              </Stack>
              <Typography sx={{ mt: 1, fontWeight: 700 }}>{c.subject}</Typography>
              {c.body && <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap", fontSize: 14 }}>{c.body}</Typography>}
              {c.relatedPolicyNumber && (
                <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
                  Συμβόλαιο: {c.relatedPolicyNumber}
                </Typography>
              )}
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Νέα καταχώρηση επικοινωνίας</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField select label="Τύπος" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {COMMUNICATION_KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
            </TextField>
            <TextField select label="Κατεύθυνση" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              {["Internal", "Inbound", "Outbound"].map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </TextField>
            <TextField required label="Θέμα" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <TextField multiline rows={4} label="Σώμα / σημειώσεις" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <TextField type="number" label="Διάρκεια (sec)" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Άκυρο</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={create.isPending || !form.subject.trim()}>
            Καταχώρηση
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ---------- Consents ---------- */

function ConsentsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["customer-consents", customerId],
    queryFn: async () => (await api.get<ConsentRow[]>(`/customers/${customerId}/consents`)).data
  });

  const grant = useMutation({
    mutationFn: async (type: string) => api.post(`/customers/${customerId}/consents`, {
      type, method: "OnlineForm", version: "v1"
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-consents", customerId] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const revoke = useMutation({
    mutationFn: async (type: string) => api.post(`/customers/${customerId}/consents/revoke`, { type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-consents", customerId] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const liveByType = useMemo(() => {
    const m: Record<string, ConsentRow | undefined> = {};
    for (const c of q.data ?? []) {
      if (!c.revokedAt && !m[c.type]) m[c.type] = c;
    }
    return m;
  }, [q.data]);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Συγκαταθέσεις επικοινωνίας</Typography>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      <Card variant="outlined">
        {CONSENT_TYPES.map((type, i) => {
          const active = !!liveByType[type];
          return (
            <Stack key={type} direction="row" alignItems="center" sx={{
              p: 2,
              borderTop: i === 0 ? 0 : 1,
              borderColor: "divider"
            }}>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={700}>{consentLabel(type)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {active
                    ? `Δόθηκε ${formatDate(liveByType[type]!.grantedAt)}`
                    : "Ανενεργό"}
                </Typography>
              </Box>
              <Switch
                checked={active}
                disabled={grant.isPending || revoke.isPending}
                onChange={(e) => (e.target.checked ? grant.mutate(type) : revoke.mutate(type))}
              />
            </Stack>
          );
        })}
      </Card>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center" }}>
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} /> Ιστορικό
        </Typography>
        {q.data?.length === 0 ? (
          <Typography color="text.secondary" variant="body2">—</Typography>
        ) : (
          <Card variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Τύπος</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                  <TableCell>Από</TableCell>
                  <TableCell>Ανακλήθηκε</TableCell>
                  <TableCell>Μέθοδος</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(q.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{consentLabel(c.type)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={c.revokedAt ? "Ανακλήθηκε" : "Ενεργό"}
                        color={c.revokedAt ? "default" : "success"}
                      />
                    </TableCell>
                    <TableCell>{formatDate(c.grantedAt)}</TableCell>
                    <TableCell>{c.revokedAt ? formatDate(c.revokedAt) : "—"}</TableCell>
                    <TableCell>{c.method}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </Box>
    </Box>
  );
}

function consentLabel(type: string): string {
  switch (type) {
    case "EmailMarketing": return "Email marketing";
    case "SmsMarketing": return "SMS marketing";
    case "PhoneMarketing": return "Τηλεμάρκετινγκ";
    case "AutomatedDecisionMaking": return "Αυτοματοποιημένη λήψη αποφάσεων";
    case "DataSharingPartners": return "Κοινοποίηση σε συνεργάτες";
    default: return type;
  }
}

/* ---------- Contacts (for company customers) ---------- */

function ContactsTab({ customerId, customerType }: { customerId: string; customerType: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactRow | null>(null);

  const q = useQuery({
    queryKey: ["customer-contacts", customerId],
    queryFn: async () => (await api.get<ContactRow[]>(`/customers/${customerId}/contacts`)).data
  });

  const empty = { firstName: "", lastName: "", role: "", email: "", phone: "", notes: "", isPrimary: false };
  const [form, setForm] = useState<typeof empty>(empty);

  const startCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (c: ContactRow) => {
    setEditing(c);
    setForm({
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: "",
      isPrimary: c.isPrimary
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        isPrimary: form.isPrimary
      };
      if (editing) return api.put(`/customers/${customerId}/contacts/${editing.id}`, payload);
      return api.post(`/customers/${customerId}/contacts`, payload);
    },
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["customer-contacts", customerId] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const del = useMutation({
    mutationFn: async (cid: string) => api.delete(`/customers/${customerId}/contacts/${cid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-contacts", customerId] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Επαφές
          {customerType !== "Company" && (
            <Typography component="span" color="text.secondary" sx={{ ml: 2, fontSize: 13 }}>
              (συνήθως για νομικά πρόσωπα)
            </Typography>
          )}
        </Typography>
        <Button variant="contained" onClick={startCreate}>+ Νέα επαφή</Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {q.isLoading ? <CircularProgress /> : q.data?.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
          Δεν έχουν προστεθεί επιπλέον επαφές.
        </Card>
      ) : (
        <Card variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Όνομα</TableCell>
                <TableCell>Ρόλος</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Τηλέφωνο</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    {c.firstName} {c.lastName}
                    {c.isPrimary && <Chip size="small" label="Κύρια" color="primary" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{c.role ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => startEdit(c)}>Επεξεργασία</Button>
                    <IconButton size="small" color="error" onClick={() => { if (confirm("Διαγραφή;")) del.mutate(c.id); }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Επεξεργασία επαφής" : "Νέα επαφή"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <TextField required label="Όνομα" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} fullWidth />
              <TextField required label="Επώνυμο" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Ρόλος" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              helperText="π.χ. Νόμιμος εκπρόσωπος, HR Manager, Λογιστής" />
            <Stack direction="row" spacing={2}>
              <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
              <TextField label="Τηλέφωνο" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Σημειώσεις" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline rows={2} />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
              <Typography>Κύρια επαφή</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Άκυρο</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.firstName || !form.lastName}>
            Αποθήκευση
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ---------- GDPR actions (export + anonymize) ---------- */

function GdprActionsTab({ customerId }: { customerId: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const exportNow = useMutation({
    mutationFn: async () => (await api.get(`/customers/${customerId}/export`)).data,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-${customerId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      setOk("Η εξαγωγή ολοκληρώθηκε.");
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const anonymize = useMutation({
    mutationFn: async () => api.post(`/customers/${customerId}/anonymize`),
    onSuccess: () => setOk("Ο πελάτης ανωνυμοποιήθηκε."),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>GDPR ενέργειες</Typography>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" onClose={() => setOk(null)} sx={{ mb: 2 }}>{ok}</Alert>}

      <Card variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography fontWeight={700}>Δικαίωμα πρόσβασης / φορητότητας</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Κατεβάστε όλα τα δεδομένα του πελάτη σε JSON.
        </Typography>
        <Button variant="contained" startIcon={<DownloadIcon />}
          onClick={() => exportNow.mutate()} disabled={exportNow.isPending}>
          Εξαγωγή σε JSON
        </Button>
      </Card>

      <Card variant="outlined" sx={{ p: 3, borderColor: "warning.light" }}>
        <Typography fontWeight={700} color="error">Δικαίωμα διαγραφής (anonymization)</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Τα προσωπικά πεδία αντικαθίστανται με placeholders και ο πελάτης σημαίνεται ως «Blocked».
          Δεν επιτρέπεται αν υπάρχουν ενεργά συμβόλαια.
        </Typography>
        <Button variant="outlined" color="error"
          onClick={() => { if (confirm("Είστε σίγουροι;")) anonymize.mutate(); }}
          disabled={anonymize.isPending}>
          Ανωνυμοποίηση
        </Button>
      </Card>
    </Box>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("el-GR", { dateStyle: "medium", timeStyle: "short" });
}
