import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, MenuItem, Snackbar, Stack, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePackages } from "../auth/PackagesContext";
import { useImpersonation } from "../impersonation/ImpersonationContext";
import { dateTime } from "../utils/format";

/**
 * Αίτημα Υποστήριξης
 *
 * The old page splashed raw JSON diagnostics on-screen which scared users.
 * Now: form on top, «Τα αιτήματά μου» table below with search + status
 * filter + pagination + row-click detail dialog. Diagnostics are still
 * captured — appended to the submitted body — but hidden from view.
 *
 * Submit path switched from /public/contact (email-only, no history) to
 * /support-tickets/mine (persists a SupportTicket for the current tenant
 * AND surfaces in the history table immediately).
 */

interface TicketDto {
  id: string; tenantId: string; tenantName: string; tenantCode: string;
  subject: string; body: string;
  priority: string; status: string; channel: string;
  assignee: string | null;
  openedAt: string; resolvedAt: string | null;
  replies: Array<{ id: string; at: string; author: string; body: string; notifiedTenant: boolean }>;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  Open:       { label: "Ανοιχτό",      bg: "rgba(217,119,6,0.14)",  fg: "#92590a", border: "#f59e0b88" },
  InProgress: { label: "Σε εξέλιξη",   bg: "rgba(29,78,137,0.14)",  fg: "#0b2545", border: "#1d4e8988" },
  Waiting:    { label: "Αναμονή",      bg: "rgba(100,116,139,0.14)",fg: "#334155", border: "#94a3b888" },
  Resolved:   { label: "Επιλύθηκε",    bg: "rgba(22,163,74,0.14)",  fg: "#146c3a", border: "#22c55e88" },
};
function renderStatusChip(status: string) {
  const s = STATUS_STYLES[status] ?? { label: status, bg: "rgba(100,116,139,0.14)", fg: "#334155", border: "#94a3b888" };
  return <Chip size="small" label={s.label}
    sx={{ bgcolor: s.bg, color: s.fg, borderColor: s.border, border: 1, fontWeight: 700 }} />;
}

export function SupportRequestPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { packages, isPlatformBypass } = usePackages();
  const { tenantId: impersonatedTenantId, tenantName: impersonatedTenantName } = useImpersonation();

  // Diagnostics still captured and shipped in the message body — just no
  // longer plastered across the screen. Kept for the support team's inbox.
  const diagnosticsText = useMemo(() => JSON.stringify({
    role: user?.role ?? "—",
    tenantId: user?.tenantId ?? "—",
    tenantName: user?.tenantName ?? "—",
    userId: user?.userId ?? "—",
    email: user?.email ?? "—",
    packages: Array.from(packages),
    isPlatformBypass,
    impersonating: !!impersonatedTenantId,
    impersonatedTenantId: impersonatedTenantId ?? null,
    impersonatedTenantName: impersonatedTenantName ?? null,
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "—",
    language: typeof navigator !== "undefined" ? navigator.language : "—",
    viewport: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "—",
    url: typeof window !== "undefined" ? window.location.href : "—",
    timestamp: new Date().toISOString()
  }, null, 2), [user, packages, isPlatformBypass, impersonatedTenantId, impersonatedTenantName]);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit$ = useMutation({
    mutationFn: async () => (await api.post<TicketDto>("/support-tickets/mine", {
      subject: subject.trim() || null,
      body: `${message.trim()}

──────────────── Διαγνωστικά (αυτόματα) ────────────────
${diagnosticsText}`
    })).data,
    onSuccess: (t) => {
      setSuccess(`Το αίτημά σας καταχωρήθηκε (αρ. ${t.id.slice(0, 8).toUpperCase()}). Θα σας απαντήσουμε στο email σας.`);
      setMessage(""); setSubject("");
      qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
    },
    onError: (e) => setError(extractErrorMessage(e, "Απέτυχε η αποστολή. Δοκιμάστε ξανά ή στείλτε email στο info@mykalypsis.gr.")),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!message.trim()) { setError("Γράψτε μια περιγραφή του προβλήματος."); return; }
    submit$.mutate();
  };

  // History table state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [detailTicket, setDetailTicket] = useState<TicketDto | null>(null);

  useEffect(() => { setPage(0); }, [search, status]);

  const historyQ = useQuery({
    queryKey: ["my-support-tickets", search, status],
    queryFn: async () => (await api.get<TicketDto[]>("/support-tickets/mine", {
      params: { search: search || undefined, status: status || undefined }
    })).data,
  });
  const rows = historyQ.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <BugReportIcon color="primary" sx={{ fontSize: 34 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Αίτημα Υποστήριξης</Typography>
          <Typography color="text.secondary">
            Στείλτε αίτημα στην ομάδα Kalypsis. Τα τεχνικά διαγνωστικά επισυνάπτονται αυτόματα στο μήνυμά σας.
          </Typography>
        </Box>
      </Stack>

      {/* Message form */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Νέο αίτημα</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
            Πείτε μας τι δεν λειτουργεί όπως περιμένατε. Όσο περισσότερες λεπτομέρειες, τόσο πιο γρήγορα σας απαντάμε.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
          <form onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Θέμα (προαιρετικό)" fullWidth
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="π.χ. Δεν βλέπω τη Γέφυρα ERGO" />
              <TextField label="Μήνυμα" fullWidth required multiline minRows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Τι προσπαθούσατε να κάνετε; Τι εμφανίστηκε; Πότε ξεκίνησε;" />
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ flex: 1 }} />
                <Button type="submit" variant="contained" size="large"
                  startIcon={submit$.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  disabled={submit$.isPending}>
                  {submit$.isPending ? "Αποστολή…" : "Αποστολή"}
                </Button>
              </Stack>
            </Stack>
          </form>
        </CardContent>
      </Card>

      {/* History table */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={2} flexWrap="wrap" useFlexGap>
            <HistoryIcon color="action" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Τα αιτήματά μου</Typography>
            <Box sx={{ flex: 1 }} />
            <TextField size="small" placeholder="Αναζήτηση σε θέμα/μήνυμα…"
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.disabled" }} />,
                endAdornment: search
                  ? <IconButton size="small" onClick={() => setSearch("")}><CloseIcon fontSize="small" /></IconButton>
                  : null
              }}
              sx={{ minWidth: 260 }} />
            <TextField select size="small" label="Κατάσταση"
              value={status} onChange={e => setStatus(e.target.value)}
              sx={{ minWidth: 160 }}>
              <MenuItem value="">Όλες</MenuItem>
              <MenuItem value="Open">Ανοιχτό</MenuItem>
              <MenuItem value="InProgress">Σε εξέλιξη</MenuItem>
              <MenuItem value="Waiting">Αναμονή</MenuItem>
              <MenuItem value="Resolved">Επιλύθηκε</MenuItem>
            </TextField>
          </Stack>

          {historyQ.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
          ) : rows.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
              Δεν υπάρχουν αιτήματα ακόμη.
            </Box>
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ημ/νία</TableCell>
                    <TableCell>Θέμα</TableCell>
                    <TableCell>Κατάσταση</TableCell>
                    <TableCell>Απαντήσεις</TableCell>
                    <TableCell align="right">Ενέργειες</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(t => (
                    <TableRow key={t.id} hover sx={{
                      cursor: "pointer",
                      "&:nth-of-type(even)": { bgcolor: "rgba(255,244,196,0.20)" },
                    }} onClick={() => setDetailTicket(t)}>
                      <TableCell>{dateTime(t.openedAt)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 420 }}>
                          {t.subject}
                        </Typography>
                        {/* First line of body as a hint. */}
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 420 }}>
                          {(t.body.split("\n")[0] ?? "").slice(0, 120)}
                        </Typography>
                      </TableCell>
                      <TableCell>{renderStatusChip(t.status)}</TableCell>
                      <TableCell>
                        {t.replies.length > 0
                          ? <Chip size="small" color="primary" label={t.replies.length} />
                          : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Άνοιγμα καρτέλας">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDetailTicket(t); }}>
                            <SearchIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={rows.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Γραμμές ανά σελίδα:"
                labelDisplayedRows={({ from: f, to: to2, count }) =>
                  `${f}–${to2} από ${count !== -1 ? count : `περισσότερα από ${to2}`}`}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Ticket detail dialog */}
      <Dialog open={!!detailTicket} onClose={() => setDetailTicket(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <BugReportIcon color="primary" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{detailTicket?.subject}</Typography>
              <Typography variant="caption" color="text.secondary">
                {detailTicket && dateTime(detailTicket.openedAt)} · αρ. {detailTicket?.id.slice(0, 8).toUpperCase()}
              </Typography>
            </Box>
            {detailTicket && renderStatusChip(detailTicket.status)}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="overline" color="text.secondary">Μήνυμα</Typography>
          {(() => {
            // Body has the JSON diagnostics appended below a sentinel
            // separator so ops staff have context; split it here so the
            // operator sees a clean message + an optional collapsed
            // «Διαγνωστικά» accordion instead of the raw JSON dump that
            // used to shove technical output in their face.
            const raw = detailTicket?.body ?? "";
            const marker = "──────────────── Διαγνωστικά (αυτόματα) ────────────────";
            const idx = raw.indexOf(marker);
            const userMsg = idx >= 0 ? raw.slice(0, idx).trim() : raw;
            const diag = idx >= 0 ? raw.slice(idx + marker.length).trim() : "";
            return (
              <>
                <Box sx={{
                  fontFamily: "inherit", fontSize: 14, lineHeight: 1.6,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  bgcolor: "rgba(11,37,69,0.03)", p: 2, borderRadius: 1, mb: 2,
                  border: "1px solid rgba(11,37,69,0.08)"
                }}>
                  {userMsg || "—"}
                </Box>
                {diag && (
                  <Accordion sx={{ mb: 2, "&:before": { display: "none" }, boxShadow: "none",
                    border: "1px solid rgba(11,37,69,0.08)", borderRadius: 1 }} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}
                      sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        Τεχνικά διαγνωστικά (auto)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <Box component="pre" sx={{
                        m: 0, p: 1.5, fontSize: 11.5, lineHeight: 1.5,
                        bgcolor: "rgba(11,37,69,0.03)", borderRadius: 1,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>{diag}</Box>
                    </AccordionDetails>
                  </Accordion>
                )}
              </>
            );
          })()}
          {(detailTicket?.replies?.length ?? 0) > 0 && (
            <>
              <Divider sx={{ my: 2 }}>Απαντήσεις</Divider>
              <Stack spacing={1.5}>
                {detailTicket!.replies.map(r => (
                  <Box key={r.id} sx={{
                    p: 1.5, borderRadius: 1.5, bgcolor: "rgba(22,163,74,0.05)",
                    border: "1px solid rgba(22,163,74,0.14)",
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" fontWeight={700}>{r.author}</Typography>
                      <Typography variant="caption" color="text.secondary">{dateTime(r.at)}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{r.body}</Typography>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailTicket(null)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!success}
        autoHideDuration={2200}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2, fontWeight: 600 }}>
          Το αίτημα καταχωρήθηκε
        </Alert>
      </Snackbar>
    </Box>
  );
}
