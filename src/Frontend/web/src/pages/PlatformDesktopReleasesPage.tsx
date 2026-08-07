import { useState } from "react";
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
  LinearProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PublishIcon from "@mui/icons-material/Publish";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import type { DesktopRelease, DesktopReleaseAsset } from "../models/DesktopRelease";

type UploadStatus = {
  progress: number;
  state: "uploading" | "done" | "error";
  message?: string;
};

export function PlatformDesktopReleasesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const [uploads, setUploads] = useState<Record<string, UploadStatus>>({});

  const releasesQuery = useQuery({
    queryKey: ["platform-desktop-releases"],
    queryFn: async () => (await api.get<DesktopRelease[]>("/platform/desktop-releases")).data
  });

  const updateRelease = useMutation({
    mutationFn: async ({ release, draft }: { release: DesktopRelease; draft: boolean }) =>
      (await api.patch<DesktopRelease>(`/platform/desktop-releases/${release.id}`, {
        name: release.name,
        body: release.body,
        draft,
        prerelease: release.prerelease,
        makeLatest: !draft && !release.prerelease
      })).data,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["platform-desktop-releases"] });
      await queryClient.invalidateQueries({ queryKey: ["public-desktop-releases"] });
      setNotice({ severity: "success", text: variables.draft ? "Η έκδοση επέστρεψε σε πρόχειρη κατάσταση." : "Η έκδοση δημοσιεύτηκε και εμφανίζεται στον δημόσιο κατάλογο." });
    },
    onError: (error) => setNotice({ severity: "error", text: extractErrorMessage(error, "Η αλλαγή κατάστασης απέτυχε.") })
  });

  const deleteAsset = useMutation({
    mutationFn: async (assetId: number) => api.delete(`/platform/desktop-releases/assets/${assetId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-desktop-releases"] });
      await queryClient.invalidateQueries({ queryKey: ["public-desktop-releases"] });
      setNotice({ severity: "success", text: "Το αρχείο διαγράφηκε από την έκδοση." });
    },
    onError: (error) => setNotice({ severity: "error", text: extractErrorMessage(error, "Η διαγραφή απέτυχε.") })
  });

  async function uploadFiles(release: DesktopRelease, files: File[]) {
    for (const file of files) {
      const key = `${release.id}:${file.name}`;
      if (file.size === 0 || file.size > 550 * 1024 * 1024) {
        setUploads((current) => ({ ...current, [key]: { progress: 0, state: "error", message: "Επιτρέπονται αρχεία έως 550 MB." } }));
        continue;
      }

      setUploads((current) => ({ ...current, [key]: { progress: 0, state: "uploading" } }));
      try {
        await api.post(`/platform/desktop-releases/${release.id}/assets`, file, {
          params: { name: file.name, replace: false },
          headers: { "Content-Type": file.type || "application/octet-stream" },
          timeout: 30 * 60 * 1000,
          onUploadProgress: (event) => {
            const total = event.total ?? file.size;
            const progress = total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
            setUploads((current) => ({ ...current, [key]: { progress, state: "uploading" } }));
          }
        });
        setUploads((current) => ({ ...current, [key]: { progress: 100, state: "done" } }));
        setNotice({ severity: "success", text: `Το ${file.name} ανέβηκε επιτυχώς.` });
      } catch (error) {
        setUploads((current) => ({
          ...current,
          [key]: { progress: current[key]?.progress ?? 0, state: "error", message: extractErrorMessage(error, "Το ανέβασμα απέτυχε.") }
        }));
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["platform-desktop-releases"] });
    await queryClient.invalidateQueries({ queryKey: ["public-desktop-releases"] });
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2} mb={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <SystemUpdateAltIcon color="primary" sx={{ fontSize: 38 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Desktop εκδόσεις</Typography>
            <Typography color="text.secondary">Δημιουργία, ανέβασμα αρχείων και δημοσίευση των εκδόσεων Kalypsis Desktop.</Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ width: { xs: "100%", md: "auto" } }}>
          <Button component={RouterLink} to="/download/releases" target="_blank" variant="outlined" startIcon={<OpenInNewIcon />} sx={{ textTransform: "none" }}>
            Δημόσια σελίδα
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ textTransform: "none" }}>
            Νέα έκδοση
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2.5 }}>
        Προτεινόμενη ροή: δημιουργήστε την έκδοση ως πρόχειρη, ανεβάστε και ελέγξτε όλα τα αρχεία και έπειτα πατήστε «Δημοσίευση». Για αντικατάσταση αρχείου με ίδιο όνομα, διαγράψτε πρώτα το παλιό από τον πίνακα.
      </Alert>
      <Alert severity="warning" sx={{ mb: 2.5 }}>
        Ο κύριος εγκαταστάτης πρέπει σε κάθε έκδοση να ονομάζεται ακριβώς <strong>kalypsis-desktop-win-Setup.exe</strong>. Χωρίς αυτό το αρχείο η δημοσίευση μπλοκάρεται, ώστε το σταθερό κουμπί «Λήψη για Windows» να μη σπάσει.
      </Alert>
      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 2.5 }}>{notice.text}</Alert>}

      {releasesQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : releasesQuery.isError ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void releasesQuery.refetch()}>Ξανά</Button>}>
          {extractErrorMessage(releasesQuery.error, "Δεν φορτώθηκαν οι desktop εκδόσεις.")}
        </Alert>
      ) : (releasesQuery.data?.length ?? 0) === 0 ? (
        <Alert severity="info">Δεν υπάρχουν εκδόσεις. Πατήστε «Νέα έκδοση» για να ξεκινήσετε.</Alert>
      ) : (
        <Stack spacing={3}>
          {releasesQuery.data?.map((release) => (
            <ReleaseManagerCard
              key={release.id}
              release={release}
              uploadStatuses={uploads}
              onUpload={(files) => void uploadFiles(release, files)}
              onPublish={() => {
                if (window.confirm(`Να δημοσιευτεί η ${release.tagName}; Θα εμφανιστεί αμέσως στη δημόσια σελίδα.`))
                  updateRelease.mutate({ release, draft: false });
              }}
              onUnpublish={() => {
                if (window.confirm(`Να αποσυρθεί προσωρινά η ${release.tagName} από τη δημόσια σελίδα;`))
                  updateRelease.mutate({ release, draft: true });
              }}
              onDeleteAsset={(asset) => {
                if (window.confirm(`Οριστική διαγραφή του ${asset.name} από το GitHub release;`))
                  deleteAsset.mutate(asset.id);
              }}
              isUpdating={updateRelease.isPending}
              isDeleting={deleteAsset.isPending}
            />
          ))}
        </Stack>
      )}

      <CreateReleaseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await queryClient.invalidateQueries({ queryKey: ["platform-desktop-releases"] });
          setNotice({ severity: "success", text: "Η νέα έκδοση δημιουργήθηκε. Μπορείτε τώρα να ανεβάσετε τα αρχεία της." });
        }}
      />
    </Box>
  );
}

function ReleaseManagerCard({
  release,
  uploadStatuses,
  onUpload,
  onPublish,
  onUnpublish,
  onDeleteAsset,
  isUpdating,
  isDeleting
}: {
  release: DesktopRelease;
  uploadStatuses: Record<string, UploadStatus>;
  onUpload: (files: File[]) => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDeleteAsset: (asset: DesktopReleaseAsset) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const releaseUploads = Object.entries(uploadStatuses).filter(([key]) => key.startsWith(`${release.id}:`));
  const inputId = `desktop-assets-${release.id}`;
  const hasStableInstaller = release.assets.some((asset) => asset.name.toLowerCase() === "kalypsis-desktop-win-setup.exe");

  return (
    <Card variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ p: 2.5, bgcolor: release.draft ? "warning.50" : "success.50", borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
          <Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 850 }}>{release.name}</Typography>
              <Chip size="small" label={release.tagName} sx={{ fontFamily: "monospace", fontWeight: 800 }} />
              <Chip size="small" color={release.draft ? "warning" : "success"} label={release.draft ? "Πρόχειρη" : "Δημοσιευμένη"} />
              {release.prerelease && <Chip size="small" color="info" label="Prerelease" />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {release.assets.length} αρχεία · Δημιουργία {new Date(release.createdAt).toLocaleDateString("el-GR")}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
            <input
              id={inputId}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) onUpload(files);
                event.target.value = "";
              }}
            />
            <Button component="label" htmlFor={inputId} variant="outlined" startIcon={<CloudUploadIcon />} sx={{ textTransform: "none" }}>
              Ανέβασμα αρχείων
            </Button>
            {release.draft ? (
              <Button variant="contained" color="success" startIcon={<PublishIcon />} disabled={isUpdating || !hasStableInstaller} onClick={onPublish} sx={{ textTransform: "none" }}>
                Δημοσίευση
              </Button>
            ) : (
              <Button variant="outlined" color="warning" disabled={isUpdating} onClick={onUnpublish} sx={{ textTransform: "none" }}>
                Απόσυρση
              </Button>
            )}
          </Stack>
        </Stack>
        {release.body && <Typography sx={{ mt: 1.5, whiteSpace: "pre-line", fontSize: 13.5, color: "text.secondary", maxWidth: 1000 }}>{release.body}</Typography>}
      </Box>

      {releaseUploads.length > 0 && (
        <Stack spacing={1} sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
          {releaseUploads.map(([key, status]) => {
            const fileName = key.slice(key.indexOf(":") + 1);
            return (
              <Box key={key}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{fileName}</Typography>
                  <Typography variant="caption" color={status.state === "error" ? "error" : "text.secondary"}>
                    {status.state === "done" ? "Ολοκληρώθηκε" : status.state === "error" ? status.message : `${status.progress}%`}
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={status.progress} color={status.state === "error" ? "error" : status.state === "done" ? "success" : "primary"} />
              </Box>
            );
          })}
        </Stack>
      )}

      {release.assets.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 3 }}>Δεν έχουν ανέβει αρχεία σε αυτή την έκδοση.</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Αρχείο</TableCell>
                <TableCell>Μέγεθος</TableCell>
                <TableCell>Λήψεις</TableCell>
                <TableCell>SHA-256</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {release.assets.map((asset) => (
                <TableRow key={asset.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{asset.name}</TableCell>
                  <TableCell>{formatBytes(asset.size)}</TableCell>
                  <TableCell>{asset.downloadCount.toLocaleString("el-GR")}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 11.5 }}>{asset.digest?.replace("sha256:", "").slice(0, 16) ?? "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton component="a" href={asset.browserDownloadUrl} target="_blank" rel="noopener noreferrer" size="small" title="Λήψη">
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" size="small" disabled={isDeleting} onClick={() => onDeleteAsset(asset)} title="Διαγραφή">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Card>
  );
}

function CreateReleaseDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ tagName: "", name: "", body: "", prerelease: false, generateReleaseNotes: false });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => api.post("/platform/desktop-releases", {
      tagName: form.tagName.trim(),
      name: form.name.trim(),
      body: form.body.trim(),
      draft: true,
      prerelease: form.prerelease,
      generateReleaseNotes: form.generateReleaseNotes
    }),
    onSuccess: () => {
      setForm({ tagName: "", name: "", body: "", prerelease: false, generateReleaseNotes: false });
      setError(null);
      onCreated();
    },
    onError: (requestError) => setError(extractErrorMessage(requestError, "Η δημιουργία της έκδοσης απέτυχε."))
  });

  return (
    <Dialog open={open} onClose={create.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 850 }}>Νέα desktop έκδοση</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          <Alert severity="info">Η έκδοση θα δημιουργηθεί ως πρόχειρη και δεν θα εμφανιστεί δημόσια μέχρι να την δημοσιεύσετε.</Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              required
              label="Tag έκδοσης"
              placeholder="v2.1.0"
              value={form.tagName}
              onChange={(event) => setForm((current) => ({ ...current, tagName: event.target.value }))}
              sx={{ width: { xs: "100%", sm: 180 } }}
            />
            <TextField
              required
              label="Τίτλος"
              placeholder="Kalypsis Desktop 2.1.0"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              fullWidth
            />
          </Stack>
          <TextField
            label="Σημειώσεις έκδοσης"
            multiline
            minRows={5}
            placeholder="Νέα χαρακτηριστικά, διορθώσεις και οδηγίες αναβάθμισης..."
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
          />
          <FormControlLabel
            control={<Switch checked={form.prerelease} onChange={(event) => setForm((current) => ({ ...current, prerelease: event.target.checked }))} />}
            label="Δοκιμαστική έκδοση (prerelease)"
          />
          <FormControlLabel
            control={<Switch checked={form.generateReleaseNotes} onChange={(event) => setForm((current) => ({ ...current, generateReleaseNotes: event.target.checked }))} />}
            label="Αυτόματη δημιουργία σημειώσεων από το GitHub"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={create.isPending}>Άκυρο</Button>
        <Button variant="contained" disabled={create.isPending || !form.tagName.trim() || !form.name.trim()} onClick={() => create.mutate()}>
          {create.isPending ? <CircularProgress size={20} /> : "Δημιουργία πρόχειρης"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export default PlatformDesktopReleasesPage;
