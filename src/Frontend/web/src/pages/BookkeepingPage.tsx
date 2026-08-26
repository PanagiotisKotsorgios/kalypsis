import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, IconButton, InputLabel, LinearProgress,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem,
  Paper, Select, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FolderIcon from "@mui/icons-material/Folder";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { api, extractErrorMessage } from "../api/client";

/**
 * Tenant-side view of Μηχανογράφιση. Two modes:
 *
 *   1. Not opted in yet  → «What is this?» explainer + opt-in switch
 *      + free-text «contact request» box.
 *   2. Opted in           → three-column workspace: folder tree,
 *      files (drag-drop upload from PC), activity log the platform
 *      team maintains.
 *
 * All API calls go through /api/bookkeeping/* — tenant-scoped by the
 * normal tenant filter, no way to reach another tenant's data.
 */
interface ProgramDto { enabled: boolean; mode: string; contactRequestNote: string | null;
  onboarded: boolean; onboardedAt: string | null; createdAt: string | null;
  termsAcceptedAt: string | null; termsAcceptedVersion: string | null; currentTermsVersion: string; }
interface FolderDto { id: string; parentFolderId: string | null; name: string;
  origin: string; displayOrder: number; createdAt: string; fileCount: number; }
interface FileDto { id: string; folderId: string; fileName: string; mimeType: string;
  sizeBytes: number; uploadedBy: string; notes: string | null; status: string;
  createdAt: string; uploadedByDisplay: string | null; }
interface TreeResp { folders: FolderDto[]; files: FileDto[]; }
interface ActivityDto { id: string; kind: string; title: string; body: string | null;
  authorUserId: string; authorDisplay: string; category: string | null;
  autoNotified: boolean; createdAt: string; }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BookkeepingPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const prog = useQuery({
    queryKey: ["bookkeeping", "program"],
    queryFn: async () => (await api.get<ProgramDto>("/bookkeeping/program")).data,
  });
  if (prog.isLoading) return <Container sx={{ py: 4 }}><CircularProgress /></Container>;
  if (!prog.data?.enabled) return <OptInScreen program={prog.data ?? null} qc={qc} setErr={setErr} err={err} />;
  return <WorkspaceScreen program={prog.data!} qc={qc} setErr={setErr} err={err} />;
}

function OptInScreen({ program, qc, setErr, err }: {
  program: ProgramDto | null; qc: ReturnType<typeof useQueryClient>;
  setErr: (s: string | null) => void; err: string | null;
}) {
  const [note, setNote] = useState(program?.contactRequestNote ?? "");
  // Force "files" mode on opt-in. The «portals»/«hybrid» modes are
  // no longer selectable (see JSX below) — coercing the initial
  // state to "files" prevents a stale saved value from another
  // session showing up as an implicit selection.
  const [mode, setMode] = useState("files");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsFull, setShowTermsFull] = useState(false);
  const enable = useMutation({
    // Two-step so the user only sees one button: (1) enable program,
    // (2) accept current AUP version. Both go through in one click.
    mutationFn: async () => {
      await api.put("/bookkeeping/program",
        { enabled: true, mode, contactRequestNote: note });
      if (program?.currentTermsVersion)
        await api.post("/bookkeeping/program/accept-terms",
          { version: program.currentTermsVersion });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookkeeping", "program"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <FolderIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>Μηχανογράφιση από την ομάδα Kalypsis</Typography>
          <Typography variant="body2" color="text.secondary">
            Ξεφορτώστε τη λογιστική εργασία εισαγωγής δεδομένων στην ομάδα μας — εσείς
            δουλεύετε στο πελατολόγιο και τις πωλήσεις.
          </Typography>
        </Box>
      </Stack>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={800} mb={1}>Πώς λειτουργεί</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Επιλέξτε τον τρόπο συνεργασίας. Μπορείτε να αλλάξετε γνώμη οποτεδήποτε ή να
          απενεργοποιήσετε την υπηρεσία εντελώς.
        </Typography>
        {/* Only «files» mode is offered on the tenant surface. The
            «portals»/«hybrid» modes stored credentials for insurance-
            carrier portals — a security + regulatory risk (phishing
            target, GDPR liability). Kept the backend entity + admin
            endpoints intact so any pre-existing rows still work, but
            the tenant can no longer opt-IN to that flow from the UI.
            Any office that legitimately needs it must arrange it
            manually with the Kalypsis Ops team out-of-band. */}
        <Stack spacing={2}>
          <ModeOption title="Ανέβασμα αρχείων"
            selected={mode === "files"} onClick={() => setMode("files")}
            description="Ανεβάζετε στο σύστημα τα παραστατικά (εβδομαδιαία ή μηνιαία)· η ομάδα μας τα ενσωματώνει. Ασφαλής επιλογή — δεν δίνετε ποτέ κωδικούς πρόσβασης εξωτερικών portal σε τρίτους." />
        </Stack>
        <TextField label="Ζητήστε μας να επικοινωνήσουμε (προαιρετικό)"
          value={note} onChange={e => setNote(e.target.value)}
          multiline minRows={3} fullWidth sx={{ mt: 2 }}
          helperText="Όποια προτίμηση θέλετε να ξέρουμε πριν κανονίσουμε την πρώτη συνάντηση — π.χ. προτιμώμενη ώρα, εταιρείες που δουλεύετε κ.λπ." />
        {/* AUP acceptance — required to enable. Checkbox mirrors the
            server-side gate; ενεργοποίηση button stays disabled until
            checked. Full text is available inline via the toggle. */}
        <Paper variant="outlined" sx={{ mt: 3, p: 2, bgcolor: "rgba(240,180,60,0.06)" }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Checkbox size="small" checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)} sx={{ pt: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={700}>
                Έχω διαβάσει και αποδέχομαι την Πολιτική Χρήσης Μηχανογράφισης
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                Δεσμεύομαι ότι δεν θα ανεβάσω υλικό που παραβιάζει πνευματικά δικαιώματα (copyright),
                τη νομοθεσία, ή είναι εκτός σκοπού της υπηρεσίας. Η Kalypsis δεν φέρει ευθύνη για το
                περιεχόμενο που ανεβάζω.
              </Typography>
              <Button size="small" onClick={() => setShowTermsFull(v => !v)} sx={{ mt: 0.5, px: 0 }}>
                {showTermsFull ? "Απόκρυψη κειμένου" : "Πλήρες κείμενο όρων"}
              </Button>
              {showTermsFull && <TermsFullText />}
            </Box>
          </Stack>
        </Paper>
        <Stack direction="row" spacing={2} mt={3}>
          <Button variant="contained" onClick={() => enable.mutate()}
            disabled={enable.isPending || !acceptedTerms}>
            Ενεργοποίηση μηχανογράφισης
          </Button>
        </Stack>
      </Card>

      <Alert severity="info" icon={<HelpOutlineIcon />}>
        Μόλις ενεργοποιήσετε την υπηρεσία, θα σας συστήσουμε συγκεκριμένο άτομο από την
        ομάδα μας ως υπεύθυνο και θα λάβετε ξεχωριστό email με τα βήματα onboarding.
        Έως τότε, μπορείτε να αρχίσετε να ανεβάζετε αρχεία στους προεπιλεγμένους φακέλους.
      </Alert>
    </Container>
  );
}

function ModeOption({ title, description, selected, onClick }: {
  title: string; description: string; selected: boolean; onClick: () => void;
}) {
  return (
    <Paper variant="outlined" onClick={onClick}
      sx={{
        p: 2, cursor: "pointer",
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: selected ? 2 : 1,
        bgcolor: selected ? "rgba(31,123,179,0.04)" : "transparent",
      }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <CheckCircleOutlineIcon color={selected ? "primary" : "disabled"} sx={{ mt: 0.5 }} />
        <Box>
          <Typography fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function WorkspaceScreen({ program, qc, setErr, err }: {
  program: ProgramDto; qc: ReturnType<typeof useQueryClient>;
  setErr: (s: string | null) => void; err: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"files" | "activities">("files");
  const disable = useMutation({
    mutationFn: () => api.put("/bookkeeping/program",
      { enabled: false, mode: program.mode, contactRequestNote: program.contactRequestNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookkeeping", "program"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <FolderIcon color="primary" sx={{ fontSize: 32 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>Μηχανογράφιση</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={program.mode} variant="outlined" />
            {program.onboarded
              ? <Chip size="small" color="success" label={`Onboarded ${program.onboardedAt ? new Date(program.onboardedAt).toLocaleDateString("el-GR") : ""}`} />
              : <Chip size="small" color="warning" label="Onboarding σε εξέλιξη — θα σας συστήσουμε υπεύθυνο σύντομα" />}
          </Stack>
        </Box>
        <Button size="small" color="inherit" onClick={() => {
          if (window.confirm("Απενεργοποίηση της μηχανογράφισης; Τα αρχεία σας παραμένουν στο σύστημα.")) disable.mutate();
        }}>Απενεργοποίηση</Button>
      </Stack>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {/* AUP gate — server refuses uploads until this is accepted, so
          we show it as a prominent inline card AND gate any upload
          button on `termsAccepted`. Not a modal — the tenant may want
          to browse existing files before deciding. */}
      <TermsAcceptanceCard program={program} qc={qc} setErr={setErr} />

      <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 320px)" }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}>
          <Tab value="files" icon={<FolderSpecialIcon fontSize="small" />} iconPosition="start" label="Φάκελοι & αρχεία" />
          <Tab value="activities" icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Ενέργειες Kalypsis" />
        </Tabs>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "files" && <MyFilesTab qc={qc} setErr={setErr}
            termsAccepted={program.termsAcceptedVersion === program.currentTermsVersion} />}
          {activeTab === "activities" && <MyActivitiesTab />}
        </Box>
      </Card>
    </Container>
  );
}

/** Full Acceptable Use Policy text + accept button. Rendered as a
 *  banner above the workspace when the tenant hasn't yet accepted the
 *  current AUP version. The text below is the load-bearing legal
 *  disclaimer — Kalypsis is a passive storage / workflow platform, not
 *  a content curator. Any breach of copyright or law is the tenant's
 *  responsibility. Backend enforces the same gate — this UI just makes
 *  the policy visible before the tenant is turned away by a 428. */
function TermsAcceptanceCard({ program, qc, setErr }: {
  program: ProgramDto; qc: ReturnType<typeof useQueryClient>;
  setErr: (s: string | null) => void;
}) {
  const accepted = program.termsAcceptedVersion === program.currentTermsVersion;
  const [showFull, setShowFull] = useState(false);
  const accept = useMutation({
    mutationFn: () => api.post("/bookkeeping/program/accept-terms",
      { version: program.currentTermsVersion }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookkeeping", "program"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  if (accepted) return null;
  return (
    <Alert severity="warning" icon={<HelpOutlineIcon />} sx={{ mb: 2 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => setShowFull(v => !v)}>
            {showFull ? "Απόκρυψη κειμένου" : "Εμφάνιση πλήρους κειμένου"}
          </Button>
          <Button size="small" variant="contained" onClick={() => accept.mutate()}>
            Αποδοχή & ενεργοποίηση upload
          </Button>
        </Stack>
      }>
      <Typography fontWeight={800}>Πολιτική Χρήσης Μηχανογράφισης — απαιτείται αποδοχή πριν το upload</Typography>
      {!showFull && (
        <Typography variant="body2">
          Ανεβάζοντας αρχεία στη μηχανογράφιση δεσμεύεστε ότι έχετε τα δικαιώματα χρήσης τους,
          δεν παραβιάζουν πνευματική ιδιοκτησία τρίτων και δεν είναι απαγορευμένα από τη νομοθεσία.
          Πατήστε «Εμφάνιση πλήρους κειμένου» για τους πλήρεις όρους.
        </Typography>
      )}
      {showFull && <TermsFullText />}
    </Alert>
  );
}

/** The full AUP body — kept as a component so both the acceptance
 *  banner and any «διαβάστε τους όρους» footer link render the same
 *  copy. Version-tagged so legal updates are traceable. */
function TermsFullText() {
  return (
    <Box sx={{ mt: 1, fontSize: 13, lineHeight: 1.7 }}>
      <Typography variant="subtitle2" fontWeight={800} mt={1}>1. Πεδίο εφαρμογής</Typography>
      Η υπηρεσία «Μηχανογράφιση» της Kalypsis σας παρέχει αποθηκευτικό χώρο και εργαλεία
      συνεργασίας με την ομάδα μας για δεδομένα του ασφαλιστικού γραφείου σας
      (παραστατικά, εκθέσεις, βιβλία κ.λπ.). Η Kalypsis λειτουργεί ως πάροχος υποδομής
      και επεξεργαστής δεδομένων — δεν παρακολουθεί, αξιολογεί ή εγκρίνει το περιεχόμενο των αρχείων.

      <Typography variant="subtitle2" fontWeight={800} mt={2}>2. Δηλώσεις & εγγυήσεις χρήστη</Typography>
      Ανεβάζοντας οποιοδήποτε αρχείο ή δημιουργώντας φακέλους δηλώνετε ρητά ότι:
      <ul>
        <li>Έχετε τα νόμιμα δικαιώματα ή σχετική άδεια για κάθε αρχείο που ανεβάζετε.</li>
        <li>Δεν θα ανεβάσετε υλικό που παραβιάζει πνευματικά δικαιώματα (copyright), εμπορικά σήματα ή άλλα δικαιώματα διανοητικής ιδιοκτησίας τρίτων.</li>
        <li>Δεν θα ανεβάσετε περιεχόμενο που είναι απαγορευμένο από το ελληνικό ή ευρωπαϊκό δίκαιο (μεταξύ άλλων: απάτη, παιδικό υλικό, δεδομένα υγείας τρίτων χωρίς συγκατάθεση, malware, spam).</li>
        <li>Δεν θα ανεβάσετε αρχεία εκτός σκοπού της υπηρεσίας (μηχανογράφιση ασφαλιστικού γραφείου) — π.χ. πολυμεσικό υλικό ψυχαγωγίας, personal cloud storage κ.λπ.</li>
        <li>Για τυχόν δεδομένα προσωπικού χαρακτήρα (πελατών, εργαζομένων) έχετε νόμιμη βάση επεξεργασίας κατά GDPR και θα ενημερώσετε τα υποκείμενα όπου απαιτείται.</li>
      </ul>

      <Typography variant="subtitle2" fontWeight={800} mt={2}>3. Ευθύνη</Typography>
      Η Kalypsis <b>δεν φέρει καμία ευθύνη</b> για το περιεχόμενο των αρχείων που ανεβάζετε.
      Οποιαδήποτε νομική αξίωση από τρίτους (πνευματικά δικαιώματα, GDPR, ποινική νομοθεσία)
      καλύπτεται αποκλειστικά από εσάς, ως χρήστη που ανέβασε ή δημιούργησε το περιεχόμενο.
      Δεσμεύεστε να αποζημιώσετε την Kalypsis για κάθε ζημία, πρόστιμο ή δικαστικό κόστος
      που ενδεχομένως προκύψει από παραβίαση των παραπάνω όρων.

      <Typography variant="subtitle2" fontWeight={800} mt={2}>4. Δικαίωμα αφαίρεσης</Typography>
      Η Kalypsis διατηρεί το δικαίωμα να αφαιρέσει άμεσα, χωρίς προηγούμενη ειδοποίηση,
      περιεχόμενο που πιστεύει καλόπιστα ότι παραβιάζει τους παρόντες όρους, τη νομοθεσία,
      ή τα δικαιώματα τρίτων — καθώς και να αναστείλει τον λογαριασμό σας σε περίπτωση
      επαναλαμβανόμενων παραβάσεων.

      <Typography variant="subtitle2" fontWeight={800} mt={2}>5. Ασφάλεια αποθήκευσης</Typography>
      Τα αρχεία σας κρυπτογραφούνται εν αναπαύσει (AES-256-GCM) με κλειδί που ζει
      στο περιβάλλον διακομιστή (Coolify env var, όχι στη βάση). Ένα σκέτο leak του
      MySQL dump δεν αρκεί για ανάγνωση των αρχείων ή των ονομάτων φακέλων/αρχείων.

      <Typography variant="subtitle2" fontWeight={800} mt={2}>6. Νομοθεσία</Typography>
      Οι παρόντες όροι διέπονται από το ελληνικό δίκαιο. Αρμόδια δικαστήρια:
      Αθηνών.

      <Typography variant="caption" component="div" color="text.secondary" mt={2}>
        Έκδοση όρων: {/* stays in sync with backend CurrentTermsVersion */}<b>2026-08-26.v1</b>
      </Typography>
    </Box>
  );
}

function MyFilesTab({ qc, setErr, termsAccepted }: {
  qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
  termsAccepted: boolean;
}) {
  const tree = useQuery({
    queryKey: ["bookkeeping", "tree"],
    queryFn: async () => (await api.get<TreeResp>("/bookkeeping/tree")).data,
    // Stabilise: don't refetch on every window-focus (opening the OS
    // file picker briefly loses focus and used to cause a visible
    // tree re-render / flicker as the user clicked «Ανέβασμα»).
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Search + filter state ───────────────────────────────────────
  // `search` filters BOTH folders (by name, transitively — matched
  // folders + their ancestors + their descendants stay visible) AND
  // files (by name). `statusFilter` / `uploaderFilter` further scope
  // the file list. All in-memory over the /tree response; no round
  // trips per keystroke.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processed" | "rejected">("all");
  const [uploaderFilter, setUploaderFilter] = useState<"all" | "tenant" | "admin">("all");
  const [showAllMatchingFiles, setShowAllMatchingFiles] = useState(false);

  // ── Folder CRUD dialogs ─────────────────────────────────────────
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<FolderDto | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const createFolder = useMutation({
    mutationFn: async () => api.post("/bookkeeping/folders",
      { parentFolderId: newFolderParentId, name: newFolderName.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookkeeping", "tree"] });
      setNewFolderOpen(false); setNewFolderName("");
    },
    onError: e => setErr(extractErrorMessage(e)),
  });
  const renameFolderMut = useMutation({
    mutationFn: async () => api.put(`/bookkeeping/folders/${renamingFolder!.id}`,
      { name: renameValue.trim(), displayOrder: renamingFolder!.displayOrder }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookkeeping", "tree"] });
      setRenamingFolder(null); setRenameValue("");
    },
    onError: e => setErr(extractErrorMessage(e)),
  });
  const deleteFolder = useMutation({
    mutationFn: async (id: string) => api.delete(`/bookkeeping/folders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookkeeping", "tree"] });
      if (selectedFolderId && tree.data?.folders.every(f => f.id !== selectedFolderId))
        setSelectedFolderId(null);
    },
    onError: e => setErr(extractErrorMessage(e)),
  });

  // Drag-and-drop reparenting. moveFolder posts to the tenant-side
  // /folders/{id}/move endpoint which cycle-guards + tenant-isolates.
  // Drag source = a folder in the tree; drop target = another folder
  // (nest under it) OR the tree background (promote to root).
  const moveFolder = useMutation({
    mutationFn: async (p: { id: string; newParentId: string | null }) =>
      api.patch(`/bookkeeping/folders/${p.id}/move`,
        { newParentFolderId: p.newParentId, newDisplayOrder: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookkeeping", "tree"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);

  // File drag-and-drop: pick up a file row and drop onto a folder to
  // move it. Distinct from folder DnD by drag-type ("file" vs
  // "folder") — the tree row's drop handler branches on that so a
  // stray file drop can't accidentally reparent a folder.
  const moveFiles = useMutation({
    mutationFn: async (p: { ids: string[]; targetFolderId: string }) =>
      api.post("/bookkeeping/files/move",
        { fileIds: p.ids, targetFolderId: p.targetFolderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookkeeping", "tree"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);

  /** Returns true if `descendantId` is inside the subtree rooted at
   *  `ancestorId`. Used to disable drop targets that would create a
   *  cycle — matches the server-side guard so we don't send doomed
   *  requests and flash red errors. */
  const isDescendantOf = useCallback((descendantId: string, ancestorId: string) => {
    const byId = new Map((tree.data?.folders ?? []).map(f => [f.id, f]));
    let cur = byId.get(descendantId);
    while (cur?.parentFolderId) {
      if (cur.parentFolderId === ancestorId) return true;
      cur = byId.get(cur.parentFolderId);
    }
    return false;
  }, [tree.data]);

  useEffect(() => {
    const roots = tree.data?.folders.filter(f => !f.parentFolderId) ?? [];
    if (!selectedFolderId && roots.length > 0) setSelectedFolderId(roots[0].id);
  }, [tree.data, selectedFolderId]);

  // ── Filter passes ─────────────────────────────────────────────
  const folders = tree.data?.folders ?? [];
  const allFiles = tree.data?.files ?? [];
  const q = search.trim().toLowerCase();

  // Folders that should stay visible in the tree:
  //   • Empty search → all folders visible.
  //   • Non-empty search → folders whose name matches, PLUS every
  //     ancestor of a match (so the match is reachable in the tree)
  //     PLUS folders that CONTAIN a matching file (so users can find
  //     invoices by name even when the folder name doesn't match).
  const visibleFolderIds = useMemo(() => {
    if (!q) return null;   // null = «all visible»
    const byId = new Map(folders.map(f => [f.id, f]));
    const matches = new Set<string>();
    for (const f of folders) if (f.name.toLowerCase().includes(q)) matches.add(f.id);
    for (const file of allFiles)
      if (file.fileName.toLowerCase().includes(q)) matches.add(file.folderId);
    // Walk up ancestors so tree still branches down to each match.
    const visible = new Set(matches);
    for (const id of matches) {
      let cur = byId.get(id);
      while (cur?.parentFolderId) {
        visible.add(cur.parentFolderId);
        cur = byId.get(cur.parentFolderId);
      }
    }
    return visible;
  }, [q, folders, allFiles]);

  const filesToShow = useMemo(() => {
    let list = allFiles;
    if (showAllMatchingFiles && q) {
      // Cross-folder search: ignore the selected folder, show every
      // matching file. Useful for «where did I put that invoice?».
      list = list.filter(f => f.fileName.toLowerCase().includes(q));
    } else {
      list = list.filter(f => f.folderId === selectedFolderId);
      if (q) list = list.filter(f => f.fileName.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter(f => f.status === statusFilter);
    if (uploaderFilter !== "all") list = list.filter(f => f.uploadedBy === uploaderFilter);
    return list;
  }, [allFiles, selectedFolderId, q, showAllMatchingFiles, statusFilter, uploaderFilter]);

  // Client-side pre-flight so the user gets a fast, specific reason
  // when the upload can't proceed — no more silent-nothing-happens.
  // Returns null if OK, else a human-readable Greek message that we
  // stuff into `setErr` and show at the top of the panel.
  const uploadBlockedReason = useMemo(() => {
    if (!termsAccepted) return "Πρέπει πρώτα να αποδεχτείτε την Πολιτική Χρήσης (κίτρινο πλαίσιο στην κορυφή) πριν το upload.";
    if ((tree.data?.folders.length ?? 0) === 0) return "Δεν υπάρχει κανένας φάκελος. Δημιουργήστε φάκελο από το «+» πάνω αριστερά.";
    if (!selectedFolderId) return "Επιλέξτε πρώτα φάκελο από τη λίστα αριστερά.";
    return null;
  }, [termsAccepted, tree.data, selectedFolderId]);

  const uploadFile = useCallback(async (file: File) => {
    if (uploadBlockedReason) { setErr(uploadBlockedReason); return; }
    if (!selectedFolderId) return;
    // 16 MB cap enforced server-side; catch it early so the user
    // doesn't wait for an upload that will 400.
    if (file.size > 16 * 1024 * 1024) {
      setErr(`Το αρχείο «${file.name}» ξεπερνά τα 16 MB. Παρακαλώ σπάστε το ή συμπιέστε το.`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folderId", selectedFolderId);
      await api.post("/bookkeeping/files", form, { headers: { "Content-Type": "multipart/form-data" } });
      qc.invalidateQueries({ queryKey: ["bookkeeping", "tree"] });
    } catch (e) { setErr(extractErrorMessage(e)); } finally { setUploading(false); }
  }, [selectedFolderId, qc, setErr, uploadBlockedReason]);

  // Visual drop-zone highlight — true while the user is dragging OS
  // files over the file panel. Different from `draggingFileId` which
  // is for internal file rearranging.
  const [isOsFileDragOver, setIsOsFileDragOver] = useState(false);

  if (tree.isLoading) return <Box sx={{ p: 3 }}><CircularProgress size={20} /></Box>;

  const emptyState = (tree.data?.folders.length ?? 0) === 0;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "300px 1fr" }, height: "100%", minHeight: 0 }}>
      {/* ── Left column: folder tree + folder CRUD ─────────────── */}
      <Box sx={{ borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1, pl: 0.5 }}>Φάκελοι</Typography>
          <Tooltip title="Νέος φάκελος στη ρίζα">
            <IconButton size="small" onClick={() => {
              setNewFolderParentId(null); setNewFolderName(""); setNewFolderOpen(true);
            }}><CreateNewFolderIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
        {emptyState ? (
          <Alert severity="info" sx={{ m: 1.5 }}>
            Δεν υπάρχουν φάκελοι ακόμη. Πατήστε το «+» για να φτιάξετε τον πρώτο σας.
          </Alert>
        ) : (
          <List dense sx={{ flex: 1, overflowY: "auto" }}
            // Root-level drop target — dragging a folder onto empty space
            // in the tree list promotes it to a root folder. The stopPropagation
            // in the inner rows keeps a drop on a folder row from also
            // hitting this handler.
            onDragOver={e => {
              if (draggingFolderId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
            }}
            onDrop={e => {
              if (!draggingFolderId) return;
              e.preventDefault();
              const dragged = folders.find(f => f.id === draggingFolderId);
              if (dragged && dragged.parentFolderId !== null)
                moveFolder.mutate({ id: draggingFolderId, newParentId: null });
              setDraggingFolderId(null);
            }}>
            <TenantTreeNode folders={folders} parentId={null} depth={0}
              selectedId={selectedFolderId} onSelect={setSelectedFolderId}
              visibleFolderIds={visibleFolderIds}
              draggingFolderId={draggingFolderId}
              draggingFileId={draggingFileId}
              onDragStart={setDraggingFolderId}
              onDragEnd={() => setDraggingFolderId(null)}
              onDropOnFolder={(sourceId, targetId) => {
                if (sourceId === targetId) return;
                if (isDescendantOf(targetId, sourceId)) return;   // cycle guard
                const src = folders.find(f => f.id === sourceId);
                if (src?.parentFolderId === targetId) return;      // already there
                moveFolder.mutate({ id: sourceId, newParentId: targetId });
              }}
              onDropFileOnFolder={(fileId, targetFolderId) => {
                const file = allFiles.find(f => f.id === fileId);
                if (!file || file.folderId === targetFolderId) return;   // already there
                moveFiles.mutate({ ids: [fileId], targetFolderId });
              }}
              isDescendantOf={isDescendantOf}
              onNewSubfolder={pid => {
                setNewFolderParentId(pid); setNewFolderName(""); setNewFolderOpen(true);
              }}
              onRename={f => { setRenamingFolder(f); setRenameValue(f.name); }}
              onDelete={id => {
                if (window.confirm("Διαγραφή φακέλου; Ο φάκελος πρέπει να είναι ΚΕΝΟΣ."))
                  deleteFolder.mutate(id);
              }} />
          </List>
        )}
        {draggingFolderId && (
          <Typography variant="caption" sx={{ p: 1, color: "text.secondary", fontStyle: "italic" }}>
            Αφήστε πάνω σε φάκελο για nesting, ή σε κενή περιοχή για ρίζα.
          </Typography>
        )}
        {draggingFileId && (
          <Typography variant="caption" sx={{ p: 1, color: "text.secondary", fontStyle: "italic" }}>
            Αφήστε το αρχείο πάνω σε φάκελο για μεταφορά.
          </Typography>
        )}
      </Box>

      {/* ── Right column: files + filters + upload ─────────────── */}
      <Box sx={{
        display: "flex", flexDirection: "column", minHeight: 0,
        // Blue tint + dashed outline while an OS file is being dragged
        // over — the user can now SEE that the panel is ready to accept
        // the drop, instead of guessing.
        outline: isOsFileDragOver ? "3px dashed" : undefined,
        outlineColor: isOsFileDragOver ? "primary.main" : undefined,
        outlineOffset: -3,
        bgcolor: isOsFileDragOver ? "rgba(31, 123, 179, 0.06)" : undefined,
        transition: "background-color 0.1s",
      }}
        onDragOver={e => {
          const isOsUpload = e.dataTransfer.types.includes("Files")
            && !e.dataTransfer.types.includes("text/kalypsis-file");
          if (!isOsUpload) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!isOsFileDragOver) setIsOsFileDragOver(true);
        }}
        onDragLeave={e => {
          // Only clear when we actually leave the whole panel — dragleave
          // fires on every child boundary crossing otherwise (annoying flicker).
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsOsFileDragOver(false);
        }}
        onDrop={e => {
          const isOsUpload = e.dataTransfer.types.includes("Files")
            && !e.dataTransfer.types.includes("text/kalypsis-file");
          if (!isOsUpload) return;
          e.preventDefault();
          setIsOsFileDragOver(false);
          // Let uploadFile() surface any blocked reason via setErr —
          // we no longer silently drop the file on the floor.
          for (const f of Array.from(e.dataTransfer.files ?? [])) void uploadFile(f);
        }}>
        {/* Search + filter row */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
          sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <TextField size="small" placeholder="Αναζήτηση φακέλων/αρχείων…"
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />,
              endAdornment: search
                ? <IconButton size="small" onClick={() => setSearch("")}><CloseIcon fontSize="small" /></IconButton>
                : undefined,
            }}
            sx={{ flex: 1, maxWidth: { md: 360 } }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Κατάσταση</InputLabel>
            <Select label="Κατάσταση" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
              <MenuItem value="all">Όλες</MenuItem>
              <MenuItem value="pending">Σε αναμονή</MenuItem>
              <MenuItem value="processed">Επεξεργασμένα</MenuItem>
              <MenuItem value="rejected">Απορριφθέντα</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Ανέβασε</InputLabel>
            <Select label="Ανέβασε" value={uploaderFilter}
              onChange={e => setUploaderFilter(e.target.value as typeof uploaderFilter)}>
              <MenuItem value="all">Όλοι</MenuItem>
              <MenuItem value="tenant">Το γραφείο</MenuItem>
              <MenuItem value="admin">Kalypsis</MenuItem>
            </Select>
          </FormControl>
          {q && (
            <FormControlLabel sx={{ ml: 0 }}
              control={<Switch size="small" checked={showAllMatchingFiles}
                onChange={e => setShowAllMatchingFiles(e.target.checked)} />}
              label={<Typography variant="caption">Σε όλους τους φακέλους</Typography>} />
          )}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
            Αρχεία {filesToShow.length > 0 && `(${filesToShow.length}${q || statusFilter !== "all" || uploaderFilter !== "all" ? " εμφανίζονται" : ""})`}
          </Typography>
          {/* Upload button is ALWAYS clickable when nothing is currently
              in-flight — if a pre-flight blocker exists (no folder, no
              terms accepted, no folders at all) the click surfaces
              the reason via setErr instead of silently doing nothing.
              Previous behaviour disabled the button which left users
              staring at a greyed-out control with no feedback. */}
          <Tooltip title={uploadBlockedReason
            ? `Πατήστε για εξήγηση: ${uploadBlockedReason.slice(0, 60)}…`
            : "Ανέβασμα αρχείου (max 16 MB)"}>
            {uploadBlockedReason ? (
              <Button size="small" variant="outlined" color="warning" startIcon={<UploadFileIcon />}
                onClick={() => setErr(uploadBlockedReason)}>
                Ανέβασμα (μπλοκαρισμένο)
              </Button>
            ) : (
              <Button size="small" variant="contained" startIcon={<UploadFileIcon />} component="label"
                disabled={uploading}>
                Ανέβασμα
                <input type="file" hidden multiple onChange={async e => {
                  for (const f of Array.from(e.target.files ?? [])) await uploadFile(f);
                  e.target.value = "";
                }} />
              </Button>
            )}
          </Tooltip>
        </Stack>
        {uploading && <LinearProgress />}
        {emptyState ? (
          <Alert severity="info" sx={{ m: 3 }}>
            Δεν έχετε φακέλους ακόμη. Δημιουργήστε τον πρώτο σας από το «+» πάνω αριστερά.
          </Alert>
        ) : !selectedFolderId && !showAllMatchingFiles ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>Επιλέξτε φάκελο.</Box>
        ) : filesToShow.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            {q || statusFilter !== "all" || uploaderFilter !== "all"
              ? "Δεν βρέθηκαν αρχεία με τα τρέχοντα φίλτρα."
              : "Δεν υπάρχουν αρχεία εδώ ακόμη. Σύρετε αρχεία ή πατήστε «Ανέβασμα»."}
          </Box>
        ) : (
          <List dense sx={{ flex: 1, overflowY: "auto" }}>
            {filesToShow.map(f => {
              const folderName = folders.find(x => x.id === f.folderId)?.name;
              return (
                <ListItem key={f.id} divider
                  // File row is draggable → the tree-side rows accept it as a
                  // drop target and fire the /files/move endpoint. Setting
                  // a custom mime type ("text/kalypsis-file") lets the upload
                  // drop-zone tell "this is an internal move" apart from
                  // "OS file being uploaded" without a global drag state.
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/kalypsis-file", f.id);
                    setDraggingFileId(f.id);
                  }}
                  onDragEnd={() => setDraggingFileId(null)}
                  sx={{
                    cursor: "grab",
                    opacity: draggingFileId === f.id ? 0.45 : 1,
                    "&:active": { cursor: "grabbing" },
                  }}
                  secondaryAction={
                  <Tooltip title="Λήψη">
                    <IconButton size="small" onClick={async () => {
                      const res = await api.get<Blob>(`/bookkeeping/files/${f.id}`, { responseType: "blob" });
                      const url = window.URL.createObjectURL(res.data);
                      const el = document.createElement("a"); el.href = url; el.download = f.fileName; el.click();
                      window.URL.revokeObjectURL(url);
                    }}><DownloadIcon fontSize="small" /></IconButton>
                  </Tooltip>
                }>
                  <ListItemText
                    primary={<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" fontWeight={600}>
                        {highlightMatch(f.fileName, q)}
                      </Typography>
                      <Chip size="small" label={f.uploadedBy === "admin" ? "από Kalypsis" : "δικό μου"}
                        color={f.uploadedBy === "admin" ? "primary" : "default"}
                        variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      <Chip size="small" label={f.status}
                        color={f.status === "processed" ? "success" : f.status === "rejected" ? "error" : "warning"}
                        sx={{ height: 18, fontSize: 10 }} />
                      {showAllMatchingFiles && folderName && (
                        <Chip size="small" icon={<FolderIcon sx={{ fontSize: 12 }} />}
                          label={folderName} variant="outlined"
                          onClick={() => { setShowAllMatchingFiles(false); setSelectedFolderId(f.folderId); }}
                          sx={{ height: 18, fontSize: 10 }} />
                      )}
                    </Stack>}
                    secondary={`${formatBytes(f.sizeBytes)} · ${new Date(f.createdAt).toLocaleString("el-GR")}`}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* ── Folder dialogs ─────────────────────────────────────── */}
      <Dialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          {newFolderParentId ? "Νέος υποφάκελος" : "Νέος φάκελος (ρίζα)"}
        </DialogTitle>
        <DialogContent>
          {newFolderParentId && (
            <Typography variant="caption" color="text.secondary" mb={1} component="div">
              Μέσα στον φάκελο: <b>{folders.find(f => f.id === newFolderParentId)?.name ?? "—"}</b>
            </Typography>
          )}
          <TextField autoFocus fullWidth label="Όνομα φακέλου"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newFolderName.trim()) createFolder.mutate(); }}
            sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderOpen(false)}>Άκυρο</Button>
          <Button variant="contained" onClick={() => createFolder.mutate()}
            disabled={!newFolderName.trim() || createFolder.isPending}>
            Δημιουργία
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!renamingFolder} onClose={() => setRenamingFolder(null)} fullWidth maxWidth="xs">
        <DialogTitle>Μετονομασία φακέλου</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Νέο όνομα"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && renameValue.trim()) renameFolderMut.mutate(); }}
            sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenamingFolder(null)}>Άκυρο</Button>
          <Button variant="contained" onClick={() => renameFolderMut.mutate()}
            disabled={!renameValue.trim() || renameFolderMut.isPending}>
            Αποθήκευση
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Wraps every occurrence of `query` in a highlight span. Case-insensitive.
 *  Returns the original string as a React fragment when query is empty. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Box component="mark" sx={{ bgcolor: "rgba(255, 213, 0, 0.4)", px: 0.25 }}>
        {text.slice(idx, idx + query.length)}
      </Box>
      {text.slice(idx + query.length)}
    </>
  );
}

function TenantTreeNode({ folders, parentId, depth, selectedId, onSelect,
  visibleFolderIds, draggingFolderId, draggingFileId,
  onDragStart, onDragEnd, onDropOnFolder, onDropFileOnFolder,
  isDescendantOf, onNewSubfolder, onRename, onDelete }: {
  folders: FolderDto[]; parentId: string | null; depth: number;
  selectedId: string | null; onSelect: (id: string) => void;
  visibleFolderIds: Set<string> | null;
  draggingFolderId: string | null;
  draggingFileId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOnFolder: (sourceId: string, targetId: string) => void;
  onDropFileOnFolder: (fileId: string, targetFolderId: string) => void;
  isDescendantOf: (descendantId: string, ancestorId: string) => boolean;
  onNewSubfolder: (parentId: string) => void;
  onRename: (folder: FolderDto) => void;
  onDelete: (folderId: string) => void;
}) {
  const children = folders
    .filter(f => (f.parentFolderId ?? null) === parentId)
    .filter(f => !visibleFolderIds || visibleFolderIds.has(f.id))
    .sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name, "el"));
  return (
    <>
      {children.map(f => (
        <TenantTreeRow key={f.id} folder={f} depth={depth}
          folders={folders} selectedId={selectedId} onSelect={onSelect}
          visibleFolderIds={visibleFolderIds}
          draggingFolderId={draggingFolderId} draggingFileId={draggingFileId}
          onDragStart={onDragStart} onDragEnd={onDragEnd}
          onDropOnFolder={onDropOnFolder} onDropFileOnFolder={onDropFileOnFolder}
          isDescendantOf={isDescendantOf}
          onNewSubfolder={onNewSubfolder} onRename={onRename} onDelete={onDelete} />
      ))}
    </>
  );
}

/** One folder row + a lazy inline action menu (subfolder / rename /
 *  delete). Kept as its own component so hover state stays local — a
 *  hover on one row doesn't re-render the whole tree. Recurses into
 *  its own <TenantTreeNode> for children so nesting works.
 *
 *  Also owns the row-level drag-and-drop UI:
 *    • draggable="true" — the whole row can be picked up
 *    • dragover shows an "about to drop here" outline when the drop
 *      would land on a valid target (not self, not a descendant)
 *    • drop calls the parent's onDropOnFolder which fires the move mutation */
function TenantTreeRow({ folder, depth, folders, selectedId, onSelect,
  visibleFolderIds, draggingFolderId, draggingFileId,
  onDragStart, onDragEnd, onDropOnFolder, onDropFileOnFolder,
  isDescendantOf, onNewSubfolder, onRename, onDelete }: {
  folder: FolderDto; depth: number; folders: FolderDto[];
  selectedId: string | null; onSelect: (id: string) => void;
  visibleFolderIds: Set<string> | null;
  draggingFolderId: string | null;
  draggingFileId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOnFolder: (sourceId: string, targetId: string) => void;
  onDropFileOnFolder: (fileId: string, targetFolderId: string) => void;
  isDescendantOf: (descendantId: string, ancestorId: string) => boolean;
  onNewSubfolder: (parentId: string) => void;
  onRename: (folder: FolderDto) => void;
  onDelete: (folderId: string) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isDropOver, setIsDropOver] = useState(false);
  const isSystem = folder.origin === "system";
  // Is THIS row a valid drop target for whatever is being dragged?
  //   • Folder drag: reject self + descendants (cycle) — matches server guard.
  //   • File drag: any folder is valid target, including THIS one if the
  //     file lives elsewhere (the onDropFileOnFolder handler skips the
  //     no-op case where the file is already here).
  const acceptsFolderDrop = draggingFolderId !== null
    && draggingFolderId !== folder.id
    && !isDescendantOf(folder.id, draggingFolderId);
  const acceptsFileDrop = draggingFileId !== null;
  const acceptsDrop = acceptsFolderDrop || acceptsFileDrop;
  return (
    <Box>
      <ListItemButton selected={folder.id === selectedId} onClick={() => onSelect(folder.id)}
        draggable={!isSystem}
        onDragStart={e => {
          if (isSystem) { e.preventDefault(); return; }
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", folder.id);   // Firefox needs a payload
          onDragStart(folder.id);
        }}
        onDragEnd={() => { onDragEnd(); setIsDropOver(false); }}
        onDragOver={e => {
          if (!acceptsDrop) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          setIsDropOver(true);
        }}
        onDragLeave={() => setIsDropOver(false)}
        onDrop={e => {
          if (!acceptsDrop) return;
          e.preventDefault();
          e.stopPropagation();
          setIsDropOver(false);
          // Route by drag payload type. File drags carry
          // "text/kalypsis-file" (set by the file row's dragStart);
          // folder drags rely on the parent-owned draggingFolderId.
          const fileId = e.dataTransfer.getData("text/kalypsis-file");
          if (fileId) {
            onDropFileOnFolder(fileId, folder.id);
          } else if (draggingFolderId) {
            onDropOnFolder(draggingFolderId, folder.id);
          }
        }}
        sx={{
          pl: 1 + depth * 2, pr: 1,
          opacity: draggingFolderId === folder.id ? 0.45 : 1,
          // Highlight when this row is a live drop target — matches
          // primary color at 12% so it reads as "you're dropping here"
          // without competing with the row-selected background.
          bgcolor: isDropOver && acceptsDrop ? "rgba(31, 123, 179, 0.16)" : undefined,
          outline: isDropOver && acceptsDrop ? "2px dashed" : undefined,
          outlineColor: isDropOver && acceptsDrop ? "primary.main" : undefined,
          outlineOffset: -2,
          // Kebab dims to 0.35 instead of fully hidden — makes the row
          // feel stable (no fade-in on every hover) but still keeps the
          // action button visually secondary to the folder name.
          "& .row-actions": { opacity: 0.35 },
          "&:hover .row-actions, &.Mui-selected .row-actions": { opacity: 1 },
        }}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {folder.id === selectedId ? <FolderSpecialIcon fontSize="small" color="primary" /> : <FolderIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText
          primary={<Typography variant="body2" noWrap>{folder.name}</Typography>}
          secondary={folder.fileCount > 0 ? `${folder.fileCount} αρχεία` : undefined} />
        <Box className="row-actions">
          <IconButton size="small" edge="end"
            onClick={e => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      </ListItemButton>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        onClick={e => e.stopPropagation()}>
        <MenuItem onClick={() => { onNewSubfolder(folder.id); setMenuAnchor(null); }}>
          <ListItemIcon><CreateNewFolderIcon fontSize="small" /></ListItemIcon>
          Νέος υποφάκελος
        </MenuItem>
        {/* System folders (seeded by Kalypsis onboarding) can't be
            renamed/deleted from the tenant side — protects the shared
            taxonomy the Ops team relies on. */}
        <MenuItem disabled={isSystem}
          onClick={() => { onRename(folder); setMenuAnchor(null); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Μετονομασία
        </MenuItem>
        <MenuItem disabled={isSystem}
          onClick={() => { onDelete(folder.id); setMenuAnchor(null); }}
          sx={{ color: "error.main" }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Διαγραφή
        </MenuItem>
      </Menu>
      <TenantTreeNode folders={folders} parentId={folder.id} depth={depth + 1}
        selectedId={selectedId} onSelect={onSelect}
        visibleFolderIds={visibleFolderIds}
        draggingFolderId={draggingFolderId} draggingFileId={draggingFileId}
        onDragStart={onDragStart} onDragEnd={onDragEnd}
        onDropOnFolder={onDropOnFolder} onDropFileOnFolder={onDropFileOnFolder}
        isDescendantOf={isDescendantOf}
        onNewSubfolder={onNewSubfolder} onRename={onRename} onDelete={onDelete} />
    </Box>
  );
}

function MyActivitiesTab() {
  const list = useQuery({
    queryKey: ["bookkeeping", "activities"],
    queryFn: async () => (await api.get<ActivityDto[]>("/bookkeeping/activities")).data,
  });
  return (
    <Box sx={{ p: 2, overflowY: "auto", height: "100%" }}>
      <Typography variant="subtitle2" fontWeight={800} mb={1}>Τι έχει κάνει η ομάδα Kalypsis</Typography>
      {list.isLoading && <CircularProgress size={20} />}
      {list.data?.length === 0 && <Typography color="text.secondary">Καμία ενέργεια ακόμη.</Typography>}
      <Stack spacing={1.5}>
        {list.data?.map(a => (
          <Paper key={a.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <Typography variant="body2" fontWeight={700}>{a.title}</Typography>
              {a.category && <Chip size="small" label={a.category} variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {new Date(a.createdAt).toLocaleString("el-GR")}
              </Typography>
            </Stack>
            {a.body && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{a.body}</Typography>}
            <Typography variant="caption" color="text.secondary">από {a.authorDisplay}</Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
