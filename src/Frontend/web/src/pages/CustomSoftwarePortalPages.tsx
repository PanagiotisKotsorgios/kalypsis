import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import AttachMoneyRoundedIcon from "@mui/icons-material/AttachMoneyRounded";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "../api/client";
import { KalypsisLogo } from "../components/KalypsisLogo";

const PORTAL_TOKEN_KEY = "kalypsis_custom_software_portal";
const portalApi = axios.create({ baseURL: API_BASE_URL });

portalApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(PORTAL_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface PortalProjectSummary {
  id: string;
  name: string;
  summary: string | null;
  status: string;
  targetDate: string | null;
  totalCost: number | null;
  currency: string;
}

interface PortalAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  mustChangePassword: boolean;
  preferencesJson: string;
  projects: PortalProjectSummary[];
}

interface ProjectRecord {
  id: string;
  parentRecordId: string | null;
  kind: "phase" | "milestone" | "deliverable" | "team" | "cost" | "note" | string;
  title: string;
  description: string | null;
  status: string | null;
  detailsJson: string | null;
  sortOrder: number;
  amount: number | null;
  dueOn: string | null;
  issuedOn: string | null;
  hasFile: boolean;
  fileName: string | null;
  sizeBytes: number | null;
}

interface PortalProject extends PortalProjectSummary {
  clientName: string;
  description: string | null;
  startedOn: string | null;
  repositoryUrl: string | null;
  projectDownloadUrl: string | null;
  records: ProjectRecord[];
}

const statusLabels: Record<string, string> = {
  planning: "Σχεδιασμός",
  active: "Σε εξέλιξη",
  in_progress: "Σε εξέλιξη",
  on_hold: "Σε αναμονή",
  completed: "Ολοκληρώθηκε",
  cancelled: "Ακυρώθηκε",
  todo: "Προς υλοποίηση",
  done: "Ολοκληρώθηκε",
  blocked: "Σε αναμονή",
  paid: "Εξοφλήθηκε",
  unpaid: "Σε εκκρεμότητα",
  overdue: "Εκπρόθεσμο",
};

function statusLabel(status?: string | null) {
  if (!status) return "Σε εξέλιξη";
  return statusLabels[status.toLowerCase()] ?? status.replaceAll("_", " ");
}

function money(value: number | null | undefined, currency = "EUR") {
  if (value == null) return "—";
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("el-GR");
}

function details(record: ProjectRecord): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(record.detailsJson ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

export function CustomSoftwarePortalLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await portalApi.post("/custom-software-portal/auth/login", {
        email: email.trim(),
        password,
      });
      sessionStorage.setItem(PORTAL_TOKEN_KEY, data.accessToken);
      navigate("/custom-software-solutions/portal", { replace: true });
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message ?? "Δεν ήταν δυνατή η σύνδεση. Ελέγξτε τα στοιχεία σας."
          : "Παρουσιάστηκε σφάλμα σύνδεσης. Δοκιμάστε ξανά.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, bgcolor: "#f4f7fb" }}>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          minHeight: "100vh",
          flexDirection: "column",
          justifyContent: "space-between",
          p: { md: 6, lg: 9 },
          color: "#fff",
          background: "radial-gradient(circle at 20% 20%,rgba(72,159,223,.3),transparent 40%),linear-gradient(145deg,#07182a,#0b2545 62%,#143c60)",
        }}
      >
        <Box component={RouterLink} to="/" sx={{ width: "fit-content", p: 1.25, bgcolor: "#fff", borderRadius: 2 }}>
          <KalypsisLogo size={52} crop />
        </Box>
        <Box sx={{ maxWidth: 540 }}>
          <Typography sx={{ color: "#88cfff", fontSize: 12, fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase" }}>
            KALYPSIS · PROJECT PORTAL
          </Typography>
          <Typography component="h1" sx={{ mt: 2, color: "#fff", fontSize: { md: 42, lg: 54 }, lineHeight: 1.08, fontWeight: 900, letterSpacing: "-.04em" }}>
            Το έργο σας. Η πρόοδός του. Όλα σε ένα σημείο.
          </Typography>
          <Typography sx={{ mt: 2, color: "rgba(231,241,252,.75)", fontSize: 17, lineHeight: 1.8 }}>
            Παρακολουθήστε φάσεις, παραδοτέα, κόστος και τιμολόγια με ασφαλή πρόσβαση αποκλειστικά στα δικά σας έργα.
          </Typography>
        </Box>
        <Typography sx={{ color: "rgba(231,241,252,.55)", fontSize: 12 }}>© {new Date().getFullYear()} KALYPSIS SOFTWARE SOLUTIONS</Typography>
      </Box>
      <Box sx={{ display: "grid", placeItems: "center", p: { xs: 2.5, md: 5 } }}>
        <Card sx={{ width: "100%", maxWidth: 470, borderRadius: 4, boxShadow: "0 30px 90px rgba(11,37,69,.12)" }}>
          <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
              <Box component={RouterLink} to="/" sx={{ display: { xs: "block", md: "none" }, width: "fit-content" }}>
                <KalypsisLogo size={42} crop />
              </Box>
              <Button component={RouterLink} to="/custom-software-solutions" startIcon={<ArrowBackRoundedIcon />} sx={{ ml: "auto", textTransform: "none" }}>
                Πίσω στην ιστοσελίδα
              </Button>
            </Stack>
            <Typography sx={{ color: "#247db4", fontSize: 11, fontWeight: 900, letterSpacing: ".17em" }}>PORTAL ΣΥΝΕΡΓΑΤΩΝ</Typography>
            <Typography component="h2" sx={{ mt: 1, color: "#0b2545", fontSize: 32, fontWeight: 900, letterSpacing: "-.03em" }}>
              Σύνδεση στο έργο
            </Typography>
            <Typography sx={{ mt: 1, mb: 3, color: "#52647a", lineHeight: 1.7 }}>
              Η πρόσβαση δημιουργείται από την ομάδα KALYPSIS. Δεν υπάρχει δημόσια εγγραφή.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
            <form onSubmit={submit}>
              <Stack spacing={2.25}>
                <TextField label="Email συνεργάτη" type="email" autoComplete="username" required fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
                <TextField label="Κωδικός πρόσβασης" type="password" autoComplete="current-password" required fullWidth value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ py: 1.35, borderRadius: 2, bgcolor: "#0b2545", fontWeight: 850, textTransform: "none", "&:hover": { bgcolor: "#174874" } }}>
                  {submitting ? <CircularProgress size={23} color="inherit" /> : "Ασφαλής σύνδεση"}
                </Button>
              </Stack>
            </form>
            <Typography sx={{ mt: 3, color: "#718198", fontSize: 12, lineHeight: 1.65 }}>
              Δεν έχετε στοιχεία σύνδεσης; Επικοινωνήστε μαζί μας στο{" "}
              <Box component="a" href="mailto:info@mykalypsis.gr" sx={{ color: "#17689e", fontWeight: 800 }}>info@mykalypsis.gr</Box>.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export function CustomSoftwarePartnerPortalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useParams();
  const [tab, setTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const accountQuery = useQuery({
    queryKey: ["custom-software-portal-me"],
    queryFn: async () => (await portalApi.get<PortalAccount>("/custom-software-portal/me")).data,
    retry: false,
  });
  const projectQuery = useQuery({
    queryKey: ["custom-software-portal-project", projectId],
    queryFn: async () => (await portalApi.get<PortalProject>(`/custom-software-portal/projects/${projectId}`)).data,
    enabled: Boolean(projectId),
    retry: false,
  });

  useEffect(() => {
    if (accountQuery.isError) {
      sessionStorage.removeItem(PORTAL_TOKEN_KEY);
      navigate("/custom-software-solutions/login", { replace: true });
    }
  }, [accountQuery.isError, navigate]);

  useEffect(() => {
    if (accountQuery.data?.mustChangePassword) setPasswordDialog(true);
  }, [accountQuery.data?.mustChangePassword]);

  const logout = async () => {
    try {
      await portalApi.post("/custom-software-portal/logout");
    } catch {
      // Local logout still clears the portal-only session if the API is offline.
    } finally {
      sessionStorage.removeItem(PORTAL_TOKEN_KEY);
      queryClient.clear();
      navigate("/custom-software-solutions/login", { replace: true });
    }
  };

  if (!sessionStorage.getItem(PORTAL_TOKEN_KEY)) return <Navigate to="/custom-software-solutions/login" replace />;
  if (accountQuery.isLoading || !accountQuery.data) {
    return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  }

  const account = accountQuery.data;
  const selectedProject = account.projects.find((project) => project.id === projectId);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f4f7fb" }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "rgba(255,255,255,.94)", color: "#0b2545", borderBottom: "1px solid #dfe7ef", backdropFilter: "blur(14px)" }}>
        <Toolbar sx={{ maxWidth: 1500, width: "100%", mx: "auto", px: { xs: 1.5, md: 4 }, gap: 2 }}>
          <Box component={RouterLink} to="/custom-software-solutions/portal" sx={{ display: "flex", alignItems: "center", mr: { xs: "auto", md: 1 } }}>
            <KalypsisLogo size={40} crop />
          </Box>
          <Typography sx={{ display: { xs: "none", sm: "block" }, color: "#54708d", fontSize: 13, fontWeight: 750 }}>PROJECT PORTAL</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: 13, fontWeight: 750 }}>{account.firstName} {account.lastName}</Typography>
          <IconButton aria-label="Ρυθμίσεις λογαριασμού" onClick={() => setSettingsOpen(true)}><SettingsOutlinedIcon /></IconButton>
          <IconButton aria-label="Αποσύνδεση" onClick={() => void logout()}><LogoutRoundedIcon /></IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, md: 4 } }}>
        {account.mustChangePassword && (
          <Alert severity="warning" icon={<LockOutlinedIcon />} sx={{ mb: 3 }}>
            Για την προστασία του λογαριασμού σας, ορίστε νέο προσωπικό κωδικό πριν συνεχίσετε.
          </Alert>
        )}
        {!projectId ? (
          <ProjectOverview account={account} onSelect={(id) => navigate(`/custom-software-solutions/portal/projects/${id}`)} />
        ) : !selectedProject ? (
          <Alert severity="warning">Δεν βρέθηκε έργο για τον λογαριασμό σας.</Alert>
        ) : projectQuery.isLoading ? (
          <Box sx={{ py: 12, display: "grid", placeItems: "center" }}><CircularProgress /></Box>
        ) : projectQuery.isError || !projectQuery.data ? (
          <Alert severity="error" action={<Button onClick={() => void projectQuery.refetch()}>Δοκιμή ξανά</Button>}>Δεν ήταν δυνατή η φόρτωση του έργου.</Alert>
        ) : (
          <ProjectWorkspace project={projectQuery.data} tab={tab} onTabChange={setTab} onBack={() => navigate("/custom-software-solutions/portal")} />
        )}
      </Container>

      <ProfileDialog
        open={settingsOpen}
        account={account}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setSettingsOpen(false);
          void accountQuery.refetch();
        }}
        onPasswordChanged={() => {
          setPasswordDialog(false);
          sessionStorage.removeItem(PORTAL_TOKEN_KEY);
          navigate("/custom-software-solutions/login", { replace: true });
        }}
        forcePassword={passwordDialog}
      />
    </Box>
  );
}

function ProjectOverview({ account, onSelect }: { account: PortalAccount; onSelect: (id: string) => void }) {
  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography sx={{ color: "#277cb3", fontSize: 11, fontWeight: 900, letterSpacing: ".16em" }}>ΧΩΡΟΣ ΣΥΝΕΡΓΑΤΗ</Typography>
        <Typography component="h1" sx={{ mt: 1, color: "#0b2545", fontSize: { xs: 30, md: 42 }, fontWeight: 900, letterSpacing: "-.035em" }}>
          Καλώς ήρθατε, {account.firstName}
        </Typography>
        <Typography sx={{ mt: 1, color: "#63748a", fontSize: 16 }}>Παρακολουθήστε την πρόοδο και τα αρχεία των έργων σας.</Typography>
      </Box>
      {account.projects.length === 0 ? (
        <Card sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
          <FolderOpenOutlinedIcon sx={{ color: "#4c8db8", fontSize: 40 }} />
          <Typography sx={{ mt: 1, color: "#0b2545", fontSize: 19, fontWeight: 850 }}>Δεν υπάρχουν έργα συνδεδεμένα ακόμη</Typography>
          <Typography sx={{ mt: 0.75, color: "#64748b" }}>Η ομάδα KALYPSIS θα εμφανίσει εδώ το έργο σας όταν είναι διαθέσιμο.</Typography>
        </Card>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))", xl: "repeat(3,minmax(0,1fr))" }, gap: 2 }}>
          {account.projects.map((project) => (
            <Card key={project.id} sx={{ borderRadius: 3, border: "1px solid #e1e9f1", boxShadow: "0 16px 40px rgba(11,37,69,.055)" }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography sx={{ color: "#0b2545", fontSize: 20, fontWeight: 850 }}>{project.name}</Typography>
                    <Typography sx={{ mt: 0.75, color: "#64748b", fontSize: 13, lineHeight: 1.65 }}>{project.summary || "Το έργο σας σε εξέλιξη."}</Typography>
                  </Box>
                  <StatusChip status={project.status} />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Box>
                    <Typography sx={metaLabelSx}>ΣΥΜΦΩΝΗΜΕΝΟ ΚΟΣΤΟΣ</Typography>
                    <Typography sx={{ mt: 0.35, color: "#0b2545", fontWeight: 850 }}>{money(project.totalCost, project.currency)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography sx={metaLabelSx}>ΣΤΟΧΟΣ ΠΑΡΑΔΟΣΗΣ</Typography>
                    <Typography sx={{ mt: 0.35, color: "#0b2545", fontWeight: 750 }}>{dateLabel(project.targetDate)}</Typography>
                  </Box>
                </Stack>
                <Button fullWidth variant="contained" onClick={() => onSelect(project.id)} sx={{ mt: 2.5, borderRadius: 2, bgcolor: "#0b2545", fontWeight: 800, textTransform: "none" }}>
                  Άνοιγμα έργου
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function ProjectWorkspace({ project, tab, onTabChange, onBack }: { project: PortalProject; tab: number; onTabChange: (tab: number) => void; onBack: () => void }) {
  const phases = project.records.filter((record) => record.kind === "phase");
  const costs = project.records.filter((record) => record.kind === "cost");
  const invoices = project.records.filter((record) => record.kind === "invoice");
  const contracts = project.records.filter((record) => record.kind === "contract");
  const deliverables = project.records.filter((record) => record.kind === "deliverable");
  const team = project.records.filter((record) => record.kind === "team");
  const completedPhases = phases.filter((phase) => ["done", "completed"].includes((phase.status ?? "").toLowerCase())).length;
  const progress = phases.length ? Math.round((completedPhases / phases.length) * 100) : 0;
  const costTotal = costs.reduce((total, item) => total + (item.amount ?? 0), 0);

  return (
    <Stack spacing={3}>
      <Button onClick={onBack} startIcon={<ArrowBackRoundedIcon />} sx={{ width: "fit-content", color: "#315879", textTransform: "none", fontWeight: 750 }}>Όλα τα έργα</Button>
      <Card sx={{ overflow: "hidden", borderRadius: 4, color: "#fff", background: "radial-gradient(ellipse at 85% 0%,rgba(65,145,204,.35),transparent 38%),linear-gradient(125deg,#07182a,#0b2545 65%,#133b5e)" }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
            <Box>
              <Stack direction="row" useFlexGap flexWrap="wrap" alignItems="center" gap={1.25}>
                <Typography component="h1" sx={{ color: "#fff", fontSize: { xs: 28, md: 38 }, fontWeight: 900, letterSpacing: "-.035em" }}>{project.name}</Typography>
                <StatusChip status={project.status} />
              </Stack>
              <Typography sx={{ mt: 1, maxWidth: 760, color: "rgba(231,241,252,.75)", lineHeight: 1.75 }}>{project.summary || project.description}</Typography>
            </Box>
            <Stack direction={{ xs: "row", md: "column" }} useFlexGap flexWrap="wrap" gap={1} alignItems={{ md: "flex-end" }}>
              {project.repositoryUrl && <Button component="a" href={project.repositoryUrl} target="_blank" rel="noopener noreferrer" startIcon={<GitHubIcon />} sx={darkActionSx}>Repository</Button>}
              {project.projectDownloadUrl && <Button component="a" href={project.projectDownloadUrl} target="_blank" rel="noopener noreferrer" startIcon={<CloudDownloadOutlinedIcon />} sx={darkActionSx}>Λήψη έργου</Button>}
            </Stack>
          </Stack>
          <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 2 }}>
            <HeroStat label="ΕΝΑΡΞΗ" value={dateLabel(project.startedOn)} />
            <HeroStat label="ΣΤΟΧΟΣ ΠΑΡΑΔΟΣΗΣ" value={dateLabel(project.targetDate)} />
            <HeroStat label="ΣΥΝΟΛΙΚΟ ΚΟΣΤΟΣ" value={money(project.totalCost, project.currency)} />
            <HeroStat label="ΦΑΣΕΙΣ" value={`${completedPhases} / ${phases.length} ολοκληρωμένες`} />
          </Box>
          <Box sx={{ mt: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Typography sx={{ color: "rgba(231,241,252,.72)", fontSize: 12, fontWeight: 750 }}>Πρόοδος έργου</Typography>
              <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 850 }}>{progress}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 99, bgcolor: "rgba(255,255,255,.14)", "& .MuiLinearProgress-bar": { borderRadius: 99, bgcolor: "#6ac5ff" } }} />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, overflow: "hidden", border: "1px solid #e1e9f1" }}>
        <Tabs value={tab} onChange={(_, value: number) => onTabChange(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 1, borderBottom: "1px solid #e4ebf2" }}>
          <Tab label="Επισκόπηση" />
          <Tab label="Φάσεις & παραδοτέα" />
          <Tab label="Οικονομικά & τιμολόγια" />
          <Tab label="Ομάδα" />
          <Tab label="Έγγραφα" />
        </Tabs>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 0 && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.5fr 1fr" }, gap: 2.5 }}>
              <Panel title="Στάδια υλοποίησης" icon={<AssignmentTurnedInOutlinedIcon />}>
                {phases.length ? phases.map((phase) => <PhaseRow key={phase.id} phase={phase} project={project} />) : <EmptyState>Η ομάδα θα προσθέσει τις φάσεις του έργου σας εδώ.</EmptyState>}
              </Panel>
              <Stack spacing={2.5}>
                <Panel title="Συμφωνία συνεργασίας" icon={<DescriptionOutlinedIcon />}>
                  {contracts.length ? contracts.map((item) => <DocumentRow key={item.id} record={item} />) : <EmptyState>Δεν έχει αναρτηθεί σύμβαση.</EmptyState>}
                </Panel>
                <Panel title="Επόμενα ορόσημα" icon={<AssignmentTurnedInOutlinedIcon />}>
                  {project.records.filter((item) => item.kind === "milestone" && item.status !== "done").slice(0, 4).map((item) => <RecordRow key={item.id} record={item} />)}
                  {!project.records.some((item) => item.kind === "milestone" && item.status !== "done") && <EmptyState>Δεν υπάρχουν εκκρεμή ορόσημα.</EmptyState>}
                </Panel>
              </Stack>
            </Box>
          )}
          {tab === 1 && <PhasesPanel project={project} phases={phases} deliverables={deliverables} />}
          {tab === 2 && <FinancePanel costs={costs} invoices={invoices} totalCost={project.totalCost} costTotal={costTotal} currency={project.currency} />}
          {tab === 3 && <TeamPanel members={team} phases={phases} />}
          {tab === 4 && <DocumentsPanel records={project.records} />}
        </CardContent>
      </Card>
    </Stack>
  );
}

function PhasesPanel({ project, phases, deliverables }: { project: PortalProject; phases: ProjectRecord[]; deliverables: ProjectRecord[] }) {
  return (
    <Stack spacing={2}>
      <Typography sx={{ color: "#0b2545", fontSize: 20, fontWeight: 850 }}>Φάσεις έργου και παραδοτέα</Typography>
      {!phases.length && <EmptyState>Δεν έχουν καταχωριστεί ακόμη φάσεις.</EmptyState>}
      {phases.map((phase, index) => {
        const milestones = project.records.filter((record) => record.kind === "milestone" && record.parentRecordId === phase.id);
        const phaseDeliverables = deliverables.filter((record) => record.parentRecordId === phase.id);
        return (
          <Card key={phase.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={numberBadgeSx}>{String(index + 1).padStart(2, "0")}</Box>
                  <Box>
                    <Typography sx={{ color: "#0b2545", fontWeight: 850, fontSize: 17 }}>{phase.title}</Typography>
                    {phase.description && <Typography sx={{ mt: 0.4, color: "#64748b", fontSize: 13.5, lineHeight: 1.7 }}>{phase.description}</Typography>}
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {phase.dueOn && <Typography sx={{ color: "#708198", fontSize: 12 }}>Έως {dateLabel(phase.dueOn)}</Typography>}
                  <StatusChip status={phase.status ?? "planning"} />
                </Stack>
              </Stack>
              {(milestones.length > 0 || phaseDeliverables.length > 0) && (
                <Box sx={{ ml: { xs: 0, sm: 7 }, mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                  <Box>
                    <Typography sx={metaLabelSx}>ΟΡΟΣΗΜΑ</Typography>
                    {milestones.map((record) => <RecordRow key={record.id} record={record} />)}
                    {!milestones.length && <Typography sx={{ mt: 0.5, color: "#93a0af", fontSize: 12 }}>Δεν έχουν προστεθεί ορόσημα.</Typography>}
                  </Box>
                  <Box>
                    <Typography sx={metaLabelSx}>ΠΑΡΑΔΟΤΕΑ</Typography>
                    {phaseDeliverables.map((record) => <DocumentRow key={record.id} record={record} />)}
                    {!phaseDeliverables.length && <Typography sx={{ mt: 0.5, color: "#93a0af", fontSize: 12 }}>Δεν έχουν αναρτηθεί αρχεία.</Typography>}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

function FinancePanel({ costs, invoices, totalCost, costTotal, currency }: { costs: ProjectRecord[]; invoices: ProjectRecord[]; totalCost: number | null; costTotal: number; currency: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.15fr .85fr" }, gap: 2.5 }}>
      <Panel title="Ανάλυση κόστους έργου" icon={<AttachMoneyRoundedIcon />}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: "#f2f7fb" }}>
          <Box><Typography sx={metaLabelSx}>ΣΥΜΦΩΝΗΜΕΝΟ ΣΥΝΟΛΟ</Typography><Typography sx={{ mt: .5, color: "#0b2545", fontSize: 20, fontWeight: 900 }}>{money(totalCost, currency)}</Typography></Box>
          <Box sx={{ textAlign: "right" }}><Typography sx={metaLabelSx}>ΑΝΑΛΥΤΙΚΕΣ ΓΡΑΜΜΕΣ</Typography><Typography sx={{ mt: .5, color: "#0b2545", fontSize: 20, fontWeight: 900 }}>{money(costTotal, currency)}</Typography></Box>
        </Stack>
        {costs.length ? costs.map((line) => (
          <Stack key={line.id} direction="row" justifyContent="space-between" gap={2} sx={{ py: 1.25, borderBottom: "1px solid #edf1f5" }}>
            <Box><Typography sx={{ color: "#183b5b", fontSize: 14, fontWeight: 750 }}>{line.title}</Typography>{line.description && <Typography sx={{ color: "#76869a", fontSize: 12.5 }}>{line.description}</Typography>}</Box>
            <Typography sx={{ color: "#0b2545", fontWeight: 850, whiteSpace: "nowrap" }}>{money(line.amount, currency)}</Typography>
          </Stack>
        )) : <EmptyState>Δεν έχουν αναρτηθεί αναλυτικές γραμμές κόστους.</EmptyState>}
      </Panel>
      <Panel title="Τιμολόγια υπηρεσιών" icon={<ReceiptLongOutlinedIcon />}>
        {invoices.length ? invoices.map((invoice) => <InvoiceRow key={invoice.id} record={invoice} currency={currency} />) : <EmptyState>Τα τιμολόγια που εκδίδονται για τις υπηρεσίες σας θα εμφανίζονται εδώ.</EmptyState>}
      </Panel>
    </Box>
  );
}

function TeamPanel({ members, phases }: { members: ProjectRecord[]; phases: ProjectRecord[] }) {
  return (
    <Box>
      <Typography sx={{ color: "#0b2545", fontSize: 20, fontWeight: 850, mb: 2 }}>Ομάδα έργου και υπευθυνότητες</Typography>
      {!members.length && <EmptyState>Η ομάδα έργου θα εμφανιστεί εδώ.</EmptyState>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))", xl: "repeat(3,minmax(0,1fr))" }, gap: 1.5 }}>
        {members.map((member) => {
          const meta = details(member);
          const phase = phases.find((item) => item.id === member.parentRecordId);
          return (
            <Card key={member.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <AccountCircleOutlinedIcon sx={{ color: "#3485b6", fontSize: 34 }} />
                  <Box>
                    <Typography sx={{ color: "#0b2545", fontWeight: 850 }}>{member.title}</Typography>
                    {meta.role && <Typography sx={{ color: "#47789a", fontSize: 13, fontWeight: 750 }}>{meta.role}</Typography>}
                    {member.description && <Typography sx={{ mt: .75, color: "#64748b", fontSize: 13, lineHeight: 1.65 }}>{member.description}</Typography>}
                    {meta.goal && <Typography sx={{ mt: 1, color: "#40566e", fontSize: 12.5 }}><b>Στόχος:</b> {meta.goal}</Typography>}
                    {phase && <Chip size="small" label={phase.title} sx={{ mt: 1.25, bgcolor: "#eff6fc", color: "#285b7d", fontWeight: 750 }} />}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}

function DocumentsPanel({ records }: { records: ProjectRecord[] }) {
  const items = records.filter((record) => ["contract", "deliverable", "invoice", "project-file"].includes(record.kind));
  return (
    <Box>
      <Typography sx={{ color: "#0b2545", fontSize: 20, fontWeight: 850, mb: 2 }}>Συμβάσεις, παραδοτέα και αρχεία έργου</Typography>
      {!items.length ? <EmptyState>Δεν έχουν αναρτηθεί αρχεία.</EmptyState> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 1.25 }}>
          {items.map((record) => <DocumentRow key={record.id} record={record} large />)}
        </Box>
      )}
    </Box>
  );
}

function DocumentRow({ record, large = false }: { record: ProjectRecord; large?: boolean }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const response = await portalApi.get<Blob>(`/custom-software-portal/documents/${record.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = record.fileName || record.title;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Δεν ήταν δυνατή η λήψη του αρχείου. Δοκιμάστε ξανά.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ p: large ? 1.75 : 1, border: large ? "1px solid #e4ebf2" : 0, borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
        <DescriptionOutlinedIcon sx={{ color: "#4385ad", fontSize: 19, flexShrink: 0 }} />
        <Box minWidth={0}>
          <Typography sx={{ color: "#274762", fontSize: 13, fontWeight: 800 }}>{record.title}</Typography>
          {record.description && <Typography sx={{ color: "#7a899b", fontSize: 11.5 }}>{record.description}</Typography>}
          {record.fileName && <Typography sx={{ color: "#8996a5", fontSize: 10.5 }}>{record.fileName}</Typography>}
        </Box>
      </Stack>
      <Button size="small" disabled={!record.hasFile || busy} onClick={() => void download()} startIcon={busy ? <CircularProgress size={14} /> : <CloudDownloadOutlinedIcon />} sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800 }}>
        Λήψη
      </Button>
    </Stack>
  );
}

function InvoiceRow({ record, currency }: { record: ProjectRecord; currency: string }) {
  return (
    <Card variant="outlined" sx={{ mb: 1.2, borderRadius: 2 }}>
      <CardContent sx={{ p: "14px !important" }}>
        <Stack direction="row" justifyContent="space-between" gap={1}>
          <Box><Typography sx={{ color: "#173b5b", fontSize: 13.5, fontWeight: 850 }}>{record.title}</Typography><Typography sx={{ mt: .3, color: "#748397", fontSize: 11.5 }}>Έκδοση: {dateLabel(record.issuedOn)} · Λήξη: {dateLabel(record.dueOn)}</Typography></Box>
          <Typography sx={{ color: "#0b2545", fontWeight: 900, whiteSpace: "nowrap" }}>{money(record.amount, currency)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <StatusChip status={record.status ?? "unpaid"} />
          <DocumentRow record={record} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function PhaseRow({ phase, project }: { phase: ProjectRecord; project: PortalProject }) {
  const milestones = project.records.filter((record) => record.kind === "milestone" && record.parentRecordId === phase.id);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr) auto", gap: 1.5, alignItems: "start", py: 1.2, borderBottom: "1px solid #edf1f5" }}>
      <Box sx={numberBadgeSx}>{String(phase.sortOrder + 1).padStart(2, "0")}</Box>
      <Box><Typography sx={{ color: "#183b5b", fontSize: 14, fontWeight: 800 }}>{phase.title}</Typography><Typography sx={{ mt: .25, color: "#77879a", fontSize: 12.5 }}>{milestones.length} ορόσημα · {dateLabel(phase.dueOn)}</Typography></Box>
      <StatusChip status={phase.status ?? "planning"} />
    </Box>
  );
}

function RecordRow({ record }: { record: ProjectRecord }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1} sx={{ py: .75 }}>
      <Typography sx={{ color: "#35536e", fontSize: 12.5, fontWeight: 700 }}>{record.title}</Typography>
      <Typography sx={{ color: "#8491a1", fontSize: 11.5, whiteSpace: "nowrap" }}>{dateLabel(record.dueOn)}</Typography>
    </Stack>
  );
}

function ProfileDialog({ open, account, onClose, onSaved, onPasswordChanged, forcePassword }: {
  open: boolean;
  account: PortalAccount;
  onClose: () => void;
  onSaved: () => void;
  onPasswordChanged: () => void;
  forcePassword: boolean;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [phone, setPhone] = useState(account.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setPhone(account.phone ?? "");
  }, [account]);

  const saveProfile = useMutation({
    mutationFn: async () => portalApi.put("/custom-software-portal/profile", {
      firstName,
      lastName,
      phone,
      preferencesJson: account.preferencesJson || "{}",
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["custom-software-portal-me"] });
      onSaved();
    },
    onError: () => setError("Δεν ήταν δυνατή η αποθήκευση του προφίλ."),
  });
  const changePassword = useMutation({
    mutationFn: async () => portalApi.post("/custom-software-portal/change-password", { currentPassword, newPassword }),
    onSuccess: onPasswordChanged,
    onError: (requestError) => setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Δεν ήταν δυνατή η αλλαγή κωδικού." : "Δεν ήταν δυνατή η αλλαγή κωδικού."),
  });

  return (
    <Dialog open={open || forcePassword} onClose={forcePassword ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ color: "#0b2545", fontWeight: 900 }}>{forcePassword ? "Ορίστε τον προσωπικό σας κωδικό" : "Προφίλ & προτιμήσεις"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {forcePassword ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">Ο προσωρινός κωδικός πρέπει να αλλαχθεί πριν από την πρόσβαση στα στοιχεία του έργου.</Alert>
            <TextField label="Τρέχων προσωρινός κωδικός" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <TextField label="Νέος κωδικός (τουλάχιστον 12 χαρακτήρες)" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField label="Όνομα" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth />
              <TextField label="Επώνυμο" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
            </Stack>
            <TextField label="Email λογαριασμού" value={account.email} disabled helperText="Η αλλαγή email γίνεται από την ομάδα KALYPSIS για λόγους ασφαλείας." />
            <TextField label="Τηλέφωνο" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Divider />
            <Typography sx={{ color: "#0b2545", fontWeight: 850 }}>Αλλαγή κωδικού</Typography>
            <TextField label="Τρέχων κωδικός" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <TextField label="Νέος κωδικός (τουλάχιστον 12 χαρακτήρες)" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
        {!forcePassword && <Button onClick={onClose} sx={{ textTransform: "none" }}>Κλείσιμο</Button>}
        {forcePassword ? (
          <Button variant="contained" disabled={changePassword.isPending || newPassword.length < 12} onClick={() => { setError(""); changePassword.mutate(); }} sx={{ bgcolor: "#0b2545", textTransform: "none", fontWeight: 800 }}>
            {changePassword.isPending ? <CircularProgress size={18} color="inherit" /> : "Αποθήκευση νέου κωδικού"}
          </Button>
        ) : (
          <Stack direction="row" gap={1}>
            <Button disabled={changePassword.isPending || newPassword.length < 12 || !currentPassword} onClick={() => { setError(""); changePassword.mutate(); }} sx={{ textTransform: "none" }}>Αλλαγή κωδικού</Button>
            <Button variant="contained" disabled={saveProfile.isPending} onClick={() => { setError(""); saveProfile.mutate(); }} sx={{ bgcolor: "#0b2545", textTransform: "none", fontWeight: 800 }}>Αποθήκευση προφίλ</Button>
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5, borderColor: "#e1e9f1" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, color: "#347da8" }}>{icon}<Typography sx={{ color: "#0b2545", fontSize: 15, fontWeight: 850 }}>{title}</Typography></Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return <Box sx={{ px: 1.5, py: 1.25, borderRadius: 2, border: "1px solid rgba(202,225,245,.16)", bgcolor: "rgba(255,255,255,.055)" }}><Typography sx={{ color: "rgba(231,241,252,.58)", fontSize: 9.5, fontWeight: 850, letterSpacing: ".1em" }}>{label}</Typography><Typography sx={{ mt: .5, color: "#fff", fontSize: 13, fontWeight: 800 }}>{value}</Typography></Box>;
}

function StatusChip({ status }: { status?: string | null }) {
  const normalized = (status ?? "").toLowerCase();
  const color = ["done", "completed", "paid"].includes(normalized) ? "success" : ["on_hold", "blocked", "overdue"].includes(normalized) ? "warning" : "info";
  return <Chip size="small" label={statusLabel(status)} color={color} sx={{ height: 24, fontWeight: 800, fontSize: 10.5, textTransform: "capitalize" }} />;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ py: 1, color: "#8090a2", fontSize: 13, lineHeight: 1.7 }}>{children}</Typography>;
}

const metaLabelSx = { color: "#8391a1", fontSize: 9.5, fontWeight: 900, letterSpacing: ".11em" };
const numberBadgeSx = { width: 36, height: 36, flexShrink: 0, display: "grid", placeItems: "center", border: "1px solid #cfe0ee", borderRadius: 1.5, bgcolor: "#f1f7fc", color: "#2876a7", fontSize: 12, fontWeight: 900 };
const darkActionSx = { color: "#fff", border: "1px solid rgba(213,234,250,.35)", bgcolor: "rgba(255,255,255,.08)", borderRadius: 2, textTransform: "none", fontWeight: 750, "&:hover": { bgcolor: "rgba(255,255,255,.16)" } };
