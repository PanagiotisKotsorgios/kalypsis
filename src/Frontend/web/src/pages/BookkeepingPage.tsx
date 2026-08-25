import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Container,
  IconButton, LinearProgress, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Paper,
  Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FolderIcon from "@mui/icons-material/Folder";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
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
  onboarded: boolean; onboardedAt: string | null; createdAt: string | null; }
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
  const [mode, setMode] = useState(program?.mode ?? "files");
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.put("/bookkeeping/program",
      { enabled, mode, contactRequestNote: note }),
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
        <Stack spacing={2}>
          <ModeOption title="Ανέβασμα αρχείων"
            selected={mode === "files"} onClick={() => setMode("files")}
            description="Ανεβάζετε στο σύστημα τα παραστατικά (εβδομαδιαία ή μηνιαία)· η ομάδα μας τα ενσωματώνει. Δεν χρειάζεται να δίνετε κωδικούς πρόσβασης εξωτερικών portal." />
          <ModeOption title="Έλεγχος portal ασφαλιστικών από εμάς"
            selected={mode === "portals"} onClick={() => setMode("portals")}
            description="Μας δίνετε τα κωδικά σας για τα portal των ασφαλιστικών εταιρειών· εμείς κατεβάζουμε αναλυτικά προμηθειών κ.λπ. Οι κωδικοί αποθηκεύονται κρυπτογραφημένοι και είναι ορατοί μόνο σε Platform Admin." />
          <ModeOption title="Μικτό"
            selected={mode === "hybrid"} onClick={() => setMode("hybrid")}
            description="Συνδυασμός των παραπάνω — εσείς ανεβάζετε ορισμένα, εμείς κατεβάζουμε τα υπόλοιπα." />
        </Stack>
        <TextField label="Ζητήστε μας να επικοινωνήσουμε (προαιρετικό)"
          value={note} onChange={e => setNote(e.target.value)}
          multiline minRows={3} fullWidth sx={{ mt: 2 }}
          helperText="Όποια προτίμηση θέλετε να ξέρουμε πριν κανονίσουμε την πρώτη συνάντηση — π.χ. προτιμώμενη ώρα, εταιρείες που δουλεύετε κ.λπ." />
        <Stack direction="row" spacing={2} mt={3}>
          <Button variant="contained" onClick={() => toggle.mutate(true)} disabled={toggle.isPending}>
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

      <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 260px)" }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}>
          <Tab value="files" icon={<FolderSpecialIcon fontSize="small" />} iconPosition="start" label="Φάκελοι & αρχεία" />
          <Tab value="activities" icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Ενέργειες Kalypsis" />
        </Tabs>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "files" && <MyFilesTab qc={qc} setErr={setErr} />}
          {activeTab === "activities" && <MyActivitiesTab />}
        </Box>
      </Card>
    </Container>
  );
}

function MyFilesTab({ qc, setErr }: {
  qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
}) {
  const tree = useQuery({
    queryKey: ["bookkeeping", "tree"],
    queryFn: async () => (await api.get<TreeResp>("/bookkeeping/tree")).data,
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    const roots = tree.data?.folders.filter(f => !f.parentFolderId) ?? [];
    if (!selectedFolderId && roots.length > 0) setSelectedFolderId(roots[0].id);
  }, [tree.data, selectedFolderId]);

  const filesInFolder = useMemo(() => (tree.data?.files ?? [])
    .filter(f => f.folderId === selectedFolderId), [tree.data, selectedFolderId]);

  const uploadFile = useCallback(async (file: File) => {
    if (!selectedFolderId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folderId", selectedFolderId);
      await api.post("/bookkeeping/files", form, { headers: { "Content-Type": "multipart/form-data" } });
      qc.invalidateQueries({ queryKey: ["bookkeeping", "tree"] });
    } catch (e) { setErr(extractErrorMessage(e)); } finally { setUploading(false); }
  }, [selectedFolderId, qc, setErr]);

  if (tree.isLoading) return <Box sx={{ p: 3 }}><CircularProgress size={20} /></Box>;
  if ((tree.data?.folders.length ?? 0) === 0) {
    return (
      <Alert severity="info" sx={{ m: 3 }}>
        Οι φάκελοι σας ετοιμάζονται από την ομάδα μας. Θα σας ειδοποιήσουμε μέσω ΕΡΜΗ
        μόλις είναι διαθέσιμοι για upload.
      </Alert>
    );
  }
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px 1fr" }, height: "100%", minHeight: 0 }}>
      <Box sx={{ borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2" fontWeight={700}>Φάκελοι</Typography>
        </Box>
        <List dense sx={{ flex: 1, overflowY: "auto" }}>
          <TenantTreeNode folders={tree.data?.folders ?? []} parentId={null} depth={0}
            selectedId={selectedFolderId} onSelect={setSelectedFolderId} />
        </List>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}
        onDragOver={e => { if (selectedFolderId) e.preventDefault(); }}
        onDrop={e => {
          if (!selectedFolderId) return; e.preventDefault();
          for (const f of Array.from(e.dataTransfer.files ?? [])) void uploadFile(f);
        }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
            Αρχεία {filesInFolder.length > 0 && `(${filesInFolder.length})`}
          </Typography>
          <Button size="small" variant="contained" startIcon={<UploadFileIcon />} component="label"
            disabled={!selectedFolderId || uploading}>
            Ανέβασμα
            <input type="file" hidden multiple onChange={async e => {
              for (const f of Array.from(e.target.files ?? [])) await uploadFile(f);
              e.target.value = "";
            }} />
          </Button>
        </Stack>
        {uploading && <LinearProgress />}
        {!selectedFolderId ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>Επιλέξτε φάκελο.</Box>
        ) : filesInFolder.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            Δεν υπάρχουν αρχεία εδώ ακόμη. Σύρετε αρχεία ή πατήστε «Ανέβασμα».
          </Box>
        ) : (
          <List dense sx={{ flex: 1, overflowY: "auto" }}>
            {filesInFolder.map(f => (
              <ListItem key={f.id} divider secondaryAction={
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
                  primary={<Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={600}>{f.fileName}</Typography>
                    <Chip size="small" label={f.uploadedBy === "admin" ? "από Kalypsis" : "δικό μου"}
                      color={f.uploadedBy === "admin" ? "primary" : "default"}
                      variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                    <Chip size="small" label={f.status}
                      color={f.status === "processed" ? "success" : f.status === "rejected" ? "error" : "warning"}
                      sx={{ height: 18, fontSize: 10 }} />
                  </Stack>}
                  secondary={`${formatBytes(f.sizeBytes)} · ${new Date(f.createdAt).toLocaleString("el-GR")}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

function TenantTreeNode({ folders, parentId, depth, selectedId, onSelect }: {
  folders: FolderDto[]; parentId: string | null; depth: number;
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  const children = folders.filter(f => (f.parentFolderId ?? null) === parentId);
  return (
    <>
      {children.map(f => (
        <Box key={f.id}>
          <ListItemButton selected={f.id === selectedId} onClick={() => onSelect(f.id)}
            sx={{ pl: 1 + depth * 2 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              {f.id === selectedId ? <FolderSpecialIcon fontSize="small" color="primary" /> : <FolderIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" noWrap>{f.name}</Typography>}
              secondary={f.fileCount > 0 ? `${f.fileCount} αρχεία` : undefined} />
          </ListItemButton>
          <TenantTreeNode folders={folders} parentId={f.id} depth={depth + 1}
            selectedId={selectedId} onSelect={onSelect} />
        </Box>
      ))}
    </>
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
