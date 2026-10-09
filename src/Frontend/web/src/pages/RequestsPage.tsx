import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import SendIcon from "@mui/icons-material/Send";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

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

interface ServiceRequestMessageDto {
  id: string;
  authorRole: "Customer" | "Agency" | string;
  body: string;
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
  isRead: boolean;
  readAt: string | null;
  archivedAt: string | null;
  messages: ServiceRequestMessageDto[];
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
  const isAgency = user?.role === "AgencyAdmin" || user?.role === "AgencyOfficeAdmin" || user?.role === "AgencyUser";

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RequestDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RequestDto | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "" as ServiceRequestStatus | "",
    type: "" as ServiceRequestType | "",
    from: "",
    to: "",
    read: "" as "" | "read" | "unread",
    sort: "newest",
    includeArchived: false
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.read) params.set("isRead", String(filters.read === "read"));
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.includeArchived) params.set("includeArchived", "true");
    return params.toString();
  }, [filters]);

  const requestsQuery = useQuery({
    queryKey: ["service-requests", queryParams],
    queryFn: async () => (await api.get<RequestDto[]>(`/service-requests${queryParams ? `?${queryParams}` : ""}`)).data
  });

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) =>
      (await api.post<RequestDto>("/service-requests", body)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      setOpen(false);
      setSuccess(t("requests.actions.created"));
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const readMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) =>
      (await api.put<RequestDto>(`/service-requests/${id}/read`, { isRead })).data,
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      setSuccess(t(variables.isRead ? "requests.actions.markedRead" : "requests.actions.markedUnread"));
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      (await api.put<RequestDto>(`/service-requests/${id}/archive`, { archived })).data,
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      setSuccess(t(variables.archived ? "requests.actions.archived" : "requests.actions.unarchived"));
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/service-requests/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      setDeleteTarget(null);
      setDetail(null);
      setSuccess(t("requests.actions.deleted"));
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const rows = requestsQuery.data ?? [];
  const clearFilters = () => setFilters({ search: "", status: "", type: "", from: "", to: "", read: "", sort: "newest", includeArchived: false });

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} mb={1.25} flexWrap="wrap" gap={1}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {isCustomer ? t("requests.customerTitle") : t("requests.agencyTitle")}
            </Typography>
            <HelpHint id="page.requests" />
          </Stack>
          <Typography color="text.secondary">
            {isCustomer ? t("requests.customerLead") : t("requests.agencyLead")}
          </Typography>
        </Box>
        {isCustomer && (
          <Button
            variant="contained"
            size="small"
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
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {isAgency && (
        <Card sx={{ mb: 1.25 }}>
          <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ width: "100%" }}>
              <TextField
                size="small"
                label={t("requests.filters.search")}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                sx={{ flex: "1 1 220px", minWidth: { xs: "100%", sm: 190 } }}
              />
              <SearchableTextField
                select size="small" label={t("requests.filters.status")} value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as ServiceRequestStatus | "" })}
                sx={{ flex: "1 1 130px", minWidth: { xs: 125, sm: 130 } }}
              >
                <MenuItem value="">{t("requests.filters.all")}</MenuItem>
                {(["Submitted", "InReview", "AwaitingCustomerInfo", "Resolved", "Closed", "Rejected"] as const).map((s) => (
                  <MenuItem key={s} value={s}>{t(`requests.statuses.${s}`)}</MenuItem>
                ))}
              </SearchableTextField>
              <SearchableTextField
                select size="small" label={t("requests.filters.type")} value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value as ServiceRequestType | "" })}
                sx={{ flex: "1 1 135px", minWidth: { xs: 130, sm: 135 } }}
              >
                <MenuItem value="">{t("requests.filters.all")}</MenuItem>
                {(["NewPolicy", "AccidentReport", "DocumentRequest", "PolicyChange", "GeneralQuestion"] as const).map((type) => (
                  <MenuItem key={type} value={type}>{t(`requests.types.${type}`)}</MenuItem>
                ))}
              </SearchableTextField>
              <TextField size="small" type="date" label={t("requests.filters.from")} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ flex: "1 1 125px", minWidth: 120 }} />
              <TextField size="small" type="date" label={t("requests.filters.to")} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ flex: "1 1 125px", minWidth: 120 }} />
              <SearchableTextField
                select size="small" label={t("requests.filters.read")} value={filters.read}
                onChange={(e) => setFilters({ ...filters, read: e.target.value as "" | "read" | "unread" })}
                sx={{ flex: "1 1 120px", minWidth: 115 }}
              >
                <MenuItem value="">{t("requests.filters.all")}</MenuItem>
                <MenuItem value="unread">{t("requests.filters.unread")}</MenuItem>
                <MenuItem value="read">{t("requests.filters.readOnly")}</MenuItem>
              </SearchableTextField>
              <SearchableTextField select size="small" label={t("requests.filters.sort")} value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} sx={{ flex: "1 1 130px", minWidth: 125 }}>
                <MenuItem value="newest">{t("requests.filters.newest")}</MenuItem>
                <MenuItem value="oldest">{t("requests.filters.oldest")}</MenuItem>
                <MenuItem value="unread">{t("requests.filters.unreadFirst")}</MenuItem>
                <MenuItem value="status">{t("requests.filters.statusOrder")}</MenuItem>
              </SearchableTextField>
              <FormControlLabel
                control={<Checkbox size="small" checked={filters.includeArchived} onChange={(e) => setFilters({ ...filters, includeArchived: e.target.checked })} />}
                label={t("requests.filters.includeArchived")}
                sx={{ mr: 0, whiteSpace: "nowrap", flex: "0 1 auto" }}
              />
              <Button size="small" color="error" variant="contained" startIcon={<FilterAltIcon />} onClick={clearFilters} sx={{ whiteSpace: "nowrap" }}>{t("requests.filters.clear")}</Button>
            </Stack>
          </CardContent>
        </Card>
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
                  <TableCell>{isAgency && t("requests.colActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: "pointer", bgcolor: isAgency && !r.isRead ? "action.hover" : undefined }} onClick={() => { setDetail(r); if (isAgency && !r.isRead) readMutation.mutate({ id: r.id, isRead: true }); }}>
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
                    <TableCell>{date(r.createdAt)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
                        {r.attachments.length > 0 && <Chip icon={<AttachFileIcon />} label={r.attachments.length} size="small" variant="outlined" />}
                        {isAgency && (
                          <>
                            <IconButton size="small" title={t(r.isRead ? "requests.actions.markUnread" : "requests.actions.markRead")} onClick={(e) => { e.stopPropagation(); readMutation.mutate({ id: r.id, isRead: !r.isRead }); }}>
                              {r.isRead ? <MarkEmailUnreadIcon fontSize="small" /> : <MarkEmailReadIcon fontSize="small" />}
                            </IconButton>
                            <IconButton size="small" title={t(r.archivedAt ? "requests.actions.unarchive" : "requests.actions.archive")} onClick={(e) => { e.stopPropagation(); archiveMutation.mutate({ id: r.id, archived: !r.archivedAt }); }}>
                              {r.archivedAt ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                            </IconButton>
                            <IconButton color="error" size="small" title={t("requests.actions.delete")} onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </>
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

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("requests.actions.confirmDeleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography>{t("requests.actions.confirmDeleteBody")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</Button>
          <Button color="error" variant="contained" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}>
            {t("requests.actions.delete")}
          </Button>
        </DialogActions>
      </Dialog>
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
          <SearchableTextField
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
          </SearchableTextField>
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
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setNewStatus(request.status);
      setAgencyNotes(request.agencyNotes ?? "");
      setReply("");
      setReplyError(null);
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

  const replyMutation = useMutation({
    mutationFn: async ({ id, message, status }: { id: string; message: string; status: ServiceRequestStatus }) =>
      (await api.post<RequestDto>(`/service-requests/${id}/reply`, { message, status })).data,
    onSuccess: () => {
      setReply("");
      setReplyError(null);
      void qc.invalidateQueries({ queryKey: ["service-requests"] });
      onChanged();
    },
    onError: (err) => setReplyError(extractErrorMessage(err))
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

          <Box>
            <Typography variant="overline" color="text.secondary">{t("requests.detail.messages")}</Typography>
            {request.messages.length === 0 ? (
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>{t("requests.detail.noMessages")}</Typography>
            ) : (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {request.messages.map((message) => (
                  <Card key={message.id} variant="outlined" sx={{ p: 1.5, bgcolor: message.authorRole === "Agency" ? "rgba(30, 167, 225, 0.08)" : "background.paper" }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{message.authorRole === "Agency" ? t("requests.detail.agency") : t("requests.detail.customerMessage")}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(message.createdAt).toLocaleString("el-GR")}</Typography>
                    </Stack>
                    <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>{message.body}</Typography>
                  </Card>
                ))}
              </Stack>
            )}
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
                          {t(`requests.attachmentCategories.${a.category}`)} · {Math.round(a.sizeBytes / 1024)} KB · {date(a.createdAt)}
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
                  <SearchableTextField
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
                  </SearchableTextField>
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
                    <SearchableTextField
                      select
                      label={t("requests.detail.changeStatus")}
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as ServiceRequestStatus)}
                      fullWidth
                    >
                      {(["Submitted", "InReview", "AwaitingCustomerInfo", "Resolved", "Closed", "Rejected"] as const).map(s => (
                        <MenuItem key={s} value={s}>{t(`requests.statuses.${s}`)}</MenuItem>
                      ))}
                    </SearchableTextField>
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
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.75 }}>{t("requests.detail.replyTitle")}</Typography>
                    {replyError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setReplyError(null)}>{replyError}</Alert>}
                    <TextField
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={t("requests.detail.replyPlaceholder")}
                      helperText={t("requests.detail.replyHelp")}
                      fullWidth
                      multiline
                      minRows={3}
                    />
                    <Button
                      sx={{ mt: 1 }}
                      variant="contained"
                      startIcon={replyMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                      disabled={replyMutation.isPending || reply.trim().length < 1}
                      onClick={() => replyMutation.mutate({ id: request.id, message: reply.trim(), status: newStatus })}
                    >
                      {t("requests.detail.sendReply")}
                    </Button>
                  </Box>
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

