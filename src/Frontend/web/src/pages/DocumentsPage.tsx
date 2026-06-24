import { useState } from "react";
import { HelpHint } from "../components/HelpHint";
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
  IconButton,
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
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";

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
  const [error, setError] = useState<string | null>(null);

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

  const rows = docsQuery.data ?? [];
  const isCustomer = user?.role === "Customer";

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
                  <TableRow key={d.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <InsertDriveFileIcon color="action" />
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
                    <TableCell sx={{ fontSize: 13 }}>{new Date(d.createdAt).toLocaleDateString("el-GR")}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
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
    </Box>
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
          <TextField
            select required fullWidth label={t("documents.upload.policy")}
            value={policyId} onChange={(e) => setPolicyId(e.target.value)}
          >
            {(policiesQuery.data ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.policyNumber} · {p.customerDisplay}</MenuItem>
            ))}
          </TextField>
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
