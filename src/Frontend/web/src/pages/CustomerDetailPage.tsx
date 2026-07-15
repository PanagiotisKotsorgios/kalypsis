import { useEffect, useMemo, useState } from "react";
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
  FormControlLabel,
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
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroom";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import GroupsIcon from "@mui/icons-material/Groups";
import { CustomerProducersDialog } from "../components/CustomerProducersDialog";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

interface CustomerNeed {
  id: string; kind: string; title: string; hasAsset: boolean; isInsured: boolean;
  priority: number; nextContactAt: string | null; notes: string | null;
}
interface FamilyPolicy {
  id: string; policyNumber: string; policyType: string; status: string;
  startDate: string; endDate: string; premium: number; currency: string;
}
interface FamilyMember {
  relationshipId: string; customerId: string; displayName: string; customerType: string;
  relationshipType: string; notes: string | null; policies: FamilyPolicy[]; needs: CustomerNeed[];
}
interface FamilyProfile {
  profile: {
    id: string; customerNumber: string; type: string; displayName: string;
    maritalStatus: string | null; occupation: string | null; employer: string | null;
    mobilePhone: string | null; email: string | null; phone: string | null; notes: string | null;
    // ALIS-parity KYC fields (all nullable)
    fatherName: string | null;
    motherName: string | null;
    spouseName: string | null;
    nationality: string | null;
    zone: string | null;
    activityCode: string | null;
  };
  needs: CustomerNeed[];
  family: FamilyMember[];
  opportunities: { customerId: string; customerName: string; relationship: string | null; needKind: string; needTitle: string; reason: string; priority: number; }[];
}

// Ομαδοποιημένα consent types για το UI του CustomerDetailPage. Οι δύο
// ομάδες εμφανίζονται σε ξεχωριστά sections ώστε ο operator να μη μπερδεύει
// τα Άρθρα 13/9 GDPR (compliance-critical) με τα marketing opt-ins.
const CONSENT_TYPES_LEGAL = [
  "PrivacyNotice",             // Άρθρο 13 GDPR
  "HealthDataProcessing",      // Άρθρο 9 GDPR
  "IddDemandsAndNeeds",        // Ν.4583/2018 Άρθρο 27
  "AmlKycDeclaration",         // Ν.4557/2018
];
const CONSENT_TYPES_MARKETING = [
  "EmailMarketing",
  "SmsMarketing",
  "ViberMarketing",
  "PhoneMarketing",
  "AutomatedDecisionMaking",
  "DataSharingPartners"
];

const COMMUNICATION_KINDS = ["Note", "Phone", "Email", "Meeting", "Sms", "WalkIn"];

export function CustomerDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [tab, setTab] = useState(0);
  const [showProducers, setShowProducers] = useState(false);

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
        <Button
          startIcon={<GroupsIcon />}
          variant="outlined"
          onClick={() => setShowProducers(true)}
        >
          Συνεργάτες πελάτη
        </Button>
      </Stack>

      <CustomerProducersDialog
        open={showProducers}
        onClose={() => setShowProducers(false)}
        customerId={id}
        customerDisplay={displayName}
      />

      <CustomerSummaryCard customerId={id} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Επισκόπηση" />
        <Tab label="Συμβόλαια" />
        <Tab label="Ζημίες" />
        <Tab label="Εμπλεκόμενοι" />
        <Tab label="Επικοινωνία" />
        <Tab label="Ειδοποιήσεις" />
        <Tab label="Συγκαταθέσεις (GDPR)" />
        <Tab label="Επαφές" />
        <Tab label="GDPR ενέργειες" />
        <Tab icon={<FamilyRestroomIcon fontSize="small" />} iconPosition="start" label="Οικογένεια & ανάγκες" />
        <Tab label="Προτεινόμενα" />
      </Tabs>

      {tab === 0 && <OverviewTab customer={customer} />}
      {tab === 1 && <CustomerPoliciesTab customerId={id} />}
      {tab === 2 && <CustomerClaimsTab customerId={id} />}
      {tab === 3 && <ClaimInvolvedPartiesTab customerId={id} />}
      {tab === 4 && <CommunicationsTab customerId={id} />}
      {tab === 5 && <CustomerNotificationsTab customerId={id} />}
      {tab === 6 && <ConsentsTab customerId={id} />}
      {tab === 7 && <ContactsTab customerId={id} customerType={customer.type} />}
      {tab === 8 && <GdprActionsTab customerId={id} />}
      {tab === 9 && <FamilyNeedsTab customerId={id} />}
      {tab === 10 && <InsuranceOpportunitiesTab customerId={id} />}
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
    <Stack spacing={3}>
      <RenewalTimeline policies={rows} />
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
    </Stack>
  );
}

interface TimelinePolicy {
  id: string; policyNumber: string; insuranceCompanyName: string; policyType: string;
  status: string; startDate: string; endDate: string; premium: number; currency: string;
}

/**
 * Renewal timeline — a visual «what's coming up» strip for this customer's
 * active policies, sorted by end date. Colour-codes each row by how many
 * days remain: red < 30, orange < 90, green otherwise. Filters out
 * Cancelled / Expired / Draft so the strip only shows things that need
 * attention.
 */
function RenewalTimeline({ policies }: { policies: TimelinePolicy[] }) {
  const now = new Date();
  const upcoming = policies
    .filter(p => p.status === "Active" || p.status === "PendingRenewal")
    .map(p => {
      const end = new Date(p.endDate);
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { p, days, end };
    })
    .sort((a, b) => a.end.getTime() - b.end.getTime());
  if (upcoming.length === 0) return null;
  const colorFor = (days: number) =>
    days < 30 ? "error" : days < 90 ? "warning" : "success";
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography variant="overline" color="text.secondary" fontWeight={700}>
        Χρονογραμμή ανανεώσεων
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {upcoming.map(({ p, days }) => {
          const label = days < 0
            ? `Έληξε πριν ${Math.abs(days)} μέρες`
            : days === 0 ? "Λήγει σήμερα"
            : `Σε ${days} μέρες`;
          return (
            <Stack key={p.id} direction="row" alignItems="center" spacing={1.5}
              sx={{ p: 1, borderLeft: 4, borderColor: `${colorFor(days)}.main`, bgcolor: "background.default", borderRadius: 1 }}>
              <Chip size="small" color={colorFor(days)} label={label} sx={{ fontWeight: 700, minWidth: 130 }} />
              <Typography sx={{ fontFamily: "monospace" }}>{p.policyNumber}</Typography>
              <Typography color="text.secondary" sx={{ flex: 1 }}>
                {p.insuranceCompanyName} · {p.policyType}
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>Λήξη: {p.endDate}</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {p.premium.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {p.currency}
              </Typography>
              <Button size="small" component={RouterLink} to={`/app/policies?focus=${p.id}`}>Άνοιγμα</Button>
            </Stack>
          );
        })}
      </Stack>
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
  const { t } = useTranslation();
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
            <SearchableTextField label="Τύπος" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {COMMUNICATION_KINDS.map((k) => <MenuItem key={k} value={k}>{String(t(`communicationKind.${k}`, k))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label="Κατεύθυνση" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              {["Internal", "Inbound", "Outbound"].map((d) => <MenuItem key={d} value={d}>{String(t(`communicationDirection.${d}`, d))}</MenuItem>)}
            </SearchableTextField>
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
    mutationFn: async (type: string) => {
      // Νομικές συγκαταθέσεις: υπογράφονται σε τυπωμένο έντυπο. Marketing:
      // στην πράξη δίνονται είτε τηλεφωνικά είτε online — «OnlineForm» είναι
      // λογικό default. Ο operator μπορεί να το αλλάξει από το UI αν χρειαστεί.
      const isLegal = CONSENT_TYPES_LEGAL.includes(type);
      return api.post(`/customers/${customerId}/consents`, {
        type,
        method: isLegal ? "PaperForm" : "OnlineForm",
        version: "v1.0"
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-consents", customerId] });
      qc.invalidateQueries({ queryKey: ["compliance-dashboard"] });
    },
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

  const renderRow = (type: string, i: number) => {
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
  };

  return (
    <Box>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      <Typography variant="h6" sx={{ mb: 1.5 }}>Νομικές Συγκαταθέσεις</Typography>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Υποχρεωτικές βάσει GDPR / IDD / AML. Πάρτε το έντυπο από τη σελίδα «Νομικά
        Έντυπα Πελατών», δώστε το στον πελάτη, και μόλις υπογραφεί ενεργοποιήστε
        το αντίστοιχο switch εδώ.
      </Typography>
      <Card variant="outlined" sx={{ mb: 3 }}>
        {CONSENT_TYPES_LEGAL.map((type, i) => renderRow(type, i))}
      </Card>

      <Typography variant="h6" sx={{ mb: 1.5 }}>Συγκαταθέσεις Επικοινωνίας</Typography>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Marketing opt-ins ανά κανάλι. Ο πελάτης μπορεί να ανακαλέσει ανά πάσα στιγμή.
      </Typography>
      <Card variant="outlined">
        {CONSENT_TYPES_MARKETING.map((type, i) => renderRow(type, i))}
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
    case "PrivacyNotice": return "Ενημέρωση Υποκειμένου (Άρθρο 13 GDPR)";
    case "HealthDataProcessing": return "Επεξεργασία δεδομένων υγείας (Άρθρο 9 GDPR)";
    case "IddDemandsAndNeeds": return "Ανάλυση Αναγκών Πελάτη (IDD)";
    case "AmlKycDeclaration": return "Δήλωση Πραγματικού Δικαιούχου (AML/KYC)";
    case "EmailMarketing": return "Email marketing";
    case "SmsMarketing": return "SMS marketing";
    case "ViberMarketing": return "Viber marketing";
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

/* ---------- Family, assets and insurance opportunities ---------- */

const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"];
const RELATIONSHIP_TYPES = ["Spouse", "Partner", "Child", "Parent", "Grandparent", "Grandchild", "Sibling", "Dependent", "Other"];
const NEED_LABEL: Record<string, string> = {
  Home: "Κατοικία", Vehicle: "Όχημα", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση",
  Travel: "Ταξίδι", Pet: "Κατοικίδιο", Liability: "Αστική ευθύνη", Cyber: "Cyber", Other: "Άλλο"
};
const RELATION_LABEL: Record<string, string> = {
  Spouse: "Σύζυγος", Partner: "Σύντροφος", Child: "Παιδί", Parent: "Γονέας", Grandparent: "Παππούς / γιαγιά",
  Grandchild: "Εγγόνι", Sibling: "Αδελφός / αδελφή", Dependent: "Εξαρτώμενο μέλος", Other: "Άλλη σχέση"
};

function FamilyNeedsTab({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-family", customerId],
    queryFn: async () => (await api.get<FamilyProfile>(`/customers/${customerId}/family`)).data
  });
  if (q.isLoading) return <CircularProgress />;
  if (q.isError || !q.data) return <Alert severity="error">{q.isError ? extractErrorMessage(q.error) : "Δεν φορτώθηκε η οικογενειακή καρτέλα."}</Alert>;

  return (
    <Stack spacing={2.5}>
      <CustomerProfileCard customerId={customerId} profile={q.data.profile} />
      <DriverLicenseCard customerId={customerId} />
      <CustomerNeedsCard customerId={customerId} needs={q.data.needs} />
      <FamilyMembersCard customerId={customerId} members={q.data.family} />
      <ConsentsCard customerId={customerId} />
      <CommunicationsCard customerId={customerId} />
      <OpportunitiesCard opportunities={q.data.opportunities} />
    </Stack>
  );
}

function ConsentsCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["consents", customerId],
    queryFn: async () => (await api.get<any[]>(`/customers/${customerId}/consents`)).data
  });
  const [form, setForm] = useState({ kind: "Marketing", channel: "Email", source: "ManualAgency" });
  const grant = useMutation({
    mutationFn: async () => (await api.post(`/customers/${customerId}/consents`, form)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["consents", customerId] })
  });
  const revoke = useMutation({
    mutationFn: async (kind: string) => api.post(`/customers/${customerId}/consents/revoke`, { kind }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["consents", customerId] })
  });
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Stack mb={2}>
        <Typography variant="h6">Συγκαταθέσεις (GDPR)</Typography>
        <Typography variant="body2" color="text.secondary">
          Καταγραφή ρητής συγκατάθεσης για επικοινωνία / προώθηση / άλλους σκοπούς.
        </Typography>
      </Stack>
      {q.isLoading ? <CircularProgress size={20} /> : (q.data ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">Δεν έχουν καταγραφεί συγκαταθέσεις.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {(q.data ?? []).map((c: any) => (
            <Stack key={c.id} direction="row" alignItems="center" spacing={1.5}
              sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={700}>{c.kind} · {c.channel}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Από {c.source} · {c.grantedAt ? `δοθείσα ${c.grantedAt}` : "—"}
                  {c.revokedAt && ` · ανακλήθηκε ${c.revokedAt}`}
                </Typography>
              </Box>
              {!c.revokedAt && (
                <Button size="small" color="error" onClick={() => revoke.mutate(c.kind)}>Ανάκληση</Button>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">Νέα συγκατάθεση</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={1}>
          <SearchableTextField size="small" label="Είδος" value={form.kind}
            onChange={e => setForm({ ...form, kind: e.target.value })} sx={{ minWidth: 160 }}>
            {["Marketing", "Communication", "DataSharing", "Other"].map(k => <MenuItem key={k} value={k}>{String(t(`consentKind.${k}`, k))}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" label="Κανάλι" value={form.channel}
            onChange={e => setForm({ ...form, channel: e.target.value })} sx={{ minWidth: 140 }}>
            {["Email", "Sms", "Phone", "Postal", "All"].map(c => <MenuItem key={c} value={c}>{String(t(`consentChannel.${c}`, c))}</MenuItem>)}
          </SearchableTextField>
          <Button variant="contained" onClick={() => grant.mutate()} disabled={grant.isPending}>
            {grant.isPending ? <CircularProgress size={18} /> : "Καταγραφή συγκατάθεσης"}
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}

function CommunicationsCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["communications", customerId],
    queryFn: async () => (await api.get<any[]>(`/customers/${customerId}/communications`)).data
  });
  const [form, setForm] = useState({ kind: "Call", subject: "", summary: "" });
  const log = useMutation({
    mutationFn: async () => (await api.post(`/customers/${customerId}/communications`, form)).data,
    onSuccess: () => {
      setForm({ kind: "Call", subject: "", summary: "" });
      void qc.invalidateQueries({ queryKey: ["communications", customerId] });
    }
  });
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Stack mb={2}>
        <Typography variant="h6">Επικοινωνίες</Typography>
        <Typography variant="body2" color="text.secondary">
          Ιστορικό κλήσεων / email / SMS / επιστολών με τον πελάτη.
        </Typography>
      </Stack>
      {q.isLoading ? <CircularProgress size={20} /> : (q.data ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">Δεν έχουν καταγραφεί επικοινωνίες.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {(q.data ?? []).slice(0, 20).map((c: any) => (
            <Box key={c.id} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                <Typography fontWeight={700}>{c.kind} · {c.subject ?? "—"}</Typography>
                <Typography variant="caption" color="text.secondary">{c.occurredAt ?? c.createdAt}</Typography>
              </Stack>
              {c.summary && <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>{c.summary}</Typography>}
            </Box>
          ))}
        </Stack>
      )}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">Καταγραφή επικοινωνίας</Typography>
        <Stack spacing={1} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <SearchableTextField size="small" label="Είδος" value={form.kind}
              onChange={e => setForm({ ...form, kind: e.target.value })} sx={{ minWidth: 140 }}>
              {["Call", "Email", "Sms", "Postal", "Meeting", "Note"].map(k => <MenuItem key={k} value={k}>{String(t(`communicationKind.${k}`, k))}</MenuItem>)}
            </SearchableTextField>
            <TextField size="small" label="Θέμα" value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })} sx={{ flex: 1 }} />
          </Stack>
          <TextField size="small" label="Σύνοψη" value={form.summary} multiline rows={2}
            onChange={e => setForm({ ...form, summary: e.target.value })} fullWidth />
          <Box>
            <Button variant="contained" size="small" onClick={() => log.mutate()}
              disabled={log.isPending || !form.subject.trim()}>
              {log.isPending ? <CircularProgress size={18} /> : "Καταγραφή"}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Card>
  );
}

function DriverLicenseCard({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["driver-license", customerId],
    queryFn: async () => (await api.get<{ number: string | null; class: string | null;
      issueDate: string | null; expiryDate: string | null }>(`/customers/${customerId}/driver-license`)).data
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ number: "", class: "", issueDate: "", expiryDate: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setForm({
      number: q.data.number ?? "", class: q.data.class ?? "",
      issueDate: q.data.issueDate ?? "", expiryDate: q.data.expiryDate ?? ""
    });
  }, [q.data]);
  const save = useMutation({
    mutationFn: async () => api.put(`/customers/${customerId}/driver-license`, {
      number: form.number || null, class: form.class || null,
      issueDate: form.issueDate || null, expiryDate: form.expiryDate || null
    }),
    onSuccess: () => { setEditing(false); setErr(null); void qc.invalidateQueries({ queryKey: ["driver-license", customerId] }); },
    onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box><Typography variant="h6">Δίπλωμα οδήγησης</Typography>
          <Typography variant="body2" color="text.secondary">
            Χρησιμοποιείται στις ασφαλίσεις αυτοκινήτου και στη λίστα επιτρεπτών οδηγών.
          </Typography></Box>
        <Button startIcon={<EditIcon />} onClick={() => setEditing(!editing)}>{editing ? "Ακύρωση" : "Επεξεργασία"}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {editing ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField label="Αριθμός" value={form.number}
            onChange={e => setForm({ ...form, number: e.target.value })} sx={{ flex: 1, minWidth: 200 }} />
          <SearchableTextField label="Κατηγορία" value={form.class}
            onChange={e => setForm({ ...form, class: e.target.value })} sx={{ width: 160 }}>
            <MenuItem value="">—</MenuItem>
            {["ΑΜ", "Α1", "Α2", "Α", "Β", "ΒΕ", "Γ", "ΓΕ", "Δ", "ΔΕ"].map(k =>
              <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </SearchableTextField>
          <TextField type="date" label="Έκδοση" InputLabelProps={{ shrink: true }}
            value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} sx={{ width: 180 }} />
          <TextField type="date" label="Λήξη" InputLabelProps={{ shrink: true }}
            value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} sx={{ width: 180 }} />
          <Box sx={{ width: "100%" }}>
            <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Αποθήκευση</Button>
          </Box>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" } }}>
          <ProfileValue label="Αριθμός" value={q.data?.number ?? null} />
          <ProfileValue label="Κατηγορία" value={q.data?.class ?? null} />
          <ProfileValue label="Έκδοση" value={q.data?.issueDate ?? null} />
          <ProfileValue label="Λήξη" value={q.data?.expiryDate ?? null} />
        </Box>
      )}
    </Card>
  );
}

function CustomerProfileCard({ customerId, profile }: { customerId: string; profile: FamilyProfile["profile"] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    maritalStatus: "", occupation: "", employer: "", mobilePhone: "", notes: "",
    fatherName: "", motherName: "", spouseName: "",
    nationality: "", zone: "", activityCode: ""
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setForm({
    maritalStatus: profile.maritalStatus ?? "", occupation: profile.occupation ?? "", employer: profile.employer ?? "",
    mobilePhone: profile.mobilePhone ?? "", notes: profile.notes ?? "",
    fatherName: profile.fatherName ?? "", motherName: profile.motherName ?? "", spouseName: profile.spouseName ?? "",
    nationality: profile.nationality ?? "", zone: profile.zone ?? "", activityCode: profile.activityCode ?? ""
  }), [profile]);
  const save = useMutation({
    mutationFn: async () => api.put(`/customers/${customerId}/family/profile`, form),
    onSuccess: () => { setEditing(false); setErr(null); void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }); },
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box><Typography variant="h6">Προφίλ και οικογενειακή κατάσταση</Typography>
          <Typography variant="body2" color="text.secondary">Τα στοιχεία αυτά χρησιμοποιούνται στα φίλτρα πελατών, στα ασφαλιστικά έντυπα και στις προτάσεις κάλυψης.</Typography></Box>
        <Button startIcon={<EditIcon />} onClick={() => setEditing(!editing)}>{editing ? "Ακύρωση" : "Επεξεργασία"}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {editing ? (
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <SearchableTextField label="Οικογενειακή κατάσταση" value={form.maritalStatus} onChange={e => setForm({ ...form, maritalStatus: e.target.value })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {["Single", "Married", "Divorced", "Widowed", "Other"].map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </SearchableTextField>
            <TextField label="Επάγγελμα / κλάδος" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} fullWidth />
            <TextField label="Εργοδότης / επιχείρηση" value={form.employer} onChange={e => setForm({ ...form, employer: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="Πατρώνυμο" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} fullWidth
              helperText="Απαιτείται για MyDATA και ασφαλιστικά έντυπα." />
            <TextField label="Μητρώνυμο" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} fullWidth />
            <TextField label="Όνομα συζύγου" value={form.spouseName} onChange={e => setForm({ ...form, spouseName: e.target.value })} fullWidth
              helperText="Ελεύθερο κείμενο. Για δομημένη σχέση χρησιμοποιήστε την ενότητα Οικογένεια." />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="Εθνικότητα" value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} fullWidth
              placeholder="π.χ. Ελληνική" />
            <TextField label="Ζώνη" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} fullWidth
              helperText="Γεωγραφική ή εμπορική ζώνη για πολιτικές τιμολόγησης." />
            <TextField label="Κωδικός δραστηριότητας" value={form.activityCode} onChange={e => setForm({ ...form, activityCode: e.target.value })} fullWidth
              placeholder="π.χ. ΚΑΔ" />
          </Stack>
          <TextField label="Κινητό" value={form.mobilePhone} onChange={e => setForm({ ...form, mobilePhone: e.target.value })} fullWidth />
          <TextField label="Σημειώσεις πελάτη" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={3} fullWidth />
          <Stack direction="row" justifyContent="flex-end"><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Αποθήκευση</Button></Stack>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" } }}>
          <ProfileValue label="Οικογενειακή κατάσταση" value={profile.maritalStatus} />
          <ProfileValue label="Επάγγελμα / κλάδος" value={profile.occupation} />
          <ProfileValue label="Εργοδότης / επιχείρηση" value={profile.employer} />
          <ProfileValue label="Κινητό" value={profile.mobilePhone ?? profile.phone} />
          <ProfileValue label="Πατρώνυμο" value={profile.fatherName} />
          <ProfileValue label="Μητρώνυμο" value={profile.motherName} />
          <ProfileValue label="Όνομα συζύγου" value={profile.spouseName} />
          <ProfileValue label="Εθνικότητα" value={profile.nationality} />
          <ProfileValue label="Ζώνη" value={profile.zone} />
          <ProfileValue label="Κωδ. δραστηριότητας" value={profile.activityCode} />
          {profile.notes && <Box sx={{ gridColumn: "1/-1" }}><ProfileValue label="Σημειώσεις" value={profile.notes} /></Box>}
        </Box>
      )}
    </Card>
  );
}

function ProfileValue({ label, value }: { label: string; value?: string | null }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={700}>{value || "—"}</Typography></Box>;
}

function CustomerNeedsCard({ customerId, needs }: { customerId: string; needs: CustomerNeed[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerNeed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const empty = { kind: "Home", title: "", hasAsset: true, isInsured: false, priority: 3, nextContactAt: "", notes: "" };
  const [form, setForm] = useState(empty);
  const openCreate = (kind?: string) => { setEditing(null); setForm({ ...empty, kind: kind ?? "Home", title: kind === "Home" ? "Κύρια κατοικία" : kind === "Vehicle" ? "Όχημα" : "" }); setOpen(true); };
  const openEdit = (need: CustomerNeed) => { setEditing(need); setForm({ kind: need.kind, title: need.title, hasAsset: need.hasAsset, isInsured: need.isInsured, priority: need.priority, nextContactAt: need.nextContactAt ?? "", notes: need.notes ?? "" }); setOpen(true); };
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, nextContactAt: form.nextContactAt || null };
      return editing ? api.put(`/customers/${customerId}/family/needs/${editing.id}`, body) : api.post(`/customers/${customerId}/family/needs`, body);
    },
    onSuccess: () => { setOpen(false); setErr(null); void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }); },
    onError: e => setErr(extractErrorMessage(e))
  });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/customers/${customerId}/family/needs/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }), onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
        <Box><Typography variant="h6">Περιουσία και ανάγκες ασφάλισης</Typography><Typography variant="body2" color="text.secondary">Καταχωρήστε όχημα, σπίτι, υγεία ή οποιαδήποτε ανάγκη. Η κατάσταση «χωρίς κάλυψη» τροφοδοτεί τις προτάσεις.</Typography></Box>
        <Button variant="contained" onClick={() => openCreate()}>+ Νέα ανάγκη</Button>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        <Button size="small" startIcon={<HomeWorkIcon />} onClick={() => openCreate("Home")}>Έχει σπίτι</Button>
        <Button size="small" startIcon={<DirectionsCarIcon />} onClick={() => openCreate("Vehicle")}>Έχει όχημα</Button>
        <Button size="small" startIcon={<HealthAndSafetyIcon />} onClick={() => openCreate("Health")}>Υγεία</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {needs.length === 0 ? <Alert severity="info">Δεν έχουν καταχωρηθεί ακόμη περιουσία ή ανάγκες.</Alert> : (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {needs.map(need => <Card key={need.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" gap={1}><Box><Chip label={NEED_LABEL[need.kind] ?? need.kind} size="small" color={need.isInsured ? "success" : "warning"} />
              <Typography fontWeight={800} mt={0.5}>{need.title}</Typography>
              <Typography variant="caption" color="text.secondary">{need.isInsured ? "Με ενεργή κάλυψη" : "Χωρίς ενεργή κάλυψη"} · Προτεραιότητα {need.priority}/5</Typography>
              {need.notes && <Typography variant="body2" mt={0.5}>{need.notes}</Typography>}</Box>
              <Stack spacing={0.25}><Button size="small" onClick={() => openEdit(need)}>Επεξεργασία</Button><Button size="small" color="error" onClick={() => { if (confirm("Διαγραφή ανάγκης;")) del.mutate(need.id); }}>Διαγραφή</Button></Stack>
            </Stack>
          </Card>)}
        </Box>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Επεξεργασία ανάγκης" : "Νέα ανάγκη / περιουσία"}</DialogTitle><DialogContent><Stack spacing={2} mt={1}>
        <SearchableTextField label="Τύπος" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} fullWidth>{NEED_KINDS.map(kind => <MenuItem key={kind} value={kind}>{NEED_LABEL[kind]}</MenuItem>)}</SearchableTextField>
        <TextField label="Περιγραφή" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth required placeholder="π.χ. Toyota Yaris, εξοχικό, ιδιωτική υγεία" />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><FormControlLabel control={<Switch checked={form.hasAsset} onChange={e => setForm({ ...form, hasAsset: e.target.checked })} />} label="Έχει την περιουσία / ανάγκη" />
          <FormControlLabel control={<Switch checked={form.isInsured} onChange={e => setForm({ ...form, isInsured: e.target.checked })} />} label="Είναι ήδη ασφαλισμένο" /></Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><SearchableTextField label="Προτεραιότητα" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} fullWidth>{[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}</SearchableTextField>
          <TextField type="date" label="Επόμενη επικοινωνία" InputLabelProps={{ shrink: true }} value={form.nextContactAt} onChange={e => setForm({ ...form, nextContactAt: e.target.value })} fullWidth /></Stack>
        <TextField label="Σημειώσεις" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={3} fullWidth />
      </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Άκυρο</Button><Button variant="contained" disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>Αποθήκευση</Button></DialogActions></Dialog>
    </Card>
  );
}

function FamilyMembersCard({ customerId, members }: { customerId: string; members: FamilyMember[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ relatedCustomerId: "", relationshipType: "Spouse", notes: "" });
  const customersQ = useQuery({ queryKey: ["customers", "family-candidates"], queryFn: async () => (await api.get<{ id: string; customerNumber: string; type: string; firstName?: string; lastName?: string; companyName?: string }[]>("/customers")).data, enabled: open });
  const save = useMutation({ mutationFn: async () => api.post(`/customers/${customerId}/family/relationships`, form),
    onSuccess: () => { setOpen(false); setForm({ relatedCustomerId: "", relationshipType: "Spouse", notes: "" }); void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }); }, onError: e => setErr(extractErrorMessage(e)) });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/customers/${customerId}/family/relationships/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }), onError: e => setErr(extractErrorMessage(e)) });
  const candidates = (customersQ.data ?? []).filter(c => c.id !== customerId && !members.some(member => member.customerId === c.id));
  const display = (candidate: typeof candidates[number]) => candidate.type === "Company" ? candidate.companyName ?? candidate.customerNumber : `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim();

  return <Card variant="outlined" sx={{ p: 2.5 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}><Box><Typography variant="h6">Οικογένεια και συνδεδεμένοι πελάτες</Typography><Typography variant="body2" color="text.secondary">Κάθε μέλος βλέπει τα δικά του συμβόλαια, ανάγκες και τις εκκρεμείς ευκαιρίες κάλυψης.</Typography></Box><Button variant="contained" onClick={() => setOpen(true)}>+ Σύνδεση μέλους</Button></Stack>
    {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
    {members.length === 0 ? <Alert severity="info">Δεν έχουν συνδεθεί ακόμη σύζυγος, παιδιά ή άλλα μέλη.</Alert> : <Stack spacing={1}>{members.map(member => <Card key={member.relationshipId} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={800}>{member.displayName}</Typography><Chip size="small" label={RELATION_LABEL[member.relationshipType] ?? member.relationshipType} /></Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={1}>{member.policies.length ? member.policies.map(policy => <Chip key={policy.id} size="small" color="success" variant="outlined" label={`${policy.policyType} · ${policy.policyNumber}`} />) : <Typography variant="caption" color="text.secondary">Δεν έχει συμβόλαια.</Typography>}</Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>{member.needs.map(need => <Chip key={need.id} size="small" color={need.isInsured ? "success" : "warning"} label={`${NEED_LABEL[need.kind] ?? need.kind}: ${need.title}`} />)}</Stack>
      {member.notes && <Typography variant="body2" color="text.secondary" mt={0.75}>{member.notes}</Typography>}</Box><Button size="small" color="error" onClick={() => { if (confirm("Αφαίρεση οικογενειακής σχέσης;")) del.mutate(member.relationshipId); }}>Αφαίρεση</Button></Stack></Card>)}</Stack>}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Σύνδεση οικογενειακού μέλους</DialogTitle><DialogContent><Stack spacing={2} mt={1}>
      <SearchableSelect
        label="Υπάρχων πελάτης"
        required
        value={form.relatedCustomerId}
        onChange={(v) => setForm({ ...form, relatedCustomerId: v })}
        options={candidates.map(candidate => ({
          value: candidate.id,
          label: display(candidate),
          hint: candidate.customerNumber,
        }))}
      />
      <SearchableTextField label="Σχέση" value={form.relationshipType} onChange={e => setForm({ ...form, relationshipType: e.target.value })} fullWidth>{RELATIONSHIP_TYPES.map(type => <MenuItem key={type} value={type}>{RELATION_LABEL[type]}</MenuItem>)}</SearchableTextField>
      <TextField label="Σημειώσεις σχέσης" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={3} fullWidth />
      <Alert severity="info">Αν το μέλος δεν υπάρχει ακόμη ως πελάτης, δημιουργήστε πρώτα την καρτέλα του και μετά συνδέστε το εδώ.</Alert>
    </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Άκυρο</Button><Button variant="contained" disabled={!form.relatedCustomerId || save.isPending} onClick={() => save.mutate()}>Σύνδεση</Button></DialogActions></Dialog>
  </Card>;
}

function OpportunitiesCard({ opportunities }: { opportunities: FamilyProfile["opportunities"] }) {
  return <Card variant="outlined" sx={{ p: 2.5, borderColor: opportunities.length ? "warning.light" : "divider" }}>
    <Typography variant="h6" mb={0.5}>Προτεινόμενες καλύψεις</Typography><Typography variant="body2" color="text.secondary" mb={2}>Παράγονται από την καταχωρημένη περιουσία/ανάγκη όταν δεν υπάρχει ενεργό συμβόλαιο του αντίστοιχου κλάδου.</Typography>
    {opportunities.length === 0 ? <Alert severity="success">Δεν υπάρχουν ανοικτές προτάσεις με βάση τα σημερινά στοιχεία.</Alert> : <Stack spacing={1}>{opportunities.map((opportunity, index) => <Alert key={`${opportunity.customerId}-${opportunity.needKind}-${index}`} severity="warning"><strong>{opportunity.customerName}</strong>{opportunity.relationship ? ` (${RELATION_LABEL[opportunity.relationship] ?? opportunity.relationship})` : ""}: {NEED_LABEL[opportunity.needKind] ?? opportunity.needKind} — {opportunity.needTitle}. {opportunity.reason}</Alert>)}</Stack>}
  </Card>;
}

function InsuranceOpportunitiesTab({ customerId }: { customerId: string }) {
  const q = useQuery({ queryKey: ["customer-family", customerId], queryFn: async () => (await api.get<FamilyProfile>(`/customers/${customerId}/family`)).data });
  if (q.isLoading) return <CircularProgress />;
  if (q.isError || !q.data) return <Alert severity="error">{q.isError ? extractErrorMessage(q.error) : "Δεν φορτώθηκαν προτάσεις."}</Alert>;
  return <OpportunitiesCard opportunities={q.data.opportunities} />;
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

/* ============================================================================
   Ζημιάδες Εμπλεκόμενοι — ALIS parity item #29. One row per person / entity
   involved in a claim beyond the policyholder. Aggregated across every claim
   tied to this customer's policies, grouped by claim, edit + delete inline,
   add via a claim picker.
   ============================================================================ */
interface ClaimInvolvedParty {
  id: string;
  claimId: string;
  claimNumber: string;
  claimIncidentDate: string | null;
  policyId: string;
  policyNumber: string;
  role: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  vehiclePlate: string | null;
  insuranceCompany: string | null;
  policyNumberOther: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClaimLite {
  id: string;
  claimNumber: string;
  incidentDate: string;
  policyNumber: string;
}

const INVOLVED_ROLES = [
  "Driver", "Passenger", "Pedestrian", "Cyclist", "Witness",
  "OwnerOfOther", "Garage", "Attorney", "Expert", "Other"
];
const INVOLVED_ROLE_LABEL: Record<string, string> = {
  Driver: "Οδηγός", Passenger: "Επιβάτης", Pedestrian: "Πεζός",
  Cyclist: "Ποδηλάτης", Witness: "Μάρτυρας",
  OwnerOfOther: "Ιδιοκτήτης άλλου οχήματος",
  Garage: "Συνεργείο", Attorney: "Δικηγόρος",
  Expert: "Πραγματογνώμονας", Other: "Άλλο"
};

function ClaimInvolvedPartiesTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClaimInvolvedParty | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["customer-involved-parties", customerId],
    queryFn: async () =>
      (await api.get<ClaimInvolvedParty[]>(`/customers/${customerId}/claim-involved-parties`)).data
  });

  // Customer's claims — needed for the "which claim?" picker in the add dialog.
  const claimsQ = useQuery({
    queryKey: ["customer-claims-lite", customerId],
    enabled: creating,
    queryFn: async () => {
      const rows = (await api.get<any[]>("/claims")).data;
      // Filter to this customer's claims via their policies.
      const policies = (await api.get<any[]>("/policies", { params: { customerId } })).data;
      const policyIds = new Set(policies.map((p: any) => p.id));
      return rows
        .filter((c: any) => policyIds.has(c.policyId))
        .map((c: any): ClaimLite => ({
          id: c.id, claimNumber: c.claimNumber,
          incidentDate: c.incidentDate,
          policyNumber: c.policyNumber ?? ""
        }));
    }
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/claim-involved-parties/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-involved-parties", customerId] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const grouped = useMemo(() => {
    const rows = q.data ?? [];
    const byClaim = new Map<string, { claimNumber: string; incidentDate: string | null; policyNumber: string; rows: ClaimInvolvedParty[] }>();
    for (const r of rows) {
      let bucket = byClaim.get(r.claimId);
      if (!bucket) {
        bucket = { claimNumber: r.claimNumber, incidentDate: r.claimIncidentDate, policyNumber: r.policyNumber, rows: [] };
        byClaim.set(r.claimId, bucket);
      }
      bucket.rows.push(r);
    }
    return Array.from(byClaim.entries());
  }, [q.data]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6">Ζημιάδες Εμπλεκόμενοι</Typography>
          <Typography variant="body2" color="text.secondary">
            Άλλοι οδηγοί, επιβάτες, μάρτυρες, συνεργεία και όσοι εμπλέκονται σε ζημιές του πελάτη.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          Νέος εμπλεκόμενος
        </Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : grouped.length === 0 ? (
        <Card variant="outlined">
          <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <Typography>Δεν έχουν καταχωρηθεί εμπλεκόμενοι σε καμία ζημιά του πελάτη.</Typography>
          </Box>
        </Card>
      ) : (
        <Stack spacing={2}>
          {grouped.map(([claimId, group]) => (
            <Card key={claimId} variant="outlined">
              <Box sx={{ p: 2, bgcolor: "rgba(11,37,69,0.03)", borderBottom: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                  <Chip size="small" label={group.claimNumber} sx={{ fontFamily: "monospace", fontWeight: 700 }} />
                  <Typography variant="body2" color="text.secondary">
                    Ημ. συμβάντος: {group.incidentDate ?? "—"} · Συμβόλαιο: <b>{group.policyNumber || "—"}</b>
                  </Typography>
                </Stack>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ρόλος</TableCell>
                    <TableCell>Ονοματεπώνυμο</TableCell>
                    <TableCell>Στοιχεία επικοινωνίας</TableCell>
                    <TableCell>Ασφαλιστική / Συμβόλαιο</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.rows.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell><Chip size="small" label={INVOLVED_ROLE_LABEL[r.role] ?? r.role} /></TableCell>
                      <TableCell>
                        <Typography fontWeight={700}>{r.fullName}</Typography>
                        {(r.vatNumber || r.vehiclePlate) && (
                          <Typography variant="caption" color="text.secondary">
                            {r.vatNumber && <>ΑΦΜ: {r.vatNumber}</>}
                            {r.vatNumber && r.vehiclePlate && " · "}
                            {r.vehiclePlate && <>Πινακίδα: {r.vehiclePlate}</>}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.phone && <div>{r.phone}</div>}
                        {r.email && <div><a href={`mailto:${r.email}`}>{r.email}</a></div>}
                        {!r.phone && !r.email && "—"}
                      </TableCell>
                      <TableCell>
                        {r.insuranceCompany || r.policyNumberOther
                          ? <>
                              {r.insuranceCompany}
                              {r.policyNumberOther && <Typography variant="caption" color="text.secondary" display="block">
                                Αρ. συμβολαίου: {r.policyNumberOther}
                              </Typography>}
                            </>
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => {
                          if (confirm("Διαγραφή εμπλεκόμενου;")) del.mutate(r.id);
                        }}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </Stack>
      )}

      <InvolvedPartyDialog
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        editing={editing}
        claims={claimsQ.data ?? []}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void qc.invalidateQueries({ queryKey: ["customer-involved-parties", customerId] });
        }}
      />
    </Box>
  );
}

function InvolvedPartyDialog({ open, onClose, editing, claims, onSaved }: {
  open: boolean;
  onClose: () => void;
  editing: ClaimInvolvedParty | null;
  claims: ClaimLite[];
  onSaved: () => void;
}) {
  const [claimId, setClaimId] = useState("");
  const [form, setForm] = useState({
    role: "Driver",
    fullName: "",
    phone: "",
    email: "",
    vatNumber: "",
    vehiclePlate: "",
    insuranceCompany: "",
    policyNumberOther: "",
    notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setClaimId(editing.claimId);
      setForm({
        role: editing.role,
        fullName: editing.fullName,
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        vatNumber: editing.vatNumber ?? "",
        vehiclePlate: editing.vehiclePlate ?? "",
        insuranceCompany: editing.insuranceCompany ?? "",
        policyNumberOther: editing.policyNumberOther ?? "",
        notes: editing.notes ?? ""
      });
    } else if (open) {
      setClaimId("");
      setForm({
        role: "Driver", fullName: "", phone: "", email: "",
        vatNumber: "", vehiclePlate: "", insuranceCompany: "",
        policyNumberOther: "", notes: ""
      });
    }
    setErr(null);
  }, [editing, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        role: form.role,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
        vehiclePlate: form.vehiclePlate.trim() || null,
        insuranceCompany: form.insuranceCompany.trim() || null,
        policyNumberOther: form.policyNumberOther.trim() || null,
        notes: form.notes.trim() || null
      };
      if (editing) return (await api.put(`/claim-involved-parties/${editing.id}`, body)).data;
      return (await api.post(`/claims/${claimId}/involved-parties`, body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Επεξεργασία εμπλεκόμενου" : "Νέος εμπλεκόμενος σε ζημιά"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          {!editing && (
            <SearchableTextField label="Ζημιά" value={claimId} onChange={e => setClaimId(e.target.value)} fullWidth required
              helperText="Επιλέξτε τη ζημιά στην οποία εμπλέκεται.">
              <MenuItem value="">— Επιλέξτε ζημιά —</MenuItem>
              {claims.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.claimNumber} · {c.incidentDate} · Συμβόλαιο {c.policyNumber}
                </MenuItem>
              ))}
            </SearchableTextField>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Ρόλος" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} fullWidth>
              {INVOLVED_ROLES.map(r => <MenuItem key={r} value={r}>{INVOLVED_ROLE_LABEL[r] ?? r}</MenuItem>)}
            </SearchableTextField>
            <TextField required label="Ονοματεπώνυμο" value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Τηλέφωνο" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="ΑΦΜ" value={form.vatNumber} onChange={e => setForm({ ...form, vatNumber: e.target.value })} fullWidth />
            <TextField label="Πινακίδα οχήματος" value={form.vehiclePlate}
              onChange={e => setForm({ ...form, vehiclePlate: e.target.value.toUpperCase() })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Ασφαλιστική εταιρεία" value={form.insuranceCompany}
              onChange={e => setForm({ ...form, insuranceCompany: e.target.value })} fullWidth />
            <TextField label="Αρ. συμβολαίου (τρίτου)" value={form.policyNumberOther}
              onChange={e => setForm({ ...form, policyNumberOther: e.target.value })} fullWidth />
          </Stack>
          <TextField label="Σημειώσεις" multiline rows={3} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth
            placeholder="π.χ. σοβαρότητα τραυματισμού, μαρτυρίες, εκκρεμότητες…" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.fullName.trim() || (!editing && !claimId)}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
