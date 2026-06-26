import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

type RegistrationStatus = "New" | "Reviewing" | "Approved" | "Rejected";

interface RegistrationSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string | null;
  city: string | null;
  referenceCode: string;
  status: RegistrationStatus;
  submittedAt: string;
}

interface RegistrationDetail extends RegistrationSummary {
  vatNumber: string | null;
  licenseNumber: string | null;
  message: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  ipAddress: string | null;
}

interface RegistrationStats {
  total: number;
  new: number;
  reviewing: number;
  approved: number;
  rejected: number;
}

const STATUS_FILTERS: { value: "" | RegistrationStatus; key: string }[] = [
  { value: "",          key: "registrations.filter.all" },
  { value: "New",       key: "registrations.status.New" },
  { value: "Reviewing", key: "registrations.status.Reviewing" },
  { value: "Approved",  key: "registrations.status.Approved" },
  { value: "Rejected",  key: "registrations.status.Rejected" }
];

function statusColor(s: RegistrationStatus): "default" | "info" | "warning" | "success" | "error" {
  switch (s) {
    case "New":       return "info";
    case "Reviewing": return "warning";
    case "Approved":  return "success";
    case "Rejected":  return "error";
    default:          return "default";
  }
}

export function PlatformRegistrationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"" | RegistrationStatus>("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Debounce so each keystroke doesn't fire a query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ["registration-requests", statusFilter, debounced],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (debounced)    params.set("search", debounced);
      const url = params.toString()
        ? `/platform/registration-requests?${params.toString()}`
        : "/platform/registration-requests";
      return (await api.get<RegistrationSummary[]>(url)).data;
    }
  });

  const stats = useQuery({
    queryKey: ["registration-requests", "stats"],
    queryFn: async () => (await api.get<RegistrationStats>("/platform/registration-requests/stats")).data
  });

  const fmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language || "el-GR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }),
    [i18n.language]
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("registrations.title")}</Typography>
          <Typography color="text.secondary">{t("registrations.subtitle")}</Typography>
        </Box>
        <Tooltip title={t("common.refresh")}>
          <IconButton onClick={() => {
            void qc.invalidateQueries({ queryKey: ["registration-requests"] });
          }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Stats strip — totals + per-status counts. */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" }
      }}>
        <StatCard label={t("registrations.stats.total")}     value={stats.data?.total ?? 0}     color="default" />
        <StatCard label={t("registrations.status.New")}       value={stats.data?.new ?? 0}       color="info" />
        <StatCard label={t("registrations.status.Reviewing")} value={stats.data?.reviewing ?? 0} color="warning" />
        <StatCard label={t("registrations.status.Approved")}  value={stats.data?.approved ?? 0}  color="success" />
        <StatCard label={t("registrations.status.Rejected")}  value={stats.data?.rejected ?? 0}  color="error" />
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <ToggleButtonGroup
            exclusive size="small" color="primary" value={statusFilter}
            onChange={(_, v) => v !== null && setStatusFilter(v)}
            sx={{ flexWrap: "wrap" }}
          >
            {STATUS_FILTERS.map(s => (
              <ToggleButton key={s.value || "all"} value={s.value}>{t(s.key)}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("registrations.searchPlaceholder")}
            sx={{ minWidth: { xs: "100%", md: 320 } }}
          />
        </Stack>
      </Card>

      {list.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("registrations.col.ref")}</TableCell>
                <TableCell>{t("registrations.col.name")}</TableCell>
                <TableCell>{t("registrations.col.contact")}</TableCell>
                <TableCell>{t("registrations.col.organization")}</TableCell>
                <TableCell>{t("registrations.col.submitted")}</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(list.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 6 }}>
                    {t("registrations.empty")}
                  </TableCell>
                </TableRow>
              )}
              {(list.data ?? []).map(r => (
                <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(r.id)}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.referenceCode}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{r.firstName} {r.lastName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography fontSize={13}>{r.email}</Typography>
                      <Typography fontSize={12.5} color="text.secondary">{r.phone}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography fontSize={13}>{r.organizationName ?? "—"}</Typography>
                      {r.city && <Typography fontSize={12.5} color="text.secondary">{r.city}</Typography>}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, color: "text.secondary" }}>
                    {fmt.format(new Date(r.submittedAt))}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColor(r.status)} label={t(`registrations.status.${r.status}`)} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>
                      <VisibilityOutlinedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <DetailDialog
        id={openId}
        onClose={() => setOpenId(null)}
        onAfterSave={() => {
          void qc.invalidateQueries({ queryKey: ["registration-requests"] });
        }}
      />
    </Box>
  );
}

function StatCard({ label, value, color }: {
  label: string; value: number;
  color: "default" | "info" | "warning" | "success" | "error";
}) {
  const dotBg: Record<typeof color, string> = {
    default: "rgba(11,37,69,0.10)",
    info:    "rgba(31,123,179,0.15)",
    warning: "rgba(237,153,9,0.18)",
    success: "rgba(34,140,87,0.18)",
    error:   "rgba(196,53,53,0.18)"
  };
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: dotBg[color] }} />
        <Typography fontSize={12} color="text.secondary" sx={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 0.5 }}>{value}</Typography>
    </Card>
  );
}

function DetailDialog({ id, onClose, onAfterSave }: {
  id: string | null;
  onClose: () => void;
  onAfterSave: () => void;
}) {
  const { t, i18n } = useTranslation();
  const open = !!id;
  const [status, setStatus] = useState<RegistrationStatus>("New");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["registration-requests", "detail", id],
    queryFn: async () => (await api.get<RegistrationDetail>(`/platform/registration-requests/${id}`)).data,
    enabled: open
  });

  useEffect(() => {
    if (detail.data) {
      setStatus(detail.data.status);
      setNotes(detail.data.reviewNotes ?? "");
    } else {
      setStatus("New");
      setNotes("");
    }
    setErr(null);
  }, [detail.data]);

  const save = useMutation({
    mutationFn: async () => (await api.patch(
      `/platform/registration-requests/${id}/status`,
      { status, reviewNotes: notes.trim() || null }
    )).data,
    onSuccess: () => { onAfterSave(); onClose(); },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const fmt = (s: string | null) => s
    ? new Intl.DateTimeFormat(i18n.language || "el-GR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      }).format(new Date(s))
    : "—";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Box>
            <Typography fontSize={20} fontWeight={800}>
              {detail.data ? `${detail.data.firstName} ${detail.data.lastName}` : t("registrations.detail.title")}
            </Typography>
            {detail.data && (
              <Typography fontSize={13} sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                {detail.data.referenceCode}
              </Typography>
            )}
          </Box>
          {detail.data && (
            <Chip size="small" color={statusColor(detail.data.status)}
              label={t(`registrations.status.${detail.data.status}`)} />
          )}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {detail.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : detail.data ? (
          <Stack spacing={3}>
            <Box sx={{
              display: "grid", gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }
            }}>
              <DetailRow icon={<EmailOutlinedIcon fontSize="small" />} label={t("register.email")}        value={detail.data.email} />
              <DetailRow icon={<PhoneOutlinedIcon fontSize="small" />} label={t("register.phone")}        value={detail.data.phone} />
              <DetailRow icon={<BusinessOutlinedIcon fontSize="small" />} label={t("register.organizationName")} value={detail.data.organizationName ?? "—"} />
              <DetailRow icon={<PlaceOutlinedIcon fontSize="small" />}   label={t("register.city")}        value={detail.data.city ?? "—"} />
              <DetailRow icon={<BadgeOutlinedIcon fontSize="small" />}   label={t("register.vat")}         value={detail.data.vatNumber ?? "—"} />
              <DetailRow icon={<ReceiptOutlinedIcon fontSize="small" />} label={t("register.licenseNumber")} value={detail.data.licenseNumber ?? "—"} />
            </Box>

            {detail.data.message && (
              <Box>
                <Typography fontSize={12} sx={{ letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary" }}>
                  {t("register.message")}
                </Typography>
                <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {detail.data.message}
                </Typography>
              </Box>
            )}

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ color: "text.secondary", fontSize: 13 }}>
              <span>{t("registrations.detail.submittedAt")}: <strong>{fmt(detail.data.submittedAt)}</strong></span>
              <span>{t("registrations.detail.reviewedAt")}: <strong>{fmt(detail.data.reviewedAt)}</strong></span>
              {detail.data.ipAddress && (
                <span>IP: <strong style={{ fontFamily: "monospace" }}>{detail.data.ipAddress}</strong></span>
              )}
            </Stack>

            <Box>
              <Typography fontSize={14} fontWeight={700} mb={1.5}>{t("registrations.detail.reviewSection")}</Typography>
              <Stack spacing={2}>
                <TextField
                  select size="small" label={t("common.status")}
                  value={status} onChange={(e) => setStatus(e.target.value as RegistrationStatus)}
                  sx={{ maxWidth: 280 }}
                >
                  {(["New","Reviewing","Approved","Rejected"] as RegistrationStatus[]).map(s => (
                    <MenuItem key={s} value={s}>{t(`registrations.status.${s}`)}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={t("registrations.detail.reviewNotes")}
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  multiline minRows={3} fullWidth
                  helperText={t("registrations.detail.reviewNotesHelp")}
                />
              </Stack>
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
        <Button variant="contained" disabled={!detail.data || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ color: "text.secondary", mt: 0.25 }}>{icon}</Box>
      <Box>
        <Typography fontSize={12} color="text.secondary" sx={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </Typography>
        <Typography fontSize={15} sx={{ fontWeight: 600 }}>{value}</Typography>
      </Box>
    </Stack>
  );
}
