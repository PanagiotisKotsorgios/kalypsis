import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, LinearProgress, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, MenuItem, Paper, Select,
  Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BusinessIcon from "@mui/icons-material/Business";
import FolderIcon from "@mui/icons-material/Folder";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import LockIcon from "@mui/icons-material/Lock";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import { api, extractErrorMessage } from "../api/client";

/**
 * Platform-admin Μηχανογράφιση workspace. Renders as three-column:
 *
 *   ┌──────────────┬───────────────────────┬──────────────────────┐
 *   │ Γραφεία      │ Δέντρο φακέλων        │ Αρχεία + σημειώσεις  │
 *   │ (opted in)   │ + drop targets        │ + activity log       │
 *   └──────────────┴───────────────────────┴──────────────────────┘
 *
 * Everything is a REST call to /api/platform/bookkeeping/tenants/{id}/*.
 * Tenant selection is stored in `selectedTenantId`; changing it swaps
 * the middle + right columns without unmounting the shell.
 */
interface TenantOverview { tenantId: string; tenantName: string; mode: string;
  onboarded: boolean; onboardedAt: string | null; folderCount: number;
  fileCount: number; pendingFiles: number; lastActivityAt: string | null; }
interface FolderDto { id: string; parentFolderId: string | null; name: string;
  origin: string; displayOrder: number; createdAt: string; fileCount: number; }
interface FileDto { id: string; folderId: string; fileName: string; mimeType: string;
  sizeBytes: number; uploadedBy: string; notes: string | null; status: string;
  createdAt: string; uploadedByDisplay: string | null; }
interface TreeResp { folders: FolderDto[]; files: FileDto[]; }
interface ActivityDto { id: string; kind: string; title: string; body: string | null;
  authorUserId: string; authorDisplay: string; category: string | null;
  autoNotified: boolean; createdAt: string; }
interface CredentialDto { id: string; carrierName: string; portalUrl: string;
  notes: string | null; active: boolean; lastVerifiedAt: string | null; createdAt: string; }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function PlatformBookkeepingPage() {
  const qc = useQueryClient();
  const tenants = useQuery({
    queryKey: ["platform-bookkeeping", "tenants"],
    queryFn: async () => (await api.get<TenantOverview[]>("/platform/bookkeeping/tenants")).data,
  });
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"files" | "activities" | "credentials" | "defaults">("files");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTenantId && tenants.data && tenants.data.length > 0)
      setSelectedTenantId(tenants.data[0].tenantId);
  }, [tenants.data, selectedTenantId]);

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <FolderIcon color="primary" sx={{ fontSize: 32 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>Μηχανογράφιση γραφείων</Typography>
          <Typography variant="body2" color="text.secondary">
            Διαχειριστείτε τα αρχεία, τους φακέλους και τις ενέργειες μηχανογράφισης
            για κάθε γραφείο που έχει ενεργοποιήσει την υπηρεσία.
          </Typography>
        </Box>
      </Stack>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "280px 1fr" }, gap: 2, minHeight: "calc(100vh - 220px)" }}>
        <TenantListPanel tenants={tenants.data ?? []} loading={tenants.isLoading}
          selectedId={selectedTenantId} onSelect={setSelectedTenantId} />

        {selectedTenantId ? (
          <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}>
              <Tab value="files" icon={<FolderSpecialIcon fontSize="small" />} iconPosition="start" label="Φάκελοι & αρχεία" />
              <Tab value="activities" icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Ενέργειες" />
              <Tab value="credentials" icon={<VpnKeyIcon fontSize="small" />} iconPosition="start" label="Portal codes" />
              <Tab value="defaults" icon={<SettingsIcon fontSize="small" />} iconPosition="start" label="Προεπιλογές" />
            </Tabs>
            <Box sx={{ flex: 1, overflow: "hidden" }}>
              {activeTab === "files" && (
                <FilesTab tenantId={selectedTenantId} qc={qc} setErr={setErr} />
              )}
              {activeTab === "activities" && (
                <ActivitiesTab tenantId={selectedTenantId} qc={qc} setErr={setErr} />
              )}
              {activeTab === "credentials" && (
                <CredentialsTab tenantId={selectedTenantId} qc={qc} setErr={setErr} />
              )}
              {activeTab === "defaults" && (
                <DefaultStructureTab qc={qc} setErr={setErr} tenantId={selectedTenantId} />
              )}
            </Box>
          </Card>
        ) : (
          <Card variant="outlined" sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 8 }}>
            <Typography color="text.secondary">Επιλέξτε ένα γραφείο από αριστερά.</Typography>
          </Card>
        )}
      </Box>
    </Container>
  );
}

function TenantListPanel({ tenants, loading, selectedId, onSelect }: {
  tenants: TenantOverview[]; loading: boolean;
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => tenants.filter(t =>
    !q || t.tenantName.toLowerCase().includes(q.toLowerCase())), [tenants, q]);
  return (
    <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <TextField size="small" fullWidth placeholder="Αναζήτηση γραφείου…"
          value={q} onChange={e => setQ(e.target.value)} />
      </Box>
      <List dense sx={{ flex: 1, overflowY: "auto", py: 0 }}>
        {loading && <ListItem><CircularProgress size={20} /></ListItem>}
        {!loading && filtered.length === 0 && (
          <ListItem>
            <ListItemText primary={<Typography variant="body2" color="text.secondary">
              Κανένα γραφείο δεν έχει ενεργοποιήσει τη μηχανογράφιση ακόμη.
            </Typography>} />
          </ListItem>
        )}
        {filtered.map(t => (
          <ListItemButton key={t.tenantId} selected={t.tenantId === selectedId}
            onClick={() => onSelect(t.tenantId)}
            sx={{ borderLeft: 3, borderColor: t.tenantId === selectedId ? "primary.main" : "transparent" }}>
            <ListItemIcon><BusinessIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" fontWeight={700}>{t.tenantName}</Typography>}
              secondary={
                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={t.mode} variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                  {t.onboarded
                    ? <Chip size="small" color="success" icon={<CheckCircleOutlineIcon sx={{ fontSize: 12 }} />} label="onboarded" sx={{ height: 18, fontSize: 10 }} />
                    : <Chip size="small" color="warning" label="pending" sx={{ height: 18, fontSize: 10 }} />}
                  {t.pendingFiles > 0 && (
                    <Chip size="small" color="warning" label={`${t.pendingFiles} pending`} sx={{ height: 18, fontSize: 10 }} />
                  )}
                </Stack>
              }
            />
          </ListItemButton>
        ))}
      </List>
    </Card>
  );
}

function FilesTab({ tenantId, qc, setErr }: {
  tenantId: string; qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
}) {
  const tree = useQuery({
    queryKey: ["platform-bookkeeping", "tree", tenantId],
    queryFn: async () => (await api.get<TreeResp>(`/platform/bookkeeping/tenants/${tenantId}/tree`)).data,
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Auto-select the first root folder when tree changes.
    const roots = tree.data?.folders.filter(f => !f.parentFolderId) ?? [];
    if (!selectedFolderId && roots.length > 0) setSelectedFolderId(roots[0].id);
  }, [tree.data, selectedFolderId]);

  const applyDefaults = useMutation({
    mutationFn: () => api.post(`/platform/bookkeeping/tenants/${tenantId}/apply-defaults`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] }),
    onError: e => setErr(extractErrorMessage(e)),
  });

  const filesInFolder = useMemo(() => (tree.data?.files ?? [])
    .filter(f => f.folderId === selectedFolderId), [tree.data, selectedFolderId]);

  const uploadFile = useCallback(async (file: File) => {
    if (!selectedFolderId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folderId", selectedFolderId);
      await api.post(`/platform/bookkeeping/tenants/${tenantId}/files`, form,
        { headers: { "Content-Type": "multipart/form-data" } });
      qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] });
    } catch (e) { setErr(extractErrorMessage(e)); } finally { setUploading(false); }
  }, [tenantId, selectedFolderId, qc, setErr]);

  if (tree.isLoading) return <Box sx={{ p: 3 }}><CircularProgress size={20} /></Box>;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px 1fr" }, height: "100%", minHeight: 0 }}>
      {/* Folder tree */}
      <Box sx={{ borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>Φάκελοι</Typography>
          <Tooltip title="Νέος φάκελος">
            <IconButton size="small" onClick={() => setNewFolderOpen(true)}><AddIcon fontSize="small" /></IconButton>
          </Tooltip>
          {(tree.data?.folders.length ?? 0) === 0 && (
            <Tooltip title="Δημιουργία προεπιλεγμένης δομής">
              <IconButton size="small" onClick={() => applyDefaults.mutate()}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <List dense sx={{ flex: 1, overflowY: "auto" }}>
          <FolderTreeNode folders={tree.data?.folders ?? []} parentId={null} depth={0}
            selectedId={selectedFolderId} onSelect={setSelectedFolderId}
            tenantId={tenantId} qc={qc} setErr={setErr} />
        </List>
      </Box>

      {/* Files list + upload */}
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}
        onDragOver={e => { if (selectedFolderId) e.preventDefault(); }}
        onDrop={e => {
          if (!selectedFolderId) return;
          e.preventDefault();
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
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            Επιλέξτε φάκελο για να δείτε ή να ανεβάσετε αρχεία. Μπορείτε επίσης να σύρετε αρχεία εδώ.
          </Box>
        ) : filesInFolder.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            Κανένα αρχείο σε αυτόν τον φάκελο. Σύρετε αρχεία εδώ ή πατήστε «Ανέβασμα».
          </Box>
        ) : (
          <List dense sx={{ flex: 1, overflowY: "auto" }}>
            {filesInFolder.map(f => (
              <FileRow key={f.id} f={f} tenantId={tenantId} qc={qc} setErr={setErr} />
            ))}
          </List>
        )}
      </Box>

      <NewFolderDialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)}
        tenantId={tenantId} parentFolderId={selectedFolderId} qc={qc} setErr={setErr} />
    </Box>
  );
}

function FolderTreeNode({ folders, parentId, depth, selectedId, onSelect, tenantId, qc, setErr }: {
  folders: FolderDto[]; parentId: string | null; depth: number;
  selectedId: string | null; onSelect: (id: string) => void;
  tenantId: string; qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
}) {
  const children = folders.filter(f => (f.parentFolderId ?? null) === parentId);
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/bookkeeping/tenants/${tenantId}/folders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  return (
    <>
      {children.map(f => (
        <Box key={f.id}>
          <ListItemButton selected={f.id === selectedId}
            onClick={() => onSelect(f.id)} sx={{ pl: 1 + depth * 2 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              {f.id === selectedId ? <FolderSpecialIcon fontSize="small" color="primary" /> : <FolderIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" noWrap>{f.name}</Typography>}
              secondary={f.fileCount > 0 ? `${f.fileCount} αρχεία` : undefined} />
            <Tooltip title="Διαγραφή φακέλου (πρέπει να είναι άδειος)">
              <IconButton size="small" onClick={e => {
                e.stopPropagation();
                if (window.confirm(`Διαγραφή «${f.name}»;`)) del.mutate(f.id);
              }}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Tooltip>
          </ListItemButton>
          <FolderTreeNode folders={folders} parentId={f.id} depth={depth + 1}
            selectedId={selectedId} onSelect={onSelect}
            tenantId={tenantId} qc={qc} setErr={setErr} />
        </Box>
      ))}
    </>
  );
}

function FileRow({ f, tenantId, qc, setErr }: {
  f: FileDto; tenantId: string;
  qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
}) {
  const del = useMutation({
    mutationFn: () => api.delete(`/platform/bookkeeping/tenants/${tenantId}/files/${f.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const status = useMutation({
    mutationFn: (s: string) => api.put(`/platform/bookkeeping/tenants/${tenantId}/files/${f.id}`, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const replaceMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData(); form.append("file", file);
      return api.post(`/platform/bookkeeping/tenants/${tenantId}/files/${f.id}/replace`, form,
        { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const download = async () => {
    const res = await api.get<Blob>(`/platform/bookkeeping/tenants/${tenantId}/files/${f.id}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const el = document.createElement("a"); el.href = url; el.download = f.fileName; el.click();
    window.URL.revokeObjectURL(url);
  };
  return (
    <ListItem divider secondaryAction={
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Λήψη"><IconButton size="small" onClick={download}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Αντικατάσταση">
          <IconButton size="small" component="label">
            <SwapHorizIcon fontSize="small" />
            <input type="file" hidden onChange={e => {
              const file = e.target.files?.[0]; if (file) replaceMut.mutate(file);
              e.target.value = "";
            }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Διαγραφή">
          <IconButton size="small" onClick={() => {
            if (window.confirm(`Διαγραφή «${f.fileName}»;`)) del.mutate();
          }}><DeleteOutlineIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
    }>
      <ListItemText
        primary={<Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" fontWeight={600}>{f.fileName}</Typography>
          <Chip size="small" label={f.uploadedBy} variant="outlined" sx={{ height: 18, fontSize: 10 }} />
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <Select value={f.status} onChange={e => status.mutate(e.target.value)}
              sx={{ height: 24, fontSize: 12 }}>
              <MenuItem value="pending">pending</MenuItem>
              <MenuItem value="processed">processed</MenuItem>
              <MenuItem value="rejected">rejected</MenuItem>
            </Select>
          </FormControl>
        </Stack>}
        secondary={`${formatBytes(f.sizeBytes)} · ${new Date(f.createdAt).toLocaleString("el-GR")}${f.uploadedByDisplay ? " · " + f.uploadedByDisplay : ""}`}
      />
    </ListItem>
  );
}

function NewFolderDialog({ open, onClose, tenantId, parentFolderId, qc, setErr }: {
  open: boolean; onClose: () => void; tenantId: string; parentFolderId: string | null;
  qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [asChild, setAsChild] = useState(false);
  useEffect(() => { if (open) { setName(""); setAsChild(false); } }, [open]);
  const create = useMutation({
    mutationFn: () => api.post(`/platform/bookkeeping/tenants/${tenantId}/folders`,
      { name, parentFolderId: asChild ? parentFolderId : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] }); onClose(); },
    onError: e => setErr(extractErrorMessage(e)),
  });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Νέος φάκελος</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label="Όνομα" value={name} onChange={e => setName(e.target.value)} autoFocus />
          {parentFolderId && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch size="small" checked={asChild} onChange={e => setAsChild(e.target.checked)} />
              <Typography variant="body2">Ως υποφάκελος του τρέχοντος</Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" onClick={() => create.mutate()} disabled={!name.trim()}>Δημιουργία</Button>
      </DialogActions>
    </Dialog>
  );
}

function ActivitiesTab({ tenantId, qc, setErr }: {
  tenantId: string; qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
}) {
  const list = useQuery({
    queryKey: ["platform-bookkeeping", "activities", tenantId],
    queryFn: async () => (await api.get<ActivityDto[]>(`/platform/bookkeeping/tenants/${tenantId}/activities`)).data,
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [autoNotify, setAutoNotify] = useState(true);
  const create = useMutation({
    mutationFn: () => api.post(`/platform/bookkeeping/tenants/${tenantId}/activities`,
      { kind: "note", title, body: body || null, category: category || null, autoNotify }),
    onSuccess: () => {
      setTitle(""); setBody("");
      qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "activities", tenantId] });
      qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tenants"] });
    },
    onError: e => setErr(extractErrorMessage(e)),
  });
  const cats = ["Προμήθειες", "Υπερπρομήθειες", "Πληρωμές", "Έξοδα", "Βιβλία", "Άλλο"];
  return (
    <Box sx={{ p: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 360px" }, gap: 2, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 2, overflowY: "auto" }}>
        <Typography variant="subtitle2" fontWeight={800} mb={1}>Ιστορικό ενεργειών</Typography>
        {list.isLoading && <CircularProgress size={20} />}
        {list.data?.length === 0 && <Typography color="text.secondary">Καμία ενέργεια ακόμη.</Typography>}
        <Stack spacing={1.5}>
          {list.data?.map(a => (
            <Box key={a.id} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <Typography variant="body2" fontWeight={700}>{a.title}</Typography>
                {a.category && <Chip size="small" label={a.category} variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                {a.autoNotified && (
                  <Tooltip title="Στάλθηκε notification στο γραφείο μέσω ΕΡΜΗ">
                    <NotificationsActiveIcon fontSize="small" color="success" />
                  </Tooltip>
                )}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(a.createdAt).toLocaleString("el-GR")} · {a.authorDisplay}
                </Typography>
              </Stack>
              {a.body && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{a.body}</Typography>}
            </Box>
          ))}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight={800} mb={1}>Νέα ενέργεια</Typography>
        <Stack spacing={2}>
          <TextField size="small" label="Τίτλος" value={title} onChange={e => setTitle(e.target.value)} />
          <TextField size="small" label="Λεπτομέρειες" multiline minRows={3} value={body} onChange={e => setBody(e.target.value)} />
          <FormControl size="small">
            <InputLabel>Κατηγορία</InputLabel>
            <Select label="Κατηγορία" value={category} onChange={e => setCategory(e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {cats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch size="small" checked={autoNotify} onChange={e => setAutoNotify(e.target.checked)} />
            <Typography variant="body2">Auto-notify στο γραφείο μέσω ΕΡΜΗ</Typography>
          </Stack>
          <Button variant="contained" onClick={() => create.mutate()}
            disabled={!title.trim() || create.isPending}>
            Καταγραφή
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

function CredentialsTab({ tenantId, qc, setErr }: {
  tenantId: string; qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void;
}) {
  const list = useQuery({
    queryKey: ["platform-bookkeeping", "credentials", tenantId],
    queryFn: async () => (await api.get<CredentialDto[]>(`/platform/bookkeeping/tenants/${tenantId}/credentials`)).data,
  });
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const save = useMutation({
    mutationFn: () => api.post(`/platform/bookkeeping/tenants/${tenantId}/credentials`,
      { carrierName: carrier, portalUrl: url, username, password, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "credentials", tenantId] });
      setOpen(false); setCarrier(""); setUrl(""); setUsername(""); setPassword(""); setNotes("");
    },
    onError: e => setErr(extractErrorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/bookkeeping/tenants/${tenantId}/credentials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "credentials", tenantId] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const [revealed, setRevealed] = useState<Record<string, { username: string; password: string } | undefined>>({});
  const reveal = async (id: string) => {
    try {
      const r = await api.get<{ usernameCipher: string; passwordCipher: string }>(
        `/platform/bookkeeping/tenants/${tenantId}/credentials/${id}/reveal`);
      setRevealed(v => ({ ...v, [id]: { username: r.data.usernameCipher, password: r.data.passwordCipher } }));
    } catch (e) { setErr(extractErrorMessage(e)); }
  };
  return (
    <Box sx={{ p: 2 }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        Portal codes αποθηκεύονται κρυπτογραφημένα (AES-256-GCM) και είναι ορατά ΜΟΝΟ σε Platform Admin.
        Χρησιμοποιείται για γραφεία που μας έχουν εξουσιοδοτήσει να συνδεθούμε σε portals ασφαλιστικών εταιρειών εκ μέρους τους.
      </Alert>
      <Stack direction="row" mb={2}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Νέο credential</Button>
      </Stack>
      {list.isLoading && <CircularProgress size={20} />}
      {list.data?.length === 0 && <Typography color="text.secondary">Καμία εγγραφή.</Typography>}
      <Stack spacing={1}>
        {list.data?.map(c => (
          <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <VpnKeyIcon fontSize="small" color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={700}>{c.carrierName}</Typography>
                <Typography variant="caption" color="text.secondary">{c.portalUrl}</Typography>
                {revealed[c.id] && (
                  <Typography variant="caption" component="div" sx={{ fontFamily: "monospace", mt: 0.5 }}>
                    user: {revealed[c.id]?.username} · pass: {revealed[c.id]?.password}
                  </Typography>
                )}
                {c.notes && <Typography variant="caption" component="div" color="text.secondary">{c.notes}</Typography>}
              </Box>
              <Button size="small" startIcon={<LockIcon />} onClick={() => reveal(c.id)} disabled={!!revealed[c.id]}>
                Αποκάλυψη
              </Button>
              <IconButton size="small" onClick={() => {
                if (window.confirm(`Διαγραφή credential «${c.carrierName}»;`)) del.mutate(c.id);
              }}><DeleteOutlineIcon fontSize="small" /></IconButton>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Νέο portal credential</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Ασφαλιστική εταιρεία" value={carrier} onChange={e => setCarrier(e.target.value)} />
            <TextField size="small" label="URL portal" value={url} onChange={e => setUrl(e.target.value)} />
            <TextField size="small" label="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <TextField size="small" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <TextField size="small" label="Σημειώσεις" value={notes} onChange={e => setNotes(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Ακύρωση</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={!carrier.trim() || !username.trim()}>Αποθήκευση</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DefaultStructureTab({ qc, setErr, tenantId }: {
  qc: ReturnType<typeof useQueryClient>; setErr: (s: string | null) => void; tenantId: string;
}) {
  const q = useQuery({
    queryKey: ["platform-bookkeeping", "defaults"],
    queryFn: async () => (await api.get<string[]>("/platform/bookkeeping/default-structure")).data,
  });
  const [draft, setDraft] = useState<string[]>([]);
  useEffect(() => { if (q.data) setDraft(q.data); }, [q.data]);
  const [newName, setNewName] = useState("");
  const save = useMutation({
    mutationFn: () => api.put("/platform/bookkeeping/default-structure", draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "defaults"] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  const applyToTenant = useMutation({
    mutationFn: () => api.post(`/platform/bookkeeping/tenants/${tenantId}/apply-defaults`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-bookkeeping", "tree", tenantId] }),
    onError: e => setErr(extractErrorMessage(e)),
  });
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={800} mb={1}>Προεπιλεγμένη δομή φακέλων</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Ο κατάλογος root φακέλων που δημιουργείται αυτόματα όταν εφαρμόζετε τις προεπιλογές
        σε ένα νέο γραφείο. Αλλαγές εδώ ισχύουν από την επόμενη εφαρμογή.
      </Typography>
      <Stack spacing={1} mb={2}>
        {draft.map((name, i) => (
          <Stack key={i} direction="row" alignItems="center" spacing={1}>
            <TextField size="small" value={name} onChange={e => {
              const next = draft.slice(); next[i] = e.target.value; setDraft(next);
            }} sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => setDraft(draft.filter((_, ix) => ix !== i))}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} mb={2}>
        <TextField size="small" placeholder="Νέος φάκελος" value={newName}
          onChange={e => setNewName(e.target.value)} sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => {
          if (newName.trim()) { setDraft([...draft, newName.trim()]); setNewName(""); }
        }}>Προσθήκη</Button>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          Αποθήκευση προεπιλογών
        </Button>
        <Button variant="outlined" onClick={() => applyToTenant.mutate()} disabled={applyToTenant.isPending}>
          Εφαρμογή στο τρέχον γραφείο
        </Button>
      </Stack>
    </Box>
  );
}
