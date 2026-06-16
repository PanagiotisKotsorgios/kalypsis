import { useEffect, useState } from "react";
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
  Divider,
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
import AddIcon from "@mui/icons-material/Add";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CarCrashIcon from "@mui/icons-material/CarCrash";
import DescriptionIcon from "@mui/icons-material/Description";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import EditNoteIcon from "@mui/icons-material/EditNote";
import DownloadIcon from "@mui/icons-material/Download";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";

type ServiceRequestType = "NewPolicy" | "AccidentReport" | "DocumentRequest" | "PolicyChange" | "GeneralQuestion";
type ServiceRequestStatus = "Submitted" | "InReview" | "AwaitingCustomerInfo" | "Resolved" | "Closed" | "Rejected";
type AttachmentCategory = "DrivingLicense" | "VehicleRegistration" | "AccidentPhoto" | "AccidentReport" | "IdCard" | "Other";

interface AttachmentDto {
  id: string;
  category: AttachmentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface RequestDto {
  id: string;
  requestNumber: string;
  customerId: string;
  customerDisplay: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  subject: string;
  description: string;
  relatedPolicyId: string | null;
  incidentDate: string | null;
  incidentLocation: string | null;
  otherPartyInfo: string | null;
  agencyNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  attachments: AttachmentDto[];
}

interface CreateBody {
  type: ServiceRequestType;
  subject: string;
  description: string;
  incidentDate?: string;
  incidentLocation?: string;
  otherPartyInfo?: string;
  customerId?: string;
}

const TYPE_META: Record<ServiceRequestType, { icon: React.ReactNode; color: string }> = {
  NewPolicy: { icon: <DescriptionIcon />, color: "#0b2545" },
  PolicyChange: { icon: <EditNoteIcon />, color: "#1d4e89" },
  AccidentReport: { icon: <CarCrashIcon />, color: "#c0392b" },
  DocumentRequest: { icon: <AttachFileIcon />, color: "#1ea7e1" },
  GeneralQuestion: { icon: <HelpOutlineIcon />, color: "#7f8c8d" }
};

const STATUS_COLOR: Record<ServiceRequestStatus, "default" | "info" | "warning" | "success" | "error"> = {
  Submitted: "info",
  InReview: "warning",
  AwaitingCustomerInfo: "warning",
  Resolved: "success",
  Closed: "default",
  Rejected: "error"
};

export function RequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isCustomer = user?.role === "Customer";
  const isAgency = user?.role === "AgencyAdmin" || user?.role === "AgencyUser";

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RequestDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["service-requests"],
    queryFn: async () => (await api.get<RequestDto[]>("/service-requests")).data
  });

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) =>
      (await api.post<RequestDto>("/service-requests", body)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      setOpen(false);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const rows = requestsQuery.data ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {isCustomer ? t("requests.customerTitle") : t("requests.agencyTitle")}
          </Typography>
          <Typography color="text.secondary">
            {isCustomer ? t("requests.customerLead") : t("requests.agencyLead")}
          </Typography>
        </Box>
        {isCustomer && (
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => { setError(null); setOpen(true); }}
          >
            {t("requests.newRequest")}
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {requestsQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">{t("requests.noRequests")}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("requests.col.number")}</TableCell>
                  <TableCell>{t("requests.col.type")}</TableCell>
                  <TableCell>{t("requests.col.subject")}</TableCell>
                  {isAgency && <TableCell>{t("requests.col.customer")}</TableCell>}
                  <TableCell>{t("requests.col.status")}</TableCell>
                  <TableCell>{t("requests.col.created")}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => setDetail(r)}>
                    <TableCell><Chip label={r.requestNumber} size="small" variant="outlined" /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ color: TYPE_META[r.type].color, display: "flex" }}>{TYPE_META[r.type].icon}</Box>
                        <Typography>{t(`requests.types.${r.type}`)}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography sx={{ fontWeight: 600 }}>{r.subject}</Typography></TableCell>
                    {isAgency && <TableCell>{r.customerDisplay}</TableCell>}
                    <TableCell>
                      <Chip
                        label={t(`requests.statuses.${r.status}`)}
                        size="small"
                        color={STATUS_COLOR[r.status]}
                      />
                    </TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString("el-GR")}</TableCell>
                    <TableCell>
                      {r.attachments.length > 0 && (
                        <Chip
                          icon={<AttachFileIcon />}
                          label={r.attachments.length}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <CreateRequestDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(b) => createMutation.mutate(b)}
        submitting={createMutation.isPending}
      />

      <RequestDetailDialog
        request={detail}
        onClose={() => setDetail(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ["service-requests"] })}
        isAgency={isAgency}
      />
    </Box>
  );
}

/* ====================== Create dialog ====================== */

interface CreateProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (b: CreateBody) => void;
  submitting: boolean;
}

function CreateRequestDialog({ open, onClose, onSubmit, submitting }: CreateProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState<CreateBody>({
    type: "NewPolicy",
    subject: "",
    description: ""
  });

  const isAccident = body.type === "AccidentReport";

  const handleSubmit = () => {
    onSubmit({
      ...body,
      incidentDate: isAccident ? body.incidentDate : undefined,
      incidentLocation: isAccident ? body.incidentLocation : undefined,
      otherPartyInfo: isAccident ? body.otherPartyInfo : undefined
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("requests.create.title")}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("requests.create.subtitle")}
        </Typography>
        <Stack spacing={2.5} mt={1}>
          <TextField
            select
            label={t("requests.create.type")}
            value={body.type}
            onChange={(e) => setBody({ ...body, type: e.target.value as ServiceRequestType })}
            fullWidth
          >
            <MenuItem value="NewPolicy">{t("requests.types.NewPolicy")}</MenuItem>
            <MenuItem value="AccidentReport">{t("requests.types.AccidentReport")}</MenuItem>
            <MenuItem value="DocumentRequest">{t("requests.types.DocumentRequest")}</MenuItem>
            <MenuItem value="PolicyChange">{t("requests.types.PolicyChange")}</MenuItem>
            <MenuItem value="GeneralQuestion">{t("requests.types.GeneralQuestion")}</MenuItem>
          </TextField>
          <TextField
            label={t("requests.create.subject")}
            value={body.subject}
            onChange={(e) => setBody({ ...body, subject: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label={t("requests.create.description")}
            value={body.description}
            onChange={(e) => setBody({ ...body, description: e.target.value })}
            fullWidth
            required
            multiline
            rows={4}
            helperText={t("requests.create.descriptionHelp")}
          />

          {isAccident && (
            <>
              <Divider sx={{ my: 1 }}>{t("requests.create.accidentSection")}</Divider>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  type="date"
                  label={t("requests.create.incidentDate")}
                  value={body.incidentDate ?? ""}
                  onChange={(e) => setBody({ ...body, incidentDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
                <TextField
                  label={t("requests.create.incidentLocation")}
                  value={body.incidentLocation ?? ""}
                  onChange={(e) => setBody({ ...body, incidentLocation: e.target.value })}
                  fullWidth
                  required
                />
              </Stack>
              <TextField
                label={t("requests.create.otherParty")}
                value={body.otherPartyInfo ?? ""}
                onChange={(e) => setBody({ ...body, otherPartyInfo: e.target.value })}
                fullWidth
                multiline
                rows={2}
                helperText={t("requests.create.otherPartyHelp")}
              />
            </>
          )}

          <Alert severity="info" sx={{ mt: 1 }}>
            {t("requests.create.attachmentsAfterCreate")}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !body.subject.trim() || body.description.trim().length < 10}
        >
          {submitting ? <CircularProgress size={18} /> : t("requests.create.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ====================== Detail dialog ====================== */

interface DetailProps {
  request: RequestDto | null;
  onClose: () => void;
  onChanged: () => void;
  isAgency: boolean;
}

function RequestDetailDialog({ request, onClose, onChanged, isAgency }: DetailProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>("DrivingLicense");
  const [uploading, setUploading] = useState(false);
  const [newStatus, setNewStatus] = useState<ServiceRequestStatus>("Submitted");
  const [agencyNotes, setAgencyNotes] = useState("");

  useEffect(() => {
    if (request) {
      setNewStatus(request.status);
      setAgencyNotes(request.agencyNotes ?? "");
    }
  }, [request?.id, request?.status, request?.agencyNotes]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: ServiceRequestStatus; notes: string }) =>
      (await api.put<RequestDto>(`/service-requests/${id}/status`, { status, agencyNotes: notes })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      onChanged();
    }
  });

  if (!request) return null;
  const isAccident = request.type === "AccidentReport";

  const handleUpload = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      await api.post(`/service-requests/${request.id}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
    } catch (err) {
      setUploadError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const downloadAttachment = async (attId: string, fileName: string) => {
    const res = await api.get<Blob>(`/service-requests/attachments/${attId}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Chip label={request.requestNumber} variant="outlined" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {request.subject}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Chip
            label={t(`requests.statuses.${request.status}`)}
            color={STATUS_COLOR[request.status]}
          />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2
            }}
          >
            <DetailRow label={t("requests.detail.type")} value={t(`requests.types.${request.type}`)} />
            <DetailRow label={t("requests.detail.customer")} value={request.customerDisplay} />
            <DetailRow
              label={t("requests.detail.createdAt")}
              value={new Date(request.createdAt).toLocaleString("el-GR")}
            />
            {request.resolvedAt && (
              <DetailRow
                label={t("requests.detail.resolvedAt")}
                value={new Date(request.resolvedAt).toLocaleString("el-GR")}
              />
            )}
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">{t("requests.detail.description")}</Typography>
            <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{request.description}</Typography>
          </Box>

          {isAccident && (request.incidentDate || request.incidentLocation || request.otherPartyInfo) && (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary">{t("requests.detail.accidentInfo")}</Typography>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {request.incidentDate && <Typography><strong>{t("requests.create.incidentDate")}:</strong> {request.incidentDate}</Typography>}
                  {request.incidentLocation && <Typography><strong>{t("requests.create.incidentLocation")}:</strong> {request.incidentLocation}</Typography>}
                  {request.otherPartyInfo && (
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>
                      <strong>{t("requests.create.otherParty")}:</strong> {request.otherPartyInfo}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </>
          )}

          <Divider />

          {/* Attachments */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="overline" color="text.secondary">{t("requests.detail.attachments")}</Typography>
            </Stack>

            {request.attachments.length === 0 ? (
              <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                {t("requests.detail.noAttachments")}
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {request.attachments.map((a) => (
                  <Card key={a.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <AttachFileIcon color="action" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>{a.fileName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`requests.attachmentCategories.${a.category}`)} · {Math.round(a.sizeBytes / 1024)} KB · {new Date(a.createdAt).toLocaleDateString("el-GR")}
                        </Typography>
                      </Box>
                      <IconButton onClick={() => downloadAttachment(a.id, a.fileName)} size="small">
                        <DownloadIcon />
                      </IconButton>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}

            {/* Upload */}
            {request.status !== "Closed" && (
              <Card variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t("requests.detail.uploadTitle")}
                </Typography>
                {uploadError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
                    {uploadError}
                  </Alert>
                )}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                  <TextField
                    select
                    size="small"
                    label={t("requests.detail.attachmentCategory")}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AttachmentCategory)}
                    fullWidth
                  >
                    <MenuItem value="DrivingLicense">{t("requests.attachmentCategories.DrivingLicense")}</MenuItem>
                    <MenuItem value="VehicleRegistration">{t("requests.attachmentCategories.VehicleRegistration")}</MenuItem>
                    <MenuItem value="AccidentPhoto">{t("requests.attachmentCategories.AccidentPhoto")}</MenuItem>
                    <MenuItem value="AccidentReport">{t("requests.attachmentCategories.AccidentReport")}</MenuItem>
                    <MenuItem value="IdCard">{t("requests.attachmentCategories.IdCard")}</MenuItem>
                    <MenuItem value="Other">{t("requests.attachmentCategories.Other")}</MenuItem>
                  </TextField>
                  <Button
                    component="label"
                    variant="contained"
                    startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <AttachFileIcon />}
                    disabled={uploading}
                  >
                    {t("requests.detail.uploadButton")}
                    <input
                      type="file"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </Button>
                </Stack>
              </Card>
            )}
          </Box>

          {/* Agency-side actions */}
          {isAgency && (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary">{t("requests.detail.agencyActions")}</Typography>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      select
                      label={t("requests.detail.changeStatus")}
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as ServiceRequestStatus)}
                      fullWidth
                    >
                      {(["Submitted", "InReview", "AwaitingCustomerInfo", "Resolved", "Closed", "Rejected"] as const).map(s => (
                        <MenuItem key={s} value={s}>{t(`requests.statuses.${s}`)}</MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      onClick={() => updateStatus.mutate({ id: request.id, status: newStatus, notes: agencyNotes })}
                      disabled={updateStatus.isPending}
                    >
                      {t("common.save")}
                    </Button>
                  </Stack>
                  <TextField
                    label={t("requests.detail.agencyNotes")}
                    value={agencyNotes}
                    onChange={(e) => setAgencyNotes(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                  />
                </Stack>
              </Box>
            </>
          )}

          {request.agencyNotes && !isAgency && (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary">{t("requests.detail.agencyMessage")}</Typography>
                <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{request.agencyNotes}</Typography>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

