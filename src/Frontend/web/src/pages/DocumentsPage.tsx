import { useEffect, useMemo, useRef, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert,
  Autocomplete,
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
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import VisibilityIcon from "@mui/icons-material/Visibility";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { date } from "../utils/format";

type DocumentType = "Policy" | "GreenCard" | "Roadside" | "Invoice" | "Other";

interface DocumentDto {
  id: string;
  policyId: string;
  policyNumber: string;
  customerId: string;
  customerDisplay: string;
  documentType: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface PolicyLite {
  id: string;
  policyNumber: string;
  customerDisplay: string;
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === "AgencyAdmin" || user?.role === "AgencyUser";
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewOf, setPreviewOf] = useState<DocumentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Filter state — all local so the operator can narrow the huge document
  // list by policy number, customer name, doc type, or upload date range
  // without a page reload.
  const [q, setQ]     = useState("");           // free text (policy # OR customer OR filename)
  const [type, setType] = useState<DocumentType | "">("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo]     = useState<string>("");

  const docsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await api.get<DocumentDto[]>("/documents")).data
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["documents"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const download = async (id: string, fileName: string) => {
    const res = await api.get<Blob>(`/documents/${id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const allRows = docsQuery.data ?? [];
  const isCustomer = user?.role === "Customer";

  // Client-side filter — the /documents endpoint returns everything for the
  // current tenant, so we filter here instead of round-tripping.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allRows.filter(d => {
      if (needle) {
        const hay = [d.policyNumber, d.customerDisplay, d.fileName].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (type && d.documentType !== type) return false;
      if (from && d.createdAt < from) return false;
      if (to && d.createdAt > to + "T23:59:59") return false;
      return true;
    });
  }, [allRows, q, type, from, to]);
  const anyFilterActive = q || type || from || to;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {isCustomer ? t("documents.customerTitle") : t("documents.agencyTitle")}
            </Typography>
            <HelpHint id="page.documents" />
          </Stack>
          <Typography color="text.secondary">
            {isCustomer ? t("documents.customerLead") : t("documents.agencyLead")}
          </Typography>
        </Box>
        {canEdit && (
          <Button startIcon={<CloudUploadIcon />} variant="contained" size="large" onClick={() => { setError(null); setUploadOpen(true); }}>
            {t("documents.uploadBtn")}
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters — search by policy #, customer, filename + type + date range. */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <FilterListIcon color="action" sx={{ display: { xs: "none", md: "inline-flex" } }} />
          <TextField
            size="small"
            placeholder="Αναζήτηση: αριθμός συμβολαίου, πελάτης, όνομα αρχείου"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ minWidth: 320, flex: 1 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: q ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQ("")}><CloseIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : undefined
            }}
          />
          <TextField
            select size="small" label="Τύπος" value={type}
            onChange={(e) => setType(e.target.value as DocumentType | "")}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Όλοι</MenuItem>
            {(["Policy","GreenCard","Roadside","Invoice","Other"] as const).map(d => (
              <MenuItem key={d} value={d}>{t(`documents.types.${d}`)}</MenuItem>
            ))}
          </TextField>
          <TextField
            type="date" size="small" label="Από" InputLabelProps={{ shrink: true }}
            value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 150 }}
          />
          <TextField
            type="date" size="small" label="Έως" InputLabelProps={{ shrink: true }}
            value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 150 }}
          />
          {anyFilterActive && (
            <Button size="small" onClick={() => { setQ(""); setType(""); setFrom(""); setTo(""); }}>
              Καθαρισμός
            </Button>
          )}
          <Chip
            size="small"
            label={`${rows.length} / ${allRows.length}`}
            color={anyFilterActive ? "primary" : "default"}
            sx={{ ml: "auto" }}
          />
        </Stack>
      </Card>

      {docsQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">{t("documents.empty")}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("documents.col.file")}</TableCell>
                  <TableCell>{t("documents.col.type")}</TableCell>
                  <TableCell>{t("documents.col.policy")}</TableCell>
                  {!isCustomer && <TableCell>{t("documents.col.customer")}</TableCell>}
                  <TableCell>{t("documents.col.uploadedAt")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((d) => (
                  <TableRow
                    key={d.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={(e) => {
                      // Ignore clicks that landed on an action button so the
                      // Download / Delete / etc. IconButtons keep their own
                      // behaviour and don't accidentally open the drawer.
                      if ((e.target as HTMLElement).closest("button")) return;
                      setPreviewOf(d);
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <MimeIcon mime={d.mimeType} />
                        <Box>
                          <Typography fontWeight={600}>{d.fileName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(d.sizeBytes / 1024)} KB · {d.mimeType}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Chip label={t(`documents.types.${d.documentType}`)} size="small" /></TableCell>
                    <TableCell>{d.policyNumber}</TableCell>
                    {!isCustomer && <TableCell>{d.customerDisplay}</TableCell>}
                    <TableCell sx={{ fontSize: 13 }}>{date(d.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" onClick={() => setPreviewOf(d)} title="Προεπισκόπηση">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => download(d.id, d.fileName)} title={t("documents.download")}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        {canEdit && (
                          <IconButton
                            size="small" color="error"
                            onClick={() => { if (confirm(t("documents.confirmDelete", { name: d.fileName }))) deleteMutation.mutate(d.id); }}
                            title={t("common.delete")}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {canEdit && (
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => { void qc.invalidateQueries({ queryKey: ["documents"] }); setUploadOpen(false); }}
        />
      )}

      <DocumentPreviewDrawer
        doc={previewOf}
        canEdit={canEdit}
        onClose={() => setPreviewOf(null)}
        onChanged={() => void qc.invalidateQueries({ queryKey: ["documents"] })}
      />
    </Box>
  );
}

/* ============================================================================
   MimeIcon — quick visual cue for the file kind: PDFs / images / text /
   everything else. Used both in the list row and the preview drawer header.
   ============================================================================ */
function MimeIcon({ mime, sx }: { mime: string; sx?: object }) {
  if (/pdf/i.test(mime)) return <PictureAsPdfIcon color="error" sx={sx} />;
  if (/^image\//i.test(mime)) return <ImageIcon color="primary" sx={sx} />;
  if (/text|xml|json|csv|word|excel|spreadsheet|document/i.test(mime))
    return <DescriptionIcon color="action" sx={sx} />;
  return <InsertDriveFileIcon color="action" sx={sx} />;
}

/* ============================================================================
   DocumentPreviewDrawer
   ----------------------------------------------------------------------------
   Slides in from the right when a row is clicked. Shows:
     - Header with the MIME icon, filename, chips (type + size), metadata,
       and a close button.
     - Inline preview iframe backed by /api/documents/{id}/preview so PDFs
       and images render in-place; a friendly fallback for other MIME
       types with a Download-Instead button.
     - Actions rail: Download, «Άνοιγμα σε νέα καρτέλα», Replace, Rename,
       Change Type, Delete (each guarded by canEdit).
   The Replace flow reuses a hidden file input; Rename/ChangeType update
   only the DB row (no re-upload).
   ========================================================================= */
function DocumentPreviewDrawer({ doc, canEdit, onClose, onChanged }: {
  doc: DocumentDto | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [docType, setDocType] = useState<DocumentType>("Policy");
  const [err, setErr] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Reset the local rename state whenever the drawer switches documents.
  useEffect(() => {
    setEditing(false);
    setErr(null);
    if (doc) {
      setFileName(doc.fileName);
      setDocType(doc.documentType);
    }
  }, [doc]);

  // Preview URL — the browser handles the auth cookie automatically, so we
  // don't need to pipe the file through JS. The token appended forces a
  // reload whenever the drawer switches to a new document.
  const previewUrl = doc ? `/api/documents/${doc.id}/preview?v=${doc.createdAt}` : "";
  const canInlinePreview = doc
    ? /pdf|^image\/|^text\/|json|xml|csv/i.test(doc.mimeType)
    : false;

  const patchMut = useMutation({
    mutationFn: async () => (await api.patch(`/documents/${doc!.id}`, {
      fileName: fileName || undefined,
      documentType: docType,
    })).data,
    onSuccess: () => { setEditing(false); onChanged(); },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const replaceMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.put(`/documents/${doc!.id}/replace`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: () => onChanged(),
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const download = async () => {
    if (!doc) return;
    const res = await api.get<Blob>(`/documents/${doc.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Drawer
      anchor="right"
      open={!!doc}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: "min(720px, 96vw)" },
          display: "flex", flexDirection: "column"
        }
      }}
    >
      {doc && (
        <>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2 }}>
            <MimeIcon mime={doc.mimeType} sx={{ fontSize: 32 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    fullWidth
                    autoFocus
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                </Stack>
              ) : (
                <Typography sx={{ fontWeight: 700 }} noWrap title={doc.fileName}>
                  {doc.fileName}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {Math.round(doc.sizeBytes / 1024)} KB · {doc.mimeType} · {date(doc.createdAt)}
              </Typography>
            </Box>
            <Chip size="small" label={t(`documents.types.${doc.documentType}`)} />
            <IconButton onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
          <Divider />

          {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ m: 2 }}>{err}</Alert>}

          {/* Actions rail */}
          <Stack direction="row" spacing={1} sx={{ p: 2, flexWrap: "wrap", gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={download}>
              {t("documents.download")}
            </Button>
            <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />}
              onClick={() => window.open(previewUrl, "_blank", "noopener")}>
              Νέα καρτέλα
            </Button>
            {canEdit && (
              <>
                <Button size="small" variant="outlined" startIcon={<SwapHorizIcon />}
                  onClick={() => replaceInputRef.current?.click()}
                  disabled={replaceMut.isPending}>
                  {replaceMut.isPending ? <CircularProgress size={16} /> : "Αντικατάσταση αρχείου"}
                </Button>
                <Button size="small" variant="outlined" startIcon={<EditIcon />}
                  onClick={() => setEditing(v => !v)}>
                  {editing ? "Ακύρωση" : "Μετονομασία / Τύπος"}
                </Button>
                {editing && (
                  <>
                    <TextField
                      select size="small" label="Τύπος"
                      value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}
                      sx={{ minWidth: 160 }}
                    >
                      {(["Policy","GreenCard","Roadside","Invoice","Other"] as const).map(d => (
                        <MenuItem key={d} value={d}>{t(`documents.types.${d}`)}</MenuItem>
                      ))}
                    </TextField>
                    <Button size="small" variant="contained"
                      disabled={patchMut.isPending || !fileName.trim()}
                      onClick={() => patchMut.mutate()}>
                      {patchMut.isPending ? <CircularProgress size={16} /> : "Αποθήκευση"}
                    </Button>
                  </>
                )}
              </>
            )}
            <input
              ref={replaceInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) replaceMut.mutate(f);
                e.target.value = "";
              }}
            />
          </Stack>
          <Divider />

          {/* Preview surface — fills the remaining drawer height. */}
          <Box sx={{
            flex: 1,
            bgcolor: "action.hover",
            display: "flex", alignItems: "stretch", justifyContent: "stretch",
            overflow: "hidden"
          }}>
            {canInlinePreview ? (
              <Box
                component="iframe"
                src={previewUrl}
                title={doc.fileName}
                sx={{ flex: 1, border: 0, width: "100%", height: "100%", bgcolor: "background.paper" }}
              />
            ) : (
              <Stack alignItems="center" justifyContent="center" spacing={2}
                sx={{ flex: 1, p: 4, textAlign: "center" }}>
                <MimeIcon mime={doc.mimeType} sx={{ fontSize: 64 }} />
                <Typography variant="h6" fontWeight={700}>Δεν υπάρχει προεπισκόπηση</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                  Ο τύπος «{doc.mimeType}» δεν υποστηρίζεται από τον browser για inline προβολή.
                  Κατεβάστε το αρχείο για να το ανοίξετε στην κατάλληλη εφαρμογή.
                </Typography>
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={download}>
                  {t("documents.download")}
                </Button>
              </Stack>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
}

function UploadDialog({ open, onClose, onUploaded }: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t } = useTranslation();
  const [policyId, setPolicyId] = useState("");
  const [type, setType] = useState<DocumentType>("Policy");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const policiesQuery = useQuery({
    queryKey: ["policies", "all-for-doc-upload"],
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data,
    enabled: open
  });

  const handleUpload = async () => {
    if (!file || !policyId) {
      setError(t("documents.errors.required"));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("policyId", policyId);
      fd.append("type", type);
      await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onUploaded();
      setPolicyId(""); setType("Policy"); setFile(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("documents.upload.title")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Autocomplete
            fullWidth
            options={policiesQuery.data ?? []}
            getOptionLabel={(p) => `${p.policyNumber} · ${p.customerDisplay}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={(policiesQuery.data ?? []).find(p => p.id === policyId) ?? null}
            onChange={(_, v) => setPolicyId(v?.id ?? "")}
            loading={policiesQuery.isLoading}
            // Fuzzy-ish match: match on policy number OR customer display, so
            // «καλογηρου» matches a customer AND «12345» matches a policy #.
            filterOptions={(opts, state) => {
              const needle = state.inputValue.trim().toLowerCase();
              if (!needle) return opts.slice(0, 100);
              return opts.filter(p =>
                p.policyNumber.toLowerCase().includes(needle)
                || p.customerDisplay.toLowerCase().includes(needle)
              ).slice(0, 100);
            }}
            renderOption={(props, p) => (
              <li {...props} key={p.id}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: "100%" }}>
                  <Typography sx={{ fontFamily: "monospace", fontWeight: 700, minWidth: 100 }}>
                    {p.policyNumber}
                  </Typography>
                  <Typography sx={{ flex: 1 }}>{p.customerDisplay}</Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} required
                label={t("documents.upload.policy")}
                placeholder="Γράψτε αριθμό συμβολαίου ή όνομα πελάτη…"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  )
                }}
              />
            )}
          />
          <TextField
            select required fullWidth label={t("documents.upload.type")}
            value={type} onChange={(e) => setType(e.target.value as DocumentType)}
          >
            {(["Policy","GreenCard","Roadside","Invoice","Other"] as const).map(d =>
              <MenuItem key={d} value={d}>{t(`documents.types.${d}`)}</MenuItem>
            )}
          </TextField>
          <Button
            component="label" variant="outlined" startIcon={<CloudUploadIcon />}
            sx={{ py: 1.4 }}
          >
            {file ? file.name : t("documents.upload.choose")}
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Button>
          {file && (
            <Typography variant="caption" color="text.secondary">
              {Math.round(file.size / 1024)} KB · {file.type || "—"}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={handleUpload} disabled={uploading || !file || !policyId}>
          {uploading ? <CircularProgress size={18} /> : t("documents.upload.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
