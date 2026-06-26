import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, IconButton, InputAdornment, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
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

/** Generates a memorable, copy-friendly temporary password — three groups
 *  separated by dashes (e.g. "Klp7-Wave-93Qx"). Long enough to satisfy the
 *  backend's 8-char minimum, short enough to read out over the phone. */
function suggestPassword(): string {
  const consonants = "BCDFGHJKLMNPQRSTVWXZ";
  const vowels = "AEIOU";
  const digits = "23456789";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const syllable = () => pick(consonants) + pick(vowels).toLowerCase() + pick(consonants).toLowerCase();
  const first  = "Klp" + pick(digits);
  const second = syllable().charAt(0).toUpperCase() + syllable().substring(1);
  const third  = pick(digits) + pick(digits) + pick(consonants).toLowerCase() + pick(vowels).toLowerCase();
  return `${first}-${second}-${third}`;
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

interface ApproveResult {
  request: RegistrationDetail;
  tenantId: string;
  tenantCode: string;
  userId: string;
  emailSent: boolean;
  emailError: string | null;
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

  // Approval-only state — kept in this dialog so it resets when the
  // selected request changes.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null);

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
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setSendWelcomeEmail(true);
    setApproveResult(null);
    setErr(null);
  }, [detail.data]);

  // When the admin flips status to Approved, drop in a strong default so the
  // common case is one click; they can override or regenerate before saving.
  useEffect(() => {
    if (status === "Approved" && !password && detail.data && detail.data.status !== "Approved") {
      const sugg = suggestPassword();
      setPassword(sugg);
      setConfirmPassword(sugg);
    }
  }, [status, detail.data, password]);

  const alreadyApproved = detail.data?.status === "Approved";
  const isApproving = status === "Approved" && !alreadyApproved;

  const passwordValid = password.length >= 8 && password === confirmPassword;

  const approve = useMutation({
    mutationFn: async () => (await api.post<ApproveResult>(
      `/platform/registration-requests/${id}/approve`,
      { password, sendWelcomeEmail }
    )).data,
    onSuccess: (data) => {
      setApproveResult(data);
      onAfterSave();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const save = useMutation({
    mutationFn: async () => (await api.patch(
      `/platform/registration-requests/${id}/status`,
      { status, reviewNotes: notes.trim() || null }
    )).data,
    onSuccess: () => { onAfterSave(); onClose(); },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const handleSave = () => {
    setErr(null);
    if (isApproving) {
      if (!passwordValid) {
        setErr(t("registrations.approve.errors.password"));
        return;
      }
      approve.mutate();
    } else {
      save.mutate();
    }
  };

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
                  disabled={alreadyApproved}
                  helperText={alreadyApproved ? t("registrations.approve.alreadyApproved") : undefined}
                >
                  {(["New","Reviewing","Approved","Rejected"] as RegistrationStatus[]).map(s => (
                    <MenuItem key={s} value={s}>{t(`registrations.status.${s}`)}</MenuItem>
                  ))}
                </TextField>

                {isApproving && (
                  <Box sx={{
                    border: "1px solid", borderColor: "rgba(34,140,87,0.32)",
                    bgcolor: "rgba(34,140,87,0.06)",
                    borderRadius: 2, p: 2.5
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                      <CheckCircleOutlineIcon sx={{ color: "success.main", fontSize: 22 }} />
                      <Typography fontWeight={700}>{t("registrations.approve.title")}</Typography>
                    </Stack>
                    <Typography fontSize={13.5} color="text.secondary" mb={2}>
                      {t("registrations.approve.lead")}
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label={t("registrations.approve.password")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        fullWidth
                        autoComplete="new-password"
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip title={t("registrations.approve.regenerate")}>
                                <IconButton size="small" onClick={() => {
                                  const s = suggestPassword();
                                  setPassword(s); setConfirmPassword(s);
                                }}>
                                  <AutorenewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t("registrations.approve.copy")}>
                                <IconButton size="small" onClick={() => {
                                  if (password) void navigator.clipboard.writeText(password);
                                }}>
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <IconButton size="small" onClick={() => setShowPassword(s => !s)}>
                                {showPassword
                                  ? <VisibilityOffOutlinedIcon fontSize="small" />
                                  : <VisibilityOutlinedIcon fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                        helperText={t("registrations.approve.passwordHelp")}
                      />
                      <TextField
                        label={t("registrations.approve.confirmPassword")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        fullWidth
                        autoComplete="new-password"
                        error={confirmPassword.length > 0 && confirmPassword !== password}
                        helperText={
                          confirmPassword.length > 0 && confirmPassword !== password
                            ? t("registrations.approve.errors.mismatch")
                            : undefined
                        }
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={sendWelcomeEmail}
                            onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography fontSize={14} fontWeight={600}>
                              {t("registrations.approve.sendWelcomeEmail")}
                            </Typography>
                            <Typography fontSize={12.5} color="text.secondary">
                              {t("registrations.approve.sendWelcomeEmailHelp")}
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: "flex-start", ".MuiCheckbox-root": { mt: -0.5 } }}
                      />
                    </Stack>
                  </Box>
                )}

                {approveResult && (
                  <Alert
                    severity={approveResult.emailError ? "warning" : "success"}
                    icon={<CheckCircleOutlineIcon fontSize="inherit" />}
                  >
                    <Typography fontWeight={700} mb={0.5}>
                      {t("registrations.approve.success.title", {
                        name: detail.data ? `${detail.data.firstName} ${detail.data.lastName}` : ""
                      })}
                    </Typography>
                    <Typography fontSize={13.5} mb={0.5}>
                      {t("registrations.approve.success.tenant")}: <strong>{approveResult.tenantCode}</strong>
                    </Typography>
                    <Typography fontSize={13.5}>
                      {approveResult.emailSent
                        ? t("registrations.approve.success.emailSent")
                        : approveResult.emailError
                          ? t("registrations.approve.success.emailFailed", { error: approveResult.emailError })
                          : t("registrations.approve.success.emailSkipped")}
                    </Typography>
                  </Alert>
                )}

                <TextField
                  label={t("registrations.detail.reviewNotes")}
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  multiline minRows={3} fullWidth
                  helperText={t("registrations.detail.reviewNotesHelp")}
                  disabled={isApproving}
                />
              </Stack>
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{approveResult ? t("common.close") : t("common.cancel")}</Button>
        {!approveResult && (
          <Button
            variant="contained"
            color={isApproving ? "success" : "primary"}
            disabled={!detail.data || save.isPending || approve.isPending ||
              (isApproving && !passwordValid)}
            onClick={handleSave}
          >
            {(save.isPending || approve.isPending)
              ? <CircularProgress size={18} />
              : isApproving
                ? t("registrations.approve.submit")
                : t("common.save")}
          </Button>
        )}
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
