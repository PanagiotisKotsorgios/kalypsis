import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VerifiedIcon from "@mui/icons-material/Verified";
import LocalPoliceIcon from "@mui/icons-material/LocalPolice";
import CloseIcon from "@mui/icons-material/Close";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

interface Policy {
  id: string;
  policyNumber: string;
  policyType: string;
  insuranceCompanyName: string;
  insuranceCompanyId: string;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  status: string;
  customerDisplay: string;
}

interface DocumentDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  documentType: string;
  policyId: string;
  createdAt: string;
}

export function CustomerContractDetailsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const policyQuery = useQuery({
    queryKey: ["policy", id],
    queryFn: async () => (await api.get<Policy>(`/policies/${id}`)).data,
    enabled: !!id
  });

  const documentsQuery = useQuery({
    queryKey: ["policy-documents", id],
    queryFn: async () => (await api.get<DocumentDto[]>("/documents", { params: { policyId: id } })).data,
    enabled: !!id
  });

  const [previewDoc, setPreviewDoc] = useState<DocumentDto | null>(null);
  const [policeMode, setPoliceMode] = useState(false);

  if (policyQuery.isLoading || !policyQuery.data) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (policyQuery.isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {t("contractDetails.loadError")}
        <Button onClick={() => navigate("/app/policies")} sx={{ ml: 2 }}>{t("nav.back")}</Button>
      </Alert>
    );
  }

  const p = policyQuery.data;
  const documents = documentsQuery.data ?? [];
  const days = Math.ceil((new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isInForce = p.status === "Active" && days > 0;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        {t("nav.back")}
      </Button>

      {/* Summary card */}
      <Card sx={{ mb: 3, borderRadius: 4, overflow: "hidden" }}>
        <Box
          sx={{
            background: "linear-gradient(135deg, #0b2545 0%, #1d4e89 60%, #1ea7e1 130%)",
            color: "common.white",
            p: { xs: 3, md: 4 }
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={2}>
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                <Chip label={p.policyNumber} sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "common.white", fontWeight: 700 }} />
                {isInForce && (
                  <Chip
                    icon={<VerifiedIcon sx={{ color: "common.white !important" }} />}
                    label={t("contractDetails.inForce")}
                    sx={{ bgcolor: "rgba(123,226,149,0.25)", color: "common.white", fontWeight: 700, border: "1px solid rgba(123,226,149,0.6)" }}
                  />
                )}
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.15, mb: 0.5 }}>
                {p.insuranceCompanyName}
              </Typography>
              <Typography sx={{ opacity: 0.92 }}>
                {t(`policies.types.${p.policyType}`)}
              </Typography>
            </Box>
            <Button
              variant="contained" color="secondary" size="large"
              startIcon={<LocalPoliceIcon />}
              onClick={() => setPoliceMode(true)}
              sx={{ fontWeight: 700, px: 3, py: 1.5, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
            >
              {t("contractDetails.policeMode")}
            </Button>
          </Stack>
        </Box>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
            }}
          >
            <Field label={t("contractDetails.customer")} value={p.customerDisplay} />
            <Field label={t("contractDetails.startDate")} value={p.startDate} />
            <Field label={t("contractDetails.endDate")} value={p.endDate} highlight={days > 0 && days <= 30 ? "warn" : undefined} />
            <Field
              label={t("contractDetails.premium")}
              value={`${p.premium.toLocaleString("el-GR", { minimumFractionDigits: 2 })} ${p.currency}`}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            {t("contractDetails.documents")}
          </Typography>

          {documentsQuery.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>
          ) : documents.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
              <InsertDriveFileIcon sx={{ fontSize: 48, opacity: 0.4, mb: 1 }} />
              <Typography>{t("contractDetails.noDocuments")}</Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {documents.map((d) => (
                <DocumentRow key={d.id} doc={d} onPreview={() => setPreviewDoc(d)} />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <DocumentPreviewDialog
        open={!!previewDoc}
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <PoliceModeDialog
        open={policeMode}
        onClose={() => setPoliceMode(false)}
        policy={p}
        userName={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
        isInForce={isInForce}
      />
    </Box>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: "warn" }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 17, color: highlight === "warn" ? "warning.main" : "text.primary" }}>
        {value}
      </Typography>
    </Box>
  );
}

/* ====================== Document row ====================== */

function DocumentRow({ doc, onPreview }: { doc: DocumentDto; onPreview: () => void }) {
  const { t } = useTranslation();
  const isPdf = doc.mimeType.includes("pdf") || doc.fileName.toLowerCase().endsWith(".pdf");
  const isImage = doc.mimeType.startsWith("image/");

  const download = async () => {
    const res = await api.get<Blob>(`/documents/${doc.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const print = async () => {
    const res = await api.get<Blob>(`/documents/${doc.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const w = window.open(url, "_blank");
    if (w) {
      w.addEventListener("load", () => {
        try { w.print(); } catch { /* user can print from viewer toolbar */ }
      });
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        transition: "border-color 200ms",
        "&:hover": { borderColor: "primary.main" }
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: isPdf ? "rgba(192,57,43,0.10)" : "rgba(11,37,69,0.06)",
            color: isPdf ? "#c0392b" : "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            alignSelf: { xs: "center", sm: "auto" }
          }}
        >
          {isPdf ? <PictureAsPdfIcon sx={{ fontSize: 32 }} /> : <InsertDriveFileIcon sx={{ fontSize: 32 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{doc.fileName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t(`documents.types.${doc.documentType}`)} · {Math.round(doc.sizeBytes / 1024)} KB · {new Date(doc.createdAt).toLocaleDateString("el-GR")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} justifyContent={{ xs: "center", sm: "flex-end" }}>
          {(isPdf || isImage) && (
            <Button startIcon={<VisibilityIcon />} variant="contained" size="medium" onClick={onPreview}>
              {t("contractDetails.view")}
            </Button>
          )}
          <Button startIcon={<DownloadIcon />} variant="outlined" size="medium" onClick={download}>
            {t("contractDetails.download")}
          </Button>
          {isPdf && (
            <Button startIcon={<PrintIcon />} variant="outlined" size="medium" onClick={print}>
              {t("contractDetails.print")}
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

/* ====================== PDF / image inline preview ====================== */

function DocumentPreviewDialog({
  open,
  doc,
  onClose
}: {
  open: boolean;
  doc: DocumentDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (doc && open) {
      setLoading(true);
      api.get<Blob>(`/documents/${doc.id}/download`, { responseType: "blob" })
        .then((res) => {
          if (cancelled) return;
          const objectUrl = window.URL.createObjectURL(res.data);
          blobRef.current = objectUrl;
          setUrl(objectUrl);
        })
        .finally(() => !cancelled && setLoading(false));
    }
    return () => {
      cancelled = true;
      if (blobRef.current) {
        window.URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      setUrl(null);
    };
  }, [doc, open]);

  if (!doc) return null;
  const isImage = doc.mimeType.startsWith("image/");

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
          <Typography sx={{ flex: 1, fontWeight: 700 }} noWrap>{doc.fileName}</Typography>
          <Button
            size="small" startIcon={<DownloadIcon />}
            onClick={async () => {
              if (!url) return;
              const a = document.createElement("a");
              a.href = url;
              a.download = doc.fileName;
              a.click();
            }}
          >
            {t("contractDetails.download")}
          </Button>
          <Button
            size="small" startIcon={<PrintIcon />}
            onClick={() => {
              if (!url) return;
              const w = window.open(url, "_blank");
              if (w) w.addEventListener("load", () => { try { w.print(); } catch { /* noop */ } });
            }}
          >
            {t("contractDetails.print")}
          </Button>
        </Box>
        <DialogContent sx={{ flex: 1, p: 0, bgcolor: "#222" }}>
          {loading || !url ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <CircularProgress />
            </Box>
          ) : isImage ? (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
              <Box component="img" src={url} alt={doc.fileName} sx={{ maxWidth: "100%", maxHeight: "100%" }} />
            </Box>
          ) : (
            <Box component="iframe" src={url} title={doc.fileName} sx={{ width: "100%", height: "100%", border: 0 }} />
          )}
        </DialogContent>
      </Box>
    </Dialog>
  );
}

/* ====================== POLICE MODE ====================== */

function PoliceModeDialog({
  open,
  onClose,
  policy,
  userName,
  isInForce
}: {
  open: boolean;
  onClose: () => void;
  policy: Policy;
  userName: string;
  isInForce: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0b2545 0%, #1d4e89 100%)",
          color: "common.white",
          p: { xs: 2, md: 4 }
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <LocalPoliceIcon sx={{ fontSize: 32 }} />
            <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.85 }}>
              {t("policeMode.eyebrow")}
            </Typography>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: "common.white" }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ textAlign: "center", maxWidth: 760, width: "100%" }}>
            {isInForce && (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 3, py: 1.5,
                  borderRadius: 999,
                  bgcolor: "rgba(123,226,149,0.16)",
                  border: "2px solid rgba(123,226,149,0.7)",
                  mb: 4
                }}
              >
                <VerifiedIcon sx={{ fontSize: 32, color: "#7be295" }} />
                <Typography sx={{ fontWeight: 900, fontSize: 22, color: "#7be295", letterSpacing: 0.5 }}>
                  {t("policeMode.active")}
                </Typography>
              </Box>
            )}

            <Typography
              sx={{
                fontSize: { xs: 16, md: 20 },
                letterSpacing: 4,
                opacity: 0.7,
                mb: 1
              }}
            >
              {t("policeMode.policyNumber")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "monospace",
                fontWeight: 900,
                fontSize: { xs: 56, md: 96 },
                lineHeight: 1,
                letterSpacing: -2,
                mb: 4
              }}
            >
              {policy.policyNumber}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: { xs: 2, md: 3 },
                textAlign: "left",
                bgcolor: "rgba(255,255,255,0.08)",
                p: { xs: 2.5, md: 4 },
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.15)"
              }}
            >
              <PoliceField label={t("policeMode.holder")} value={userName || policy.customerDisplay} />
              <PoliceField label={t("policeMode.carrier")} value={policy.insuranceCompanyName} />
              <PoliceField label={t("policeMode.type")} value={t(`policies.types.${policy.policyType}`)} />
              <PoliceField label={t("policeMode.dates")} value={`${policy.startDate} → ${policy.endDate}`} />
            </Box>

            <Typography sx={{ opacity: 0.6, fontSize: 13, letterSpacing: 1.5, mt: 4 }}>
              {t("policeMode.footer")}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}

function PoliceField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ opacity: 0.55, fontSize: 11, letterSpacing: 2, mb: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, md: 22 }, lineHeight: 1.3 }}>{value}</Typography>
    </Box>
  );
}
