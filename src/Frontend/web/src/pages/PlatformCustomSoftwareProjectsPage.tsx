import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type RecordKind = "phase" | "milestone" | "deliverable" | "team" | "cost" | "note";

interface PortalProject {
  id: string;
  name: string;
  clientName: string;
  summary: string | null;
  description: string | null;
  status: string;
  currency: string;
  totalCost: number | null;
  startedOn: string | null;
  targetDate: string | null;
  repositoryUrl: string | null;
  projectDownloadUrl: string | null;
  adminNotes: string | null;
  userIds: string[];
  records: ProjectRecord[];
}

interface ProjectRecord {
  id: string;
  projectId: string;
  parentRecordId: string | null;
  kind: RecordKind | string;
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

interface PortalAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  projectIds: string[];
}

const apiRoot = "/platform/custom-software-portal";

export function PlatformCustomSoftwareProjectsPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDialog, setProjectDialog] = useState<PortalProject | "new" | null>(null);
  const [accountDialog, setAccountDialog] = useState<PortalAccount | "new" | null>(null);
  const [recordDialog, setRecordDialog] = useState<ProjectRecord | "new" | null>(null);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [issuedPasswordNotice, setIssuedPasswordNotice] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["platform-custom-software-projects"],
    queryFn: async () => (await api.get<PortalProject[]>(`${apiRoot}/projects`)).data,
    enabled: user?.role === "PlatformAdmin",
  });
  const accountsQuery = useQuery({
    queryKey: ["platform-custom-software-accounts"],
    queryFn: async () => (await api.get<PortalAccount[]>(`${apiRoot}/accounts`)).data,
    enabled: user?.role === "PlatformAdmin",
  });
  const projects = projectsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["platform-custom-software-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-custom-software-accounts"] }),
    ]);
  };
  const actionMutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async (result) => {
      setError("");
      setSuccess("Οι αλλαγές αποθηκεύτηκαν.");
      const initialPassword = (result as { data?: { initialPassword?: string } })?.data?.initialPassword;
      if (initialPassword) setIssuedPasswordNotice(initialPassword);
      await refresh();
    },
    onError: (requestError) => setError(extractErrorMessage(requestError, "Η ενέργεια δεν ολοκληρώθηκε.")),
  });

  if (loading) return <CircularProgress />;
  if (user?.role !== "PlatformAdmin") return <Alert severity="error">Η διαχείριση έργων είναι διαθέσιμη μόνο στον KALYPSIS Platform Admin.</Alert>;

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ color: "#0b2545", fontWeight: 900 }}>Custom software · Έργα συνεργατών</Typography>
          <Typography color="text.secondary" sx={{ mt: .5 }}>Διαχειριστείτε έργα, portal accounts, παραδοτέα, κόστος και τιμολόγια.</Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setAccountDialog("new")}>Νέος λογαριασμός</Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setProjectDialog("new")}>Νέο έργο</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>{success}</Alert>}
      {issuedPasswordNotice && (
        <Alert severity="warning" onClose={() => setIssuedPasswordNotice("")} sx={{ mb: 2 }}>
          Αρχικός κωδικός συνεργάτη: <b>{issuedPasswordNotice}</b>. Αντιγράψτε τον και μοιραστείτε τον με ασφαλή τρόπο. Δεν θα εμφανιστεί ξανά.
        </Alert>
      )}
      {(projectsQuery.isError || accountsQuery.isError) && (
        <Alert severity="error" action={<Button onClick={() => { void projectsQuery.refetch(); void accountsQuery.refetch(); }}>Δοκιμή ξανά</Button>} sx={{ mb: 2 }}>
          Δεν ήταν δυνατή η φόρτωση της διαχείρισης portal.
        </Alert>
      )}
      {(projectsQuery.isLoading || accountsQuery.isLoading) ? <CircularProgress /> : (
        <Card sx={{ borderRadius: 3 }}>
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)} sx={{ borderBottom: "1px solid #e6ebf0" }}>
            <Tab label={`Έργα (${projects.length})`} />
            <Tab label={`Λογαριασμοί (${accounts.length})`} />
          </Tabs>
          <CardContent sx={{ p: { xs: 1.5, md: 3 } }}>
            {tab === 0 && (
              <Stack spacing={2.5}>
                <FormControl sx={{ maxWidth: 560 }}>
                  <InputLabel id="project-select-label">Επιλέξτε έργο</InputLabel>
                  <Select labelId="project-select-label" value={selectedProject?.id ?? ""} label="Επιλέξτε έργο" onChange={(e) => setSelectedProjectId(e.target.value)}>
                    {projects.map((project) => <MenuItem key={project.id} value={project.id}>{project.name} · {project.clientName}</MenuItem>)}
                  </Select>
                </FormControl>
                {!selectedProject ? (
                  <Alert severity="info">Δεν έχουν δημιουργηθεί έργα. Δημιουργήστε νέο έργο για να ξεκινήσετε.</Alert>
                ) : (
                  <>
                    <ProjectSummaryCard project={selectedProject} accounts={accounts} onEdit={() => setProjectDialog(selectedProject)} />
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="h6" sx={{ fontWeight: 850 }}>Περιεχόμενο έργου</Typography>
                      <Stack direction="row" gap={1}>
                        <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => setUploadDialog(true)}>Ανάρτηση αρχείου / τιμολογίου</Button>
                        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setRecordDialog("new")}>Προσθήκη στοιχείου</Button>
                      </Stack>
                    </Stack>
                    <RecordTable
                      records={selectedProject.records}
                      onEdit={(record) => setRecordDialog(record)}
                      onDelete={(record) => {
                        if (!window.confirm(`Διαγραφή «${record.title}»;`)) return;
                        actionMutation.mutate(() => api.delete(`${apiRoot}/projects/${selectedProject.id}/records/${record.id}`));
                      }}
                    />
                  </>
                )}
              </Stack>
            )}
            {tab === 1 && (
              <AccountTable
                accounts={accounts}
                projects={projects}
                onEdit={(account) => setAccountDialog(account)}
                onDelete={(account) => {
                  if (!window.confirm(`Απενεργοποίηση και ανάκληση πρόσβασης για τον λογαριασμό ${account.email};`)) return;
                  actionMutation.mutate(() => api.delete(`${apiRoot}/accounts/${account.id}`));
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      <ProjectDialog
        open={projectDialog !== null}
        project={projectDialog === "new" ? null : projectDialog}
        busy={actionMutation.isPending}
        onClose={() => setProjectDialog(null)}
        onSubmit={(body) => {
          setError("");
          actionMutation.mutate(() => projectDialog === "new"
            ? api.post(`${apiRoot}/projects`, body)
            : api.put(`${apiRoot}/projects/${projectDialog!.id}`, body));
          setProjectDialog(null);
        }}
        onDelete={projectDialog !== "new" && projectDialog ? () => {
          if (!window.confirm("Διαγραφή έργου και όλων των σχετικών εγγραφών;")) return;
          actionMutation.mutate(() => api.delete(`${apiRoot}/projects/${projectDialog.id}`));
          setProjectDialog(null);
        } : undefined}
      />
      <AccountDialog
        open={accountDialog !== null}
        account={accountDialog === "new" ? null : accountDialog}
        projects={projects}
        busy={actionMutation.isPending}
        onClose={() => setAccountDialog(null)}
        onSubmit={(body) => {
          setError("");
          setIssuedPasswordNotice("");
          actionMutation.mutate(() => accountDialog === "new"
            ? api.post(`${apiRoot}/accounts`, body)
            : api.put(`${apiRoot}/accounts/${accountDialog!.id}`, body));
          setAccountDialog(null);
        }}
      />
      {selectedProject && (
        <>
          <RecordDialog
            open={recordDialog !== null}
            record={recordDialog === "new" ? null : recordDialog}
            phases={selectedProject.records.filter((record) => record.kind === "phase")}
            busy={actionMutation.isPending}
            onClose={() => setRecordDialog(null)}
            onSubmit={(body) => {
              actionMutation.mutate(() => recordDialog === "new"
                ? api.post(`${apiRoot}/projects/${selectedProject.id}/records`, body)
                : api.put(`${apiRoot}/projects/${selectedProject.id}/records/${recordDialog!.id}`, body));
              setRecordDialog(null);
            }}
          />
          <UploadDialog
            open={uploadDialog}
            phases={selectedProject.records.filter((record) => record.kind === "phase")}
            busy={actionMutation.isPending}
            onClose={() => setUploadDialog(false)}
            onSubmit={(form) => {
              actionMutation.mutate(() => api.post(`${apiRoot}/projects/${selectedProject.id}/documents`, form, {
                headers: { "Content-Type": "multipart/form-data" },
              }));
              setUploadDialog(false);
            }}
          />
        </>
      )}
    </Box>
  );
}

function ProjectSummaryCard({ project, accounts, onEdit }: { project: PortalProject; accounts: PortalAccount[]; onEdit: () => void }) {
  const assigned = accounts.filter((account) => project.userIds.includes(account.id));
  const phaseCount = project.records.filter((record) => record.kind === "phase").length;
  const invoices = project.records.filter((record) => record.kind === "invoice").length;
  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h6" sx={{ color: "#0b2545", fontWeight: 850 }}>{project.name}</Typography>
              <Chip size="small" label={project.status} />
            </Stack>
            <Typography sx={{ mt: .5, color: "#607087" }}>{project.clientName} · {phaseCount} φάσεις · {invoices} τιμολόγια</Typography>
            <Typography sx={{ mt: 1, color: "#607087", fontSize: 13 }}>{assigned.length ? assigned.map((account) => `${account.firstName} ${account.lastName}`).join(", ") : "Δεν έχουν ανατεθεί λογαριασμοί."}</Typography>
            {project.adminNotes && <Typography sx={{ mt: 1, color: "#8a6c2b", fontSize: 12 }}>Εσωτερική σημείωση: {project.adminNotes}</Typography>}
          </Box>
          <Button startIcon={<EditOutlinedIcon />} onClick={onEdit} sx={{ alignSelf: { md: "flex-start" }, textTransform: "none" }}>Επεξεργασία έργου</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function RecordTable({ records, onEdit, onDelete }: { records: ProjectRecord[]; onEdit: (record: ProjectRecord) => void; onDelete: (record: ProjectRecord) => void }) {
  if (!records.length) return <Alert severity="info">Δεν υπάρχουν ακόμη φάσεις, ορόσημα, κόστος ή έγγραφα.</Alert>;
  const kinds: Record<string, string> = { phase: "Φάση", milestone: "Ορόσημο", deliverable: "Παραδοτέο", team: "Ομάδα", cost: "Κόστος", note: "Σημείωση", contract: "Σύμβαση", invoice: "Τιμολόγιο", "project-file": "Αρχείο έργου" };
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <Box component="thead"><Box component="tr">{["Τύπος", "Τίτλος", "Κατάσταση", "Ημ/νία", "Ποσό", "Αρχείο", ""].map((heading) => <Box component="th" key={heading} sx={tableHeadSx}>{heading}</Box>)}</Box></Box>
        <Box component="tbody">
          {records.map((record) => (
            <Box component="tr" key={record.id}>
              <Box component="td" sx={tableCellSx}>{kinds[record.kind] ?? record.kind}</Box>
              <Box component="td" sx={tableCellSx}><b>{record.title}</b>{record.description && <Typography sx={{ color: "#77879a", fontSize: 11.5 }}>{record.description}</Typography>}</Box>
              <Box component="td" sx={tableCellSx}>{record.status ?? "—"}</Box>
              <Box component="td" sx={tableCellSx}>{record.dueOn ?? record.issuedOn ?? "—"}</Box>
              <Box component="td" sx={tableCellSx}>{record.amount == null ? "—" : new Intl.NumberFormat("el-GR",{style:"currency",currency:"EUR"}).format(record.amount)}</Box>
              <Box component="td" sx={tableCellSx}>{record.fileName ?? "—"}</Box>
              <Box component="td" sx={tableCellSx}>
                <IconButton size="small" aria-label="Επεξεργασία" onClick={() => onEdit(record)}><EditOutlinedIcon fontSize="small" /></IconButton>
                <IconButton size="small" aria-label="Διαγραφή" color="error" onClick={() => onDelete(record)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function AccountTable({ accounts, projects, onEdit, onDelete }: {
  accounts: PortalAccount[];
  projects: PortalProject[];
  onEdit: (account: PortalAccount) => void;
  onDelete: (account: PortalAccount) => void;
}) {
  if (!accounts.length) return <Alert severity="info">Δεν υπάρχουν λογαριασμοί portal. Δημιουργήστε λογαριασμό για τον συνεργάτη και αναθέστε τον στα αντίστοιχα έργα.</Alert>;
  return (
    <Stack spacing={1.25}>
      {accounts.map((account) => (
        <Card variant="outlined" key={account.id} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, py: "14px !important" }}>
            <Box>
              <Typography sx={{ color: "#0b2545", fontWeight: 850 }}>{account.firstName} {account.lastName} · {account.email}</Typography>
              <Typography sx={{ mt: .4, color: "#718096", fontSize: 12 }}>
                {account.isActive ? "Ενεργός" : "Απενεργοποιημένος"} · {account.projectIds.map((id) => projects.find((project) => project.id === id)?.name).filter(Boolean).join(", ") || "Χωρίς έργα"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5}>
              <Button startIcon={<EditOutlinedIcon />} onClick={() => onEdit(account)}>Διαχείριση</Button>
              <IconButton aria-label={`Απενεργοποίηση ${account.email}`} color="error" onClick={() => onDelete(account)} disabled={!account.isActive}>
                <DeleteOutlineRoundedIcon />
              </IconButton>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function ProjectDialog({ open, project, busy, onClose, onSubmit, onDelete }: {
  open: boolean; project: PortalProject | null; busy: boolean; onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void; onDelete?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    setValues({
      name: project?.name ?? "",
      clientName: project?.clientName ?? "",
      summary: project?.summary ?? "",
      description: project?.description ?? "",
      status: project?.status ?? "planning",
      currency: project?.currency ?? "EUR",
      totalCost: project?.totalCost?.toString() ?? "",
      startedOn: project?.startedOn ?? "",
      targetDate: project?.targetDate ?? "",
      repositoryUrl: project?.repositoryUrl ?? "",
      projectDownloadUrl: project?.projectDownloadUrl ?? "",
      adminNotes: project?.adminNotes ?? "",
    });
  }, [project, open]);
  const set = (key: string) => (event: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...values,
      totalCost: values.totalCost ? Number(values.totalCost) : null,
      startedOn: values.startedOn || null,
      targetDate: values.targetDate || null,
    });
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={submit}>
        <DialogTitle sx={{ color: "#0b2545", fontWeight: 900 }}>{project ? "Επεξεργασία έργου" : "Νέο custom software έργο"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Τίτλος έργου" required value={values.name ?? ""} onChange={set("name")} fullWidth /><TextField label="Πελάτης / εταιρεία" required value={values.clientName ?? ""} onChange={set("clientName")} fullWidth /></Stack>
          <TextField label="Σύντομη περιγραφή" value={values.summary ?? ""} onChange={set("summary")} multiline minRows={2} />
          <TextField label="Περιγραφή έργου για το portal" value={values.description ?? ""} onChange={set("description")} multiline minRows={3} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <FormControl fullWidth><InputLabel>Κατάσταση</InputLabel><Select label="Κατάσταση" value={values.status ?? "planning"} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}><MenuItem value="planning">Σχεδιασμός</MenuItem><MenuItem value="active">Σε εξέλιξη</MenuItem><MenuItem value="on_hold">Σε αναμονή</MenuItem><MenuItem value="completed">Ολοκληρώθηκε</MenuItem></Select></FormControl>
            <TextField label="Συνολικό κόστος" type="number" inputProps={{ min: 0, step: "0.01" }} value={values.totalCost ?? ""} onChange={set("totalCost")} />
            <TextField label="Νόμισμα" inputProps={{ maxLength: 3 }} value={values.currency ?? "EUR"} onChange={set("currency")} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Ημερομηνία έναρξης" type="date" InputLabelProps={{ shrink: true }} value={values.startedOn ?? ""} onChange={set("startedOn")} /><TextField label="Στόχος παράδοσης" type="date" InputLabelProps={{ shrink: true }} value={values.targetDate ?? ""} onChange={set("targetDate")} /><TextField label="GitHub repository (HTTPS)" value={values.repositoryUrl ?? ""} onChange={set("repositoryUrl")} fullWidth /></Stack>
          <TextField label="Σύνδεσμος λήψης έργου (HTTPS)" value={values.projectDownloadUrl ?? ""} onChange={set("projectDownloadUrl")} />
          <TextField label="Εσωτερικές σημειώσεις (μόνο για διαχειριστή)" value={values.adminNotes ?? ""} onChange={set("adminNotes")} multiline minRows={2} />
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
          {onDelete ? <Button color="error" onClick={onDelete}>Διαγραφή έργου</Button> : <Box />}
          <Stack direction="row" gap={1}><Button onClick={onClose}>Ακύρωση</Button><Button type="submit" variant="contained" disabled={busy}>Αποθήκευση</Button></Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function AccountDialog({ open, account, projects, busy, onClose, onSubmit }: {
  open: boolean; account: PortalAccount | null; projects: PortalProject[]; busy: boolean; onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const makePassword = () => {
    const value = `${crypto.randomUUID().replaceAll("-", "")}aA!`;
    setPassword(value);
    return value;
  };
  const reset = () => {
    setEmail(account?.email ?? "");
    setFirstName(account?.firstName ?? "");
    setLastName(account?.lastName ?? "");
    setPhone(account?.phone ?? "");
    setActive(account?.isActive ?? true);
    setPassword("");
    setProjectIds(account?.projectIds ?? []);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const initialPassword = account ? password || null : password || makePassword();
    onSubmit({ email, firstName, lastName, phone: phone || null, isActive: active, projectIds, initialPassword });
  };

  return (
    <Dialog open={open} onClose={onClose} onTransitionEnter={reset} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle sx={{ color: "#0b2545", fontWeight: 900 }}>{account ? "Λογαριασμός συνεργάτη" : "Δημιουργία portal λογαριασμού"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Δεν υπάρχει δημόσια εγγραφή. Μόνο λογαριασμοί που δημιουργούνται εδώ μπορούν να συνδεθούν. Ο συνεργάτης μπορεί να αλλάξει τον κωδικό του από τις ρυθμίσεις προφίλ.</Alert>
          <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Όνομα" required value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth /><TextField label="Επώνυμο" required value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth /></Stack>
          <TextField label="Τηλέφωνο" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <FormControl fullWidth>
            <InputLabel id="portal-projects-label">Πρόσβαση στα έργα</InputLabel>
            <Select labelId="portal-projects-label" multiple label="Πρόσβαση στα έργα" value={projectIds} onChange={(e) => setProjectIds(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}>
              {projects.map((project) => <MenuItem key={project.id} value={project.id}>{project.name} · {project.clientName}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label={account ? "Νέος κωδικός (προαιρετικό)" : "Αρχικός κωδικός"} type="text" helperText="Τουλάχιστον 12 χαρακτήρες· εμφανίζεται μόνο κατά τη δημιουργία ή επαναφορά." value={password} onChange={(e) => setPassword(e.target.value)} InputProps={{ endAdornment: <Button onClick={() => makePassword()} size="small">Δημιουργία</Button> }} />
          {account && <FormControl fullWidth><InputLabel>Κατάσταση λογαριασμού</InputLabel><Select label="Κατάσταση λογαριασμού" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}><MenuItem value="active">Ενεργός</MenuItem><MenuItem value="inactive">Απενεργοποιημένος</MenuItem></Select></FormControl>}
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={onClose}>Κλείσιμο</Button><Button type="submit" variant="contained" disabled={busy || (password.length > 0 && password.length < 12)}>{account ? "Αποθήκευση" : "Δημιουργία λογαριασμού"}</Button></DialogActions>
      </form>
    </Dialog>
  );
}

function RecordDialog({ open, record, phases, busy, onClose, onSubmit }: {
  open: boolean; record: ProjectRecord | null; phases: ProjectRecord[]; busy: boolean; onClose: () => void; onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [kind, setKind] = useState<RecordKind>("phase");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [parentRecordId, setParentRecordId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [detailsJson, setDetailsJson] = useState("");

  const reset = () => {
    setKind((record?.kind as RecordKind) ?? "phase");
    setTitle(record?.title ?? "");
    setDescription(record?.description ?? "");
    setStatus(record?.status ?? "planning");
    setAmount(record?.amount?.toString() ?? "");
    setDueOn(record?.dueOn ?? "");
    setIssuedOn(record?.issuedOn ?? "");
    setParentRecordId(record?.parentRecordId ?? "");
    setSortOrder(record?.sortOrder?.toString() ?? "0");
    setDetailsJson(record?.detailsJson ?? "");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      kind,
      title,
      description: description || null,
      status: status || null,
      amount: amount ? Number(amount) : null,
      dueOn: dueOn || null,
      issuedOn: issuedOn || null,
      parentRecordId: parentRecordId || null,
      sortOrder: Number(sortOrder) || 0,
      detailsJson: detailsJson || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} onTransitionEnter={reset} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle sx={{ color: "#0b2545", fontWeight: 900 }}>{record ? "Επεξεργασία στοιχείου έργου" : "Νέο στοιχείο έργου"}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth><InputLabel>Τύπος στοιχείου</InputLabel><Select label="Τύπος στοιχείου" value={kind} onChange={(e) => setKind(e.target.value as RecordKind)}>{recordKinds.map((item) => <MenuItem value={item.value} key={item.value}>{item.label}</MenuItem>)}</Select></FormControl>
          <TextField label="Τίτλος" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Περιγραφή" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <FormControl fullWidth><InputLabel>Κατάσταση</InputLabel><Select label="Κατάσταση" value={status} onChange={(e) => setStatus(e.target.value)}>{recordStatuses.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</Select></FormControl>
            <TextField label="Σειρά εμφάνισης" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Stack>
          <FormControl fullWidth><InputLabel>Γονική φάση / αναφορά</InputLabel><Select label="Γονική φάση / αναφορά" value={parentRecordId} onChange={(e) => setParentRecordId(e.target.value)}><MenuItem value="">Χωρίς φάση</MenuItem>{phases.map((phase) => <MenuItem value={phase.id} key={phase.id}>{phase.title}</MenuItem>)}</Select></FormControl>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Ποσό (€)" type="number" inputProps={{ min: 0, step: ".01" }} value={amount} onChange={(e) => setAmount(e.target.value)} /><TextField label="Ημερομηνία λήξης / ορόσημο" type="date" InputLabelProps={{ shrink: true }} value={dueOn} onChange={(e) => setDueOn(e.target.value)} /><TextField label="Ημερομηνία έκδοσης" type="date" InputLabelProps={{ shrink: true }} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} /></Stack>
          {kind === "team" && <TextField label='Ρόλος και στόχος σε JSON (π.χ. {"role":"Developer","goal":"API"})' value={detailsJson} onChange={(e) => setDetailsJson(e.target.value)} />}
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={onClose}>Ακύρωση</Button><Button type="submit" variant="contained" disabled={busy}>Αποθήκευση</Button></DialogActions>
      </form>
    </Dialog>
  );
}

function UploadDialog({ open, phases, busy, onClose, onSubmit }: {
  open: boolean; phases: ProjectRecord[]; busy: boolean; onClose: () => void; onSubmit: (form: FormData) => void;
}) {
  const [kind, setKind] = useState("deliverable");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [parentRecordId, setParentRecordId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setKind("deliverable"); setTitle(""); setDescription(""); setAmount("");
    setDueOn(""); setIssuedOn(""); setParentRecordId(""); setFile(null);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    form.append("title", title);
    form.append("description", description);
    if (amount) form.append("amount", amount);
    if (dueOn) form.append("dueOn", dueOn);
    if (issuedOn) form.append("issuedOn", issuedOn);
    if (parentRecordId) form.append("parentRecordId", parentRecordId);
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} onTransitionEnter={reset} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle sx={{ color: "#0b2545", fontWeight: 900 }}>Ανάρτηση αρχείου για συνεργάτη</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">Επιτρέπονται ασφαλή έγγραφα έως 25 MB. Τα αρχεία συμβάσεων και τιμολογίων είναι ορατά μόνο στους χρήστες του συγκεκριμένου έργου.</Alert>
          <FormControl fullWidth><InputLabel>Κατηγορία αρχείου</InputLabel><Select label="Κατηγορία αρχείου" value={kind} onChange={(e) => setKind(e.target.value)}><MenuItem value="contract">Σύμβαση συνεργασίας</MenuItem><MenuItem value="deliverable">Παραδοτέο</MenuItem><MenuItem value="invoice">Τιμολόγιο</MenuItem><MenuItem value="project-file">Αρχείο έργου</MenuItem></Select></FormControl>
          <TextField label={kind === "invoice" ? "Αριθμός / τίτλος τιμολογίου" : "Τίτλος"} required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Περιγραφή" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Ποσό (€)" type="number" inputProps={{ min: 0, step: ".01" }} value={amount} onChange={(e) => setAmount(e.target.value)} /><TextField label="Ημ/νία έκδοσης" type="date" InputLabelProps={{ shrink: true }} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} /><TextField label="Ημ/νία λήξης" type="date" InputLabelProps={{ shrink: true }} value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></Stack>
          {kind === "deliverable" && <FormControl fullWidth><InputLabel>Σύνδεση με φάση</InputLabel><Select label="Σύνδεση με φάση" value={parentRecordId} onChange={(e) => setParentRecordId(e.target.value)}><MenuItem value="">Χωρίς σύνδεση</MenuItem>{phases.map((phase) => <MenuItem key={phase.id} value={phase.id}>{phase.title}</MenuItem>)}</Select></FormControl>}
          <Button variant="outlined" component="label" startIcon={<UploadFileOutlinedIcon />}>{file ? file.name : "Επιλογή αρχείου"}<input type="file" hidden required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Button>
          {file && <Typography sx={{ color: "#66788d", fontSize: 12 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</Typography>}
        </Stack></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={onClose}>Ακύρωση</Button><Button type="submit" variant="contained" disabled={busy || !file}>Ανάρτηση</Button></DialogActions>
      </form>
    </Dialog>
  );
}

const recordKinds = [
  { value: "phase", label: "Φάση" },
  { value: "milestone", label: "Ορόσημο" },
  { value: "deliverable", label: "Παραδοτέο" },
  { value: "team", label: "Μέλος ομάδας" },
  { value: "cost", label: "Γραμμή κόστους" },
  { value: "note", label: "Ενημέρωση έργου" },
];
const recordStatuses = [
  { value: "planning", label: "Σχεδιασμός / προς υλοποίηση" },
  { value: "active", label: "Σε εξέλιξη" },
  { value: "done", label: "Ολοκληρώθηκε" },
  { value: "blocked", label: "Σε αναμονή" },
  { value: "paid", label: "Εξοφλήθηκε" },
  { value: "unpaid", label: "Σε εκκρεμότητα" },
];
const tableHeadSx = { p: 1.25, borderBottom: "1px solid #dde5ed", color: "#607087", textAlign: "left", fontSize: 11, letterSpacing: ".06em", whiteSpace: "nowrap" };
const tableCellSx = { p: 1.25, borderBottom: "1px solid #edf1f5", color: "#263f58", fontSize: 12.5, verticalAlign: "top" };
