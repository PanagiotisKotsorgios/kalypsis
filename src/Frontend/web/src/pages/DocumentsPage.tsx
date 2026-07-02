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
import ArticleIcon from "@mui/icons-material/Article";
import PersonIcon from "@mui/icons-material/Person";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkIcon from "@mui/icons-material/Link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

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
          <SearchableTextField
            select size="small" label="Τύπος" value={type}
            onChange={(e) => setType(e.target.value as DocumentType | "")}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Όλοι</MenuItem>
            {(["Policy","GreenCard","Roadside","Invoice","Other"] as const).map(d => (
              <MenuItem key={d} value={d}>{t(`documents.types.${d}`)}</MenuItem>
            ))}
          </SearchableTextField>
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
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [docType, setDocType] = useState<DocumentType>("Policy");
  const [err, setErr] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  // Blob URL for the preview iframe. We fetch the file via authenticated
  // axios (Bearer token) and wrap the response in URL.createObjectURL, so
  // the browser can render it in an <iframe> without needing to attach the
  // Authorization header itself (iframes/plain URLs don't run axios
  // interceptors — that's why the /preview endpoint was returning 401 on a
  // direct visit and the iframe was showing empty).
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Reset the local rename state + refetch the preview blob whenever the
  // drawer switches documents. Old blob URLs are revoked so we don't leak.
  useEffect(() => {
    setEditing(false);
    setErr(null);
    if (doc) {
      setFileName(doc.fileName);
      setDocType(doc.documentType);
    }
  }, [doc]);

  useEffect(() => {
    let cancelled = false;
    let mintedUrl: string | null = null;
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); setPreviewObjectUrl(null); }
    const canInline = doc
      ? /pdf|^image\/|^text\/|json|xml|csv/i.test(doc.mimeType)
      : false;
    if (doc && canInline) {
      setPreviewLoading(true);
      api.get<Blob>(`/documents/${doc.id}/preview`, { responseType: "blob" })
        .then((res) => {
          if (cancelled) return;
          // Force the MIME on the Blob — some browsers ignore an inline
          // `application/octet-stream` and refuse to render as PDF.
          const blob = new Blob([res.data], { type: doc.mimeType });
          mintedUrl = URL.createObjectURL(blob);
          setPreviewObjectUrl(mintedUrl);
        })
        .catch((e) => { if (!cancelled) setErr(extractErrorMessage(e)); })
        .finally(() => { if (!cancelled) setPreviewLoading(false); });
    }
    return () => {
      cancelled = true;
      if (mintedUrl) URL.revokeObjectURL(mintedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, doc?.mimeType, doc?.createdAt]);

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
              disabled={!previewObjectUrl}
              onClick={() => {
                // Blob URLs are same-origin so the new tab (from the same
                // browsing context) can consume them without any auth
                // headers. This is how we avoid the 401 that used to hit
                // when opening the raw /preview endpoint in a new tab.
                if (previewObjectUrl) window.open(previewObjectUrl, "_blank", "noopener");
              }}>
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
                    <SearchableTextField
                      select size="small" label="Τύπος"
                      value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}
                      sx={{ minWidth: 160 }}
                    >
                      {(["Policy","GreenCard","Roadside","Invoice","Other"] as const).map(d => (
                        <MenuItem key={d} value={d}>{t(`documents.types.${d}`)}</MenuItem>
                      ))}
                    </SearchableTextField>
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

          {/* Linked entities — the operator's map into the rest of the app.
              Clicking either row navigates to the underlying record and
              closes the drawer, so a document can never be an orphan. */}
          <Stack spacing={0.5} sx={{ px: 2, py: 1.5, bgcolor: "background.default" }}>
            <Typography sx={{
              fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
              color: "text.secondary", fontWeight: 700, mb: 0.5
            }}>
              Συνδέεται με
            </Typography>
            {/* Policy row */}
            <Box
              onClick={() => {
                if (!doc.policyId) return;
                navigate(`/app/policies?documentPolicyId=${doc.policyId}`);
                onClose();
              }}
              sx={{
                display: "flex", alignItems: "center", gap: 1.25,
                px: 1, py: 1, borderRadius: 1.5,
                cursor: doc.policyId ? "pointer" : "default",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                transition: "border-color 160ms, background-color 160ms",
                "&:hover": doc.policyId ? {
                  borderColor: "primary.main",
                  bgcolor: "action.hover"
                } : undefined
              }}
            >
              <ArticleIcon color="primary" fontSize="small" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">Συμβόλαιο</Typography>
                <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }} noWrap>
                  {doc.policyNumber || "—"}
                </Typography>
              </Box>
              {doc.policyId && <ArrowForwardIcon fontSize="small" color="action" />}
            </Box>
            {/* Customer row */}
            <Box
              onClick={() => {
                if (!doc.customerId) return;
                navigate(`/app/customers/${doc.customerId}`);
                onClose();
              }}
              sx={{
                display: "flex", alignItems: "center", gap: 1.25,
                px: 1, py: 1, borderRadius: 1.5, mt: 0.5,
                cursor: doc.customerId ? "pointer" : "default",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                transition: "border-color 160ms, background-color 160ms",
                "&:hover": doc.customerId ? {
                  borderColor: "primary.main",
                  bgcolor: "action.hover"
                } : undefined
              }}
            >
              <PersonIcon color="primary" fontSize="small" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">Πελάτης</Typography>
                <Typography fontWeight={700} noWrap>
                  {doc.customerDisplay || "—"}
                </Typography>
              </Box>
              {doc.customerId && <ArrowForwardIcon fontSize="small" color="action" />}
            </Box>
            {/* Copy-direct-link row (nice-to-have for sharing internally) */}
            <Box
              onClick={async () => {
                try {
                  const url = `${window.location.origin}/app/documents#doc=${doc.id}`;
                  await navigator.clipboard.writeText(url);
                } catch { /* clipboard blocked — ignore */ }
              }}
              sx={{
                display: "flex", alignItems: "center", gap: 1.25,
                px: 1, py: 0.75, borderRadius: 1.5, mt: 0.25,
                cursor: "pointer",
                color: "text.secondary",
                "&:hover": { color: "primary.main" }
              }}
            >
              <LinkIcon fontSize="small" />
              <Typography variant="caption">Αντιγραφή εσωτερικού συνδέσμου</Typography>
            </Box>
          </Stack>
          <Divider />

          {/* Preview surface — fills the remaining drawer height. */}
          <Box sx={{
            flex: 1,
            bgcolor: "action.hover",
            display: "flex", alignItems: "stretch", justifyContent: "stretch",
            overflow: "hidden"
          }}>
            {previewLoading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
                <CircularProgress />
              </Stack>
            ) : canInlinePreview && previewObjectUrl ? (
              <Box
                component="iframe"
                src={previewObjectUrl}
                title={doc.fileName}
                sx={{ flex: 1, border: 0, width: "100%", height: "100%", bgcolor: "background.paper" }}
              />
            ) : (
              <Stack alignItems="center" justifyContent="center" spacing={2}
                sx={{ flex: 1, p: 4, textAlign: "center" }}>
                <MimeIcon mime={doc.mimeType} sx={{ fontSize: 64 }} />
                <Typography variant="h6" fontWeight={700}>
                  {canInlinePreview ? "Δεν φορτώθηκε η προεπισκόπηση" : "Δεν υπάρχει προεπισκόπηση"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                  {canInlinePreview
                    ? "Δοκιμάστε ξανά ή κατεβάστε το αρχείο για να το ανοίξετε στην κατάλληλη εφαρμογή."
                    : `Ο τύπος «${doc.mimeType}» δεν υποστηρίζεται από τον browser για inline προβολή. Κατεβάστε το αρχείο για να το ανοίξετε στην κατάλληλη εφαρμογή.`}
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
          <SearchableTextField
            select required fullWidth label={t("documents.upload.type")}
            value={type} onChange={(e) => setType(e.target.value as DocumentType)}
          >
            {(["Policy","GreenCard","Roadside","Invoice","Other"] as const).map(d =>
              <MenuItem key={d} value={d}>{t(`documents.types.${d}`)}</MenuItem>
            )}
          </SearchableTextField>
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
